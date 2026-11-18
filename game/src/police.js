// TELUK HARAPAN — police.js
// Sistem wanted 1-5: mobil patroli mengejar, polisi jalan kaki menangkap,
// helikopter di wanted 3+, blokade jalan di wanted 4+. Wanted turun saat
// pemain bersembunyi (jauh dari polisi, di gang, atau di rumah aman).

import { WORLD } from './config.js';
import { dist, angleTo, clamp, angleDiff } from './random.js';
import { makeCar, updatePoliceCar } from './vehicles.js';
import { makeEnemy } from './combat.js';
import { damagePlayer, lowerWanted } from './player.js';
import { randomRoadPoint, nearestRoadPoint } from './world.js';

export function updatePolice(G, dt) {
  const p = G.player;
  const wanted = p.wanted;

  // --- Spawn mobil patroli sesuai wanted ----------------------------------
  const wantCars = wanted === 0 ? 0 : wanted === 1 ? 1 : wanted === 2 ? 2 : wanted === 3 ? 3 : wanted === 4 ? 4 : 5;
  let policeCars = G.cars.filter((c) => c.isPolice && c.driver === 'police');
  if (policeCars.length < wantCars && G.policeTimer <= 0) {
    const car = spawnPoliceCar(G);
    if (car) G.cars.push(car);
    G.policeTimer = 2.5;
  }
  G.policeTimer = Math.max(0, (G.policeTimer || 0) - dt);

  // Mobil patroli yang tidak lagi dibutuhkan pergi (wanted turun).
  for (const car of policeCars) {
    if (wanted === 0) {
      car.ai.kind = 'traffic';
      car.ai.cruise = 140;
      car.driver = 'traffic';
      car.isPolice = false;
    }
  }

  // --- Polisi jalan kaki (tidak spawn di tengah misi aktif) ----------------
  const wantFoot = (!G.mission.active && wanted >= 2) ? Math.min(4, wanted) : 0;
  let footCops = G.enemies.filter((e) => e.isCop && !e.dead);
  if (footCops.length < wantFoot && G.copTimer <= 0 && !p.inCar) {
    const cop = makeEnemy(G, p.x + (Math.random() - 0.5) * 500, p.y + (Math.random() - 0.5) * 500, {
      name: 'Polisi Teluk', hp: 50, speed: 120, weapon: 'pistol', damage: 4, range: 320, isCop: true, dropsCash: 0,
    });
    cop.state = 'chase';
    G.enemies.push(cop);
    G.copTimer = 4;
  }
  G.copTimer = Math.max(0, (G.copTimer || 0) - dt);

  // Polisi jalan kaki yang dekat menangkap pemain (bukan menembak dari jauh).
  if (!p.inCar) {
    for (const cop of footCops) {
      if (dist(cop.x, cop.y, p.x, p.y) < 26 && p.hp > 0) {
        // Ditangkap: wanted lunas dengan denda, HP tersisa sedikit.
        arrestPlayer(G);
        break;
      }
    }
  }

  // --- Helikopter (wanted 3+) ----------------------------------------------
  if (wanted >= 3 && !G.heli) {
    G.heli = {
      x: p.x + 300, y: p.y - 300, angle: 0,
      rotor: 0, spotlight: true, shootTimer: 2,
      searchTimer: 0,
    };
    G.addToast('Helikopter polisi di atasmu! Cari tempat tertutup!');
    G.audio.sfx.radio();
  }
  if (wanted < 3 && G.heli) {
    G.heli = null;
  }
  if (G.heli) {
    const h = G.heli;
    h.rotor += dt * 22;
    const a = angleTo(h.x, h.y, p.x, p.y);
    h.angle = a;
    const d = dist(h.x, h.y, p.x, p.y);
    const speed = d > 260 ? 220 : 120;
    h.x += Math.cos(a) * speed * dt;
    h.y += Math.sin(a) * speed * dt;
    // Helikopter menembak dari udara sesekali (tidak mematikan, menekan).
    h.shootTimer -= dt;
    if (h.shootTimer <= 0 && d < 420) {
      G.bullets.push({
        x: h.x, y: h.y, angle: angleTo(h.x, h.y, p.x, p.y) + (Math.random() - 0.5) * 0.3,
        speed: 700, damage: 3, from: 'enemy', life: 0.8, color: '#ff8a5a',
      });
      h.shootTimer = 1.4;
    }
    // Rotor meniup debu di bawahnya.
    if (Math.random() < 0.3) {
      G.addParticles(h.x + (Math.random() - 0.5) * 60, h.y + (Math.random() - 0.5) * 60, 1, '#c9c9c9', 60);
    }
  }

  // --- Blokade jalan (wanted 4+) --------------------------------------------
  if (wanted >= 4 && G.roadblocks.length < 2 && G.blockTimer <= 0) {
    const ahead = aheadRoadPoint(G, p);
    if (ahead) {
      G.roadblocks.push({
        x: ahead.x, y: ahead.y, angle: ahead.angle,
        cars: [makeCar('patroli', ahead.x - 30, ahead.y, ahead.angle + Math.PI / 2, { driver: 'police', ai: { kind: 'blockade' } })],
        timer: 30,
      });
      G.addToast('Blokade polisi di depan! Cari jalan lain!');
      G.blockTimer = 12;
    }
  }
  G.blockTimer = Math.max(0, (G.blockTimer || 0) - dt);
  for (const rb of G.roadblocks) rb.timer -= dt;
  G.roadblocks = G.roadblocks.filter((rb) => rb.timer > 0 && wanted >= 3);

  // --- Wanted menurun saat bersembunyi --------------------------------------
  const nearestCop = nearestCopDist(G);
  const hidden = nearestCop > 520 && !G.recentShotActive;
  if (wanted > 0 && hidden) {
    G.hideTimer += dt;
    if (G.hideTimer > 2) {
      lowerWanted(G, dt * 2.2);
      if (p.wanted === 0 && G.hideTimer > 2.2) {
        G.addToast('Kau lolos dari kejaran polisi.');
        G.hideTimer = 0;
      }
    }
  } else {
    G.hideTimer = 0;
  }

  // Sirene berbunyi selama ada kejaran.
  const chasing = policeCars.length > 0 || G.heli;
  G.audio.setSiren(chasing);
  G.audio.updateSiren(dt);
}

