/**
 * Weapon SFX presets — data-driven sound design. One generic engine
 * (src/audio/sfx.ts) interprets these; the /lab page tunes and persists
 * selections to localStorage under SFX_STORAGE_KEY.
 */

export type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type WeaponSoundKind = 'rail' | 'beam' | 'missile' | 'chain' | 'burst' | 'splash';

export interface SfxPreset {
  id: string;
  name: string;
  osc: OscType;
  freqStart: number;
  freqEnd: number;
  /** seconds for the pitch sweep */
  sweepTime: number;
  /** 0..1 noise mix */
  noise: number;
  /** noise bandpass center frequency */
  noiseFreq: number;
  duration: number;
  gain: number;
  /** repeater — 1 for one-shots, N for burst rips */
  hits: number;
  /** seconds between hits */
  hitGap: number;
}

export const SFX_STORAGE_KEY = 'phosphor.sfx';

export const SFX_PRESETS: Record<WeaponSoundKind, SfxPreset[]> = {
  rail: [
    {
      id: 'rail.boom',
      name: 'Boom',
      osc: 'sine',
      freqStart: 220,
      freqEnd: 40,
      sweepTime: 0.09,
      noise: 0.4,
      noiseFreq: 900,
      duration: 0.22,
      gain: 0.5,
      hits: 1,
      hitGap: 0,
    },
    {
      id: 'rail.crack',
      name: 'Crack',
      osc: 'square',
      freqStart: 1400,
      freqEnd: 180,
      sweepTime: 0.05,
      noise: 0.7,
      noiseFreq: 2400,
      duration: 0.14,
      gain: 0.4,
      hits: 1,
      hitGap: 0,
    },
    {
      id: 'rail.railzap',
      name: 'Rail Zap',
      osc: 'sawtooth',
      freqStart: 2400,
      freqEnd: 90,
      sweepTime: 0.12,
      noise: 0.3,
      noiseFreq: 1400,
      duration: 0.2,
      gain: 0.42,
      hits: 1,
      hitGap: 0,
    },
  ],
  beam: [
    {
      id: 'beam.pew',
      name: 'Pew',
      osc: 'square',
      freqStart: 1800,
      freqEnd: 420,
      sweepTime: 0.06,
      noise: 0.15,
      noiseFreq: 3000,
      duration: 0.07,
      gain: 0.22,
      hits: 1,
      hitGap: 0,
    },
    {
      id: 'beam.chirp',
      name: 'Chirp',
      osc: 'sine',
      freqStart: 900,
      freqEnd: 2200,
      sweepTime: 0.05,
      noise: 0.1,
      noiseFreq: 2600,
      duration: 0.06,
      gain: 0.2,
      hits: 1,
      hitGap: 0,
    },
    {
      id: 'beam.tick',
      name: 'Tick',
      osc: 'triangle',
      freqStart: 1200,
      freqEnd: 800,
      sweepTime: 0.03,
      noise: 0.5,
      noiseFreq: 3400,
      duration: 0.045,
      gain: 0.18,
      hits: 1,
      hitGap: 0,
    },
  ],
  missile: [
    {
      id: 'missile.whoosh',
      name: 'Whoosh',
      osc: 'sine',
      freqStart: 300,
      freqEnd: 900,
      sweepTime: 0.16,
      noise: 0.8,
      noiseFreq: 1200,
      duration: 0.22,
      gain: 0.34,
      hits: 1,
      hitGap: 0,
    },
    {
      id: 'missile.thump',
      name: 'Thump',
      osc: 'sine',
      freqStart: 160,
      freqEnd: 60,
      sweepTime: 0.08,
      noise: 0.5,
      noiseFreq: 700,
      duration: 0.18,
      gain: 0.4,
      hits: 1,
      hitGap: 0,
    },
    {
      id: 'missile.whistle',
      name: 'Whistle',
      osc: 'triangle',
      freqStart: 700,
      freqEnd: 1900,
      sweepTime: 0.2,
      noise: 0.35,
      noiseFreq: 1600,
      duration: 0.24,
      gain: 0.3,
      hits: 1,
      hitGap: 0,
    },
  ],
  chain: [
    {
      id: 'chain.crackle',
      name: 'Crackle',
      osc: 'sawtooth',
      freqStart: 90,
      freqEnd: 60,
      sweepTime: 0.09,
      noise: 0.85,
      noiseFreq: 2800,
      duration: 0.12,
      gain: 0.34,
      hits: 1,
      hitGap: 0,
    },
    {
      id: 'chain.spark',
      name: 'Spark',
      osc: 'square',
      freqStart: 2000,
      freqEnd: 900,
      sweepTime: 0.03,
      noise: 0.6,
      noiseFreq: 3200,
      duration: 0.05,
      gain: 0.3,
      hits: 3,
      hitGap: 0.045,
    },
    {
      id: 'chain.hum',
      name: 'Hum Zap',
      osc: 'square',
      freqStart: 130,
      freqEnd: 110,
      sweepTime: 0.1,
      noise: 0.5,
      noiseFreq: 2000,
      duration: 0.13,
      gain: 0.3,
      hits: 1,
      hitGap: 0,
    },
  ],
  burst: [
    {
      id: 'burst.rip',
      name: 'Rip',
      osc: 'square',
      freqStart: 900,
      freqEnd: 500,
      sweepTime: 0.02,
      noise: 0.75,
      noiseFreq: 2200,
      duration: 0.035,
      gain: 0.3,
      hits: 7,
      hitGap: 0.022,
    },
    {
      id: 'burst.chug',
      name: 'Chug',
      osc: 'sine',
      freqStart: 240,
      freqEnd: 120,
      sweepTime: 0.02,
      noise: 0.4,
      noiseFreq: 900,
      duration: 0.04,
      gain: 0.32,
      hits: 7,
      hitGap: 0.024,
    },
    {
      id: 'burst.ripper',
      name: 'Ripper',
      osc: 'sawtooth',
      freqStart: 1400,
      freqEnd: 300,
      sweepTime: 0.03,
      noise: 0.85,
      noiseFreq: 2600,
      duration: 0.03,
      gain: 0.28,
      hits: 10,
      hitGap: 0.016,
    },
  ],
  splash: [
    {
      id: 'splash.boom',
      name: 'Boom',
      osc: 'sine',
      freqStart: 140,
      freqEnd: 34,
      sweepTime: 0.18,
      noise: 0.6,
      noiseFreq: 500,
      duration: 0.3,
      gain: 0.5,
      hits: 1,
      hitGap: 0,
    },
    {
      id: 'splash.crump',
      name: 'Crump',
      osc: 'triangle',
      freqStart: 220,
      freqEnd: 50,
      sweepTime: 0.12,
      noise: 0.75,
      noiseFreq: 800,
      duration: 0.22,
      gain: 0.44,
      hits: 1,
      hitGap: 0,
    },
    {
      id: 'splash.thud',
      name: 'Thud',
      osc: 'sine',
      freqStart: 90,
      freqEnd: 28,
      sweepTime: 0.1,
      noise: 0.3,
      noiseFreq: 350,
      duration: 0.26,
      gain: 0.55,
      hits: 1,
      hitGap: 0,
    },
  ],
};

