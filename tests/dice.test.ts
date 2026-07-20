import { describe, expect, it } from 'vitest';
import type { Rng } from '../src/core/rng';
import { towerById } from '../src/data/towers';
import { DiceSystem, RECHARGE_COST, SALVAGE_RATE, type Wallet } from '../src/game/dice';
import { settings } from '../src/settings';

/** Scripted RNG: returns queued faces from int(), so gamble outcomes are exact. */
function scriptedRng(faces: number[]): Rng {
  let i = 0;
  return {
    seed: 0,
    next: () => 0.5,
    int: (_min: number, max: number) => faces[i++] ?? max,
    range: (min: number) => min,
    pick: <T>(items: readonly T[]): T => items[0],
    draws: () => i,
  };
}

function makeWallet(balance = 1000): Wallet & { bal: number } {
  return {
    bal: balance,
    balance() {
      return this.bal;
    },
    spend(amount: number) {
      if (this.bal < amount) return false;
      this.bal -= amount;
      return true;
    },
    credit(amount: number) {
      this.bal += amount;
    },
  };
}

describe('DiceSystem', () => {
  it('starts with 3 d100, 6 slots, 3 chances', () => {
    const dice = new DiceSystem(scriptedRng([]), makeWallet());
    expect(dice.tray.map((d) => d.sides)).toEqual([100, 100, 100]);
    expect(dice.slots).toBe(6);
    expect(dice.chances).toBe(3);
  });

  it('success: roll over price consumes committed dice and closes', () => {
    const dice = new DiceSystem(scriptedRng([50]), makeWallet());
    dice.begin(towerById('tesla')); // price 24
    dice.commit(dice.tray[0].id);
    const result = dice.roll();
    expect(result.status).toBe('success');
    expect(result.total).toBe(50);
    expect(dice.tray).toHaveLength(2); // committed die consumed
    expect(dice.purchase).toBeNull();
  });

  it('accumulates across chances; all committed dice consumed on success', () => {
    // faces: 5, 2, 20 — total 27 >= 24 on the third chance
    const dice = new DiceSystem(scriptedRng([5, 2, 20]), makeWallet());
    dice.begin(towerById('tesla'));
    dice.commit(dice.tray[0].id);
    expect(dice.roll().status).toBe('committing'); // 5 < 24
    expect(dice.purchase?.total).toBe(5);
    expect(dice.purchase?.chancesLeft).toBe(2);
    dice.commit(dice.tray[0].id);
    expect(dice.roll().status).toBe('committing'); // 7 < 24
    expect(dice.purchase?.total).toBe(7);
    expect(dice.purchase?.chancesLeft).toBe(1);
    dice.commit(dice.tray[0].id);
    const result = dice.roll();
    expect(result.status).toBe('success');
    expect(result.total).toBe(27);
    expect(dice.tray).toHaveLength(0); // all three dice consumed
  });

  it('bust: chances exhausted converts committed dice to salvage at ~22%', () => {
    const dice = new DiceSystem(scriptedRng([1, 2, 3]), makeWallet());
    dice.begin(towerById('railgun')); // price 60
    dice.commit(dice.tray[0].id);
    dice.roll(); // 1
    dice.commit(dice.tray[0].id);
    dice.roll(); // 2
    dice.commit(dice.tray[0].id);
    const result = dice.roll(); // 3 — total 6, bust
    expect(result.status).toBe('bust');
    expect(dice.salvage).toBeCloseTo(3 * RECHARGE_COST[100] * SALVAGE_RATE, 5);
    expect(dice.tray).toHaveLength(0);
    expect(dice.purchase).toBeNull();
  });

  it('abandon converts committed dice to salvage', () => {
    const dice = new DiceSystem(scriptedRng([]), makeWallet());
    dice.begin(towerById('tesla'));
    dice.commit(dice.tray[0].id);
    dice.abandon();
    expect(dice.salvage).toBeCloseTo(RECHARGE_COST[100] * SALVAGE_RATE, 5);
    expect(dice.tray).toHaveLength(2);
  });

  it('uncommit returns dice before the first roll, never after', () => {
    const dice = new DiceSystem(scriptedRng([1]), makeWallet());
    dice.begin(towerById('railgun'));
    const dieId = dice.tray[0].id;
    dice.commit(dieId);
    expect(dice.uncommit(dieId)).toBe(true);
    expect(dice.tray).toHaveLength(3);
    dice.commit(dieId);
    dice.roll(); // rolledOnce now
    expect(dice.uncommit(dieId)).toBe(false);
  });

  it('shop: buyDie spends palladium at the ratio table and respects slots', () => {
    const wallet = makeWallet(1000);
    const dice = new DiceSystem(scriptedRng([]), wallet);
    expect(dice.buyDie(3)).toBe(true);
    expect(wallet.bal).toBe(1000 - RECHARGE_COST[3]);
    // fill to slot cap
    expect(dice.buyDie(100)).toBe(true);
    expect(dice.buyDie(100)).toBe(true);
    expect(dice.tray).toHaveLength(6);
    expect(dice.buyDie(6)).toBe(false); // at slot cap
    expect(dice.buySlot()).toBe(true);
    expect(dice.buyDie(6)).toBe(true);
    expect(dice.tray).toHaveLength(7);
  });

  it('shop: buyChance raises the per-purchase chance count', () => {
    const dice = new DiceSystem(scriptedRng([1, 2, 3, 60]), makeWallet());
    expect(dice.buyChance()).toBe(true);
    dice.begin(towerById('railgun'));
    expect(dice.purchase?.chancesLeft).toBe(4);
    dice.commit(dice.tray[0].id);
    dice.roll();
    dice.commit(dice.tray[0].id);
    dice.roll();
    dice.commit(dice.tray[0].id);
    dice.roll();
    expect(dice.purchase?.chancesLeft).toBe(1);
  });

  it('refineSalvage converts salvage back to palladium at the settings rate', () => {
    const wallet = makeWallet(100);
    const dice = new DiceSystem(scriptedRng([]), wallet);
    dice.salvage = 55.5;
    dice.refineSalvage();
    expect(wallet.bal).toBe(100 + Math.floor(55.5 * settings.economy.salvageRefineRate));
    expect(dice.salvage).toBe(0);
  });

  it('rolls are seeded-deterministic', () => {
    const a = new DiceSystem(scriptedRng([42]), makeWallet());
    a.begin(towerById('railgun'));
    a.commit(a.tray[0].id);
    expect(a.roll().faces).toEqual([42]);
  });
});
