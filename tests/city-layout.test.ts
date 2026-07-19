import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import {
  type CityLayout,
  computeCityLayout,
  makeSurfaceMap,
  SIGN_WORDS,
} from '../src/world/city-layout';
import { Path } from '../src/world/path';

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

  it('band signs contained by host; blade signs clear of other buildings', () => {
    const layout = computeCityLayout(createRng(1337), W, H);
    for (const s of layout.signs) {
      if (s.style === 'band') {
        const host = layout.buildings[s.hostIdx];
        expect(s.x).toBeGreaterThanOrEqual(host.x);
        expect(s.x + s.w).toBeLessThanOrEqual(host.x + host.w);
        expect(s.y).toBeGreaterThanOrEqual(host.y);
        expect(s.y + s.h).toBeLessThanOrEqual(host.y + host.h);
      } else {
        layout.buildings.forEach((b, idx) => {
          if (idx === s.hostIdx) return;
          const overlaps = s.x < b.x + b.w && s.x + s.w > b.x && s.y < b.y + b.h && s.y + s.h > b.y;
          expect(overlaps).toBe(false);
        });
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x + s.w).toBeLessThanOrEqual(layout.width);
      }
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

  it('never hangs a holo over the street corridor', () => {
    const layout = computeCityLayout(createRng(1337), W, H);
    for (const h of layout.holos) {
      // corners + edge midpoints must all clear the corridor
      const samples = [
        [h.x, h.y],
        [h.x + h.w / 2, h.y],
        [h.x + h.w, h.y],
        [h.x, h.y + h.h / 2],
        [h.x + h.w / 2, h.y + h.h / 2],
        [h.x + h.w, h.y + h.h / 2],
        [h.x, h.y + h.h],
        [h.x + h.w / 2, h.y + h.h],
        [h.x + h.w, h.y + h.h],
      ];
      for (const [x, y] of samples) {
        expect(layout.path.closestPoint({ x, y }).distance).toBeGreaterThanOrEqual(
          layout.streetWidth * 0.5,
        );
      }
    }
  });
  it('keeps tower slots within engagement range of the street', () => {
    const layout = computeCityLayout(createRng(1337), W, H);
    expect(layout.slots.length).toBeGreaterThan(0);
    for (const s of layout.slots) {
      expect(layout.path.closestPoint(s).distance).toBeLessThanOrEqual(200);
    }
  });
});

describe('makeSurfaceMap', () => {
  const handLayout: CityLayout = {
    width: 1000,
    height: 800,
    streetWidth: 80,
    // short street segment (x 400-600) so roof/street/ground cases all exist
    path: new Path([
      { x: 400, y: 600 },
      { x: 600, y: 600 },
    ]),
    buildings: [{ x: 100, y: 100, w: 200, h: 100, depth: 20, litRatio: 0.3 }],
    signs: [],
    holos: [],
    vents: [],
    slots: [],
  };
  const surf = makeSurfaceMap(handLayout, 780);

  it('lands rain on rooftops over buildings', () => {
    expect(surf(200)).toBe(80); // roofline: y - depth
  });

  it('lands rain at street level over the corridor', () => {
    expect(surf(500)).toBe(600);
  });

  it('lands rain on the ground elsewhere', () => {
    expect(surf(50)).toBe(780); // off-corridor, no building
  });
});
