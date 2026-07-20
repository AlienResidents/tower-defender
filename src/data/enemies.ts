import type { Tier } from './towers';

/** Enemy definitions — pure data. Mechanical only (spec §11). */

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  /** px per second along the path */
  speed: number;
  tier: Tier;
  radius: number;
  /** data-core damage when this unit leaks */
  cores: number;
  /** base palladium dropped on kill (before pressure multiplier) */
  drop: number;
  tint: number;
  scale: number;
  /** regenerating energy shield pool (aegis) */
  shield?: number;
  /** hp/s healed to nearby allies (repair spider) */
  healAura?: number;
  /** anchored siege platform */
  boss?: boolean;
  /** drops an item pick on death */
  elite?: boolean;
}

export const ENEMIES: readonly EnemyDef[] = [
  {
    id: 'walker',
    name: 'Walker Mech',
    hp: 40,
    speed: 55,
    tier: 'street',
    radius: 12,
    cores: 1,
    drop: 1,
    tint: 0xdfe9ff,
    scale: 0.9,
  },
  {
    id: 'swarm',
    name: 'Swarm Drone',
    hp: 12,
    speed: 110,
    tier: 'street',
    radius: 8,
    cores: 1,
    drop: 1,
    tint: 0x9dffea,
    scale: 0.6,
  },
  {
    id: 'siege',
    name: 'Siege Mech',
    hp: 260,
    speed: 28,
    tier: 'mega',
    radius: 16,
    cores: 3,
    drop: 8,
    tint: 0xffb36b,
    scale: 1.35,
    elite: true,
  },
  {
    id: 'aegis',
    name: 'Aegis Unit',
    hp: 60,
    speed: 45,
    tier: 'street',
    radius: 12,
    cores: 2,
    drop: 3,
    tint: 0x9db8ff,
    scale: 1.0,
    shield: 40,
  },
  {
    id: 'spider',
    name: 'Repair Spider',
    hp: 30,
    speed: 52,
    tier: 'street',
    radius: 8,
    cores: 1,
    drop: 2,
    tint: 0x8affa0,
    scale: 0.7,
    healAura: 6,
  },
  {
    id: 'boss',
    name: 'Anchored Siege Platform',
    hp: 2200,
    speed: 18,
    tier: 'mega',
    radius: 24,
    cores: 20,
    drop: 100,
    tint: 0xff8866,
    scale: 2.2,
    boss: true,
    elite: true,
  },
] as const;

export function enemyById(id: string): EnemyDef {
  const def = ENEMIES.find((e) => e.id === id);
  if (!def) throw new RangeError(`unknown enemy: ${id}`);
  return def;
}
