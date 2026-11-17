// Deterministic screenshot scenes for ?shot=start|play|chase|mission (&seed=1).
// Each stages a real game state (no free-play loop), draws the minimap + HUD,
// and main.js then paints a few frames and sets window.__shotReady.
export function stageShot(name, ctx) {
  const { G, world, renderer, playerMesh, startMission, enterCar, addWanted } = ctx;
  const titleEl = document.getElementById('title-screen');
  const hud = document.getElementById('hud');
  const THREE = window.THREE;

  function showHud() { titleEl.style.display = 'none'; hud.style.display = 'block'; }
  function setHud(money, hp, ammo, wanted, missionText, timerText) {
    document.getElementById('hud-money').textContent = `$${money}`;
    document.getElementById('hud-day').textContent = `Hari ${G.day} · ${['', 'Senja', 'Maghrib', 'Malam'][G.day]}`;
    document.getElementById('hud-hp').textContent = `${Math.ceil(hp)} HP`;
    const bar = document.getElementById('hud-hpbar');
    bar.style.width = `${Math.max(0, hp)}%`;
    bar.style.background = hp > 50 ? '#3aa84a' : hp > 25 ? '#e8a832' : '#d83a2e';
    document.getElementById('hud-ammo').textContent = `${ammo} peluru`;
    const w = document.getElementById('hud-wanted');
    w.textContent = '★'.repeat(wanted) + '☆'.repeat(5 - wanted);
    w.style.color = wanted > 0 ? '#ff4444' : '#888';
    document.getElementById('hud-mission').textContent = missionText;
    document.getElementById('hud-timer').textContent = timerText || '';
  }
  function drawMap() {
    renderer.drawMinimap({
      px: G.player.x, pz: G.player.z, heading: G.player.angle,
      beacon: G.beaconPos ? { visible: true, x: G.beaconPos.x, z: G.beaconPos.z } : { visible: false },
      thugs: world.thugs,
      police: world._police || [],
      shops: [
        { pos: [-90, -30] }, { pos: [30, -30] }, { pos: [-90, 30] }, { pos: [30, 30] }, { pos: [150, 30] },
      ],
    });
  }
  function orbitCamera(x, y, z, lx, ly, lz) {
    renderer.camera.position.set(x, y, z);
    renderer.camera.lookAt(lx, ly, lz);
  }

  G.screen = 'play';
  if (name === 'start') {
    // Title screen over a golden-hour view of the whole city.
    G.day = 1; renderer.setDay(1);
    G.player.x = 0; G.player.z = 20; G.player.angle = Math.PI;
    playerMesh.position.set(0, 0, 20);
    orbitCamera(90, 55, 190, 0, 8, -40);
    titleEl.style.display = 'flex';
    hud.style.display = 'none';
    return;
  }

  showHud();
  if (name === 'play') {
    // On foot in Pelabuhan, mission 2 active (package picked up), minimap live.
    G.day = 1; renderer.setDay(1);
    G.money = 230; G.hp = 100; G.ammo = 24; G.wanted = 0;
    startMission(1); // M2 Antar Paket
    // simulate the pickup: stage 1, beacon at the beach
    G.mission.stage = 1; G.mission.timer = 58;
    ctx.beaconAt(180, 180);
    G.player.x = -120; G.player.z = -150; G.player.angle = Math.PI * 0.75;
    playerMesh.position.set(G.player.x, 0, G.player.z);
    playerMesh.rotation.y = G.player.angle;
    renderer.snapCamera(G.player.x, G.player.z, G.player.angle);
    setHud(230, 100, 24, 0, 'M2 — Antar Paket: Antar paket ke gubuk Pantai Senja sebelum 75 detik.', '⏱ 58 dtk');
    document.getElementById('banner').textContent = 'Paket diambil — antar ke Pantai Senja!';
    document.getElementById('banner').style.opacity = '1';
    drawMap();
    return;
  }

  if (name === 'chase') {
    // High-speed chase at Menara Kaca, wanted 5, police on the tail.
    G.day = 2; renderer.setDay(2);
    G.money = 410; G.hp = 78; G.ammo = 18; G.wanted = 5;
    startMission(6); // M7 Kabur dari Polisi
    const car = world.parked[2];
    enterCar(car);
    car.x = 60; car.z = -120; car.angle = Math.PI; car.speed = 24;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    G.player.x = car.x; G.player.z = car.z;
    const cops = [];
    for (let i = 0; i < 3; i += 1) {
      const c = world.spawnPoliceCar(60 + (i % 2 === 0 ? 2.5 : -2.5), -120 + 16 + i * 8);
      c.speed = 22; cops.push(c);
    }
    world._police = cops;
    renderer.snapCamera(car.x, car.z, car.angle);
    setHud(410, 78, 18, 5, 'M7 — Kabur dari Polisi: Bertahan 30 detik tanpa tertangkap.', '⏱ 21 dtk');
    document.getElementById('speed').textContent = '86 km/j';
    document.getElementById('prompt').textContent = '';
    drawMap();
    return;
  }

  // mission: final boss fight at the tower plaza, night, low HP, wanted 2.
  G.day = 3; renderer.setDay(3);
  G.money = 890; G.hp = 16; G.ammo = 9; G.wanted = 2;
  startMission(11); // M12 Menara Kaca
  G.player.x = 52; G.player.z = -106; G.player.angle = Math.PI;
  playerMesh.position.set(G.player.x, 0, G.player.z);
  playerMesh.rotation.y = G.player.angle;
  // boss + guards already spawned by startMission at (60,-120)
  renderer.snapCamera(G.player.x, G.player.z, G.player.angle);
  setHud(890, 16, 9, 2, 'M12 — Menara Kaca: FINAL: Bang Darto menunggumu di plaza Menara Kaca.', '');
  document.getElementById('banner').textContent = 'FINAL: Kalahkan Bang Darto!';
  document.getElementById('banner').style.opacity = '1';
  document.getElementById('crosshair').style.display = 'block';
  drawMap();
}
