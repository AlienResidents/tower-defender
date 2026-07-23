import { Application, Container, Graphics, Text } from 'pixi.js';
import { armAmbientAudio, bossMode, pauseMusic, resumeMusic, toggleMute } from './audio/ambient';
import { Clock } from './core/clock';
import { createRng } from './core/rng';
import { PALETTE } from './data/palette';
import { towerByKey, type TowerDef } from './data/towers';
import { WAVES } from './data/waves';
import { PixiRain, type WeatherSystem } from './fx/rain';
import { SearchlightSystem } from './fx/searchlights';
import { SmokeSystem } from './fx/smoke';
import { TrafficSystem } from './fx/traffic';
import { createWebGpuRain, type WebGpuRain } from './fx/webgpu-rain';
import { dropMultiplier } from './game/economy';
import { isOccupied, nearestSlot } from './game/placement';
import { Run } from './game/run';
import { RunView } from './game/runView';
import { BuildBar } from './ui/buildbar';
import { DicePanel } from './ui/dicepanel';
import { ItemModal } from './ui/itemmodal';
import { PauseMenu } from './ui/pausemenu';
import { MetaScreen } from './ui/metascreen';
import { showTitleCard } from './ui/titlecard';
import { buildCity } from './world/city';
import { computeCityLayout, makeSurfaceMap } from './world/city-layout';
import { dumpInputLog, recordInput } from './dev/inputlog';
import { settings } from './settings';
import { loadMeta, saveMeta } from './game/meta';
import { itemById, MAX_ITEMS_PER_TOWER } from './data/items';
import { salvageValue } from './ui/itemmodal';
import { TowerPanel } from './ui/towerpanel';

/**
 * M2 core loop — towers on rooftops, waves on the street, win/lose.
 * Greybox mechanics inside the look-locked M1 scene.
 */

const params = new URLSearchParams(location.search);
// --- campaign meta: palladium / shift / stash persist across shifts ---
const meta = loadMeta();
const SEED = params.get('seed')
  ? parseInt(params.get('seed') ?? '1337', 10) || 1337
  : 1336 + meta.shift; // no explicit seed — resume the campaign
const SHIFT_NO = SEED - 1336;
const SHIFT_LABEL = `SHIFT ${String(SHIFT_NO).padStart(2, '0')}`;

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
const searchlights = new SearchlightSystem(DESIGN_W, DESIGN_H);
const traffic = new TrafficSystem(rng, DESIGN_W, DESIGN_H, 6);

// --- rain backend selection ---
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
scene.addChild(searchlights.container);
scene.addChild(traffic.container);
if (rain) scene.addChild(rain.container);

// --- z-order: world < fx < ui < cards < modals < warnings < toast ---
scene.sortableChildren = true;
city.container.zIndex = 0;
smoke.container.zIndex = 5;
searchlights.container.zIndex = 12;
traffic.container.zIndex = 14;
if (rain) rain.container.zIndex = 16;

// --- game: run state + views + build bar + dice panel ---
const run = new Run(layout.path, rng, { startingPalladium: meta.palladium });
run.setAttrGrid(meta.grid); // attribute grid bonuses apply at placement
const metaScreen = new MetaScreen({ meta, run, onToast: showToast });
const runView = new RunView(run, clock);
runView.container.zIndex = 8;
scene.addChild(runView.container);
const buildBar = new BuildBar(DESIGN_W, DESIGN_H - 44);
buildBar.container.zIndex = 50;
scene.addChild(buildBar.container);

let pendingSlot: { x: number; y: number } | null = null;
let pendingItem: import('./data/items').ItemDef | null = null;
const dicePanel = new DicePanel(run.dice, (def) => {
  if (pendingSlot) {
    const tower = run.placeTower(def, pendingSlot.x, pendingSlot.y);
    runView.addTowerView(tower);
    drawSlotPads();
  }
  pendingSlot = null;
});
scene.addChild(dicePanel.container);
dicePanel.container.zIndex = 90;

