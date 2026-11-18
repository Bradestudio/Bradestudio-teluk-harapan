// TELUK HARAPAN — missions.js
// Lima story mission, masing-masing satu arc lengkap (intro, konflik,
// twist, finale) dengan dialog, tujuan bervariasi, dan hadiah.
// Misi 1-2 di Hari 1 (Senja), 3-4 di Hari 2 (Maghrib), 5 di Hari 3 (Malam).

import { MISSIONS, STORY } from './config.js';
import { dist, angleTo } from './random.js';
import { makeEnemy } from './combat.js';
import { makeCar } from './vehicles.js';
import { addCash, raiseWanted, lowerWanted } from './player.js';
import { districtAt } from './world.js';

// --- Titik-titik penting di peta --------------------------------------------
export const SPOTS = {
  tono: { x: 340, y: 1250, label: 'Pak Tono — Pelabuhan' },
  pasarDrop: { x: 1500, y: 500, label: 'Pasar Ikan Lama' },
  balai: { x: 1200, y: 1250, label: 'Balai Kota Tua' },
  bengkel: { x: 1800, y: 1150, label: 'Bengkel Jaya — Sinta' },
  taksi: { x: 1200, y: 850, label: 'Taksi Kuning' },
  gudang: { x: 860, y: 2150, label: 'Gudang 7 — Dermaga Neon' },
  dermaga: { x: 2100, y: 2150, label: 'Klub Lampion' },
  vila: { x: 2950, y: 575, label: 'Vila Bukit' },
  rumah: { x: 2950, y: 600, label: 'Rumah Aman' },
};

// --- State misi ---------------------------------------------------------------
export function createMissionState() {
  return {
    id: 0, // 0 = belum ada misi aktif
    stageIndex: -1,
    stage: null,
    stageTimer: 0,
    stageData: {},
    active: false,
    completed: [],
    objective: 'Jelajahi Teluk Harapan. Cari penanda misi kuning di peta.',
    marker: null, // {x,y,label}
    stealth: 0, // meter deteksi untuk misi penyamaran
    followCar: null,
    boss: null,
    safeTimer: 0,
    introShown: false,
  };
}

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id);
}

export function nextMissionId(G) {
  for (const m of MISSIONS) {
    if (!G.mission.completed.includes(m.id)) return m.id;
  }
  return 0;
}

// Posisi mulai misi berikutnya (penanda kuning di peta).
export function nextMissionStart(G) {
  const id = nextMissionId(G);
  if (id === 1) return { ...SPOTS.tono, missionId: 1 };
  if (id === 2) return { ...SPOTS.bengkel, missionId: 2 };
  if (id === 3) return { ...SPOTS.tono, missionId: 3 };
  if (id === 4) return { ...SPOTS.bengkel, missionId: 4 };
  if (id === 5) return { ...SPOTS.dermaga, missionId: 5 };
  return null;
}

export function startMission(G, id) {
  const def = missionById(id);
  if (!def) return false;
  const M = G.mission;
  // NPC misi lama dibersihkan — jangan sampai dua 'Pak Tono' di titik sama
  // dan autopilot/pemain bicara dengan yang salah.
  G.npcs = [];
  // Polisi jalan kaki dari sebelum misi juga diusir — mereka bukan bagian
  // dari misi, dan penangkapan di tengah baku tembak terasa tidak adil.
  G.enemies = G.enemies.filter((e) => !e.isCop);
  M.id = id;
  M.active = true;
  M.stageIndex = 0;
  M.stageData = {};
  M.introShown = true;
  G.player.day = def.day;
  G.setDay(def.day);
  G.showDialogue(def.intro, () => {
    enterStage(G, 0);
  });
  G.audio.sfx.mission();
  return true;
}

export function enterStage(G, idx) {
  const M = G.mission;
  const def = missionById(M.id);
  const stage = def.stages[idx];
  if (!stage) {
    completeMission(G);
    return;
  }
  M.stageIndex = idx;
  M.stage = stage;
  M.stageTimer = 0;
  M.stageData = {};
  M.objective = stage.text;
  M.marker = stage.target ? { x: stage.target.x, y: stage.target.y, label: stage.target.label || stage.text } : null;
  if (stage.onEnter) stage.onEnter(G);
  G.addToast('Tujuan: ' + stage.text);
}

