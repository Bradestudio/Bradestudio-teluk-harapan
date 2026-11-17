// TELUK HARAPAN Round 2 — boot + game loop + missions + wanted + combat + economy.
// 3 days, 12 story missions, side jobs, save. All original.
import { CITY, MISSIONS, ECONOMY, SHOPS } from './config.js';
import { mulberry32 } from './random.js';
import { keys, initInput, consumeMouse, axis } from './input.js';
import { audio } from './audio.js';
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
const SAVE_KEY = 'teluk-harapan-r2-save';

const canvas = document.getElementById('game');
const minimap = document.getElementById('minimap');
const THREE = window.THREE;

const renderer = createRenderer(canvas, minimap);
const world = createWorld(seed);
renderer.scene.add(world.group);
renderer.setDay(1);

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const hudMoney = $('hud-money'), hudDay = $('hud-day'), hudHp = $('hud-hp'), hudHpBar = $('hud-hpbar'),
  hudAmmo = $('hud-ammo'), hudWanted = $('hud-wanted'), hudMission = $('hud-mission'),
  hudTimer = $('hud-timer'), bannerEl = $('banner'), promptEl = $('prompt'),
  speedEl = $('speed'), titleEl = $('title-screen'), endEl = $('end-screen'),
  endTitle = $('end-title'), endText = $('end-text'), crosshair = $('crosshair');

// ---------- state ----------
const G = {
  screen: 'title', // title | play | paused | over | done
  day: 1, missionIdx: 0, money: ECONOMY.startMoney, hp: 100, ammo: ECONOMY.startAmmo,
  wanted: 0, wantedSeen: 0, decay: 0,
  time: 0, earned: 0, kills: 0,
  player: { x: 0, z: 20, angle: Math.PI, speed: 0, inCar: null, carHp: 100 },
  mission: null, job: null, bannerTimer: 0, sirenTimer: 0,
  overReason: '', paused: false,
};
let policeCars = [];
let onFootCops = [];
let sari = null; // escort NPC

// ---------- player + NPC meshes ----------
function makeHuman(shirt, pants, skin, scale = 1) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), mat(pants));
  legs.position.y = 0.4;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.36), mat(shirt));
  torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), mat(skin));
  head.position.y = 1.72;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), mat(0x181410));
  hair.position.y = 1.9;
  g.add(legs, torso, head, hair);
  g.scale.setScalar(scale);
  return g;
}
const playerMesh = makeHuman(0x2e8a8a, 0x2a2a33);
playerMesh.position.set(G.player.x, 0, G.player.z);
renderer.scene.add(playerMesh);
const sariMesh = makeHuman(0xd84a8a, 0x3a3a4a);
sariMesh.visible = false;
renderer.scene.add(sariMesh);

// ---------- helpers ----------
function dist(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
function showBanner(text, secs = 3) {
  bannerEl.textContent = text;
  bannerEl.style.opacity = '1';
  G.bannerTimer = secs;
}
function addMoney(n) { G.money += n; G.earned += n; }
function addWanted(n) {
  G.wanted = Math.max(0, Math.min(5, G.wanted + n));
  if (G.wanted > 0) audio.siren();
}
function beaconAt(x, z, visible = true) {
  world.beacon.position.set(x, 0, z);
  world.beacon.visible = visible;
  G.beaconPos = visible ? { x, z } : null;
}
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ day: G.day, missionIdx: G.missionIdx, money: G.money, hp: G.hp, ammo: G.ammo }));
  } catch (_) {}
}
function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    return s && typeof s.missionIdx === 'number' ? s : null;
  } catch (_) { return null; }
}

