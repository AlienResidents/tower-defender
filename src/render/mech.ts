import { Texture } from 'pixi.js';
import type { MechPart, MechSpec } from '../data/mechs';
import { createRng } from '../core/rng';
import { canvasTexture } from './textures';

/**
 * Pixel-mech renderer v2 — chunky pixel-art units, fully procedural.
 *
 * Body renders on a 32×32 grid at 3× scale (96px texture). Palette is a
 * 3-tone ramp derived from the enemy tint (shade/mid/highlight + glow), so
 * armor reads lit instead of flat. Limbs are jointed (thigh/shin/foot) and
 * articulate through a 4-frame stride cycle. Heads render as a separate
 * texture so the game can swivel them toward targets. The lab draws through
 * the same path (drawMech) so what you tune is what ships.
 */

export interface MechPalette {
  dark: string;
  shade: string;
  mid: string;
  hi: string;
  glow: string;
}

/** 3-tone armor ramp + glow, derived from a unit tint. */
export function paletteFromTint(tint: number): MechPalette {
  const r = (tint >> 16) & 255;
  const g = (tint >> 8) & 255;
  const b = tint & 255;
  const ramp = (f: number, add: number): string =>
    `rgb(${Math.min(255, Math.round(r * f + add))},${Math.min(255, Math.round(g * f + add))},${Math.min(255, Math.round(b * f + add))})`;
  return {
    dark: ramp(0.2, 6),
    shade: ramp(0.4, 12),
    mid: ramp(0.74, 20),
    hi: ramp(0.92, 78),
    glow: '#f2fbff',
  };
}

const GRID = 32;
const SCALE = 3;
export const MECH_TEXTURE_SIZE = GRID * SCALE; // 96
const FEET_Y = 28; // grid y of the ground line
const HEAD_GRID = 14;
const HEAD_TEX = HEAD_GRID * SCALE; // 42

type MechPartType = MechPart['type'];

function find(spec: MechSpec, type: MechPartType): MechPart | undefined {
  return spec.parts.find((p) => p.type === type);
}

function specSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c: string,
): void {
  ctx.fillStyle = c;
  ctx.fillRect(
    Math.round(x),
    Math.round(y),
    Math.max(1, Math.round(w)),
    Math.max(1, Math.round(h)),
  );
}

function limb(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** Stride phase offsets per leg index — diagonal pairs / tripod gait. */
function gaitOffset(i: number, count: number): number {
  if (count <= 2) return i % 2 === 0 ? 0 : 0.5;
  if (count <= 4) return [0, 0.5, 0.5, 0][i % 4];
  return i % 2 === 0 ? 0 : 0.5; // hexapod tripod
}

interface TorsoBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function drawLegs(
  ctx: CanvasRenderingContext2D,
  spec: MechSpec,
  frame: number,
  pal: MechPalette,
  legLen: number,
): number {
  const legs = find(spec, 'legs');
  const len = legLen;
  const hipY = FEET_Y - len;
  if (!legs) return hipY;
  const count = Math.max(2, Math.round(legs.params.count));
  const spread = legs.params.spread / SCALE;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const hipX = GRID / 2 - spread / 2 + t * spread;
    const p = (frame / 4 + gaitOffset(i, count)) % 1;
    const fwd = Math.cos(p * Math.PI * 2) * 2.2;
    const lift = Math.max(0, Math.sin(p * Math.PI * 2)) * 1.8;
    const footX = hipX + fwd;
    const footY = FEET_Y - lift;
    const kneeX = hipX + fwd * 0.3 + (t < 0.5 ? -1.2 : 1.2);
    const kneeY = hipY + len * 0.5 - lift * 0.4;
    // thigh mid, shin shade, knee hi dot, foot block
    limb(ctx, hipX, hipY, kneeX, kneeY, 1.6, pal.mid);
    limb(ctx, kneeX, kneeY, footX, footY, 1.4, pal.shade);
    px(ctx, kneeX - 0.8, kneeY - 0.8, 1.6, 1.6, pal.hi);
    px(ctx, footX - 1, footY - 0.6, 2.4, 1.2, pal.dark);
  }
  return hipY;
}

