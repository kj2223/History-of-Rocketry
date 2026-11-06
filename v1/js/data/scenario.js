// The 1945–1958 scenario (freeze §2): acts, the programmes that arrive and the anchor events.
import { dayOf, END_DAY } from '../core/calendar.js';

export const ACTS = [
  { id: 'wac', name: 'WAC at White Sands', from: 0 },
  { id: 'aerobee-viking', name: 'Aerobee and Viking', from: dayOf(1947, 1, 1) },
  { id: 'vanguard-explorer', name: 'Vanguard and Explorer', from: dayOf(1955, 1, 1) },
  { id: 'nasa-formation', name: 'NASA formation', from: dayOf(1958, 1, 1) },
];

// Programmes and when their proposal arrives. `stage: 'greenlit'` starts the programme already approved.
// `supersededBy`/`goalFlights`: when the technical director recommends closing it (§8.6).
// `terms` is what the client puts on the table at the stage 3 meeting (illustrative figures, tuning).
export const PROGRAMMES = [
  { id: 'wac', name: 'WAC Corporal', vehicle: 'wac', source: 'objective', arrives: 0, stage: 'greenlit', supersededBy: ['aerobee', 'viking'] },
  { id: 'bumper', name: 'Bumper', vehicle: 'bumper', source: 'external', client: 'Army Ordnance', arrives: dayOf(1946, 6, 1), goalFlights: 8, terms: { cost: 250000, contribution: 'captured V-2 vehicles and their ground crews', timeline: '24 months', requirements: 'a two-stage flight reaching high altitude' } },
  { id: 'aerobee', name: 'Aerobee', vehicle: 'aerobee', source: 'external', client: 'Applied Physics Laboratory', arrives: dayOf(1946, 5, 17), terms: { cost: 300000, contribution: 'the first production vehicles', timeline: '18 months', requirements: 'upper-air instruments carried to 70 km' } },
  { id: 'viking', name: 'Viking', vehicle: null, design: 'viking', source: 'external', client: 'Naval Research Laboratory', arrives: dayOf(1946, 8, 1), terms: { cost: 900000, contribution: 'airframes built by their contractor', timeline: '36 months', requirements: 'a larger, steerable sounding rocket' } },
  { id: 'vanguard', name: 'Vanguard proposal', vehicle: null, source: 'external', client: 'Naval Research Laboratory', arrives: dayOf(1955, 8, 3), terms: { cost: 2000000, contribution: 'the Viking-derived first stage and the satellite', timeline: '30 months', requirements: 'a scientific satellite in orbit during the Geophysical Year' } },
  { id: 'explorer', name: 'Explorer proposal', vehicle: null, source: 'external', client: 'Army Ballistic Missile Agency', arrives: dayOf(1955, 8, 3), terms: { cost: 1500000, contribution: 'Redstone-derived boosters and their launch team', timeline: '18 months', requirements: 'a satellite launch from existing missiles' } },
];

export const ANCHORS = [
  { id: 'sputnik', day: dayOf(1957, 10, 4), text: 'The Soviet Union has placed a satellite in orbit. Congress wants to know why we have not.', supplementary: 2000000 },
  { id: 'nasa-formation', day: END_DAY, text: 'The National Aeronautics and Space Administration begins operations today.' },
];

// Conditions attached to an annual award, checked when the fiscal year closes.
export const AWARD_CONDITIONS = {
  1947: { text: 'Fly at least one instrumented sounding rocket this year', successfulFlights: 1 },
  1950: { text: 'Fly at least two research flights this year', successfulFlights: 2 },
};
