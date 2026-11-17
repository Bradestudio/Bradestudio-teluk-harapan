// TELUK HARAPAN — Round 2. Configuration: city, districts, missions, economy.
// All original: fictional Kota Teluk Harapan, protagonist Raka vs Bang Darto.

export const CITY = {
  half: 250,          // playable bounds [-250, 250] on x and z
  roadEvery: 60,      // roads on a 60-unit grid
  roadHalf: 5,        // half-width of a road
};

export const DISTRICTS = [
  { id: 'harbor',   name: 'Pelabuhan',       x0: -250, x1: -120, z0: -250, z1: -60,  kind: 'harbor' },
  { id: 'market',   name: 'Pasar Lama',      x0: -120, x1: 0,    z0: -250, z1: -60,  kind: 'market' },
  { id: 'cbd',      name: 'Menara Kaca',    x0: 0,    x1: 120,  z0: -250, z1: -60,  kind: 'cbd' },
  { id: 'warehouse',name: 'Gudang Timur',    x0: 120,  x1: 250,  z0: -250, z1: -60,  kind: 'warehouse' },
  { id: 'plaza',    name: 'Alun-Alun',       x0: -120, x1: 120,  z0: -60,  z1: 60,   kind: 'plaza' },
  { id: 'homes',    name: 'Perumahan Bukit', x0: -250, x1: 0,    z0: 60,   z1: 250,  kind: 'homes' },
  { id: 'beach',    name: 'Pantai Senja',    x0: 0,    x1: 250,  z0: 60,   z1: 250,  kind: 'beach' },
];

export const DAY_LIGHT = [
  { sky: 0xff9a52, fog: 0xf7b267, sun: 0xffd27a, sunPos: [-140, 90, -60], hemi: 0xffe0b3, amb: 0.55, lamp: false, label: 'Hari 1 — Senja' },
  { sky: 0x7a5ba6, fog: 0x9a7bb0, sun: 0xff8f5e, sunPos: [-180, 45, 40],  hemi: 0xc9a7d8, amb: 0.45, lamp: true,  label: 'Hari 2 — Maghrib' },
  { sky: 0x0d1530, fog: 0x1a2440, sun: 0x8fb4ff, sunPos: [60, 120, -100], hemi: 0x5a6ea8, amb: 0.35, lamp: true,  label: 'Hari 3 — Malam' },
];

