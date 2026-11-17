// TELUK HARAPAN — save.js
// Simpan & muat progres (localStorage): uang, senjata, hari, misi, posisi,
// dan statistik. Versi save dicantumkan supaya save lama yang tidak cocok
// ditolak dengan bersih. Ditulis fresh untuk round 4.

import { CONFIG } from './config.js';

const SAVE_VERSION = 4;

export function saveGame(state) {
  const payload = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    day: state.day,
    missionIndex: state.missionIndex,
    missionsDone: state.missionsDone,
    money: state.economy.money,
    weapons: state.economy.weapons,
    currentWeapon: state.economy.currentWeapon,
    armor: state.economy.armor,
    health: state.economy.health,
    player: { x: state.player.x, z: state.player.z, heading: state.player.heading },
    totalEarned: state.totalEarned,
    carsStolen: state.carsStolen,
    playSeconds: state.playSeconds,
  };
  try {
    window.localStorage.setItem(CONFIG.saveKey, JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function loadGame() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(CONFIG.saveKey);
  } catch {
    return { ok: false, error: 'storage-unavailable' };
  }
  if (!raw) return { ok: false, error: 'no-save' };
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'corrupt' };
  }
  if (!data || data.version !== SAVE_VERSION) {
    return { ok: false, error: 'version-mismatch' };
  }
  return { ok: true, data };
}

export function clearSave() {
  try {
    window.localStorage.removeItem(CONFIG.saveKey);
  } catch {
    // Abaikan: penyimpanan memang tidak tersedia.
  }
}

export function hasSave() {
  try {
    return window.localStorage.getItem(CONFIG.saveKey) !== null;
  } catch {
    return false;
  }
}
