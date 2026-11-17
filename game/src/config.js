// TELUK HARAPAN — every tuning number in one place.
// The city is a grid of blocks on the x/z plane, centred on (0,0). Streets are the gaps
// between blocks; all movement, AI and missions live on this plane, the renderer only draws it.
export const STEP = 1 / 60;
export const SAVE_KEY = 'teluk-harapan.save.v1';

// 7 blocks by 7 blocks; each block 60 wide, streets 14 wide. City spans -266..266.
export const CITY = { blocks: 7, block: 60, street: 14, half: 266 };
export const BLOCK_STEP = CITY.block + CITY.street; // 74
export function blockOrigin(i) { return -CITY.half + CITY.street / 2 + i * BLOCK_STEP; } // left edge of block i
export function streetCenter(i) { return -CITY.half + i * BLOCK_STEP; } // centre line of street i (0..7)

export const DISTRICTS = [
  { id: 'pelabuhan', name: 'Pelabuhan', bx: [0, 1], bz: [2, 4], color: 0x5a6b7a, roof: 0x3d4a56, hMin: 8, hMax: 16, style: 'warehouse' },
  { id: 'pasar', name: 'Pasar Lama', bx: [0, 2], bz: [5, 6], color: 0xc96f3f, roof: 0x8a4a2a, hMin: 6, hMax: 12, style: 'shop' },
  { id: 'menara', name: 'Menara Kaca', bx: [3, 4], bz: [2, 4], color: 0x7fb2d9, roof: 0x2c4a66, hMin: 30, hMax: 70, style: 'tower' },
  { id: 'bukit', name: 'Perumahan Bukit', bx: [5, 6], bz: [0, 2], color: 0x9db98a, roof: 0x6a7a5a, hMin: 6, hMax: 12, style: 'house' },
  { id: 'pantai', name: 'Pantai Senja', bx: [3, 6], bz: [6, 6], color: 0xe0c98f, roof: 0xc9a86a, hMin: 4, hMax: 8, style: 'beach' },
  { id: 'gudang', name: 'Gudang Timur', bx: [5, 6], bz: [3, 4], color: 0x8a7a5a, roof: 0x5a4a3a, hMin: 8, hMax: 14, style: 'warehouse' },
  { id: 'alun', name: 'Alun-Alun', bx: [2, 4], bz: [0, 1], color: 0xb8a888, roof: 0x7a6a55, hMin: 6, hMax: 14, style: 'civic' },
];
// Blocks not listed above are generic mid-rise fill.
export function districtAt(bx, bz) {
  for (const d of DISTRICTS) if (bx >= d.bx[0] && bx <= d.bx[1] && bz >= d.bz[0] && bz <= d.bz[1]) return d;
  return { id: 'kota', name: 'Kota', color: 0x8a8fa0, roof: 0x555a66, hMin: 10, hMax: 26, style: 'mid' };
}

// Three days; light changes with the day. Missions are data, the world runs them.
export const DAYS = [
  { name: 'Hari 1 — Senja', sky: 0xff9a52, fog: 0x2a1a2e, sun: 0xffb36b, sunPos: [-80, 40, -60], ambient: 0x8a6a7a, hemi: 0.75 },
  { name: 'Hari 2 — Maghrib', sky: 0x7a4a8a, fog: 0x241a33, sun: 0xd98aff, sunPos: [-60, 25, 80], ambient: 0x6a5a8a, hemi: 0.75 },
  { name: 'Hari 3 — Malam', sky: 0x0a1230, fog: 0x0a0f22, sun: 0x9ab8ff, sunPos: [40, 60, -40], ambient: 0x3a4a7a, hemi: 0.95 },
];

export const PLAYER = {
  walk: 8, run: 12, radius: 1.1, hp: 100, startMoney: 100, startAmmo: 36,
  punchRange: 3.2, punchDamage: 12, punchCooldown: 0.45,
  bulletDamage: 16, shootCooldown: 0.28, bulletSpeed: 90, bulletRange: 70,
};
export const CAR = {
  accel: 16, brake: 42, maxSpeed: 30, maxReverse: 10, steer: 2.6, radius: 2.2, length: 4.6,
};
export const TRAFFIC_COUNT = 16;
export const PED_COUNT = 30;
export const PARKED_COUNT = 8;
export const WANTED_DECAY_SECONDS = 25;
export const POLICE_RAM_DAMAGE = 8;
export const POLICE_RAM_COOLDOWN = 1.2;

