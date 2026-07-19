import { Container, Sprite } from 'pixi.js';
import type { Rng } from '../core/rng';
import { PALETTE } from '../data/palette';
import { makeSoftDiscTexture } from '../render/textures';
import type { VentSpec } from '../world/city-layout';

interface Puff {
  sprite: Sprite;
  life: number;
  maxLife: number;
  rise: number;
  drift: number;
  grow: number;
  baseAlpha: number;
}

/** Steam/smoke vents — volumetric-feel soft puffs drifting up from the streets. */
export class SmokeSystem {
  readonly container = new Container();
  #puffs: Puff[] = [];
  #rng: Rng;
  #vents: VentSpec[];
  #spawnTimers: number[];

  constructor(rng: Rng, vents: VentSpec[]) {
    this.#rng = rng;
    this.#vents = vents;
    this.#spawnTimers = vents.map((_, i) => i * 0.35);
  }

  #spawn(vent: VentSpec): void {
    const rng = this.#rng;
    const sprite = new Sprite(makeSoftDiscTexture());
    sprite.anchor.set(0.5);
    sprite.tint = PALETTE.smoke;
    sprite.position.set(vent.x + rng.range(-6, 6), vent.y);
    const size = rng.range(26, 54);
    sprite.scale.set(size / 128);
    this.container.addChild(sprite);
    this.#puffs.push({
      sprite,
      life: 0,
      maxLife: rng.range(3.2, 5.5),
      rise: rng.range(26, 44),
      drift: rng.range(-14, -4), // same wind as the rain
      grow: rng.range(0.35, 0.7),
      baseAlpha: rng.range(0.1, 0.2),
    });
  }

  update(dt: number): void {
    this.#spawnTimers = this.#spawnTimers.map((timer, i) => {
      const next = timer - dt;
      if (next <= 0) {
        this.#spawn(this.#vents[i]);
        return this.#rng.range(0.5, 0.9);
      }
      return next;
    });
    for (let i = this.#puffs.length - 1; i >= 0; i--) {
      const p = this.#puffs[i];
      p.life += dt;
      const t = p.life / p.maxLife;
      if (t >= 1) {
        p.sprite.destroy();
        this.#puffs.splice(i, 1);
        continue;
      }
      p.sprite.y -= p.rise * dt;
      p.sprite.x += p.drift * dt;
      const grow = 1 + p.grow * dt;
      p.sprite.scale.set(p.sprite.scale.x * grow);
      // fade in fast, out slow
      p.sprite.alpha = p.baseAlpha * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
    }
  }
}
