// WebAudio synth sound + music. Everything is generated, no audio files.
// Created lazily on first user gesture (or first shot frame) so headless runs never crash.
let ctx = null;
let musicTimer = null;
let engineOsc = null;
let engineGain = null;

function ensure() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (_) { ctx = null; }
  return ctx;
}

function tone(freq, dur, type, vol, when = 0) {
  const c = ensure(); if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol, filterFreq = 1200) {
  const c = ensure(); if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start();
}

export const audio = {
  unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
  shoot() { noise(0.12, 0.5, 2500); tone(180, 0.08, 'square', 0.15); },
  punch() { noise(0.1, 0.4, 400); },
  pickup() { tone(880, 0.08, 'sine', 0.2); tone(1320, 0.12, 'sine', 0.2, 0.07); },
  coin() { tone(660, 0.07, 'triangle', 0.25); tone(990, 0.1, 'triangle', 0.25, 0.06); },
  mission() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.22, i * 0.09)); },
  fail() { tone(220, 0.3, 'sawtooth', 0.2); tone(165, 0.4, 'sawtooth', 0.2, 0.15); },
  siren() { tone(700, 0.25, 'sine', 0.08); tone(950, 0.25, 'sine', 0.08, 0.25); },
  engineStart() {
    const c = ensure(); if (!c) return;
    this.engineStop();
    engineOsc = c.createOscillator(); engineGain = c.createGain();
    engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
    engineGain.gain.value = 0.04;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    engineOsc.connect(f); f.connect(engineGain); engineGain.connect(c.destination);
    engineOsc.start();
  },
  engine(speed01) {
    if (engineOsc && engineGain) {
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(0.03 + speed01 * 0.03, ctx.currentTime, 0.1);
    }
  },
  engineStop() {
    if (engineOsc) { try { engineOsc.stop(); } catch (_) {} engineOsc = null; engineGain = null; }
  },
  startMusic() {
    const c = ensure(); if (!c || musicTimer) return;
    // Simple sunset-city bassline loop: A minor groove, 8 steps.
    const bass = [110, 0, 110, 130.8, 98, 0, 110, 146.8];
    const lead = [440, 523, 659, 523, 587, 659, 784, 659];
    let step = 0;
    musicTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const b = bass[step % 8];
      if (b) tone(b, 0.22, 'triangle', 0.12);
      if (step % 2 === 0) tone(lead[(step / 2) | 0], 0.18, 'sine', 0.05);
      step += 1;
    }, 240);
  },
  stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
};
