/** Wave tables — 15 waves for the POC shift (spec §12). Pure data. */

export interface WaveGroup {
  enemy: string;
  count: number;
  /** seconds between spawns within the group */
  interval: number;
  /** seconds after wave start before this group's first spawn */
  delay: number;
}

export const WAVES: readonly (readonly WaveGroup[])[] = [
  [{ enemy: 'walker', count: 6, interval: 1.4, delay: 0 }],
  [{ enemy: 'walker', count: 9, interval: 1.2, delay: 0 }],
  [
    { enemy: 'walker', count: 6, interval: 1.2, delay: 0 },
    { enemy: 'swarm', count: 6, interval: 0.5, delay: 3 },
  ],
  [
    { enemy: 'swarm', count: 12, interval: 0.45, delay: 0 },
    { enemy: 'walker', count: 6, interval: 1.3, delay: 2 },
  ],
  [
    { enemy: 'walker', count: 10, interval: 1.0, delay: 0 },
    { enemy: 'siege', count: 1, interval: 1, delay: 4 },
  ],
  [
    { enemy: 'swarm', count: 16, interval: 0.4, delay: 0 },
    { enemy: 'walker', count: 8, interval: 1.1, delay: 3 },
  ],
  [
    { enemy: 'walker', count: 14, interval: 0.9, delay: 0 },
    { enemy: 'siege', count: 1, interval: 1, delay: 6 },
  ],
  [
    { enemy: 'swarm', count: 20, interval: 0.35, delay: 0 },
    { enemy: 'siege', count: 2, interval: 3, delay: 4 },
  ],
  [
    { enemy: 'walker', count: 16, interval: 0.8, delay: 0 },
    { enemy: 'swarm', count: 12, interval: 0.4, delay: 4 },
    { enemy: 'siege', count: 1, interval: 1, delay: 8 },
  ],
  [
    { enemy: 'walker', count: 12, interval: 0.9, delay: 0 },
    { enemy: 'siege', count: 2, interval: 4, delay: 3 },
  ],
  [
    { enemy: 'swarm', count: 26, interval: 0.3, delay: 0 },
    { enemy: 'walker', count: 10, interval: 0.9, delay: 5 },
  ],
  [
    { enemy: 'walker', count: 18, interval: 0.75, delay: 0 },
    { enemy: 'siege', count: 3, interval: 3.5, delay: 4 },
  ],
  [
    { enemy: 'swarm', count: 30, interval: 0.28, delay: 0 },
    { enemy: 'siege', count: 2, interval: 3, delay: 6 },
  ],
  [
    { enemy: 'walker', count: 22, interval: 0.65, delay: 0 },
    { enemy: 'swarm', count: 16, interval: 0.35, delay: 3 },
    { enemy: 'siege', count: 3, interval: 4, delay: 8 },
  ],
  [
    { enemy: 'walker', count: 26, interval: 0.6, delay: 0 },
    { enemy: 'swarm', count: 24, interval: 0.3, delay: 2 },
    { enemy: 'siege', count: 4, interval: 3, delay: 6 },
  ],
] as const;
