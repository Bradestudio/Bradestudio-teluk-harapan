// TELUK HARAPAN — vehicles.js
// Fisika mobil arcade (akselerasi, grip, rem tangan, nitro, tabrakan) dan
// lalu lintas AI: mobil warga mengikuti jaringan jalan, berhenti di
// persimpangan, menghindar, dan membunyikan klakson.

import { CAR_MODELS, CAR_COLORS, WORLD, WEAPONS } from './config.js';
import { clamp, dist, angleDiff, angleTo } from './random.js';
import { randomRoadPoint, carHitsBuilding, clampToWorld, nearestRoadPoint, collideCircleBuildings } from './world.js';
import { raiseWanted, healPlayer, aimAngle, shootWeapon, reloadWeapon } from './player.js';

let carIdCounter = 1;

export function makeCar(modelId, x, y, angle, opts = {}) {
  const model = CAR_MODELS.find((m) => m.id === modelId) || CAR_MODELS[1];
  return {
    id: carIdCounter++,
    model,
    modelId: model.id,
    x, y,
    angle: angle || 0,
    speed: 0,
    color: opts.color || model.color,
    hp: model.hp,
    maxHp: model.hp,
    driver: opts.driver || null, // 'player' | 'traffic' | 'police' | null
    owned: !!opts.owned,
    ai: opts.ai || null, // { kind:'traffic'|'police'|'mission', target, route }
    crashed: false,
    smoke: 0,
    brakeLight: false,
    nitro: !!opts.nitro,
    nitroFuel: 100,
    size: model.size,
    honkTimer: 0,
    stuckTimer: 0,
    lastX: x, lastY: y,
    isPolice: !!model.police,
    despawn: false,
  };
}

export function spawnTrafficCar(G, near) {
  const rng = G.rng;
  let x, y, angle;
  if (near) {
    const rp = randomRoadPoint(rng);
    x = clamp(near.x + rng.range(-700, 700), 100, WORLD.width - 100);
    y = clamp(near.y + rng.range(-500, 500), 100, WORLD.height - 100);
    const road = nearestRoadPoint(x, y);
    x = road.x; y = road.y;
    angle = road.vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
  } else {
    const rp = randomRoadPoint(rng);
    x = rp.x; y = rp.y;
    angle = rp.vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
  }
  const modelId = rng.pick(['sedan', 'sedan', 'taksi', 'pikap', 'becakmotor', 'sport', 'truk']);
  const car = makeCar(modelId, x, y, angle, {
    driver: 'traffic',
    color: rng.pick(CAR_COLORS),
    ai: { kind: 'traffic', cruise: rng.range(90, 170), wait: 0, lane: rng.chance(0.5) ? 1 : -1 },
  });
  car.speed = car.ai.cruise * rng.range(0.5, 0.9);
  return car;
}

export function ensureTraffic(G, dt) {
  // Jaga jumlah mobil lalu lintas di sekitar pemain.
  const p = G.player;
  const target = 14;
  let count = 0;
  for (const c of G.cars) {
    if (c.driver === 'traffic') {
      count++;
      if (dist(c.x, c.y, p.x, p.y) > 1600) c.despawn = true;
    }
  }
  G.cars = G.cars.filter((c) => !c.despawn);
  if (count < target && G.spawnTimer <= 0) {
    G.cars.push(spawnTrafficCar(G, p));
    G.spawnTimer = 0.4;
  }
  G.spawnTimer = Math.max(0, (G.spawnTimer || 0) - dt);
}

