// Keyboard + mouse input state. WASD move, mouse drag orbits the camera,
// E interact, F steal car, Space punch, click shoot, Shift sprint, R restart day.
export const keys = {};
export const mouse = { dx: 0, dy: 0, down: false, clicked: false, x: 0, y: 0 };
let pointerLocked = false;

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true; mouse.clicked = true; mouse.x = e.clientX; mouse.y = e.clientY;
    if (e.button === 0 && !pointerLocked) { try { canvas.requestPointerLock(); } catch (_) {} }
  });
  addEventListener('mouseup', () => { mouse.down = false; });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      mouse.dx += e.movementX; mouse.dy += e.movementY;
    } else if (mouse.down) {
      mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0;
    }
  });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
  });
}

export function consumeMouse() {
  const d = { dx: mouse.dx, dy: mouse.dy, clicked: mouse.clicked };
  mouse.dx = 0; mouse.dy = 0; mouse.clicked = false;
  return d;
}

export function axis() {
  let x = 0, z = 0;
  if (keys.KeyW || keys.ArrowUp) z -= 1;
  if (keys.KeyS || keys.ArrowDown) z += 1;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  return { x, z };
}
