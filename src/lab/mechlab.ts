import {
  clearMechOverride,
  MECH_DEFAULTS,
  mechSpecFor,
  PART_SCHEMAS,
  saveMechOverride,
  type MechPart,
  type MechPartType,
  type MechSpec,
} from '../data/mechs';
import { drawMech } from '../render/mech';

/**
 * Mech workshop — design enemy units visually: drag parts from the palette
 * onto the canvas, tune the selected part with sliders, watch it walk.
 * Overrides persist to localStorage (the game reads them); copy-config bakes.
 */

const PART_TYPES: MechPartType[] = ['torso', 'legs', 'head', 'weapon', 'core', 'shield'];
const REQUIRED: MechPartType[] = ['torso', 'legs'];

function defaultParams(type: MechPartType): Record<string, number> {
  const params: Record<string, number> = {};
  for (const s of PART_SCHEMAS[type]) {
    params[s.key] = s.min + Math.round((s.max - s.min) / 3 / s.step) * s.step;
  }
  return params;
}

export function buildMechLab(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'mechlab';

  // --- sample row ---
  const samples = document.createElement('div');
  samples.className = 'samples';
  root.appendChild(samples);

  // --- main row: canvas | palette | editor ---
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

  // --- state ---
  let spec: MechSpec = structuredClone(MECH_DEFAULTS.walker);
  let selectedId: string | null = null;
  let frame = 0;

  const ctx = canvas.getContext('2d');
  if (!ctx) return root;

  function currentEnemyId(): string {
    return spec.id;
  }

  function persist(): void {
    saveMechOverride(spec);
  }

  function redraw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, 192, 192);
    ctx.save();
    ctx.scale(2, 2); // render at 2× for visibility
    drawMech(ctx, spec, frame);
    ctx.restore();
  }

  function renderSamples(): void {
    samples.replaceChildren();
    for (const id of Object.keys(MECH_DEFAULTS)) {
      const b = document.createElement('button');
      b.textContent = MECH_DEFAULTS[id].name;
      b.className = id === currentEnemyId() ? 'active' : '';
      b.onclick = () => {
        spec = structuredClone(mechSpecFor(id));
        selectedId = null;
        persist();
        renderAll();
      };
      samples.appendChild(b);
    }
  }

  function renderPalette(): void {
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
  }

  canvas.addEventListener('dragover', (e) => e.preventDefault());
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer?.getData('text/phosphor-part') as MechPartType | '';
    if (!type) return;
    const existing = spec.parts.find((p) => p.type === type);
    if (existing) {
      selectedId = existing.id; // one part per type — drop selects it
    } else {
      const part: MechPart = {
        id: `${type}-${Date.now() % 100000}`,
        type,
        params: defaultParams(type),
      };
      spec.parts.push(part);
      selectedId = part.id;
      persist();
    }
    renderAll();
  });

  function renderEditor(): void {
    editor.replaceChildren();
    // parts list
    const list = document.createElement('div');
    list.className = 'partslist';
    for (const part of spec.parts) {
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
          spec.parts = spec.parts.filter((p) => p.id !== part.id);
          if (selectedId === part.id) selectedId = null;
          persist();
          renderAll();
        };
        chip.appendChild(x);
      }
      list.appendChild(chip);
    }
    editor.appendChild(list);

    // sliders for the selected part
    const selected = spec.parts.find((p) => p.id === selectedId);
    if (!selected) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'select a part to tune it · drag new parts onto the canvas';
      editor.appendChild(hint);
    } else {
      for (const s of PART_SCHEMAS[selected.type]) {
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

    // actions
    const actions = document.createElement('div');
    actions.className = 'actions';
    const copy = document.createElement('button');
    copy.textContent = '⧉ COPY CONFIG';
    copy.onclick = () => {
      void navigator.clipboard.writeText(JSON.stringify(spec, null, 2)).then(() => {
        copy.textContent = '✓ COPIED';
        setTimeout(() => {
          copy.textContent = '⧉ COPY CONFIG';
        }, 1200);
      });
    };
    const reset = document.createElement('button');
    reset.textContent = 'RESET';
    reset.onclick = () => {
      clearMechOverride(currentEnemyId());
      spec = structuredClone(MECH_DEFAULTS[currentEnemyId()]);
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

  renderPalette();
  renderAll();

  // walk animation — 4-frame cycle
  setInterval(() => {
    frame = (frame + 1) % 4;
    redraw();
  }, 120);

  return root;
}
