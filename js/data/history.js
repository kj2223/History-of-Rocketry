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
  { id: 'f_mach', name: 'First American-built rocket past 1,000 m/s', cash: 6000, reputation: 2, test: c => c.ok && c.spd >= 1000 },
  { id: 'f_space', name: 'First American-built rocket into space (100 km)', cash: 20000, reputation: 6, test: c => c.ok && c.peak >= 100000, rivalEvent: 'r_space' },
  { id: 'f_rec', name: 'First payload recovered from an American-built rocket', cash: 5000, reputation: 2, test: c => c.rec },
  { id: 'f_cosm', name: 'First cosmic-ray data from an American-built rocket above 50 km', cash: 8000, reputation: 2, test: c => c.pay == 'Cosmic-Ray Package' && c.got > 0 && c.peak >= 50000 },
  { id: 'f_photo', name: 'First photograph from 100 km on an American-built rocket', cash: 15000, reputation: 4, test: c => c.pay == 'Film Camera' && c.rec && c.peak >= 100000 },
  { id: 'f_bio', name: 'First animal recovered alive from 70 km', cash: 15000, reputation: 6, test: c => c.pay == 'Primate Capsule' && c.rec && c.peak >= 70000, rivalEvent: 'r_dog' },
  { id: 'f_stage', name: 'First successful multi-stage flight', cash: 10000, reputation: 3, test: c => c.ok && c.staged },
  { id: 'f_range', name: 'First flight 300 km downrange', cash: 8000, reputation: 2, test: c => c.ok && c.dr >= 300000 },
  { id: 'f_orbit', name: 'First artificial satellite', cash: 0, reputation: 0, test: c => c.why == 'orbit', rivalEvent: 'r_sat' },
  { id: 'f_human', name: 'First human in space', cash: 0, reputation: 0, test: c => !!c.human, rivalEvent: 'r_gagarin' },
  { id: 'f_day', name: 'First day in orbit', cash: 40000, reputation: 6, test: c => !!c.dayInOrbit, rivalEvent: 'r_titov' },
  { id: 'f_crew2', name: 'First crew of more than one in orbit', cash: 40000, reputation: 6, test: c => !!c.crew2, rivalEvent: 'r_voskhod' },
  { id: 'f_eva', name: 'First spacewalk', cash: 50000, reputation: 8, test: c => !!c.eva, rivalEvent: 'r_leonov' },
  { id: 'f_rdv', name: 'First rendezvous in orbit', cash: 40000, reputation: 6, test: c => !!c.rendezvous },
  { id: 'f_dock', name: 'First docking in orbit', cash: 50000, reputation: 8, test: c => !!c.dock, rivalEvent: 'r_kosmos' },
];
// When the real US programme did each first, for the end-of-phase comparison. The captured German V-2s at White Sands did several
// of them first; those firsts are for American-built rockets in the game (the V-2s fly beside you, rules/neighbours.js), so the
// comparison names the V-2 date as well.
export const HISTORICAL_US_FIRSTS = {
  f_50: 'Oct 1945, WAC Corporal', f_mach: 'Captured V-2 first, Apr 1946', f_space: 'Mar 1948, Aerobee A5 at 117 km (a captured V-2 first, May 1946)',
  f_rec: 'Captured V-2 first, Oct 1946 (film canister)', f_cosm: 'Captured V-2 first, 1946 (cosmic-ray counters)',
  f_photo: 'Captured V-2 first, Oct 1946 (camera at 105 km)', f_bio: 'Sep 1951, Aerobee at 72 km (monkey Yorick and eleven mice)',
  f_stage: 'Feb 1949, Bumper-WAC', f_range: 'Jul 1950, Bumper-WAC from Cape Canaveral', f_orbit: 'Jan 1958, Explorer 1',
  f_human: 'May 1961, Freedom 7 (Vostok 1 had flown in April)', f_day: 'May 1963, Faith 7 (Vostok 2 had flown in August 1961)',
  f_crew2: 'Mar 1965, Gemini 3 (Voskhod 1 had flown three in October 1964)', f_eva: 'Jun 1965, Ed White on Gemini 4 (Leonov had walked in March)',
  f_rdv: 'Dec 1965, Gemini 6A and Gemini 7', f_dock: 'Mar 1966, Gemini 8 with an Agena',
};

