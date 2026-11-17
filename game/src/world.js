// Simulasi kota Teluk Harapan: tanpa gambar, tanpa browser. Bangunan, jalan, lalu lintas,
// pejalan kaki, polisi, helikopter, perahu, musuh, tabrakan. step() maju satu langkah tetap
// dan mencatat kejadian di world.events agar main.js bisa bereaksi (suara, misi, HUD).
import { CITY, DISTRICTS, PALETTE, PLAYER, PLACES, ROADS, VEHICLES, WANTED } from './config.js';
import { pick, range } from './random.js';

export const EVENT_DAMAGE = 1;
export const EVENT_KILL = 2;
export const EVENT_CRASH = 4;

let nextId = 1;

function aabb(x, z, w, d) {
  return { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 };
}

function circleHitsAABB(x, z, r, b) {
  const cx = Math.max(b.x0, Math.min(x, b.x1));
  const cz = Math.max(b.z0, Math.min(z, b.z1));
  const dx = x - cx, dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

function pushOutCircle(x, z, r, b) {
  const cx = Math.max(b.x0, Math.min(x, b.x1));
  const cz = Math.max(b.z0, Math.min(z, b.z1));
  let dx = x - cx, dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 < 1e-6) { dx = 0; dz = -1; }
  const d = Math.sqrt(dx * dx + dz * dz) || 1;
  const push = r - d;
  return { x: x + (dx / d) * push, z: z + (dz / d) * push };
}

function inWater(x, z) {
  return x < CITY.waterWest || z > CITY.waterSouth;
}

function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[6];
}