function drawTorso(
  ctx: CanvasRenderingContext2D,
  spec: MechSpec,
  box: TorsoBox,
  shape: number,
  finish: number,
  detail: number,
  pal: MechPalette,
): void {
  const { x, y, w, h } = box;
  if (shape === 1) {
    // hex plate: widest at middle rows
    const rows: [number, number][] = [
      [x + 2, y],
      [x, y + 1],
      [x - 1, y + 2],
      [x - 1, y + h - 2],
      [x, y + h - 1],
      [x + 2, y + h],
    ];
    for (let r = 0; r < rows.length - 1; r++) {
      const [rx, ry] = rows[r];
      const [nx] = rows[r + 1];
      const rowW = x + w - rx + (rx - nx);
      px(ctx, rx, ry, rowW, 1, pal.mid);
    }
  } else if (shape === 2) {
    // wedge: nose taper to the right
    for (let r = 0; r < h; r++) {
      const inset = r < h / 2 ? 0 : Math.floor((r - h / 2) * 0.8);
      px(ctx, x, y + r, w - inset, 1, pal.mid);
    }
  } else {
    px(ctx, x, y, w, h, pal.mid);
  }
  // lighting: top+left hi, bottom dark, right shade
  px(ctx, x + 1, y, w - 1, 1, pal.hi);
  px(ctx, x, y + 1, 1, h - 1, pal.hi);
  px(ctx, x + 1, y + h - 1, w - 1, 1, pal.dark);
  px(ctx, x + w - 1, y + 1, 1, h - 1, pal.shade);

  // finish pass
  const rng = createRng(specSeed(spec.id));
  if (finish === 1 && w >= 6) {
    // paneled seams
    px(ctx, x + Math.floor(w / 2), y + 1, 1, h - 2, pal.shade);
    px(ctx, x + 1, y + Math.floor(h / 2), w - 2, 1, pal.shade);
    for (const [rx, ry] of [
      [x + 1, y + 1],
      [x + w - 2, y + 1],
      [x + 1, y + h - 2],
      [x + w - 2, y + h - 2],
    ]) {
      px(ctx, rx, ry, 1, 1, pal.hi); // rivets
    }
  } else if (finish === 2) {
    // hazard band along the bottom
    for (let i = 0; i < w; i += 2) {
      px(ctx, x + i, y + h - 2 + (i % 4 === 0 ? 0 : 1), 1, 1, i % 4 < 2 ? pal.hi : pal.dark);
    }
  } else if (finish === 3) {
    // worn: seeded chips + scratch lines
    const chips = 2 + Math.round((detail / 100) * 8);
    for (let i = 0; i < chips; i++) {
      px(ctx, x + 1 + rng.next() * (w - 2), y + 1 + rng.next() * (h - 2), 1, 1, pal.dark);
    }
    const scratches = 1 + Math.round((detail / 100) * 3);
    for (let i = 0; i < scratches; i++) {
      const sx = x + 1 + rng.next() * (w - 4);
      const sy = y + 1 + rng.next() * (h - 2);
      px(ctx, sx, sy, 2 + rng.next() * 3, 1, pal.shade);
    }
  }
  // vents
  if (detail >= 20 && w >= 8) {
    const slits = 2 + Math.round((detail / 100) * 3);
    for (let i = 0; i < slits; i++) {
      px(ctx, x + w - 3 - i * 2, y + 2, 1, Math.max(2, Math.floor(h * 0.35)), pal.dark);
    }
  }
}

function drawWeapon(
  ctx: CanvasRenderingContext2D,
  box: TorsoBox,
  part: MechPart,
  pal: MechPalette,
): void {
  const len = Math.max(2, Math.round(part.params.len / SCALE));
  const side = Math.round(part.params.side);
  const my = box.y + Math.floor(box.h / 2);
  const barrel = (dir: 1 | -1): void => {
    const bx = dir === 1 ? box.x + box.w - 1 : box.x + 1 - len;
    // shoulder pod
    px(ctx, dir === 1 ? box.x + box.w - 2 : box.x, my - 2, 3, 3, pal.shade);
    px(ctx, dir === 1 ? box.x + box.w - 2 : box.x, my - 2, 3, 1, pal.mid);
    // barrel + muzzle
    px(ctx, bx, my - 1, len, 1, pal.mid);
    px(ctx, dir === 1 ? bx + len - 1 : bx, my - 1, 1, 2, pal.dark);
  };
  if (side === 0 || side === 2) barrel(1);
  if (side === 1 || side === 2) barrel(-1);
}

function drawCore(
  ctx: CanvasRenderingContext2D,
  box: TorsoBox,
  part: MechPart,
  pal: MechPalette,
): void {
  const size = Math.max(1, Math.round(part.params.size / SCALE));
  const cx = box.x + Math.floor(box.w / 2);
  const cy = box.y + Math.floor(box.h / 2);
  px(ctx, cx - size, cy - size, size * 2 + 1, size * 2 + 1, pal.shade);
  px(ctx, cx - size + 1, cy - size + 1, size * 2 - 1, size * 2 - 1, pal.hi);
  px(ctx, cx, cy, 1, 1, pal.glow);
}

