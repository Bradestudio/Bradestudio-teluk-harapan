// TELUK HARAPAN — config.js
// Satu sumber kebenaran untuk semua angka, nama, dan teks cerita.
// Kota pesisir Indonesia fiktif: Teluk Harapan. Semua nama, karakter,
// kendaraan, dan tempat di sini orisinal — bukan dari game komersial mana pun.

export const GAME_TITLE = 'TELUK HARAPAN';
export const GAME_SUBTITLE = 'Kota pesisir. Tiga hari. Satu kesempatan terakhir.';
export const GAME_VERSION = '5.0.0';

// ---------------------------------------------------------------------------
// Dunia
// ---------------------------------------------------------------------------
export const WORLD = {
  width: 3600,
  height: 2600,
  // Jalan vertikal (avenue) dan horizontal (street), dalam koordinat dunia.
  avenues: [300, 900, 1500, 2100, 2700, 3200],
  streets: [300, 850, 1400, 1950, 2350],
  roadHalfWidth: 34,
  sidewalk: 14,
  blockMargin: 26,
};

// Lima distrik — masing-masing punya identitas visual dan suasana sendiri.
export const DISTRICTS = [
  {
    id: 'pelabuhan',
    name: 'Pelabuhan Senja',
    short: 'PELABUHAN',
    bounds: { x0: 0, y0: 0, x1: 900, y1: 1400 },
    ground: '#5d5a4a',
    groundAlt: '#6b6753',
    accent: '#d97b2b',
    roof: ['#7a4a2e', '#8a5a35', '#6e3f28'],
    landmark: 'Dermaga Kontainer',
    flavor: 'Bau solar dan garam. Derek raksasa membayangi kontainer berkarat.',
    ambient: 'gull',
  },
  {
    id: 'pasar',
    name: 'Pasar Ikan Lama',
    short: 'PASAR',
    bounds: { x0: 900, y0: 0, x1: 2100, y1: 850 },
    ground: '#6e6250',
    groundAlt: '#7a6d58',
    accent: '#2fa08a',
    roof: ['#a8442f', '#b0522f', '#96502c'],
    landmark: 'Pasar Ikan Lama',
    flavor: 'Teriakan pedagang, es balok, dan bau ikan segar dari laut pagi.',
    ambient: 'crowd',
  },
  {
    id: 'kotatua',
    name: 'Kota Tua',
    short: 'KOTA TUA',
    bounds: { x0: 900, y0: 850, x1: 2100, y1: 1950 },
    ground: '#6a6257',
    groundAlt: '#756d60',
    accent: '#c9a227',
    roof: ['#8c2f26', '#7d2a24', '#94502f'],
    landmark: 'Balai Kota Tua',
    flavor: 'Gedung kolonial, jalan batu, dan jam tua yang tak pernah tepat.',
    ambient: 'bells',
  },
  {
    id: 'bukit',
    name: 'Bukit Harapan',
    short: 'BUKIT',
    bounds: { x0: 2100, y0: 0, x1: 3600, y1: 1950 },
    ground: '#4f5d43',
    groundAlt: '#58664a',
    accent: '#7fb069',
    roof: ['#5d3a2a', '#6b4430', '#4a2f24'],
    landmark: 'Vila Bukit',
    flavor: 'Rumah-rumah di lereng bukit, menghadap teluk yang berkilau.',
    ambient: 'birds',
  },
  {
    id: 'neon',
    name: 'Dermaga Neon',
    short: 'NEON',
    bounds: { x0: 0, y0: 1950, x1: 3600, y1: 2600 },
    ground: '#3d3a4d',
    groundAlt: '#453f57',
    accent: '#ff2e88',
    roof: ['#2e2a3d', '#3a2f4d', '#262233'],
    landmark: 'Klub Lampion',
    flavor: 'Neon menyala sebelum gelap. Musik, taruhan, dan janji palsu.',
    ambient: 'music',
  },
];

