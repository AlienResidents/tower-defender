import type { Rng } from '../core/rng';
import type { EnemyDef } from '../data/enemies';
import { enemyById } from '../data/enemies';
import { ITEMS, MAX_ITEMS_PER_TOWER, ZERO_MODS, type ItemDef, type TowerMods } from '../data/items';
import type { TowerDef } from '../data/towers';
import { WAVES } from '../data/waves';
import type { Path } from '../world/path';
import { applyDamage } from './combat';
import { DiceSystem } from './dice';
import { dropMultiplier } from './economy';
import { WaveSpawner } from './spawner';
import { settings } from '../settings';
import { attrMods, emptyGrid, type AttrGrid } from '../data/attributes';

/**
 * Run — the complete game state of one shift. Pure logic, zero rendering:
 * views subscribe via Run.on() and draw from state (plan §5).
 *
 * Waves can run concurrently (send early); kills credit palladium scaled by
 * the pressure multiplier — more simultaneous waves, bigger drops.
 */

export type Phase = 'build' | 'wave' | 'won' | 'lost';

export interface EnemyState {
  uid: number;
  def: EnemyDef;
  wave: number;
  dist: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  lastDamageT: number;
  anchored: boolean;
  anchorT: number;
  alive: boolean;
  x: number;
  y: number;
}

export interface TowerState {
  uid: number;
  def: TowerDef;
  x: number;
  y: number;
  cooldown: number;
  burstLeft: number;
  reloadT: number;
  mods: TowerMods;
  items: ItemDef[];
}

export interface ProjectileState {
  uid: number;
  def: TowerDef;
  targetUid: number;
  x: number;
  y: number;
  speed: number;
  alive: boolean;
  dmgMult: number;
  auxMult: number;
}

export type RunEvent =
  | { type: 'spawn'; enemy: EnemyState }
  | { type: 'death'; enemy: EnemyState }
  | { type: 'leak'; enemy: EnemyState }
  | { type: 'fire'; tower: TowerState; target: EnemyState }
  | { type: 'splash'; x: number; y: number; radius: number }
  | { type: 'drop'; enemy: EnemyState; amount: number; mult: number }
  | { type: 'eliteDrop'; enemy: EnemyState; items: ItemDef[]; roll: number }
  | { type: 'phase'; phase: Phase; wave: number };

const STARTING_LIVES = 20;
const STARTING_PALLADIUM = settings.economy.startingPalladium;

interface ActiveSpawner {
  spawner: WaveSpawner;
  waveNo: number;
}

export class Run {
  phase: Phase = 'build';
  wave = 0;
  lives = STARTING_LIVES;
  palladium: number = STARTING_PALLADIUM;
  readonly enemies: EnemyState[] = [];
  readonly towers: TowerState[] = [];
  readonly projectiles: ProjectileState[] = [];

  /** Run-summary counters + recent-events log (dev-mode copyout). */
  readonly stats = {
    kills: new Map<string, number>(),
    leaked: new Map<string, number>(),
    palladiumEarned: 0,
    palladiumSpent: 0,
    towersPlaced: new Map<string, number>(),
  };
  readonly log: string[] = [];
  #combatT = 0;

  #path: Path;
  #rng: Rng;
  #spawners: ActiveSpawner[] = [];
  #uid = 1;
  #listeners: ((e: RunEvent) => void)[] = [];

  /** The dice economy — tray, purchases, recharges (spec §8). */
  readonly dice: DiceSystem;

  #attrGrid: AttrGrid = emptyGrid();

  constructor(path: Path, rng: Rng, opts?: { startingPalladium?: number }) {
    this.#path = path;
    this.#rng = rng;
    this.dice = new DiceSystem(rng, {
      balance: () => this.palladium,
      spend: (amount) => {
        if (this.palladium < amount) return false;
        this.palladium -= amount;
        this.stats.palladiumSpent += amount;
        return true;
      },
      credit: (amount) => {
        this.palladium += amount;
      },
    });
    if (opts?.startingPalladium !== undefined) this.palladium = opts.startingPalladium;
  }

  on(fn: (e: RunEvent) => void): void {
    this.#listeners.push(fn);
  }

  #emit(e: RunEvent): void {
    for (const fn of this.#listeners) fn(e);
  }

