// TELUK HARAPAN — main.ts (program penyerahan, Node 22, standard library only)
// Dibangun fresh untuk round 5 gta6-01. Tugas program ini:
//   1. Validasi isi repository (game/ + screenshots/ + vendor + LICENSE).
//   2. Salin game/ dan screenshots/ ke /output (atau MAKEFUN_OUTPUT_DIR).
//   3. Tulis /output/dossier.json dengan buildDossier dari vendor/makefun-game.ts.
//   4. Verifikasi hasil: batas gate (file, ukuran, screenshot) dicek ulang di sini
//      agar kesalahan ketahuan sebelum submit, bukan sesudah.
// Bukan starter kit: logika validasi, manifest, dan pemeriksaan batas di bawah
// ini ditulis oleh agen pembangun round 5 di sesi terekam.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const GAME_TITLE = 'TELUK HARAPAN';
const GAME_VERSION = '5.0.0';

// Batas gate (lihat RULES.txt / reference/gate.json).
const LIMITS = {
  gameMaxFiles: 993,
  gameMaxBytes: 48 * 1024 * 1024,
  gamePathMaxBytes: 1000,
  indexMaxBytes: 1024 * 1024,
  screenshotsMax: 4,
  screenshotMaxBytes: 256 * 1024,
  dossierMaxBytes: 1.5 * 1024 * 1024,
  textMaxBytes: 163840,
};

// --- 1. Validasi repository -------------------------------------------------
function fail(message: string): never {
  console.error(`[teluk-harapan] GAGAL: ${message}`);
  process.exit(1);
}

function checkExists(path: string, label: string): void {
  if (!existsSync(path)) fail(`${label} tidak ditemukan: ${relative(here, path)}`);
}

function walkFiles(dir: string, base: string, acc: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) fail(`game/ tidak boleh berisi symlink: ${relative(base, full)}`);
    if (entry.isDirectory()) walkFiles(full, base, acc);
    else if (entry.isFile()) acc.push(full);
    else fail(`game/ hanya boleh berisi file dan direktori biasa: ${relative(base, full)}`);
  }
  return acc;
}

function validateRepo(): { gameFiles: string[]; gameBytes: number; shots: string[] } {
  console.log(`[teluk-harapan] memvalidasi ${GAME_TITLE} v${GAME_VERSION} ...`);
  checkExists(join(here, 'game', 'index.html'), 'game/index.html');
  checkExists(join(here, 'vendor', 'makefun-game.ts'), 'vendor/makefun-game.ts');
  checkExists(join(here, 'LICENSE'), 'LICENSE');
  checkExists(join(here, 'screenshots'), 'screenshots/');

  const indexStat = statSync(join(here, 'game', 'index.html'));
  if (indexStat.size > LIMITS.indexMaxBytes) {
    fail(`game/index.html ${indexStat.size} byte melebihi batas ${LIMITS.indexMaxBytes}`);
  }

  const gameFiles = walkFiles(join(here, 'game'), here, []);
  if (gameFiles.length > LIMITS.gameMaxFiles) {
    fail(`game/ berisi ${gameFiles.length} file, melebihi batas ${LIMITS.gameMaxFiles}`);
  }
  let gameBytes = 0;
  for (const f of gameFiles) {
    const rel = relative(join(here, 'game'), f);
    if (Buffer.byteLength(rel, 'utf8') > LIMITS.gamePathMaxBytes) {
      fail(`path game/ terlalu panjang: ${rel}`);
    }
    gameBytes += statSync(f).size;
  }
  if (gameBytes > LIMITS.gameMaxBytes) {
    fail(`game/ total ${gameBytes} byte melebihi batas ${LIMITS.gameMaxBytes}`);
  }

  const shots = readdirSync(join(here, 'screenshots'))
    .filter((n) => !n.startsWith('.'))
    .sort();
  if (shots.length < 3 || shots.length > LIMITS.screenshotsMax) {
    fail(`screenshots/ berisi ${shots.length} file, harus 3-4`);
  }
  for (const name of shots) {
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name.startsWith('-') || name.startsWith('.')) {
      fail(`nama screenshot tidak valid: ${name}`);
    }
    const size = statSync(join(here, 'screenshots', name)).size;
    if (size > LIMITS.screenshotMaxBytes) {
      fail(`screenshot ${name} ${size} byte melebihi batas ${LIMITS.screenshotMaxBytes}`);
    }
    if (!/\.(png|jpg|jpeg)$/i.test(name)) fail(`screenshot harus PNG/JPEG: ${name}`);
  }

  // main.ts sendiri harus memuat logika boot game — cek kasar bahwa index.html
  // memuat modul game dan game memuat sistem inti (bukan starter kit).
  const indexHtml = readFileSync(join(here, 'game', 'index.html'), 'utf8');
  if (!indexHtml.includes('src/main.js')) fail('game/index.html tidak memuat src/main.js');
  const mainJs = readFileSync(join(here, 'game', 'src', 'main.js'), 'utf8');
  for (const needle of ['TELUK HARAPAN', 'createGame', 'updateMission', 'drawHUD']) {
    if (!mainJs.includes(needle)) fail(`game/src/main.js tidak memuat ${needle} — entrypoint belum ditulis ulang`);
  }
  console.log(`[teluk-harapan] validasi OK: ${gameFiles.length} file game (${gameBytes} byte), ${shots.length} screenshot`);
  return { gameFiles, gameBytes, shots };
}

// --- 2. Salin ke /output ------------------------------------------------------
function copyTree(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

// --- 3. Tulis dossier + manifest ----------------------------------------------
function writeDossier(): void {
  const dossier = buildDossier(out, {
    text_max_bytes: LIMITS.textMaxBytes,
    screenshots: { max: LIMITS.screenshotsMax, max_bytes: LIMITS.screenshotMaxBytes },
    game_max_files: LIMITS.gameMaxFiles,
    game_max_bytes: LIMITS.gameMaxBytes,
    game_path_max_bytes: LIMITS.gamePathMaxBytes,
  });
  writeFileSync(join(out, 'dossier.json'), dossier);
  if (Buffer.byteLength(dossier, 'utf8') > LIMITS.dossierMaxBytes) {
    fail(`dossier.json melebihi batas ${LIMITS.dossierMaxBytes} byte`);
  }
  console.log(`[teluk-harapan] dossier.json ditulis (${Buffer.byteLength(dossier, 'utf8')} byte)`);
}

// --- 4. Verifikasi hasil ---------------------------------------------------------
function verifyOutput(): void {
  const outGame = join(out, 'game');
  const outShots = join(out, 'screenshots');
  const outDossier = join(out, 'dossier.json');
  checkExists(join(outGame, 'index.html'), 'output game/index.html');
  checkExists(outDossier, 'output dossier.json');
  const shots = readdirSync(outShots).filter((n) => !n.startsWith('.'));
  if (shots.length < 3 || shots.length > LIMITS.screenshotsMax) {
    fail(`output screenshots/ berisi ${shots.length} file`);
  }
  const gameFileCount = walkFiles(outGame, out, []).length;
  console.log(`[teluk-harapan] selesai: ${gameFileCount} file game, ${shots.length} screenshot (${shots.sort().join(', ')}) -> ${out}`);
}

// --- Main -------------------------------------------------------------------------
const checked = validateRepo();
mkdirSync(out, { recursive: true });
copyTree(join(here, 'game'), join(out, 'game'));
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}
writeDossier();
verifyOutput();
console.log(`[teluk-harapan] ${GAME_TITLE} v${GAME_VERSION} siap diserahkan.`);
