import type { Rng } from '../core/rng';
import { NEON_SIGN_COLORS } from '../data/palette';
import { Path } from './path';

/**
 * City layout — pure data, fully deterministic from the seeded RNG.
 * View construction (PixiJS) consumes this; tests verify invariants.
 */

export interface BuildingSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pseudo-3D extrusion height for the oblique top face. */
  depth: number;
  litRatio: number;
}

export interface SignSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: number;
  vertical: boolean;
}

export interface HoloSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
}

export interface VentSpec {
  x: number;
  y: number;
}

export interface CityLayout {
  width: number;
  height: number;
  streetWidth: number;
  path: Path;
  buildings: BuildingSpec[];
  signs: SignSpec[];
  holos: HoloSpec[];
  vents: VentSpec[];
}

export const SIGN_WORDS = [
  'RAMEN',
  'DATA-CORE',
  'PALLADIUM',
  'DICE',
  'NOODLE BAR',
  'SYNTH',
  'MECH REPAIR',
  'GHOST',
  'DOCK 9',
  'AUGMENT',
  'HOTEL',
  'BAR',
] as const;

export function computeCityLayout(rng: Rng, width: number, height: number): CityLayout {
  const streetWidth = 84;

  // Street: a lazy S across the map — enters left, dips, exits right.
  const path = new Path([
    { x: -40, y: height * 0.62 },
    { x: width * 0.3, y: height * 0.62 },
    { x: width * 0.42, y: height * 0.74 },
    { x: width * 0.66, y: height * 0.74 },
    { x: width * 0.76, y: height * 0.6 },
    { x: width + 40, y: height * 0.6 },
  ]);

  // Buildings on a jittered grid, rejection-sampled away from the street.
  const buildings: BuildingSpec[] = [];
  const clearance = streetWidth * 0.5 + 14;
  const cols = Math.max(3, Math.floor(width / 210));
  const rows = Math.max(2, Math.floor(height / 190));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (rng.next() < 0.18) continue; // empty lots keep the skyline irregular
      const w = rng.range(110, 210);
      const h = rng.range(60, 130);
      const depth = rng.range(16, 42);
      const cellW = width / cols;
      const cellH = height / rows;
      const x = col * cellW + rng.range(4, Math.max(8, cellW - w - 8));
      const y = row * cellH + rng.range(4, Math.max(8, cellH - h - 8)) + depth;
      const cx = x + w / 2;
      const cy = y + h / 2;
      if (path.closestPoint({ x: cx, y: cy }).distance < clearance + Math.max(w, h) * 0.5) {
        continue; // too close to the street — keep the canyon open
      }
      buildings.push({ x, y, w, h, depth, litRatio: rng.range(0.2, 0.45) });
    }
  }

  // Signs on the buildings nearest the street (max 9).
  const streetSorted = [...buildings]
    .map((b) => ({
      b,
      d: path.closestPoint({ x: b.x + b.w / 2, y: b.y + b.h / 2 }).distance,
    }))
    .sort((a, b2) => a.d - b2.d);
  const signs: SignSpec[] = [];
  for (const { b } of streetSorted.slice(0, 9)) {
    const text = rng.pick(SIGN_WORDS);
    const vertical = rng.next() < 0.35;
    const color = rng.pick(NEON_SIGN_COLORS);
    const w = vertical ? 30 : Math.max(64, text.length * 16 + 20);
    const h = vertical ? Math.max(80, text.length * 22 + 16) : 34;
    signs.push({
      x: b.x + rng.range(0, Math.max(1, b.w - w)),
      y: b.y + b.h * rng.range(0.15, 0.6),
      w,
      h,
      text,
      color,
      vertical,
    });
  }

  // Holographic ad panels floating above rooftops.
  const holos: HoloSpec[] = [];
  for (const b of streetSorted.slice(0, 3).map((s) => s.b)) {
    holos.push({
      x: b.x + b.w * 0.5 - 70,
      y: b.y - b.depth - rng.range(90, 150),
      w: rng.range(130, 200),
      h: rng.range(80, 120),
      color: rng.pick(NEON_SIGN_COLORS),
    });
  }

  // Steam vents near the street edges.
  const vents: VentSpec[] = [];
  for (let i = 0; i < 3; i++) {
    const d = path.totalLength * rng.range(0.2, 0.85);
    const p = path.pointAt(d);
    const side = rng.next() < 0.5 ? -1 : 1;
    vents.push({
      x: p.x + rng.range(-20, 20),
      y: p.y + side * (streetWidth * 0.5 + rng.range(8, 30)),
    });
  }

  return { width, height, streetWidth, path, buildings, signs, holos, vents };
}
