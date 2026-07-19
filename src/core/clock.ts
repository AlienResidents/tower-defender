/**
 * Fixed-timestep clock with tactical pause and 1x/2x/4x time scale (spec §7).
 * Simulation consumes whole fixed steps; rendering may run faster.
 */

export type TimeScale = 0 | 1 | 2 | 4;

export const TIME_SCALES: readonly TimeScale[] = [0, 1, 2, 4];

/** Max real seconds processed per frame — tab-sleep / debugger guard. */
const MAX_REAL_DT = 0.25;

export class Clock {
  readonly fixedDt: number;
  #scale: TimeScale = 1;
  #accumulator = 0;
  #elapsed = 0;

  constructor(fixedDt = 1 / 60) {
    this.fixedDt = fixedDt;
  }

  get scale(): TimeScale {
    return this.#scale;
  }

  get paused(): boolean {
    return this.#scale === 0;
  }

  /** Total simulated seconds so far. */
  get elapsed(): number {
    return this.#elapsed;
  }

  setScale(scale: TimeScale): void {
    this.#scale = scale;
  }

  togglePause(): void {
    this.#scale = this.#scale === 0 ? 1 : 0;
  }

  /**
   * Advance the simulation by `realDt` real seconds, invoking `step(fixedDt)`
   * a whole number of times. Returns the number of steps executed.
   */
  advance(realDt: number, step: (dt: number) => void): number {
    const clamped = Math.min(Math.max(realDt, 0), MAX_REAL_DT);
    this.#accumulator += clamped * this.#scale;
    let steps = 0;
    while (this.#accumulator >= this.fixedDt) {
      step(this.fixedDt);
      this.#accumulator -= this.fixedDt;
      this.#elapsed += this.fixedDt;
      steps++;
    }
    return steps;
  }
}
