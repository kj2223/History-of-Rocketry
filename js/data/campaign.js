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
  { id: 'v2-1', vehicle: 'v2', start: dayOf(1947, 4, 8), name: "a V-2 round with General Electric's Hermes crew" }, // Provisional
  {
    id: 'bumper-1',
    vehicle: 'bumper',
    start: dayOf(1948, 5, 11),
    name: 'Bumper 1, the first V-2 with a WAC on its nose',
  }, // flew 13 May 1948
  { id: 'bumper-5', vehicle: 'bumper', start: dayOf(1949, 2, 22), name: 'Bumper 5', turningPoint: true }, // flew 24 February 1949
  // Aerobee firings at White Sands for the Navy and Aerojet. The seat you hold decides whether you run them or work on them.
  { id: 'aerobee-1', vehicle: 'aerobee', start: dayOf(1949, 6, 7), name: 'an Aerobee round for the Navy' }, // Provisional
  { id: 'aerobee-2', vehicle: 'aerobee', start: dayOf(1949, 11, 15), name: 'an autumn 1949 Aerobee round' }, // Provisional
  {
    id: 'aerobee-3',
    vehicle: 'aerobee',
    start: dayOf(1950, 5, 9),
    name: 'a spring 1950 Aerobee round',
    turningPoint: true,
  }, // Provisional
  // The Navy's Viking, built by Martin for the Naval Research Laboratory: a gimballed engine where the V-2 had vanes.
  { id: 'viking-5', vehicle: 'viking', start: dayOf(1950, 11, 19), name: 'Viking 5' }, // flew 21 November 1950
  { id: 'viking-7', vehicle: 'viking', start: dayOf(1951, 8, 5), name: 'Viking 7' }, // flew 7 August 1951
  { id: 'viking-9', vehicle: 'viking', start: dayOf(1952, 12, 13), name: 'Viking 9' }, // flew 15 December 1952
  // Project Vanguard, the Navy's satellite for the International Geophysical Year, at Cape Canaveral. Vikings 13 and 14 flew
  // first as test vehicles TV-0 and TV-1. After Sputnik every slip is watched from Washington (pressure).
  {
    id: 'vanguard-tv0',
    vehicle: 'viking',
    site: 'cape',
    start: dayOf(1956, 12, 6),
    name: 'Vanguard TV-0, Viking 13, the first round at the Cape',
  }, // flew 8 December 1956
  {
    id: 'vanguard-tv3',
    vehicle: 'vanguard',
    site: 'cape',
    pressure: true,
    start: dayOf(1957, 12, 4),
    name: 'Vanguard TV-3, the first try for orbit',
  }, // 6 December 1957
  {
    id: 'vanguard-tv4',
    vehicle: 'vanguard',
    site: 'cape',
    pressure: true,
    start: dayOf(1958, 3, 15),
    name: 'Vanguard TV-4',
  }, // flew 17 March 1958, Vanguard 1
  // NASA, from 1 October 1958. JPL's lunar probes: two Juno II Pioneers aimed past the Moon, and Ranger 7, after six Rangers
  // had failed, aimed to hit it with its cameras running.
  {
    id: 'pioneer-3',
    vehicle: 'juno',
    site: 'cape',
    start: dayOf(1958, 12, 4),
    name: 'Pioneer 3, a Juno II for the Moon',
  }, // flew 6 December 1958
  { id: 'pioneer-4', vehicle: 'juno', site: 'cape', start: dayOf(1959, 3, 1), name: 'Pioneer 4', turningPoint: 'nasa' }, // flew 3 March 1959
  // From here the years split. Take the Space Task Group's offer and you go to Mercury Control (path 'nasa'); stay with
  // JPL and you work Ranger (path 'jpl'). crewed: the round is a Mercury flight, worked from a console (mercury.js).
  {
    id: 'mr-1',
    vehicle: 'redstone',
    site: 'cape',
    crewed: 'mercury',
    path: 'nasa',
    start: dayOf(1960, 11, 20),
    name: 'Mercury-Redstone 1, the first Mercury capsule on a Redstone',
  }, // 21 November 1960: a sim day, then launch day
  // The first American in space. crew: who flies it. adopt: fixes Marshall made between flights whatever the reviews said
  // (after MR-1 the tail plug; after Ham's flight the thrust controller, proved on the MR-BD flight of 24 March 1961).
  {
    id: 'mr-3',
    vehicle: 'redstone',
    site: 'cape',
    crewed: 'mercury',
    crew: ['rourke'],
    adopt: ['plug', 'thrust'],
    turningPoint: 'engineer',
    path: 'nasa',
    pressure: true,
    start: dayOf(1961, 5, 4),
    name: 'Mercury-Redstone 3, the first American in space',
  }, // 5 May 1961
  // Into orbit on the Atlas. orbital: the flight is worked through orbit, retrofire and entry. risk: what is likelier on this
  // flight than the programme's usual odds (the hidden layer still decides).
  {
    id: 'ma-6',
    vehicle: 'atlas',
    site: 'cape',
    crewed: 'mercury',
    orbital: true,
    crew: ['okafor'],
    risk: { seg51Risk: 0.6 },
    path: 'nasa',
    pressure: true,
    start: dayOf(1962, 2, 19),
    name: 'Mercury-Atlas 6, the first American in orbit',
  }, // 20 February 1962
  {
    id: 'ma-7',
    vehicle: 'atlas',
    site: 'cape',
    crewed: 'mercury',
    orbital: true,
    crew: ['lindqvist'],
    risk: { scannerRisk: 0.7 },
    after: 'route',
    turningPoint: 'flight',
    path: 'nasa',
    start: dayOf(1962, 5, 23),
    name: 'Mercury-Atlas 7',
  }, // 24 May 1962
  // Gemini, from the new Mission Control in Houston: two-man flights of days, worked in shifts (houston.js). crew: the
  // commander first.
  {
    id: 'gem-4',
    vehicle: 'titan',
    site: 'cape',
    crewed: 'gemini',
    orbital: true,
    crew: ['boateng', 'nakamura'],
    risk: { hatchRisk: 0.6, computerRisk: 0.6 },
    path: 'nasa',
    pressure: true,
    start: dayOf(1965, 6, 2),
    name: 'Gemini 4, the first flight from Houston',
  }, // 3 June 1965
  {
    id: 'gem-5',
    vehicle: 'titan',
    site: 'cape',
    crewed: 'gemini',
    orbital: true,
    crew: ['whitcomb', 'castellano'],
    risk: { fuelcellRisk: 0.75, navRisk: 0.7 },
    path: 'nasa',
    start: dayOf(1965, 8, 20),
    name: 'Gemini 5, eight days',
  }, // 21 August 1965
  {
    id: 'gem-6',
    vehicle: 'titan',
    site: 'cape',
    crewed: 'gemini',
    orbital: true,
    crew: ['szabo', 'kowalczyk'],
    risk: { shutdownRisk: 0.7, computerRisk: 0.3 },
    path: 'nasa',
    pressure: true,
    start: dayOf(1965, 12, 11),
    name: 'Gemini 6A, the rendezvous with Gemini 7',
  }, // 12 December 1965, flown 15 December
  {
    id: 'gem-8',
    vehicle: 'titan',
    site: 'cape',
    crewed: 'gemini',
    orbital: true,
    crew: ['fairbanks', 'nakamura'],
    risk: { thrusterRisk: 0.7 },
    path: 'nasa',
    start: dayOf(1966, 3, 15),
    name: 'Gemini 8, the first docking',
  }, // 16 March 1966
  {
    id: 'gem-12',
    vehicle: 'titan',
    site: 'cape',
    crewed: 'gemini',
    orbital: true,
    crew: ['kowalczyk', 'boateng'],
    path: 'nasa',
    start: dayOf(1966, 11, 10),
    name: 'Gemini 12, the last Gemini',
  }, // 11 November 1966
  // Apollo, on the Saturn V. The first is flown without a crew: the last proving flight before men ride it.
  {
    id: 'apollo-6',
    vehicle: 'saturn5',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: [],
    risk: { pogoRisk: 0.75, j2Risk: 0.6, relightRisk: 0.5 },
    after: 'apollo8',
    path: 'nasa',
    start: dayOf(1968, 4, 2),
    name: 'Apollo 6, the second Saturn V, without a crew',
  }, // 4 April 1968
  {
    id: 'apollo-8',
    vehicle: 'saturn5',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: ['boateng', 'beckett', 'oyelaran'],
    path: 'nasa',
    pressure: true,
    start: dayOf(1968, 12, 20),
    name: 'Apollo 8',
  }, // 21 December 1968
  {
    id: 'apollo-10',
    vehicle: 'saturn5',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: ['szabo', 'reiss', 'kowalczyk'],
    path: 'nasa',
    start: dayOf(1969, 5, 17),
    name: 'Apollo 10, the dress rehearsal',
  }, // 18 May 1969
  {
    id: 'apollo-11',
    vehicle: 'saturn5',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: ['fairbanks', 'oyelaran', 'beckett'],
    risk: { alarmRisk: 0.75 },
    path: 'nasa',
    pressure: true,
    start: dayOf(1969, 7, 14),
    name: 'Apollo 11, the landing',
  }, // 16 July 1969
  {
    id: 'apollo-12',
    vehicle: 'saturn5',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: ['nakamura', 'reiss', 'dumont'],
    risk: { lightningRisk: 0.7 },
    path: 'nasa',
    start: dayOf(1969, 11, 12),
    name: 'Apollo 12, the pinpoint landing',
  }, // 14 November 1969
  // The third landing. The flight itself is the hidden layer's, like every round: whether oxygen tank two fails on the
  // way out is decided when the round is made, never scripted (C3).
  {
    id: 'apollo-13',
    vehicle: 'saturn5',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: ['kowalczyk', 'harlan', 'reiss'],
    path: 'nasa',
    start: dayOf(1970, 4, 9),
    name: 'Apollo 13, the third landing',
  }, // launched 11 April 1970
  {
    id: 'apollo-15',
    vehicle: 'saturn5',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: ['moreau', 'price', 'tanaka'],
    risk: { chuteRisk: 0.6 },
    path: 'nasa',
    start: dayOf(1971, 7, 24),
    name: 'Apollo 15, Hadley Rille and the rover',
  }, // 26 July 1971
  // Apollo 16, the Descartes highlands: the last of the science landings before the cuts, and the rover again.
  {
    id: 'apollo-16',
    vehicle: 'saturn5',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: ['achterberg', 'castellano', 'dumont'],
    risk: { spsRisk: 0.4, throttleRisk: 0.75 },
    path: 'nasa',
    start: dayOf(1972, 4, 14),
    name: 'Apollo 16, the Descartes highlands',
  }, // launched 16 April 1972
  // Apollo 17, the last one: three days in the valley of Taurus-Littrow, with the geologist in the lander.
  {
    id: 'apollo-17',
    vehicle: 'saturn5',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: ['price', 'beckett', 'tanaka'],
    risk: { j2Risk: 0.5 },
    path: 'nasa',
    start: dayOf(1972, 12, 5),
    name: 'Apollo 17, the last landing, the valley of Taurus-Littrow',
  }, // launched 7 December 1972
  // The workshop years. The crews fly on the Saturn IB and stay weeks aboard; the station itself went up on the last
  // Saturn V, and whether her shield survived the climb is the hidden layer's, from the game's seed.
  {
    id: 'skylab-2',
    vehicle: 'saturnib',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: ['halloran', 'dengler', 'serrano'],
    path: 'nasa',
    start: dayOf(1973, 5, 23),
    name: 'Skylab 2, the first crew to the workshop',
  }, // launched 25 May 1973
  {
    id: 'skylab-3',
    vehicle: 'saturnib',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: ['cavanagh', 'ostrowski', 'lindstrom'],
    path: 'nasa',
    start: dayOf(1973, 7, 26),
    name: 'Skylab 3, fifty-nine days aboard',
  }, // launched 28 July 1973
  {
    id: 'skylab-4',
    vehicle: 'saturnib',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: ['beaumont', 'adeyemi', 'whitfield'],
    path: 'nasa',
    start: dayOf(1973, 11, 14),
    name: 'Skylab 4, eighty-four days aboard',
  }, // launched 16 November 1973
  // The last Apollo: docked with the other side, and flown home for good.
  {
    id: 'astp',
    vehicle: 'saturnib',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: ['okafor', 'gardner', 'novak'],
    path: 'nasa',
    start: dayOf(1975, 7, 13),
    name: 'Apollo-Soyuz, the last Apollo',
  }, // launched 15 July 1975
  // The Shuttle years (A8). The orbiter is a winged spacecraft: she flies to orbit, works in it, and lands on a runway.
  // The joints and the tank are the hidden layer's; the cold of January 1986 is a condition, never a script.
  {
    id: 'sts-1',
    vehicle: 'shuttle',
    site: 'cape',
    crewed: 'shuttle',
    orbital: true,
    crew: ['carter', 'ellison'],
    path: 'nasa',
    start: dayOf(1981, 4, 10),
    name: 'STS-1, the first Shuttle flight',
  }, // launched 12 April 1981
  {
    id: 'sts-51l',
    vehicle: 'shuttle',
    site: 'cape',
    crewed: 'shuttle',
    orbital: true,
    crew: ['hobbs', 'winters', 'nakagawa'],
    risk: { oringRisk: 0.9, boostRisk: 0.95, cold: true },
    path: 'nasa',
    start: dayOf(1986, 1, 26),
    name: 'STS-51-L, the coldest launch morning',
  }, // launched 28 January 1986
  {
    id: 'sts-26',
    vehicle: 'shuttle',
    site: 'cape',
    crewed: 'shuttle',
    orbital: true,
    crew: ['donovan', 'vasquez', 'brennan'],
    path: 'nasa',
    start: dayOf(1988, 9, 27),
    name: 'STS-26, the return to flight',
  }, // launched 29 September 1988
  {
    id: 'sts-61',
    vehicle: 'shuttle',
    site: 'cape',
    crewed: 'shuttle',
    orbital: true,
    crew: ['vasquez', 'quinn', 'donovan'],
    path: 'nasa',
    start: dayOf(1993, 12, 1),
    name: 'STS-61, the repair of the telescope',
  }, // launched 2 December 1993
  // The station era (A9): the pieces go up on the Shuttle, and the crews stay months at a time.
  {
    id: 'sts-88',
    vehicle: 'shuttle',
    site: 'cape',
    crewed: 'shuttle',
    orbital: true,
    crew: ['okeke', 'farrow', 'delacroix'],
    path: 'nasa',
    start: dayOf(1998, 12, 2),
    name: 'STS-88, the first two modules of the station',
  }, // launched 4 December 1998
  {
    id: 'sts-97',
    vehicle: 'shuttle',
    site: 'cape',
    crewed: 'shuttle',
    orbital: true,
    crew: ['hawthorne', 'farrow', 'quinn'],
    path: 'nasa',
    start: dayOf(2000, 11, 29),
    name: 'STS-97, the solar wings and the first expedition',
  }, // launched 30 November 2000
  // Commercial crew (A10): a company's spacecraft and launcher, bought by the seat.
  {
    id: 'demo-2',
    vehicle: 'dragon',
    site: 'cape',
    crewed: 'dragon',
    orbital: true,
    crew: ['sharma', 'larsen'],
    path: 'nasa',
    start: dayOf(2020, 5, 25),
    name: 'Demo-2, the first commercial crew',
  }, // launched 30 May 2020
  // Artemis (A11): Apollo's granddaughter. One round the Moon with nobody aboard, then a crew of four on the free return,
  // then the return to the Moon at the south pole. The campaign ends here, in 2030.
  {
    id: 'artemis-1',
    vehicle: 'sls',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: [],
    risk: { relightRisk: 0.4 },
    path: 'nasa',
    start: dayOf(2022, 11, 14),
    name: 'Artemis I, the Moon round trip without a crew',
  }, // launched 16 November 2022
  {
    id: 'artemis-2',
    vehicle: 'sls',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: ['sharma', 'vaughn', 'larsen', 'petrossian'],
    path: 'nasa',
    start: dayOf(2025, 9, 10),
    name: 'Artemis II, a crew of four round the Moon',
  }, // launched 12 September 2025
  {
    id: 'artemis-3',
    vehicle: 'sls',
    site: 'cape',
    crewed: 'apollo',
    orbital: true,
    crew: ['vaughn', 'larsen', 'petrossian'],
    risk: { spsRisk: 0.4 },
    path: 'nasa',
    start: dayOf(2028, 9, 8),
    name: 'Artemis III, the return to the Moon, the south pole',
  }, // launched 10 September 2028
  {
    id: 'ranger-7',
    vehicle: 'ranger',
    site: 'cape',
    path: 'jpl',
    pressure: true,
    start: dayOf(1964, 7, 26),
    name: 'Ranger 7',
  }, // flew 28 July 1964
];

