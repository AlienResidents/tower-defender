/** Item upgrades — elite drops, pick 1 of 3, socketed onto towers (spec §8). */

export interface TowerMods {
  /** additive fractions: 0.25 = +25% */
  damage: number;
  range: number;
  rate: number;
  aux: number;
  /** additive rounds (vulcan burst) */
  burst: number;
  /** subtractive fraction of reload time: 0.35 = -35% */
  reload: number;
}

export const ZERO_MODS: TowerMods = {
  damage: 0,
  range: 0,
  rate: 0,
  aux: 0,
  burst: 0,
  reload: 0,
};

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  mods: Partial<TowerMods>;
}

export const ITEMS: readonly ItemDef[] = [
  { id: 'amp', name: 'AMP ROUNDS', desc: '+25% damage', mods: { damage: 0.25 } },
  { id: 'scope', name: 'TARGETING SCOPE', desc: '+20% range', mods: { range: 0.2 } },
  { id: 'overclock', name: 'OVERCLOCK CORE', desc: '+25% fire rate', mods: { rate: 0.25 } },
  { id: 'payload', name: 'PAYLOAD BAY', desc: '+30% splash/chain range', mods: { aux: 0.3 } },
  { id: 'drum', name: 'EXTENDED DRUM', desc: '+6 burst rounds', mods: { burst: 6 } },
  { id: 'coolant', name: 'COOLANT LOOP', desc: '-35% reload time', mods: { reload: 0.35 } },
] as const;

export const MAX_ITEMS_PER_TOWER = 2;
