// TELUK HARAPAN — player.js
// Raka: berjalan kaki, bertarung, menembak, masuk-keluar mobil, dan semua
// statusnya (HP, armor, uang, wanted, senjata, amunisi).

import { WEAPONS, WANTED_LINES } from './config.js';
import { clamp, angleTo, angleDiff, dist } from './random.js';
import { collideCircleBuildings, clampToWorld, nearestShop } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    vx: 0, vy: 0,
    radius: 14,
    hp: 100,
    maxHp: 100,
    armor: 0,
    maxArmor: 100,
    cash: 250,
    wanted: 0,
    wantedHeat: 0, // 0..100, naik saat kejahatan terlihat
    inCar: null, // referensi mobil yang dikendarai
    weapon: 'pistol',
    owned: { fist: true, pistol: true, smg: false, shotgun: false },
    ammo: { pistol: 0, smg: 0, shotgun: 0 },
    mag: { pistol: 12, smg: 30, shotgun: 6 },
    reserve: { pistol: 300, smg: 0, shotgun: 0 },
    medkits: 3,
    nitro: false, // tabung nitro terpasang di mobil aktif
    nitroFuel: 100,
    punchCooldown: 0,
    shootCooldown: 0,
    hurtFlash: 0,
    walkCycle: 0,
    moving: false,
    stealth: false,
    kills: 0,
    carsStolen: 0,
    missionsDone: 0,
    day: 1,
    playTime: 0,
  };
}

export function playerSpeed(p) {
  return Math.sqrt(p.vx * p.vx + p.vy * p.vy);
}

// Kerusakan masuk: armor menyerap 70% dulu.
export function damagePlayer(G, amount, source) {
  const p = G.player;
  if (p.hp <= 0) return;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left * 0.7);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.hp -= left;
  p.hurtFlash = 1;
  G.audio.sfx.hit();
  G.addFloatingText(p.x, p.y - 24, `-${Math.round(amount)}`, '#ff5a5a');
  if (p.hp <= 0) {
    p.hp = 0;
    G.state = 'gameover';
    G.audio.sfx.fail();
    G.audio.setEngine(0, false);
    G.audio.setSiren(false);
  }
}

export function healPlayer(G, amount) {
  const p = G.player;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  G.audio.sfx.heal();
  G.addFloatingText(p.x, p.y - 24, `+${Math.round(amount)} HP`, '#7be495');
}

export function addCash(G, amount, why) {
  const p = G.player;
  p.cash += amount;
  G.audio.sfx.cash();
  G.addFloatingText(p.x, p.y - 30, (amount > 0 ? '+' : '') + 'Rp ' + amount, amount > 0 ? '#ffd24a' : '#ff8a5a');
  if (why) G.addToast(why + ' — Rp ' + Math.abs(amount));
}

export function spendCash(G, amount) {
  if (G.player.cash < amount) return false;
  G.player.cash -= amount;
  return true;
}

// Wanted naik saat kejahatan terlihat polisi / saksi.
export function raiseWanted(G, amount, reason) {
  const p = G.player;
  const before = p.wanted;
  p.wantedHeat = clamp(p.wantedHeat + amount, 0, 100);
  const level = p.wantedHeat <= 0 ? 0
    : p.wantedHeat < 20 ? 1
    : p.wantedHeat < 40 ? 2
    : p.wantedHeat < 60 ? 3
    : p.wantedHeat < 85 ? 4 : 5;
  if (level > before) {
    p.wanted = level;
    G.audio.sfx.wanted();
    G.audio.sfx.radio();
    G.addToast(WANTED_LINES[level] || 'Polisi mengejarmu!');
    G.addFloatingText(p.x, p.y - 34, 'WANTED ' + level + '★', '#ff5a5a');
  } else {
    p.wanted = level;
  }
  if (reason) G.lastCrime = reason;
}

export function lowerWanted(G, amount) {
  const p = G.player;
  p.wantedHeat = clamp(p.wantedHeat - amount, 0, 100);
  p.wanted = p.wantedHeat <= 0 ? 0
    : p.wantedHeat < 20 ? 1
    : p.wantedHeat < 40 ? 2
    : p.wantedHeat < 60 ? 3
    : p.wantedHeat < 85 ? 4 : 5;
}

