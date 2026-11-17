// TELUK HARAPAN — missions.js
// 5 story mission: tiap misi punya dialog pembuka, daftar objektif berurutan,
// NPC musuh & sekutu, dan kondisi menang/kalah. State machine kecil per misi:
// dialogue -> objectives -> done/failed. Ditulis fresh untuk round 4 —
// revisi ini sengaja hanya 5 misi, masing-masing dengan arc lengkap.

import { CONFIG } from './config.js';

const ENEMY_SHOOT_RANGE = 42;
const ENEMY_DAMAGE = 7;

export class MissionRunner {
  constructor(game) {
    this.game = game; // akses: player, renderer, traffic, police, economy, audio, city
    this.missionIndex = -1;
    this.mission = null;
    this.objectiveIndex = 0;
    this.dialogue = [];
    this.dialogueIndex = 0;
    this.dialogueTimer = 0;
    this.enemies = [];
    this.allies = [];
    this.escapeTimer = 0;
    this.escapeNeed = 0;
    this.chaseTarget = null;
    this.defeatNeeded = 0;
    this.defeatDone = 0;
    this.bossSpawned = false;
    this.bossMinionsSpawned = false;
    this.state = 'idle'; // idle | dialogue | playing | done | failed
    this.failReason = '';
    this._onEvent = null;
  }

  onEvent(cb) { this._onEvent = cb; }
  _emit(type, data) { if (this._onEvent) this._onEvent(type, data); }

  get currentObjective() {
    if (!this.mission) return null;
    return this.mission.objectives[this.objectiveIndex] || null;
  }

  get progressText() {
    if (!this.mission) return '';
    const done = this.mission.objectives.slice(0, this.objectiveIndex).length;
    return `${done}/${this.mission.objectives.length}`;
  }

  startMission(index) {
    const def = CONFIG.missions[index];
    if (!def) return false;
    this._clearField();
    this.missionIndex = index;
    this.mission = def;
    this.objectiveIndex = 0;
    this.dialogue = def.dialogue.slice();
    this.dialogueIndex = 0;
    this.dialogueTimer = 0;
    this.escapeTimer = 0;
    this.defeatDone = 0;
    this.bossSpawned = false;
    this.bossMinionsSpawned = false;
    this.state = 'dialogue';
    this.game.applyPhase(def.phase);
    this.game.setDay(def.day);
    if (def.startWanted) this.game.police.setStars(def.startWanted, this.game.time);
    this._emit('mission-start', { mission: def });
    return true;
  }

  advanceDialogue() {
    if (this.state !== 'dialogue') return;
    this.dialogueIndex += 1;
    this.dialogueTimer = 0;
    if (this.dialogueIndex >= this.dialogue.length) {
      this.state = 'playing';
      this._spawnForObjective();
      this._emit('dialogue-done', {});
    }
  }

  _clearField() {
    for (const e of this.enemies) this.game.renderer.scene.remove(e.mesh);
    for (const a of this.allies) this.game.renderer.scene.remove(a.mesh);
    this.enemies = [];
    this.allies = [];
    this.chaseTarget = null;
  }

  _spawnEnemy(x, z, opts) {
    const o = opts || {};
    const mesh = this.game.renderer.makePedMesh(o.shirt || 0x8a2a2a, 0xc98a5a);
    mesh.position.set(x, 0, z);
    this.game.renderer.scene.add(mesh);
    const enemy = {
      x, z, heading: 0, hp: o.hp || 60, mesh,
      kind: o.kind || 'gang', shootTimer: 1 + Math.random(),
      speed: o.speed || 4.5, boss: !!o.boss, name: o.name || 'Anak Buah',
    };
    this.enemies.push(enemy);
    return enemy;
  }

  _spawnAlly(x, z, name, shirt) {
    const mesh = this.game.renderer.makePedMesh(shirt || 0x3a7ad9, 0xe8b88a);
    mesh.position.set(x, 0, z);
    this.game.renderer.scene.add(mesh);
    const ally = { x, z, heading: 0, mesh, name, follow: false };
    this.allies.push(ally);
    return ally;
  }

