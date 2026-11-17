// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot, so the
// frame is what real play looks like and the same seed always gives the same frame.
import { STEP } from './config.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const CHASE_SECONDS = 18;
const MISSION_SECONDS = 12;

function angleTo(x1, z1, x2, z2) { return Math.atan2(z2 - z1, x2 - x1); }
function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

// Steer toward a target: returns the input for one step (on foot, running).
function driveInput(world, tx, tz, driving) {
  const p = world.state.player;
  const want = angleTo(p.x, p.z, tx, tz);
  const d = angDiff(p.angle, want);
  const input = { up: true, down: false, left: false, right: false, run: !driving, enter: false, punch: false, shoot: false, buy: false };
  if (d > 0.12) input.left = true;
  else if (d < -0.12) input.right = true;
  return input;
}

function idleInput() {
  return { up: false, down: false, left: false, right: false, run: false, enter: false, punch: false, shoot: false, buy: false };
}

export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'chase' && name !== 'mission') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, idleInput());
    return { screen: 'title' };
  }
  if (name === 'play') {
    world.setMission(1); // M2 Antar Paket
    world.teleport(-192, 60, -Math.PI / 2, null);
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      const m = state.mission;
      const t = m.target;
      const input = t ? driveInput(world, t.x, t.z, false) : idleInput();
      world.step(STEP, input);
      if (state.over || state.won) break;
    }
    return { screen: 'play' };
  }
  if (name === 'chase') {
    world.setMission(6); // M7 Kejar-kejaran (wanted 3)
    const parked = state.cars.find((c) => c.kind === 'parked');
    if (parked) world.teleport(parked.x, parked.z, 0, parked.id);
    world.forceWanted(5);
    const loop = [[-192, -192], [178, -192], [178, 178], [-192, 178]];
    let wp = 0;
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      const p = state.player;
      const [tx, tz] = loop[wp];
      if (Math.hypot(p.x - tx, p.z - tz) < 12) wp = (wp + 1) % loop.length;
      world.step(STEP, driveInput(world, loop[wp][0], loop[wp][1], true));
      if (state.over || state.won) break;
    }
    return { screen: 'play' };
  }
  // mission: M12 final vs Bang Darto, at night.
  world.setMission(11);
  world.teleport(-170, -44, 0, null);
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
    const p = state.player;
    let target = null;
    let best = 1e9;
    for (const t of state.thugs) {
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < best) { best = d; target = t; }
    }
    let input;
    if (target) {
      input = driveInput(world, target.x, target.z, false);
      if (best < 42) {
        // Face the thug and shoot.
        const want = angleTo(p.x, p.z, target.x, target.z);
        const d = angDiff(p.angle, want);
        input.left = d > 0.08;
        input.right = d < -0.08;
        input.shoot = Math.abs(d) < 0.3;
        input.up = best > 12;
      }
    } else input = idleInput();
    world.step(STEP, input);
    if (state.over || state.won) break;
  }
  // A fixed camera on the street looking west at the fight, so the frame is composed
  // instead of depending on where the third-person camera ends up mid-combat.
  return { screen: 'play', camera: { x: -150, y: 9, z: -44, tx: -185, ty: 2, tz: -44 } };
}
