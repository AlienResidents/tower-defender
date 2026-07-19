import { Container, Graphics, Text } from 'pixi.js';
import { playDiceRoll } from '../audio/ambient';
import type { TowerDef } from '../data/towers';
import { DIE_SIDES, type Die, type DiceSystem } from '../game/dice';

/**
 * Purchase panel — the dice gamble UI (spec §8). Modal: commit tray dice,
 * roll up to N chances, physics tumble theater, success places the tower,
 * bust/abandon converts dice to salvage. Right rail: palladium shop.
 */

const PANEL_W = 920;
const PANEL_H = 540;

const DIE_TINTS: Record<number, number> = {
  3: 0x00e5ff,
  6: 0x9df5ff,
  8: 0x66d9ff,
  10: 0xffa63d,
  12: 0xffe66b,
  20: 0xff2bd6,
  100: 0xff3355,
};

interface RollingDie {
  view: Container;
  label: Text;
  face: number;
  vx: number;
  vy: number;
  va: number;
  settled: boolean;
}

function polyPoints(sides: number, r: number): number[] {
  const n = sides === 100 ? 24 : sides <= 3 ? 3 : Math.min(sides, 8);
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
}

function button(
  label: string,
  tint: number,
  onClick: () => void,
  enabled: () => boolean = () => true,
): { container: Container; bg: Graphics; refresh: () => void } {
  const container = new Container();
  const bg = new Graphics();
  const text = new Text({
    text: label,
    style: { fontFamily: '"Courier New", monospace', fontSize: 13, fill: tint },
  });
  text.anchor.set(0.5);
  const w = Math.max(64, label.length * 8.2 + 18);
  const draw = (): void => {
    const on = enabled();
    bg.clear()
      .roundRect(-w / 2, -14, w, 28, 4)
      .fill({ color: 0x0b1020, alpha: on ? 1 : 0.5 })
      .stroke({ width: 1.5, color: tint, alpha: on ? 0.9 : 0.3 });
    text.alpha = on ? 1 : 0.35;
  };
  draw();
  container.addChild(bg, text);
  container.eventMode = 'static';
  container.cursor = 'pointer';
  container.on('pointerdown', (e) => {
    e.stopPropagation();
    if (enabled()) onClick();
  });
  return { container, bg, refresh: draw };
}

export class DicePanel {
  readonly container = new Container();
  #dice: DiceSystem;
  #onSuccess: (def: TowerDef) => void;
  #panel = new Container();
  #rolling: RollingDie[] = [];
  #rollSettling = false;
  #afterRoll: (() => void) | null = null;
  #buttons: { refresh: () => void }[] = [];

  constructor(dice: DiceSystem, onSuccess: (def: TowerDef) => void) {
    this.#dice = dice;
    this.#onSuccess = onSuccess;
    this.container.visible = false;
  }

  get isOpen(): boolean {
    return this.container.visible;
  }

  open(x: number, y: number): void {
    this.container.visible = true;
    this.container.removeChildren();
    this.#buttons = [];
    this.#rolling = [];
    this.#rollSettling = false;

    const dim = new Graphics()
      .rect(-4000, -4000, 8000, 8000)
      .fill({ color: 0x000000, alpha: 0.55 });
    dim.eventMode = 'static';
    this.container.addChild(dim);

    this.#panel = new Container();
    this.#panel.position.set(x - PANEL_W / 2, y - PANEL_H / 2);
    const bg = new Graphics();
    bg.roundRect(0, 0, PANEL_W, PANEL_H, 8)
      .fill({ color: 0x05070f, alpha: 0.97 })
      .stroke({ width: 2, color: 0x3ec6d8 });
    this.#panel.addChild(bg);
    this.container.addChild(this.#panel);
    this.#render();
  }

  close(): void {
    this.container.visible = false;
    this.container.removeChildren();
    if (this.#dice.purchase?.status === 'committing') this.#dice.abandon();
  }

  #text(str: string, size: number, fill: number, x: number, y: number): Text {
    const t = new Text({
      text: str,
      style: { fontFamily: '"Courier New", monospace', fontSize: size, fill },
    });
    t.position.set(x, y);
    this.#panel.addChild(t);
    return t;
  }

  #dieView(die: Die, tint: number, onClick?: () => void): Container {
    const c = new Container();
    const g = new Graphics();
    g.poly(polyPoints(die.sides, 20))
      .fill({ color: 0x0b1020, alpha: 0.9 })
      .stroke({ width: 2, color: tint });
    const label = new Text({
      text: `${die.sides}`,
      style: { fontFamily: '"Courier New", monospace', fontSize: 13, fill: tint },
    });
    label.anchor.set(0.5);
    c.addChild(g, label);
    if (onClick) {
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.on('pointerdown', (e) => {
        e.stopPropagation();
        onClick();
      });
    }
    return c;
  }