// --- Fisika pemain saat mengemudi -----------------------------------------
export function updatePlayerCar(G, dt) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  // Kotak P3K bisa dipakai sambil mengemudi (H).
  if (G.input.wasPressed('H') && p.medkits > 0 && p.hp < p.maxHp) {
    p.medkits--;
    healPlayer(G, 70);
    G.addToast('Kotak P3K dipakai. Sisa: ' + p.medkits);
  }
  // Tembak dari mobil (drive-by) + isi ulang — sebelumnya hanya jalan kaki
  // yang bisa menembak, jadi drive-by tidak pernah mengenai apa pun.
  p.shootCooldown = Math.max(0, (p.shootCooldown || 0) - dt);
  if (G.input.wasPressed('R')) reloadWeapon(G);
  const w = WEAPONS[p.weapon];
  if (w && w.id !== 'fist') {
    const wantFire = w.auto ? G.input.mouse.down : G.input.mouse.clicked;
    if (wantFire && p.shootCooldown <= 0) shootWeapon(G, w);
  }
  const inp = G.input;
  const model = car.model;

  const forward = inp.down('W') || inp.down('ArrowUp') ? 1 : 0;
  const reverse = inp.down('S') || inp.down('ArrowDown') ? 1 : 0;
  const steer = inp.axisX();
  const handbrake = inp.down('Space');
  const wantNitro = inp.down('Shift') && car.nitro && car.nitroFuel > 0 && forward;

  let accel = 0;
  if (forward) accel = model.accel * (wantNitro ? 1.9 : 1);
  if (reverse) accel = -model.accel * 0.55;
  if (!forward && !reverse) {
    // Gesekan jalan.
    car.speed -= car.speed * Math.min(1, dt * 1.4);
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed += accel * dt;
  const top = model.top * (wantNitro ? 1.25 : 1);
  car.speed = clamp(car.speed, -model.top * 0.45, top);
  if (handbrake) {
    car.speed -= car.speed * Math.min(1, dt * 5);
    car.brakeLight = true;
  } else {
    car.brakeLight = reverse > 0;
  }

  // Belok: makin cepat makin susah, rem tangan bikin drift.
  const steerFactor = clamp(Math.abs(car.speed) / 120, 0.15, 1);
  const grip = handbrake ? model.grip * 0.45 : model.grip;
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * grip * steerFactor * dir * dt * (handbrake ? 1.5 : 1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;

  // Tabrakan bangunan.
  const testCar = { ...car, x: nx, y: ny };
  if (carHitsBuilding(testCar, G.world.buildings)) {
    car.speed *= -0.25;
    damageCar(G, car, Math.abs(car.speed) * 0.08 + 4);
    G.audio.sfx.crash();
    G.addParticles(car.x, car.y, 10, '#c9c9c9', 160);
    car.x += Math.cos(car.angle) * car.speed * dt * 0.2;
    car.y += Math.sin(car.angle) * car.speed * dt * 0.2;
  } else {
    car.x = nx;
    car.y = ny;
  }

  // Tabrakan dengan mobil lain (lingkaran kasar).
  for (const other of G.cars) {
    if (other === car) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    const minD = (car.size[0] + other.size[0]) / 2 - 6;
    if (d < minD && d > 0.01) {
      const push = (minD - d) / 2;
      const ux = (car.x - other.x) / d;
      const uy = (car.y - other.y) / d;
      car.x += ux * push;
      car.y += uy * push;
      // Kendaraan misi yang terparkir (taksi/becak) tidak terdorong — ia harus
      // tetap di tempatnya sampai dicuri.
      if (!(other.mission && !other.driver)) {
        other.x -= ux * push;
        other.y -= uy * push;
      }
      const impact = Math.abs(car.speed - other.speed);
      if (impact > 90) {
        damageCar(G, car, impact * 0.05);
        damageCar(G, other, impact * 0.05);
        // Menabrak mobil pengawal misi (konvoi) merusak berat — ramming
        // adalah taktik yang sah untuk menghentikan mereka.
        if (other.mission && other.driver === 'traffic') damageCar(G, other, 25);
        G.audio.sfx.crash();
        G.addParticles(car.x, car.y, 8, '#e8c832', 140);
        if (other.driver === 'traffic') {
          other.ai.wait = 0.6;
          if (G.timeNow - (G.lastBumpWanted || 0) > 3) {
            G.lastBumpWanted = G.timeNow;
            raiseWanted(G, 4, 'tabrakan');
          }
        }
      }
      // Mobil lalu lintas terdorong maju (seperti di jalanan nyata), sehingga
      // pemain tidak macet di belakang mobil yang berhenti.
      if (other.driver === 'traffic' && car.speed > other.speed) {
        other.speed = Math.max(other.speed, car.speed * 0.65);
        other.x += ux * push * 0.5;
        other.y += uy * push * 0.5;
        car.speed *= 0.94;
      } else {
        car.speed *= 0.88;
        other.speed *= 0.85;
      }
    }
  }

  // Musuh tertabrak mobil (termasuk bos) — menabrak itu taktik yang sah.
  for (const e of G.enemies) {
    if (e.hp <= 0 || e.dead) continue;
    const d = dist(car.x, car.y, e.x, e.y);
    if (d < 30 && Math.abs(car.speed) > 50 && G.timeNow - (e.lastRam || 0) > 0.8) {
      e.lastRam = G.timeNow;
      if (G.damageEnemy) G.damageEnemy(e, 50, 'ram');
      e.x += (e.x - car.x) * 0.5;
      e.y += (e.y - car.y) * 0.5;
      if (e.isCop) raiseWanted(G, 10, 'menabrak polisi');
      car.speed *= 0.85;
    }
  }
  // Pejalan kaki tertabrak.
  for (const ped of G.peds) {
    if (ped.fleeing && ped.fleeTimer <= 0) continue;
    const d = dist(car.x, car.y, ped.x, ped.y);
    if (d < 26 && Math.abs(car.speed) > 40) {
      ped.fleeing = true;
      ped.fleeTimer = 4;
      ped.x += (ped.x - car.x) * 0.4;
      ped.y += (ped.y - car.y) * 0.4;
      raiseWanted(G, 14, 'menabrak warga');
      G.audio.sfx.crash();
      G.addParticles(ped.x, ped.y, 8, '#ff8a5a', 120);
    }
  }

  // Anti-jepit: bila mobil terdorong masuk ke dalam bangunan (oleh tabrakan
  // atau ram polisi), dorong keluar ke sisi terdekat — jangan diam di dalam.
  const out = collideCircleBuildings(car.x, car.y, 20, G.world.buildings);
  if (out) { car.x = out.x; car.y = out.y; car.speed *= 0.5; }

  const cl = clampToWorld(car.x, car.y, 30);
  if (cl.x !== car.x || cl.y !== car.y) {
    car.x = cl.x; car.y = cl.y;
    car.speed *= 0.4;
  }

  // Nitro.
  if (wantNitro) {
    car.nitroFuel = Math.max(0, car.nitroFuel - dt * 34);
    if (Math.random() < 0.6) {
      G.addParticles(car.x - Math.cos(car.angle) * 26, car.y - Math.sin(car.angle) * 26, 2, '#5ab5ff', 200);
    }
  } else {
    car.nitroFuel = Math.min(100, car.nitroFuel + dt * 6);
  }

  // Asap bila rusak parah.
  car.smoke = car.hp < car.maxHp * 0.35 ? 1 : car.hp < car.maxHp * 0.6 ? 0.5 : 0;
  if (car.smoke > 0 && Math.random() < car.smoke * 0.3) {
    G.addParticles(car.x, car.y - 8, 1, '#8a8a8a', 40);
  }

  // Pemain mengikuti mobil — kecuali mobilnya hancur di tengah jalan
  // (damageCar sudah mengeluarkan pemain dan memindahkannya ke samping).
  if (p.inCar === car) {
    p.x = car.x;
    p.y = car.y;
    // Bidik mouse saat mengemudi (drive-by): arah tembakan mengikuti mouse,
    // bukan arah mobil — kalau tidak, peluru meleset saat mobil mengorbit.
    if (p.weapon !== 'fist' && dist(G.input.mouse.worldX, G.input.mouse.worldY, p.x, p.y) > 30) {
      p.angle = aimAngle(G);
    } else {
      p.angle = car.angle;
    }
    p.vx = Math.cos(car.angle) * car.speed;
    p.vy = Math.sin(car.angle) * car.speed;
  }

  // Audio mesin.
  G.audio.setEngine(Math.abs(car.speed) / car.model.top, true);
}

export function damageCar(G, car, amount) {
  if (car.hp <= 0) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    car.hp = 0;
    car.crashed = true;
    car.speed = 0;
    G.addParticles(car.x, car.y, 26, '#ff8a3a', 260);
    G.addParticles(car.x, car.y, 14, '#3a3a3a', 120);
    G.audio.sfx.explosion();
    if (car.driver === 'player') {
      G.addToast('Mobilmu hancur! Keluar dan cari mobil lain.');
      G.player.inCar = null;
      car.driver = null;
      G.player.x = car.x + 40;
      G.player.y = car.y + 40;
    }
  }
}

