// Boot + loop + alur game: 15 misi dalam 3 hari, wanted & polisi + helikopter, tembak-menembak,
// kerja sampingan, toko & upgrade, simpan otomatis, musik & suara synth WebAudio.
//
// ?seed=N mengunci kota. ?shot=start|play|chase|mission (dengan &seed=N) menata adegan itu,
// menggambar dua kali, lalu menyalakan window.__shotReady untuk screenshot.
import { BEST_KEY, ECONOMY, MISSIONS, PHASES, PLACES, PLAYER, SAVE_KEY, SIDE_JOBS, STEP, VEHICLES, WANTED } from './config.js';
import { createRandom } from './random.js';
import { createWorld, damageVehicle, enterVehicle, exitVehicle, spawnEnemy, spawnPoliceCar, stepWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_INTERACT, ACTION_MISSION, ACTION_PAUSE, ACTION_STEAL, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_SHOP, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
renderer.buildCity(world);

// ---------- Audio synth (WebAudio, tanpa aset) ----------
let AC = null, master = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
function audio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.25; master.connect(AC.destination);
      engineOsc = AC.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
      engineGain = AC.createGain(); engineGain.gain.value = 0; engineOsc.connect(engineGain); engineGain.connect(master); engineOsc.start();
      sirenOsc = AC.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
      sirenGain = AC.createGain(); sirenGain.gain.value = 0; sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
    }
    if (AC.state === 'suspended') void AC.resume();
  } catch { /* suara opsional */ }
}
function blip(freq, dur, type, vol) {
  if (!AC) return;
  try {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.3, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(AC.currentTime + dur);
  } catch { /* abaikan */ }
}
function noiseBurst(dur, vol) {
  if (!AC) return;
  try {
    const len = Math.floor(AC.sampleRate * dur);
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = AC.createBufferSource(); src.buffer = buf;
    const g = AC.createGain(); g.gain.value = vol || 0.4;
    src.connect(g); g.connect(master); src.start();
  } catch { /* abaikan */ }
}
function jingle(notes) {
  if (!AC) return;
  notes.forEach((n, i) => setTimeout(() => blip(n, 0.18, 'square', 0.25), i * 110));
}

// ---------- Save / load ----------
function loadSave() {
  try {
    const s = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
    if (s && typeof s.money === 'number') return s;
  } catch { /* abaikan */ }
  return null;
}
function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: world.player.money, missionIndex: game.missionIndex,
      armor: world.player.armor, engine: world.player.engine,
      damage: world.player.damage, safehouse: world.player.safehouse,
      maxHp: world.player.maxHp,
    }));
  } catch { /* abaikan */ }
}
function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}

// ---------- State game ----------
const game = {
  screen: SCREEN_TITLE,
  missionIndex: 0,
  mission: null, // runtime misi aktif
  job: null, // kerja sampingan aktif
  wantedTimer: 0,
  banner: '', bannerUntil: 0,
  fireCd: 0, fistCd: 0, ramCd: 0,
  best: readBest(),
  started: false,
  shopPlace: null,
  missionKills: 0,
};

function banner(text, seconds) {
  game.banner = text; game.bannerUntil = world.time + (seconds || 4);
}
function announce(text) { statusEl.textContent = text; }

function currentMission() { return MISSIONS[game.missionIndex] ?? null; }
function missionTitle() {
  const m = currentMission();
  if (game.mission) return `M${m.id} — ${m.title}`;
  return m ? `Misi berikutnya: M${m.id} — ${m.title} (tekan M)` : 'Semua misi selesai!';
}
function objectiveText() {
  if (game.job) return game.job.objective;
  if (game.mission) return game.mission.objective;
  const m = currentMission();
  return m ? `Tekan M untuk mulai: ${m.title}` : 'Teluk Harapan bebas. Terima kasih sudah main!';
}

// ---------- Misi ----------
function startMission() {
  const m = currentMission();
  if (!m || game.mission) return;
  world.phase = m.day;
  const run = { def: m, stepIdx: 0, timer: 0, kills: 0, cpIdx: 0, objective: '', targetCar: null, truck: null, thugs: [], rival: null, startedAt: world.time, waitFrom: false };
  game.mission = run;
  setupStep(run);
  banner(`M${m.id} — ${m.title}: ${m.brief}`, 5);
  announce(`Misi ${m.id} dimulai: ${m.title}`);
  jingle([523, 659, 784]);
  audio();
}

