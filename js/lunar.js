// A LUNAR SHOT AFTER THE CAPE: the cruise and the encounter, followed from JPL. The launch is played at the Cape like any
// round; once she is away the day ends, and the next mornings follow her out on the tracking (the cruise), then in to the
// Moon (the encounter). What the player sees is in g.lunar, copied from what the tracking stations report; the truth of
// where she is really going is in truth/lunar.js.
import { g, setBeat, say, note, roomChanged, registerCrewed } from './game.js';
import {
  firstFix,
  midcourse,
  finalFix,
  encounter,
  fallBack,
  distanceAt,
  CRUISE_HOURS,
  FIRST_FIX,
  SECOND_FIX,
  MOON_RADIUS,
  LATE_REACH,
  FALL_PEAK_HOUR,
  FIX_ERROR,
} from './truth/lunar.js';
export { CAMERA_LEADS, MOON_KM, MOON_RADIUS, LATE_REACH, FIRST_FIX, SECOND_FIX, FIX_ERROR } from './truth/lunar.js';

// Cruise hours a real second at 1x, and encounter minutes a real second.
const HOURS_A_SECOND = 1.5,
  MINUTES_A_SECOND = 4;
const fmt = n => Math.round(n).toLocaleString('en-US');
const km100 = n => (n < 100 ? 'less than 100' : fmt(Math.round(n / 100) * 100)),
  km1000 = n => fmt(Math.round(n / 1000) * 1000);
const deep = () => g.round.flight.deep;

// Which station has her at hour h: the Cape's down-range stations first, then the deep-space dishes as the Earth turns.
const STATIONS = {
  juno: ['Mayaguez', 'Goldstone', 'Goldstone', 'JPL Pasadena'],
  ranger: ['Johannesburg', 'Woomera', 'Goldstone'],
};
export function stationAt(vehicle, h) {
  if (h < 2) return vehicle === 'juno' ? 'Cape and Mayaguez' : 'Cape and Antigua';
  const list = STATIONS[vehicle];
  return list[Math.floor((h - 2) / 8) % list.length];
}

function log(text, tone = '', who = 'morgan') {
  const L = g.lunar;
  L.log.push({ at: L.phase === 'cruise' ? `${Math.floor(L.h)} h` : `${Math.ceil(L.minutes)} min`, text, tone });
  if (L.log.length > 14) L.log.shift();
  say(who, text, tone, 6);
  note(
    `${L.phase === 'cruise' ? `Cruise, hour ${Math.floor(L.h)}` : `Encounter, ${Math.ceil(L.minutes)} minutes out`}: ${text}`,
  );
  roomChanged();
}

export const LUNAR_BEATS = {
  lLaunched() {
    g.objective =
      'She is on her way to the Moon, and JPL has the tracking from here. End the day: tomorrow you follow her out.';
    g.dayDone = true;
    say('morgan', "She's off our plot. JPL will have the first tracking by morning.", 'go', 7);
  },
  lCruise() {
    const d = deep();
    g.lunar = {
      phase: 'cruise',
      vehicle: d.vehicle,
      h: 0,
      total: d.fallsBack ? 2 * FALL_PEAK_HOUR : CRUISE_HOURS[d.vehicle],
      dist: 0,
      trail: [0],
      station: stationAt(d.vehicle, 0),
      log: [],
      poll: null,
      seen: {},
      falls: false,
      fix: null,
      predicted: null,
      midcourse: null,
      endWait: 0,
    };
    g.objective = 'The tracking reports come in on the teletype in the technical office. Go and follow her out.';
    say('morgan', 'JPL is on the line. The tracking will come in to the technical office.', '', 6);
  },
  lCruised() {
    g.objective = 'She is nearly at the Moon. End the day: tomorrow is the encounter.';
    g.dayDone = true;
  },
  lEncounter() {
    const d = deep();
    g.lunar = {
      phase: 'encounter',
      vehicle: d.vehicle,
      minutes: 60,
      log: [],
      poll: d.vehicle === 'ranger' ? 'lead' : null,
      lead: null,
      predicted: d.predicted,
      video: null,
      pictures: 0,
      picturesTotal: 0,
      outcome: null,
      endWait: 0,
    };
    g.objective =
      d.vehicle === 'ranger'
        ? 'Encounter day. Go to the technical office: Goldstone has her coming in, and the cameras are your call.'
        : 'Encounter day. Go to the technical office: Goldstone has her coming up on the Moon.';
  },
};

export const lunarRoom = () =>
  g.lunar && ['cruise', 'encounter'].includes(g.lunar.phase) && ['lCruise', 'lEncounter'].includes(g.beat)
    ? g.lunar.phase
    : null;

// ---- The player's calls ----
// The midcourse: burn on the first fix, or wait for the second.
export function lunarMidcourse(when) {
  const L = g.lunar;
  if (!L || L.poll !== 'midcourse') return;
  L.poll = null;
  if (when === 'now') {
    midcourse(g.round, 'now');
    L.midcourse = { when: 'now', at: L.h };
    log('Midcourse burn on the first fix. The motor fired and shut down on time.', 'go');
  } else {
    L.midcourse = { when: 'wait', at: SECOND_FIX };
    log(`Holding the midcourse for the ${SECOND_FIX}-hour fix.`);
  }
}
// The cameras: how many minutes before impact they go on.
export function lunarLead(minutes) {
  const L = g.lunar;
  if (!L || L.poll !== 'lead') return;
  L.poll = null;
  L.lead = minutes;
  log(`Cameras to come on ${minutes} minutes before impact.`, '', 'you');
}