export function advanceStage(G) {
  const M = G.mission;
  const def = missionById(M.id);
  G.audio.sfx.pickup();
  enterStage(G, M.stageIndex + 1);
}

export function completeMission(G) {
  const M = G.mission;
  const def = missionById(M.id);
  M.active = false;
  M.completed.push(M.id);
  M.stage = null;
  M.marker = null;
  G.npcs = [];
  // Bersihkan sisa misi: musuh dan kendaraan misi tidak boleh mengejar
  // pemain selamanya ke misi berikutnya.
  G.enemies = G.enemies.filter((e) => !e.mission);
  G.cars = G.cars.filter((c) => !c.mission || c === G.player.inCar);
  if (M.followCar) M.followCar = null;
  G.mission.boss = null;
  M.objective = 'Misi selesai! Cari penanda misi berikutnya.';
  G.player.missionsDone++;
  G.player.medkits = Math.min(3, (G.player.medkits || 0) + 1);
  G.addToast('+1 kotak P3K dari Sinta. Sisa: ' + G.player.medkits);
  // Misi selesai: polisi kehilangan jejak sepenuhnya — jangan biarkan
  // kejaran misi sebelumnya membunuh pemain di jalan menuju misi berikut.
  G.player.wantedHeat = 0;
  G.player.wanted = 0;
  G.enemies = G.enemies.filter((e) => !e.isCop);
  G.addToast('Polisi kehilangan jejakmu. Tarik napas sebelum misi berikut.');
  addCash(G, def.reward, 'Hadiah misi: ' + def.title);
  G.audio.sfx.mission();
  G.showDialogue(def.outro, () => {
    // Pergantian hari setelah misi 2 dan 4.
    if (M.id === 2) {
      G.setDay(2);
      G.addToast('Hari berganti — Maghrib turun di Teluk Harapan.');
    } else if (M.id === 4) {
      G.setDay(3);
      G.addToast('Hari berganti — Malam terakhir telah tiba.');
    }
    const next = nextMissionId(G);
    if (next === 0) {
      G.state = 'victory';
      G.audio.sfx.mission();
    } else {
      const start = nextMissionStart(G);
      if (start) {
        M.marker = { x: start.x, y: start.y, label: 'Misi ' + next + ': ' + missionById(next).title };
        M.objective = 'Menuju misi berikutnya: ' + missionById(next).title;
      }
    }
  });
  if (M.id === 5) {
    // Misi terakhir: kemenangan langsung setelah outro.
    setTimeout(() => { if (G.state === 'playing') G.state = 'victory'; }, 100);
  }
}

export function failMission(G, reason) {
  const M = G.mission;
  if (!M.active) return;
  M.active = false;
  M.stage = null;
  M.marker = null;
  G.npcs = [];
  G.audio.sfx.fail();
  G.addToast('MISI GAGAL: ' + reason + ' — kembali ke penanda misi untuk mencoba lagi.');
  G.player.hp = Math.max(40, G.player.hp);
  G.player.wanted = 0;
  G.player.wantedHeat = 0;
  // Bersihkan musuh dan kendaraan misi (taksi/becak gagal tidak menumpuk).
  G.enemies = G.enemies.filter((e) => !e.mission);
  G.cars = G.cars.filter((c) => !c.mission || c === G.player.inCar);
  if (M.followCar) {
    G.cars = G.cars.filter((c) => c !== M.followCar);
    M.followCar = null;
  }
  const start = nextMissionStart(G);
  if (start) {
    M.marker = { x: start.x, y: start.y, label: 'Coba lagi: ' + missionById(M.id).title };
    M.objective = 'Misi gagal — kembali ke penanda untuk mencoba lagi.';
  }
}

// Dipanggil tiap frame saat misi aktif.
export function updateMission(G, dt) {
  const M = G.mission;
  if (!M.active || !M.stage) return;
  M.stageTimer += dt;
  const stage = M.stage;
  if (stage.onUpdate) stage.onUpdate(G, dt);
  if (stage.isDone && stage.isDone(G)) {
    advanceStage(G);
  }
}