// Missions: 12 across 3 days. type: reach | deliver | taxi | fight | race | collect | survive | escort | hold | drive
export const MISSIONS = [
  { day: 1, id: 'M1',  title: 'Turun di Pelabuhan', type: 'reach',   target: [-180, -180], reward: 50,
    text: 'Raka baru turun dari kapal. Temui kontak di ujung dermaga Pelabuhan.' },
  { day: 1, id: 'M2',  title: 'Antar Paket',        type: 'deliver', pickup: [-60, -180], target: [180, 180], time: 75, reward: 80,
    text: 'Ambil paket di Pasar Lama, antar ke gubuk Pantai Senja sebelum 75 detik.' },
  { day: 1, id: 'M3',  title: 'Taksi Pertama',      type: 'taxi',    stops: [[-30, 0, -180, 150], [60, -180, -180, -120]], reward: 80,
    text: 'Dua penumpang menunggu taksi. Jemput dan antar mereka tepat waktu.' },
  { day: 1, id: 'M4',  title: 'Utang Lama',         type: 'fight',   target: [-60, -120], thugs: 1, reward: 60,
    text: 'Joko si penagih utang menghadang di Pasar Lama. Selesaikan dengan tinju. (Spasi = pukul)' },
  { day: 2, id: 'M5',  title: 'Balap Pantai',       type: 'race',    points: [[180, 120], [200, 210], [60, 210], [-60, 210], [-180, 120]], time: 100, reward: 120,
    text: 'Balapan liar di Pantai Senja. Lewati 5 titik sebelum 100 detik. Butuh mobil!' },
  { day: 2, id: 'M6',  title: 'Tagih Utang',        type: 'collect', targets: [[-180, -200], [90, -200], [-150, 200]], reward: 150,
    text: 'Tiga orang berutang pada Bang Darto. Datangi dan tagih dengan E.' },
  { day: 2, id: 'M7',  title: 'Kabur dari Polisi',  type: 'survive', wanted: 3, time: 30, reward: 100,
    text: 'Polisi memburumu! Bertahan 30 detik tanpa tertangkap.' },
  { day: 2, id: 'M8',  title: 'Selamatkan Sari',    type: 'escort',  target: [-150, 120], dest: [-30, -150], reward: 120,
    text: 'Sari terjebak di Perumahan Bukit. Jemput dia, lalu antar ke rumah aman Pasar Lama.' },
  { day: 3, id: 'M9',  title: 'Mata-Mata Menara',   type: 'hold',    target: [60, -180], hold: 8, reward: 100,
    text: 'Menyusup ke Menara Kaca. Bertahan 8 detik di titik pantau tanpa ketahuan.' },
  { day: 3, id: 'M10', title: 'Perang Geng',        type: 'fight',   target: [-200, -200], thugs: 5, reward: 150,
    text: 'Lima anak buah Darto menjaga dermaga. Habisi mereka semua.' },
  { day: 3, id: 'M11', title: 'Pelarian Terakhir',  type: 'drive',   from: [90, -120], target: [200, 200], time: 75, wanted: 4, reward: 150,
    text: 'Bawa mobil dari Menara Kaca ke Pantai Senja dalam 75 detik, dengan 4 bintang buronan!' },
  { day: 3, id: 'M12', title: 'Menara Kaca',        type: 'boss',    target: [60, -120], reward: 500,
    text: 'FINAL: Bang Darto menunggumu di plaza Menara Kaca. Kalahkan dia dan rebut kotanya.' },
];

export const ECONOMY = {
  clinicCost: 50,   // heal to full
  ammoCost: 20,     // +12 bullets
  repairCost: 30,   // fix current car
  taxiFare: 40,
  courierPay: 35,
  collectPay: 40,
  startMoney: 100,
  startAmmo: 24,
};

export const SHOPS = [
  { id: 'clinic', name: 'Klinik Sehat',  pos: [-90, -30],  action: 'heal',  cost: ECONOMY.clinicCost, label: 'E — Berobat $50 (nyawa penuh)' },
  { id: 'ammo',   name: 'Toko Amunisi',  pos: [30, -30],   action: 'ammo',  cost: ECONOMY.ammoCost,   label: 'E — Beli peluru $20 (+12)' },
  { id: 'repair', name: 'Bengkel Jaya',  pos: [-90, 30],   action: 'repair', cost: ECONOMY.repairCost, label: 'E — Perbaiki mobil $30' },
  { id: 'taxi',   name: 'Pangkalan Taksi', pos: [30, 30],  action: 'taxi',  cost: 0, label: 'E — Cari penumpang taksi' },
  { id: 'courier',name: 'Kantor Kurir',  pos: [150, 30],   action: 'courier', cost: 0, label: 'E — Ambil paket kurir' },
];

export const COLORS = {
  road: 0x2e2e38, sidewalk: 0x8a8a92, ground: 0x5d7a4a,
  sand: 0xd9c184, water: 0x2f6f8f, plaza: 0x9a938a,
  buildingPalette: [0xc96f4a, 0xd8a24a, 0x7a9a6a, 0x6a8ab0, 0xb06a7a, 0x8a6ab0, 0xd8d0c0],
  glass: 0x7fb8d8, glassDark: 0x4a7a9a,
  carPalette: [0xd83a2e, 0x2e6ad8, 0xe8c832, 0x3aa84a, 0xe8e8e8, 0x222222, 0x8a4ad8, 0xd87a2e],
  police: 0x1a4ad8, taxi: 0xf2c200,
};
