/**
 * Central tunables — every gameplay / UI / debug variable lives here.
 *
 * Renderer-internal geometry (sign sizes, city layout constants, panel chrome)
 * stays local to its module; this file holds the values you'd actually reach
 * for while balancing, tuning, or debugging. Change numbers here, not in the
 * systems that consume them.
 */
export const settings = {
  /** Dev input recorder — captures key/pointer events for playtest replay. */
  input: {
    /** Record inputs during the dev cycle. Dump with [i]. */
    record: true,
    /** Ring-buffer size; oldest events drop off first. */
    maxEvents: 10_000,
  },

  economy: {
    startingPalladium: 500,
    /** Fraction of recharge cost returned as salvage on bust/abandon. */
    salvageRate: 0.22,
    /** Concurrent-wave pressure curve: drops × (activeWaves ^ exponent). */
    pressureExponent: 1.75,
    /** Palladium recharge cost per die type — spec §8 ratio table. */
    rechargeCost: {
      100: 100, // 1:1
      20: 100, // 5:1
      12: 108, // 9:1
      10: 120, // 12:1
      8: 128, // 16:1
      6: 132, // 22:1
      3: 135, // 45:1
    } as Readonly<Record<number, number>>,
  },

  dice: {
    startingSlots: 6,
    startingChances: 3,
    /** Tumble theater physics (dice panel). */
    physics: {
      gravity: 1400,
      floorBounce: -0.42,
      floorFriction: 0.7,
      spinDamping: 0.6,
      wallBounce: -0.6,
      settleVy: 40,
      settleVx: 30,
      /** Pause after all dice settle before resolving the roll. */
      settleHoldMs: 500,
    },
  },

  ui: {
    toastSeconds: 2,
    /** Delay after the volume slider stops before the audition beep plays. */
    volumeAuditionDelaySeconds: 0.4,
  },

  audio: {
    /** Bus ceiling — the volume slider scales within this. */
    masterLevel: 0.9,
    defaultVolume: 0.9,
  },
} as const;
