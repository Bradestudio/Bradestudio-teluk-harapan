// TELUK HARAPAN — input.js
// Keyboard + mouse, dengan edge detection (pressed sekali) dan binding
// yang bisa dibaca HUD untuk layar bantuan.

export const KEY_BINDINGS = [
  { keys: ['W', 'A', 'S', 'D'], label: 'Bergerak / Mengemudi' },
  { keys: ['Mouse'], label: 'Arahkan & tembak (klik kiri)' },
  { keys: ['E'], label: 'Masuk / keluar mobil, interaksi' },
  { keys: ['F'], label: 'Pukul (saat jalan kaki)' },
  { keys: ['R'], label: 'Isi ulang senjata' },
  { keys: ['H'], label: 'Pakai kotak P3K' },
  { keys: ['Shift'], label: 'Nitro (bila terpasang)' },
  { keys: ['Spasi'], label: 'Rem tangan' },
  { keys: ['1', '2', '3', '4'], label: 'Ganti senjata' },
  { keys: ['M'], label: 'Peta besar' },
  { keys: ['Esc', 'P'], label: 'Jeda / menu' },
  { keys: ['Enter'], label: 'Lanjut dialog / mulai misi' },
];

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(), // ditekan pada frame ini saja
    mouse: { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 },
    anyKey: false,
  };

  const keyName = (e) => {
    if (e.key === ' ') return 'Space';
    if (e.key.length === 1) return e.key.toUpperCase();
    return e.key;
  };

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      e.preventDefault();
    }
    if (!e.repeat) {
      input.pressed.add(k);
      input.anyKey = true;
    }
    input.keys.add(k);
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(keyName(e));
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouse.down = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouse.down = true;
      input.mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  input.down = (k) => input.keys.has(k) || input.keys.has(k.toUpperCase());
  input.wasPressed = (k) => input.pressed.has(k) || input.pressed.has(k.toUpperCase());
  input.axisX = () => (input.down('D') || input.down('ArrowRight') ? 1 : 0) - (input.down('A') || input.down('ArrowLeft') ? 1 : 0);
  input.axisY = () => (input.down('S') || input.down('ArrowDown') ? 1 : 0) - (input.down('W') || input.down('ArrowUp') ? 1 : 0);

  // Dipanggil di akhir tiap frame oleh main loop.
  input.endFrame = () => {
    input.pressed.clear();
    input.mouse.clicked = false;
    input.anyKey = false;
  };

  return input;
}
