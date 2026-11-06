// The 1958–1966 scenario (V2 freeze §2): acts, the programmes that arrive and the anchor events.
// V2 opens at NASA formation, either from a V1 save or from the standard 1958 agency (data/opening.js).
import { dayOf, START_DAY, END_DAY } from '../core/calendar.js';

export const ACTS = [
  { id: 'nasa-formation', name: 'NASA formation', from: START_DAY },
  { id: 'mercury', name: 'Mercury', from: dayOf(1959, 1, 1) },
  { id: 'mercury-to-gemini', name: 'Between Mercury and Gemini', from: dayOf(1963, 6, 1) },
  { id: 'gemini', name: 'Gemini', from: dayOf(1964, 4, 1) },
];

// Programmes and when their proposal arrives. A `design` programme gets its vehicles TUNING.designDays after
// greenlight. Mercury flies two boosters, so it runs as two programmes under one name.
export const PROGRAMMES = [
  { id: 'mercury-redstone', name: 'Mercury suborbital (Redstone)', vehicle: null, design: 'mercury-redstone', source: 'objective', arrives: dayOf(1958, 10, 7) },
  { id: 'mercury-atlas', name: 'Mercury orbital (Atlas)', vehicle: null, design: 'mercury-atlas', source: 'objective', arrives: dayOf(1958, 10, 7) },
  { id: 'gemini', name: 'Gemini', vehicle: null, design: 'gemini-titan', source: 'objective', arrives: dayOf(1961, 12, 7) },
];

// Soviet firsts arrive with the race (slice 4). The close of Gemini ends the campaign.
export const ANCHORS = [
  { id: 'gemini-close', day: END_DAY, text: 'The Gemini programme is closed. The agency takes stock of what it can now do.' },
];
export const CLOSING_ANCHOR = 'gemini-close';

// Military flights whose records the agency holds as evidence (V2 freeze §5). Content, Provisional: dates are
// spread across the real Atlas D and Titan II test series. The physics decides how each one went.
export const MILITARY_FLIGHTS = [
  ...[[1959, 4, 14], [1959, 7, 29], [1959, 9, 9], [1959, 11, 4], [1960, 1, 26], [1960, 4, 8], [1960, 6, 22], [1960, 9, 12]]
    .map(([y, m, d], i) => ({ id: `atlas-d-${i + 1}`, vehicle: 'atlas-icbm', day: dayOf(y, m, d) })),
  ...[[1962, 3, 16], [1962, 6, 7], [1962, 7, 25], [1962, 9, 12], [1962, 12, 6], [1963, 3, 21]]
    .map(([y, m, d], i) => ({ id: `titan-ii-${i + 1}`, vehicle: 'titan-icbm', day: dayOf(y, m, d) })),
];

// Conditions attached to an annual award, checked when the fiscal year closes. V2 adds its own with the race.
export const AWARD_CONDITIONS = {};
