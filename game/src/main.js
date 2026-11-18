// TELUK HARAPAN — main.js
// Boot entrypoint: membangun state game, game loop, kamera, input tingkat
// tinggi (menu, dialog, toko, misi), dan semua helper yang dipakai modul lain.
// main.ts (program penyerahan) memanggil game ini lewat index.html.

import { WORLD, DAYS, SHOPS } from './config.js';
import { makeRng } from './random.js';
import { buildWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayerOnFoot, tryInteract, exitCar, damageEnemy, enterCar } from './player.js';
import { makeCar, spawnTrafficCar, ensureTraffic, updatePlayerCar, updateTrafficCar, updatePoliceCar } from './vehicles.js';
import { ensurePeds, updatePeds } from './pedestrians.js';
import { updateBullets, updateEnemies } from './combat.js';
import { updatePolice } from './police.js';
import {
  createMissionState, startMission, updateMission, missionEvent as missionEventFn,
  nextMissionStart, nextMissionId, npcTalked, missionById,
} from './missions.js';
import { buyItem, updatePickups } from './economy.js';
import { saveGame as saveGameFn, loadGame as loadGameFn, saveSummary } from './save.js';
import { renderWorld } from './render.js';
import {
  drawHUD, drawDialogue, drawShop, drawTitle, drawPause, drawGameOver,
  drawVictory, drawBigMap, drawHelp,
} from './hud.js';
import { parseShotQuery, setupShot, autopilot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

export function createGame() {
  const seed = 20261118;
  const rng = makeRng(seed);
  const G = {
    seed,
    rng,
    canvas,
    ctx,
    state: 'title', // title | playing | paused | gameover | victory
    timeNow: 0,
    timeScale: 1,
    world: null,
    player: null,
    cars: [],
    peds: [],
    enemies: [],
    npcs: [],
    bullets: [],
    particles: [],
    floatingTexts: [],
    pickups: [],
    roadblocks: [],
    heli: null,
    mission: createMissionState(),
    cam: { x: 1500, y: 1400, w: 1280, h: 720, zoom: 1 },
    input: null,
    audio: createAudio(),
    dialogue: null, // { lines, index, chars, onDone }
    shopOpen: null,
    shopSel: 0,
    shopMsg: null,
    shopMsgOk: true,
    shopMsgTimer: 0,
    toasts: [],
    titleSel: 0,
    pauseSel: 0,
    helpOpen: false,
    bigMap: false,
    shake: 0,
    hideTimer: 0,
    spawnTimer: 0,
    pedTimer: 0,
    policeTimer: 0,
    copTimer: 0,
    blockTimer: 0,
    recentShot: null,
    recentShotActive: false,
    stashTakenToday: false,
    lastCrime: null,
    autotest: false,
    autotestDone: false,
    autotestStart: 0,
    shotMode: 0,
    errors: [],
  };

  // --- Helper yang dipakai modul lain -----------------------------------------
  G.addToast = (text) => {
    G.toasts.push({ text, life: 4 });
    if (G.toasts.length > 4) G.toasts.shift();
  };
  G.addParticles = (x, y, n, color, speed) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (speed || 120) * (0.4 + Math.random() * 0.8);
      G.particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.5, maxLife: 1,
        color, size: 2 + Math.random() * 4,
      });
    }
    if (G.particles.length > 600) G.particles.splice(0, G.particles.length - 600);
  };
  G.addFloatingText = (x, y, text, color) => {
    G.floatingTexts.push({ x, y, text, color, life: 1.2 });
    if (G.floatingTexts.length > 30) G.floatingTexts.shift();
  };
  G.showDialogue = (lines, onDone) => {
    G.dialogue = { lines, index: 0, chars: 0, onDone: onDone || null };
  };
  G.setDay = (day) => {
    G.player.day = day;
    G.stashTakenToday = false;
    const d = DAYS[day - 1];
    if (d) G.addToast(d.phase + ' turun di Teluk Harapan.');
  };
  G.saveGame = (slot) => saveGameFn(G, slot);
  G.loadGame = (slot) => loadGameFn(G, slot);
  G.missionEvent = (kind, data) => missionEventFn(G, kind, data);
  G.damageEnemy = (e, amount, kind) => damageEnemy(G, e, amount, kind);
  G.nextMissionStart = () => nextMissionStart(G);

  // --- Dunia & pemain ------------------------------------------------------------
  G.world = buildWorld(rng);
  G.player = createPlayer(1500, 1560);
  G.input = createInput(canvas);

  // Mobil parkir awal di sekitar titik mulai.
  const parked = [
    ['sedan', 1500, 1560, 0, '#4a7fb5'],
    ['pikap', 900, 1300, Math.PI / 2, '#7a8a7a'],
    ['taksi', 1300, 1400, Math.PI, '#e8c832'],
    ['becakmotor', 2100, 1700, -Math.PI / 2, '#e8b93c'],
    ['sport', 1500, 1750, Math.PI, '#c93a3a'],
  ];
  for (const [model, x, y, a, color] of parked) {
    G.cars.push(makeCar(model, x, y, a, { color }));
  }
  // Lalu lintas awal (pejalan kaki di-spawn lewat ensurePeds di loop pertama).
  for (let i = 0; i < 10; i++) G.cars.push(spawnTrafficCar(G, G.player));
  G.cam.x = G.player.x;
  G.cam.y = G.player.y;

  return G;
}

