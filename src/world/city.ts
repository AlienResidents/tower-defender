import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { PALETTE } from '../data/palette';
import { makeHoloTexture, makeSoftDiscTexture } from '../render/textures';
import type { CityLayout } from './city-layout';

/** Builds the neon-city scene from a pure CityLayout. Owns its ambient animation. */

export interface CityView {
  container: Container;
  update(dt: number): void;
}

interface Flicker {
  node: Container | Graphics | Sprite;
  rate: number;
  phase: number;
  dropSeed: number;
}

interface Shimmer {
  bar: Sprite;
  panelH: number;
  speed: number;
  offset: number;
}

export function buildCity(layout: CityLayout): CityView {
  const container = new Container();
  const flickers: Flicker[] = [];
  const shimmers: Shimmer[] = [];

  // --- street: asphalt body, wet sheen, center guide ---
  const street = new Graphics();
  const pts = layout.path.points;
  const trace = (g: Graphics): void => {
    g.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
  };
  trace(street);
  street.stroke({ width: layout.streetWidth, color: PALETTE.asphalt, cap: 'round', join: 'round' });
  trace(street);
  street.stroke({
    width: layout.streetWidth * 0.55,
    color: PALETTE.asphaltSheen,
    alpha: 0.35,
    cap: 'round',
    join: 'round',
  });
  trace(street);
  street.stroke({ width: 2, color: PALETTE.cyan, alpha: 0.12, cap: 'round', join: 'round' });
  container.addChild(street);

  // --- sign reflections on wet asphalt (under buildings, synced flicker) ---
  layout.signs.forEach((s, i) => {
    const cp = layout.path.closestPoint({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
    const refl = new Graphics();
    refl.ellipse(cp.x, cp.y, s.w * 0.7, 14).fill({ color: s.color, alpha: 0.1 });
    refl.blendMode = 'add';
    container.addChild(refl);
    flickers.push({ node: refl, rate: 3 + (i % 5), phase: i * 1.7, dropSeed: i * 13.3 });
  });

  // --- buildings: oblique extrusion, edges, window grids ---
  for (const b of layout.buildings) {
    const g = new Graphics();
    g.poly([b.x, b.y, b.x + b.w, b.y, b.x + b.w, b.y - b.depth, b.x, b.y - b.depth]).fill(
      PALETTE.buildingTop,
    );
    g.rect(b.x, b.y, b.w, b.h).fill(PALETTE.building);
    g.rect(b.x, b.y, b.w, b.h).stroke({ width: 1.5, color: PALETTE.buildingEdge });
    g.poly([b.x, b.y, b.x + b.w, b.y, b.x + b.w, b.y - b.depth, b.x, b.y - b.depth]).stroke({
      width: 1,
      color: PALETTE.buildingEdge,
      alpha: 0.7,
    });
    // windows — deterministic hash pattern, no RNG needed at view time
    const cols = Math.floor(b.w / 18);
    const rows = Math.floor(b.h / 22);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hash = ((r * 7 + c * 13 + Math.floor(b.x)) % 100) / 100;
        const lit = hash < b.litRatio;
        const warm = (r * 3 + c * 11) % 10 < 2;
        const color = !lit ? PALETTE.windowDark : warm ? PALETTE.windowWarm : PALETTE.windowLit;
        g.rect(b.x + 8 + c * 18, b.y + 8 + r * 22, 8, 10).fill({
          color,
          alpha: lit ? 0.9 : 0.6,
        });
      }
    }
    container.addChild(g);
  }

  // --- neon signs ---
  layout.signs.forEach((s, i) => {
    const sign = new Container();
    sign.position.set(s.x, s.y);

    const glow = new Graphics();
    glow.roundRect(-6, -6, s.w + 12, s.h + 12, 8).fill({ color: s.color, alpha: 0.18 });
    glow.blendMode = 'add';

    const panel = new Graphics();
    panel
      .roundRect(0, 0, s.w, s.h, 4)
      .fill({ color: PALETTE.night, alpha: 0.85 })
      .stroke({ width: 1.5, color: s.color, alpha: 0.9 });

    const label = new Text({
      text: s.vertical ? s.text.split('').join('\n') : s.text,
      style: {
        fontFamily: '"Courier New", monospace',
        fontSize: s.vertical ? 16 : 15,
        fill: s.color,
        letterSpacing: s.vertical ? 2 : 3,
        align: 'center',
      },
    });
    label.anchor.set(0.5);
    label.position.set(s.w / 2, s.h / 2);

    sign.addChild(glow, panel, label);
    container.addChild(sign);
    flickers.push({ node: sign, rate: 3 + (i % 5), phase: i * 1.7, dropSeed: i * 13.3 });
  });

  // --- holographic ads above rooftops ---
  layout.holos.forEach((h, i) => {
    const holo = new Container();
    holo.position.set(h.x, h.y);

    const panel = new Sprite(makeHoloTexture(h.color));
    panel.width = h.w;
    panel.height = h.h;
    panel.alpha = 0.55; // translucent — reads as projection, not billboard
    panel.blendMode = 'add';

    const bar = new Sprite(makeSoftDiscTexture());
    bar.width = h.w * 0.9;
    bar.height = 12;
    bar.alpha = 0.3;
    bar.tint = 0xffffff;
    bar.blendMode = 'add';

    holo.addChild(panel, bar);
    container.addChild(holo);
    shimmers.push({ bar, panelH: h.h, speed: 30 + ((i * 17) % 25), offset: i * 2.3 });
    flickers.push({ node: holo, rate: 1.5 + i, phase: i * 2.1, dropSeed: 9 + i * 7 });
  });

  let t = 0;
  function update(dt: number): void {
    t += dt;
    for (const f of flickers) {
      const base = 0.72 + 0.28 * Math.sin(t * f.rate + f.phase);
      const drop = Math.sin(t * 0.9 + f.dropSeed) > 0.985 ? 0.25 : 1; // occasional buzz-out
      f.node.alpha = base * drop;
    }
    for (const s of shimmers) {
      s.bar.position.y = ((t * s.speed + s.offset * 40) % (s.panelH + 30)) - 15;
    }
  }

  return { container, update };
}
