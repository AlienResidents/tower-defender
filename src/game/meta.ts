import { settings } from '../settings';
import { emptyGrid, type AttrGrid } from '../data/attributes';
import { activeMetaKey } from './profiles';

/**
 * Campaign meta state — persists across shifts via localStorage.
 *
 * v2 adds: credits (store currency), attribute grid, campaign ledger.
 * v1 saves migrate on load. Palladium is the meta currency: it carries
 * between shifts. Picked items live in the stash until socketed.
 *
 * Storage is per-operator-profile: reads/writes resolve the active
 * profile's key through profiles.activeMetaKey() — the seam where a
 * server backend can later replace localStorage without touching callers.
 */

export interface MetaState {
  version: 2;
  palladium: number;
  /** Next shift to play (1-based). Booting without ?seed resumes here. */
  shift: number;
  /** Stashed item def ids — picked but not yet socketed. */
  stash: string[];
  /** Store credits (CSC armory). Bought with palladium at a flat rate. */
  credits: number;
  /** Per-archetype attribute ranks. */
  grid: AttrGrid;
  /** Lifetime campaign totals. */
  ledger: {
    pdEarned: number;
    pdSpent: number;
    svEarned: number;
    svRefined: number;
  };
}

export function freshMeta(): MetaState {
  return {
    version: 2,
    palladium: settings.economy.startingPalladium,
    shift: 1,
    stash: [],
    credits: 0,
    grid: emptyGrid(),
    ledger: { pdEarned: 0, pdSpent: 0, svEarned: 0, svRefined: 0 },
  };
}

interface MetaV1 {
  version: 1;
  palladium: number;
  shift: number;
  stash: string[];
}

function migrate(parsed: Partial<MetaState> | Partial<MetaV1>): MetaState | null {
  if (parsed.version === 2) {
    const v2 = parsed as MetaState;
    if (!Number.isFinite(v2.palladium) || !Number.isFinite(v2.shift)) return null;
    return {
      ...freshMeta(),
      ...v2,
      grid: v2.grid ?? emptyGrid(),
      ledger: v2.ledger ?? freshMeta().ledger,
      stash: Array.isArray(v2.stash) ? v2.stash : [],
      credits: Number.isFinite(v2.credits) ? v2.credits : 0,
    };
  }
  if (parsed.version === 1) {
    const v1 = parsed as MetaV1;
    if (!Number.isFinite(v1.palladium) || !Number.isFinite(v1.shift)) return null;
    return {
      ...freshMeta(),
      palladium: v1.palladium,
      shift: v1.shift,
      stash: Array.isArray(v1.stash) ? v1.stash : [],
    };
  }
  return null;
}

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(activeMetaKey());
    if (!raw) return freshMeta();
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    const migrated = migrate(parsed);
    if (migrated) return migrated;
  } catch {
    // corrupt or unavailable storage — start fresh
  }
  return freshMeta();
}

export function saveMeta(meta: MetaState): void {
  try {
    localStorage.setItem(activeMetaKey(), JSON.stringify(meta));
  } catch {
    // storage unavailable — session-only progress
  }
}

/** Dev/testing escape hatch. */
export function clearMeta(): void {
  try {
    localStorage.removeItem(activeMetaKey());
  } catch {
    // ignore
  }
}
