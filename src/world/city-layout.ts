import type { Rng } from '../core/rng';
import { NEON_SIGN_COLORS } from '../data/palette';
import { Path, type PathPoint } from './path';

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
  /** Index of the host building in CityLayout.buildings. */
  hostIdx: number;
  /** band = lightbox in the rooftop band; blade = projecting sign on struts. */
  style: 'band' | 'blade';
  /** Blade only: -1 projects left of host, 1 projects right. */
  side: -1 | 1;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: number;
  fontSize: number;
}

export interface HoloSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Emitter mast height connecting panel to the host building's roofline. */
  mast: number;
  /** Absolute x of the mast (host building center). */
  mountX: number;
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
  /** Discrete tower-snap points on rooftops. */
  slots: PathPoint[];
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

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

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

  // Signs: modest lightbox panels in a band just under the roofline —
  // realistic scale (never multi-story, never building-wide), horizontal only.
  const streetSorted = [...buildings]
    .map((b) => ({
      b,
      d: path.closestPoint({ x: b.x + b.w / 2, y: b.y + b.h / 2 }).distance,
    }))
    .sort((a, b2) => a.d - b2.d);
  const signs: SignSpec[] = [];
  for (const { b } of streetSorted.slice(0, 9)) {
    const text = rng.pick(SIGN_WORDS);
    const color = rng.pick(NEON_SIGN_COLORS);
    const hostIdx = buildings.indexOf(b);

    // ~45% blade signs: small vertical panels on struts off a building side
    if (rng.next() < 0.45) {
      const fontSize = rng.range(8, 11);
      const w = fontSize + 10;
      const h = text.length * (fontSize + 3) + 10;
      const strut = 8;
      if (h + 12 < b.h) {
        const y = b.y + rng.range(6, b.h - h - 6);
        const preferred: -1 | 1 = rng.next() < 0.5 ? -1 : 1;
        const fallback: -1 | 1 = preferred === 1 ? -1 : 1;
        let placed = false;
        for (const sd of [preferred, fallback]) {
          const x = sd === -1 ? b.x - w - strut : b.x + b.w + strut;
          if (x < 4 || x + w > width - 4) continue;
          const rect = { x, y, w, h };
          if (buildings.some((o) => o !== b && rectsOverlap(rect, o))) continue;
          signs.push({ hostIdx, style: 'blade', side: sd, x, y, w, h, text, color, fontSize });
          placed = true;
          break;
        }
        if (placed) continue;
      }
      // no clean fit — fall through to a band sign
    }

    // band sign: modest lightbox just under the roofline
    const perChar = (fs: number): number => text.length * (fs * 0.64 + 3); // glyphs + letterSpacing
    let fontSize = rng.range(11, 16);
    let w = Math.ceil(perChar(fontSize)) + 16;
    if (w > b.w * 0.6) {
      fontSize = Math.floor(((b.w * 0.6 - 16) / text.length - 3) / 0.64);
      if (fontSize < 9) continue;
      w = Math.ceil(perChar(fontSize)) + 16;
    }
    const h = fontSize + 10;
    signs.push({
      hostIdx,
      style: 'band',
      side: 1,
      x: b.x + (b.w - w) * rng.range(0.2, 0.8),
      y: b.y + 4, // the sign band just under the roofline
      w,
      h,
      text,
      color,
      fontSize,
    });
  }

  // Holographic ad panels mast-mounted on rooftops, centered on their host,
  // and never hanging over the street corridor.
  const holos: HoloSpec[] = [];
  for (const { b } of streetSorted) {
    if (holos.length >= 3) break;
    const w = rng.range(130, 200);
    const h = rng.range(80, 120);
    const mast = rng.range(18, 34);
    const holo: HoloSpec = {
      x: b.x + b.w * 0.5 - w / 2,
      y: b.y - b.depth - mast - h,
      w,
      h,
      mast,
      mountX: b.x + b.w * 0.5,
      color: rng.pick(NEON_SIGN_COLORS),
    };
    const cx = holo.x + w / 2;
    const cy = holo.y + h / 2;
    const halfDiag = Math.hypot(w, h) / 2;
    if (path.closestPoint({ x: cx, y: cy }).distance < streetWidth * 0.5 + 10 + halfDiag) {
      continue; // would overlap the road/enemy track — pick another host
    }
    holos.push(holo);
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

  // Tower slots on rooftops — kept only within engagement range of the
  // street; deep-city roofs are useless and not buildable
  const MAX_ENGAGE = 200;
  const slots: PathPoint[] = [];
  for (const b of buildings) {
    const usable = b.w - 24;
    const n = Math.max(0, Math.floor(usable / 34));
    for (let i = 0; i < n; i++) {
      const slot = {
        x: b.x + 12 + (usable / n) * (i + 0.5),
        y: b.y - b.depth * 0.5, // mid top face
      };
      if (path.closestPoint(slot).distance <= MAX_ENGAGE) slots.push(slot);
    }
  }

  return { width, height, streetWidth, path, buildings, signs, holos, vents, slots };
}

/**
 * Surface map for weather: Y of whatever is under scene-x — rooftop over
 * buildings, street level over the corridor, ground otherwise. Pure.
 */
export function makeSurfaceMap(layout: CityLayout, groundY: number): (x: number) => number {
  return (x: number): number => {
    // "over the street" = horizontally within the corridor of the path curve
    const cp = layout.path.closestPoint({ x, y: groundY });
    if (Math.abs(cp.x - x) < layout.streetWidth * 0.5) return cp.y;
    let y = groundY;
    for (const b of layout.buildings) {
      if (x >= b.x && x <= b.x + b.w) {
        y = Math.min(y, b.y - b.depth); // roofline
      }
    }
    return y;
  };
}