// The last word on the season-end page: what came after the last round you worked, and where this build stops.
export const LAST_WORD = {
  'ranger-7':
    "Ranger 7's pictures showed the Moon's surface down to a metre across: craters on craters, and ground firm enough to land on. Ranger 8 and 9 followed in 1965, and then the Surveyors set down softly. That is as far as the uncrewed years go in this build.",
  'artemis-3':
    'Artemis III came home in the autumn of 2028, and the crew walked where nobody has walked since 1972: the south pole of the Moon, where the ice is. The base at the pole grows through 2029 and 2030, and the flights keep coming. This is where the build ends.',
};
// Where a round is flown, and what the site is called on the range plot and in the rooms.
export const SITES = {
  'white-sands': {
    name: 'White Sands Proving Ground',
    plot: 'WHITE SANDS PROVING GROUND',
    truck: 'Recovery truck',
    recovery: 'The impact area',
  },
  cape: {
    name: 'Cape Canaveral',
    plot: 'ATLANTIC MISSILE RANGE · CAPE CANAVERAL',
    truck: 'Range car',
    recovery: 'The telemetry building',
  },
};
export const siteOf = round => SITES[round.site || 'white-sands'];
// Whether a round is on the player's path: rounds without a path are on every path; the rest only on their own.
export const onPath = (round, path = 'jpl') => !round.path || round.path === path;

