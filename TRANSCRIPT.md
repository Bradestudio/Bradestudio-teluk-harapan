# Build transcript — TELUK HARAPAN, round 2 (gta6-01)

Round 2 of the make.fun "Make GTA 6" entry. Round 1 (5 missions, 5 districts) was
submitted 17 Nov 2026 ~23:06 WIB and has no rank yet; round 2 rebuilds the game
fresh, bigger in every direction, aiming for the top 100 (prize $1,666 total,
1st $500; entries close 24 Nov 2026 22:00 WIB).

## Competition study (before writing code)

- `GET /api/competitions/gta6-01` + `/requirements` + `/leaderboard` (475 entries).
- Top entries: #1 althrosways "Neon Harbor — Three Days in Solmaris (12 missions,
  3 days, a city that remembers)", #2 sagor-ahamed "Neon Harbor", #3 ckieking
  "Mirage Palms". The pattern at the top: 12 missions, a 3-day structure, and a
  city that persists. Round 2 matches that scope: 12 missions, 3 days with
  changing light, a save that remembers money / day / progress.
- Judge: AI pairwise comparison of two games via screenshots + source outline;
  completeness matters most. So: a complete, playable arc first, polish second.

## What was built (all code written fresh this session)

- `game/src/config.js` — city, 7 districts, 3-day lighting, 12 missions
  (M1 reach, M2 timed delivery, M3 taxi, M4 fight, M5 race, M6 collect,
  M7 survive-wanted, M8 escort, M9 hold-point, M10 gang fight, M11 getaway
  drive, M12 boss fight vs Bang Darto, HP 200), economy + 5 shops.
- `game/src/world.js` — city grid, per-district buildings, harbour cranes and
  containers, glass tower with window texture, plaza fountain + city hall,
  24 traffic cars, 12 parked cars, 1 taxi, 30 pedestrians, thugs + boss,
  police cars, mission beacons, AABB colliders.
- `game/src/main.js` — fixed-step loop, missions, wanted/police AI, combat,
  side jobs, shops, localStorage save, HUD + minimap, shot mode, debug handle.
- `game/src/render.js`, `input.js`, `audio.js` (WebAudio synth, no audio files),
  `random.js`, `shots.js` — camera, third-person controls, music/SFX, seeded RNG,
  deterministic screenshot scenes.
- `game/vendor/three.min.js` — Three.js r186 UMD, vendored in-session from
  /opt/hatch-image/three/three.min.js (verified `THREE.REVISION: 186`).
- `game/index.html` — title screen, HUD, minimap, end screen.
- `shots.json` — exactly 4 shots, 1280x720, each under 58 KiB.

## Verification (headless Chrome, swiftshader WebGL)

- CDP smoke test (real synthetic keyboard/mouse events): title → play, M1 → M2
  on reaching the target (+$50, $100 → $150), W walks the player, E enters a
  parked car, W drives it (speed ~15), E exits the car, Space/click shoots
  (ammo 24 → 23), P pauses and resumes. 0 console exceptions.
- Bugs found and fixed in-session: `world.update` missing from `createWorld`'s
  return (TypeError every frame); camera placed in front of the player
  (`angle + PI` → `angle`); `initInput` accidentally dropped by a debug-handle
  edit (keyboard dead until restored); E did not enter a parked car and did
  not exit a car (both fixed — E enters empty cars, F steals with +1 wanted).
- All 4 screenshots re-taken with the final code and viewed: title screen over
  the dusk city, M2 delivery on foot with full HUD, M7 police chase at 86 km/h
  with 5 wanted stars, M12 final boss fight at night in the beacon ring.
- `main.ts` dossier: re-run after the final files; size under the 160 KiB cap.
- Kit check: `node cli/makefun.mjs check --kit . --repo <entry>` — 0 failed.

## Notes

- 100% original: no Rockstar/GTA names, characters, music or assets. Kota Teluk
  Harapan, Raka and Bang Darto are fictional.
- `vendor/makefun-game.ts` untouched. No file was read or copied from round 1.
- Not submitted yet — submission happens only after the owner's explicit yes.
