// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. Screens:
// title, play, paused, game over and win. Progress (money, health, day, mission) is saved to
// localStorage whenever a mission is completed, so Space on the title continues a saved run.
//
// ?seed=N fixes the city's random layout. ?shot=start|play|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUY, EVENT_CRIME, EVENT_DAY, EVENT_HIT, EVENT_MISSION, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, EVENT_WASTED, EVENT_WIN } from './world.js';
import { ACTION_BUY, ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const banner = document.getElementById('hud-banner-panel');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeSave() {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.snapshot())); } catch { /* storage can be off */ }
}
function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

function titleHtml() {
  const save = readSave();
  const cont = save ? `<p>Lanjutkan: Hari ${save.day + 1}, Misi ${save.mission + 1} — $${save.money}</p>` : '';
  return `<h1>TELUK HARAPAN</h1>
<p>Kota fiktif di ujung teluk. Raka pulang kampung dan berhadapan dengan Bang Darto.</p>
<p>12 misi dalam 3 hari · 7 distrik · nyetir, curi mobil, kejar-kejaran polisi</p>
${cont}
<p>WASD jalan / nyetir · E masuk &amp; keluar mobil · F pukul · klik / Space tembak · B beli di toko · P jeda</p>
<p>Tekan Space atau klik untuk main</p>`;
}
function overHtml() {
  const s = world.state.stats;
  return `<h1>RAKA TUMBANG</h1><p>Polisi dan preman menang ronde ini. Misi ${world.state.mission.index + 1} diulang dari simpanan terakhir.</p><p>Misi selesai: ${s.missions} · Mobil dicuri: ${s.stolen}</p><p>Tekan Space untuk coba lagi</p>`;
}
function winHtml() {
  const s = world.state.stats;
  return `<h1>KOTA INI MILIKMU, RAKA</h1><p>Bang Darto kalah. Teluk Harapan bebas — 12 misi selesai!</p><p>Uang: $${world.state.player.money} · Preman dikalahkan: ${s.kills} · Mobil dicuri: ${s.stolen}</p><p>Tekan Space untuk main lagi dari awal</p>`;
}

function runShot(name) {
  if (name === 'start') banner.innerHTML = titleHtml();
  else banner.innerHTML = '';
  const scene = stageShot(name, world);
  if (scene.camera) renderer.setShotCamera(scene.camera.x, scene.camera.y, scene.camera.z, scene.camera.tx, scene.camera.ty, scene.camera.tz);
  const simSeconds = name === 'play' ? 24 : name === 'chase' ? 30 : name === 'mission' ? 12 : 5;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, simSeconds);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (dx, dy) => renderer.addLook(dx, dy));
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();
  let started = false;

  function announce(message) { status.textContent = message; }
  function showBanner(html) { banner.innerHTML = html; }

  function startGame() {
    const save = readSave();
    world.reset();
    if (save && save.mission > 0) world.restore(save);
    accumulator = 0;
    screen = 'play';
    audio.unlock(world.state.day);
    announce('Main. Ikuti beacon kuning ke misi berikutnya.');
  }
  function endGame() {
    screen = 'over';
    showBanner(overHtml());
    announce('Raka tumbang. Tekan Space untuk coba lagi.');
  }
  function winGame() {
    screen = 'win';
    clearSave();
    showBanner(winHtml());
    announce('Menang! Kota ini milikmu, Raka.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === 'title') { if (!started) { started = true; } startGame(); }
      else if (screen === 'over') { world.reset(); const save = readSave(); if (save) world.restore(save); screen = 'play'; accumulator = 0; }
      else if (screen === 'win') { clearSave(); world.reset(); screen = 'play'; accumulator = 0; }
    } else if (actions & ACTION_PAUSE && screen === 'play') {
      screen = 'paused';
      announce('Jeda.');
    } else if (actions & ACTION_PAUSE && screen === 'paused') {
      screen = 'play';
      announce('Main.');
    }
    return actions;
  }

  function stepWorld(actions) {
    const held = input.held;
    const wInput = {
      up: held.up, down: held.down, left: held.left, right: held.right, run: held.run,
      enter: !!(actions & ACTION_ENTER),
      punch: !!(actions & ACTION_PUNCH),
      shoot: held.shoot,
      buy: !!(actions & ACTION_BUY),
    };
    const events = world.step(STEP, wInput);
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_MISSION) { audio.mission(); writeSave(); }
    if (events & EVENT_DAY) audio.setDay(world.state.day);
    if (events & EVENT_BUY) audio.pickup();
    if (events & EVENT_WASTED) endGame();
    else if (events & EVENT_WIN) winGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One-shot actions (confirm, pause, enter, punch, buy) are read once per frame
    // for every screen, so P can resume from pause and Space works on every screen.
    // They are only fed to the first world sub-step of the frame.
    const actions = handleActions();
    if (screen === 'title') {
      world.step(STEP, { up: false, down: false, left: false, right: false, run: false, enter: false, punch: false, shoot: false, buy: false });
      renderer.draw(world.state, 'title', now / 1000);
      return;
    }
    if (screen === 'play') {
      let first = true;
      while (accumulator >= STEP && screen === 'play') {
        stepWorld(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
      audio.engine(world.state.player.speed, world.state.player.inCar !== null);
      audio.siren(world.state.wanted > 0, now / 1000);
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, now / 1000);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      announce('Jeda.');
    }
  });

  showBanner(titleHtml());
  announce('Teluk Harapan. Tekan Space atau klik untuk main.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
