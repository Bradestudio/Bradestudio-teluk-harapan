// TELUK HARAPAN — render.js
// Menggambar dunia: tanah per distrik, jalan + marka, bangunan 2.5D,
// pelabuhan, pasar, taman, mobil, pejalan kaki, polisi, helikopter,
// partikel, dan pencahayaan per hari (Senja / Maghrib / Malam).

import { WORLD, DISTRICTS, DAYS, SHOPS } from './config.js';
import { districtAt } from './world.js';

export function renderWorld(G, ctx) {
  const cam = G.cam;
  const day = DAYS[G.player.day - 1] || DAYS[0];
  const vw = cam.w;
  const vh = cam.h;
  const vx0 = cam.x - vw / 2;
  const vy0 = cam.y - vh / 2;
  const vx1 = cam.x + vw / 2;
  const vy1 = cam.y + vh / 2;

  // --- Langit / tanah dasar --------------------------------------------------
  ctx.fillStyle = '#2a2f45';
  ctx.fillRect(0, 0, vw, vh);
  // Tanah per distrik (hanya yang terlihat).
  for (const d of DISTRICTS) {
    const b = d.bounds;
    if (b.x1 < vx0 || b.x0 > vx1 || b.y1 < vy0 || b.y0 > vy1) continue;
    ctx.fillStyle = d.ground;
    ctx.fillRect(b.x0 - vx0, b.y0 - vy0, b.x1 - b.x0, b.y1 - b.y0);
    // Tekstur tanah: bintik-bintik acak deterministik.
    ctx.fillStyle = d.groundAlt;
    for (let i = 0; i < 40; i++) {
      const px = b.x0 + ((i * 173 + 41) % (b.x1 - b.x0));
      const py = b.y0 + ((i * 311 + 97) % (b.y1 - b.y0));
      if (px < vx0 || px > vx1 || py < vy0 || py > vy1) continue;
      ctx.fillRect(px - vx0, py - vy0, 26, 18);
    }
  }
  // Laut di barat pelabuhan.
  ctx.fillStyle = '#2a5a8a';
  ctx.fillRect(-vx0, -vy0, 60, WORLD.height);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let y = 120; y < WORLD.height; y += 160) {
    ctx.fillRect(18 - vx0, y - vy0, 26, 3);
  }

  // --- Taman -----------------------------------------------------------------
  for (const park of G.world.parks) {
    if (park.x1 < vx0 || park.x0 > vx1 || park.y1 < vy0 || park.y0 > vy1) continue;
    ctx.fillStyle = '#4a6a3a';
    ctx.fillRect(park.x0 - vx0, park.y0 - vy0, park.x1 - park.x0, park.y1 - park.y0);
    ctx.strokeStyle = '#7fb069';
    ctx.lineWidth = 3;
    ctx.strokeRect(park.x0 - vx0, park.y0 - vy0, park.x1 - park.x0, park.y1 - park.y0);
  }

  drawRoads(G, ctx, vx0, vy0, vx1, vy1);

  // --- Props (pohon, lampu, kontainer, kios) -----------------------------------
  for (const prop of G.world.props) {
    if (prop.x < vx0 - 80 || prop.x > vx1 + 80 || prop.y < vy0 - 80 || prop.y > vy1 + 80) continue;
    drawProp(G, ctx, prop, vx0, vy0);
  }

  // --- Toko (bangunan kecil berlabel) ------------------------------------------
  for (const shop of SHOPS) {
    if (shop.x < vx0 - 120 || shop.x > vx1 + 120 || shop.y < vy0 - 120 || shop.y > vy1 + 120) continue;
    drawShopBuilding(G, ctx, shop, vx0, vy0);
  }

  // --- Bangunan ------------------------------------------------------------------
  const sorted = G.world.buildings.filter((b) => b.x + b.w > vx0 - 60 && b.x < vx1 + 60 && b.y + b.h > vy0 - 60 && b.y < vy1 + 60);
  sorted.sort((a, b) => a.y - b.y);
  for (const b of sorted) drawBuilding(G, ctx, b, vx0, vy0);

  // --- Penanda misi (tiang cahaya) ------------------------------------------------
  if (G.mission.marker) {
    const m = G.mission.marker;
    if (m.x > vx0 - 100 && m.x < vx1 + 100 && m.y > vy0 - 100 && m.y < vy1 + 100) {
      const pulse = 0.6 + Math.sin(G.timeNow * 4) * 0.25;
      ctx.fillStyle = `rgba(255,210,74,${pulse * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(m.x - vx0, m.y - vy0, 46, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd24a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(m.x - vx0, m.y - vy0);
      ctx.lineTo(m.x - vx0, m.y - vy0 - 90 - Math.sin(G.timeNow * 4) * 8);
      ctx.stroke();
      // Berlian melayang.
      const dy = m.y - vy0 - 100 - Math.sin(G.timeNow * 4) * 8;
      ctx.fillStyle = '#ffd24a';
      ctx.save();
      ctx.translate(m.x - vx0, dy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-8, -8, 16, 16);
      ctx.restore();
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', m.x - vx0, dy + 3);
      ctx.textAlign = 'left';
    }
  }

  // --- Pickup (uang, dll) ----------------------------------------------------------
  for (const pk of G.pickups) {
    if (pk.x < vx0 || pk.x > vx1 || pk.y < vy0 || pk.y > vy1) continue;
    const bob = Math.sin(pk.bob || 0) * 4;
    ctx.fillStyle = pk.kind === 'cash' ? '#ffd24a' : '#7be495';
    ctx.beginPath();
    ctx.arc(pk.x - vx0, pk.y - vy0 + bob, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'cash' ? 'Rp' : '+', pk.x - vx0, pk.y - vy0 + bob + 4);
    ctx.textAlign = 'left';
  }

  // --- NPC ------------------------------------------------------------------------
  for (const npc of G.npcs) {
    if (npc.x < vx0 || npc.x > vx1 || npc.y < vy0 || npc.y > vy1) continue;
    drawPerson(ctx, npc.x - vx0, npc.y - vy0, 0, npc.color, '#e8b88a', 1);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(npc.name, npc.x - vx0, npc.y - vy0 - 26);
    ctx.fillStyle = '#5ab5ff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('!', npc.x - vx0, npc.y - vy0 - 40 - Math.sin(G.timeNow * 3) * 3);
    ctx.textAlign = 'left';
  }

  // --- Pejalan kaki ------------------------------------------------------------------
  for (const ped of G.peds) {
    if (ped.x < vx0 - 30 || ped.x > vx1 + 30 || ped.y < vy0 - 30 || ped.y > vy1 + 30) continue;
    drawPerson(ctx, ped.x - vx0, ped.y - vy0, ped.walkCycle, ped.shirt, ped.skin, ped.fleeing ? 1.4 : 1);
    if (ped.line) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '11px sans-serif';
      const tw = ctx.measureText(ped.line).width + 12;
      ctx.fillRect(ped.x - vx0 - tw / 2, ped.y - vy0 - 52, tw, 18);
      ctx.fillStyle = '#222';
      ctx.textAlign = 'center';
      ctx.fillText(ped.line, ped.x - vx0, ped.y - vy0 - 39);
      ctx.textAlign = 'left';
    }
  }

  // --- Mobil ---------------------------------------------------------------------------
  const cars = G.cars.filter((c) => c.x > vx0 - 80 && c.x < vx1 + 80 && c.y > vy0 - 80 && c.y < vy1 + 80);
  cars.sort((a, b) => a.y - b.y);
  for (const car of cars) drawCar(G, ctx, car, vx0, vy0);

  // --- Blokade polisi ---------------------------------------------------------------------
  for (const rb of G.roadblocks) {
    if (rb.x < vx0 - 100 || rb.x > vx1 + 100 || rb.y < vy0 - 100 || rb.y > vy1 + 100) continue;
    ctx.save();
    ctx.translate(rb.x - vx0, rb.y - vy0);
    ctx.rotate(rb.angle);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(-50, -8, 100, 16);
    ctx.fillStyle = '#fff';
    for (let i = -40; i < 50; i += 20) ctx.fillRect(i, -8, 10, 16);
    ctx.restore();
    ctx.fillStyle = '#ff8a8a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BLOKADE POLISI', rb.x - vx0, rb.y - vy0 - 24);
    ctx.textAlign = 'left';
  }

  // --- Musuh -------------------------------------------------------------------------------
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (e.x < vx0 - 30 || e.x > vx1 + 30 || e.y < vy0 - 30 || e.y > vy1 + 30) continue;
    drawPerson(ctx, e.x - vx0, e.y - vy0, G.timeNow * 6, e.shirt, '#c98a5a', 1);
    // Bar HP.
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(e.x - vx0 - 18, e.y - vy0 - 30, 36, 5);
    ctx.fillStyle = e.isBoss ? '#ff2e88' : '#ff5a5a';
    ctx.fillRect(e.x - vx0 - 18, e.y - vy0 - 30, 36 * (e.hp / e.maxHp), 5);
    if (e.isBoss) {
      ctx.fillStyle = '#ff2e88';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BOS DARMA', e.x - vx0, e.y - vy0 - 38);
      ctx.textAlign = 'left';
    }
    if (e.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${e.flash * 0.6})`;
      ctx.beginPath();
      ctx.arc(e.x - vx0, e.y - vy0, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Pemain ----------------------------------------------------------------------------------
  drawPlayer(G, ctx, vx0, vy0);

  // --- Helikopter ---------------------------------------------------------------------------------
  if (G.heli) {
    const h = G.heli;
    const hx = h.x - vx0;
    const hy = h.y - vy0;
    // Sorot lampu ke pemain.
    const p = G.player;
    ctx.fillStyle = 'rgba(255,255,220,0.10)';
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(p.x - vx0 - 40, p.y - vy0);
    ctx.lineTo(p.x - vx0 + 40, p.y - vy0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,220,0.16)';
    ctx.beginPath();
    ctx.ellipse(p.x - vx0, p.y - vy0, 46, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(hx, hy);
    ctx.fillStyle = '#2a4a8a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5ab5ff';
    ctx.beginPath();
    ctx.ellipse(14, 0, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Rotor berputar.
    ctx.strokeStyle = 'rgba(200,200,200,0.8)';
    ctx.lineWidth = 3;
    const r = h.rotor;
    ctx.beginPath();
    ctx.moveTo(-34 * Math.cos(r), -34 * Math.sin(r));
    ctx.lineTo(34 * Math.cos(r), 34 * Math.sin(r));
    ctx.stroke();
    ctx.restore();
    // Bayangan helikopter di tanah.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(hx + 26, hy + 60, 30, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Peluru ---------------------------------------------------------------------------------------
  for (const b of G.bullets) {
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - vx0 - Math.cos(b.angle) * 10, b.y - vy0 - Math.sin(b.angle) * 10);
    ctx.lineTo(b.x - vx0, b.y - vy0);
    ctx.stroke();
  }

  // --- Partikel --------------------------------------------------------------------------------------
  for (const pt of G.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - vx0 - pt.size / 2, pt.y - vy0 - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  // --- Teks melayang ------------------------------------------------------------------------------------
  for (const ft of G.floatingTexts) {
    ctx.globalAlpha = Math.max(0, ft.life / 1.2);
    ctx.fillStyle = ft.color;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x - vx0, ft.y - vy0);
    ctx.textAlign = 'left';
  }
  ctx.globalAlpha = 1;

  // --- Pencahayaan per hari ------------------------------------------------------------------------------
  const light = day.light;
  if (light < 1) {
    ctx.fillStyle = `rgba(8,10,26,${(1 - light) * 0.55})`;
    ctx.fillRect(0, 0, vw, vh);
  }
  // Kabut warna langit.
  ctx.fillStyle = day.fog;
  ctx.fillRect(0, 0, vw, vh);

  // Lampu kota menyala di malam hari.
  if (G.player.day === 3) {
    ctx.fillStyle = 'rgba(255,210,120,0.5)';
    for (const prop of G.world.props) {
      if (prop.kind !== 'lamp') continue;
      if (prop.x < vx0 - 40 || prop.x > vx1 + 40 || prop.y < vy0 - 40 || prop.y > vy1 + 40) continue;
      ctx.beginPath();
      ctx.arc(prop.x - vx0, prop.y - vy0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRoads(G, ctx, vx0, vy0, vx1, vy1) {
  const hw = WORLD.roadHalfWidth;
  ctx.fillStyle = '#3a3a40';
  for (const ax of WORLD.avenues) {
    if (ax + hw < vx0 || ax - hw > vx1) continue;
    ctx.fillRect(ax - hw - vx0, -vy0, hw * 2, WORLD.height);
  }
  for (const sy of WORLD.streets) {
    if (sy + hw < vy0 || sy - hw > vy1) continue;
    ctx.fillRect(-vx0, sy - hw - vy0, WORLD.width, hw * 2);
  }
  // Trotoar.
  ctx.fillStyle = '#55555c';
  for (const ax of WORLD.avenues) {
    if (ax + hw + 14 < vx0 || ax - hw - 14 > vx1) continue;
    ctx.fillRect(ax - hw - 14 - vx0, -vy0, 14, WORLD.height);
    ctx.fillRect(ax + hw - vx0, -vy0, 14, WORLD.height);
  }
  for (const sy of WORLD.streets) {
    if (sy + hw + 14 < vy0 || sy - hw - 14 > vy1) continue;
    ctx.fillRect(-vx0, sy - hw - 14 - vy0, WORLD.width, 14);
    ctx.fillRect(-vx0, sy + hw - vy0, WORLD.width, 14);
  }
  // Marka jalan putus-putus.
  ctx.fillStyle = 'rgba(255,220,120,0.85)';
  for (const ax of WORLD.avenues) {
    if (ax < vx0 || ax > vx1) continue;
    for (let y = 40; y < WORLD.height; y += 90) {
      if (y < vy0 || y > vy1) continue;
      ctx.fillRect(ax - 2 - vx0, y - vy0, 4, 44);
    }
  }
  for (const sy of WORLD.streets) {
    if (sy < vy0 || sy > vy1) continue;
    for (let x = 40; x < WORLD.width; x += 90) {
      if (x < vx0 || x > vx1) continue;
      ctx.fillRect(x - vx0, sy - 2 - vy0, 44, 4);
    }
  }
  // Zebra cross di persimpangan.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (const ax of WORLD.avenues) {
    for (const sy of WORLD.streets) {
      if (ax < vx0 - 60 || ax > vx1 + 60 || sy < vy0 - 60 || sy > vy1 + 60) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(ax + i * 12 - 4 - vx0, sy - hw - 12 - vy0, 8, 10);
      }
    }
  }
}

function drawProp(G, ctx, prop, vx0, vy0) {
  const x = prop.x - vx0;
  const y = prop.y - vy0;
  if (prop.kind === 'tree' || prop.kind === 'palm') {
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(x - 2, y - 2, 4, 10);
    ctx.fillStyle = prop.kind === 'palm' ? '#3a8a4a' : '#2f6a2f';
    ctx.beginPath();
    ctx.arc(x, y - 8, prop.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(x - 4, y - 12, prop.s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.kind === 'lamp') {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x - 2, y - 8, 4, 16);
    ctx.fillStyle = G.player.day === 3 ? '#ffd24a' : '#c9c9c9';
    ctx.beginPath();
    ctx.arc(x, y - 10, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.kind === 'container') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(prop.angle || 0);
    ctx.fillStyle = prop.color;
    ctx.fillRect(-prop.w / 2, -prop.h / 2, prop.w, prop.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (let i = -prop.w / 2 + 8; i < prop.w / 2; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i, -prop.h / 2);
      ctx.lineTo(i, prop.h / 2);
      ctx.stroke();
    }
    ctx.restore();
  } else if (prop.kind === 'crane') {
    ctx.strokeStyle = '#d97b2b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, y + 30);
    ctx.lineTo(x, y - 60);
    ctx.lineTo(x + 70, y - 60);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 70, y - 60);
    ctx.lineTo(x + 70, y - 20);
    ctx.stroke();
    ctx.fillStyle = '#8a5a35';
    ctx.fillRect(x - 14, y + 22, 28, 16);
  } else if (prop.kind === 'stall') {
    ctx.fillStyle = prop.color;
    ctx.fillRect(x - prop.w / 2, y - prop.h / 2, prop.w, prop.h);
    ctx.fillStyle = '#c93a3a';
    ctx.beginPath();
    ctx.moveTo(x - prop.w / 2 - 4, y - prop.h / 2);
    ctx.lineTo(x + prop.w / 2 + 4, y - prop.h / 2);
    ctx.lineTo(x + prop.w / 2, y - prop.h / 2 - 10);
    ctx.lineTo(x - prop.w / 2, y - prop.h / 2 - 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2fa08a';
    ctx.fillRect(x - 12, y - 2, 24, 8);
  } else if (prop.kind === 'bench') {
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(x - 14, y - 4, 28, 8);
    ctx.fillRect(x - 12, y + 4, 4, 8);
    ctx.fillRect(x + 8, y + 4, 4, 8);
  }
}

function drawBuilding(G, ctx, b, vx0, vy0) {
  const x = b.x - vx0;
  const y = b.y - vy0;
  // Bayangan.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x + 6, y + 8, b.w, b.h);
  // Dinding.
  ctx.fillStyle = b.wall;
  ctx.fillRect(x, y, b.w, b.h);
  // Atap.
  ctx.fillStyle = b.color;
  ctx.fillRect(x + 4, y + 4, b.w - 8, b.h - 8);
  // Jendela menyala (malam) / gelap (siang).
  const night = G.player.day === 3;
  ctx.fillStyle = night ? '#ffd24a' : 'rgba(20,30,50,0.55)';
  const cols = Math.max(2, Math.floor(b.w / 34));
  const rows = Math.max(2, Math.floor(b.h / 34));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (((i * 7 + j * 13 + b.x) % 5) === 0 && !night) continue;
      ctx.fillRect(x + 10 + i * ((b.w - 20) / cols), y + 10 + j * ((b.h - 20) / rows), 12, 10);
    }
  }
  // Nama landmark.
  if (b.type === 'landmark') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.name, x + b.w / 2, y + b.h / 2 + 4);
    ctx.textAlign = 'left';
  }
  // Pintu.
  ctx.fillStyle = '#2a2018';
  ctx.fillRect(x + b.w / 2 - 8, y + b.h - 14, 16, 14);
}

function drawShopBuilding(G, ctx, shop, vx0, vy0) {
  const x = shop.x - vx0;
  const y = shop.y - vy0;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - 44, y - 28, 92, 64);
  ctx.fillStyle = shop.kind === 'safehouse' ? '#2f6a4a' : '#4a3a6a';
  ctx.fillRect(x - 48, y - 32, 96, 60);
  ctx.fillStyle = '#ffd24a';
  ctx.fillRect(x - 48, y - 32, 96, 16);
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(shop.name.toUpperCase().slice(0, 16), x, y - 20);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2a2018';
  ctx.fillRect(x - 8, y + 14, 16, 14);
  // Ikon jenis toko (teks pendek — aman di semua font).
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  const icon = shop.kind === 'repair' ? 'BENGKEL' : shop.kind === 'weapons' ? 'SENJATA' : shop.kind === 'safehouse' ? 'RUMAH' : 'KLINIK';
  ctx.fillText(icon, x, y + 8);
  ctx.textAlign = 'left';
}

export function drawCar(G, ctx, car, vx0, vy0) {
  const x = car.x - vx0;
  const y = car.y - vy0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  const [len, wid] = car.size;
  // Bayangan.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  // Bodi.
  ctx.fillStyle = car.crashed ? '#3a3a3a' : car.color;
  roundRectPath(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  // Kabin.
  ctx.fillStyle = car.crashed ? '#2a2a2a' : 'rgba(20,30,50,0.75)';
  roundRectPath(ctx, -len / 6, -wid / 2 + 3, len / 3, wid - 6, 4);
  ctx.fill();
  // Lampu depan / belakang.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 5);
  ctx.fillRect(len / 2 - 2, wid / 2 - 7, 3, 5);
  ctx.fillStyle = car.brakeLight ? '#ff2a2a' : '#8a1a1a';
  ctx.fillRect(-len / 2, -wid / 2 + 2, 3, 5);
  ctx.fillRect(-len / 2, wid / 2 - 7, 3, 5);
  // Polisi: strip + lampu strobo.
  if (car.isPolice) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-len / 4, -wid / 2, len / 2, 4);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLISI', 0, 3);
    ctx.textAlign = 'left';
    const blink = Math.floor(G.timeNow * 6) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2a2a' : '#2a5aff';
    ctx.beginPath();
    ctx.arc(-4, -wid / 2 + 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#2a5aff' : '#ff2a2a';
    ctx.beginPath();
    ctx.arc(6, -wid / 2 + 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.modelId === 'taksi') {
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAKSI', 0, 3);
    ctx.textAlign = 'left';
  }
  // Asap bila rusak.
  if (car.smoke > 0 && Math.random() < 0.2) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath();
    ctx.arc(-len / 4, 0, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPerson(ctx, x, y, walkCycle, shirt, skin, speedMul) {
  const bob = Math.sin(walkCycle * (speedMul || 1)) * 2;
  // Bayangan.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Kaki.
  ctx.fillStyle = '#2a2a3a';
  const legSwing = Math.sin(walkCycle) * 4;
  ctx.fillRect(x - 6, y + 2 + legSwing * 0.3, 4, 9);
  ctx.fillRect(x + 2, y + 2 - legSwing * 0.3, 4, 9);
  // Badan.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(x, y + bob * 0.4, 9, 0, Math.PI * 2);
  ctx.fill();
  // Kepala.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, y - 12 + bob * 0.4, 7, 0, Math.PI * 2);
  ctx.fill();
  // Rambut.
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(x, y - 15 + bob * 0.4, 6, Math.PI, 0);
  ctx.fill();
}

function drawPlayer(G, ctx, vx0, vy0) {
  const p = G.player;
  if (p.hp <= 0) return;
  const x = p.x - vx0;
  const y = p.y - vy0;
  if (p.inCar) {
    // Panah arah di atas mobil (biar pemain kelihatan).
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.angle);
    ctx.beginPath();
    ctx.moveTo(34, 0);
    ctx.lineTo(24, -6);
    ctx.lineTo(24, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }
  drawPerson(ctx, x, y, p.walkCycle, '#4a7fb5', '#e8b88a', p.moving ? 1.2 : 0);
  // Senjata di tangan.
  if (p.weapon !== 'fist') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(8, -2, 16, 4);
    ctx.restore();
  }
  // Lingkaran bidik kecil.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + Math.cos(p.angle) * 30, y + Math.sin(p.angle) * 30, 5, 0, Math.PI * 2);
  ctx.stroke();
}