export const DEFAULT_SELECTION: Record<WeaponSoundKind, string> = {
  rail: 'rail.boom',
  beam: 'beam.pew',
  missile: 'missile.whoosh',
  chain: 'chain.crackle',
  burst: 'burst.rip',
  splash: 'splash.boom',
};

interface StoredSfx {
  selection?: Partial<Record<WeaponSoundKind, string>>;
  overrides?: Record<string, Partial<SfxPreset>>;
}

function readStored(): StoredSfx {
  try {
    const raw = localStorage.getItem(SFX_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSfx) : {};
  } catch {
    return {};
  }
}

function writeStored(stored: StoredSfx): void {
  try {
    localStorage.setItem(SFX_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // storage unavailable — session-only sound
  }
}

/** Selected preset id per weapon kind (lab-tuned or default). */
export function getSelection(): Record<WeaponSoundKind, string> {
  return { ...DEFAULT_SELECTION, ...readStored().selection };
}

export function setSelection(kind: WeaponSoundKind, presetId: string): void {
  const stored = readStored();
  stored.selection = { ...stored.selection, [kind]: presetId };
  writeStored(stored);
}

export function getOverride(presetId: string): Partial<SfxPreset> | undefined {
  return readStored().overrides?.[presetId];
}

export function setOverride(presetId: string, params: Partial<SfxPreset>): void {
  const stored = readStored();
  stored.overrides = { ...stored.overrides, [presetId]: params };
  writeStored(stored);
}

export function clearOverride(presetId: string): void {
  const stored = readStored();
  if (stored.overrides) delete stored.overrides[presetId];
  writeStored(stored);
}

/** Preset by id with any lab overrides applied. */
export function resolvePreset(id: string): SfxPreset | undefined {
  for (const presets of Object.values(SFX_PRESETS)) {
    const base = presets.find((p) => p.id === id);
    if (base) return { ...base, ...getOverride(id) };
  }
  return undefined;
}

/** The preset a weapon kind should sound like right now. */
export function presetFor(kind: WeaponSoundKind): SfxPreset | undefined {
  return resolvePreset(getSelection()[kind]);
}
