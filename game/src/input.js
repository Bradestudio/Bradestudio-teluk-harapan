// Keyboard and mouse input for TELUK HARAPAN. Held keys give movement and driving;
// one-shot presses (enter car, steal, punch, shoot, pause, confirm) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost or counted
// twice. Mouse look uses pointer lock when the player clicks the canvas; dragging works
// without it, so the game still plays in a headless screenshot run.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_STEAL = 8;
export const ACTION_PUNCH = 16;
export const ACTION_SHOOT = 32;
export const ACTION_WEAPON = 64;
export const ACTION_HORN = 128;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);

export function createInput(target) {
  const keys = new Set();
  let actions = 0;
  let lookX = 0;
  let lookY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyE') actions |= ACTION_ENTER;
    else if (event.code === 'KeyF') actions |= ACTION_STEAL;
    else if (event.code === 'KeyQ') actions |= ACTION_WEAPON;
    else if (event.code === 'KeyH') actions |= ACTION_HORN;
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    dragging = false;
  });

  target.addEventListener('pointerdown', (event) => {
    actions |= ACTION_CONFIRM;
    if (event.button === 0) actions |= ACTION_PUNCH;
    if (event.button === 2) actions |= ACTION_SHOOT;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    if (target.requestPointerLock) {
      try {
        target.requestPointerLock();
      } catch {
        // Pointer lock is a nicety; dragging still works without it.
      }
    }
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });
  window.addEventListener('pointermove', (event) => {
    if (document.pointerLockElement === target) {
      lookX += event.movementX || 0;
      lookY += event.movementY || 0;
    } else if (dragging) {
      lookX += event.clientX - lastX;
      lookY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  });
  target.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  const has = (set) => {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  };

  return {
    /** -1..1 forward/back and left/right, from held keys. */
    move() {
      return {
        forward: (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0),
        strafe: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
        run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      };
    },
    /** Mouse-look deltas since the last call, in pixels. */
    takeLook() {
      const taken = { x: lookX, y: lookY };
      lookX = 0;
      lookY = 0;
      return taken;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
