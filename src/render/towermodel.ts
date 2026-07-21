import { Texture } from 'pixi.js';
import type { TowerDesign, TowerPart } from '../data/towerdesigns';
import { paletteFromTint, type MechPalette } from './mech';
import { canvasTexture } from './textures';

/**
 * Pixel tower renderer — static base texture + rotating turret texture.
 * Same grid/palette pipeline as the mechs; the turret is drawn facing right
 * (rotation 0) and pivots at the mount point in-game.
 */

const GRID = 24;
const SCALE = 3;
export const TOWER_TEXTURE_SIZE = GRID * SCALE; // 72
const GROUND_Y = 20; // grid y of the base line

function find(design: TowerDesign, type: TowerPart['type']): TowerPart | undefined {
  return design.parts.find((p) => p.type === type);
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

function drawBase(ctx: CanvasRenderingContext2D, design: TowerDesign, pal: MechPalette): number {
  const base = find(design, 'base');
  const mount = find(design, 'mount');
  const bw = base?.params.w ?? 16;
  const shape = Math.round(base?.params.shape ?? 0);
  const cx = GRID / 2;
  const x = cx - bw / 2;

  // base plate
  if (shape === 2) {
    // platform: wide top, stepped feet
    px(ctx, x, GROUND_Y - 2, bw, 2, pal.mid);
    px(ctx, x + 1, GROUND_Y - 3, bw - 2, 1, pal.hi);
    px(ctx, x, GROUND_Y - 2, 2, 2, pal.dark);
    px(ctx, x + bw - 2, GROUND_Y - 2, 2, 2, pal.dark);
  } else if (shape === 1) {
    // block
    px(ctx, x, GROUND_Y - 3, bw, 3, pal.mid);
    px(ctx, x, GROUND_Y - 3, bw, 1, pal.hi);
    px(ctx, x, GROUND_Y - 1, bw, 1, pal.dark);
  } else {
    // low pad
    px(ctx, x, GROUND_Y - 1, bw, 1, pal.shade);
    px(ctx, x + 1, GROUND_Y - 2, bw - 2, 1, pal.mid);
  }

  // mount
  const mh = mount?.params.h ?? 6;
  const kind = Math.round(mount?.params.kind ?? 1);
  const topY = GROUND_Y - 2 - mh;
  if (kind === 0) {
    // legs: two angled struts
    ctx.strokeStyle = pal.shade;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 3, GROUND_Y - 2);
    ctx.lineTo(cx - 1, topY);
    ctx.moveTo(cx + 3, GROUND_Y - 2);
    ctx.lineTo(cx + 1, topY);
    ctx.stroke();
  } else if (kind === 2) {
    // tripod
    ctx.strokeStyle = pal.shade;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 4, GROUND_Y - 1);
    ctx.lineTo(cx, topY);
    ctx.moveTo(cx + 4, GROUND_Y - 1);
    ctx.lineTo(cx, topY);
    ctx.moveTo(cx, GROUND_Y - 1);
    ctx.lineTo(cx, topY);
    ctx.stroke();
  } else {
    // pillar with shading
    px(ctx, cx - 1.5, topY, 3, mh, pal.mid);
    px(ctx, cx - 1.5, topY, 1, mh, pal.hi);
    px(ctx, cx + 0.5, topY, 1, mh, pal.shade);
  }
  return topY; // turret seat (grid y)
}

function drawDish(
  ctx: CanvasRenderingContext2D,
  kind: number,
  cx: number,
  topY: number,
  pal: MechPalette,
): void {
  if (kind === 1) {
    // antenna + tip
    px(ctx, cx, topY - 4, 1, 4, pal.shade);
    px(ctx, cx - 1, topY - 5, 2, 2, pal.glow);
  } else if (kind === 2) {
    // small dish
    px(ctx, cx - 2, topY - 3, 1, 3, pal.shade);
    px(ctx, cx - 3, topY - 4, 3, 1, pal.hi);
  } else if (kind === 3) {
    // tesla coils: two prongs + arc gap
    px(ctx, cx - 2, topY - 4, 1, 4, pal.shade);
    px(ctx, cx + 1, topY - 4, 1, 4, pal.shade);
    px(ctx, cx - 2, topY - 5, 1, 1, pal.glow);
    px(ctx, cx + 1, topY - 5, 1, 1, pal.glow);
  }
}

