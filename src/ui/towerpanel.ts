import { Container, Graphics, Text } from 'pixi.js';
import { MAX_ITEMS_PER_TOWER, type ItemDef } from '../data/items';
import type { TowerState } from '../game/run';

/**
 * Tower inspect panel — click a placed tower to see its stats and socketed
 * items. With a pending drop and full sockets, offers [swap] per item slot;
 * the swapped-out (used) item yields flat salvage.
 */

export interface TowerPanelOpts {
  pendingItem: ItemDef | null;
  onReplace: (index: number) => void;
}

function rowButton(label: string, onClick: () => void): Container {
  const c = new Container();
  const bg = new Graphics();
  const text = new Text({
    text: label,
    style: { fontFamily: '"Courier New", monospace', fontSize: 11, fill: 0xffa63d },
  });
  text.anchor.set(0.5);
  bg.roundRect(-30, -9, 60, 18, 3)
    .fill({ color: 0x0b1020 })
    .stroke({ width: 1, color: 0xffa63d, alpha: 0.9 });
  c.addChild(bg, text);
  c.eventMode = 'static';
  c.cursor = 'pointer';
  c.on('pointerdown', (e) => {
    e.stopPropagation();
    onClick();
  });
  return c;
}

export class TowerPanel {
  readonly container = new Container();

  constructor() {
    this.container.visible = false;
  }

  get isOpen(): boolean {
    return this.container.visible;
  }

  open(tower: TowerState, opts: TowerPanelOpts): void {
    this.container.removeChildren();
    this.container.visible = true;

    const rows = MAX_ITEMS_PER_TOWER;
    const w = 250;
    const h = 88 + rows * 26;
    // keep the panel on-screen near the tower
    const px = Math.min(Math.max(tower.x + 22, 8), 1920 - w - 8);
    const py = Math.min(Math.max(tower.y - h / 2, 8), 1080 - h - 8);

    const bg = new Graphics();
    bg.roundRect(px, py, w, h, 6)
      .fill({ color: 0x05070f, alpha: 0.96 })
      .stroke({ width: 1.5, color: 0x3ec6d8 });
    bg.eventMode = 'static'; // swallow clicks — empty-space clicks close the panel
    this.container.addChild(bg);

    const title = new Text({
      text: tower.def.name,
      style: { fontFamily: '"Courier New", monospace', fontSize: 13, fill: 0x9df5ff },
    });
    title.position.set(px + 12, py + 10);
    this.container.addChild(title);

    const stats = new Text({
      text: `dmg ${tower.def.damage} · rng ${tower.def.range}`,
      style: { fontFamily: '"Courier New", monospace', fontSize: 11, fill: 0x8a9bb8 },
    });
    stats.position.set(px + 12, py + 30);
    this.container.addChild(stats);

    const slotsLabel = new Text({
      text: opts.pendingItem ? `SWAP IN: ${opts.pendingItem.name}` : 'SOCKETS',
      style: {
        fontFamily: '"Courier New", monospace',
        fontSize: 11,
        fill: opts.pendingItem ? 0xffa63d : 0x3ec6d8,
      },
    });
    slotsLabel.position.set(px + 12, py + 54);
    this.container.addChild(slotsLabel);

    for (let i = 0; i < rows; i++) {
      const item = tower.items[i];
      const row = new Text({
        text: item ? `▸ ${item.name} — ${item.desc}` : '▸ — empty —',
        style: {
          fontFamily: '"Courier New", monospace',
          fontSize: 11,
          fill: item ? 0xffffff : 0x445566,
        },
      });
      row.position.set(px + 12, py + 76 + i * 26);
      this.container.addChild(row);
      if (opts.pendingItem && item) {
        const swap = rowButton('SWAP', () => opts.onReplace(i));
        swap.position.set(px + w - 44, py + 82 + i * 26);
        this.container.addChild(swap);
      }
    }
  }

  close(): void {
    this.container.visible = false;
    this.container.removeChildren();
  }
}
