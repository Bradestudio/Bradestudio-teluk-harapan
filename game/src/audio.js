// TELUK HARAPAN — audio.js
// Semua suara disintesis dengan WebAudio — tanpa file audio sama sekali.
// Mesin, sirene, tembakan, musik ambient, dan bunyi antarmuka.

export function createAudio() {
  const A = {
    ctx: null,
    master: null,
    musicGain: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    enabled: true,
    musicOn: true,
    _musicTimer: null,
    _step: 0,
    _sirenPhase: 0,
  };

  A.init = () => {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.5;
      A.master.connect(A.ctx.destination);
      A.musicGain = A.ctx.createGain();
      A.musicGain.gain.value = 0.16;
      A.musicGain.connect(A.master);
      // Mesin: osilator sawtooth rendah + lowpass, nadanya ikut kecepatan.
      A.engineOsc = A.ctx.createOscillator();
      A.engineOsc.type = 'sawtooth';
      A.engineOsc.frequency.value = 55;
      const filt = A.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 320;
      A.engineGain = A.ctx.createGain();
      A.engineGain.gain.value = 0;
      A.engineOsc.connect(filt);
      filt.connect(A.engineGain);
      A.engineGain.connect(A.master);
      A.engineOsc.start();
      // Sirene: dua nada bergantian.
      A.sirenOsc = A.ctx.createOscillator();
      A.sirenOsc.type = 'sine';
      A.sirenOsc.frequency.value = 720;
      A.sirenGain = A.ctx.createGain();
      A.sirenGain.gain.value = 0;
      A.sirenOsc.connect(A.sirenGain);
      A.sirenGain.connect(A.master);
      A.sirenOsc.start();
      A.startMusic();
    } catch (e) {
      A.ctx = null;
    }
  };

  A.setEngine = (speedNorm, on) => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    A.engineGain.gain.setTargetAtTime(on ? 0.05 + speedNorm * 0.06 : 0, t, 0.08);
    A.engineOsc.frequency.setTargetAtTime(48 + speedNorm * 130, t, 0.1);
  };

  A.setSiren = (on) => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    A.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, t, 0.15);
  };

  A.updateSiren = (dt) => {
    if (!A.ctx || !A.sirenOsc) return;
    A._sirenPhase += dt;
    const f = 660 + 240 * Math.sin(A._sirenPhase * 4.4);
    A.sirenOsc.frequency.setTargetAtTime(f, A.ctx.currentTime, 0.05);
  };

  function tone(freq, dur, type, vol, slideTo) {
    if (!A.ctx || !A.enabled) return;
    const t = A.ctx.currentTime;
    const o = A.ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(A.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!A.ctx || !A.enabled) return;
    const t = A.ctx.currentTime;
    const len = Math.floor(A.ctx.sampleRate * dur);
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource();
    src.buffer = buf;
    const filt = A.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq || 1800;
    const g = A.ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(filt);
    filt.connect(g);
    g.connect(A.master);
    src.start(t);
  }

  A.sfx = {
    shoot() { noise(0.09, 0.35, 2600); tone(180, 0.07, 'square', 0.16, 60); },
    shotgun() { noise(0.22, 0.5, 1400); tone(120, 0.16, 'square', 0.22, 40); },
    punch() { noise(0.08, 0.3, 700); },
    hit() { tone(220, 0.08, 'triangle', 0.2, 110); },
    pickup() { tone(660, 0.09, 'sine', 0.22); setTimeout(() => tone(990, 0.12, 'sine', 0.22), 70); },
    cash() { tone(880, 0.07, 'sine', 0.2); setTimeout(() => tone(1174, 0.07, 'sine', 0.2), 60); setTimeout(() => tone(1568, 0.14, 'sine', 0.2), 120); },
    crash() { noise(0.3, 0.5, 900); tone(90, 0.25, 'sawtooth', 0.25, 40); },
    door() { tone(300, 0.08, 'square', 0.12, 180); },
    horn() { tone(370, 0.22, 'square', 0.14); tone(466, 0.22, 'square', 0.1); },
    click() { tone(1200, 0.04, 'square', 0.12); },
    denied() { tone(160, 0.18, 'square', 0.18, 110); },
    mission() { tone(523, 0.12, 'sine', 0.22); setTimeout(() => tone(659, 0.12, 'sine', 0.22), 110); setTimeout(() => tone(784, 0.22, 'sine', 0.24), 220); },
    fail() { tone(392, 0.2, 'sawtooth', 0.16, 330); setTimeout(() => tone(311, 0.35, 'sawtooth', 0.16, 220), 180); },
    wanted() { tone(740, 0.1, 'square', 0.14); setTimeout(() => tone(740, 0.1, 'square', 0.14), 140); },
    heal() { tone(520, 0.1, 'sine', 0.18, 780); },
    explosion() { noise(0.7, 0.6, 500); tone(70, 0.6, 'sawtooth', 0.3, 28); },
    radio() { tone(980, 0.05, 'square', 0.08); setTimeout(() => tone(1240, 0.05, 'square', 0.08), 80); },
    save() { tone(660, 0.1, 'sine', 0.2); setTimeout(() => tone(880, 0.16, 'sine', 0.2), 100); },
  };

  // --- Musik ambient: sequencer sederhana, skala minor pentatonik ---------
  // Nada-nada senja Teluk Harapan: santai di hari 1, tegang di hari 3.
  const SCALE = [0, 3, 5, 7, 10, 12, 15];
  const BASSLINE = [0, 0, 7, 5, 0, 0, 10, 7];
  A._melodySeed = [0, 2, 4, 3, 5, 4, 2, 1, 0, 2, 5, 7, 5, 3, 2, 0];

  A.startMusic = () => {
    if (!A.ctx || A._musicTimer) return;
    A._musicTimer = setInterval(() => {
      if (!A.ctx || !A.musicOn || !A.enabled) return;
      const step = A._step++;
      const beat = step % 16;
      const root = 110; // A2
      // Bass tiap 4 ketuk.
      if (beat % 4 === 0) {
        const idx = BASSLINE[(step / 4 | 0) % BASSLINE.length];
        A._note(root * Math.pow(2, idx / 12), 0.5, 'triangle', 0.5, 0.09);
      }
      // Melodi pentatonik, kadang diam agar bernapas.
      if (beat % 2 === 0 && (step * 7919 % 10) < 6) {
        const deg = A._melodySeed[beat % A._melodySeed.length];
        const f = root * 4 * Math.pow(2, SCALE[deg % SCALE.length] / 12);
        A._note(f, 0.28, 'sine', 0.28, 0.06);
      }
      // Hi-hat sintetis tiap ketuk genap.
      if (beat % 2 === 1) A._hat();
    }, 240);
  };

  A._note = (freq, dur, type, when, vol) => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime + (when || 0);
    const o = A.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(A.musicGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  };

  A._hat = () => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    const len = Math.floor(A.ctx.sampleRate * 0.03);
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource();
    src.buffer = buf;
    const filt = A.ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 6000;
    const g = A.ctx.createGain();
    g.gain.value = 0.05;
    src.connect(filt);
    filt.connect(g);
    g.connect(A.musicGain);
    src.start(t);
  };

  A.toggleMusic = () => {
    A.musicOn = !A.musicOn;
    return A.musicOn;
  };

  A.toggleSound = () => {
    A.enabled = !A.enabled;
    if (A.master) A.master.gain.value = A.enabled ? 0.5 : 0;
    return A.enabled;
  };

  return A;
}
