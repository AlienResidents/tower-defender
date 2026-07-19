/**
 * Early-send pressure economy: drops multiply by concurrent wave count.
 * n^1.75 — ramps hard past 3 waves, stays sub-exponential (spec: operator).
 */

export const PRESSURE_EXPONENT = 1.75;

export function dropMultiplier(activeWaves: number): number {
  return Math.pow(Math.max(activeWaves, 1), PRESSURE_EXPONENT);
}
