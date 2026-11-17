// TELUK HARAPAN — audio.js
// Semua suara disintesis dengan WebAudio — tidak ada file audio. Mesin mobil
// (osilator + noise), sirene polisi (dua nada), tembakan (noise burst),
// denting pickup, sting misi, dan pad ambien. Ditulis fresh untuk round 4.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.ambientNodes = null;
    this._noiseBuffer = null;
  }

  /** Dipanggil dari gestur pertama pengguna (klik/tombol), sesuai aturan autoplay. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this._buildNoise();
    this._startAmbient();
  }

  _buildNoise() {
    const len = this.ctx.sampleRate;
    this._noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this._noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  }

  _startAmbient() {
    // Pad ambien: dua osilator detune + LFO pelan. Volume rendah, terus jalan.
    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.045;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const o1 = this.ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = 110;
    const o2 = this.ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = 165.3;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(padGain);
    padGain.connect(this.master);
    o1.start();
    o2.start();
    lfo.start();
    this.ambientNodes = { o1, o2, lfo, padGain };
  }

  /** Nada pendek (UI, pickup, klik). */
  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.12));
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + (dur || 0.12) + 0.02);
  }

  /** Dua nada naik (notifikasi misi, objektif selesai). */
  chime() {
    this.blip(660, 0.14, 'sine', 0.18);
    window.setTimeout(() => this.blip(880, 0.22, 'sine', 0.18), 130);
  }

  /** Sting misi selesai: arpeggio naik 4 nada. */
  missionSting() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => {
      window.setTimeout(() => this.blip(n, 0.3, 'triangle', 0.2), i * 110);
    });
  }

  /** Sting misi gagal: dua nada turun. */
  failSting() {
    window.setTimeout(() => this.blip(392, 0.3, 'sawtooth', 0.12), 0);
    window.setTimeout(() => this.blip(262, 0.5, 'sawtooth', 0.12), 180);
  }

  /** Tembakan: noise burst + klik rendah. */
  gunshot() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.14);
    this.blip(90, 0.08, 'square', 0.2);
  }

  /** Bunyi kena (hit marker): klik tajam. */
  hit() {
    this.blip(1400, 0.06, 'square', 0.12);
  }

  /** Ledakan: noise lowpass panjang. */
  explosion() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + 0.7);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.85);
  }

  /** Deru mesin: osilator sawtooth + noise, pitch mengikuti kecepatan. */
  engineStart() {
    if (!this.ctx || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 500;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  engineUpdate(speedRatio, on) {
    if (!this.ctx || !this.engineOsc) return;
    const target = on ? 0.05 + speedRatio * 0.1 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, this.ctx.currentTime, 0.08);
    this.engineFilter.frequency.setTargetAtTime(400 + speedRatio * 1200, this.ctx.currentTime, 0.1);
  }

  engineStop() {
    if (!this.engineOsc) return;
    try { this.engineOsc.stop(); } catch { /* sudah berhenti */ }
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
  }

  /** Sirene polisi: dua nada bergantian (naik-turun tiap 350 ms). */
  sirenStart() {
    if (!this.ctx || this.sirenOsc) return;
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 780;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.05;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    let high = false;
    this.sirenTimer = window.setInterval(() => {
      if (!this.sirenOsc) return;
      high = !high;
      this.sirenOsc.frequency.setTargetAtTime(high ? 980 : 780, this.ctx.currentTime, 0.05);
    }, 350);
  }

  sirenStop() {
    if (this.sirenTimer) window.clearInterval(this.sirenTimer);
    this.sirenTimer = null;
    if (this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch { /* sudah berhenti */ }
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}
