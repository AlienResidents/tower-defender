import { Application, Text } from 'pixi.js';
import { armAmbientAudio } from './audio/ambient';
import { Clock } from './core/clock';
import { createRng } from './core/rng';
import { PALETTE } from './data/palette';
import { PixiRain, type WeatherSystem } from './fx/rain';
import { SearchlightSystem } from './fx/searchlights';
import { SmokeSystem } from './fx/smoke';
import { TrafficSystem } from './fx/traffic';
import { createWebGpuRain, type WebGpuRain } from './fx/webgpu-rain';
import { showTitleCard } from './ui/titlecard';
import { buildCity } from './world/city';
import { computeCityLayout } from './world/city-layout';
import { GliderSystem } from './world/gliders';

/**
 * M1 beauty spike — neon city, weather, searchlights, traffic, gliders.
 * Look-lock gate: operator sign-off (plan §3).
 *
 * Rain backend: PixiJS-native by default; `?particles=webgpu` attempts the
 * WebGPU compute spike (overlay canvas), falling back ONLY to report —
 * the fallback decision belongs to the operator.
 */

const SEED = 1337;

const app = new Application();
await app.init({
  preference: 'webgl', // explicit WebGL2 — plan §4
  background: PALETTE.night,
  resizeTo: window,
  antialias: true,
});
app.canvas.classList.add('pixi');
document.body.appendChild(app.canvas);

const rng = createRng(SEED);
const clock = new Clock();
const { width, height } = app.screen;

// --- scene ---
const layout = computeCityLayout(rng, width, height);
const city = buildCity(layout);
const smoke = new SmokeSystem(rng, layout.vents);
const gliders = new GliderSystem(rng, layout.path, 6);
const searchlights = new SearchlightSystem(width, height);
const traffic = new TrafficSystem(rng, width, height, 6);

// --- rain backend selection ---
const params = new URLSearchParams(location.search);
let rainLabel = 'pixi';
let rain: WeatherSystem | null = null;
let webgpuRain: WebGpuRain | null = null;

if (params.get('particles') === 'webgpu') {
  const overlay = document.querySelector<HTMLCanvasElement>('#webgpu-rain');
  if (overlay) {
    overlay.width = width;
    overlay.height = height;
    try {
      webgpuRain = await createWebGpuRain(overlay, SEED);
    } catch (err) {
      console.error('[phosphor] WebGPU spike failed:', err);
      webgpuRain = null;
    }
    rainLabel = webgpuRain ? 'webgpu' : 'pixi (webgpu unavailable)';
  }
}
if (!webgpuRain) {
  rain = new PixiRain(rng, width, height, 700);
}

app.stage.addChild(city.container);
app.stage.addChild(smoke.container);
app.stage.addChild(gliders.container);
app.stage.addChild(searchlights.container);
app.stage.addChild(traffic.container);
if (rain) app.stage.addChild(rain.container);

// --- HUD ---
let audioOn = false;
const hud = new Text({
  text: '',
  style: { fontFamily: '"Courier New", monospace', fontSize: 13, fill: 0x3ec6d8 },
});
hud.anchor.set(0, 1);
hud.position.set(16, height - 12);

function refreshHud(): void {
  hud.text =
    `SHIFT 01 · SEED ${SEED} · TIME ${clock.scale}x · RAIN ${rainLabel} · ` +
    `${audioOn ? 'AUDIO ON' : '[click] audio'} · [space] pause · [1/2/4] speed`;
}
refreshHud();
app.stage.addChild(hud);

// --- title card ---
const card = showTitleCard(
  width,
  height,
  'SHIFT 01 :: NEON DISTRICT',
  'INITIALIZE // PHOSPHOR ONLINE',
);
app.stage.addChild(card.container);
let cardActive = true;

// --- input ---
window.addEventListener('keydown', (event) => {
  if (event.key === ' ') clock.togglePause();
  if (event.key === '1') clock.setScale(1);
  if (event.key === '2') clock.setScale(2);
  if (event.key === '4') clock.setScale(4);
  refreshHud();
});
armAmbientAudio(() => {
  audioOn = true;
  refreshHud();
});

// --- main loop: simulation advances on the fixed clock, not wall time ---
app.ticker.add((ticker) => {
  clock.advance(ticker.deltaMS / 1000, (dt) => {
    city.update(dt);
    smoke.update(dt);
    gliders.update(dt);
    searchlights.update(dt);
    traffic.update(dt);
    rain?.update(dt);
    webgpuRain?.update(dt);
    if (cardActive) cardActive = card.update(dt);
  });
});
