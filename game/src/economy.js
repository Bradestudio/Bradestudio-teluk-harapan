// TELUK HARAPAN — economy.js
// Empat toko yang semuanya berfungsi: Bengkel Jaya (perbaiki & upgrade mobil),
// Sinar Senjata (senjata & amunisi), Rumah Aman (simpan & istirahat),
// Klinik Sehat (obat & P3K). Transaksi lewat shopOpen di G.

import { WEAPONS, SHOPS } from './config.js';
import { spendCash, addCash, healPlayer } from './player.js';

export function shopById(id) {
  return SHOPS.find((s) => s.id === id);
}

// Beli satu item toko. Kembalikan { ok, message }.
export function buyItem(G, shop, itemId) {
  const p = G.player;
  const item = shop.stock.find((i) => i.id === itemId);
  if (!item) return { ok: false, message: 'Barang tidak dikenal.' };
  if (item.price > 0 && p.cash < item.price) {
    G.audio.sfx.denied();
    return { ok: false, message: 'Uang tidak cukup. Perlu Rp ' + item.price + ', kamu punya Rp ' + p.cash + '.' };
  }

  switch (itemId) {
    case 'repair': {
      const car = p.inCar;
      if (!car) return { ok: false, message: 'Bawa mobilmu ke sini dulu — kamu sedang jalan kaki.' };
      if (car.hp >= car.maxHp) return { ok: false, message: 'Mobilmu sudah dalam kondisi sempurna.' };
      spendCash(G, item.price);
      car.hp = car.maxHp;
      car.crashed = false;
      G.audio.sfx.save();
      return { ok: true, message: 'Mobil diperbaiki penuh. Siap ngebut lagi!' };
    }
    case 'armor_car': {
      const car = p.inCar;
      if (!car) return { ok: false, message: 'Bawa mobilmu ke sini dulu.' };
      if (car.maxHp > car.model.hp + 40) return { ok: false, message: 'Mobil ini sudah berpelindung baja.' };
      spendCash(G, item.price);
      car.maxHp += 80;
      car.hp += 80;
      G.audio.sfx.save();
      return { ok: true, message: 'Pelindung baja terpasang. Mobil +80 HP.' };
    }
    case 'paint': {
      const car = p.inCar;
      if (!car) return { ok: false, message: 'Bawa mobilmu ke sini dulu.' };
      spendCash(G, item.price);
      const colors = ['#c93a3a', '#4a7fb5', '#7fb069', '#e8c832', '#8a6a9a', '#2fa08a', '#3a3a3a'];
      car.color = colors[Math.floor(Math.random() * colors.length)];
      p.wantedHeat = Math.max(0, p.wantedHeat - 15);
      G.audio.sfx.save();
      return { ok: true, message: 'Cat baru! Polisi lebih lambat mengenalimu (wanted -15).' };
    }
    case 'nitro': {
      const car = p.inCar;
      if (!car) return { ok: false, message: 'Bawa mobilmu ke sini dulu.' };
      if (car.nitro) return { ok: false, message: 'Mobil ini sudah punya nitro.' };
      spendCash(G, item.price);
      car.nitro = true;
      car.nitroFuel = 100;
      G.audio.sfx.save();
      return { ok: true, message: 'Nitro terpasang! Tahan Shift saat mengemudi.' };
    }
    case 'buy_pistol':
    case 'buy_smg':
    case 'buy_shotgun': {
      const wid = itemId.replace('buy_', '');
      if (p.owned[wid]) return { ok: false, message: 'Kamu sudah punya ' + WEAPONS[wid].name + '.' };
      spendCash(G, item.price);
      p.owned[wid] = true;
      p.reserve[wid] += WEAPONS[wid].mag;
      p.weapon = wid;
      G.audio.sfx.save();
      return { ok: true, message: WEAPONS[wid].name + ' dibeli! Tekan 2/3/4 untuk memakainya.' };
    }
    case 'ammo_pistol':
    case 'ammo_smg':
    case 'ammo_shotgun': {
      const wid = itemId.replace('ammo_', '');
      if (!p.owned[wid]) return { ok: false, message: 'Beli dulu senjatanya (' + WEAPONS[wid].name + ').' };
      spendCash(G, item.price);
      const qty = wid === 'pistol' ? 24 : wid === 'smg' ? 60 : 12;
      p.reserve[wid] += qty;
      G.audio.sfx.pickup();
      return { ok: true, message: '+' + qty + ' peluru ' + WEAPONS[wid].name + '.' };
    }
    case 'vest': {
      if (p.armor >= p.maxArmor) return { ok: false, message: 'Rompi sudah penuh.' };
      spendCash(G, item.price);
      p.armor = Math.min(p.maxArmor, p.armor + 50);
      G.audio.sfx.save();
      return { ok: true, message: 'Rompi dipakai. Armor +50.' };
    }
    case 'save': {
      const ok = G.saveGame(1);
      return ok
        ? { ok: true, message: 'Permainan disimpan ke slot 1.' }
        : { ok: false, message: 'Gagal menyimpan (penyimpanan browser tidak tersedia).' };
    }
    case 'rest': {
      spendCash(G, item.price);
      p.hp = p.maxHp;
      p.wantedHeat = Math.max(0, p.wantedHeat - 20);
      p.wanted = p.wantedHeat <= 0 ? 0 : p.wanted;
      G.audio.sfx.heal();
      return { ok: true, message: 'Kau beristirahat. HP penuh, wanted berkurang.' };
    }
    case 'stash': {
      if (G.stashTakenToday) return { ok: false, message: 'Simpanan hari ini sudah diambil. Kembali besok.' };
      G.stashTakenToday = true;
      addCash(G, 200, 'Uang simpanan');
      return { ok: true, message: 'Rp 200 diambil dari simpanan.' };
    }
    case 'heal': {
      if (p.hp >= p.maxHp) return { ok: false, message: 'HP-mu sudah penuh.' };
      spendCash(G, item.price);
      healPlayer(G, p.maxHp - p.hp);
      return { ok: true, message: 'Perawatan selesai. HP penuh.' };
    }
    case 'bandage': {
      if (p.hp >= p.maxHp) return { ok: false, message: 'HP-mu sudah penuh.' };
      spendCash(G, item.price);
      healPlayer(G, 40);
      return { ok: true, message: 'Perban dipasang. HP +40.' };
    }
    case 'medkit': {
      if (p.medkits >= 5) return { ok: false, message: 'Kantongmu sudah penuh (maks 5 kotak P3K).' };
      spendCash(G, item.price);
      p.medkits++;
      G.audio.sfx.pickup();
      return { ok: true, message: 'Kotak P3K masuk kantong. Tekan H untuk memakai.' };
    }
    default:
      return { ok: false, message: 'Barang belum tersedia.' };
  }
}

// Uang receh di jalan: koin yang bisa diambil.
export function spawnCashPickup(G, x, y, amount) {
  G.pickups.push({ kind: 'cash', x, y, amount, label: 'Rp ' + amount });
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (const pk of G.pickups) {
    pk.bob = (pk.bob || 0) + dt * 3;
    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    if (d < 36) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        addCash(G, pk.amount, 'Uang ditemukan');
        // Beri tahu misi (dipakai stage ambil uang).
        if (G.missionEvent) G.missionEvent('pickupCash', pk);
      } else if (pk.kind === 'health') {
        healPlayer(G, 30);
      } else if (pk.kind === 'ammo') {
        p.reserve.pistol = (p.reserve.pistol || 0) + 12;
        G.addToast('+12 amunisi pistol.');
      }
    }
  }
  G.pickups = G.pickups.filter((pk) => !pk.taken);
}