// --- Penanda misi berikutnya saat free roam ---------------------------------------
function refreshFreeRoamMarker(G) {
  const M = G.mission;
  if (M.active) return;
  const start = nextMissionStart(G);
  if (start) {
    M.marker = { x: start.x, y: start.y, label: 'Misi ' + start.missionId + ': ' + missionById(start.missionId).title };
    M.objective = 'Menuju misi berikutnya: ' + missionById(start.missionId).title;
  } else {
    M.marker = null;
    M.objective = 'Semua misi selesai! Jelajahi Teluk Harapan dengan bebas.';
  }
}

// --- Input tingkat tinggi -----------------------------------------------------------
function handleGlobalKeys(G) {
  const inp = G.input;
  const p = G.player;

  // Dialog: Enter / klik lanjut.
  if (G.dialogue) {
    const d = G.dialogue;
    const line = d.lines[d.index];
    if (inp.wasPressed('Enter') || inp.mouse.clicked) {
      if (d.chars < line.text.length) {
        d.chars = line.text.length;
      } else if (d.index < d.lines.length - 1) {
        d.index++;
        d.chars = 0;
      } else {
        const done = d.onDone;
        G.dialogue = null;
        if (done) done();
      }
      G.audio.sfx.click();
    }
    return;
  }

  // Toko: navigasi & beli.
  if (G.shopOpen) {
    const shop = G.shopOpen;
    if (inp.wasPressed('Escape') || inp.wasPressed('E')) {
      G.shopOpen = null;
      G.shopMsg = null;
      return;
    }
    if (inp.wasPressed('ArrowUp') || inp.wasPressed('W')) {
      G.shopSel = (G.shopSel + shop.stock.length - 1) % shop.stock.length;
      G.audio.sfx.click();
    }
    if (inp.wasPressed('ArrowDown') || inp.wasPressed('S')) {
      G.shopSel = (G.shopSel + 1) % shop.stock.length;
      G.audio.sfx.click();
    }
    if (inp.wasPressed('Enter')) {
      const item = shop.stock[G.shopSel];
      const res = buyItem(G, shop, item.id);
      G.shopMsg = res.message;
      G.shopMsgOk = res.ok;
      G.shopMsgTimer = 3;
      if (res.ok) G.audio.sfx.save();
    }
    // Klik angka 1-9 untuk beli langsung.
    for (let i = 0; i < Math.min(9, shop.stock.length); i++) {
      if (inp.wasPressed(String(i + 1))) {
        const res = buyItem(G, shop, shop.stock[i].id);
        G.shopMsg = res.message;
        G.shopMsgOk = res.ok;
        G.shopMsgTimer = 3;
      }
    }
    return;
  }

  if (G.state === 'title') {
    if (G.helpOpen) {
      if (inp.wasPressed('Enter') || inp.wasPressed('Escape')) G.helpOpen = false;
      return;
    }
    if (inp.wasPressed('ArrowUp') || inp.wasPressed('W')) {
      G.titleSel = (G.titleSel + 5 - 1) % 5;
      G.audio.sfx.click();
    }
    if (inp.wasPressed('ArrowDown') || inp.wasPressed('S')) {
      G.titleSel = (G.titleSel + 1) % 5;
      G.audio.sfx.click();
    }
    if (inp.wasPressed('Enter')) {
      titleChoose(G, G.titleSel);
    }
    return;
  }

  if (G.state === 'paused') {
    if (inp.wasPressed('Escape') || inp.wasPressed('P')) {
      G.state = 'playing';
      return;
    }
    if (inp.wasPressed('ArrowUp') || inp.wasPressed('W')) {
      G.pauseSel = (G.pauseSel + 6 - 1) % 6;
      G.audio.sfx.click();
    }
    if (inp.wasPressed('ArrowDown') || inp.wasPressed('S')) {
      G.pauseSel = (G.pauseSel + 1) % 6;
      G.audio.sfx.click();
    }
    if (inp.wasPressed('Enter')) pauseChoose(G, G.pauseSel);
    return;
  }

  if (G.state === 'gameover') {
    if (inp.wasPressed('Enter')) {
      // Bangkit di Rumah Aman.
      p.hp = p.maxHp;
      p.armor = Math.max(p.armor, 25);
      p.x = 2950;
      p.y = 600;
      p.wanted = 0;
      p.wantedHeat = 0;
      p.cash = Math.max(0, p.cash - 200);
      G.state = 'playing';
      G.addToast('Kau bangkit di Rumah Aman. Denda Rp 200.');
    } else if (inp.wasPressed('Escape')) {
      G.state = 'title';
    }
    return;
  }

  if (G.state === 'victory') {
    if (inp.wasPressed('Enter')) {
      G.state = 'playing';
      refreshFreeRoamMarker(G);
    } else if (inp.wasPressed('Escape')) {
      G.state = 'title';
    }
    return;
  }

  // --- Bermain -----------------------------------------------------------------------
  if (G.state === 'playing') {
    if (inp.wasPressed('Escape') || inp.wasPressed('P')) {
      G.state = 'paused';
      G.audio.setEngine(0, false);
      return;
    }
    if (inp.wasPressed('M')) {
      G.bigMap = !G.bigMap;
      G.audio.sfx.click();
      return;
    }
    if (G.bigMap) {
      if (inp.wasPressed('Escape') || inp.wasPressed('M')) G.bigMap = false;
      return;
    }
    // Interaksi (E): mulai misi > bicara NPC > toko > mobil.
    if (inp.wasPressed('E')) {
      const M = G.mission;
      if (!M.active && M.marker && Math.hypot(p.x - M.marker.x, p.y - M.marker.y) < 85) {
        const id = nextMissionId(G);
        if (id > 0) {
          startMission(G, id);
          return;
        }
      }
      // Stage curi kendaraan: E masuk kendaraan misi SECARA LANGSUNG (bukan
      // mobil terdekat — mobil biasa yang diparkir di sampingnya bikin loop).
      const st = G.mission.stage;
      if (st && (st.id.includes('curi') || st.id.includes('ambil-paket'))) {
        const mv = G.mission.stageData.bike || G.mission.stageData.taxi;
        if (mv && !mv.crashed && Math.hypot(p.x - mv.x, p.y - mv.y) < 85) {
          enterCar(G, mv);
          return;
        }
      }
      // Stage foto: E memotret dari mobil, bukan keluar mobil (di jalanan
      // Dermaga yang ramai polisi, turun = sasaran empuk).
      if (st && st.id.includes('foto')) {
        return;
      }
      // NPC terdekat.
      let talked = false;
      for (const npc of G.npcs) {
        if (Math.hypot(p.x - npc.x, p.y - npc.y) < 70) {
          npcTalked(G, npc);
          talked = true;
          break;
        }
      }
      if (talked) return;
      if (p.inCar) {
        exitCar(G);
        return;
      }
      const res = tryInteract(G);
      if (res === 'shop') {
        G.shopSel = 0;
        G.shopMsg = null;
      }
    }
  }
}

