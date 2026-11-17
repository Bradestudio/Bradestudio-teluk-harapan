// Adegan screenshot di balik ?shot=start|play|chase|mission. Setiap adegan menata dunia dari
// keadaan segar ke satu frame yang sama setiap kali (posisi tetap, seed tetap): judul di atas
// kota senja, mengemudi di Pelabuhan, kejar-kejaran malam dengan helikopter, dan misi final di
// Mercusuar. Semua memakai aturan main yang sebenarnya, bukan gambar tempelan.
import { PLACES } from './config.js';
import { enterVehicle, spawnEnemy, spawnPoliceCar, stepWorld } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function freshPlayer(world, x, z, angle) {
  const p = world.player;
  p.x = x; p.z = z; p.angle = angle; p.hp = p.maxHp; p.ammo = 24; p.onFoot = true; p.vehicleId = 0;
  p.wanted = 0; p.speed = 0; p.money = 350;
  world.enemies.length = 0;
  for (const pc of world.police) pc.hp = 0;
  world.police.length = 0;
  world.heli.active = false;
}

function driveCar(world, type, x, z, angle, speed) {
  const v = world.vehicles.find((vv) => vv.type === type && vv.parked && vv.driver === 'none');
  if (!v) return null;
  v.x = x; v.z = z; v.angle = angle; v.speed = speed; v.hp = 100;
  enterVehicle(world, v);
  return v;
}

// Simulasikan beberapa detik agar lalu lintas dan pejalan kaki tersebar alami.
function settle(world, seconds) {
  const ctl = { fwd: false, back: false, left: false, right: false, run: false, shoot: false, camYaw: 0 };
  for (let i = 0; i < seconds * 60; i++) stepWorld(world, 1 / 60, ctl, { wanted: world.player.wanted });
}

export function stageShot(name, world) {
  world.phase = name === 'chase' || name === 'mission' ? 2 : 0;
  world.time = 0;
  const p = world.player;
  if (name === 'play') {
    freshPlayer(world, 0, -100, 0);
    const car = driveCar(world, 'sedan', 0, -100, 0, 22);
    settle(world, 2);
    if (car) car.speed = 22; // settle meredam mobil; kembalikan laju untuk foto
    world.player.speed = 22;
    return {
      screen: SCREEN_PLAY,
      ui: {
        missionTitle: 'M3 — Paket Kilat', objective: 'Antar paket ke Menara Kaca (45 dtk)',
        marker: { x: 65, z: -130 }, banner: '', bannerUntil: 0,
      },
    };
  }
  if (name === 'chase') {
    freshPlayer(world, 0, 65, 0);
    const car = driveCar(world, 'sedan', 0, 65, 0, 30);
    p.wanted = 5; p.money = 1250;
    spawnPoliceCar(world, -7, 88).speed = 28;
    spawnPoliceCar(world, 7, 92).speed = 28;
    spawnPoliceCar(world, -14, 78).speed = 26;
    world.heli.active = true; world.heli.x = 0; world.heli.z = 100; world.heli.y = 12;
    settle(world, 1.5);
    if (car) car.speed = 28;
    world.player.speed = 28;
    world.heli.x = 0; world.heli.z = 100; world.heli.y = 12;
    return {
      screen: SCREEN_PLAY,
      ui: {
        missionTitle: 'M14 — Mata Helikopter', objective: 'Tembus ke Mercusuar! (75 dtk)',
        marker: { x: -195, z: -195 }, banner: '', bannerUntil: 0,
      },
    };
  }
  if (name === 'mission') {
    freshPlayer(world, -182, -172, -2.52);
    p.money = 2400;
    spawnEnemy(world, 'boss', -192, -186, 320);
    spawnEnemy(world, 'guard', -186, -192);
    spawnEnemy(world, 'guard', -198, -182);
    world.time = 4.4; // putar sorot mercusuar melintasi frame
    return {
      screen: SCREEN_PLAY,
      ui: {
        missionTitle: 'M15 — Darto Terakhir', objective: 'Kalahkan Bang Darto!',
        marker: { x: -195, z: -195 }, banner: 'Bang Darto: "Kota ini milikku, Raka!"', bannerUntil: 99,
      },
    };
  }
  // start: judul di atas kota senja, Raka berdiri di barat daya menghadap langit Menara Kaca.
  freshPlayer(world, -150, 170, Math.PI * 0.75);
  world.time = 2;
  return {
    screen: SCREEN_TITLE,
    ui: { missionTitle: '', objective: '', marker: null, banner: '', bannerUntil: 0 },
  };
}
