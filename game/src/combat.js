// TELUK HARAPAN — combat.js
// Peluru, ledakan, musuh AI (anak buah Darma), dan pertempuran bos.
// Musuh mengejar, menembak, berlindung; polisi jalan kaki menangkap.

import { dist, angleTo, angleDiff, clamp } from './random.js';
import { damagePlayer, damageEnemy, raiseWanted } from './player.js';
import { collideCircleBuildings } from './world.js';
import { damageCar } from './vehicles.js';

let enemyIdCounter = 1;

export function makeEnemy(G, x, y, opts = {}) {
  return {
    id: enemyIdCounter++,
    name: opts.name || 'Anak Buah Darma',
    x, y,
    angle: 0,
    hp: opts.hp || 60,
    maxHp: opts.hp || 60,
    speed: opts.speed || 95,
    weapon: opts.weapon || 'pistol',
    damage: opts.damage || 8,
    range: opts.range || 380,
    shootTimer: opts.shootTimer || 1,
    state: 'idle', // idle | chase | shoot | cover | dead
    stateTimer: 0,
    flash: 0,
    dead: false,
    deathTimer: 0,
    dropsCash: opts.dropsCash || 0,
    isBoss: !!opts.isBoss,
    isCop: !!opts.isCop,
    cover: null,
    color: opts.isCop ? '#2a4a8a' : '#3a3a3a',
    shirt: opts.isCop ? '#2a4a8a' : '#5a2a2a',
  };
}

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    // Kena bangunan?
    let hitWall = false;
    for (const bd of G.world.buildings) {
      if (b.x >= bd.x && b.x <= bd.x + bd.w && b.y >= bd.y && b.y <= bd.y + bd.h) {
        hitWall = true;
        break;
      }
    }
    if (hitWall) {
      b.life = 0;
      G.addParticles(b.x, b.y, 3, '#c9c9c9', 90);
      continue;
    }
    if (b.life <= 0) continue;
    if (b.from === 'player') {
      // Kena musuh?
      for (const e of G.enemies) {
        if (e.hp > 0 && dist(b.x, b.y, e.x, e.y) < 18) {
          damageEnemy(G, e, b.damage, 'bullet');
          b.life = 0;
          break;
        }
      }
      if (b.life <= 0) continue;
      // Kena mobil? Tembakan merusak mobil (penting untuk misi konvoi).
      for (const car of G.cars) {
        if (car.crashed) continue;
        if (dist(b.x, b.y, car.x, car.y) < 26) {
          if (car.isPolice) raiseWanted(G, 5, 'menembak polisi');
          damageCar(G, car, b.damage);
          b.life = 0;
          G.addParticles(b.x, b.y, 4, '#ffd24a', 120);
          break;
        }
      }
    } else {
      // Peluru musuh kena pemain.
      const p = G.player;
      if (p.hp > 0) {
        const pr = p.inCar ? 26 : 14;
        if (dist(b.x, b.y, p.x, p.y) < pr) {
          if (p.inCar) {
            // Tembakan ke mobil: rusak mobil dulu.
            const car = p.inCar;
            car.hp -= b.damage * 0.25;
            if (car.hp <= 0) {
              // Mobil meledak — panggil lewat damageCar di vehicles.
              car.hp = 0;
              car.crashed = true;
              G.addParticles(car.x, car.y, 24, '#ff8a3a', 240);
              G.audio.sfx.explosion();
              G.player.inCar = null;
              car.driver = null;
              G.player.x = car.x + 40;
              G.player.y = car.y + 40;
            }
          } else {
            damagePlayer(G, b.damage, 'tembakan');
          }
          b.life = 0;
        }
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0 && b.x > -50 && b.x < 3650 && b.y > -50 && b.y < 2650);
}

export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) {
      e.deathTimer += dt;
      continue;
    }
    e.flash = Math.max(0, e.flash - dt * 4);
    e.shootTimer -= dt;
    e.stateTimer -= dt;
    const d = dist(e.x, e.y, p.x, p.y);
    const seePlayer = d < e.range && p.hp > 0;

    if (e.state === 'idle') {
      if (seePlayer) {
        e.state = 'chase';
        e.stateTimer = 6;
      }
    } else if (e.state === 'chase') {
      // Kejar pemain sampai jarak tembak, lalu tembak.
      if (d > e.range * 0.55) {
        const a = angleTo(e.x, e.y, p.x, p.y);
        e.angle = a;
        e.x += Math.cos(a) * e.speed * dt;
        e.y += Math.sin(a) * e.speed * dt;
      } else {
        e.state = 'shoot';
        e.stateTimer = 2.5;
      }
      if (e.stateTimer <= 0) e.state = 'idle';
    } else if (e.state === 'shoot') {
      e.angle = angleTo(e.x, e.y, p.x, p.y);
      if (e.shootTimer <= 0 && d < e.range) {
        enemyShoot(G, e);
        e.shootTimer = e.isBoss ? 0.55 : 1.1;
      }
      if (e.stateTimer <= 0) {
        // Kadang pindah posisi (strafe) agar tidak jadi sasaran empuk.
        e.state = 'chase';
        e.stateTimer = 3;
      }
      // Bos Darma di bawah 30% HP jadi agresif: maju sambil menembak.
      if (e.isBoss && e.hp < e.maxHp * 0.3) {
        const a = angleTo(e.x, e.y, p.x, p.y);
        e.x += Math.cos(a) * e.speed * 0.7 * dt;
        e.y += Math.sin(a) * e.speed * 0.7 * dt;
      }
    }

    // Jangan menembus bangunan.
    const hit = collideCircleBuildings(e.x, e.y, 13, G.world.buildings);
    if (hit) { e.x = hit.x; e.y = hit.y; }
    e.x = clamp(e.x, 40, 3560);
    e.y = clamp(e.y, 40, 2560);
  }
  G.enemies = G.enemies.filter((e) => !e.dead || e.deathTimer < 8);
}

function enemyShoot(G, e) {
  const p = G.player;
  const aim = angleTo(e.x, e.y, p.x, p.y) + (Math.random() - 0.5) * 0.22;
  G.bullets.push({
    x: e.x + Math.cos(aim) * 20,
    y: e.y + Math.sin(aim) * 20,
    angle: aim,
    speed: 780,
    damage: e.damage,
    from: 'enemy',
    life: e.range / 780,
    color: '#ff8a5a',
  });
  G.audio.sfx.shoot();
  G.recentShot = { x: e.x, y: e.y, t: G.timeNow };
  // Tembakan musuh membuat pejalan kaki kabur (ditangani pedestrians.js).
}

// Ledakan: merusak semua yang dekat.
export function explode(G, x, y, radius, damage) {
  G.addParticles(x, y, 30, '#ff8a3a', 300);
  G.addParticles(x, y, 16, '#3a3a3a', 160);
  G.audio.sfx.explosion();
  G.shake = Math.max(G.shake, 14);
  const p = G.player;
  if (dist(x, y, p.x, p.y) < radius) {
    if (p.inCar) damagePlayer(G, damage * 0.4, 'ledakan');
    else damagePlayer(G, damage, 'ledakan');
  }
  for (const e of G.enemies) {
    if (e.hp > 0 && dist(x, y, e.x, e.y) < radius) damageEnemy(G, e, damage, 'ledakan');
  }
  for (const car of G.cars) {
    if (dist(x, y, car.x, car.y) < radius) {
      car.hp -= damage;
      if (car.hp <= 0 && !car.crashed) {
        car.crashed = true;
        G.addParticles(car.x, car.y, 20, '#ff8a3a', 260);
      }
    }
  }
}
