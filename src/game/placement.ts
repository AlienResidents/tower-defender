import type { CityLayout } from '../world/city-layout';
import type { PathPoint } from '../world/path';

/** Tower placement rules — towers mount on building rooftops only (spec-fiction). */

export interface PlacementCheck {
  ok: boolean;
  reason?: 'off-roof' | 'too-close';
}

/** Roof = the building's top face, inset slightly from the edges. */
export function roofAt(layout: CityLayout, p: PathPoint): boolean {
  return layout.buildings.some(
    (b) => p.x >= b.x + 6 && p.x <= b.x + b.w - 6 && p.y >= b.y - b.depth + 3 && p.y <= b.y - 2,
  );
}

export function canPlace(
  layout: CityLayout,
  p: PathPoint,
  existing: readonly PathPoint[],
  minGap = 28,
): PlacementCheck {
  if (!roofAt(layout, p)) return { ok: false, reason: 'off-roof' };
  for (const t of existing) {
    if (Math.hypot(t.x - p.x, t.y - p.y) < minGap) return { ok: false, reason: 'too-close' };
  }
  return { ok: true };
}