const itemModal = new ItemModal();
itemModal.container.zIndex = 90;
scene.addChild(itemModal.container);

// --- pause menu (ESC / space) ---
let resumeScale: 1 | 2 | 4 = 1;

function openPauseMenu(): void {
  if (pauseMenu.isOpen) return;
  resumeScale = clock.scale > 0 ? (clock.scale as 1 | 2 | 4) : 1;
  clock.setScale(0);
  pauseMenu.open(DESIGN_W / 2, DESIGN_H / 2);
  pauseMusic();
}

function closePauseMenu(): void {
  if (!pauseMenu.isOpen) return;
  pauseMenu.close();
  clock.setScale(resumeScale);
  resumeMusic();
}

const pauseMenu = new PauseMenu(
  {
    onResume: () => closePauseMenu(),
    onRestart: () => location.reload(),
    onMeta: () => metaScreen.open(),
    onQuit: () => {
      location.href = location.pathname; // strip ?seed — back to shift start
    },
  },
  (dx, dy) => ({
    x: scene.position.x + dx * scene.scale.x,
    y: scene.position.y + dy * scene.scale.y,
  }),
);
pauseMenu.container.zIndex = 85;
scene.addChild(pauseMenu.container);

const towerPanel = new TowerPanel();
towerPanel.container.zIndex = 88;
scene.addChild(towerPanel.container);

// elite drops queue — a second elite kill never wipes an open picker
const dropQueue: { items: import('./data/items').ItemDef[]; roll: number }[] = [];
function openNextDrop(): void {
  if (itemModal.isOpen || dropQueue.length === 0) return;
  const d = dropQueue.shift();
  if (!d) return;
  itemModal.open(d.items, d.roll, DESIGN_W / 2, DESIGN_H / 2 - 40, (item) => {
    if (item) {
      meta.stash.push(item.id); // picked items enter the persistent stash
      saveMeta(meta);
    } else {
      // discarded the whole pool — salvage it (Σ power × unit, scales with d4)
      const sv = salvageValue(d.items);
      run.dice.addSalvage(sv);
      showToast(`SALVAGED +${sv} Sv`);
    }
    pendingItem = item; // null = discarded; otherwise awaiting tower click
    openNextDrop();
  });
}

// offer the persisted stash — pick to socket, ESC keeps it stashed.
// Fires at boot and on [s].
let stashModalOpen = false;

function openStash(): void {
  if (itemModal.isOpen) return; // a modal is already up — it owns the screen
  if (meta.stash.length === 0) {
    showToast('STASH EMPTY — pick items from elite drops');
    return;
  }
  const defs = meta.stash
    .map((id) => itemById(id))
    .filter((d): d is NonNullable<typeof d> => d !== undefined);
  if (defs.length === 0) {
    showToast('STASH EMPTY');
    return;
  }
  stashModalOpen = true;
  itemModal.open(defs, defs.length, DESIGN_W / 2, DESIGN_H / 2 - 40, (item) => {
    pendingItem = item; // already in the stash — no re-push
    stashModalOpen = false;
  });
}

if (meta.stash.length > 0) openStash();

run.on((e) => {
  if (e.type === 'eliteDrop') {
    dropQueue.push({ items: e.items, roll: e.roll });
    openNextDrop();
  }
  if (e.type === 'spawn' && e.enemy.def.boss) {
    bossMode(true);
    const warn = showTitleCard(
      DESIGN_W,
      DESIGN_H,
      '!! WARNING !!',
      'SIEGE PLATFORM DETECTED // HEAVY METAL',
    );
    scene.addChild(warn.container);
    warn.container.zIndex = 100;
    app.ticker.add((ticker) => warn.update(ticker.deltaMS / 1000));
    setTimeout(() => warn.dismiss(), 1800);
  }
  if (e.type === 'death' && e.enemy.def.boss) {
    bossMode(false);
  }
});