// The site changes over the years. The new blockhouse goes up beside the old one over the winter of 1950-51 (Provisional
// dates); from the spring the count is run from there.
export const SITE_CHANGES = { newBlockhouse: { start: dayOf(1950, 9, 1), done: dayOf(1951, 4, 1) } };
export const blockhouseState = day => {
  const b = SITE_CHANGES.newBlockhouse;
  return day >= b.done
    ? { built: true, progress: 1 }
    : { built: false, progress: Math.max(0, Math.min(1, (day - b.start) / (b.done - b.start))) };
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
    "The V-2s are captured German hardware, rebuilt from crates of parts. Walt Hoyt, GE's crew chief, runs the V-2 hangar. He will be on your rounds.",
    'The V-2 crews talk about two things above all: the turbopump and its steam generator, and the graphite vanes that steer her in the exhaust.',
  ],
  'bumper-1': [
    'Project Bumper is under way: a V-2 lower stage with a WAC Corporal on its nose, to see how high two stages can go. JPL builds the upper stage, GE flies the V-2. You are on both.',
    'The first Bumper flies with its WAC only partly fuelled, to prove the staging before going for height.',
  ],
  'bumper-5': [
    'Bumper 2 flew in August 1948 without you: the V-2 lost its propellant flow and came down from 13 km.',
    'Bumper 3 in September: the V-2 did its part, but the WAC stage failed.',
    "Bumper 4 in November: an explosion in the V-2's tail, under 5 km up.",
    'After three bad flights in a row the whole range is watching the next one. Ellis wants you on it.',
  ],
  'aerobee-1': [
    "The Aerobee is Aerojet's sounding rocket, born of the WAC: a solid booster and a nitric acid and aniline sustainer. It has flown here since November 1947, for the Navy and the Air Force.",
    "Lt. Cmdr. Paul Brandt is the Navy's project officer for these firings. Range time is booked weeks ahead, and he means to keep his slots.",
  ],
  'aerobee-2': [
    "The summer's other Aerobee firings went ahead without you: scientists' instruments in the nose, cosmic rays and the upper air.",
  ],
  'aerobee-3': ["Winter on the range. Up at the north end, the Navy's Viking team is getting its own rocket ready."],
  'viking-5': [
    "The Navy's Viking has flown four times. Vikings 1 and 2, in May and September 1949, cut off early with steam leaking from the turbine. Viking 3 veered west and the range cut it down. Viking 4 flew from the deck of USS Norton Sound in the Pacific in May 1950, to about 170 km.",
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
  'apollo-16': [
    'Apollo 14 went to Fra Mauro in February 1971 without you. The Saturn V was checked from end to end after the trouble the year before, and the landings went on.',
  ],
  'apollo-17': [
    '1972: the budget took three Saturn Vs and their flights away, and everyone on the shift knows the valley flight is the last one.',
  ],
  'skylab-2': [
    'The last three Saturn Vs never flew: two stand in museums and one is cut up for spares. Apollo 17 came home in December 1972, and nobody has been back to the Moon.',
  ],
  'skylab-3': ['The first crew came home in June, having kept the workshop alive. The astronomers want her for years.'],
  'skylab-4': [
    'The second crew flew fifty-nine days in the summer and came home in September. The workshop has been lived in for a year.',
  ],
  astp: [
    '1974: the last Skylab crew came home in February after eighty-four days. The workshop stands empty in orbit, waiting for the shuttle that nobody has built yet.',
  ],
  'sts-1': [
    'The seventies went to the workshop and to the treaty handshake in orbit. After that the Saturn line is struck, and what comes next has wings. Six years of building, two years of delays, and the first orbiter goes up with only the two of them aboard.',
  ],
  'sts-51l': [
    'The fleet has flown twenty-four flights without a loss: satellites up, crews back, a laboratory in the bay. January 1986 is the coldest launch morning anyone at the Cape can remember, and the first teacher is aboard.',
  ],
  'sts-26': [
    'The fleet stood down for thirty-two months while the joints were redesigned and the whole agency asked itself what it had missed. The countdown for the return to flight is the most watched in years.',
  ],
  'sts-61': [
    '1990: the telescope went up and could not focus - a mirror ground to the wrong figure, a mistake known only from orbit. The repair has been rehearsed for a year in the pool at Huntsville.',
  ],
  'sts-88': [
    'The station era: Russia is a partner now, and the first module has been up alone for a fortnight, waiting for a visitor.',
  ],
  'sts-97': [
    'The station has been lived in for three weeks by its first long-stay crew, and the visiting flights keep her supplied.',
  ],
  'demo-2': [
    "Nine years since an American crew flew from American soil. The crewed spacecraft are a company's now, and NASA buys the seats.",
  ],
  'artemis-1': [
    "2011: the Shuttle fleet retired, and for a decade the crews rode other people's rockets. What came out of the decade is Apollo's granddaughter with a new name, and she goes up with nobody aboard.",
  ],
  'artemis-2': [
    'Orion flew round the Moon with nobody aboard and came home at eleven kilometres a second, inside her corridor. The four of them have trained together for two years.',
  ],
  'artemis-3': [
    'The lander is up, checked out in lunar orbit by the last flight. The south pole is where the ice is, and where nobody has ever stood.',
  ],
  'vanguard-tv0': [
    'Vikings 10, 11 and 12 flew from White Sands without you. Viking 11, in May 1954, reached 254 km, the highest any single-stage rocket had gone.',
    "In 1955 the satellite proposals went before the Stewart Committee in Washington: the Army's Orbiter, a Redstone with clusters of small solid rockets on top, against the Navy's Vanguard, a new three-stage rocket built on the Viking. In August the committee chose Vanguard.",
    "The Navy's Vanguard team has moved to Cape Canaveral in Florida, to Launch Complex 18 on the Atlantic Missile Range. Brandt is with the Naval Research Laboratory now, and you have gone with him.",
    'The first rounds are Vikings, flown as test vehicles. This one, TV-0, carries the Minitrack radio that is meant to follow a satellite. What comes down falls in the Atlantic: the range reads her from telemetry and radar, not from a wreck.',
  ],
  'vanguard-tv3': [
    'Vanguard TV-1, Viking 14, flew in May 1957 and proved the third stage. TV-2, in October, flew the new first stage, with dummy upper stages, and it worked.',
    'On 4 October 1957 the Soviet Union put Sputnik 1 into orbit. Its beeping could be picked up on any shortwave radio. On 3 November Sputnik 2 followed, with a dog, Laika, aboard.',
    'The White House has announced that Vanguard will put up an American satellite. This round was meant as a test, and now it carries a 1.5 kg sphere with two radios. The press is camped on the beach.',
    'Every day this round slips is reported from here to Washington.',
  ],
  'vanguard-tv4': [
    "On 31 January 1958 the Army put Explorer 1 into orbit from the Cape on a Jupiter-C: a Redstone with three upper stages of small solid rockets, clustered in a spinning tub. JPL built the upper stages and the satellite. Ellis's people were on it.",
    "Explorer 1's Geiger counter found far more radiation than anyone expected, in belts around the Earth.",
    'Vanguard TV-3BU, the backup, went up on 5 February. Its steering failed and it broke up at 57 seconds. You were not on it.',
  ],
  'pioneer-3': [
    'On 1 October 1958 the National Aeronautics and Space Administration opened its doors. The Vanguard team went to it, and in December so did JPL.',
    'Pioneer 1 went up on 11 October on an Air Force Thor-Able, aimed at the Moon. It climbed to about 113,800 km and fell back. Pioneer 2, in November, never got that far: its third stage did not fire.',
    "Ellis asked for you. JPL's Pioneers fly on Juno II: a Jupiter missile with JPL's spinning tub of small solid rockets on top. The aim is to go past the Moon. Brandt went to NASA too, and he still keeps the schedule.",
  ],
  'pioneer-4': [
    'On 2 January 1959 the Soviet Luna 1 passed the Moon at about 6,000 km and went on into orbit round the Sun, the first craft to escape the Earth.',
    'In February Vanguard 2 went into orbit with the first weather instruments.',
  ],
  'mr-1': [
    "You left JPL in the spring of 1959 for the Space Task Group, NASA's new Mercury team at Langley in Virginia. Ellis shook your hand and told you to bring them back alive.",
    'In April 1959 NASA chose seven military test pilots to fly Mercury. They have been training ever since: centrifuge runs, the procedures trainer, survival courses in the desert and at sea.',
    "Mercury Control is a new building at the Cape: rows of consoles facing a big map of the world, with the flight director in the middle and you at the Retrofire officer's desk. Your job is when the capsule comes down, and where.",
    'In September 1959 the Big Joe capsule came back from space on an Atlas with its heat shield charred but whole. On 29 July 1960 Mercury-Atlas 1 broke up a minute after launch with its capsule aboard.',
    "Brandt went to NASA with you. He keeps the Cape's schedule now, and Vega's crew has the Redstone pad at Launch Complex 5.",
    'This first Mercury-Redstone carries no one. If the booster, the capsule and Mercury Control all work, a man rides the next ones.',
  ],
  'mr-3': [
    'Mercury-Redstone 1A flew on 19 December 1960 with the tail plug tied down, and the capsule came home from the edge of space.',
    'On 31 January 1961 Mercury-Redstone 2 carried Ham, a chimpanzee. The thrust controller let the Redstone burn too hot; she ran dry early, the abort sensing fired the escape tower, and the capsule came down 130 miles beyond the ships. Ham was picked up alive from a capsule taking on water.',
    'Marshall reworked the thrust controller and flew a Redstone with a dummy capsule on 24 March to prove it. Some said a man should have been on it.',
    'On 12 April 1961 Yuri Gagarin orbited the Earth once in Vostok 1 and landed in the Soviet Union alive. The papers ask why America is still flying monkeys.',
    'Thomas Rourke has been named for the first flight: fifteen minutes up and down the Atlantic Missile Range. He will be in the simulator with you, and on your loop on the day.',
    'Every day this flight slips is reported to Washington.',
  ],
  'ma-6': [
    'On 21 July 1961 Mercury-Redstone 4 flew Samuel Price up the range. After splashdown the hatch blew, the capsule filled and sank, and he very nearly drowned before a helicopter got a horsecollar to him.',
    'On 25 May 1961 President Kennedy asked Congress to land a man on the Moon before the decade was out. In August Gherman Titov flew seventeen orbits in Vostok 2.',
    "The Redstone has done its work. Orbit needs the Atlas: Convair's missile, its tanks so thin they hold their shape only under pressure. On 29 November 1961 Mercury-Atlas 5 carried Enos, a chimpanzee, round twice and home.",
    "Your console now has the Goddard computers' go/no-go for orbit, the ground stations round the world, and the retrofire clock. The capsule comes home by firing three small retro rockets over California, and where she lands depends on how well they fire.",
    'Daniel Okafor has been named for the first orbit, three times round. The flight has been scrubbed for weather and for the Atlas since January. Every slip is reported to Washington.',
  ],
  'ma-7': [
    'Mercury-Atlas 6 brought the first American home from orbit. Ticker-tape parades in Washington and New York.',
    'Henry Lindqvist has the next one, three orbits again, with experiments to do: a balloon to trail, flares to watch, the horizon to photograph. A busy man uses fuel.',
    'Hangar S reports trouble with the horizon scanners on the bench. They have been changed, and the new ones checked as well as anyone can check them.',
  ],
  'gem-4': [
    'Mercury-Atlas 8 flew six orbits in October 1962. In May 1963 Mercury-Atlas 9 flew twenty-two; when its automatic system failed, its pilot flew the entry by hand. Mercury was over.',
    'In September 1962 NASA chose nine more astronauts for Gemini and Apollo. In June 1963 Valentina Tereshkova flew Vostok 6, the first woman in space.',
    'The Manned Spacecraft Center has moved to Houston, and so has Mission Control: three shifts of flight controllers, a flight director for each, and back rooms full of engineers. The Cape only launches now.',
    'On 23 March 1965 Gemini 3 flew three orbits with Earl Whitcomb in command. Five days earlier Alexei Leonov had stepped outside Voskhod 2 for twelve minutes: the first spacewalk.',
    'Gemini 4 is the first flight run from Houston: four days, and a spacewalk if the spacecraft is good for it. Every slip is reported to Washington.',
  ],
  'gem-5': [
    'Gemini 4 is home. Gemini 5 is meant to stay up eight days, as long as a trip to the Moon and back. It is the first to fly fuel cells instead of batteries.',
    'Nobody knows yet what eight days of weightlessness does to a man. The flight surgeons want to find out before anyone goes to the Moon.',
  ],
  'gem-6': [
    'Gemini 6 was meant to chase an Agena target in October. The Agena blew up on its way to orbit, and the flight was scrubbed with the crew already strapped in.',
    'So Houston changed the plan: Gemini 7 went up on 4 December for fourteen days, and Gemini 6, now 6A, goes up to meet it. Two spacecraft, two crews, both yours.',
    'Gemini 7 has been up a week. The press counts the days. Every slip is reported to Washington.',
  ],
  'gem-8': [
    'Gemini 7 came home after fourteen days. Two Gemini crews have now flown longer than a lunar mission, and Gemini 6A showed that one spacecraft can find another.',
    "Gemini 8 is to dock with an Agena target, the first time two spacecraft have joined in orbit. Then three days of work with the Agena's engine.",
  ],
  'gem-12': [
    'Gemini 9A, in June 1966: its spacewalker fought his suit for two hours, his visor fogged and his heart rate passed 180. He got back in, exhausted, with most of the work undone.',
    'Gemini 10 in July and Gemini 11 in September docked with their Agenas and fired the Agena engines to climb, Gemini 11 to 1,370 km. Their spacewalks went better, and still wore men out.',
    'Gemini 12 is the last. The spacewalk has been rehearsed underwater in a pool, with handholds and foot restraints fitted outside.',
  ],
  'apollo-6': [
    "Gemini is over, and Houston's whole attention is on Apollo: a command and service module from North American, a lunar module from Grumman, and the Saturn V from Marshall, the biggest rocket ever built.",
    'Saturn IB flights in 1966 tested the command and service module without a crew: AS-201, AS-202, and AS-203 for the third stage.',
    "On 9 November 1967 Apollo 4, the first Saturn V, flew without a crew and flawlessly. In January 1968 Apollo 5 tested the lunar module's engines in Earth orbit, also without a crew.",
    'Apollo 6 is the second Saturn V. If it flies clean, the next one carries men.',
  ],
  'apollo-8': [
    'In October 1968 Apollo 7 flew eleven days in Earth orbit on a Saturn IB, the first crew in the rebuilt command module. It worked, nearly everything of it.',
    'Apollo 8 is the first crew on a Saturn V. Every slip is reported to Washington.',
  ],
  'apollo-10': [
    'In March 1969 Apollo 9 flew the lander for the first time with a crew, in Earth orbit: undocked, flew it a hundred miles away and brought it back.',
    'Apollo 10 does everything but land: the lander goes down to fifteen kilometres over the landing site and climbs back.',
  ],
  'apollo-11': [
    'Apollo 10 came home. Everything but the landing has now been done.',
    "Apollo 11 lands. The lander's computer has never flown a landing, and nobody has ever flown the last hundred feet over the Moon except in the simulator and on the training vehicle that nearly killed its pilot in 1968.",
    "Kennedy's decade has five months to run. Every slip is reported to Washington.",
  ],
  'apollo-12': [
    'Apollo 11 came home in July. The landing has been done: the next ones are for the science, and for landing where you mean to.',
    'Apollo 12 is to land beside Surveyor 3, a robot lander that came down in the Ocean of Storms in April 1967, and bring pieces of it home.',
  ],
  'apollo-15': [
    "Apollo 13, in April 1970: an oxygen tank in the service module failed on the way out, and the crew came home round the Moon in the lander, cold and short of water. The tank's heater switches had been welded shut when it was boiled dry on the pad.",
    'Apollo 14, in February 1971, landed at Fra Mauro, where Apollo 13 had been going.',
    'Apollo 15 is the first of the long expeditions: three days on the Moon, a lander stretched to carry more, and an electric car folded on its side. Apollo 18, 19 and 20 have already been cancelled.',
  ],
  'ranger-7': [
    'That was the last of the Juno II lunar probes. In September 1959 Luna 2 hit the Moon; in October Luna 3 photographed its far side.',
    "In April 1961 Yuri Gagarin orbited the Earth, and in May Alan Shepard flew from the Cape. On 25 May President Kennedy asked Congress to land a man on the Moon before the decade was out. Apollo needs to know what the Moon's surface is like.",
    "JPL's Ranger was meant to find out, and six Rangers failed. Rangers 1 and 2, in 1961, were left in low orbit when the Agena did not restart. Ranger 3 missed the Moon. Ranger 4 hit the far side, dead. Ranger 5 lost its power and missed. In February 1964 Ranger 6 hit the Sea of Tranquility on time, and its cameras never came on.",
    'Congress has held hearings. The papers call Ranger a shoot-and-hope programme. Every day this round slips is reported to Washington.',
  ],
};

