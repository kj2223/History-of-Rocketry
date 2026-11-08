// THE OTHER SIDE: the Soviet programme from 1966, as Houston heard of it. No DOM, no drawing.
// Before 1966 the Soviet firsts are fixed history (told in the between-round notes). From 1966 each Soviet attempt is
// decided by its own seeded draw, so the race can go differently from one game to the next: a Soyuz can fly clean or
// kill its pilot, a Zond can carry men round the Moon before Apollo 8, an N1 can fly. Dates slip when an attempt before
// them fails. What Houston hears is not the truth: TASS announces the successes and is silent about the failures, and
// the intelligence reports that reach you are sometimes wrong.
import { newStreams, draw } from '../core/rng.js';
import { dayOf } from '../core/calendar.js';

// Each attempt: when it was planned, the chance it works, what follows if it works or fails, and how long a failure
// sets the next attempt in its line back (days). line: attempts in the same line wait for the one before.
export const ATTEMPTS = [
  {
    id: 'luna9',
    line: 'luna',
    at: dayOf(1966, 2, 3),
    p: 0.7,
    slip: 120,
    win: 'Luna 9 has landed softly on the Ocean of Storms and sent back pictures of the surface: the ground holds up a spacecraft.',
    lose: 'A Soviet probe was launched toward the Moon and has not been heard of since.',
  },
  {
    id: 'soyuz1',
    line: 'soyuz',
    at: dayOf(1967, 4, 23),
    p: 0.45,
    slip: 540,
    crewed: true,
    win: 'Soyuz 1 and Soyuz 2 have docked in orbit and two cosmonauts have crossed between them on a spacewalk.',
    lose: 'Soyuz 1 came down with its parachute tangled. Its pilot, Vladimir Komarov, was killed. The Soviet crewed flights stop while they find out why.',
  },
  {
    id: 'zond-crewed',
    line: 'zond',
    at: dayOf(1968, 12, 8),
    p: 0.25,
    slip: 200,
    crewed: true,
    needs: 'soyuz1',
    win: 'TASS: a Zond spacecraft has carried two cosmonauts round the Moon and home. The first men to see the far side are Russian.',
    lose: 'A Soviet launch from Baikonur in early December went badly. The Zond programme has not flown men.',
  },
  {
    id: 'n1-1',
    line: 'n1',
    at: dayOf(1969, 2, 21),
    p: 0.2,
    slip: 150,
    win: 'Satellite photographs show a giant Soviet booster has flown from Baikonur and put its payload toward the Moon.',
    lose: 'A giant Soviet booster blew up a minute after launch from Baikonur, by the satellite photographs.',
  },
  {
    id: 'luna15',
    line: 'luna',
    at: dayOf(1969, 7, 13),
    p: 0.35,
    slip: 300,
    win: 'Luna 16 landed on the Sea of Fertility, drilled up a core of Moon rock and brought it back to Earth.',
    lose: 'Luna 15, a robot sent to bring back Moon rock, crashed into the Sea of Crises.',
  },
  {
    id: 'n1-2',
    line: 'n1',
    at: dayOf(1969, 7, 3),
    p: 0.25,
    slip: 700,
    win: 'A second giant Soviet booster has flown. The CIA believes a crewed Soviet lander is a year away.',
    lose: 'The second giant Soviet booster fell back on its pad and destroyed it. The CIA thinks the Soviet Moon landing is years off.',
  },
  {
    id: 'lander',
    line: 'lander',
    at: dayOf(1970, 9, 1),
    p: 0.5,
    slip: 400,
    crewed: true,
    needs: 'n1-2',
    win: 'TASS: a Soviet cosmonaut has walked on the Moon.',
    lose: 'A Soviet flight to the Moon has been lost with its crew, by the intelligence reports. TASS says nothing.',
  },
];
// The race is told from here on; before it, the between-round notes tell the fixed history.
export const RACE_FROM = dayOf(1966, 1, 1);
// How often the intelligence that reaches Houston gets a Soviet result wrong (a failure reported as rumoured success).
export const INTEL_WRONG = 0.15;

// The race in this game, decided once from the game's seed: which attempts happened, when, and how they went.
export function raceOf(seed) {
  const s = newStreams((seed ^ 0x51ed270b) >>> 0).forecast;
  const done = {},
    out = [],
    lineSlip = {};
  for (const a of ATTEMPTS) {
    const ok = draw(s),
      wrong = draw(s);
    if (a.needs && !done[a.needs]) continue; // the line it waits for never got there
    const at = a.at + (lineSlip[a.line] || 0);
    const win = ok < a.p;
    if (win) done[a.id] = true;
    else lineSlip[a.line] = (lineSlip[a.line] || 0) + a.slip;
    out.push({
      id: a.id,
      at,
      win,
      crewed: !!a.crewed,
      text: win ? a.win : a.lose,
      rumour: !win && wrong < INTEL_WRONG,
    });
  }
  return out.sort((x, y) => x.at - y.at);
}

// Skylab's launch, 14 May 1973: whether the workshop's micrometeoroid shield is torn away on the climb and one solar
// wing jams against the hull. The hidden layer's, from the game's seed; never a script.
export function skylabShield(seed) {
  const s = newStreams((seed ^ 0x5b1af3e7) >>> 0).forecast;
  return draw(s) < 0.6;
}

// Apollo 1's plugs-out test, January 1967: whether the chafed wiring sparks in the pure-oxygen cabin. Seeded from the
// game, like the Soviet attempts: the programme's cabin hazard at that time, never a script.
export function apolloFire(seed, programme) {
  const s = newStreams((seed ^ 0x2a7f4c19) >>> 0).forecast;
  return draw(s) < Math.min(0.9, (programme.cabinRisk ?? 0.15) * 3.5);
}

// What reached Houston between two days: the lines for the "while you were away" notes.
export function raceNews(seed, from, to) {
  return raceOf(seed)
    .filter(e => e.at > from && e.at <= to)
    .map(e =>
      e.rumour
        ? `A rumour from the intelligence reports, never confirmed: a Soviet flight has done something big. ${e.text.split('.')[0]}? Nobody in Houston can say.`
        : e.text,
    );
}
// Whether Houston has heard of a line's attempts by a day: 'zond' rumours before the flight, say. A planned attempt is
// known to the intelligence about four months ahead.
export const raceHeard = (seed, line, day) =>
  raceOf(seed).some(e => ATTEMPTS.find(a => a.id === e.id).line === line && e.at - 120 <= day);
// Whether the Soviets have done a thing by a day: 'zond-crewed' (men round the Moon) or 'lander' (a man on the Moon).
export const sovietHas = (seed, id, day) => raceOf(seed).some(e => e.id === id && e.win && e.at <= day);
