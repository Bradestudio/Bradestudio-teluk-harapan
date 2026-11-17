// TELUK HARAPAN — economy.js
// Uang, inventaris senjata, dan toko: Bengkel (perbaiki), Toko Senjata (beli
// senjata & amunisi & rompi), Klinik (obat), Rumah Aman (simpan & tidur).
// Semua transaksi mengubah state pemain dan mengembalikan pesan hasil.
// Ditulis fresh untuk round 4.

import { CONFIG } from './config.js';

export class Economy {
  constructor() {
    this.money = CONFIG.player.startMoney;
    this.weapons = {
      fists: { owned: true, ammo: Infinity },
    };
    this.currentWeapon = 'fists';
    this.armor = 0;
    this.health = CONFIG.player.health;
    this._log = [];
  }

  log(message) {
    this._log.push(message);
    if (this._log.length > 6) this._log.shift();
  }

  recentLog() {
    return this._log.slice();
  }

  earn(amount, reason) {
    this.money += amount;
    this.log(`+$${amount} — ${reason}`);
    return this.money;
  }

  spend(amount, reason) {
    if (this.money < amount) return false;
    this.money -= amount;
    this.log(`-$${amount} — ${reason}`);
    return true;
  }

  giveWeapon(id) {
    const spec = CONFIG.weapons[id];
    if (!spec) return false;
    if (!this.weapons[id]) {
      this.weapons[id] = { owned: true, ammo: spec.ammo };
    } else {
      this.weapons[id].ammo += spec.ammo;
    }
    this.log(`${spec.name} didapat.`);
    return true;
  }

  hasWeapon(id) {
    return !!(this.weapons[id] && this.weapons[id].owned);
  }

  ammoFor(id) {
    const w = this.weapons[id];
    return w ? w.ammo : 0;
  }

  currentSpec() {
    return CONFIG.weapons[this.currentWeapon];
  }

  switchWeapon() {
    const owned = Object.keys(this.weapons).filter((id) => this.weapons[id].owned);
    if (owned.length <= 1) return this.currentWeapon;
    const idx = owned.indexOf(this.currentWeapon);
    this.currentWeapon = owned[(idx + 1) % owned.length];
    this.log(`Senjata: ${CONFIG.weapons[this.currentWeapon].name}`);
    return this.currentWeapon;
  }

  useAmmo() {
    const w = this.weapons[this.currentWeapon];
    if (!w) return false;
    if (w.ammo === Infinity) return true;
    if (w.ammo <= 0) return false;
    w.ammo -= 1;
    return true;
  }

  needReload() {
    const w = this.weapons[this.currentWeapon];
    return w && w.ammo !== Infinity && w.ammo <= 0;
  }

  buyAmmo() {
    const id = this.currentWeapon;
    if (id === 'fists') return { ok: false, msg: 'Tangan kosong tidak butuh amunisi.' };
    if (!this.weapons[id]) return { ok: false, msg: 'Senjata itu belum dimiliki.' };
    const spec = CONFIG.weapons[id];
    const price = spec.ammoPrice;
    if (this.money < price) return { ok: false, msg: 'Uang tidak cukup.' };
    this.money -= price;
    this.weapons[id].ammo += spec.ammo;
    return { ok: true, msg: `Amunisi ${spec.name} +${spec.ammo} (-$${price}).` };
  }

  /** Daftar barang toko berdasarkan jenisnya; tiap item {id, name, price, can, buy}. */
  shopItems(kind) {
    const items = [];
    if (kind === 'repair') {
      items.push(
        { id: 'repair', name: 'Perbaiki mobil', price: CONFIG.prices.repair, desc: 'Mobil kembali 100%' },
        { id: 'armorCar', name: 'Lapis baja mobil', price: 120, desc: 'Mobil tahan 2x tabrakan' },
      );
    } else if (kind === 'weapons') {
      if (!this.hasWeapon('pistol')) {
        items.push({ id: 'buyPistol', name: 'Pistol', price: CONFIG.weapons.pistol.price, desc: 'Damage 22, 12 peluru' });
      }
      if (!this.hasWeapon('smg')) {
        items.push({ id: 'buySmg', name: 'SMG', price: CONFIG.weapons.smg.price, desc: 'Damage 14, otomatis, 32 peluru' });
      }
      items.push(
        { id: 'ammo', name: 'Amunisi senjata aktif', price: CONFIG.weapons[this.currentWeapon].ammoPrice || 20, desc: 'Isi ulang magasin' },
        { id: 'vest', name: 'Rompi antipeluru', price: CONFIG.prices.armorPlate, desc: '+50 armor' },
      );
    } else if (kind === 'clinic') {
      items.push(
        { id: 'heal', name: 'Obat luka', price: CONFIG.prices.heal, desc: '+50 darah' },
        { id: 'fullHeal', name: 'Rawat penuh', price: CONFIG.prices.fullHeal, desc: 'Darah penuh' },
      );
    } else if (kind === 'safehouse') {
      items.push(
        { id: 'save', name: 'Simpan game', price: 0, desc: 'Simpan progres ke browser' },
        { id: 'sleep', name: 'Tidur sampai pagi', price: 0, desc: 'Lanjut ke hari berikutnya' },
      );
    }
    return items;
  }

