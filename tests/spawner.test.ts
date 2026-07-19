import { describe, expect, it } from 'vitest';
import { WaveSpawner } from '../src/game/spawner';

describe('WaveSpawner', () => {
  it('emits every spawn in the table and finishes', () => {
    const spawner = new WaveSpawner([{ enemy: 'walker', count: 5, interval: 1, delay: 0 }]);
    const spawned: string[] = [];
    for (let t = 0; t < 6; t += 0.05) spawner.update(0.05, (id) => spawned.push(id));
    expect(spawned).toHaveLength(5);
    expect(spawned.every((s) => s === 'walker')).toBe(true);
    expect(spawner.done).toBe(true);
  });

  it('respects group delays', () => {
    const spawner = new WaveSpawner([
      { enemy: 'walker', count: 2, interval: 0.5, delay: 0 },
      { enemy: 'swarm', count: 2, interval: 0.5, delay: 5 },
    ]);
    const spawned: { at: number; id: string }[] = [];
    let t = 0;
    while (!spawner.done && t < 10) {
      spawner.update(0.05, (id) => spawned.push({ at: t, id }));
      t += 0.05;
    }
    expect(spawned.map((s) => s.id)).toEqual(['walker', 'walker', 'swarm', 'swarm']);
    expect(spawned[2].at).toBeGreaterThanOrEqual(4.9);
  });

  it('reports remaining count', () => {
    const spawner = new WaveSpawner([{ enemy: 'walker', count: 3, interval: 1, delay: 0 }]);
    expect(spawner.remaining).toBe(3);
    spawner.update(0.5, () => {}); // first spawn (t=0) has fired
    expect(spawner.remaining).toBe(2);
  });
});
