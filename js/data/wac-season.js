// The WAC Corporal season, 1945–1946: the rounds the player works, and what happens on the range between them.
// The first round follows the October 1945 campaign (first flights 11 October). The later dates are Provisional:
// a WAC round later in October 1945, one in spring 1946, and the improved WAC-B at the end of 1946.
import { dayOf } from '../core/calendar.js';

export const SEASON = [
  { id: 'wac-1', start: dayOf(1945, 10, 9), name: 'the first WAC Corporal round' },
  { id: 'wac-2', start: dayOf(1945, 10, 23), name: 'the second WAC Corporal round' },
  { id: 'wac-3', start: dayOf(1946, 5, 14), name: 'a spring 1946 WAC Corporal round' },
  { id: 'wac-b', start: dayOf(1946, 12, 3), name: 'the first WAC-B, the improved WAC Corporal' },
];

// What went on at White Sands while the player had no WAC round to work. Shown on arrival at the next round.
export const BETWEEN = {
  'wac-2': ['The rest of the October rounds kept the crew busy. You were not on them.'],
  'wac-3': [
    'Winter on the range: the WAC team went back to Pasadena to rework the design, and you went with the drawings.',
    'Over the winter the Army assembled V-2s from the captured parts that came by rail last year. On 16 April 1946 they fired the first one from their own pad down the range.',
  ],
  'wac-b': [
    'Summer and autumn 1946: the V-2 firings carried on through the year, some well, some badly. Everyone on the range watched them.',
    'The WAC-B is the improved round: lighter, with the lessons of the 1945 flights built in.',
  ],
};
