/** Tower definitions — pure data (plan §5: content is data-driven). */

export type TowerKind = 'rail' | 'beam' | 'missile' | 'chain' | 'burst';
export type Tier = 'street' | 'mega';

export interface TowerDef {
  id: string;
  name: string;
  key: string; // select hotkey
  tier: Tier;
  kind: TowerKind;
  range: number; // px
  fireRate: number; // shots per second
  damage: number;
  /** missile splash radius / chain bounce range, where applicable */
  aux: number;
  /** rounds per burst (kind 'burst') */
  burst?: number;
  /** seconds to reload after a burst (kind 'burst') */
  reload?: number;
  tint: number;
}

export const TOWERS: readonly TowerDef[] = [
  {
    id: 'railgun',
    name: 'Railgun',
    key: 'q',
    tier: 'mega',
    kind: 'rail',
    range: 260,
    fireRate: 0.5,
    damage: 55,
    aux: 0,
    tint: 0x9df5ff,
  },
  {
    id: 'laser',
    name: 'Pulse Laser',
    key: 'w',
    tier: 'street',
    kind: 'beam',
    range: 170,
    fireRate: 4,
    damage: 3,
    aux: 0,
    tint: 0xff2bd6,
  },
  {
    id: 'missile',
    name: 'Missile Pod',
    key: 'e',
    tier: 'mega',
    kind: 'missile',
    range: 230,
    fireRate: 0.8,
    damage: 22,
    aux: 55,
    tint: 0xffa63d,
  },
  {
    id: 'tesla',
    name: 'Tesla ARC',
    key: 'r',
    tier: 'street',
    kind: 'chain',
    range: 140,
    fireRate: 1.2,
    damage: 9,
    aux: 75,
    tint: 0x66d9ff,
  },
  {
    id: 'vulcan',
    name: 'Vulcan',
    key: 't',
    tier: 'street',
    kind: 'burst',
    range: 190,
    fireRate: 12,
    damage: 2,
    aux: 0,
    burst: 14,
    reload: 1.3,
    tint: 0xffe66b,
  },
] as const;

export function towerById(id: string): TowerDef {
  const def = TOWERS.find((t) => t.id === id);
  if (!def) throw new RangeError(`unknown tower: ${id}`);
  return def;
}

export function towerByKey(key: string): TowerDef | undefined {
  return TOWERS.find((t) => t.key === key);
}
