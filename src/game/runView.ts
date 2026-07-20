import { Container, Graphics, Sprite } from 'pixi.js';
import { playWeaponSound } from '../audio/sfx';
import type { Clock } from '../core/clock';
import type { WeaponSoundKind } from '../data/sfx';
import type { EnemyState, Run, RunEvent, TowerState } from '../game/run';
import { makeMechTexture, makeSoftDiscTexture } from '../render/textures';

/** Binds a Run (pure logic) to PixiJS sprites. Subscribes to RunEvents. */

interface Flash {
  node: Graphics | Sprite;
  life: number;
  max: number;
}

export class RunView {
  readonly container = new Container();
  #run: Run;
  #clock: Clock;
  #enemyViews = new Map<number, Container>();
  #hpBars = new Map<number, { bar: Graphics; yOff: number }>();
  #shieldBars = new Map<number, { bar: Graphics; yOff: number }>();
  #anchorRings = new Map<number, Graphics>();
  #towerViews = new Map<number, Container>();
  #towerPips = new Map<number, Graphics>();
  #spiderPulseT = 0;
  #projectileViews = new Map<number, Sprite>();
  #flashes: Flash[] = [];
  #mechTex = makeMechTexture();
  #glowTex = makeSoftDiscTexture();

  constructor(run: Run, clock: Clock) {
    this.#run = run;
    this.#clock = clock;
    run.on((e) => this.#handle(e));
  }

  #addFlash(node: Graphics | Sprite, max: number): void {
    this.container.addChild(node);
    this.#flashes.push({ node, life: 0, max });
  }

  #handle(e: RunEvent): void {
    switch (e.type) {
      case 'spawn':
        this.#addEnemy(e.enemy);
        break;
      case 'death':
        this.#removeEnemy(e.enemy, true);
        break;
      case 'leak':
        this.#removeEnemy(e.enemy, false);
        break;
      case 'fire':
        playWeaponSound(e.tower.def.kind as WeaponSoundKind, this.#clock.scale);
        this.#fireFlash(e.tower, e.target);
        break;
      case 'splash':
        playWeaponSound('splash', this.#clock.scale);
        this.#puff(e.x, e.y, e.radius / 128, 0xffa63d);
        break;
    }
  }

  #addEnemy(e: EnemyState): void {
    const unit = new Container();
    const glow = new Sprite(this.#glowTex);
    glow.anchor.set(0.5);
    glow.tint = 0x66d9ff;
    glow.blendMode = 'add';
    glow.scale.set(0.5 * e.def.scale, 0.16 * e.def.scale);
    glow.y = 14 * e.def.scale;

    const body = new Sprite(this.#mechTex);
    body.anchor.set(0.5);
    body.scale.set(e.def.scale);
    body.tint = e.def.tint;

    const yOff = -22 * e.def.scale;
    const hpBg = new Graphics().rect(-12, yOff, 24, 3).fill({ color: 0x000000, alpha: 0.6 });
    const hp = new Graphics();
    this.#hpBars.set(e.uid, { bar: hp, yOff });

    unit.addChild(glow, body, hpBg, hp);

    // aegis: shield bar above the hp bar
    if (e.maxShield > 0) {
      const shBg = new Graphics().rect(-12, yOff - 5, 24, 2).fill({ color: 0x000000, alpha: 0.6 });
      const sh = new Graphics();
      this.#shieldBars.set(e.uid, { bar: sh, yOff: yOff - 5 });
      unit.addChild(shBg, sh);
    }

    // boss: anchor indicator ring (hidden until anchored)
    if (e.def.boss) {
      const ring = new Graphics();
      ring.circle(0, 0, 34).stroke({ width: 2, color: 0xffa63d, alpha: 0.9 });
      ring.visible = false;
      this.#anchorRings.set(e.uid, ring);
      unit.addChild(ring);
    }

    unit.position.set(e.x, e.y - 6);
    this.#enemyViews.set(e.uid, unit);
    this.container.addChild(unit);
  }

  #removeEnemy(e: EnemyState, died: boolean): void {
    const v = this.#enemyViews.get(e.uid);
    if (v) {
      v.destroy();
      this.#enemyViews.delete(e.uid);
    }
    this.#hpBars.delete(e.uid);
    this.#shieldBars.delete(e.uid);
    this.#anchorRings.delete(e.uid);
    this.#puff(e.x, e.y - 6, died ? 0.35 * e.def.scale + 0.15 : 0.5, died ? e.def.tint : 0xff3355);
  }

  #puff(x: number, y: number, scale: number, tint: number): void {
    const s = new Sprite(this.#glowTex);
    s.anchor.set(0.5);
    s.tint = tint;
    s.blendMode = 'add';
    s.scale.set(scale);
    s.position.set(x, y);
    this.#addFlash(s, 0.35);
  }

  #fireFlash(t: TowerState, target: EnemyState): void {
    const kind = t.def.kind;
    if (kind === 'missile') {
      const m = new Graphics().circle(t.x, t.y, 6).fill({ color: t.def.tint, alpha: 0.9 });
      this.#addFlash(m, 0.1);
      return;
    }
    const g = new Graphics();
    if (kind === 'chain') {
      const mx = (t.x + target.x) / 2 + (Math.random() - 0.5) * 24;
      const my = (t.y + target.y) / 2 + (Math.random() - 0.5) * 24;
      g.moveTo(t.x, t.y)
        .lineTo(mx, my)
        .lineTo(target.x, target.y)
        .stroke({ width: 2, color: t.def.tint, alpha: 0.9 });
      this.#addFlash(g, 0.12);
    } else {
      const width = kind === 'rail' ? 3 : 1.5;
      const alpha = kind === 'rail' ? 0.95 : kind === 'burst' ? 0.55 : 0.7;
      g.moveTo(t.x, t.y).lineTo(target.x, target.y).stroke({ width, color: t.def.tint, alpha });
      this.#addFlash(g, kind === 'rail' ? 0.14 : 0.05);
    }
  }