// Event dari sistem lain (bos mati, dll).
export function missionEvent(G, kind, data) {
  const M = G.mission;
  if (!M.active || !M.stage) return;
  if (M.stage.onEvent) M.stage.onEvent(G, kind, data);
}

// --- Pembantu stage -----------------------------------------------------------
function spawnGoons(G, spots, count, opts = {}) {
  const spawned = [];
  for (let i = 0; i < count; i++) {
    const s = spots[i % spots.length];
    const e = makeEnemy(G, s.x + (Math.random() - 0.5) * 90, s.y + (Math.random() - 0.5) * 90, {
      hp: opts.hp || 60,
      speed: opts.speed || 100,
      damage: opts.damage || 8,
      dropsCash: opts.dropsCash || 60,
      isBoss: !!opts.isBoss,
      name: opts.name,
    });
    e.mission = true;
    e.state = 'chase';
    spawned.push(e);
    G.enemies.push(e);
  }
  return spawned;
}

function markerReached(G, radius) {
  const M = G.mission;
  if (!M.marker) return false;
  return dist(G.player.x, G.player.y, M.marker.x, M.marker.y) < (radius || 70);
}

// --- Definisi stage tiap misi ------------------------------------------------
// Setiap stage: text (tujuan di HUD), target (penanda), onEnter, onUpdate,
// isDone. Arc tiap misi: intro -> konflik -> twist -> finale.

MISSIONS[0].stages = [
  {
    id: 'm1-temui-tono',
    text: 'Temui Pak Tono di Pelabuhan Senja',
    target: SPOTS.tono,
    onEnter(G) {
      G.npcs.push({
        id: 'tono', name: 'Pak Tono', x: SPOTS.tono.x, y: SPOTS.tono.y,
        color: '#2fa08a', role: 'Nelayan tua',
        talk(G2) { G2.showDialogue([{ who: 'Pak Tono', text: 'Paketnya di becak motorku. Ambil, bawa ke Pasar Ikan. Cepat!' }]); },
      });
    },
    isDone(G) { return G.mission.stageData.metTono; },
    onEvent(G, kind) { if (kind === 'npcTalk' && G.mission.stageData.npcId === 'tono') G.mission.stageData.metTono = true; },
  },
  {
    id: 'm1-ambil-paket',
    text: 'Ambil paket dari becak motor Pak Tono',
    target: { x: 300, y: 1150, label: 'Becak Motor Pak Tono' },
    onEnter(G) {
      const bike = makeCar('becakmotor', 300, 1150, Math.PI / 2, { owned: false });
      bike.mission = true;
      G.cars.push(bike);
      G.mission.stageData.bike = bike;
    },
    onUpdate(G) {
      const bike = G.mission.stageData.bike;
      if (bike && G.player.inCar === bike) {
        G.mission.stageData.gotPackage = true;
        G.addToast('Paket di tangan! Bawa ke Pasar Ikan sebelum senja habis.');
      }
    },
    isDone(G) { return G.mission.stageData.gotPackage; },
  },
  {
    id: 'm1-antar',
    text: 'Antar paket ke Pasar Ikan Lama (sebelum waktu habis!)',
    target: SPOTS.pasarDrop,
    onEnter(G) {
      G.mission.stageData.timeLeft = 100;
      G.addToast('Waktu: 100 detik. Jangan sampai paket ini terlambat!');
    },
    onUpdate(G, dt) {
      const M = G.mission;
      M.stageData.timeLeft -= dt;
      if (M.stageData.timeLeft <= 0) {
        failMission(G, 'paket terlambat sampai');
      }
      // Kejutan: dua anak buah Darma menghadang di tengah jalan.
      if (!M.stageData.ambush && M.stageTimer > 12) {
        M.stageData.ambush = true;
        spawnGoons(G, [{ x: 1200, y: 850 }, { x: 1250, y: 900 }], 2, { hp: 50, dropsCash: 80 });
        G.addToast('Anak buah Darma menghadang! Tabrak atau hindari mereka!');
        raiseWanted(G, 8, 'dikejar anak buah Darma');
      }
    },
    isDone(G) { return markerReached(G, 80); },
  },
  {
    id: 'm1-selesai',
    text: 'Serahkan paket ke pedagang pasar',
    target: SPOTS.pasarDrop,
    onEnter(G) {
      G.npcs.push({
        id: 'pedagang', name: 'Bu Sari', x: SPOTS.pasarDrop.x + 40, y: SPOTS.pasarDrop.y + 20,
        color: '#c95a4a', role: 'Pedagang ikan',
        talk(G2) {
          G2.showDialogue([{ who: 'Bu Sari', text: 'Paket diterima, Nak. Pak Tono percaya padamu — jaga kepercayaan itu.' }]);
        },
      });
    },
    isDone(G) { return G.mission.stageData.delivered; },
    onEvent(G, kind) { if (kind === 'npcTalk' && G.mission.stageData.npcId === 'pedagang') G.mission.stageData.delivered = true; },
  },
];

