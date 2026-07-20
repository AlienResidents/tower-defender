/**
 * Parametric mech designs — the enemy unit look layer.
 *
 * A MechSpec is a list of parts; each part type has a fixed slider schema
 * (PART_SCHEMAS) that drives both the renderer and the /lab workshop UI.
 * The workshop edits overrides in localStorage; baked defaults below ship
 * with the game. Same pipeline as the SFX lab.
 */

export type MechPartType = 'torso' | 'legs' | 'head' | 'weapon' | 'core' | 'shield';

export interface MechPart {
  id: string;
  type: MechPartType;
  params: Record<string, number>;
}

export interface MechSpec {
  id: string;
  name: string;
  parts: MechPart[];
}

export interface SliderDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

/** Slider schema per part type — the workshop renders these for the selected part. */
export const PART_SCHEMAS: Record<MechPartType, SliderDef[]> = {
  torso: [
    { key: 'w', label: 'width', min: 14, max: 64, step: 1 },
    { key: 'h', label: 'height', min: 8, max: 40, step: 1 },
    { key: 'shape', label: 'shape 0=box 1=hex 2=wedge', min: 0, max: 2, step: 1 },
  ],
  legs: [
    { key: 'count', label: 'legs (2/4/6)', min: 2, max: 6, step: 2 },
    { key: 'len', label: 'length', min: 8, max: 30, step: 1 },
    { key: 'spread', label: 'spread', min: 6, max: 34, step: 1 },
  ],
  head: [
    { key: 'size', label: 'size', min: 3, max: 16, step: 1 },
    { key: 'shape', label: 'shape 0=dome 1=visor 2=antenna', min: 0, max: 2, step: 1 },
  ],
  weapon: [
    { key: 'len', label: 'barrel length', min: 6, max: 34, step: 1 },
    { key: 'w', label: 'barrel width', min: 2, max: 8, step: 1 },
    { key: 'side', label: 'side 0=R 1=L 2=both', min: 0, max: 2, step: 1 },
  ],
  core: [{ key: 'size', label: 'glow size', min: 2, max: 10, step: 1 }],
  shield: [
    { key: 'radius', label: 'radius', min: 22, max: 52, step: 1 },
    { key: 'alpha', label: 'opacity ×100', min: 10, max: 60, step: 1 },
  ],
};

function part(type: MechPartType, params: Record<string, number>): MechPart {
  return { id: `${type}-1`, type, params };
}

/** Baked defaults, one per enemy archetype (tuned in /lab, then copied here). */
export const MECH_DEFAULTS: Record<string, MechSpec> = {
  walker: {
    id: 'walker',
    name: 'SCAV WALKER',
    parts: [
      part('legs', { count: 2, len: 14, spread: 10 }),
      part('torso', { w: 22, h: 14, shape: 0 }),
      part('head', { size: 5, shape: 0 }),
      part('core', { size: 3 }),
    ],
  },
  swarm: {
    id: 'swarm',
    name: 'SKIMMER',
    parts: [
      part('legs', { count: 2, len: 18, spread: 8 }),
      part('torso', { w: 18, h: 10, shape: 2 }),
      part('head', { size: 4, shape: 1 }),
    ],
  },
  siege: {
    id: 'siege',
    name: 'BULWARK HAULER',
    parts: [
      part('legs', { count: 4, len: 16, spread: 22 }),
      part('torso', { w: 44, h: 24, shape: 0 }),
      part('core', { size: 6 }),
      part('weapon', { len: 14, w: 4, side: 0 }),
    ],
  },
  aegis: {
    id: 'aegis',
    name: 'AEGIS CARRIER',
    parts: [
      part('legs', { count: 4, len: 15, spread: 18 }),
      part('torso', { w: 30, h: 18, shape: 1 }),
      part('head', { size: 5, shape: 0 }),
      part('shield', { radius: 34, alpha: 22 }),
    ],
  },
  spider: {
    id: 'spider',
    name: 'MENDER SPIDER',
    parts: [
      part('legs', { count: 6, len: 12, spread: 20 }),
      part('torso', { w: 20, h: 12, shape: 1 }),
      part('head', { size: 4, shape: 2 }),
      part('core', { size: 3 }),
    ],
  },
  boss: {
    id: 'boss',
    name: 'SIEGE PLATFORM',
    parts: [
      part('legs', { count: 6, len: 22, spread: 30 }),
      part('torso', { w: 56, h: 30, shape: 2 }),
      part('head', { size: 8, shape: 0 }),
      part('weapon', { len: 26, w: 6, side: 2 }),
      part('core', { size: 8 }),
    ],
  },
};

const STORAGE_KEY = 'phosphor.mechs.v1';

export function loadMechOverrides(): Record<string, MechSpec> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, MechSpec>;
  } catch {
    // ignore
  }
  return {};
}

export function saveMechOverride(spec: MechSpec): void {
  try {
    const all = loadMechOverrides();
    all[spec.id] = spec;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // session-only
  }
}

export function clearMechOverride(id: string): void {
  try {
    const all = loadMechOverrides();
    delete all[id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

/** The effective spec for an enemy id — lab override wins, else baked default. */
export function mechSpecFor(enemyId: string): MechSpec {
  const overrides = loadMechOverrides();
  return overrides[enemyId] ?? MECH_DEFAULTS[enemyId] ?? MECH_DEFAULTS.walker;
}
