// TELUK HARAPAN — world.js
// Generator kota: jalan, blok bangunan, 5 distrik, sungai + 3 jembatan,
// landmark, dan graf jalan untuk AI lalu lintas. Murni data (tanpa three.js)
// supaya bisa dites di Node. Semua angka datang dari CONFIG + seed.
// Ditulis fresh untuk round 4.

import { CONFIG } from './config.js';
import { SeededRandom } from './random.js';

const W = CONFIG.world;

// Jalan utama (avenue) — posisi sumbu jalan.
const AVE_X = [-256, -192, -128, -64, 0, 96, 160, 224, 288];
const AVE_Z = [-256, -192, -128, -64, 0, 64, 128, 192, 256];
// Sungai: strip air utara-selatan di antara avenue x=0 dan x=96.
const RIVER = { x0: 48, x1: 80, z0: -320, z1: 320 };
// Jembatan (jalan melintasi sungai) pada avenue z ini.
const BRIDGES = [-160, 32, 96];
// Laut: barat (pelabuhan) dan selatan (pantai).
const SEA_WEST = { x0: -320, x1: -272, z0: -320, z1: 320 };
const SEA_SOUTH = { x0: -320, x1: 320, z0: 288, z1: 320 };

function rectsOverlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}

function pointInRect(x, z, r) {
  return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
}

/** Distrik yang memuat titik (x, z); null bila di luar distrik (laut/sungai). */
export function districtAt(x, z) {
  for (const d of CONFIG.districts) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return null;
}

/** Apakah titik berada di atas jalan (avenue / jembatan). */
export function isOnRoad(x, z) {
  const half = W.avenueWidth / 2;
  for (const ax of AVE_X) {
    if (Math.abs(x - ax) <= half && !pointInRect(x, z, RIVER)) return true;
  }
  for (const az of AVE_Z) {
    if (Math.abs(z - az) <= half) return true;
  }
  // Jembatan: di atas sungai, pada avenue z jembatan.
  if (pointInRect(x, z, RIVER)) {
    for (const bz of BRIDGES) if (Math.abs(z - bz) <= half) return true;
  }
  return false;
}

/** Apakah titik bisa dilalui kendaraan darat (bukan air, bukan bangunan). */
export function isLand(x, z) {
  if (pointInRect(x, z, SEA_WEST) || pointInRect(x, z, SEA_SOUTH)) return false;
  if (pointInRect(x, z, RIVER)) {
    // Di atas sungai hanya bisa lewat jembatan (avenue z jembatan).
    const half = W.avenueWidth / 2;
    for (const bz of BRIDGES) if (Math.abs(z - bz) <= half) return true;
    return false;
  }
  return x >= -320 && x <= 320 && z >= -320 && z <= 320;
}

