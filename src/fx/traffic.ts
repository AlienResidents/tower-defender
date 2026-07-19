import { Container, Sprite } from 'pixi.js';
import type { Rng } from '../core/rng';
import { makeSoftDiscTexture } from '../render/textures';

interface Spinner {
  front: Sprite;
  rear: Sprite;
  laneY: number;
  speed: number;
  dir: 1 | -1;
  bobPhase: number;
}

/** Distant spinner fly-bys — paired headlights/taillights crossing the sky lanes. */
export class TrafficSystem {
  readonly container = new Container();
  #spinners: Spinner[] = [];
  #width: number;

  constructor(rng: Rng, width: number, height: number, count = 6) {
    this.#width = width;
    const tex = makeSoftDiscTexture();
    for (let i = 0; i < count; i++) {
      const dir: 1 | -1 = rng.next() < 0.5 ? 1 : -1;
      const scale = rng.range(0.5, 1.1); // depth via size
      const front = new Sprite(tex);
      front.anchor.set(0.5);
      front.tint = 0xfff4d6;
      front.scale.set(0.09 * scale);
      front.blendMode = 'add';
      const rear = new Sprite(tex);
      rear.anchor.set(0.5);
      rear.tint = 0xff4455;
      rear.scale.set(0.07 * scale);
      rear.blendMode = 'add';
      this.container.addChild(front, rear);
      this.#spinners.push({
        front,
        rear,
        laneY: height * rng.range(0.06, 0.3),
        speed: rng.range(60, 170) * scale,
        dir,
        bobPhase: rng.range(0, Math.PI * 2),
      });
      this.#place(this.#spinners[i], rng.range(-0.1, 1.1) * width);
    }
  }

  #place(s: Spinner, x: number): void {
    const gap = 14 * s.dir;
    s.front.position.set(x + gap / 2, s.laneY);
    s.rear.position.set(x - gap / 2, s.laneY);
  }

  #t = 0;

  update(dt: number): void {
    this.#t += dt;
    for (const s of this.#spinners) {
      const x = s.front.x + s.speed * s.dir * dt;
      const bob = Math.sin(this.#t * 1.3 + s.bobPhase) * 3;
      const gap = 14 * s.dir;
      s.front.position.set(x + (gap * 0) / 2, s.laneY + bob);
      s.rear.position.set(x - gap, s.laneY + bob * 0.8);
      const margin = 80;
      if (x > this.#width + margin || x < -margin) {
        this.#place(s, s.dir === 1 ? -margin : this.#width + margin);
      }
    }
  }
}
