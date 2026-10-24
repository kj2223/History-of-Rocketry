// HISTORY AND THE CALENDAR: Phase One directives, eras, historical firsts, the Soviet timeline and calendar speed.
// Game days run from 1 Jan 1946 in 360-day years (30-day months), so day 4230 is October 1957.

// Phase One directives, in order. altitudeKm 120 is the satellite directive: it needs orbit, not just height.
export const DIRECTIVES = [
  { name: 'Sub-Orbital Hop', altitudeKm: 3, reward: 15000 },
  { name: 'Lower Atmosphere', altitudeKm: 15, reward: 35000 },
  { name: 'Upper Stratosphere', altitudeKm: 35, reward: 60000 },
  { name: 'Mesosphere Frontier', altitudeKm: 65, reward: 100000 },
  { name: 'First Artificial Satellite', altitudeKm: 120, reward: 250000 },
];
// The news line shown with each directive (one per directive).
export const DIRECTIVE_NEWS = [
  'Defense officials want sounding data to calibrate radar grids.',
  'Congress asks for atmospheric density figures before funding larger boosters.',
  'Papers speculate about rockets that climb above the weather.',
  'Rivals abroad are testing larger engines. Prestige is now policy.',
  'The White House backs an orbital satellite. The world is watching.',
];
// Eras set the look of the page. The era changes at directive 2 and directive 4 (rules/design.js, era()).
export const ERAS = [
  { name: 'SOUNDING ROCKET ERA', tagline: 'Radar plots, a radio beacon and slide rules.' },
  { name: 'MISSILE & STAGING AGE', tagline: 'Telemetry, test data and talk of stacking stages.' },
  { name: 'THE SATELLITE RACE', tagline: 'Orbit or bust. Every headline is a scoreboard.' },
];

// HISTORICAL FIRSTS. cash and reputation are paid to whoever gets there first (40% and a third for matching a Soviet first).
// test(c) reads the flight's outcome (rules/flight.js). rivalEvent: the Soviet event that can claim it first, if any.
export const FIRSTS = [
  { id: 'f_50', name: 'First rocket above 50 km', cash: 8000, reputation: 2, test: c => c.ok && c.peak >= 50000 },
  { id: 'f_mach', name: 'First flight past 1,000 m/s', cash: 6000, reputation: 2, test: c => c.ok && c.spd >= 1000 },
  { id: 'f_space', name: 'First American rocket into space (100 km)', cash: 20000, reputation: 6, test: c => c.ok && c.peak >= 100000, rivalEvent: 'r_space' },
  { id: 'f_rec', name: 'First payload recovered from flight', cash: 5000, reputation: 2, test: c => c.rec },
  { id: 'f_cosm', name: 'First cosmic-ray data from above 50 km', cash: 8000, reputation: 2, test: c => c.pay == 'Cosmic-Ray Package' && c.got > 0 && c.peak >= 50000 },
  { id: 'f_photo', name: 'First photograph from 100 km', cash: 15000, reputation: 4, test: c => c.pay == 'Film Camera' && c.rec && c.peak >= 100000 },
  { id: 'f_bio', name: 'First animal recovered alive from 80 km', cash: 15000, reputation: 6, test: c => c.pay == 'Primate Capsule' && c.rec && c.peak >= 80000, rivalEvent: 'r_dog' },
  { id: 'f_stage', name: 'First successful multi-stage flight', cash: 10000, reputation: 3, test: c => c.ok && c.staged },
  { id: 'f_range', name: 'First flight 300 km downrange', cash: 8000, reputation: 2, test: c => c.ok && c.dr >= 300000 },
  { id: 'f_orbit', name: 'First artificial satellite', cash: 0, reputation: 0, test: c => c.why == 'orbit', rivalEvent: 'r_sat' },
  { id: 'f_human', name: 'First human in space', cash: 0, reputation: 0, test: c => !!c.human, rivalEvent: 'r_gagarin' },
  { id: 'f_day', name: 'First day in orbit', cash: 40000, reputation: 6, test: c => !!c.dayInOrbit, rivalEvent: 'r_titov' },
  { id: 'f_crew2', name: 'First crew of more than one in orbit', cash: 40000, reputation: 6, test: c => !!c.crew2, rivalEvent: 'r_voskhod' },
  { id: 'f_eva', name: 'First spacewalk', cash: 50000, reputation: 8, test: c => !!c.eva, rivalEvent: 'r_leonov' },
];
// When the real US programme did each first, for the end-of-phase comparison.
export const HISTORICAL_US_FIRSTS = {
  f_50: 'Oct 1945, WAC Corporal', f_mach: 'Apr 1946, captured V-2', f_space: 'May 1946, V-2 at White Sands', f_rec: 'Oct 1946, V-2 film canister',
  f_cosm: '1946, V-2 cosmic-ray counters', f_photo: 'Oct 1946, V-2 camera at 105 km', f_bio: 'Sep 1951, Aerobee (monkey Yorick)',
  f_stage: 'Feb 1949, Bumper-WAC', f_range: 'Jul 1950, Bumper-WAC from Cape Canaveral', f_orbit: 'Jan 1958, Explorer 1',
  f_human: 'May 1961, Freedom 7 (Vostok 1 had flown in April)', f_day: 'May 1963, Faith 7 (Vostok 2 had flown in August 1961)',
  f_crew2: 'Mar 1965, Gemini 3 (Voskhod 1 had flown three in October 1964)', f_eva: 'Jun 1965, Ed White on Gemini 4 (Leonov had walked in March)',
};

