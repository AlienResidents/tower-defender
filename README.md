# tower-defender

A neon-drenched sci-fi tower defense game — Blade Runner's rain-slicked megacity crossed with Cowboy Bebop's cool. Original art, original maps, mechanical enemies (robots, mechs, drones), futuristic weapons.

**Status:** POC complete (tags `m0`–`m4`): 15-wave shift, dice economy, meta shell. Multi-operator local profiles (create/switch/delete in the meta screen's PROFILES tab); per-profile saves in localStorage, legacy single-save auto-adopted. Next: post-POC re-evaluation + full-game systems (issue #8).

## Vision

- **Absolutely beautiful** — neon, rain, glow, style-first presentation
- **Browser POC first** (Chrome), full engine build TBD later
- **100% original art and maps** — nothing borrowed from other games
- Time controls (pause, speed-up), difficulty scaling, saves, per-level checkpoints

## Repository policy

- **Git holds source code and docs only.** Game assets (images, textures, audio, models) are stored in Google storage and must never be committed — asset directories are gitignored.
- Asset store location: TBD (Drive vs GCS — see design spec)

## Structure

- `docs/` — design spec, implementation plans
- `okf/` — knowledge bundle index
- `src/` — game source (PixiJS v8 / WebGL2)
- `assets/` — gitignored; populated by sync from Google storage
