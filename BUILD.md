# LUMEN BAY — build brief (make.fun gta6-01)

This file is the handoff brief for the **witnessed build session**. Setup below is already done;
do not redo it. Do all game code inside this repo.

## Already done — do not redo
- make.fun account connected as **@theuvkhan**. Recording `01a1f9bd-2ac9-718e-9313-8d6be153b3aa`
  is RUNNING in the background, watching this repo. NEVER stop/kill/restart it. Never run `makefun record`.
- Keypair: `C:\Users\acer\Desktop\makefun-keypair.json` (private, never print).
- Kit: `C:\Users\acer\Desktop\gta6-kit\gta6-01-kit` (CLI `cli/makefun.mjs`). Run `submit` from inside it.
- GitHub repo created: `https://github.com/Theuvkhan/lumen-bay-crime` (origin here, branch `main`, no commits yet).
- Git token: username `Theuvkhan`, scopes `gist,repo,workflow` (get via `git credential fill`).
- Present in repo:
  - `game/vendor/three.min.js` — three.js r158, **classic global script** → `window.THREE`. Load with a plain
    `<script src="./vendor/three.min.js"></script>`. No import maps, no ES import for three.
  - `vendor/makefun-game.ts` — official dossier lib. Import in `main.ts` as `./vendor/makefun-game.ts`.
  - `serve.ts` — static server, `node serve.ts` serves `game/` on :8080.
  - `LICENSE` — MIT with SPDX header. `.makefun/owner.json` — wallet `NLAwfiUCRWfXboWDQaktgHvS7Dm9yoVvt6TBZ9hzeVD`.
  - `screenshots/` — empty, you fill it.
- `main.ts` does NOT exist yet — you write it.

## main.ts (plumbing)
Reproduce the starter's `C:\Users\acer\Desktop\gta6-kit\gta6-01-kit\starter\main.ts` behavior at repo root:
copy `game/` and `screenshots/` to `$MAKEFUN_OUTPUT_DIR` (else `/output`) and write `dossier.json`
via `buildDossier` with caps `text_max_bytes:163840, screenshots:{max:4,max_bytes:262144},
game_max_files:993, game_max_bytes:50331648, game_path_max_bytes:1000`.
Grading runs `node /bot/main.ts` headless in **10s, no network** → stdlib-only and fast (just copies + dossier).

## Game — "LUMEN BAY"
Original open-world crime game. Fictional neon-dusk coastal city. **No GTA/Rockstar names or assets, no competitor
content.** All original: city Lumen Bay, districts, characters, vehicles, factions, mission text, UI, sounds.
Offline only — NO network requests at runtime. three.js is a global script.

Prioritize a polished playable loop and **strong screenshots** — an AI judge compares screenshot pairs, and
leaderboard scores cluster 992k–994k, so screenshot quality decides rank.
1. Title/start: original logo, New Game, controls help, graceful load.
2. Open world: roads, intersections, distinct districts, landmarks, alleys, strong lighting/fog/neon/signs. Clear walkway vs road. Readable chase camera.
3. On-foot WASD, mouse camera, collision, sprint.
4. Vehicles: multiple types, enter/exit (E), accel/brake/steer/collision, vehicle HUD (speed/name/condition), carjacking, distributed around city.
5. Pedestrians + traffic, believable motion, react to crime.
6. Missions: list, ≥3 connected original missions, markers, objective text, completion feedback, rewards.
7. Police/wanted: stars, escalation, pursuit, evade.
8. HUD: minimap, health, money, wanted stars, objective, vehicle info.
9. Save/continue (localStorage), pause, game over/restart.
10. Procedural WebAudio SFX + music (no audio files).
11. Steady framerate, resize handling.

## Screenshots — critical
3–4 JPEG in `screenshots/` (first by name = cover). **Real Chrome captures** using the `?shot=start|play|end&seed=N`
deterministic autopilot pattern — study the starter `game/src/shots.js` + `shots.json`. Stage rich scenes (dusk neon
skyline, car chase, mission moment). Each under 256 KiB. Serve with `node serve.ts`, capture with Chrome at
`C:\Program Files\Google\Chrome\Application\chrome.exe` (`--headless=new --screenshot`).

## Repo checks before submit
- `main.ts` at root. LICENSE MIT. `.makefun/owner.json`.
- `README.md` at root with THREE live badges (no shields.io, no `{owner}`):
  `[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)`
  `[![rank](https://make.fun/badge/rank.svg)](https://make.fun/bounty/gta6-01)`
  `[![reward](https://make.fun/badge/reward.svg)](https://make.fun/bounty/gta6-01)`
- GitHub About: website = `https://make.fun/bounty/gta6-01`, topic includes `makefun` (+`ai-agents`,`bounties`).
- `game/` under caps. Verify: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.
- Commit all to main, get full 40-char SHA, push to origin main.

## Submit (only after all above passes), from kit dir
`node cli/makefun.mjs submit --competition gta6-01 --recording 01a1f9bd-2ac9-718e-9313-8d6be153b3aa --repo-url https://github.com/Theuvkhan/lumen-bay-crime --commit <FULL_SHA> --title "LUMEN BAY: neon-dusk open-world crime — districts, driving, heists and a Bay Patrol heat system" --keypair C:/Users/acer/Desktop/makefun-keypair.json --repo C:/Users/acer/Desktop/gta6-entry`
Then poll status until a stage. Record submission id.

Never print/commit keys, seed phrases, the af_ key, credentials, .env. Keypair/credentials are outside the repo.
Deadline 2026-11-24T15:00Z. Do not claim first place or completed scoring unless official status confirms.
