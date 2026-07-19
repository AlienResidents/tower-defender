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
  mirror?: Graphics;
  nextEvent: number;
  burst: number[] | null;
  burstT: number;
}

interface Shimmer {
  bar: Sprite;
  panelH: number;
  speed: number;
  offset: number;
}

interface HoloAnim {
  root: Container;
  content: Container;
  glyph: Graphics;
  bar: Sprite;
  panelH: number;
  speed: number;
  bobPhase: number;
  glitchSeed: number;
}

function hexPoints(cx: number, cy: number, r: number): number[] {
  const pts: number[] = [];
  for (let k = 0; k < 6; k++) {
    const ang = (Math.PI / 3) * k - Math.PI / 6;
    pts.push(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
  }
  return pts;
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

  // --- sign reflections on wet asphalt (under buildings, flicker in sync) ---
  const refls: Graphics[] = [];
  layout.signs.forEach((s) => {
    const cp = layout.path.closestPoint({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
    const refl = new Graphics();
    refl.ellipse(cp.x, cp.y, s.w * 0.7, 14).fill({ color: s.color, alpha: 0.1 });
    refl.blendMode = 'add';
    container.addChild(refl);
    refls.push(refl);
  });

  // --- buildings: oblique extrusion, edges, window grids, sign bands ---
  const SIGN_BAND_H = 32;
  const signHosts = new Set(layout.signs.map((s) => s.hostIdx));
  layout.buildings.forEach((b, idx) => {
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
    // parapet line marking the sign band on host buildings
    if (signHosts.has(idx)) {
      g.moveTo(b.x + 4, b.y + SIGN_BAND_H)
        .lineTo(b.x + b.w - 4, b.y + SIGN_BAND_H)
        .stroke({ width: 1, color: PALETTE.buildingEdge, alpha: 0.6 });
    }
    // windows — deterministic hash pattern; hosts keep the sign band clear
    const winTop = signHosts.has(idx) ? SIGN_BAND_H + 6 : 8;
    const cols = Math.floor(b.w / 18);
    const rows = Math.max(0, Math.floor((b.h - winTop - 4) / 22));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hash = ((r * 7 + c * 13 + Math.floor(b.x)) % 100) / 100;
        const lit = hash < b.litRatio;
        const warm = (r * 3 + c * 11) % 10 < 2;
        const color = !lit ? PALETTE.windowDark : warm ? PALETTE.windowWarm : PALETTE.windowLit;
        g.rect(b.x + 8 + c * 18, b.y + winTop + r * 22, 8, 10).fill({
          color,
          alpha: lit ? 0.9 : 0.6,
        });
      }
    }
    container.addChild(g);
  });

  // --- neon signs (band lightboxes + blade panels on struts) ---
  layout.signs.forEach((s, i) => {
    // struts for blade signs — behind the panel
    if (s.style === 'blade') {
      const host = layout.buildings[s.hostIdx];
      const edgeX = s.side === -1 ? host.x : host.x + host.w;
      const farX = s.side === -1 ? s.x + s.w : s.x;
      const struts = new Graphics();
      struts.moveTo(edgeX, s.y + 3).lineTo(farX, s.y + 3);
      struts.moveTo(edgeX, s.y + s.h - 3).lineTo(farX, s.y + s.h - 3);
      struts.stroke({ width: 2, color: PALETTE.buildingEdge });
      container.addChild(struts);
    }

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
      text: s.style === 'blade' ? s.text.split('').join('\n') : s.text,
      style: {
        fontFamily: '"Courier New", monospace',
        fontSize: s.fontSize,
        fill: s.color,
        letterSpacing: s.style === 'blade' ? 1 : 3,
        ...(s.style === 'blade' ? { lineHeight: s.fontSize + 3 } : {}),
        align: 'center',
      },
    });
    label.anchor.set(0.5);
    label.position.set(s.w / 2, s.h / 2);

    sign.addChild(glow, panel, label);
    container.addChild(sign);
    flickers.push({
      node: sign,
      mirror: refls[i],
      nextEvent: 1 + Math.random() * 5 + i * 0.4,
      burst: null,
      burstT: 0,
    });
  });

  // --- holographic ads: static mast, bobbing framed panel, clipped content ---
  const holoAnims: HoloAnim[] = [];
  layout.holos.forEach((h, i) => {
    const root = new Container();
    root.position.set(h.x, h.y);

    // static emitter mast + roof foot plate — starts exactly at the panel's
    // bottom edge, never intrudes into the display
    const mastX = h.mountX - h.x;
    const mastG = new Graphics();
    mastG.rect(mastX - 4, h.h, 8, h.mast).fill(PALETTE.building);
    mastG.rect(mastX - 4, h.h, 8, h.mast).stroke({ width: 1, color: PALETTE.buildingEdge });
    // foot plate where the mast meets the roofline
    mastG.rect(mastX - 9, h.h + h.mast - 2, 18, 4).fill(PALETTE.buildingEdge);
    mastG.circle(mastX, h.h + 5, 4).fill({ color: h.color, alpha: 0.9 });
    root.addChild(mastG);

    // panel base (gradient + scanlines texture)
    const panelSprite = new Sprite(makeHoloTexture(h.color));
    panelSprite.width = h.w;
    panelSprite.height = h.h;
    panelSprite.alpha = 0.55;
    panelSprite.blendMode = 'add';
    root.addChild(panelSprite);

    // masked content container — nothing escapes the frame
    const maskG = new Graphics().roundRect(2, 2, h.w - 4, h.h - 4, 3).fill(0xffffff);
    const content = new Container();
    content.mask = maskG;
    root.addChild(maskG, content);

    // rotating glyph ring — the "brand mark"
    const cx = h.w * 0.5;
    const cy = h.h * 0.42;
    const r = Math.min(h.w, h.h) * 0.22;
    const glyph = new Graphics();
    glyph.poly(hexPoints(0, 0, r)).stroke({ width: 2.5, color: 0xffffff, alpha: 0.85 });
    glyph.poly(hexPoints(0, 0, r * 0.55)).stroke({ width: 1.5, color: 0xffffff, alpha: 0.5 });
    glyph.position.set(cx, cy);
    glyph.blendMode = 'add';
    content.addChild(glyph);

    // fake ad-text bars
    const bars = new Graphics();
    for (let li = 0; li < 3; li++) {
      bars
        .roundRect(h.w * 0.2, h.h * 0.68 + li * 9, h.w * (0.6 - li * 0.14), 4, 2)
        .fill({ color: 0xffffff, alpha: 0.35 - li * 0.08 });
    }
    bars.blendMode = 'add';
    content.addChild(bars);

    // shimmer sweep (clipped inside the frame now)
    const bar = new Sprite(makeSoftDiscTexture());
    bar.width = h.w * 0.9;
    bar.height = 12;
    bar.alpha = 0.3;
    bar.tint = 0xffffff;
    bar.blendMode = 'add';
    content.addChild(bar);

    // frame + corner brackets
    const frame = new Graphics();
    frame.roundRect(0, 0, h.w, h.h, 4).stroke({ width: 1.5, color: h.color, alpha: 0.9 });
    const cLen = 10;
    for (const [bx, by, sx, sy] of [
      [0, 0, 1, 1],
      [h.w, 0, -1, 1],
      [0, h.h, 1, -1],
      [h.w, h.h, -1, -1],
    ] as const) {
      frame
        .moveTo(bx, by + sy * cLen)
        .lineTo(bx, by)
        .lineTo(bx + sx * cLen, by);
    }
    frame.stroke({ width: 3, color: h.color, alpha: 1 });
    root.addChild(frame);

    container.addChild(root);
    holoAnims.push({
      root,
      content,
      glyph,
      bar,
      panelH: h.h,
      speed: 30 + ((i * 17) % 25),
      bobPhase: i * 2.1,
      glitchSeed: i * 7.3,
    });
  });

  let t = 0;
  function update(dt: number): void {
    t += dt;
    for (const f of flickers) {
      // neon model: mostly ON, occasional fast stutter-burst, snap back
      if (f.burst) {
        f.burstT += dt;
        const step = Math.floor(f.burstT / 0.045); // ~45ms per stutter
        if (step >= f.burst.length) {
          f.burst = null;
          f.node.alpha = 0.95;
          if (f.mirror) f.mirror.alpha = 0.1;
          f.nextEvent = 2 + Math.random() * 7;
        } else {
          const a = f.burst[step];
          f.node.alpha = a;
          if (f.mirror) f.mirror.alpha = 0.02 + 0.08 * a;
        }
      } else {
        f.node.alpha = 0.95;
        f.nextEvent -= dt;
        if (f.nextEvent <= 0) {
          const len = 2 + Math.floor(Math.random() * 4);
          f.burst = Array.from({ length: len }, () => 0.15 + Math.random() * 0.65);
          f.burstT = 0;
        }
      }
    }
    for (const s of shimmers) {
      s.bar.position.y = ((t * s.speed + s.offset * 40) % (s.panelH + 30)) - 15;
    }
    for (const a of holoAnims) {
      // fixed-mounted panels: no bob — liveliness from flicker/glitch/shimmer
      a.root.alpha =
        0.85 + 0.1 * Math.sin(t * 7.3 + a.bobPhase * 3) * Math.sin(t * 2.1 + a.bobPhase);
      // rare glitch: brief horizontal content jitter
      const g = Math.sin(t * 0.9 + a.glitchSeed * 5);
      a.content.x = g > 0.995 ? (Math.sin(t * 60 + a.glitchSeed) > 0 ? 3 : -3) : 0;
      a.glyph.rotation = t * 0.4 + a.bobPhase;
      a.bar.position.y = (t * a.speed) % a.panelH;
    }
  }

  return { container, update };
}
