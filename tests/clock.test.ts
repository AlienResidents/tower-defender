import { describe, expect, it } from 'vitest';
import { Clock } from '../src/core/clock';

// fixedDt 0.25 is exactly representable in binary floats, keeping step
// counts exact — 1/60 would make boundary assertions float-flaky.
const DT = 0.25;

/** Feed real time in sub-clamp frames (Clock clamps each advance() to 0.25s). */
function run(clock: Clock, seconds: number, step: () => void): void {
  for (let t = 0; t < seconds; t += 0.25) {
    clock.advance(0.25, step);
  }
}

describe('Clock', () => {
  it('runs fixed steps per real second at 1x', () => {
    const clock = new Clock(DT);
    let steps = 0;
    run(clock, 1, () => steps++);
    expect(steps).toBe(4);
  });

  it('scales steps at 2x and 4x', () => {
    const clock = new Clock(DT);
    let steps = 0;
    clock.setScale(2);
    run(clock, 1, () => steps++);
    expect(steps).toBe(8);
    clock.setScale(4);
    run(clock, 1, () => steps++);
    expect(steps).toBe(8 + 16);
  });

  it('freezes at 0 (tactical pause) and resumes', () => {
    const clock = new Clock(DT);
    let steps = 0;
    clock.setScale(0);
    run(clock, 1, () => steps++);
    expect(steps).toBe(0);
    expect(clock.paused).toBe(true);
    clock.togglePause();
    run(clock, 1, () => steps++);
    expect(steps).toBe(4);
  });

  it('accumulates fractional frames into whole steps', () => {
    const clock = new Clock(DT);
    let steps = 0;
    clock.advance(0.125, () => steps++);
    expect(steps).toBe(0);
    clock.advance(0.125, () => steps++);
    expect(steps).toBe(1);
  });

  it('clamps huge real deltas (tab-sleep guard)', () => {
    const clock = new Clock(DT);
    let steps = 0;
    clock.advance(60, () => steps++);
    expect(steps).toBe(1); // real dt clamped to 0.25s
  });

  it('ignores negative deltas', () => {
    const clock = new Clock(DT);
    let steps = 0;
    clock.advance(-5, () => steps++);
    expect(steps).toBe(0);
  });

  it('tracks simulated elapsed time', () => {
    const clock = new Clock(DT);
    run(clock, 1, () => {});
    expect(clock.elapsed).toBe(1);
  });
});
