// TUNING + DATA — Teluk Harapan round 3.
// Kota Teluk Harapan: kota fiksi 100% original (bukan Rockstar/GTA). Raka pulang kampung dan
// berperang dengan Bang Darto selama tiga hari: Senja -> Maghrib -> Malam.

export const STEP = 1 / 60;
export const SAVE_KEY = 'teluk-harapan.save.v3';
export const BEST_KEY = 'teluk-harapan.best.v3';

// Kota: bujur sangkar 520x520, jalan grid tiap 65 unit. Air di barat (x < -230) dan selatan (z > 230).
export const CITY = { half: 260, waterWest: -230, waterSouth: 230, roadEvery: 65 };
export const ROADS = [-195, -130, -65, 0, 65, 130, 195];

export const PHASES = [
  { name: 'HARI 1 — SENJA', sky: 0xff9a52, fog: 0x2a1a2e, sun: 0xffb36b, sunPos: [-140, 60, 90], ambient: 0x8a6a72, hemi: 0.55, lampOn: false, neon: false },
  { name: 'HARI 2 — MAGHRIB', sky: 0x7a4a8a, fog: 0x241a33, sun: 0xc96bb0, sunPos: [-60, 35, 140], ambient: 0x5a4a6a, hemi: 0.42, lampOn: true, neon: true },
  { name: 'HARI 3 — MALAM', sky: 0x0b1026, fog: 0x0a0e22, sun: 0x8fa8ff, sunPos: [80, 90, -120], ambient: 0x3d4a6a, hemi: 0.38, lampOn: true, neon: true },
];

export const DISTRICTS = [
  { name: 'Pelabuhan', x0: -260, z0: -130, x1: -130, z1: 130, style: 'harbor' },
  { name: 'Pasar Lama', x0: -130, z0: -260, x1: 0, z1: -65, style: 'market' },
  { name: 'Menara Kaca', x0: 0, z0: -260, x1: 130, z1: -65, style: 'cbd' },
  { name: 'Perumahan Bukit', x0: 130, z0: -260, x1: 260, z1: -65, style: 'houses' },
  { name: 'Pantai Senja', x0: -260, z0: 130, x1: -130, z1: 260, style: 'beach' },
  { name: 'Gudang Timur', x0: 130, z0: 65, x1: 260, z1: 260, style: 'warehouse' },
  { name: 'Alun-Alun', x0: -65, z0: -65, x1: 65, z1: 65, style: 'plaza' },
  { name: 'Mercusuar', x0: -260, z0: -260, x1: -130, z1: -130, style: 'lighthouse' },
];

// Tempat-tempat penting (x, z).
export const PLACES = {
  rumah: { x: 195, z: -195, label: 'Rumah Raka' },
  pasar: { x: -65, z: -130, label: 'Pasar Lama' },
  menara: { x: 65, z: -130, label: 'Menara Kaca' },
  pelabuhan: { x: -195, z: 0, label: 'Pelabuhan' },
  dermaga: { x: -225, z: 130, label: 'Dermaga Nelayan' },
  pantai: { x: -130, z: 195, label: 'Pantai Senja' },
  gudang: { x: 195, z: 130, label: 'Gudang Timur' },
  alun: { x: 0, z: 0, label: 'Alun-Alun' },
  mercusuar: { x: -195, z: -195, label: 'Mercusuar' },
  bukit: { x: 195, z: -65, label: 'Perumahan Bukit' },
  klinik: { x: -65, z: 0, label: 'Klinik' },
  bengkel: { x: 130, z: 65, label: 'Bengkel' },
  tokoSenjata: { x: 0, z: -65, label: 'Toko Senjata' },
  rumahAman: { x: 195, z: -130, label: 'Rumah Aman' },
};

export const VEHICLES = {
  sedan: { name: 'Sedan', top: 34, accel: 22, turn: 2.4, hp: 100, color: 0x3a7bd5, price: 0 },
  taxi: { name: 'Taksi', top: 32, accel: 20, turn: 2.5, hp: 90, color: 0xf2c94c, price: 0 },
  truck: { name: 'Truk', top: 24, accel: 13, turn: 1.7, hp: 220, color: 0x8a94a6, price: 0 },
  moto: { name: 'Motor', top: 42, accel: 30, turn: 3.4, hp: 55, color: 0xe5534b, price: 0 },
  boat: { name: 'Perahu Laju', top: 38, accel: 18, turn: 2.0, hp: 120, color: 0x2ec4b6, price: 0 },
  police: { name: 'Patroli', top: 36, accel: 26, turn: 2.8, hp: 120, color: 0x1c2a4a, price: 0 },
};

