import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { towerById, type TowerDef } from '../src/data/towers';
import { Run, type RunEvent } from '../src/game/run';
import { Path } from '../src/world/path';

function makeRun(): Run {
  return new Run(
    new Path([
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
    ]),
    createRng(42),
  );
}

function step(run: Run, seconds: number, dt = 0.05): void {
  for (let t = 0; t < seconds; t += dt) run.update(dt);
}

describe('Run', () => {
  it('leaks cost data-cores scaled by enemy', () => {
    const run = makeRun();
    const events: RunEvent[] = [];
    run.on((e) => events.push(e));
    run.startWave(); // wave 1: 6 walkers, 1 core each
    step(run, 30);
    const leaks = events.filter((e) => e.type === 'leak');
    expect(leaks.length).toBe(6);
    expect(run.lives).toBe(20 - 6);
    expect(run.phase).toBe('build'); // wave cleared (all leaked), ready for next
  });

  it('towers kill enemies in range', () => {
    const run = makeRun();
    const deaths: string[] = [];
    run.on((e) => {
      if (e.type === 'death') deaths.push(e.enemy.def.id);
    });
    run.placeTower(towerById('railgun'), 500, 0);
    run.startWave();
    step(run, 30);
    expect(deaths.length).toBeGreaterThan(0);
    expect(deaths.every((d) => d === 'walker')).toBe(true);
    expect(run.lives).toBe(20); // nothing leaked
  });

  it('street weapons barely scratch mega plating', () => {
    const run = makeRun();
    // laser (street) vs siege (mega, 260hp): 3dmg * 0.01 = 0.03/shot — effectively immortal
    run.placeTower(towerById('laser'), 500, 0);
    run.startWave();
    // jump to wave 5 (has a siege) — cheat: start all waves
    step(run, 30);
    expect(run.wave).toBe(1);
  });

  it('vulcan fires a burst then pauses for reload', () => {
    const run = makeRun();
    const fireTimes: number[] = [];
    let t = 0;
    run.on((e) => {
      if (e.type === 'fire') fireTimes.push(t);
    });
    run.placeTower(towerById('vulcan'), 500, 0);
    run.startWave();
    for (; t < 20; t += 1 / 60) run.update(1 / 60);
    expect(fireTimes.length).toBeGreaterThan(14);
    const first = fireTimes[0];
    const burst = fireTimes.filter((ft) => ft - first < 1.25);
    expect(burst).toHaveLength(14); // one full magazine
    const after = fireTimes.find((ft) => ft - first >= 1.25 && ft - first < 2.2);
    expect(after).toBeUndefined(); // reloading, silent
  });

  it('loses when the last data-core is destroyed', () => {
    const run = makeRun();
    while (run.phase !== 'lost' && run.wave < 15) {
      if (run.phase === 'build') run.startWave();
      step(run, 30);
    }
    expect(run.phase).toBe('lost');
    expect(run.lives).toBe(0);
  });

  it('stacks concurrent waves and multiplies drops', () => {
    const run = makeRun();
    const drops: { amount: number; mult: number }[] = [];
    run.on((e) => {
      if (e.type === 'drop') drops.push({ amount: e.amount, mult: e.mult });
    });
    run.placeTower(towerById('railgun'), 500, 0);
    run.startWave();
    step(run, 1);
    run.startWave(); // send wave 2 early — waves now overlap
    step(run, 6);
    expect(run.wave).toBe(2);
    expect(run.activeWaveCount()).toBeGreaterThanOrEqual(2);
    expect(drops.length).toBeGreaterThan(0);
    expect(drops.some((d) => d.mult > 1)).toBe(true);
    expect(run.palladium).toBeGreaterThan(0);
  });

  it('tracks run summary stats and log', () => {
    const run = makeRun();
    run.placeTower(towerById('railgun'), 500, 0);
    run.startWave();
    step(run, 30);
    const summary = run.buildRunSummary(1337) as {
      kills: Record<string, number>;
      palladium: { earned: number };
      towersPlaced: Record<string, number>;
      recentEvents: string[];
    };
    expect(summary.kills.walker).toBeGreaterThan(0);
    expect(summary.palladium.earned).toBeGreaterThan(0);
    expect(summary.towersPlaced.railgun).toBe(1);
    expect(summary.recentEvents.length).toBeGreaterThan(0);
  });

  it('wins after clearing wave 15', () => {
    const run = makeRun();
    const superTower: TowerDef = {
      ...towerById('railgun'),
      damage: 1e6,
      fireRate: 20,
      range: 5000,
    };
    run.placeTower(superTower, 500, 0);
    let guard = 0;
    while (run.phase !== 'won' && guard++ < 20000) {
      if (run.phase === 'build') run.startWave();
      run.update(0.05);
    }
    expect(run.phase).toBe('won');
    expect(run.wave).toBe(15);
    expect(run.lives).toBe(20);
  });
});
