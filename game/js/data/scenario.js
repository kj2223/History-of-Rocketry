// The campaign from 1 January 1945 (GAME-DESIGN §3): acts, the programmes that arrive and the anchor events.
// It runs on through NASA formation into Mercury and Gemini. A campaign can also open at NASA formation with
// the standard 1958 agency (data/opening.js); programmes and anchors before that day then never arrive.
import { dayOf, NASA_DAY, END_DAY } from '../core/calendar.js';
import { RACE_CONDITIONS } from './race.js';

export const ACTS = [
  { id: 'wac', name: 'WAC at White Sands', from: 0 },
  { id: 'aerobee-viking', name: 'Aerobee and Viking', from: dayOf(1947, 1, 1) },
  { id: 'vanguard-explorer', name: 'Vanguard and Explorer', from: dayOf(1955, 1, 1) },
  { id: 'nasa-formation', name: 'NASA formation', from: NASA_DAY },
  { id: 'mercury', name: 'Mercury', from: dayOf(1959, 1, 1) },
  { id: 'mercury-to-gemini', name: 'Between Mercury and Gemini', from: dayOf(1963, 6, 1) },
  { id: 'gemini', name: 'Gemini', from: dayOf(1964, 4, 1) },
];

// Programmes and when their proposal arrives. `stage: 'greenlit'` starts the programme already approved. A `design` programme gets its vehicles TUNING.designDays after
// greenlight. Mercury flies two boosters, so it runs as two programmes under one name. The agency sets these
// objectives itself; the `client` is the project office that would run the work and `terms` are its planning
// figures (illustrative, tuning), heard at the stage 3 meeting like a client's.
export const PROGRAMMES = [
  { id: 'wac', name: 'WAC Corporal', vehicle: 'wac', source: 'objective', arrives: 0, stage: 'greenlit' },
  { id: 'bumper', name: 'Bumper', vehicle: 'bumper', source: 'external', client: 'Army Ordnance', arrives: dayOf(1946, 6, 1), terms: { cost: 250000, contribution: 'captured V-2 vehicles and their ground crews', timeline: '24 months', requirements: 'a two-stage flight reaching high altitude' } },
  { id: 'aerobee', name: 'Aerobee', vehicle: 'aerobee', source: 'external', client: 'Applied Physics Laboratory', arrives: dayOf(1946, 5, 17), terms: { cost: 300000, contribution: 'the first production vehicles', timeline: '18 months', requirements: 'upper-air instruments carried to 70 km' } },
  { id: 'viking', name: 'Viking', vehicle: null, design: 'viking', source: 'external', client: 'Naval Research Laboratory', arrives: dayOf(1946, 8, 1), terms: { cost: 900000, contribution: 'airframes built by their contractor', timeline: '36 months', requirements: 'a larger, steerable sounding rocket' } },
  { id: 'vanguard', name: 'Vanguard proposal', vehicle: null, source: 'external', client: 'Naval Research Laboratory', arrives: dayOf(1955, 8, 3), terms: { cost: 2000000, contribution: 'the Viking-derived first stage and the satellite', timeline: '30 months', requirements: 'a scientific satellite in orbit during the Geophysical Year' } },
  { id: 'explorer', name: 'Explorer proposal', vehicle: null, source: 'external', client: 'Army Ballistic Missile Agency', arrives: dayOf(1955, 8, 3), terms: { cost: 1500000, contribution: 'Redstone-derived boosters and their launch team', timeline: '18 months', requirements: 'a satellite launch from existing missiles' } },
  { id: 'mercury-redstone', name: 'Mercury suborbital (Redstone)', vehicle: null, design: 'mercury-redstone', source: 'objective', client: 'the Space Task Group', arrives: dayOf(1958, 10, 7),
    terms: { cost: 2500000, contribution: 'Redstone boosters and the Army launch team at the Cape', timeline: '30 months', requirements: 'a crewed suborbital flight and safe recovery' } },
  { id: 'mercury-atlas', name: 'Mercury orbital (Atlas)', vehicle: null, design: 'mercury-atlas', source: 'objective', client: 'the Space Task Group', arrives: dayOf(1958, 10, 7),
    terms: { cost: 6000000, contribution: 'Atlas boosters bought from the Air Force', timeline: '40 months', requirements: 'a crewed orbital flight and safe recovery' } },
  { id: 'gemini', name: 'Gemini', vehicle: null, design: 'gemini-titan', source: 'objective', client: 'the Manned Spacecraft Center', arrives: dayOf(1961, 12, 7),
    terms: { cost: 18000000, contribution: 'Titan II launch vehicles through the Air Force', timeline: '48 months', requirements: 'two-person flights of up to two weeks, spacewalks, rendezvous and docking' } },
];

// Soviet firsts from 1959 are in data/race.js. NASA formation is a milestone with its summary (rules/summary.js);
// the close of Gemini ends the campaign for now.
export const ANCHORS = [
  { id: 'sputnik', day: dayOf(1957, 10, 4), text: 'The Soviet Union has placed a satellite in orbit. Congress wants to know why we have not.', supplementary: 2000000 },
  { id: 'nasa-formation', day: NASA_DAY, text: 'The National Aeronautics and Space Administration begins operations today.' },
  { id: 'gemini-close', day: END_DAY, text: 'The Gemini programme is closed. The agency takes stock of what it can now do.' },
];
export const MILESTONE_ANCHOR = 'nasa-formation';
export const CLOSING_ANCHOR = 'gemini-close';

// Military flights whose records the agency holds as evidence (V2 freeze §5). Content, Provisional: dates are
// spread across the real Atlas D and Titan II test series. The physics decides how each one went.
export const MILITARY_FLIGHTS = [
  ...[[1959, 4, 14], [1959, 7, 29], [1959, 9, 9], [1959, 11, 4], [1960, 1, 26], [1960, 4, 8], [1960, 6, 22], [1960, 9, 12]]
    .map(([y, m, d], i) => ({ id: `atlas-d-${i + 1}`, vehicle: 'atlas-icbm', day: dayOf(y, m, d) })),
  ...[[1962, 3, 16], [1962, 6, 7], [1962, 7, 25], [1962, 9, 12], [1962, 12, 6], [1963, 3, 21]]
    .map(([y, m, d], i) => ({ id: `titan-ii-${i + 1}`, vehicle: 'titan-icbm', day: dayOf(y, m, d) })),
];

// Conditions attached to an annual award, checked when the fiscal year closes. Those from 1959 come with the race.
export const AWARD_CONDITIONS = {
  1947: { text: 'Fly at least one instrumented sounding rocket this year', successfulFlights: 1 },
  1950: { text: 'Fly at least two research flights this year', successfulFlights: 2 },
  ...RACE_CONDITIONS,
};