  addTowerView(t: TowerState): void {
    const unit = new Container();
    const base = new Graphics();
    base.circle(0, 0, 10).fill({ color: 0x0b1020 }).stroke({ width: 1.5, color: t.def.tint });
    const barrel = new Graphics();
    barrel.moveTo(0, 0).lineTo(0, -14).stroke({ width: 3, color: t.def.tint });
    const dot = new Graphics().circle(0, 0, 3).fill(t.def.tint);
    unit.addChild(base, barrel, dot);
    unit.position.set(t.x, t.y);
    this.#towerViews.set(t.uid, unit);
    this.container.addChild(unit);
  }

  /** Per-frame visual sync: positions, hp bars, projectiles, flash lifetimes. */
  sync(dt: number): void {
    this.#spiderPulseT += dt;
    for (const e of this.#run.enemies) {
      const v = this.#enemyViews.get(e.uid);
      if (!v || !e.alive) continue;
      v.position.set(e.x, e.y - 6);
      const hb = this.#hpBars.get(e.uid);
      if (hb) {
        const frac = Math.max(e.hp / e.maxHp, 0);
        hb.bar.clear();
        if (frac < 1) {
          hb.bar
            .rect(-12, hb.yOff, 24 * frac, 3)
            .fill({ color: frac > 0.5 ? 0x66ff99 : frac > 0.25 ? 0xffcc44 : 0xff4455 });
        }
      }
      const sb = this.#shieldBars.get(e.uid);
      if (sb) {
        const frac = e.maxShield > 0 ? Math.max(e.shield / e.maxShield, 0) : 0;
        sb.bar.clear();
        if (frac > 0) {
          sb.bar.rect(-12, sb.yOff, 24 * frac, 2).fill({ color: 0x66aaff });
        }
      }
      const ring = this.#anchorRings.get(e.uid);
      if (ring) ring.visible = e.anchored;
    }

    // repair spiders pulse a heal ring periodically
    if (this.#spiderPulseT > 1.5) {
      this.#spiderPulseT = 0;
      for (const e of this.#run.enemies) {
        if (!e.alive || !e.def.healAura) continue;
        const ring = new Graphics();
        ring.circle(e.x, e.y - 6, 30).stroke({ width: 1.5, color: 0x8affa0, alpha: 0.6 });
        this.#addFlash(ring, 0.6);
      }
    }
    // item pips under towers
    for (const t of this.#run.towers) {
      let pips = this.#towerPips.get(t.uid);
      if (!pips && t.items.length > 0) {
        pips = new Graphics();
        pips.position.set(t.x, t.y + 14);
        this.#towerPips.set(t.uid, pips);
        this.container.addChild(pips);
      }
      if (pips) {
        pips.clear();
        for (let i = 0; i < t.items.length; i++) {
          pips.circle(-6 + i * 12, 0, 3).fill(0xffa63d);
        }
      }
    }
    for (const p of this.#run.projectiles) {
      let s = this.#projectileViews.get(p.uid);
      if (!p.alive) {
        if (s) {
          s.destroy();
          this.#projectileViews.delete(p.uid);
        }
        continue;
      }
      if (!s) {
        s = new Sprite(this.#glowTex);
        s.anchor.set(0.5);
        s.scale.set(0.08);
        s.tint = 0xffa63d;
        s.blendMode = 'add';
        this.#projectileViews.set(p.uid, s);
        this.container.addChild(s);
      }
      s.position.set(p.x, p.y);
    }
    for (let i = this.#flashes.length - 1; i >= 0; i--) {
      const f = this.#flashes[i];
      f.life += dt;
      const k = f.life / f.max;
      if (k >= 1) {
        f.node.destroy();
        this.#flashes.splice(i, 1);
      } else {
        f.node.alpha = 1 - k;
      }
    }
  }
}
