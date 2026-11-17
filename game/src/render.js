// Gambar saja: state dunia + layar -> piksel. Three.js (vendored) membangun kota 3D sekali,
// lalu tiap frame menggerakkan mobil, orang, helikopter, dan kamera. HUD + minimap digambar di
// DOM/canvas 2D di atasnya. Pencahayaan berubah tiap hari: Senja oranye, Maghrib ungu, Malam neon.
import * as THREE from '../vendor/three.module.min.js';
import { CITY, FONT, PALETTE, PHASES, PLACES, ROADS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';
export const SCREEN_SHOP = 'shop';

const carGeo = new THREE.BoxGeometry(2.2, 0.7, 4.4);
const cabinGeo = new THREE.BoxGeometry(1.8, 0.6, 2.2);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
const personGeo = new THREE.BoxGeometry(0.9, 1.9, 0.6);
const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
const trunkGeo = new THREE.CylinderGeometry(0.18, 0.24, 1.6, 6);
const treeGeo = new THREE.ConeGeometry(1.4, 3.2, 7);
const lampPoleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6);
const lampBulbGeo = new THREE.SphereGeometry(0.3, 8, 6);

function mat(color, emissive) {
  return new THREE.MeshLambertMaterial({ color, emissive: emissive ?? 0x000000 });
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PHASES[0].sky);
  scene.fog = new THREE.Fog(PHASES[0].fog, 180, 700);
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 1200);
  const sun = new THREE.DirectionalLight(PHASES[0].sun, 1.1);
  sun.position.set(-140, 60, 90);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x40342a, PHASES[0].hemi);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(PHASES[0].ambient, 0.9);
  scene.add(amb);

  // --- Kota statis ---
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), mat(0x2e3329));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  // Air barat + selatan.
  const waterMat = new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.85 });
  const waterW = new THREE.Mesh(new THREE.PlaneGeometry(60, 560), waterMat);
  waterW.rotation.x = -Math.PI / 2; waterW.position.set(-260, 0.02, 0); scene.add(waterW);
  const waterS = new THREE.Mesh(new THREE.PlaneGeometry(560, 60), waterMat);
  waterS.rotation.x = -Math.PI / 2; waterS.position.set(0, 0.02, 260); scene.add(waterS);
  // Pasir pantai selatan.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(140, 40), mat(PALETTE.sand));
  sand.rotation.x = -Math.PI / 2; sand.position.set(-195, 0.03, 215); scene.add(sand);
  // Jalan grid.
  const roadMat = mat(PALETTE.road);
  const lineMat = mat(PALETTE.roadLine);
  for (const c of ROADS) {
    const r1 = new THREE.Mesh(new THREE.PlaneGeometry(520, 9), roadMat);
    r1.rotation.x = -Math.PI / 2; r1.position.set(0, 0.04, c); scene.add(r1);
    const r2 = new THREE.Mesh(new THREE.PlaneGeometry(9, 520), roadMat);
    r2.rotation.x = -Math.PI / 2; r2.position.set(c, 0.04, 0); scene.add(r2);
    for (let k = -240; k <= 240; k += 24) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.5), lineMat);
      d1.rotation.x = -Math.PI / 2; d1.position.set(k, 0.05, c); scene.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 6), lineMat);
      d2.rotation.x = -Math.PI / 2; d2.position.set(c, 0.05, k); scene.add(d2);
    }
  }
  // Alun-Alun: plaza + air mancur.
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat(PALETTE.plaza));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.06, 0); scene.add(plaza);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.2, 16), mat(0x7a8a9a));
  fountain.position.set(0, 0.6, 0); scene.add(fountain);
  const fountainWater = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.4, 16), mat(0x2a7a9a));
  fountainWater.position.set(0, 1.2, 0); scene.add(fountainWater);

  const buildingMeshes = [];
  const windowMatLit = new THREE.MeshBasicMaterial({ color: PALETTE.windowLit });
  const windowMatDark = new THREE.MeshBasicMaterial({ color: PALETTE.windowDark });
  const lampBulbs = [];
  const neonSigns = [];
  let lighthouseBeam = null;
  let lighthouseTop = null;

  function buildCity(world) {
    for (const b of world.buildings) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat(b.color));
      body.position.y = b.h / 2; g.add(body);
      if (b.glass) {
        const glass = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.7, b.h * 0.9, 0.3), mat(PALETTE.glass, 0x0a2a4a));
        glass.position.set(0, b.h / 2, b.d / 2 + 0.1); g.add(glass);
      }
      if (b.style === 'lighthouse') {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 3, 10), mat(0x2a2a2a));
        cap.position.y = b.h + 1.5; g.add(cap);
        lighthouseTop = new THREE.Vector3(b.x, b.h + 1.5, b.z);
        // Sorot: poros di puncak mercusuar, ujung kerucut di poros, melebar ke bawah
        // (miring 17°) sejauh 70 unit, lalu poros diputar tiap frame.
        const pivot = new THREE.Group();
        pivot.position.set(b.x, b.h + 1.5, b.z);
        const beam = new THREE.Mesh(new THREE.ConeGeometry(11, 70, 12, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
        beam.rotation.x = -1.05;
        beam.position.set(0, -17.5, 30.5);
        pivot.add(beam);
        scene.add(pivot); lighthouseBeam = pivot;
      }
      // Jendela menyala (malam) di beberapa sisi.
      const rows = Math.max(1, Math.floor(b.h / 7));
      for (let r = 0; r < rows; r++) {
        for (let cI = 0; cI < Math.max(1, Math.floor(b.w / 7)); cI++) {
          const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), windowMatDark);
          w.position.set(-b.w / 2 + 4 + cI * 7, 5 + r * 7, b.d / 2 + 0.06);
          g.add(w); buildingMeshes.push(w);
        }
      }
      // Neon di CBD saat malam.
      if (b.style === 'cbd' && b.h > 50) {
        const sign = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.5, 3, 0.4),
          new THREE.MeshBasicMaterial({ color: [0xff4fa3, 0x35d0ff, 0xffd23f][buildingMeshes.length % 3] }));
        sign.position.set(0, b.h - 3, b.d / 2 + 0.3); sign.visible = false;
        g.add(sign); neonSigns.push(sign);
      }
      g.position.set(b.x, 0, b.z);
      scene.add(g);
    }
    for (const t of world.trees) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, mat(PALETTE.trunk)); trunk.position.y = 0.8; g.add(trunk);
      const top = new THREE.Mesh(treeGeo, mat(PALETTE.tree)); top.position.y = 3; g.add(top);
      g.position.set(t.x, 0, t.z); g.scale.setScalar(t.s); scene.add(g);
    }
    for (const l of world.lamps) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(lampPoleGeo, mat(0x222222)); pole.position.y = 2.7; g.add(pole);
      const bulb = new THREE.Mesh(lampBulbGeo, new THREE.MeshBasicMaterial({ color: 0x666655 }));
      bulb.position.y = 5.5; g.add(bulb); lampBulbs.push(bulb);
      g.position.set(l.x, 0, l.z); scene.add(g);
    }
    for (const c of world.crates) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), mat(0xb07840));
      m.position.set(c.x, c.h / 2, c.z); scene.add(m);
    }
  }

  // --- Objek dinamis (dibuat sekali, dipindah tiap frame) ---
  const dyn = { vehicles: new Map(), peds: new Map(), enemies: new Map() };
  const wheelMat = mat(0x111111);
  function makeCar(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(carGeo, mat(color)); body.position.y = 0.55; g.add(body);
    const cabin = new THREE.Mesh(cabinGeo, mat(0x1a2436)); cabin.position.set(0, 1.15, -0.2); g.add(cabin);
    const wheels = [];
    for (const [wx, wz] of [[-1.05, 1.5], [1.05, 1.5], [-1.05, -1.5], [1.05, -1.5]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w); wheels.push(w);
    }
    const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    lightL.position.set(-0.7, 0.6, 2.25); g.add(lightL);
    const lightR = lightL.clone(); lightR.position.x = 0.7; g.add(lightR);
    return { group: g, wheels };
  }
  function makeBoat(color) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 6), mat(color)); hull.position.y = 0.5; g.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 2), mat(0xe8e8e8)); cabin.position.set(0, 1.3, -0.5); g.add(cabin);
    return { group: g };
  }
  function makePerson(color, scale, emissive) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(personGeo, mat(color, emissive ?? 0x000000)); body.position.y = 0.95; g.add(body);
    const head = new THREE.Mesh(headGeo, mat(0xd8a878)); head.position.y = 2.15; g.add(head);
    g.scale.setScalar(scale || 1);
    return { group: g };
  }
  function makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 6), mat(0x7a8aa8)); body.position.y = 0; g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.4, 6.05), mat(0xffffff)); stripe.position.y = 0.1; g.add(stripe);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    beacon.position.set(0, 1.1, 0); g.add(beacon);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 5), mat(0x7a8aa8)); tail.position.set(0, 0.2, -5); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), mat(0x111111)); rotor.position.y = 1.1; g.add(rotor);
    const spot = new THREE.Mesh(new THREE.ConeGeometry(3.5, 36, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    spot.rotation.x = Math.PI; spot.position.y = -19; g.add(spot);
    return { group: g, rotor };
  }
  const heliObj = makeHeli(); heliObj.group.visible = false; scene.add(heliObj.group);
  const markerRing = new THREE.Mesh(new THREE.TorusGeometry(3, 0.35, 8, 24), new THREE.MeshBasicMaterial({ color: PALETTE.marker }));
  markerRing.rotation.x = Math.PI / 2; scene.add(markerRing);
  const markerBeam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: PALETTE.marker, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
  scene.add(markerBeam);

  // --- HUD (DOM) ---
  const $ = (id) => document.getElementById(id);
  const hud = {
    money: $('hud-money'), day: $('hud-day'), mission: $('hud-mission'), objective: $('hud-objective'),
    wanted: $('hud-wanted'), hp: $('hud-hp'), hpBar: $('hud-hpbar'), ammo: $('hud-ammo'),
    speed: $('hud-speed'), banner: $('hud-banner'), minimap: $('minimap'),
  };
  const mm = hud.minimap ? hud.minimap.getContext('2d') : null;
  let camYaw = Math.PI;
  let camDist = 16;
  let lastPhase = -1;

  function applyPhase(phaseIdx, time) {
    const ph = PHASES[phaseIdx];
    scene.background.set(ph.sky);
    scene.fog.color.set(ph.fog);
    sun.color.set(ph.sun);
    sun.position.set(ph.sunPos[0], ph.sunPos[1], ph.sunPos[2]);
    hemi.intensity = ph.hemi;
    amb.color.set(ph.ambient);
    for (const b of lampBulbs) b.material.color.set(ph.lampOn ? 0xffe9a8 : 0x666655);
    for (const w of buildingMeshes) w.material = ph.lampOn ? windowMatLit : windowMatDark;
    for (const n of neonSigns) n.visible = ph.neon;
    lastPhase = phaseIdx;
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    buildCity,
    get camYaw() { return camYaw; },
    setCamYaw(v) { camYaw = v; },
    setCamDist(v) { camDist = v; },
    applyPhase,
    draw(world, screen, ui) {
      if (world.phase !== lastPhase) applyPhase(world.phase, world.time);
      const p = world.player;
      // Kamera: di belakang pemain/mobil, halus.
      const targetYaw = p.angle + Math.PI;
      let dy = targetYaw - camYaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      camYaw += dy * 0.06;
      const dist = p.onFoot ? 13 : 17;
      const height = p.onFoot ? 6.5 : 8;
      const cx = p.x + Math.sin(camYaw) * dist;
      const cz = p.z + Math.cos(camYaw) * dist;
      camera.position.set(cx, height, cz);
      camera.lookAt(p.x, 1.5, p.z);
      // Air bergerak pelan.
      waterW.position.x = -260 + Math.sin(world.time * 0.3) * 1.5;
      if (lighthouseBeam) {
        lighthouseBeam.rotation.y = world.time * 0.5;
        lighthouseBeam.visible = world.phase >= 1;
      }
      // Kendaraan dinamis.
      const seenV = new Set();
      for (const v of world.vehicles) {
        seenV.add(v.id);
        let o = dyn.vehicles.get(v.id);
        if (!o) {
          o = v.type === 'boat' ? makeBoat(v.color) : makeCar(v.color);
          if (v.type === 'police') { // strip putih + lampu
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.15, 4.45), mat(0xffffff));
            stripe.position.y = 0.9; o.group.add(stripe);
            const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
            bar.position.set(0, 1.55, -0.2); o.group.add(bar);
          }
          scene.add(o.group); dyn.vehicles.set(v.id, o);
        }
        o.group.visible = v.hp > 0;
        o.group.position.set(v.x, v.type === 'boat' ? 0.1 : 0, v.z);
        o.group.rotation.y = v.angle;
        if (o.wheels) for (const w of o.wheels) w.rotation.x += v.speed * 0.016;
      }
      for (const [id, o] of dyn.vehicles) if (!seenV.has(id)) { scene.remove(o.group); dyn.vehicles.delete(id); }
      // Pejalan kaki.
      const seenP = new Set();
      world.peds.forEach((pd, i) => {
        seenP.add(i);
        let o = dyn.peds.get(i);
        if (!o) { o = makePerson(pd.color, 1); scene.add(o.group); dyn.peds.set(i, o); }
        o.group.position.set(pd.x, 0, pd.z);
        o.group.rotation.y = pd.angle;
        o.group.position.y = pd.flee > 0 ? Math.abs(Math.sin(world.time * 10)) * 0.25 : 0;
      });
      // Musuh.
      const seenE = new Set();
      for (const e of world.enemies) {
        seenE.add(e.id);
        let o = dyn.enemies.get(e.id);
        if (!o) { o = makePerson(e.kind === 'boss' ? 0xe02030 : PALETTE.enemy, e.kind === 'boss' ? 1.5 : 1, e.kind === 'boss' ? 0x661111 : 0x000000); scene.add(o.group); dyn.enemies.set(e.id, o); }
        o.group.position.set(e.x, 0, e.z);
        o.group.rotation.y = e.angle;
      }
      for (const [id, o] of dyn.enemies) if (!seenE.has(id)) { scene.remove(o.group); dyn.enemies.delete(id); }
      // Pemain jalan kaki.
      let playerObj = dyn.vehicles.get(-1);
      if (!playerObj) { playerObj = makePerson(PALETTE.player, 1); scene.add(playerObj.group); dyn.vehicles.set(-1, playerObj); }
      playerObj.group.visible = p.onFoot;
      playerObj.group.position.set(p.x, 0, p.z);
      playerObj.group.rotation.y = p.angle;
      // Helikopter.
      heliObj.group.visible = world.heli.active;
      if (world.heli.active) {
        heliObj.group.position.set(world.heli.x, world.heli.y, world.heli.z);
        heliObj.rotor.rotation.y = world.time * 30;
      }
      // Marker misi.
      if (ui && ui.marker) {
        markerRing.visible = true; markerBeam.visible = true;
        const bob = Math.sin(world.time * 3) * 0.4;
        markerRing.position.set(ui.marker.x, 1.2 + bob, ui.marker.z);
        markerBeam.position.set(ui.marker.x, 30, ui.marker.z);
        markerRing.rotation.z = world.time;
      } else { markerRing.visible = false; markerBeam.visible = false; }
      renderer.render(scene, camera);
      // --- HUD teks ---
      if (hud.money) hud.money.textContent = `$${p.money}`;
      if (hud.day) hud.day.textContent = PHASES[world.phase].name;
      if (hud.mission) hud.mission.textContent = ui?.missionTitle || '';
      if (hud.objective) hud.objective.textContent = ui?.objective || '';
      if (hud.wanted) hud.wanted.textContent = '★'.repeat(p.wanted) + '☆'.repeat(5 - p.wanted);
      if (hud.hpBar) hud.hpBar.style.width = `${Math.max(0, p.hp / p.maxHp * 100)}%`;
      if (hud.hp) hud.hp.textContent = `❤ ${Math.max(0, Math.ceil(p.hp))}`;
      if (hud.ammo) hud.ammo.textContent = p.onFoot ? `🔫 ${p.ammo}` : '—';
      if (hud.speed) hud.speed.textContent = p.onFoot ? '' : `${Math.round(Math.abs(p.speed) * 3.6)} km/j`;
      if (hud.banner) {
        if (ui?.banner && ui.bannerUntil > world.time) { hud.banner.textContent = ui.banner; hud.banner.style.opacity = '1'; }
        else hud.banner.style.opacity = '0';
      }
      // --- Minimap ---
      if (mm) {
        const S = 180, k = S / 560;
        mm.clearRect(0, 0, S, S);
        mm.fillStyle = '#10141c'; mm.fillRect(0, 0, S, S);
        mm.fillStyle = '#1a5f7a'; mm.fillRect(0, 0, (CITY.waterWest + 280) * k, S); // air barat
        mm.fillStyle = '#1a5f7a'; mm.fillRect(0, (CITY.waterSouth + 280) * k, S, S - (CITY.waterSouth + 280) * k); // air selatan
        mm.strokeStyle = '#3a3f4a'; mm.lineWidth = 2;
        for (const c of ROADS) {
          mm.beginPath(); mm.moveTo(0, (c + 280) * k); mm.lineTo(S, (c + 280) * k); mm.stroke();
          mm.beginPath(); mm.moveTo((c + 280) * k, 0); mm.lineTo((c + 280) * k, S); mm.stroke();
        }
        const dot = (x, z, color, r) => { mm.fillStyle = color; mm.beginPath(); mm.arc((x + 280) * k, (z + 280) * k, r, 0, 7); mm.fill(); };
        for (const v of world.police) if (v.hp > 0) dot(v.x, v.z, '#ff4444', 3);
        for (const e of world.enemies) dot(e.x, e.z, '#ff8844', 3);
        if (ui?.marker) { mm.fillStyle = '#ffd23f'; mm.beginPath(); mm.arc((ui.marker.x + 280) * k, (ui.marker.z + 280) * k, 5 + Math.sin(world.time * 4) * 2, 0, 7); mm.fill(); }
        dot(p.x, p.z, '#35d0ff', 4);
      }
      // --- Layar overlay ---
      for (const id of ['screen-title', 'screen-pause', 'screen-over', 'screen-win', 'screen-shop']) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      }
      const show = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'flex'; };
      if (screen === SCREEN_TITLE) show('screen-title');
      else if (screen === SCREEN_PAUSED) show('screen-pause');
      else if (screen === SCREEN_OVER) show('screen-over');
      else if (screen === SCREEN_WIN) show('screen-win');
      else if (screen === SCREEN_SHOP) show('screen-shop');
    },
  };
}
