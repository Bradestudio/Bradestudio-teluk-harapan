# TRANSCRIPT — TELUK HARAPAN (round 2 redo)

Built in one recorded agent session for make.fun's "Make GTA 6" bounty (gta6-01).

## What happened
- Studied the competition first: the brief rewards completeness above all — an AI judge
  compares games pairwise by their screenshots and an outline of their source. The live
  leaderboard at build time had 1,216 entries; the top games led with scope (12 missions,
  3 days, helicopters, radio, heists, shops, saves). Our round-1 entry sat at rank 516.
- The previous round-2 build was lost unsealed when the VM restarted, so this session rebuilt
  the round-2 improvements from scratch, from the kit starter only, under a new recording.
- Designed the game from the brief: 12 story missions across 3 days (Senja → Maghrib →
  Malam, lighting changes per day), 7 districts, traffic and pedestrian AI, police with a
  1–5 wanted level, fists + pistol combat, a boss (Bang Darto) with henchmen, side jobs
  (taxi, courier, debt collection, street racing), shops (clinic, ammo, repair), money,
  HUD + minimap, start/pause/game-over/win screens, localStorage saves, and synthesized
  WebAudio sound and music.
- Wrote every game file fresh in this session (config, random, world, render, input, audio,
  shots, main, index.html). Nothing was copied from round 1 or from any earlier build.
  vendor/makefun-game.ts is untouched; three.js r152.2 is vendored under game/vendor/.
- Verified headlessly in the headless shell: title → play, mission progress, entering and
  driving a car, shooting, pausing, and all four deterministic screenshots (?shot=start,
  play, chase, mission with seed 1), viewed one by one. Zero console exceptions.

## Files
- `main.ts` — kit plumbing: copies game/ + screenshots/ to /output and writes dossier.json.
- `game/` — the playable game (index.html + ES modules + vendored three.js).
- `screenshots/` — 4 real renders of the game's own code, 1280×720 each.
- `shots.json` — the four deterministic shot queries.