// --- Lalu lintas AI --------------------------------------------------------
export function updateTrafficCar(G, car, dt) {
  const ai = car.ai;
  if (!ai || ai.kind !== 'traffic') return;
  const rng = G.rng;

  // Jalan yang sedang dilalui: ikuti arah jalan, belok di persimpangan.
  const road = nearestRoadPoint(car.x, car.y);
  const onVertical = Math.abs(Math.sin(car.angle)) > 0.7;
  const laneOffset = 13 * ai.lane;

  // Target: terus lurus di jalurnya; di persimpangan kadang belok.
  let targetAngle = car.angle;
  if (road.vertical && Math.abs(car.x - road.x) > 4) {
    // Kembali ke jalur vertikal.
    const desired = onVertical ? car.angle : (car.y < WORLD.height / 2 ? Math.PI / 2 : -Math.PI / 2);
    targetAngle = desired;
    // Koreksi posisi ke lajur.
    const wantX = road.x + laneOffset;
    car.x += clamp(wantX - car.x, -60 * dt, 60 * dt);
  } else if (!road.vertical && Math.abs(car.y - road.y) > 4) {
    const desired = !onVertical ? car.angle : (car.x < WORLD.width / 2 ? 0 : Math.PI);
    targetAngle = desired;
    const wantY = road.y + laneOffset;
    car.y += clamp(wantY - car.y, -60 * dt, 60 * dt);
  }

  // Belok acak di persimpangan.
  const nearIntersection = WORLD.avenues.some((ax) => Math.abs(car.x - ax) < 40)
    && WORLD.streets.some((sy) => Math.abs(car.y - sy) < 40);
  if (nearIntersection && rng.chance(dt * 0.25)) {
    targetAngle = car.angle + (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) * rng.pick([1, 1, 2]);
  }

  car.angle += angleDiff(car.angle, targetAngle) * Math.min(1, dt * 2.2);

  // Mengalah: mobil pemain menempel di belakang -> percepat / minggir.
  const p = G.player;
  if (p.inCar) {
    const behind = (p.inCar.x - car.x) * Math.cos(car.angle) + (p.inCar.y - car.y) * Math.sin(car.angle);
    const side = (p.inCar.x - car.x) * -Math.sin(car.angle) + (p.inCar.y - car.y) * Math.cos(car.angle);
    if (behind < -10 && behind > -95 && Math.abs(side) < 40) {
      car.speed = Math.min(car.ai.cruise * 1.35, car.speed + 160 * dt);
    }
  }

  // Berhenti bila ada mobil di depan atau pemain menghalangi.
  let blocked = false;
  const aheadX = car.x + Math.cos(car.angle) * 70;
  const aheadY = car.y + Math.sin(car.angle) * 70;
  for (const other of G.cars) {
    if (other === car) continue;
    if (dist(aheadX, aheadY, other.x, other.y) < 44) { blocked = true; break; }
  }
  if (dist(aheadX, aheadY, p.x, p.y) < 40) blocked = true;

  if (ai.wait > 0) {
    ai.wait -= dt;
    car.speed = Math.max(0, car.speed - 200 * dt);
  } else if (blocked) {
    car.speed = Math.max(0, car.speed - 260 * dt);
    car.honkTimer -= dt;
    if (car.honkTimer <= 0 && dist(car.x, car.y, p.x, p.y) < 500) {
      G.audio.sfx.horn();
      car.honkTimer = 4;
    }
  } else {
    car.speed += (ai.cruise - car.speed) * Math.min(1, dt * 0.8);
  }

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Bangunan: mobil AI tidak boleh menembus — pantulkan halus.
  if (carHitsBuilding(car, G.world.buildings)) {
    car.angle += Math.PI / 2;
    car.x -= Math.cos(car.angle) * car.speed * dt * 2;
    car.y -= Math.sin(car.angle) * car.speed * dt * 2;
    car.speed *= 0.5;
  }
  const outT = collideCircleBuildings(car.x, car.y, 20, G.world.buildings);
  if (outT) { car.x = outT.x; car.y = outT.y; car.speed *= 0.5; }
  const cl = clampToWorld(car.x, car.y, 60);
  if (cl.x !== car.x || cl.y !== car.y) {
    car.x = cl.x; car.y = cl.y;
    car.angle += Math.PI;
  }

  // Stuck detection: kalau tidak bergerak lama, teleport ke jalan terdekat.
  const moved = dist(car.x, car.y, car.lastX, car.lastY);
  if (moved < 2 && car.speed > 10) car.stuckTimer += dt;
  else car.stuckTimer = 0;
  car.lastX = car.x;
  car.lastY = car.y;
  if (car.stuckTimer > 4) {
    const rp = randomRoadPoint(rng);
    car.x = rp.x; car.y = rp.y;
    car.angle = rp.vertical ? Math.PI / 2 : 0;
    car.stuckTimer = 0;
  }
}

