import {
  ATTR_MAX_RANK,
  ATTR_TRACKS,
  attrCost,
  buyRank,
  rankOf,
  respec,
  archetypeSpent,
} from '../data/attributes';
import { ITEMS } from '../data/items';
import { TOWERS } from '../data/towers';
import type { MetaState } from '../game/meta';
import { saveMeta } from '../game/meta';
import type { Run } from '../game/run';
import { settings } from '../settings';

/**
 * Meta screen ([g]) — DOM overlay, two tabs + ledger footer.
 * ATTRIBUTE GRID: per-archetype ranks bought with live palladium, free respec.
 * CSC ARMORY: palladium → credits, credits → items (into the stash).
 * Functional-ugly per the M4 plan; DOM because grids belong in the browser.
 */

export interface MetaScreenDeps {
  meta: MetaState;
  run: Run;
  onToast: (text: string) => void;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export class MetaScreen {
  #deps: MetaScreenDeps;
  #overlay: HTMLDivElement | null = null;
  #tab: 'grid' | 'armory' = 'grid';

  constructor(deps: MetaScreenDeps) {
    this.#deps = deps;
  }

  get isOpen(): boolean {
    return this.#overlay !== null;
  }

  open(): void {
    if (this.#overlay) return;
    this.#overlay = document.createElement('div');
    this.#overlay.className = 'metascreen';
    document.body.appendChild(this.#overlay);
    this.#render();
  }

  close(): void {
    this.#overlay?.remove();
    this.#overlay = null;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  #render(): void {
    const overlay = this.#overlay;
    if (!overlay) return;
    const { meta, run } = this.#deps;
    overlay.replaceChildren();

    const panel = el('div', 'metapanel');
    overlay.appendChild(panel);

    // header
    const head = el('div', 'metahead');
    head.appendChild(el('span', 'metatitle', 'PHOSPHOR :: META'));
    head.appendChild(el('span', 'metabal', `Pd ${Math.floor(run.palladium)} · ${meta.credits} cr`));
    const close = el('button', 'metaclose', '✕');
    close.onclick = () => this.close();
    head.appendChild(close);
    panel.appendChild(head);

    // tabs
    const tabs = el('div', 'metatabs');
    for (const [id, label] of [
      ['grid', 'ATTRIBUTE GRID'],
      ['armory', 'CSC ARMORY'],
    ] as const) {
      const b = el('button', this.#tab === id ? 'active' : '', label);
      b.onclick = () => {
        this.#tab = id;
        this.#render();
      };
      tabs.appendChild(b);
    }
    panel.appendChild(tabs);

    const body = el('div', 'metabody');
    panel.appendChild(body);
    if (this.#tab === 'grid') this.#renderGrid(body);
    else this.#renderArmory(body);

    // ledger footer
    const led = meta.ledger;
    panel.appendChild(
      el(
        'div',
        'metafoot',
        `CAMPAIGN LEDGER — Pd +${Math.floor(led.pdEarned)} / -${Math.floor(led.pdSpent)} · Sv +${Math.floor(led.svEarned)} · refined ${Math.floor(led.svRefined)}`,
      ),
    );
  }

  #spend(cost: number): boolean {
    const { run } = this.#deps;
    if (run.palladium < cost) {
      this.#deps.onToast('NOT ENOUGH Pd');
      return false;
    }
    run.palladium -= cost;
    run.stats.palladiumSpent += cost;
    return true;
  }

  #renderGrid(body: HTMLElement): void {
    const { meta } = this.#deps;
    for (const def of TOWERS) {
      const rowEl = el('div', 'attrrow');
      rowEl.appendChild(el('div', 'attrname', def.name));
      for (const track of ATTR_TRACKS) {
        const rank = rankOf(meta.grid, def.id, track.id);
        const cell = el('div', 'attrcell');
        cell.appendChild(el('span', 'attrtrack', track.name));
        const pips = el('span', 'pips');
        for (let i = 0; i < ATTR_MAX_RANK; i++) {
          pips.appendChild(el('span', i < rank ? 'pip on' : 'pip', '▪'));
        }
        cell.appendChild(pips);
        if (rank >= ATTR_MAX_RANK) {
          cell.appendChild(el('span', 'attrmax', 'MAX'));
        } else {
          const cost = attrCost(rank);
          const buy = el('button', 'attrbuy', `+${Math.round(track.perRank * 100)}% · ${cost} Pd`);
          buy.onclick = () => {
            if (!this.#spend(cost)) return;
            buyRank(meta.grid, def.id, track.id);
            saveMeta(meta);
            this.#render();
          };
          cell.appendChild(buy);
        }
        rowEl.appendChild(cell);
      }
      const spent = archetypeSpent(meta.grid, def.id);
      if (spent > 0) {
        const respecBtn = el('button', 'attrrespec', `RESPEC +${spent} Pd`);
        respecBtn.onclick = () => {
          const refund = respec(meta.grid, def.id);
          this.#deps.run.palladium += refund;
          saveMeta(meta);
          this.#deps.onToast(`${def.name} RESPEC → +${refund} Pd`);
          this.#render();
        };
        rowEl.appendChild(respecBtn);
      }
      body.appendChild(rowEl);
    }
    body.appendChild(
      el('div', 'hint', 'grid bonuses apply to newly placed towers · respec refunds 100%'),
    );
  }

  #renderArmory(body: HTMLElement): void {
    const { meta } = this.#deps;
    const s = settings.store;

    const exchange = el('div', 'storex');
    exchange.appendChild(
      el('span', '', `EXCHANGE — ${s.creditPackCost} Pd → ${s.creditPackSize} credits`),
    );
    const buyCr = el('button', '', `BUY ${s.creditPackSize} cr`);
    buyCr.onclick = () => {
      if (!this.#spend(s.creditPackCost)) return;
      meta.credits += s.creditPackSize;
      saveMeta(meta);
      this.#render();
    };
    exchange.appendChild(buyCr);
    body.appendChild(exchange);

    for (const item of ITEMS) {
      const price = item.power * s.itemCreditPerPower;
      const rowEl = el('div', 'storerow');
      rowEl.appendChild(el('span', 'storeitem', `${item.name} — ${item.desc}`));
      const buy = el('button', 'attrbuy', `${price} cr`);
      buy.onclick = () => {
        if (meta.credits < price) {
          this.#deps.onToast('NOT ENOUGH CREDITS');
          return;
        }
        meta.credits -= price;
        meta.stash.push(item.id);
        saveMeta(meta);
        this.#deps.onToast(`${item.name} → STASH [s]`);
        this.#render();
      };
      rowEl.appendChild(buy);
      body.appendChild(rowEl);
    }
    body.appendChild(el('div', 'hint', 'purchased items land in the stash — open with [s]'));
  }
}
