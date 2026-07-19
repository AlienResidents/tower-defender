import { Container, Sprite } from 'pixi.js';
import type { Rng } from '../core/rng';
import { PALETTE } from '../data/palette';
import { makeConeTexture, makeMechTexture, makeSoftDiscTexture } from '../render/textures';
import type { Path } from './path';

interface Glider {
  unit: Container;
  glow: Sprite;
  dist: number;
  speed: number;
  bobPhase: number;
  bobRate: number;
}

/** Enemy mechs gliding the street path — pure ambience for M1, no gameplay. */
export class GliderSystem {
  readonly container = new Container();
  #gliders: Glider[] = [];
  #path: Path;

  constructor(rng: Rng, path: Path, count = 6) {
    this.#path = path;
    const mechTex = makeMechTexture();
    const glowTex = makeSoftDiscTexture();
    const coneTex = makeConeTexture();
    for (let i = 0; i < count; i++) {
      const scale = rng.range(0.75, 1.25);
      const unit = new Container();

      const glow = new Sprite(glowTex);
      glow.anchor.set(0.5);
      glow.tint = PALETTE.engineGlow;
      glow.blendMode = 'add';
      glow.scale.set(0.5 * scale, 0.18 * scale);
      glow.y = 16 * scale;

      const body = new Sprite(mechTex);
      body.anchor.set(0.5);
      body.scale.set(scale);
      body.tint = 0xdfe9ff;

      const headlight = new Sprite(coneTex);
      headlight.anchor.set(0.5, 0);
      headlight.tint = PALETTE.headlight;
      headlight.blendMode = 'add';
      headlight.alpha = 0.18;
      headlight.scale.set(0.28, 0.22);
      headlight.y = 8;

      unit.addChild(glow, body, headlight);
      this.container.addChild(unit);
      this.#gliders.push({
        unit,
        glow,
        dist: rng.range(0, path.totalLength),
        speed: rng.range(45, 95),
        bobPhase: rng.range(0, Math.PI * 2),
        bobRate: rng.range(1.6, 2.6),
      });
    }
  }

  update(dt: number): void {
    for (const g of this.#gliders) {
      g.dist += g.speed * dt;
      const s = this.#path.pointAt(g.dist, true);
      g.bobPhase += g.bobRate * dt;
      g.unit.position.set(s.x, s.y - 6 + Math.sin(g.bobPhase) * 2);
      g.unit.rotation = s.angle - Math.PI / 2; // headlight (local +y) along travel
      g.glow.alpha = 0.3 + 0.12 * Math.sin(g.bobPhase * 2);
    }
  }
}
