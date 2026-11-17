// TELUK HARAPAN — the game's rules and state, with no drawing and no browser in it:
// the city, the player on foot and by car, traffic and pedestrians, police and wanted level,
// thugs and the boss, missions across three days, shops and money. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react (sound, banner, save).
import { BOSS, CAR, CITY, DAYS, MISSIONS, PALETTE, PARKED_COUNT, PED_COUNT, PLAYER, POLICE_RAM_COOLDOWN, POLICE_RAM_DAMAGE, SHOPS, THUG, TRAFFIC_COUNT, WANTED_DECAY_SECONDS, blockOrigin, districtAt, streetCenter } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_MISSION = 2;
export const EVENT_WASTED = 4;
export const EVENT_WIN = 8;
export const EVENT_SHOT = 16;
export const EVENT_PUNCH = 32;
export const EVENT_PICKUP = 64;
export const EVENT_CRIME = 128;
export const EVENT_DAY = 256;
export const EVENT_BUY = 512;

const TAU = Math.PI * 2;
const CAR_COLORS = [0xd94f3d, 0x3d7bd9, 0xe8b93d, 0x4fae5a, 0xd9d9d9, 0x8a5ad9, 0x2a2a2e, 0xe87a2a];
const PED_COLORS = [0xe8e8e8, 0x3d7bd9, 0xe8b93d, 0x4fae5a, 0xd94f3d, 0x8a5ad9, 0x2a8a7a, 0xc96f3f];

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function turnToward(angle, target, maxStep) {
  const d = angDiff(angle, target);
  return angle + clamp(d, -maxStep, maxStep);
}