function setupStep(run) {
  const s = run.def.steps[run.stepIdx];
  if (!s) { completeMission(run); return; }
  run.kills = 0; run.cpIdx = 0; run.waitFrom = !!s.from;
  run.objective = s.label;
  if (s.t === 'kill') {
    for (let i = 0; i < s.count; i++) {
      spawnEnemy(world, s.kind, s.x + (i % 2 ? 8 : -8), s.z + (i < 2 ? 6 : -6));
    }
  } else if (s.t === 'boss') {
    spawnEnemy(world, 'boss', s.x + 8, s.z + 8);
    spawnEnemy(world, 'guard', s.x + 12, s.z - 4);
    spawnEnemy(world, 'guard', s.x - 6, s.z + 12);
  } else if (s.t === 'chase') {
    const v = { id: 9000 + run.def.id, type: 'sedan', x: 130, z: -130, angle: Math.PI / 2, speed: 24, hp: 100, parked: false, driver: 'chase', color: 0x8a1a2a, target: null, ramCd: 0, wp: 0 };
    world.vehicles.push(v); run.targetCar = v;
  } else if (s.t === 'escort') {
    const t = { id: 9100 + run.def.id, type: 'truck', x: s.from[0], z: s.from[1], angle: Math.PI / 2, speed: 0, hp: 200, parked: false, driver: 'escort', color: VEHICLES.truck.color, target: null, ramCd: 0, wp: 0 };
    world.vehicles.push(t); run.truck = t;
    run.thugs = [];
    for (let i = 0; i < 3; i++) {
      const th = { id: 9200 + run.def.id * 10 + i, type: 'sedan', x: s.from[0] + 10 + i * 8, z: s.from[1] + 20, angle: Math.PI / 2, speed: 0, hp: 60, parked: false, driver: 'thug', color: 0xe5534b, target: null, ramCd: 0 };
      world.vehicles.push(th); run.thugs.push(th);
    }
  } else if (s.t === 'race') {
    const r = { id: 9300 + run.def.id, type: 'sedan', x: -6, z: -6, angle: 0, speed: 0, hp: 100, parked: false, driver: 'race', color: 0x8a1a2a, target: null, ramCd: 0, wp: 0 };
    world.vehicles.push(r); run.rival = r;
  } else if (s.t === 'boat') {
    const b = world.vehicles.find((vv) => vv.type === 'boat' && vv.parked);
    if (b) { b.x = s.from[0]; b.z = s.from[1]; b.angle = Math.PI / 2; }
  } else if (s.t === 'timed') {
    run.timer = s.seconds;
  }
  updateObjectiveLabel(run);
}

function updateObjectiveLabel(run) {
  const s = run.def.steps[run.stepIdx];
  if (!s) return;
  if (s.t === 'kill') run.objective = s.label.replace(/\(\d+\/\d+\)/, `(${run.kills}/${s.count})`);
  else if (s.t === 'race') run.objective = s.label.replace(/\(\d+\/\d+\)/, `(${run.cpIdx}/${s.points.length})`);
  else if (s.t === 'timed' && s.points) run.objective = s.label.replace(/\(\d+\/\d+\)/, `(${run.cpIdx}/${s.points.length})`);
  else run.objective = s.label;
}

function nextStep(run) {
  run.stepIdx++;
  if (run.stepIdx >= run.def.steps.length) { completeMission(run); return; }
  setupStep(run);
  blip(880, 0.15, 'sine', 0.3);
}

function failMission(run, why) {
  const m = run.def;
  game.mission = null;
  world.enemies.length = 0;
  banner(`Misi gagal: ${why} — tekan M untuk coba lagi`, 5);
  announce(`Misi ${m.id} gagal: ${why}`);
}

