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
  /** envelope attack — swells vs instant-on clicks */
  attack: number;
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
  /** optional charge-up whine played before the hit */
  charge?: { osc: OscType; freqStart: number; freqEnd: number; duration: number; gain: number };
  /** optional distinct second transient after the hit (ku-chunk) */
  secondHit?: {
    osc: OscType;
    freqStart: number;
    freqEnd: number;
    duration: number;
    gain: number;
    noise: number;
    noiseFreq: number;
    /** seconds after the main hit */
    at: number;
  };
  /** optional low resonant body under the transient */
  body?: { osc: OscType; freq: number; decay: number; gain: number };
}

export const SFX_STORAGE_KEY = 'phosphor.sfx';

export const SFX_PRESETS: Record<WeaponSoundKind, SfxPreset[]> = {
  rail: [
    {
      id: 'rail.boom',
      name: 'Capacitor',
      osc: 'square',
      freqStart: 900,
      freqEnd: 300,
      sweepTime: 0.03,
      attack: 0.002,
      noise: 0.5,
      noiseFreq: 1400,
      duration: 0.05,
      gain: 0.4,
      hits: 1,
      hitGap: 0,
      charge: { osc: 'sawtooth', freqStart: 280, freqEnd: 1600, duration: 0.65, gain: 0.14 },
      secondHit: {
        osc: 'sine',
        freqStart: 120,
        freqEnd: 35,
        duration: 0.18,
        gain: 0.55,
        noise: 0.5,
        noiseFreq: 700,
        at: 0.07,
      },
      body: { osc: 'sine', freq: 55, decay: 0.3, gain: 0.35 },
    },
    {
      id: 'rail.crack',
      name: 'Coilgun',
      osc: 'square',
      freqStart: 700,
      freqEnd: 220,
      sweepTime: 0.03,
      attack: 0.002,
      noise: 0.65,
      noiseFreq: 1000,
      duration: 0.045,
      gain: 0.42,
      hits: 1,
      hitGap: 0,
      charge: { osc: 'sine', freqStart: 180, freqEnd: 1100, duration: 0.55, gain: 0.16 },
      secondHit: {
        osc: 'sine',
        freqStart: 95,
        freqEnd: 30,
        duration: 0.22,
        gain: 0.6,
        noise: 0.4,
        noiseFreq: 500,
        at: 0.08,
      },
      body: { osc: 'sine', freq: 48, decay: 0.4, gain: 0.4 },
    },
    {
      id: 'rail.railzap',
      name: 'Servo',
      osc: 'sawtooth',
      freqStart: 1600,
      freqEnd: 400,
      sweepTime: 0.03,
      attack: 0.002,
      noise: 0.55,
      noiseFreq: 2200,
      duration: 0.04,
      gain: 0.36,
      hits: 1,
      hitGap: 0,
      charge: { osc: 'triangle', freqStart: 420, freqEnd: 2100, duration: 0.45, gain: 0.12 },
      secondHit: {
        osc: 'sine',
        freqStart: 150,
        freqEnd: 45,
        duration: 0.14,
        gain: 0.5,
        noise: 0.55,
        noiseFreq: 900,
        at: 0.06,
      },
      body: { osc: 'sine', freq: 90, decay: 0.25, gain: 0.3 },
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
      attack: 0.002,
      noise: 0.15,
      noiseFreq: 2400,
      duration: 0.09,
      gain: 0.22,
      hits: 1,
      hitGap: 0,
      body: { osc: 'sine', freq: 300, decay: 0.09, gain: 0.15 },
    },
    {
      id: 'beam.chirp',
      name: 'Chirp',
      osc: 'sine',
      freqStart: 900,
      freqEnd: 2200,
      sweepTime: 0.05,
      attack: 0.006,
      noise: 0.1,
      noiseFreq: 2200,
      duration: 0.08,
      gain: 0.2,
      hits: 1,
      hitGap: 0,
      body: { osc: 'sine', freq: 500, decay: 0.08, gain: 0.12 },
    },
    {
      id: 'beam.tick',
      name: 'Tick',
      osc: 'triangle',
      freqStart: 1200,
      freqEnd: 800,
      sweepTime: 0.03,
      attack: 0.002,
      noise: 0.5,
      noiseFreq: 3000,
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
      sweepTime: 0.2,
      attack: 0.06,
      noise: 0.8,
      noiseFreq: 900,
      duration: 0.35,
      gain: 0.34,
      hits: 1,
      hitGap: 0,
      body: { osc: 'sine', freq: 120, decay: 0.3, gain: 0.2 },
    },
    {
      id: 'missile.thump',
      name: 'Thump',
      osc: 'sine',
      freqStart: 160,
      freqEnd: 55,
      sweepTime: 0.08,
      attack: 0.01,
      noise: 0.5,
      noiseFreq: 600,
      duration: 0.35,
      gain: 0.4,
      hits: 1,
      hitGap: 0,
      body: { osc: 'sine', freq: 55, decay: 0.45, gain: 0.4 },
    },
    {
      id: 'missile.whistle',
      name: 'Whistle',
      osc: 'triangle',
      freqStart: 700,
      freqEnd: 1900,
      sweepTime: 0.22,
      attack: 0.04,
      noise: 0.35,
      noiseFreq: 1400,
      duration: 0.35,
      gain: 0.3,
      hits: 1,
      hitGap: 0,
      body: { osc: 'sine', freq: 200, decay: 0.28, gain: 0.15 },
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
      attack: 0.004,
      noise: 0.85,
      noiseFreq: 1800,
      duration: 0.18,
      gain: 0.34,
      hits: 1,
      hitGap: 0,
      body: { osc: 'sawtooth', freq: 80, decay: 0.2, gain: 0.25 },
    },
    {
      id: 'chain.spark',
      name: 'Spark',
      osc: 'square',
      freqStart: 2000,
      freqEnd: 900,
      sweepTime: 0.03,
      attack: 0.002,
      noise: 0.6,
      noiseFreq: 2800,
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
      attack: 0.006,
      noise: 0.5,
      noiseFreq: 1600,
      duration: 0.2,
      gain: 0.3,
      hits: 1,
      hitGap: 0,
      body: { osc: 'sine', freq: 65, decay: 0.25, gain: 0.3 },
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
      attack: 0.002,
      noise: 0.75,
      noiseFreq: 1600,
      duration: 0.05,
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
      attack: 0.003,
      noise: 0.4,
      noiseFreq: 800,
      duration: 0.05,
      gain: 0.32,
      hits: 7,
      hitGap: 0.024,
      body: { osc: 'sine', freq: 90, decay: 0.05, gain: 0.25 },
    },
    {
      id: 'burst.ripper',
      name: 'Ripper',
      osc: 'sawtooth',
      freqStart: 1400,
      freqEnd: 300,
      sweepTime: 0.03,
      attack: 0.002,
      noise: 0.85,
      noiseFreq: 1800,
      duration: 0.04,
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
      freqEnd: 32,
      sweepTime: 0.2,
      attack: 0.008,
      noise: 0.6,
      noiseFreq: 450,
      duration: 0.5,
      gain: 0.5,
      hits: 1,
      hitGap: 0,
      body: { osc: 'sine', freq: 40, decay: 0.8, gain: 0.55 },
    },
    {
      id: 'splash.crump',
      name: 'Crump',
      osc: 'triangle',
      freqStart: 220,
      freqEnd: 50,
      sweepTime: 0.12,
      attack: 0.01,
      noise: 0.75,
      noiseFreq: 700,
      duration: 0.35,
      gain: 0.44,
      hits: 1,
      hitGap: 0,
      body: { osc: 'sine', freq: 60, decay: 0.4, gain: 0.4 },
    },
    {
      id: 'splash.thud',
      name: 'Thud',
      osc: 'sine',
      freqStart: 90,
      freqEnd: 26,
      sweepTime: 0.1,
      attack: 0.012,
      noise: 0.3,
      noiseFreq: 320,
      duration: 0.4,
      gain: 0.55,
      hits: 1,
      hitGap: 0,
      body: { osc: 'sine', freq: 36, decay: 0.7, gain: 0.6 },
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
  // merge into the existing override — each slider keeps its own change
  const existing = stored.overrides?.[presetId] ?? {};
  stored.overrides = { ...stored.overrides, [presetId]: { ...existing, ...params } };
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
