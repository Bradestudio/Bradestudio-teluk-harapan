// Sound and music, all synthesized with WebAudio: no audio files, no network.
// Everything is a no-op until the first user gesture creates the context, so a
// headless screenshot run (no gesture) stays silent and never throws.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol || 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Sound never blocks the game.
    }
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t);
    } catch {
      // Sound never blocks the game.
    }
  }

  /** A slow sunset chord loop: two detuned triangles over a low root, very quiet. */
  function startMusic() {
    if (!ensure() || musicTimer !== null) return;
    const chords = [
      [220.0, 277.18, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 246.94, 293.66],
      [146.83, 220.0, 293.66],
    ];
    let index = 0;
    const playChord = () => {
      if (!ctx) return;
      const chord = chords[index % chords.length];
      index += 1;
      for (const freq of chord) {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          osc.detune.value = 4;
          const t = ctx.currentTime;
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.linearRampToValueAtTime(0.035, t + 0.8);
          gain.gain.setValueAtTime(0.035, t + 3.2);
          gain.gain.linearRampToValueAtTime(0.0001, t + 4.2);
          osc.connect(gain);
          gain.connect(master);
          osc.start(t);
          osc.stop(t + 4.3);
        } catch {
          // Ignore.
        }
      }
    };
    playChord();
    musicTimer = window.setInterval(playChord, 4000);
  }

  return {
    /** Call on the first gesture; starts the engine hum and the music loop. */
    unlock() {
      if (started) return;
      started = true;
      if (!ensure()) return;
      try {
        if (ctx.state === 'suspended') ctx.resume();
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineGain.gain.value = 0.0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'sine';
        sirenOsc.frequency.value = 700;
        sirenGain.gain.value = 0.0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        window.setInterval(() => {
          if (sirenGain && sirenGain.gain.value > 0.01) {
            sirenOsc.frequency.value = sirenOsc.frequency.value > 800 ? 660 : 920;
          }
        }, 420);
        startMusic();
      } catch {
        // Sound never blocks the game.
      }
    },
    /** 0..1 engine load while driving; 0 and silent on foot. */
    engine(load) {
      if (!engineGain || !engineOsc) return;
      try {
        engineGain.gain.value = load > 0.01 ? 0.03 + load * 0.05 : 0.0;
        engineOsc.frequency.value = 55 + load * 130;
      } catch {
        // Ignore.
      }
    },
    siren(on) {
      if (!sirenGain) return;
      try {
        sirenGain.gain.value = on ? 0.035 : 0.0;
      } catch {
        // Ignore.
      }
    },
    punch() {
      noise(0.12, 0.3, 500);
    },
    shot() {
      noise(0.16, 0.4, 2400);
      blip(160, 0.1, 'square', 0.12, 60);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.18);
      window.setTimeout(() => blip(990, 0.12, 'sine', 0.18), 70);
    },
    cash() {
      blip(880, 0.08, 'triangle', 0.2);
      window.setTimeout(() => blip(1174, 0.1, 'triangle', 0.2), 60);
      window.setTimeout(() => blip(1568, 0.16, 'triangle', 0.2), 120);
    },
    jingle() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, i) => {
        window.setTimeout(() => blip(freq, 0.22, 'triangle', 0.2), i * 110);
      });
    },
    hurt() {
      blip(140, 0.18, 'sawtooth', 0.2, 70);
    },
    click() {
      blip(1200, 0.05, 'square', 0.08);
    },
  };
}
