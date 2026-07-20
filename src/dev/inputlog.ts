import { settings } from '../settings';

/**
 * Dev input recorder — ring buffer of key/pointer events with wall-clock
 * timestamps, for playtest replay and bug reports. Toggle in settings.input.
 * Dump with [i] in-game (copies JSON to clipboard).
 */

export interface InputEvent {
  /** ms since page load (performance.now, rounded). */
  t: number;
  kind: 'key' | 'pointerdown' | 'pointerup';
  /** Key name, or "x,y" pointer position. */
  detail: string;
}

const buffer: InputEvent[] = [];

export function recordInput(kind: InputEvent['kind'], detail: string): void {
  if (!settings.input.record) return;
  buffer.push({ t: Math.round(performance.now()), kind, detail });
  if (buffer.length > settings.input.maxEvents) buffer.shift();
}

export function dumpInputLog(): { json: string; count: number } {
  return {
    json: JSON.stringify({ events: buffer.length, log: buffer }, null, 2),
    count: buffer.length,
  };
}