  _spawnForObjective() {
    const obj = this.currentObjective;
    if (!obj) return;
    const g = this.game;
    switch (this.mission.id + ':' + obj.id) {
      case 'm1:deliver':
        // Dua penagih utang mulai membuntuti dengan mobil.
        for (let i = 0; i < 2; i += 1) {
          const mesh = g.renderer.makeCarMesh('sedan', 0x2a2a2a);
          g.renderer.scene.add(mesh);
          this.enemies.push({
            x: g.player.x + (i === 0 ? -30 : 30), z: g.player.z - 20,
            heading: 0, hp: 9999, mesh, kind: 'tail', shootTimer: 0, speed: 0, boss: false, name: 'Penagih',
          });
        }
        break;
      case 'm2:ambush':
        this.defeatNeeded = obj.count;
        this._spawnEnemy(-70, -218, { hp: 50 });
        this._spawnEnemy(-56, -230, { hp: 50 });
        this._spawnEnemy(-64, -210, { hp: 50 });
        break;
      case 'm3:bridge':
        // Blokade polisi di jembatan.
        g.police.placeRoadblock(64, 96, Math.PI / 2);
        break;
      case 'm4:clear':
        this.defeatNeeded = obj.count;
        this._spawnEnemy(196, -104, { hp: 60 });
        this._spawnEnemy(216, -88, { hp: 60 });
        this._spawnEnemy(200, -80, { hp: 60 });
        this._spawnEnemy(224, -104, { hp: 60 });
        this._spawnEnemy(190, -88, { hp: 60 });
        this._spawnEnemy(216, -112, { hp: 60 });
        break;
      case 'm5:chase': {
        // Perahu Anggara melaju ke utara di perairan pelabuhan.
        const mesh = g.renderer.makeCarMesh('perahu', 0x1a1a1a);
        g.renderer.scene.add(mesh);
        this.chaseTarget = {
          x: -292, z: 120, heading: Math.PI, speed: 16, mesh,
          kind: 'boat', hp: 9999, name: 'Perahu Anggara', shootTimer: 0, boss: false,
        };
        this.enemies.push(this.chaseTarget);
        break;
      }
      case 'm5:boss': {
        const boss = this._spawnEnemy(-276, 40, { hp: 300, boss: true, name: 'Bos Anggara', shirt: 0x1a1a1a, speed: 5.5 });
        this.bossSpawned = true;
        this._emit('boss', { name: 'Bos Anggara' });
        break;
      }
      default:
        break;
    }
  }

  /** Dipanggil main.js saat pemain membunuh musuh (damage datang dari tembakan pemain). */
  registerKill(enemy) {
    const obj = this.currentObjective;
    if (this.state !== 'playing' || !obj || obj.kind !== 'defeat') return;
    this.defeatDone += 1;
    this._emit('kill', { done: this.defeatDone, need: this.defeatNeeded });
    if (this.defeatDone >= this.defeatNeeded) this._completeObjective();
  }

  _completeObjective() {
    const obj = this.currentObjective;
    this._emit('objective-done', { objective: obj });
    this.game.audio.chime();
    this.objectiveIndex += 1;
    this.escapeTimer = 0;
    if (this.objectiveIndex >= this.mission.objectives.length) {
      this._finishMission();
    } else {
      this._spawnForObjective();
    }
  }

  _finishMission() {
    this.state = 'done';
    const reward = this.mission.reward;
    this.game.economy.earn(reward, `Misi ${this.mission.title} selesai`);
    this.game.audio.missionSting();
    if (this.mission.unlock === 'pistol') this.game.economy.giveWeapon('pistol');
    if (this.mission.unlock === 'smg') this.game.economy.giveWeapon('smg');
    if (this.mission.unlock === 'win') this.game.winGame();
    this._emit('mission-done', { mission: this.mission, reward });
    this._clearField();
  }

  failMission(reason) {
    if (this.state !== 'playing' && this.state !== 'dialogue') return;
    this.state = 'failed';
    this.failReason = reason;
    this.game.audio.failSting();
    this._emit('mission-failed', { reason });
    this._clearField();
  }

