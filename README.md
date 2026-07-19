# tower-defender

A neon-drenched sci-fi tower defense game — Blade Runner's rain-slicked megacity crossed with Cowboy Bebop's cool. Original art, original maps, mechanical enemies (robots, mechs, drones), futuristic weapons.

**Status:** POC planned. Design spec + implementation plan approved — see `docs/`. Build not started.

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
- `src/` — POC source (coming soon)
- `assets/` — gitignored; populated by sync from Google storage
