// The player's years on the range, 1945–1950: the rounds they work, and what happens at White Sands between them.
// WAC Corporal first (first flights 11 October 1945). Then the Army lends JPL hands to the captured V-2 firings, and JPL
// and General Electric put a WAC on a V-2's nose: Project Bumper. Dates marked Provisional are a plausible round in that
// stretch; the others are the real flight's date less two days of preparation.
import { dayOf } from '../core/calendar.js';

export const SEASON = [
  { id: 'wac-1', vehicle: 'wac', start: dayOf(1945, 10, 9), name: 'the first WAC Corporal round' },
  { id: 'wac-2', vehicle: 'wac', start: dayOf(1945, 10, 23), name: 'the second WAC Corporal round' }, // Provisional
  { id: 'wac-3', vehicle: 'wac', start: dayOf(1946, 5, 14), name: 'a spring 1946 WAC Corporal round' }, // Provisional
  { id: 'wac-b', vehicle: 'wac', start: dayOf(1946, 12, 3), name: 'the first WAC-B, the improved WAC Corporal' }, // Provisional
  { id: 'v2-1', vehicle: 'v2', start: dayOf(1947, 4, 8), name: 'a V-2 round with General Electric\'s Hermes crew' }, // Provisional
  { id: 'bumper-1', vehicle: 'bumper', start: dayOf(1948, 5, 11), name: 'Bumper 1, the first V-2 with a WAC on its nose' }, // flew 13 May 1948
  { id: 'bumper-5', vehicle: 'bumper', start: dayOf(1949, 2, 22), name: 'Bumper 5', turningPoint: true }, // flew 24 February 1949
  // Aerobee firings at White Sands for the Navy and Aerojet. The seat you hold decides whether you run them or work on them.
  { id: 'aerobee-1', vehicle: 'aerobee', start: dayOf(1949, 6, 7), name: 'an Aerobee round for the Navy' }, // Provisional
  { id: 'aerobee-2', vehicle: 'aerobee', start: dayOf(1949, 11, 15), name: 'an autumn 1949 Aerobee round' }, // Provisional
  { id: 'aerobee-3', vehicle: 'aerobee', start: dayOf(1950, 5, 9), name: 'a spring 1950 Aerobee round', turningPoint: true }, // Provisional
  // The Navy's Viking, built by Martin for the Naval Research Laboratory: a gimballed engine where the V-2 had vanes.
  { id: 'viking-5', vehicle: 'viking', start: dayOf(1950, 11, 19), name: 'Viking 5' }, // flew 21 November 1950
  { id: 'viking-7', vehicle: 'viking', start: dayOf(1951, 8, 5), name: 'Viking 7' }, // flew 7 August 1951
  { id: 'viking-9', vehicle: 'viking', start: dayOf(1952, 12, 13), name: 'Viking 9' }, // flew 15 December 1952
];

// The site changes over the years. The new blockhouse goes up beside the old one over the winter of 1950-51 (Provisional
// dates); from the spring the count is run from there.
export const SITE_CHANGES = { newBlockhouse: { start: dayOf(1950, 9, 1), done: dayOf(1951, 4, 1) } };
export const blockhouseState = day => {
  const b = SITE_CHANGES.newBlockhouse;
  return day >= b.done ? { built: true, progress: 1 } : { built: false, progress: Math.max(0, Math.min(1, (day - b.start) / (b.done - b.start))) };
};