  #render(): void {
    const p = this.#dice.purchase;
    if (!p) return;
    this.#panel.removeChildren();
    this.#buttons = [];

    const bg = new Graphics();
    bg.roundRect(0, 0, PANEL_W, PANEL_H, 8)
      .fill({ color: 0x05070f, alpha: 0.97 })
      .stroke({ width: 2, color: 0x3ec6d8 });
    this.#panel.addChild(bg);

    this.#text(`PURCHASE :: ${p.def.name.toUpperCase()}`, 20, 0xe8f6ff, 24, 16);
    this.#text(`PRICE ${p.def.price}`, 16, 0xffa63d, 24, 46);
    this.#text(
      `TOTAL ${p.total} / ${p.def.price}`,
      16,
      p.total >= p.def.price ? 0x66ff99 : 0xe8f6ff,
      360,
      46,
    );

    // chances pips
    for (let i = 0; i < this.#dice.chances; i++) {
      const pip = new Graphics();
      pip.circle(0, 0, 6).fill(i < p.chancesLeft ? 0x66ff99 : 0x223344);
      pip.position.set(380 + i * 20, 24);
      this.#panel.addChild(pip);
    }

    // tray
    this.#text('TRAY (click to commit)', 12, 0x3ec6d8, 24, 84);
    this.#dice.tray.forEach((die, i) => {
      const v = this.#dieView(die, DIE_TINTS[die.sides] ?? 0xffffff, () => {
        if (this.#dice.commit(die.id)) this.#render();
      });
      v.position.set(52 + (i % 6) * 52, 128 + Math.floor(i / 6) * 52);
      this.#panel.addChild(v);
    });

    // committed
    this.#text('COMMITTED (click to take back)', 12, 0x3ec6d8, 360, 84);
    p.committed.forEach((die, i) => {
      const inPending = p.pending.some((d) => d.id === die.id);
      const v = this.#dieView(die, DIE_TINTS[die.sides] ?? 0xffffff, () => {
        if (this.#dice.uncommit(die.id)) this.#render();
      });
      v.alpha = inPending ? 1 : 0.45; // already rolled — on the table
      v.position.set(388 + (i % 5) * 52, 128 + Math.floor(i / 5) * 52);
      this.#panel.addChild(v);
    });

    // roll / abandon
    const rollBtn = button(
      'ROLL',
      0x66ff99,
      () => this.#doRoll(),
      () => p.pending.length > 0,
    );
    rollBtn.container.position.set(430, 240);
    this.#panel.addChild(rollBtn.container);
    this.#buttons.push(rollBtn);
    const abandonBtn = button('ABANDON', 0xff4455, () => {
      this.#dice.abandon();
      this.close();
    });
    abandonBtn.container.position.set(560, 240);
    this.#panel.addChild(abandonBtn.container);
    this.#buttons.push(abandonBtn);

    // shop rail
    const sx = 660;
    this.#text(`PALLADIUM ${Math.floor(this.#dice.palladium)}`, 14, 0xffa63d, sx, 84);
    this.#text('RECHARGE DICE', 12, 0x3ec6d8, sx, 112);
    DIE_SIDES.forEach((sides, i) => {
      const cost = this.#dice.rechargeCost(sides);
      const b = button(`d${sides} ${cost}`, DIE_TINTS[sides] ?? 0xffffff, () => {
        if (this.#dice.buyDie(sides)) this.#render();
      });
      b.container.position.set(sx + 52 + (i % 2) * 108, 146 + Math.floor(i / 2) * 36);
      this.#panel.addChild(b.container);
      this.#buttons.push(b);
    });
    this.#text(`TRAY ${this.#dice.tray.length}/${this.#dice.slots}`, 12, 0x3ec6d8, sx, 250);
    const slotBtn = button(`+SLOT ${this.#dice.slotCost()}`, 0x9df5ff, () => {
      if (this.#dice.buySlot()) this.#render();
    });
    slotBtn.container.position.set(sx + 64, 286);
    this.#panel.addChild(slotBtn.container);
    this.#buttons.push(slotBtn);
    const chanceBtn = button(`+CHANCE ${this.#dice.chanceCost()}`, 0x9df5ff, () => {
      if (this.#dice.buyChance()) this.#render();
    });
    chanceBtn.container.position.set(sx + 178, 286);
    this.#panel.addChild(chanceBtn.container);
    this.#buttons.push(chanceBtn);

    this.#text(`SALVAGE ${Math.floor(this.#dice.salvage)}`, 12, 0x8a9bb8, sx, 320);
    const refineBtn = button(
      'REFINE',
      0x8a9bb8,
      () => {
        this.#dice.refineSalvage();
        this.#render();
      },
      () => this.#dice.salvage >= 1,
    );
    refineBtn.container.position.set(sx + 190, 322);
    this.#panel.addChild(refineBtn.container);
    this.#buttons.push(refineBtn);

    this.#text(
      'rolls accumulate across chances · bust/abandon = dice become salvage (~22%)',
      11,
      0x3ec6d8,
      24,
      PANEL_H - 30,
    );
  }

  #doRoll(): void {
    const p = this.#dice.purchase;
    if (!p || p.pending.length === 0) return;
    const pendingSides = p.pending.map((d) => d.sides);
    const result = this.#dice.roll();
    playDiceRoll(pendingSides);

    // theater: tumble the pending dice, reveal faces on settle
    this.#rolling = pendingSides.map((sides, i) => {
      const view = this.#dieView({ id: -1, sides }, DIE_TINTS[sides] ?? 0xffffff);
      const label = new Text({
        text: '?',
        style: { fontFamily: '"Courier New", monospace', fontSize: 15, fill: 0xffffff },
      });
      label.anchor.set(0.5);
      view.addChild(label);
      view.position.set(80 + i * 60, 320);
      this.#panel.addChild(view);
      return {
        view,
        label,
        face: result.faces[i],
        vx: 220 + Math.random() * 260,
        vy: -(120 + Math.random() * 200),
        va: (Math.random() - 0.5) * 14,
        settled: false,
      };
    });
    this.#rollSettling = true;

    this.#afterRoll = () => {
      if (result.status === 'success') {
        const def = p.def;
        this.close();
        this.#onSuccess(def);
      } else if (result.status === 'bust') {
        this.close();
      } else {
        this.#render(); // next chance
      }
    };
  }

  update(dt: number): void {
    if (!this.container.visible) return;
    if (this.#rollSettling) {
      const floor = 430;
      const left = 40;
      const right = 620;
      let allSettled = true;
      for (const d of this.#rolling) {
        if (d.settled) continue;
        d.vy += 1400 * dt;
        d.view.x += d.vx * dt;
        d.view.y += d.vy * dt;
        d.view.rotation += d.va * dt;
        if (d.view.y > floor) {
          d.view.y = floor;
          d.vy *= -0.42;
          d.vx *= 0.7;
          d.va *= 0.6;
        }
        if (d.view.x < left) {
          d.view.x = left;
          d.vx *= -0.6;
        }
        if (d.view.x > right) {
          d.view.x = right;
          d.vx *= -0.6;
        }
        if (Math.abs(d.vy) < 40 && Math.abs(d.vx) < 30 && d.view.y >= floor - 1) {
          d.settled = true;
          d.view.rotation = 0;
          d.label.text = `${d.face}`;
        } else {
          allSettled = false;
        }
      }
      if (allSettled) {
        this.#rollSettling = false;
        const after = this.#afterRoll;
        this.#afterRoll = null;
        setTimeout(() => after?.(), 500);
      }
    }
  }
}
