// TELUK HARAPAN — main.js
// Orkestrator: boot, loop fixed-step, pemain (jalan kaki / mobil / perahu),
// tembak-menembak, HUD + minimap, dialog cerita, toko, simpan/muat, dan
// mode ?shot= (screenshot) serta ?selftest=1 (verifikasi otomatis).
// Ditulis fresh untuk round 4.

import { CONFIG } from './config.js';
import { SeededRandom } from './random.js';
import { Input, ACT } from './input.js';
import { AudioSys } from './audio.js';
import { Renderer } from './render.js';
import { buildCity, districtAt, isLand, resolveCircleColliders } from './world.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Economy } from './economy.js';
import { MissionRunner } from './missions.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : CONFIG.world.seed;
const selftest = params.get('selftest') === '1';

function $(id) {
  return document.getElementById(id);
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.rng = new SeededRandom(seed);
    this.city = buildCity(seed);
    this.renderer = new Renderer(canvas);
    this.renderer.buildCity(this.city);
    this.traffic = new Traffic(this.city, this.renderer, seed + 7);
    this.traffic.spawn();
    this.police = new Police(this.city, this.renderer, seed + 13);
    this.economy = new Economy();
    this.audio = new AudioSys();
    this.input = new Input(canvas);
    this.missions = new MissionRunner(this);
    this.missions.onEvent((type, data) => this.onMissionEvent(type, data));

    this.time = 0;
    this.playSeconds = 0;
    this.day = 1;
    this.phase = 'senja';
    this.state = 'title'; // title | playing | dialogue | paused | shop | busted | wasted | win | missiondone
    this.prevState = 'playing';
    this.totalEarned = 0;
    this.carsStolen = 0;
    this.cameraYaw = Math.PI / 2;
    this.cameraOrbit = null;
    this._shotProps = [];
    this.toastTimer = 0;
    this.dialogueShown = -1;
    this.dialogueChars = 0;
    this.shopOpen = null;
    this.shopSelected = 0;
    this.mapOpen = false;
    this.helpOpen = false;
    this.missionDonePending = false;
    this._lastShot = 0;
    this._damageFlash = 0;

    // --- pemain ---
    this.player = {
      x: this.city.playerSpawn.x,
      z: this.city.playerSpawn.z,
      heading: this.city.playerSpawn.heading,
      speed: 0,
      inCar: false,
      car: null,
      mesh: null,
      walkPhase: 0,
    };
    this.player.mesh = this.renderer.makePedMesh(0x2a4a8a, 0xc98a5a);
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.renderer.scene.add(this.player.mesh);

    // Mobil awal pemain (sedan bapaknya) terparkir di dekat spawn.
    this.spawnPlayerCar('sedan', -232, -64, Math.PI / 2, true);

    this.police.onBusted((reason) => this.onBusted(reason));
    this.police.onStarsChanged((stars) => this.updateStarsHud(stars));
    this.applyPhase('senja');
    this._bindHud();
    this._showTitle();
  }

  // ---------- fase & hari ----------
  applyPhase(phaseName) {
    this.phase = phaseName;
    this.renderer.applyPhase(phaseName);
  }

  setDay(day) {
    this.day = day;
    const def = CONFIG.days.find((d) => d.day === day) || CONFIG.days[0];
    this.applyPhase(def.phase);
    this.updateDayHud();
  }

  // ---------- mobil pemain ----------
  spawnPlayerCar(kind, x, z, heading, owned) {
    const mesh = this.renderer.makeCarMesh(kind);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.renderer.scene.add(mesh);
    const car = {
      kind, x, z, heading, speed: 0,
      hp: CONFIG.cars[kind].hp, armored: false, mesh,
      owned: !!owned, isBoat: kind === 'perahu',
    };
    this._playerCars = this._playerCars || [];
    this._playerCars.push(car);
    return car;
  }

  spawnPlayerBoat(x, z) {
    return this.spawnPlayerCar('perahu', x, z, Math.PI, true);
  }

  nearestDrivable(maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of this._playerCars || []) {
      if (this.player.car === car) continue;
      const d = (car.x - this.player.x) ** 2 + (car.z - this.player.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    for (const car of this.traffic.cars) {
      const d = (car.x - this.player.x) ** 2 + (car.z - this.player.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { trafficCar: car, x: car.x, z: car.z };
      }
    }
    return best;
  }

  enterNearestCar() {
    const near = this.nearestDrivable(5);
    if (!near) return false;
    if (near.trafficCar) {
      // Curi mobil lalu lintas: kriminal, wanted +1.
      const tc = near.trafficCar;
      const idx = this.traffic.cars.indexOf(tc);
      if (idx !== -1) this.traffic.cars.splice(idx, 1);
      const car = {
        kind: tc.kind, x: tc.x, z: tc.z, heading: tc.heading, speed: 0,
        hp: CONFIG.cars[tc.kind].hp, armored: false, mesh: tc.mesh,
        owned: false, isBoat: false,
      };
      this._playerCars.push(car);
      this.player.car = car;
      this.player.inCar = true;
      this.player.mesh.visible = false;
      this.carsStolen += 1;
      this.police.addStars(1, this.time);
      this.toast('Mobil dicuri! Polisi mengejar (+1 bintang).');
      this.audio.engineStart();
      return true;
    }
    this.player.car = near;
    this.player.inCar = true;
    this.player.mesh.visible = false;
    this.audio.engineStart();
    return true;
  }

  exitCar() {
    if (!this.player.car) return;
    const car = this.player.car;
    this.player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.5;
    this.player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.5;
    this.player.heading = car.heading;
    this.player.inCar = false;
    this.player.car = null;
    this.player.mesh.visible = true;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.audio.engineStop();
  }

  // ---------- cerita ----------
  startStory() {
    this.state = 'playing';
    this._hideScreens();
    $('hud').classList.add('on');
    this.audio.ensure();
    this.missions.startMission(0);
    this.toast('Misi 1 — PULANG');
  }

  startFreeRoam() {
    this.state = 'playing';
    this._hideScreens();
    $('hud').classList.add('on');
    this.audio.ensure();
  }

  continueSave() {
    const loaded = loadGame();
    if (!loaded.ok) {
      this.toast('Tidak ada save yang bisa dilanjutkan.');
      return;
    }
    const d = loaded.data;
    this.economy.restore({
      money: d.money, weapons: d.weapons, currentWeapon: d.currentWeapon,
      armor: d.armor, health: d.health,
    });
    this.day = d.day || 1;
    this.totalEarned = d.totalEarned || 0;
    this.carsStolen = d.carsStolen || 0;
    this.player.x = d.player.x;
    this.player.z = d.player.z;
    this.player.heading = d.player.heading;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    const def = CONFIG.days.find((x) => x.day === this.day) || CONFIG.days[0];
    this.applyPhase(def.phase);
    this.state = 'playing';
    this._hideScreens();
    $('hud').classList.add('on');
    this.audio.ensure();
    this.toast(`Save dimuat — Hari ${this.day}.`);
    if (d.missionIndex >= 0 && d.missionIndex < CONFIG.missions.length && !d.missionsDone) {
      this.missions.startMission(d.missionIndex);
    }
  }

  winGame() {
    this.state = 'win';
    this._showScreen('win-screen');
    $('win-stats').textContent =
      `Misi selesai 5/5 · Uang $${this.economy.money} · Mobil dicuri ${this.carsStolen} · Waktu ${Math.floor(this.playSeconds / 60)} menit`;
  }

  onBusted(reason) {
    if (this.state !== 'playing' && this.state !== 'dialogue') return;
    this.police.clearWanted();
    this.economy.money = Math.max(0, this.economy.money - CONFIG.wanted.bustedFine);
    this._respawnAtClinic();
    this.state = 'busted';
    $('busted-text').textContent = `Tertangkap polisi (${reason}). Denda $${CONFIG.wanted.bustedFine}. Misi diulang dari awal.`;
    this._showScreen('busted-screen');
    this.audio.failSting();
  }

  onWasted() {
    if (this.state !== 'playing' && this.state !== 'dialogue') return;
    this.police.clearWanted();
    this.economy.money = Math.max(0, this.economy.money - CONFIG.wanted.hospitalFee);
    this._respawnAtClinic();
    this.state = 'wasted';
    $('busted-text').textContent = `Kamu tewas. Dirawat di Klinik Harapan (-$${CONFIG.wanted.hospitalFee}). Misi diulang dari awal.`;
    this._showScreen('busted-screen');
    this.audio.failSting();
  }

  _respawnAtClinic() {
    if (this.player.inCar) this.exitCar();
    this.player.x = 48;
    this.player.z = 196;
    this.player.heading = Math.PI;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.economy.health = CONFIG.player.health;
    this.economy.armor = 0;
    if (this.missions.missionIndex >= 0) {
      const idx = this.missions.missionIndex;
      this.missions.reset();
      this.missions.startMission(idx);
    }
  }

  damagePlayer(amount, source) {
    if (this.state !== 'playing') return;
    const hp = this.economy.damage(amount);
    this._damageFlash = 0.35;
    this.toast(`${source} menyerang! -${amount} darah.`);
    if (hp <= 0) this.onWasted();
  }

  // ---------- event misi ----------
  onMissionEvent(type, data) {
    if (type === 'mission-start') {
      this.state = 'dialogue';
      this.dialogueShown = -1;
      this.dialogueChars = 0;
      this._showDialogue();
    } else if (type === 'dialogue-done') {
      this.state = 'playing';
      this._hideDialogue();
      this.toast(`Objektif: ${this.missions.currentObjective ? this.missions.currentObjective.text : ''}`);
    } else if (type === 'objective-done') {
      const next = this.missions.currentObjective;
      this.toast(next ? `Objektif baru: ${next.text}` : 'Objektif selesai.');
    } else if (type === 'mission-done') {
      this.totalEarned += data.reward;
      this.missionDonePending = true;
      this.state = 'missiondone';
      $('missiondone-title').textContent = `${data.mission.title} SELESAI`;
      $('missiondone-text').textContent = `Hadiah $${data.reward}. Total yang kamu hasilkan: $${this.totalEarned}.`;
      this._showScreen('missiondone-screen');
    } else if (type === 'mission-failed') {
      this.toast(`Misi gagal: ${data.reason}`);
    } else if (type === 'boss') {
      this.toast('BOS ANGGARA muncul! Kalahkan dia!');
    } else if (type === 'boss-phase') {
      this.toast('Anggara memanggil anak buah!');
    }
  }

  // ---------- satu langkah simulasi ----------
  step(dt, input) {
    this.time += dt;
    if (this.state === 'playing' || this.state === 'dialogue') this.playSeconds += dt;
    const actions = input.actions || [];

    // Dialog: hanya maju dialog, dunia diam.
    if (this.state === 'dialogue') {
      this.missions.update(dt);
      this._updateDialogue(dt);
      if (input.actions && input.actions.includes(ACT.CONFIRM)) this.missions.advanceDialogue();
      this.renderer.update(dt, this.time);
      return;
    }
    if (this.state !== 'playing') {
      this.renderer.update(dt, this.time);
      return;
    }

    // --- aksi sekali tekan ---
    if (actions.includes(ACT.PAUSE)) {
      this.state = 'paused';
      this._showScreen('pause-screen');
      return;
    }
    if (actions.includes(ACT.HELP)) {
      this.helpOpen = !this.helpOpen;
      $('help-panel').style.display = this.helpOpen ? 'block' : 'none';
    }
    if (actions.includes(ACT.MAP)) {
      this.mapOpen = !this.mapOpen;
      $('bigmap').style.display = this.mapOpen ? 'block' : 'none';
    }
    if (actions.includes(ACT.QUICKSAVE)) {
      const r = saveGame(this._saveState());
      this.toast(r.ok ? 'Game disimpan.' : 'Gagal menyimpan.');
    }
    if (actions.includes(ACT.CAMERA)) {
      this.renderer.cameraMode = (this.renderer.cameraMode + 1) % 3;
    }
    if (actions.includes(ACT.SWITCH_WEAPON)) {
      this.economy.switchWeapon();
    }
    if (actions.includes(ACT.RELOAD)) {
      const r = this.economy.buyAmmo();
      this.toast(r.msg);
    }
    if (actions.includes(ACT.ENTER_CAR)) {
      if (this.player.inCar) this.exitCar();
      else this.enterNearestCar();
    }
    if (actions.includes(ACT.INTERACT)) {
      this._tryInteract();
    }

    // --- gerak pemain ---
    const throttle = input.throttle || 0;
    const steer = input.steer || 0;
    if (this.player.inCar && this.player.car) {
      this._driveCar(dt, this.player.car, throttle, steer, input.handbrake);
    } else {
      this._walkPlayer(dt, input);
    }

    // --- tembak ---
    const firing = input.firing || actions.includes(ACT.SHOOT);
    if (firing) this._tryShoot();

    // --- dunia ---
    this.traffic.update(dt, { x: this.player.x, z: this.player.z }, this.time);
    this.police.update(dt, {
      x: this.player.x, z: this.player.z,
      inCar: this.player.inCar,
      onRam: (car) => this._onPoliceRam(car),
    }, this.time);
    this.missions.update(dt);

    // Sirene bila ada polisi aktif.
    if (this.police.stars > 0) this.audio.sirenStart();
    else this.audio.sirenStop();

    // Toko terdekat (prompt).
    this._updateShopPrompt();

    // Kamera + render state.
    this._updateCamera(dt);
    this.renderer.update(dt, this.time);
    this._updateHud(dt);
    this._drawMinimap();
    if (this.mapOpen) this._drawBigMap();
    if (this.toastTimer > 0) this.toastTimer -= dt;
    if (this._damageFlash > 0) {
      this._damageFlash -= dt;
      $('damage-flash').style.opacity = String(Math.max(0, this._damageFlash * 2));
    }
  }

  _walkPlayer(dt, input) {
    const mv = {
      x: input.steer || 0,
      z: -(input.throttle || 0),
      run: input.run || false,
    };
    const speed = mv.run ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
    // Gerak relatif arah kamera.
    const cy = this.cameraYaw;
    const fx = Math.sin(cy);
    const fz = Math.cos(cy);
    const rx = Math.cos(cy);
    const rz = -Math.sin(cy);
    let mx = fx * -mv.z + rx * mv.x;
    let mz = fz * -mv.z + rz * mv.x;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      this.player.heading = Math.atan2(mx, mz);
      this.player.x += mx * speed * dt;
      this.player.z += mz * speed * dt;
      this.player.walkPhase += dt * speed * 1.6;
    }
    // Jaga tetap di darat.
    if (!isLand(this.player.x, this.player.z)) {
      const fixed = resolveCircleColliders(this.city, this.player.x, this.player.z, 0.9);
      this.player.x = fixed.x;
      this.player.z = fixed.z;
      if (this.player.x < -268) this.player.x = -268;
      if (this.player.x > 316) this.player.x = 316;
      if (this.player.z > 284) this.player.z = 284;
      if (this.player.z < -316) this.player.z = -316;
    }
    const fixed = resolveCircleColliders(this.city, this.player.x, this.player.z, CONFIG.player.radius);
    this.player.x = fixed.x;
    this.player.z = fixed.z;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.player.mesh.rotation.y = this.player.heading;
    const swing = Math.sin(this.player.walkPhase) * 0.45;
    this.player.mesh.userData.legs[0].rotation.x = len > 0.01 ? swing : 0;
    this.player.mesh.userData.legs[1].rotation.x = len > 0.01 ? -swing : 0;
    // Kamera mengikuti arah hadap pemain.
    let dh = this.player.heading - this.cameraYaw;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.cameraYaw += dh * Math.min(1, dt * 4);
  }

  _driveCar(dt, car, throttle, steer, handbrake) {
    const spec = CONFIG.cars[car.kind];
    const grip = handbrake ? 0.82 : spec.grip;
    car.hitCooldown = Math.max(0, (car.hitCooldown || 0) - dt);
    if (throttle > 0) car.speed += spec.accel * throttle * dt;
    else if (throttle < 0) {
      if (car.speed > 0.5) car.speed -= spec.brake * dt;
      else car.speed -= spec.accel * 0.55 * dt; // mundur
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    }
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
    car.speed = Math.max(-spec.topSpeed * 0.45, Math.min(spec.topSpeed, car.speed));
    const steerAmount = steer * spec.steer * Math.min(1, Math.abs(car.speed) / 8) * (car.speed >= 0 ? 1 : -1);
    car.heading += steerAmount * dt * (handbrake ? 1.7 : 1) * (1 - (1 - grip) * 0.4);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    // Perahu: hanya di air.
    if (car.isBoat) {
      car.x = Math.max(-316, Math.min(-266, nx));
      car.z = Math.max(-300, Math.min(300, nz));
    } else {
      const before = { x: car.x, z: car.z };
      const fixed = resolveCircleColliders(this.city, nx, nz, 1.7);
      car.x = fixed.x;
      car.z = fixed.z;
      if (fixed.hit && Math.abs(car.speed) > 12 && car.hitCooldown <= 0) {
        const dmg = (Math.abs(car.speed) - 12) * (car.armored ? 0.7 : 1.5);
        car.hp -= dmg;
        car.hitCooldown = 0.6;
        this.renderer.spawnParticles({ x: car.x, y: 1, z: car.z }, 0x888888, 10, 5, 0.7, 0.8, 2);
        this.audio.blip(70, 0.15, 'square', 0.25);
        car.speed *= 0.4;
      }
      // Tabrak mobil lalu lintas: dorong + rusak (sekali per 0,5 dtk, bukan per frame).
      for (const tc of this.traffic.cars) {
        const dx = tc.x - car.x;
        const dz = tc.z - car.z;
        const d = Math.hypot(dx, dz);
        if (d < 3.4 && d > 0.01) {
          const push = (3.4 - d) / 2;
          tc.x += (dx / d) * push;
          tc.z += (dz / d) * push;
          if (car.hitCooldown <= 0) {
            car.hp -= 6;
            car.hitCooldown = 0.5;
            car.speed *= 0.85;
          }
        }
      }
      // Masuk sungai/laut dengan mobil darat: dorong kembali.
      if (!isLand(car.x, car.z)) {
        car.x = before.x;
        car.z = before.z;
        car.speed *= 0.3;
      }
    }
    car.mesh.position.set(car.x, car.isBoat ? -0.2 : 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Pemain ikut mobil: posisi pemain = posisi mobil (penting untuk
    // objektif misi, minimap, dan kejaran polisi saat mengemudi).
    this.player.x = car.x;
    this.player.z = car.z;
    this.player.heading = car.heading;
    const spin = car.speed * dt * 2.4;
    for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += spin;
    // Asap bila rusak parah.
    if (car.hp < 40 && Math.random() < dt * 8) {
      this.renderer.spawnParticles({ x: car.x, y: 1.5, z: car.z }, 0x555555, 3, 2, 1.2, 1.2, 1.5);
    }
    if (car.hp <= 0) {
      this._explodeCar(car);
    }
    this.audio.engineUpdate(Math.abs(car.speed) / spec.topSpeed, true);
    this.cameraYaw = car.heading;
  }

  _explodeCar(car) {
    this.renderer.spawnParticles({ x: car.x, y: 1.5, z: car.z }, 0xff7722, 40, 12, 1.2, 1.4, -4);
    this.renderer.spawnParticles({ x: car.x, y: 2, z: car.z }, 0x333333, 25, 6, 2, 1.8, 1);
    this.audio.explosion();
    this.traffic.scare(car.x, car.z, 30);
    const wasPlayer = this.player.car === car;
    this.renderer.scene.remove(car.mesh);
    const idx = (this._playerCars || []).indexOf(car);
    if (idx !== -1) this._playerCars.splice(idx, 1);
    if (wasPlayer) {
      this.player.inCar = false;
      this.player.car = null;
      this.player.x = car.x + 3;
      this.player.z = car.z + 3;
      this.player.mesh.visible = true;
      this.player.mesh.position.set(this.player.x, 0, this.player.z);
      this.audio.engineStop();
      this.damagePlayer(25, 'Ledakan mobil');
    }
  }

  _onPoliceRam(car) {
    if (!this.player.car) return;
    this.player.car.hp -= 6;
    this.player.car.speed *= 0.7;
    this.audio.blip(90, 0.12, 'square', 0.2);
    this.renderer.spawnParticles({ x: this.player.x, y: 1, z: this.player.z }, 0x888888, 8, 4, 0.5, 0.7, 2);
  }

  _tryShoot() {
    const now = this.time;
    if (now - this._lastShot < 1 / Math.max(1, this.economy.currentSpec().rate)) return;
    const spec = this.economy.currentSpec();
    if (!this.economy.useAmmo()) {
      this.toast('Amunisi habis! Beli di Toko Senjata Jaya (atau tekan Q).');
      this._lastShot = now;
      return;
    }
    this._lastShot = now;
    this.audio.gunshot();
    // Arah bidik = arah kamera (tengah layar) diproyeksikan ke tanah.
    const dirX = Math.sin(this.cameraYaw);
    const dirZ = Math.cos(this.cameraYaw);
    const origin = { x: this.player.x, z: this.player.z };
    const target = this.missions.aimTarget(origin, dirX, dirZ, spec.range);
    // Kilat moncong.
    this.renderer.spawnParticles(
      { x: origin.x + dirX * 1.2, y: 1.4, z: origin.z + dirZ * 1.2 },
      0xffcc66, 4, 8, 0.15, 0.5, 0,
    );
    if (target) {
      const killed = this.missions.damageEnemy(target, spec.damage);
      this.audio.hit();
      if (!killed) this.toast(`Kena ${target.name}! (${Math.max(0, Math.round(target.hp))} HP)`);
      else this.toast(`${target.name} tumbang!`);
      // Tembakan menarik perhatian: pejalan kaki lari.
      this.traffic.scare(target.x, target.z, 20);
    } else {
      // Tembakan ke udara tetap menakuti pejalan kaki di dekat arah bidik.
      this.traffic.scare(origin.x + dirX * 10, origin.z + dirZ * 10, 14);
    }
    // Tembakan saat wanted 0 di dekat polisi = +1 bintang (polisi mendengar).
    if (this.police.stars === 0) {
      for (const c of this.police.cars) {
        if (Math.hypot(c.x - origin.x, c.z - origin.z) < 40) {
          this.police.addStars(1, this.time);
          this.toast('Polisi mendengar tembakan! (+1 bintang)');
          break;
        }
      }
    }
  }

  // ---------- toko ----------
  _nearestShop(maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const shop of CONFIG.shops) {
      const d = (shop.x - this.player.x) ** 2 + (shop.z - this.player.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = shop;
      }
    }
    return best;
  }

  _updateShopPrompt() {
    const shop = this._nearestShop(9);
    const prompt = $('shop-prompt');
    if (shop && !this.player.inCar && this.state === 'playing') {
      prompt.style.display = 'block';
      prompt.textContent = `F — ${shop.name} · ${shop.blurb}`;
      this._nearShop = shop;
    } else {
      prompt.style.display = 'none';
      this._nearShop = null;
    }
  }

  _tryInteract() {
    if (this._nearShop) {
      this.shopOpen = this._nearShop;
      this.shopSelected = 0;
      this.prevState = this.state;
      this.state = 'shop';
      this._renderShop();
      $('shop-panel').style.display = 'block';
    }
  }

  _renderShop() {
    const shop = this.shopOpen;
    if (!shop) return;
    $('shop-title').textContent = shop.name;
    const items = this.economy.shopItems(shop.kind);
    const list = $('shop-items');
    list.innerHTML = '';
    items.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'shop-item' + (i === this.shopSelected ? ' selected' : '');
      div.textContent = `${i + 1}. ${item.name} — $${item.price} · ${item.desc}`;
      list.appendChild(div);
    });
    $('shop-money').textContent = `Uang: $${this.economy.money}`;
  }

  _shopKey(code) {
    if (!this.shopOpen) return false;
    if (code === 'Escape' || code === 'KeyF') {
      $('shop-panel').style.display = 'none';
      this.shopOpen = null;
      this.state = 'playing';
      return true;
    }
    const items = this.economy.shopItems(this.shopOpen.kind);
    if (code === 'ArrowDown' || code === 'KeyS') {
      this.shopSelected = (this.shopSelected + 1) % items.length;
      this._renderShop();
      return true;
    }
    if (code === 'ArrowUp' || code === 'KeyW') {
      this.shopSelected = (this.shopSelected - 1 + items.length) % items.length;
      this._renderShop();
      return true;
    }
    const num = Number.parseInt(code.replace('Digit', ''), 10);
    if (num >= 1 && num <= items.length) {
      this._buyShopItem(items[num - 1]);
      return true;
    }
    if (code === 'Enter' || code === 'Space') {
      this._buyShopItem(items[this.shopSelected]);
      return true;
    }
    return false;
  }

  _buyShopItem(item) {
    const hooks = {
      repairCar: () => { if (this.player.car) this.player.car.hp = CONFIG.cars[this.player.car.kind].hp; },
      armorCar: () => { if (this.player.car) this.player.car.armored = true; },
      saveGame: () => saveGame(this._saveState()),
      sleep: () => {
        const nextDay = Math.min(3, this.day + 1);
        this.setDay(nextDay);
        this.police.clearWanted();
      },
    };
    const r = this.economy.buy(item.id, hooks);
    this.toast(r.msg);
    this.audio.blip(r.ok ? 880 : 220, 0.12, 'sine', 0.15);
    this._renderShop();
  }

  // ---------- kamera ----------
  _updateCamera(dt) {
    if (this.cameraOrbit) {
      this.cameraOrbit.angle += dt * 0.05;
      const c = this.cameraOrbit.center;
      const a = this.cameraOrbit.angle;
      this.renderer.camera.position.set(
        c.x + Math.cos(a) * this.cameraOrbit.radius,
        this.cameraOrbit.height,
        c.z + Math.sin(a) * this.cameraOrbit.radius,
      );
      this.renderer.camera.lookAt(c.x, 0, c.z);
      return;
    }
    const target = this.player.inCar && this.player.car
      ? { x: this.player.car.x, z: this.player.car.z, y: 1 }
      : { x: this.player.x, z: this.player.z, y: 1 };
    const heading = this.player.inCar && this.player.car ? this.player.car.heading : this.cameraYaw;
    this.renderer.followCamera(target, heading, this.player.car ? Math.abs(this.player.car.speed) : 0, dt);
  }

  // ---------- HUD ----------
  _bindHud() {
    $('btn-start').addEventListener('click', () => this.startStory());
    $('btn-continue').addEventListener('click', () => this.continueSave());
    $('btn-free').addEventListener('click', () => this.startFreeRoam());
    $('btn-resume').addEventListener('click', () => {
      this.state = 'playing';
      this._hideScreens();
    });
    $('btn-restart-mission').addEventListener('click', () => {
      this._hideScreens();
      this.state = 'playing';
      if (this.missions.missionIndex >= 0) this.missions.startMission(this.missions.missionIndex);
    });
    $('btn-next-mission').addEventListener('click', () => {
      this._hideScreens();
      this.state = 'playing';
      const next = this.missions.missionIndex + 1;
      if (next < CONFIG.missions.length) this.missions.startMission(next);
      else this.toast('Semua misi selesai — jelajah bebas!');
    });
    $('btn-busted-ok').addEventListener('click', () => {
      this._hideScreens();
      this.state = 'playing';
    });
    $('btn-win-again').addEventListener('click', () => {
      this._hideScreens();
      this.state = 'playing';
      this.missions.reset();
      this.missions.startMission(0);
    });
    $('btn-win-free').addEventListener('click', () => {
      this._hideScreens();
      this.state = 'playing';
    });
    if (!hasSave()) $('btn-continue').style.display = 'none';
    window.addEventListener('keydown', (event) => {
      if (this.state === 'shop') {
        if (this._shopKey(event.code)) event.preventDefault();
      }
    });
    this.canvas.addEventListener('pointerdown', () => this.audio.ensure());
  }

  _showScreen(id) {
    for (const el of document.querySelectorAll('.screen')) el.style.display = 'none';
    $(id).style.display = 'flex';
  }

  _hideScreens() {
    for (const el of document.querySelectorAll('.screen')) el.style.display = 'none';
  }

  _showTitle() {
    this._showScreen('title-screen');
    $('title-version').textContent = `v${CONFIG.version} · 5 misi cerita · 5 distrik`;
  }

  toast(message) {
    $('toast').textContent = message;
    $('toast').style.opacity = '1';
    this.toastTimer = 3;
    window.setTimeout(() => { $('toast').style.opacity = '0'; }, 3000);
  }

  updateStarsHud(stars) {
    const el = $('hud-stars');
    el.textContent = '★'.repeat(stars) + '☆'.repeat(CONFIG.wanted.maxStars - stars);
    el.style.color = stars >= 3 ? '#ff5533' : '#ffd94a';
  }

  updateDayHud() {
    const def = CONFIG.days.find((d) => d.day === this.day) || CONFIG.days[0];
    $('hud-day').textContent = `${def.label} · ${CONFIG.phases[def.phase].label}`;
  }

  _updateHud(dt) {
    $('hud-health').style.width = `${Math.max(0, this.economy.health)}%`;
    $('hud-armor').style.width = `${Math.max(0, this.economy.armor)}%`;
    $('hud-money').textContent = `$${this.economy.money}`;
    const spec = this.economy.currentSpec();
    $('hud-weapon').textContent = spec.name;
    const ammo = this.economy.ammoFor(this.economy.currentWeapon);
    $('hud-ammo').textContent = ammo === Infinity ? '∞' : `${ammo}`;
    const speed = this.player.car ? Math.abs(this.player.car.speed) * 3.6 : 0;
    $('hud-speed').textContent = this.player.inCar ? `${Math.round(speed)} km/j` : '';
    const obj = this.missions.currentObjective;
    if (this.missions.state === 'playing' && obj) {
      $('hud-objective-text').textContent = `${this.missions.mission.title} · ${obj.text} (${this.missions.progressText})`;
      // Jarak ke target.
      if (obj.x !== undefined) {
        const d = Math.hypot(this.player.x - obj.x, this.player.z - obj.z);
        $('hud-dist').textContent = `${Math.round(d)} m`;
      } else {
        $('hud-dist').textContent = '';
      }
    } else if (this.missions.state === 'done' || this.missions.missionIndex === -1) {
      $('hud-objective-text').textContent = 'Jelajah bebas — tekan H untuk bantuan';
      $('hud-dist').textContent = '';
    }
    const district = districtAt(this.player.x, this.player.z);
    $('hud-district').textContent = district ? district.name : 'Laut';
    $('hud-hint').textContent = this.player.inCar ? CONFIG.controls.driving : CONFIG.controls.onFoot;
  }

  // ---------- dialog ----------
  _showDialogue() {
    $('dialogue').style.display = 'block';
    this._renderDialogueLine();
  }

  _hideDialogue() {
    $('dialogue').style.display = 'none';
  }

  _renderDialogueLine() {
    const line = this.missions.dialogue[this.missions.dialogueIndex];
    if (!line) return;
    $('dialogue-who').textContent = line.who;
    $('dialogue-text').textContent = '';
    this.dialogueChars = 0;
    this._dialogueLine = line.text;
  }

  _updateDialogue(dt) {
    if (!this._dialogueLine) return;
    this.dialogueChars += dt * 45;
    const shown = this._dialogueLine.slice(0, Math.floor(this.dialogueChars));
    if ($('dialogue-text').textContent !== shown) {
      $('dialogue-text').textContent = shown;
    }
  }

  // ---------- minimap & peta besar ----------
  _drawMinimap() {
    const canvas = $('minimap');
    const ctx = canvas.getContext('2d');
    const S = 200;
    const scale = S / 660;
    const toX = (x) => (x + 330) * scale;
    const toZ = (z) => (z + 330) * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, S, S);
    // Distrik.
    for (const d of CONFIG.districts) {
      ctx.fillStyle = d.ground;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(toX(d.x0), toZ(d.z0), (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
    }
    ctx.globalAlpha = 1;
    // Air.
    ctx.fillStyle = '#1a5a7a';
    ctx.fillRect(toX(-320), toZ(-320), 48 * scale, 640 * scale);
    ctx.fillRect(toX(-320), toZ(288), 640 * scale, 32 * scale);
    ctx.fillRect(toX(48), toZ(-320), 32 * scale, 640 * scale);
    // Jalan.
    ctx.strokeStyle = '#3a3a40';
    ctx.lineWidth = 2;
    for (const ax of this.city.avenuesX) {
      ctx.beginPath();
      ctx.moveTo(toX(ax), toZ(-320));
      ctx.lineTo(toX(ax), toZ(320));
      ctx.stroke();
    }
    for (const az of this.city.avenuesZ) {
      ctx.beginPath();
      ctx.moveTo(toX(-320), toZ(az));
      ctx.lineTo(toX(320), toZ(az));
      ctx.stroke();
    }
    // Toko.
    for (const shop of CONFIG.shops) {
      ctx.fillStyle = '#3aa84a';
      ctx.fillRect(toX(shop.x) - 3, toZ(shop.z) - 3, 6, 6);
    }
    // Target misi.
    const obj = this.missions.currentObjective;
    if (obj && obj.x !== undefined && this.missions.state === 'playing') {
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(toX(obj.x), toZ(obj.z), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(toX(obj.x), toZ(obj.z), 8 + Math.sin(this.time * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Polisi.
    ctx.fillStyle = '#4a7aff';
    for (const c of this.police.cars) {
      ctx.beginPath();
      ctx.arc(toX(c.x), toZ(c.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Musuh.
    ctx.fillStyle = '#ff3333';
    for (const e of this.missions.enemies) {
      if (e.kind === 'tail' || e.kind === 'boat') continue;
      ctx.beginPath();
      ctx.arc(toX(e.x), toZ(e.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pemain (panah).
    ctx.save();
    ctx.translate(toX(this.player.x), toZ(this.player.z));
    ctx.rotate(Math.atan2(Math.sin(this.player.heading), Math.cos(this.player.heading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawBigMap() {
    const canvas = $('bigmap-canvas');
    const ctx = canvas.getContext('2d');
    const S = 560;
    const scale = S / 660;
    const toX = (x) => (x + 330) * scale;
    const toZ = (z) => (z + 330) * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#101825';
    ctx.fillRect(0, 0, S, S);
    for (const d of CONFIG.districts) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(toX(d.x0), toZ(d.z0), (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(d.name, toX((d.x0 + d.x1) / 2), toZ((d.z0 + d.z1) / 2));
      ctx.font = '12px system-ui';
      ctx.fillText(d.landmark, toX((d.x0 + d.x1) / 2), toZ((d.z0 + d.z1) / 2) + 18);
    }
    ctx.fillStyle = '#1a5a7a';
    ctx.fillRect(toX(-320), toZ(-320), 48 * scale, 640 * scale);
    ctx.fillRect(toX(-320), toZ(288), 640 * scale, 32 * scale);
    ctx.fillRect(toX(48), toZ(-320), 32 * scale, 640 * scale);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    for (const ax of this.city.avenuesX) {
      ctx.beginPath(); ctx.moveTo(toX(ax), toZ(-320)); ctx.lineTo(toX(ax), toZ(320)); ctx.stroke();
    }
    for (const az of this.city.avenuesZ) {
      ctx.beginPath(); ctx.moveTo(toX(-320), toZ(az)); ctx.lineTo(toX(320), toZ(az)); ctx.stroke();
    }
    for (const shop of CONFIG.shops) {
      ctx.fillStyle = '#3aa84a';
      ctx.beginPath();
      ctx.arc(toX(shop.x), toZ(shop.z), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '11px system-ui';
      ctx.fillText(shop.name, toX(shop.x), toZ(shop.z) - 10);
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(toX(this.player.x), toZ(this.player.z), 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- simpan ----------
  _saveState() {
    return {
      day: this.day,
      missionIndex: this.missions.missionIndex,
      missionsDone: this.missions.missionIndex >= CONFIG.missions.length,
      economy: this.economy,
      player: this.player,
      totalEarned: this.totalEarned,
      carsStolen: this.carsStolen,
      playSeconds: this.playSeconds,
    };
  }

  // ---------- loop ----------
  run() {
    let last = performance.now();
    let accumulator = 0;
    const frame = (now) => {
      requestAnimationFrame(frame);
      accumulator += Math.min((now - last) / 1000, MAX_FRAME);
      last = now;
      // Input keyboard -> objek input langkah.
      const input = {
        throttle: this.input.throttle(),
        steer: this.input.steer(),
        handbrake: this.input.handbrake,
        firing: this.input.firing,
        run: this.input.moveVector().run,
        actions: this.input.drainActions(),
      };
      if (this.state === 'shop') {
        // Di toko: dunia diam, tapi tetap render.
        this.renderer.render();
        return;
      }
      while (accumulator >= STEP) {
        this.step(STEP, input);
        accumulator -= STEP;
        // Setelah langkah pertama, aksi sekali tekan habis.
        input.actions = [];
      }
      this.renderer.render();
    };
    requestAnimationFrame(frame);
  }
}

// ---------- boot ----------
const canvas = $('game');
const game = new Game(canvas);

// API debug untuk verifikasi otomatis (playwright / selftest).
window.__TH = game;

if (selftest) {
  runSelfTest(game);
} else if (shotName) {
  const scene = stageShot(shotName, game);
  game.state = scene.screen === 'title' ? 'title' : 'playing';
  game._updateCamera(0.016);
  game.renderer.render();
  requestAnimationFrame(() => {
    game.renderer.render();
    requestAnimationFrame(() => {
      game.renderer.render();
      window.__shotReady = true;
    });
  });
} else {
  game.run();
}

// ---------- self-test ----------
function runSelfTest(g) {
  const steps = [];
  const errors = [];
  function check(name, cond, extra) {
    steps.push({ name, pass: !!cond, extra: extra || '' });
    if (!cond) errors.push(name);
    console.log(`SELFTEST ${cond ? 'PASS' : 'FAIL'}: ${name}${extra ? ' — ' + extra : ''}`);
  }
  try {
    check('boot: kota dibangun', g.city.buildings.length > 50, `${g.city.buildings.length} gedung`);
    check('boot: graf jalan', g.city.roadNodes.length > 40, `${g.city.roadNodes.length} simpul`);
    check('boot: lalu lintas', g.traffic.cars.length === CONFIG.traffic.cars, `${g.traffic.cars.length} mobil`);
    check('boot: pejalan kaki', g.traffic.peds.length === CONFIG.traffic.peds, `${g.traffic.peds.length} pejalan`);
    check('boot: toko', CONFIG.shops.length === 4, '4 toko');

    // M1: dialog -> objektif 1 -> objektif 2 -> lepas kejaran -> selesai.
    g.startStory();
    check('m1: state dialogue', g.missions.state === 'dialogue');
    for (let i = 0; i < 5; i += 1) g.missions.advanceDialogue();
    check('m1: state playing', g.missions.state === 'playing');
    g.player.x = -272; g.player.z = -64;
    g.step(STEP, { throttle: 0, steer: 0, actions: [] });
    check('m1: objektif 1 selesai', g.missions.objectiveIndex === 1, `obj=${g.missions.objectiveIndex}`);
    g.player.x = -40; g.player.z = -96;
    g.step(STEP, { throttle: 0, steer: 0, actions: [] });
    check('m1: objektif 2 selesai', g.missions.objectiveIndex === 2, `obj=${g.missions.objectiveIndex}`);
    // Jauh dari penagih 12 detik (teleport ke sudut Bukit, jauh dari kejaran).
    g.player.x = 280; g.player.z = 280;
    for (let i = 0; i < 13 * 60; i += 1) g.step(STEP, { throttle: 0, steer: 0, actions: [] });
    check('m1: misi selesai', g.missions.state === 'done', `state=${g.missions.state}`);
    check('m1: hadiah masuk', g.economy.money >= CONFIG.player.startMoney + 150, `$${g.economy.money}`);

    // M2: ambil paket, kalahkan 3, antar.
    g.state = 'playing';
    g.missions.startMission(1);
    for (let i = 0; i < 5; i += 1) g.missions.advanceDialogue();
    g.player.x = -64; g.player.z = -224;
    g.step(STEP, { throttle: 0, steer: 0, actions: [] });
    check('m2: paket diambil', g.missions.objectiveIndex === 1, `obj=${g.missions.objectiveIndex}`);
    const ambush = g.missions.enemies.slice();
    check('m2: 3 penyergap muncul', ambush.length === 3, `${ambush.length} musuh`);
    for (const e of ambush) g.missions.damageEnemy(e, 999);
    check('m2: penyergapan selesai', g.missions.objectiveIndex === 2, `obj=${g.missions.objectiveIndex}`);
    g.player.x = 208; g.player.z = -78;
    g.step(STEP, { throttle: 0, steer: 0, actions: [] });
    check('m2: misi selesai + pistol', g.missions.state === 'done' && g.economy.hasWeapon('pistol'));

    // Polisi: wanted 3 -> heli ada; clear -> 0.
    g.police.setStars(3, g.time);
    check('polisi: 3 bintang + heli', g.police.stars === 3 && g.police.heli !== null);
    g.police.clearWanted();
    check('polisi: wanted bersih', g.police.stars === 0 && g.police.heli === null);

    // Mobil: naik & jalan.
    g.state = 'playing';
    const car = g.spawnPlayerCar('sedan', -240, -64, Math.PI / 2, true);
    g.player.x = -240; g.player.z = -64;
    g.enterNearestCar();
    check('mobil: naik', g.player.inCar === true);
    const x0 = g.player.car.x;
    for (let i = 0; i < 120; i += 1) g.step(STEP, { throttle: 1, steer: 0, actions: [] });
    check('mobil: bergerak maju', Math.abs(g.player.car.x - x0) + Math.abs(g.player.car.z - (-64)) > 20, `dx=${(g.player.car.x - x0).toFixed(1)}`);
    g.exitCar();
    check('mobil: turun', g.player.inCar === false);

    // Toko: beli amunisi pistol.
    g.economy.money = 500;
    g.economy.currentWeapon = 'pistol';
    const before = g.economy.ammoFor('pistol');
    const bought = g.economy.buyAmmo();
    check('toko: beli amunisi', bought.ok && g.economy.ammoFor('pistol') > before, `ammo ${before} -> ${g.economy.ammoFor('pistol')}`);

    // Save/load.
    const saved = saveGame(g._saveState());
    const loaded = loadGame();
    check('save/load', saved.ok && loaded.ok && loaded.data.money === g.economy.money);

    // M5 singkat: naik perahu & capai titik kejar.
    g.missions.startMission(4);
    for (let i = 0; i < 6; i += 1) g.missions.advanceDialogue();
    g.spawnPlayerBoat(-288, 60);
    g.player.x = -288; g.player.z = 58;
    g.enterNearestCar();
    check('m5: naik perahu', g.player.inCar === true);
    for (let i = 0; i < 180; i += 1) g.step(STEP, { throttle: 1, steer: 0, actions: [] });
    check('m5: objektif perahu', g.missions.objectiveIndex === 1, `obj=${g.missions.objectiveIndex}`);
  } catch (err) {
    errors.push(`exception: ${err.message}`);
    console.log(`SELFTEST EXCEPTION: ${err.stack}`);
  }
  const pass = errors.length === 0;
  window.__selftest = { pass, steps, errors };
  console.log(`SELFTEST ${pass ? 'ALL PASS' : 'FAILED'}: ${steps.filter((s) => s.pass).length}/${steps.length} lolos`);
}