function completeMission(run) {
  const m = run.def;
  world.player.money += m.reward;
  game.mission = null;
  game.missionIndex++;
  world.enemies.length = 0;
  banner(`Misi selesai! +$${m.reward}`, 5);
  announce(`Misi ${m.id} selesai, +$${m.reward}`);
  jingle([523, 659, 784, 1047]);
  saveGame();
  if (game.missionIndex === 5) { world.phase = 1; banner('HARI 2 — MAGHRIB. Darto makin nekat.', 6); }
  else if (game.missionIndex === 10) { world.phase = 2; banner('HARI 3 — MALAM. Saatnya mengakhiri ini.', 6); }
  else if (game.missionIndex >= 15) {
    game.screen = SCREEN_WIN;
    const score = world.player.money;
    if (score > game.best) { game.best = score; try { window.localStorage.setItem(BEST_KEY, String(score)); } catch { /* abaikan */ } }
  }
}

function dist2(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

function driveToward(v, tx, tz, top, dt) {
  const dx = tx - v.x, dz = tz - v.z, d = Math.hypot(dx, dz);
  if (d < 3) return true;
  const want = Math.atan2(dx, dz);
  let da = want - v.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  v.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, da));
  v.speed = Math.min(top, v.speed + 14 * dt);
  v.x += Math.sin(v.angle) * v.speed * dt;
  v.z += Math.cos(v.angle) * v.speed * dt;
  return false;
}

function updateMission(dt) {
  const run = game.mission;
  if (!run) return;
  const s = run.def.steps[run.stepIdx];
  if (!s) return;
  const p = world.player;
  if (s.t === 'goto') {
    if (dist2(p.x, p.z, s.x, s.z) < s.r) nextStep(run);
  } else if (s.t === 'timed') {
    if (s.from && run.waitFrom) {
      const from = PLACES[s.from];
      if (dist2(p.x, p.z, from.x, from.z) < 10) { run.waitFrom = false; run.timer = s.seconds; banner('Waktu jalan!', 2); }
      return;
    }
    run.timer -= dt;
    if (s.points) {
      const pt = s.points[run.cpIdx];
      if (dist2(p.x, p.z, pt[0], pt[1]) < 10) {
        run.cpIdx++; updateObjectiveLabel(run); blip(990, 0.12, 'sine', 0.3);
        if (run.cpIdx >= s.points.length) { nextStep(run); return; }
      }
    } else if (dist2(p.x, p.z, s.x, s.z) < s.r) { nextStep(run); return; }
    if (run.timer <= 0) failMission(run, 'waktu habis');
    else run.objective = `${s.label} — ${Math.ceil(run.timer)} dtk`;
  } else if (s.t === 'kill') {
    if (run.kills >= s.count) nextStep(run);
  } else if (s.t === 'boss') {
    if (!world.enemies.some((e) => e.kind === 'boss')) nextStep(run);
  } else if (s.t === 'chase') {
    const t = run.targetCar;
    if (!t || t.hp <= 0) { nextStep(run); return; }
    const loop = [[130, -130], [130, 130], [-130, 130], [-130, -130]];
    const wp = loop[t.wp % loop.length];
    if (driveToward(t, wp[0], wp[1], 24, dt)) t.wp++;
    // Tabrakan pemain -> damage.
    game.ramCd -= dt;
    const pv = p.onFoot ? null : world.vehicles.find((vv) => vv.id === p.vehicleId);
    if (pv && dist2(pv.x, pv.z, t.x, t.z) < 4.6 && Math.abs(pv.speed) > 6 && game.ramCd <= 0) {
      game.ramCd = 0.8;
      if (damageVehicle(world, t, 25, true)) { banner('Mobil Si Licin mogok!', 3); }
      else { blip(180, 0.15, 'square', 0.35); noiseBurst(0.15, 0.3); }
      pv.speed *= 0.55;
    }
    run.objective = `${s.label} — HP mobil ${Math.max(0, Math.ceil(t.hp))}`;
  } else if (s.t === 'escort') {
    const t = run.truck;
    if (!t || t.hp <= 0) { failMission(run, 'truk hancur'); return; }
    const path = [[-195, 0], [-130, 65], [0, 65], [65, 130], [195, 130]];
    const wp = path[t.wp % path.length];
    if (driveToward(t, wp[0], wp[1], 12, dt)) t.wp++;
    if (t.wp >= path.length || dist2(t.x, t.z, 195, 130) < 8) { nextStep(run); return; }
    for (const th of run.thugs) {
      if (th.hp <= 0) continue;
      driveToward(th, t.x, t.z, 22, dt);
      th.ramCd = (th.ramCd || 0) - dt;
      if (dist2(th.x, th.z, t.x, t.z) < 5 && th.ramCd <= 0) {
        th.ramCd = 1.2; damageVehicle(world, t, 6, false); blip(140, 0.2, 'square', 0.3);
      }
      // Pemain menabrak preman -> damage.
      const pv = p.onFoot ? null : world.vehicles.find((vv) => vv.id === p.vehicleId);
      if (pv && dist2(pv.x, pv.z, th.x, th.z) < 4.4 && Math.abs(pv.speed) > 6) {
        damageVehicle(world, th, 30, true); pv.speed *= 0.6; noiseBurst(0.15, 0.3);
      }
    }
    const dTruck = dist2(p.x, p.z, t.x, t.z);
    if (dTruck > 55) { run.farTimer = (run.farTimer || 0) + dt; if (run.farTimer > 10) { failMission(run, 'tertinggal dari truk'); return; } }
    else run.farTimer = 0;
    run.objective = `${s.label} — HP truk ${Math.max(0, Math.ceil(t.hp))}`;
  } else if (s.t === 'race') {
    const pts = s.points;
    const pt = pts[run.cpIdx];
    if (dist2(p.x, p.z, pt[0], pt[1]) < 12) {
      run.cpIdx++; updateObjectiveLabel(run); blip(990, 0.12, 'sine', 0.3);
      if (run.cpIdx >= pts.length) { nextStep(run); return; }
    }
    const r = run.rival;
    if (r) {
      const rpt = pts[Math.min(r.wp, pts.length - 1)];
      const rubber = dist2(r.x, r.z, p.x, p.z) > 60 ? 30 : 24;
      if (driveToward(r, rpt[0], rpt[1], rubber, dt)) r.wp++;
      if (r.wp >= pts.length) { failMission(run, 'Si Licin menang balapan'); return; }
    }
  } else if (s.t === 'boat') {
    const pv = p.onFoot ? null : world.vehicles.find((vv) => vv.id === p.vehicleId);
    if (pv && pv.type === 'boat' && dist2(pv.x, pv.z, s.to[0], s.to[1]) < 12) nextStep(run);
    else if (!pv || pv.type !== 'boat') run.objective = `${s.label} — naik perahu dulu (E)`;
    else run.objective = s.label;
  }
}

