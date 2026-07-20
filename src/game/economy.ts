/**
 * Early-send pressure economy: drops multiply by concurrent wave count.
 * n^exponent — ramps hard past 3 waves, stays sub-exponential (spec: operator).
 */
import { settings } from '../settings';

export const PRESSURE_EXPONENT = settings.economy.pressureExponent;

export function dropMultiplier(activeWaves: number): number {
  return Math.pow(Math.max(activeWaves, 1), PRESSURE_EXPONENT);
}
