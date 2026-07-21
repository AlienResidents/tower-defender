/**
 * Parametric tower designs — the tower look layer, mirroring the mech pipeline.
 *
 * A TowerDesign is part-keyed (base/mount/turret/barrel/core/dish); schemas
 * drive the /lab sliders. Overrides live in localStorage; baked defaults ship.
 * Towers render as two textures: static BASE and rotating TURRET (aims in-game).
 */

export type TowerPartType = 'base' | 'mount' | 'turret' | 'barrel' | 'core' | 'dish';

export interface TowerPart {
  id: string;
  type: TowerPartType;
  params: Record<string, number>;
}

export interface TowerDesign {
  id: string;
  name: string;
  parts: TowerPart[];
}

export interface TowerSliderDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const TOWER_SCHEMAS: Record<TowerPartType, TowerSliderDef[]> = {
  base: [
    { key: 'w', label: 'width', min: 10, max: 26, step: 1 },
    { key: 'shape', label: 'shape 0=pad 1=block 2=platform', min: 0, max: 2, step: 1 },
  ],
  mount: [
    { key: 'kind', label: 'kind 0=legs 1=pillar 2=tripod', min: 0, max: 2, step: 1 },
    { key: 'h', label: 'height', min: 3, max: 12, step: 1 },
  ],
  turret: [
    { key: 'w', label: 'width', min: 6, max: 18, step: 1 },
    { key: 'h', label: 'height', min: 4, max: 12, step: 1 },
    { key: 'shape', label: 'shape 0=box 1=dome 2=wedge', min: 0, max: 2, step: 1 },
  ],
  barrel: [
    { key: 'count', label: 'barrels (0=coil)', min: 0, max: 2, step: 1 },
    { key: 'len', label: 'length', min: 4, max: 22, step: 1 },
    { key: 'w', label: 'width', min: 1, max: 4, step: 1 },
  ],
  core: [{ key: 'size', label: 'glow size', min: 0, max: 6, step: 1 }],
  dish: [{ key: 'kind', label: 'kind 0=none 1=antenna 2=dish 3=coils', min: 0, max: 3, step: 1 }],
};

function tpart(type: TowerPartType, params: Record<string, number>): TowerPart {
  return { id: `${type}-1`, type, params };
}

/** Baked defaults, one per tower archetype (tuned in /lab, then copied here). */
export const TOWER_DEFAULTS: Record<string, TowerDesign> = {
  railgun: {
    id: 'railgun',
    name: 'RAILGUN',
    parts: [
      tpart('base', { w: 18, shape: 2 }),
      tpart('mount', { kind: 1, h: 7 }),
      tpart('turret', { w: 10, h: 6, shape: 2 }),
      tpart('barrel', { count: 2, len: 20, w: 1 }),
      tpart('core', { size: 3 }),
    ],
  },
  laser: {
    id: 'laser',
    name: 'BEAM ARRAY',
    parts: [
      tpart('base', { w: 16, shape: 0 }),
      tpart('mount', { kind: 1, h: 6 }),
      tpart('turret', { w: 9, h: 7, shape: 1 }),
      tpart('barrel', { count: 1, len: 10, w: 2 }),
      tpart('core', { size: 4 }),
      tpart('dish', { kind: 2 }),
    ],
  },
  missile: {
    id: 'missile',
    name: 'MISSILE POD',
    parts: [
      tpart('base', { w: 18, shape: 1 }),
      tpart('mount', { kind: 0, h: 5 }),
      tpart('turret', { w: 12, h: 8, shape: 0 }),
      tpart('barrel', { count: 2, len: 8, w: 3 }),
      tpart('dish', { kind: 1 }),
    ],
  },
  tesla: {
    id: 'tesla',
    name: 'TESLA COIL',
    parts: [
      tpart('base', { w: 16, shape: 2 }),
      tpart('mount', { kind: 1, h: 9 }),
      tpart('turret', { w: 8, h: 5, shape: 1 }),
      tpart('barrel', { count: 0, len: 6, w: 1 }),
      tpart('core', { size: 5 }),
      tpart('dish', { kind: 3 }),
    ],
  },
  vulcan: {
    id: 'vulcan',
    name: 'VULCAN',
    parts: [
      tpart('base', { w: 18, shape: 1 }),
      tpart('mount', { kind: 2, h: 6 }),
      tpart('turret', { w: 11, h: 7, shape: 0 }),
      tpart('barrel', { count: 2, len: 13, w: 2 }),
      tpart('core', { size: 3 }),
    ],
  },
};

const STORAGE_KEY = 'phosphor.towers.v1';

export function loadTowerOverrides(): Record<string, TowerDesign> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, TowerDesign>;
  } catch {
    // ignore
  }
  return {};
}

export function saveTowerOverride(design: TowerDesign): void {
  try {
    const all = loadTowerOverrides();
    all[design.id] = design;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // session-only
  }
}

export function clearTowerOverride(id: string): void {
  try {
    const all = loadTowerOverrides();
    delete all[id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

/** Effective design for a tower id — lab override wins, else baked default. */
export function towerDesignFor(towerId: string): TowerDesign {
  const overrides = loadTowerOverrides();
  return overrides[towerId] ?? TOWER_DEFAULTS[towerId] ?? TOWER_DEFAULTS.vulcan;
}
