// The player's years on the range, 1945–1964: the rounds they work, and what happens between them. White Sands first; from
// late 1956 Project Vanguard at Cape Canaveral; then NASA's first lunar shots, with JPL, from the Cape.
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
  // Project Vanguard, the Navy's satellite for the International Geophysical Year, at Cape Canaveral. Vikings 13 and 14 flew
  // first as test vehicles TV-0 and TV-1. After Sputnik every slip is watched from Washington (pressure).
  { id: 'vanguard-tv0', vehicle: 'viking', site: 'cape', start: dayOf(1956, 12, 6), name: 'Vanguard TV-0, Viking 13, the first round at the Cape' }, // flew 8 December 1956
  { id: 'vanguard-tv3', vehicle: 'vanguard', site: 'cape', pressure: true, start: dayOf(1957, 12, 4), name: 'Vanguard TV-3, the first try for orbit' }, // 6 December 1957
  { id: 'vanguard-tv4', vehicle: 'vanguard', site: 'cape', pressure: true, start: dayOf(1958, 3, 15), name: 'Vanguard TV-4' }, // flew 17 March 1958, Vanguard 1
  // NASA, from 1 October 1958. JPL's lunar probes: two Juno II Pioneers aimed past the Moon, and Ranger 7, after six Rangers
  // had failed, aimed to hit it with its cameras running.
  { id: 'pioneer-3', vehicle: 'juno', site: 'cape', start: dayOf(1958, 12, 4), name: 'Pioneer 3, a Juno II for the Moon' }, // flew 6 December 1958
  { id: 'pioneer-4', vehicle: 'juno', site: 'cape', start: dayOf(1959, 3, 1), name: 'Pioneer 4' }, // flew 3 March 1959
  { id: 'ranger-7', vehicle: 'ranger', site: 'cape', pressure: true, start: dayOf(1964, 7, 26), name: 'Ranger 7' }, // flew 28 July 1964
];

// Where a round is flown, and what the site is called on the range plot and in the rooms.
export const SITES = {
  'white-sands': { name: 'White Sands Proving Ground', plot: 'WHITE SANDS PROVING GROUND', truck: 'Recovery truck', recovery: 'The impact area' },
  cape: { name: 'Cape Canaveral', plot: 'ATLANTIC MISSILE RANGE · CAPE CANAVERAL', truck: 'Range car', recovery: 'The telemetry building' },
};
export const siteOf = round => SITES[round.site || 'white-sands'];

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
  'vanguard-tv0': [
    'Vikings 10, 11 and 12 flew from White Sands without you. Viking 11, in May 1954, reached 254 km, the highest any single-stage rocket had gone.',
    'In 1955 the satellite proposals went before the Stewart Committee in Washington: the Army\'s Orbiter, a Redstone with clusters of small solid rockets on top, against the Navy\'s Vanguard, a new three-stage rocket built on the Viking. In August the committee chose Vanguard.',
    'The Navy\'s Vanguard team has moved to Cape Canaveral in Florida, to Launch Complex 18 on the Atlantic Missile Range. Brandt is with the Naval Research Laboratory now, and you have gone with him.',
    'The first rounds are Vikings, flown as test vehicles. This one, TV-0, carries the Minitrack radio that is meant to follow a satellite. What comes down falls in the Atlantic: the range reads her from telemetry and radar, not from a wreck.',
  ],
  'vanguard-tv3': [
    'Vanguard TV-1, Viking 14, flew in May 1957 and proved the third stage. TV-2, in October, flew the new first stage, with dummy upper stages, and it worked.',
    'On 4 October 1957 the Soviet Union put Sputnik 1 into orbit. Its beeping could be picked up on any shortwave radio. On 3 November Sputnik 2 followed, with a dog, Laika, aboard.',
    'The White House has announced that Vanguard will put up an American satellite. This round was meant as a test, and now it carries a 1.5 kg sphere with two radios. The press is camped on the beach.',
    'Every day this round slips is reported from here to Washington.',
  ],
  'vanguard-tv4': [
    'On 31 January 1958 the Army put Explorer 1 into orbit from the Cape on a Jupiter-C: a Redstone with three upper stages of small solid rockets, clustered in a spinning tub. JPL built the upper stages and the satellite. Ellis\'s people were on it.',
    'Explorer 1\'s Geiger counter found far more radiation than anyone expected, in belts around the Earth.',
    'Vanguard TV-3BU, the backup, went up on 5 February. Its steering failed and it broke up at 57 seconds. You were not on it.',
  ],
  'pioneer-3': [
    'On 1 October 1958 the National Aeronautics and Space Administration opened its doors. The Vanguard team went to it, and in December so did JPL.',
    'Pioneer 1 went up on 11 October on an Air Force Thor-Able, aimed at the Moon. It climbed to about 113,800 km and fell back. Pioneer 2, in November, never got that far: its third stage did not fire.',
    'Ellis asked for you. JPL\'s Pioneers fly on Juno II: a Jupiter missile with JPL\'s spinning tub of small solid rockets on top. The aim is to go past the Moon. Brandt went to NASA too, and he still keeps the schedule.',
  ],
  'pioneer-4': [
    'On 2 January 1959 the Soviet Luna 1 passed the Moon at about 6,000 km and went on into orbit round the Sun, the first craft to escape the Earth.',
    'In February Vanguard 2 went into orbit with the first weather instruments.',
  ],
  'ranger-7': [
    'That was the last of the Juno II lunar probes. In September 1959 Luna 2 hit the Moon; in October Luna 3 photographed its far side.',
    'In April 1961 Yuri Gagarin orbited the Earth, and in May Alan Shepard flew from the Cape. On 25 May President Kennedy asked Congress to land a man on the Moon before the decade was out. Apollo needs to know what the Moon\'s surface is like.',
    'JPL\'s Ranger was meant to find out, and six Rangers failed. Rangers 1 and 2, in 1961, were left in low orbit when the Agena did not restart. Ranger 3 missed the Moon. Ranger 4 hit the far side, dead. Ranger 5 lost its power and missed. In February 1964 Ranger 6 hit the Sea of Tranquility on time, and its cameras never came on.',
    'Congress has held hearings. The papers call Ranger a shoot-and-hope programme. Every day this round slips is reported to Washington.',
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
