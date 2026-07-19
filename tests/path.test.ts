import { describe, expect, it } from 'vitest';
import { Path } from '../src/world/path';

describe('Path', () => {
  const square = new Path([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ]);

  it('rejects fewer than 2 points', () => {
    expect(() => new Path([{ x: 0, y: 0 }])).toThrow(RangeError);
  });

  it('computes total length', () => {
    expect(square.totalLength).toBe(200);
    const diagonal = new Path([
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ]);
    expect(diagonal.totalLength).toBe(5);
  });

  it('samples points along the path', () => {
    const mid = square.pointAt(50);
    expect(mid.x).toBeCloseTo(50);
    expect(mid.y).toBeCloseTo(0);
    expect(mid.angle).toBeCloseTo(0);
    const corner = square.pointAt(150);
    expect(corner.x).toBeCloseTo(100);
    expect(corner.y).toBeCloseTo(50);
    expect(corner.angle).toBeCloseTo(Math.PI / 2);
  });

  it('clamps when not looping', () => {
    expect(square.pointAt(-10).x).toBe(0);
    const end = square.pointAt(9999);
    expect(end.x).toBe(100);
    expect(end.y).toBe(100);
  });

  it('wraps when looping', () => {
    const wrapped = square.pointAt(250, true);
    expect(wrapped.x).toBeCloseTo(50);
    expect(wrapped.y).toBeCloseTo(0);
    const negative = square.pointAt(-150, true);
    expect(negative.x).toBeCloseTo(50);
    expect(negative.y).toBeCloseTo(0);
  });

  it('finds the closest point on the path', () => {
    const cp = square.closestPoint({ x: 50, y: 30 });
    expect(cp.x).toBeCloseTo(50);
    expect(cp.y).toBeCloseTo(0);
    expect(cp.distance).toBeCloseTo(30);
    // beyond the end clamps to the endpoint
    const end = square.closestPoint({ x: 140, y: 140 });
    expect(end.x).toBe(100);
    expect(end.y).toBe(100);
  });
});
