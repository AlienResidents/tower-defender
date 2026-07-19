import type { WaveGroup } from '../data/waves';

/** Wave spawner — flattens groups into a timed schedule, emits on tick. Pure. */

interface SpawnEntry {
  at: number;
  enemy: string;
}

export class WaveSpawner {
  #elapsed = 0;
  #cursor = 0;
  readonly #entries: SpawnEntry[];

  constructor(groups: readonly WaveGroup[]) {
    this.#entries = groups
      .flatMap((g) =>
        Array.from({ length: g.count }, (_, i) => ({
          at: g.delay + i * g.interval,
          enemy: g.enemy,
        })),
      )
      .sort((a, b) => a.at - b.at);
  }

  get done(): boolean {
    return this.#cursor >= this.#entries.length;
  }

  get remaining(): number {
    return this.#entries.length - this.#cursor;
  }

  update(dt: number, spawn: (enemyId: string) => void): void {
    this.#elapsed += dt;
    while (this.#cursor < this.#entries.length && this.#entries[this.#cursor].at <= this.#elapsed) {
      spawn(this.#entries[this.#cursor].enemy);
      this.#cursor++;
    }
  }
}
