// TELUK HARAPAN — police.js
// Sistem wanted 0-5 bintang + AI polisi: mobil patroli mengejar & menabrak,
// polisi jalan kaki menangkap, blokade di bintang 3+, helikopter dengan sorot
// di bintang 3+. Panas mereda bila lama tidak terlihat. Ditulis fresh.

import { CONFIG } from './config.js';
import { SeededRandom } from './random.js';
import { nearestRoadNode, resolveCircleColliders } from './world.js';

export class Police {
  constructor(city, renderer, rngSeed) {
    this.city = city;
    this.renderer = renderer;
    this.rng = new SeededRandom(rngSeed);
    this.stars = 0;
    this.heat = 0; // 0..1 — seberapa "panas" posisi pemain diketahui
    this.lastCrimeAt = -999;
    this.time = 0;
    this.cars = [];
    this.officers = [];
    this.heli = null;
    this.heliMesh = null;
    this.roadblock = []; // mobil blokade {x,z,heading,mesh}
    this.busted = false;
    this._onBusted = null;
    this._onStarsChanged = null;
  }

  onBusted(cb) { this._onBusted = cb; }
  onStarsChanged(cb) { this._onStarsChanged = cb; }

  addStars(n, now) {
    const before = this.stars;
    this.stars = Math.max(0, Math.min(CONFIG.wanted.maxStars, this.stars + n));
    this.heat = 1;
    this.lastCrimeAt = now;
    if (this.stars !== before && this._onStarsChanged) this._onStarsChanged(this.stars);
    this._syncUnits();
  }

  setStars(n, now) {
    const before = this.stars;
    this.stars = Math.max(0, Math.min(CONFIG.wanted.maxStars, n));
    this.heat = this.stars > 0 ? 1 : 0;
    this.lastCrimeAt = now;
    if (this.stars !== before && this._onStarsChanged) this._onStarsChanged(this.stars);
    this._syncUnits();
  }

  clearWanted() {
    this.setStars(0, this.time);
  }

  _syncUnits() {
    const wantCars = this.stars * CONFIG.wanted.policePerStar;
    // Tambah mobil polisi bila kurang.
    while (this.cars.length < wantCars) {
      const mesh = this.renderer.makeCarMesh('polisi');
      this.renderer.scene.add(mesh);
      this.cars.push({
        x: 0, z: 0, heading: 0, speed: 0, node: 0, target: null,
        mesh, siren: Math.random() * 10, ramCooldown: 0,
      });
    }
    // Kurangi bila berlebih (pulang ke markas = hapus).
    while (this.cars.length > wantCars) {
      const car = this.cars.pop();
      this.renderer.scene.remove(car.mesh);
    }
    // Petugas jalan kaki di bintang 1-2.
    const wantOfficers = this.stars >= 1 && this.stars <= 2 ? 2 : 0;
    while (this.officers.length < wantOfficers) {
      const mesh = this.renderer.makePedMesh(0x1e3a8a, 0xc98a5a);
      this.renderer.scene.add(mesh);
      this.officers.push({ x: 0, z: 0, heading: 0, mesh, catchTimer: 0 });
    }
    while (this.officers.length > wantOfficers) {
      const o = this.officers.pop();
      this.renderer.scene.remove(o.mesh);
    }
    // Helikopter di bintang 3+.
    if (this.stars >= CONFIG.wanted.heliAtStars && !this.heliMesh) {
      this.heliMesh = this.renderer.makeHeliMesh();
      this.renderer.scene.add(this.heliMesh);
      this.heli = { x: 0, z: 0, y: 55, angle: 0, mesh: this.heliMesh };
    }
    if (this.stars < CONFIG.wanted.heliAtStars && this.heliMesh) {
      this.renderer.scene.remove(this.heliMesh);
      this.heliMesh = null;
      this.heli = null;
    }
    // Blokade di bintang 3+: dua mobil melintang di jalan depan pemain.
    if (this.stars >= 3 && this.roadblock.length === 0) {
      for (let i = 0; i < 2; i += 1) {
        const mesh = this.renderer.makeCarMesh('polisi');
        this.renderer.scene.add(mesh);
        this.roadblock.push({ x: 0, z: 0, heading: 0, mesh, placed: false });
      }
    }
    if (this.stars < 3 && this.roadblock.length > 0) {
      for (const b of this.roadblock) this.renderer.scene.remove(b.mesh);
      this.roadblock = [];
    }
  }

  /** Letakkan blokade di depan pemain (dipanggil misi saat pemain mendekat). */
  placeRoadblock(x, z, heading) {
    for (let i = 0; i < this.roadblock.length; i += 1) {
      const b = this.roadblock[i];
      const side = i === 0 ? -1 : 1;
      b.x = x + Math.cos(heading) * side * 4;
      b.z = z + Math.sin(heading) * side * 4;
      b.heading = heading + Math.PI / 2;
      b.placed = true;
      b.mesh.position.set(b.x, 0, b.z);
      b.mesh.rotation.y = b.heading;
    }
  }