// Tiga hari cerita — Senja, Maghrib, Malam — masing-masing punya palet langit.
export const DAYS = [
  {
    day: 1,
    phase: 'Senja',
    sky: '#f2a65a',
    skyTop: '#e07b39',
    light: 0.96,
    fog: 'rgba(242,166,90,0.10)',
    sun: { x: 0.82, y: 0.16, color: '#ffd27a' },
    label: 'HARI 1 — SENJA',
  },
  {
    day: 2,
    phase: 'Maghrib',
    sky: '#b65a7a',
    skyTop: '#5e3a6e',
    light: 0.78,
    fog: 'rgba(150,70,110,0.16)',
    sun: { x: 0.2, y: 0.1, color: '#ff9e7a' },
    label: 'HARI 2 — MAGHRIB',
  },
  {
    day: 3,
    phase: 'Malam',
    sky: '#1c2340',
    skyTop: '#0b0e1e',
    light: 0.58,
    fog: 'rgba(10,12,30,0.28)',
    sun: { x: 0.5, y: 0.08, color: '#e8ecff' },
    label: 'HARI 3 — MALAM',
  },
];

// ---------------------------------------------------------------------------
// Kendaraan
// ---------------------------------------------------------------------------
export const CAR_MODELS = [
  { id: 'becakmotor', name: 'Becak Motor', top: 175, accel: 240, grip: 3.4, hp: 120, color: '#e8b93c', price: 0, seats: 2, size: [30, 18] },
  { id: 'sedan', name: 'Sedan Kota', top: 235, accel: 260, grip: 3.1, hp: 100, color: '#4a7fb5', price: 1200, seats: 4, size: [44, 22] },
  { id: 'pikap', name: 'Pikap Muatan', top: 205, accel: 230, grip: 2.8, hp: 140, color: '#7a8a7a', price: 1800, seats: 2, size: [48, 24] },
  { id: 'sport', name: 'Sport Senja', top: 330, accel: 360, grip: 3.8, hp: 90, color: '#c93a3a', price: 5200, seats: 2, size: [46, 21] },
  { id: 'taksi', name: 'Taksi Teluk', top: 225, accel: 250, grip: 3.0, hp: 100, color: '#e8c832', price: 1500, seats: 4, size: [44, 22] },
  { id: 'truk', name: 'Truk Kontainer', top: 170, accel: 170, grip: 2.4, hp: 220, color: '#8a6a4a', price: 3200, seats: 2, size: [64, 26] },
  { id: 'patroli', name: 'Mobil Patroli', top: 300, accel: 340, grip: 3.6, hp: 160, color: '#2a4a8a', price: 0, seats: 4, size: [46, 22], police: true },
  { id: 'ambulans', name: 'Ambulans', top: 250, accel: 280, grip: 3.0, hp: 160, color: '#e8e8e8', price: 0, seats: 2, size: [50, 24] },
];

export const CAR_COLORS = ['#4a7fb5', '#c93a3a', '#7fb069', '#e8c832', '#8a6a9a', '#d97b2b', '#5a6a7a', '#b5b5b5', '#3a3a3a', '#2fa08a'];

// ---------------------------------------------------------------------------
// Senjata
// ---------------------------------------------------------------------------
export const WEAPONS = {
  fist: { id: 'fist', name: 'Tinju', damage: 12, rate: 0.32, range: 46, ammo: Infinity, auto: false, price: 0, mag: Infinity, spread: 0, speed: 0, color: '#e8d8b0' },
  pistol: { id: 'pistol', name: 'Pistol P-9', damage: 22, rate: 0.28, range: 420, ammo: 12, auto: false, price: 800, mag: 12, spread: 0.05, speed: 900, color: '#c9c9c9' },
  smg: { id: 'smg', name: 'SMG Kilat', damage: 13, rate: 0.085, range: 360, ammo: 30, auto: true, price: 2400, mag: 30, spread: 0.11, speed: 950, color: '#8a8a8a' },
  shotgun: { id: 'shotgun', name: 'Senapan Lorong', damage: 14, rate: 0.85, range: 260, ammo: 6, auto: false, price: 1800, mag: 6, spread: 0.22, speed: 820, color: '#6a4a2a', pellets: 6 },
};

