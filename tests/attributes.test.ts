import { describe, expect, it } from 'vitest';
import {
  ATTR_MAX_RANK,
  archetypeSpent,
  attrCost,
  attrMods,
  buyRank,
  emptyGrid,
  rankOf,
  respec,
} from '../src/data/attributes';

describe('attribute grid', () => {
  it('buyRank escalates cost and caps at max rank', () => {
    const grid = emptyGrid();
    expect(attrCost(0)).toBe(100);
    expect(buyRank(grid, 'railgun', 'damage')).toBe(100);
    expect(buyRank(grid, 'railgun', 'damage')).toBe(200);
    expect(rankOf(grid, 'railgun', 'damage')).toBe(2);
    for (let i = 0; i < 3; i++) buyRank(grid, 'railgun', 'damage');
    expect(rankOf(grid, 'railgun', 'damage')).toBe(ATTR_MAX_RANK);
    expect(buyRank(grid, 'railgun', 'damage')).toBeNull(); // maxed
  });

  it('attrMods stacks ranks into mod bonuses', () => {
    const grid = emptyGrid();
    buyRank(grid, 'vulcan', 'rate');
    buyRank(grid, 'vulcan', 'rate');
    buyRank(grid, 'vulcan', 'range');
    const mods = attrMods(grid, 'vulcan');
    expect(mods.rate).toBeCloseTo(0.12);
    expect(mods.range).toBeCloseTo(0.05);
    expect(mods.damage).toBeUndefined();
    expect(attrMods(grid, 'tesla')).toEqual({});
  });

  it('archetypeSpent sums the full cost curve; respec refunds and clears', () => {
    const grid = emptyGrid();
    buyRank(grid, 'laser', 'damage'); // 100
    buyRank(grid, 'laser', 'damage'); // 200
    buyRank(grid, 'laser', 'range'); // 100
    expect(archetypeSpent(grid, 'laser')).toBe(400);
    expect(respec(grid, 'laser')).toBe(400);
    expect(rankOf(grid, 'laser', 'damage')).toBe(0);
    expect(archetypeSpent(grid, 'laser')).toBe(0);
  });
});
