/**
 * Seeded RNG (mulberry32). Every roll in PHOSPHOR flows through this —
 * runs are reproducible and bug reports can cite a seed (plan §4).
 */

export interface Rng {
  readonly seed: number;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Number of draws so far (save/replay support). */
  draws(): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  let drawCount = 0;

  function next(): number {
    drawCount++;
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    seed,
    next,
    int(min: number, max: number): number {
      if (max < min) throw new RangeError(`int: max ${max} < min ${min}`);
      return min + Math.floor(next() * (max - min + 1));
    },
    range(min: number, max: number): number {
      if (max <= min) throw new RangeError(`range: max ${max} <= min ${min}`);
      return min + next() * (max - min);
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('pick: empty array');
      return items[Math.floor(next() * items.length)];
    },
    draws: () => drawCount,
  };
}