function titleChoose(G, sel) {
  G.audio.init();
  G.audio.sfx.click();
  if (sel === 0) {
    startNewGame(G);
  } else if (sel >= 1 && sel <= 3) {
    const slot = sel;
    const summary = saveSummary(slot);
    if (!summary) {
      G.addToast('Slot ' + slot + ' kosong.');
      return;
    }
    const ok = G.loadGame(slot);
    if (ok) {
      G.state = 'playing';
      refreshFreeRoamMarker(G);
    }
  } else if (sel === 4) {
    G.helpOpen = true;
  }
}

function pauseChoose(G, sel) {
  G.audio.sfx.click();
  if (sel === 0) {
    G.state = 'playing';
  } else if (sel >= 1 && sel <= 3) {
    G.saveGame(sel);
  } else if (sel === 4) {
    const on = G.audio.toggleMusic();
    G.addToast('Musik ' + (on ? 'menyala' : 'mati') + '.');
  } else if (sel === 5) {
    G.state = 'title';
    G.audio.setEngine(0, false);
    G.audio.setSiren(false);
  }
}

export function startNewGame(G) {
  const p = G.player;
  p.x = 1500;
  p.y = 1560;
  p.hp = p.maxHp;
  p.armor = 0;
  p.cash = 250;
  p.wanted = 0;
  p.wantedHeat = 0;
  p.day = 1;
  p.missionsDone = 0;
  p.kills = 0;
  p.carsStolen = 0;
  p.weapon = 'pistol';
  p.owned = { fist: true, pistol: true, smg: false, shotgun: false };
  p.reserve = { pistol: 300, smg: 0, shotgun: 0 };
  p.mag = { pistol: 12, smg: 30, shotgun: 6 };
  p.medkits = 3;
  p.inCar = null;
  G.mission = createMissionState();
  G.enemies = [];
  G.npcs = [];
  G.bullets = [];
  G.pickups = [];
  G.roadblocks = [];
  G.heli = null;
  G.setDay(1);
  G.state = 'playing';
  refreshFreeRoamMarker(G);
  G.addToast('Selamat datang di Teluk Harapan, Raka. Ikuti penanda kuning!');
  G.audio.sfx.mission();
}

