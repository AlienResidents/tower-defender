# PHOSPHOR — Design Spec

_Working title — trademark pass outstanding (see §14). Status: **APPROVED 2026-07-19** — ready for implementation plan._

## 1. Overview

A neon-drenched sci-fi tower defense game for the browser (Chrome-first). Blade Runner's rain-slicked megacity meets Cowboy Bebop's session structure and space-western loneliness. All art, maps, enemies, and music are original to this game — nothing borrowed. Browser build is potentially **the** game, not a throwaway prototype.

**Signature mechanic:** the economy is _dice_. Towers and upgrades are bought with polyhedral dice, rolled on purchase, consumed, no change given.

## 2. Fiction & Naming

- You are **PHOSPHOR**, a megacorp's automated defense-grid AI, repelling rival corps' mech raids on your data-cores.
- Levels are **shifts** (Bebop's "sessions"). Title cards render as system logs (`SHIFT 03 :: INITIALIZE`).
- Difficulty tiers: **STANDBY → PATROL → REDLINE → MIDNIGHT DIRECTIVE** ("Midnight Protocol" avoided — existing 2021 game; see research doc).
- Title: **PHOSPHOR** (confirmed). Subtitle (working): **Graveyard Shift**. Steam slot open; trademark search still required before public use.

## 3. Influences (confirmed)

- **Blade Runner:** rain-slicked streets, dense neon signage + holographic ads, volumetric smoke + searchlights.
- **Cowboy Bebop:** title-card typography, session-structured levels, space-western loneliness.
- **Rifts (Palladium):** combat mechanics inspiration — see §9. Mechanics homage only; zero Palladium names, lore, or art.

## 4. Technical Direction

- **POC:** TypeScript + **PixiJS v8 on WebGL2**. Neon via filter pipeline (glow/blur/custom GLSL, additive blending); thousands of batched sprites.
- **Parallel spike (≤1 person-week):** raw **WebGPU compute-shader particles** (rain, volumetric smoke, searchlight cones) rendered to a texture composited into the PixiJS scene.
- **Full game:** PixiJS (WebGL2, or matured WebGPU backend) + dedicated WebGPU compute particle subsystem. Re-evaluate at POC end.
- Avoid: 3D engines (churn/overhead for 2D), raw-WebGPU-only (cost), Unreal/Unity (wrong tool for 2D web).
- Full rationale: `docs/research/2026-07-19-rendering-audio-naming.md`.

## 5. Art Direction

- **100% procedural/vector** — everything drawn in code (Geometry-Wars-style neon). Original by construction; glow, trails, and particles are easier procedurally than hand-drawn.
- No borrowed assets, no AI-generated sprites in the shipped look.
- Title-card typography is a first-class feature (Bebop homage) — open-license fonts only, stored in Google Drive (see §13).

## 6. Audio

- **Engine:** Tone.js (MIT) + small hand-rolled pattern engine (cycles, `cat`/`stack`/`seq`, polymeters — few hundred lines). Strudel rejected: AGPL v3, no commercial path, `unsafe-eval` CSP friction.
- **Style:** moody **synth-ambient**, generative via Tone.js patterns. **Boss encounters shift the mix bass-heavy** — music reacts to game state.
- SFX: synthesized via Web Audio.

## 7. Core Systems

| System        | Decision                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------- |
| Pathing       | POC: fixed paths. Full game: hybrid (some open-field mazing maps)                           |
| Time controls | Tactical pause (issue orders while frozen); 1x / 2x / 4x                                    |
| Difficulty    | 4 tiers × per-wave scaling curve. Tier names per §2                                         |
| Saves         | One-shot shifts — death = restart shift. Meta progression persists.                         |
| Lives         | **Data-cores** — leaked enemies destroy cores scaled by size; a boss leak takes most/all    |
| Build phase   | Build anytime; tactical pause covers planning                                               |
| Meta          | Roguelite: post-shift **choice of 1 of N** unlocks (tower / attribute branch / enemy intel) |

## 8. Economy — the dice system

**In-level currency: dice.** Polyhedral set d3→d100. Towers and tower upgrades are bought with dice.

- **Gamble-purchase (manual only, no auto-pay):** you get **3 chances** per purchase (meta upgrades add more). Commit dice per chance; rolls accumulate across chances until the running total ≥ price. On success, **all committed dice are consumed**. On final failure (or abandon), committed dice convert to **salvage** at a fraction (~20%) of their palladium investment — the house edge.
- **No change given. Prices** are multiples of 3, 6, 8, 10 — texture, not safety: **all dice are a gamble**, no exact-cover breakpoints.
- **Value structure:** low-sided dice = higher total EV + low variance (3d100 avg 151.5 vs 100d3 avg 200 — verified by simulation, `scripts/roll-simulator.bash`); high-sided = swingy high-rolls. Matching die size to price is the core skill.
- **Dice are scarce and expensive.** Starting tray: 2–3 × d100 (the corp's black budget for the shift).

**Drops (Diablo-style):** kills drop **item upgrades** (rarity tiers, random affixes) and **palladium**. POC scope: run-scoped drops (elite kill → pick 1 of 3); full game: persistent stash + tower item slots.

**Meta progression:**

- **Salvage** — consolation from failed gambles (and trash drops); refines to palladium.
- **Palladium** — the master meta-resource (drops from kills + salvage refinement). Spent on:
  - **Dice slots** (tray capacity)
  - **Dice recharges** — ratio table: d100 1:1 (100 Pd), d20 5:1 (100), d12 9:1 (108), d10 12:1 (120), d8 16:1 (128), d6 22:1 (132), d3 45:1 (135). Flat-ish cost with a low-die premium — the EV inversion encoded as price. **Upgrades reduce ratios** (e.g. d3 45:1 → 40:1).
  - **Extra purchase chances**
  - **Technology** (attribute grid, §8 below) and **credits** (below)
- **Attribute grid:** persistent per-tower-archetype (damage / fire rate / range / crit% / crit dmg / status potency). Exponential cost (~×1.35/rank), soft cap ~20, **free respec**.

**Credits & stores (Rifts-inspired structure, original names):** palladium trades into three credit types, each spendable only at its store:

| Credit                                                                                                 | Store archetype                         | Notes                   |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------- | ----------------------- |
| **CSC — Corporate Standard Credits**                                                                   | Corporate Depot (official gear)         | universal-standard riff |
| **FOUNDRY Credits**                                                                                    | Foundry Exchange (mil-surp / high-tech) | mercantile riff         |
| **Black Market / GHOST Credits**                                                                       | The Black Market (exotic, untraceable)  | underworld riff         |
| _(Confirmed names — CS/NGMI are Palladium IP, not usable.)_ Exchange: **flat rate** palladium→credits. |

## 9. Combat — Rifts-derived (mechanics homage, original expression)

- **Two-tier damage:** _street-class_ vs _mega-class_ (Rifts SDC/MDC). Street weapons do ~1% to mega plating — cheap towers handle trash waves; mega weapons (rail guns, particle beams) gate heavy mechs.
- **Damage types:** kinetic / energy / explosive vs hull / shields / armor — light, readable, no hidden math.
- Roster flavor homages (original names/visuals): rail guns, particle beams, plasma, ion, mini-missiles; skelebot-style infantry, flight power-armor-style air units, heavy walker mechs, repair bots, anchored siege-platform bosses.

## 10. Towers

POC roster 4–6 from: **Railgun** (pierce, mega kinetic) / **Pulse Laser** (ramping beam) / **Missile Pod** (homing splash) / **Tesla ARC** (chain, shield-strip) / **Disruptor** (AoE slow) / **Nanite Hive** (armor-eating DoT) / **Flak Battery** (anti-air).
Dual progression: in-level upgrades (dice) + persistent attribute grid (palladium).

## 11. Enemies

Mechanical only. Candidate roster: **Swarm Drones** (air, fast, fragile) / **Walker Mechs** (baseline) / **Siege Mechs** (slow, mega-plated) / **Aegis Units** (energy shields) / **Repair Spiders** (heal allies — priority target) / **Cloaked Infiltrators** (need detection).
Enemies **never attack towers**. One boss per shift ("villain of the week"); bosses are DPS-check/rhythm encounters, not tower-killers.

## 12. Campaign Structure

- POC: 1 shift, ~15 waves, 4–6 towers, 4–6 enemy types, run-scoped item drops — vertical slice proving the _look_.
- Full game: **12 shifts** (launch), boss each, escalating biomes.
- Map-unique mechanics (all confirmed): rain density cuts tower range / searchlight zones reveal cloaked / hackable neon signs = buff nodes / elevated skyway lanes.

## 13. Asset Storage & Repo Policy

- **Git: source + docs only.** Assets (fonts, concept refs, audio exports) live in **Google Drive**, synced into gitignored `assets/` via script. Never committed.

## 14. Spec Complete — Outstanding Action Items

All interview questions resolved 2026-07-19. Carried into the plan phase:

1. **Trademark search** on "Phosphor" (USPTO/EUIPO) before any public use; subtitle _Graveyard Shift_ is the working differentiator.
2. **Balance numbers** — starting tray, prices, drop rates, refine rates, ratio-upgrade curve: TBD in plan/balancing passes.
3. **POC scope lock:** 1 shift / ~15 waves / 4–6 towers / 4–6 enemy types / run-scoped item drops / tactical pause + 1x-2x-4x / data-core lives / meta persistence shell. Credit stores & persistent stash are full-game systems.
