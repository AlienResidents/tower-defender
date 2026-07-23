import type { TowerMods } from './items';

/**
 * Attribute grid (spec §8) — per-archetype permanent upgrades, palladium cost,
 * free respec. Data-driven; effects stack additively into tower mods at
 * placement (same unit as item mods: +0.06 = +6%).
 */

export interface AttrTrack {
  id: keyof Pick<TowerMods, 'damage' | 'rate' | 'range'>;
  name: string;
  /** Effect per rank, added to the tower's mods. */
  perRank: number;
}

export const ATTR_TRACKS: readonly AttrTrack[] = [
  { id: 'damage', name: 'DAMAGE', perRank: 0.06 },
  { id: 'rate', name: 'FIRE RATE', perRank: 0.06 },
  { id: 'range', name: 'RANGE', perRank: 0.05 },
] as const;

export const ATTR_MAX_RANK = 5;

/** Grid shape: towerId -> trackId -> rank (0..5). */
export type AttrGrid = Record<string, Record<string, number>>;

export function emptyGrid(): AttrGrid {
  return {};
}

export function rankOf(grid: AttrGrid, towerId: string, trackId: string): number {
  return grid[towerId]?.[trackId] ?? 0;
}

/** Palladium cost of buying the NEXT rank (rank r costs 100×(r+1)). */
export function attrCost(currentRank: number): number {
  return 100 * (currentRank + 1);
}

/** Total palladium spent on one archetype (for respec refunds). */
export function archetypeSpent(grid: AttrGrid, towerId: string): number {
  let total = 0;
  for (const t of ATTR_TRACKS) {
    const rank = rankOf(grid, towerId, t.id);
    for (let r = 0; r < rank; r++) total += attrCost(r);
  }
  return total;
}

/** Buy the next rank. Returns the cost, or null if maxed. Mutates the grid. */
export function buyRank(grid: AttrGrid, towerId: string, trackId: string): number | null {
  const current = rankOf(grid, towerId, trackId);
  if (current >= ATTR_MAX_RANK) return null;
  if (!grid[towerId]) grid[towerId] = {};
  grid[towerId][trackId] = current + 1;
  return attrCost(current);
}

/** Reset an archetype's ranks. Returns the palladium to refund. */
export function respec(grid: AttrGrid, towerId: string): number {
  const refund = archetypeSpent(grid, towerId);
  delete grid[towerId];
  return refund;
}

/** Mod bonuses from the grid for one tower archetype (added at placement). */
export function attrMods(grid: AttrGrid, towerId: string): Partial<TowerMods> {
  const mods: Partial<TowerMods> = {};
  for (const t of ATTR_TRACKS) {
    const rank = rankOf(grid, towerId, t.id);
    if (rank > 0) mods[t.id] = rank * t.perRank;
  }
  return mods;
}