MISSIONS[1].stages = [
  {
    id: 'm2-ke-balai',
    text: 'Pergi ke Balai Kota Tua — anak buah Darma menunggu',
    target: SPOTS.balai,
    onEnter(G) {
      G.addToast('Sinta: mereka berempat, bersenjata. Siapkan dirimu dulu kalau perlu.');
    },
    isDone(G) { return markerReached(G, 110); },
  },
  {
    id: 'm2-hadapi',
    text: 'Hadapi 4 anak buah Darma di Balai Kota Tua',
    target: SPOTS.balai,
    onEnter(G) {
      const goons = spawnGoons(G, [
        { x: 1120, y: 1250 }, { x: 1280, y: 1250 },
        { x: 1120, y: 950 }, { x: 1280, y: 950 },
      ], 4, { hp: 40, damage: 5, dropsCash: 120 });
      G.mission.stageData.goons = goons;
      G.addToast('Mereka menyerang! Bertahanlah, Raka!');
      raiseWanted(G, 6, 'perkelahian di Kota Tua');
    },
    isDone(G) {
      const goons = G.mission.stageData.goons || [];
      return goons.length > 0 && goons.every((e) => e.dead);
    },
  },
  {
    id: 'm2-ambil-uang',
    text: 'Ambil tas uang yang mereka jatuhkan',
    target: SPOTS.balai,
    onEnter(G) {
      G.pickups.push({ kind: 'cash', x: 1200, y: 1250, amount: 400, label: 'Tas Uang' });
      G.addToast('Tas uang ada di tengah plaza. Ambil!');
    },
    isDone(G) { return G.mission.stageData.gotBag; },
    onEvent(G, kind) { if (kind === 'pickupCash') G.mission.stageData.gotBag = true; },
  },
  {
    id: 'm2-kembali',
    text: 'Kembali ke Bengkel Jaya, temui Sinta',
    target: SPOTS.bengkel,
    onEnter(G) {
      G.npcs.push({
        id: 'sinta', name: 'Sinta', x: SPOTS.bengkel.x, y: SPOTS.bengkel.y,
        color: '#e8c832', role: 'Montir',
        talk(G2) {
          G2.showDialogue([{ who: 'Sinta', text: 'Uang kembali, dan kau masih hidup. Itu sudah lebih dari cukup untuk hari ini.' }]);
        },
      });
      // Polisi mulai memperhatikan setelah perkelahian.
      raiseWanted(G, 4, 'keributan di Kota Tua');
    },
    isDone(G) { return G.mission.stageData.metSinta; },
    onEvent(G, kind) { if (kind === 'npcTalk' && G.mission.stageData.npcId === 'sinta') G.mission.stageData.metSinta = true; },
  },
];

