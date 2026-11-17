// TELUK HARAPAN — config.js
// Semua data tuning game: dunia, distrik, misi, ekonomi, kendaraan, senjata.
// Ditulis fresh untuk round 4 (revisi): 5 story mission yang dalam, bukan
// misi banyak yang tipis. Tidak ada aset Rockstar/GTA — semua nama, karakter,
// dan tempat adalah fiksi original Indonesia.

export const CONFIG = Object.freeze({
  title: 'TELUK HARAPAN',
  subtitle: 'Kota pesisir. Utang keluarga. Satu jalan pulang.',
  version: '4.0.0',
  saveKey: 'teluk-harapan-save-v1',

  // ---- dunia ----
  world: {
    size: 640, // kota 640 x 640 unit, pusat (0,0)
    roadEvery: 64, // jarak antar jalan utama
    streetEvery: 32, // jarak antar gang
    avenueWidth: 13,
    streetWidth: 8,
    sidewalk: 3,
    seed: 20261118,
    waterWest: -320, // garis pantai barat (x < -260 = laut)
    beachSouth: 300, // garis pantai selatan (z > 280 = pasir/laut)
  },

  // ---- 5 distrik, masing-masing identitas kuat ----
  districts: [
    {
      id: 'pelabuhan',
      name: 'Pelabuhan',
      x0: -320, z0: -320, x1: -128, z1: 128,
      palette: ['#7a6a58', '#8c7a63', '#5d6b73', '#9a8a70', '#6b7a86'],
      ground: '#6f6a5e',
      landmark: 'Dermaga & kontainer',
      desc: 'Dermaga tua, kontainer berkarat, derek raksasa, kapal nelayan.',
    },
    {
      id: 'kota-lama',
      name: 'Kota Lama',
      x0: -128, z0: -320, x1: 128, z1: 64,
      palette: ['#b98a4e', '#a87c46', '#c9a35f', '#8f6b3d', '#d4b06a'],
      ground: '#8a7a5c',
      landmark: 'Pasar & menara jam',
      desc: 'Gang sempit, pasar pagi, rumah toko tua, menara jam 1927.',
    },
    {
      id: 'pesisir',
      name: 'Pesisir',
      x0: -128, z0: 64, x1: 128, z1: 320,
      palette: ['#e8d9a0', '#d9c27f', '#f2e6b8', '#cbb26a', '#e0c98f'],
      ground: '#cbb98a',
      landmark: 'Pantai & mercusuar',
      desc: 'Pantai berpasir, pohon kelapa, hotel kecil, mercusuar putih.',
    },
    {
      id: 'industri',
      name: 'Kawasan Industri',
      x0: 128, z0: -320, x1: 320, z1: 128,
      palette: ['#6e6e6e', '#7d7d7d', '#5a5a5a', '#8a8a8a', '#4d4d4d'],
      ground: '#5f5f5c',
      landmark: 'Gudang 7 & cerobong',
      desc: 'Gudang baja, cerobong asap, truk kontainer, pagar kawat.',
    },
    {
      id: 'bukit',
      name: 'Bukit',
      x0: 128, z0: 128, x1: 320, z1: 320,
      palette: ['#7d9b6a', '#8aa878', '#6b8a5e', '#93b184', '#5f7d55'],
      ground: '#6f7d5a',
      landmark: 'Vila & rumah aman',
      desc: 'Jalan menanjak, vila beratap genteng, taman, rumah aman.',
    },
  ],

  // ---- fase hari (3 hari cerita) ----
  phases: {
    senja: {
      label: 'Senja',
      sky: 0xff9a52, fog: 0xf7b06a, sun: 0xffb36b, sunIntensity: 1.5,
      sunPos: [-180, 60, 120], ambient: 0x8a7a9a, ambientIntensity: 0.55,
      hemi: 0xffc890, hemiIntensity: 0.5, lamps: false, stars: false,
    },
    maghrib: {
      label: 'Maghrib',
      sky: 0x7a4a8a, fog: 0x9a6a8a, sun: 0xff7a5a, sunIntensity: 0.9,
      sunPos: [-220, 22, 60], ambient: 0x6a5a8a, ambientIntensity: 0.5,
      hemi: 0xc07a9a, hemiIntensity: 0.45, lamps: true, stars: false,
    },
    malam: {
      label: 'Malam',
      sky: 0x0a1230, fog: 0x0e1a3a, sun: 0x9ab8ff, sunIntensity: 0.35,
      sunPos: [120, 140, -80], ambient: 0x2a3a6a, ambientIntensity: 0.55,
      hemi: 0x3a4a7a, hemiIntensity: 0.4, lamps: true, stars: true,
    },
  },
  days: [
    { day: 1, phase: 'senja', label: 'Hari 1 — Senja' },
    { day: 2, phase: 'maghrib', label: 'Hari 2 — Maghrib' },
    { day: 3, phase: 'malam', label: 'Hari 3 — Malam' },
  ],

  // ---- pemain ----
  player: {
    walkSpeed: 7,
    runSpeed: 12,
    health: 100,
    armor: 0,
    startMoney: 120,
    radius: 0.9,
    height: 1.8,
  },

  // ---- kendaraan ----
  cars: {
    sedan: { name: 'Sedan Tua', accel: 16, topSpeed: 34, brake: 30, steer: 1.9, grip: 0.92, hp: 100, color: 0x7a3a2e, price: 0 },
    taksi: { name: 'Taksi Kuning', accel: 14, topSpeed: 30, brake: 28, steer: 1.8, grip: 0.9, hp: 90, color: 0xd9a821, price: 0 },
    pickup: { name: 'Pikap', accel: 13, topSpeed: 28, brake: 26, steer: 1.6, grip: 0.88, hp: 130, color: 0x3a5a7a, price: 0 },
    sport: { name: 'Sport Merah', accel: 22, topSpeed: 46, brake: 34, steer: 2.3, grip: 0.95, hp: 80, color: 0xa31e22, price: 0 },
    truk: { name: 'Truk Kontainer', accel: 9, topSpeed: 22, brake: 20, steer: 1.3, grip: 0.85, hp: 180, color: 0x5a6a5a, price: 0 },
    polisi: { name: 'Mobil Polisi', accel: 20, topSpeed: 42, brake: 34, steer: 2.2, grip: 0.94, hp: 120, color: 0x1e3a8a, price: 0 },
    perahu: { name: 'Perahu Cepat', accel: 18, topSpeed: 40, brake: 22, steer: 2.0, grip: 0.9, hp: 90, color: 0xe8e8e8, price: 0 },
  },

  // ---- senjata ----
  weapons: {
    fists: { name: 'Tangan Kosong', damage: 12, rate: 2.2, range: 2.2, ammo: Infinity, auto: false, price: 0 },
    pistol: { name: 'Pistol', damage: 22, rate: 3.5, range: 55, ammo: 12, auto: false, price: 150, ammoPrice: 20 },
    smg: { name: 'SMG', damage: 14, rate: 11, range: 45, ammo: 32, auto: true, price: 400, ammoPrice: 35 },
  },

  // ---- ekonomi / toko ----
  shops: [
    { id: 'bengkel', name: 'Bengkel Sari', kind: 'repair', x: -40, z: -96, district: 'kota-lama', blurb: 'Perbaiki mobil & lapis baja' },
    { id: 'senjata', name: 'Toko Senjata Jaya', kind: 'weapons', x: 176, z: -160, district: 'industri', blurb: 'Pistol, SMG, amunisi, rompi' },
    { id: 'klinik', name: 'Klinik Harapan', kind: 'clinic', x: 48, z: 208, district: 'pesisir', blurb: 'Obat & rawat luka' },
    { id: 'rumah', name: 'Rumah Aman', kind: 'safehouse', x: 224, z: 224, district: 'bukit', blurb: 'Simpan game & tidur' },
  ],
  prices: {
    repair: 30, armorPlate: 100, heal: 50, fullHeal: 90,
    pistolAmmo: 20, smgAmmo: 35, bribe: 200,
  },

  // ---- wanted ----
  wanted: {
    decaySeconds: 22,
    policePerStar: 2,
    heliAtStars: 3,
    maxStars: 5,
    bustedFine: 150,
    hospitalFee: 50,
  },

  // ---- lalu lintas & pejalan kaki ----
  traffic: { cars: 22, peds: 30, pedFleeRadius: 18 },

  // ---- misi: 5 story mission, masing-masing arc lengkap ----
  missions: [
    {
      id: 'm1',
      title: 'M1 — PULANG',
      day: 1, phase: 'senja',
      brief: 'Raka pulang ke Teluk Harapan setelah 3 tahun. Jemput Dimas di dermaga, antar ke Bengkel Sari. Dua penagih utang membuntuti.',
      dialogue: [
        { who: 'Dimas', text: 'Bang Raka! Akhirnya pulang juga. Mereka... mereka nyari aku, Bang.' },
        { who: 'Raka', text: 'Siapa? Lorong? Utang berapa, Dim?' },
        { who: 'Dimas', text: 'Aku nggak bisa bayar. Bos Anggara yang pegang. Cepat, ke bengkel Sari dulu.' },
        { who: 'Sari', text: 'Raka! Mobil bapakmu masih di sini. Hati-hati — dua orang itu ngikutin dari tadi.' },
      ],
      objectives: [
        { id: 'drive', text: 'Naik mobil & jemput Dimas di dermaga', kind: 'reach', x: -272, z: -64, radius: 8 },
        { id: 'deliver', text: 'Antar Dimas ke Bengkel Sari', kind: 'reach', x: -40, z: -96, radius: 10 },
        { id: 'lose', text: 'Lepas dari kejaran penagih utang', kind: 'escape', seconds: 12 },
      ],
      reward: 150, unlock: 'pistol_hint',
    },
    {
      id: 'm2',
      title: 'M2 — UTANG LUNAS?',
      day: 1, phase: 'senja',
      brief: 'Sari memberi pistol. Ambil paket di Pasar Kota Lama, antar ke Gudang 7. Penagih Lorong menyergap di pasar.',
      dialogue: [
        { who: 'Sari', text: 'Ambil pistol ini. Paketnya di Pasar, kios nomor 7. Jangan sampai jatuh ke tangan Lorong.' },
        { who: 'Raka', text: 'Paket apa sih ini?' },
        { who: 'Sari', text: 'Bukti utang Dimas. Kalau sampai ke Gudang 7, Anggara nggak bisa ngapa-ngapain.' },
        { who: 'Penagih', text: 'Itu dia! Ambil paketnya! Jangan biarkan dia lolos!' },
      ],
      objectives: [
        { id: 'pickup', text: 'Ambil paket di Pasar Kota Lama', kind: 'reach', x: -64, z: -224, radius: 8 },
        { id: 'ambush', text: 'Hadapi penyergapan di pasar', kind: 'defeat', count: 3 },
        { id: 'deliver', text: 'Antar paket ke Gudang 7', kind: 'reach', x: 208, z: -78, radius: 10 },
      ],
      reward: 250, unlock: 'pistol',
    },
    {
      id: 'm3',
      title: 'M3 — BLOKADE',
      day: 2, phase: 'maghrib',
      brief: 'Anggara menjebak Raka: polisi mengira Raka perampok bank. Wanted 3 bintang. Tembus blokade di jembatan, sampai ke Rumah Aman di Bukit.',
      dialogue: [
        { who: 'Radio Polisi', text: 'Perhatian semua unit: tersangka perampokan bank, sedan merah, arah Jembatan Harapan.' },
        { who: 'Raka', text: 'Ini jebakan Anggara. Aku harus sampai ke Bukit sebelum mereka menangkapku.' },
        { who: 'Sari (telepon)', text: 'Raka, jangan berhenti! Blokade di jembatan — cari celah di sisi kanan!' },
        { who: 'Radio Polisi', text: 'Helikopter sudah di udara. Tersangka menuju Bukit. Jangan biarkan lolos.' },
      ],
      objectives: [
        { id: 'bridge', text: 'Tembus blokade di Jembatan Harapan', kind: 'reach', x: 64, z: 96, radius: 12 },
        { id: 'escape', text: 'Lepas dari kejaran polisi', kind: 'escape', seconds: 15 },
        { id: 'safehouse', text: 'Sampai ke Rumah Aman di Bukit', kind: 'reach', x: 224, z: 224, radius: 10 },
      ],
      reward: 300, unlock: 'smg_hint',
      startWanted: 3,
    },
    {
      id: 'm4',
      title: 'M4 — GUDANG 7',
      day: 2, phase: 'maghrib',
      brief: 'Dimas ditahan di Gudang 7. Serbu gudang, kalahkan 6 anak buah Anggara, bebaskan Dimas.',
      dialogue: [
        { who: 'Dimas (telepon)', text: 'Bang... mereka bawa aku ke Gudang 7. Cepat... sebelum Anggara datang.' },
        { who: 'Raka', text: 'Bertahan, Dim. Aku datang.' },
        { who: 'Anak Buah', text: 'Ada penyusup! Jangan biarkan dia masuk ke ruang tahanan!' },
        { who: 'Dimas', text: 'Bang Raka! Kuncinya di meja penjaga. Ayo pergi dari sini!' },
      ],
      objectives: [
        { id: 'infiltrate', text: 'Masuk ke Gudang 7', kind: 'reach', x: 208, z: -78, radius: 10 },
        { id: 'clear', text: 'Kalahkan anak buah Anggara', kind: 'defeat', count: 6 },
        { id: 'rescue', text: 'Bebaskan Dimas', kind: 'reach', x: 224, z: -80, radius: 6 },
      ],
      reward: 400, unlock: 'smg',
    },
    {
      id: 'm5',
      title: 'M5 — BOS ANGGARA',
      day: 3, phase: 'malam',
      brief: 'Finale. Anggara kabur naik perahu dari dermaga. Kejar dengan perahu cepat, hadapi dia di dermaga malam, akhiri semuanya.',
      dialogue: [
        { who: 'Anggara', text: 'Raka Pradana. Kau pikir bisa menghancurkanku di kotaku sendiri?' },
        { who: 'Raka', text: 'Kotamu? Ini kota kami semua. Dan utang Dimas lunas malam ini.' },
        { who: 'Anggara', text: 'Kalau begitu, kejar aku — kalau bisa.' },
        { who: 'Sari', text: 'Perahu cepat sudah siap di dermaga. Hati-hati, Raka. Ini yang terakhir.' },
        { who: 'Raka', text: 'Teluk Harapan... aku pulang untuk ini.' },
      ],
      objectives: [
        { id: 'boat', text: 'Naik perahu cepat di dermaga', kind: 'reach', x: -288, z: 32, radius: 8 },
        { id: 'chase', text: 'Kejar perahu Anggara', kind: 'chase', target: 'anggara', radius: 14 },
        { id: 'boss', text: 'Kalahkan Bos Anggara di dermaga', kind: 'defeat', count: 1, boss: true },
      ],
      reward: 1000, unlock: 'win',
    },
  ],

  // ---- kontrol ----
  controls: {
    onFoot: 'WASD jalan · Shift lari · E masuk mobil · Klik tembak · R ganti senjata · M peta',
    driving: 'W gas · S rem/mundur · A/D belok · Spasi rem tangan · E keluar mobil · C kamera',
    general: 'P jeda · H bantuan · F5 simpan cepat',
  },

  // ---- screenshot (deterministik, seed 1) ----
  shots: [
    { name: '1-start.jpg', query: '?shot=start&seed=1', caption: 'Layar judul di atas Teluk Harapan saat senja' },
    { name: '2-play.jpg', query: '?shot=play&seed=1', caption: 'Mengemudi di Pelabuhan saat senja' },
    { name: '3-chase.jpg', query: '?shot=chase&seed=1', caption: 'Kejaran polisi di Maghrib, helikopter di udara' },
    { name: '4-end.jpg', query: '?shot=end&seed=1', caption: 'Finale malam di dermaga — perahu cepat' },
  ],
});