let selected: TowerDef | null = null;
let autoSend = false;
const ghost = new Graphics();
ghost.visible = false;
ghost.zIndex = 31;
scene.addChild(ghost);
const slotPads = new Graphics();
slotPads.visible = false;
slotPads.zIndex = 30;
scene.addChild(slotPads);

function drawSlotPads(): void {
  slotPads.clear();
  if (!selected) {
    slotPads.visible = false;
    return;
  }
  slotPads.visible = true;
  for (const s of layout.slots) {
    const taken = isOccupied(s, run.towers);
    slotPads
      .circle(s.x, s.y, 5)
      .fill({ color: taken ? 0xff4455 : 0x66ff99, alpha: taken ? 0.12 : 0.22 });
  }
}

function refreshGhost(x: number, y: number): void {
  if (!selected) {
    ghost.visible = false;
    return;
  }
  ghost.clear();
  const slot = nearestSlot(layout, { x, y });
  if (!slot) {
    ghost.visible = false;
    return;
  }
  const taken = isOccupied(slot, run.towers);
  const tint = taken ? 0xff4455 : 0x66ff99;
  // semi-transparent tower preview snapped to the nearest slot
  ghost.circle(slot.x, slot.y, 10).fill({ color: selected.tint, alpha: 0.35 });
  ghost
    .moveTo(slot.x, slot.y)
    .lineTo(slot.x, slot.y - 14)
    .stroke({ width: 3, color: selected.tint, alpha: 0.35 });
  ghost.circle(slot.x, slot.y, 10).stroke({ width: 1.5, color: tint, alpha: 0.9 });
  ghost.circle(slot.x, slot.y, selected.range).stroke({ width: 1, color: tint, alpha: 0.22 });
  ghost.visible = true;
}

function statusText(): string {
  const waves = run.activeWaveCount();
  const multText = waves > 1 ? ` · ×${run.currentMult().toFixed(1)} (${waves} waves)` : '';
  const hint = pendingItem
    ? `click a tower to socket ${pendingItem.name}`
    : run.phase === 'build'
      ? '[enter] send wave'
      : run.phase === 'wave'
        ? `[enter] send early ×${dropMultiplier(waves + 1).toFixed(1)}`
        : run.phase === 'won'
          ? '[n] next shift'
          : '';
  const stashText = meta.stash.length > 0 ? ` · stash ${meta.stash.length} [s]` : '';
  return `LIVES ${run.lives} · WAVE ${run.wave}/${WAVES.length} · Pd ${Math.floor(run.palladium)} · Sv ${Math.floor(run.dice.salvage)}${stashText}${multText} · ${hint}`;
}

run.on((e) => {
  if (e.type !== 'phase') return;
  if (e.phase === 'build' && autoSend && run.wave < WAVES.length) {
    run.startWave(); // auto-send on clear
  }
  if (e.phase === 'won' || e.phase === 'lost') {
    // persist the campaign: salvage refines on a win, shift advances
    if (e.phase === 'won') {
      meta.ledger.svRefined += Math.floor(run.dice.salvage * settings.economy.salvageRefineRate);
      run.dice.refineSalvage();
      meta.shift = SHIFT_NO + 1;
    }
    meta.ledger.pdEarned += run.stats.palladiumEarned;
    meta.ledger.pdSpent += run.stats.palladiumSpent;
    meta.ledger.svEarned += run.dice.stats.salvageEarned;
    meta.palladium = run.palladium;
    saveMeta(meta);
    const endCard = showTitleCard(
      DESIGN_W,
      DESIGN_H,
      e.phase === 'won' ? `${SHIFT_LABEL} :: COMPLETE` : `${SHIFT_LABEL} :: FAILED`,
      e.phase === 'won'
        ? 'SEE YOU SPACE COWBOY… [n] next shift'
        : 'DATA-CORE BREACH // PHOSPHOR OFFLINE',
    );
    scene.addChild(endCard.container);
    endCard.container.zIndex = 80;
    endCard.show();
    app.ticker.add((ticker) => endCard.update(ticker.deltaMS / 1000));
  }
});