export const PLAYER = {
  walkSpeed: 11, runSpeed: 17, radius: 1.1, hp: 100, maxHp: 100,
  pistolDamage: 34, pistolRange: 55, fireRate: 0.22, startAmmo: 24, maxAmmo: 120,
  fistDamage: 25, fistRange: 2.6, fistRate: 0.45,
};

export const ECONOMY = {
  clinicHeal: 50, ammoPrice: 20, ammoAmount: 12, repairPrice: 30,
  armorPrice: 200, armorHp: 60, enginePrice: 300, engineBoost: 1.25,
  safehousePrice: 500, damagePrice: 250, damageBoost: 1.5,
};

export const WANTED = {
  decaySeconds: 25, maxPolice: 4, heliAt: 4, policeSpawnDist: 70, loseDist: 130,
};

// 15 misi, 5 per hari. steps: goto | timed | kill | chase | escort | race | boat | boss
export const MISSIONS = [
  { id: 1, day: 0, title: 'Pulang ke Teluk', brief: 'Raka pulang. Temui Pak Haji di Pasar Lama.', reward: 100,
    steps: [{ t: 'goto', x: -65, z: -130, r: 8, label: 'Temui Pak Haji di Pasar Lama' }] },
  { id: 2, day: 0, title: 'Taksi Pertama', brief: 'Antar penumpang dari Pasar ke Alun-Alun.', reward: 80,
    steps: [
      { t: 'goto', x: -65, z: -130, r: 8, label: 'Jemput penumpang di Pasar Lama' },
      { t: 'goto', x: 0, z: 0, r: 8, label: 'Antar ke Alun-Alun' },
    ] },
  { id: 3, day: 0, title: 'Paket Kilat', brief: 'Paket buat Menara Kaca. Jangan telat!', reward: 120,
    steps: [{ t: 'timed', x: 65, z: -130, r: 8, seconds: 45, label: 'Antar paket ke Menara Kaca (45 dtk)' }] },
  { id: 4, day: 0, title: 'Tagih Utang', brief: 'Dua preman Darto nunggak di Gudang Timur.', reward: 150,
    steps: [
      { t: 'goto', x: 195, z: 130, r: 10, label: 'Datangi Gudang Timur' },
      { t: 'kill', count: 2, kind: 'thug', x: 195, z: 130, label: 'Hadapi 2 preman (0/2)' },
    ] },
  { id: 5, day: 0, title: 'Balapan Senja', brief: 'Si Licin menantang balap keliling Alun-Alun.', reward: 200,
    steps: [{ t: 'race', points: [[0, 0], [130, 0], [130, 130], [0, 130], [0, 0]], label: 'Menangi balapan (cek poin 0/5)' }] },
  { id: 6, day: 1, title: 'Antar Ikan Segar', brief: 'Ikan dari Dermaga harus sampai Pasar sebelum maghrib.', reward: 150,
    steps: [{ t: 'timed', x: -65, z: -130, r: 8, seconds: 60, from: 'dermaga', label: 'Ikan Dermaga -> Pasar (60 dtk)' }] },
  { id: 7, day: 1, title: 'Kawal Truk', brief: 'Kawal truk Pak Haji dari Pelabuhan ke Gudang.', reward: 200,
    steps: [{ t: 'escort', from: [-195, 0], to: [195, 130], label: 'Kawal truk ke Gudang Timur' }] },
  { id: 8, day: 1, title: 'Gudang Terbakar', brief: 'Anak buah Darto membakar gudang. Rebut petinya!', reward: 250,
    steps: [
      { t: 'goto', x: 195, z: 130, r: 10, label: 'Ke Gudang Timur' },
      { t: 'kill', count: 4, kind: 'guard', x: 195, z: 130, label: 'Lumpuhkan penjaga (0/4)' },
      { t: 'goto', x: -195, z: 0, r: 8, label: 'Bawa peti ke Pelabuhan' },
    ] },
  { id: 9, day: 1, title: 'Kejar Si Licin', brief: 'Si Licin kabur naik sedan. Tabrak sampai berhenti!', reward: 250,
    steps: [{ t: 'chase', label: 'Tabrak mobil Si Licin sampai mogok' }] },
  { id: 10, day: 1, title: 'Pesan dari Darto', brief: 'Darto mengirim pesan: penyergapan di Alun-Alun.', reward: 300,
    steps: [
      { t: 'goto', x: 0, z: 0, r: 10, label: 'Ke Alun-Alun (polisi mengejar!)' },
      { t: 'kill', count: 2, kind: 'thug', x: 0, z: 0, label: 'Hadapi penyergap (0/2)' },
    ] },
  { id: 11, day: 2, title: 'Jalan Tikus', brief: 'Lewat jalan tikus: tiga titik sebelum tengah malam.', reward: 250,
    steps: [{ t: 'timed', points: [[0, 0], [-130, 195], [195, -65]], seconds: 90, label: 'Tiga titik dalam 90 dtk (0/3)' }] },
  { id: 12, day: 2, title: 'Pelarian Perahu', brief: 'Naik perahu dari Dermaga, susuri pelabuhan sampai ujung.', reward: 300,
    steps: [{ t: 'boat', from: [-225, 130], to: [-240, -130], label: 'Susuri pelabuhan dengan perahu' }] },
  { id: 13, day: 2, title: 'Serbu Markas', brief: 'Markas Darto di Menara Kaca. Enam penjaga.', reward: 350,
    steps: [
      { t: 'goto', x: 65, z: -130, r: 10, label: 'Ke Menara Kaca' },
      { t: 'kill', count: 6, kind: 'guard', x: 65, z: -130, label: 'Lumpuhkan penjaga (0/6)' },
    ] },
  { id: 14, day: 2, title: 'Mata Helikopter', brief: 'Helikopter polisi di atas. Tembus ke Mercusuar!', reward: 350,
    steps: [{ t: 'timed', x: -195, z: -195, r: 8, seconds: 75, label: 'Tembus ke Mercusuar (75 dtk, heli mengejar!)' }] },
  { id: 15, day: 2, title: 'Darto Terakhir', brief: 'Bang Darto menunggu di Mercusuar. Akhiri ini.', reward: 500,
    steps: [
      { t: 'goto', x: -195, z: -195, r: 10, label: 'Ke Mercusuar' },
      { t: 'boss', x: -195, z: -195, label: 'Kalahkan Bang Darto!' },
      { t: 'goto', x: -195, z: -195, r: 6, label: 'Nyalakan lampu mercusuar — Teluk bebas!' },
    ] },
];

