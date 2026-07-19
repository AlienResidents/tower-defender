import { describe, expect, it } from 'vitest';
import { simulatePurchase } from '../src/lab/sim';

describe('simulatePurchase (greedy could-reach strategy)', () => {
  it('3×d100 almost always covers a small price', () => {
    const r = simulatePurchase(24, [100, 100, 100], 2000);
    expect(r.successRate).toBeGreaterThan(0.9);
  });

  it('success rate falls as price rises for the same loadout', () => {
    const loadout = [100, 100];
    const easy = simulatePurchase(24, loadout, 2000);
    const hard = simulatePurchase(100, loadout, 2000);
    expect(easy.successRate).toBeGreaterThan(hard.successRate);
  });

  it('busts return salvage', () => {
    // 2×d3 can never reach 100 — always bust, always salvage
    const r = simulatePurchase(100, [3, 3], 500);
    expect(r.successRate).toBe(0);
    expect(r.avgSalvage).toBeGreaterThan(0);
  });

  it('reports value spent in palladium terms', () => {
    const r = simulatePurchase(24, [100, 100, 100], 2000);
    expect(r.avgValueSpent).toBeGreaterThan(0);
    expect(r.avgDiceSpent).toBeGreaterThan(0);
    expect(r.avgDiceSpent).toBeLessThanOrEqual(3);
  });
});