app.stage.eventMode = 'static';
app.stage.hitArea = app.screen;
app.stage.on('pointermove', (event) => {
  const p = scene.toLocal(event.global);
  refreshGhost(p.x, p.y);
});
app.stage.on('pointerdown', (event) => {
  const p = scene.toLocal(event.global);
  recordInput('pointerdown', `${Math.round(p.x)},${Math.round(p.y)}`);
  if (dicePanel.isOpen) return; // modal owns clicks while open
  const clickedTower = run.towers.find((t) => Math.hypot(t.x - p.x, t.y - p.y) < 18);
  if (pendingItem) {
    if (clickedTower) {
      if (clickedTower.items.length >= MAX_ITEMS_PER_TOWER) {
        const swapping = pendingItem; // narrowed non-null for the closure
        towerPanel.open(clickedTower, {
          pendingItem: swapping,
          onReplace: (index) => {
            const replaced = run.replaceItem(clickedTower.uid, index, swapping);
            if (replaced) {
              const stashIdx = meta.stash.indexOf(swapping.id);
              if (stashIdx >= 0) meta.stash.splice(stashIdx, 1);
              saveMeta(meta);
              run.dice.addSalvage(settings.economy.usedItemSalvage); // used → flat rate
              showToast(`${replaced.name} SALVAGED +${settings.economy.usedItemSalvage} Sv`);
              pendingItem = null;
              towerPanel.close();
            }
          },
        });
      } else if (run.applyItem(clickedTower.uid, pendingItem)) {
        const stashIdx = meta.stash.indexOf(pendingItem.id);
        if (stashIdx >= 0) meta.stash.splice(stashIdx, 1); // socketed — leaves the stash
        saveMeta(meta);
        pendingItem = null;
      }
    }
    return;
  }
  if (clickedTower) {
    towerPanel.open(clickedTower, { pendingItem: null, onReplace: () => {} });
    return;
  }
  towerPanel.close();
  if (!selected) return;
  const slot = nearestSlot(layout, p);
  if (slot && !isOccupied(slot, run.towers)) {
    pendingSlot = slot;
    if (run.dice.begin(selected)) {
      dicePanel.open(DESIGN_W / 2, DESIGN_H / 2 - 40);
    } else {
      pendingSlot = null;
    }
  }
});

// --- HUD ---
let audioState: 'off' | 'on' | 'muted' = 'off';
const hud = new Text({
  text: '',
  style: { fontFamily: '"Courier New", monospace', fontSize: 13, fill: 0x3ec6d8 },
});
hud.anchor.set(0, 0);
hud.position.set(16, 12);
hud.zIndex = 55;

function refreshHud(): void {
  const audioLabel =
    audioState === 'off' ? '[click] audio on' : audioState === 'muted' ? 'MUTED' : 'AUDIO ON';
  hud.text =
    `SHIFT 01 · SEED ${SEED} · TIME ${clock.scale}x · RAIN ${rainLabel} · ${audioLabel} · ` +
    `[a] auto ${autoSend ? 'ON' : 'off'} · [c] stats · [space] pause · [1/2/4] speed · [m] mute`;
}
refreshHud();
scene.addChild(hud);

// --- title card ---
const card = showTitleCard(
  DESIGN_W,
  DESIGN_H,
  `${SHIFT_LABEL} :: NEON DISTRICT`,
  'INITIALIZE // PHOSPHOR ONLINE',
);
card.container.zIndex = 70;
scene.addChild(card.container);

// --- toast (dev feedback, e.g. stats copied) ---
const toast = new Text({
  text: '',
  style: { fontFamily: '"Courier New", monospace', fontSize: 14, fill: 0x66ff99 },
});
toast.anchor.set(1, 1);
toast.position.set(DESIGN_W - 16, DESIGN_H - 56);
toast.zIndex = 110;
toast.alpha = 0;
scene.addChild(toast);
let toastT = 0;
function showToast(text: string): void {
  toast.text = text;
  toastT = settings.ui.toastSeconds;
}
fitScene();
app.renderer.on('resize', fitScene);

