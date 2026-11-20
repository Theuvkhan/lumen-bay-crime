# LUMEN BAY

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/reward.svg)](https://make.fun/bounty/gta6-01)

An original **open-world crime game** set in **Lumen Bay**, a neon-dusk coastal city. Steal cars,
outrun the Bay Patrol, run heists for the Vesper syndicate and explore five districts from the
palm-lined heights to the harbour cranes — all in the browser, offline, on a vendored three.js.

## Play

Serve the `game/` folder and open it in desktop Chrome:

```bash
node serve.ts          # http://localhost:8080
```

## Controls

| Input | Action |
|-------|--------|
| `W A S D` | Move (on foot) / throttle + steer (driving) |
| Mouse | Look / chase camera |
| `Shift` | Sprint |
| `E` | Enter / exit / carjack a vehicle |
| `Space` | Handbrake (driving) |
| `1`–`4` | Missions list |
| `M` | Toggle missions panel |
| `P` / `Esc` | Pause |
| `F` | Toggle mute |

## The city

Five districts across a 520 m grid: **Vesper Heights** (palm-lined mid-rise in the north-west),
**Downtown Lumen** (tall neon towers around Lumen Tower), **Mirage Row** (the south strip, all
neon and signs), **Old Harbour** (warehouses and container cranes on the bay) and the **Bay
waterfront** with the Orbit ferris wheel. Roads, intersections, crosswalks, alleys and a readable
chase camera throughout.

## Systems

- **On foot** — WASD + mouse look, sprint, collision against every building.
- **Vehicles** — compacts, sedans, sports cars, trucks and Bay Patrol cruisers; enter/exit/carjack
  with `E`; arcade handling with acceleration, braking, steering, handbrake and collisions; a
  vehicle HUD with speed, name and condition.
- **Traffic & pedestrians** — lane-following AI traffic and sidewalk pedestrians that scatter when
  crime breaks out nearby.
- **Missions** — three connected original missions with markers, objective text, completion
  feedback and cash rewards.
- **Wanted / Bay Patrol** — a five-star heat system; cruisers pursue, escalate and can be evaded.
- **HUD** — rotating minimap, health, money, wanted stars, objective banner, vehicle panel,
  notifications and a missions panel.
- **Persistence** — save / continue to `localStorage`, pause, game over and restart.
- **Audio** — procedural WebAudio engine, siren, gunfire, pickups and a synth music bed (no audio
  files).

## Screenshots

Real Chrome captures of the game, staged deterministically through `?shot=…&seed=N`
(see `game/src/shots.js`), live in `screenshots/`.

## Build & hand-in

`main.ts` at the repo root copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored `vendor/makefun-game.ts`. Verify with:

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