function spawnPoliceCar(G) {
  const p = G.player;
  const rng = G.rng;
  const rp = randomRoadPoint(rng);
  // Spawn di jalan, agak jauh dari pemain agar adil.
  let x = rp.x;
  let y = rp.y;
  let tries = 0;
  while (dist(x, y, p.x, p.y) < 380 && tries < 8) {
    const rp2 = randomRoadPoint(rng);
    x = rp2.x; y = rp2.y;
    tries++;
  }
  const angle = rp.vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
  const car = makeCar('patroli', x, y, angle, {
    driver: 'police',
    ai: { kind: 'police', target: p, ramming: true },
  });
  car.speed = 180;
  return car;
}

function aheadRoadPoint(G, p) {
  // Titik jalan di depan arah gerak pemain (untuk blokade).
  const dir = p.inCar ? p.inCar.angle : p.angle;
  const fx = p.x + Math.cos(dir) * 420;
  const fy = p.y + Math.sin(dir) * 420;
  const road = nearestRoadPoint(fx, fy);
  if (!road) return null;
  return { x: road.x, y: road.y, angle: road.vertical ? Math.PI / 2 : 0 };
}

export function nearestCopDist(G) {
  const p = G.player;
  let best = Infinity;
  for (const c of G.cars) {
    if (c.isPolice && c.driver === 'police') best = Math.min(best, dist(c.x, c.y, p.x, p.y));
  }
  for (const e of G.enemies) {
    if (e.isCop && !e.dead) best = Math.min(best, dist(e.x, e.y, p.x, p.y));
  }
  if (G.heli) best = Math.min(best, dist(G.heli.x, G.heli.y, p.x, p.y));
  return best;
}

// Ditangkap polisi: denda, senjata disita sebagian, respawn di kantor polisi.
export function arrestPlayer(G) {
  const p = G.player;
  const fine = Math.min(p.cash, 300);
  p.cash -= fine;
  p.wanted = 0;
  p.wantedHeat = 0;
  p.hp = Math.max(30, p.hp);
  // Amunisi disita sebagian sebagai barang bukti — senjata tetap di tangan.
  for (const wid of ['pistol', 'smg', 'shotgun']) {
    if (p.owned[wid]) p.reserve[wid] = Math.floor((p.reserve[wid] || 0) / 2);
  }
  // Respawn di depan Balai Kota Tua.
  p.x = 1500;
  p.y = 1560;
  if (p.inCar) {
    p.inCar.driver = null;
    p.inCar = null;
  }
  G.enemies = G.enemies.filter((e) => !e.isCop);
  G.cars = G.cars.filter((c) => !(c.isPolice && c.driver === 'police'));
  G.heli = null;
  G.roadblocks = [];
  G.audio.sfx.fail();
  G.addToast('DITANGKAP! Denda Rp ' + fine + '. Kau dibebaskan di Balai Kota Tua.');
  G.shake = 8;
}
