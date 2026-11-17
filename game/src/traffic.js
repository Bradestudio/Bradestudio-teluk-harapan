// TELUK HARAPAN — traffic.js
// Lalu lintas & pejalan kaki: mobil mengikuti graf jalan (persimpangan ke
// persimpangan, lajur kanan), pejalan kaki berjalan di trotoar dan lari saat
// ada tembakan/ledakan. Ditulis fresh untuk round 4.

import { CONFIG } from './config.js';
import { SeededRandom } from './random.js';
import { nearestRoadNode, resolveCircleColliders } from './world.js';

const CAR_KINDS = ['sedan', 'taksi', 'sedan', 'pickup', 'taksi', 'sport', 'truk'];
const SHIRT_COLORS = [0xd94a3a, 0x3a7ad9, 0x3aa84a, 0xd9a821, 0x8a4ad9, 0xe8e8e8, 0x2a2a2a, 0xd97a3a];
const SKIN_COLORS = [0xc98a5a, 0x8a5a3a, 0xe8b88a, 0x6a3a22];

export class Traffic {
  constructor(city, renderer, rngSeed) {
    this.city = city;
    this.renderer = renderer;
    this.rng = new SeededRandom(rngSeed);
    this.cars = [];
    this.peds = [];
    this._carMeshes = [];
    this._pedMeshes = [];
  }

  spawn() {
    const count = CONFIG.traffic.cars;
    for (let i = 0; i < count; i += 1) {
      const node = this.city.roadNodes[Math.floor(this.rng.next() * this.city.roadNodes.length)];
      const kind = CAR_KINDS[Math.floor(this.rng.next() * CAR_KINDS.length)];
      const car = {
        kind,
        node: node.id,
        target: null,
        x: node.x + this.rng.range(-4, 4),
        z: node.z + this.rng.range(-4, 4),
        heading: this.rng.angle(),
        speed: 0,
        cruise: this.rng.range(9, 14),
        color: undefined,
        mesh: null,
        stuck: 0,
      };
      const mesh = this.renderer.makeCarMesh(kind);
      mesh.position.set(car.x, 0, car.z);
      mesh.rotation.y = car.heading;
      this.renderer.scene.add(mesh);
      car.mesh = mesh;
      this.cars.push(car);
      this._carMeshes.push(mesh);
    }
    const pedCount = CONFIG.traffic.peds;
    for (let i = 0; i < pedCount; i += 1) {
      const spawn = this.city.pedSpawns[Math.floor(this.rng.next() * this.city.pedSpawns.length)];
      const ped = {
        x: spawn.x,
        z: spawn.z,
        heading: this.rng.angle(),
        speed: this.rng.range(1.2, 2.2),
        target: null,
        flee: 0,
        fleeFrom: null,
        walkPhase: this.rng.range(0, Math.PI * 2),
        mesh: null,
      };
      const mesh = this.renderer.makePedMesh(
        SHIRT_COLORS[Math.floor(this.rng.next() * SHIRT_COLORS.length)],
        SKIN_COLORS[Math.floor(this.rng.next() * SKIN_COLORS.length)],
      );
      mesh.position.set(ped.x, 0, ped.z);
      this.renderer.scene.add(mesh);
      ped.mesh = mesh;
      this.peds.push(ped);
      this._pedMeshes.push(mesh);
    }
  }

  /** Pejalan kaki di sekitar (x,z) lari menjauh. */
  scare(x, z, radius) {
    const r = radius || CONFIG.traffic.pedFleeRadius;
    for (const ped of this.peds) {
      const dx = ped.x - x;
      const dz = ped.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        ped.flee = 3;
        ped.fleeFrom = { x, z };
      }
    }
  }

  /** Mobil lalu lintas terdekat dengan titik (untuk tabrakan / misi). */
  nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of this.cars) {
      const d = (car.x - x) ** 2 + (car.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  update(dt, playerPos, time) {
    // --- mobil ---
    for (const car of this.cars) {
      if (!car.target) {
        const neighbors = this.city.adjacency.get(car.node) || [];
        if (neighbors.length === 0) continue;
        car.target = neighbors[Math.floor(this.rng.next() * neighbors.length)];
      }
      const target = this.city.roadNodes[car.target];
      if (!target) continue;
      const dx = target.x - car.x;
      const dz = target.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) {
        car.node = car.target;
        car.target = null;
        continue;
      }
      // Lajur kanan: geser tegak lurus arah jalan.
      const nx = dx / dist;
      const nz = dz / dist;
      const laneX = -nz * 2.4;
      const laneZ = nx * 2.4;
      const gx = target.x + laneX - car.x;
      const gz = target.z + laneZ - car.z;
      const goalHeading = Math.atan2(gx, gz);
      let dh = goalHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
      // Pelan bila ada mobil di depan (hindari tabrakan beruntun).
      let blocked = false;
      for (const other of this.cars) {
        if (other === car) continue;
        const ox = other.x - car.x;
        const oz = other.z - car.z;
        const od = Math.hypot(ox, oz);
        if (od < 7 && ox * Math.sin(car.heading) + oz * Math.cos(car.heading) > 0) {
          blocked = true;
          break;
        }
      }
      if (playerPos) {
        const px = playerPos.x - car.x;
        const pz = playerPos.z - car.z;
        const pd = Math.hypot(px, pz);
        if (pd < 8 && px * Math.sin(car.heading) + pz * Math.cos(car.heading) > 0) blocked = true;
      }
      const want = blocked ? 0 : car.cruise;
      car.speed += (want - car.speed) * Math.min(1, dt * 1.5);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const fixed = resolveCircleColliders(this.city, car.x, car.z, 1.6);
      car.x = fixed.x;
      car.z = fixed.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt * 2.4;
      for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += spin;
    }

    // --- pejalan kaki ---
    for (const ped of this.peds) {
      let speed = ped.speed;
      if (ped.flee > 0) {
        ped.flee -= dt;
        speed = 6.5;
        const dx = ped.x - ped.fleeFrom.x;
        const dz = ped.z - ped.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        ped.heading = Math.atan2(dx / d, dz / d);
      } else if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.z - ped.z) < 2) {
        // Pilih tujuan baru: jalan kaki di dekat jalan (trotoar).
        const node = nearestRoadNode(this.city, ped.x, ped.z);
        const a = this.rng.angle();
        ped.target = {
          x: node.x + Math.cos(a) * this.rng.range(6, 20),
          z: node.z + Math.sin(a) * this.rng.range(6, 20),
        };
      } else {
        const dx = ped.target.x - ped.x;
        const dz = ped.target.z - ped.z;
        ped.heading = Math.atan2(dx, dz);
      }
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      const fixed = resolveCircleColliders(this.city, ped.x, ped.z, 0.5);
      ped.x = fixed.x;
      ped.z = fixed.z;
      // Jaga pejalan kaki tetap di darat (jangan masuk sungai/laut).
      if (ped.x > 44 && ped.x < 84) ped.x = ped.x < 64 ? 44 : 84;
      if (ped.x < -268) ped.x = -268;
      if (ped.z > 284) ped.z = 284;
      ped.walkPhase += dt * speed * 2.4;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.mesh.userData.legs[0].rotation.x = swing;
      ped.mesh.userData.legs[1].rotation.x = -swing;
    }
  }

  dispose() {
    for (const m of this._carMeshes) this.renderer.scene.remove(m);
    for (const m of this._pedMeshes) this.renderer.scene.remove(m);
    this.cars = [];
    this.peds = [];
    this._carMeshes = [];
    this._pedMeshes = [];
  }
}
