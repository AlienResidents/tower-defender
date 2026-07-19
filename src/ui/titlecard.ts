import { Container, Graphics, Text } from 'pixi.js';

/**
 * Bebop-style title card (spec §2). Intro persists until the user dismisses
 * it, lingers ~1/3 longer, then fades. Doubles as the pause screen: fast in
 * on pause, instant out on unpause.
 */

export interface TitleCard {
  container: Container;
  update(dt: number): void;
  /** User interaction during the intro — starts the linger-then-fade. */
  dismiss(): void;
  /** Pause: bring the card up. */
  show(): void;
  /** Unpause: drop the card instantly. */
  hide(): void;
}

type CardState = 'intro-in' | 'intro-hold' | 'intro-linger' | 'intro-out' | 'hidden' | 'pause';

const INTRO_IN = 0.6;
const LINGER = 1.4; // ≈1/3 longer than the original 4.2s sequence
const FADE_OUT = 0.8;

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

  let state: CardState = 'intro-in';
  let t = 0;
  const easeOut = (x: number): number => 1 - Math.pow(1 - x, 3);

  function setFullyShown(): void {
    top.y = 0;
    bottom.y = height - barH;
    titleText.alpha = 1;
    subText.alpha = 1;
  }

  function update(dt: number): void {
    t += dt;
    switch (state) {
      case 'intro-in': {
        const k = Math.min(t / INTRO_IN, 1);
        top.y = -barH + easeOut(k) * barH;
        bottom.y = height - easeOut(k) * barH;
        titleText.alpha = Math.min(Math.max((t - 0.3) / 0.4, 0), 1);
        subText.alpha = Math.min(Math.max((t - 0.5) / 0.4, 0), 1);
        if (k >= 1) state = 'intro-hold';
        break;
      }
      case 'intro-hold':
        break; // persists until dismiss()
      case 'intro-linger':
        if (t >= LINGER) {
          state = 'intro-out';
          t = 0;
        }
        break;
      case 'intro-out': {
        const k = Math.min(t / FADE_OUT, 1);
        container.alpha = 1 - k;
        if (k >= 1) {
          state = 'hidden';
          container.visible = false;
        }
        break;
      }
      case 'pause':
        container.alpha = Math.min(container.alpha + dt * 4, 1); // fast fade-in
        break;
      case 'hidden':
        break;
    }
  }

  function dismiss(): void {
    if (state === 'intro-in' || state === 'intro-hold') {
      setFullyShown();
      state = 'intro-linger';
      t = 0;
    }
  }

  function show(): void {
    setFullyShown();
    container.visible = true;
    container.alpha = 0;
    state = 'pause';
  }

  function hide(): void {
    if (state !== 'pause') return;
    state = 'hidden';
    container.visible = false;
  }

  return { container, update, dismiss, show, hide };
}