// ---------- Kerja sampingan ----------
function startJob(def) {
  const job = { def, objective: '', timer: 0, cpIdx: 0, kills: 0, phase: 0 };
  if (def.id === 'taxi') { job.objective = 'Antar penumpang ke Pantai Senja.'; job.tx = -130; job.tz = 195; }
  if (def.id === 'kurir') { job.objective = 'Antar paket ke Bukit (40 dtk).'; job.tx = 195; job.tz = -65; job.timer = 40; }
  if (def.id === 'utang') {
    job.objective = 'Hadapi 2 preman (0/2).';
    spawnEnemy(world, 'thug', 195, 130); spawnEnemy(world, 'thug', 203, 138);
    job.tx = 195; job.tz = 130;
  }
  if (def.id === 'balap') { job.objective = 'Balapan 4 cek poin (0/4).'; job.points = [[0, 130], [130, 130], [130, -130], [0, -130]]; }
  if (def.id === 'ikan') { job.objective = 'Ikan Dermaga -> Pasar (50 dtk).'; job.tx = -65; job.tz = -130; job.timer = 50; }
  game.job = job;
  banner(`Kerja: ${def.name} — ${def.brief}`, 4);
}
function updateJob(dt) {
  const job = game.job;
  if (!job) return;
  const p = world.player;
  if (job.def.id === 'taxi') {
    if (dist2(p.x, p.z, job.tx, job.tz) < 8) finishJob();
  } else if (job.def.id === 'kurir' || job.def.id === 'ikan') {
    job.timer -= dt;
    if (dist2(p.x, p.z, job.tx, job.tz) < 8) finishJob();
    else if (job.timer <= 0) { game.job = null; banner('Kerja gagal: telat.', 3); }
    else job.objective = `${job.def.brief.split('(')[0]} (${Math.ceil(job.timer)} dtk)`;
  } else if (job.def.id === 'utang') {
    if (job.kills >= 2) finishJob();
  } else if (job.def.id === 'balap') {
    const pt = job.points[job.cpIdx];
    if (dist2(p.x, p.z, pt[0], pt[1]) < 12) {
      job.cpIdx++; job.objective = `Balapan 4 cek poin (${job.cpIdx}/4).`; blip(990, 0.12, 'sine', 0.3);
      if (job.cpIdx >= 4) finishJob();
    }
  }
}
function finishJob() {
  const job = game.job;
  world.player.money += job.def.reward;
  banner(`Kerja selesai! +$${job.def.reward}`, 4);
  jingle([659, 784]);
  game.job = null;
  saveGame();
}

