import { Container, Graphics, Text } from 'pixi.js';

/** Bebop-style title card — letterbox bars + system-log typography (spec §2). */

export interface TitleCard {
  container: Container;
  /** Returns false once the card has finished and can be discarded. */
  update(dt: number): boolean;
}

export function showTitleCard(
  width: number,
  height: number,
  title: string,
  subtitle: string,
): TitleCard {
  const container = new Container();
  const barH = Math.round(height * 0.12);

  const top = new Graphics().rect(0, 0, width, barH).fill(0x000000);
  const bottom = new Graphics().rect(0, height - barH, width, barH).fill(0x000000);
  top.y = -barH;
  bottom.y = height;

  const titleText = new Text({
    text: title,
    style: {
      fontFamily: '"Courier New", monospace',
      fontSize: 44,
      fill: 0xe8f6ff,
      letterSpacing: 10,
    },
  });
  titleText.anchor.set(0.5);
  titleText.position.set(width / 2, height / 2 - 14);
  titleText.alpha = 0;

  const subText = new Text({
    text: subtitle,
    style: {
      fontFamily: '"Courier New", monospace',
      fontSize: 16,
      fill: 0x3ec6d8,
      letterSpacing: 6,
    },
  });
  subText.anchor.set(0.5);
  subText.position.set(width / 2, height / 2 + 30);
  subText.alpha = 0;

  container.addChild(top, bottom, titleText, subText);

  let t = 0;
  const easeOut = (x: number): number => 1 - Math.pow(1 - x, 3);

  function update(dt: number): boolean {
    t += dt;
    const inT = Math.min(t / 0.6, 1);
    top.y = -barH + easeOut(inT) * barH;
    bottom.y = height - easeOut(inT) * barH;
    titleText.alpha = Math.min(Math.max((t - 0.5) / 0.5, 0), 1);
    subText.alpha = Math.min(Math.max((t - 0.8) / 0.5, 0), 1);
    if (t > 3.4) {
      const outT = Math.min((t - 3.4) / 0.8, 1);
      container.alpha = 1 - outT;
      if (outT >= 1) return false;
    }
    return true;
  }

  return { container, update };
}
