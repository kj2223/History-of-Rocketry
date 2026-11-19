// MANAGEMENT MODE: the state of a management game, and the check its saves must pass.
// You run the launch centre from NASA's founding on 1 October 1958 (GAME-DESIGN §17.0d, Aaron's answers of 18 Nov
// 2026). This is the groundwork: a game that starts, saves in its own slot (js/core/save.js MANAGEMENT) and loads.
// The base, money, people and the round scheduler build on it. Nothing here touches the Flight Director's game.
import { dayOf, dateLabel } from '../core/calendar.js';

export const START_DAY = dayOf(1958, 10, 1); // NASA opens its doors
// How long one game day lasts at normal speed, in real seconds (Aaron, 19 Nov 2026: about 10, to be tuned later).
export const SECONDS_PER_DAY = 10;
export const SPEEDS = [1, 4, 16];
export const SITES = { cape: 'Cape Canaveral' }; // one site on screen at a time, the Cape first (answer M2)

export function newManagement(seed = Math.floor(Math.random() * 1e9)) {
  return { kind: 'management', seed, day: START_DAY, site: 'cape' };
}

// Throws on anything that is not a management game this version can carry on.
export function checkManagement(c) {
  if (!c || typeof c !== 'object' || c.kind !== 'management') throw new Error('not a management game');
  if (!Number.isInteger(c.seed)) throw new Error('no seed');
  if (!Number.isInteger(c.day) || c.day < START_DAY) throw new Error('no date');
  if (!(c.site in SITES)) throw new Error(`unknown site ${c.site}`);
  if (c.split !== undefined) {
    const v = Object.values(c.split ?? {});
    if (v.length !== 3 || v.some(x => !Number.isInteger(x) || x < 0) || v.reduce((a, b) => a + b, 0) !== 100)
      throw new Error('bad budget split');
  }
  if (c.heads !== undefined && (typeof c.heads !== 'object' || c.heads === null)) throw new Error('bad heads');
  if (c.flown !== undefined && !(Array.isArray(c.flown) && c.flown.every(f => typeof f?.id === 'string')))
    throw new Error('bad flight record');
}

// Where a management game stands, for the title screen.
export const managementWhere = c => `${SITES[c.site]}, ${dateLabel(c.day)}`;