// ---------- Toko ----------
function shopItems() {
  const place = game.shopPlace;
  if (place === 'klinik') return [
    { key: 1, name: 'Berobat (HP penuh)', price: ECONOMY.clinicHeal, run: () => { world.player.hp = world.player.maxHp; } },
    { key: 2, name: 'Rompi anti peluru (+60 HP maks)', price: ECONOMY.armorPrice, run: () => { world.player.maxHp += ECONOMY.armorHp; world.player.hp = world.player.maxHp; world.player.armor++; } },
  ];
  if (place === 'bengkel') return [
    { key: 1, name: 'Servis mobil (HP penuh)', price: ECONOMY.repairPrice, run: () => { const v = world.vehicles.find((vv) => vv.id === world.player.vehicleId); if (v) v.hp = VEHICLES[v.type].hp; } },
    { key: 2, name: 'Mesin balap (+25% laju)', price: ECONOMY.enginePrice, run: () => { world.player.engine = true; } },
  ];
  if (place === 'tokoSenjata') return [
    { key: 1, name: 'Amunisi +12', price: ECONOMY.ammoPrice, run: () => { world.player.ammo = Math.min(PLAYER.maxAmmo, world.player.ammo + ECONOMY.ammoAmount); } },
    { key: 2, name: 'Pistol berat (damage x1.5)', price: ECONOMY.damagePrice, run: () => { world.player.damage = true; } },
  ];
  if (place === 'rumahAman') return [
    { key: 1, name: 'Beli Rumah Aman (heal gratis + simpan)', price: ECONOMY.safehousePrice, run: () => { world.player.safehouse = true; world.player.hp = world.player.maxHp; } },
    { key: 2, name: 'Istirahat (HP penuh)', price: 0, run: () => { if (world.player.safehouse) world.player.hp = world.player.maxHp; } },
  ];
  return [];
}
function openShop(place) {
  game.shopPlace = place;
  game.screen = SCREEN_SHOP;
  const el = document.getElementById('shop-items');
  const items = shopItems();
  el.innerHTML = items.map((it) => `<div>[${it.key}] ${it.name} — $${it.price}</div>`).join('') + '<div style="margin-top:10px">Tekan angka untuk beli, P/Esc untuk keluar.</div>';
  const title = document.getElementById('shop-title');
  if (title) title.textContent = { klinik: 'KLINIK — Bu Sari', bengkel: 'BENGKEL — Bang Udin', tokoSenjata: 'TOKO SENJATA', rumahAman: 'RUMAH AMAN' }[place] || 'TOKO';
}
function buyShop(key) {
  const it = shopItems().find((i) => i.key === key);
  if (!it) return;
  if (world.player.money < it.price) { banner('Uang kurang!', 2); blip(160, 0.2, 'square', 0.3); return; }
  world.player.money -= it.price;
  it.run();
  banner(`Dibeli: ${it.name}`, 3);
  jingle([784, 988]);
  saveGame();
  openShop(game.shopPlace);
}