// Shops: fixed spots, marked on the minimap. price = cost, effect applied on buy.
export const SHOPS = [
  { id: 'klinik', name: 'Klinik', x: -190, z: 120, price: 50, kind: 'heal' },
  { id: 'amunisi', name: 'Toko Amunisi', x: 150, z: -150, price: 20, kind: 'ammo' },
  { id: 'bengkel', name: 'Bengkel', x: 190, z: 190, price: 30, kind: 'repair' },
];

export const THUG = { hp: 30, speed: 5.2, range: 42, damage: 5, cooldown: 1.0, punchRange: 2.6 };
export const BOSS = { hp: 120, speed: 5.8, range: 60, damage: 10, cooldown: 0.8, punchRange: 3.0 };

// Mission types: goto (reach), deliver (pick up then drop, timed), taxi (pick up passenger,
// drop them), fight (defeat N thugs at a spot), race (checkpoints in order, timed, in a car),
// evade (survive T seconds at a wanted level), boss (defeat Bang Darto + henchmen).
// tx/tz are world coords; they must sit on streets (multiples of 74 offset) or plaza centres.
export const MISSIONS = [
  // ---- Hari 1 (Senja) ----
  { day: 0, name: 'M1 — Kenalan', type: 'goto', x: -192, z: 178, reward: 50, text: 'Temui Pak Seno di Pasar Lama' },
  { day: 0, name: 'M2 — Antar Paket', type: 'deliver', px: -192, pz: -44, x: 30, z: -44, time: 90, reward: 120, text: 'Ambil paket di Pelabuhan, antar ke Menara Kaca' },
  { day: 0, name: 'M3 — Taksi Pertama', type: 'taxi', px: -44, pz: -192, x: 178, z: 252, reward: 100, text: 'Jemput penumpang di Alun-Alun, antar ke Pantai Senja' },
  { day: 0, name: 'M4 — Tagih Utang', type: 'fight', x: 178, z: 30, count: 2, reward: 150, text: 'Tagih utang di Gudang Timur — hadapi 2 preman' },
  // ---- Hari 2 (Maghrib) ----
  { day: 1, name: 'M5 — Rebut Wilayah', type: 'fight', x: 178, z: -192, count: 3, reward: 180, text: 'Rebut Perumahan Bukit dari 3 preman' },
  { day: 1, name: 'M6 — Balapan Liar', type: 'race', points: [[-192, -192], [178, -192], [178, 178], [-192, 178]], time: 150, reward: 220, text: 'Balapan liar: lewati 4 titik — harus naik mobil!' },
  { day: 1, name: 'M7 — Kejar-kejaran', type: 'evade', wanted: 3, time: 60, reward: 200, text: 'Kabur dari polisi selama 60 detik!' },
  { day: 1, name: 'M8 — Selundupan', type: 'deliver', px: -192, pz: 30, x: 178, z: 104, time: 100, reward: 240, text: 'Bawa selundupan dari Pelabuhan ke Gudang Timur' },
  // ---- Hari 3 (Malam) ----
  { day: 2, name: 'M9 — Mata-mata', type: 'goto', x: 30, z: 104, time: 75, reward: 200, text: 'Menyelinap ke Menara Kaca sebelum 75 detik' },
  { day: 2, name: 'M10 — Rampok Balik', type: 'fight', x: -192, z: 178, count: 4, reward: 260, text: 'Bersihkan Pasar Lama dari 4 preman' },
  { day: 2, name: 'M11 — Amankan Bukti', type: 'deliver', px: 104, pz: -192, x: -44, z: -192, time: 75, reward: 280, text: 'Antar bukti ke Alun-Alun dalam 75 detik' },
  { day: 2, name: 'M12 — Bos Terakhir', type: 'boss', x: -192, z: -44, reward: 400, text: 'Kalahkan Bang Darto di Pelabuhan — final!' },
];

export const PALETTE = {
  road: 0x23262e, sidewalk: 0x3a3e48, ground: 0x1c1f26, sand: 0xc9a86a,
  plaza: 0x6a6258, water: 0x1a4a6a, beacon: 0xffd34d, police: 0x2a4ad9,
  player: 0x37c8e8, playerJacket: 0xe84d3d, thug: 0x8a2a2a, boss: 0x5a1a5a,
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
