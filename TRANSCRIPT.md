# TELUK HARAPAN — build transcript (round 3)

Round 3 of the make.fun gta6-01 entry ("Make GTA 6"). Round 1 (5 missions) ranked 660/1,502
(judge 983,796); round 2 (12 missions, 3 days) is in intake. Round 3 goes further: 15 missions,
8 districts, a police helicopter, boats, a deeper economy, and a full boss finale — built to
climb into the paid top 100.

## What was built (all fresh in this session)

- **City** (`game/src/world.js`): seeded 520×520 city, 8 districts, road grid, harbor with
  patrol boats, beach, lighthouse hill; 24 traffic cars that drive the roads and brake for
  cars ahead; 30 pedestrians who flee gunfire; police cars that chase and ram; a helicopter
  that hunts at wanted 4–5; enemies that chase and shoot.
- **Missions** (`game/src/main.js`): 15 missions, 5 per day, data-driven steps — go-to,
  timed delivery, kill counts, chase (ram the target car), escort (defend the truck),
  checkpoint race vs a rival, boat escape across the harbor, and a boss fight with Bang Darto
  at the lighthouse. Day phases change the lighting: sunset → dusk → neon night. Win screen
  after mission 15; "wasted" screen with a hospital fee on death.
- **Systems**: 5 vehicle types (sedan, taxi, truck, motorcycle, speedboat), steal cars (F,
  +1 wanted), 5-star wanted that decays out of sight, 5 side jobs (taxi, courier, debt,
  race, fish delivery), shops (clinic, repair, gun store, safehouse) with upgrades
  (armor, engine, damage), money, localStorage save, synthesized WebAudio (engine, siren,
  gunshots, jingles).
- **Rendering** (`game/src/render.js`): three.js r160 vendored offline; per-phase sun/fog/
  lamps/neon; lighthouse searchlight; HUD (money, day, mission, objective, wanted stars,
  health, ammo, speed) + 2D minimap with player, police, enemies and mission marker.
- **Screenshots** (`game/src/shots.js`): 4 deterministic 1280×720 shots — title over the
  sunset skyline, driving the central avenue, night helicopter chase at 101 km/h, final boss
  fight at the lighthouse. Each verified headlessly with 0 console errors, and a full
  playthrough probe (walk, drive, shoot, steal, wanted, missions 1/4/5/9/12/15, shop, side
  job) passed before submitting.

## Controls

WASD/arrows drive & walk · E enter/exit car · F steal car · Space/click shoot · M start
mission · Q shop (near clinic/repair/gun store/safehouse) · 1–5 buy · P pause.

## Run

`node serve.ts` → http://localhost:8080, or open `game/index.html` in desktop Chrome.
