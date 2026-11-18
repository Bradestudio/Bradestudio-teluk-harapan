# TELUK HARAPAN

**Open-world crime game orisinal** — kota pesisir Indonesia fiktif, dimainkan di
browser desktop dari file statis, tanpa jaringan. Dibangun untuk kompetisi
make.fun **gta6-01** ("Make GTA 6"). Semua kota, karakter, kendaraan, cerita,
dan suara di sini orisinal — bukan dari Grand Theft Auto atau game komersial
lain mana pun.

## Cerita

Kamu **Raka**, kurir Teluk Harapan yang berutang pada orang yang salah.
Dalam **3 hari** — Senja, Maghrib, Malam — kamu harus menyelesaikan
**5 story mission** dan mengakhiri kekuasaan **Bos Darma** atas kota ini:

1. **Senja di Pelabuhan** — antar paket ke Pasar Ikan sebelum senja habis.
2. **Utang Lama** — rebut kembali uangmu dari anak buah Darma di Kota Tua.
3. **Topeng Maghrib** — curi taksi kuning dan buntuti konvoi Darma tanpa ketahuan.
4. **Perampokan Dermaga** — bobol brankas di Gudang 7 dan kabur dari kejaran polisi.
5. **Malam Terakhir** — hentikan konvoi Bos Darma dan hadapi dia di Dermaga Neon.

## Dunia

**5 distrik** dengan identitas kuat: Pelabuhan Senja (derek & kontainer),
Pasar Ikan Lama (kios & pedagang), Kota Tua (gedung kolonial & Balai Kota),
Bukit Harapan (vila di lereng bukit), Dermaga Neon (klub & lampu neon).
Langit dan pencahayaan berubah tiap hari: Senja → Maghrib → Malam.

## Sistem

- **Berkendara & mencuri mobil** — 8 model kendaraan, fisika arcade, nitro,
  rem tangan, tabrakan merusak mobil.
- **Lalu lintas & pejalan kaki AI** — mobil mengikuti jalan, berhenti di
  persimpangan, membunyikan klakson; pejalan kaki berjalan, mengobrol, dan
  kabur saat ada tembakan.
- **Wanted 1–5** — mobil patroli mengejar, polisi jalan kaki menangkap,
  helikopter di wanted 3+, blokade jalan di wanted 4+. Bersembunyi untuk
  menurunkan wanted.
- **Combat** — tinju, pistol, SMG, senapan; musuh AI mengejar, menembak,
  dan bos final yang agresif.
- **Ekonomi & 4 toko** — Bengkel Jaya (perbaiki & upgrade mobil), Sinar
  Senjata (senjata & amunisi), Rumah Aman (simpan & istirahat), Klinik
  Sehat (obat & kotak P3K).
- **HUD + minimap + peta besar (M)** — HP, armor, uang, wanted, tujuan
  misi, kecepatan, dan penanda misi yang berdenyut.
- **Save/load** — 3 slot di localStorage, dari Rumah Aman atau menu jeda.
- **Audio synth** — mesin, sirene, tembakan, dan musik ambient, semua
  disintesis WebAudio tanpa file audio.

## Cara bermain

| Kontrol | Aksi |
|---|---|
| WASD | Berjalan / mengemudi |
| Mouse + klik kiri | Arahkan & tembak |
| E | Masuk/keluar mobil, bicara, interaksi, mulai misi |
| F | Pukul |
| R | Isi ulang senjata |
| H | Pakai kotak P3K |
| Shift | Nitro (bila terpasang) |
| Spasi | Rem tangan |
| 1–4 | Ganti senjata |
| M | Peta besar |
| Esc / P | Jeda |

Mulai misi dari **penanda kuning** di minimap. Simpan permainanmu di
**Rumah Aman** (Bukit Harapan) — kalau Raka tumbang, kamu bangkit dari sana.

## Menjalankan

```sh
node serve.ts
# buka http://localhost:8080
```

## Screenshot deterministik

```
http://localhost:8080/?shot=1&seed=1   # layar judul
http://localhost:8080/?shot=2&seed=1   # mengemudi di Kota Tua
http://localhost:8080/?shot=3&seed=1   # kejar-kejaran polisi (Maghrib)
http://localhost:8080/?shot=4&seed=1   # finale vs Bos Darma (Malam)
```

## Struktur kode

```
game/
  index.html            # canvas + boot modul
  src/
    main.js             # boot, game loop, kamera, menu, dialog
    config.js           # distrik, kendaraan, senjata, toko, cerita
    world.js            # bangun kota + tabrakan + query spasial
    random.js           # RNG deterministik + matematika
    input.js            # keyboard + mouse
    audio.js            # synth WebAudio (mesin, sirene, musik)
    player.js           # Raka: jalan kaki, senjata, wanted, mobil
    vehicles.js         # fisika mobil + lalu lintas AI
    pedestrians.js      # pejalan kaki AI
    police.js           # wanted, patroli, helikopter, blokade
    combat.js           # peluru, musuh AI, ledakan, bos
    missions.js         # 5 story mission + stage
    economy.js          # 4 toko + pickup
    save.js             # save/load 3 slot
    hud.js              # HUD, minimap, dialog, toko, menu
    render.js           # render dunia + pencahayaan hari
    shots.js            # scene screenshot + autopilot playthrough
main.ts                 # program penyerahan (validasi + dossier)
serve.ts                # server statis lokal
vendor/makefun-game.ts  # pustaka dossier kit (tidak diubah)
```

## Lisensi

MIT — lihat `LICENSE`.
