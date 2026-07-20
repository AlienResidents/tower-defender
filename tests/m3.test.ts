import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { ITEMS, MAX_ITEMS_PER_TOWER } from '../src/data/items';
import { towerById, type TowerDef } from '../src/data/towers';
import { Run, type RunEvent } from '../src/game/run';
import { Path } from '../src/world/path';
import { settings } from '../src/settings';

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

describe('M3 mechanics', () => {
  it('aegis shield absorbs hp damage until depleted', () => {
    const run = makeRun();
    run.placeTower(towerById('laser'), 200, 0);
    const e = run.debugSpawn('aegis');
    step(run, 3);
    expect(e.shield).toBeLessThan(40);
    expect(e.hp).toBe(60); // shield soaked everything so far
  });

  it('tesla EMP strips shields x3', () => {
    const run = makeRun();
    run.placeTower(towerById('tesla'), 200, 0);
    const e = run.debugSpawn('aegis');
    step(run, 4);
    expect(e.shield).toBe(0);
    expect(e.hp).toBeLessThan(60); // hp damage after the shield fell
  });

  it('shield regenerates after 3s undamaged', () => {
    const run = makeRun();
    run.placeTower(towerById('laser'), 200, 0);
    const e = run.debugSpawn('aegis');
    step(run, 4);
    const lowShield = e.shield;
    // enemy walks out of laser range (170) around x=370 → ~8s; regen after +3s
    step(run, 12);
    expect(e.shield).toBeGreaterThan(lowShield);
  });

  it('repair spider heals nearby allies but not itself or the boss', () => {
    const run = makeRun();
    const walker = run.debugSpawn('walker');
    walker.hp = 20; // pre-damaged
    const spider = run.debugSpawn('spider');
    spider.dist = walker.dist; // co-located, inside the 60px aura
    const boss = run.debugSpawn('boss');
    boss.hp = 1000;
    boss.dist = walker.dist;
    const spiderHpBefore = spider.hp;
    step(run, 3);
    expect(walker.hp).toBeGreaterThan(20);
    expect(spider.hp).toBe(spiderHpBefore); // no self-heal
    expect(boss.hp).toBe(1000); // boss excluded
  });

  it('boss anchors on a cycle and takes reduced damage while anchored', () => {
    const run = makeRun();
    run.placeTower(towerById('railgun'), 500, 0);
    const boss = run.debugSpawn('boss');
    boss.dist = 600; // already inside the railgun's range
    expect(boss.anchored).toBe(false);
    // unanchored window (0-5s): one full-damage shot
    step(run, 1.5);
    const freeLoss = 2200 - boss.hp;
    expect(freeLoss).toBeGreaterThan(0);
    // anchored window (5-8s): reduced damage
    step(run, 4); // t=5.5
    expect(boss.anchored).toBe(true);
    const hpA = boss.hp;
    step(run, 2); // t=7.5, still anchored
    const anchoredLoss = hpA - boss.hp;
    // per-second damage rate while anchored is ~40% of free rate (55 vs 22)
    expect(freeLoss / 1.5).toBeGreaterThan((anchoredLoss / 2) * 1.5);
  });

  it('elite deaths roll a d4 item pool of distinct items', () => {
    const run = makeRun();
    const drops: { items: { id: string }[]; roll: number }[] = [];
    run.on((e: RunEvent) => {
      if (e.type === 'eliteDrop') drops.push(e);
    });
    const superTower: TowerDef = {
      ...towerById('railgun'),
      damage: 1e6,
      fireRate: 20,
      range: 5000,
    };
    run.placeTower(superTower, 500, 0);
    run.debugSpawn('boss');
    step(run, 1);
    expect(drops).toHaveLength(1);
    const d = drops[0];
    expect(d.roll).toBeGreaterThanOrEqual(1);
    expect(d.roll).toBeLessThanOrEqual(4);
    expect(d.items.length).toBe(d.roll);
    expect(new Set(d.items.map((i) => i.id)).size).toBe(d.items.length); // distinct
    expect(d.items.every((i) => ITEMS.some((def) => def.id === i.id))).toBe(true);
  });

  it('items socket onto towers and stack to MAX_ITEMS_PER_TOWER', () => {
    const run = makeRun();
    const tower = run.placeTower(towerById('vulcan'), 500, 0);
    const amp = ITEMS.find((i) => i.id === 'amp');
    const scope = ITEMS.find((i) => i.id === 'scope');
    const drum = ITEMS.find((i) => i.id === 'drum');
    expect(amp && scope && drum).toBeTruthy();
    expect(run.applyItem(tower.uid, amp!)).toBe(true);
    expect(tower.mods.damage).toBeCloseTo(0.25);
    expect(run.applyItem(tower.uid, scope!)).toBe(true);
    expect(tower.mods.range).toBeCloseTo(0.2);
    expect(run.applyItem(tower.uid, drum!)).toBe(false); // at cap
    expect(tower.items).toHaveLength(MAX_ITEMS_PER_TOWER);
  });

  it('replaceItem swaps a socket and rebuilds mods from the item set', () => {
    const run = makeRun();
    const tower = run.placeTower(towerById('vulcan'), 500, 0);
    const amp = ITEMS.find((i) => i.id === 'amp')!;
    const scope = ITEMS.find((i) => i.id === 'scope')!;
    const overclock = ITEMS.find((i) => i.id === 'overclock')!;
    run.applyItem(tower.uid, amp);
    run.applyItem(tower.uid, scope);
    const replaced = run.replaceItem(tower.uid, 0, overclock);
    expect(replaced?.id).toBe('amp');
    expect(tower.items.map((i) => i.id)).toEqual(['overclock', 'scope']);
    expect(tower.mods.damage).toBeCloseTo(0); // amp's mod is gone
    expect(tower.mods.rate).toBeCloseTo(0.25);
    expect(tower.mods.range).toBeCloseTo(0.2); // scope untouched
    expect(run.replaceItem(tower.uid, 9, overclock)).toBeNull();
    expect(run.replaceItem(999, 0, overclock)).toBeNull();
  });

  it('salvage: addSalvage credits balance; refine converts at the settings rate', () => {
    const run = makeRun();
    const before = run.palladium;
    run.dice.addSalvage(24);
    expect(run.dice.salvage).toBe(24);
    expect(run.dice.stats.salvageEarned).toBe(24);
    run.dice.refineSalvage();
    expect(run.dice.salvage).toBe(0);
    expect(run.palladium).toBe(before + Math.floor(24 * settings.economy.salvageRefineRate));
  });
});
