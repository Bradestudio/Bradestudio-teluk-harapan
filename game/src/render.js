// Drawing only: the world's state and the current screen in, pixels out.
// three.js (vendored UMD) paints the sunset city; a DOM HUD shows money, health,
// wanted stars, the mission and speed; a 2D canvas draws the minimap.

import { CITY, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const SCALE = 180 / (CITY.half * 2);

function makeCanvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function buildingTexture(glass) {
  return makeCanvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 12;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const lit = ((r * 7 + c * 13) % 5) === 0;
        ctx.fillStyle = glass ? (lit ? '#ffe9a8' : '#274b63') : lit ? '#ffe9a8' : '#3a4a5a';
        ctx.fillRect(8 + c * 20, 10 + r * 20, 12, 12);
      }
    }
  });
}

function roadTexture() {
  const tex = makeCanvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#33333a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(w / 2 - 2, 6, 4, 22);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function hexColor(value) {
  return `#${value.toString(16).padStart(6, '0')}`;
}

export function createRenderer(canvas, world) {
  const THREE = window.THREE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 180, 520);

  const hemi = new THREE.HemisphereLight(0x9db4d6, 0x3a2f28, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.6);
  sun.position.set(-140, 110, -90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 600;
  scene.add(sun);

  // The low sun itself, a flat disc over the sea.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffdf8a, fog: false }),
  );
  sunDisc.position.set(-60, 42, -330);
  sunDisc.lookAt(0, 42, 0);
  scene.add(sunDisc);

  const city = world.city;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const glassTex = buildingTexture(true);
  const wallTex = buildingTexture(false);
  const buildingMats = new Map();
  function buildingMaterial(color, glass) {
    const key = `${color}:${glass}`;
    if (!buildingMats.has(key)) {
      buildingMats.set(key, new THREE.MeshLambertMaterial({ map: glass ? glassTex : wallTex, color }));
    }
    return buildingMats.get(key);
  }
  for (const b of city.buildings) {
    const mesh = new THREE.Mesh(boxGeo, buildingMaterial(b.color, b.glass));
    mesh.scale.set(b.w, b.h, b.d);
    mesh.position.set(b.x, b.h / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    // A flat roof cap so the top reads as a roof, not a stretched wall.
    const cap = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2e2a26 }));
    cap.scale.set(b.w + 0.4, 0.4, b.d + 0.4);
    cap.position.set(b.x, b.h + 0.2, b.z);
    scene.add(cap);
  }

  // Ground, roads, sidewalks, beach and sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2, CITY.half * 2),
    new THREE.MeshLambertMaterial({ color: 0x6a6a72 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadTex = roadTexture();
  roadTex.repeat.set(32, 1);
  for (const road of city.roads) {
    for (const horizontal of [true, false]) {
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(CITY.half * 2, CITY.roadWidth),
        new THREE.MeshLambertMaterial({ map: roadTex }),
      );
      strip.rotation.x = -Math.PI / 2;
      if (horizontal) strip.rotation.z = Math.PI / 2;
      strip.position.set(horizontal ? road : 0, 0.02, horizontal ? 0 : road);
      strip.receiveShadow = true;
      scene.add(strip);
      for (const side of [-1, 1]) {
        const walk = new THREE.Mesh(
          new THREE.PlaneGeometry(CITY.half * 2, CITY.sidewalk),
          new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk }),
        );
        walk.rotation.x = -Math.PI / 2;
        if (horizontal) walk.rotation.z = Math.PI / 2;
        const off = CITY.roadWidth / 2 + CITY.sidewalk / 2;
        // Roads running along Z sit at x = road; roads along X sit at z = road.
        walk.position.set(horizontal ? road + side * off : 0, 0.03, horizontal ? 0 : road + side * off);
        walk.receiveShadow = true;
        scene.add(walk);
      }
    }
  }

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2, 40),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.02, -220);
  beach.receiveShadow = true;
  scene.add(beach);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 160, 120),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.6, -300);
  scene.add(sea);

  // Plaza fountain and park grass.
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x7fa8c9 }),
  );
  plaza.position.set(30, 0.6, 30);
  scene.add(plaza);
  const park = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 52),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  park.rotation.x = -Math.PI / 2;
  park.position.set(-30, 0.02, -90);
  park.receiveShadow = true;
  scene.add(park);

  // Trees and palms, containers and market stalls.
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 2.4, 6);
  const leafGeo = new THREE.SphereGeometry(1.6, 8, 6);
  const palmLeafGeo = new THREE.ConeGeometry(1.8, 3.2, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x4a7a3a });
  const palmMat = new THREE.MeshLambertMaterial({ color: 0x3f8a4a });
  for (const tree of city.trees) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.scale.setScalar(tree.scale);
    trunk.position.set(tree.x, 1.2 * tree.scale, tree.z);
    trunk.castShadow = true;
    scene.add(trunk);
    if (tree.palm) {
      for (let i = 0; i < 5; i += 1) {
        const leaf = new THREE.Mesh(palmLeafGeo, palmMat);
        leaf.scale.setScalar(tree.scale);
        leaf.position.set(tree.x, 3.0 * tree.scale, tree.z);
        leaf.rotation.z = 0.9;
        leaf.rotation.y = (i / 5) * Math.PI * 2;
        scene.add(leaf);
      }
    } else {
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.scale.setScalar(tree.scale);
      leaves.position.set(tree.x, 3.4 * tree.scale, tree.z);
      leaves.castShadow = true;
      scene.add(leaves);
    }
  }
  const containerGeo = new THREE.BoxGeometry(6, 2.6, 2.6);
  for (const c of city.containers) {
    const mesh = new THREE.Mesh(containerGeo, new THREE.MeshLambertMaterial({ color: c.color }));
    mesh.position.set(c.x, 1.3, c.z);
    mesh.rotation.y = c.angle;
    mesh.castShadow = true;
    scene.add(mesh);
  }
  const stallGeo = new THREE.BoxGeometry(3, 2.2, 3);
  for (const s of city.stalls) {
    const mesh = new THREE.Mesh(stallGeo, new THREE.MeshLambertMaterial({ color: s.color }));
    mesh.position.set(s.x, 1.1, s.z);
    mesh.castShadow = true;
    scene.add(mesh);
  }

  // ---- dynamic models ----
  function buildPerson(color, scale) {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.5), mat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8b98a }),
    );
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x2c2c34 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.9, 0.36), legMat);
    legL.position.set(-0.22, 0.45, 0);
    group.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.22;
    group.add(legR);
    group.userData.legs = [legL, legR];
    group.scale.setScalar(scale || 1);
    return group;
  }

  function buildCar(color, police) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.85, 4.4), bodyMat);
    body.position.y = 0.75;
    body.castShadow = true;
    group.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.75, 2.2),
      new THREE.MeshLambertMaterial({ color: police ? 0x222226 : 0x1c2733 }),
    );
    cabin.position.set(0, 1.45, -0.3);
    cabin.castShadow = true;
    group.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141416 });
    for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      group.add(wheel);
    }
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
    for (const hx of [-0.6, 0.6]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
      lamp.position.set(hx, 0.8, 2.21);
      group.add(lamp);
    }
    if (police) {
      const barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      barR.position.set(-0.45, 1.95, -0.3);
      group.add(barR);
      const barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2a6aff }));
      barB.position.set(0.45, 1.95, -0.3);
      group.add(barB);
      group.userData.barR = barR;
      group.userData.barB = barB;
    }
    return group;
  }

  const playerMesh = buildPerson(PALETTE.playerJacket, 1);
  scene.add(playerMesh);

  const carMeshes = new Map();
  const pedMeshes = new Map();
  const thugMeshes = new Map();

  // Mission beacon: a glowing column plus a spinning diamond.
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffcf5c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  beacon.add(beam);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffcf5c }),
  );
  gem.position.y = 7;
  beacon.add(gem);
  beacon.visible = false;
  scene.add(beacon);

  // Particles: one small box per particle, pooled.
  const particleGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const particleMeshes = [];
  for (let i = 0; i < 60; i += 1) {
    const mesh = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    mesh.visible = false;
    scene.add(mesh);
    particleMeshes.push(mesh);
  }

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  let cameraMode = 'follow';
  let orbitAngle = 0.6;

  // ---- HUD and minimap (DOM) ----
  const el = (id) => document.getElementById(id);
  const hud = {
    money: el('hud-money'),
    healthFill: el('hud-health-fill'),
    healthText: el('hud-health-text'),
    stars: el('hud-stars'),
    missionTitle: el('hud-mission-title'),
    missionObj: el('hud-mission-obj'),
    speed: el('hud-speed'),
    message: el('hud-message'),
    toast: el('hud-toast'),
    minimap: el('minimap'),
  };
  const mapCtx = hud.minimap ? hud.minimap.getContext('2d') : null;
  const mapStatic = document.createElement('canvas');
  mapStatic.width = 180;
  mapStatic.height = 180;
  {
    const ctx = mapStatic.getContext('2d');
    ctx.fillStyle = '#20242e';
    ctx.fillRect(0, 0, 180, 180);
    ctx.fillStyle = '#2e6f8e';
    ctx.fillRect(0, 0, 180, 8);
    ctx.fillStyle = '#e0cd9a';
    ctx.fillRect(0, 8, 180, 7);
    ctx.strokeStyle = '#3a3f4a';
    ctx.lineWidth = 3;
    for (const road of city.roads) {
      const p = (road + CITY.half) * SCALE;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, 180);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(180, p);
      ctx.stroke();
    }
    ctx.fillStyle = '#4a4f5a';
    for (const b of city.buildings) {
      ctx.fillRect((b.x - b.w / 2 + CITY.half) * SCALE, (b.z - b.d / 2 + CITY.half) * SCALE, Math.max(1.5, b.w * SCALE), Math.max(1.5, b.d * SCALE));
    }
    ctx.fillStyle = '#5d7d4a';
    ctx.fillRect((30 - 26 + CITY.half) * SCALE, (30 - 26 + CITY.half) * SCALE, 52 * SCALE, 52 * SCALE);
    ctx.fillRect((-30 - 26 + CITY.half) * SCALE, (-90 - 26 + CITY.half) * SCALE, 52 * SCALE, 52 * SCALE);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function syncCars(state) {
    const seen = new Set();
    for (const car of state.cars) {
      seen.add(car.id);
      let mesh = carMeshes.get(car.id);
      if (!mesh) {
        mesh = buildCar(car.color, car.kind === 'police');
        carMeshes.set(car.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(car.x, 0, car.z);
      mesh.rotation.y = car.angle;
      if (car.kind === 'police' && mesh.userData.barR) {
        const on = Math.sin(car.lightPhase) > 0;
        mesh.userData.barR.material.color.setHex(on ? 0xff2a2a : 0x551111);
        mesh.userData.barB.material.color.setHex(on ? 0x111155 : 0x2a6aff);
      }
    }
    for (const [id, mesh] of carMeshes) {
      if (!seen.has(id)) {
        scene.remove(mesh);
        carMeshes.delete(id);
      }
    }
  }

  function syncPeople(state, dt) {
    const seen = new Set();
    for (const ped of state.peds) {
      if (ped.state === 'riding') continue;
      seen.add(ped.id);
      let mesh = pedMeshes.get(ped.id);
      if (!mesh) {
        mesh = buildPerson(ped.color, 1);
        pedMeshes.set(ped.id, mesh);
        scene.add(mesh);
      }
      mesh.visible = ped.state !== 'down';
      mesh.position.set(ped.x, ped.state === 'down' ? 0.35 : 0, ped.z);
      mesh.rotation.y = ped.angle;
      if (ped.state === 'down') mesh.rotation.x = Math.PI / 2;
      else mesh.rotation.x = 0;
      const swing = ped.state === 'walk' ? Math.sin(ped.walkPhase) * 0.45 : 0;
      mesh.userData.legs[0].rotation.x = swing;
      mesh.userData.legs[1].rotation.x = -swing;
    }
    for (const [id, mesh] of pedMeshes) {
      if (!seen.has(id)) {
        scene.remove(mesh);
        pedMeshes.delete(id);
      }
    }
    const seenThugs = new Set();
    for (const thug of state.thugs) {
      seenThugs.add(thug.id);
      let mesh = thugMeshes.get(thug.id);
      if (!mesh) {
        mesh = buildPerson(0x7a2e2e, thug.boss ? 1.18 : 1);
        thugMeshes.set(thug.id, mesh);
        scene.add(mesh);
      }
      mesh.visible = thug.state !== 'down';
      mesh.position.set(thug.x, thug.state === 'down' ? 0.4 : 0, thug.z);
      mesh.rotation.y = thug.angle;
      mesh.rotation.x = thug.state === 'down' ? Math.PI / 2 : 0;
      const swing = thug.state === 'chase' ? Math.sin(thug.walkPhase) * 0.5 : 0;
      mesh.userData.legs[0].rotation.x = swing;
      mesh.userData.legs[1].rotation.x = -swing;
    }
    for (const [id, mesh] of thugMeshes) {
      if (!seenThugs.has(id)) {
        scene.remove(mesh);
        thugMeshes.delete(id);
      }
    }
    void dt;
  }

  function updateCamera(state, screen, dt) {
    const p = state.player;
    if (cameraMode === 'orbit' || screen === SCREEN_TITLE) {
      orbitAngle += dt * 0.03;
      const cx = Math.cos(orbitAngle) * 170;
      const cz = Math.sin(orbitAngle) * 170 - 40;
      camera.position.set(cx, 62, cz);
      camera.lookAt(20, 8, 20);
      return;
    }
    const driving = !p.onFoot;
    const dist = driving ? 11 : 7.5;
    const height = driving ? 4.6 : 3.4 + p.pitch * 6;
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    camera.position.set(p.x - fx * dist, height, p.z - fz * dist);
    camera.lookAt(p.x + fx * 5, 1.7, p.z + fz * 5);
  }

  function drawMinimap(world, state) {
    if (!mapCtx) return;
    mapCtx.drawImage(mapStatic, 0, 0);
    const toMap = (x, z) => [(x + CITY.half) * SCALE, (z + CITY.half) * SCALE];
    const target = world.missionTarget();
    if (target) {
      const [mx, my] = toMap(target.x, target.z);
      const pulse = 3 + Math.sin(state.time * 4) * 1.5;
      mapCtx.fillStyle = '#ffcf5c';
      mapCtx.beginPath();
      mapCtx.moveTo(mx, my - 5 - pulse);
      mapCtx.lineTo(mx + 5, my);
      mapCtx.lineTo(mx, my + 5 + pulse);
      mapCtx.lineTo(mx - 5, my);
      mapCtx.closePath();
      mapCtx.fill();
    }
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      const [mx, my] = toMap(car.x, car.z);
      mapCtx.fillStyle = Math.sin(car.lightPhase) > 0 ? '#ff2a2a' : '#2a6aff';
      mapCtx.beginPath();
      mapCtx.arc(mx, my, 3, 0, Math.PI * 2);
      mapCtx.fill();
    }
    for (const ped of state.peds) {
      if (ped.state !== 'taxi') continue;
      const [mx, my] = toMap(ped.x, ped.z);
      mapCtx.fillStyle = '#2ecc71';
      mapCtx.beginPath();
      mapCtx.arc(mx, my, 3, 0, Math.PI * 2);
      mapCtx.fill();
    }
    for (const thug of state.thugs) {
      if (thug.state === 'down') continue;
      const [mx, my] = toMap(thug.x, thug.z);
      mapCtx.fillStyle = '#ff5a3c';
      mapCtx.fillRect(mx - 2, my - 2, 4, 4);
    }
    const [px, py] = toMap(state.player.x, state.player.z);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.save();
    mapCtx.translate(px, py);
    // The arrow is drawn pointing up; world direction (sin a, cos a) maps to the
    // minimap the same way, so rotating by (PI - a) points it along the heading.
    mapCtx.rotate(Math.PI - state.player.angle);
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6);
    mapCtx.lineTo(4.5, 5);
    mapCtx.lineTo(-4.5, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  function updateHud(world, state, screen) {
    if (!hud.money) return;
    const moneyText = `$${state.money}`;
    if (hud.money.textContent !== moneyText) hud.money.textContent = moneyText;
    const healthPct = Math.max(0, Math.round((state.health / 100) * 100));
    hud.healthFill.style.width = `${healthPct}%`;
    hud.healthFill.style.background = healthPct > 50 ? '#58c96b' : healthPct > 25 ? '#ffcf5c' : '#e5534b';
    const healthText = `${healthPct}`;
    if (hud.healthText.textContent !== healthText) hud.healthText.textContent = healthText;
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    if (hud.stars.textContent !== stars) hud.stars.textContent = stars;
    hud.stars.style.color = state.wanted > 0 ? '#ff5a3c' : '#8b93a3';
    const mission = world.currentMission();
    const stage = world.currentStage();
    if (state.missionIndex >= 5 || state.won) {
      hud.missionTitle.textContent = 'Utang lunas — Kota Teluk Harapan bebas!';
      hud.missionObj.textContent = 'Terima kasih sudah bermain. Coba side job taksi & kurir, atau mulai lagi.';
    } else if (mission && stage) {
      hud.missionTitle.textContent = mission.title;
      let obj = stage.text;
      if (stage.kind === 'survive') obj += ` — ${Math.max(0, Math.ceil(state.stageTimer))} dtk`;
      const target = world.missionTarget();
      if (target) {
        const d = Math.round(Math.hypot(target.x - state.player.x, target.z - state.player.z));
        obj += ` · ${d}m`;
      }
      hud.missionObj.textContent = obj;
    }
    const speedText = state.player.onFoot ? '' : `${Math.round(Math.abs(state.player.speed) * 3.2)} km/j`;
    if (hud.speed.textContent !== speedText) hud.speed.textContent = speedText;
    hud.message.textContent = state.message || '';
    hud.message.style.opacity = state.message ? '1' : '0';
    hud.toast.textContent = state.toast || '';
    hud.toast.style.opacity = state.toast ? '1' : '0';
    hud.minimap.style.display = screen === SCREEN_PLAY ? 'block' : 'none';
  }

  return {
    draw(world, screen, best, dt) {
      const state = world.state;
      void best;
      // The player model hides while driving (the driver sits in the car).
      playerMesh.visible = state.player.onFoot && screen !== SCREEN_TITLE;
      if (state.player.onFoot) {
        playerMesh.position.set(state.player.x, 0, state.player.z);
        playerMesh.rotation.y = state.player.angle;
        const swing = state.player.moving ? Math.sin(state.player.walkPhase) * 0.5 : 0;
        playerMesh.userData.legs[0].rotation.x = swing;
        playerMesh.userData.legs[1].rotation.x = -swing;
      }
      syncCars(state);
      syncPeople(state, dt);
      const target = world.missionTarget();
      if (target && screen === SCREEN_PLAY) {
        beacon.visible = true;
        beacon.position.set(target.x, 0, target.z);
        gem.rotation.y = state.time * 1.5;
      } else {
        beacon.visible = false;
      }
      for (let i = 0; i < particleMeshes.length; i += 1) {
        const mesh = particleMeshes[i];
        const p = state.particles[i];
        if (p) {
          mesh.visible = true;
          mesh.position.set(p.x, p.y, p.z);
          mesh.material.color.setHex(p.color);
          const s = 0.5 + (p.life / p.maxLife) * 0.8;
          mesh.scale.setScalar(s);
        } else {
          mesh.visible = false;
        }
      }
      updateCamera(state, screen, dt || 0);
      renderer.render(scene, camera);
      updateHud(world, state, screen);
      drawMinimap(world, state);
    },
    setCameraMode(mode) {
      cameraMode = mode;
    },
    resize,
  };
}
