import {
  clearTowerOverride,
  TOWER_DEFAULTS,
  towerDesignFor,
  TOWER_SCHEMAS,
  saveTowerOverride,
  type TowerDesign,
  type TowerPart,
  type TowerPartType,
} from '../data/towerdesigns';
import { drawTower } from '../render/towermodel';

/**
 * Tower workshop — design tower models: drag parts from the palette, tune the
 * selected part with sliders. Overrides persist to localStorage (the game
 * reads them); copy-config bakes. Same editor pattern as the mech workshop.
 */

const PART_TYPES: TowerPartType[] = ['base', 'mount', 'turret', 'barrel', 'core', 'dish'];
const REQUIRED: TowerPartType[] = ['base', 'mount', 'turret'];

function defaultParams(type: TowerPartType): Record<string, number> {
  const params: Record<string, number> = {};
  for (const s of TOWER_SCHEMAS[type]) {
    params[s.key] = s.min + Math.round((s.max - s.min) / 3 / s.step) * s.step;
  }
  return params;
}

export function buildTowerLab(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'mechlab'; // reuse the workshop CSS

  const samples = document.createElement('div');
  samples.className = 'samples';
  root.appendChild(samples);

  const row = document.createElement('div');
  row.className = 'mechrow';
  root.appendChild(row);

  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 192;
  canvas.className = 'mechcanvas';
  row.appendChild(canvas);

  const palette = document.createElement('div');
  palette.className = 'palette';
  palette.innerHTML = '<div class="pal-title">PARTS — drag onto canvas</div>';
  row.appendChild(palette);

  const editor = document.createElement('div');
  editor.className = 'mecheditor';
  row.appendChild(editor);

  let design: TowerDesign = structuredClone(TOWER_DEFAULTS.railgun);
  let selectedId: string | null = null;

  const ctx = canvas.getContext('2d');
  if (!ctx) return root;

  function persist(): void {
    saveTowerOverride(design);
  }

  function redraw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, 192, 192);
    ctx.save();
    ctx.scale(2.4, 2.4);
    ctx.translate(-16, -24); // center the 72px tower in the 192px canvas
    drawTower(ctx, design);
    ctx.restore();
  }

  function renderSamples(): void {
    samples.replaceChildren();
    for (const id of Object.keys(TOWER_DEFAULTS)) {
      const b = document.createElement('button');
      b.textContent = TOWER_DEFAULTS[id].name;
      b.className = id === design.id ? 'active' : '';
      b.onclick = () => {
        design = structuredClone(towerDesignFor(id));
        selectedId = null;
        persist();
        renderAll();
      };
      samples.appendChild(b);
    }
  }

  for (const type of PART_TYPES) {
    const chip = document.createElement('div');
    chip.className = 'pal-chip';
    chip.textContent = type;
    chip.draggable = true;
    chip.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/phosphor-part', type);
    });
    palette.appendChild(chip);
  }

  canvas.addEventListener('dragover', (e) => e.preventDefault());
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer?.getData('text/phosphor-part') as TowerPartType | '';
    if (!type) return;
    const existing = design.parts.find((p) => p.type === type);
    if (existing) {
      selectedId = existing.id;
    } else {
      const part: TowerPart = {
        id: `${type}-${Date.now() % 100000}`,
        type,
        params: defaultParams(type),
      };
      design.parts.push(part);
      selectedId = part.id;
      persist();
    }
    renderAll();
  });

  function renderEditor(): void {
    editor.replaceChildren();
    const list = document.createElement('div');
    list.className = 'partslist';
    for (const part of design.parts) {
      const chip = document.createElement('div');
      chip.className = 'part-chip' + (part.id === selectedId ? ' active' : '');
      chip.textContent = part.type;
      chip.onclick = () => {
        selectedId = part.id;
        renderAll();
      };
      if (!REQUIRED.includes(part.type)) {
        const x = document.createElement('span');
        x.textContent = ' ✕';
        x.className = 'del';
        x.onclick = (e) => {
          e.stopPropagation();
          design.parts = design.parts.filter((p) => p.id !== part.id);
          if (selectedId === part.id) selectedId = null;
          persist();
          renderAll();
        };
        chip.appendChild(x);
      }
      list.appendChild(chip);
    }
    editor.appendChild(list);

    const selected = design.parts.find((p) => p.id === selectedId);
    if (!selected) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'select a part to tune it · drag new parts onto the canvas';
      editor.appendChild(hint);
    } else {
      for (const s of TOWER_SCHEMAS[selected.type]) {
        const wrap = document.createElement('div');
        wrap.className = 'slider';
        const label = document.createElement('label');
        label.textContent = s.label;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(s.min);
        input.max = String(s.max);
        input.step = String(s.step);
        input.value = String(selected.params[s.key] ?? s.min);
        const val = document.createElement('span');
        val.className = 'val';
        val.textContent = input.value;
        input.oninput = () => {
          selected.params[s.key] = Number(input.value);
          val.textContent = input.value;
          persist();
          redraw();
        };
        wrap.appendChild(label);
        wrap.appendChild(input);
        wrap.appendChild(val);
        editor.appendChild(wrap);
      }
    }

    const actions = document.createElement('div');
    actions.className = 'actions';
    const copy = document.createElement('button');
    copy.textContent = '⧉ COPY CONFIG';
    copy.onclick = () => {
      void navigator.clipboard.writeText(JSON.stringify(design, null, 2)).then(() => {
        copy.textContent = '✓ COPIED';
        setTimeout(() => {
          copy.textContent = '⧉ COPY CONFIG';
        }, 1200);
      });
    };
    const reset = document.createElement('button');
    reset.textContent = 'RESET';
    reset.onclick = () => {
      clearTowerOverride(design.id);
      design = structuredClone(TOWER_DEFAULTS[design.id]);
      selectedId = null;
      renderAll();
    };
    actions.appendChild(copy);
    actions.appendChild(reset);
    editor.appendChild(actions);
  }

  function renderAll(): void {
    renderSamples();
    renderEditor();
    redraw();
  }

  renderAll();
  return root;
}
