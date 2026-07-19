import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SELECTION,
  resolvePreset,
  SFX_PRESETS,
  type WeaponSoundKind,
} from '../src/data/sfx';

describe('SFX preset data', () => {
  it('every preset is well-formed', () => {
    for (const [kind, presets] of Object.entries(SFX_PRESETS)) {
      for (const p of presets) {
        expect(p.id.startsWith(`${kind}.`)).toBe(true);
        expect(p.hits).toBeGreaterThanOrEqual(1);
        expect(p.gain).toBeGreaterThan(0);
        expect(p.gain).toBeLessThanOrEqual(1);
        expect(p.freqStart).toBeGreaterThan(0);
        expect(p.duration).toBeGreaterThan(0);
        expect(p.noise).toBeGreaterThanOrEqual(0);
        expect(p.noise).toBeLessThanOrEqual(1);
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
});