  /** Beli item toko; kembalikan {ok, msg}. `hooks` menyediakan aksi dunia. */
  buy(itemId, hooks) {
    switch (itemId) {
      case 'repair': {
        if (this.money < CONFIG.prices.repair) return { ok: false, msg: 'Uang tidak cukup.' };
        this.money -= CONFIG.prices.repair;
        if (hooks && hooks.repairCar) hooks.repairCar();
        return { ok: true, msg: 'Mobil diperbaiki.' };
      }
      case 'armorCar': {
        if (this.money < 120) return { ok: false, msg: 'Uang tidak cukup.' };
        this.money -= 120;
        if (hooks && hooks.armorCar) hooks.armorCar();
        return { ok: true, msg: 'Mobil dilapis baja.' };
      }
      case 'buyPistol': {
        if (this.hasWeapon('pistol')) return { ok: false, msg: 'Sudah punya pistol.' };
        if (this.money < CONFIG.weapons.pistol.price) return { ok: false, msg: 'Uang tidak cukup.' };
        this.money -= CONFIG.weapons.pistol.price;
        this.giveWeapon('pistol');
        return { ok: true, msg: 'Pistol dibeli.' };
      }
      case 'buySmg': {
        if (this.hasWeapon('smg')) return { ok: false, msg: 'Sudah punya SMG.' };
        if (this.money < CONFIG.weapons.smg.price) return { ok: false, msg: 'Uang tidak cukup.' };
        this.money -= CONFIG.weapons.smg.price;
        this.giveWeapon('smg');
        return { ok: true, msg: 'SMG dibeli.' };
      }
      case 'ammo': {
        return this.buyAmmo();
      }
      case 'vest': {
        if (this.money < CONFIG.prices.armorPlate) return { ok: false, msg: 'Uang tidak cukup.' };
        this.money -= CONFIG.prices.armorPlate;
        this.armor = Math.min(100, this.armor + 50);
        return { ok: true, msg: 'Rompi dipakai. Armor +50.' };
      }
      case 'heal': {
        if (this.money < CONFIG.prices.heal) return { ok: false, msg: 'Uang tidak cukup.' };
        this.money -= CONFIG.prices.heal;
        this.health = Math.min(CONFIG.player.health, this.health + 50);
        return { ok: true, msg: 'Luka diobati. +50 darah.' };
      }
      case 'fullHeal': {
        if (this.money < CONFIG.prices.fullHeal) return { ok: false, msg: 'Uang tidak cukup.' };
        this.money -= CONFIG.prices.fullHeal;
        this.health = CONFIG.player.health;
        return { ok: true, msg: 'Darah penuh.' };
      }
      case 'save': {
        if (hooks && hooks.saveGame) hooks.saveGame();
        return { ok: true, msg: 'Game disimpan.' };
      }
      case 'sleep': {
        if (hooks && hooks.sleep) hooks.sleep();
        return { ok: true, msg: 'Tidur... hari baru dimulai.' };
      }
      default:
        return { ok: false, msg: 'Barang tidak dikenal.' };
    }
  }

  /** Kerusakan masuk: armor menyerap dulu, baru darah. */
  damage(amount) {
    let rest = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rest);
      this.armor -= absorbed;
      rest -= absorbed;
    }
    this.health -= rest;
    return this.health;
  }

  get alive() {
    return this.health > 0;
  }

  snapshot() {
    return {
      money: this.money,
      weapons: this.weapons,
      currentWeapon: this.currentWeapon,
      armor: this.armor,
      health: this.health,
    };
  }

  restore(snap) {
    this.money = snap.money ?? CONFIG.player.startMoney;
    this.weapons = snap.weapons ?? { fists: { owned: true, ammo: Infinity } };
    this.currentWeapon = snap.currentWeapon || 'fists';
    this.armor = snap.armor ?? 0;
    this.health = snap.health ?? CONFIG.player.health;
  }
}
