// City + actors for TELUK HARAPAN Round 2. Builds the whole 3D city into a THREE
// group (roads, districts, buildings, props, traffic, pedestrians), owns the
// colliders, and updates traffic / pedestrians / thugs / police every frame.
// All geometry is generated here from boxes, cylinders and spheres — no assets.
import { CITY, COLORS, DISTRICTS } from './config.js';
import { mulberry32, pick, range, rangeInt } from './random.js';

const T = () => window.THREE;

function box(w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
  const THREE = T();
  const mat = new THREE.MeshLambertMaterial({ color, emissive: opts.emissive || 0x000000, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  return m;
}

function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 10) {
  const THREE = T();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  return m;
}

function makeCarMesh(color, kind = 'civil') {
  const THREE = T();
  const g = new THREE.Group();
  const body = box(2.0, 0.65, 4.4, color, 0, 0.55, 0);
  const cabin = box(1.7, 0.55, 2.2, kind === 'police' ? 0xeeeeee : 0x222831, 0, 1.15, -0.2);
  g.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
  }
  if (kind === 'police') {
    g.add(box(2.02, 0.18, 0.9, 0x1a4ad8, 0, 0.75, 0.6));
    const bar = box(1.2, 0.18, 0.5, 0x2233ff, 0, 1.5, -0.2, { emissive: 0x2233ff });
    bar.name = 'lightbar';
    g.add(bar);
  }
  if (kind === 'taxi') {
    g.add(box(0.9, 0.25, 0.5, 0xf2c200, 0, 1.55, -0.2, { emissive: 0xaa8800 }));
  }
  return g;
}

function makePersonMesh(shirt, pants = 0x2a2a33, skin = 0xc98e6a) {
  const THREE = T();
  const g = new THREE.Group();
  const legs = box(0.5, 0.8, 0.3, pants, 0, 0.4, 0);
  const torso = box(0.62, 0.75, 0.36, shirt, 0, 1.15, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.set(0, 1.72, 0);
  const hair = box(0.5, 0.14, 0.5, 0x181410, 0, 1.9, 0);
  g.add(legs, torso, head, hair);
  return g;
}

function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[4];
}

