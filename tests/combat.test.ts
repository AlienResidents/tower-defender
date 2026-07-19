import { describe, expect, it } from 'vitest';
import { applyDamage, tierMultiplier } from '../src/game/combat';

describe('tier damage (Rifts two-tier, spec §9)', () => {
  it('mega weapons damage everything fully', () => {
    expect(tierMultiplier('mega', 'street')).toBe(1);
    expect(tierMultiplier('mega', 'mega')).toBe(1);
  });

  it('street weapons are full on street, 1% on mega plating', () => {
    expect(tierMultiplier('street', 'street')).toBe(1);
    expect(tierMultiplier('street', 'mega')).toBe(0.01);
  });

  it('applies the multiplier to base damage', () => {
    expect(applyDamage('street', 'mega', 55)).toBeCloseTo(0.55);
    expect(applyDamage('mega', 'mega', 55)).toBe(55);
  });
});