// ---------- Tembak ----------
function shoot() {
  const p = world.player;
  if (!p.onFoot) return;
  if (p.ammo <= 0) { // tinju
    if (game.fistCd > 0) return;
    game.fistCd = PLAYER.fistRate;
    for (const e of world.enemies) {
      if (dist2(p.x, p.z, e.x, e.z) < PLAYER.fistRange) {
        e.hp -= PLAYER.fistDamage; blip(120, 0.1, 'square', 0.3);
        if (e.hp <= 0) { p.money += 15; }
      }
    }
    return;
  }
  if (game.fireCd > 0) return;
  game.fireCd = PLAYER.fireRate;
  p.ammo--;
  noiseBurst(0.08, 0.35);
  world.gunshotAt = world.time;
  // Auto-aim: musuh terdekat dalam kerucut depan.
  let best = null, bestScore = 1e9;
  for (const e of world.enemies) {
    const d = dist2(p.x, p.z, e.x, e.z);
    if (d > PLAYER.pistolRange) continue;
    const ang = Math.atan2(e.x - p.x, e.z - p.z);
    let da = Math.abs(ang - p.angle);
    if (da > Math.PI) da = Math.PI * 2 - da;
    const score = d + da * 20;
    if (score < bestScore) { bestScore = score; best = e; }
  }
  if (best) {
    const dmg = PLAYER.pistolDamage * (p.damage ? 1.5 : 1);
    best.hp -= dmg;
    blip(300, 0.08, 'square', 0.25);
    if (best.hp <= 0) p.money += 15;
  }
  // Tembak mobil polisi / preman di jalan.
  for (const v of world.vehicles) {
    if (v.driver !== 'police' && v.driver !== 'thug') continue;
    if (dist2(p.x, p.z, v.x, v.z) < PLAYER.pistolRange && v.hp > 0) {
      const ang = Math.atan2(v.x - p.x, v.z - p.z);
      let da = Math.abs(ang - p.angle);
      if (da > Math.PI) da = Math.PI * 2 - da;
      if (da < 0.5) { damageVehicle(world, v, PLAYER.pistolDamage * (p.damage ? 1.5 : 1), true); break; }
    }
  }
}

// ---------- Wanted ----------
function raiseWanted(n) {
  const p = world.player;
  p.wanted = Math.min(5, p.wanted + n);
  if (p.wanted >= 1) audio();
}
function updateWanted(dt) {
  const p = world.player;
  // Jaga jumlah mobil polisi = wanted (maks 4).
  const alive = world.police.filter((v) => v.hp > 0).length;
  if (p.wanted > alive && p.wanted > 0) {
    const a = Math.random() * Math.PI * 2;
    const x = Math.max(-240, Math.min(240, p.x + Math.sin(a) * WANTED.policeSpawnDist));
    const z = Math.max(-240, Math.min(240, p.z + Math.cos(a) * WANTED.policeSpawnDist));
    const pc = spawnPoliceCar(world, x, z);
    pc.speed = 20;
  }
  // Hilang pelan kalau tidak ada polisi dekat.
  const near = world.police.some((v) => v.hp > 0 && dist2(v.x, v.z, p.x, p.z) < 60);
  if (p.wanted > 0 && !near) {
    game.wantedTimer += dt;
    if (game.wantedTimer > WANTED.decaySeconds) { p.wanted--; game.wantedTimer = 0; }
  } else game.wantedTimer = 0;
  // Helikopter mengikuti wanted.
  world.heli.active = p.wanted >= WANTED.heliAt;
}