// Arah bidik: ke arah mouse (dunia).
export function aimAngle(G) {
  const p = G.player;
  const inp = G.input;
  return angleTo(p.x, p.y, inp.mouse.worldX, inp.mouse.worldY);
}

export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const inp = G.input;
  const ax = inp.axisX();
  const ay = inp.axisY();
  const speed = 175;
  const tx = ax * speed;
  const ty = ay * speed;
  p.vx += (tx - p.vx) * Math.min(1, dt * 10);
  p.vy += (ty - p.vy) * Math.min(1, dt * 10);
  p.moving = Math.abs(p.vx) + Math.abs(p.vy) > 12;
  if (p.moving) p.walkCycle += dt * 9;

  let nx = p.x + p.vx * dt;
  let ny = p.y + p.vy * dt;
  const hit = collideCircleBuildings(nx, ny, p.radius, G.world.buildings);
  if (hit) { nx = hit.x; ny = hit.y; p.vx *= 0.4; p.vy *= 0.4; }
  const cl = clampToWorld(nx, ny);
  p.x = cl.x;
  p.y = cl.y;

  // Arah hadap mengikuti mouse saat bersenjata, gerakan saat tinju.
  if (p.weapon !== 'fist' && dist(inp.mouse.worldX, inp.mouse.worldY, p.x, p.y) > 30) {
    p.angle = aimAngle(G);
  } else if (p.moving) {
    p.angle = angleTo(0, 0, p.vx, p.vy);
  }

  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 3);

  // Pukul.
  if (inp.wasPressed('F') && p.punchCooldown <= 0) {
    punch(G);
  }
  // Tembak.
  const w = WEAPONS[p.weapon];
  if (w && w.id !== 'fist') {
    const wantFire = w.auto ? inp.mouse.down : inp.mouse.clicked;
    if (wantFire && p.shootCooldown <= 0) shootWeapon(G, w);
  }
  // Isi ulang.
  if (inp.wasPressed('R')) reloadWeapon(G);
  // Kotak P3K.
  if (inp.wasPressed('H') && p.medkits > 0 && p.hp < p.maxHp) {
    p.medkits--;
    healPlayer(G, 70);
    G.addToast('Kotak P3K dipakai. Sisa: ' + p.medkits);
  }
  // Ganti senjata.
  for (const [key, id] of [['1', 'fist'], ['2', 'pistol'], ['3', 'smg'], ['4', 'shotgun']]) {
    if (inp.wasPressed(key) && p.owned[id]) {
      p.weapon = id;
      G.audio.sfx.click();
    }
  }
}

export function punch(G) {
  const p = G.player;
  p.punchCooldown = WEAPONS.fist.rate;
  G.audio.sfx.punch();
  const range = WEAPONS.fist.range;
  const ax = p.x + Math.cos(p.angle) * range * 0.7;
  const ay = p.y + Math.sin(p.angle) * range * 0.7;
  G.addParticles(ax, ay, 6, '#e8d8b0', 90);
  // Kena musuh?
  for (const e of G.enemies) {
    if (e.hp > 0 && dist(ax, ay, e.x, e.y) < 34) {
      damageEnemy(G, e, WEAPONS.fist.damage, 'punch');
    }
  }
  // Kena pejalan kaki? Itu kejahatan — wanted naik.
  for (const ped of G.peds) {
    if (!ped.fleeing && dist(ax, ay, ped.x, ped.y) < 30) {
      ped.fleeing = true;
      ped.fleeTimer = 3;
      raiseWanted(G, 8, 'menyerang warga');
    }
  }
}