// THE CAPTURED V-2s (rules/neighbours.js): the Army flew about sixty German V-2s at White Sands from April 1946 to September 1952,
// with the scientists' instruments in the nose. They fly beside you on the range, on the Army's schedule: about a third failed, and
// the best climbed to 187 km. They never claim your firsts (those are for American-built rockets).
//   start, end: game days of the first and last launch; every: days between launches (each jittered by up to a third);
//   ok: chance a flight goes well; peak: the range of a good flight's peak (km); record: the highest a V-2 can climb (km).
export const V2_PROGRAMME = { start: 105, end: 2419, every: 39, ok: .7, peak: [80, 170], record: 187 };
// What a failed V-2 did, one picked at random (the Army's records of the real failures).
export const V2_FAILURES = ['lost a fin and tumbled', 'went off course and was destroyed by the range safety officer', 'cut off early in a guidance fault', 'broke up in the thin upper air', 'burned through its steam turbine'];

// RIDE-ALONGS (rules/neighbours.js): the V-2 Panel sells nose space on the next Army V-2 to anyone with instruments ready. You pay
// for the payload and the panel's fee; a good flight sends back a share of the payload's science (it shares the nose and the
// telemetry), and the instruments teach your team. A failed V-2 loses the payload. Film has to come down in one piece: a good
// flight still recovers it only RIDE_FILM_RECOVERY of the time. Payloads: those with science, no animals, no satellites.
export const RIDE_FEE = 1500;
export const RIDE_SHARE = .5;
export const RIDE_FILM_RECOVERY = .6;
export const RIDE_PAYLOADS = ['Sensor Suite', 'Cosmic-Ray Package', 'Film Camera'];
// BUMPER: your WAC Corporal on top of a V-2, the first American two-stage rocket. Offered once the WAC Corporal has flown
// BUMPER_OFFER.proven good flights, from BUMPER_OFFER.day (May 1948) while the V-2s still fly. It takes over the next
// BUMPER_FLIGHTS V-2 launches, each costing BUMPER_COST (a WAC Corporal and the integration work), paid when it flies (a flight
// waits a slot if the treasury is short). The upper stage separates with a chance that grows with your staging knowledge; the
// last two fly from the new Florida range, long and low. Bumper flights count for the multi-stage and downrange firsts, never
// for your altitude records or directives (most of the climb is the V-2's).
export const BUMPER_OFFER = { proven: 3, day: 840 };
export const BUMPER_FLIGHTS = 6;
export const BUMPER_COST = 8000;
export const BUMPER_SEPARATION = { base: .55, knowledge: .35 };
export const BUMPER_PEAK = [250, 400];
export const BUMPER_DOWNRANGE = [300, 400];
export const BUMPER_FLORIDA = 2;

// THE CORPORAL CONTRACT (rules/corporal.js): the Army's guided missile, which the same people who built the WAC Corporal developed
// at the same time. Offered once you could hand routine flying to a launch director (three good Aerobee flights). It takes one
// engineering team for each milestone in turn and pays when each is done; a milestone finished after its due date pays LATE_SHARE.
// Each milestone teaches your own rockets a little (learn: { area: points }, for the rocket in focus).
//   seconds: team time it takes; due: game days after you accept by which it should be done; pay ($)
export const CORPORAL_MILESTONES = [
  { name: 'Static firings of the Corporal engine', seconds: 40, due: 200, pay: 15000, learn: { p: 3 } },
  { name: 'Radio-command guidance trials', seconds: 50, due: 400, pay: 20000, learn: { i: 3 } },
  { name: 'First guided Corporal flight', seconds: 60, due: 620, pay: 25000, learn: { s: 1.5, a: 1.5 } },
  { name: 'Accuracy trials for the Army', seconds: 60, due: 840, pay: 30000, learn: { i: 3 } },
];
export const CORPORAL_LATE_SHARE = .5;
// When the Army's next missile comes to you (the Redstone programme), a finished Corporal brings an Army development payment.
export const CORPORAL_REDSTONE_PAYMENT = 20000;

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
  { id: 'r_kosmos', day: 7859, wire: 'Kosmos 186 and Kosmos 188, two uncrewed Soviet spacecraft, find each other and dock automatically.', short: 'a docking in orbit' },
];

// CALENDAR SPEED: game days per real second. Tuned so a typical first playthrough reaches orbit around early 1958.
export const DAYS_PER_SECOND = 1.4;
export const DAYS_PER_SECOND_PHASE_TWO = .45; // Phase Two runs the calendar about three times slower: more happens in each year.
export const NASA_DAY = 4590; // October 1958: NASA opens its doors