  /** Number of waves currently in progress (spawning or with live units). */
  activeWaveCount(): number {
    const active = new Set<number>();
    for (const s of this.#spawners) active.add(s.waveNo);
    for (const e of this.enemies) if (e.alive) active.add(e.wave);
    return active.size;
  }

  currentMult(): number {
    return dropMultiplier(this.activeWaveCount());
  }

  #logEvent(text: string): void {
    this.log.push(`[w${this.wave} ${this.#combatT.toFixed(0)}s] ${text}`);
    if (this.log.length > 40) this.log.shift(); // tail only
  }

  placeTower(def: TowerDef, x: number, y: number): TowerState {
    const tower: TowerState = {
      uid: this.#uid++,
      def,
      x,
      y,
      cooldown: 0,
      burstLeft: def.burst ?? 0,
      reloadT: 0,
      mods: { ...ZERO_MODS },
      items: [],
    };
    // attribute grid bonuses stack in at placement (same unit as item mods)
    const attr = attrMods(this.#attrGrid, def.id);
    for (const [k, v] of Object.entries(attr)) {
      tower.mods[k as keyof TowerMods] += v as number;
    }
    this.towers.push(tower);
    this.stats.towersPlaced.set(def.id, (this.stats.towersPlaced.get(def.id) ?? 0) + 1);
    this.#logEvent(`tower placed: ${def.name} @ ${Math.round(x)},${Math.round(y)}`);
    return tower;
  }

  /** Attach the campaign attribute grid (applies to future placements). */
  setAttrGrid(grid: AttrGrid): void {
    this.#attrGrid = grid;
  }

  /** Socket an item onto a tower (max MAX_ITEMS_PER_TOWER). */
  applyItem(towerUid: number, item: ItemDef): boolean {
    const tower = this.towers.find((t) => t.uid === towerUid);
    if (!tower || tower.items.length >= MAX_ITEMS_PER_TOWER) return false;
    tower.items.push(item);
    for (const [k, v] of Object.entries(item.mods)) {
      tower.mods[k as keyof TowerMods] += v as number;
    }
    this.#logEvent(`item: ${item.name} -> ${tower.def.name}`);
    return true;
  }

  /** Swap a socketed item for a new one. Returns the replaced item (used → flat salvage). */
  replaceItem(towerUid: number, index: number, item: ItemDef): ItemDef | null {
    const tower = this.towers.find((t) => t.uid === towerUid);
    if (!tower || index < 0 || index >= tower.items.length) return null;
    const replaced = tower.items[index];
    tower.items[index] = item;
    // mods are additive per item — rebuild from the socket set
    tower.mods = { ...ZERO_MODS };
    for (const it of tower.items) {
      for (const [k, v] of Object.entries(it.mods)) {
        tower.mods[k as keyof TowerMods] += v as number;
      }
    }
    this.#logEvent(`item swap: ${replaced.name} -> ${item.name} on ${tower.def.name}`);
    return replaced;
  }

  /** Start the next wave. Works mid-wave (send early) — waves stack. */
  startWave(): void {
    if (this.phase === 'won' || this.phase === 'lost' || this.wave >= WAVES.length) return;
    this.wave++;
    this.#spawners.push({ spawner: new WaveSpawner(WAVES[this.wave - 1]), waveNo: this.wave });
    this.#logEvent(`wave ${this.wave} sent (${this.activeWaveCount()} active)`);
    if (this.phase === 'build') {
      this.phase = 'wave';
      this.#emit({ type: 'phase', phase: this.phase, wave: this.wave });
    }
  }

  #setPhase(phase: Phase): void {
    this.phase = phase;
    this.#emit({ type: 'phase', phase, wave: this.wave });
  }

  /** Dev/lab hook: spawn an enemy directly (tests, future sandbox). */
  debugSpawn(enemyId: string): EnemyState {
    if (this.phase === 'build') this.phase = 'wave';
    this.#spawn(enemyId, this.wave);
    return this.enemies[this.enemies.length - 1];
  }