  update(dt, player, now) {
    this.time = now;
    // Panas mereda bila lama tanpa kejahatan baru.
    if (this.stars > 0 && now - this.lastCrimeAt > CONFIG.wanted.decaySeconds) {
      this.heat = Math.max(0, this.heat - dt / 8);
      if (this.heat <= 0) this.setStars(Math.max(0, this.stars - 1), now);
    }

    const px = player.x;
    const pz = player.z;
    // Mobil polisi: kejar pemain (kejar langsung bila panas, patroli bila dingin).
    for (const car of this.cars) {
      car.ramCooldown = Math.max(0, car.ramCooldown - dt);
      const dx = px - car.x;
      const dz = pz - car.z;
      const dist = Math.hypot(dx, dz);
      // Spawn di dekat pemain bila terlalu jauh (respawn patroli).
      if (dist > 260) {
        const node = nearestRoadNode(this.city, px + this.rng.range(-60, 60), pz + this.rng.range(-60, 60));
        car.x = node.x;
        car.z = node.z;
        car.node = node.id;
        car.target = null;
        continue;
      }
      let goalX = px;
      let goalZ = pz;
      if (this.heat < 0.4) {
        // Patroli: ikuti graf jalan.
        if (!car.target) {
          const neighbors = this.city.adjacency.get(car.node) || [];
          if (neighbors.length > 0) car.target = neighbors[Math.floor(this.rng.next() * neighbors.length)];
        }
        const t = this.city.roadNodes[car.target];
        if (t) { goalX = t.x; goalZ = t.z; }
      }
      const gx = goalX - car.x;
      const gz = goalZ - car.z;
      const goalHeading = Math.atan2(gx, gz);
      let dh = goalHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steerRate = this.heat > 0.4 ? 2.6 : 1.6;
      car.heading += Math.max(-steerRate * dt, Math.min(steerRate * dt, dh));
      const spec = CONFIG.cars.polisi;
      const wantSpeed = this.heat > 0.4 ? spec.topSpeed * 0.96 : 12;
      car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.2);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const fixed = resolveCircleColliders(this.city, car.x, car.z, 1.6);
      car.x = fixed.x;
      car.z = fixed.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt * 2.4;
      for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += spin;
      // Menabrak pemain (di mobil): dorong + rusak.
      if (player.inCar && dist < 4.2 && car.ramCooldown <= 0) {
        car.ramCooldown = 1.2;
        if (player.onRam) player.onRam(car);
      }
      // Menangkap pemain jalan kaki: berdiri dekat 2,5 detik = tertangkap.
      if (!player.inCar && dist < 3.2) {
        car.catchTimer = (car.catchTimer || 0) + dt;
        if (car.catchTimer > 2.5 && this._onBusted) {
          this._onBusted('ditangkap');
          car.catchTimer = 0;
        }
      } else {
        car.catchTimer = 0;
      }
    }

    // Petugas jalan kaki: berjalan ke arah pemain bila dekat.
    for (const o of this.officers) {
      const dx = px - o.x;
      const dz = pz - o.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 200) {
        const node = nearestRoadNode(this.city, px + this.rng.range(-30, 30), pz + this.rng.range(-30, 30));
        o.x = node.x;
        o.z = node.z;
        continue;
      }
      if (dist > 2.4) {
        o.heading = Math.atan2(dx, dz);
        o.x += Math.sin(o.heading) * 5.5 * dt;
        o.z += Math.cos(o.heading) * 5.5 * dt;
      } else {
        o.catchTimer += dt;
        if (o.catchTimer > 2 && this._onBusted) {
          this._onBusted('ditangkap');
          o.catchTimer = 0;
        }
      }
      o.mesh.position.set(o.x, 0, o.z);
      o.mesh.rotation.y = o.heading;
    }

    // Helikopter: mengorbit di atas pemain, sorot mengikuti.
    if (this.heli) {
      this.heli.angle += dt * 0.35;
      const hx = px + Math.cos(this.heli.angle) * 26;
      const hz = pz + Math.sin(this.heli.angle) * 26;
      this.heli.x = hx;
      this.heli.z = hz;
      this.heli.mesh.position.set(hx, this.heli.y, hz);
      this.heli.mesh.rotation.y = Math.atan2(px - hx, pz - hz);
      for (const r of this.heli.mesh.userData.rotors) r.rotation.y += dt * 22;
      this.heli.mesh.userData.spot.target.position.set(px - hx, -this.heli.y, pz - hz);
    }
  }

  dispose() {
    for (const c of this.cars) this.renderer.scene.remove(c.mesh);
    for (const o of this.officers) this.renderer.scene.remove(o.mesh);
    for (const b of this.roadblock) this.renderer.scene.remove(b.mesh);
    if (this.heliMesh) this.renderer.scene.remove(this.heliMesh);
    this.cars = [];
    this.officers = [];
    this.roadblock = [];
    this.heli = null;
    this.heliMesh = null;
  }
}
