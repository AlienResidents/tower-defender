import { Application, BlurFilter, Text } from 'pixi.js';
import { Clock } from './core/clock';
import { createRng } from './core/rng';

/**
 * M0 boot — neon-black canvas, seeded RNG, fixed-timestep loop, time controls.
 * Explicit WebGL2 renderer; WebGPU re-evaluated post-POC (plan §4).
 */

const SEED = 1337;

const app = new Application();
await app.init({
  preference: 'webgl',
  background: 0x05070f,
  resizeTo: window,
  antialias: true,
});
document.body.appendChild(app.canvas);

const rng = createRng(SEED);
const clock = new Clock();
const bootRoll = rng.int(1, 100); // deterministic — same on every reload at this seed

const titleStyle = {
  fontFamily: '"Courier New", monospace',
  fontSize: 72,
  letterSpacing: 18,
  fill: 0x9df5ff,
} as const;

const glow = new Text({ text: 'P H O S P H O R', style: { ...titleStyle } });
glow.anchor.set(0.5);
glow.filters = [new BlurFilter({ strength: 10, quality: 4 })];

const title = new Text({ text: 'P H O S P H O R', style: { ...titleStyle } });
title.anchor.set(0.5);

const hud = new Text({
  text: '',
  style: { fontFamily: '"Courier New", monospace', fontSize: 14, fill: 0x3ec6d8 },
});
hud.anchor.set(0, 1);

function layout(): void {
  const { width, height } = app.screen;
  title.position.set(width / 2, height / 2);
  glow.position.copyFrom(title.position);
  hud.position.set(16, height - 12);
}

function refreshHud(): void {
  hud.text = `SEED ${SEED} · TIME ${clock.scale}x · boot roll ${bootRoll} · [space] pause · [1/2/4] speed`;
}

app.stage.addChild(glow, title, hud);
layout();
refreshHud();
app.renderer.on('resize', layout);

window.addEventListener('keydown', (event) => {
  if (event.key === ' ') clock.togglePause();
  if (event.key === '1') clock.setScale(1);
  if (event.key === '2') clock.setScale(2);
  if (event.key === '4') clock.setScale(4);
  refreshHud();
});

let pulse = 0;
app.ticker.add((ticker) => {
  clock.advance(ticker.deltaMS / 1000, (dt) => {
    pulse += dt;
    const alpha = 0.7 + 0.3 * Math.sin(pulse * 2.2);
    title.alpha = alpha;
    glow.alpha = alpha * 0.85;
  });
});
