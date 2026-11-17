// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same seed
// always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const CHASE_SECONDS = 20;
const MISSION_SECONDS = 8;

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/** Yaw that walks toward (tx, tz) from (px, pz): forward is (-sin yaw, -cos yaw). */
function yawToward(px, pz, tx, tz) {
  return Math.atan2(-(tx - px), -(tz - pz));
}

/** Steer the player's yaw toward a heading, a few degrees a step. */
function steerYaw(state, tx, tz) {
  const p = state.player;
  const diff = wrapAngle(yawToward(p.x, p.z, tx, tz) - p.yaw);
  return Math.max(-20, Math.min(20, diff * 30));
}

/** Drive a loop around the city on the roads: steer toward the next corner waypoint. */
function chaseSteer(state, waypoint) {
  const p = state.player;
  const car = state.cars.find((c) => c.id === p.carId);
  if (!car) return 0;
  const desired = Math.atan2(waypoint.x - car.x, waypoint.z - car.z);
  const diff = wrapAngle(desired - car.angle);
  return Math.max(-1, Math.min(1, diff * 1.4));
}

function baseControls() {
  return {
    moveF: 0,
    moveS: 0,
    run: false,
    lookDX: 0,
    lookDY: 0,
    enter: false,
    steal: false,
    punch: false,
    shoot: false,
    weapon: false,
    horn: false,
  };
}

/**
 * Set `world` to the named scene (start, play, chase or mission; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  const { state } = world;
  world.reset();
  if (name !== 'play' && name !== 'chase' && name !== 'mission') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, null, true);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'play') {
    // Raka walks through Pasar Lama toward the first package, on foot.
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      const controls = baseControls();
      const stage = world.currentStage();
      const target = world.missionTarget();
      if (target) {
        controls.lookDX = steerYaw(state, target.x, target.z);
        controls.moveF = 1;
        controls.run = true;
        const d = Math.hypot(target.x - state.player.x, target.z - state.player.z);
        if (d < 4.5) controls.enter = true;
      }
      world.step(STEP, controls, false);
      void stage;
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // Raka in a stolen car, wanted 3, police behind him on the avenue.
    const car = state.cars.find((c) => c.kind === 'parked');
    if (car) {
      car.kind = 'player';
      state.player.onFoot = false;
      state.player.carId = car.id;
      state.player.x = car.x;
      state.player.z = car.z;
      state.player.yaw = car.angle + Math.PI;
      state.camera.yaw = state.player.yaw;
    }
    state.wanted = 3;
    state.lastCrime = state.time;
    const loop = [
      { x: 0, z: -180 },
      { x: 180, z: -180 },
      { x: 180, z: 180 },
      { x: -180, z: 180 },
      { x: -180, z: -180 },
    ];
    let waypoint = 0;
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      const controls = baseControls();
      controls.moveF = 1;
      const car = state.cars.find((c) => c.id === state.player.carId);
      if (car) {
        const target = loop[waypoint % loop.length];
        if (Math.hypot(target.x - car.x, target.z - car.z) < 18) waypoint += 1;
        controls.moveS = chaseSteer(state, loop[waypoint % loop.length]);
      }
      world.step(STEP, controls, false);
    }
    return { screen: SCREEN_PLAY };
  }
  // mission: the final confrontation at the port — Raka, pistol out, Darto's men closing in.
  world.setMission(4);
  state.player.x = -120;
  state.player.z = 198;
  state.player.yaw = yawToward(-120, 198, -120, 180);
  state.player.angle = state.player.yaw;
  state.camera.yaw = state.player.yaw;
  state.weapon = 'pistol';
  state.ammo = 24;
  state.wanted = 2;
  state.lastCrime = state.time;
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
    const controls = baseControls();
    let nearest = null;
    let nearestD = Infinity;
    for (const thug of state.thugs) {
      if (thug.state === 'down') continue;
      const d = Math.hypot(thug.x - state.player.x, thug.z - state.player.z);
      if (d < nearestD) {
        nearestD = d;
        nearest = thug;
      }
    }
    if (nearest) {
      controls.lookDX = steerYaw(state, nearest.x, nearest.z);
      if (nearestD > 2.2) {
        controls.moveF = 1;
        controls.run = true;
      } else {
        controls.punch = true;
      }
    }
    world.step(STEP, controls, false);
  }
  return { screen: SCREEN_PLAY };
}
