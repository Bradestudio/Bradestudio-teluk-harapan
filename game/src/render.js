// TELUK HARAPAN — drawing only: the world's state in, pixels out. Three.js builds the city
// once (ground texture, buildings, palms, cranes, lamps), then each frame moves the cars,
// people, beacon and camera. The HUD and the minimap are DOM + a small 2D canvas.
import { CITY, DAYS, MISSIONS, PALETTE, blockOrigin, districtAt, streetCenter } from './config.js';

const THREE = window.THREE;
const TAU = Math.PI * 2;

function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#20242e'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 14) {
    for (let x = 6; x < 58; x += 14) {
      const lit = ((x * 7 + y * 13) % 5) < 2;
      g.fillStyle = lit ? '#ffd98a' : '#12151d';
      g.fillRect(x, y, 9, 9);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeGroundTexture() {
  const S = 1024, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  const toPx = (v) => ((v + CITY.half) / (CITY.half * 2)) * S;
  g.fillStyle = '#23262e'; g.fillRect(0, 0, S, S); // asphalt base
  // Blocks: lighter slabs.
  for (let bx = 0; bx < CITY.blocks; bx += 1) {
    for (let bz = 0; bz < CITY.blocks; bz += 1) {
      const d = districtAt(bx, bz);
      const x = toPx(blockOrigin(bx)), z = toPx(blockOrigin(bz));
      const w = (60 / (CITY.half * 2)) * S;
      if (d.style === 'beach') { g.fillStyle = '#c9a86a'; }
      else if (d.style === 'civic') { g.fillStyle = '#6a6258'; }
      else { g.fillStyle = '#31353f'; }
      g.fillRect(x, z, w, w);
    }
  }
  // Lane dashes along every street.
  g.fillStyle = '#8a8f9a';
  for (let i = 0; i <= 7; i += 1) {
    const p = toPx(streetCenter(i));
    for (let t = -CITY.half + 10; t < CITY.half - 10; t += 16) {
      g.fillRect(toPx(t), p - 1.5, 8, 3);
      g.fillRect(p - 1.5, toPx(t), 3, 8);
    }
  }
  // Beach water strip at the south edge.
  g.fillStyle = '#1a4a6a';
  g.fillRect(0, S - 26, S, 26);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

function makeCar(color, police) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.0, 2.2), bodyMat);
  body.position.y = 0.7;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.9), new THREE.MeshLambertMaterial({ color: 0x1a2028 }));
  cabin.position.set(-0.3, 1.5, 0);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[1.5, 1.05], [1.5, -1.05], [-1.5, 1.05], [-1.5, -1.05]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    group.add(w);
    wheels.push(w);
  }
  let bar = null;
  if (police) {
    bar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.7), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    r.position.x = -0.3;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.7), new THREE.MeshBasicMaterial({ color: 0x2a5aff }));
    b.position.x = 0.3;
    bar.add(r); bar.add(b);
    bar.position.set(-0.3, 2.05, 0);
    group.add(bar);
  }
  return { group, wheels, bar };
}

