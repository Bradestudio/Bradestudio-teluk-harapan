// TELUK HARAPAN — shots.js
// Scene deterministik untuk screenshot (?shot=1..4&seed=1) dan autopilot
// playthrough (?autotest=1) yang memainkan game sungguhan lewat input
// sintetis sampai menang — dipakai verifikasi, bukan jalan pintas.

import { makeCar } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { makeEnemy } from './combat.js';
import { CAR_COLORS, WORLD, WEAPONS } from './config.js';
import { nearestRoadPoint, carHitsBuilding } from './world.js';

export function parseShotQuery() {
  const q = new URLSearchParams(window.location.search);
  const shot = parseInt(q.get('shot') || '0', 10);
  const seed = parseInt(q.get('seed') || '1', 10);
  const autotest = q.get('autotest') === '1';
  return { shot: Number.isNaN(shot) ? 0 : shot, seed: Number.isNaN(seed) ? 1 : seed, autotest };
}

// Menyiapkan scene tetap untuk satu screenshot. Semua posisi eksplisit —
// tidak ada acak di sini, jadi tangkapan selalu sama dari seed yang sama.
export function setupShot(G, n) {
  const p = G.player;
  G.cars = [];
  G.peds = [];
  G.enemies = [];
  G.npcs = [];
  G.pickups = [];
  G.bullets = [];
  G.roadblocks = [];
  G.heli = null;
  p.wanted = 0;
  p.wantedHeat = 0;
  p.hp = 100;
  p.armor = 50;
  p.cash = 2450;
  p.owned = { fist: true, pistol: true, smg: true, shotgun: false };
  p.weapon = 'smg';
  p.mag = { pistol: 12, smg: 30, shotgun: 0 };
  p.reserve = { pistol: 48, smg: 120, shotgun: 0 };

  if (n === 1) {
    // Sampul: layar judul (diatur main.js lewat state 'title').
    G.state = 'title';
    G.titleSel = 0;
    return;
  }

  if (n === 2) {
    // Bermain siang-senja di Kota Tua: mengemudi, lalu lintas, pejalan kaki.
    G.setDay(1);
    G.state = 'playing';
    p.x = 1500; p.y = 1250;
    const sedan = makeCar('sedan', 1500, 1250, 0, { owned: true, color: '#4a7fb5' });
    sedan.driver = 'player';
    p.inCar = sedan;
    G.cars.push(sedan);
    // Lalu lintas di sekitar.
    const spots = [
      ['taksi', 1500, 1080, Math.PI / 2, '#e8c832'],
      ['sedan', 1350, 1400, 0, '#c93a3a'],
      ['pikap', 1500, 1620, -Math.PI / 2, '#7a8a7a'],
      ['sport', 1680, 1400, Math.PI, '#7fb069'],
      ['becakmotor', 1180, 1400, 0, '#e8b93c'],
    ];
    for (const [model, x, y, a, color] of spots) {
      const c = makeCar(model, x, y, a, { driver: 'traffic', color, ai: { kind: 'traffic', cruise: 120, wait: 0, lane: 1 } });
      c.speed = 90;
      G.cars.push(c);
    }
    // Pejalan kaki di trotoar.
    for (let i = 0; i < 10; i++) {
      const ped = makePed(G.rng, 1100 + i * 60, 1352 + (i % 2) * 96);
      ped.state = 'walk';
      ped.target = { x: ped.x + 200, y: ped.y };
      G.peds.push(ped);
    }
    // Misi 1 aktif: penanda di Pasar Ikan.
    G.mission.id = 1;
    G.mission.active = true;
    G.mission.stageIndex = 2;
    G.mission.objective = 'Antar paket ke Pasar Ikan Lama (sebelum waktu habis!)';
    G.mission.marker = { x: 1500, y: 500, label: 'Pasar Ikan Lama' };
    G.mission.stageData = { timeLeft: 52 };
    G.mission.stage = { id: 'm1-antar', text: G.mission.objective, target: { x: 1500, y: 500 } };
    return;
  }

  if (n === 3) {
    // Kejar-kejaran Maghrib: wanted 4, polisi + helikopter + blokade.
    G.setDay(2);
    G.state = 'playing';
    p.x = 2100; p.y = 1950;
    p.wanted = 4;
    p.wantedHeat = 70;
    const sport = makeCar('sport', 2100, 1950, Math.PI / 2, { owned: true, color: '#c93a3a', nitro: true });
    sport.driver = 'player';
    sport.hp = 62;
    p.inCar = sport;
    G.cars.push(sport);
    // Mobil polisi mengejar.
    const copSpots = [
      [2100, 1750, Math.PI / 2], [1950, 1950, 0], [2250, 1950, Math.PI],
    ];
    for (const [x, y, a] of copSpots) {
      const c = makeCar('patroli', x, y, a, { driver: 'police', ai: { kind: 'police', target: p, ramming: true } });
      c.speed = 220;
      G.cars.push(c);
    }
    // Helikopter di atas.
    G.heli = { x: 2100, y: 1750, angle: Math.PI / 2, rotor: 1.2, spotlight: true, shootTimer: 2, searchTimer: 0 };
    // Blokade di depan.
    G.roadblocks.push({ x: 2100, y: 2220, angle: 0, cars: [], timer: 30 });
    // Lalu lintas yang minggir.
    for (let i = 0; i < 4; i++) {
      const c = makeCar('sedan', 1700 + i * 220, 1950, 0, { driver: 'traffic', color: CAR_COLORS[i], ai: { kind: 'traffic', cruise: 100, wait: 0, lane: 1 } });
      c.speed = 60;
      G.cars.push(c);
    }
    G.mission.id = 4;
    G.mission.active = true;
    G.mission.stageIndex = 3;
    G.mission.objective = 'KABUR! Capai Rumah Aman di Bukit Harapan sebelum tertangkap';
    G.mission.marker = { x: 2850, y: 650, label: 'Rumah Aman' };
    G.mission.stageData = { escapeTimer: 61 };
    G.mission.stage = { id: 'm4-kabur', text: G.mission.objective, target: { x: 2850, y: 650 } };
    return;
  }

  if (n === 4) {
    // Finale malam: Bos Darma + pengawal di Dermaga Neon, wanted 5.
    G.setDay(3);
    G.state = 'playing';
    p.x = 2100; p.y = 2000;
    p.wanted = 5;
    p.wantedHeat = 95;
    p.weapon = 'shotgun';
    p.owned.shotgun = true;
    p.mag.shotgun = 6;
    p.reserve.shotgun = 24;
    const boss = makeEnemy(G, 2100, 2150, { name: 'Bos Darma', hp: 320, speed: 110, damage: 14, range: 420, isBoss: true, dropsCash: 2000 });
    boss.state = 'shoot';
    boss.mission = true;
    G.enemies.push(boss);
    G.mission.boss = boss;
    const goons = [
      makeEnemy(G, 2100, 2050, { hp: 90, dropsCash: 200 }),
      makeEnemy(G, 2100, 2250, { hp: 90, dropsCash: 200 }),
    ];
    for (const g of goons) { g.mission = true; g.state = 'chase'; G.enemies.push(g); }
    for (let i = 0; i < 8; i++) {
      const ped = makePed(G.rng, 1900 + i * 60, 2350);
      ped.fleeing = true;
      ped.fleeTimer = 5;
      ped.state = 'flee';
      G.peds.push(ped);
    }
    G.heli = { x: 2150, y: 1950, angle: 0, rotor: 2.4, spotlight: true, shootTimer: 1, searchTimer: 0 };
    G.mission.id = 5;
    G.mission.active = true;
    G.mission.stageIndex = 1;
    G.mission.objective = 'Hadapi Bos Darma di Dermaga Neon — kalahkan dia!';
    G.mission.marker = { x: 2100, y: 2150, label: 'Klub Lampion' };
    G.mission.stageData = { bossDown: false };
    G.mission.stage = { id: 'm5-bos', text: G.mission.objective, target: { x: 2100, y: 2150 } };
  }
}

