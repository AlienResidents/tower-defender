import type { Rng } from '../core/rng';
import type { TowerDef } from '../data/towers';
import { settings } from '../settings';

/**
 * The dice economy (spec §8). Pure logic, seeded rolls.
 *
 * Dice are the in-level currency: towers are bought by committing dice and
 * rolling. 3 chances per purchase; each chance rolls only newly committed
 * dice and the total accumulates across chances. Success consumes all
 * committed dice. Bust (or abandon) converts them to salvage at a fraction
 * of their palladium recharge cost. Palladium (from kills) recharges dice,
 * buys tray slots and extra chances; salvage refines back to palladium 1:1.
 */

export const DIE_SIDES = [3, 6, 8, 10, 12, 20, 100] as const;

/** Palladium recharge cost per die type — spec §8 ratio table. */
export const RECHARGE_COST: Readonly<Record<number, number>> = settings.economy.rechargeCost;

/** Fraction of recharge cost returned as salvage on bust/abandon. */
export const SALVAGE_RATE = settings.economy.salvageRate;

const STARTING_SLOTS: number = settings.dice.startingSlots;
const STARTING_CHANCES: number = settings.dice.startingChances;

export interface Die {
  id: number;
  sides: number;
}

export type PurchaseStatus = 'committing' | 'success' | 'bust' | 'abandoned';

export interface Purchase {
  def: TowerDef;
  chancesLeft: number;
  /** all dice committed so far (consumed on success, salvaged on bust) */
  committed: Die[];
  /** dice committed since the last roll — these roll on the next chance */
  pending: Die[];
  total: number;
  rolledOnce: boolean;
  status: PurchaseStatus;
}

export interface Wallet {
  balance(): number;
  spend(amount: number): boolean;
  credit(amount: number): void;
}

export function salvageValue(die: Die): number {
  return (RECHARGE_COST[die.sides] ?? 100) * SALVAGE_RATE;
}

export class DiceSystem {
  tray: Die[] = [];
  salvage = 0;
  slots = STARTING_SLOTS;
  chances = STARTING_CHANCES;
  purchase: Purchase | null = null;

  /** Lifetime counters for the run summary. */
  readonly stats = {
    salvageEarned: 0,
    diceBought: 0,
    slotsBought: 0,
    chancesBought: 0,
    success: 0,
    bust: 0,
    abandoned: 0,
  };

  #uid = 1;
  #rng: Rng;
  #wallet: Wallet;

  constructor(rng: Rng, wallet: Wallet) {
    this.#rng = rng;
    this.#wallet = wallet;
    // starting tray: 3 x d100 — the corp's black budget for the shift
    for (let i = 0; i < 3; i++) this.tray.push({ id: this.#uid++, sides: 100 });
  }

  get palladium(): number {
    return this.#wallet.balance();
  }

  // --- shop ---

  rechargeCost(sides: number): number {
    return RECHARGE_COST[sides] ?? 100;
  }

  slotCost(): number {
    return 40 * (this.slots - STARTING_SLOTS + 1);
  }

  chanceCost(): number {
    return 60 * (this.chances - STARTING_CHANCES + 1);
  }

  buyDie(sides: number): boolean {
    if (this.tray.length >= this.slots) return false;
    if (!this.#wallet.spend(this.rechargeCost(sides))) return false;
    this.tray.push({ id: this.#uid++, sides });
    this.stats.diceBought++;
    return true;
  }

  buySlot(): boolean {
    if (!this.#wallet.spend(this.slotCost())) return false;
    this.slots++;
    this.stats.slotsBought++;
    return true;
  }

  buyChance(): boolean {
    if (!this.#wallet.spend(this.chanceCost())) return false;
    this.chances++;
    this.stats.chancesBought++;
    return true;
  }

  refineSalvage(): void {
    this.#wallet.credit(Math.floor(this.salvage));
    this.salvage = 0;
  }

  // --- purchase flow ---

  begin(def: TowerDef): Purchase | null {
    if (this.purchase) return null;
    this.purchase = {
      def,
      chancesLeft: this.chances,
      committed: [],
      pending: [],
      total: 0,
      rolledOnce: false,
      status: 'committing',
    };
    return this.purchase;
  }

  commit(dieId: number): boolean {
    const p = this.purchase;
    if (!p || p.status !== 'committing') return false;
    const idx = this.tray.findIndex((d) => d.id === dieId);
    if (idx === -1) return false;
    const [die] = this.tray.splice(idx, 1);
    p.committed.push(die);
    p.pending.push(die);
    return true;
  }

  /** Take back a pending die — only before the first roll of the purchase. */
  uncommit(dieId: number): boolean {
    const p = this.purchase;
    if (!p || p.status !== 'committing' || p.rolledOnce) return false;
    const idx = p.committed.findIndex((d) => d.id === dieId);
    if (idx === -1) return false;
    const [die] = p.committed.splice(idx, 1);
    p.pending.splice(
      p.pending.findIndex((d) => d.id === dieId),
      1,
    );
    this.tray.push(die);
    return true;
  }

  /** Roll this chance's pending dice. Returns the faces rolled (for theater). */
  roll(): { faces: number[]; total: number; status: PurchaseStatus } {
    const p = this.purchase;
    if (!p || p.status !== 'committing' || p.pending.length === 0) {
      return { faces: [], total: p?.total ?? 0, status: p?.status ?? 'abandoned' };
    }
    const faces = p.pending.map((d) => this.#rng.int(1, d.sides));
    const sum = faces.reduce((a, b) => a + b, 0);
    p.total += sum;
    p.pending = [];
    p.rolledOnce = true;

    if (p.total >= p.def.price) {
      p.status = 'success';
      this.stats.success++;
      this.#finish();
      return { faces, total: p.total, status: 'success' };
    }
    p.chancesLeft--;
    if (p.chancesLeft <= 0) {
      p.status = 'bust';
      this.stats.bust++;
      this.#salvageCommitted(p);
      this.#finish();
      return { faces, total: p.total, status: 'bust' };
    }
    return { faces, total: p.total, status: 'committing' };
  }

  /** Walk away — committed dice convert to salvage (spec §8). */
  abandon(): void {
    const p = this.purchase;
    if (!p) return;
    p.status = 'abandoned';
    this.stats.abandoned++;
    this.#salvageCommitted(p);
    this.#finish();
  }

  #salvageCommitted(p: Purchase): void {
    for (const die of p.committed) {
      const value = salvageValue(die);
      this.salvage += value;
      this.stats.salvageEarned += value;
    }
    p.committed = [];
  }

  #finish(): void {
    if (this.purchase?.status === 'committing') return;
    this.purchase = null;
  }
}
