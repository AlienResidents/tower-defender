import type { Rng } from '../core/rng';
import type { EnemyDef } from '../data/enemies';
import { enemyById } from '../data/enemies';
import type { TowerDef } from '../data/towers';
import { WAVES } from '../data/waves';
import type { Path } from '../world/path';
import { applyDamage } from './combat';
import { DiceSystem } from './dice';
import { dropMultiplier } from './economy';
import { WaveSpawner } from './spawner';

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
}

export interface ProjectileState {
  uid: number;
  def: TowerDef;
  targetUid: number;
  x: number;
  y: number;
  speed: number;
  alive: boolean;
}

export type RunEvent =
  | { type: 'spawn'; enemy: EnemyState }
  | { type: 'death'; enemy: EnemyState }
  | { type: 'leak'; enemy: EnemyState }
  | { type: 'fire'; tower: TowerState; target: EnemyState }
  | { type: 'splash'; x: number; y: number; radius: number }
  | { type: 'drop'; enemy: EnemyState; amount: number; mult: number }
  | { type: 'phase'; phase: Phase; wave: number };

const STARTING_LIVES = 20;
const STARTING_PALLADIUM = 100;

interface ActiveSpawner {
  spawner: WaveSpawner;
  waveNo: number;
}

export class Run {
  phase: Phase = 'build';
  wave = 0;
  lives = STARTING_LIVES;
  palladium = STARTING_PALLADIUM;
  readonly enemies: EnemyState[] = [];
  readonly towers: TowerState[] = [];
  readonly projectiles: ProjectileState[] = [];

  #path: Path;
  #spawners: ActiveSpawner[] = [];
  #uid = 1;
  #listeners: ((e: RunEvent) => void)[] = [];

  /** The dice economy — tray, purchases, recharges (spec §8). */
  readonly dice: DiceSystem;

  constructor(path: Path, rng: Rng) {
    this.#path = path;
    this.dice = new DiceSystem(rng, {
      balance: () => this.palladium,
      spend: (amount) => {
        if (this.palladium < amount) return false;
        this.palladium -= amount;
        return true;
      },
      credit: (amount) => {
        this.palladium += amount;
      },
    });
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

  placeTower(def: TowerDef, x: number, y: number): TowerState {
    const tower: TowerState = {
      uid: this.#uid++,
      def,
      x,
      y,
      cooldown: 0,
      burstLeft: def.burst ?? 0,
      reloadT: 0,
    };
    this.towers.push(tower);
    return tower;
  }

  /** Start the next wave. Works mid-wave (send early) — waves stack. */
  startWave(): void {
    if (this.phase === 'won' || this.phase === 'lost' || this.wave >= WAVES.length) return;
    this.wave++;
    this.#spawners.push({ spawner: new WaveSpawner(WAVES[this.wave - 1]), waveNo: this.wave });
    if (this.phase === 'build') {
      this.phase = 'wave';
      this.#emit({ type: 'phase', phase: this.phase, wave: this.wave });
    }
  }

  #setPhase(phase: Phase): void {
    this.phase = phase;
    this.#emit({ type: 'phase', phase, wave: this.wave });
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
      alive: true,
      x: p.x,
      y: p.y,
    };
    this.enemies.push(enemy);
    this.#emit({ type: 'spawn', enemy });
  }

  #hit(source: TowerDef, enemy: EnemyState, mult = 1): void {
    if (!enemy.alive) return;
    enemy.hp -= applyDamage(source.tier, enemy.def.tier, source.damage * mult);
    if (enemy.hp <= 0) {
      enemy.alive = false;
      const dropMult = this.currentMult();
      const amount = enemy.def.drop * dropMult;
      this.palladium += amount;
      this.#emit({ type: 'drop', enemy, amount, mult: dropMult });
      this.#emit({ type: 'death', enemy });
    }
  }

  #acquire(tower: TowerState): EnemyState | null {
    let best: EnemyState | null = null;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - tower.x, e.y - tower.y);
      if (d > tower.def.range) continue;
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

    switch (def.kind) {
      case 'rail':
      case 'beam':
        this.#hit(def, target);
        this.#emit({ type: 'fire', tower, target });
        break;
      case 'chain': {
        this.#hit(def, target);
        this.#emit({ type: 'fire', tower, target });
        const others = this.enemies
          .filter((e) => e.alive && e.uid !== target.uid)
          .map((e) => ({ e, d: Math.hypot(e.x - target.x, e.y - target.y) }))
          .filter((o) => o.d <= def.aux)
          .sort((a, b) => a.d - b.d)
          .slice(0, 2);
        others.forEach((o, i) => {
          this.#hit(def, o.e, i === 0 ? 0.6 : 0.3);
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
        });
        this.#emit({ type: 'fire', tower, target });
        break;
      case 'burst':
        this.#hit(def, target);
        this.#emit({ type: 'fire', tower, target });
        tower.burstLeft--;
        if (tower.burstLeft <= 0) {
          tower.reloadT = def.reload ?? 0;
          tower.burstLeft = def.burst ?? 0;
        }
        break;
    }
    tower.cooldown = 1 / def.fireRate;
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
        this.#emit({ type: 'splash', x: cx, y: cy, radius: p.def.aux });
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const d = Math.hypot(e.x - cx, e.y - cy);
          if (d <= p.def.aux) this.#hit(p.def, e, e.uid === p.targetUid ? 1 : 0.6);
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
    for (const s of this.#spawners) {
      s.spawner.update(dt, (id) => this.#spawn(id, s.waveNo));
    }
    this.#spawners = this.#spawners.filter((s) => !s.spawner.done);

    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.dist += e.def.speed * dt;
      const p = this.#path.pointAt(e.dist);
      e.x = p.x;
      e.y = p.y;
      if (e.dist >= this.#path.totalLength) {
        e.alive = false;
        this.lives -= e.def.cores;
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

    if (this.#spawners.length === 0 && this.enemies.every((e) => !e.alive)) {
      if (this.wave >= WAVES.length) this.#setPhase('won');
      else this.#setPhase('build');
    }
  }
}
