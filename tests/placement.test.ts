import { describe, expect, it } from 'vitest';
import { canPlace, isOccupied, nearestSlot } from '../src/game/placement';
import type { CityLayout } from '../src/world/city-layout';
import { Path } from '../src/world/path';

const layout: CityLayout = {
  width: 1000,
  height: 800,
  streetWidth: 80,
  path: new Path([
    { x: 0, y: 700 },
    { x: 1000, y: 700 },
  ]),
  buildings: [{ x: 100, y: 100, w: 200, h: 100, depth: 20, litRatio: 0.3 }],
  signs: [],
  holos: [],
  vents: [],
  slots: [
    { x: 200, y: 90 },
    { x: 240, y: 90 },
  ],
};

describe('placement (slot snapping)', () => {
  it('snaps to the nearest slot within the snap radius', () => {
    expect(nearestSlot(layout, { x: 195, y: 95 })).toEqual({ x: 200, y: 90 });
    expect(nearestSlot(layout, { x: 222, y: 88 })).toEqual({ x: 240, y: 90 });
  });

  it('returns null beyond the snap radius', () => {
    expect(nearestSlot(layout, { x: 500, y: 500 })).toBeNull();
  });

  it('detects occupied slots', () => {
    expect(isOccupied({ x: 200, y: 90 }, [{ x: 202, y: 92 }])).toBe(true);
    expect(isOccupied({ x: 200, y: 90 }, [{ x: 240, y: 90 }])).toBe(false);
  });

  it('canPlace: off-roof and occupied rejected, free slot accepted', () => {
    expect(canPlace(layout, { x: 500, y: 500 }, []).reason).toBe('off-roof');
    expect(canPlace(layout, { x: 200, y: 90 }, [{ x: 200, y: 90 }]).reason).toBe('too-close');
    expect(canPlace(layout, { x: 240, y: 90 }, [{ x: 200, y: 90 }]).ok).toBe(true);
  });
});