export function shootWeapon(G, w) {
  const p = G.player;
  if (p.mag[w.id] <= 0) {
    G.audio.sfx.denied();
    reloadWeapon(G);
    return;
  }
  p.mag[w.id]--;
  p.shootCooldown = w.rate;
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const spread = (Math.random() - 0.5) * 2 * w.spread;
    const a = p.angle + spread;
    const bx = p.x + Math.cos(p.angle) * 22;
    const by = p.y + Math.sin(p.angle) * 22;
    G.bullets.push({
      x: bx, y: by, angle: a, speed: w.speed,
      damage: w.damage, from: 'player', life: w.range / w.speed,
      color: '#ffd24a',
    });
  }
  if (w.id === 'shotgun') G.audio.sfx.shotgun();
  else G.audio.sfx.shoot();
  // Suara tembakan menarik polisi — sekali per 3 detik, bukan per peluru
  // (kalau tidak, satu tembakan beruntun langsung wanted 5).
  if (G.timeNow - (G.lastShotWanted || 0) > 3) {
    G.lastShotWanted = G.timeNow;
    raiseWanted(G, 3, 'tembakan');
  }
  p.vx -= Math.cos(p.angle) * 14;
  p.vy -= Math.sin(p.angle) * 14;
}

export function reloadWeapon(G) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  if (!w || w.id === 'fist') return;
  const need = w.mag - p.mag[w.id];
  if (need <= 0 || p.reserve[w.id] <= 0) {
    if (p.reserve[w.id] <= 0) G.addToast('Amunisi habis — beli di Toko Senjata.');
    return;
  }
  const take = Math.min(need, p.reserve[w.id]);
  p.reserve[w.id] -= take;
  p.mag[w.id] += take;
  G.audio.sfx.click();
  G.addToast(w.name + ' diisi ulang (' + p.mag[w.id] + '/' + w.mag + ').');
}

// Musuh (anak buah Darma / polisi jalan kaki) menerima damage.
export function damageEnemy(G, e, amount, kind) {
  e.hp -= amount;
  e.flash = 1;
  G.addParticles(e.x, e.y, 5, '#ff5a5a', 120);
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    e.deathTimer = 0;
    G.player.kills++;
    G.addParticles(e.x, e.y, 22, '#c93a3a', 200);
    G.audio.sfx.hit();
    if (e.dropsCash) {
      addCash(G, e.dropsCash, 'Uang dari ' + (e.name || 'musuh'));
    }
    // Musuh misi menjatuhkan amunisi — ambil dengan berjalan di atasnya.
    if (e.mission) {
      G.pickups.push({ kind: 'ammo', x: e.x, y: e.y, amount: 12, label: '+12 Amunisi' });
    }
    if (e.isBoss) {
      G.missionEvent('bossDown', e);
    }
  }
}

// Masuk mobil terdekat (E).
// Masuk ke mobil tertentu (dipakai stage curi: becak/taksi misi, bukan
// mobil terdekat yang kebetulan diparkir di sampingnya).
export function enterCar(G, car) {
  const p = G.player;
  p.inCar = car;
  car.driver = 'player';
  car.ai = null;
  if (!car.owned) {
    car.owned = true;
    p.carsStolen++;
    raiseWanted(G, 6, 'mencuri mobil');
    G.addToast('Mobil dicuri! ' + car.model.name);
  } else {
    G.addToast('Masuk mobil: ' + car.model.name);
  }
  G.audio.sfx.door();
  p.x = car.x;
  p.y = car.y;
  return true;
}

export function tryEnterCar(G) {
  const p = G.player;
  let best = null;
  let bd = 90;
  for (const car of G.cars) {
    if (car.isPolice && car.driver) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  if (!best) return false;
  return enterCar(G, best);
}

// Keluar mobil (E saat di mobil).
export function exitCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  const hit = collideCircleBuildings(p.x, p.y, p.radius, G.world.buildings);
  if (hit) { p.x = hit.x; p.y = hit.y; }
  car.driver = null;
  car.speed = 0;
  p.inCar = null;
  G.audio.sfx.door();
}

// Interaksi toko / NPC terdekat (E saat jalan kaki dan tidak ada mobil).
export function tryInteract(G) {
  const p = G.player;
  // Toko dulu.
  const { shop, d } = nearestShop(p.x, p.y);
  if (shop && d < 110) {
    G.shopOpen = shop;
    G.audio.sfx.click();
    return 'shop';
  }
  // NPC misi terdekat.
  for (const npc of G.npcs) {
    if (npc.talk && dist(p.x, p.y, npc.x, npc.y) < 70) {
      npc.talk(G);
      return 'npc';
    }
  }
  return tryEnterCar(G) ? 'car' : null;
}
