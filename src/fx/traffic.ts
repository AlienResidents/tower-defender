import { Container, Sprite } from 'pixi.js';
import type { Rng } from '../core/rng';
import { PALETTE } from '../data/palette';
import { makeSoftDiscTexture, makeSpinnerTexture } from '../render/textures';

interface Spinner {
  root: Container;
  strobe: Sprite;
  laneY: number;
  speed: number;
  dir: 1 | -1;
  bobPhase: number;
  blinkSeed: number;
}

/** Distant spinner fly-bys — hull silhouette, nav strobes, engine trail. */
export class TrafficSystem {
  readonly container = new Container();
  #spinners: Spinner[] = [];
  #width: number;
  #t = 0;

  constructor(rng: Rng, width: number, height: number, count = 6) {
    this.#width = width;
    const glowTex = makeSoftDiscTexture();
    const hullTex = makeSpinnerTexture();
    for (let i = 0; i < count; i++) {
      const dir: 1 | -1 = rng.next() < 0.5 ? 1 : -1;
      const scale = rng.range(0.6, 1.2);
      const root = new Container();

      // engine trail — stretched glow behind the hull
      const trail = new Sprite(glowTex);
      trail.anchor.set(1, 0.5);
      trail.tint = PALETTE.engineGlow;
      trail.blendMode = 'add';
      trail.alpha = 0.22;
      trail.scale.set(0.5 * scale, 0.06 * scale);
      trail.x = -28 * scale * dir;
      root.addChild(trail);

      // dart hull, flipped to travel direction
      const hull = new Sprite(hullTex);
      hull.anchor.set(0.5);
      hull.scale.set(scale * dir, scale);
      hull.tint = 0xaebbd6;
      root.addChild(hull);

      // rear nav light
      const rear = new Sprite(glowTex);
      rear.anchor.set(0.5);
      rear.tint = 0xff4455;
      rear.blendMode = 'add';
      rear.scale.set(0.06 * scale);
      rear.x = -24 * scale * dir;
      root.addChild(rear);

      // top strobe
      const strobe = new Sprite(glowTex);
      strobe.anchor.set(0.5);
      strobe.tint = 0xffffff;
      strobe.blendMode = 'add';
      strobe.scale.set(0.05 * scale);
      strobe.y = -6 * scale;
      root.addChild(strobe);

      root.position.set(rng.range(-0.1, 1.1) * width, height * rng.range(0.06, 0.3));
      this.container.addChild(root);
      this.#spinners.push({
        root,
        strobe,
        laneY: root.y,
        speed: rng.range(60, 170) * scale,
        dir,
        bobPhase: rng.range(0, Math.PI * 2),
        blinkSeed: rng.range(0, 20),
      });
    }
  }

  update(dt: number): void {
    this.#t += dt;
    for (const s of this.#spinners) {
      s.root.x += s.speed * s.dir * dt;
      s.root.y = s.laneY + Math.sin(this.#t * 1.3 + s.bobPhase) * 3;
      s.strobe.alpha = Math.sin(this.#t * 6 + s.blinkSeed) > 0.75 ? 0.95 : 0.05;
      const margin = 80;
      if (s.root.x > this.#width + margin) s.root.x = -margin;
      else if (s.root.x < -margin) s.root.x = this.#width + margin;
    }
  }
}