// ---------- missions ----------
function startMission(idx) {
  const m = MISSIONS[idx];
  G.missionIdx = idx;
  G.day = m.day;
  renderer.setDay(m.day);
  const st = { def: m, stage: 0, timer: m.time || 0, hold: 0, collected: 0, raceIdx: 0, taxiIdx: 0 };
  G.mission = st;
  // clean previous mission actors
  for (const th of world.thugs) { if (th.alive) { th.alive = false; th.mesh.visible = false; } }
  if (sari) { sariMesh.visible = false; sari = null; }
  if (m.type === 'reach' || m.type === 'deliver' || m.type === 'hold' || m.type === 'fight' || m.type === 'boss') beaconAt(m.target[0], m.target[1]);
  if (m.type === 'deliver') beaconAt(m.pickup[0], m.pickup[1]);
  if (m.type === 'taxi') beaconAt(m.stops[0][0], m.stops[0][1]);
  if (m.type === 'race') beaconAt(m.points[0][0], m.points[0][1]);
  if (m.type === 'collect') beaconAt(m.targets[0][0], m.targets[0][1]);
  if (m.type === 'escort') beaconAt(m.target[0], m.target[1]);
  if (m.type === 'drive') {
    beaconAt(m.target[0], m.target[1]);
    // put the player in a car at `from`
    const car = nearestParked(m.from[0], m.from[1]) || world.parked[0];
    enterCar(car);
    car.x = m.from[0]; car.z = m.from[1]; car.angle = Math.PI / 2;
    car.mesh.position.set(car.x, 0, car.z);
    G.player.x = car.x; G.player.z = car.z;
    addWanted(m.wanted || 0);
  }
  if (m.type === 'fight') {
    for (let i = 0; i < m.thugs; i += 1) {
      world.spawnThug(m.target[0] + (i - 2) * 3, m.target[1] + (i % 2) * 4, 60, false);
    }
  }
  if (m.type === 'boss') {
    world.spawnThug(m.target[0], m.target[1], 200, true);
    world.spawnThug(m.target[0] - 6, m.target[1] + 4, 60, false);
    world.spawnThug(m.target[0] + 6, m.target[1] + 4, 60, false);
  }
  if (m.type === 'survive') addWanted(m.wanted || 3);
  showBanner(`${m.id} — ${m.title}`, 3.5);
  saveGame();
}

function completeMission() {
  const m = G.mission.def;
  addMoney(m.reward);
  G.mission = null;
  beaconAt(0, 0, false);
  audio.mission();
  showBanner(`Misi selesai! +$${m.reward}`, 3);
  const next = G.missionIdx + 1;
  if (next >= MISSIONS.length) {
    G.screen = 'done';
    endTitle.textContent = 'TAMAT — KOTA MILIKMU';
    endText.textContent = `Raka mengalahkan Bang Darto. 12 misi selesai, $${G.earned} dikumpulkan, ${G.kills} musuh dijatuhkan. Kota Teluk Harapan akhirnya tenang.`;
    endEl.style.display = 'flex';
    saveGame();
    return;
  }
  const nm = MISSIONS[next];
  if (nm.day !== G.day) {
    showBanner(`HARI ${nm.day} — ${nm.day === 2 ? 'Maghrib' : 'Malam'}`, 4);
  }
  startMission(next);
}

function failMission(reason) {
  audio.fail();
  showBanner(reason || 'Misi gagal — coba lagi', 3);
  const idx = G.missionIdx;
  startMission(idx); // restart same mission
}

