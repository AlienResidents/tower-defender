# PHOSPHOR — Implementation Plan (POC)

_Implements `docs/design-spec.md` (APPROVED 2026-07-19). Status: APPROVED 2026-07-19._

## 1. Objective

Ship a Chrome POC that proves two things, in this order:

1. **The look** — rain-slicked neon megacity, volumetric smoke, searchlights, title-card typography (M1 look-lock gate).
2. **The loop** — a complete vertical slice: 1 shift, ~15 waves, 4–6 towers, 4–6 enemy types, dice-gamble economy, boss, run-scoped item drops, meta shell.

## 2. Execution Model

- **Builder:** Fulmar (agent-led). **Reviewer/director:** Chrispy — sign-off at each milestone gate; M1 (look-lock) is the hard gate.
- **Post-POC:** parallel subagent builds for isolated subsystems (audio engine, dice UI, WebGPU particles) with integration checkpoints.
- **Repo:** push direct to `main`, no PR ceremony. Commit early/often; milestone tags (`m0`…`m4`).
- **Tracking:** GitHub Issues (no JIRA). One issue per milestone workstream, referencing this plan.
- **Assets:** Google Drive only, synced to gitignored `assets/`. Git = source + docs. First real assets: open-license fonts for title cards.

## 3. Milestones

| #       | Name                | Deliverable                                                                                                                                             | Exit criteria                                                             |
| ------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **M0**  | Scaffold            | Vite + TS + PixiJS v8 + pnpm; ESLint/Prettier; Vitest; `pnpm dev` boots a neon-black canvas                                                             | Dev server runs; CI-less (POC); seeded RNG + fixed-timestep loop in place |
| **M1**  | **Beauty spike**    | One static map: neon signage/holo ads, rain, volumetric smoke, searchlight cones, ambient audio bed; enemies gliding a path (no gameplay)               | **LOOK LOCK — Chrispy sign-off**                                          |
| **M2**  | Core loop greybox   | Fixed path, wave spawner, tower placement/targeting/projectiles, data-core lives, win/lose, tactical pause + 1x/2x/4x                                   | 15 waves playable start→finish, ugly                                      |
| **M2a** | Dice economy        | Dice tray (2D physics), gamble-purchase (3 chances, accumulation, salvage conversion), prices from data, dice sounds                                    | Full purchase flows incl. bust→salvage; unit-tested math                  |
| **M3**  | Vertical slice      | M1 art × M2 loop merged; 4–6 towers, 4–6 enemies (incl. boss), 15-wave table, elite-kill item drops (pick 1 of 3)                                       | Shift 01 beatable; boss bass-shift music live                             |
| **M4**  | Polish + meta shell | Title cards (system-log style), Tone.js generative ambient, SFX pass, localStorage saves, palladium/salvage ledger, attribute grid UI (functional-ugly) | Meta persists across browser restarts; POC done                           |

**WebGPU compute-particle spike** (spec §4): runs **inside M1**, hard timebox (≤1 person-week). Fallback: PixiJS-native particles ship M1; compute path revisited at POC end.

## 4. Stack & Scaffold

- **TypeScript + Vite + PixiJS v8 (WebGL2 renderer, explicit — not WebGPU auto-detect)** + pnpm.
- ESLint + Prettier; Vitest for unit tests. No CI in POC (local `pnpm test` / `pnpm build` gates).
- Physics for dice tray: planck.js (2D). Audio: Tone.js + minimal hand-rolled pattern engine (cycles, `seq`/`stack`/`cat` — capped DSL, no mini-notation eval).
- Seeded RNG (mulberry32 or similar) threaded through **all** rolls — runs are reproducible; seed shown in UI for bug reports.

## 5. Architecture

Plain structured game objects + scene graph (no ECS for POC; refactor only if profiling demands). **All content data-driven from day one** — towers, enemies, waves, prices, attribute grid defined as TS data modules in `src/data/`, never hardcoded in logic.