// --- Navigasi jalan (autopilot) --------------------------------------------------
// Mobil dan pejalan kaki tidak bisa menembus bangunan, jadi autopilot bergerak
// lewat jaringan jalan: BFS antar persimpangan (avenue x street), lalu ke target.
export function computeRoute(from, to) {
  const avenues = WORLD.avenues;
  const streets = WORLD.streets;
  const nearestInter = (x, y) => {
    let best = null;
    let bd = Infinity;
    for (const a of avenues) {
      for (const st of streets) {
        const d = Math.hypot(a - x, st - y);
        if (d < bd) { bd = d; best = { x: a, y: st }; }
      }
    }
    return best;
  };
  const start = nearestInter(from.x, from.y);
  const goal = nearestInter(to.x, to.y);
  const si = avenues.indexOf(start.x);
  const sj = streets.indexOf(start.y);
  const gi = avenues.indexOf(goal.x);
  const gj = streets.indexOf(goal.y);
  const key = (i, j) => i + ',' + j;
  const prev = new Map();
  const queue = [[si, sj]];
  prev.set(key(si, sj), null);
  while (queue.length > 0) {
    const [i, j] = queue.shift();
    if (i === gi && j === gj) break;
    for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (ni < 0 || ni >= avenues.length || nj < 0 || nj >= streets.length) continue;
      if (prev.has(key(ni, nj))) continue;
      prev.set(key(ni, nj), [i, j]);
      queue.push([ni, nj]);
    }
  }
  const path = [];
  let cur = [gi, gj];
  while (cur) {
    path.unshift({ x: avenues[cur[0]], y: streets[cur[1]] });
    cur = prev.get(key(cur[0], cur[1]));
  }
  // Titik jalan terdekat dulu (keluar dari blok), lalu persimpangan, lalu
  // titik jalan terdekat target, baru targetnya — agar tidak memotong blok.
  const first = nearestRoadPoint(from.x, from.y);
  const last = nearestRoadPoint(to.x, to.y);
  const wps = [{ x: first.x, y: first.y }, ...path, { x: last.x, y: last.y }, { x: to.x, y: to.y }];
  return wps;
}

