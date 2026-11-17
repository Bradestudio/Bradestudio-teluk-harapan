# TRANSCRIPT — TELUK HARAPAN (gta6-01)

Entry ini dibangun seluruhnya di dalam sesi agent yang terekam untuk kompetisi ini
(`makefun record --competition gta6-01`, dimulai sebelum satu baris kode pun ditulis).
Tidak ada kode yang disalin dari proyek lain: semua file di `game/src/` ditulis fresh
di sesi terekam dari spesifikasi game di bawah, dan `main.ts` ditulis ulang di sesi
yang sama. Satu-satunya kode pihak ketiga adalah three.js r152.2 (UMD, vendored
sebagai `game/vendor/three.min.js`) dan library `vendor/makefun-game.ts` dari kit.

## Game yang dibangun

TELUK HARAPAN — open-world crime 3D original (three.js, static files, tanpa build step):

- Kota 480×480 dengan 5 distrik (Pelabuhan, Pasar Lama, Menara Kaca/CBD, Perumahan
  Bukit, Pantai Senja), jalan grid, trotoar, taman, plaza, pantai + laut, gedung
  dengan tekstur jendela hasil generate, kontainer, kios pasar, dan pepohonan.
- Jalan kaki + nyetir (fisika arcade: akselerasi, rem, setir), traffic AI (16 mobil
  yang belok di persimpangan dan berhenti untuk mobil/pejalan kaki di depan),
  22 pejalan kaki AI, mobil parkir yang bisa dicuri.
- Wanted level 1–5 bintang: curi mobil, pukul/bunuh pejalan kaki, dan menembak
  menaikkan bintang; polisi AI mengejar dan menabrak; bintang turun saat bersembunyi.
- Combat: tinju (Spasi) dan pistol (klik kanan, amunisi bisa dibeli), musuh AI
  (anak buah + bos Bang Darto) yang mengejar dan memukul.
- 5 misi cerita berurutan (antar paket, curi mobil, kabur dari polisi, rampok toko,
  jebakan terakhir) + side job taksi dan kurir, ekonomi uang, klinik (nyawa) dan
  toko amunisi, save/load localStorage, HUD (uang, nyawa, bintang, misi + jarak,
  kecepatan) + minimap canvas, layar awal/jeda/game over/menang.
- Suara/musik WebAudio synth sendiri (mesin, sirene, pukulan, tembakan, musik chord).

## Screenshot

4 screenshot deterministik (seed 1, 1280×720), diambil dari game yang sama via
`serve.ts` + chrome-headless-shell, distaging oleh `game/src/shots.js` yang
memainkan aturan asli ke depan dengan autopilot:

1. `1-start.jpg` — layar judul di atas kota senja (kamera orbit).
2. `2-play.jpg` — Raka jalan kaki di Pelabuhan setelah menyelesaikan Misi 1.
3. `3-chase.jpg` — nyetir dikejar polisi (wanted 5) di Menara Kaca, 115 km/j.
4. `4-mission.jpg` — Misi 5 di Pelabuhan, di bawah beacon misi, melawan anak buah Darto.

## File

- `game/index.html` — canvas + HUD + overlay layar.
- `game/src/` — `config.js` (tuning/misi), `random.js` (mulberry32),
  `input.js` (keyboard/mouse/pointer-lock), `audio.js` (WebAudio synth),
  `world.js` (kota, pemain, mobil, traffic, polisi, misi, combat, ekonomi),
  `render.js` (three.js, kamera, HUD, minimap), `shots.js` (staging screenshot),
  `main.js` (loop fixed-step, save/load, mode `?shot=`).
- `game/vendor/three.min.js` — three.js r152.2 UMD.
- `main.ts` — entrypoint: salin `game/` + `screenshots/` ke /output, tulis dossier.
- `serve.ts` — server statis lokal untuk development.
- `shots.json` — daftar scene screenshot.