// --- input ---
window.addEventListener('keydown', (event) => {
  recordInput('key', event.key);
  if (event.key === ' ') {
    if (pauseMenu.isOpen) closePauseMenu();
    else openPauseMenu();
  }
  if (event.key === '1') clock.setScale(1);
  if (event.key === '2') clock.setScale(2);
  if (event.key === '4') clock.setScale(4);
  if (event.key === 'm' && audioState !== 'off') {
    audioState = toggleMute() ? 'muted' : 'on';
  }
  if (event.key === 'Enter') {
    run.startWave();
    card.dismiss(); // intro card auto-dismisses when the action starts
  }
  if (event.key === 'a' || event.key === 'A') {
    autoSend = !autoSend;
  }
  if (event.key === 'c' || event.key === 'C') {
    // dev-mode: copy the run summary to clipboard
    void navigator.clipboard.writeText(JSON.stringify(run.buildRunSummary(SEED), null, 2));
    showToast('STATS COPIED ✓');
  }
  if (event.key === 'i' || event.key === 'I') {
    // dev-mode: dump the recorded input log (settings.input.record)
    const dump = dumpInputLog();
    void navigator.clipboard.writeText(dump.json);
    showToast(`INPUT LOG COPIED ✓ (${dump.count} events)`);
  }
  if (event.key === 's' || event.key === 'S') {
    if (stashModalOpen)
      itemModal.close(null); // toggle: s opens, s closes
    else openStash();
  }
  if (event.key === 'g' || event.key === 'G') {
    metaScreen.toggle(); // attribute grid + CSC armory + ledger
  }
  if (event.key === 'n' && run.phase === 'won') {
    // next shift: meta already saved with the advance — boot resumes there
    location.href = location.pathname;
  }
  if (event.key === 'Escape') {
    if (dicePanel.isOpen) {
      dicePanel.close(); // abandons the purchase, dice become salvage
      pendingSlot = null;
    } else if (itemModal.isOpen) {
      itemModal.close(null); // discard the drop
    } else if (pendingItem) {
      pendingItem = null;
    } else if (pauseMenu.isOpen) {
      closePauseMenu();
    } else if (metaScreen.isOpen) {
      metaScreen.close();
    } else if (towerPanel.isOpen) {
      towerPanel.close();
    } else if (selected) {
      selected = null;
      buildBar.setSelected(null);
      ghost.visible = false;
      drawSlotPads();
    } else {
      openPauseMenu();
    }
  }
  const towerPick = towerByKey(event.key.toLowerCase());
  if (towerPick) {
    selected = selected?.id === towerPick.id ? null : towerPick;
    buildBar.setSelected(selected?.id ?? null);
    if (!selected) ghost.visible = false;
    drawSlotPads();
  }
  refreshHud();
});
window.addEventListener('pointerdown', () => card.dismiss());
armAmbientAudio(() => {
  audioState = 'on';
  if (pauseMenu.isOpen) pauseMusic(); // armed late while paused — duck now
  refreshHud();
});

// --- main loop: simulation advances on the fixed clock, not wall time ---
app.ticker.add((ticker) => {
  const rawDt = ticker.deltaMS / 1000;
  clock.advance(rawDt, (dt) => {
    city.update(dt);
    smoke.update(dt);
    searchlights.update(dt);
    traffic.update(dt);
    rain?.update(dt);
    webgpuRain?.update(dt);
    card.update(dt);
    run.update(dt);
    runView.sync(dt);
  });
  buildBar.setStatus(statusText());
  dicePanel.update(rawDt);
  pauseMenu.update(rawDt);
  if (toastT > 0) {
    toastT -= rawDt;
    toast.alpha = Math.min(1, toastT);
  } else {
    toast.alpha = 0;
  }
  if (clock.paused) card.update(rawDt); // pause screen animates on wall time
});
