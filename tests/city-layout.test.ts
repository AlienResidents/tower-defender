import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { computeCityLayout, SIGN_WORDS } from '../src/world/city-layout';

const W = 1600;
const H = 900;

describe('computeCityLayout', () => {
  it('is deterministic for a fixed seed', () => {
    const a = computeCityLayout(createRng(1337), W, H);
    const b = computeCityLayout(createRng(1337), W, H);
    expect(a.buildings).toEqual(b.buildings);
    expect(a.signs).toEqual(b.signs);
    expect(a.holos).toEqual(b.holos);
    expect(a.vents).toEqual(b.vents);
  });

  it('diverges for different seeds', () => {
    const a = computeCityLayout(createRng(1), W, H);
    const b = computeCityLayout(createRng(2), W, H);
    expect(a.buildings).not.toEqual(b.buildings);
  });

  it('keeps every building clear of the street corridor', () => {
    const layout = computeCityLayout(createRng(1337), W, H);
    const clearance = layout.streetWidth * 0.5 + 14;
    for (const b of layout.buildings) {
      const d = layout.path.closestPoint({ x: b.x + b.w / 2, y: b.y + b.h / 2 }).distance;
      expect(d).toBeGreaterThanOrEqual(clearance + Math.max(b.w, b.h) * 0.5);
    }
  });

  it('places signs from the approved word bank', () => {
    const layout = computeCityLayout(createRng(1337), W, H);
    expect(layout.signs.length).toBeGreaterThan(0);
    for (const s of layout.signs) {
      expect(SIGN_WORDS).toContain(s.text);
    }
  });

  it('produces holos and vents within bounds', () => {
    const layout = computeCityLayout(createRng(1337), W, H);
    expect(layout.holos.length).toBeGreaterThan(0);
    expect(layout.holos.length).toBeLessThanOrEqual(3);
    expect(layout.vents).toHaveLength(3);
    for (const v of layout.vents) {
      expect(v.x).toBeGreaterThanOrEqual(-40);
      expect(v.x).toBeLessThanOrEqual(W + 40);
    }
  });
});