  _nearestPursuerDist() {
    const g = this.game;
    let best = Infinity;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - g.player.x, e.z - g.player.z);
      if (d < best) best = d;
    }
    for (const c of g.police.cars) {
      const d = Math.hypot(c.x - g.player.x, c.z - g.player.z);
      if (d < best) best = d;
    }
    return best;
  }

  update(dt) {
    if (this.state === 'dialogue') {
      this.dialogueTimer += dt;
      if (this.dialogueTimer > 6) this.advanceDialogue();
      return;
    }
    if (this.state !== 'playing') return;
    const g = this.game;
    const obj = this.currentObjective;
    if (!obj) return;

    // --- gerak musuh ---
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      if (e.kind === 'tail') {
        // Penagih membuntuti dengan mobil: kejar pemain, tapi tidak menabrak.
        const dx = g.player.x - e.x;
        const dz = g.player.z - e.z;
        const d = Math.hypot(dx, dz) || 1;
        const wantHeading = Math.atan2(dx, dz);
        let dh = wantHeading - e.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        e.heading += Math.max(-2 * dt, Math.min(2 * dt, dh));
        const speed = d > 26 ? 30 : d > 14 ? 22 : 12;
        e.x += Math.sin(e.heading) * speed * dt;
        e.z += Math.cos(e.heading) * speed * dt;
        e.mesh.position.set(e.x, 0, e.z);
        e.mesh.rotation.y = e.heading;
        continue;
      }
      if (e.kind === 'boat') {
        // Perahu Anggara melaju ke utara, sedikit berbelok.
        e.z -= e.speed * dt;
        e.x += Math.sin(g.time * 0.5) * 2 * dt;
        if (e.z < -160) e.z = 130; // putar balik (tetap dalam jangkauan)
        e.mesh.position.set(e.x, -0.2, e.z);
        e.mesh.rotation.y = Math.PI;
        continue;
      }
      // Musuh jalan kaki: dekati pemain, tembak bila dalam jangkauan.
      const dx = g.player.x - e.x;
      const dz = g.player.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 10) {
        e.heading = Math.atan2(dx, dz);
        e.x += Math.sin(e.heading) * e.speed * dt;
        e.z += Math.cos(e.heading) * e.speed * dt;
      } else {
        e.heading = Math.atan2(dx, dz);
      }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < ENEMY_SHOOT_RANGE) {
        e.shootTimer = e.boss ? 0.9 : 1.6;
        // Akurasi: 45% kena (bos 60%).
        if (Math.random() < (e.boss ? 0.6 : 0.45)) {
          g.damagePlayer(e.boss ? ENEMY_DAMAGE + 6 : ENEMY_DAMAGE, e.name);
          g.renderer.spawnParticles(
            { x: g.player.x, y: 1.4, z: g.player.z }, 0xff5533, 6, 4, 0.4, 0.5, -2,
          );
        }
        g.audio.gunshot();
        g.renderer.spawnParticles(
          { x: e.x, y: 1.5, z: e.z }, 0xffcc66, 5, 6, 0.25, 0.4, -1,
        );
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.heading;
      // Bos memanggil 2 anak buah saat darah setengah.
      if (e.boss && !this.bossMinionsSpawned && e.hp < 150) {
        this.bossMinionsSpawned = true;
        this._spawnEnemy(e.x + 6, e.z + 6, { hp: 50 });
        this._spawnEnemy(e.x - 6, e.z + 6, { hp: 50 });
        this._emit('boss-phase', {});
      }
    }

    // --- sekutu mengikuti (Dimas setelah dijemput) ---
    for (const a of this.allies) {
      if (!a.follow) continue;
      const dx = g.player.x - a.x;
      const dz = g.player.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > 4) {
        a.heading = Math.atan2(dx, dz);
        a.x += Math.sin(a.heading) * 6 * dt;
        a.z += Math.cos(a.heading) * 6 * dt;
        a.mesh.position.set(a.x, 0, a.z);
        a.mesh.rotation.y = a.heading;
      }
    }

    // --- cek objektif ---
    if (obj.kind === 'reach') {
      const d = Math.hypot(g.player.x - obj.x, g.player.z - obj.z);
      if (d < obj.radius) {
        if (this.mission.id === 'm1' && obj.id === 'drive') {
          // Dimas ikut: muncul di samping pemain dan mengikuti.
          const dimas = this._spawnAlly(g.player.x + 2, g.player.z + 2, 'Dimas', 0x3a7ad9);
          dimas.follow = true;
        }
        this._completeObjective();
      }
    } else if (obj.kind === 'escape') {
      const near = this._nearestPursuerDist();
      if (near > 26) {
        this.escapeTimer += dt;
        if (this.escapeTimer >= obj.seconds) this._completeObjective();
      } else {
        this.escapeTimer = Math.max(0, this.escapeTimer - dt * 2);
      }
    } else if (obj.kind === 'chase') {
      if (this.chaseTarget) {
        const d = Math.hypot(g.player.x - this.chaseTarget.x, g.player.z - this.chaseTarget.z);
        if (d < obj.radius) this._completeObjective();
      }
    }
    // defeat: diselesaikan lewat registerKill.
  }

  /** Musuh yang sedang dibidik pemain (untuk tembakan): terdekat dalam kerucut bidik. */
  aimTarget(origin, dirX, dirZ, maxRange) {
    let best = null;
    let bestScore = Infinity;
    for (const e of this.enemies) {
      if (e.kind === 'tail' || e.kind === 'boat') continue;
      const dx = e.x - origin.x;
      const dz = e.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > maxRange || d < 0.5) continue;
      const dot = (dx * dirX + dz * dirZ) / d;
      if (dot < 0.86) continue; // di luar kerucut bidik (~30 derajat)
      const score = d + (1 - dot) * 20;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  damageEnemy(enemy, amount) {
    enemy.hp -= amount;
    this.game.renderer.spawnParticles(
      { x: enemy.x, y: 1.4, z: enemy.z }, 0xff3333, 8, 5, 0.4, 0.5, -2,
    );
    if (enemy.hp <= 0) {
      const idx = this.enemies.indexOf(enemy);
      if (idx !== -1) this.enemies.splice(idx, 1);
      this.game.renderer.scene.remove(enemy.mesh);
      this.game.renderer.spawnParticles(
        { x: enemy.x, y: 1, z: enemy.z }, 0xaa2222, 16, 7, 0.8, 0.8, -4,
      );
      if (enemy.kind !== 'tail' && enemy.kind !== 'boat') {
        this.registerKill(enemy);
      }
      return true;
    }
    return false;
  }

  reset() {
    this._clearField();
    this.missionIndex = -1;
    this.mission = null;
    this.objectiveIndex = 0;
    this.dialogue = [];
    this.state = 'idle';
  }
}
