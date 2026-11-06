// The 1958–1966 scenario (V2 freeze §2): acts, the programmes that arrive and the anchor events.
// V2 opens at NASA formation, either from a V1 save or from the standard 1958 agency (data/opening.js).
import { dayOf, START_DAY, END_DAY } from '../core/calendar.js';
import { RACE_CONDITIONS } from './race.js';

export const ACTS = [
  { id: 'nasa-formation', name: 'NASA formation', from: START_DAY },
  { id: 'mercury', name: 'Mercury', from: dayOf(1959, 1, 1) },
  { id: 'mercury-to-gemini', name: 'Between Mercury and Gemini', from: dayOf(1963, 6, 1) },
  { id: 'gemini', name: 'Gemini', from: dayOf(1964, 4, 1) },
];

// Programmes and when their proposal arrives. A `design` programme gets its vehicles TUNING.designDays after
// greenlight. Mercury flies two boosters, so it runs as two programmes under one name. The agency sets these
// objectives itself; the `client` is the project office that would run the work and `terms` are its planning
// figures (illustrative, tuning), heard at the stage 3 meeting like a client's.
export const PROGRAMMES = [
  { id: 'mercury-redstone', name: 'Mercury suborbital (Redstone)', vehicle: null, design: 'mercury-redstone', source: 'objective', client: 'the Space Task Group', arrives: dayOf(1958, 10, 7), supersededBy: ['mercury-atlas'],
    terms: { cost: 2500000, contribution: 'Redstone boosters and the Army launch team at the Cape', timeline: '30 months', requirements: 'a crewed suborbital flight and safe recovery' } },
  { id: 'mercury-atlas', name: 'Mercury orbital (Atlas)', vehicle: null, design: 'mercury-atlas', source: 'objective', client: 'the Space Task Group', arrives: dayOf(1958, 10, 7), supersededBy: ['gemini'],
    terms: { cost: 6000000, contribution: 'Atlas boosters bought from the Air Force', timeline: '40 months', requirements: 'a crewed orbital flight and safe recovery' } },
  { id: 'gemini', name: 'Gemini', vehicle: null, design: 'gemini-titan', source: 'objective', client: 'the Manned Spacecraft Center', arrives: dayOf(1961, 12, 7),
    terms: { cost: 18000000, contribution: 'Titan II launch vehicles through the Air Force', timeline: '48 months', requirements: 'two-person flights of up to two weeks, spacewalks, rendezvous and docking' } },
];

// Soviet firsts are in data/race.js. The close of Gemini ends the campaign.
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

// Conditions attached to an annual award, checked when the fiscal year closes. V2's come with the race.
export const AWARD_CONDITIONS = RACE_CONDITIONS;
