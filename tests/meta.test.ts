import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearMeta, freshMeta, loadMeta, saveMeta } from '../src/game/meta';
import { settings } from '../src/settings';

function stubLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
  return store;
}

describe('meta persistence (schema v1)', () => {
  beforeEach(() => stubLocalStorage());
  afterEach(() => {
    // @ts-expect-error test cleanup
    delete globalThis.localStorage;
  });

  it('fresh meta starts with the settings palladium at shift 1', () => {
    const meta = loadMeta();
    expect(meta.palladium).toBe(settings.economy.startingPalladium);
    expect(meta.shift).toBe(1);
    expect(meta.stash).toEqual([]);
  });

  it('round-trips palladium, shift, and stash', () => {
    const meta = freshMeta();
    meta.palladium = 2950;
    meta.shift = 3;
    meta.stash = ['overclock', 'cryo-rounds'];
    saveMeta(meta);
    const loaded = loadMeta();
    expect(loaded.palladium).toBe(2950);
    expect(loaded.shift).toBe(3);
    expect(loaded.stash).toEqual(['overclock', 'cryo-rounds']);
  });

  it('survives corrupt storage and clears cleanly', () => {
    localStorage.setItem('phosphor.meta.v1', '{not json');
    expect(loadMeta().shift).toBe(1);
    saveMeta(freshMeta());
    clearMeta();
    expect(loadMeta().palladium).toBe(settings.economy.startingPalladium);
  });

  it('migrates v1 saves to v2 with empty grid/credits/ledger', () => {
    localStorage.setItem(
      'phosphor.meta.v1',
      JSON.stringify({ version: 1, palladium: 2950, shift: 3, stash: ['amp'] }),
    );
    const meta = loadMeta();
    expect(meta.version).toBe(2);
    expect(meta.palladium).toBe(2950);
    expect(meta.shift).toBe(3);
    expect(meta.stash).toEqual(['amp']);
    expect(meta.credits).toBe(0);
    expect(meta.grid).toEqual({});
    expect(meta.ledger.pdEarned).toBe(0);
  });
});