// THE SOVIET PROGRAMME. Each event lands on its historical day, jittered by about 5% each game (core/state.js).
// wire: the news report. short: how intelligence estimates describe it.
export const RIVAL = [
  { id: 'r_space', day: 1860, wire: 'Soviet geophysical rockets climb above 100 km.', short: 'rockets above 100 km' },
  { id: 'r_dog', day: 1980, wire: 'Soviet dogs Dezik and Tsygan return alive from a rocket flight to 100 km.', short: 'an animal flight to space altitude' },
  { id: 'r_icbm', day: 4170, wire: 'The Soviet Union announces a successful intercontinental ballistic missile test. Congress is alarmed.', short: 'an ICBM test' },
  { id: 'r_sat', day: 4230, wire: 'SPUTNIK. The Soviet Union has placed the first artificial satellite in orbit.', short: 'an artificial satellite' },
  { id: 'r_luna2', day: 4934, wire: 'Luna 2 strikes the Moon: the first object from Earth to reach another world.', short: 'a probe reaching the Moon' },
  { id: 'r_luna3', day: 4957, wire: 'Luna 3 photographs the far side of the Moon.', short: 'photographs of the lunar far side' },
  { id: 'r_belka', day: 5269, wire: 'Korabl-Sputnik 2: the dogs Belka and Strelka orbit the Earth for a day and are recovered alive.', short: 'animals orbited and recovered' },
  { id: 'r_gagarin', day: 5502, wire: 'VOSTOK 1. A Soviet cosmonaut has orbited the Earth and returned alive: the first human in space.', short: 'a crewed spaceflight' },
];
// Section 2 of Phase Two. Their dates are set when Section 2 opens, shifted by however early or late Vostok 1 flew (rules/race.js).
export const RIVAL_SECTION_TWO = [
  { id: 'r_titov', day: 5616, wire: 'VOSTOK 2. A second cosmonaut orbits the Earth seventeen times and spends a whole day in space.', short: 'a day in orbit' },
  { id: 'r_group', day: 5981, wire: 'Vostok 3 and Vostok 4 fly in orbit at the same time, passing within a few kilometres of each other.', short: 'two spacecraft in orbit at once' },
  { id: 'r_woman', day: 6286, wire: 'VOSTOK 6. Valentina Tereshkova is the first woman in space: 48 orbits in three days.', short: 'a three-day flight' },
  { id: 'r_voskhod', day: 6761, wire: 'VOSKHOD 1. Three cosmonauts orbit the Earth together, without spacesuits, in one spacecraft.', short: 'a crew of several in orbit' },
  { id: 'r_leonov', day: 6917, wire: 'VOSKHOD 2. Alexei Leonov leaves his spacecraft and floats in space for twelve minutes: the first spacewalk.', short: 'a spacewalk' },
];

// CALENDAR SPEED: game days per real second. Tuned so a typical first playthrough reaches orbit around early 1958.
export const DAYS_PER_SECOND = 1.4;
export const DAYS_PER_SECOND_PHASE_TWO = .45; // Phase Two runs the calendar about three times slower: more happens in each year.
export const NASA_DAY = 4590; // October 1958: NASA opens its doors
