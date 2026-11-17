// Keyboard + mouse. WASD/panah jalan & nyetir, Space/klik tembak, E masuk-keluar mobil,
// F curi mobil, M mulai misi, P/Esc jeda, 1-5 beli di toko, Enter konfirmasi.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_STEAL = 8;
export const ACTION_MISSION = 16;
export const ACTION_INTERACT = 32;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let dragX = 0;
  let dragY = 0;

  function press(code) {
    if (code === 'Space') { actions |= ACTION_CONFIRM; return; }
    if (code === 'KeyE') { actions |= ACTION_ENTER; return; }
    if (code === 'KeyF') { actions |= ACTION_STEAL; return; }
    if (code === 'KeyM') { actions |= ACTION_MISSION; return; }
    if (code === 'KeyQ') { actions |= ACTION_INTERACT; return; }
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) { keys.add(event.code); return; }
    keys.add(event.code);
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      event.preventDefault();
      return;
    }
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (event.code === 'Space') { actions |= ACTION_CONFIRM; event.preventDefault(); }
    else if (event.code === 'KeyE') actions |= ACTION_ENTER;
    else if (event.code === 'KeyF') actions |= ACTION_STEAL;
    else if (event.code === 'KeyM') actions |= ACTION_MISSION;
    else if (event.code === 'KeyQ') actions |= ACTION_INTERACT;
    else if (/^Digit[1-5]$/.test(event.code)) actions |= (1 << (16 + Number(event.code.slice(5)))); // shop keys 1-5
  });
  window.addEventListener('keyup', (event) => { keys.delete(event.code); });
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });

  target.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    dragX = event.clientX; dragY = event.clientY;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });
  window.addEventListener('pointermove', (event) => {
    if (!mouseDown) return;
    dragX = event.clientX; dragY = event.clientY;
  });

  const has = (set) => { for (const k of set) if (keys.has(k)) return true; return false; };

  return {
    forward() { return has(FORWARD); },
    back() { return has(BACK); },
    left() { return has(LEFT); },
    right() { return has(RIGHT); },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    mouseDown() { return mouseDown; },
    takeActions() { const t = actions; actions = 0; return t; },
    // Exposed for tests / autopilot: press a key programmatically.
    press,
  };
}