// The second offer, after Pioneer 4: NASA's Space Task Group is staffing Mercury Control for the manned flights.
export const NASA_OFFER = {
  seat: 'retro',
  path: 'nasa',
  title: 'Retrofire officer, Mercury Control',
  from: 'ellis',
  text: "The Space Task Group is staffing Mercury Control for the manned flights, and they asked JPL for people who have run a count. I gave them your name. You'd be the Retrofire officer: when the capsule comes down, and where. I'd hate to lose you, and you should go.",
  sidelined:
    "NASA's Space Task Group asked for people to staff Mercury Control. I couldn't put your name forward this time. There will be other chances.",
  again: 'NASA are asking again for Mercury Control.',
  takeNote:
    'From now on you sit at a console in Mercury Control: the go/no-go polls, the trajectory plot, and where the capsule comes down.',
  declineNote: 'You stay at JPL, on the lunar probes.',
};

// The test conductor's offer, made at a turning point (Bumper 5, and again after the Aerobee rounds if you are still a
// junior engineer). Aerobee: the sounding rocket Aerojet
// built from the WAC's lessons, first flown at White Sands in November 1947.
export const FIRST_OFFER = {
  seat: 'test-conductor',
  title: 'Test conductor, Aerobee firings',
  from: 'ellis',
  text: "Aerojet and the Navy are short of a test conductor for their Aerobee firings here. You'd plan the tests, run the whole count and chair the reviews. I told them you were ready.",
  sidelined:
    "Aerojet wanted a test conductor for their Aerobee firings. They asked me about you, and I couldn't say you were ready. Keep at it and they'll ask again.",
  again:
    "Aerojet are asking again. They still need a test conductor for the Aerobee firings, and after this year I can tell them you're ready.",
  takeNote: 'Take it and you plan the rounds, run the count and chair the reviews from now on.',
  declineNote: 'Turn it down and you keep your seat; they may ask again.',
};
// The third, after the first American in space: the Mercury project office wants an engineer for the orbital capsules.
export const ENGINEER_OFFER = {
  seat: 'engineer',
  title: 'Project engineer, Mercury capsules',
  from: 'hollis',
  text: "The project office wants an engineer on the orbital capsules: checkout in Hangar S, the qualification tests, and someone to tell me straight what the hardware will do. They asked for you. I'd keep you on the console if I could, but it's your call.",
  sidelined: "The project office was looking for a capsule engineer. I didn't send your name this time.",
  again: 'The project office is asking for you again.',
  takeNote:
    'From now on you check the capsules out in Hangar S and run their qualification tests. On flight day you sit in the back room and answer for the hardware; Bill Tate takes the Retrofire console.',
  declineNote: 'You stay the Retrofire officer.',
};