export function createWorld(rand) {
  const buildings = [];
  const lamps = [];
  const trees = [];
  const crates = [];
  // Isi blok-blok kota dengan bangunan. Blok berpusat di tengah-tengah jalan
  // (pusat = gx*65+32.5), jadi bangunan tidak pernah menutup jalan: bangunan
  // maksimal 21 unit dari pusat blok, tepi dalam jalan ada di 28 unit.
  for (let gx = -4; gx <= 3; gx++) {
    for (let gz = -4; gz <= 3; gz++) {
      const cx = gx * 65 + 32.5, cz = gz * 65 + 32.5;
      if (Math.abs(cx) === 32.5 && Math.abs(cz) === 32.5) { // Alun-Alun: air mancur + pepohonan
        trees.push({ x: -28, z: -28, s: 1.4 }, { x: 28, z: -28, s: 1.2 }, { x: -28, z: 28, s: 1.3 }, { x: 28, z: 28, s: 1.1 });
        continue;
      }
      if (cx < -130 && cz > 130) continue; // Pantai Senja: pasir, bukan bangunan
      if (cx < -130 && cz < -130) continue; // Mercusuar: bukit + mercusuar
      if (cx < -130) continue; // Pelabuhan: gudang pelabuhan + derek (dibangun di bawah)
      const d = districtAt(cx, cz);
      const n = d.style === 'cbd' ? 1 : d.style === 'market' ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const w = range(rand, 14, 26), dd = range(rand, 14, 26);
        const x = cx + range(rand, -8, 8), z = cz + range(rand, -8, 8);
        const h = d.style === 'cbd' ? range(rand, 42, 95) : d.style === 'houses' ? range(rand, 8, 16) : d.style === 'warehouse' ? range(rand, 10, 18) : range(rand, 12, 30);
        buildings.push({ x, z, w, d: dd, h, color: pick(rand, PALETTE.building), glass: d.style === 'cbd', style: d.style });
      }
      if (rand() < 0.7) trees.push({ x: cx + range(rand, -24, 24), z: cz + range(rand, -24, 24), s: range(rand, 0.8, 1.4) });
    }
  }
  // Pelabuhan: deretan gudang + derek kontainer di tepi air (di dalam blok, jauh dari jalan).
  for (let i = 0; i < 4; i++) {
    const z = -90 + i * 60;
    buildings.push({ x: -212, z, w: 20, d: 34, h: range(rand, 12, 20), color: 0x6a5a4a, glass: false, style: 'warehouse' });
    crates.push({ x: -225, z: z + 8, w: 8, d: 8, h: 4 });
    crates.push({ x: -225, z: z - 12, w: 6, d: 6, h: 3 });
  }
  // Mercusuar: menara di bukit barat laut (di dalam blok, tidak menutup jalan).
  buildings.push({ x: -208, z: -208, w: 10, d: 10, h: 46, color: 0xe8e0d0, glass: false, style: 'lighthouse' });
  // Lampu jalan di tiap persimpangan.
  for (const rx of ROADS) for (const rz of ROADS) lamps.push({ x: rx + 4, z: rz + 4 });
  // Pohon pantai.
  for (let i = 0; i < 8; i++) trees.push({ x: -240 + rand() * 100, z: 150 + rand() * 80, s: range(rand, 1, 1.6) });

  const vehicles = [];
  function addVehicle(type, x, z, angle, parked) {
    const v = { id: nextId++, type, x, z, angle, speed: 0, hp: VEHICLES[type].hp, parked: !!parked, driver: 'none', color: VEHICLES[type].color, target: null, ramCd: 0 };
    vehicles.push(v);
    return v;
  }
  // Mobil parkir di jalan-jalan.
  const parkSpots = [[-65, -32, 0], [65, 32, 0], [130, -32, 1], [-130, 32, 0], [0, -195, 0], [195, 65, 1], [-32, 130, 0], [32, -65, 1], [-195, 65, 0], [65, 195, 1], [-130, -195, 0], [195, -65, 1]];
  const parkTypes = ['sedan', 'sedan', 'taxi', 'sedan', 'truck', 'sedan', 'moto', 'sedan', 'taxi', 'sedan', 'moto', 'truck'];
  parkSpots.forEach((s, i) => addVehicle(parkTypes[i], s[0], s[1], s[2] * Math.PI / 2, true));
  // Perahu di dermaga.
  addVehicle('boat', -242, 120, Math.PI / 2, true);
  addVehicle('boat', -242, -60, Math.PI / 2, true);
  // Lalu lintas berjalan (24 mobil).
  const traffic = [];
  for (let i = 0; i < 24; i++) {
    const horizontal = rand() < 0.5;
    const road = pick(rand, ROADS);
    const along = range(rand, -240, 240);
    const type = rand() < 0.12 ? 'truck' : rand() < 0.2 ? 'taxi' : 'sedan';
    const v = addVehicle(type, horizontal ? along : road, horizontal ? road : along, horizontal ? (rand() < 0.5 ? 0 : Math.PI) : (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2), false);
    v.driver = 'traffic';
    v.speed = range(rand, 10, 18);
    v.horizontal = horizontal;
    traffic.push(v);
  }
  // Perahu patroli di pelabuhan.
  const boats = [];
  for (let i = 0; i < 3; i++) {
    const b = addVehicle('boat', -245, -120 + i * 110, Math.PI / 2, false);
    b.driver = 'boat'; b.speed = range(rand, 4, 8); b.patrol = true;
    boats.push(b);
  }
  // Pejalan kaki (30).
  const peds = [];
  for (let i = 0; i < 30; i++) {
    peds.push({ x: range(rand, -240, 240), z: range(rand, -240, 220), angle: rand() * Math.PI * 2, speed: range(rand, 1.2, 2.4), tx: 0, tz: 0, flee: 0, color: pick(rand, [0xe8b04b, 0x7ab648, 0xc65a8a, 0x5aa8c6, 0xd8d8d8]) });
  }

  const world = {
    rand, buildings, lamps, trees, crates, vehicles, traffic, boats, peds,
    enemies: [], police: [], heli: { x: 0, z: 0, y: 46, angle: 0, active: false },
    player: {
      x: PLACES.rumah.x, z: PLACES.rumah.z, angle: Math.PI, hp: PLAYER.hp, maxHp: PLAYER.maxHp,
      ammo: PLAYER.startAmmo, money: 0, onFoot: true, vehicleId: 0, wanted: 0, speed: 0,
      armor: 0, engine: false, damage: false, safehouse: false,
    },
    time: 0, events: [], gunshotAt: -100, phase: 0,
  };
  return world;
}

export function collideWorld(world, x, z, r) {
  // Batas kota + air (pejalan kaki & mobil darat tidak bisa masuk air).
  x = Math.max(-258, Math.min(258, x));
  z = Math.max(-258, Math.min(258, z));
  if (inWater(x, z)) {
    if (x < CITY.waterWest) x = CITY.waterWest + r;
    if (z > CITY.waterSouth) z = CITY.waterSouth - r;
  }
  for (const b of world.buildings) {
    const box = aabb(b.x, b.z, b.w, b.d);
    if (circleHitsAABB(x, z, r, box)) {
      const out = pushOutCircle(x, z, r, box);
      if (out) { x = out.x; z = out.z; }
    }
  }
  return { x, z };
}

