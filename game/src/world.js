// TELUK HARAPAN — world.js
// Membangun kota: jalan, blok bangunan, taman, pelabuhan, pasar, landmark,
// dan semua query spasial (distrik di titik, tabrakan bangunan, jalan terdekat).

import { WORLD, DISTRICTS, SHOPS } from './config.js';
import { clamp, dist } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    const b = d.bounds;
    if (x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1) return d;
  }
  return DISTRICTS[2];
}

export function isOnRoad(x, y) {
  for (const ax of WORLD.avenues) {
    if (Math.abs(x - ax) < WORLD.roadHalfWidth + WORLD.sidewalk) return true;
  }
  for (const sy of WORLD.streets) {
    if (Math.abs(y - sy) < WORLD.roadHalfWidth + WORLD.sidewalk) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  // Proyeksi ke jalan terdekat (dipakai traffic AI dan spawn mobil).
  let best = null;
  for (const ax of WORLD.avenues) {
    const d = Math.abs(x - ax);
    if (!best || d < best.d) best = { d, x: ax, y: clamp(y, 60, WORLD.height - 60), vertical: true };
  }
  for (const sy of WORLD.streets) {
    const d = Math.abs(y - sy);
    if (!best || d < best.d) best = { d, x: clamp(x, 60, WORLD.width - 60), y: sy, vertical: false };
  }
  return best;
}

// Titik jalan acak (tengah jalan) untuk spawn lalu lintas.
export function randomRoadPoint(rng) {
  if (rng.chance(0.5)) {
    const ax = rng.pick(WORLD.avenues);
    return { x: ax + rng.range(-18, 18), y: rng.range(80, WORLD.height - 80), vertical: true };
  }
  const sy = rng.pick(WORLD.streets);
  return { x: rng.range(80, WORLD.width - 80), y: sy + rng.range(-18, 18), vertical: false };
}

export function buildWorld(rng) {
  const buildings = [];
  const props = []; // pohon, lampu, kontainer, kios, patung, dll.
  const parks = [];
  const docks = [];

  const blockXs = [0, ...WORLD.avenues, WORLD.width];
  const blockYs = [0, ...WORLD.streets, WORLD.height];

  // Blok plaza: area terbuka tanpa bangunan di sekitar landmark, toko, dan
  // titik misi — agar misi selalu bisa dicapai dan pertempuran punya ruang.
  // (kolom, baris) dalam grid blok: balai (2,2), pasar (2,1), klub (4,4),
  // vila/rumah (5,1), menara/tono (0,2), gudang (1,4), bengkel (3,2),
  // klinik (3,1), senjata (2,4).
  const PLAZAS = new Set(['2,2', '2,1', '4,4', '5,1', '0,2', '1,4', '3,2', '3,1', '2,4']);

  // --- Bangunan per blok kota -------------------------------------------
  for (let bi = 0; bi < blockXs.length - 1; bi++) {
    for (let bj = 0; bj < blockYs.length - 1; bj++) {
      const x0 = blockXs[bi] + WORLD.roadHalfWidth + WORLD.sidewalk + WORLD.blockMargin;
      const x1 = blockXs[bi + 1] - WORLD.roadHalfWidth - WORLD.sidewalk - WORLD.blockMargin;
      const y0 = blockYs[bj] + WORLD.roadHalfWidth + WORLD.sidewalk + WORLD.blockMargin;
      const y1 = blockYs[bj + 1] - WORLD.roadHalfWidth - WORLD.sidewalk - WORLD.blockMargin;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);

      // Plaza: tanpa bangunan, hanya pohon dan bangku.
      if (PLAZAS.has(bi + ',' + bj)) {
        for (let t = 0; t < 5; t++) {
          props.push({ kind: 'tree', x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), s: rng.range(10, 16) });
        }
        props.push({ kind: 'bench', x: cx, y: cy, s: 12 });
        continue;
      }

      // Taman kota sesekali, bukan bangunan.
      if (rng.chance(0.12)) {
        parks.push({ x0, y0, x1, y1, district: district.id });
        for (let t = 0; t < 7; t++) {
          props.push({ kind: 'tree', x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), s: rng.range(10, 18) });
        }
        props.push({ kind: 'bench', x: cx, y: cy, s: 12 });
        continue;
      }

      // Pelabuhan: kontainer dan derek, bukan gedung.
      if (district.id === 'pelabuhan' && bi === 0) {
        for (let c = 0; c < 5; c++) {
          props.push({
            kind: 'container',
            x: rng.range(x0 + 30, x1 - 30),
            y: rng.range(y0 + 24, y1 - 24),
            w: rng.range(60, 110), h: 26,
            color: rng.pick(['#b5522f', '#2f7a6a', '#c9a227', '#4a6a8a', '#7a4a8a']),
            angle: rng.chance(0.5) ? 0 : Math.PI / 2,
          });
        }
        props.push({ kind: 'crane', x: cx, y: y0 + 40, s: 46 });
        docks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }

      // Pasar: kios-kios kecil berjejer.
      if (district.id === 'pasar' && rng.chance(0.55)) {
        for (let k = 0; k < 6; k++) {
          const kx = x0 + 30 + (k % 3) * ((x1 - x0 - 60) / 2);
          const ky = y0 + 30 + Math.floor(k / 3) * ((y1 - y0 - 60) / 1.5);
          props.push({ kind: 'stall', x: kx, y: ky, w: 46, h: 34, color: rng.pick(['#e8e8e8', '#2fa08a', '#d97b2b', '#c95a4a']) });
        }
        continue;
      }

      // Gedung biasa: 1-4 bangunan per blok, ukuran bervariasi.
      const count = rng.int(1, 3);
      for (let b = 0; b < count; b++) {
        const bw = rng.range(70, Math.min(190, (x1 - x0) / count - 24));
        const bh = rng.range(60, Math.min(170, y1 - y0 - 24));
        const bx = x0 + 14 + (b * (x1 - x0 - 28)) / count + rng.range(0, 10);
        const by = y0 + 14 + rng.range(0, Math.max(1, y1 - y0 - bh - 28));
        const tall = district.id === 'kotatua' || district.id === 'neon';
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          district: district.id,
          color: rng.pick(district.roof),
          wall: shade(district.roof[0]),
          height: tall ? rng.int(3, 7) : rng.int(1, 3),
          windows: rng.int(2, 6),
          type: rng.pick(['house', 'house', 'shop', 'office', 'house', 'warehouse']),
        });
      }
      // Pohon dan lampu di tepi blok.
      for (let t = 0; t < 3; t++) {
        props.push({ kind: 'tree', x: rng.range(x0 + 12, x1 - 12), y: rng.range(y0 + 12, y1 - 12), s: rng.range(9, 15) });
      }
    }
  }

  // --- Landmark khas tiap distrik ----------------------------------------
  const landmarks = [
    { id: 'balai', name: 'Balai Kota Tua', x: 1200, y: 1100, w: 150, h: 100, color: '#8c2f26', district: 'kotatua' },
    { id: 'klub', name: 'Klub Lampion', x: 2400, y: 2150, w: 170, h: 90, color: '#ff2e88', district: 'neon' },
    { id: 'vila', name: 'Vila Bukit', x: 2950, y: 575, w: 130, h: 90, color: '#5d3a2a', district: 'bukit' },
    { id: 'pasar', name: 'Pasar Ikan Lama', x: 1200, y: 500, w: 190, h: 110, color: '#a8442f', district: 'pasar' },
    { id: 'menara', name: 'Menara Suar', x: 180, y: 1250, w: 60, h: 60, color: '#e8e8e8', district: 'pelabuhan' },
  ];
  for (const lm of landmarks) {
    buildings.push({ x: lm.x - lm.w / 2, y: lm.y - lm.h / 2, w: lm.w, h: lm.h, district: lm.district, color: lm.color, wall: shade(lm.color), height: 4, windows: 6, type: 'landmark', name: lm.name });
  }

  // Lampu jalan di setiap persimpangan.
  for (const ax of WORLD.avenues) {
    for (const sy of WORLD.streets) {
      props.push({ kind: 'lamp', x: ax + WORLD.roadHalfWidth + 8, y: sy - WORLD.roadHalfWidth - 8, s: 8 });
      props.push({ kind: 'lamp', x: ax - WORLD.roadHalfWidth - 8, y: sy + WORLD.roadHalfWidth + 8, s: 8 });
    }
  }
  // Pohon palem di sepanjang dermaga neon.
  for (let x = 200; x < WORLD.width - 100; x += 160) {
    props.push({ kind: 'palm', x, y: 2400 + ((x / 160) % 2) * 40, s: 16 });
  }

  return { buildings, props, parks, docks, landmarks };
}