// ---- The tick ----
export function tickLunar(dt) {
  const L = g.lunar;
  if (!L || L.phase === 'done') return;
  if (L.finished) {
    L.endWait += dt;
    if (L.endWait > 3) finish();
    return;
  }
  if (g.room !== L.phase || L.poll) return;
  if (L.phase === 'cruise') tickCruise(dt);
  else tickEncounter(dt);
}

function once(key, fn) {
  const L = g.lunar;
  if (!L.seen[key]) {
    L.seen[key] = true;
    fn();
  }
}

function tickCruise(dt) {
  const L = g.lunar,
    d = deep();
  L.h = Math.min(L.total, L.h + HOURS_A_SECOND * g.speed * dt);
  L.dist = distanceAt(d, L.h);
  if (L.h - (L.trail.length - 1) * 0.5 >= 0.5) L.trail.push(L.dist);
  L.station = stationAt(L.vehicle, L.h);
  const every = Math.floor(L.h / 6);
  if (L.h >= 1)
    once('injection', () =>
      log(
        d.fallsBack
          ? `${L.station} have her, but she is slower than planned.`
          : `${L.station} have her. Injection looks good.`,
        d.fallsBack ? 'warn' : 'go',
      ),
    );
  if (every >= 1) once(`dist${every}`, () => log(`${L.station} has her about ${km1000(L.dist)} km out.`));
  if (L.vehicle === 'ranger') {
    if (L.h >= FIRST_FIX)
      once('fix1', () => {
        L.fix = Math.abs(firstFix(g.round));
        L.poll = 'midcourse';
        log(
          `First fix from ${L.station}: left alone, she reaches the Moon about ${km100(L.fix)} km from the aim point, give or take ${fmt(FIX_ERROR)} km. Burn now on this fix, or wait for the ${SECOND_FIX}-hour fix?`,
          'warn',
        );
      });
    if (L.midcourse?.when === 'wait' && L.h >= SECOND_FIX)
      once('burn2', () => {
        midcourse(g.round, 'wait');
        log(
          `The ${SECOND_FIX}-hour fix is good. Midcourse burn done: the motor took out all it could, up to ${fmt(LATE_REACH)} km.`,
          'go',
        );
      });
    if (L.midcourse && L.h >= L.midcourse.at + 4)
      once('fix3', () => {
        L.predicted = finalFix(g.round);
        const hit = L.predicted < MOON_RADIUS * 0.85,
          edge = L.predicted < MOON_RADIUS * 1.15;
        log(
          `After the burn, ${L.station} puts her about ${km100(L.predicted)} km from the aim point. The Moon's radius is ${fmt(MOON_RADIUS)} km.${hit ? " She'll hit." : edge ? " It's going to be close." : " She'll miss."}`,
          hit ? 'go' : edge ? 'warn' : 'bad',
        );
      });
  } else if (!d.fallsBack) {
    if (L.h >= 10)
      once('fix', () => {
        L.predicted = finalFix(g.round);
        log(`${L.station}'s fix: she will pass the Moon at about ${km1000(L.predicted)} km.`, 'go');
      });
  } else {
    if (L.h >= 8)
      once('slow', () =>
        log(`${L.station}: she is slowing faster than she should. She won't reach escape speed.`, 'bad'),
      );
    if (L.h >= FALL_PEAK_HOUR)
      once('peak', () => log(`She topped out at about ${km1000(d.peak)} km and is falling back toward Earth.`, 'bad'));
  }
  if (L.h >= L.total) {
    if (d.fallsBack)
      once('fell', () => {
        fallBack(g.round);
        g.round.flight.failAt = Math.round(L.total * 3600);
        L.outcome = d.say;
        log(d.say, 'bad');
        L.finished = true;
      });
    else if (L.vehicle === 'ranger' && !L.midcourse)
      return; // the midcourse call is still open
    else
      once('arrive', () => {
        L.phase = 'arrived';
        g.room = null;
        setBeat('lCruised');
      });
  }
}

function tickEncounter(dt) {
  const L = g.lunar,
    d = deep();
  const before = L.minutes;
  L.minutes = Math.max(0, L.minutes - MINUTES_A_SECOND * g.speed * dt);
  if (L.vehicle === 'ranger') {
    if (L.minutes <= L.lead && before > L.lead) {
      encounter(g.round, L.lead);
      const f = g.round.flight;
      L.picturesTotal = d.pictures;
      L.video = f.failure !== 'camera';
      log(
        f.failure === 'camera'
          ? 'Cameras commanded on... nothing. No video on any channel.'
          : f.failure === 'miss'
            ? 'Cameras on. Video, but the Moon is sliding off the edge of the frame.'
            : 'Cameras on. Video on all six channels!',
        f.failure ? 'bad' : 'go',
      );
    }
    if (L.video && L.lead) L.pictures = Math.round(L.picturesTotal * Math.min(1, (L.lead - L.minutes) / L.lead));
  }
  for (const m of [45, 30, 15, 5]) if (L.minutes <= m && before > m) log(`${m} minutes out. Goldstone has her.`);
  if (L.minutes <= 0) {
    if (L.vehicle === 'juno') encounter(g.round);
    L.outcome = d.say;
    log(d.say, g.round.flight.failure ? 'bad' : 'go');
    L.finished = true;
  }
}

function finish() {
  const L = g.lunar;
  L.phase = 'done';
  g.room = null;
  setBeat('recovery');
}

// Registered with game.js at load, so game.js need not import this file (see registerCrewed there).
registerCrewed(LUNAR_BEATS, { tickLunar, lunarRoom });