function nearestVehicle(world, x, z, maxDist, filter) {
  let best = null, bestD = maxDist;
  for (const v of world.vehicles) {
    if (filter && !filter(v)) continue;
    const dx = v.x - x, dz = v.z - z, d = Math.hypot(dx, dz);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

export function enterVehicle(world, vehicle) {
  const p = world.player;
  p.onFoot = false; p.vehicleId = vehicle.id; vehicle.driver = 'player'; vehicle.parked = false;
  p.x = vehicle.x; p.z = vehicle.z; p.angle = vehicle.angle;
}

export function exitVehicle(world) {
  const p = world.player;
  const v = world.vehicles.find((vv) => vv.id === p.vehicleId);
  if (!v) return;
  v.driver = 'none'; v.parked = true; v.speed = 0;
  p.onFoot = true; p.vehicleId = 0;
  const nx = v.x + Math.cos(v.angle + Math.PI / 2) * 4, nz = v.z + Math.sin(v.angle + Math.PI / 2) * 4;
  const out = collideWorld(world, nx, nz, PLAYER.radius);
  p.x = out.x; p.z = out.z; p.speed = 0;
}

export function spawnEnemy(world, kind, x, z, hp) {
  const e = { id: nextId++, kind, x, z, angle: 0, hp: hp ?? (kind === 'boss' ? 320 : kind === 'guard' ? 70 : 50), shootCd: range(world.rand, 0.5, 1.5), speed: kind === 'boss' ? 4.5 : 5.5, tx: x, tz: z };
  world.enemies.push(e);
  return e;
}

export function spawnPoliceCar(world, x, z) {
  const v = { id: nextId++, type: 'police', x, z, angle: 0, speed: 0, hp: VEHICLES.police.hp, parked: false, driver: 'police', color: VEHICLES.police.color, target: null, ramCd: 0 };
  world.vehicles.push(v);
  world.police.push(v);
  return v;
}

export function damageVehicle(world, v, amount, fromPlayer) {
  v.hp -= amount;
  if (v.hp <= 0) {
    v.hp = 0; v.speed = 0;
    if (v.driver === 'player') { world.events.push({ type: 'carDead' }); }
    if (v.driver === 'traffic' || v.driver === 'police') { v.driver = 'none'; v.parked = true; }
    if (fromPlayer && v.driver === 'police') world.events.push({ type: 'copDown' });
    return true;
  }
  return false;
}

// Satu langkah simulasi. ctl: {fwd,back,left,right,run,shoot,aimX,aimZ,camYaw}.
// ctx: {wanted, shooting (apakah pemain menembak), onKill(kind)} — main.js yang mengisi.
export function stepWorld(world, dt, ctl, ctx) {
  world.time += dt;
  world.events.length = 0;
  const p = world.player;
  const rand = world.rand;

  // --- Pemain jalan kaki ---
  if (p.onFoot) {
    let mx = 0, mz = 0;
    const cy = ctl.camYaw || 0;
    const fx = -Math.sin(cy), fz = -Math.cos(cy); // arah pandang kamera
    const rx = -fz, rz = fx;
    if (ctl.fwd) { mx += fx; mz += fz; }
    if (ctl.back) { mx -= fx; mz -= fz; }
    if (ctl.left) { mx -= rx; mz -= rz; }
    if (ctl.right) { mx += rx; mz += rz; }
    const len = Math.hypot(mx, mz);
    const speed = (ctl.run ? PLAYER.runSpeed : PLAYER.walkSpeed);
    if (len > 0) {
      mx /= len; mz /= len;
      p.angle = Math.atan2(mx, mz);
      const out = collideWorld(world, p.x + mx * speed * dt, p.z + mz * speed * dt, PLAYER.radius);
      p.x = out.x; p.z = out.z; p.speed = speed;
    } else p.speed = 0;
  } else {
    // --- Pemain nyetir ---
    const v = world.vehicles.find((vv) => vv.id === p.vehicleId);
    if (v) {
      const spec = VEHICLES[v.type];
      const boost = p.engine && v.type !== 'boat' ? 1.25 : 1;
      if (ctl.fwd) v.speed += spec.accel * boost * dt;
      else if (ctl.back) v.speed -= spec.accel * 0.7 * dt;
      else v.speed *= Math.max(0, 1 - 0.8 * dt);
      if (v.speed > spec.top * boost) v.speed = spec.top * boost;
      if (v.speed < -spec.top * 0.35) v.speed = -spec.top * 0.35;
      const steer = (ctl.left ? 1 : 0) - (ctl.right ? 1 : 0);
      v.angle += steer * spec.turn * (v.speed / spec.top) * dt * (v.speed >= 0 ? 1 : -1);
      const nx = v.x + Math.sin(v.angle) * v.speed * dt;
      const nz = v.z + Math.cos(v.angle) * v.speed * dt;
      if (v.type === 'boat') {
        // Perahu: hanya di air barat.
        v.x = Math.max(-258, Math.min(CITY.waterWest - 2, nx));
        v.z = Math.max(-258, Math.min(258, nz));
      } else {
        const out = collideWorld(world, nx, nz, 2.2);
        if (Math.hypot(out.x - nx, out.z - nz) > 0.05 && Math.abs(v.speed) > 8) {
          world.events.push({ type: 'crash', speed: Math.abs(v.speed) });
          v.speed *= 0.4;
        }
        v.x = out.x; v.z = out.z;
      }
      p.x = v.x; p.z = v.z; p.angle = v.angle; p.speed = Math.abs(v.speed);
      // Tabrak pejalan kaki? Mereka lari duluan; tabrakan mobil-pedestrian dihindari (mereka menghindar).
    } else { p.onFoot = true; p.vehicleId = 0; }
  }

  // --- Lalu lintas: jalan lurus di jalurnya, belok acak di persimpangan ---
  for (const v of world.traffic) {
    if (v.hp <= 0) continue;
    const spec = VEHICLES[v.type];
    const px = world.player.x, pz = world.player.z;
    const ahead = v.horizontal ? (v.angle === 0 ? px - v.x : v.x - px) : (v.angle === Math.PI / 2 ? pz - v.z : v.z - pz);
    const side = v.horizontal ? Math.abs(pz - v.z) : Math.abs(px - v.x);
    if (ahead > 0 && ahead < 14 && side < 4) v.speed = Math.max(0, v.speed - 20 * dt); // rem kalau ada mobil di depan
    else if (v.speed < spec.top * 0.55) v.speed += 6 * dt;
    let nx = v.x + Math.sin(v.angle) * v.speed * dt;
    let nz = v.z + Math.cos(v.angle) * v.speed * dt;
    // Belok di persimpangan.
    const onGrid = (c) => Math.abs(c - Math.round(c / 65) * 65) < 1.2;
    if ((v.horizontal ? onGrid(v.x) : onGrid(v.z)) && rand() < 0.02) {
      v.horizontal = !v.horizontal;
      v.angle += (rand() < 0.5 ? 1 : -1) * Math.PI / 2;
      nx = v.x; nz = v.z;
    }
    if (nx > 255 || nx < -255 || nz > 255 || nz < -255) { // putar balik di ujung kota
      v.angle += Math.PI;
      nx = v.x; nz = v.z;
    }
    const out = collideWorld(world, nx, nz, 2.0);
    v.x = out.x; v.z = out.z;
    // Tabrakan dengan pemain?
    const d = Math.hypot(v.x - p.x, v.z - p.z);
    if (d < 3.4 && !p.onFoot) {
      const pv = world.vehicles.find((vv) => vv.id === p.vehicleId);
      if (pv && Math.abs(v.speed) + Math.abs(pv.speed) > 10) {
        world.events.push({ type: 'crash', speed: Math.abs(v.speed) + Math.abs(pv.speed) });
        v.speed *= 0.3; pv.speed *= 0.5;
        damageVehicle(world, v, 15, false);
      }
    } else if (d < 2.2 && p.onFoot) {
      world.events.push({ type: 'damage', amount: 12, from: 'traffic' });
      p.hp -= 12;
      const out2 = collideWorld(world, p.x + (p.x - v.x) * 0.5, p.z + (p.z - v.z) * 0.5, PLAYER.radius);
      p.x = out2.x; p.z = out2.z;
    }
  }

  // --- Perahu patroli ---
  for (const b of world.boats) {
    if (b.hp <= 0) continue;
    b.z += Math.sin(b.angle) * b.speed * dt;
    if (b.z > 220 || b.z < -220) b.angle += Math.PI;
  }

  // --- Pejalan kaki: jalan santai, lari kalau ada tembakan ---
  for (const pd of world.peds) {
    if (pd.flee > 0) pd.flee -= dt;
    const dx = pd.tx - pd.x, dz = pd.tz - pd.z;
    const d = Math.hypot(dx, dz);
    if (d < 2 || pd.tx === 0) {
      pd.tx = range(rand, -240, 240); pd.tz = range(rand, -240, 220);
      if (inWater(pd.tx, pd.tz)) { pd.tx = 0; pd.tz = 0; }
    }
    const sp = pd.flee > 0 ? 7 : pd.speed;
    const nx = pd.x + (dx / (d || 1)) * sp * dt, nz = pd.z + (dz / (d || 1)) * sp * dt;
    if (!inWater(nx, nz)) { pd.x = nx; pd.z = nz; }
    pd.angle = Math.atan2(dx, dz);
  }
  if (world.gunshotAt > 0 && world.time - world.gunshotAt < 0.1) {
    for (const pd of world.peds) {
      if (Math.hypot(pd.x - p.x, pd.z - p.z) < 40) pd.flee = 3;
    }
  }

  // --- Musuh: kejar + tembak pemain ---
  for (const e of world.enemies) {
    if (e.hp <= 0) continue;
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
    e.angle = Math.atan2(dx, dz);
    if (d > 3) {
      const sp = Math.min(e.speed, d > 20 ? e.speed * 1.4 : e.speed);
      const out = collideWorld(world, e.x + (dx / d) * sp * dt, e.z + (dz / d) * sp * dt, 1.0);
      e.x = out.x; e.z = out.z;
    }
    e.shootCd -= dt;
    if (d < 38 && e.shootCd <= 0) {
      e.shootCd = range(rand, 1.0, 1.8);
      const hit = rand() < 0.55;
      if (hit) {
        const dmg = e.kind === 'boss' ? 14 : 8;
        world.events.push({ type: 'damage', amount: dmg, from: e.kind });
        p.hp -= dmg;
        if (!p.onFoot) {
          const v = world.vehicles.find((vv) => vv.id === p.vehicleId);
          if (v) damageVehicle(world, v, dmg, false);
        }
      }
      world.events.push({ type: 'enemyShot', x: e.x, z: e.z });
    }
  }

  // --- Polisi: kejar pemain, tabrak ---
  const wanted = ctx?.wanted ?? 0;
  for (const pc of world.police) {
    if (pc.hp <= 0) continue;
    const dx = p.x - pc.x, dz = p.z - pc.z, d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let da = want - pc.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    pc.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, da));
    const spec = VEHICLES.police;
    pc.speed = Math.min(spec.top, pc.speed + spec.accel * dt);
    const out = collideWorld(world, pc.x + Math.sin(pc.angle) * pc.speed * dt, pc.z + Math.cos(pc.angle) * pc.speed * dt, 2.2);
    pc.x = out.x; pc.z = out.z;
    pc.ramCd -= dt;
    if (d < 4.2 && pc.ramCd <= 0) {
      pc.ramCd = 1.2;
      if (p.onFoot) {
        world.events.push({ type: 'damage', amount: 18, from: 'police' });
        p.hp -= 18;
      } else {
        const v = world.vehicles.find((vv) => vv.id === p.vehicleId);
        if (v) { damageVehicle(world, v, 22, false); world.events.push({ type: 'crash', speed: 12 }); }
      }
      pc.speed *= 0.4;
    }
  }
  // Helikopter: mengikuti dari atas saat wanted >= 4.
  const heli = world.heli;
  heli.active = wanted >= WANTED.heliAt;
  if (heli.active) {
    const dx = p.x - heli.x, dz = p.z - heli.z, d = Math.hypot(dx, dz);
    if (d > 6) { heli.x += (dx / d) * 26 * dt; heli.z += (dz / d) * 26 * dt; }
    heli.angle += dt * 2;
  }

  // Bersihkan musuh mati.
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    if (world.enemies[i].hp <= 0) {
      const kind = world.enemies[i].kind;
      world.events.push({ type: 'kill', kind });
      world.enemies.splice(i, 1);
      if (ctx?.onKill) ctx.onKill(kind);
    }
  }
  return world.events;
}

export { nearestVehicle, inWater, districtAt };