// ---------- Loop utama ----------
function runShot(name) {
  const staged = stageShot(name, world);
  // Kamera mengikuti pemain dengan lerp: beri waktu cukup agar yaw-nya sampai ke target
  // sebelum foto diambil, kalau tidak framing-nya masih di tengah jalan.
  const targetYaw = world.player.angle + Math.PI;
  let painted = 0;
  function paint() {
    renderer.draw(world, staged.screen, staged.ui);
    painted++;
    let dy = targetYaw - renderer.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    if ((Math.abs(dy) < 0.05 || painted >= 150) && painted >= 2) window.__shotReady = true;
    else requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  const saved = loadSave();
  if (saved) {
    world.player.money = saved.money;
    game.missionIndex = Math.min(saved.missionIndex || 0, 14);
    world.player.armor = saved.armor || 0;
    world.player.engine = !!saved.engine;
    world.player.damage = !!saved.damage;
    world.player.safehouse = !!saved.safehouse;
    if (saved.maxHp) world.player.maxHp = saved.maxHp;
    world.phase = game.missionIndex >= 10 ? 2 : game.missionIndex >= 5 ? 1 : 0;
    banner('Save dimuat — lanjutkan perjuangan!', 4);
  }

  // Expose untuk probe headless.
  window.__game = { world, game, MISSIONS, startMission, shoot };

  function startGame() {
    game.screen = SCREEN_PLAY;
    game.started = true;
    audio();
    announce('Main. WASD jalan/nyetir, E masuk mobil, Space tembak, M mulai misi.');
  }

  function wasted() {
    game.screen = SCREEN_OVER;
    const fee = Math.floor(world.player.money * 0.1);
    world.player.money -= fee;
    world.player.hp = world.player.maxHp;
    world.player.wanted = 0;
    world.enemies.length = 0;
    if (game.mission) { game.mission = null; }
    saveGame();
    announce(`Tewas. Biaya rumah sakit $${fee}. Tekan Enter untuk bangkit.`);
  }

  function handleActions() {
    const a = input.takeActions();
    if (a & ACTION_CONFIRM) {
      audio();
      if (game.screen === SCREEN_TITLE || game.screen === SCREEN_OVER || game.screen === SCREEN_WIN) startGame();
      else if (game.screen === SCREEN_PLAY) shoot();
    }
    if (a & ACTION_PAUSE) {
      if (game.screen === SCREEN_PLAY) game.screen = SCREEN_PAUSED;
      else if (game.screen === SCREEN_PAUSED) game.screen = SCREEN_PLAY;
      else if (game.screen === SCREEN_SHOP) game.screen = SCREEN_PLAY;
    }
    if (a & ACTION_ENTER && game.screen === SCREEN_PLAY) {
      const p = world.player;
      if (p.onFoot) {
        let best = null, bestD = 6;
        for (const v of world.vehicles) {
          if (v.hp <= 0 || v.driver === 'traffic' || v.driver === 'police' || v.driver === 'chase' || v.driver === 'escort' || v.driver === 'thug' || v.driver === 'race') continue;
          const d = dist2(p.x, p.z, v.x, v.z);
          if (d < bestD) { bestD = d; best = v; }
        }
        if (best) {
          if (best.parked && best.driver === 'none') { enterVehicle(world, best); blip(440, 0.1, 'sine', 0.25); }
          else enterVehicle(world, best);
        }
      } else exitVehicle(world);
    }
    if (a & ACTION_STEAL && game.screen === SCREEN_PLAY) {
      const p = world.player;
      if (p.onFoot) {
        let best = null, bestD = 6;
        for (const v of world.vehicles) {
          if (v.hp <= 0 || v.driver !== 'none' || !v.parked) continue;
          const d = dist2(p.x, p.z, v.x, v.z);
          if (d < bestD) { bestD = d; best = v; }
        }
        if (best) { enterVehicle(world, best); raiseWanted(1); banner('Mobil dicuri! Wanted +1', 3); blip(220, 0.2, 'square', 0.3); }
      }
    }
    if (a & ACTION_MISSION && game.screen === SCREEN_PLAY) {
      if (!game.mission) startMission();
    }
    if (a & ACTION_INTERACT && game.screen === SCREEN_PLAY) {
      const p = world.player;
      for (const [key, place] of Object.entries(PLACES)) {
        if (['klinik', 'bengkel', 'tokoSenjata', 'rumahAman'].includes(key) && dist2(p.x, p.z, place.x, place.z) < 9) {
          openShop(key); break;
        }
      }
    }
    // Tombol toko 1-5.
    for (let k = 1; k <= 5; k++) {
      if (a & (1 << (16 + k)) && game.screen === SCREEN_SHOP) buyShop(k);
    }
  }

  function step() {
    const p = world.player;
    if (game.screen === SCREEN_TITLE) {
      stepWorld(world, STEP, { fwd: false, back: false, left: false, right: false, run: false, shoot: false, camYaw: renderer.camYaw }, { wanted: 0 });
      return;
    }
    game.fireCd = Math.max(0, game.fireCd - STEP);
    game.fistCd = Math.max(0, game.fistCd - STEP);
    const ctl = {
      fwd: input.forward(), back: input.back(), left: input.left(), right: input.right(),
      run: input.run(), shoot: input.mouseDown(), camYaw: renderer.camYaw,
    };
    const events = stepWorld(world, STEP, ctl, {
      wanted: p.wanted,
      onKill: (kind) => {
        if (game.mission) { game.mission.kills++; updateObjectiveLabel(game.mission); }
        if (game.job && game.job.def.id === 'utang') game.job.kills++;
        if (kind === 'boss') banner('BANG DARTO TUMBANG!', 5);
      },
    });
    for (const ev of events) {
      if (ev.type === 'damage' && ev.from === 'police') { /* sudah dikurangi di world */ }
      if (ev.type === 'carDead') {
        exitVehicle(world);
        banner('Mobilmu hancur!', 3);
      }
      if (ev.type === 'copDown') raiseWanted(1);
      if (ev.type === 'crash') noiseBurst(0.12, 0.25);
    }
    if (input.mouseDown() && p.onFoot) shoot();
    // Masuk marker kerja sampingan.
    if (!game.job && !game.mission) {
      for (const def of SIDE_JOBS) {
        if (dist2(p.x, p.z, def.x, def.z) < 8) { startJob(def); break; }
      }
    }
    updateMission(STEP);
    updateJob(STEP);
    updateWanted(STEP);
    // Suara mesin + sirene.
    if (engineGain) engineGain.gain.value = p.onFoot ? 0 : Math.min(0.12, Math.abs(p.speed) * 0.003);
    if (engineOsc) engineOsc.frequency.value = 40 + Math.abs(p.speed) * 3;
    if (sirenGain) sirenGain.gain.value = p.wanted > 0 ? 0.05 : 0;
    if (sirenOsc) sirenOsc.frequency.value = 650 + Math.sin(world.time * 6) * 150;
    if (p.hp <= 0) wasted();
    // Rumah aman: heal gratis saat di dekatnya.
    if (p.safehouse && dist2(p.x, p.z, PLACES.rumahAman.x, PLACES.rumahAman.z) < 10) p.hp = Math.min(p.maxHp, p.hp + 2 * STEP);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (game.screen === SCREEN_TITLE || game.screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (game.screen === SCREEN_TITLE || game.screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else accumulator = 0;
    const ui = {
      missionTitle: missionTitle(),
      objective: objectiveText(),
      marker: game.mission ? missionMarker() : game.job ? { x: game.job.tx ?? game.job.points?.[game.job.cpIdx]?.[0] ?? 0, z: game.job.tz ?? game.job.points?.[game.job.cpIdx]?.[1] ?? 0 } : null,
      banner: game.banner, bannerUntil: game.bannerUntil,
    };
    renderer.draw(world, game.screen, ui);
  }

  function missionMarker() {
    const run = game.mission;
    if (!run) return null;
    const s = run.def.steps[run.stepIdx];
    if (!s) return null;
    if (s.t === 'goto' || s.t === 'timed') {
      if (s.points) { const pt = s.points[run.cpIdx]; return pt ? { x: pt[0], z: pt[1] } : null; }
      return { x: s.x, z: s.z };
    }
    if (s.t === 'kill' || s.t === 'boss') return { x: s.x, z: s.z };
    if (s.t === 'chase' && run.targetCar) return { x: run.targetCar.x, z: run.targetCar.z };
    if (s.t === 'escort' && run.truck) return { x: run.truck.x, z: run.truck.z };
    if (s.t === 'race') { const pt = s.points[run.cpIdx]; return pt ? { x: pt[0], z: pt[1] } : null; }
    if (s.t === 'boat') return { x: s.to[0], z: s.to[1] };
    return null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === SCREEN_PLAY) game.screen = SCREEN_PAUSED;
  });

  announce('Teluk Harapan. Tekan Space atau klik untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
