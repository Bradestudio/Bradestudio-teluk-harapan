// TELUK HARAPAN — the world: a seeded coastal city, its people and its rules.
// The simulation is pure logic (no rendering here): it advances in fixed 1/60 s steps
// from a seeded random, so the same seed always replays the same city and traffic.

import { CAR, CITY, DISTRICT_STYLE, MISSIONS, PLAYER, POLICE, PRICES, SIDE_JOBS, WANTED, districtAt } from './config.js';
import { pick, range } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_MISSION = 4;
export const EVENT_WANTED = 8;
export const EVENT_CASH = 16;

const ROADS = [];
for (let v = -CITY.half; v <= CITY.half; v += CITY.roadEvery) ROADS.push(v);

function nearestRoad(value) {
  let best = ROADS[0];
  for (const road of ROADS) if (Math.abs(road - value) < Math.abs(best - value)) best = road;
  return best;
}

function clampToCity(value) {
  return Math.max(-CITY.half + 8, Math.min(CITY.half - 8, value));
}

/** Push a circle (x, z, radius) out of every building AABB it overlaps. */
function collideBuildings(city, body) {
  for (const b of city.buildings) {
    const hw = b.w / 2;
    const hd = b.d / 2;
    const cx = Math.max(b.x - hw, Math.min(b.x + hw, body.x));
    const cz = Math.max(b.z - hd, Math.min(b.z + hd, body.z));
    const dx = body.x - cx;
    const dz = body.z - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq < body.radius * body.radius) {
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        body.x = cx + (dx / dist) * body.radius;
        body.z = cz + (dz / dist) * body.radius;
      } else {
        body.x = b.x + hw + body.radius;
      }
    }
  }
}

function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

/** Build the city once, from the seeded random: buildings, trees, containers, stalls. */
export function generateCity(random) {
  const buildings = [];
  const trees = [];
  const containers = [];
  const stalls = [];
  const blockCenters = [];
  for (let x = -210; x <= 210; x += 60) {
    for (let z = -210; z <= 210; z += 60) blockCenters.push({ x, z });
  }
  for (const block of blockCenters) {
    const district = districtAt(block.x, block.z);
    // The central plaza and a park stay open: no buildings, just trees.
    if ((block.x === 30 && block.z === 30) || (block.x === -30 && block.z === -90)) {
      for (let i = 0; i < 6; i += 1) {
        trees.push({ x: block.x + range(random, -22, 22), z: block.z + range(random, -22, 22), scale: range(random, 0.8, 1.3), palm: false });
      }
      continue;
    }
    if (district === 'beach') {
      // Boardwalk huts and palms along the sand.
      if (random() < 0.6) {
        buildings.push({ x: block.x, z: block.z, w: 10, d: 8, h: 4, color: pick(random, DISTRICT_STYLE.beach.colors), glass: false, district });
      }
      for (let i = 0; i < 5; i += 1) {
        trees.push({ x: block.x + range(random, -24, 24), z: block.z + range(random, -24, 24), scale: range(random, 0.9, 1.4), palm: true });
      }
      continue;
    }
    const style = DISTRICT_STYLE[district];
    const count = style.wide ? 1 : 1 + Math.floor(random() * 3);
    for (let i = 0; i < count; i += 1) {
      const w = style.wide ? range(random, 30, 44) : range(random, 12, 22);
      const d = style.wide ? range(random, 18, 26) : range(random, 12, 22);
      const h = range(random, style.hMin, style.hMax);
      const ox = count === 1 ? 0 : range(random, -14, 14);
      const oz = count === 1 ? 0 : range(random, -14, 14);
      buildings.push({
        x: block.x + ox,
        z: block.z + oz,
        w,
        d,
        h,
        color: pick(random, style.colors),
        glass: !!style.glass,
        district,
      });
    }
    if (district === 'port') {
      for (let i = 0; i < 4; i += 1) {
        containers.push({
          x: block.x + range(random, -20, 20),
          z: block.z + range(random, -20, 20),
          color: pick(random, [0xb8442c, 0x2c6eb8, 0xd9a441, 0x4a8a4a, 0x8a5aa8]),
          angle: random() < 0.5 ? 0 : Math.PI / 2,
        });
      }
    }
    if (district === 'market') {
      for (let i = 0; i < 3; i += 1) {
        stalls.push({
          x: block.x + range(random, -18, 18),
          z: block.z + range(random, -18, 18),
          color: pick(random, [0xd94f4f, 0xe8a13c, 0x4f9ed9, 0x6ab86a]),
        });
      }
    }
    const treeCount = district === 'senja' ? 4 : district === 'hills' ? 5 : 1;
    for (let i = 0; i < treeCount; i += 1) {
      trees.push({ x: block.x + range(random, -24, 24), z: block.z + range(random, -24, 24), scale: range(random, 0.8, 1.4), palm: district === 'senja' });
    }
  }
  return { buildings, trees, containers, stalls, roads: ROADS };
}

function makeCar(id, kind, x, z, angle, color, random) {
  return {
    id,
    kind,
    x,
    z,
    angle,
    speed: 0,
    color,
    axis: random() < 0.5 ? 'x' : 'z',
    dir: random() < 0.5 ? 1 : -1,
    lane: 2.5,
    turnCd: 2,
    stopTimer: 0,
    lightPhase: random() * Math.PI * 2,
  };
}