// The fourth, at the end of Mercury: Houston needs flight directors for Gemini.
export const FD_OFFER = {
  seat: 'flight',
  title: 'Flight director, Gemini',
  from: 'hollis',
  text: "Mercury's done, and Houston needs flight directors for Gemini: three shifts, days at a time, and the call on everything on your shift. I'm going upstairs to run flight operations. I want you on one of those shifts.",
  sidelined: "Houston named its Gemini flight directors. Your name wasn't on my list this time.",
  again: 'Houston needs another flight director.',
  takeNote:
    "From now on you run a shift in Mission Control, Houston: the polls, the holds, the aborts and the mission rules. When a sick spacecraft stays up, it's your call.",
  declineNote: 'You keep your seat for Gemini; another flight director has the room.',
};

// Parked (Aaron, 8 November 2026): the game is the Flight Director's for now, so no round makes this offer. It stays for
// the management side, which Aaron is designing; older saves holding this seat move to the flight director's shift.
// It was the fifth, at the end of Gemini: Apollo's hardware is late and over weight, and the programme office needs people.
export const PROGRAMME_OFFER = {
  seat: 'programme',
  title: 'Apollo programme office',
  from: 'hollis',
  text: "Apollo's spacecraft are late and the lander's over weight. The programme office wants people who've flown these things to run the schedule: the test stands, the pads, the suppliers. They asked for you. You'd be off the console for good.",
  sidelined: "The Apollo programme office was hiring. Your name didn't go to them this time.",
  again: 'The Apollo programme office is asking for you again.',
  takeNote:
    "From now on you run Apollo's schedule: the hardware, its tests and its suppliers, and the reviews. On flight day you watch from the viewing room, and the calls that are the programme's are yours.",
  declineNote: 'You keep your seat and fly Apollo from the console.',
};

