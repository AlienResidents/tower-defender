import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SELECTION,
  resolvePreset,
  setOverride,
  clearOverride,
  SFX_PRESETS,
  type WeaponSoundKind,
} from '../src/data/sfx';
import { modPreset } from '../src/audio/sfx';
import { ZERO_MODS } from '../src/data/items';
import { settings } from '../src/settings';

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
          expect(p.body.gain).toBeGreaterThanOrEqual(0); // 0 = body off
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

describe('modPreset — item-mod-driven SFX', () => {
  const chugRip = resolvePreset('burst.chugrip')!;

  it('burst mod adds hits and compresses the gap to the floor', () => {
    // one drum (+6): 8→14 hits, span 0.16s → gap 0.0114 → floored at 0.012
    const one = modPreset(chugRip, { ...ZERO_MODS, burst: 6 });
    expect(one.hits).toBe(14);
    expect(one.hitGap).toBeCloseTo(settings.audio.minBurstGapSeconds);
    // energy preservation: gain scales by √(base/new) so the bus stays clean
    expect(one.gain).toBeCloseTo(chugRip.gain * Math.sqrt(8 / 14));
    // two drums (+12): 8→20 hits, gap wants 0.008 → still floored
    const two = modPreset(chugRip, { ...ZERO_MODS, burst: 12 });
    expect(two.hits).toBe(20);
    expect(two.hitGap).toBeCloseTo(settings.audio.minBurstGapSeconds);
    expect(two.gain).toBeCloseTo(chugRip.gain * Math.sqrt(8 / 20));
  });

  it('range mod stretches hit duration slightly', () => {
    const scoped = modPreset(chugRip, { ...ZERO_MODS, range: 0.2 });
    expect(scoped.duration).toBeCloseTo(
      chugRip.duration * (1 + 0.2 * settings.audio.rangeDurationFactor),
    );
  });

  it('damage mod drops pitch (thumpier) and lifts gain', () => {
    const amped = modPreset(chugRip, { ...ZERO_MODS, damage: 0.25 });
    const bass = 1 - 0.25 * settings.audio.damageBassFactor;
    expect(amped.freqStart).toBeCloseTo(chugRip.freqStart * bass);
    expect(amped.freqEnd).toBeCloseTo(chugRip.freqEnd * bass);
    expect(amped.gain).toBeCloseTo(chugRip.gain * (1 + 0.25 * settings.audio.damageGainFactor));
  });

  it('zero mods leave the preset untouched', () => {
    const plain = modPreset(chugRip, { ...ZERO_MODS });
    expect(plain.hits).toBe(chugRip.hits);
    expect(plain.hitGap).toBe(chugRip.hitGap);
    expect(plain.duration).toBe(chugRip.duration);
    expect(plain.freqStart).toBe(chugRip.freqStart);
  });
});
