// The 1945–1958 scenario (freeze §2): acts, the programmes that arrive and the anchor events.
import { dayOf, END_DAY } from '../core/calendar.js';

export const ACTS = [
  { id: 'wac', name: 'WAC at White Sands', from: 0 },
  { id: 'aerobee-viking', name: 'Aerobee and Viking', from: dayOf(1947, 1, 1) },
  { id: 'vanguard-explorer', name: 'Vanguard and Explorer', from: dayOf(1955, 1, 1) },
  { id: 'nasa-formation', name: 'NASA formation', from: dayOf(1958, 1, 1) },
];

// Programmes and when their proposal arrives. `stage: 'greenlit'` starts the programme already approved.
export const PROGRAMMES = [
  { id: 'wac', name: 'WAC Corporal', vehicle: 'wac', source: 'objective', arrives: 0, stage: 'greenlit' },
  { id: 'bumper', name: 'Bumper', vehicle: 'bumper', source: 'external', client: 'Army Ordnance', arrives: dayOf(1946, 6, 1) },
  { id: 'aerobee', name: 'Aerobee', vehicle: 'aerobee', source: 'external', client: 'Applied Physics Laboratory', arrives: dayOf(1946, 5, 17) },
  { id: 'viking', name: 'Viking', vehicle: null, source: 'external', client: 'Naval Research Laboratory', arrives: dayOf(1946, 8, 1) },
  { id: 'vanguard', name: 'Vanguard proposal', vehicle: null, source: 'external', client: 'Naval Research Laboratory', arrives: dayOf(1955, 8, 3) },
  { id: 'explorer', name: 'Explorer proposal', vehicle: null, source: 'external', client: 'Army Ballistic Missile Agency', arrives: dayOf(1955, 8, 3) },
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
