// TELUK HARAPAN — save.js
// Simpan / muat progres ke localStorage (3 slot). Menyimpan posisi, uang,
// senjata, misi yang selesai, hari, dan statistik — bukan seluruh dunia
// (dunia dibangun ulang dari seed saat muat).

import { createPlayer } from './player.js';

const KEY = 'teluk-harapan-save-';

export function saveSlotExists(slot) {
  try {
    return !!localStorage.getItem(KEY + slot);
  } catch (e) {
    return false;
  }
}

export function listSaves() {
  const out = [];
  for (let s = 1; s <= 3; s++) {
    try {
      const raw = localStorage.getItem(KEY + s);
      out.push(raw ? JSON.parse(raw) : null);
    } catch (e) {
      out.push(null);
    }
  }
  return out;
}

export function buildSaveData(G) {
  const p = G.player;
  return {
    version: 5,
    savedAt: new Date().toISOString(),
    day: p.day,
    x: Math.round(p.x),
    y: Math.round(p.y),
    hp: Math.round(p.hp),
    armor: Math.round(p.armor),
    cash: p.cash,
    weapon: p.weapon,
    owned: p.owned,
    ammo: p.ammo,
    mag: p.mag,
    reserve: p.reserve,
    medkits: p.medkits,
    missionsDone: p.missionsDone,
    completedMissions: G.mission.completed.slice(),
    kills: p.kills,
    carsStolen: p.carsStolen,
    playTime: Math.round(p.playTime),
    seed: G.seed,
  };
}

export function saveGame(G, slot) {
  try {
    const data = buildSaveData(G);
    localStorage.setItem(KEY + slot, JSON.stringify(data));
    G.audio.sfx.save();
    G.addToast('Permainan disimpan (slot ' + slot + ').');
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(G, slot) {
  let data = null;
  try {
    const raw = localStorage.getItem(KEY + slot);
    if (!raw) return null;
    data = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  if (!data || data.version !== 5) return null;
  const p = G.player;
  p.day = data.day || 1;
  p.x = data.x;
  p.y = data.y;
  p.hp = data.hp;
  p.armor = data.armor;
  p.cash = data.cash;
  p.weapon = data.weapon || 'fist';
  p.owned = { fist: true, ...(data.owned || {}) };
  p.ammo = data.ammo || p.ammo;
  p.mag = data.mag || p.mag;
  p.reserve = data.reserve || p.reserve;
  p.medkits = data.medkits || 0;
  p.missionsDone = data.missionsDone || 0;
  p.kills = data.kills || 0;
  p.carsStolen = data.carsStolen || 0;
  p.playTime = data.playTime || 0;
  p.wanted = 0;
  p.wantedHeat = 0;
  G.mission.completed = (data.completedMissions || []).slice();
  G.setDay(p.day);
  G.addToast('Save dimuat — Hari ' + p.day + ', ' + (data.completedMissions || []).length + ' misi selesai.');
  return data;
}

export function deleteSave(slot) {
  try {
    localStorage.removeItem(KEY + slot);
    return true;
  } catch (e) {
    return false;
  }
}

// Ringkasan save untuk layar judul.
export function saveSummary(slot) {
  try {
    const raw = localStorage.getItem(KEY + slot);
    if (!raw) return null;
    const d = JSON.parse(raw);
    const date = new Date(d.savedAt);
    return {
      slot,
      day: d.day,
      missions: (d.completedMissions || []).length,
      cash: d.cash,
      when: date.toLocaleDateString('id-ID') + ' ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch (e) {
    return null;
  }
}
