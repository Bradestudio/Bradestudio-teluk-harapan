// TELUK HARAPAN — pedestrians.js
// Pejalan kaki AI: berjalan di trotoar, mengobrol, menyeberang, kabur saat
// ada tembakan atau mobil ngebut, dan kadang memberi uang receh (tips).

import { PED_NAMES, PED_SHIRTS, PED_LINES, WORLD } from './config.js';
import { dist, angleTo } from './random.js';
import { nearestRoadPoint, collideCircleBuildings, clampToWorld } from './world.js';

let pedIdCounter = 1;

export function makePed(rng, x, y) {
  const onRoad = nearestRoadPoint(x, y);
  return {
    id: pedIdCounter++,
    name: rng.pick(PED_NAMES),
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(28, 55),
    shirt: rng.pick(PED_SHIRTS),
    skin: rng.pick(['#e8b88a', '#c98a5a', '#a06a42', '#f0c8a0']),
    walkCycle: rng.range(0, 6),
    state: 'walk', // walk | idle | flee | chat
    stateTimer: rng.range(2, 8),
    target: null,
    fleeing: false,
    fleeTimer: 0,
    chatPartner: null,
    line: null,
    lineTimer: 0,
    tipGiven: false,
  };
}

export function spawnPed(G, near) {
  const rng = G.rng;
  let x;
  let y;
  if (near) {
    x = near.x + rng.range(-500, 500);
    y = near.y + rng.range(-400, 400);
  } else {
    x = rng.range(100, WORLD.width - 100);
    y = rng.range(100, WORLD.height - 100);
  }
  x = Math.max(60, Math.min(WORLD.width - 60, x));
  y = Math.max(60, Math.min(WORLD.height - 60, y));
  return makePed(rng, x, y);
}

export function ensurePeds(G, dt) {
  const p = G.player;
  const target = 26;
  let count = 0;
  for (const ped of G.peds) {
    if (dist(ped.x, ped.y, p.x, p.y) < 1400) count++;
  }
  G.peds = G.peds.filter((ped) => dist(ped.x, ped.y, p.x, p.y) < 1600);
  if (G.peds.length < target && G.pedTimer <= 0) {
    G.peds.push(spawnPed(G, p));
    G.pedTimer = 0.25;
  }
  G.pedTimer = Math.max(0, (G.pedTimer || 0) - dt);
}

export function updatePeds(G, dt) {
  const p = G.player;
  const rng = G.rng;
  for (const ped of G.peds) {
    ped.walkCycle += dt * (ped.state === 'flee' ? 12 : 5);
    ped.stateTimer -= dt;
    ped.lineTimer -= dt;
    if (ped.lineTimer <= 0) ped.line = null;

    // Reaksi terhadap bahaya: tembakan baru atau mobil pemain ngebut.
    if (!ped.fleeing) {
      const danger = G.recentShot && dist(ped.x, ped.y, G.recentShot.x, G.recentShot.y) < 260;
      const carDanger = p.inCar && Math.abs(p.inCar.speed) > 150 && dist(ped.x, ped.y, p.x, p.y) < 120;
      if (danger || carDanger) {
        ped.fleeing = true;
        ped.fleeTimer = rng.range(2.5, 4.5);
        ped.state = 'flee';
      }
    }
    if (ped.fleeing) {
      ped.fleeTimer -= dt;
      const away = angleTo(p.x, p.y, ped.x, ped.y);
      ped.angle = away;
      ped.x += Math.cos(away) * 130 * dt;
      ped.y += Math.sin(away) * 130 * dt;
      if (ped.fleeTimer <= 0) {
        ped.fleeing = false;
        ped.state = 'walk';
        ped.stateTimer = rng.range(2, 6);
      }
    } else if (ped.state === 'idle') {
      if (ped.stateTimer <= 0) {
        ped.state = 'walk';
        ped.stateTimer = rng.range(4, 10);
        pickWalkTarget(G, ped);
      }
    } else if (ped.state === 'chat') {
      // Berdiri mengobrol dengan pasangan.
      if (ped.chatPartner && dist(ped.x, ped.y, ped.chatPartner.x, ped.chatPartner.y) < 60) {
        ped.angle = angleTo(ped.x, ped.y, ped.chatPartner.x, ped.chatPartner.y);
        if (ped.stateTimer <= 0 && rng.chance(0.3)) {
          ped.line = rng.pick(PED_LINES);
          ped.lineTimer = 3;
        }
      } else {
        ped.state = 'walk';
        ped.chatPartner = null;
      }
      if (ped.stateTimer <= 0) {
        ped.state = 'walk';
        ped.chatPartner = null;
        ped.stateTimer = rng.range(4, 10);
        pickWalkTarget(G, ped);
      }
    } else {
      // Berjalan menuju target trotoar.
      if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 24 || ped.stateTimer <= 0) {
        if (rng.chance(0.18)) {
          ped.state = 'idle';
          ped.stateTimer = rng.range(2, 6);
          ped.target = null;
        } else if (rng.chance(0.12)) {
          // Cari teman mengobrol di dekat.
          const other = G.peds.find((o) => o !== ped && !o.fleeing && o.state === 'walk' && dist(ped.x, ped.y, o.x, o.y) < 90);
          if (other) {
            ped.state = 'chat';
            ped.chatPartner = other;
            other.state = 'chat';
            other.chatPartner = ped;
            ped.stateTimer = rng.range(4, 9);
            other.stateTimer = ped.stateTimer;
            ped.target = null;
          } else {
            pickWalkTarget(G, ped);
          }
        } else {
          pickWalkTarget(G, ped);
        }
      }
      if (ped.target) {
        const a = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
        ped.angle += (a - ped.angle) * Math.min(1, dt * 6);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
    }

    // Jangan menembus bangunan.
    const hit = collideCircleBuildings(ped.x, ped.y, 10, G.world.buildings);
    if (hit) { ped.x = hit.x; ped.y = hit.y; pickWalkTarget(G, ped); }
    const cl = clampToWorld(ped.x, ped.y, 40);
    ped.x = cl.x; ped.y = cl.y;

    // Pejalan kaki yang ramah kadang memberi tips saat pemain jalan kaki dekat.
    if (!ped.tipGiven && !p.inCar && dist(ped.x, ped.y, p.x, p.y) < 46 && !ped.fleeing) {
      ped.tipGiven = true;
      ped.line = rng.pick(PED_LINES);
      ped.lineTimer = 3.5;
    }
  }
}

function pickWalkTarget(G, ped) {
  const rng = G.rng;
  // Target: titik di trotoar jalan terdekat, atau titik acak di sekitar.
  const road = nearestRoadPoint(ped.x, ped.y);
  const along = rng.range(-260, 260);
  if (road.vertical) {
    ped.target = {
      x: road.x + (rng.chance(0.5) ? 1 : -1) * (WORLD.roadHalfWidth + WORLD.sidewalk / 2),
      y: Math.max(80, Math.min(WORLD.height - 80, road.y + along)),
    };
  } else {
    ped.target = {
      x: Math.max(80, Math.min(WORLD.width - 80, road.x + along)),
      y: road.y + (rng.chance(0.5) ? 1 : -1) * (WORLD.roadHalfWidth + WORLD.sidewalk / 2),
    };
  }
}