function updateMission(dt) {
  const st = G.mission;
  if (!st || G.job) return; // job pauses mission progress
  const m = st.def;
  const P = G.player;
  if (m.time && (m.type === 'deliver' && st.stage === 1 || m.type === 'race' || m.type === 'survive' || m.type === 'drive')) {
    st.timer -= dt;
    if (st.timer <= 0) {
      if (m.type === 'survive') { completeMission(); return; }
      failMission('Waktu habis!'); return;
    }
  }
  switch (m.type) {
    case 'reach':
      if (dist(P.x, P.z, m.target[0], m.target[1]) < 4) completeMission();
      break;
    case 'deliver':
      if (st.stage === 0) {
        if (dist(P.x, P.z, m.pickup[0], m.pickup[1]) < 4) {
          st.stage = 1; st.timer = m.time;
          beaconAt(m.target[0], m.target[1]);
          showBanner('Paket diambil — antar ke Pantai Senja!', 2.5);
          audio.pickup();
        }
      } else if (dist(P.x, P.z, m.target[0], m.target[1]) < 4) completeMission();
      break;
    case 'taxi': {
      const stop = m.stops[st.taxiIdx];
      if (st.stage === 0) {
        if (dist(P.x, P.z, stop[0], stop[1]) < 4) {
          st.stage = 1;
          beaconAt(stop[2], stop[3]);
          showBanner('Penumpang naik — antar ke tujuan!', 2.5);
          audio.pickup();
        }
      } else if (dist(P.x, P.z, stop[2], stop[3]) < 4) {
        addMoney(40);
        showBanner('Penumpang sampai +$40', 2);
        audio.coin();
        st.taxiIdx += 1; st.stage = 0;
        if (st.taxiIdx >= m.stops.length) completeMission();
        else beaconAt(m.stops[st.taxiIdx][0], m.stops[st.taxiIdx][1]);
      }
      break;
    }
    case 'fight':
    case 'boss': {
      const alive = world.thugs.filter((t) => t.alive);
      if (m.type === 'boss') {
        const boss = world.thugs.find((t) => t.boss);
        if (boss && !boss.alive) completeMission();
      } else if (alive.length === 0) completeMission();
      break;
    }
    case 'race': {
      const pt = m.points[st.raceIdx];
      if (dist(P.x, P.z, pt[0], pt[1]) < 6) {
        st.raceIdx += 1; audio.coin();
        if (st.raceIdx >= m.points.length) completeMission();
        else beaconAt(m.points[st.raceIdx][0], m.points[st.raceIdx][1]);
      }
      break;
    }
    case 'collect': {
      const t = m.targets[st.collected];
      if (t && dist(P.x, P.z, t[0], t[1]) < 3.5 && keys.KeyE && !G.prevE) {
        st.collected += 1; addMoney(50);
        showBanner(`Utang ditagih +$50 (${st.collected}/3)`, 2);
        audio.coin();
        if (st.collected >= m.targets.length) completeMission();
        else beaconAt(m.targets[st.collected][0], m.targets[st.collected][1]);
      }
      break;
    }
    case 'survive':
      // timer handled above; surviving = not busted
      break;
    case 'escort': {
      if (!sari) {
        if (dist(P.x, P.z, m.target[0], m.target[1]) < 4) {
          sari = { x: m.target[0], z: m.target[1] };
          sariMesh.position.set(sari.x, 0, sari.z);
          sariMesh.visible = true;
          beaconAt(m.dest[0], m.dest[1]);
          showBanner('Sari ikut! Antar dia ke rumah aman.', 2.5);
          audio.pickup();
        }
      } else {
        const d = dist(sari.x, sari.z, P.x, P.z);
        if (d > 5) {
          const nx = sari.x + ((P.x - sari.x) / d) * 5 * dt;
          const nz = sari.z + ((P.z - sari.z) / d) * 5 * dt;
          const c = world.collide(nx, nz, 0.5);
          sari.x = c.x; sari.z = c.z;
          sariMesh.position.set(sari.x, 0, sari.z);
          sariMesh.rotation.y = Math.atan2(P.x - sari.x, P.z - sari.z);
        }
        if (dist(P.x, P.z, m.dest[0], m.dest[1]) < 5 && dist(sari.x, sari.z, m.dest[0], m.dest[1]) < 12) completeMission();
      }
      break;
    }
    case 'hold': {
      if (dist(P.x, P.z, m.target[0], m.target[1]) < 5) {
        st.hold += dt;
        if (st.hold >= m.hold) completeMission();
      } else st.hold = Math.max(0, st.hold - dt);
      break;
    }
    case 'drive':
      if (dist(P.x, P.z, m.target[0], m.target[1]) < 6) completeMission();
      break;
  }
}