// What went on at White Sands while the player had no round to work. Shown on arrival at the next round.
// Lines about other people's flights follow the record: the player was not on those rounds.
export const BETWEEN = {
  'wac-2': ['The rest of the October rounds kept the crew busy. You were not on them.'],
  'wac-3': [
    'Winter on the range: the WAC team went back to Pasadena to rework the design, and you went with the drawings.',
    'Over the winter the Army assembled V-2s from the captured parts that came by rail last year. They static-fired one on 15 March, and on 16 April 1946 they launched the first from their own pad down the range.',
  ],
  'wac-b': [
    'Summer and autumn 1946: the V-2 firings carried on through the year. About half went wrong one way or another: a pump, the controls, the radio.',
    'The WAC-B is the improved round: lighter, with the lessons of the 1945 flights built in.',
  ],
  'v2-1': [
    'After the WAC-B the Army asked for JPL hands on the V-2 firings. Ellis lent you to the General Electric crew that runs them for Project Hermes, and she came along to keep an eye on her people.',
    'The V-2s are captured German hardware, rebuilt from crates of parts. Walt Hoyt, GE\'s crew chief, runs the V-2 hangar. He will be on your rounds.',
    'The V-2 crews talk about two things above all: the turbopump and its steam generator, and the graphite vanes that steer her in the exhaust.',
  ],
  'bumper-1': [
    'Project Bumper is under way: a V-2 lower stage with a WAC Corporal on its nose, to see how high two stages can go. JPL builds the upper stage, GE flies the V-2. You are on both.',
    'The first Bumper flies with its WAC only partly fuelled, to prove the staging before going for height.',
  ],
  'bumper-5': [
    'Bumper 2 flew in August 1948 without you: the V-2 lost its propellant flow and came down from 13 km.',
    'Bumper 3 in September: the V-2 did its part, but the WAC stage failed.',
    'Bumper 4 in November: an explosion in the V-2\'s tail, under 5 km up.',
    'After three bad flights in a row the whole range is watching the next one. Ellis wants you on it.',
  ],
  'aerobee-1': [
    'The Aerobee is Aerojet\'s sounding rocket, born of the WAC: a solid booster and a nitric acid and aniline sustainer. It has flown here since November 1947, for the Navy and the Air Force.',
    'Lt. Cmdr. Paul Brandt is the Navy\'s project officer for these firings. Range time is booked weeks ahead, and he means to keep his slots.',
  ],
  'aerobee-2': ['The summer\'s other Aerobee firings went ahead without you: scientists\' instruments in the nose, cosmic rays and the upper air.'],
  'aerobee-3': ['Winter on the range. Up at the north end, the Navy\'s Viking team is getting its own rocket ready.'],
  'viking-5': [
    'The Navy\'s Viking has flown four times. Vikings 1 and 2, in May and September 1949, cut off early with steam leaking from the turbine. Viking 3 veered west and the range cut it down. Viking 4 flew from the deck of USS Norton Sound in the Pacific in May 1950, to about 170 km.',
    'Brandt has the Viking firings at White Sands now, and you go with them.',
    'Beside the old blockhouse the range has started a new one: bigger, with thicker walls. You can watch it go up.',
  ],
  'viking-7': [
    'Viking 6, in December 1950, lost a fin and its attitude and came down from about 64 km. You were not on it.',
    'The new blockhouse is finished: a bigger firing room, periscopes, and a telemetry rack. This round is counted from there.',
  ],
  'viking-9': [
    'Viking 8, in June 1952, broke loose from its moorings during a static firing and flew. The range cut its engine at 55 seconds and it came down a few miles to the southeast.',
    'Martin has improved the airframe for the later Vikings: lighter, and carrying more propellant.',
  ],
};

// The test conductor's offer, made at a turning point (Bumper 5, and again after the Aerobee rounds if you are still a
// junior engineer). Aerobee: the sounding rocket Aerojet
// built from the WAC's lessons, first flown at White Sands in November 1947.
export const FIRST_OFFER = {
  seat: 'test-conductor',
  title: 'Test conductor, Aerobee firings',
  from: 'ellis',
  text: 'Aerojet and the Navy are short of a test conductor for their Aerobee firings here. You\'d plan the tests, run the whole count and chair the reviews. I told them you were ready.',
  sidelined: 'Aerojet wanted a test conductor for their Aerobee firings. They asked me about you, and I couldn\'t say you were ready. Keep at it and they\'ll ask again.',
  again: 'Aerojet are asking again. They still need a test conductor for the Aerobee firings, and after this year I can tell them you\'re ready.',
};