// --- Autopilot: memainkan game sungguhan sampai menang ------------------------
// Menggerakkan input (tombol + mouse) seperti pemain, lewat loop game yang
// sama. Dipakai ?autotest=1. Log ke console untuk verifikasi luar.
export function autopilot(G, dt) {
  const p = G.player;
  const inp = G.input;
  const M = G.mission;
  G.autoLog = G.autoLog || { last: '', t: 0 };
  G.autoLog.t += dt;

  const log = (msg) => {
    if (G.autoLog.last !== msg) {
      G.autoLog.last = msg;
      console.log('[AUTOTEST] ' + msg);
    }
  };

  // Dialog: lanjutkan otomatis.
  if (G.dialogue) {
    if (G.autoLog.t - (G.autoLog.dialogAt || 0) > 0.7) {
      G.autoLog.dialogAt = G.autoLog.t;
      inp.pressed.add('Enter');
    }
    return;
  }
  // Toko: tutup saja (autotest tidak belanja).
  if (G.shopOpen) {
    inp.pressed.add('Escape');
    return;
  }
  // Layar akhir.
  if (G.state === 'victory') {
    console.log('[AUTOTEST] PASS — kemenangan tercapai. Misi: ' + p.missionsDone + '/5, uang: Rp ' + p.cash);
    document.title = 'AUTOTEST PASS';
    G.autotestDone = true;
    return;
  }
  if (G.state === 'gameover') {
    console.log('[AUTOTEST] FAIL — pemain mati.');
    document.title = 'AUTOTEST FAIL gameover';
    G.autotestDone = true;
    return;
  }
  if (G.state === 'title') {
    inp.pressed.add('Enter');
    log('mulai dari layar judul');
    return;
  }

  // Lepas tombol E yang mungkin macet tertahan dari stage bobol brankas.
  inp.keys.delete('E');
  // Heal darurat — dicek paling awal agar tidak ter-skip oleh early return.
  if (p.hp < 40 && p.medkits > 0) inp.pressed.add('H');
  // Senjata api kehabisan amunisi total -> tinju; ada amunisi -> kembali ke pistol.
  if (p.weapon !== 'fist' && (p.mag[p.weapon] || 0) === 0 && (p.reserve[p.weapon] || 0) === 0) {
    inp.pressed.add('1');
  } else if (p.weapon === 'fist' && p.owned.pistol && ((p.mag.pistol || 0) > 0 || (p.reserve.pistol || 0) > 0)) {
    inp.pressed.add('2');
  }
  if (p.hp < 25) log('HP kritis: ' + Math.round(p.hp));

  // Target: penanda misi, NPC, musuh, atau pickup.
  let target = null;
  let mode = 'goto';
  if (M.active && M.marker) {
    target = { x: M.marker.x, y: M.marker.y };
  }
  // Musuh misi terdekat lebih penting saat stage bunuh/bos.
  const stageId = M.stage ? M.stage.id : '';
  const killStage = stageId.includes('hadapi') || stageId.includes('bos') || stageId.includes('konvoi');
  let nearestEnemy = null;
  let nearestD = Infinity;
  for (const e of G.enemies) {
    if (e.dead || !e.mission) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < nearestD) { nearestD = d; nearestEnemy = e; }
  }
  if (killStage && nearestEnemy) {
    target = { x: nearestEnemy.x, y: nearestEnemy.y };
    mode = 'combat';
  }
  // Kendaraan misi: kejar posisi aslinya, bukan titik statis — taksi/becak
  // bisa terdorong sedikit saat kau mendekat dengan mobil.
  const mv = M.stageData.taxi || M.stageData.bike;
  if ((stageId.includes('curi') || stageId.includes('ambil-paket')) && mv && !mv.crashed) {
    target = { x: mv.x, y: mv.y };
  }
  // Pickup uang misi.
  if ((stageId.includes('ambil-uang') || stageId.includes('uang')) && G.pickups.length > 0) {
    const pk = G.pickups[0];
    target = { x: pk.x, y: pk.y };
    mode = 'goto';
  }
  if (!target && M.marker) target = { x: M.marker.x, y: M.marker.y };
  if (!target) {
    // Tidak ada misi aktif: menuju penanda misi berikutnya.
    const start = G.nextMissionStart ? G.nextMissionStart() : null;
    if (start) {
      target = { x: start.x, y: start.y };
      mode = 'goto';
    } else {
      log('tidak ada target — menunggu');
      return;
    }
  }

  const dTarget = Math.hypot(target.x - p.x, target.y - p.y);
  const isSteal = stageId.includes('curi') || stageId.includes('ambil-paket');
  const needOnFoot = stageId.includes('temui') || stageId.includes('selesai') || stageId.includes('kembali')
    || stageId.includes('bobol') || stageId.includes('finale') || stageId.includes('bos')
    || stageId.includes('ambil') || stageId.includes('curi');
  const isFollow = stageId.includes('ikuti');
  const isCrack = stageId.includes('bobol');
  const isKonvoi = stageId.includes('konvoi');

  // Isi ulang otomatis bila magazen kosong.
  if (p.weapon !== 'fist' && p.mag[p.weapon] === 0 && p.reserve[p.weapon] > 0) {
    inp.pressed.add('R');
  }

  // Stage konvoi (misi 5): targetkan mobil pengawal terdekat, tabrak/tembak.
  let convoyTarget = null;
  if (isKonvoi && M.stageData.escorts) {
    let bd = Infinity;
    for (const c of M.stageData.escorts) {
      if (c.crashed) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; convoyTarget = c; }
    }
    if (convoyTarget) {
      target = { x: convoyTarget.x, y: convoyTarget.y };
      mode = 'ram';
      // Tanpa mobil, cari mobil dulu untuk menabrak (jangan jalan kaki).
      if (!p.inCar) {
        let bestCar = null;
        let bd2 = 250;
        for (const car of G.cars) {
          if (car.isPolice && car.driver) continue;
          if (M.stageData.escorts.includes(car)) continue;
          if (car.crashed) continue;
          const d = Math.hypot(car.x - p.x, car.y - p.y);
          if (d < bd2) { bd2 = d; bestCar = car; }
        }
        if (bestCar) {
          target = { x: bestCar.x, y: bestCar.y };
          if (bd2 < 70) { inp.pressed.add('E'); log('masuk mobil untuk menabrak konvoi'); }
        }
      }
      // Tembak dari mobil (drive-by) — jangan turun jalan kaki, pengawal
      // bergerak dan kau akan tertinggal di antara blok.
      if (bd < 420 && p.weapon !== 'fist') {
        aimAtLead(G, convoyTarget.x, convoyTarget.y, convoyTarget.angle, convoyTarget.speed);
        if (bd < 300) { inp.mouse.down = true; inp.mouse.clicked = true; }
      }
    }
  }

  // Curi kendaraan misi: tekan E saat dekat becak/taksi misi.
  if (isSteal && !p.inCar) {
    const mv = M.stageData.bike || M.stageData.taxi;
    if (mv && Math.hypot(mv.x - p.x, mv.y - p.y) < 75) {
      inp.pressed.add('E');
      log('masuk kendaraan misi');
      return;
    }
  }

  // Tempur: di dalam mobil, tabrak musuh (lebih aman daripada turun).
  // Turun hanya bila mobil hampir hancur atau musuh bos yang harus ditembak.
  if (killStage && nearestEnemy) {
    if (p.inCar) {
      if (p.inCar.hp < 60) {
        inp.pressed.add('E');
        log('mobil rusak — turun dan bertempur dari jarak aman');
        return;
      }
      driveToward(G, { x: nearestEnemy.x, y: nearestEnemy.y }, true);
      log('menabrak ' + (nearestEnemy.name || 'musuh'));
      return;
    }
    if (!p.inCar) {
      aimAtLead(G, nearestEnemy.x, nearestEnemy.y, nearestEnemy.angle, nearestEnemy.state === 'chase' ? nearestEnemy.speed : 0);
      if (nearestD > 260) {
        walkToward(G, { x: nearestEnemy.x, y: nearestEnemy.y });
      } else {
        // Strafe menyamping sambil menembak — jangan jadi sasaran diam.
        const aim = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
        const side = (Math.floor(G.timeNow * 0.8) % 2 === 0 ? 1 : -1) * (Math.PI / 2);
        walkToward(G, { x: p.x + Math.cos(aim + side) * 160, y: p.y + Math.sin(aim + side) * 160 });
        if (p.weapon === 'fist' && nearestD < 60) inp.pressed.add('F');
        else if (p.weapon !== 'fist' && nearestD < 280) { inp.mouse.down = true; inp.mouse.clicked = true; }
      }
      return;
    }
  }

  // Masuk mobil bila jauh dan ada mobil dekat (dan tidak butuh jalan kaki dekat target).
  if (!p.inCar && dTarget > 320 && !needOnFoot) {
    let bestCar = null;
    let bd = 120;
    for (const car of G.cars) {
      if (car.isPolice && car.driver) continue;
      if (carHitsBuilding(car, G.world.buildings)) continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bd) { bd = d; bestCar = car; }
    }
    if (bestCar) {
      target = { x: bestCar.x, y: bestCar.y };
      if (bd < 70) {
        inp.pressed.add('E');
        log('masuk mobil');
      }
    }
  }

  // Keluar mobil bila dekat penanda mulai misi (belum ada misi aktif).
  if (p.inCar && !M.active && M.marker && dTarget < 160) {
    inp.pressed.add('E');
    log('keluar mobil untuk memulai misi');
    return;
  }
  // Keluar mobil bila target butuh jalan kaki dan sudah dekat — kecuali bila
  // mobil yang dikendarai ADALAH kendaraan misi (becak/taksi): stage selesai
  // justru saat berada di dalamnya.
  if (p.inCar && needOnFoot && dTarget < 220 && p.inCar !== mv) {
    inp.pressed.add('E');
    log('keluar mobil untuk interaksi');
    return;
  }

  // Ikuti konvoi: jaga jarak 120-200.
  if (isFollow && M.stageData.convoy && M.stageData.convoy[0]) {
    const lead = M.stageData.convoy[0];
    const d = Math.hypot(lead.x - p.x, lead.y - p.y);
    if (d > 200) target = { x: lead.x, y: lead.y };
    else if (d < 110) {
      // Mundur: jangan gas, biarkan jarak membesar.
      inp.keys.delete('W');
      log('menjaga jarak konvoi');
      return;
    } else {
      // Ikuti pelan.
      target = { x: lead.x, y: lead.y };
    }
  }

  // Bobol brankas: habisi penjaga misi dulu, baru tahan E.
  if (isCrack) {
    let guard = null;
    let gd = Infinity;
    for (const e of G.enemies) {
      if (e.dead || !e.mission) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < gd) { gd = d; guard = e; }
    }
    if (guard && gd < 350 && !p.inCar) {
      aimAtLead(G, guard.x, guard.y, guard.angle, guard.state === 'chase' ? guard.speed : 0);
      if (gd > 200) walkToward(G, { x: guard.x, y: guard.y });
      else if (p.weapon !== 'fist') { inp.mouse.down = true; inp.mouse.clicked = true; }
      log('menghabisi penjaga gudang dulu');
      return;
    }
    if (guard && gd < 350 && p.inCar) {
      inp.pressed.add('E');
      return;
    }
  }
  // Bobol brankas: tahan E di dekat brankas.
  if (isCrack && dTarget < 90 && !p.inCar) {
    inp.keys.add('E');
    log('membobol brankas… ' + Math.round(M.stageData.crack || 0) + '/8 dtk');
    return;
  }
  // Foto: tekan E di dekat gudang (boleh dari mobil).
  if (stageId.includes('foto') && dTarget < 130) {
    inp.pressed.add('E');
    return;
  }

  // NPC dekat: tekan E untuk bicara — hanya saat stage memang butuh bicara.
  const isTalkStage = stageId.includes('temui') || stageId.includes('selesai')
    || stageId.includes('kembali') || stageId.includes('finale');
  if (!p.inCar && isTalkStage) {
    for (const npc of G.npcs) {
      if (Math.hypot(npc.x - p.x, npc.y - p.y) < 65) {
        inp.pressed.add('E');
        log('bicara dengan ' + npc.name);
        return;
      }
    }
  }
  // Penanda misi (mulai misi baru): tekan E saat dekat dan tidak ada misi aktif.
  if (!M.active && M.marker && dTarget < 80 && !p.inCar) {
    inp.pressed.add('E');
    log('memulai misi di penanda');
    return;
  }

  // Gerak menuju target — lewat jaringan jalan (bukan garis lurus menembus blok).
  let navPoint = target;
  const useRoute = !killStage && !isFollow && mode !== 'ram' && !isCrack;
  if (useRoute) {
    const key = (stageId || 'free') + '|' + Math.round(target.x / 50) + ',' + Math.round(target.y / 50);
    if (G.autoRouteKey !== key) {
      G.autoRouteKey = key;
      G.autoRoute = computeRoute(p, target);
      G.autoRouteIdx = 0;
    }
    const wps = G.autoRoute || [target];
    while (G.autoRouteIdx < wps.length - 1) {
      const wp = wps[G.autoRouteIdx];
      if (Math.hypot(wp.x - p.x, wp.y - p.y) < (p.inCar ? 80 : 45)) G.autoRouteIdx++;
      else break;
    }
    navPoint = wps[Math.min(G.autoRouteIdx, wps.length - 1)];
  }
  // Deteksi macet: tidak bergerak padahal target jauh -> jalan memutar.
  G.autoStuck = G.autoStuck || { x: p.x, y: p.y, t: G.timeNow };
  if (Math.hypot(p.x - G.autoStuck.x, p.y - G.autoStuck.y) > 25) {
    G.autoStuck = { x: p.x, y: p.y, t: G.timeNow };
    G.autoDetour = null;
    G.autoStuckCount = 0;
  } else if (G.timeNow - G.autoStuck.t > 2.0 && dTarget > 130) {
    if (p.inCar) {
      // Mobil terjepit: mundur 1,2 detik sambil menggoyang setir.
      G.autoReverseUntil = G.timeNow + 1.2;
      G.autoRouteKey = null;
      G.autoStuckCount = (G.autoStuckCount || 0) + 1;
      log('tersangkut — mundur dulu');
      if (G.autoStuckCount >= 3) {
        // Macet berkali-kali: tinggalkan mobil, lanjut jalan kaki.
        G.autoStuckCount = 0;
        inp.pressed.add('E');
        log('macet berkali-kali — lanjut jalan kaki');
      }
    } else if (!G.autoDetour) {
      const side = Math.random() < 0.5 ? 1 : -1;
      const a = Math.atan2(target.y - p.y, target.x - p.x) + side * (Math.PI / 2);
      const dp = nearestRoadPoint(p.x + Math.cos(a) * 260, p.y + Math.sin(a) * 260);
      G.autoDetour = { x: dp.x, y: dp.y, until: G.timeNow + 2.5 };
      G.autoRouteKey = null;
      log('tersangkut — mencari jalan memutar');
    }
    G.autoStuck = { x: p.x, y: p.y, t: G.timeNow };
  }
  if (G.autoDetour && G.timeNow < G.autoDetour.until) navPoint = G.autoDetour;
  else if (G.autoDetour) G.autoDetour = null;
  if (p.inCar && G.autoReverseUntil && G.timeNow < G.autoReverseUntil) {
    inp.keys.delete('W'); inp.keys.delete('A'); inp.keys.delete('S'); inp.keys.delete('D');
    inp.keys.add('S');
  } else if (p.inCar) {
    driveToward(G, navPoint, mode === 'combat');
  } else {
    walkToward(G, navPoint);
  }

  // Tempur: arahkan mouse ke musuh terdekat dan tembak.
  if (nearestEnemy && nearestD < 420) {
    const car = p.inCar;
    const px = car ? car.x : p.x;
    const py = car ? car.y : p.y;
    aimAtLead(G, nearestEnemy.x, nearestEnemy.y, nearestEnemy.angle, nearestEnemy.state === 'chase' ? nearestEnemy.speed : 0);
    if (p.weapon === 'fist' && nearestD < 60) {
      inp.pressed.add('F');
    } else if (p.weapon !== 'fist') {
      // Tembak bila musuh dalam jangkauan efektif (jangan semprot dari jauh).
      if (nearestD < 280) { inp.mouse.down = true; inp.mouse.clicked = true; }
    }
    // Beli senjata otomatis? Tidak — autotest memakai pistol awal? Pastikan
    // pemain punya pistol: bila tidak punya dan musuh dekat, dekati dan pukul.
    if (!p.owned.pistol && !p.owned.smg && !p.owned.shotgun && nearestD > 60) {
      log('tanpa senjata api — mendekat untuk memukul');
    }
  } else {
    inp.mouse.down = false;
  }


}