function spawnTraffic(random, count, avoid) {
  const cars = [];
  const colors = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x7d3c98, 0x16a085, 0xe67e22, 0x95a5a6, 0x2c3e50];
  for (let i = 0; i < count; i += 1) {
    const axis = random() < 0.5 ? 'x' : 'z';
    const road = pick(random, ROADS);
    const along = range(random, -CITY.half + 20, CITY.half - 20);
    const dir = random() < 0.5 ? 1 : -1;
    const x = axis === 'x' ? along : road + (dir > 0 ? -2.5 : 2.5);
    const z = axis === 'x' ? road + (dir > 0 ? 2.5 : -2.5) : along;
    if (dist2(x, z, avoid.x, avoid.z) < 900) continue;
    const car = makeCar(1000 + i, 'traffic', x, z, axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI, pick(random, colors), random);
    car.axis = axis;
    car.dir = dir;
    car.speed = range(random, 8, 14);
    cars.push(car);
  }
  return cars;
}

function spawnParked(random, count, avoid) {
  const cars = [];
  const colors = [0x922b21, 0x1a5276, 0x7e5109, 0x4a235a, 0x145a32, 0x935116];
  for (let i = 0; i < count; i += 1) {
    const road = pick(random, ROADS);
    const along = range(random, -CITY.half + 30, CITY.half - 30);
    const side = random() < 0.5 ? 1 : -1;
    const axis = random() < 0.5 ? 'x' : 'z';
    const x = axis === 'x' ? along : road + side * (CITY.roadWidth / 2 + 1.6);
    const z = axis === 'x' ? road + side * (CITY.roadWidth / 2 + 1.6) : along;
    if (dist2(x, z, avoid.x, avoid.z) < 400) continue;
    const angle = axis === 'x' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? 0 : Math.PI;
    cars.push(makeCar(2000 + i, 'parked', x, z, angle, pick(random, colors), random));
  }
  return cars;
}

function spawnPeds(random, count, avoid) {
  const peds = [];
  const colors = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xecf0f1, 0x1abc9c, 0xe67e22];
  for (let i = 0; i < count; i += 1) {
    const axis = random() < 0.5 ? 'x' : 'z';
    const road = pick(random, ROADS);
    const along = range(random, -CITY.half + 15, CITY.half - 15);
    const side = random() < 0.5 ? 1 : -1;
    const off = CITY.roadWidth / 2 + CITY.sidewalk / 2 + 0.4;
    const x = axis === 'x' ? along : road + side * off;
    const z = axis === 'x' ? road + side * off : along;
    if (dist2(x, z, avoid.x, avoid.z) < 100) continue;
    peds.push({
      id: 3000 + i,
      x,
      z,
      angle: axis === 'x' ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : random() < 0.5 ? 0 : Math.PI,
      speed: range(random, 1.0, 1.8),
      color: pick(random, colors),
      state: 'walk',
      axis,
      dir: random() < 0.5 ? 1 : -1,
      road,
      downTimer: 0,
      walkPhase: random() * Math.PI * 2,
    });
  }
  return peds;
}

/** The player's starting spot: on foot in Pasar Lama, a parked car a few steps away. */
const SPAWN = { x: -60, z: 170, yaw: Math.PI * 0.75 };

