import { Texture } from 'pixi.js';
import type { MechPart, MechSpec } from '../data/mechs';
import { canvasTexture } from './textures';

/**
 * Parametric mech renderer (Canvas2D). Everything draws white so sprites can
 * be tinted per enemy type — same pipeline as the old blob texture. Origin is
 * feet-center, facing right. `phase` (0|1) alternates the leg stride for the
 * two-frame walk cycle.
 */

const W = 96;
const H = 96;
const OX = 48; // origin x (center)
const OY = 84; // origin y (feet baseline)

function find(spec: MechSpec, type: MechPart['type']): MechPart | undefined {
  return spec.parts.find((p) => p.type === type);
}

export function drawMech(ctx: CanvasRenderingContext2D, spec: MechSpec, phase: 0 | 1): void {
  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const legs = find(spec, 'legs');
  const torso = find(spec, 'torso');
  const legLen = legs?.params.len ?? 14;
  const hipY = OY - legLen;

  // --- legs (two-segment, alternating stride) ---
  if (legs) {
    const count = Math.max(2, Math.round(legs.params.count));
    const spread = legs.params.spread;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1); // 0..1 across the spread
      const hipX = OX - spread / 2 + t * spread;
      const stride = (i % 2 === phase ? 4 : -4) * (legLen / 18);
      const kneeX = hipX + (t < 0.5 ? -3 : 3);
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeX, hipY + legLen * 0.55);
      ctx.lineTo(hipX + stride, OY);
      ctx.stroke();
    }
  }

  // --- torso ---
  let torsoTop = hipY - 12;
  if (torso) {
    const w = torso.params.w;
    const h = torso.params.h;
    const shape = Math.round(torso.params.shape);
    torsoTop = hipY - h;
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (shape === 1) {
      // hex
      const cx = OX;
      const cy = hipY - h / 2;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + Math.cos(a) * (w / 2);
        const y = cy + Math.sin(a) * (h / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (shape === 2) {
      // wedge (nose forward)
      ctx.moveTo(OX - w / 2, hipY);
      ctx.lineTo(OX - w / 2 + 4, torsoTop);
      ctx.lineTo(OX + w / 2 - 8, torsoTop);
      ctx.lineTo(OX + w / 2, hipY - h / 2);
      ctx.lineTo(OX + w / 2 - 8, hipY);
      ctx.closePath();
    } else {
      ctx.rect(OX - w / 2, torsoTop, w, h);
    }
    ctx.fill();
    ctx.stroke();
  }

  // --- head ---
  const head = find(spec, 'head');
  if (head) {
    const size = head.params.size;
    const shape = Math.round(head.params.shape);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    if (shape === 1) {
      // visor slit
      ctx.fillRect(OX - size, torsoTop - size * 0.7, size * 2, size * 0.7);
    } else if (shape === 2) {
      // antenna + tip
      ctx.beginPath();
      ctx.moveTo(OX, torsoTop);
      ctx.lineTo(OX + 3, torsoTop - size * 1.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(OX + 3, torsoTop - size * 1.8, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // dome
      ctx.beginPath();
      ctx.arc(OX, torsoTop, size, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
    }
  }

  // --- weapon barrel(s) ---
  const weapon = find(spec, 'weapon');
  if (weapon && torso) {
    const len = weapon.params.len;
    const bw = weapon.params.w;
    const side = Math.round(weapon.params.side);
    const my = hipY - torso.params.h / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    if (side === 0 || side === 2) ctx.fillRect(OX + torso.params.w / 2 - 2, my - bw / 2, len, bw);
    if (side === 1 || side === 2)
      ctx.fillRect(OX - torso.params.w / 2 + 2 - len, my - bw / 2, len, bw);
  }

  // --- core glow ---
  const core = find(spec, 'core');
  if (core && torso) {
    const size = core.params.size;
    const cy = hipY - torso.params.h / 2;
    const grad = ctx.createRadialGradient(OX, cy, 0, OX, cy, size * 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(OX, cy, size * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- shield ring ---
  const shield = find(spec, 'shield');
  if (shield) {
    ctx.strokeStyle = `rgba(255,255,255,${(shield.params.alpha / 100).toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(OX, hipY - 8, shield.params.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** Two walk-frame textures for a spec (white — tint via sprite.tint). */
export function mechTextures(spec: MechSpec): [Texture, Texture] {
  return [
    canvasTexture(W, H, (ctx) => drawMech(ctx, spec, 0)),
    canvasTexture(W, H, (ctx) => drawMech(ctx, spec, 1)),
  ];
}

export const MECH_TEXTURE_SIZE = W;
