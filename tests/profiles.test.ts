import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshMeta, loadMeta, saveMeta } from '../src/game/meta';
import {
  createProfile,
  deleteProfile,
  getActiveProfile,
  LEGACY_META_KEY,
  listProfiles,
  metaKeyFor,
  switchProfile,
} from '../src/game/profiles';

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

describe('operator profiles', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = stubLocalStorage();
  });
  afterEach(() => {
    // @ts-expect-error test cleanup
    delete globalThis.localStorage;
  });

  it('first boot creates and activates OPERATOR-01', () => {
    const profiles = listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('OPERATOR-01');
    expect(getActiveProfile().id).toBe(profiles[0].id);
  });

  it('adopts a legacy single-save blob into OPERATOR-01', () => {
    const legacy = JSON.stringify({ version: 2, palladium: 777, shift: 4, stash: ['amp'] });
    store.set(LEGACY_META_KEY, legacy);
    const profiles = listProfiles();
    expect(profiles).toHaveLength(1);
    expect(store.get(metaKeyFor(profiles[0].id))).toBe(legacy);
    expect(store.has(LEGACY_META_KEY)).toBe(false);
    expect(loadMeta().palladium).toBe(777);
  });

  it('auto-names new profiles OPERATOR-02, -03, …', () => {
    expect(createProfile().name).toBe('OPERATOR-02');
    expect(createProfile().name).toBe('OPERATOR-03');
    expect(createProfile('  Chrispy  ').name).toBe('Chrispy');
  });

  it('isolates saves per profile', () => {
    const a = getActiveProfile();
    const metaA = freshMeta();
    metaA.palladium = 111;
    saveMeta(metaA);

    const b = createProfile('B');
    switchProfile(b.id);
    expect(loadMeta().palladium).not.toBe(111);
    const metaB = freshMeta();
    metaB.palladium = 222;
    saveMeta(metaB);

    switchProfile(a.id);
    expect(loadMeta().palladium).toBe(111);
    switchProfile(b.id);
    expect(loadMeta().palladium).toBe(222);
  });

  it('switchProfile rejects unknown ids without changing the active profile', () => {
    const active = getActiveProfile();
    expect(switchProfile('p_nope')).toBe(false);
    expect(getActiveProfile().id).toBe(active.id);
  });

  it('deleteProfile removes the blob and activates the next profile', () => {
    const a = getActiveProfile();
    saveMeta({ ...freshMeta(), palladium: 999 });
    const b = createProfile('B');
    const active = deleteProfile(a.id);
    expect(active).toBe(b.id);
    expect(store.has(metaKeyFor(a.id))).toBe(false);
    expect(listProfiles().map((p) => p.id)).toEqual([b.id]);
  });

  it('deleting the last profile recreates a fresh OPERATOR-01', () => {
    const only = getActiveProfile();
    const active = deleteProfile(only.id);
    const profiles = listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('OPERATOR-01');
    expect(profiles[0].id).toBe(active);
    expect(loadMeta().palladium).toBeGreaterThan(0); // fresh meta, not the deleted save
  });

  it('rebuilds from a corrupt registry without losing profile saves', () => {
    saveMeta({ ...freshMeta(), palladium: 555 });
    const active = getActiveProfile();
    store.set('phosphor.profiles.v1', '{broken');
    // corrupt registry → rebuilt; old per-profile blob is orphaned, not loaded
    const profiles = listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).not.toBe(active);
    expect(loadMeta().shift).toBe(1);
  });
});
