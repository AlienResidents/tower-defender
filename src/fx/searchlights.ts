import { Container, Sprite } from 'pixi.js';
import { PALETTE } from '../data/palette';
import { makeConeTexture } from '../render/textures';

interface Beam {
  sprite: Sprite;
  baseAngle: number;
  sweep: number;
  speed: number;
  phase: number;
}

/** Rooftop searchlights — slow additive cones sweeping the city. */
export class SearchlightSystem {
  readonly container = new Container();
  #beams: Beam[] = [];

  constructor(width: number, height: number) {
    const origins = [
      { x: width * 0.18, y: -20, baseAngle: Math.PI * 0.42 },
      { x: width * 0.82, y: -30, baseAngle: Math.PI * 0.58 },
    ];
    origins.forEach((o, i) => {
      const sprite = new Sprite(makeConeTexture());
      sprite.anchor.set(0.5, 0);
      sprite.position.set(o.x, o.y);
      sprite.tint = PALETTE.searchlight;
      sprite.alpha = 0.09;
      sprite.blendMode = 'add';
      sprite.scale.set(1.4, (height * 1.1) / 400);
      this.container.addChild(sprite);
      this.#beams.push({
        sprite,
        baseAngle: o.baseAngle - Math.PI / 2, // cone texture points down
        sweep: 0.5 + i * 0.14,
        speed: 0.18 + i * 0.05,
        phase: i * 2.4,
      });
    });
  }

  #t = 0;

  update(dt: number): void {
    this.#t += dt;
    for (const b of this.#beams) {
      b.sprite.rotation = b.baseAngle + Math.sin(this.#t * b.speed + b.phase) * b.sweep;
      // subtle intensity breathing
      b.sprite.alpha = 0.08 + 0.02 * Math.sin(this.#t * 0.5 + b.phase * 2);
    }
  }
}
