import { describe, expect, it } from 'vitest';
import { dropMultiplier, PRESSURE_EXPONENT } from '../src/game/economy';

describe('dropMultiplier (early-send pressure)', () => {
  it('is 1x for a single wave', () => {
    expect(dropMultiplier(1)).toBe(1);
  });

  it('ramps hard past 3 waves', () => {
    expect(dropMultiplier(2)).toBeCloseTo(3.36, 1);
    expect(dropMultiplier(3)).toBeCloseTo(6.84, 1);
    expect(dropMultiplier(4)).toBeCloseTo(11.31, 1);
  });

  it('stays sub-exponential', () => {
    for (let n = 3; n <= 12; n++) {
      expect(dropMultiplier(n)).toBeLessThan(2 ** n);
    }
  });

  it('floors at 1 for degenerate input', () => {
    expect(dropMultiplier(0)).toBe(1);
  });

  it('uses the documented exponent', () => {
    expect(dropMultiplier(5)).toBeCloseTo(Math.pow(5, PRESSURE_EXPONENT), 6);
  });
});