function drawShield(
  ctx: CanvasRenderingContext2D,
  part: MechPart,
  hipY: number,
  pal: MechPalette,
): void {
  const radius = part.params.radius / SCALE;
  ctx.strokeStyle = pal.hi;
  ctx.globalAlpha = (part.params.alpha ?? 22) / 100;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 1.5]);
  ctx.beginPath();
  ctx.arc(GRID / 2, hipY - 3, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/** Head on its own grid (for the swivel sprite). Neck sits at bottom-center. */
function drawHead(ctx: CanvasRenderingContext2D, part: MechPart, pal: MechPalette): void {
  const size = Math.max(2, Math.round(part.params.size / SCALE) + 1);
  const shape = Math.round(part.params.shape);
  const cx = HEAD_GRID / 2;
  const baseY = HEAD_GRID - 2; // neck line
  if (shape === 1) {
    // visor block + slit
    px(ctx, cx - size - 1, baseY - 3, size * 2 + 2, 3, pal.mid);
    px(ctx, cx - size - 1, baseY - 3, size * 2 + 2, 1, pal.hi);
    px(ctx, cx - size + 1, baseY - 2, size * 2 - 2, 1, pal.glow);
  } else if (shape === 2) {
    // antenna mast + glowing tip
    px(ctx, cx, baseY - size * 2, 1, size * 2, pal.shade);
    px(ctx, cx - 1, baseY - size * 2 - 1, 2, 2, pal.glow);
    px(ctx, cx - 2, baseY - 1, 4, 1, pal.mid);
  } else {
    // dome + eye
    for (let r = 0; r < size; r++) {
      const rowW = size * 2 - r;
      px(ctx, cx - Math.floor(rowW / 2), baseY - size + r, rowW, 1, r === 0 ? pal.hi : pal.mid);
    }
    px(ctx, cx + 1, baseY - Math.ceil(size / 2), 1, 1, pal.glow);
  }
}

export interface MechFrames {
  body: [Texture, Texture, Texture, Texture];
  head: Texture | null;
  /** Neck pivot in container coords (body texture space, feet-origin). */
  headPivot: { x: number; y: number };
}

/** Full render: 4 body walk frames + separate swivel head, tinted per palette. */
export function mechTextures(spec: MechSpec, tint: number): MechFrames {
  const pal = paletteFromTint(tint);
  const body = [0, 1, 2, 3].map((frame) =>
    canvasTexture(MECH_TEXTURE_SIZE, MECH_TEXTURE_SIZE, (ctx) => {
      drawBody(ctx, spec, frame, pal, false);
    }),
  ) as [Texture, Texture, Texture, Texture];

  const headPart = find(spec, 'head');
  const head = headPart
    ? canvasTexture(HEAD_TEX, HEAD_TEX, (ctx) => {
        ctx.scale(SCALE, SCALE);
        drawHead(ctx, headPart, pal);
      })
    : null;

  const torso = find(spec, 'torso');
  const legLen = (find(spec, 'legs')?.params.len ?? 14) / SCALE;
  const hipY = FEET_Y - legLen;
  const torsoH = (torso?.params.h ?? 12) / SCALE;
  const neckGridY = hipY - torsoH;
  // body texture anchors at feet-center: container coords = grid·SCALE − (48, 84)
  const headPivot = { x: 0, y: neckGridY * SCALE - FEET_Y * SCALE };
  return { body, head, headPivot };
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  spec: MechSpec,
  frame: number,
  pal: MechPalette,
  withHead: boolean,
): void {
  ctx.scale(SCALE, SCALE);
  const bob = frame % 2 === 0 ? 0 : -0.5;
  const legLen = (find(spec, 'legs')?.params.len ?? 14) / SCALE;
  const hipY = drawLegs(ctx, spec, frame, pal, legLen);
  const bodyY = hipY + bob; // torso rides the hips; feet stay planted

  const torso = find(spec, 'torso');
  if (torso) {
    const w = Math.max(5, Math.round(torso.params.w / SCALE));
    const h = Math.max(3, Math.round(torso.params.h / SCALE));
    const box: TorsoBox = { x: GRID / 2 - w / 2, y: bodyY - h, w, h };
    drawTorso(
      ctx,
      spec,
      box,
      Math.round(torso.params.shape),
      Math.round(torso.params.finish ?? 0),
      torso.params.detail ?? 0,
      pal,
    );
    const weapon = find(spec, 'weapon');
    if (weapon) drawWeapon(ctx, box, weapon, pal);
    const core = find(spec, 'core');
    if (core) drawCore(ctx, box, core, pal);
    if (withHead) {
      const headPart = find(spec, 'head');
      if (headPart) {
        ctx.save();
        ctx.translate(GRID / 2 - HEAD_GRID / 2, box.y - HEAD_GRID + 2);
        drawHead(ctx, headPart, pal);
        ctx.restore();
      }
    }
  }
  const shield = find(spec, 'shield');
  if (shield) drawShield(ctx, shield, hipY, pal);
}

/** Lab/static render: single frame with head attached (neutral angle). */
export function drawMech(
  ctx: CanvasRenderingContext2D,
  spec: MechSpec,
  frame: number,
  tint = 0x9df5ff,
): void {
  drawBody(ctx, spec, frame, paletteFromTint(tint), true);
}
