# Tower Defender — Knowledge Bundle

**Status 2026-08-28:** POC complete (m0–m4). Multi-operator local profiles shipped (`src/game/profiles.ts`; per-profile saves keyed `phosphor.meta.v1.p_<id>`, registry `phosphor.profiles.v1`; legacy single-save adopted into OPERATOR-01). `activeMetaKey()` in profiles.ts is the seam for a future server backend.

**OKF v0.1 Knowledge Bundle** for the tower-defender game project.
Covers the design spec, implementation plan, asset pipeline, and POC architecture as they land.

## Sections

### Design

- [Design Spec](../docs/design-spec.md) — PHOSPHOR: vision, systems, dice economy, Rifts-derived combat (DRAFT)

### Planning

- [Implementation Plan](../docs/implementation-plan.md) — POC milestones M0–M4, architecture, risks (APPROVED; COMPLETE)

### Research

- [Rendering / Audio / Naming](../docs/research/2026-07-19-rendering-audio-naming.md) — PixiJS-WebGL2 + WebGPU particles, Strudel-AGPL rejection, name collisions

### Reference

- [README](../README.md) — vision, repo policy (source+docs only; assets in Google storage)
