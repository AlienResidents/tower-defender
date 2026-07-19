import { Texture } from 'pixi.js';

/**
 * Procedural texture factory — every texture in the game is generated in
 * code via canvas 2D gradients/shapes. No asset files, ever (spec §5).
 */

export function hexToRgba(hex: number, alpha: number): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  draw(ctx);
  return Texture.from(canvas);
}

/** Vertical rain streak — bright center fading to transparent tips. */
export function makeStreakTexture(): Texture {
  return canvasTexture(8, 32, (ctx) => {
    const grad = ctx.createLinearGradient(0, 0, 0, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(2, 0, 4, 32);
  });
}

/** Soft radial disc — smoke puffs, glows, engine lights. */
export function makeSoftDiscTexture(): Texture {
  return canvasTexture(128, 128, (ctx) => {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  });
}

/** Expanding splash ring for rain hitting ground. */
export function makeRingTexture(): Texture {
  return canvasTexture(64, 64, (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 32, 26, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/** Searchlight cone — bright at the tip, dissolving to the base. */
export function makeConeTexture(): Texture {
  return canvasTexture(200, 400, (ctx) => {
    const grad = ctx.createLinearGradient(100, 0, 100, 400);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(96, 0);
    ctx.lineTo(104, 0);
    ctx.lineTo(200, 400);
    ctx.lineTo(0, 400);
    ctx.closePath();
    ctx.fill();
  });
}

/** Holo-ad panel — vertical gradient with scanlines and a glow border. */
export function makeHoloTexture(color: number): Texture {
  return canvasTexture(256, 160, (ctx) => {
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, hexToRgba(color, 0.75));
    grad.addColorStop(0.5, hexToRgba(color, 0.35));
    grad.addColorStop(1, hexToRgba(color, 0.05));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 160);
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < 160; y += 4) {
      ctx.fillRect(0, y, 256, 1);
    }
    // glow border
    ctx.strokeStyle = hexToRgba(color, 0.9);
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 253, 157);
  });
}

/**
 * Scout-walker mech silhouette — hex core, leg strokes, sensor eye.
 * Drawn white so gliders can be tinted per-unit.
 */
export function makeMechTexture(): Texture {
  return canvasTexture(64, 64, (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2.5;
    // hex core
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const x = 32 + Math.cos(a) * 16;
      const y = 32 + Math.sin(a) * 16;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // legs
    ctx.lineWidth = 2;
    for (const [x1, y1, x2, y2] of [
      [20, 22, 10, 10],
      [44, 22, 54, 10],
      [20, 42, 10, 54],
      [44, 42, 54, 54],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    // sensor eye
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.arc(32, 32, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}
