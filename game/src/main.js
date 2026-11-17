// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, game over and win.
//
// ?seed=N fixes the city and the traffic. ?shot=start|play|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { CAR, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { EVENT_CASH, EVENT_MISSION, EVENT_OVER, createWorld } from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_ENTER,
  ACTION_HORN,
  ACTION_PAUSE,
  ACTION_PUNCH,
  ACTION_SHOOT,
  ACTION_STEAL,
  ACTION_WEAPON,
  createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas, world);
const audio = createAudio();

const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  over: document.getElementById('screen-over'),
  win: document.getElementById('screen-win'),
  continueBtn: document.getElementById('btn-continue'),
  overStats: document.getElementById('over-stats'),
  winStats: document.getElementById('win-stats'),
};

function showOnly(name) {
  for (const [key, el] of Object.entries(screens)) {
    if (!el || key === 'continueBtn' || key === 'overStats' || key === 'winStats') continue;
    el.classList.toggle('hidden', key !== name);
  }
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.save()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function statsLine() {
  const s = world.state.stats;
  return `Misi selesai: ${s.missionsDone} · Uang didapat: $${s.earned} · Mobil dicuri: ${s.carsStolen}`;
}

function runShot(name) {
  // Gameplay shots show the game itself, not the title screen: hide the overlays
  // (the start shot keeps its title panel — that is the shot).
  if (name !== 'start') {
    for (const id of ['screen-title', 'screen-pause', 'screen-over', 'screen-win']) {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    }
  }
  const scene = stageShot(name, world);
  renderer.setCameraMode(name === 'start' ? 'orbit' : 'follow');
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, 0, STEP);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let saveClock = 0;

  const save = readSave();
  if (save && screens.continueBtn) {
    screens.continueBtn.classList.remove('hidden');
    screens.continueBtn.textContent = `Lanjutkan — Misi ${Math.min(save.missionIndex + 1, 5)} · $${save.money}`;
  }

  function announce(message) {
    if (status) status.textContent = message;
  }

  function startFresh() {
    world.reset();
    audio.unlock();
    screen = SCREEN_PLAY;
    showOnly(null);
    announce('TELUK HARAPAN. WASD jalan, E masuk mobil, F curi mobil. Ikuti penanda kuning.');
  }

  function startContinue() {
    const data = readSave();
    world.reset();
    if (data) world.load(data);
    audio.unlock();
    screen = SCREEN_PLAY;
    showOnly(null);
    announce(`Lanjut misi ${Math.min(world.state.missionIndex + 1, 5)}.`);
  }

  function endGame(won) {
    if (won) {
      screen = SCREEN_WIN;
      showOnly('win');
      if (screens.winStats) screens.winStats.textContent = statsLine();
      announce('Utang lunas. Kamu menang.');
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        // Ignore.
      }
    } else {
      screen = SCREEN_OVER;
      showOnly('over');
      if (screens.overStats) screens.overStats.textContent = statsLine();
      announce(`Raka tumbang. Uangmu $${world.state.money}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) startFresh();
    else if (actions & ACTION_CONFIRM && (screen === SCREEN_OVER || screen === SCREEN_WIN)) startFresh();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      showOnly('pause');
      announce('Jeda.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      showOnly(null);
      announce('Lanjut.');
    }
  }

  function step() {
    const move = input.move();
    const look = input.takeLook();
    const actions = input.takeActions();
    const controls = {
      moveF: move.forward,
      moveS: move.strafe,
      run: move.run,
      lookDX: look.x,
      lookDY: look.y,
      enter: !!(actions & ACTION_ENTER),
      steal: !!(actions & ACTION_STEAL),
      punch: !!(actions & ACTION_PUNCH),
      shoot: !!(actions & ACTION_SHOOT),
      weapon: !!(actions & ACTION_WEAPON),
      horn: !!(actions & ACTION_HORN),
    };
    if (screen === SCREEN_TITLE) {
      world.step(STEP, null, true);
      return;
    }
    const events = world.step(STEP, controls, false);
    if (events & EVENT_MISSION) {
      audio.jingle();
      writeSave();
    }
    if (events & EVENT_CASH) audio.cash();
    if (events & EVENT_OVER) endGame(world.state.won);
    // Engine hum and siren follow the driving and the heat.
    const driving = !world.state.player.onFoot;
    audio.engine(driving ? Math.abs(world.state.player.speed) / CAR.maxSpeed : 0);
    audio.siren(world.state.wanted > 0);
    saveClock += STEP;
    if (saveClock > 10) {
      saveClock = 0;
      writeSave();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, 0, STEP);
  }

  // Leaving the tab pauses a running game rather than letting the police catch Raka unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      showOnly('pause');
      announce('Jeda.');
    }
  });

  const freshBtn = document.getElementById('btn-start');
  if (freshBtn) freshBtn.addEventListener('click', startFresh);
  if (screens.continueBtn) screens.continueBtn.addEventListener('click', startContinue);
  const retryBtn = document.getElementById('btn-retry');
  if (retryBtn) retryBtn.addEventListener('click', startFresh);
  const againBtn = document.getElementById('btn-again');
  if (againBtn) againBtn.addEventListener('click', startFresh);
  const resumeBtn = document.getElementById('btn-resume');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        showOnly(null);
        announce('Lanjut.');
      }
    });
  }

  showOnly('title');
  announce('TELUK HARAPAN. Tekan Spasi atau klik untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
