import { describe, expect, it } from 'vitest';
import { canPlace, roofAt } from '../src/game/placement';
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
};

describe('placement (rooftop towers)', () => {
  it('accepts points on the roof face', () => {
    expect(roofAt(layout, { x: 200, y: 90 })).toBe(true);
  });

  it('rejects points off the roof', () => {
    expect(roofAt(layout, { x: 200, y: 100 })).toBe(false); // front face
    expect(roofAt(layout, { x: 50, y: 50 })).toBe(false); // open ground
    expect(roofAt(layout, { x: 200, y: 700 })).toBe(false); // street
  });

  it('rejects placements too close to existing towers', () => {
    expect(canPlace(layout, { x: 210, y: 90 }, [{ x: 200, y: 90 }]).reason).toBe('too-close');
    expect(canPlace(layout, { x: 240, y: 90 }, [{ x: 200, y: 90 }]).ok).toBe(true);
  });

  it('rejects off-roof placements', () => {
    expect(canPlace(layout, { x: 500, y: 500 }, []).reason).toBe('off-roof');
  });
});
