import { settings } from '../settings';

/**
 * Campaign meta state (schema v1) — persists across shifts via localStorage.
 *
 * Palladium is the meta currency: it carries between shifts. Dice and towers
 * are in-level and reset. Picked items live in the stash until socketed;
 * the stash persists too. Salvage auto-refines into palladium on a win.
 */

export interface MetaState {
  version: 1;
  palladium: number;
  /** Next shift to play (1-based). Booting without ?seed resumes here. */
  shift: number;
  /** Stashed item def ids — picked but not yet socketed. */
  stash: string[];
}

const KEY = 'phosphor.meta.v1';

export function freshMeta(): MetaState {
  return {
    version: 1,
    palladium: settings.economy.startingPalladium,
    shift: 1,
    stash: [],
  };
}

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshMeta();
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    if (
      parsed.version === 1 &&
      Number.isFinite(parsed.palladium) &&
      Number.isFinite(parsed.shift) &&
      Array.isArray(parsed.stash)
    ) {
      return parsed as MetaState;
    }
  } catch {
    // corrupt or unavailable storage — start fresh
  }
  return freshMeta();
}

export function saveMeta(meta: MetaState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    // storage unavailable — session-only progress
  }
}

/** Dev/testing escape hatch. */
export function clearMeta(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