MISSIONS[2].stages = [
  {
    id: 'm3-temui-tono',
    text: 'Temui Pak Tono di Pelabuhan (Maghrib)',
    target: SPOTS.tono,
    onEnter(G) {
      G.npcs.push({
        id: 'tono2', name: 'Pak Tono', x: SPOTS.tono.x, y: SPOTS.tono.y,
        color: '#2fa08a', role: 'Nelayan tua',
        talk(G2) { G2.showDialogue([{ who: 'Pak Tono', text: 'Taksi kuning di Pasar Ikan itu bukan taksi. Curilah — tapi jangan sampai ketahuan.' }]); },
      });
    },
    isDone(G) { return G.mission.stageData.metTono; },
    onEvent(G, kind) { if (kind === 'npcTalk' && G.mission.stageData.npcId === 'tono2') G.mission.stageData.metTono = true; },
  },
  {
    id: 'm3-curi-taksi',
    text: 'Curi taksi kuning di Pasar Ikan (jangan bikin keributan)',
    target: SPOTS.taksi,
    onEnter(G) {
      const taxi = makeCar('taksi', SPOTS.taksi.x, SPOTS.taksi.y, 0, { owned: false });
      taxi.mission = true;
      G.cars.push(taxi);
      G.mission.stageData.taxi = taxi;
      // Panas yang sudah ada sebelum pencurian bukan salahmu — yang dinilai
      // hanya keributan BARU selama mencuri (tembakan, tabrak warga, dll).
      G.mission.stageData.heatAtStart = G.player.wantedHeat;
      G.addToast('Taksi kuning ada di depan pasar. Dekati dari belakang, tekan E.');
    },
    onUpdate(G) {
      let taxi = G.mission.stageData.taxi;
      if (taxi && taxi.hp <= 0) {
        // Taksi dihancurkan saat kau dalam perjalanan — ada taksi kuning lain.
        G.cars = G.cars.filter((c) => c !== taxi);
        const fresh = makeCar('taksi', SPOTS.taksi.x, SPOTS.taksi.y, 0, { owned: false });
        fresh.mission = true;
        G.cars.push(fresh);
        G.mission.stageData.taxi = fresh;
        taxi = fresh;
        G.addToast('Taksi pertama hancur — ada taksi kuning lain di pasar.');
      }
      if (taxi && G.player.inCar === taxi) {
        G.mission.stageData.stoleTaxi = true;
        G.addToast('Taksi dicuri! Sekarang ikuti konvoi dari kejauhan.');
      }
      if (!G.mission.stageData.stoleTaxi
        && G.player.wantedHeat - (G.mission.stageData.heatAtStart || 0) >= 20) {
        failMission(G, 'aksimu ketahuan — polisi melihat keributan di pasar');
      }
    },
    isDone(G) { return G.mission.stageData.stoleTaxi; },
  },
  {
    id: 'm3-ikuti',
    text: 'Ikuti konvoi Darma ke Dermaga Neon — jaga jarak 80-220m',
    target: SPOTS.gudang,
    onEnter(G) {
      // Konvoi: 2 mobil yang bergerak menuju gudang.
      const lead = makeCar('truk', 1500, 850, Math.PI / 2, { driver: 'traffic', ai: { kind: 'convoy', cruise: 120 } });
      const escort = makeCar('sedan', 1500, 920, Math.PI / 2, { driver: 'traffic', ai: { kind: 'convoy', cruise: 120 } });
      lead.mission = true;
      escort.mission = true;
      G.cars.push(lead, escort);
      G.mission.stageData.convoy = [lead, escort];
      G.mission.stageData.followTime = 0;
      G.addToast('Konvoi bergerak ke selatan. Jangan terlalu dekat, jangan terlalu jauh!');
    },
    onUpdate(G, dt) {
      const M = G.mission;
      const convoy = M.stageData.convoy || [];
      const lead = convoy[0];
      if (!lead) return;
      // Konvoi bergerak sendiri menuju gudang.
      const a = angleTo(lead.x, lead.y, SPOTS.gudang.x, SPOTS.gudang.y);
      lead.angle += (a - lead.angle) * Math.min(1, dt * 1.5);
      lead.x += Math.cos(lead.angle) * 120 * dt;
      lead.y += Math.sin(lead.angle) * 120 * dt;
      const esc = convoy[1];
      if (esc) {
        esc.x += (lead.x - Math.cos(lead.angle) * 60 - esc.x) * Math.min(1, dt * 2);
        esc.y += (lead.y - Math.sin(lead.angle) * 60 - esc.y) * Math.min(1, dt * 2);
        esc.angle = lead.angle;
      }
      const d = dist(G.player.x, G.player.y, lead.x, lead.y);
      M.stageData.followTime = d >= 80 && d <= 260 ? (M.stageData.followTime || 0) + dt : 0;
      if (d < 60) {
        M.stageData.detected = (M.stageData.detected || 0) + dt;
        if (M.stageData.detected > 3) failMission(G, 'konvoi menyadari kau membuntuti');
      } else {
        M.stageData.detected = 0;
      }
      if (dist(lead.x, lead.y, SPOTS.gudang.x, SPOTS.gudang.y) < 120) {
        M.stageData.convoyArrived = true;
      }
    },
    isDone(G) {
      const M = G.mission;
      return (M.stageData.followTime || 0) > 14 || M.stageData.convoyArrived;
    },
  },
  {
    id: 'm3-foto',
    text: 'Foto gudang tujuan konvoi (dekati Gudang 7)',
    target: SPOTS.gudang,
    onEnter(G) {
      G.addToast('Gudang 7 di depan. Dekati dan tekan E untuk memotret.');
      G.mission.stageData.photoReady = true;
    },
    onUpdate(G) {
      if (G.input.wasPressed('E') && dist(G.player.x, G.player.y, SPOTS.gudang.x, SPOTS.gudang.y) < 130) {
        G.mission.stageData.photoTaken = true;
        G.audio.sfx.pickup();
        G.addToast('Foto diambil! Gudang 7 — tempat Darma menyimpan uangnya.');
      }
    },
    isDone(G) { return G.mission.stageData.photoTaken; },
  },
];

