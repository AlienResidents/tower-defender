import { createRng } from '../core/rng';
import type { TowerDef } from '../data/towers';
import { towerById } from '../data/towers';
import { DiceSystem, RECHARGE_COST, type Wallet } from '../game/dice';

/**
 * Dice-economy simulator for the /lab page (issue #7): Monte-Carlo a
 * greedy purchase strategy against price × loadout, report success rate,
 * expected dice spend (count AND recharge value), expected salvage.
 */

const UNLIMITED: Wallet = {
  balance: () => 1e9,
  spend: () => true,
  credit: () => {},
};

export interface SimResult {
  trials: number;
  successRate: number;
  avgDiceSpent: number;
  avgValueSpent: number;
  avgSalvage: number;
}

function defWithPrice(price: number): TowerDef {
  return { ...towerById('tesla'), price };
}

export function simulatePurchase(
  price: number,
  loadout: number[],
  trials = 2000,
  seed = 1337,
): SimResult {
  let successes = 0;
  let diceSpent = 0;
  let valueSpent = 0;
  let salvage = 0;

  for (let t = 0; t < trials; t++) {
    const rng = createRng(seed + t);
    const dice = new DiceSystem(rng, UNLIMITED);
    dice.tray = loadout.map((sides, i) => ({ id: i + 1, sides }));
    dice.slots = 999;
    dice.begin(defWithPrice(price));

    let status: 'committing' | 'success' | 'bust' | 'abandoned' = 'committing';
    while (status === 'committing' && dice.purchase) {
      // greedy: commit largest dice until the pending pile could reach the
      // remaining price, then roll the chance
      const need = dice.purchase.def.price - dice.purchase.total;
      const pendingMax = dice.purchase.pending.reduce((a, d) => a + d.sides, 0);
      if (pendingMax >= need) {
        status = dice.roll().status;
        continue;
      }
      const largest = [...dice.tray].sort((a, b) => b.sides - a.sides)[0];
      if (!largest) {
        if (dice.purchase.pending.length > 0) {
          status = dice.roll().status;
          continue; // chances may remain — loop abandons when truly stuck
        }
        dice.abandon();
        status = 'abandoned';
        break;
      }
      dice.commit(largest.id);
    }

    const remaining = new Map<number, number>();
    for (const d of dice.tray) remaining.set(d.sides, (remaining.get(d.sides) ?? 0) + 1);
    const wanted = new Map<number, number>();
    for (const s of loadout) wanted.set(s, (wanted.get(s) ?? 0) + 1);
    let spentCount = 0;
    let spentValue = 0;
    for (const [sides, count] of wanted) {
      const used = count - (remaining.get(sides) ?? 0);
      spentCount += used;
      spentValue += used * (RECHARGE_COST[sides] ?? 100);
    }
    diceSpent += spentCount;
    valueSpent += spentValue;
    salvage += dice.salvage;
    if (status === 'success') successes++;
  }

  return {
    trials,
    successRate: successes / trials,
    avgDiceSpent: diceSpent / trials,
    avgValueSpent: valueSpent / trials,
    avgSalvage: salvage / trials,
  };
}