// --- Update ----------------------------------------------------------------------
function update(G, dt) {
  const p = G.player;
  const inp = G.input;

  // Mouse -> koordinat dunia (untuk bidik).
  const rect = canvas.getBoundingClientRect();
  const scaleX = G.cam.w / canvas.width;
  const scaleY = G.cam.h / canvas.height;
  inp.mouse.worldX = (inp.mouse.x * scaleX) + (G.cam.x - G.cam.w / 2);
  inp.mouse.worldY = (inp.mouse.y * scaleY) + (G.cam.y - G.cam.h / 2);

  // Autopilot (hanya ?autotest=1) berjalan SEBELUM input dibaca, agar
  // tombol yang ditekan autopilot terbaca di frame yang sama.
  if (G.autotest && !G.autotestDone) autopilot(G, dt);

  // Dialog berjalan (typewriter) walau dunia berhenti.
  if (G.dialogue) {
    const d = G.dialogue;
    const line = d.lines[d.index];
    if (line && d.chars < line.text.length) d.chars = Math.min(line.text.length, d.chars + dt * 55);
    handleGlobalKeys(G);
    inp.endFrame();
    return;
  }

  handleGlobalKeys(G);
  if (G.shopOpen) {
    if (G.shopMsgTimer > 0) {
      G.shopMsgTimer -= dt;
      if (G.shopMsgTimer <= 0) G.shopMsg = null;
    }
    inp.endFrame();
    return;
  }
  if (G.state !== 'playing' || G.bigMap) {
    inp.endFrame();
    return;
  }

  G.timeNow += dt;
  p.playTime += dt;

  // Pemain: jalan kaki atau mengemudi.
  if (p.inCar) updatePlayerCar(G, dt);
  else updatePlayerOnFoot(G, dt);

  // Sistem dunia.
  ensureTraffic(G, dt);
  ensurePeds(G, dt);
  for (const car of G.cars) {
    if (car.driver === 'traffic') updateTrafficCar(G, car, dt);
    else if (car.driver === 'police' && car.ai && car.ai.kind === 'police') updatePoliceCar(G, car, dt);
  }
  updatePeds(G, dt);
  updateEnemies(G, dt);
  updateBullets(G, dt);
  updatePolice(G, dt);
  updateMission(G, dt);
  updatePickups(G, dt);

  // Tembakan terakhir (untuk reaksi pejalan kaki & wanted).
  let latestShot = null;
  for (const b of G.bullets) {
    if (b.from === 'player') latestShot = { x: b.x, y: b.y, t: G.timeNow };
  }
  if (latestShot) G.recentShot = latestShot;
  G.recentShotActive = !!(G.recentShot && G.timeNow - G.recentShot.t < 3);

  // Partikel & teks melayang.
  for (const pt of G.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    pt.life -= dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
  for (const ft of G.floatingTexts) {
    ft.y -= 30 * dt;
    ft.life -= dt;
  }
  G.floatingTexts = G.floatingTexts.filter((ft) => ft.life > 0);
  for (const t of G.toasts) t.life -= dt;
  G.toasts = G.toasts.filter((t) => t.life > 0);
  G.shake = Math.max(0, G.shake - dt * 20);

  // Kamera mengikuti pemain.
  const cam = G.cam;
  cam.x += (p.x - cam.x) * Math.min(1, dt * 5);
  cam.y += (p.y - cam.y) * Math.min(1, dt * 5);
  cam.x = Math.max(cam.w / 2 - 60, Math.min(WORLD.width - cam.w / 2 + 60, cam.x));
  cam.y = Math.max(cam.h / 2 - 60, Math.min(WORLD.height - cam.h / 2 + 60, cam.y));

  // Audio mesin mati bila jalan kaki.
  if (!p.inCar) G.audio.setEngine(0, false);

  // Autotest timeout (4 menit).
  if (G.autotest && !G.autotestDone && G.timeNow - G.autotestStart > 420) {
    console.log('[AUTOTEST] FAIL — timeout 420 detik. Misi: ' + p.missionsDone + '/5, stage: ' + (G.mission.stage ? G.mission.stage.id : 'none'));
    document.title = 'AUTOTEST FAIL timeout';
    G.autotestDone = true;
  }

  inp.endFrame();
}

// --- Render ------------------------------------------------------------------------
function render(G) {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Goyangan kamera saat ledakan/tabrak.
  const shx = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  const shy = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;

  if (G.state === 'title') {
    drawTitle(G, ctx, W, H);
    if (G.helpOpen) drawHelp(G, ctx, W, H);
    return;
  }

  ctx.save();
  ctx.translate(-shx, -shy);
  renderWorld(G, ctx);
  ctx.restore();

  // HUD selalu di atas dunia saat bermain / jeda / akhir.
  if (G.state === 'playing' || G.state === 'paused' || G.state === 'gameover' || G.state === 'victory') {
    drawHUD(G, ctx, W, H);
  }
  if (G.dialogue) drawDialogue(G, ctx, W, H);
  if (G.shopOpen) drawShop(G, ctx, W, H);
  if (G.bigMap && G.state === 'playing') drawBigMap(G, ctx, W, H);
  if (G.state === 'paused') drawPause(G, ctx, W, H);
  if (G.state === 'gameover') drawGameOver(G, ctx, W, H);
  if (G.state === 'victory') drawVictory(G, ctx, W, H);
}

// --- Resize ----------------------------------------------------------------------------
function resize(G) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  G.cam.w = w;
  G.cam.h = h;
}

