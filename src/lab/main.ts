import * as Tone from 'tone';
import { playPreset } from '../audio/sfx';
import {
  clearOverride,
  DEFAULT_SELECTION,
  getSelection,
  resolvePreset,
  setOverride,
  setSelection,
  SFX_PRESETS,
  type SfxPreset,
  type WeaponSoundKind,
} from '../data/sfx';
import { simulatePurchase } from './sim';

/** /lab page — weapon SFX tuning + dice-economy simulation (issue #7). */

// ---------------------------------------------------------------- SFX LAB

interface SliderSpec {
  key: keyof SfxPreset;
  label: string;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderSpec[] = [
  { key: 'freqStart', label: 'freq start', min: 20, max: 4000, step: 10 },
  { key: 'freqEnd', label: 'freq end', min: 10, max: 4000, step: 10 },
  { key: 'sweepTime', label: 'sweep', min: 0.005, max: 0.4, step: 0.005 },
  { key: 'noise', label: 'noise', min: 0, max: 1, step: 0.05 },
  { key: 'noiseFreq', label: 'noise freq', min: 100, max: 6000, step: 50 },
  { key: 'duration', label: 'duration', min: 0.02, max: 0.6, step: 0.01 },
  { key: 'gain', label: 'gain', min: 0.05, max: 1, step: 0.01 },
  { key: 'hits', label: 'hits', min: 1, max: 14, step: 1 },
  { key: 'hitGap', label: 'hit gap', min: 0.008, max: 0.15, step: 0.002 },
];

function ensureAudio(): void {
  void Tone.start();
}

function buildWeaponSection(kind: WeaponSoundKind): HTMLElement {
  const presets = SFX_PRESETS[kind];
  const root = document.createElement('div');
  root.className = 'weapon';

  const title = document.createElement('h3');
  title.textContent = kind.toUpperCase();
  root.appendChild(title);

  const variantRow = document.createElement('div');
  variantRow.className = 'variants';
  root.appendChild(variantRow);

  const slidersBox = document.createElement('div');
  slidersBox.className = 'sliders';
  root.appendChild(slidersBox);

  const actions = document.createElement('div');
  actions.className = 'actions';
  root.appendChild(actions);

  let currentId = getSelection()[kind];

  function currentPreset(): SfxPreset {
    return resolvePreset(currentId) ?? presets[0];
  }

  function renderVariantButtons(): void {
    variantRow.replaceChildren();
    const selection = getSelection()[kind];
    for (const p of presets) {
      const b = document.createElement('button');
      b.textContent = p.name + (p.id === selection ? ' ★' : '');
      b.className = (p.id === currentId ? 'active' : '') + (p.id === selection ? ' default' : '');
      b.onclick = () => {
        ensureAudio();
        currentId = p.id;
        renderAll();
      };
      variantRow.appendChild(b);
    }
  }

  function renderSliders(): void {
    slidersBox.replaceChildren();
    const preset = currentPreset();
    for (const spec of SLIDERS) {
      const wrap = document.createElement('div');
      wrap.className = 'slider';
      const label = document.createElement('label');
      label.textContent = spec.label;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.value = String(preset[spec.key]);
      const val = document.createElement('span');
      val.className = 'val';
      val.textContent = String(preset[spec.key]);
      input.oninput = () => {
        const v = Number(input.value);
        val.textContent = String(v);
        setOverride(currentId, { [spec.key]: v } as Partial<SfxPreset>);
      };
      input.onchange = () => {
        ensureAudio();
        playPreset(currentPreset());
      };
      wrap.append(label, input, val);
      slidersBox.appendChild(wrap);
    }
  }

  function renderActions(): void {
    actions.replaceChildren();
    const play = document.createElement('button');
    play.textContent = '▶ PLAY';
    play.onclick = () => {
      ensureAudio();
      playPreset(currentPreset());
    };
    const use = document.createElement('button');
    use.textContent = '★ SET DEFAULT';
    use.onclick = () => {
      setSelection(kind, currentId);
      renderAll();
    };
    const reset = document.createElement('button');
    reset.textContent = 'RESET';
    reset.onclick = () => {
      clearOverride(currentId);
      renderAll();
    };
    const defaults = document.createElement('button');
    defaults.textContent = 'ALL DEFAULTS';
    defaults.onclick = () => {
      for (const k of Object.keys(DEFAULT_SELECTION) as WeaponSoundKind[]) {
        setSelection(k, DEFAULT_SELECTION[k]);
        for (const p of SFX_PRESETS[k]) clearOverride(p.id);
      }
      renderAll();
    };
    actions.append(play, use, reset, defaults);
  }

  function renderAll(): void {
    renderVariantButtons();
    renderSliders();
    renderActions();
  }

  renderAll();
  return root;
}

const sfxRoot = document.querySelector<HTMLElement>('#sfx');
if (sfxRoot) {
  for (const kind of Object.keys(SFX_PRESETS) as WeaponSoundKind[]) {
    sfxRoot.appendChild(buildWeaponSection(kind));
  }
}

// ---------------------------------------------------------------- DICE SIM

const PRICES = [24, 30, 36, 48, 60, 80, 100];
const LOADOUTS: { name: string; dice: number[] }[] = [
  { name: '2×d100', dice: [100, 100] },
  { name: '3×d100', dice: [100, 100, 100] },
  { name: 'd100+d20', dice: [100, 20] },
  { name: '2×d20', dice: [20, 20] },
  { name: '3×d12', dice: [12, 12, 12] },
  { name: '5×d10', dice: [10, 10, 10, 10, 10] },
  { name: '8×d6', dice: [6, 6, 6, 6, 6, 6, 6, 6] },
  { name: '12×d3', dice: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3] },
];

function buildSim(): void {
  const root = document.querySelector<HTMLElement>('#sim');
  if (!root) return;

  const run = document.createElement('button');
  run.textContent = 'RUN 2,000 TRIALS PER CELL';
  root.appendChild(run);
  const tableHost = document.createElement('div');
  root.appendChild(tableHost);
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent =
    'greedy strategy: commit largest die each chance · Pd-value = Σ recharge cost of consumed dice · lower is better';
  root.appendChild(hint);

  run.onclick = () => {
    run.textContent = 'RUNNING…';
    setTimeout(() => {
      const table = document.createElement('table');
      const head = table.insertRow();
      head.insertCell().textContent = 'loadout';
      for (const price of PRICES) {
        const th = head.insertCell();
        th.textContent = `price ${price}`;
      }
      for (const l of LOADOUTS) {
        const row = table.insertRow();
        const name = row.insertCell();
        name.textContent = l.name;
        for (const price of PRICES) {
          const r = simulatePurchase(price, l.dice, 2000);
          const cell = row.insertCell();
          cell.textContent = `${(r.successRate * 100).toFixed(0)}% · ${r.avgValueSpent.toFixed(0)}Pd · ${r.avgDiceSpent.toFixed(1)}d`;
          cell.title = `success ${(r.successRate * 100).toFixed(1)}% · value spent ${r.avgValueSpent.toFixed(1)} · dice spent ${r.avgDiceSpent.toFixed(2)} · salvage ${r.avgSalvage.toFixed(1)}`;
        }
      }
      tableHost.replaceChildren(table);
      run.textContent = 'RUN 2,000 TRIALS PER CELL';
    }, 30);
  };
}

buildSim();
