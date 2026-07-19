import { Container, Sprite } from 'pixi.js';
import type { Rng } from '../core/rng';
import { PALETTE } from '../data/palette';
import { makeRingTexture, makeStreakTexture } from '../render/textures';

/** Weather system contract — PixiJS and WebGPU implementations both satisfy this. */
export interface WeatherSystem {
  readonly container: Container;
  update(dt: number): void;
}

interface Streak {
  sprite: Sprite;
  speed: number;
  drift: number;
  landY: number;
}

interface Splash {
  sprite: Sprite;
  life: number;
}

/**
 * PixiJS-native rain — batched streak sprites with splash rings on landing.
 * This is the guaranteed-beautiful baseline; the WebGPU spike replaces it
 * only if it proves out (and only after operator sign-off).
 */
export class PixiRain implements WeatherSystem {
  readonly container = new Container();
  #streaks: Streak[] = [];
  #splashes: Splash[] = [];
  #splashPool: Sprite[] = [];
  #width: number;
  #height: number;
  #wind: number;

  constructor(rng: Rng, width: number, height: number, count = 700) {
    this.#width = width;
    this.#height = height;
    this.#wind = -34; // slight slant, wind from the right

    const streakTex = makeStreakTexture();
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(streakTex);
      sprite.anchor.set(0.5, 1);
      sprite.tint = PALETTE.rainStreak;
      sprite.alpha = rng.range(0.15, 0.4);
      sprite.rotation = Math.atan2(this.#wind, 900);
      this.container.addChild(sprite);
      this.#streaks.push(this.#spawn(sprite, rng, true));
    }

    const ringTex = makeRingTexture();
    for (let i = 0; i < 90; i++) {
      const ring = new Sprite(ringTex);
      ring.anchor.set(0.5);
      ring.tint = PALETTE.rainStreak;
      ring.visible = false;
      ring.blendMode = 'add';
      this.container.addChild(ring);
      this.#splashPool.push(ring);
    }
  }

  #spawn(sprite: Sprite, rng: Rng, anywhere: boolean): Streak {
    const x = rng.range(-20, this.#width + 20);
    const y = anywhere ? rng.range(-this.#height, this.#height) : rng.range(-80, -10);
    sprite.position.set(x, y);
    // rain lands across the lower two-thirds of the scene (streets + rooftops)
    const landY = this.#height * rng.range(0.55, 0.98);
    return { sprite, speed: rng.range(650, 950), drift: this.#wind * rng.range(0.8, 1.2), landY };
  }

  #splash(x: number, y: number): void {
    const ring = this.#splashPool.pop();
    if (!ring) return;
    ring.visible = true;
    ring.position.set(x, y);
    this.#splashes.push({ sprite: ring, life: 0 });
  }

  update(dt: number): void {
    for (let i = 0; i < this.#streaks.length; i++) {
      const s = this.#streaks[i];
      s.sprite.y += s.speed * dt;
      s.sprite.x += s.drift * dt;
      if (s.sprite.y >= s.landY) {
        this.#splash(s.sprite.x, s.landY);
        // respawn at top with fresh lateral position
        s.sprite.position.set(
          ((s.sprite.x % this.#width) + this.#width) % this.#width,
          -20 - (i % 40),
        );
        s.landY = this.#height * (0.55 + ((i * 37) % 43) / 100);
      }
    }
    for (let i = this.#splashes.length - 1; i >= 0; i--) {
      const sp = this.#splashes[i];
      sp.life += dt;
      const t = sp.life / 0.3;
      if (t >= 1) {
        sp.sprite.visible = false;
        this.#splashPool.push(sp.sprite);
        this.#splashes.splice(i, 1);
      } else {
        // small squashed ellipses — ground ripples, not bubbles
        const s = 0.12 + t * 0.3;
        sp.sprite.scale.set(s, s * 0.32);
        sp.sprite.alpha = 0.35 * (1 - t);
      }
    }
  }
}