export function buildCity(seed) {
  const rng = new SeededRandom(seed);
  const buildings = [];
  const colliders = []; // {x0,z0,x1,z1, h} — AABB penghalang
  const props = []; // {kind, x, z, ...} — dekorasi + landmark
  const roadNodes = []; // persimpangan {x, z, id}
  const nodeIndex = new Map();
  const adjacency = new Map(); // id -> [id]

  // ---- graf jalan: node di tiap persimpangan avenue ----
  let nextId = 0;
  function addNode(x, z) {
    const key = `${x},${z}`;
    if (nodeIndex.has(key)) return nodeIndex.get(key);
    const id = nextId;
    nextId += 1;
    nodeIndex.set(key, id);
    roadNodes.push({ id, x, z });
    adjacency.set(id, []);
    return id;
  }
  function link(a, b) {
    if (a === b) return;
    if (!adjacency.get(a).includes(b)) adjacency.get(a).push(b);
    if (!adjacency.get(b).includes(a)) adjacency.get(b).push(a);
  }
  for (const ax of AVE_X) {
    for (const az of AVE_Z) {
      if (!isLand(ax, az)) continue;
      addNode(ax, az);
    }
  }
  // Sisi sepanjang avenue yang sama (vertikal).
  for (const ax of AVE_X) {
    const column = AVE_Z.map((az) => ({ az, id: nodeIndex.get(`${ax},${az}`) }))
      .filter((n) => n.id !== undefined);
    for (let i = 0; i < column.length - 1; i += 1) link(column[i].id, column[i + 1].id);
  }
  // Sisi sepanjang avenue yang sama (horizontal); sungai hanya bisa diseberangi di jembatan.
  for (const az of AVE_Z) {
    const row = AVE_X.map((ax) => ({ ax, id: nodeIndex.get(`${ax},${az}`) }))
      .filter((n) => n.id !== undefined);
    for (let i = 0; i < row.length - 1; i += 1) {
      const a = row[i];
      const b = row[i + 1];
      const crossesRiver = (a.ax < RIVER.x0 && b.ax > RIVER.x1) || (a.ax > RIVER.x1 && b.ax < RIVER.x0);
      if (crossesRiver && !BRIDGES.includes(az)) continue;
      link(a.id, b.id);
    }
  }

  // ---- bangunan: satu blok = sel di antara dua avenue ----
  const halfRoad = W.avenueWidth / 2 + 2;
  for (let xi = 0; xi < AVE_X.length - 1; xi += 1) {
    for (let zi = 0; zi < AVE_Z.length - 1; zi += 1) {
      const bx0 = AVE_X[xi] + halfRoad;
      const bx1 = AVE_X[xi + 1] - halfRoad;
      const bz0 = AVE_Z[zi] + halfRoad;
      const bz1 = AVE_Z[zi + 1] - halfRoad;
      const block = { x0: bx0, x1: bx1, z0: bz0, z1: bz1 };
      if (rectsOverlap(block, RIVER) || rectsOverlap(block, SEA_WEST) || rectsOverlap(block, SEA_SOUTH)) continue;
      const cx = (bx0 + bx1) / 2;
      const cz = (bz0 + bz1) / 2;
      const district = districtAt(cx, cz);
      if (!district) continue;
      const count = district.id === 'bukit' ? rng.int(1, 2) : rng.int(1, 4);
      for (let b = 0; b < count; b += 1) {
        const w = rng.range(10, Math.min(24, (bx1 - bx0) / count));
        const d = rng.range(10, Math.min(24, (bz1 - bz0) / count));
        const x = rng.range(bx0 + w / 2 + 1, bx1 - w / 2 - 1);
        const z = rng.range(bz0 + d / 2 + 1, bz1 - d / 2 - 1);
        if (x - w / 2 < bx0 || x + w / 2 > bx1 || z - d / 2 < bz0 || z + d / 2 > bz1) continue;
        const h = district.id === 'industri'
          ? rng.range(8, 16)
          : district.id === 'bukit'
            ? rng.range(6, 12)
            : district.id === 'kota-lama'
              ? rng.range(7, 18)
              : rng.range(8, 30);
        const color = rng.color(district.palette);
        const building = { x, z, w, d, h, color, district: district.id, roof: rng.chance(0.3) };
        buildings.push(building);
        colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h });
      }
    }
  }

  // ---- landmark & prop (posisi tetap, identitas kota) ----
  function addProp(prop) {
    props.push(prop);
    if (prop.solid) {
      colliders.push({
        x0: prop.x - (prop.hw || 2), x1: prop.x + (prop.hw || 2),
        z0: prop.z - (prop.hd || 2), z1: prop.z + (prop.hd || 2), h: prop.h || 6,
      });
    }
  }
  // Mercusuar di ujung barat daya (pesisir).
  addProp({ kind: 'lighthouse', x: -288, z: 272, h: 34, hw: 4, hd: 4, solid: true });
  // Menara jam di alun-alun Kota Lama.
  addProp({ kind: 'clocktower', x: -96, z: -160, h: 26, hw: 5, hd: 5, solid: true });
  // Pasar: deretan kios di Kota Lama.
  for (let i = 0; i < 8; i += 1) {
    addProp({ kind: 'stall', x: -80 + (i % 4) * 10, z: -232 + Math.floor(i / 4) * 10, h: 3.2, hw: 3, hd: 3, solid: true });
  }
  // Derek pelabuhan.
  addProp({ kind: 'crane', x: -256, z: -160, h: 30, hw: 4, hd: 4, solid: true });
  addProp({ kind: 'crane', x: -256, z: 64, h: 30, hw: 4, hd: 4, solid: true });
  // Kontainer di pelabuhan.
  const containerColors = ['#a34a2a', '#2a6a8a', '#7a8a2a', '#8a2a4a'];
  for (let i = 0; i < 14; i += 1) {
    addProp({
      kind: 'container',
      x: rng.range(-264, -140), z: rng.range(-288, 96),
      h: 2.6, hw: 6, hd: 1.4, solid: true,
      color: containerColors[i % containerColors.length], rot: rng.chance(0.5) ? 0 : Math.PI / 2,
    });
  }
  // Cerobong pabrik di Industri.
  addProp({ kind: 'chimney', x: 224, z: -192, h: 28, hw: 3, hd: 3, solid: true });
  addProp({ kind: 'chimney', x: 248, z: -176, h: 22, hw: 3, hd: 3, solid: true });
  // Gudang 7 (besar, lokasi misi 2 & 4).
  addProp({ kind: 'warehouse', x: 208, z: -96, h: 12, hw: 18, hd: 12, solid: true });
  addProp({ kind: 'warehouse', x: 256, z: -64, h: 10, hw: 14, hd: 10, solid: true });
  // Dermaga kayu menjorok ke laut barat.
  addProp({ kind: 'pier', x: -292, z: 32, h: 1, hw: 20, hd: 6, solid: false });
  // Perahu nelayan di dermaga.
  for (let i = 0; i < 5; i += 1) {
    addProp({ kind: 'boat', x: rng.range(-308, -282), z: -16 + i * 18, h: 2, hw: 2, hd: 5, solid: false, rot: rng.range(-0.3, 0.3) });
  }
  // Pohon kelapa di Pesisir.
  for (let i = 0; i < 26; i += 1) {
    const x = rng.range(-120, 120);
    const z = rng.range(96, 280);
    if (!isLand(x, z) || isOnRoad(x, z)) continue;
    addProp({ kind: 'palm', x, z, h: rng.range(7, 11), hw: 0.6, hd: 0.6, solid: false });
  }
  // Pohon rindang di Bukit.
  for (let i = 0; i < 30; i += 1) {
    const x = rng.range(140, 300);
    const z = rng.range(140, 300);
    if (!isLand(x, z) || isOnRoad(x, z)) continue;
    addProp({ kind: 'tree', x, z, h: rng.range(5, 9), hw: 0.8, hd: 0.8, solid: false });
  }
  // Lampu jalan di tiap persimpangan.
  for (const node of roadNodes) {
    if (rng.chance(0.6)) {
      addProp({ kind: 'lamp', x: node.x + 8, z: node.z + 8, h: 6, hw: 0.4, hd: 0.4, solid: false });
    }
  }
  // Bangku & halte di Kota Lama.
  for (let i = 0; i < 10; i += 1) {
    addProp({ kind: 'bench', x: rng.range(-120, 120), z: rng.range(-280, 40), h: 1, hw: 1.5, hd: 0.6, solid: false });
  }

  // ---- titik spawn ----
  const carSpawns = [];
  for (const node of roadNodes) {
    if (rng.chance(0.35)) carSpawns.push({ x: node.x + rng.range(-4, 4), z: node.z + rng.range(-4, 4), heading: rng.angle() });
  }
  const pedSpawns = [];
  for (let i = 0; i < 60; i += 1) {
    const x = rng.range(-260, 300);
    const z = rng.range(-260, 280);
    if (!isLand(x, z) || isOnRoad(x, z)) continue;
    pedSpawns.push({ x, z });
  }

  return {
    seed,
    buildings,
    colliders,
    props,
    roadNodes,
    adjacency,
    carSpawns,
    pedSpawns,
    river: RIVER,
    bridges: BRIDGES,
    seaWest: SEA_WEST,
    seaSouth: SEA_SOUTH,
    avenuesX: AVE_X,
    avenuesZ: AVE_Z,
    playerSpawn: { x: -240, z: -64, heading: Math.PI / 2 },
    boatDock: { x: -288, z: 32 },
    bridgePoint: { x: 64, z: 96 },
  };
}