// ---------------------------------------------------------------------------
// Toko dan ekonomi — empat toko, semuanya berfungsi
// ---------------------------------------------------------------------------
export const SHOPS = [
  {
    id: 'bengkel',
    name: 'Bengkel Jaya',
    kind: 'repair',
    district: 'kotatua',
    x: 1800, y: 1150,
    blurb: 'Perbaiki mobil, pasang pelindung, ganti cat.',
    stock: [
      { id: 'repair', name: 'Perbaiki Mobil (penuh)', price: 150, desc: 'HP mobil kembali 100%.' },
      { id: 'armor_car', name: 'Pelindung Baja Mobil', price: 900, desc: 'Mobil +80 HP maks, tahan tabrakan.' },
      { id: 'paint', name: 'Cat Ulang Mobil', price: 120, desc: 'Warna baru — polisi lebih lambat mengenalimu.' },
      { id: 'nitro', name: 'Tabung Nitro', price: 650, desc: 'Shift = dorongan nitro 3 detik.' },
    ],
  },
  {
    id: 'senjata',
    name: 'Sinar Senjata & Amunisi',
    kind: 'weapons',
    district: 'neon',
    x: 1200, y: 2150,
    blurb: 'Senjata, amunisi, dan rompi. Tanpa banyak tanya.',
    stock: [
      { id: 'buy_pistol', name: 'Pistol P-9', price: 800, desc: '12 peluru per magazen.' },
      { id: 'buy_smg', name: 'SMG Kilat', price: 2400, desc: 'Tembakan cepat, 30 peluru.' },
      { id: 'buy_shotgun', name: 'Senapan Lorong', price: 1800, desc: '6 proyektil sekali tembak.' },
      { id: 'ammo_pistol', name: 'Amunisi Pistol x24', price: 120, desc: 'Stok peluru pistol.' },
      { id: 'ammo_smg', name: 'Amunisi SMG x60', price: 220, desc: 'Stok peluru SMG.' },
      { id: 'ammo_shotgun', name: 'Amunisi Senapan x12', price: 160, desc: 'Stok peluru senapan.' },
      { id: 'vest', name: 'Rompi Anti Peluru', price: 500, desc: 'Armor +50, tahan tembakan.' },
    ],
  },
  {
    id: 'rumah',
    name: 'Rumah Aman Raka',
    kind: 'safehouse',
    district: 'bukit',
    x: 2950, y: 600,
    blurb: 'Rumahmu di bukit. Simpan permainan, istirahat, ganti hari.',
    stock: [
      { id: 'save', name: 'Simpan Permainan', price: 0, desc: 'Simpan progres ke slot.' },
      { id: 'rest', name: 'Istirahat (pulih penuh)', price: 60, desc: 'HP penuh, wanted turun 1.' },
      { id: 'stash', name: 'Ambil Uang Simpanan', price: 0, desc: 'Ambil Rp 200 dari simpanan (sekali per hari).' },
    ],
  },
  {
    id: 'klinik',
    name: 'Klinik Sehat Teluk',
    kind: 'clinic',
    district: 'pasar',
    x: 1800, y: 550,
    blurb: 'Perban, obat, dan dokter yang tidak bertanya.',
    stock: [
      { id: 'heal', name: 'Perawatan Penuh', price: 200, desc: 'HP kembali 100.' },
      { id: 'bandage', name: 'Perban Darurat', price: 80, desc: 'HP +40 seketika.' },
      { id: 'medkit', name: 'Kotak P3K', price: 150, desc: 'Bawa pulang: pakai dengan H.' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Pejalan kaki — nama dan penampilan acak dari daftar ini
// ---------------------------------------------------------------------------
export const PED_NAMES = [
  'Pak Budi', 'Bu Sari', 'Dedi', 'Maya', 'Agus', 'Rina', 'Joko', 'Lestari',
  'Fajar', 'Nina', 'Hendra', 'Sinta', 'Bambang', 'Dewi', 'Rizky', 'Putri',
  'Slamet', 'Ayu', 'Eko', 'Ratna', 'Yusuf', 'Wulan', 'Tono', 'Laras',
];
export const PED_SHIRTS = ['#c95a4a', '#4a7fb5', '#7fb069', '#e8c832', '#8a6a9a', '#d97b2b', '#2fa08a', '#b5b5b5', '#e8e8e8', '#5a6a7a'];
export const PED_LINES = [
  'Hati-hati di jalan, Nak.',
  'Ikan hari ini segar-segar!',
  'Katanya ada razia di dermaga.',
  'Teluk ini makin ramai saja.',
  'Awas, ada mobil ngebut!',
  'Kopi di warung ujung enak.',
  'Jangan pulang malam-malam.',
  'Harga cabai naik lagi!',
];

// ---------------------------------------------------------------------------
// Cerita — 5 misi, masing-masing satu arc lengkap
// ---------------------------------------------------------------------------
export const STORY = {
  hero: 'Raka',
  heroDesc: 'Kurir teluk yang berutang pada orang yang salah.',
  antagonist: 'Bos Darma',
  antagonistDesc: 'Penguasa dermaga. Pemilik utang Raka — dan pemilik kota ini.',
  ally: 'Sinta',
  allyDesc: 'Montir Bengkel Jaya. Satu-satunya orang yang masih percaya pada Raka.',
  informant: 'Pak Tono',
  informantDesc: 'Nelayan tua yang tahu semua rahasia pelabuhan.',
};

export const MISSIONS = [
  {
    id: 1,
    title: 'Senja di Pelabuhan',
    day: 1,
    district: 'pelabuhan',
    briefing: 'Pak Tono menunggumu di Pelabuhan Senja. Sebuah paket harus sampai ke Pasar Ikan sebelum senja habis — dan seseorang tidak mau paket itu sampai.',
    reward: 600,
    intro: [
      { who: 'Pak Tono', text: 'Raka! Akhirnya. Paket ini harus sampai ke Pasar Ikan sebelum senja habis.' },
      { who: 'Raka', text: 'Paket apa ini, Pak? Berat sekali.' },
      { who: 'Pak Tono', text: 'Jangan tanya. Bawa saja. Dan hati-hati — orang-orang Darma mengawasi dermaga.' },
    ],
    outro: [
      { who: 'Raka', text: 'Paket sampai. Tapi kenapa rasanya ini baru permulaan?' },
      { who: 'Sinta', text: 'Karena memang baru permulaan. Datang ke bengkelku kalau kau butuh mobil yang lebih cepat.' },
    ],
  },
  {
    id: 2,
    title: 'Utang Lama',
    day: 1,
    district: 'kotatua',
    briefing: 'Bos Darma menagih utang lamamu lewat anak buahnya di Kota Tua. Sinta bilang: hadapi mereka, atau utangmu berlipat. Ambil kembali uangmu dari mereka.',
    reward: 900,
    intro: [
      { who: 'Sinta', text: 'Anak buah Darma nongkrong di Balai Kota Tua. Mereka bawa uang tagihanmu — uang yang bukan hak mereka.' },
      { who: 'Raka', text: 'Jadi aku harus merebutnya kembali?' },
      { who: 'Sinta', text: 'Kau yang berutang, kau yang tentukan caranya. Tapi jangan mati, Raka.' },
    ],
    outro: [
      { who: 'Raka', text: 'Uang kembali. Tapi Darma tidak akan diam saja.' },
      { who: 'Pak Tono', text: 'Darma tidak pernah diam. Besok maghrib, temui aku di Pasar Ikan. Ada yang harus kau lihat.' },
    ],
  },
  {
    id: 3,
    title: 'Topeng Maghrib',
    day: 2,
    district: 'pasar',
    briefing: 'Maghrib turun. Darma memindahkan barang selundupan lewat Pasar Ikan dengan mobil pengantar berkedok taksi. Curi mobil itu, ikuti tanpa ketahuan, dan foto tujuannya — tanpa menembak siapa pun kalau bisa.',
    reward: 1200,
    intro: [
      { who: 'Pak Tono', text: 'Lihat taksi kuning itu? Itu bukan taksi. Di dalamnya ada catatan pengiriman Darma.' },
      { who: 'Raka', text: 'Jadi aku mencuri taksi, lalu membuntutinya?' },
      { who: 'Pak Tono', text: 'Curi mobilnya, ikuti konvoinya, dan jangan sampai ketahuan. Maghrib adalah temanmu — gelap menutupi.' },
    ],
    outro: [
      { who: 'Raka', text: 'Catatan itu menyebut Dermaga Neon. Gudang nomor tujuh.' },
      { who: 'Sinta', text: 'Gudang tujuh adalah tempat Darma menyimpan semua uangnya. Raka... kau tahu apa artinya ini, kan?' },
    ],
  },
  {
    id: 4,
    title: 'Perampokan Dermaga',
    day: 2,
    district: 'neon',
    briefing: 'Malam hampir tiba. Gudang 7 di Dermaga Neon menyimpan brankas Darma. Bobol brankasnya, ambil uangnya, dan kabur sebelum helikopter polisi datang. Ini titik tanpa jalan kembali.',
    reward: 2500,
    intro: [
      { who: 'Sinta', text: 'Brankasnya di dalam gudang. Alarmnya kupadamkan — kau punya tiga menit sebelum polisi sadar.' },
      { who: 'Raka', text: 'Tiga menit untuk mengubah hidupku.' },
      { who: 'Sinta', text: 'Atau mengakhirinya. Pilih baik-baik, Raka.' },
    ],
    outro: [
      { who: 'Raka', text: 'Uang Darma ada di tanganku. Sekarang seluruh kota mengejarku.' },
      { who: 'Bos Darma', text: 'Kau pikir kau bisa mencuri dariku, Raka? Malam ini, aku sendiri yang akan mengakhirinya.' },
    ],
  },
  {
    id: 5,
    title: 'Malam Terakhir',
    day: 3,
    district: 'neon',
    briefing: 'Malam terakhir. Bos Darma sendiri turun ke jalan dengan konvoinya. Hentikan konvoi itu, hadapi Darma di Dermaga Neon, dan akhiri semua ini — untuk Teluk Harapan.',
    reward: 4000,
    intro: [
      { who: 'Bos Darma', text: 'Kau datang juga, kurir kecil. Kota ini milikku — dan malam ini, nyawamu juga.' },
      { who: 'Raka', text: 'Kota ini milik orang-orangnya, Darma. Bukan milikmu. Bukan malam ini.' },
      { who: 'Sinta', text: 'Raka, konvoinya datang dari utara. Aku di belakangmu. Akhiri ini!' },
    ],
    outro: [
      { who: 'Raka', text: 'Selesai. Darma jatuh. Teluk Harapan akhirnya bisa bernapas.' },
      { who: 'Sinta', text: 'Matahari akan terbit lagi di teluk ini. Dan kali ini, untuk kita semua.' },
      { who: 'Pak Tono', text: 'Laut tidak pernah lupa, Nak. Tapi laut juga memaafkan. Selamat datang kembali, Raka.' },
    ],
  },
];

// Pesan radio polisi per tingkat wanted.
export const WANTED_LINES = {
  1: 'Unit patroli: ada laporan keributan di Teluk Harapan.',
  2: 'Semua unit: tersangka bersenjata, dekati dengan hati-hati.',
  3: 'Helikopter dikerahkan. Jangan biarkan dia kabur!',
  4: 'Blokade di semua jalan utama! Tangkap dia hidup atau mati!',
  5: 'DARURAT KOTA! Semua unit ke Teluk Harapan, sekarang!',
};

// Tips yang muncul di layar judul, bergantian.
export const TIPS = [
  'WASD mengemudi / berjalan — E masuk & keluar mobil.',
  'Klik mouse untuk menembak. R isi ulang. H pakai kotak P3K.',
  'Tekan Shift untuk nitro (kalau mobilmu punya). Spasi rem tangan.',
  'Sembunyi di gang sempit untuk menurunkan wanted.',
  'Kunjungi 4 toko: Bengkel, Senjata, Rumah Aman, Klinik.',
  'Misi dimulai dari penanda kuning di peta. Ikuti panah di minimap.',
  'Tabrakan keras merusak mobil — perbaiki di Bengkel Jaya.',
  'Simpan permainanmu di Rumah Aman, Bukit Harapan.',
];