// --- Boot -------------------------------------------------------------------------------
function boot() {
  window.addEventListener('error', (e) => {
    console.error('[GAME ERROR]', e.message, e.filename, e.lineno);
  });
  const G = createGame();
  window.__game = G;
  const q = parseShotQuery();
  G.shotMode = q.shot;
  G.autotest = q.autotest;
  resize(G);
  window.addEventListener('resize', () => resize(G));

  if (q.shot > 0) {
    // Mode screenshot deterministik: bangun scene tetap, render satu frame.
    G.rng = makeRng(q.seed);
    setupShot(G, q.shot);
    G.timeNow = 1.234;
    // Kamera ke pemain.
    G.cam.x = G.player.x;
    G.cam.y = G.player.y;
    render(G);
    document.title = 'SHOT READY';
    console.log('[SHOT] ready shot=' + q.shot + ' seed=' + q.seed);
    return;
  }

  if (G.autotest) {
    G.timeScale = 2;
    G.autotestStart = 0;
    console.log('[AUTOTEST] mulai — target: menangkan 5 misi.');
  }

  let last = performance.now();
  function frame(now) {
    const rawDt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dt = rawDt * G.timeScale;
    if (G.state === 'title' || G.state === 'paused' || G.state === 'gameover' || G.state === 'victory') {
      // Menu tetap beranimasi (tips, denyut) walau dunia diam.
      G.timeNow += dt;
      if (G.autotest && !G.autotestDone) autopilot(G, dt);
      handleGlobalKeys(G);
      G.input.endFrame();
    } else {
      try {
        update(G, dt);
      } catch (err) {
        // Satu bug tidak boleh membekukan game: catat dan lanjutkan frame
        // berikutnya (maks 10x, lalu berhenti agar tidak spam).
        G.errors.push(String(err && err.message ? err.message : err));
        console.error('[GAME ERROR]', err);
        if (G.errors.length > 10) {
          document.title = 'GAME ERROR — lihat konsol';
          return;
        }
      }
    }
    render(G);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Klik pertama mengaktifkan audio (kebijakan browser).
  window.addEventListener('pointerdown', () => G.audio.init(), { once: true });
  window.addEventListener('keydown', () => G.audio.init(), { once: true });
}

boot();