function walkToward(G, target) {
  const p = G.player;
  const inp = G.input;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  inp.keys.delete('W'); inp.keys.delete('A'); inp.keys.delete('S'); inp.keys.delete('D');
  if (Math.abs(dx) > 12) inp.keys.add(dx > 0 ? 'D' : 'A');
  if (Math.abs(dy) > 12) inp.keys.add(dy > 0 ? 'S' : 'W');
}

function driveToward(G, target, aggressive) {
  const p = G.player;
  const inp = G.input;
  const car = p.inCar;
  if (!car) return;
  const desired = Math.atan2(target.y - car.y, target.x - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  inp.keys.delete('W'); inp.keys.delete('A'); inp.keys.delete('S'); inp.keys.delete('D');
  inp.keys.add('W');
  if (diff > 0.12) inp.keys.add('D');
  else if (diff < -0.12) inp.keys.add('A');
  // Rem bila terlalu cepat dan target dekat — kecuali mode agresif (ram):
  // di sana mobil justru harus menabrak dengan kecepatan penuh.
  const d = Math.hypot(target.x - car.x, target.y - car.y);
  if (!aggressive && d < 140 && Math.abs(car.speed) > 120) {
    inp.keys.delete('W');
    inp.keys.add('S');
  }
  if (aggressive && Math.abs(car.speed) > 200) inp.keys.add('Shift');
}

function aimAt(G, x, y) {
  const p = G.player;
  const cam = G.cam;
  const scaleX = G.canvas.width / cam.w;
  const scaleY = G.canvas.height / cam.h;
  G.input.mouse.worldX = x;
  G.input.mouse.worldY = y;
  G.input.mouse.x = (x - (cam.x - cam.w / 2)) * scaleX;
  G.input.mouse.y = (y - (cam.y - cam.h / 2)) * scaleY;
}

// Bidik dengan memimpin sasaran (lead): peluru butuh waktu terbang sampai ke
// musuh yang bergerak — bidik ke posisi depannya, bukan posisi saat ini.
function aimAtLead(G, x, y, angle, speed) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  const bs = (w && w.speed) || 700;
  const d = Math.hypot(x - p.x, y - p.y);
  const tof = d / bs;
  aimAt(G, x + Math.cos(angle) * (speed || 0) * tof, y + Math.sin(angle) * (speed || 0) * tof);
}
