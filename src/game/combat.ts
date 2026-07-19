import type { Tier } from '../data/towers';

/**
 * Rifts-derived two-tier damage (spec §9): street weapons barely scratch
 * mega plating; mega weapons damage everything fully.
 */

export function tierMultiplier(weaponTier: Tier, targetTier: Tier): number {
  if (weaponTier === 'mega') return 1;
  if (targetTier === 'mega') return 0.01;
  return 1;
}

export function applyDamage(weaponTier: Tier, targetTier: Tier, base: number): number {
  return base * tierMultiplier(weaponTier, targetTier);
}
