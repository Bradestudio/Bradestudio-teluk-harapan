// TELUK HARAPAN — shots.js
// Adegan screenshot deterministik (?shot=start|play|chase|end&seed=1): tiap
// adegan memainkan aturan game yang sebenarnya dari seed yang sama (bukan
// gambar tempelan), maju sejumlah langkah tetap dengan input skrip, lalu
// membekukan frame. Seed sama -> frame sama. Ditulis fresh untuk round 4.

const STEP = 1 / 60;

// Input sintetis untuk autopilot adegan.
function scriptedInput(throttle, steer, handbrake) {
  return { throttle, steer, handbrake: !!handbrake, actions: [] };
}

function driveForward(game, seconds, steerFn) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const steer = steerFn ? steerFn(i * STEP) : 0;
    game.step(STEP, scriptedInput(1, steer, false));
  }
}

function idleSteps(game, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.step(STEP, scriptedInput(0, 0, false));
  }
}

/**
 * Siapkan adegan bernama pada `game` yang sudah boot. Mengembalikan layar
 * yang harus ditampilkan ('title' | 'play').
 */
export function stageShot(name, game) {
  const g = game;
  if (name === 'start') {
    // Layar judul: kamera mengorbit di atas kota saat senja, lalu lintas jalan.
    g.applyPhase('senja');
    g.setDay(1);
    g.state = 'title';
    g.cameraOrbit = { angle: 0.6, radius: 220, height: 90, center: { x: -40, z: 0 } };
    idleSteps(g, 4);
    return { screen: 'title' };
  }

  if (name === 'play') {
    // Mengemudi di Pelabuhan saat senja: M1 dimulai, dialog dilewati,
    // Raka mengendarai sedan ke arah dermaga.
    g.applyPhase('senja');
    g.setDay(1);
    g.startFreeRoam();
    g.spawnPlayerCar('sedan', -240, -64, Math.PI / 2);
    g.enterNearestCar();
    g.renderer.cameraMode = 1; // kamera jauh: jalan + kota terlihat lebar
    // Lurus di avenue z=-64 (jalan utama Pelabuhan) — tanpa belok supaya
    // mobil tetap di tengah jalan dan framing bagus.
    driveForward(g, 5, () => 0);
    return { screen: 'play' };
  }

  if (name === 'chase') {
    // Kejaran polisi di Maghrib: wanted 3, helikopter + mobil polisi
    // mengejar di Jembatan Harapan.
    g.applyPhase('maghrib');
    g.setDay(2);
    g.startFreeRoam();
    // Pindahkan pemain ke jembatan dulu — mobil harus di dekat pemain
    // supaya enterNearestCar berhasil.
    g.player.x = 40;
    g.player.z = 92;
    g.player.mesh.position.set(40, 0, 92);
    g.spawnPlayerCar('sport', 40, 96, Math.PI / 2);
    g.enterNearestCar();
    g.police.setStars(3, g.time);
    g.police.placeRoadblock(96, 96, Math.PI / 2);
    g.renderer.cameraMode = 1; // kamera jauh: mobil + blokade + jalan terlihat
    driveForward(g, 2, () => 0);
    // Helikopter ke depan mobil dan lebih rendah supaya terlihat di frame.
    if (g.police.heli) {
      g.police.heli.angle = 0.3;
      g.police.heli.y = 20;
    }
    idleSteps(g, 0.3);
    return { screen: 'play' };
  }

  if (name === 'end') {
    // Finale malam di dermaga: Raka di perahu cepat, perahu Anggara di depan,
    // mercusuar menyala di latar.
    g.applyPhase('malam');
    g.setDay(3);
    g.startFreeRoam();
    // Pindahkan pemain ke dermaga dulu — perahu harus di dekat pemain.
    g.player.x = -288;
    g.player.z = 58;
    g.player.mesh.position.set(-288, 0, 58);
    g.spawnPlayerBoat(-288, 60);
    g.enterNearestCar();
    const anggara = g.renderer.makeCarMesh('perahu', 0x8a2a2a);
    anggara.position.set(-292, -0.2, 10);
    anggara.rotation.y = Math.PI;
    g.renderer.scene.add(anggara);
    g._shotProps = [anggara];
    g.renderer.cameraMode = 1;
    driveForward(g, 3, () => 0);
    idleSteps(g, 0.5);
    return { screen: 'play' };
  }

  // Nama tak dikenal -> layar judul.
  g.applyPhase('senja');
  g.state = 'title';
  return { screen: 'title' };
}
