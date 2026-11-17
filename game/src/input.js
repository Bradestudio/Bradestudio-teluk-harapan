// Keyboard and pointer input. Held keys are read every frame; one-shot presses (start,
// pause, enter a car, punch, buy) are queued as bit flags and taken once by the loop, so a
// press between two frames is never lost and never counted twice. Dragging the mouse orbits
// the camera; holding the mouse (or Space) shoots.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_BUY = 16;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const BUY = new Set(['KeyB']);

export function createInput(target, onLook) {
  const held = { up: false, down: false, left: false, right: false, run: false, shoot: false };
  let actions = 0;
  let dragging = false;
  let lastX = 0, lastY = 0;

  function key(code, down, repeat) {
    if (UP.has(code)) held.up = down;
    else if (DOWN.has(code)) held.down = down;
    else if (LEFT.has(code)) held.left = down;
    else if (RIGHT.has(code)) held.right = down;
    else if (RUN.has(code)) held.run = down;
    else if (CONFIRM.has(code)) { if (down && !repeat) actions |= ACTION_CONFIRM; held.shoot = down; }
    else if (PAUSE.has(code)) { if (down && !repeat) actions |= ACTION_PAUSE; }
    else if (ENTER.has(code)) { if (down && !repeat) actions |= ACTION_ENTER; }
    else if (PUNCH.has(code)) { if (down && !repeat) actions |= ACTION_PUNCH; }
    else if (BUY.has(code)) { if (down && !repeat) actions |= ACTION_BUY; }
    else return false;
    return true;
  }

  window.addEventListener('keydown', (event) => {
    if (key(event.code, true, event.repeat)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { key(event.code, false, false); });
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.run = held.shoot = false;
    dragging = false;
  });
  target.addEventListener('pointerdown', (event) => {
    actions |= ACTION_CONFIRM;
    held.shoot = true;
    dragging = true;
    lastX = event.clientX; lastY = event.clientY;
  });
  window.addEventListener('pointerup', () => { held.shoot = false; dragging = false; });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    onLook(event.clientX - lastX, event.clientY - lastY);
    lastX = event.clientX; lastY = event.clientY;
  });

  return {
    held,
    takeActions() { const taken = actions; actions = 0; return taken; },
  };
}