/** Titik jalan terdekat (untuk spawn lalu lintas & patroli). */
export function nearestRoadNode(city, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const node of city.roadNodes) {
    const d = (node.x - x) ** 2 + (node.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = node;
    }
  }
  return best;
}

/** Tabrakan lingkaran (x,z,r) dengan AABB penghalang; kembalikan titik yang sudah didorong keluar. */
export function resolveCircleColliders(city, x, z, r) {
  let px = x;
  let pz = z;
  let hit = false;
  for (const c of city.colliders) {
    const cx = Math.max(c.x0, Math.min(px, c.x1));
    const cz = Math.max(c.z0, Math.min(pz, c.z1));
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        px = cx + (dx / d) * r;
        pz = cz + (dz / d) * r;
      } else {
        // Tepat di dalam: dorong ke sisi terdekat.
        const pushLeft = px - c.x0;
        const pushRight = c.x1 - px;
        const pushTop = pz - c.z0;
        const pushBottom = c.z1 - pz;
        const m = Math.min(pushLeft, pushRight, pushTop, pushBottom);
        if (m === pushLeft) px = c.x0 - r;
        else if (m === pushRight) px = c.x1 + r;
        else if (m === pushTop) pz = c.z0 - r;
        else pz = c.z1 + r;
      }
    }
  }
  return { x: px, z: pz, hit };
}

/** Apakah segmen (x1,z1)-(x2,z2) memotong sungai di luar jembatan (untuk AI). */
export function crossesRiverOffBridge(x1, z1, x2, z2) {
  if ((x1 < RIVER.x0 && x2 > RIVER.x1) || (x1 > RIVER.x1 && x2 < RIVER.x0)) {
    for (const bz of BRIDGES) {
      if (Math.min(z1, z2) <= bz && bz <= Math.max(z1, z2)) return false;
    }
    return true;
  }
  return false;
}
