import { Container, Graphics, Text } from 'pixi.js';
import { TOWERS, type TowerDef } from '../data/towers';

/** Greybox build bar: tower select cards + run status. Pretty comes in M3. */

interface Entry {
  def: TowerDef;
  box: Graphics;
  x: number;
  y: number;
}

export class BuildBar {
  readonly container = new Container();
  #entries: Entry[] = [];
  #status: Text;

  constructor(width: number, y: number) {
    const bar = new Graphics().rect(0, y, width, 44).fill({ color: 0x05070f, alpha: 0.85 });
    this.container.addChild(bar);

    let x = 16;
    for (const def of TOWERS) {
      const box = new Graphics();
      this.#drawBox(box, def, x, y + 6, false);
      const label = new Text({
        text: `[${def.key.toUpperCase()}] ${def.name}`,
        style: { fontFamily: '"Courier New", monospace', fontSize: 12, fill: def.tint },
      });
      label.position.set(x + 10, y + 16);
      this.container.addChild(box, label);
      this.#entries.push({ def, box, x, y: y + 6 });
      x += 136;
    }

    this.#status = new Text({
      text: '',
      style: { fontFamily: '"Courier New", monospace', fontSize: 13, fill: 0x3ec6d8 },
    });
    this.#status.anchor.set(1, 0);
    this.#status.position.set(width - 16, y + 15);
    this.container.addChild(this.#status);
  }

  #drawBox(box: Graphics, def: TowerDef, x: number, y: number, selected: boolean): void {
    box
      .clear()
      .roundRect(x, y, 124, 32, 4)
      .fill({ color: 0x0b1020 })
      .stroke({ width: selected ? 2.5 : 1, color: def.tint, alpha: selected ? 1 : 0.45 });
  }

  setSelected(id: string | null): void {
    for (const e of this.#entries) {
      this.#drawBox(e.box, e.def, e.x, e.y, e.def.id === id);
    }
  }

  setStatus(text: string): void {
    this.#status.text = text;
  }
}