MISSIONS[3].stages = [
  {
    id: 'm4-ke-gudang',
    text: 'Menyusup ke Gudang 7 di Dermaga Neon',
    target: SPOTS.gudang,
    onEnter(G) {
      G.addToast('Sinta mematikan alarm — kau punya waktu terbatas begitu masuk.');
    },
    isDone(G) { return markerReached(G, 100); },
  },
  {
    id: 'm4-bobol',
    text: 'Bobol brankas Darma — tahan E di dekat brankas selama 8 detik',
    target: SPOTS.gudang,
    onEnter(G) {
      G.mission.stageData.crack = 0;
      G.mission.stageData.guards = spawnGoons(G, [
        { x: 820, y: 2090 }, { x: 900, y: 2210 }, { x: 820, y: 2210 },
      ], 3, { hp: 60, damage: 6, dropsCash: 150 });
      G.addToast('Penjaga gudang menyerang! Sambil melawan, bobol brankasnya!');
    },
    onUpdate(G, dt) {
      const M = G.mission;
      const nearSafe = dist(G.player.x, G.player.y, SPOTS.gudang.x, SPOTS.gudang.y) < 90;
      if (nearSafe && G.input.down('E') && !G.player.inCar) {
        M.stageData.crack = (M.stageData.crack || 0) + dt;
        if (Math.random() < 0.4) G.addParticles(G.player.x, G.player.y - 10, 1, '#ffd24a', 80);
        if (M.stageData.crack >= 8) {
          M.stageData.cracked = true;
          G.addToast('BRANKAS TERBUKA! Ambil uangnya dan kabur!');
          raiseWanted(G, 40, 'perampokan gudang');
        }
      }
    },
    isDone(G) { return G.mission.stageData.cracked; },
  },
  {
    id: 'm4-ambil-uang',
    text: 'Ambil uang Darma dari brankas',
    target: SPOTS.gudang,
    onEnter(G) {
      G.pickups.push({ kind: 'cash', x: SPOTS.gudang.x, y: SPOTS.gudang.y, amount: 1500, label: 'Uang Darma' });
    },
    isDone(G) { return G.mission.stageData.gotMoney; },
    onEvent(G, kind) { if (kind === 'pickupCash') G.mission.stageData.gotMoney = true; },
  },
  {
    id: 'm4-kabur',
    text: 'KABUR! Capai Rumah Aman di Bukit Harapan sebelum tertangkap',
    target: SPOTS.rumah,
    onEnter(G) {
      raiseWanted(G, 30, 'kabur dari gudang');
      G.mission.stageData.escapeTimer = 150;
      G.addToast('Helikopter dan blokade mengejarmu! 150 detik menuju Rumah Aman!');
    },
    onUpdate(G, dt) {
      const M = G.mission;
      M.stageData.escapeTimer -= dt;
      if (M.stageData.escapeTimer <= 0) failMission(G, 'polisi mengepungmu sebelum sampai rumah aman');
    },
    isDone(G) { return markerReached(G, 90); },
  },
];

