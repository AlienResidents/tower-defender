import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SELECTION,
  resolvePreset,
  setOverride,
  clearOverride,
  SFX_PRESETS,
  type WeaponSoundKind,
} from '../src/data/sfx';

// minimal localStorage stub for node
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

describe('SFX preset data', () => {
  it('every preset is well-formed', () => {
    for (const [kind, presets] of Object.entries(SFX_PRESETS)) {
      for (const p of presets) {
        expect(p.id.startsWith(`${kind}.`)).toBe(true);
        expect(p.hits).toBeGreaterThanOrEqual(1);
        expect(p.gain).toBeGreaterThan(0);
        expect(p.gain).toBeLessThanOrEqual(1);
        expect(p.freqStart).toBeGreaterThan(0);
        expect(p.attack).toBeGreaterThan(0);
        expect(p.duration).toBeGreaterThan(0);
        expect(p.noise).toBeGreaterThanOrEqual(0);
        expect(p.noise).toBeLessThanOrEqual(1);
        if (p.body) {
          expect(p.body.freq).toBeGreaterThan(0);
          expect(p.body.decay).toBeGreaterThan(0);
          expect(p.body.gain).toBeGreaterThan(0);
          expect(p.body.gain).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('default selections resolve to real presets', () => {
    for (const id of Object.values(DEFAULT_SELECTION)) {
      expect(resolvePreset(id)).toBeDefined();
    }
  });

  it('every weapon kind has 3 variants', () => {
    for (const kind of Object.keys(SFX_PRESETS) as WeaponSoundKind[]) {
      expect(SFX_PRESETS[kind]).toHaveLength(3);
    }
  });

  it('slider overrides merge — multiple changes all apply', () => {
    const id = 'rail.boom';
    clearOverride(id);
    setOverride(id, { gain: 0.7 });
    setOverride(id, { duration: 0.3 });
    const resolved = resolvePreset(id);
    expect(resolved?.gain).toBe(0.7); // first change survived the second
    expect(resolved?.duration).toBe(0.3);
    clearOverride(id);
  });
});
