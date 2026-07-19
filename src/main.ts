import { Application, Container, Text } from 'pixi.js';
import { armAmbientAudio, pauseMusic, resumeMusic, toggleMute } from './audio/ambient';
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
import { computeCityLayout, makeSurfaceMap } from './world/city-layout';
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

// Fixed design resolution — layout is generated once and only ever scaled
// (letterboxed). Map geometry is gameplay; resize must never relayout.
const DESIGN_W = 1920;
const DESIGN_H = 1080;
const scene = new Container();
app.stage.addChild(scene);

function fitScene(): void {
  const scale = Math.min(app.screen.width / DESIGN_W, app.screen.height / DESIGN_H);
  scene.scale.set(scale);
  scene.position.set(
    (app.screen.width - DESIGN_W * scale) / 2,
    (app.screen.height - DESIGN_H * scale) / 2,
  );
  const overlay = document.querySelector<HTMLCanvasElement>('#webgpu-rain');
  if (overlay) {
    overlay.style.left = `${scene.position.x}px`;
    overlay.style.top = `${scene.position.y}px`;
    overlay.style.width = `${DESIGN_W * scale}px`;
    overlay.style.height = `${DESIGN_H * scale}px`;
  }
}

// --- scene (built at design resolution, always) ---
const layout = computeCityLayout(rng, DESIGN_W, DESIGN_H);
const city = buildCity(layout);
const smoke = new SmokeSystem(rng, layout.vents);
const gliders = new GliderSystem(rng, layout.path, 6);
const searchlights = new SearchlightSystem(DESIGN_W, DESIGN_H);
const traffic = new TrafficSystem(rng, DESIGN_W, DESIGN_H, 6);

// --- rain backend selection ---
const params = new URLSearchParams(location.search);
let rainLabel = 'pixi';
let rain: WeatherSystem | null = null;
let webgpuRain: WebGpuRain | null = null;

if (params.get('particles') === 'webgpu') {
  const overlay = document.querySelector<HTMLCanvasElement>('#webgpu-rain');
  if (overlay) {
    overlay.width = DESIGN_W;
    overlay.height = DESIGN_H;
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
  rain = new PixiRain(rng, makeSurfaceMap(layout, DESIGN_H * 0.96), DESIGN_W, DESIGN_H, 700);
}

scene.addChild(city.container);
scene.addChild(smoke.container);
scene.addChild(gliders.container);
scene.addChild(searchlights.container);
scene.addChild(traffic.container);
if (rain) scene.addChild(rain.container);

// --- HUD ---
let audioState: 'off' | 'on' | 'muted' = 'off';
const hud = new Text({
  text: '',
  style: { fontFamily: '"Courier New", monospace', fontSize: 13, fill: 0x3ec6d8 },
});
hud.anchor.set(0, 1);
hud.position.set(16, DESIGN_H - 12);

function refreshHud(): void {
  const audioLabel =
    audioState === 'off' ? '[click] audio on' : audioState === 'muted' ? 'MUTED' : 'AUDIO ON';
  hud.text =
    `SHIFT 01 · SEED ${SEED} · TIME ${clock.scale}x · RAIN ${rainLabel} · ${audioLabel} · ` +
    `[space] pause · [1/2/4] speed · [m] mute`;
}
refreshHud();
scene.addChild(hud);

// --- title card ---
const card = showTitleCard(
  DESIGN_W,
  DESIGN_H,
  'SHIFT 01 :: NEON DISTRICT',
  'INITIALIZE // PHOSPHOR ONLINE',
);
scene.addChild(card.container);
fitScene();
app.renderer.on('resize', fitScene);

// --- input ---
window.addEventListener('keydown', (event) => {
  if (event.key === ' ') {
    clock.togglePause();
    if (clock.paused) {
      card.show();
      pauseMusic();
    } else {
      card.hide();
      resumeMusic();
    }
  }
  if (event.key === '1') clock.setScale(1);
  if (event.key === '2') clock.setScale(2);
  if (event.key === '4') clock.setScale(4);
  if (event.key === 'm' && audioState !== 'off') {
    audioState = toggleMute() ? 'muted' : 'on';
  }
  refreshHud();
});
window.addEventListener('pointerdown', () => card.dismiss());
armAmbientAudio(() => {
  audioState = 'on';
  refreshHud();
});

// --- main loop: simulation advances on the fixed clock, not wall time ---
app.ticker.add((ticker) => {
  const rawDt = ticker.deltaMS / 1000;
  clock.advance(rawDt, (dt) => {
    city.update(dt);
    smoke.update(dt);
    gliders.update(dt);
    searchlights.update(dt);
    traffic.update(dt);
    rain?.update(dt);
    webgpuRain?.update(dt);
    card.update(dt);
  });
  if (clock.paused) card.update(rawDt); // pause screen animates on wall time
});
