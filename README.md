# solmar-heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/robbygmc/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/robbygmc/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMAR HEAT is a 3D open-world crime game set in Solmar, a sun-soaked coastal city at sunset. You are Mara Voss, a getaway driver who owes a debt. Her fixer, Dante Cruz, hands her five jobs — steal the red coupe at the marina, run a package to the Vista Hotel, lose the heat, make a timed run to the harbor, and take the casino van — until the debt is paid.

Explore the city on foot or by car: steal parked and traffic cars, outrun police cruisers, lose a 1–5 star wanted level by hiding, punch and shoot your way out of trouble, and follow the golden beacon to the next job. The HUD carries a live minimap, wanted stars, cash, health, speed and ammo; progress saves to localStorage.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network requests — the game is static files under `game/` (three.js is vendored under `game/vendor/`).

## Controls

| Key | Action |
| --- | --- |
| W A S D | Walk / drive |
| Mouse | Look (pointer lock) |
| Shift | Sprint |
| E | Enter / exit a car, pick up |
| F | Punch |
| Click | Shoot the pistol |
| R | Reload the pistol |
| M | Toggle the music loop |
| Space | Handbrake |
| P / Esc | Pause |

## What is in the game

- **A city:** a 9×9-block procedural Solmar — beach and sea, hotel strip, port containers, park, the Solmar Tower, billboards, palms and lamps, all lit by a low sunset sun with shadows.
- **On foot and by car:** third-person walking with a chase camera, arcade driving with acceleration, braking, steering, collisions, damage smoke and exhaust.
- **Traffic and pedestrians:** cars driving the road grid, pedestrians on the sidewalks who flee when scared.
- **Wanted level 1–5:** crimes raise it; foot cops and police cruisers chase, ram and arrest; it decays when you hide.
- **Missions and story:** five chained jobs with briefings, a golden beacon and a ground ring marking each objective, cash rewards and a story-complete ending.
- **Combat:** punch and a pistol with ammo, muzzle flash, tracers and hit sparks.
- **HUD:** live minimap (roads, player arrow, mission marker, police blips, north), compass to the objective, wanted stars, cash, health, speed and ammo.
- **Save:** cash, mission progress, position, health and ammo persist in localStorage; continue from the title screen.
- **Sound:** WebAudio synth — engine hum, sirens, gunshots, crashes and mission chimes, plus an original synth music loop, "Sunset over Solmar" (M toggles it). No audio files.

## Layout

- `game/index.html` — the page, HUD and screens.
- `game/src/` — one file per system: `city`, `player`, `vehicles`, `police`, `pedestrians`, `missions`, `combat`, `hud`, `audio`, `input`, `save`, `random`, `config`, `shots`.
- `game/vendor/three.module.min.js` — three.js r160, vendored.
- `screenshots/` — four real renders of the game in a browser.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=tv86zvxh&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