MISSIONS[4].stages = [
  {
    id: 'm5-konvoi',
    text: 'Hentikan konvoi Bos Darma — tabrak / tembak 3 mobil pengawal',
    target: SPOTS.dermaga,
    onEnter(G) {
      const escorts = [];
      for (let i = 0; i < 3; i++) {
        const c = makeCar(i === 0 ? 'sport' : 'sedan', 2100 + i * 90, 1750, Math.PI / 2, {
          driver: 'traffic', ai: { kind: 'convoy', cruise: 140 },
        });
        c.mission = true;
        c.hp = 120;
        c.maxHp = 120;
        escorts.push(c);
        G.cars.push(c);
      }
      G.mission.stageData.escorts = escorts;
      G.mission.stageData.killed = 0;
      G.addToast('Konvoi Darma datang dari utara! Hentikan mereka!');
      raiseWanted(G, 20, 'konvoi Darma');
    },
    onUpdate(G, dt) {
      const M = G.mission;
      const escorts = M.stageData.escorts || [];
      // Konvoi bergerak ke dermaga, lalu parkir di sana (menunggu) — bukan
      // mengorbit selamanya, supaya bisa dikejar dan dihentikan.
      for (const c of escorts) {
        if (c.crashed) continue;
        if (dist(c.x, c.y, SPOTS.dermaga.x, SPOTS.dermaga.y) < 60) continue;
        const a = angleTo(c.x, c.y, SPOTS.dermaga.x, SPOTS.dermaga.y);
        c.angle += (a - c.angle) * Math.min(1, dt * 1.2);
        c.x += Math.cos(c.angle) * 110 * dt;
        c.y += Math.sin(c.angle) * 110 * dt;
      }
      M.stageData.killed = escorts.filter((c) => c.crashed).length;
    },
    isDone(G) { return (G.mission.stageData.killed || 0) >= 3; },
  },
  {
    id: 'm5-bos',
    text: 'Hadapi Bos Darma di Dermaga Neon — kalahkan dia!',
    target: SPOTS.dermaga,
    onEnter(G) {
      const boss = makeEnemy(G, SPOTS.dermaga.x, SPOTS.dermaga.y - 60, {
        name: 'Bos Darma', hp: 320, speed: 110, damage: 12, range: 420,
        isBoss: true, dropsCash: 2000,
      });
      boss.mission = true;
      boss.state = 'shoot';
      G.enemies.push(boss);
      G.mission.boss = boss;
      G.mission.stageData.bossDown = false;
      // Dua pengawal terakhir.
      spawnGoons(G, [{ x: 2020, y: 2100 }, { x: 2180, y: 2100 }], 2, { hp: 60, damage: 6, dropsCash: 200 });
      G.addToast('BOS DARMA ada di depan Klub Lampion! Ini malam terakhir!');
      raiseWanted(G, 25, 'pertempuran final');
    },
    isDone(G) { return G.mission.stageData.bossDown; },
    onEvent(G, kind) { if (kind === 'bossDown') G.mission.stageData.bossDown = true; },
  },
  {
    id: 'm5-finale',
    text: 'Menuju Menara Suar — akhiri malam ini',
    target: { x: 180, y: 1250, label: 'Menara Suar' },
    onEnter(G) {
      G.addToast('Darma jatuh. Pergi ke Menara Suar — Sinta dan Pak Tono menunggumu.');
      G.npcs.push({
        id: 'sinta2', name: 'Sinta', x: 180, y: 1250, color: '#e8c832', role: 'Montir',
        talk(G2) {
          G2.showDialogue([{ who: 'Sinta', text: 'Kau melakukannya, Raka. Teluk Harapan bebas.' }]);
        },
      });
    },
    isDone(G) { return G.mission.stageData.metFinal; },
    onEvent(G, kind) { if (kind === 'npcTalk' && G.mission.stageData.npcId === 'sinta2') G.mission.stageData.metFinal = true; },
  },
];

// NPC talk harus memberi tahu misi siapa yang diajak bicara.
export function npcTalked(G, npc) {
  const M = G.mission;
  if (M.active && M.stage) {
    M.stageData.npcId = npc.id;
    missionEvent(G, 'npcTalk', npc);
  }
  if (npc.talk) npc.talk(G);
}
