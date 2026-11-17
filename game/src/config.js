// TELUK HARAPAN — every tuning number, colour, district and mission in one place.
// The city is a 480 x 480 grid centred on (0, 0): roads every 60 units, blocks between them.

export const STEP = 1 / 60;

export const CITY = {
  half: 240,
  roadEvery: 60,
  roadWidth: 10,
  sidewalk: 3,
};

export const SAVE_KEY = 'teluk-harapan.save.v1';

export const PLAYER = {
  walk: 3.6,
  run: 6.5,
  radius: 0.9,
  health: 100,
  punchRange: 2.4,
  punchDamage: 25,
  shootRange: 42,
  shootDamage: 34,
};

export const CAR = {
  accel: 15,
  brake: 24,
  maxSpeed: 36,
  maxReverse: 11,
  steer: 2.0,
  radius: 2.3,
  length: 4.4,
  width: 2.0,
};

export const POLICE = {
  baseSpeed: 13,
  perStar: 1.7,
  /** How many police cars hunt the player at each wanted level (index = stars). */
  count: [0, 1, 2, 3, 4, 4],
  ramDamage: 8,
  ramCooldown: 1.0,
};

export const WANTED = {
  decaySeconds: 22,
  steal: 1,
  punchPed: 1,
  killPed: 2,
  shoot: 1,
  ramPolice: 2,
};

/** Districts, by region. Beach is the sand strip along the south edge. */
export function districtAt(x, z) {
  if (z < -200) return 'beach';
  if (x < -120 && z > 120) return 'port';
  if (x >= -120 && x < 60 && z > 60) return 'market';
  if (x >= 60 && z > -60) return 'cbd';
  if (x < -60 && z <= 60) return 'hills';
  return 'senja';
}

export const DISTRICT_STYLE = {
  port: { hMin: 8, hMax: 14, colors: [0x8a7a5c, 0x7c6a52, 0x9a8a68, 0x6e6250], wide: true },
  market: { hMin: 6, hMax: 11, colors: [0xc96a3b, 0xd9a441, 0x7fb069, 0x4e7fa8, 0xb8574f, 0xe0c090], wide: false },
  cbd: { hMin: 30, hMax: 88, colors: [0x5a7ea6, 0x6b93b8, 0x7fa3c4, 0x4f6d8f], wide: false, glass: true },
  hills: { hMin: 5, hMax: 8, colors: [0xd8c9a3, 0xc9b18c, 0xb7a284, 0xe0d3b8], wide: false },
  senja: { hMin: 5, hMax: 9, colors: [0xe8b48a, 0xd9a06e, 0xc98f5f, 0xe0c090], wide: false },
  beach: { hMin: 3, hMax: 5, colors: [0xe8dcc0, 0xdcc9a0], wide: false },
};

export const MISSIONS = [
  {
    id: 1,
    title: 'Misi 1 — Paket Pertama',
    briefing: 'Bang Darto butuh kurir. Ambil paket di Pasar Lama, antar ke Pelabuhan. Kalau belum punya mobil, curi saja satu (F).',
    stages: [
      { text: 'Ambil paket di Pasar Lama', target: { x: -60, z: 150 }, kind: 'pickup' },
      { text: 'Antar paket ke Pelabuhan', target: { x: -180, z: 180 }, kind: 'deliver' },
    ],
    reward: 150,
  },
  {
    id: 2,
    title: 'Misi 2 — Mobil Pertama',
    briefing: 'Darto mau mobil bagus. Curi mobil apa saja (F di dekat mobil), lalu bawa ke bengkelnya di Pelabuhan.',
    stages: [
      { text: 'Curi sebuah mobil (F)', target: null, kind: 'steal' },
      { text: 'Bawa mobil ke bengkel Darto', target: { x: -180, z: 210 }, kind: 'deliver' },
    ],
    reward: 250,
  },
  {
    id: 3,
    title: 'Misi 3 — Kejar-kejaran',
    briefing: 'Polisi sudah mengendusmu. Wanted 3 bintang! Bertahan 45 detik, atau kabur ke tempat aman di Bukit.',
    stages: [
      { text: 'Kabur dari polisi! Bertahan atau capai Bukit', target: { x: -180, z: -180 }, kind: 'survive', seconds: 45 },
    ],
    reward: 400,
  },
  {
    id: 4,
    title: 'Misi 4 — Rampok Toko',
    briefing: 'Kas toko di Pasar Lama sedang penuh. Masuk, todong kasir (E), ambil uangnya, lalu hilang sebelum polisi datang.',
    stages: [
      { text: 'Rampok toko di Pasar Lama (E)', target: { x: -60, z: 120 }, kind: 'rob' },
      { text: 'Kabur! Hilangkan wanted', target: null, kind: 'escape' },
    ],
    reward: 600,
  },
  {
    id: 5,
    title: 'Misi 5 — Jebakan Terakhir',
    briefing: 'Saatnya menagih. Pancing Darto ke Pelabuhan dan habisi anak buahnya — utangmu lunas malam ini.',
    stages: [
      { text: 'Habisi anak buah Darto di Pelabuhan', target: { x: -120, z: 180 }, kind: 'fight', enemies: 4 },
    ],
    reward: 1000,
  },
];

export const SIDE_JOBS = {
  taxiFare: [40, 85],
  courierFare: [30, 60],
};

export const PRICES = {
  health: 50,
  ammo12: 20,
  repair: 100,
};

export const PALETTE = {
  sky: 0xff9e57,
  skyTop: 0x7d6bb0,
  fog: 0xe8a06a,
  sun: 0xffd9a0,
  ground: 0x55555e,
  road: 0x33333a,
  sidewalk: 0x8d8d94,
  sand: 0xe0cd9a,
  sea: 0x2e6f8e,
  grass: 0x5d7d4a,
  playerJacket: 0x2e86c1,
  thug: 0x7a2e2e,
  police: 0xf2f2f2,
  text: '#f5efe6',
  muted: '#c9b8a3',
  accent: '#ffcf5c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