// Kerja sampingan (marker di peta, mulai otomatis saat masuk): taksi, kurir, utang, balap, ikan.
export const SIDE_JOBS = [
  { id: 'taxi', name: 'Taksi', x: -65, z: -65, reward: 60, brief: 'Antar penumpang ke Pantai Senja.' },
  { id: 'kurir', name: 'Kurir', x: 65, z: 65, reward: 50, brief: 'Antar paket ke Bukit (40 dtk).' },
  { id: 'utang', name: 'Tagih Utang', x: 130, z: 195, reward: 80, brief: 'Dua preman di Gudang Timur.' },
  { id: 'balap', name: 'Balap Liar', x: 0, z: 130, reward: 100, brief: 'Balapan 4 cek poin keliling kota.' },
  { id: 'ikan', name: 'Antar Ikan', x: -195, z: 195, reward: 70, brief: 'Ikan Dermaga ke Pasar (50 dtk).' },
];

export const PALETTE = {
  road: 0x23262e, roadLine: 0xd8d8d8, sidewalk: 0x3a3f4a, ground: 0x2e3329,
  water: 0x1a5f7a, sand: 0xc2a878, plaza: 0x4a4f5e,
  building: [0x8a7f70, 0x6b7a8a, 0x9a8a6a, 0x7a6a8a, 0x5a6a7a, 0xa89a80],
  glass: 0x2a4a6a, windowLit: 0xffd27a, windowDark: 0x1a2436,
  tree: 0x2a6a3a, trunk: 0x5a4028, lamp: 0xffe9a8,
  player: 0x35d0ff, playerDark: 0x1a6a8a, enemy: 0xe5534b, boss: 0x8a1a2a,
  heli: 0x1c2a4a, boat: 0x2ec4b6, marker: 0xffd23f,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