// There is no offer at the end of Apollo: from the Houston shift onward the player stays a flight director
// (Aaron, 8 November 2026), and the campaign runs on to 2030 with no further promotion.

// The way back from the uncrewed years: after Ranger 7, Houston staffs Gemini and asks JPL for its range man. Always
// made: it is the branch's last round, and a sidelined player must have the chance C1 promised.
export const GEMINI_OFFER = {
  seat: 'flight',
  title: 'Flight director, Gemini',
  from: 'ellis',
  text: 'Houston is staffing Gemini, and they want people who have run rounds from the ground. You know the range: the counts, the slips, and what a fault looks like from the blockhouse. I put your name forward for a flight-director shift. It means leaving JPL.',
  sidelined: 'Houston staffed Gemini from the Mercury cadre. There was no room for a JPL man this time.',
  again: 'Houston asks again: they still want you on a Gemini shift.',
  takeNote:
    "From now on you run a shift in Mission Control, Houston: the polls, the holds, the aborts and the mission rules. When a sick spacecraft stays up, it's your call.",
  declineNote: 'You keep your seat at JPL. The uncrewed years carry on without you.',
  path: 'nasa',
  always: true,
};

// Which offer a turning point brings: turningPoint true is the test conductor's, 'nasa' is Mercury Control's, 'engineer'
// the Mercury project office's, 'gemini' Houston's way back from the uncrewed years.
export const offerFor = turningPoint =>
  ({
    nasa: NASA_OFFER,
    engineer: ENGINEER_OFFER,
    flight: FD_OFFER,
    programme: PROGRAMME_OFFER,
    gemini: GEMINI_OFFER,
  })[turningPoint] || FIRST_OFFER;
// The offer behind an entry in your record, by the seat it offered.
export const offerBySeat = seat =>
  [NASA_OFFER, ENGINEER_OFFER, FD_OFFER, PROGRAMME_OFFER, FIRST_OFFER].find(o => o.seat === seat) || FIRST_OFFER;
