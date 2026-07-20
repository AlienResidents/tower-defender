import { Container, Graphics, Text } from 'pixi.js';
import { getMasterVolume, setMasterVolume } from '../audio/ambient';
import { playWeaponSound } from '../audio/sfx';
import { settings } from '../settings';

/**
 * Pause menu (ESC/space). Letterbox bars, PAUSED centered in the top bar,
 * center panel: RESUME / VOLUME / RESTART LEVEL / QUIT.
 *
 * The volume control is a native <input type="range"> overlaid on the canvas —
 * real drag, click-to-set, wheel, and a fat grab-ball. Pixi hit-testing on a
 * thin slider proved unreliable across render scales; the DOM doesn't miss.
 */

export interface PauseMenuActions {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

/** Maps design-space coords to CSS-pixel screen coords (canvas is fixed full-window). */
export type DesignToScreen = (dx: number, dy: number) => { x: number; y: number };

function menuButton(label: string, tint: number, onClick: () => void): { container: Container } {
  const container = new Container();
  const bg = new Graphics();
  const text = new Text({
    text: label,
    style: { fontFamily: '"Courier New", monospace', fontSize: 16, fill: tint },
  });
  text.anchor.set(0.5);
  bg.roundRect(-90, -18, 180, 36, 4)
    .fill({ color: 0x0b1020 })
    .stroke({ width: 1.5, color: tint, alpha: 0.8 });
  container.addChild(bg, text);
  container.eventMode = 'static';
  container.cursor = 'pointer';
  container.on('pointerdown', (e) => {
    e.stopPropagation();
    onClick();
  });
  return { container };
}

export class PauseMenu {
  readonly container = new Container();
  #actions: PauseMenuActions;
  #toScreen: DesignToScreen;
  #volSlider: HTMLInputElement | null = null;
  #volText: Text | null = null;
  #auditionT = -1; // debounce timer for the volume audition beep

  constructor(actions: PauseMenuActions, toScreen: DesignToScreen) {
    this.#actions = actions;
    this.#toScreen = toScreen;
    this.container.visible = false;
  }

  get isOpen(): boolean {
    return this.container.visible;
  }

  /** Drives the audition-beep debounce. */
  update(dt: number): void {
    if (this.#auditionT < 0) return;
    this.#auditionT -= dt;
    if (this.#auditionT <= 0) {
      this.#auditionT = -1;
      // fire OUTSIDE the ticker, exception-wrapped: a Tone throw inside the
      // ticker callback kills pixi's RAF loop and freezes all rendering
      setTimeout(() => {
        try {
          playWeaponSound('beam');
        } catch {
          // audio not ready — skip the audition
        }
      }, 0);
    }
  }

  open(x: number, y: number): void {
    this.container.removeChildren();
    this.container.visible = true;

    const dim = new Graphics().rect(-4000, -4000, 8000, 8000).fill({ color: 0x000000, alpha: 0.6 });
    dim.eventMode = 'static';
    this.container.addChild(dim);

    // letterbox curtains; PAUSED lives centered in the top one
    const barH = Math.round(y * 2 * 0.12);
    const top = new Graphics().rect(-4000, -4000, 8000, 4000 + barH).fill(0x000000);
    const bottom = new Graphics().rect(-4000, y * 2 - barH, 8000, 4000 + barH).fill(0x000000);
    const paused = new Text({
      text: 'P A U S E D',
      style: {
        fontFamily: '"Courier New", monospace',
        fontSize: 26,
        fill: 0x3ec6d8,
        letterSpacing: 12,
      },
    });
    paused.anchor.set(0.5);
    paused.position.set(x, barH / 2);
    this.container.addChild(top, bottom, paused);

    // center panel
    const panel = new Graphics();
    panel
      .roundRect(x - 220, y - 170, 440, 340, 8)
      .fill({ color: 0x05070f, alpha: 0.97 })
      .stroke({ width: 2, color: 0x3ec6d8 });
    this.container.addChild(panel);

    const resume = menuButton('RESUME', 0x66ff99, this.#actions.onResume);
    resume.container.position.set(x, y - 110);
    this.container.addChild(resume.container);

    // volume — native slider, real drag, neon grab-ball (CSS in index.html)
    const volLabel = new Text({
      text: 'VOLUME',
      style: { fontFamily: '"Courier New", monospace', fontSize: 13, fill: 0x3ec6d8 },
    });
    volLabel.anchor.set(0.5);
    volLabel.position.set(x, y - 48);
    this.container.addChild(volLabel);

    const left = this.#toScreen(x - 120, y - 16);
    const right = this.#toScreen(x + 120, y - 16);
    const centerY = this.#toScreen(x, y - 12).y;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(getMasterVolume() * 100));
    slider.className = 'phosphor-slider';
    slider.style.left = `${left.x}px`;
    slider.style.top = `${centerY - 14}px`; // 28px grab zone centered on the track
    slider.style.width = `${right.x - left.x}px`;
    slider.addEventListener('input', () => {
      this.#setVolume(Number(slider.value) / 100);
    });
    slider.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const v = Math.min(Math.max(getMasterVolume() - Math.sign(e.deltaY) * 0.05, 0), 1);
        this.#setVolume(v);
      },
      { passive: false },
    );
    document.body.appendChild(slider);
    this.#volSlider = slider;

    this.#volText = new Text({
      text: '',
      style: { fontFamily: '"Courier New", monospace', fontSize: 12, fill: 0x9df5ff },
    });
    this.#volText.anchor.set(0.5);
    this.#volText.position.set(x, y + 8);
    this.container.addChild(this.#volText);
    this.#renderVolume();

    const restart = menuButton('RESTART LEVEL', 0xffa63d, this.#actions.onRestart);
    restart.container.position.set(x, y + 66);
    this.container.addChild(restart.container);

    const quit = menuButton('QUIT', 0xff4455, this.#actions.onQuit);
    quit.container.position.set(x, y + 120);
    this.container.addChild(quit.container);
  }

  #setVolume(v: number): void {
    setMasterVolume(v);
    this.#renderVolume();
    this.#auditionT = settings.ui.volumeAuditionDelaySeconds;
  }

  #renderVolume(): void {
    const v = getMasterVolume();
    const pct = Math.round(v * 100);
    if (this.#volText) this.#volText.text = `${pct}%`;
    if (this.#volSlider) {
      if (this.#volSlider.value !== String(pct)) this.#volSlider.value = String(pct);
      this.#volSlider.style.setProperty('--fill', `${pct}%`);
    }
  }

  close(): void {
    this.container.visible = false;
    this.container.removeChildren();
    this.#volSlider?.remove();
    this.#volSlider = null;
  }
}
