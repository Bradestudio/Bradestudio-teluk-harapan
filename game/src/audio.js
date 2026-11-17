// Sound and music, all synthesized with WebAudio — no audio files. A low engine hum that
// follows the car's speed, a two-tone siren while the police chase you, one-shot blips for
// gunshots, punches, pickups and mission completions, and a quiet bass-and-arpeggio loop that
// changes key with the day. Everything starts on the first user gesture.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let step = 0;

  const SCALES = [
    [110, 130.81, 164.81, 196], // Day 1: A minor warmth
    [103.83, 123.47, 155.56, 185], // Day 2: Ab minor dusk
    [98, 116.54, 146.83, 174.61], // Day 3: G minor night
  ];

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  function startMusic(day) {
    if (!ctx || musicTimer) return;
    const scale = SCALES[day] || SCALES[0];
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const root = scale[step % scale.length];
      blip(root, 0.5, 'triangle', 0.05);
      blip(root * 2, 0.22, 'sine', 0.04);
      if (step % 4 === 0) blip(root / 2, 0.9, 'sine', 0.07);
      step += 1;
    }, 320);
  }

  return {
    unlock(day) { if (ensure()) startMusic(day); },
    setDay(day) { step = 0; if (ctx) startMusic(day); },
    engine(speed, inCar) {
      if (!ctx || muted) return;
      engineGain.gain.value = inCar ? 0.03 + Math.abs(speed) * 0.0016 : 0;
      engineOsc.frequency.value = 50 + Math.abs(speed) * 4;
    },
    siren(on, time) {
      if (!ctx || muted) return;
      sirenGain.gain.value = on ? 0.035 : 0;
      if (on) sirenOsc.frequency.value = 650 + Math.sin(time * 5) * 180;
    },
    shot() { blip(900, 0.12, 'square', 0.14, 120); },
    punch() { blip(140, 0.12, 'sine', 0.2, 60); },
    pickup() { blip(660, 0.1, 'sine', 0.1); blip(990, 0.16, 'sine', 0.1); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => blip(f, 0.22, 'triangle', 0.12), i * 90)); },
    hit() { blip(220, 0.15, 'sawtooth', 0.12, 90); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
  };
}