function shade(hex) {
  // Warna dinding: versi lebih terang dari warna atap.
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 42);
  const g = Math.min(255, ((n >> 8) & 255) + 38);
  const b = Math.min(255, (n & 255) + 34);
  return `rgb(${r},${g},${b})`;
}

// --- Tabrakan ------------------------------------------------------------
// Lingkaran (pemain/pejalan kaki) vs kotak bangunan. Kembalikan posisi yang
// sudah digeser keluar dari bangunan, atau null bila tidak bertabrakan.
export function collideCircleBuildings(x, y, r, buildings) {
  let nx = x;
  let ny = y;
  let hit = false;
  for (const b of buildings) {
    const cx = clamp(nx, b.x, b.x + b.w);
    const cy = clamp(ny, b.y, b.y + b.h);
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        ny = cy + (dy / d) * r;
      } else {
        // Tepat di dalam: dorong ke sisi terdekat.
        const left = nx - b.x;
        const right = b.x + b.w - nx;
        const top = ny - b.y;
        const bottom = b.y + b.h - ny;
        const m = Math.min(left, right, top, bottom);
        if (m === left) nx = b.x - r;
        else if (m === right) nx = b.x + b.w + r;
        else if (m === top) ny = b.y - r;
        else ny = b.y + b.h + r;
      }
    }
  }
  return hit ? { x: nx, y: ny } : null;
}

export function pointInBuilding(x, y, buildings) {
  for (const b of buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Kotak mobil (oriented) vs bangunan — pendekatan dengan 4 titik sudut.
export function carHitsBuilding(car, buildings) {
  const hw = car.size[0] / 2;
  const hh = car.size[1] / 2;
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  const corners = [
    [hw, hh], [hw, -hh], [-hw, hh], [-hw, -hh],
  ];
  for (const [lx, ly] of corners) {
    const wx = car.x + lx * cos - ly * sin;
    const wy = car.y + lx * sin + ly * cos;
    if (pointInBuilding(wx, wy, buildings)) return true;
  }
  return false;
}

export function clampToWorld(x, y, margin = 40) {
  return {
    x: clamp(x, margin, WORLD.width - margin),
    y: clamp(y, margin, WORLD.height - margin),
  };
}

// Toko terdekat dari titik tertentu.
export function nearestShop(x, y) {
  let best = null;
  let bd = Infinity;
  for (const s of SHOPS) {
    const d = dist(x, y, s.x, s.y);
    if (d < bd) { bd = d; best = s; }
  }
  return { shop: best, d: bd };
}
