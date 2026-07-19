import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';

describe('createRng', () => {
  it('is deterministic for a fixed seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 16 }, () => a.next());
    const seqB = Array.from({ length: 16 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('diverges for different seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('int stays within inclusive bounds', () => {
    const rng = createRng(1337);
    for (let i = 0; i < 5000; i++) {
      const v = rng.int(1, 100);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('int rejects inverted bounds', () => {
    expect(() => createRng(1).int(10, 1)).toThrow(RangeError);
  });

  it('range rejects inverted bounds', () => {
    expect(() => createRng(1).range(5, 5)).toThrow(RangeError);
  });

  it('pick returns only members of the input', () => {
    const rng = createRng(7);
    const sides = [3, 6, 8, 10, 12, 20, 100] as const;
    for (let i = 0; i < 1000; i++) {
      expect(sides).toContain(rng.pick(sides));
    }
  });

  it('pick rejects an empty array', () => {
    expect(() => createRng(1).pick([])).toThrow(RangeError);
  });

  it('tracks draw count for save/replay', () => {
    const rng = createRng(9);
    expect(rng.draws()).toBe(0);
    rng.next();
    rng.int(1, 6);
    expect(rng.draws()).toBe(2);
  });
});
