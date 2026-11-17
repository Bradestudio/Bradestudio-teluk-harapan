// Rendering: three.js scene/camera/lights, third-person camera follow,
// 2D minimap canvas, and the DOM HUD wiring (money, health, wanted, mission).
import { DAY_LIGHT, DISTRICTS } from './config.js';

export function createRenderer(canvas, minimapCanvas) {
  const THREE = window.THREE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf7b267, 120, 480);
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 1200);
  const hemi = new THREE.HemisphereLight(0xffe0b3, 0x40342a, 0.9);
  const sun = new THREE.DirectionalLight(0xffd27a, 1.6);
  sun.position.set(-140, 90, -60);
  scene.add(hemi, sun);

  let camYaw = Math.PI; // camera looks north by default
  let camPitch = 0.32;
  let camDist = 10;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (minimapCanvas) { minimapCanvas.width = 190; minimapCanvas.height = 190; }
  }
  resize();
  addEventListener('resize', resize);

  function setDay(dayIdx) {
    const L = DAY_LIGHT[Math.max(0, Math.min(2, dayIdx - 1))];
    scene.background = new THREE.Color(L.sky);
    scene.fog.color.setHex(L.fog);
    sun.color.setHex(L.sun);
    sun.position.set(L.sunPos[0], L.sunPos[1], L.sunPos[2]);
    hemi.color.setHex(L.hemi);
    hemi.intensity = L.amb + 0.35;
    sun.intensity = dayIdx === 3 ? 0.5 : 1.6;
  }

  // Third-person camera: behind the player/car, orbit with mouse.
  function updateCamera(px, pz, heading, driving, dt, mouseDx, mouseDy) {
    camYaw -= mouseDx * 0.0032;
    camPitch = Math.max(0.08, Math.min(0.9, camPitch + mouseDy * 0.002));
    camDist = driving ? 13 : 10;
    const tx = px - Math.sin(camYaw) * Math.cos(camPitch) * camDist;
    const tz = pz - Math.cos(camYaw) * Math.cos(camPitch) * camDist;
    const ty = (driving ? 5.5 : 4.2) + Math.sin(camPitch) * camDist * 0.6;
    // smooth follow
    const k = 1 - Math.pow(0.0001, dt);
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (ty - camera.position.y) * k;
    camera.position.z += (tz - camera.position.z) * k;
    camera.lookAt(px, 1.6, pz);
  }

  function snapCamera(px, pz, yaw) {
    camYaw = yaw;
    camera.position.set(px - Math.sin(yaw) * 10, 6, pz - Math.cos(yaw) * 10);
    camera.lookAt(px, 1.6, pz);
  }

  // ---- minimap ----
  const mm = minimapCanvas ? minimapCanvas.getContext('2d') : null;
  function drawMinimap(state) {
    if (!mm) return;
    const S = 190, scale = S / 520;
    const toX = (x) => (x + 260) * scale;
    const toZ = (z) => (z + 260) * scale;
    mm.fillStyle = '#101018';
    mm.fillRect(0, 0, S, S);
    // districts
    for (const d of DISTRICTS) {
      mm.fillStyle = d.kind === 'beach' ? '#3a3220' : d.kind === 'plaza' ? '#2a2a30' : '#1c1c24';
      mm.fillRect(toX(d.x0), toZ(d.z0), (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
    }
    // roads
    mm.strokeStyle = '#4a4a58'; mm.lineWidth = 2;
    for (let c = -240; c <= 240; c += 60) {
      mm.beginPath(); mm.moveTo(toX(-250), toZ(c)); mm.lineTo(toX(250), toZ(c)); mm.stroke();
      mm.beginPath(); mm.moveTo(toX(c), toZ(-250)); mm.lineTo(toX(c), toZ(250)); mm.stroke();
    }
    // shops
    mm.fillStyle = '#3aa84a';
    for (const s of state.shops) { mm.beginPath(); mm.arc(toX(s.pos[0]), toZ(s.pos[1]), 3, 0, 7); mm.fill(); }
    // mission beacon
    if (state.beacon && state.beacon.visible) {
      const pulse = 4 + Math.sin(performance.now() * 0.006) * 2;
      mm.fillStyle = '#ffe14a';
      mm.beginPath(); mm.arc(toX(state.beacon.x), toZ(state.beacon.z), pulse, 0, 7); mm.fill();
    }
    // thugs
    mm.fillStyle = '#ff4444';
    for (const t of state.thugs) if (t.alive) { mm.beginPath(); mm.arc(toX(t.x), toZ(t.z), 3, 0, 7); mm.fill(); }
    // police
    mm.fillStyle = '#4488ff';
    for (const p of state.police) { mm.beginPath(); mm.arc(toX(p.x), toZ(p.z), 3, 0, 7); mm.fill(); }
    // player arrow
    mm.save();
    mm.translate(toX(state.px), toZ(state.pz));
    mm.rotate(state.heading);
    mm.fillStyle = '#ffffff';
    mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(-5, 6); mm.closePath(); mm.fill();
    mm.restore();
    // north label
    mm.fillStyle = '#888'; mm.font = '11px system-ui'; mm.fillText('N', 4, 12);
  }

  function render() { renderer.render(scene, camera); }

  return { scene, camera, renderer, setDay, updateCamera, snapCamera, drawMinimap, render, getCamYaw: () => camYaw };
}
