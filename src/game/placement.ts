import type { CityLayout } from '../world/city-layout';
import type { PathPoint } from '../world/path';

/** Tower placement — snap to discrete rooftop slots (spec: operator UX). */

export interface PlacementCheck {
  ok: boolean;
  reason?: 'off-roof' | 'too-close';
}

const SNAP_RADIUS = 40;
const OCCUPIED_RADIUS = 4;

/** Nearest roof slot to p within the snap radius, or null. */
export function nearestSlot(
  layout: CityLayout,
  p: PathPoint,
  maxDist = SNAP_RADIUS,
): PathPoint | null {
  let best: PathPoint | null = null;
  let bestD = maxDist;
  for (const s of layout.slots) {
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

export function isOccupied(slot: PathPoint, existing: readonly PathPoint[]): boolean {
  return existing.some((t) => Math.hypot(t.x - slot.x, t.y - slot.y) < OCCUPIED_RADIUS);
}

export function canPlace(
  layout: CityLayout,
  p: PathPoint,
  existing: readonly PathPoint[],
): PlacementCheck {
  const slot = nearestSlot(layout, p);
  if (!slot) return { ok: false, reason: 'off-roof' };
  if (isOccupied(slot, existing)) return { ok: false, reason: 'too-close' };
  return { ok: true };
}
