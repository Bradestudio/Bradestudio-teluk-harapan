// TELUK HARAPAN — input.js
// Keyboard + mouse. Tombol yang ditahan dibaca sebagai state (gerak, gas, lari);
// tombol sekali tekan masuk antrean aksi (masuk mobil, tembak, jeda, ganti
// senjata) supaya tidak ada yang hilang di antara frame. Ditulis fresh.

export const ACT = Object.freeze({
  ENTER_CAR: 'enterCar',
  SHOOT: 'shoot',
  SWITCH_WEAPON: 'switchWeapon',
  PAUSE: 'pause',
  CONFIRM: 'confirm',
  INTERACT: 'interact',
  CAMERA: 'camera',
  MAP: 'map',
  HELP: 'help',
  QUICKSAVE: 'quicksave',
  RELOAD: 'reload',
});

// Tombol -> aksi sekali tekan.
const PRESS_ACTIONS = {
  KeyE: ACT.ENTER_CAR,
  KeyF: ACT.INTERACT,
  KeyR: ACT.SWITCH_WEAPON,
  KeyP: ACT.PAUSE,
  Escape: ACT.PAUSE,
  Space: ACT.CONFIRM,
  Enter: ACT.CONFIRM,
  KeyC: ACT.CAMERA,
  KeyM: ACT.MAP,
  KeyH: ACT.HELP,
  F5: ACT.QUICKSAVE,
  KeyQ: ACT.RELOAD,
};

// Tombol gerak (dibaca sebagai state).
const MOVE_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight',
]);

export class Input {
  constructor(canvas) {
    this.held = new Set();
    this.queue = [];
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this._shootHeld = false;

    window.addEventListener('keydown', (event) => {
      if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) return;
      if (MOVE_KEYS.has(event.code)) {
        this.held.add(event.code);
        event.preventDefault();
      }
      const action = PRESS_ACTIONS[event.code];
      if (action && !event.repeat) {
        this.queue.push(action);
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.held.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.mouseDown = false;
      this._shootHeld = false;
    });

    canvas.addEventListener('pointerdown', (event) => {
      this.mouseDown = true;
      this._shootHeld = true;
      this.mouseX = event.clientX;
      this.mouseY = event.clientY;
      this.queue.push(ACT.SHOOT);
    });
    canvas.addEventListener('pointerup', () => {
      this.mouseDown = false;
      this._shootHeld = false;
    });
    canvas.addEventListener('pointermove', (event) => {
      this.mouseX = event.clientX;
      this.mouseY = event.clientY;
    });
    // Mencegah menu konteks saat klik kanan (dipakai untuk membidik).
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  /** -1..1 maju/mundur (W/S). */
  throttle() {
    const fwd = this.held.has('KeyW') || this.held.has('ArrowUp');
    const back = this.held.has('KeyS') || this.held.has('ArrowDown');
    return (fwd ? 1 : 0) - (back ? 1 : 0);
  }

  /** -1..1 belok kiri/kanan (A/D). */
  steer() {
    const left = this.held.has('KeyA') || this.held.has('ArrowLeft');
    const right = this.held.has('KeyD') || this.held.has('ArrowRight');
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  /** Vektor jalan kaki (x: kanan, z: maju) relatif arah hadap kamera. */
  moveVector() {
    return {
      x: this.steer(),
      z: -this.throttle(),
      run: this.held.has('ShiftLeft') || this.held.has('ShiftRight'),
    };
  }

  get handbrake() {
    return this.held.has('Space');
  }

  get firing() {
    return this._shootHeld;
  }

  /** Ambil semua aksi sekali tekan sejak panggilan terakhir. */
  drainActions() {
    const out = this.queue;
    this.queue = [];
    return out;
  }

  hasAction(list, name) {
    return list.indexOf(name) !== -1;
  }
}