// ---------- cars ----------
function nearestParked(x, z) {
  let best = null, bd = 1e9;
  for (const c of world.parked) {
    if (c.taken) continue;
    const d = dist(x, z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function nearestCar(x, z, maxD) {
  let best = null, bd = maxD;
  for (const c of world.cars) {
    if (!c.active || c.kind === 'police') continue;
    const d = dist(x, z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function enterCar(car) {
  const P = G.player;
  P.inCar = car;
  car.taken = true;
  playerMesh.visible = false;
  audio.engineStart();
}
function exitCar() {
  const P = G.player;
  const car = P.inCar;
  if (!car) return;
  P.inCar = null;
  const sx = car.x + Math.sin(car.angle + Math.PI / 2) * 2.5;
  const sz = car.z + Math.cos(car.angle + Math.PI / 2) * 2.5;
  const c = world.collide(sx, sz, 0.6);
  P.x = c.x; P.z = c.z;
  playerMesh.visible = true;
  audio.engineStop();
}

// ---------- combat ----------
let punchCd = 0, shootCd = 0;
function punch() {
  if (punchCd > 0) return;
  punchCd = 0.35;
  audio.punch();
  const P = G.player;
  for (const th of world.thugs) {
    if (!th.alive) continue;
    const d = dist(P.x, P.z, th.x, th.z);
    if (d < 2.6) { hurtThug(th, 25, P.angle); }
  }
}
function shoot() {
  if (shootCd > 0 || G.ammo <= 0) return;
  shootCd = 0.28;
  G.ammo -= 1;
  audio.shoot();
  const P = G.player;
  const yaw = renderer.getCamYaw();
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  let best = null, bd = 50;
  for (const th of world.thugs) {
    if (!th.alive) continue;
    const dx = th.x - P.x, dz = th.z - P.z;
    const d = Math.hypot(dx, dz);
    if (d > bd) continue;
    const dot = (dx * fx + dz * fz) / (d || 1);
    if (dot > 0.86) { bd = d; best = th; }
  }
  if (best) {
    hurtThug(best, 34, Math.atan2(best.x - P.x, best.z - P.z));
    addWanted(1);
  }
}
function hurtThug(th, dmg, fromAngle) {
  th.hp -= dmg;
  th.x += Math.sin(fromAngle) * 0.8;
  th.z += Math.cos(fromAngle) * 0.8;
  if (th.hp <= 0) {
    th.alive = false;
    th.mesh.rotation.x = -Math.PI / 2;
    th.mesh.position.y = 0.4;
    G.kills += 1;
    addMoney(10);
    audio.coin();
  }
}

// ---------- wanted / police ----------
function ensurePolice() {
  const want = Math.min(G.wanted, 4);
  while (policeCars.length < want) {
    const a = Math.random() * Math.PI * 2;
    const car = world.spawnPoliceCar(
      Math.max(-240, Math.min(240, G.player.x + Math.sin(a) * 60)),
      Math.max(-240, Math.min(240, G.player.z + Math.cos(a) * 60)),
    );
    policeCars.push(car);
  }
}
function updatePolice(dt) {
  const P = G.player;
  if (G.wanted > 0) {
    ensurePolice();
    G.sirenTimer -= dt;
    if (G.sirenTimer <= 0) { audio.siren(); G.sirenTimer = 4; }
  }
  for (const car of policeCars) {
    if (!car.active) continue;
    const dx = P.x - car.x, dz = P.z - car.z;
    const d = Math.hypot(dx, dz) || 1;
    const sp = 21 + G.wanted;
    car.x += (dx / d) * sp * dt;
    car.z += (dz / d) * sp * dt;
    const c = world.collide(car.x, car.z, 1.6);
    car.x = c.x; car.z = c.z;
    car.angle = Math.atan2(dx, dz);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    if (d < 3) {
      if (P.inCar) {
        P.carHp -= 12 * dt * 10;
        car.x -= (dx / d) * 2; car.z -= (dz / d) * 2;
        if (P.carHp <= 0) { bust('Mobilmu hancur. Polisi menangkapmu.'); return; }
      } else if (d < 2.2) {
        bust('Polisi menangkapmu!');
        return;
      }
    }
  }
  // decay: no police near for a while
  if (G.wanted > 0) {
    let near = false;
    for (const car of policeCars) if (dist(P.x, P.z, car.x, car.z) < 60) near = true;
    if (!near) {
      G.decay += dt;
      if (G.decay > 8) { G.wanted -= 1; G.decay = 0; }
    } else G.decay = 0;
  }
  // remove extra police when wanted drops
  while (policeCars.length > G.wanted) {
    const car = policeCars.pop();
    car.active = false; car.mesh.visible = false;
  }
}
function bust(reason) {
  G.overReason = reason;
  G.screen = 'over';
  G.money = Math.max(0, G.money - 100);
  G.hp = 100; G.wanted = 0;
  for (const car of policeCars) { car.active = false; car.mesh.visible = false; }
  policeCars = [];
  if (G.player.inCar) exitCar();
  G.player.x = 0; G.player.z = 20;
  playerMesh.position.set(0, 0, 20);
  endTitle.textContent = 'TERTANGKAP!';
  endText.textContent = `${reason} Denda $100. Misi saat ini diulang dari awal.`;
  endEl.style.display = 'flex';
  audio.fail();
  startMission(G.missionIdx);
}

// ---------- side jobs ----------
function startJob(kind) {
  const P = G.player;
  if (kind === 'taxi') {
    const px = -180 + Math.random() * 360, pz = -180 + Math.random() * 360;
    const dx = -180 + Math.random() * 360, dz = -180 + Math.random() * 360;
    G.job = { kind, stage: 0, pickup: [px, pz], dest: [dx, dz] };
    beaconAt(px, pz);
    showBanner('Penumpang menunggu — jemput dia!', 2.5);
  } else {
    const dx = -180 + Math.random() * 360, dz = -180 + Math.random() * 360;
    G.job = { kind, stage: 0, dest: [dx, dz], timer: 60 };
    beaconAt(P.x, P.z, false);
    beaconAt(dx, dz);
    showBanner('Paket diambil — antar ke tujuan (60 detik)!', 2.5);
    G.job.timer = 60;
  }
  audio.pickup();
}
function updateJob(dt) {
  const j = G.job;
  if (!j) return;
  const P = G.player;
  if (j.kind === 'taxi') {
    if (j.stage === 0) {
      if (dist(P.x, P.z, j.pickup[0], j.pickup[1]) < 4) { j.stage = 1; beaconAt(j.dest[0], j.dest[1]); showBanner('Penumpang naik!', 2); }
    } else if (dist(P.x, P.z, j.dest[0], j.dest[1]) < 4) {
      addMoney(ECONOMY.taxiFare); showBanner(`Taksi selesai +$${ECONOMY.taxiFare}`, 2); audio.coin();
      G.job = null; beaconAt(0, 0, false);
      if (G.mission) startMissionBeacon();
    }
  } else {
    j.timer -= dt;
    if (j.timer <= 0) { showBanner('Paket terlambat — job batal', 2); G.job = null; beaconAt(0, 0, false); if (G.mission) startMissionBeacon(); return; }
    if (dist(P.x, P.z, j.dest[0], j.dest[1]) < 4) {
      addMoney(ECONOMY.courierPay); showBanner(`Kurir selesai +$${ECONOMY.courierPay}`, 2); audio.coin();
      G.job = null; beaconAt(0, 0, false);
      if (G.mission) startMissionBeacon();
    }
  }
}
function startMissionBeacon() {
  const st = G.mission; if (!st) return;
  const m = st.def;
  if (m.type === 'reach' || m.type === 'hold' || m.type === 'fight' || m.type === 'boss') beaconAt(m.target[0], m.target[1]);
  else if (m.type === 'race') beaconAt(m.points[st.raceIdx][0], m.points[st.raceIdx][1]);
  else if (m.type === 'collect') beaconAt(m.targets[st.collected][0], m.targets[st.collected][1]);
  else if (m.type === 'escort') beaconAt(sari ? m.dest[0] : m.target[0], sari ? m.dest[1] : m.target[1]);
  else if (m.type === 'deliver') beaconAt(st.stage === 0 ? m.pickup[0] : m.target[0], st.stage === 0 ? m.pickup[1] : m.target[1]);
  else if (m.type === 'taxi') { const s = m.stops[st.taxiIdx]; beaconAt(st.stage === 0 ? s[0] : s[2], st.stage === 0 ? s[1] : s[3]); }
  else if (m.type === 'drive') beaconAt(m.target[0], m.target[1]);
}

// ---------- interaction ----------
G.prevE = false; G.prevF = false; G.prevSpace = false;
function nearestShop() {
  const P = G.player;
  for (const s of SHOPS) if (dist(P.x, P.z, s.pos[0], s.pos[1]) < 5) return s;
  return null;
}
function interact() {
  const P = G.player;
  const shop = nearestShop();
  if (shop) {
    if (shop.action === 'heal' && G.money >= ECONOMY.clinicCost && G.hp < 100) {
      G.money -= ECONOMY.clinicCost; G.hp = 100; showBanner('Nyawa penuh!', 2); audio.pickup();
    } else if (shop.action === 'ammo' && G.money >= ECONOMY.ammoCost) {
      G.money -= ECONOMY.ammoCost; G.ammo += 12; showBanner('Peluru +12', 2); audio.pickup();
    } else if (shop.action === 'repair' && P.inCar && G.money >= ECONOMY.repairCost) {
      G.money -= ECONOMY.repairCost; P.carHp = 100; showBanner('Mobil diperbaiki!', 2); audio.pickup();
    } else if (shop.action === 'taxi' && !G.job && !(G.mission && G.mission.def.time)) startJob('taxi');
    else if (shop.action === 'courier' && !G.job && !(G.mission && G.mission.def.time)) startJob('courier');
    return;
  }
  // mission collect is handled in updateMission via KeyE
  // E enters a nearby empty (parked/taxi) car without a wanted star;
  // F steals any car (driver flees, +1 wanted).
  const car = nearestCar(P.x, P.z, 5);
  if (car && !car.driver) {
    enterCar(car);
    showBanner('Masuk mobil', 1.5);
  }
}

// ---------- player update ----------
function updatePlayer(dt) {
  const P = G.player;
  const m = consumeMouse();
  const ax = axis();
  const yaw = renderer.getCamYaw();
  punchCd = Math.max(0, punchCd - dt);
  shootCd = Math.max(0, shootCd - dt);

  if (P.inCar) {
    const car = P.inCar;
    const fwd = ax.z !== 0 ? -ax.z : 0; // W = forward
    const steer = ax.x;
    if (fwd > 0) car.speed = Math.min(27, car.speed + 15 * dt);
    else if (fwd < 0) car.speed = Math.max(-9, car.speed - 12 * dt);
    else car.speed *= Math.pow(0.4, dt);
    if (Math.abs(car.speed) > 0.5) car.angle += steer * (car.speed > 0 ? 1 : -1) * 1.9 * dt * Math.min(1, Math.abs(car.speed) / 8);
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    const before = { x: car.x, z: car.z };
    const c = world.collide(car.x, car.z, 1.7);
    if (c.x !== before.x || c.z !== before.z) car.speed *= 0.45;
    car.x = c.x; car.z = c.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    P.x = car.x; P.z = car.z;
    audio.engine(Math.abs(car.speed) / 27);
    renderer.updateCamera(car.x, car.z, car.angle, true, dt, m.dx, m.dy);
    // E exits the car (edge-triggered); other actions are on-foot only.
    if (keys.KeyE && !G.prevE) exitCar();
    G.prevE = keys.KeyE;
    return;
  }

  // on foot
  const sprint = keys.ShiftLeft || keys.ShiftRight;
  const speed = sprint ? 10.5 : 7;
  let mx = 0, mz = 0;
  if (ax.z !== 0 || ax.x !== 0) {
    // camera-relative: forward is -yaw
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    mx = fx * -ax.z + rx * ax.x;
    mz = fz * -ax.z + rz * ax.x;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
    P.angle = Math.atan2(mx, mz);
  }
  const nx = P.x + mx * speed * dt;
  const nz = P.z + mz * speed * dt;
  const c = world.collide(nx, nz, 0.6);
  G.statsDist = (G.statsDist || 0) + Math.hypot(c.x - P.x, c.z - P.z);
  P.x = c.x; P.z = c.z;
  playerMesh.position.set(P.x, 0, P.z);
  playerMesh.rotation.y = P.angle;
  playerMesh.position.y = (ax.x || ax.z) ? Math.abs(Math.sin(G.time * 9)) * 0.06 : 0;
  renderer.updateCamera(P.x, P.z, P.angle, false, dt, m.dx, m.dy);

  // actions (edge-triggered)
  if (keys.KeyE && !G.prevE) interact();
  if (keys.KeyF && !G.prevF) {
    const car = nearestCar(P.x, P.z, 5);
    if (car) {
      enterCar(car);
      addWanted(1);
      showBanner('Mobil dicuri! +1 bintang', 2);
    }
  }
  if (keys.Space && !G.prevSpace) punch();
  if (m.clicked) shoot();
  G.prevE = keys.KeyE; G.prevF = keys.KeyF; G.prevSpace = keys.Space;

  // E near a parked car: prompt
  const near = nearestCar(P.x, P.z, 5);
  if (near) promptEl.textContent = 'E — Masuk mobil   F — Curi mobil';
  else if (nearestShop()) promptEl.textContent = nearestShop().label;
  else promptEl.textContent = '';
}

// ---------- HUD ----------
function updateHUD() {
  hudMoney.textContent = `$${G.money}`;
  hudDay.textContent = `Hari ${G.day} · ${['', 'Senja', 'Maghrib', 'Malam'][G.day]}`;
  hudHp.textContent = `${Math.ceil(G.hp)} HP`;
  hudHpBar.style.width = `${Math.max(0, G.hp)}%`;
  hudHpBar.style.background = G.hp > 50 ? '#3aa84a' : G.hp > 25 ? '#e8a832' : '#d83a2e';
  hudAmmo.textContent = `${G.ammo} peluru`;
  hudWanted.textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
  hudWanted.style.color = G.wanted > 0 ? '#ff4444' : '#888';
  const st = G.mission;
  if (st) {
    hudMission.textContent = `${st.def.id} — ${st.def.title}: ${st.def.text}`;
    const t = st.def.time && (st.def.type === 'race' || st.def.type === 'survive' || st.def.type === 'drive' || (st.def.type === 'deliver' && st.stage === 1));
    hudTimer.textContent = t ? `⏱ ${Math.ceil(st.timer)} dtk` : (st.def.type === 'hold' ? `Tahan: ${Math.ceil(st.hold)}/${st.def.hold} dtk` : '');
  } else hudMission.textContent = 'Bebas — cari kerja sampingan di toko (hijau di minimap).';
  if (G.job) hudTimer.textContent = G.job.kind === 'courier' ? `⏱ Paket: ${Math.ceil(G.job.timer)} dtk` : 'Taksi aktif';
  if (G.bannerTimer > 0) {
    G.bannerTimer -= 1 / 60;
    if (G.bannerTimer <= 0) bannerEl.style.opacity = '0';
  }
  crosshair.style.display = (!G.player.inCar && G.screen === 'play') ? 'block' : 'none';
  speedEl.textContent = G.player.inCar ? `${Math.round(Math.abs(G.player.inCar.speed) * 3.6)} km/j` : '';
}

// ---------- main loop ----------
let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  if (G.screen !== 'play') {
    // still render the scene behind overlays
    renderer.render();
    return;
  }
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  G.time += dt;
  acc += dt;
  while (acc >= STEP) {
    acc -= STEP;
    if (keys.KeyP && !G.prevP) {
      G.screen = 'paused';
      endTitle.textContent = 'JEDA';
      endText.textContent = 'Tekan P lagi atau klik Lanjut untuk main lagi.';
      endEl.style.display = 'flex';
    }
    G.prevP = keys.KeyP;
    updatePlayer(STEP);
    world.update(STEP, G.player, G.wanted);
    updateMission(STEP);
    updateJob(STEP);
    updatePolice(STEP);
    // thug punches
    for (const th of world.thugs) {
      if (!th.alive) continue;
      if (dist(th.x, th.z, G.player.x, G.player.z) < 2 && th.cooldown <= 0 && !G.player.inCar) {
        th.cooldown = 1;
        G.hp -= th.boss ? 12 : 8;
        audio.punch();
        if (G.hp <= 0) { bust('Kamu dikalahkan.'); break; }
      }
    }
    // on-foot cops (wanted >= 3): they chase on foot
    if (G.wanted >= 3 && onFootCops.length < 2) {
      const cop = { x: G.player.x + 30, z: G.player.z + 30 };
      onFootCops.push(cop);
    }
  }
  updateHUD();
  renderer.drawMinimap({
    px: G.player.x, pz: G.player.z, heading: G.player.angle,
    beacon: G.beaconPos ? { visible: true, x: G.beaconPos.x, z: G.beaconPos.z } : { visible: false },
    thugs: world.thugs, police: policeCars, shops: SHOPS,
  });
  renderer.render();
}

// ---------- screens ----------
function startNew() {
  G.day = 1; G.missionIdx = 0; G.money = ECONOMY.startMoney; G.hp = 100; G.ammo = ECONOMY.startAmmo;
  G.wanted = 0; G.earned = 0; G.kills = 0; G.time = 0;
  G.player.x = 0; G.player.z = 20; G.player.angle = Math.PI;
  if (G.player.inCar) exitCar();
  playerMesh.position.set(0, 0, 20);
  titleEl.style.display = 'none';
  endEl.style.display = 'none';
  G.screen = 'play';
  audio.unlock(); audio.startMusic();
  startMission(0);
}
function continueSave() {
  const s = loadGame();
  if (!s) return startNew();
  G.day = s.day; G.money = s.money; G.hp = s.hp; G.ammo = s.ammo;
  titleEl.style.display = 'none';
  endEl.style.display = 'none';
  G.screen = 'play';
  audio.unlock(); audio.startMusic();
  startMission(s.missionIdx);
}
$('btn-start').addEventListener('click', startNew);
const btnContinue = $('btn-continue');
if (loadGame()) { btnContinue.style.display = 'inline-block'; btnContinue.addEventListener('click', continueSave); }
$('btn-restart').addEventListener('click', () => {
  endEl.style.display = 'none';
  if (G.screen === 'done') { titleEl.style.display = 'flex'; G.screen = 'title'; return; }
  G.screen = 'play';
});
$('btn-resume').addEventListener('click', () => { endEl.style.display = 'none'; G.screen = 'play'; });

// debug handle (harmless; used by the headless smoke test)
window.__game = { G, world, renderer, keys };

// ---------- boot ----------
initInput(canvas);
if (shotName) {
  // deterministic shot staging (no free play)
  const ctx = { G, world, renderer, playerMesh, sariMesh, startMission, enterCar, addWanted, beaconAt, showBanner };
  stageShot(shotName, ctx);
  // render a few frames, then signal ready
  let n = 0;
  function paint() {
    renderer.render();
    n += 1;
    if (n < 4) requestAnimationFrame(paint);
    else setTimeout(() => { window.__shotReady = true; }, 350);
  }
  requestAnimationFrame(paint);
} else {
  renderer.snapCamera(0, 20, Math.PI);
  requestAnimationFrame(frame);
}