  #spawn(enemyId: string, waveNo: number): void {
    const def = enemyById(enemyId);
    const p = this.#path.pointAt(0);
    const enemy: EnemyState = {
      uid: this.#uid++,
      def,
      wave: waveNo,
      dist: 0,
      hp: def.hp,
      maxHp: def.hp,
      shield: def.shield ?? 0,
      maxShield: def.shield ?? 0,
      lastDamageT: 0,
      anchored: false,
      anchorT: 0,
      alive: true,
      x: p.x,
      y: p.y,
    };
    this.enemies.push(enemy);
    this.#emit({ type: 'spawn', enemy });
  }

  #hit(source: TowerDef, enemy: EnemyState, mult = 1): void {
    if (!enemy.alive) return;
    let dmg = applyDamage(source.tier, enemy.def.tier, source.damage * mult);
    if (enemy.def.boss && enemy.anchored) dmg *= 0.4; // anchored: hardened
    enemy.lastDamageT = this.#combatT;
    if (enemy.shield > 0) {
      // tesla EMP strips shields x3; everything else x1
      const shieldMult = source.kind === 'chain' ? 3 : 1;
      const absorbed = Math.min(enemy.shield, dmg * shieldMult);
      enemy.shield -= absorbed;
      dmg -= absorbed / shieldMult;
      if (dmg <= 0) return;
    }
    enemy.hp -= dmg;
    if (enemy.hp <= 0) {
      enemy.alive = false;
      const dropMult = this.currentMult();
      const amount = enemy.def.drop * dropMult;
      this.palladium += amount;
      this.stats.palladiumEarned += amount;
      this.stats.kills.set(enemy.def.id, (this.stats.kills.get(enemy.def.id) ?? 0) + 1);
      this.#emit({ type: 'drop', enemy, amount, mult: dropMult });
      this.#emit({ type: 'death', enemy });
      if (enemy.def.elite) {
        // item drop pool sized by a d4 roll (spec: operator)
        const roll = this.#rng.int(1, 4);
        const pool = [...ITEMS];
        const items: ItemDef[] = [];
        for (let i = 0; i < Math.min(roll, pool.length); i++) {
          items.push(pool.splice(this.#rng.int(0, pool.length - 1), 1)[0]);
        }
        this.#emit({ type: 'eliteDrop', enemy, items, roll });
        this.#logEvent(`elite drop: d4=${roll} -> ${items.map((i) => i.name).join(', ')}`);
      }
    }
  }

  #acquire(tower: TowerState): EnemyState | null {
    const range = tower.def.range * (1 + tower.mods.range);
    let best: EnemyState | null = null;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - tower.x, e.y - tower.y);
      if (d > range) continue;
      if (!best || e.dist > best.dist) best = e; // furthest along the path
    }
    return best;
  }

  #updateTower(tower: TowerState, dt: number): void {
    if (tower.reloadT > 0) {
      tower.reloadT -= dt;
      return;
    }
    tower.cooldown -= dt;
    // epsilon gate: float subtraction leaves cooldown an ulp above zero on
    // exact-boundary rates, costing a frame per shot
    if (tower.cooldown > 1e-9) return;
    const target = this.#acquire(tower);
    if (!target) return;
    const def = tower.def;
    const dmgMult = 1 + tower.mods.damage;
    const auxMult = 1 + tower.mods.aux;

    switch (def.kind) {
      case 'rail':
      case 'beam':
        this.#hit(def, target, dmgMult);
        this.#emit({ type: 'fire', tower, target });
        break;
      case 'chain': {
        this.#hit(def, target, dmgMult);
        this.#emit({ type: 'fire', tower, target });
        const others = this.enemies
          .filter((e) => e.alive && e.uid !== target.uid)
          .map((e) => ({ e, d: Math.hypot(e.x - target.x, e.y - target.y) }))
          .filter((o) => o.d <= def.aux * auxMult)
          .sort((a, b) => a.d - b.d)
          .slice(0, 2);
        others.forEach((o, i) => {
          this.#hit(def, o.e, (i === 0 ? 0.6 : 0.3) * dmgMult);
          this.#emit({ type: 'fire', tower, target: o.e });
        });
        break;
      }
      case 'missile':
        this.projectiles.push({
          uid: this.#uid++,
          def,
          targetUid: target.uid,
          x: tower.x,
          y: tower.y,
          speed: 420,
          alive: true,
          dmgMult,
          auxMult,
        });
        this.#emit({ type: 'fire', tower, target });
        break;
      case 'burst':
        this.#hit(def, target, dmgMult);
        this.#emit({ type: 'fire', tower, target });
        tower.burstLeft--;
        if (tower.burstLeft <= 0) {
          tower.reloadT = (def.reload ?? 0) * (1 - tower.mods.reload);
          tower.burstLeft = (def.burst ?? 0) + tower.mods.burst;
        }
        break;
    }
    tower.cooldown = 1 / (def.fireRate * (1 + tower.mods.rate));
  }

  #updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      const target = this.enemies.find((e) => e.uid === p.targetUid && e.alive);
      const tx = target ? target.x : p.x;
      const ty = target ? target.y : p.y;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (!target || dist <= step) {
        p.alive = false;
        const cx = target ? target.x : p.x;
        const cy = target ? target.y : p.y;
        this.#emit({ type: 'splash', x: cx, y: cy, radius: p.def.aux * p.auxMult });
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const d = Math.hypot(e.x - cx, e.y - cy);
          if (d <= p.def.aux * p.auxMult)
            this.#hit(p.def, e, (e.uid === p.targetUid ? 1 : 0.6) * p.dmgMult);
        }
      } else {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
      }
    }
    if (this.projectiles.length > 64) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        if (!this.projectiles[i].alive) this.projectiles.splice(i, 1);
      }
    }
  }

  update(dt: number): void {
    if (this.phase !== 'wave') return;
    this.#combatT += dt;
    for (const s of this.#spawners) {
      s.spawner.update(dt, (id) => this.#spawn(id, s.waveNo));
    }
    this.#spawners = this.#spawners.filter((s) => !s.spawner.done);

    for (const e of this.enemies) {
      if (!e.alive) continue;
      // boss anchor cycle: moves 5s, locked down 3s (hardened while anchored)
      if (e.def.boss) {
        e.anchorT += dt;
        e.anchored = e.anchorT % 8 >= 5;
      }
      e.dist += (e.anchored ? 0 : e.def.speed) * dt;
      const p = this.#path.pointAt(e.dist);
      e.x = p.x;
      e.y = p.y;
      // shield regen after 3s undamaged
      if (e.maxShield > 0 && e.shield < e.maxShield && this.#combatT - e.lastDamageT > 3) {
        e.shield = Math.min(e.maxShield, e.shield + 12 * dt);
      }
      if (e.dist >= this.#path.totalLength) {
        e.alive = false;
        this.lives -= e.def.cores;
        this.stats.leaked.set(e.def.id, (this.stats.leaked.get(e.def.id) ?? 0) + 1);
        this.#logEvent(`LEAK: ${e.def.name} (-${e.def.cores} cores, ${this.lives} left)`);
        this.#emit({ type: 'leak', enemy: e });
        if (this.lives <= 0) {
          this.lives = 0;
          this.#setPhase('lost');
          return;
        }
      }
    }

    for (const t of this.towers) this.#updateTower(t, dt);
    this.#updateProjectiles(dt);

    // repair spiders heal nearby allies (not themselves, not the boss)
    for (const s of this.enemies) {
      if (!s.alive || !s.def.healAura) continue;
      for (const o of this.enemies) {
        if (!o.alive || o.uid === s.uid || o.def.boss || o.hp >= o.maxHp) continue;
        if (Math.hypot(o.x - s.x, o.y - s.y) <= 60) {
          o.hp = Math.min(o.maxHp, o.hp + s.def.healAura * dt);
        }
      }
    }

    if (this.#spawners.length === 0 && this.enemies.every((e) => !e.alive)) {
      if (this.wave >= WAVES.length) this.#setPhase('won');
      else this.#setPhase('build');
    }
  }

  /** Dev-mode run summary for clipboard copyout. */
  buildRunSummary(seed: number): Record<string, unknown> {
    const d = this.dice;
    return {
      seed,
      outcome: this.phase,
      wave: `${this.wave}/${WAVES.length}`,
      livesRemaining: this.lives,
      combatSeconds: Math.round(this.#combatT),
      kills: Object.fromEntries(this.stats.kills),
      leaked: Object.fromEntries(this.stats.leaked),
      palladium: {
        balance: Math.floor(this.palladium),
        earned: Math.floor(this.stats.palladiumEarned),
        spent: this.stats.palladiumSpent,
      },
      salvage: { balance: Math.floor(d.salvage), earned: Math.floor(d.stats.salvageEarned) },
      dice: {
        tray: d.tray.map((x) => x.sides),
        bought: d.stats.diceBought,
        slots: d.slots,
        chances: d.chances,
      },
      purchases: { success: d.stats.success, bust: d.stats.bust, abandoned: d.stats.abandoned },
      towersPlaced: Object.fromEntries(this.stats.towersPlaced),
      recentEvents: this.log,
    };
  }
}
