# Research — Rendering, Generative Music, Name Collisions

_Researched 2026-07-19 AEST via web-researcher subagent (GLM-5.2). All browser/engine versions current as of mid-2026. Sources cited inline; unverified items listed at the end._

---

## 1. Browser game rendering (2026 state of the art)

### WebGPU in Chrome

- **Stable & default-on since Chrome 113 (May 2023)** — ChromeOS/macOS/Windows; no flags. (https://developer.chrome.com/blog/webgpu-release)
- 2026 state (caniuse): Chrome full; iOS Safari 26+ full; Android Chrome full; Firefox partial (flag); desktop Safari partial. Linux Chrome depends on GPU/drivers.
- Compute shaders + storage buffers are core since day 1 — the enabler for GPU-compute particles.

### Stack comparison

| Stack                                    | WebGPU maturity                                                                                                                               | Bloom + particles                                                                                                                                                   | Dev velocity                   | Risk                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------- |
| **PixiJS v8** (v8.19.0)                  | Ships WebGPU + WebGL2 auto-detect; **WebGPU backend has ~36 open bugs** (uniform-buffer GC, storage-buffer binding). WebGL2 is battle-tested. | Excellent neon via Filter pipeline (Glow/Blur/custom GLSL, additive blend). Thousands of sprites via ParticleContainer (CPU-sim). **No public compute-shader API.** | **Highest** — purpose-built 2D | Low on WebGL2; med-high on its WebGPU backend |
| **Three.js WebGPURenderer + TSL** (r185) | Active but **high breaking-change cadence** (monthly renames/removals)                                                                        | BloomNode post-fx; TSL compute particles work today. 3D engine — heavier than 2D needs.                                                                             | Medium                         | Medium-high (churn)                           |
| **Babylon.js** (v9.17.0)                 | **GA** — Chrome's own blog cites full support                                                                                                 | Full post-fx + ComputeShader                                                                                                                                        | Medium (3D engine)             | Low-medium                                    |
| **PlayCanvas** (v2.20.6)                 | Shipping WebGPU renderer                                                                                                                      | WebGPU + compute; editor-first SaaS workflow                                                                                                                        | Medium                         | Medium (lock-in, 3D)                          |
| **Raw WebGPU + WGSL**                    | Full power, build everything yourself                                                                                                         | Anything                                                                                                                                                            | Lowest                         | High (cost)                                   |

### GPU-compute particles today (Chrome)

- **Yes:** raw WebGPU, Three.js (TSL), Babylon.js, PlayCanvas
- **No (user-facing API):** PixiJS v8 — would need a separate raw-WebGPU compute pass composited as a texture into the PixiJS scene.

### Recommendation

- **POC (now):** **PixiJS v8 on WebGL2** — fastest 2D neon velocity; thousands of batched sprites + filter-pipeline glow.
- **Parallel spike (≤1 person-week):** raw-WebGPU compute-shader particle prototype (rain/smoke/searchlight cones) rendering to a texture PixiJS composites — de-risk the bleeding-edge win early.
- **Full game (~2027):** PixiJS v8 (WebGL2, or matured WebGPU backend if bugs close) **+ dedicated raw-WebGPU compute particle subsystem**. Re-evaluate at POC end. Avoid raw-only (cost) and 3D engines (churn/overhead) unless going genuinely 3D.

---

## 2. Strudel for in-game generative music

| Question                 | Answer                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical repo           | codeberg.org/uzu/strudel (GitHub tidalcycles/strudel mirror archived)                                                                                                  |
| **License**              | **AGPL v3**. README: _"Strudel code can only be shared within free/open source projects under the same license."_ No commercial/dual-license offered.                  |
| Embeddable as library?   | Yes (`@strudel/core`, `@strudel/web`) but AGPL-bound. `@strudel/embed` is just an iframe of the REPL.                                                                  |
| Patterns as static data? | Yes (mini-notation strings) — but the transpiler uses `Function`-constructor eval → requires `unsafe-eval` in CSP. Avoidable via programmatic API; AGPL still applies. |

**Verdict: non-starter for a proprietary game.** AGPL network-copyleft means web players are entitled to the corresponding source of the whole work. Alternatives:

| Option            | License | Fit                                                                    |
| ----------------- | ------- | ---------------------------------------------------------------------- |
| **Tone.js** (v15) | **MIT** | Strong — scheduler, synths, effects; author patterns as static JS/JSON |
| Raw Web Audio     | CC0     | Zero deps, hand-rolled lookahead scheduler, max control                |

**Plan:** Tone.js + a small hand-rolled pattern engine (cycles, `cat`/`stack`/`seq`, polymeters — a few hundred lines) for Strudel-flavored generative music without AGPL exposure.

---

## 3. Name collisions

| Candidate                    | Steam                                                                                            | itch.io                                                 | Verdict                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Midnight Protocol**        | **Exact match** — LuGus Studios / Iceberg Interactive, Oct 2021, franchise bundle exists         | 2 others                                                | **DO NOT USE** (title). Trademark-likely.                                                 |
| **Nightshift / Night Shift** | **Extremely crowded** — ≥5 exact "Night Shift" incl. LucasArts 1990, multiple exact "Nightshift" | 25+                                                     | **DO NOT USE** (title). Un-ownable. "Shift" as in-game vocabulary is fine (generic word). |
| **Phosphor**                 | **No exact match** — slot open                                                                   | Several exact matches + dormant "Phosphor Games" studio | **Most viable** — use with distinctive subtitle + trademark search before committing.     |

---

## Unverified / gaps

- PixiJS auto-detect WebGPU-vs-WebGL2 preference (docs client-rendered) — confirm against API docs before POC.
- WGSL subgroups ship status — don't bank particle perf on them.
- Chrome 2025-26 granular WebGPU feature landings (HDR bloom blends, dual-source blending) unconfirmed.
- Strudel scheduler internals (docs client-rendered); license findings (the blocking ones) fully confirmed.
- "Phosphor" trademark status — no USPTO/EUIPO search run; Steam/itch/web only. Run a trademark pass before committing.
