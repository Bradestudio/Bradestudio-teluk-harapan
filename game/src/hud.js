// TELUK HARAPAN — hud.js
// Semua antarmuka: HUD (HP, armor, uang, wanted, tujuan misi), minimap,
// dialog cerita, menu toko, layar judul / jeda / game over / menang,
// dan peta besar (M).

import { DISTRICTS, DAYS, WEAPONS, TIPS, SHOPS, WANTED_LINES } from './config.js';
import { districtAt } from './world.js';
import { saveSummary } from './save.js';

export function drawHUD(G, ctx, W, H) {
  const p = G.player;
  const day = DAYS[p.day - 1] || DAYS[0];

  // --- Panel atas kiri: HP, armor, uang -------------------------------------
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.62)';
  roundRect(ctx, 12, 12, 250, 92, 10);
  ctx.fill();

  // HP bar.
  ctx.fillStyle = '#2a2a2a';
  roundRect(ctx, 24, 24, 200, 16, 8);
  ctx.fill();
  ctx.fillStyle = p.hp > 50 ? '#7be495' : p.hp > 25 ? '#ffd24a' : '#ff5a5a';
  roundRect(ctx, 24, 24, 200 * (p.hp / p.maxHp), 16, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HP ' + Math.ceil(p.hp), 28, 36);

  // Armor bar.
  ctx.fillStyle = '#2a2a2a';
  roundRect(ctx, 24, 46, 200, 10, 5);
  ctx.fill();
  ctx.fillStyle = '#5ab5ff';
  roundRect(ctx, 24, 46, 200 * (p.armor / p.maxArmor), 10, 5);
  ctx.fill();
  ctx.fillStyle = '#cfe8ff';
  ctx.font = '11px sans-serif';
  ctx.fillText('ARMOR ' + Math.ceil(p.armor), 28, 55);

  // Uang.
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Rp ' + p.cash.toLocaleString('id-ID'), 24, 84);
  ctx.fillStyle = '#bbb';
  ctx.font = '11px sans-serif';
  ctx.fillText(day.label + '  •  ' + districtAt(p.x, p.y).name, 24, 100);

  // --- Wanted stars (kanan atas, di atas minimap) ---------------------------
  const stars = p.wanted;
  ctx.textAlign = 'right';
  ctx.font = 'bold 26px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? (Math.floor(G.timeNow * 4) % 2 === 0 ? '#ff5a5a' : '#ffb0b0') : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', W - 24 - i * 30, 44);
  }
  if (stars > 0) {
    ctx.fillStyle = '#ff8a8a';
    ctx.font = '11px sans-serif';
    ctx.fillText(WANTED_LINES[stars], W - 24, 62);
  }

  // --- Tujuan misi (bawah kiri) ----------------------------------------------
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(8,10,18,0.62)';
  const obj = G.mission.objective;
  ctx.font = 'bold 13px sans-serif';
  const objW = Math.min(420, ctx.measureText(obj).width + 44);
  roundRect(ctx, 12, H - 64, objW, 52, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd24a';
  ctx.fillText('◆ TUJUAN', 24, H - 46);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(obj.length > 58 ? obj.slice(0, 58) + '…' : obj, 24, H - 26);

  // Timer misi (bila ada).
  const timer = missionTimer(G);
  if (timer !== null) {
    ctx.fillStyle = timer < 15 ? '#ff5a5a' : '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⏱ ' + Math.ceil(timer) + ' detik', W / 2, 40);
    ctx.textAlign = 'left';
  }

  // --- Senjata aktif + amunisi (kanan bawah) ----------------------------------
  const w = WEAPONS[p.weapon];
  ctx.fillStyle = 'rgba(8,10,18,0.62)';
  roundRect(ctx, W - 212, H - 64, 200, 52, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(w.name, W - 24, H - 44);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#ffd24a';
  if (w.id === 'fist') ctx.fillText('—', W - 24, H - 26);
  else ctx.fillText(p.mag[w.id] + ' / ' + p.reserve[w.id] + '  •  [R] isi ulang', W - 24, H - 26);
  ctx.textAlign = 'left';

  // Kecepatan mobil.
  if (p.inCar) {
    const car = p.inCar;
    ctx.fillStyle = 'rgba(8,10,18,0.62)';
    roundRect(ctx, W - 212, H - 128, 200, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(Math.abs(car.speed) * 0.36) + ' km/j', W - 24, H - 104);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = car.hp < car.maxHp * 0.35 ? '#ff5a5a' : '#bbb';
    ctx.fillText(car.model.name + '  •  HP ' + Math.ceil(car.hp) + '/' + car.maxHp + (car.nitro ? '  •  NITRO' : ''), W - 24, H - 86);
    ctx.textAlign = 'left';
    if (car.nitro) {
      ctx.fillStyle = '#2a2a2a';
      roundRect(ctx, W - 200, H - 80, 176, 6, 3);
      ctx.fill();
      ctx.fillStyle = '#5ab5ff';
      roundRect(ctx, W - 200, H - 80, 176 * (car.nitroFuel / 100), 6, 3);
      ctx.fill();
    }
  }

  // --- Toast (pesan sementara, tengah atas) -----------------------------------
  let ty = 78;
  for (const t of G.toasts) {
    ctx.globalAlpha = Math.min(1, t.life * 2);
    ctx.fillStyle = 'rgba(8,10,18,0.7)';
    ctx.font = '13px sans-serif';
    const tw = ctx.measureText(t.text).width + 24;
    roundRect(ctx, W / 2 - tw / 2, ty, tw, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(t.text, W / 2, ty + 18);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    ty += 32;
  }

  // --- Minimap -----------------------------------------------------------------
  drawMinimap(G, ctx, W, H);

  // --- Interaksi terdekat -------------------------------------------------------
  const hint = interactionHint(G);
  if (hint) {
    ctx.fillStyle = 'rgba(8,10,18,0.75)';
    ctx.font = 'bold 13px sans-serif';
    const hw = ctx.measureText(hint).width + 28;
    roundRect(ctx, W / 2 - hw / 2, H - 110, hw, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#ffd24a';
    ctx.textAlign = 'center';
    ctx.fillText(hint, W / 2, H - 90);
    ctx.textAlign = 'left';
  }

  // --- Efek damage (vignette merah) ----------------------------------------------
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,40,40,${p.hurtFlash * 0.22})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function missionTimer(G) {
  const M = G.mission;
  if (!M.active || !M.stage) return null;
  if (M.stageData.timeLeft !== undefined) return M.stageData.timeLeft;
  if (M.stageData.escapeTimer !== undefined) return M.stageData.escapeTimer;
  return null;
}

function interactionHint(G) {
  const p = G.player;
  if (G.shopOpen || G.dialogue) return null;
  if (!p.inCar) {
    const { shop, d } = nearestShopInfo(G);
    if (shop && d < 110) return '[E] Masuk ' + shop.name;
    for (const npc of G.npcs) {
      if (Math.hypot(p.x - npc.x, p.y - npc.y) < 70) return '[E] Bicara dengan ' + npc.name;
    }
    for (const car of G.cars) {
      if (Math.hypot(p.x - car.x, p.y - car.y) < 80 && !(car.isPolice && car.driver)) {
        return '[E] ' + (car.owned ? 'Masuk mobil' : 'Curi mobil: ' + car.model.name);
      }
    }
    const M = G.mission;
    if (!M.active && M.marker && Math.hypot(p.x - M.marker.x, p.y - M.marker.y) < 90) {
      return '[E] Mulai misi: ' + M.marker.label;
    }
  } else {
    return '[E] Keluar mobil';
  }
  return null;
}

function nearestShopInfo(G) {
  let best = null;
  let bd = Infinity;
  for (const s of SHOPS) {
    const d = Math.hypot(G.player.x - s.x, G.player.y - s.y);
    if (d < bd) { bd = d; best = s; }
  }
  return { shop: best, d: bd };
}

// --- Minimap -------------------------------------------------------------------
function drawMinimap(G, ctx, W, H) {
  const size = 190;
  const x0 = W - size - 14;
  const y0 = 84;
  const scale = size / 3600;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();

  // Distrik sebagai latar.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(x0 + d.bounds.x0 * scale, y0 + d.bounds.y0 * scale, (d.bounds.x1 - d.bounds.x0) * scale, (d.bounds.y1 - d.bounds.y0) * scale);
  }
  // Jalan.
  ctx.strokeStyle = 'rgba(220,220,220,0.55)';
  ctx.lineWidth = 2;
  for (const ax of [300, 900, 1500, 2100, 2700, 3200]) {
    ctx.beginPath();
    ctx.moveTo(x0 + ax * scale, y0);
    ctx.lineTo(x0 + ax * scale, y0 + size);
    ctx.stroke();
  }
  for (const sy of [300, 850, 1400, 1950, 2350]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + sy * scale);
    ctx.lineTo(x0 + size, y0 + sy * scale);
    ctx.stroke();
  }
  // Laut di barat (pelabuhan).
  ctx.fillStyle = 'rgba(70,130,180,0.5)';
  ctx.fillRect(x0, y0, 14, size * 0.55);
  // Toko.
  for (const s of SHOPS) {
    ctx.fillStyle = s.kind === 'safehouse' ? '#7be495' : '#ffd24a';
    ctx.beginPath();
    ctx.arc(x0 + s.x * scale, y0 + s.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Musuh misi (merah), NPC (cyan).
  for (const e of G.enemies) {
    if (e.dead) continue;
    ctx.fillStyle = e.isBoss ? '#ff2e88' : '#ff5a5a';
    ctx.fillRect(x0 + e.x * scale - 2, y0 + e.y * scale - 2, 4, 4);
  }
  for (const npc of G.npcs) {
    ctx.fillStyle = '#5ab5ff';
    ctx.beginPath();
    ctx.arc(x0 + npc.x * scale, y0 + npc.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Penanda misi (kuning berdenyut).
  const M = G.mission;
  if (M.marker) {
    const pulse = 4 + Math.sin(G.timeNow * 5) * 1.5;
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.arc(x0 + M.marker.x * scale, y0 + M.marker.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Polisi.
  for (const c of G.cars) {
    if (c.isPolice && c.driver === 'police') {
      ctx.fillStyle = '#5ab5ff';
      ctx.fillRect(x0 + c.x * scale - 2, y0 + c.y * scale - 2, 4, 4);
    }
  }
  if (G.heli) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('H', x0 + G.heli.x * scale - 3, y0 + G.heli.y * scale + 3);
  }
  // Pemain (panah putih) + arah pandang.
  const p = G.player;
  ctx.fillStyle = '#fff';
  ctx.save();
  ctx.translate(x0 + p.x * scale, y0 + p.y * scale);
  ctx.rotate(p.angle);
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Batas pandang kamera (kotak).
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + (G.cam.x - G.cam.w / 2) * scale, y0 + (G.cam.y - G.cam.h / 2) * scale, G.cam.w * scale, G.cam.h * scale);

  ctx.restore();
  // Label distrik di bawah minimap.
  ctx.fillStyle = '#ddd';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(districtAt(p.x, p.y).name + '  •  ' + (p.inCar ? 'Mengemudi' : 'Jalan kaki'), x0 + size / 2, y0 + size + 20);
  ctx.textAlign = 'left';
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- Dialog cerita -------------------------------------------------------------
export function drawDialogue(G, ctx, W, H) {
  const d = G.dialogue;
  if (!d || !d.lines || d.index >= d.lines.length) return;
  const line = d.lines[d.index];
  ctx.save();
  // Panel bawah.
  ctx.fillStyle = 'rgba(8,10,18,0.85)';
  roundRect(ctx, W / 2 - 340, H - 190, 680, 150, 14);
  ctx.fill();
  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Potret pembicara (lingkaran + inisial).
  ctx.fillStyle = speakerColor(line.who);
  ctx.beginPath();
  ctx.arc(W / 2 - 290, H - 140, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(line.who.charAt(0), W / 2 - 290, H - 132);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(line.who, W / 2 - 240, H - 158);
  // Teks (typewriter).
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  const shown = line.text.slice(0, d.chars);
  wrapText(ctx, shown, W / 2 - 240, H - 132, 560, 22);
  ctx.fillStyle = '#aaa';
  ctx.font = '12px sans-serif';
  ctx.fillText(d.index < d.lines.length - 1 ? 'Enter / klik — lanjut' : 'Enter / klik — tutup', W / 2 - 240, H - 62);
  ctx.restore();
}

function speakerColor(who) {
  if (who === 'Raka') return '#4a7fb5';
  if (who === 'Sinta') return '#e8c832';
  if (who === 'Pak Tono') return '#2fa08a';
  if (who === 'Bos Darma') return '#c93a3a';
  return '#8a6a9a';
}

export function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

// --- Toko -----------------------------------------------------------------------
export function drawShop(G, ctx, W, H) {
  const shop = G.shopOpen;
  if (!shop) return;
  ctx.save();
  ctx.fillStyle = 'rgba(5,6,12,0.72)';
  ctx.fillRect(0, 0, W, H);
  const pw = 560;
  const ph = 110 + shop.stock.length * 46;
  const px = W / 2 - pw / 2;
  const py = H / 2 - ph / 2;
  ctx.fillStyle = '#141824';
  roundRect(ctx, px, py, pw, ph, 14);
  ctx.fill();
  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(shop.name, px + 24, py + 34);
  ctx.fillStyle = '#bbb';
  ctx.font = '13px sans-serif';
  ctx.fillText(shop.blurb, px + 24, py + 56);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Rp ' + G.player.cash.toLocaleString('id-ID'), px + pw - 24, py + 34);
  ctx.textAlign = 'left';
  const sel = G.shopSel || 0;
  shop.stock.forEach((item, i) => {
    const iy = py + 72 + i * 46;
    if (i === sel) {
      ctx.fillStyle = 'rgba(255,210,74,0.16)';
      roundRect(ctx, px + 12, iy - 6, pw - 24, 40, 8);
      ctx.fill();
    }
    ctx.fillStyle = i === sel ? '#ffd24a' : '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText((i + 1) + '. ' + item.name, px + 24, iy + 18);
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.fillText(item.desc, px + 24, iy + 34);
    ctx.fillStyle = G.player.cash >= item.price ? '#7be495' : '#ff8a8a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(item.price === 0 ? 'GRATIS' : 'Rp ' + item.price, px + pw - 24, iy + 18);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = '#aaa';
  ctx.font = '12px sans-serif';
  const msgY = py + ph - 22;
  ctx.fillText('↑↓ pilih  •  Enter beli  •  Esc tutup', px + 24, msgY);
  if (G.shopMsg) {
    ctx.fillStyle = G.shopMsgOk ? '#7be495' : '#ff8a8a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(G.shopMsg, px + 24, msgY - 18);
  }
  ctx.restore();
}

// --- Layar judul / jeda / akhir ---------------------------------------------------
export function drawTitle(G, ctx, W, H) {
  const day = DAYS[0];
  ctx.save();
  // Langit senja gradien.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, day.skyTop);
  grad.addColorStop(0.55, day.sky);
  grad.addColorStop(1, '#3a2a4d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Matahari terbenam.
  ctx.fillStyle = day.sun.color;
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.3, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,210,122,0.25)';
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.3, 100, 0, Math.PI * 2);
  ctx.fill();
  // Siluet kota.
  ctx.fillStyle = '#241a33';
  const base = H * 0.72;
  let bx = 0;
  const rngBuildings = [90, 140, 70, 180, 110, 150, 80, 200, 120, 160, 90, 130];
  for (let i = 0; bx < W; i++) {
    const bw = 60 + ((i * 37) % 70);
    const bh = rngBuildings[i % rngBuildings.length] + (i % 3) * 30;
    ctx.fillRect(bx, base - bh, bw, bh + H);
    bx += bw + 8;
  }
  // Laut.
  ctx.fillStyle = '#1c3a5a';
  ctx.fillRect(0, base + 60, W, H - base - 60);
  ctx.fillStyle = 'rgba(255,210,122,0.35)';
  ctx.fillRect(W * 0.7, base + 60, 140, 3);
  ctx.fillRect(W * 0.72, base + 78, 100, 2);

  // Judul.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillText('TELUK HARAPAN', W / 2, H * 0.3);
  ctx.shadowBlur = 0;
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#ffd24a';
  ctx.fillText(GAME_SUBTITLE_LINE, W / 2, H * 0.3 + 34);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText('Kota pesisir Indonesia  •  5 misi cerita  •  3 hari: Senja → Maghrib → Malam', W / 2, H * 0.3 + 62);

  // Menu.
  const saves = [saveSummary(1), saveSummary(2), saveSummary(3)];
  const items = ['▶  MULAI PERMAINAN BARU'];
  saves.forEach((s, i) => {
    items.push(s ? `▶  LANJUTKAN — Slot ${i + 1} (Hari ${s.day}, ${s.missions} misi, Rp ${s.cash})` : `·  Slot ${i + 1} kosong`);
  });
  items.push('?  CARA BERMAIN');
  const sel = G.titleSel || 0;
  ctx.font = 'bold 17px sans-serif';
  items.forEach((it, i) => {
    const y = H * 0.52 + i * 34;
    if (i === sel) {
      ctx.fillStyle = 'rgba(255,210,74,0.9)';
      roundRect(ctx, W / 2 - 260, y - 22, 520, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
    } else {
      ctx.fillStyle = i >= 1 && i <= 3 && !saves[i - 1] ? '#888' : '#fff';
    }
    ctx.fillText(it, W / 2, y);
  });

  // Tips bergantian.
  const tip = TIPS[Math.floor(G.timeNow / 4) % TIPS.length];
  ctx.fillStyle = '#ddd';
  ctx.font = '13px sans-serif';
  ctx.fillText('Tips: ' + tip, W / 2, H - 40);
  ctx.fillStyle = '#999';
  ctx.font = '12px sans-serif';
  ctx.fillText('↑↓ pilih  •  Enter mulai  •  Game orisinal — bukan GTA, tanpa aset Rockstar', W / 2, H - 20);
  ctx.textAlign = 'left';
  ctx.restore();
}

const GAME_SUBTITLE_LINE = 'Kota pesisir. Tiga hari. Satu kesempatan terakhir.';

export function drawPause(G, ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,6,12,0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('JEDA', W / 2, H * 0.3);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  const p = G.player;
  ctx.fillText(`Hari ${p.day}  •  Misi selesai: ${p.missionsDone}/5  •  Uang: Rp ${p.cash.toLocaleString('id-ID')}  •  Bunuh: ${p.kills}  •  Mobil dicuri: ${p.carsStolen}`, W / 2, H * 0.3 + 34);
  const items = ['▶  LANJUTKAN', '▣  SIMPAN (Slot 1)', '▣  SIMPAN (Slot 2)', '▣  SIMPAN (Slot 3)', '♪  MUSIK: ' + (G.audio.musicOn ? 'NYALA' : 'MATI'), '✕  KELUAR KE JUDUL'];
  const sel = G.pauseSel || 0;
  ctx.font = 'bold 17px sans-serif';
  items.forEach((it, i) => {
    const y = H * 0.44 + i * 34;
    if (i === sel) {
      ctx.fillStyle = 'rgba(255,210,74,0.9)';
      roundRect(ctx, W / 2 - 220, y - 22, 440, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
    } else {
      ctx.fillStyle = '#fff';
    }
    ctx.fillText(it, W / 2, y);
  });
  ctx.fillStyle = '#aaa';
  ctx.font = '13px sans-serif';
  ctx.fillText('↑↓ pilih  •  Enter jalankan  •  Esc lanjut', W / 2, H * 0.44 + items.length * 34 + 10);
  ctx.textAlign = 'left';
  ctx.restore();
}

export function drawGameOver(G, ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(20,4,8,0.88)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('RAKA TUMBANG', W / 2, H * 0.36);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText('Teluk Harapan belum selesai denganmu. Bangkit dan coba lagi.', W / 2, H * 0.36 + 36);
  ctx.fillStyle = '#ddd';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Misi selesai: ${G.player.missionsDone}/5  •  Uang: Rp ${G.player.cash.toLocaleString('id-ID')}`, W / 2, H * 0.36 + 64);
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('Enter — coba lagi dari Rumah Aman   •   Esc — kembali ke judul', W / 2, H * 0.36 + 110);
  ctx.textAlign = 'left';
  ctx.restore();
}

export function drawVictory(G, ctx, W, H) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0b0e1e');
  grad.addColorStop(0.6, '#f2a65a');
  grad.addColorStop(1, '#e07b39');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 14;
  ctx.fillText('TELUK HARAPAN BEBAS', W / 2, H * 0.3);
  ctx.shadowBlur = 0;
  ctx.font = '17px sans-serif';
  ctx.fillText('Bos Darma jatuh. Matahari terbit lagi di atas teluk — kali ini untuk semua orang.', W / 2, H * 0.3 + 36);
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('— TAMAT —', W / 2, H * 0.3 + 70);
  const p = G.player;
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText(`5 misi selesai  •  Rp ${p.cash.toLocaleString('id-ID')}  •  ${p.kills} musuh dikalahkan  •  ${p.carsStolen} mobil dicuri`, W / 2, H * 0.3 + 104);
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Enter — main lagi (free roam)   •   Esc — kembali ke judul', W / 2, H * 0.3 + 140);
  ctx.textAlign = 'left';
  ctx.restore();
}

// --- Peta besar (M) --------------------------------------------------------------
export function drawBigMap(G, ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,6,12,0.85)';
  ctx.fillRect(0, 0, W, H);
  const size = Math.min(W, H) - 120;
  const x0 = (W - size) / 2;
  const y0 = 60;
  const scale = size / 3600;
  ctx.fillStyle = '#141824';
  roundRect(ctx, x0 - 10, y0 - 10, size + 20, size + 20, 12);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(x0 + d.bounds.x0 * scale, y0 + d.bounds.y0 * scale, (d.bounds.x1 - d.bounds.x0) * scale, (d.bounds.y1 - d.bounds.y0) * scale);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.name.toUpperCase(), x0 + ((d.bounds.x0 + d.bounds.x1) / 2) * scale, y0 + ((d.bounds.y0 + d.bounds.y1) / 2) * scale);
  }
  ctx.strokeStyle = 'rgba(220,220,220,0.6)';
  ctx.lineWidth = 2;
  for (const ax of [300, 900, 1500, 2100, 2700, 3200]) {
    ctx.beginPath(); ctx.moveTo(x0 + ax * scale, y0); ctx.lineTo(x0 + ax * scale, y0 + size); ctx.stroke();
  }
  for (const sy of [300, 850, 1400, 1950, 2350]) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + sy * scale); ctx.lineTo(x0 + size, y0 + sy * scale); ctx.stroke();
  }
  for (const s of SHOPS) {
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(x0 + s.x * scale, y0 + s.y * scale, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.fillText(s.name, x0 + s.x * scale, y0 + s.y * scale - 8);
  }
  const M = G.mission;
  if (M.marker) {
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(x0 + M.marker.x * scale, y0 + M.marker.y * scale, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(M.marker.label, x0 + M.marker.x * scale, y0 + M.marker.y * scale - 12);
  }
  const p = G.player;
  ctx.fillStyle = '#fff';
  ctx.save();
  ctx.translate(x0 + p.x * scale, y0 + p.y * scale);
  ctx.rotate(p.angle);
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -7); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#aaa';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('M / Esc — tutup peta  •  Kuning = toko  •  Bintang kuning = tujuan misi', W / 2, H - 30);
  ctx.textAlign = 'left';
}

// --- Layar bantuan ---------------------------------------------------------------
export function drawHelp(G, ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,6,12,0.85)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('CARA BERMAIN', W / 2, 90);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  const lines = [
    'Kamu Raka, kurir Teluk Harapan. Selesaikan 5 misi cerita dalam 3 hari.',
    'Ikuti penanda kuning di minimap. Bicara dengan NPC (E) untuk memulai misi.',
    'WASD bergerak/mengemudi  •  E masuk-keluar mobil & interaksi  •  Mouse + klik menembak',
    'F pukul  •  R isi ulang  •  H kotak P3K  •  Shift nitro  •  Spasi rem tangan',
    '1-4 ganti senjata  •  M peta besar  •  Esc jeda',
    'Kunjungi 4 toko: Bengkel Jaya, Sinar Senjata, Rumah Aman, Klinik Sehat.',
    'Wanted 1-5: polisi, helikopter, dan blokade akan mengejarmu. Bersembunyilah!',
    'Simpan permainan di Rumah Aman (Bukit Harapan) atau dari menu jeda.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 140 + i * 30));
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Enter / Esc — kembali', W / 2, 140 + lines.length * 30 + 20);
  ctx.textAlign = 'left';
  ctx.restore();
}