```
src/
  main.ts            # boot, renderer (explicit WebGL2), main loop
  core/              # seeded RNG, fixed-timestep clock + time controls (pause/1x/2x/4x), event bus, save/load (localStorage)
  data/              # towers, enemies, waves, prices, attributes, items — pure data modules
  game/              # run state, fixed path, spawner, targeting, combat (street/mega tiers), lives, items
  dice/              # tray + planck.js physics, gamble-purchase state machine, dice sounds
  render/            # Pixi stage, layers, glow/filter pipeline, particle bridge
  fx/                # WebGPU compute particles (rain/smoke/searchlights) → texture composite (M1 spike)
  audio/             # Tone.js engine, pattern DSL, synth SFX, mixer (boss bass-shift hook)
  ui/                # HUD, shop, title cards, /lab balance page
  meta/              # salvage/palladium ledger, attribute grid, unlock choices
tests/               # vitest: dice math, damage tiers, economy state machine, save schema
```

## 6. Signature Systems Build Notes

**Dice tray & gamble-purchase** (spec §8):

- planck.js tray; dice tumble physically on commit. **Sound mapping: fewer sides → higher pitch; more sides → heavier/lower impact** (d3 = glassy tick, d100 = deep thunk). Pitch/weight derive from side count, data-driven.
- State machine: `idle → committing(chance n/3) → rolling → resolved(success|short) → success|bust→salvage(~20%)`. Manual commit only. Accumulation across chances; all committed dice consumed on success.
- Unit tests cover: accumulation, bust→salvage conversion, price validation (multiples of 3/6/8/10), EV invariants (3dN vs Nd3), ratio table (d100 1:1 … d3 45:1).

**Combat:** street/mega two-tier damage (~1% cross-penetration) + light typing (kinetic/energy/explosive vs hull/shields/armor). Enemies never attack towers. Boss = DPS-check rhythm encounter + bass-heavy music shift (mixer hook in M3).

**Meta:** localStorage save schema v1: `{ seed, ledger: {salvage, palladium, credits:{csc,foundry,ghost}}, attributes: per-archetype ranks, unlocks, shifts cleared }`. Free respec. Save-versioned for migration.

## 7. Validation

- **Unit tests** (Vitest): dice/economy/damage/save logic — pure functions, seeded.
- **`/lab` balance page:** live dice-economy simulator against real price tables + drop curves (supersedes `scripts/roll-simulator.bash`).
- **Playtest:** local `pnpm dev`; Chrispy gate-reviews each milestone build in Chrome.
- **Post-POC:** Playwright e2e (boot, place tower, complete wave).

## 8. Risks & Fallbacks

| Risk                                                 | Fallback                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| WebGPU compute-in-PixiJS compositing fights us (M1)  | PixiJS-native particles ship M1; compute revisited at POC end     |
| Physics dice edge cases (escape tray, 4x-speed perf) | Stylized tweened rolls (documented fallback, spec-safe)           |
| Tone.js pattern-engine scope creep                   | DSL capped: note/rest/cycles + `seq`/`stack`/`cat`; no eval       |
| Beauty spike subjectivity                            | M1 gate = Chrispy sign-off; iterate until lock, no artificial cap |
| Scope creep (stores, stash, hybrid pathing)          | POC scope lock (spec §14); full-game systems stay out             |

## 9. Post-POC Outlook (re-evaluation checklist)

- PixiJS WebGPU backend maturity re-check → renderer switch decision
- TypeScript 7.x adoption once typescript-eslint supports it (pinned to 5.9.3 — typescript-eslint 8.64.0 requires `typescript <6.1.0`)
- Playwright e2e suite; subagent parallel-build model (audio / dice UI / particles)
- Full-game systems: credit stores, persistent item stash, hybrid mazing maps, 12-shift campaign content
- Trademark pass on "Phosphor" before anything public