export function createWorld(seed = 1) {
  const THREE = T();
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const colliders = [];
  const lamps = [];

  // ---- ground ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshLambertMaterial({ color: COLORS.ground }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
  group.add(ground);
  // beach sand
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(250, 190), new THREE.MeshLambertMaterial({ color: COLORS.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(125, 0.0, 155);
  group.add(sand);
  // water: east of harbor (x < -250) and south of beach (z > 250)
  const waterMat = new THREE.MeshLambertMaterial({ color: COLORS.water });
  const w1 = new THREE.Mesh(new THREE.PlaneGeometry(60, 520), waterMat);
  w1.rotation.x = -Math.PI / 2; w1.position.set(-280, 0.02, 0);
  const w2 = new THREE.Mesh(new THREE.PlaneGeometry(520, 60), waterMat);
  w2.rotation.x = -Math.PI / 2; w2.position.set(0, 0.02, 280);
  group.add(w1, w2);
  // plaza concrete
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(240, 120), new THREE.MeshLambertMaterial({ color: COLORS.plaza }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.01, 0);
  group.add(plaza);

  // ---- roads (grid) ----
  const roadMat = new THREE.MeshLambertMaterial({ color: COLORS.road });
  const roadLines = [];
  for (let c = -240; c <= 240; c += 60) roadLines.push(c);
  for (const c of roadLines) {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(500, 10), roadMat);
    a.rotation.x = -Math.PI / 2; a.position.set(0, 0.03, c);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(10, 500), roadMat);
    b.rotation.x = -Math.PI / 2; b.position.set(c, 0.03, 0);
    group.add(a, b);
  }
  // dashed center lines
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
  for (const c of roadLines) {
    for (let p = -230; p <= 230; p += 20) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(1, 5), dashMat);
      d1.rotation.x = -Math.PI / 2; d1.position.set(p, 0.05, c);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 1), dashMat);
      d2.rotation.x = -Math.PI / 2; d2.position.set(c, 0.05, p);
      group.add(d1, d2);
    }
  }

  // ---- window texture for towers ----
  const winCanvas = document.createElement('canvas');
  winCanvas.width = 64; winCanvas.height = 128;
  const wc = winCanvas.getContext('2d');
  wc.fillStyle = '#2a4a66'; wc.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 124; y += 10) for (let x = 4; x < 60; x += 10) {
    wc.fillStyle = (x + y) % 30 === 0 ? '#ffe9a8' : '#9fd4ff';
    wc.fillRect(x, y, 6, 6);
  }
  const winTex = new THREE.CanvasTexture(winCanvas);

  function addCollider(x0, z0, x1, z1) { colliders.push({ x0, z0, x1, z1 }); }

  function addBuilding(cx, cz, w, h, d, color, opts = {}) {
    let mesh;
    if (opts.glass) {
      const mat = new THREE.MeshLambertMaterial({ color: COLORS.glass, map: winTex, emissive: 0x223344 });
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    } else {
      mesh = box(w, h, d, color, 0, 0, 0);
    }
    mesh.position.set(cx, h / 2, cz);
    if (opts.ry) mesh.rotation.y = opts.ry;
    group.add(mesh);
    addCollider(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
    // rooftop box
    if (opts.roof) group.add(box(w * 0.4, 2, d * 0.4, 0x555555, cx, h + 1, cz));
    return mesh;
  }

  function addTree(x, z, palm = false) {
    if (palm) {
      group.add(cyl(0.25, 0.4, 7, 0x8a6a42, x, 3.5, z, 7));
      for (let i = 0; i < 5; i += 1) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 4), new THREE.MeshLambertMaterial({ color: 0x2e8a3a }));
        const a = (i / 5) * Math.PI * 2;
        leaf.position.set(x + Math.cos(a) * 1.6, 7.6, z + Math.sin(a) * 1.6);
        leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1;
        group.add(leaf);
      }
    } else {
      group.add(cyl(0.3, 0.45, 3, 0x6a4a2a, x, 1.5, z, 7));
      const top = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), new THREE.MeshLambertMaterial({ color: 0x3f7a3a }));
      top.position.set(x, 4.6, z);
      group.add(top);
    }
  }

  function addLamp(x, z) {
    group.add(cyl(0.12, 0.16, 5, 0x333338, x, 2.5, z, 6));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffd27a }));
    bulb.position.set(x, 5.1, z);
    group.add(bulb);
    lamps.push({ x, z });
  }

  // ---- city blocks ----
  for (let i = -4; i <= 3; i += 1) {
    for (let j = -4; j <= 3; j += 1) {
      const cx = i * 60 + 30, cz = j * 60 + 30;
      const d = districtAt(cx, cz);
      if (d.kind === 'plaza') continue; // handled below
      if (d.kind === 'beach') {
        // palms + huts, sparse
        for (let k = 0; k < 3; k += 1) addTree(cx + range(rng, -20, 20), cz + range(rng, -20, 20), rng() < 0.7);
        if (rng() < 0.6) {
          addBuilding(cx, cz, 10, 5, 8, pick(rng, [0xd8a24a, 0xc96f4a, 0x7a9a6a]), { roof: true });
          group.add(box(12, 0.4, 10, 0x8a5a2a, cx, 5.4, cz, { ry: 0.3 }));
        }
        continue;
      }
      if (d.kind === 'harbor') {
        // containers + warehouse + crane
        const n = rangeInt(rng, 2, 4);
        for (let k = 0; k < n; k += 1) {
          const cc = pick(rng, [0xc23a2e, 0x2e6ac2, 0xd8a24a, 0x3a8a4a]);
          addBuilding(cx + range(rng, -14, 14), cz + range(rng, -14, 14), 12, 3, 4, cc);
        }
        if (rng() < 0.5) addBuilding(cx, cz, 22, 8, 16, 0x8a8a92, { roof: true });
        continue;
      }
      if (d.kind === 'cbd') {
        const h = range(rng, 38, 88);
        addBuilding(cx, cz, range(rng, 16, 22), h, range(rng, 16, 22), COLORS.glass, { glass: true, roof: true });
        if (rng() < 0.4) addBuilding(cx + 18, cz + 14, 10, range(rng, 12, 24), 10, COLORS.glassDark, { glass: true });
        continue;
      }
      if (d.kind === 'warehouse') {
        addBuilding(cx, cz, range(rng, 24, 34), range(rng, 9, 14), range(rng, 20, 28), pick(rng, [0x9a9aa2, 0x7a7a82, 0xb0a89a]), { roof: true });
        continue;
      }
      if (d.kind === 'market') {
        // shophouses in a row
        for (let k = -1; k <= 1; k += 1) {
          addBuilding(cx + k * 14, cz, 12, range(rng, 8, 13), 12, pick(rng, COLORS.buildingPalette));
          group.add(box(13, 0.3, 4, pick(rng, [0xd83a2e, 0x2e8a3a, 0xe8c832]), cx + k * 14, range(rng, 4, 5), cz + 7));
        }
        continue;
      }
      // homes
      for (let k = 0; k < 2; k += 1) {
        const hx = cx + range(rng, -16, 16), hz = cz + range(rng, -16, 16);
        addBuilding(hx, hz, 9, 5, 8, pick(rng, COLORS.buildingPalette), { roof: false });
        const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 3.5, 4), new THREE.MeshLambertMaterial({ color: 0x8a3a2a }));
        roof.position.set(hx, 6.7, hz); roof.rotation.y = Math.PI / 4;
        group.add(roof);
        addTree(hx + 8, hz + 6);
      }
    }
  }

  // ---- plaza: fountain, city hall, lamps, benches ----
  const fountain = cyl(6, 7, 1.2, 0x9a9aa2, 0, 0.6, 0, 16);
  group.add(fountain);
  const waterDisc = cyl(5.2, 5.2, 0.3, COLORS.water, 0, 1.3, 0, 16);
  group.add(waterDisc);
  addCollider(-7, -7, 7, 7);
  addBuilding(-90, 30, 30, 16, 22, 0xd8d0c0, { roof: true }); // city hall
  const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x4a7a9a }));
  dome.position.set(-90, 16, 30);
  group.add(dome);
  for (const [lx, lz] of [[-30, -30], [30, -30], [-30, 30], [30, 30], [-60, 0], [60, 0], [0, -50], [0, 50]]) addLamp(lx, lz);
  for (const [bx, bz] of [[-20, 20], [20, 20], [-20, -20], [20, -20]]) group.add(box(4, 1, 1.4, 0x6a4a2a, bx, 0.5, bz));

  // harbor cranes
  for (const [cx, cz] of [[-210, -210], [-150, -230]]) {
    group.add(box(3, 34, 3, 0xd8a24a, cx, 17, cz));
    group.add(box(26, 2.5, 2.5, 0xd8a24a, cx + 10, 32, cz));
    addCollider(cx - 2, cz - 2, cx + 2, cz + 2);
  }
  // beach boardwalk
  group.add(box(240, 0.4, 6, 0x8a6a42, 125, 0.2, 62));

  // ---- mission beacon (reused, moved by main.js) ----
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 34, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 17;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15;
  beacon.add(beam, ring);
  beacon.visible = false;
  group.add(beacon);

  // ---- vehicles ----
  const cars = [];
  function addCar(x, z, angle, kind, color) {
    const mesh = makeCarMesh(color ?? pick(rng, COLORS.carPalette), kind);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = angle;
    group.add(mesh);
    const car = { mesh, x, z, angle, speed: 0, kind, color, hp: 100, driver: kind === 'traffic', axis: Math.abs(Math.sin(angle)) > 0.7 ? 'x' : 'z', dir: rng() < 0.5 ? 1 : -1, lane: (rng() < 0.5 ? -1 : 1) * 2.5, cruise: range(rng, 8, 14), active: true };
    cars.push(car);
    return car;
  }
  // traffic: 24 cars on roads
  for (let i = 0; i < 24; i += 1) {
    const horizontal = rng() < 0.5;
    const road = pick(rng, [-180, -120, -60, 0, 60, 120, 180]);
    const along = range(rng, -230, 230);
    addCar(horizontal ? along : road, horizontal ? road : along, horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2), 'traffic');
  }
  // parked cars (stealable): 12
  const parked = [];
  for (let i = 0; i < 12; i += 1) {
    const road = pick(rng, [-180, -120, -60, 0, 60, 120, 180]);
    const along = range(rng, -220, 220);
    const horizontal = rng() < 0.5;
    const c = addCar(horizontal ? along : road + 7, horizontal ? road + 7 : along, horizontal ? 0 : Math.PI / 2, 'parked');
    c.driver = false;
    parked.push(c);
  }
  // one taxi waiting at the plaza
  const taxi = addCar(36, 24, Math.PI / 2, 'taxi', COLORS.taxi);

  // ---- pedestrians ----
  const peds = [];
  const shirtColors = [0xd83a2e, 0x2e6ad8, 0xe8c832, 0x3aa84a, 0xe8e8e8, 0x8a4ad8, 0xd87a2e, 0x4a9a8a];
  for (let i = 0; i < 30; i += 1) {
    const mesh = makePersonMesh(pick(rng, shirtColors));
    const x = range(rng, -230, 230), z = range(rng, -230, 230);
    mesh.position.set(x, 0, z);
    group.add(mesh);
    peds.push({ mesh, x, z, angle: range(rng, 0, Math.PI * 2), speed: range(rng, 1.2, 2.4), tx: x, tz: z, wait: 0 });
  }

  // ---- thugs (spawned by missions) ----
  const thugs = [];
  function spawnThug(x, z, hp = 60, boss = false) {
    const mesh = makePersonMesh(boss ? 0x111111 : 0x8a1a1a, 0x222222);
    if (boss) mesh.scale.set(1.25, 1.25, 1.25);
    mesh.position.set(x, 0, z);
    group.add(mesh);
    const thug = { mesh, x, z, hp, maxHp: hp, boss, angle: 0, cooldown: 0, alive: true };
    thugs.push(thug);
    return thug;
  }
  function spawnPoliceCar(x, z) {
    const car = addCar(x, z, 0, 'police', 0xeeeeee);
    car.driver = true; car.cruise = 22;
    return car;
  }

  // ---- collision: circle vs AABB, plus bounds ----
  function collide(x, z, r) {
    const H = CITY.half;
    x = Math.max(-H + r, Math.min(H - r, x));
    z = Math.max(-H + r, Math.min(H - r, z));
    for (const c of colliders) {
      const nx = Math.max(c.x0, Math.min(x, c.x1));
      const nz = Math.max(c.z0, Math.min(z, c.z1));
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r; z = nz + (dz / d) * r;
        } else {
          x += r; // inside: push out along +x
        }
      }
    }
    return { x, z };
  }

  function nearestRoadPoint(x, z) {
    // snap to nearest road line for traffic cars
    const rx = Math.round(x / 60) * 60;
    const rz = Math.round(z / 60) * 60;
    return Math.abs(x - rx) < Math.abs(z - rz) ? { x: rx, z } : { x, z: rz };
  }

  function update(dt, player, wanted) {
    // traffic: drive along roads, turn at intersections sometimes
    for (const car of cars) {
      if (!car.active || car.kind !== 'traffic') continue;
      car.speed = car.cruise;
      let nx = car.x, nz = car.z;
      if (car.axis === 'x') nx += car.dir * car.speed * dt;
      else nz += car.dir * car.speed * dt;
      // at an intersection, sometimes turn
      const atX = Math.abs(nx % 60) < 1.2, atZ = Math.abs(nz % 60) < 1.2;
      if ((car.axis === 'x' && atX && Math.abs(nz % 60) < 1.2) || (car.axis === 'z' && atZ && Math.abs(nx % 60) < 1.2)) {
        if (rng() < 0.02) {
          car.axis = car.axis === 'x' ? 'z' : 'x';
          car.dir = rng() < 0.5 ? 1 : -1;
        }
      }
      if (nx > 245 || nx < -245 || nz > 245 || nz < -245) {
        // wrap to the other side on the same road
        if (car.axis === 'x') nx = -nx * 0.98; else nz = -nz * 0.98;
      }
      // keep on the road line (lane offset)
      if (car.axis === 'x') nz = Math.round(nz / 60) * 60 + car.lane;
      else nx = Math.round(nx / 60) * 60 + car.lane;
      car.x = nx; car.z = nz;
      car.angle = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.angle;
    }
    // pedestrians wander
    for (const p of peds) {
      const dx = p.tx - p.x, dz = p.tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) {
        if (p.wait > 0) { p.wait -= dt; continue; }
        p.tx = range(rng, -230, 230); p.tz = range(rng, -230, 230); p.wait = range(rng, 0, 2);
        continue;
      }
      const step = (p.speed * dt) / d;
      let nx = p.x + dx * step, nz = p.z + dz * step;
      const c = collide(nx, nz, 0.5);
      p.x = c.x; p.z = c.z;
      p.angle = Math.atan2(dx, dz);
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.angle;
      // simple leg swing
      p.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.008 + p.x)) * 0.05;
    }
    // thugs chase + punch
    for (const th of thugs) {
      if (!th.alive) continue;
      const dx = player.x - th.x, dz = player.z - th.z;
      const d = Math.hypot(dx, dz);
      th.cooldown = Math.max(0, th.cooldown - dt);
      if (d < 26 && d > 1.6) {
        const sp = th.boss ? 4.6 : 3.6;
        const nx = th.x + (dx / d) * sp * dt, nz = th.z + (dz / d) * sp * dt;
        const c = collide(nx, nz, 0.6);
        th.x = c.x; th.z = c.z;
        th.angle = Math.atan2(dx, dz);
      }
      th.mesh.position.set(th.x, 0, th.z);
      th.mesh.rotation.y = th.angle;
    }
    // police lightbar flash
    const flash = Math.floor(performance.now() / 180) % 2 === 0;
    for (const car of cars) {
      if (car.kind !== 'police' || !car.active) continue;
      const bar = car.mesh.getObjectByName('lightbar');
      if (bar) bar.material.emissive.setHex(flash ? 0xff2222 : 0x2233ff);
    }
    // beacon pulse
    if (beacon.visible) {
      const s = 1 + Math.sin(performance.now() * 0.004) * 0.15;
      ring.scale.set(s, s, 1);
    }
  }

  return {
    group, colliders, cars, parked, taxi, peds, thugs, lamps, beacon,
    districtAt, collide, nearestRoadPoint, update,
    spawnThug, spawnPoliceCar,
  };
}