export function createWorld(random) {
  // ---- City layout (built once, from the seed) ----
  const buildings = [];
  const palms = [];
  const cranes = [];
  const lamps = [];
  for (let bx = 0; bx < CITY.blocks; bx += 1) {
    for (let bz = 0; bz < CITY.blocks; bz += 1) {
      const d = districtAt(bx, bz);
      const x0 = blockOrigin(bx), z0 = blockOrigin(bz);
      if (d.style === 'beach') {
        for (let i = 0; i < 3; i += 1) palms.push({ x: x0 + 8 + random.next() * 44, z: z0 + 8 + random.next() * 44 });
        buildings.push({ x: x0 + 30, z: z0 + 30, hw: 8, hd: 6, h: 5, color: 0xd9c9a0, roof: 0x8a7a5a, district: d.id });
        continue;
      }
      if (d.style === 'civic') {
        buildings.push({ x: x0 + 14, z: z0 + 14, hw: 10, hd: 8, h: 10, color: d.color, roof: d.roof, district: d.id });
        buildings.push({ x: x0 + 46, z: z0 + 42, hw: 8, hd: 8, h: 8, color: d.color, roof: d.roof, district: d.id });
        continue;
      }
      // Four buildings per block, with a courtyard gap in the middle.
      const cells = [[11, 11], [40, 11], [11, 40], [40, 40]];
      for (const [cx, cz] of cells) {
        const w = 16 + random.next() * 6, dep = 14 + random.next() * 6;
        const h = d.hMin + random.next() * (d.hMax - d.hMin);
        buildings.push({ x: x0 + cx, z: z0 + cz, hw: w / 2, hd: dep / 2, h, color: d.color, roof: d.roof, district: d.id });
      }
      if (d.style === 'warehouse') cranes.push({ x: x0 + 30, z: z0 + 30, h: 34 + random.next() * 10 });
    }
  }
  for (let i = 0; i <= 7; i += 1) {
    for (let j = 0; j <= 7; j += 1) {
      if ((i + j) % 2 === 0) lamps.push({ x: streetCenter(i) + 6, z: streetCenter(j) + 6 });
    }
  }
  // Spatial hash so collision checks only look at nearby buildings.
  const buckets = new Map();
  function bucketKey(x, z) { return `${Math.floor(x / 60)},${Math.floor(z / 60)}`; }
  buildings.forEach((b, i) => {
    const k = bucketKey(b.x, b.z);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(i);
  });
  function nearbyBuildings(x, z) {
    const out = [];
    const bx = Math.floor(x / 60), bz = Math.floor(z / 60);
    for (let ox = -1; ox <= 1; ox += 1) for (let oz = -1; oz <= 1; oz += 1) {
      const list = buckets.get(`${bx + ox},${bz + oz}`);
      if (list) for (const i of list) out.push(buildings[i]);
    }
    return out;
  }
  function collideCircle(pos, r) {
    for (const b of nearbyBuildings(pos.x, pos.z)) {
      const cx = clamp(pos.x, b.x - b.hw, b.x + b.hw);
      const cz = clamp(pos.z, b.z - b.hd, b.z + b.hd);
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 < 1e-6) { pos.x += r; continue; }
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * r;
      pos.z = cz + (dz / d) * r;
    }
    pos.x = clamp(pos.x, -CITY.half + 2, CITY.half - 2);
    pos.z = clamp(pos.z, -CITY.half + 2, CITY.half - 2);
  }

  // ---- Dynamic state ----
  const state = {
    buildings, palms, cranes, lamps, shops: SHOPS,
    player: { x: -192, z: 104, angle: 0, hp: PLAYER.hp, money: PLAYER.startMoney, ammo: PLAYER.startAmmo, inCar: null, speed: 0, punchCd: 0, shootCd: 0, invuln: 0 },
    cars: [], peds: [], thugs: [], bullets: [], passenger: null,
    mission: { day: 0, index: 0, phase: 'go', target: { x: -192, z: 178 }, timer: 0, progress: 0, checkpoint: 0 },
    wanted: 0, wantedTimer: 0, day: 0, time: 0, won: false, over: false,
    message: '', messageTimer: 0,
    stats: { kills: 0, missions: 0, stolen: 0, shots: 0 },
  };

  function spawnTraffic() {
    state.cars = [];
    let id = 0;
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const sx = random.int(0, 6), sz = random.int(0, 6);
      const x1 = streetCenter(sx), z1 = streetCenter(sz);
      const x2 = streetCenter(random.int(0, 7)), z2 = streetCenter(random.int(0, 7));
      state.cars.push({ id: id++, x: x1, z: z1, angle: random.next() * TAU, speed: 0, color: random.pick(CAR_COLORS), kind: 'traffic', loop: [x1, z1, x2, z2], wp: 0, ramCd: 0 });
    }
    for (let i = 0; i < PARKED_COUNT; i += 1) {
      const spots = [[-185, 100], [-185, -40], [25, 100], [100, -185], [170, 25], [-40, 170], [100, 170], [-185, -185]];
      const [x, z] = spots[i % spots.length];
      state.cars.push({ id: id++, x, z, angle: (i % 2 === 0 ? 0 : Math.PI / 2), speed: 0, color: random.pick(CAR_COLORS), kind: 'parked', loop: null, wp: 0, ramCd: 0 });
    }
  }
  function spawnPeds() {
    state.peds = [];
    for (let i = 0; i < PED_COUNT; i += 1) {
      const bx = random.int(0, 6), bz = random.int(0, 6);
      const x = blockOrigin(bx) - 4 + random.next() * 4, z = blockOrigin(bz) + random.next() * 60;
      state.peds.push({ x, z, angle: random.next() * TAU, speed: 1.6 + random.next() * 1.2, color: random.pick(PED_COLORS), tx: x, tz: z, flee: 0 });
    }
  }
  function setMessage(text, seconds = 3) { state.message = text; state.messageTimer = seconds; }

  function spawnThugs(x, z, count, boss) {
    for (let i = 0; i < count; i += 1) {
      const a = random.next() * TAU, r = 4 + random.next() * 8;
      const t = { x: clamp(x + Math.cos(a) * r, -250, 250), z: clamp(z + Math.sin(a) * r, -250, 250), angle: 0, hp: boss && i === 0 ? BOSS.hp : THUG.hp, boss: !!(boss && i === 0), cd: 0, flash: 0 };
      state.thugs.push(t);
    }
  }

  function activateMission(index) {
    const def = MISSIONS[index];
    state.mission.index = index;
    state.mission.day = def.day;
    state.day = def.day;
    state.mission.progress = 0;
    state.mission.checkpoint = 0;
    state.thugs = [];
    state.passenger = null;
    if (def.type === 'goto' || def.type === 'fight' || def.type === 'boss') {
      state.mission.phase = def.type === 'goto' ? 'go' : 'fight';
      state.mission.target = { x: def.x, z: def.z };
      if (def.type === 'fight') spawnThugs(def.x, def.z, def.count, false);
      if (def.type === 'boss') spawnThugs(def.x, def.z, 4, true);
    } else if (def.type === 'deliver' || def.type === 'taxi') {
      state.mission.phase = 'pickup';
      state.mission.target = { x: def.px, z: def.pz };
    } else if (def.type === 'race') {
      state.mission.phase = 'race';
      state.mission.target = { x: def.points[0][0], z: def.points[0][1] };
    } else if (def.type === 'evade') {
      state.mission.phase = 'evade';
      state.mission.target = null;
      state.wanted = def.wanted;
      state.wantedTimer = 0;
    }
    state.mission.timer = def.time || 0;
    setMessage(`${def.name}: ${def.text}`, 4);
  }

  function completeMission() {
    const def = MISSIONS[state.mission.index];
    state.player.money += def.reward;
    state.stats.missions += 1;
    setMessage(`${def.name} selesai! +$${def.reward}`, 3.5);
    const next = state.mission.index + 1;
    if (next >= MISSIONS.length) { state.won = true; return EVENT_WIN; }
    const prevDay = state.mission.day;
    activateMission(next);
    return EVENT_MISSION | (state.mission.day > prevDay ? EVENT_DAY : 0);
  }

  function addWanted(n) {
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.wantedTimer = 0;
  }

  function reset() {
    state.player.x = -192; state.player.z = 104; state.player.angle = 0;
    state.player.hp = PLAYER.hp; state.player.money = PLAYER.startMoney; state.player.ammo = PLAYER.startAmmo;
    state.player.inCar = null; state.player.speed = 0; state.player.punchCd = 0; state.player.shootCd = 0; state.player.invuln = 0;
    state.bullets = []; state.thugs = []; state.passenger = null;
    state.wanted = 0; state.wantedTimer = 0; state.time = 0; state.won = false; state.over = false;
    state.stats = { kills: 0, missions: 0, stolen: 0, shots: 0 };
    spawnTraffic();
    spawnPeds();
    activateMission(0);
  }

  function nearestCar(maxDist, kinds) {
    const p = state.player;
    let best = null, bestD = maxDist * maxDist;
    for (const c of state.cars) {
      if (kinds && !kinds.includes(c.kind)) continue;
      const d = dist2(p.x, p.z, c.x, c.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function enterCar() {
    const p = state.player;
    if (p.inCar !== null) {
      const car = state.cars.find((c) => c.id === p.inCar);
      if (car) { car.x = p.x; car.z = p.z; car.angle = p.angle; car.speed = 0; car.kind = 'parked'; }
      p.inCar = null; p.speed = 0;
      setMessage('Keluar mobil', 1.2);
      return;
    }
    const car = nearestCar(5, ['parked']);
    if (car) {
      p.inCar = car.id; car.kind = 'driven'; p.angle = car.angle; p.speed = 0;
      setMessage('Naik mobil', 1.2);
      return;
    }
    const busy = nearestCar(5, ['traffic']);
    if (busy) {
      busy.kind = 'driven'; busy.driver = false;
      p.inCar = busy.id; p.angle = busy.angle; p.speed = 0;
      state.stats.stolen += 1;
      addWanted(1);
      setMessage('Mobil dicuri! Wanted +1', 2);
    }
  }

  function shoot() {
    const p = state.player;
    if (p.ammo <= 0 || p.shootCd > 0) return 0;
    p.ammo -= 1; p.shootCd = PLAYER.shootCooldown; state.stats.shots += 1;
    const dx = Math.cos(p.angle), dz = Math.sin(p.angle);
    state.bullets.push({ x: p.x + dx * 2, z: p.z + dz * 2, dx, dz, life: 0.9 });
    return EVENT_SHOT;
  }

  function punch() {
    const p = state.player;
    if (p.punchCd > 0) return 0;
    p.punchCd = PLAYER.punchCooldown;
    let hit = false;
    for (const t of state.thugs) {
      const d = Math.sqrt(dist2(p.x, p.z, t.x, t.z));
      if (d > PLAYER.punchRange) continue;
      const a = Math.atan2(t.z - p.z, t.x - p.x);
      if (Math.abs(angDiff(p.angle, a)) > 1.2) continue;
      t.hp -= PLAYER.punchDamage; t.flash = 0.15;
      t.x += Math.cos(a) * 2; t.z += Math.sin(a) * 2;
      hit = true;
      if (t.hp <= 0) { state.stats.kills += 1; }
    }
    state.thugs = state.thugs.filter((t) => t.hp > 0);
    return hit ? EVENT_PUNCH : 0;
  }

  function nearestShop() {
    const p = state.player;
    let best = null, bestD = 36;
    for (const s of SHOPS) {
      const d = dist2(p.x, p.z, s.x, s.z);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  function tryBuy() {
    const s = nearestShop();
    const p = state.player;
    if (!s || p.money < s.price) return 0;
    if (s.kind === 'heal' && p.hp >= PLAYER.hp) return 0;
    if (s.kind === 'ammo' && p.ammo >= 120) return 0;
    p.money -= s.price;
    if (s.kind === 'heal') p.hp = PLAYER.hp;
    else if (s.kind === 'ammo') p.ammo += 12;
    else if (s.kind === 'repair' && p.inCar !== null) { /* car is fine: small cash back flavour */ p.money += 0; }
    setMessage(`${s.name}: -$${s.price}`, 2);
    return EVENT_BUY;
  }

  function damagePlayer(amount) {
    const p = state.player;
    if (p.invuln > 0) return 0;
    p.hp -= amount;
    p.invuln = 0.7;
    if (p.hp <= 0) { p.hp = 0; state.over = true; return EVENT_HIT | EVENT_WASTED; }
    return EVENT_HIT;
  }

  function stepTraffic(dt) {
    for (const c of state.cars) {
      if (c.kind !== 'traffic') continue;
      const [x1, z1, x2, z2] = c.loop;
      const corners = [[x1, z1], [x2, z1], [x2, z2], [x1, z2]];
      const [tx, tz] = corners[c.wp];
      const dx = tx - c.x, dz = tz - c.z;
      const d = Math.hypot(dx, dz);
      if (d < 3) { c.wp = (c.wp + 1) % 4; continue; }
      const want = Math.atan2(dz, dx);
      c.angle = turnToward(c.angle, want, 2.4 * dt);
      // Slow down for anything right ahead (player car, police, another car).
      let blocked = false;
      const aheadX = c.x + Math.cos(c.angle) * 7, aheadZ = c.z + Math.sin(c.angle) * 7;
      const p = state.player;
      if (p.inCar !== null && dist2(aheadX, aheadZ, p.x, p.z) < 16) blocked = true;
      for (const o of state.cars) {
        if (o === c || o.kind === 'parked') continue;
        if (dist2(aheadX, aheadZ, o.x, o.z) < 12) { blocked = true; break; }
      }
      const target = blocked ? 0 : 9 + (c.id % 3);
      c.speed += clamp(target - c.speed, -20 * dt, 8 * dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.z += Math.sin(c.angle) * c.speed * dt;
      collideCircle(c, CAR.radius);
    }
  }

  function stepPeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      const dPlayer = Math.sqrt(dist2(ped.x, ped.z, p.x, p.z));
      if (state.wanted >= 2 && dPlayer < 26) ped.flee = 2.5;
      if (ped.flee > 0) {
        ped.flee -= dt;
        const a = Math.atan2(ped.z - p.z, ped.x - p.x);
        ped.x += Math.cos(a) * 5 * dt; ped.z += Math.sin(a) * 5 * dt;
        ped.angle = a;
      } else {
        const dx = ped.tx - ped.x, dz = ped.tz - ped.z;
        const d = Math.hypot(dx, dz);
        if (d < 2) {
          ped.tx = clamp(ped.x + (random.next() - 0.5) * 120, -250, 250);
          ped.tz = clamp(ped.z + (random.next() - 0.5) * 120, -250, 250);
        } else {
          ped.angle = turnToward(ped.angle, Math.atan2(dz, dx), 3 * dt);
          ped.x += Math.cos(ped.angle) * ped.speed * dt;
          ped.z += Math.sin(ped.angle) * ped.speed * dt;
        }
      }
      collideCircle(ped, 0.8);
    }
  }

  function stepPolice(dt) {
    const p = state.player;
    const wantCount = state.wanted;
    let police = state.cars.filter((c) => c.kind === 'police');
    while (police.length < wantCount) {
      const a = random.next() * TAU;
      const x = clamp(p.x + Math.cos(a) * 90, -250, 250), z = clamp(p.z + Math.sin(a) * 90, -250, 250);
      const id = Math.max(0, ...state.cars.map((c) => c.id)) + 1;
      const car = { id, x, z, angle: 0, speed: 0, color: PALETTE.police, kind: 'police', loop: null, wp: 0, ramCd: 0 };
      state.cars.push(car);
      police.push(car);
    }
    while (police.length > wantCount) {
      const gone = police.pop();
      state.cars = state.cars.filter((c) => c !== gone);
    }
    for (const car of police) {
      car.ramCd -= dt;
      const want = Math.atan2(p.z - car.z, p.x - car.x);
      car.angle = turnToward(car.angle, want, 2.6 * dt);
      const target = 24 + state.wanted;
      car.speed += clamp(target - car.speed, -24 * dt, 10 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.z += Math.sin(car.angle) * car.speed * dt;
      collideCircle(car, CAR.radius);
      const d = Math.sqrt(dist2(car.x, car.z, p.x, p.z));
      if (d < 4.2 && car.ramCd <= 0) {
        car.ramCd = POLICE_RAM_COOLDOWN;
        car.speed *= 0.4;
        if (p.inCar !== null) p.speed *= 0.55;
        return damagePlayer(p.inCar !== null ? 5 : POLICE_RAM_DAMAGE);
      }
    }
    return 0;
  }

  function stepThugs(dt) {
    const p = state.player;
    let events = 0;
    for (const t of state.thugs) {
      t.cd -= dt;
      if (t.flash > 0) t.flash -= dt;
      const d = Math.sqrt(dist2(t.x, t.z, p.x, p.z));
      if (d > THUG.range && !t.boss) continue;
      if (t.boss && d > BOSS.range) continue;
      const want = Math.atan2(p.z - t.z, p.x - t.x);
      t.angle = turnToward(t.angle, want, 4 * dt);
      const speed = t.boss ? BOSS.speed : THUG.speed;
      if (d > (t.boss ? BOSS.punchRange : THUG.punchRange)) {
        t.x += Math.cos(t.angle) * speed * dt;
        t.z += Math.sin(t.angle) * speed * dt;
        collideCircle(t, 1);
      } else if (t.cd <= 0) {
        t.cd = t.boss ? BOSS.cooldown : THUG.cooldown;
        events |= damagePlayer(t.boss ? BOSS.damage : THUG.damage);
      }
    }
    return events;
  }

  function stepBullets(dt) {
    for (const b of state.bullets) {
      b.life -= dt;
      b.x += b.dx * PLAYER.bulletSpeed * dt;
      b.z += b.dz * PLAYER.bulletSpeed * dt;
      for (const t of state.thugs) {
        if (dist2(b.x, b.z, t.x, t.z) < 2.6) {
          t.hp -= PLAYER.bulletDamage; t.flash = 0.15; b.life = 0;
          if (t.hp <= 0) state.stats.kills += 1;
          break;
        }
      }
      if (b.life > 0) {
        for (const bd of nearbyBuildings(b.x, b.z)) {
          if (Math.abs(b.x - bd.x) < bd.hw && Math.abs(b.z - bd.z) < bd.hd) { b.life = 0; break; }
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
    const before = state.thugs.length;
    state.thugs = state.thugs.filter((t) => t.hp > 0);
    return before - state.thugs.length;
  }

  function stepMission(dt) {
    const m = state.mission;
    const def = MISSIONS[m.index];
    const p = state.player;
    if (m.timer > 0) {
      m.timer -= dt;
      if (m.timer <= 0) {
        if (m.phase === 'evade') {
          // For evade the countdown IS the goal: survive it and the heat is off.
          state.wanted = 0;
          return completeMission();
        }
        setMessage('Waktu habis — misi diulang', 3);
        activateMission(m.index);
        return 0;
      }
    }
    const at = (x, z, r) => dist2(p.x, p.z, x, z) < r * r;
    if (m.phase === 'go') {
      if (at(def.x, def.z, 6)) return completeMission();
    } else if (m.phase === 'pickup') {
      if (at(def.px, def.pz, 6)) {
        m.phase = 'drop';
        m.target = { x: def.x, z: def.z };
        m.timer = def.time || 0;
        if (def.type === 'taxi') {
          state.passenger = { x: def.px, z: def.pz, angle: 0, speed: 6, color: 0xe8b93d, tx: def.px, tz: def.pz, flee: 0 };
        }
        setMessage(def.type === 'taxi' ? 'Penumpang naik — antar ke tujuan!' : 'Paket diambil — antar ke tujuan!', 2.5);
        return EVENT_PICKUP;
      }
    } else if (m.phase === 'drop') {
      if (at(def.x, def.z, 6)) return completeMission();
    } else if (m.phase === 'fight') {
      if (state.thugs.length === 0) return completeMission();
    } else if (m.phase === 'race') {
      const [cx, cz] = def.points[m.checkpoint];
      m.target = { x: cx, z: cz };
      if (p.inCar !== null && at(cx, cz, 10)) {
        m.checkpoint += 1;
        if (m.checkpoint >= def.points.length) return completeMission();
        setMessage(`Titik ${m.checkpoint + 1}/${def.points.length}`, 1.5);
      }
    } else if (m.phase === 'evade') {
      if (m.timer <= 0) {
        state.wanted = 0;
        return completeMission();
      }
    }
    return 0;
  }

  function step(dt, input) {
    if (state.over || state.won) return 0;
    let events = 0;
    state.time += dt;
    const p = state.player;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (state.messageTimer > 0) { state.messageTimer -= dt; if (state.messageTimer <= 0) state.message = ''; }

    // --- Player movement ---
    if (p.inCar !== null) {
      const car = state.cars.find((c) => c.id === p.inCar);
      if (car) {
        if (input.up) car.speed += CAR.accel * dt;
        else if (input.down) car.speed -= CAR.brake * dt;
        else car.speed -= Math.sign(car.speed) * 8 * dt;
        if (Math.abs(car.speed) < 0.2 && !input.up && !input.down) car.speed = 0;
        car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
        const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
        const steerRate = CAR.steer * Math.max(0.35, Math.min(1, car.speed / 10));
        car.angle += steer * steerRate * dt * (car.speed < 0 ? -1 : 1);
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.z += Math.sin(car.angle) * car.speed * dt;
        collideCircle(car, CAR.radius);
        p.x = car.x; p.z = car.z; p.angle = car.angle; p.speed = car.speed;
        // Bumping traffic slows you a little.
        for (const o of state.cars) {
          if (o === car || o.kind === 'parked') continue;
          if (dist2(car.x, car.z, o.x, o.z) < 16) { car.speed *= 0.985; }
        }
      } else { p.inCar = null; }
    } else {
      const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      p.angle += turn * 3.2 * dt;
      const speed = input.run ? PLAYER.run : PLAYER.walk;
      let mx = 0, mz = 0;
      if (input.up) { mx += Math.cos(p.angle); mz += Math.sin(p.angle); }
      if (input.down) { mx -= Math.cos(p.angle); mz -= Math.sin(p.angle); }
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        p.x += (mx / len) * speed * dt;
        p.z += (mz / len) * speed * dt;
        p.speed = speed;
      } else p.speed = 0;
      collideCircle(p, PLAYER.radius);
    }
    if (input.enter) enterCar();
    if (input.punch) events |= punch();
    if (input.shoot) events |= shoot();
    if (input.buy) events |= tryBuy();

    // Passenger follows the player after pickup.
    if (state.passenger) {
      const pas = state.passenger;
      const d = Math.sqrt(dist2(pas.x, pas.z, p.x, p.z));
      if (d > 4) {
        const a = Math.atan2(p.z - pas.z, p.x - pas.x);
        pas.x += Math.cos(a) * 7 * dt; pas.z += Math.sin(a) * 7 * dt;
        collideCircle(pas, 0.8);
      }
    }

    stepTraffic(dt);
    stepPeds(dt);
    events |= stepPolice(dt);
    events |= stepThugs(dt);
    stepBullets(dt);
    events |= stepMission(dt);

    // Wanted decays when quiet: no crime and no police close by.
    state.wantedTimer += dt;
    if (state.wanted > 0 && state.mission.phase !== 'evade') {
      const nearPolice = state.cars.some((c) => c.kind === 'police' && dist2(c.x, c.z, p.x, p.z) < 2500);
      if (!nearPolice && state.wantedTimer > WANTED_DECAY_SECONDS) {
        state.wanted -= 1;
        state.wantedTimer = 0;
        setMessage('Wanted turun', 1.5);
      }
    }
    if (state.over) events |= EVENT_WASTED;
    return events;
  }

  function districtNameAt(x, z) {
    const bx = clamp(Math.floor((x + CITY.half - CITY.street / 2) / BLOCK_STEP), 0, 6);
    const bz = clamp(Math.floor((z + CITY.half - CITY.street / 2) / BLOCK_STEP), 0, 6);
    return districtAt(bx, bz).name;
  }

  function snapshot() {
    return { money: state.player.money, hp: state.player.hp, ammo: state.player.ammo, day: state.day, mission: state.mission.index };
  }
  function restore(snap) {
    state.player.money = snap.money; state.player.hp = snap.hp; state.player.ammo = snap.ammo;
    activateMission(snap.mission);
  }
  // For deterministic screenshots: jump straight into a mission / situation.
  function setMission(index) { activateMission(index); }
  function teleport(x, z, angle, carId) {
    const p = state.player;
    p.x = x; p.z = z; p.angle = angle;
    if (carId !== undefined && carId !== null) {
      const car = state.cars.find((c) => c.id === carId);
      if (car) { car.kind = 'driven'; car.x = x; car.z = z; car.angle = angle; car.speed = 0; p.inCar = car.id; }
    }
  }
  function forceWanted(n) { state.wanted = n; state.wantedTimer = 0; }

  reset();
  return { state, reset, step, tryBuy, nearestShop, snapshot, restore, setMission, teleport, forceWanted, districtNameAt, addWanted };
}
