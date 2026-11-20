// MANAGEMENT MODE: what the player inherits on 1 October 1958. The Cape's pads as they stood, and the flights already
// planned from them through 1959: NASA's own and those flown for it. These are the real flights and dates; from the
// first day the player can move, add or cancel them (history bends within each era's technology, answer M3).
// Sources: NASA SP-4009 (Mercury chronology) and the NSSDC launch records. Little Joe flew from Wallops, so it is not
// on the Cape's manifest.
import { dayOf } from '../core/calendar.js';

// Pad kinds: which vehicles a pad can fly. Turnaround: days on the pad before a launch (stacking and checkout), and
// days after it before the next vehicle can go up (clearing and repairs). Assumed round figures for the period.
export const PAD_KINDS = {
  redstone: { vehicles: ['juno', 'redstone'], before: 21, after: 10 },
  thor: { vehicles: ['thor-able'], before: 18, after: 7 }, // Pioneers 1 and 2 flew four weeks apart from 17A
  vanguard: { vehicles: ['vanguard'], before: 28, after: 14 },
  atlas: { vehicles: ['atlas', 'atlas-able'], before: 35, after: 14 },
};

// What players call each vehicle.
export const VEHICLE_NAMES = {
  'thor-able': 'Thor-Able',
  juno: 'Juno II',
  vanguard: 'Vanguard',
  atlas: 'Atlas',
  'atlas-able': 'Atlas-Able',
  redstone: 'Redstone',
};

export const CAPE_1958 = {
  pads: [
    { id: 'lc-5', name: 'Launch Complex 5', kind: 'redstone' },
    { id: 'lc-6', name: 'Launch Complex 6', kind: 'redstone' },
    { id: 'lc-17a', name: 'Launch Complex 17A', kind: 'thor' },
    { id: 'lc-18a', name: 'Launch Complex 18A', kind: 'vanguard' },
    { id: 'lc-14', name: 'Launch Complex 14', kind: 'atlas' },
  ],
  // Each planned flight: its vehicle, the pad it was assigned, the date it was planned to fly and its programme
  // (programmes.js).
  flights: [
    {
      id: 'pioneer-1',
      name: 'Pioneer 1',
      vehicle: 'thor-able',
      pad: 'lc-17a',
      planned: dayOf(1958, 10, 11),
      programme: 'pioneer',
    },
    {
      id: 'pioneer-2',
      name: 'Pioneer 2',
      vehicle: 'thor-able',
      pad: 'lc-17a',
      planned: dayOf(1958, 11, 8),
      programme: 'pioneer',
    },
    {
      id: 'pioneer-3',
      name: 'Pioneer 3',
      vehicle: 'juno',
      pad: 'lc-5',
      planned: dayOf(1958, 12, 6),
      programme: 'pioneer',
    },
    {
      id: 'vanguard-2',
      name: 'Vanguard 2',
      vehicle: 'vanguard',
      pad: 'lc-18a',
      planned: dayOf(1959, 2, 17),
      programme: 'vanguard',
    },
    {
      id: 'pioneer-4',
      name: 'Pioneer 4',
      vehicle: 'juno',
      pad: 'lc-5',
      planned: dayOf(1959, 3, 3),
      programme: 'pioneer',
    },
    {
      id: 'vanguard-slv5',
      name: 'Vanguard SLV-5',
      vehicle: 'vanguard',
      pad: 'lc-18a',
      planned: dayOf(1959, 4, 13),
      programme: 'vanguard',
    },
    {
      id: 'vanguard-slv6',
      name: 'Vanguard SLV-6',
      vehicle: 'vanguard',
      pad: 'lc-18a',
      planned: dayOf(1959, 6, 22),
      programme: 'vanguard',
    },
    {
      id: 'explorer-s1',
      name: 'Explorer S-1',
      vehicle: 'juno',
      pad: 'lc-5',
      planned: dayOf(1959, 7, 16),
      programme: 'explorer',
    },
    // The tutorial's flight: the first one the player sees through (answer M1, in Pioneer 4's role).
    {
      id: 'explorer-6',
      name: 'Explorer 6',
      vehicle: 'thor-able',
      pad: 'lc-17a',
      planned: dayOf(1959, 8, 7),
      tutorial: true,
      programme: 'explorer',
    },
    {
      id: 'big-joe',
      name: 'Big Joe',
      vehicle: 'atlas',
      pad: 'lc-14',
      planned: dayOf(1959, 9, 9),
      programme: 'mercury', // the first Mercury flight: a boilerplate capsule's heat shield test
    },
    {
      id: 'vanguard-3',
      name: 'Vanguard 3',
      vehicle: 'vanguard',
      pad: 'lc-18a',
      planned: dayOf(1959, 9, 18),
      programme: 'vanguard',
    },
    {
      id: 'explorer-7',
      name: 'Explorer 7',
      vehicle: 'juno',
      pad: 'lc-5',
      planned: dayOf(1959, 10, 13),
      programme: 'explorer',
    },
    {
      id: 'pioneer-p3',
      name: 'Pioneer P-3',
      vehicle: 'atlas-able',
      pad: 'lc-14',
      planned: dayOf(1959, 11, 26),
      programme: 'pioneer',
    },
  ],
};
