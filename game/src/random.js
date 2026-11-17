// TELUK HARAPAN — random.js
// RNG ber-seed (mulberry32) + helper acak. Seed yang sama -> kota, lalu lintas,
// dan penempatan yang sama persis: itulah yang membuat screenshot deterministik
// dan playthrough bisa diulang. Ditulis fresh untuk round 4.

export class SeededRandom {
  constructor(seed) {
    // Campur seed supaya seed kecil (mis. 1) tetap memberi urutan yang bagus.
    this.state = (seed ^ 0x9e3779b9) >>> 0;
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  /** Bilangan [0, 1). */
  next() {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Bilangan bulat [min, max] (inklusif). */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Bilangan riil [min, max). */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** true dengan peluang p (0..1). */
  chance(p) {
    return this.next() < p;
  }

  /** Satu elemen acak dari array. */
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  /** Salinan array yang diacak urutannya (Fisher-Yates). */
  shuffled(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /** Nilai dari distribusi normal kasar (rata-rata 0, simpangan ~1). */
  gaussian() {
    return (this.next() + this.next() + this.next() - 1.5) * 1.6;
  }

  /** Warna hex acak dari palet. */
  color(palette) {
    return this.pick(palette);
  }

  /** Sudut acak 0..2π. */
  angle() {
    return this.next() * Math.PI * 2;
  }
}

/** RNG cepat sekali pakai untuk hal non-kritis (partikel, dsb). */
export function makeRng(seed) {
  return new SeededRandom(seed);
}

/** Hash string pendek jadi seed angka (untuk nama distrik dsb). */
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