export function createWorld(random) {
  const city = generateCity(random);
  const state = {
    time: 0,
    random,
    money: 0,
    health: PLAYER.health,
    ammo: 12,
    weapon: 'fists',
    wanted: 0,
    lastCrime: -999,
    missionIndex: 0,
    stageIndex: 0,
    stageTimer: 0,
    stageData: {},
    message: '',
    messageTimer: 0,
    toast: '',
    toastTimer: 0,
    player: {
      x: SPAWN.x,
      z: SPAWN.z,
      radius: PLAYER.radius,
      angle: SPAWN.yaw,
      yaw: SPAWN.yaw,
      pitch: -0.12,
      speed: 0,
      moving: false,
      onFoot: true,
      carId: -1,
      walkPhase: 0,
      punchTimer: 0,
      shootTimer: 0,
      hurtTimer: 0,
    },
    cars: [],
    peds: [],
    thugs: [],
    particles: [],
    camera: { yaw: SPAWN.yaw, pitch: -0.12, mode: 'follow' },
    stats: { earned: 0, carsStolen: 0, crimes: 0, missionsDone: 0 },
    dead: false,
    won: false,
    taxi: null,
    courier: null,
    saveTimer: 0,
    policeRamCd: 0,
  };

  function reset() {
    state.time = 0;
    state.money = 0;
    state.health = PLAYER.health;
    state.ammo = 12;
    state.weapon = 'fists';
    state.wanted = 0;
    state.lastCrime = -999;
    state.missionIndex = 0;
    state.stageIndex = 0;
    state.stageTimer = 0;
    state.stageData = {};
    state.message = '';
    state.messageTimer = 0;
    state.toast = '';
    state.toastTimer = 0;
    state.player.x = SPAWN.x;
    state.player.z = SPAWN.z;
    state.player.angle = SPAWN.yaw;
    state.player.yaw = SPAWN.yaw;
    state.player.pitch = -0.12;
    state.player.speed = 0;
    state.player.moving = false;
    state.player.onFoot = true;
    state.player.carId = -1;
    state.player.walkPhase = 0;
    state.player.punchTimer = 0;
    state.player.shootTimer = 0;
    state.player.hurtTimer = 0;
    state.cars = [...spawnTraffic(random, 16, SPAWN), ...spawnParked(random, 10, SPAWN)];
    // One parked car right by the spawn, so the first mission can start at once.
    state.cars.push(makeCar(2001, 'parked', -57, 168, 0, 0xc0392b, random));
    state.peds = spawnPeds(random, 22, SPAWN);
    state.thugs = [];
    state.particles = [];
    state.camera.yaw = SPAWN.yaw;
    state.camera.pitch = -0.12;
    state.camera.mode = 'follow';
    state.stats = { earned: 0, carsStolen: 0, crimes: 0, missionsDone: 0 };
    state.dead = false;
    state.won = false;
    state.taxi = null;
    state.courier = null;
    state.saveTimer = 0;
    state.policeRamCd = 0;
  }

  reset();

  return { state, city, reset, step, save, load, currentMission, currentStage, missionTarget, setMission };

  function currentMission() {
    return MISSIONS[Math.min(state.missionIndex, MISSIONS.length - 1)];
  }

  function currentStage() {
    if (state.missionIndex >= MISSIONS.length) return null;
    const mission = MISSIONS[state.missionIndex];
    return mission.stages[Math.min(state.stageIndex, mission.stages.length - 1)];
  }

  /** The map position the HUD and minimap should point at, or null. */
  function missionTarget() {
    const stage = currentStage();
    if (!stage) return null;
    if (stage.target) return stage.target;
    if (state.taxi && state.taxi.stage === 'ride') return state.taxi.dest;
    if (state.courier && state.courier.stage === 'deliver') return state.courier.target;
    return null;
  }

  /** Jump straight to a mission (used by the screenshot stager and by continue). */
  function setMission(index) {
    state.missionIndex = Math.max(0, Math.min(MISSIONS.length - 1, index));
    state.stageIndex = 0;
    state.stageData = {};
    state.stageTimer = 0;
    if (state.missionIndex === 2) {
      state.wanted = 3;
      state.lastCrime = state.time;
      state.stageTimer = 45;
    }
    if (state.missionIndex === 4) spawnThugs();
  }

  function save() {
    return {
      missionIndex: state.missionIndex,
      stageIndex: state.stageIndex,
      money: state.money,
      health: state.health,
      ammo: state.ammo,
      x: state.player.x,
      z: state.player.z,
      time: state.time,
    };
  }

  function load(data) {
    if (!data || typeof data !== 'object') return false;
    state.missionIndex = Math.max(0, Math.min(MISSIONS.length - 1, data.missionIndex | 0));
    state.stageIndex = Math.max(0, data.stageIndex | 0);
    state.money = Math.max(0, data.money | 0);
    state.health = Math.max(1, Math.min(PLAYER.health, data.health | 0));
    state.ammo = Math.max(0, data.ammo | 0);
    state.player.x = clampToCity(Number(data.x) || SPAWN.x);
    state.player.z = clampToCity(Number(data.z) || SPAWN.z);
    state.time = Number(data.time) || 0;
    return true;
  }

  // ---- the step and its systems live below; they close over state, city and random. ----
  function step(dt, controls, ambient) {
    let events = EVENT_NONE;
    state.time += dt;
    if (state.messageTimer > 0) {
      state.messageTimer -= dt;
      if (state.messageTimer <= 0) state.message = '';
    }
    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) state.toast = '';
    }
    if (state.player.punchTimer > 0) state.player.punchTimer -= dt;
    if (state.player.shootTimer > 0) state.player.shootTimer -= dt;
    if (state.player.hurtTimer > 0) state.player.hurtTimer -= dt;
    if (state.policeRamCd > 0) state.policeRamCd -= dt;

    if (!ambient && controls) {
      state.player.yaw += (controls.lookDX || 0) * 0.0032;
      state.player.pitch = Math.max(-0.55, Math.min(0.35, state.player.pitch + (controls.lookDY || 0) * 0.0024));
      state.camera.yaw = state.player.yaw;
      state.camera.pitch = state.player.pitch;
    }

    if (ambient || state.dead) {
      updateTraffic(dt);
      updatePeds(dt);
      updateParticles(dt);
      return events;
    }

    if (controls) {
      if (state.player.onFoot) events |= updateOnFoot(dt, controls);
      else events |= updateDriving(dt, controls);
      if (controls.weapon) {
        state.weapon = state.weapon === 'fists' ? 'pistol' : 'fists';
        setMessage(state.weapon === 'fists' ? 'Tinju' : `Pistol (${state.ammo} peluru)`);
      }
      if (controls.enter) events |= doInteract();
      if (controls.steal) events |= doSteal();
      if (controls.punch) events |= doPunch();
      if (controls.shoot) events |= doShoot();
    }

    updateTraffic(dt);
    updatePeds(dt);
    events |= updatePolice(dt);
    events |= updateWanted(dt);
    events |= updateMissions(dt);
    updateSideJobs(dt);
    updateParticles(dt);

    // Slow health regen once the heat is off.
    if (state.wanted === 0 && state.health > 0 && state.health < PLAYER.health) {
      state.health = Math.min(PLAYER.health, state.health + 2 * dt);
    }
    if (state.health <= 0 && !state.dead) {
      state.dead = true;
      events |= EVENT_OVER;
    }
    state.saveTimer += dt;
    return events;
  }

  function setMessage(text, seconds) {
    state.message = text;
    state.messageTimer = seconds || 4;
  }

  function setToast(text, seconds) {
    state.toast = text;
    state.toastTimer = seconds || 3;
  }

  function addWanted(amount) {
    if (amount <= 0) return;
    state.wanted = Math.min(5, state.wanted + amount);
    state.lastCrime = state.time;
    state.stats.crimes += 1;
  }

  function spawnParticles(x, y, z, color, count, spread) {
    for (let i = 0; i < count; i += 1) {
      state.particles.push({
        x,
        y,
        z,
        vx: (random() - 0.5) * (spread || 6),
        vy: random() * 5 + 2,
        vz: (random() - 0.5) * (spread || 6),
        life: 0.5 + random() * 0.4,
        maxLife: 0.9,
        color,
      });
    }
    if (state.particles.length > 220) state.particles.splice(0, state.particles.length - 220);
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 12 * dt;
      if (p.y < 0.1) {
        p.y = 0.1;
        p.vy = 0;
      }
    }
  }

  function nearestCar(maxDist) {
    const p = state.player;
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      if (car.kind === 'police') continue;
      const d = dist2(p.x, p.z, car.x, car.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function updateOnFoot(dt, controls) {
    const p = state.player;
    const speed = controls.run ? PLAYER.run : PLAYER.walk;
    const f = controls.moveF || 0;
    const s = controls.moveS || 0;
    const len = Math.hypot(f, s) || 1;
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const rx = -fz;
    const rz = fx;
    const vx = ((fx * f) / len + (rx * s) / len) * speed;
    const vz = ((fz * f) / len + (rz * s) / len) * speed;
    p.moving = Math.abs(f) + Math.abs(s) > 0.1;
    p.speed = p.moving ? speed : 0;
    if (p.moving) {
      p.angle = Math.atan2(vx, vz);
      p.walkPhase += dt * speed * 1.6;
    }
    p.x = clampToCity(p.x + vx * dt);
    p.z = clampToCity(p.z + vz * dt);
    collideBuildings(city, p);
    // Traffic stops for a pedestrian in the way; a speeding car still hurts.
    for (const car of state.cars) {
      if (car.kind === 'parked') continue;
      const d = Math.sqrt(dist2(p.x, p.z, car.x, car.z));
      if (d < CAR.radius + 0.9) {
        if (car.kind === 'police' && car.speed > 4 && state.policeRamCd <= 0) {
          state.health -= POLICE.ramDamage;
          state.policeRamCd = POLICE.ramCooldown;
          p.hurtTimer = 0.6;
          return EVENT_HIT;
        }
        if (car.speed < 3) {
          const push = (CAR.radius + 0.9 - d) || 0.1;
          const nx = (p.x - car.x) / (d || 1);
          const nz = (p.z - car.z) / (d || 1);
          p.x += nx * push;
          p.z += nz * push;
        }
      }
    }
    return EVENT_NONE;
  }

  function updateDriving(dt, controls) {
    const p = state.player;
    const car = state.cars.find((c) => c.id === p.carId);
    if (!car) {
      p.onFoot = true;
      p.carId = -1;
      return EVENT_NONE;
    }
    const throttle = controls.moveF || 0;
    const steer = controls.moveS || 0;
    if (throttle > 0) car.speed = Math.min(CAR.maxSpeed, car.speed + CAR.accel * dt);
    else if (throttle < 0) {
      car.speed = car.speed > 0.5 ? Math.max(0, car.speed - CAR.brake * dt) : Math.max(-CAR.maxReverse, car.speed - CAR.accel * 0.6 * dt);
    } else {
      car.speed *= Math.max(0, 1 - 1.4 * dt);
      if (Math.abs(car.speed) < 0.2) car.speed = 0;
    }
    const steerAmount = steer * CAR.steer * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 8 + 0.25);
    car.angle += steerAmount * dt * (car.speed >= 0 ? 1 : -1) * Math.sign(car.speed || 1);
    car.x = clampToCity(car.x + Math.sin(car.angle) * car.speed * dt);
    car.z = clampToCity(car.z + Math.cos(car.angle) * car.speed * dt);
    const body = { x: car.x, z: car.z, radius: CAR.radius };
    collideBuildings(city, body);
    car.x = body.x;
    car.z = body.z;
    // Bump into other cars: both lose speed. Police rams are handled separately
    // (updatePolice, with a cooldown), so they never pin the player to zero here.
    for (const other of state.cars) {
      if (other.id === car.id || other.kind === 'parked' || other.kind === 'police') continue;
      const d = Math.sqrt(dist2(car.x, car.z, other.x, other.z));
      if (d < CAR.radius * 2 && d > 0.01) {
        const nx = (car.x - other.x) / d;
        const nz = (car.z - other.z) / d;
        const push = (CAR.radius * 2 - d) / 2;
        car.x += nx * push;
        car.z += nz * push;
        other.x -= nx * push;
        other.z -= nz * push;
        car.speed *= 0.55;
        other.speed *= 0.5;
      }
    }
    // Running over a pedestrian is a crime.
    for (const ped of state.peds) {
      if (ped.state !== 'walk' && ped.state !== 'taxi') continue;
      if (dist2(car.x, car.z, ped.x, ped.z) < 4.5) {
        ped.state = 'down';
        ped.downTimer = 6;
        addWanted(WANTED.killPed);
        spawnParticles(ped.x, 1, ped.z, 0xd94f4f, 8, 5);
      }
    }
    p.x = car.x;
    p.z = car.z;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);
    p.moving = Math.abs(car.speed) > 0.5;
    return EVENT_NONE;
  }

  function doInteract() {
    const p = state.player;
    if (!p.onFoot) {
      // Get out of the car: it stays parked where it is.
      const car = state.cars.find((c) => c.id === p.carId);
      if (car) {
        car.kind = 'parked';
        car.speed = 0;
        p.x = car.x + Math.cos(car.angle) * 2.4;
        p.z = car.z - Math.sin(car.angle) * 2.4;
      }
      p.onFoot = true;
      p.carId = -1;
      return EVENT_NONE;
    }
    // Mission targets first.
    const stage = currentStage();
    if (stage && stage.target) {
      const d = Math.sqrt(dist2(p.x, p.z, stage.target.x, stage.target.z));
      if (d < 5) {
        if (stage.kind === 'pickup') {
          state.stageData.hasPackage = true;
          advanceStage();
          return EVENT_CASH;
        }
        if (stage.kind === 'deliver') {
          if (state.missionIndex === 1 && (p.onFoot || !state.stageData.stolen)) return EVENT_NONE;
          advanceStage();
          return EVENT_CASH;
        }
        if (stage.kind === 'rob') {
          state.money += 600;
          state.stats.earned += 600;
          addWanted(2);
          spawnParticles(p.x, 1.5, p.z, 0xffcf5c, 12, 6);
          setToast('+$600 — kabur!');
          advanceStage();
          return EVENT_CASH;
        }
      }
    }
    // Taxi passenger waiting on the kerb.
    if (state.taxi && state.taxi.stage === 'wait') {
      const ped = state.peds.find((q) => q.id === state.taxi.pedId);
      if (ped && dist2(p.x, p.z, ped.x, ped.z) < 16) {
        state.taxi.stage = 'pickup';
        setMessage('Penumpang menunggu — naik mobil lalu dekati dia (E).');
        return EVENT_NONE;
      }
    }
    if (state.taxi && state.taxi.stage === 'pickup' && !p.onFoot) {
      const ped = state.peds.find((q) => q.id === state.taxi.pedId);
      if (ped && dist2(p.x, p.z, ped.x, ped.z) < 25) {
        state.taxi.stage = 'ride';
        ped.state = 'riding';
        setMessage(`Antar penumpang ke ${state.taxi.destName}.`);
        return EVENT_NONE;
      }
    }
    // Courier package.
    if (state.courier && state.courier.stage === 'pickup') {
      if (dist2(p.x, p.z, state.courier.target.x, state.courier.target.z) < 25) {
        state.courier.stage = 'deliver';
        state.courier.target = state.courier.dest;
        setMessage('Paket diambil — antar ke tujuan.');
        return EVENT_NONE;
      }
    }
    if (state.courier && state.courier.stage === 'deliver') {
      if (dist2(p.x, p.z, state.courier.target.x, state.courier.target.z) < 25) {
        state.money += state.courier.fare;
        state.stats.earned += state.courier.fare;
        setToast(`+$${state.courier.fare} ongkir`);
        state.courier = null;
        return EVENT_CASH;
      }
    }
    // Clinic: heal. Ammo shop: bullets. (Markers sit by the plaza and the market.)
    if (dist2(p.x, p.z, 30, 30) < 100 && state.money >= PRICES.health && state.health < PLAYER.health) {
      state.money -= PRICES.health;
      state.health = PLAYER.health;
      setToast(`-$${PRICES.health} — nyawa penuh`);
      return EVENT_CASH;
    }
    if (dist2(p.x, p.z, -60, 90) < 100 && state.money >= PRICES.ammo12) {
      state.money -= PRICES.ammo12;
      state.ammo += 12;
      setToast(`-$${PRICES.ammo12} — +12 peluru`);
      return EVENT_CASH;
    }
    // Enter the nearest parked car (no crime) or your own.
    const car = nearestCar(3.6);
    if (car && car.kind === 'parked') {
      car.kind = 'player';
      p.onFoot = false;
      p.carId = car.id;
      return EVENT_NONE;
    }
    return EVENT_NONE;
  }

  function doSteal() {
    const p = state.player;
    if (!p.onFoot) return EVENT_NONE;
    const car = nearestCar(3.6);
    if (!car) return EVENT_NONE;
    if (car.kind === 'parked') {
      car.kind = 'player';
      p.onFoot = false;
      p.carId = car.id;
      addWanted(WANTED.steal);
      state.stats.carsStolen += 1;
      state.stageData.stolen = true;
      setToast('Mobil dicuri! Wanted +1');
      return EVENT_WANTED;
    }
    if (car.kind === 'traffic') {
      car.kind = 'player';
      car.speed = 0;
      p.onFoot = false;
      p.carId = car.id;
      addWanted(WANTED.steal);
      state.stats.carsStolen += 1;
      state.stageData.stolen = true;
      setToast('Mobil dibajak! Wanted +1');
      return EVENT_WANTED;
    }
    return EVENT_NONE;
  }

  function doPunch() {
    const p = state.player;
    if (!p.onFoot || p.punchTimer > 0) return EVENT_NONE;
    p.punchTimer = 0.35;
    const rangeR = PLAYER.punchRange;
    let hit = false;
    for (const thug of state.thugs) {
      if (thug.state === 'down') continue;
      if (dist2(p.x, p.z, thug.x, thug.z) < rangeR * rangeR) {
        thug.hp -= PLAYER.punchDamage;
        spawnParticles(thug.x, 1.4, thug.z, 0xffe08a, 6, 5);
        if (thug.hp <= 0) {
          thug.state = 'down';
          spawnParticles(thug.x, 1, thug.z, 0x7a2e2e, 10, 6);
        }
        hit = true;
      }
    }
    if (!hit) {
      for (const ped of state.peds) {
        if (ped.state !== 'walk' && ped.state !== 'taxi') continue;
        if (dist2(p.x, p.z, ped.x, ped.z) < rangeR * rangeR) {
          ped.state = 'down';
          ped.downTimer = 8;
          addWanted(WANTED.punchPed);
          spawnParticles(ped.x, 1.2, ped.z, 0xd94f4f, 6, 5);
          hit = true;
          break;
        }
      }
    }
    return hit ? EVENT_HIT : EVENT_NONE;
  }

  function doShoot() {
    const p = state.player;
    if (!p.onFoot || p.shootTimer > 0) return EVENT_NONE;
    if (state.weapon !== 'pistol') return doPunch();
    if (state.ammo <= 0) {
      setMessage('Peluru habis — beli di Pasar Lama (E).');
      return EVENT_NONE;
    }
    p.shootTimer = 0.3;
    state.ammo -= 1;
    addWanted(WANTED.shoot);
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const rangeR = PLAYER.shootRange;
    let best = null;
    let bestD = rangeR * rangeR;
    for (const thug of state.thugs) {
      if (thug.state === 'down') continue;
      const dx = thug.x - p.x;
      const dz = thug.z - p.z;
      const d = dx * dx + dz * dz;
      const dot = dx * fx + dz * fz;
      if (d < bestD && dot > 0) {
        bestD = d;
        best = thug;
      }
    }
    if (best) {
      best.hp -= PLAYER.shootDamage;
      spawnParticles(best.x, 1.4, best.z, 0xff6a3c, 8, 6);
      if (best.hp <= 0) {
        best.state = 'down';
        spawnParticles(best.x, 1, best.z, 0x7a2e2e, 10, 6);
      }
    }
    spawnParticles(p.x + fx * 1.5, 1.4, p.z + fz * 1.5, 0xffd27a, 3, 3);
    return EVENT_HIT;
  }

  function updateTraffic(dt) {
    const p = state.player;
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      car.turnCd -= dt;
      if (car.stopTimer > 0) {
        car.stopTimer -= dt;
        car.speed = Math.max(0, car.speed - 20 * dt);
      } else {
        car.speed = Math.min(14, car.speed + 2 * dt);
      }
      // Turn at an intersection, sometimes.
      const along = car.axis === 'x' ? car.x : car.z;
      const nearCross = Math.abs(along - nearestRoad(along)) < 2.5;
      if (nearCross && car.turnCd <= 0 && random() < 0.02) {
        car.axis = car.axis === 'x' ? 'z' : 'x';
        car.dir = random() < 0.5 ? 1 : -1;
        car.turnCd = 4;
        car.angle = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : car.dir > 0 ? 0 : Math.PI;
      }
      // Stop for the car ahead and for a pedestrian in the way.
      let blocked = false;
      for (const other of state.cars) {
        if (other === car || other.kind === 'parked') continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const ahead = car.axis === 'x' ? dx * car.dir : dz * car.dir;
        const side = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
        if (ahead > 0 && ahead < 9 && side < 3) {
          blocked = true;
          break;
        }
      }
      if (!blocked && p.onFoot) {
        const dx = p.x - car.x;
        const dz = p.z - car.z;
        const ahead = car.axis === 'x' ? dx * car.dir : dz * car.dir;
        const side = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
        if (ahead > 0 && ahead < 7 && side < 2.5) blocked = true;
      }
      if (blocked) car.speed = Math.max(0, car.speed - 18 * dt);
      car.x = clampToCity(car.x + Math.sin(car.angle) * car.speed * dt);
      car.z = clampToCity(car.z + Math.cos(car.angle) * car.speed * dt);
      // At the city edge, turn around.
      if (Math.abs(car.x) > CITY.half - 10 || Math.abs(car.z) > CITY.half - 10) {
        car.dir *= -1;
        car.angle += Math.PI;
        car.x = clampToCity(car.x);
        car.z = clampToCity(car.z);
      }
    }
  }

  function updatePeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.state = 'walk';
          ped.x = clampToCity(ped.x + (random() - 0.5) * 4);
          ped.z = clampToCity(ped.z + (random() - 0.5) * 4);
        }
        continue;
      }
      if (ped.state === 'riding') continue;
      if (ped.state === 'flee') {
        const dx = ped.x - p.x;
        const dz = ped.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        ped.x = clampToCity(ped.x + (dx / d) * 4.5 * dt);
        ped.z = clampToCity(ped.z + (dz / d) * 4.5 * dt);
        ped.angle = Math.atan2(dx, dz);
        if (d > 25) ped.state = 'walk';
        continue;
      }
      // Walk the sidewalk; turn at intersections sometimes.
      const along = ped.axis === 'x' ? ped.x : ped.z;
      if (Math.abs(along - nearestRoad(along)) < 2 && random() < 0.004) {
        ped.axis = ped.axis === 'x' ? 'z' : 'x';
        ped.dir = random() < 0.5 ? 1 : -1;
      }
      const speed = ped.speed;
      if (ped.axis === 'x') {
        ped.x = clampToCity(ped.x + ped.dir * speed * dt);
        ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        ped.z = clampToCity(ped.z + ped.dir * speed * dt);
        ped.angle = ped.dir > 0 ? 0 : Math.PI;
      }
      ped.walkPhase += dt * speed * 2;
      if (Math.abs(ped.x) > CITY.half - 12 || Math.abs(ped.z) > CITY.half - 12) ped.dir *= -1;
      // Flee when the player throws a punch nearby.
      if (p.onFoot && p.punchTimer > 0.2 && dist2(ped.x, ped.z, p.x, p.z) < 100) ped.state = 'flee';
    }
  }

  function updatePolice(dt) {
    const p = state.player;
    const want = POLICE.count[state.wanted];
    const police = state.cars.filter((c) => c.kind === 'police');
    // Spawn what the wanted level calls for, at a road behind the player.
    while (police.length < want) {
      const angle = random() * Math.PI * 2;
      const sx = clampToCity(p.x + Math.cos(angle) * 75);
      const sz = clampToCity(p.z + Math.sin(angle) * 75);
      const car = makeCar(4000 + police.length + Math.floor(random() * 90), 'police', sx, sz, Math.atan2(p.x - sx, p.z - sz), 0xf2f2f2, random);
      car.speed = 10;
      state.cars.push(car);
      police.push(car);
    }
    // Despawn the surplus when the heat drops, and the far away.
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      const car = state.cars[i];
      if (car.kind !== 'police') continue;
      const d = Math.sqrt(dist2(car.x, car.z, p.x, p.z));
      if ((state.wanted === 0 && d > 40) || d > 220) {
        state.cars.splice(i, 1);
      }
    }
    let events = EVENT_NONE;
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      const dx = p.x - car.x;
      const dz = p.z - car.z;
      const d = Math.hypot(dx, dz) || 1;
      const wantAngle = Math.atan2(dx, dz);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const targetSpeed = POLICE.baseSpeed + POLICE.perStar * state.wanted;
      car.speed = Math.min(targetSpeed, car.speed + 8 * dt);
      car.x = clampToCity(car.x + Math.sin(car.angle) * car.speed * dt);
      car.z = clampToCity(car.z + Math.cos(car.angle) * car.speed * dt);
      const body = { x: car.x, z: car.z, radius: CAR.radius };
      collideBuildings(city, body);
      car.x = body.x;
      car.z = body.z;
      car.lightPhase += dt * 6;
      // Ram the player: on foot it hurts, in a car it kills speed.
      if (d < CAR.radius + 1.2) {
        if (!p.onFoot && state.policeRamCd <= 0) {
          const playerCar = state.cars.find((c) => c.id === p.carId);
          if (playerCar) playerCar.speed *= 0.35;
          state.policeRamCd = POLICE.ramCooldown;
          state.health -= 4;
          events |= EVENT_HIT;
        } else if (p.onFoot && state.policeRamCd <= 0) {
          state.health -= POLICE.ramDamage;
          state.policeRamCd = POLICE.ramCooldown;
          p.hurtTimer = 0.6;
          events |= EVENT_HIT;
        }
      }
    }
    return events;
  }

  function updateWanted(dt) {
    if (state.wanted === 0) return EVENT_NONE;
    const nearPolice = state.cars.some((c) => c.kind === 'police' && dist2(c.x, c.z, state.player.x, state.player.z) < 6400);
    if (state.time - state.lastCrime > WANTED.decaySeconds && !nearPolice) {
      state.wanted -= 1;
      state.lastCrime = state.time;
      setMessage(state.wanted === 0 ? 'Aman — polisi kehilangan jejakmu.' : `Wanted turun ke ${state.wanted} bintang.`);
      return EVENT_WANTED;
    }
    return EVENT_NONE;
  }

  function advanceStage() {
    const mission = MISSIONS[state.missionIndex];
    state.stageIndex += 1;
    state.stageData = {};
    if (state.stageIndex >= mission.stages.length) {
      state.money += mission.reward;
      state.stats.earned += mission.reward;
      state.stats.missionsDone += 1;
      setToast(`Misi selesai! +$${mission.reward}`);
      state.missionIndex += 1;
      state.stageIndex = 0;
      if (state.missionIndex >= MISSIONS.length) {
        state.won = true;
        state.wanted = 0;
      } else {
        const next = MISSIONS[state.missionIndex];
        setMessage(`${next.title} — ${next.briefing}`, 7);
        if (state.missionIndex === 2) {
          // Mission 3 starts hot: the police are already on Raka.
          state.wanted = 3;
          state.lastCrime = state.time;
          state.stageTimer = 45;
        }
        if (state.missionIndex === 4) spawnThugs();
      }
    }
  }

  function spawnThugs() {
    const target = { x: -120, z: 180 };
    state.thugs = [];
    for (let i = 0; i < 4; i += 1) {
      state.thugs.push({
        id: 5000 + i,
        x: target.x + range(random, -14, 14),
        z: target.z + range(random, -14, 14),
        angle: random() * Math.PI * 2,
        hp: 60,
        maxHp: 60,
        state: 'chase',
        speed: 3.4,
        attackCd: 0,
        boss: false,
        walkPhase: 0,
      });
    }
    // Bang Darto himself: tougher, slower, hits harder.
    state.thugs.push({
      id: 5099,
      x: target.x,
      z: target.z - 10,
      angle: 0,
      hp: 150,
      maxHp: 150,
      state: 'chase',
      speed: 2.6,
      attackCd: 0,
      boss: true,
      walkPhase: 0,
    });
  }

  function updateMissions(dt) {
    if (state.missionIndex >= MISSIONS.length) return EVENT_NONE;
    const stage = currentStage();
    if (!stage) return EVENT_NONE;
    const p = state.player;
    let events = EVENT_NONE;
    if (stage.kind === 'steal' && state.stageData.stolen) {
      advanceStage();
      return EVENT_MISSION;
    }
    if (stage.kind === 'survive') {
      state.stageTimer -= dt;
      if (state.stageTimer <= 0) {
        advanceStage();
        return EVENT_MISSION;
      }
      if (stage.target && dist2(p.x, p.z, stage.target.x, stage.target.z) < 36) {
        state.wanted = 0;
        advanceStage();
        return EVENT_MISSION;
      }
    }
    if (stage.kind === 'escape' && state.wanted === 0) {
      advanceStage();
      return EVENT_MISSION;
    }
    if (stage.kind === 'fight') {
      const alive = state.thugs.filter((t) => t.state !== 'down').length;
      if (state.thugs.length > 0 && alive === 0) {
        advanceStage();
        return EVENT_MISSION;
      }
      // Thugs chase and punch the player.
      for (const thug of state.thugs) {
        if (thug.state === 'down') continue;
        const dx = p.x - thug.x;
        const dz = p.z - thug.z;
        const d = Math.hypot(dx, dz) || 1;
        thug.attackCd -= dt;
        if (d < 26) {
          thug.angle = Math.atan2(dx, dz);
          if (d > 2.2) {
            thug.x = clampToCity(thug.x + (dx / d) * thug.speed * dt);
            thug.z = clampToCity(thug.z + (dz / d) * thug.speed * dt);
            thug.walkPhase += dt * 5;
          } else if (thug.attackCd <= 0) {
            thug.attackCd = 1.1;
            state.health -= thug.boss ? 14 : 8;
            p.hurtTimer = 0.5;
            events |= EVENT_HIT;
          }
        }
      }
    }
    return events;
  }

  function updateSideJobs(dt) {
    const p = state.player;
    // A taxi fare appears once the player is moving around, then again after each one.
    if (!state.taxi && state.missionIndex >= 1 && random() < dt * 0.02) {
      const ped = state.peds.find((q) => q.state === 'walk');
      if (ped) {
        ped.state = 'taxi';
        const dest = { x: pick(random, [-180, -60, 60, 180]), z: pick(random, [-180, -60, 60, 180]) };
        state.taxi = {
          pedId: ped.id,
          stage: 'wait',
          dest,
          destName: dest.x < -120 ? 'Pelabuhan' : dest.x > 60 ? 'Menara Kaca' : dest.z > 60 ? 'Pasar Lama' : 'Pantai Senja',
          fare: Math.floor(range(random, SIDE_JOBS.taxiFare[0], SIDE_JOBS.taxiFare[1])),
        };
        setMessage('Ada penumpang taksi menunggu (ikon $ di minimap). Dekati dia (E).');
      }
    }
    if (state.taxi && state.taxi.stage === 'ride') {
      if (dist2(p.x, p.z, state.taxi.dest.x, state.taxi.dest.z) < 36) {
        state.money += state.taxi.fare;
        state.stats.earned += state.taxi.fare;
        setToast(`+$${state.taxi.fare} ongkos taksi`);
        const ped = state.peds.find((q) => q.id === state.taxi.pedId);
        if (ped) {
          ped.state = 'walk';
          ped.x = p.x + 3;
          ped.z = p.z + 3;
        }
        state.taxi = null;
      }
    }
    // Courier packages spawn the same way, less often.
    if (!state.courier && state.missionIndex >= 1 && random() < dt * 0.008) {
      const target = { x: pick(random, [-150, -30, 90, 150]), z: pick(random, [-150, -30, 90, 150]) };
      const dest = { x: pick(random, [-180, 0, 120]), z: pick(random, [-180, 0, 180]) };
      state.courier = { stage: 'pickup', target, dest, fare: Math.floor(range(random, SIDE_JOBS.courierFare[0], SIDE_JOBS.courierFare[1])) };
      setMessage('Ada paket kurir — ambil di penanda kuning (E).');
    }
  }
}