// Mobil polisi yang mengejar — dipakai police.js lewat updatePoliceCar di sana.
export function updatePoliceCar(G, car, dt) {
  const p = G.player;
  const ai = car.ai;
  if (!ai) return;
  // Jangan bergerombol: mobil polisi lain yang terlalu dekat memperlambat.
  for (const other of G.cars) {
    if (other === car || !other.isPolice || other.driver !== 'police') continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 110 && d > 0.01) {
      car.speed *= 0.96;
      car.angle += ((car.x - other.x) * -Math.sin(car.angle) + (car.y - other.y) * Math.cos(car.angle) > 0 ? 1 : -1) * 0.4 * dt;
    }
  }
  const target = ai.target || p;
  const desired = angleTo(car.x, car.y, target.x, target.y);
  const diff = angleDiff(car.angle, desired);
  car.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
  const wantSpeed = ai.ramming ? car.model.top * 0.95 : car.model.top * 0.8;
  car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.2);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (carHitsBuilding(car, G.world.buildings)) {
    car.angle += Math.PI / 3;
    car.speed *= 0.55;
    damageCar(G, car, 3);
  }
  const outP = collideCircleBuildings(car.x, car.y, 20, G.world.buildings);
  if (outP) { car.x = outP.x; car.y = outP.y; car.speed *= 0.5; }
  // Menabrak mobil pemain — damage kecil + cooldown, agar kejar-kejaran
  // terasa menegangkan, bukan menghancurkan mobil dalam hitungan detik.
  car.ramTimer = Math.max(0, (car.ramTimer || 0) - dt);
  if (p.inCar) {
    const pc = p.inCar;
    const d = dist(car.x, car.y, pc.x, pc.y);
    if (d < 52 && car.ramTimer <= 0) {
      car.ramTimer = 1.5;
      damageCar(G, pc, 2);
      damageCar(G, car, 2);
      car.speed *= 0.6;
      // damageCar bisa menghancurkan mobil pemain (p.inCar jadi null) —
      // jangan baca .speed sesudahnya tanpa cek.
      if (p.inCar) p.inCar.speed *= 0.7;
      G.audio.sfx.crash();
    }
  }
  const cl = clampToWorld(car.x, car.y, 40);
  car.x = cl.x; car.y = cl.y;
}
