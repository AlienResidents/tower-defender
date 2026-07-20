import { Container, Graphics, Text } from 'pixi.js';
import type { ItemDef } from '../data/items';

/** Elite-drop item picker — shows the d4-rolled pool, pick 1 (or ESC to discard). */

const CARD_W = 200;
const CARD_H = 110;

export class ItemModal {
  readonly container = new Container();
  #resolve: ((item: ItemDef | null) => void) | null = null;

  get isOpen(): boolean {
    return this.container.visible;
  }

  open(
    items: ItemDef[],
    roll: number,
    x: number,
    y: number,
    resolve: (item: ItemDef | null) => void,
  ): void {
    this.container.removeChildren();
    this.#resolve = resolve;
    this.container.visible = true;

    const w = items.length * (CARD_W + 16) + 48;
    const h = CARD_H + 90;
    const dim = new Graphics().rect(-4000, -4000, 8000, 8000).fill({ color: 0x000000, alpha: 0.5 });
    dim.eventMode = 'static';
    this.container.addChild(dim);

    const panel = new Graphics();
    panel
      .roundRect(x - w / 2, y - h / 2, w, h, 8)
      .fill({ color: 0x05070f, alpha: 0.97 })
      .stroke({ width: 2, color: 0xffa63d });
    this.container.addChild(panel);

    const title = new Text({
      text: `ELITE DROP :: d4 rolled ${roll} — pick 1 (or [esc] discard)`,
      style: { fontFamily: '"Courier New", monospace', fontSize: 15, fill: 0xffa63d },
    });
    title.anchor.set(0.5, 0);
    title.position.set(x, y - h / 2 + 14);
    this.container.addChild(title);

    items.forEach((item, i) => {
      const cx = x - ((items.length - 1) / 2) * (CARD_W + 16) + i * (CARD_W + 16);
      const cy = y + 16;
      const card = new Container();
      const bg = new Graphics();
      bg.roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 6)
        .fill({ color: 0x0b1020 })
        .stroke({ width: 1.5, color: 0x9df5ff, alpha: 0.7 });
      const name = new Text({
        text: item.name,
        style: {
          fontFamily: '"Courier New", monospace',
          fontSize: 13,
          fill: 0xe8f6ff,
          wordWrap: true,
          wordWrapWidth: CARD_W - 20,
          align: 'center',
        },
      });
      name.anchor.set(0.5, 0);
      name.position.set(0, -CARD_H / 2 + 14);
      const desc = new Text({
        text: item.desc,
        style: {
          fontFamily: '"Courier New", monospace',
          fontSize: 12,
          fill: 0x3ec6d8,
          align: 'center',
        },
      });
      desc.anchor.set(0.5, 0);
      desc.position.set(0, 10);
      card.addChild(bg, name, desc);
      card.position.set(cx, cy);
      card.eventMode = 'static';
      card.cursor = 'pointer';
      card.on('pointerdown', (e) => {
        e.stopPropagation();
        this.close(item);
      });
      this.container.addChild(card);
    });
  }

  close(item: ItemDef | null): void {
    this.container.visible = false;
    this.container.removeChildren();
    const r = this.#resolve;
    this.#resolve = null;
    r?.(item);
  }
}