function makePerson(jacket, pants) {
  const group = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.55), new THREE.MeshLambertMaterial({ color: jacket }));
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
  head.position.y = 2.0;
  group.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  for (const s of [-0.22, 0.22]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.7, 0.36), legMat);
    leg.position.set(0, 0.35, s);
    group.add(leg);
  }
  return group;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(DAYS[0].sky);
  scene.fog = new THREE.Fog(DAYS[0].fog, 120, 520);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x334, DAYS[0].hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(DAYS[0].sun, 1.1);
  sun.position.set(-80, 40, -60);
  scene.add(sun);

  // Ground with painted roads, blocks, dashes and the sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 80, CITY.half * 2 + 80),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 40);
  scene.add(ground);

  const windowTex = makeWindowTexture();
  const buildingMats = new Map();
  function buildingMaterial(color, h) {
    const bucket = h < 14 ? 1 : h < 34 ? 2 : 4;
    const key = `${color}:${bucket}`;
    if (!buildingMats.has(key)) {
      const tex = windowTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(2, bucket);
      buildingMats.set(key, new THREE.MeshLambertMaterial({ color, map: tex }));
    }
    return buildingMats.get(key);
  }
  const roofMats = new Map();
  function roofMaterial(color) {
    if (!roofMats.has(color)) roofMats.set(color, new THREE.MeshLambertMaterial({ color }));
    return roofMats.get(color);
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  let cityGroup = null;
  let beacon = null;
  let beaconRing = null;
  const carMeshes = new Map();
  const pedMeshes = [];
  const thugMeshes = new Map();
  const bulletPool = [];
  let playerMesh = null;
  let passengerMesh = null;
  const lampLights = [];

  function buildCity(state) {
    cityGroup = new THREE.Group();
    for (const b of state.buildings) {
      const m = new THREE.Mesh(boxGeo, buildingMaterial(b.color, b.h));
      m.scale.set(b.hw * 2, b.h, b.hd * 2);
      m.position.set(b.x, b.h / 2, b.z);
      cityGroup.add(m);
      const roof = new THREE.Mesh(boxGeo, roofMaterial(b.roof));
      roof.scale.set(b.hw * 2 + 0.6, 0.5, b.hd * 2 + 0.6);
      roof.position.set(b.x, b.h + 0.25, b.z);
      cityGroup.add(roof);
    }
    const palmTrunk = new THREE.CylinderGeometry(0.25, 0.4, 6, 6);
    const palmMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
    const palmTop = new THREE.ConeGeometry(2.6, 3.4, 7);
    const palmTopMat = new THREE.MeshLambertMaterial({ color: 0x3d7a3d });
    for (const p of state.palms) {
      const trunk = new THREE.Mesh(palmTrunk, palmMat);
      trunk.position.set(p.x, 3, p.z);
      cityGroup.add(trunk);
      const top = new THREE.Mesh(palmTop, palmTopMat);
      top.position.set(p.x, 7.4, p.z);
      cityGroup.add(top);
    }
    const craneMat = new THREE.MeshLambertMaterial({ color: 0xd9a02a });
    for (const cr of state.cranes) {
      const tower = new THREE.Mesh(boxGeo, craneMat);
      tower.scale.set(2, cr.h, 2);
      tower.position.set(cr.x, cr.h / 2, cr.z);
      cityGroup.add(tower);
      const arm = new THREE.Mesh(boxGeo, craneMat);
      arm.scale.set(22, 1.4, 1.4);
      arm.position.set(cr.x + 8, cr.h - 2, cr.z);
      cityGroup.add(arm);
    }
    const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
    const lampBulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const l of state.lamps) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), lampPoleMat);
      pole.position.set(l.x, 3.5, l.z);
      cityGroup.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampBulbMat);
      bulb.position.set(l.x, 7.1, l.z);
      cityGroup.add(bulb);
      lampLights.push(bulb);
    }
    // Mission beacon: a tall glowing column + a ground ring.
    beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 46, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: PALETTE.beacon, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    beacon.position.y = 23;
    cityGroup.add(beacon);
    beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.4, 24),
      new THREE.MeshBasicMaterial({ color: PALETTE.beacon, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.y = 0.15;
    cityGroup.add(beaconRing);
    scene.add(cityGroup);
  }

  function syncCars(state) {
    const seen = new Set();
    for (const car of state.cars) {
      seen.add(car.id);
      let entry = carMeshes.get(car.id);
      if (!entry) {
        entry = makeCar(car.color, car.kind === 'police');
        carMeshes.set(car.id, entry);
        scene.add(entry.group);
      }
      entry.group.position.set(car.x, 0, car.z);
      entry.group.rotation.y = -car.angle;
      for (const w of entry.wheels) w.rotation.z -= car.speed * 0.016;
      if (entry.bar) entry.bar.visible = Math.floor(state.time * 4) % 2 === 0;
      entry.group.visible = true;
    }
    for (const [id, entry] of carMeshes) {
      if (!seen.has(id)) { scene.remove(entry.group); carMeshes.delete(id); }
    }
  }
  function syncPeds(state) {
    while (pedMeshes.length < state.peds.length) {
      const g = makePerson(state.peds[pedMeshes.length].color, 0x2a2a33);
      pedMeshes.push(g);
      scene.add(g);
    }
    state.peds.forEach((ped, i) => {
      const g = pedMeshes[i];
      g.position.set(ped.x, 0, ped.z);
      g.rotation.y = -ped.angle;
    });
  }
  function syncThugs(state) {
    const seen = new Set();
    for (const t of state.thugs) {
      seen.add(t);
      let g = thugMeshes.get(t);
      if (!g) {
        g = makePerson(t.boss ? PALETTE.boss : PALETTE.thug, 0x1a1a1a);
        if (t.boss) g.scale.set(1.35, 1.35, 1.35);
        thugMeshes.set(t, g);
        scene.add(g);
      }
      g.position.set(t.x, 0, t.z);
      g.rotation.y = -t.angle;
      g.visible = t.flash <= 0 || Math.floor(state.time * 20) % 2 === 0;
    }
    for (const [t, g] of thugMeshes) {
      if (!seen.has(t)) { scene.remove(g); thugMeshes.delete(t); }
    }
  }
  function syncBullets(state) {
    while (bulletPool.length < 24) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
      m.visible = false;
      bulletPool.push(m);
      scene.add(m);
    }
    state.bullets.forEach((b, i) => {
      const m = bulletPool[i];
      m.visible = true;
      m.position.set(b.x, 1.2, b.z);
    });
    for (let i = state.bullets.length; i < bulletPool.length; i += 1) bulletPool[i].visible = false;
  }

  // ---- HUD (DOM) + minimap (2D canvas) ----
  const el = (id) => document.getElementById(id);
  const hud = { money: el('hud-money'), hp: el('hud-hp'), hpBar: el('hud-hpbar'), wanted: el('hud-wanted'), mission: el('hud-mission'), district: el('hud-district'), day: el('hud-day'), speed: el('hud-speed'), ammo: el('hud-ammo'), msg: el('hud-msg'), banner: el('hud-banner') };
  const mini = el('minimap');
  const miniCtx = mini ? mini.getContext('2d') : null;

  function drawMinimap(state) {
    if (!miniCtx) return;
    const S = mini.width, k = S / (CITY.half * 2 + 20);
    const px = (x) => (x + CITY.half + 10) * k;
    const pz = (z) => (z + CITY.half + 10) * k;
    miniCtx.fillStyle = '#14161c';
    miniCtx.fillRect(0, 0, S, S);
    miniCtx.strokeStyle = '#3a3e48';
    miniCtx.lineWidth = 4;
    for (let i = 0; i <= 7; i += 1) {
      miniCtx.beginPath(); miniCtx.moveTo(px(streetCenter(i)), 0); miniCtx.lineTo(px(streetCenter(i)), S); miniCtx.stroke();
      miniCtx.beginPath(); miniCtx.moveTo(0, pz(streetCenter(i))); miniCtx.lineTo(S, pz(streetCenter(i))); miniCtx.stroke();
    }
    miniCtx.fillStyle = '#2fae5a';
    for (const s of state.shops) { miniCtx.fillRect(px(s.x) - 3, pz(s.z) - 3, 6, 6); }
    if (state.mission.target) {
      miniCtx.fillStyle = '#ffd34d';
      miniCtx.beginPath(); miniCtx.arc(px(state.mission.target.x), pz(state.mission.target.z), 6, 0, TAU); miniCtx.fill();
    }
    for (const c of state.cars) {
      if (c.kind === 'police') { miniCtx.fillStyle = '#ff2a2a'; miniCtx.beginPath(); miniCtx.arc(px(c.x), pz(c.z), 3.5, 0, TAU); miniCtx.fill(); }
    }
    for (const t of state.thugs) {
      miniCtx.fillStyle = '#ff7a2a';
      miniCtx.beginPath(); miniCtx.arc(px(t.x), pz(t.z), 3, 0, TAU); miniCtx.fill();
    }
    const p = state.player;
    miniCtx.fillStyle = '#37c8e8';
    miniCtx.beginPath(); miniCtx.arc(px(p.x), pz(p.z), 5, 0, TAU); miniCtx.fill();
    miniCtx.strokeStyle = '#37c8e8';
    miniCtx.beginPath(); miniCtx.moveTo(px(p.x), pz(p.z));
    miniCtx.lineTo(px(p.x) + Math.cos(p.angle) * 12, pz(p.z) + Math.sin(p.angle) * 12); miniCtx.stroke();
  }

  function updateHud(state, screen) {
    const p = state.player;
    const def = state.mission;
    if (hud.money) hud.money.textContent = `$${p.money}`;
    if (hud.hp) hud.hp.textContent = `❤ ${Math.max(0, Math.round(p.hp))}`;
    if (hud.hpBar) hud.hpBar.style.width = `${Math.max(0, p.hp)}%`;
    if (hud.wanted) hud.wanted.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    if (hud.day) hud.day.textContent = DAYS[state.day].name;
    if (hud.mission) {
      const m = state.mission;
      const t = m.target ? ` — ${Math.round(Math.hypot(p.x - m.target.x, p.z - m.target.z))}m` : '';
      const timer = m.timer > 0 ? ` — ${Math.ceil(m.timer)}s` : '';
      hud.mission.textContent = `${m.index + 1}/12 ${MISSIONS[m.index].name}${state.mission.phase === 'race' ? ` — Titik ${m.checkpoint + 1}/4` : ''}${t}${timer}`;
    }
    if (hud.district) hud.district.textContent = '';
    if (hud.speed) hud.speed.textContent = p.inCar !== null ? `${Math.round(Math.abs(p.speed) * 3.6)} km/j` : '';
    if (hud.ammo) hud.ammo.textContent = `▸ ${p.ammo}`;
    if (hud.msg) hud.msg.textContent = state.message;
    if (hud.banner) hud.banner.style.display = screen === 'title' || screen === 'over' || screen === 'win' ? 'flex' : 'none';
  }

  let built = false;
  let camYaw = 0, camPitch = 0.42, camDist = 15;
  let shotCamera = null;
  function setDay(day) {
    const d = DAYS[day];
    scene.background.set(d.sky);
    scene.fog.color.set(d.fog);
    hemi.intensity = d.hemi;
    sun.color.set(d.sun);
    sun.position.set(d.sunPos[0], d.sunPos[1], d.sunPos[2]);
  }
  function addLook(dx, dy) {
    camYaw += dx * 0.005;
    camPitch = Math.max(0.12, Math.min(1.1, camPitch + dy * 0.005));
  }
  function setShotCamera(x, y, z, tx, ty, tz) { shotCamera = { x, y, z, tx, ty, tz }; }
  function clearShotCamera() { shotCamera = null; }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function draw(state, screen, time) {
    if (!built) { buildCity(state); built = true; }
    setDay(state.day);
    const p = state.player;
    if (!playerMesh) {
      playerMesh = makePerson(PALETTE.playerJacket, 0x2a3a55);
      scene.add(playerMesh);
    }
    playerMesh.visible = p.inCar === null && screen !== 'title';
    playerMesh.position.set(p.x, 0, p.z);
    playerMesh.rotation.y = -p.angle;
    if (state.passenger) {
      if (!passengerMesh) { passengerMesh = makePerson(0xe8b93d, 0x2a2a33); scene.add(passengerMesh); }
      passengerMesh.visible = true;
      passengerMesh.position.set(state.passenger.x, 0, state.passenger.z);
    } else if (passengerMesh) passengerMesh.visible = false;
    syncCars(state);
    syncPeds(state);
    syncThugs(state);
    syncBullets(state);
    if (beacon && state.mission.target) {
      beacon.visible = true;
      beaconRing.visible = true;
      beacon.position.set(state.mission.target.x, 23, state.mission.target.z);
      beaconRing.position.set(state.mission.target.x, 0.15, state.mission.target.z);
      const s = 1 + Math.sin(time * 3) * 0.12;
      beaconRing.scale.set(s, s, 1);
    } else if (beacon) { beacon.visible = false; beaconRing.visible = false; }

    if (shotCamera) {
      camera.position.set(shotCamera.x, shotCamera.y, shotCamera.z);
      camera.lookAt(shotCamera.tx, shotCamera.ty, shotCamera.tz);
    } else if (screen === 'title') {
      const a = time * 0.05;
      camera.position.set(Math.cos(a) * 210, 85, Math.sin(a) * 210);
      camera.lookAt(0, 10, 0);
    } else {
      const cy = p.angle + Math.PI + camYaw;
      // Pull the camera in when a building stands behind the player, so the view
      // never ends up inside a wall (which renders as a dark void).
      const inBuilding = (x, z) => {
        for (const b of state.buildings) {
          if (Math.abs(x - b.x) < b.hw + 1 && Math.abs(z - b.z) < b.hd + 1) return true;
        }
        return false;
      };
      let dist = camDist;
      for (let i = 0; i < 5 && dist > 4 && inBuilding(p.x + Math.cos(cy) * Math.cos(camPitch) * dist, p.z + Math.sin(cy) * Math.cos(camPitch) * dist); i += 1) dist = Math.max(4, dist * 0.5);
      const cx = p.x + Math.cos(cy) * Math.cos(camPitch) * dist;
      const cz = p.z + Math.sin(cy) * Math.cos(camPitch) * dist;
      const cyy = 2 + Math.sin(camPitch) * dist;
      camera.position.set(cx, cyy, cz);
      camera.lookAt(p.x + Math.cos(p.angle) * 6, 2, p.z + Math.sin(p.angle) * 6);
    }
    renderer.render(scene, camera);
    drawMinimap(state);
    updateHud(state, screen);
  }

  window.addEventListener('resize', resize);
  resize();
  return { draw, resize, setDay, addLook, setShotCamera, clearShotCamera };
}