function drawTurret(
  ctx: CanvasRenderingContext2D,
  design: TowerDesign,
  pal: MechPalette,
): { pivotX: number; pivotY: number; muzzleX: number; muzzleY: number } {
  const turret = find(design, 'turret');
  const barrel = find(design, 'barrel');
  const core = find(design, 'core');
  const w = turret?.params.w ?? 10;
  const h = turret?.params.h ?? 6;
  const shape = Math.round(turret?.params.shape ?? 0);
  const cx = GRID / 2;
  const cy = GRID / 2;
  const x = cx - w / 2;
  const y = cy - h / 2;

  // housing
  if (shape === 1) {
    // dome
    for (let r = 0; r < h; r++) {
      const rowW = w - Math.floor(r * 0.7);
      px(ctx, cx - Math.floor(rowW / 2), y + r, rowW, 1, r === 0 ? pal.hi : pal.mid);
    }
  } else if (shape === 2) {
    // wedge nose-forward
    for (let r = 0; r < h; r++) {
      const inset = r < h / 2 ? 0 : 1;
      px(ctx, x, y + r, w - inset, 1, pal.mid);
    }
    px(ctx, x, y, w - 1, 1, pal.hi);
  } else {
    px(ctx, x, y, w, h, pal.mid);
    px(ctx, x, y, w, 1, pal.hi);
    px(ctx, x, y + h - 1, w, 1, pal.dark);
    px(ctx, x + w - 1, y + 1, 1, h - 2, pal.shade);
  }

  // core glow
  if (core && core.params.size > 0) {
    const size = Math.max(1, Math.round(core.params.size / 2));
    px(ctx, cx - size, cy - size, size * 2, size * 2, pal.shade);
    px(
      ctx,
      cx - size + 1,
      cy - size + 1,
      Math.max(1, size * 2 - 2),
      Math.max(1, size * 2 - 2),
      pal.hi,
    );
    px(ctx, cx, cy, 1, 1, pal.glow);
  }

  // barrels (drawn facing +x = rotation 0)
  const count = Math.round(barrel?.params.count ?? 1);
  const len = Math.max(2, Math.round((barrel?.params.len ?? 10) / SCALE) * 2);
  const bw = barrel?.params.w ?? 1;
  let muzzleX = cx;
  let muzzleY = cy;
  if (count > 0) {
    const offsets = count === 2 ? [-Math.ceil(bw / 2) - 1, Math.ceil(bw / 2)] : [0];
    for (const off of offsets) {
      px(ctx, x + w - 1, cy + off - bw / 2, len, bw, pal.shade);
      px(ctx, x + w - 1, cy + off - bw / 2, len, 1, pal.mid);
      px(ctx, x + w - 1 + len - 1, cy + off - bw / 2, 1, bw, pal.dark); // muzzle
    }
    muzzleX = x + w - 1 + len;
    muzzleY = cy + offsets[0];
  } else {
    // coil: stacked rings instead of a barrel
    for (let r = 0; r < 3; r++) {
      px(ctx, cx - 2 + (r % 2), y - 2 - r * 2, 4 - (r % 2) * 2, 1, r === 2 ? pal.glow : pal.hi);
    }
  }

  return { pivotX: cx, pivotY: cy, muzzleX, muzzleY };
}

export interface TowerFrames {
  /** Static base + mount, ground-anchored. */
  base: Texture;
  /** Rotating turret, facing right at rotation 0. */
  turret: Texture;
  /** Turret pivot within the turret texture (fraction for anchor). */
  turretAnchor: { x: number; y: number };
  /** Turret seat offset from the tower origin (ground point). */
  turretSeat: { x: number; y: number };
  /** Muzzle tip in turret-texture px (for flash origin). */
  muzzle: { x: number; y: number };
}

export function towerTextures(design: TowerDesign, tint: number): TowerFrames {
  const pal = paletteFromTint(tint);
  let seatY = GROUND_Y;
  const base = canvasTexture(TOWER_TEXTURE_SIZE, TOWER_TEXTURE_SIZE, (ctx) => {
    ctx.scale(SCALE, SCALE);
    seatY = drawBase(ctx, design, pal);
    const dish = find(design, 'dish');
    if (dish && dish.params.kind > 0)
      drawDish(ctx, Math.round(dish.params.kind), GRID / 2, seatY, pal);
  });

  let pivot = { pivotX: GRID / 2, pivotY: GRID / 2, muzzleX: GRID / 2, muzzleY: GRID / 2 };
  const turret = canvasTexture(TOWER_TEXTURE_SIZE, TOWER_TEXTURE_SIZE, (ctx) => {
    ctx.scale(SCALE, SCALE);
    pivot = drawTurret(ctx, design, pal);
  });

  return {
    base,
    turret,
    turretAnchor: { x: pivot.pivotX / GRID, y: pivot.pivotY / GRID },
    // seat offset from the base texture's ground-center anchor point
    turretSeat: { x: 0, y: (seatY - GROUND_Y) * SCALE },
    muzzle: { x: pivot.muzzleX * SCALE, y: pivot.muzzleY * SCALE },
  };
}

/** Lab/static render: full tower on one canvas (turret at rotation 0). */
export function drawTower(
  ctx: CanvasRenderingContext2D,
  design: TowerDesign,
  tint = 0x9df5ff,
): void {
  const pal = paletteFromTint(tint);
  ctx.scale(SCALE, SCALE);
  const seatY = drawBase(ctx, design, pal);
  const dish = find(design, 'dish');
  if (dish && dish.params.kind > 0)
    drawDish(ctx, Math.round(dish.params.kind), GRID / 2, seatY, pal);
  // turret seated on the mount
  ctx.save();
  ctx.translate(0, seatY - GRID / 2 + 1);
  drawTurret(ctx, design, pal);
  ctx.restore();
}
