// TELUK HARAPAN — render.js
// Semua gambar 3D (three.js): kota, kendaraan, pejalan kaki, helikopter,
// partikel, kamera, dan pencahayaan per fase hari (Senja/Maghrib/Malam).
// Model dibuat dari bentuk dasar (box, silinder) — semua original, tidak ada
// aset dari game lain. Ditulis fresh untuk round 4.

import * as THREE from 'three';
import { CONFIG } from './config.js';

// Tekstur jendela yang digambar sekali di canvas (dipakai ulang semua gedung).
const windowTextures = new Map();
function buildingTexture(baseColor, lit) {
  const key = `${baseColor}-${lit ? 'lit' : 'dark'}`;
  if (windowTextures.has(key)) return windowTextures.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 256);
  // Jendela acak: sebagian menyala (malam), sebagian gelap.
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const on = lit ? Math.random() < 0.55 : Math.random() < 0.12;
      ctx.fillStyle = on ? '#ffd98a' : '#1c2433';
      ctx.fillRect(12 + col * 28, 14 + row * 30, 18, 20);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  windowTextures.set(key, tex);
  return tex;
}

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
    this.cameraMode = 0; // 0 dekat, 1 jauh, 2 atas
    this.sun = new THREE.DirectionalLight(0xffb36b, 1.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -160;
    this.sun.shadow.camera.right = 160;
    this.sun.shadow.camera.top = 160;
    this.sun.shadow.camera.bottom = -160;
    this.sun.shadow.camera.far = 600;
    this.scene.add(this.sun);
    this.ambient = new THREE.AmbientLight(0x8a7a9a, 0.55);
    this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xffc890, 0x3a3a4a, 0.5);
    this.scene.add(this.hemi);
    this.lampLights = [];
    this.waterMeshes = [];
    this.stars = null;
    this.lighthouseBeam = null;
    this.particles = [];
    this._particlePool = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---- kota ----
  buildCity(city) {
    const W = CONFIG.world;
    // Tanah dasar per distrik (bidang datar berwarna).
    for (const d of CONFIG.districts) {
      const geo = new THREE.PlaneGeometry(d.x1 - d.x0, d.z1 - d.z0);
      const mat = new THREE.MeshStandardMaterial({ color: d.ground, roughness: 1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((d.x0 + d.x1) / 2, -0.05, (d.z0 + d.z1) / 2);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    // Laut barat + selatan, dan sungai.
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1a5a7a, roughness: 0.25, metalness: 0.35, transparent: true, opacity: 0.92,
    });
    const seaW = new THREE.Mesh(new THREE.PlaneGeometry(48, 640), waterMat);
    seaW.rotation.x = -Math.PI / 2;
    seaW.position.set(-296, -0.4, 0);
    this.scene.add(seaW);
    this.waterMeshes.push(seaW);
    const seaS = new THREE.Mesh(new THREE.PlaneGeometry(640, 32), waterMat.clone());
    seaS.rotation.x = -Math.PI / 2;
    seaS.position.set(0, -0.4, 304);
    this.scene.add(seaS);
    this.waterMeshes.push(seaS);
    const river = new THREE.Mesh(new THREE.PlaneGeometry(32, 640), waterMat.clone());
    river.rotation.x = -Math.PI / 2;
    river.position.set(64, -0.4, 0);
    this.scene.add(river);
    this.waterMeshes.push(river);
    // Pantai (pasir) di selatan.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(640, 24),
      new THREE.MeshStandardMaterial({ color: 0xd9c48f, roughness: 1 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, -0.02, 276);
    sand.receiveShadow = true;
    this.scene.add(sand);

    // Jalan: strip aspal gelap di tiap avenue + jembatan.
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2e2e33, roughness: 0.95 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd9c24a });
    for (const ax of city.avenuesX) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(W.avenueWidth, 640), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(ax, 0.02, 0);
      road.receiveShadow = true;
      this.scene.add(road);
      // Garis tengah putus-putus.
      for (let z = -300; z < 300; z += 16) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 7), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(ax, 0.04, z);
        this.scene.add(dash);
      }
    }
    for (const az of city.avenuesZ) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(640, W.avenueWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.02, az);
      road.receiveShadow = true;
      this.scene.add(road);
      for (let x = -300; x < 300; x += 16) {
        // Lewati sungai kecuali di jembatan.
        if (x > 48 && x < 80 && !city.bridges.includes(az)) continue;
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.5), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.04, az);
        this.scene.add(dash);
      }
    }
    // Jembatan: dek beton di atas sungai.
    for (const bz of city.bridges) {
      const deck = box(48, 1.2, W.avenueWidth + 4, 0x8a8a8a, 64, 0.6, bz);
      deck.receiveShadow = true;
      this.scene.add(deck);
      const rail1 = box(48, 1, 0.6, 0xc9a24a, 64, 1.6, bz - (W.avenueWidth / 2 + 1.4));
      const rail2 = box(48, 1, 0.6, 0xc9a24a, 64, 1.6, bz + (W.avenueWidth / 2 + 1.4));
      this.scene.add(rail1);
      this.scene.add(rail2);
    }

    // Gedung.
    for (const b of city.buildings) {
      const tex = buildingTexture(b.color, false);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      if (b.roof) {
        const roof = box(b.w * 0.5, 1.2, b.d * 0.5, 0x3a3a3a, b.x, b.h + 0.6, b.z);
        this.scene.add(roof);
      }
    }

    // Prop / landmark.
    for (const p of city.props) {
      this._addProp(p);
    }

    // Bintang (malam hari).
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for (let i = 0; i < 400; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI * 0.45 + 0.1;
      const r = 800;
      starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false }));
    this.stars.visible = false;
    this.scene.add(this.stars);
  }

  _addProp(p) {
    switch (p.kind) {
      case 'lighthouse': {
        const tower = new THREE.Mesh(
          new THREE.CylinderGeometry(2.2, 3, p.h, 12),
          new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 }),
        );
        tower.position.set(p.x, p.h / 2, p.z);
        tower.castShadow = true;
        this.scene.add(tower);
        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(2.4, 2.4, 3, 12),
          new THREE.MeshStandardMaterial({ color: 0xc23a2e, roughness: 0.7 }),
        );
        band.position.set(p.x, p.h - 6, p.z);
        this.scene.add(band);
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(1.4, 12, 8),
          new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
        );
        lamp.position.set(p.x, p.h + 1, p.z);
        this.scene.add(lamp);
        // Sorot berputar (kerucut tembus pandang).
        const beam = new THREE.Mesh(
          new THREE.ConeGeometry(6, 60, 12, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
        );
        beam.rotation.z = Math.PI / 2;
        beam.position.set(p.x, p.h + 1, p.z);
        this.scene.add(beam);
        this.lighthouseBeam = beam;
        break;
      }
      case 'clocktower': {
        const tower = box(8, p.h, 8, 0xc9a35f, p.x, p.h / 2, p.z);
        this.scene.add(tower);
        const face = new THREE.Mesh(
          new THREE.CircleGeometry(2.4, 24),
          new THREE.MeshBasicMaterial({ color: 0xfff6d8 }),
        );
        face.position.set(p.x, p.h - 4, p.z + 4.05);
        this.scene.add(face);
        const cap = new THREE.Mesh(
          new THREE.ConeGeometry(6, 5, 4),
          new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 0.8 }),
        );
        cap.position.set(p.x, p.h + 2.5, p.z);
        cap.rotation.y = Math.PI / 4;
        this.scene.add(cap);
        break;
      }
      case 'stall': {
        const stall = box(5, 2.4, 5, 0x8a5a3a, p.x, 1.2, p.z);
        this.scene.add(stall);
        const awning = box(6, 0.3, 6, 0xd94a3a, p.x, 2.8, p.z);
        this.scene.add(awning);
        break;
      }
      case 'crane': {
        const mast = box(2, p.h, 2, 0xd9a821, p.x, p.h / 2, p.z);
        this.scene.add(mast);
        const arm = box(26, 1.6, 1.6, 0xd9a821, p.x + 8, p.h - 2, p.z);
        this.scene.add(arm);
        const hook = box(1, 6, 1, 0x333333, p.x + 18, p.h - 6, p.z);
        this.scene.add(hook);
        break;
      }
      case 'container': {
        const c = box(12, 2.6, 2.8, new THREE.Color(p.color).getHex(), p.x, 1.3, p.z);
        c.rotation.y = p.rot || 0;
        this.scene.add(c);
        break;
      }
      case 'chimney': {
        const ch = new THREE.Mesh(
          new THREE.CylinderGeometry(1.6, 2.2, p.h, 10),
          new THREE.MeshStandardMaterial({ color: 0x7a3a2e, roughness: 0.9 }),
        );
        ch.position.set(p.x, p.h / 2, p.z);
        ch.castShadow = true;
        this.scene.add(ch);
        break;
      }
      case 'warehouse': {
        const wh = box(p.hw * 2, p.h, p.hd * 2, 0x6e6e6e, p.x, p.h / 2, p.z);
        this.scene.add(wh);
        const roof = new THREE.Mesh(
          new THREE.CylinderGeometry(p.hd, p.hd, p.hw * 2, 3, 1),
          new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9 }),
        );
        roof.rotation.z = Math.PI / 2;
        roof.rotation.y = Math.PI / 2;
        roof.scale.set(1, 1, 0.4);
        roof.position.set(p.x, p.h + 1, p.z);
        this.scene.add(roof);
        break;
      }
      case 'pier': {
        const pier = box(40, 1, 12, 0x6a4a2a, p.x, 0.5, p.z);
        this.scene.add(pier);
        break;
      }
      case 'boat': {
        const hull = box(3, 1.2, 9, 0xe8e8e8, p.x, 0.2, p.z);
        hull.rotation.y = p.rot || 0;
        this.scene.add(hull);
        const cabin = box(2, 1, 3, 0x3a6a8a, p.x, 1.2, p.z);
        cabin.rotation.y = p.rot || 0;
        this.scene.add(cabin);
        break;
      }
      case 'palm': {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.45, p.h, 7),
          new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 }),
        );
        trunk.position.set(p.x, p.h / 2, p.z);
        trunk.rotation.z = 0.12;
        this.scene.add(trunk);
        for (let i = 0; i < 5; i += 1) {
          const leaf = new THREE.Mesh(
            new THREE.ConeGeometry(0.7, 4.5, 4),
            new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 1 }),
          );
          const a = (i / 5) * Math.PI * 2;
          leaf.position.set(p.x + Math.cos(a) * 1.6, p.h + 0.6, p.z + Math.sin(a) * 1.6);
          leaf.rotation.z = Math.cos(a) * 1.1;
          leaf.rotation.x = -Math.sin(a) * 1.1;
          this.scene.add(leaf);
        }
        break;
      }
      case 'tree': {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.5, 2.4, 7),
          new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 1 }),
        );
        trunk.position.set(p.x, 1.2, p.z);
        this.scene.add(trunk);
        const crown = new THREE.Mesh(
          new THREE.SphereGeometry(p.h * 0.42, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 1 }),
        );
        crown.position.set(p.x, 2.4 + p.h * 0.3, p.z);
        crown.castShadow = true;
        this.scene.add(crown);
        break;
      }
      case 'lamp': {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.16, p.h, 6),
          new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 }),
        );
        pole.position.set(p.x, p.h / 2, p.z);
        this.scene.add(pole);
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
        );
        bulb.position.set(p.x, p.h, p.z);
        this.scene.add(bulb);
        const light = new THREE.PointLight(0xffd98a, 0, 22, 1.6);
        light.position.set(p.x, p.h - 0.5, p.z);
        this.scene.add(light);
        this.lampLights.push(light);
        break;
      }
      case 'bench': {
        this.scene.add(box(3, 0.5, 1, 0x6a4a2a, p.x, 0.5, p.z));
        break;
      }
      default:
        break;
    }
  }

  // ---- fase hari ----
  applyPhase(phaseName) {
    const ph = CONFIG.phases[phaseName] || CONFIG.phases.senja;
    this.scene.background = new THREE.Color(ph.sky);
    this.scene.fog = new THREE.Fog(ph.fog, 120, 700);
    this.sun.color.setHex(ph.sun);
    this.sun.intensity = ph.sunIntensity;
    this.sun.position.set(ph.sunPos[0], ph.sunPos[1], ph.sunPos[2]);
    this.ambient.color.setHex(ph.ambient);
    this.ambient.intensity = ph.ambientIntensity;
    this.hemi.color.setHex(ph.hemi);
    this.hemi.intensity = ph.hemiIntensity;
    for (const light of this.lampLights) light.intensity = ph.lamps ? 14 : 0;
    if (this.stars) this.stars.visible = ph.stars;
    if (this.lighthouseBeam) this.lighthouseBeam.visible = ph.lamps;
  }

  // ---- kendaraan & karakter ----
  makeCarMesh(kind, colorHex) {
    const group = new THREE.Group();
    const spec = CONFIG.cars[kind] || CONFIG.cars.sedan;
    const color = colorHex !== undefined ? colorHex : spec.color;
    const body = box(2.0, 0.75, 4.4, color, 0, 0.75, 0);
    group.add(body);
    const cabin = box(1.7, 0.65, 2.2, 0x1a2433, 0, 1.4, -0.2);
    group.add(cabin);
    if (kind === 'truk') {
      const cargo = box(2.1, 1.8, 3.2, 0x8a8a8a, 0, 1.4, -1.2);
      group.add(cargo);
    }
    if (kind === 'taksi') {
      const sign = box(0.9, 0.25, 0.5, 0xd9c24a, 0, 1.85, -0.2);
      group.add(sign);
    }
    if (kind === 'polisi') {
      const bar = box(1.2, 0.18, 0.4, 0x2233aa, 0, 1.8, -0.2);
      group.add(bar);
      const stripe = box(2.02, 0.3, 4.42, 0xffffff, 0, 0.8, 0);
      group.add(stripe);
    }
    if (kind === 'perahu') {
      const hull = box(2.4, 0.9, 5.6, 0xe8e8e8, 0, 0.5, 0);
      group.add(hull);
      const deck = box(2.0, 0.4, 3.2, 0x3a6a8a, 0, 1.1, -0.4);
      group.add(deck);
      const motor = box(0.6, 0.8, 0.6, 0x222222, 0, 0.9, 2.6);
      group.add(motor);
    }
    // Roda.
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
    const wheels = [];
    const wheelPos = [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]];
    for (const [wx, wz] of wheelPos) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      wheel.castShadow = true;
      group.add(wheel);
      wheels.push(wheel);
    }
    // Lampu depan (emissive) — menyala malam hari.
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), headMat);
    h1.position.set(-0.7, 0.8, 2.25);
    const h2 = h1.clone();
    h2.position.x = 0.7;
    group.add(h1);
    group.add(h2);
    group.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    group.userData.wheels = wheels;
    group.userData.headMat = headMat;
    return group;
  }

  makePedMesh(shirtColor, skinColor) {
    const group = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: skinColor || 0xc98a5a, roughness: 0.8 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 4, 8), shirt);
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.7, 6), pants);
    legL.position.set(-0.18, 0.35, 0);
    const legR = legL.clone();
    legR.position.x = 0.18;
    group.add(legL);
    group.add(legR);
    group.userData.legs = [legL, legR];
    return group;
  }

  makeHeliMesh() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6, metalness: 0.3 }),
    );
    body.scale.set(1, 0.8, 1.6);
    body.position.y = 0;
    body.castShadow = true;
    group.add(body);
    const tail = box(0.7, 0.7, 5, 0x1e3a8a, 0, 0.3, -3.6);
    group.add(tail);
    const rotor = box(9, 0.12, 0.5, 0x222222, 0, 1.5, 0);
    group.add(rotor);
    const rotor2 = box(0.5, 0.12, 9, 0x222222, 0, 1.55, 0);
    group.add(rotor2);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    lamp.position.set(0, -1.2, 1.2);
    group.add(lamp);
    const spot = new THREE.SpotLight(0xffffff, 60, 90, 0.35, 0.4, 1.2);
    spot.position.set(0, -1, 0);
    spot.target.position.set(0, -20, 0);
    group.add(spot);
    group.add(spot.target);
    group.userData.rotors = [rotor, rotor2];
    group.userData.spot = spot;
    return group;
  }

  // ---- partikel ----
  spawnParticles(pos, color, count, speed, life, size, gravity) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      vels.push({ x: Math.cos(a) * Math.cos(e) * s, y: Math.abs(Math.sin(e)) * s + speed * 0.3, z: Math.sin(a) * Math.cos(e) * s });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: size || 0.7, transparent: true, opacity: 0.9, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.particles.push({ points, vels, life, age: 0, gravity: gravity === undefined ? -6 : gravity });
    if (this.particles.length > 40) {
      const old = this.particles.shift();
      this.scene.remove(old.points);
      old.points.geometry.dispose();
      old.points.material.dispose();
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.age += dt;
      const attr = p.points.geometry.getAttribute('position');
      for (let j = 0; j < p.vels.length; j += 1) {
        const v = p.vels[j];
        v.y += p.gravity * dt;
        attr.array[j * 3] += v.x * dt;
        attr.array[j * 3 + 1] += v.y * dt;
        attr.array[j * 3 + 2] += v.z * dt;
      }
      attr.needsUpdate = true;
      p.points.material.opacity = Math.max(0, 0.9 * (1 - p.age / p.life));
      if (p.age >= p.life) {
        this.scene.remove(p.points);
        p.points.geometry.dispose();
        p.points.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  // ---- kamera ----
  followCamera(target, heading, speed, dt) {
    const mode = this.cameraMode;
    let dist = 11;
    let height = 5.2;
    let lookAhead = 4;
    if (mode === 1) { dist = 17; height = 8; lookAhead = 6; }
    if (mode === 2) { dist = 0.1; height = 42; lookAhead = 0; }
    const bx = Math.sin(heading);
    const bz = Math.cos(heading);
    const desired = new THREE.Vector3(
      target.x - bx * dist,
      (target.y || 0) + height,
      target.z - bz * dist,
    );
    const k = mode === 2 ? 1 : 1 - Math.pow(0.0015, dt);
    this.camera.position.lerp(desired, k);
    const look = new THREE.Vector3(
      target.x + bx * lookAhead,
      (target.y || 0) + 1.4,
      target.z + bz * lookAhead,
    );
    this.camera.lookAt(look);
  }

  update(dt, time) {
    for (const w of this.waterMeshes) {
      w.position.y = -0.4 + Math.sin(time * 0.7 + w.position.x * 0.01) * 0.08;
    }
    if (this.lighthouseBeam && this.lighthouseBeam.visible) {
      this.lighthouseBeam.rotation.y = time * 0.5;
    }
    this.updateParticles(dt);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
