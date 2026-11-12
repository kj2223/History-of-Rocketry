// MERCURY CONTROL: a Mercury flight worked from the Retrofire officer's console, and the training sims. No DOM, no drawing.
// The day before launch is for the simulator; on launch day you give your status in the count, watch the trajectory plot
// and call an abort if she goes off her line, then tell Recovery where to send the helicopters. Afterwards the flight
// director reviews the flight with you, the way Ellis did at White Sands.
//
// The console shows only what Mercury Control could see: the flight-path angle, velocity and acceleration on telemetry,
// the radar's and the computers' impact points, and the recovery board. The truth behind them is in truth/capsule.js.
// What the rooms read is g.console and g.mission, never the round itself.
import {
  g,
  crewOf,
  recordDeaths,
  say,
  note,
  walk,
  place,
  placeName,
  roomChanged,
  morning,
  setBeat,
  finishReview,
  dateText,
  registerCrewed,
  nextIndex as nextIndexFn,
  who as nameOf,
  himOf,
} from './game.js';
import {
  ascent,
  outcome,
  stepAt,
  impactPredictions,
  recoveryHours,
  sinks,
  padCrewNow,
  conditions,
  plannedGamma,
  crewFate,
  PLAN,
  ABORT_LIMIT,
} from './truth/capsule.js';
import {
  atlasAscent,
  atlasOutcome,
  goddard,
  insertion,
  inOrbit,
  fuelAfter,
  retrofire,
  orbitPredictions,
  orbitRecoveryHours,
  orbitGamma,
  plannedBurn,
  ORBIT_PLAN,
  FUEL_LOW,
} from './truth/orbit.js';
import { CREW_TRAITS, consents, ownAbortAt, impatient } from './world/crew.js';
import { ASTRONAUTS } from './data/crew.js';
import { newRound, ellisReading } from './truth/round.js';
import { draw } from './core/rng.js';
import { KITS, SHORT } from './data/kits.js';
import { SEASON } from './data/campaign.js';
import {
  MERCURY_COUNT,
  UNITS,
  SEA_LIMIT,
  TAPES,
  PAD_OPTIONS,
  SIMS,
  SIM_MINUTES,
  ORBIT_UNITS,
  STATIONS,
  PACK_OPTIONS,
  RETRO_OPTIONS,
  ORBIT_TAPES,
  ORBIT_SIMS,
  CAPSULE_SPOTS,
  LOOK_MINUTES,
  QUAL_TESTS,
} from './data/mercury.js';
import { addSim, shiftTrust, TRUST } from './career/record.js';
import { ROUTE_DAY, ROUTE_MODES, ROUTE_ANNOUNCED } from './data/route.js';
import { adopt } from './world/programme.js';
import { dayOf } from './core/calendar.js';
import { raceHeard, skylabShield } from './world/race.js';
import {
  startFlight,
  tickFlight,
  answer,
  flightOf,
  flightIdOf,
  recordCapabilities,
  flightJudgement,
  flightCause,
  passMinutes,
  windowMinutes,
} from './houston.js';
import { flightPredictions, flightRecoveryHours } from './truth/flights.js';
import { GEMINI_TAPES, GEMINI_SIMS, GEMINI_SPOTS, GEMINI_QUALS } from './data/gemini.js';
import { FAULT_AT_SPOT } from './data/kits.js';
import { APOLLO_TAPES, APOLLO_SIMS, APOLLO_SPOTS, APOLLO_QUALS } from './data/apollo.js';

export {
  ABORT_LIMIT,
  PLAN,
  UNITS,
  SEA_LIMIT,
  PAD_OPTIONS,
  SIMS,
  SIM_MINUTES,
  PACK_OPTIONS,
  RETRO_OPTIONS,
  ORBIT_PLAN,
  CAPSULE_SPOTS,
  QUAL_TESTS,
};
export const plannedAngle = plannedGamma;
// The programme this round belongs to: 'mercury', 'gemini' or 'apollo'.
export const programOf = () => (g.crewed && SEASON[g.roundIndex].crewed) || null;
// The spacecraft's spots and qualification tests for the checkout seats, by programme.
export const capsuleSpots = () => ({ gemini: GEMINI_SPOTS, apollo: APOLLO_SPOTS })[programOf()] || CAPSULE_SPOTS;
export const qualTests = () => ({ gemini: GEMINI_QUALS, apollo: APOLLO_QUALS })[programOf()] || QUAL_TESTS;
// The booster's own names for its control failure and its early cutoff, and the tapes and sims that go with it.
const BOOSTERS = {
  atlas: {
    names: { guidance: 'guidance', shortburn: 'shortburn', booster: 'Atlas' },
    tapes: ORBIT_TAPES,
    sims: ORBIT_SIMS,
  },
  titan: {
    names: { guidance: 'titanctl', shortburn: 'stage2', booster: 'Titan II' },
    tapes: GEMINI_TAPES,
    sims: GEMINI_SIMS,
  },
  saturn5: {
    names: { guidance: 'saturnctl', shortburn: 's2cutoff', booster: 'Saturn V' },
    tapes: APOLLO_TAPES,
    sims: APOLLO_SIMS,
  },
  saturnib: {
    names: { guidance: 'saturnctl', shortburn: 's2cutoff', booster: 'Saturn IB' },
    tapes: APOLLO_TAPES,
    sims: APOLLO_SIMS,
  },
  shuttle: {
    names: { guidance: 'computer', shortburn: 'ssme', boost: 'oring', booster: 'Shuttle' },
    tapes: APOLLO_TAPES,
    sims: APOLLO_SIMS,
  },
};
const boosterOf = con => BOOSTERS[con.round.vehicle] || BOOSTERS.atlas;
// The planned flight-path angle at second t, for this console's booster.
export const plannedAngleFor = (con, t) =>
  con.orbital ? orbitGamma(t, plannedBurn(con.round.vehicle)) : plannedGamma(t);
// The plan the console's plot is drawn against: burn time, cutoff velocity and angle.
export const planFor = con => (con.orbital ? { ...ORBIT_PLAN, burn: plannedBurn(con.round.vehicle) } : PLAN);
// Launch is planned the day after the round starts: a sim day, then launch day.
export const LAUNCH_DAY = 1;
// Count seconds per real second in Mercury Control, and flight seconds per real second on the trajectory plot.
const COUNT_RATE = 30,
  ASCENT_RATE = 2,
  COAST_SECONDS = 5,
  ORBIT_RATE = 12;

// ---- The days of a Mercury round ----
export const MERCURY_BEATS = {
  // The day before: the capsule and the booster are on the pad. The sims are open, and the day can end at any time.
  mBrief() {
    seatPeople();
    if (engineer()) return engineerBrief();
    g.rocket.where = 'tower';
    g.rocket.mated = true;
    const launch = dateText(g.roundStart + LAUNCH_DAY);
    if (flightOf()) return houstonBrief(launch);
    const line = pilotId()
      ? `We fly ${pilotName()} on ${launch}. Today you're in the simulator, and so is he: the sim supervisor will throw everything he has at you both. If he has to trust your numbers, they had better be right.`
      : `We fly on ${launch}. Today you're in the simulator: the sim supervisor will throw everything he has at you. Learn the plot, Retro.`;
    if (pilotId()) {
      place('pilot', 1180);
      g.people.pilot.hidden = false;
    }
    say('hollis', line, '', 8);
    note(`${cap(SEASON[g.roundIndex].name)}. ${nameOf('hollis')}: ${line}`);
    g.objective = 'Train in the simulator in the training building. When you have had enough, end the day.';
    g.dayDone = true;
  },
  // Launch day: the recovery area's conditions are what they are this morning.
  mLaunch() {
    seatPeople();
    g.rocket.where = 'tower';
    g.rocket.mated = true;
    if (engineer()) rework();
    g.mission.cond = conditions(g.round);
    g.objective = engineer()
      ? `Launch day. Go to the back room in ${placeName('office')}: ${nameOf('hollis')} will want the hardware answered for.`
      : `Launch day. Go to your console in ${placeName('office')} for the count.`;
    // Suited up in Hangar S, then out to the gantry and up into the capsule.
    if (pilotId()) {
      g.people.pilot.hidden = false;
      place('pilot', 690);
      walk('pilot', 2050);
      say(
        'pilot',
        engineer()
          ? 'Morning. Is she a good one?'
          : flightDirector()
            ? 'Morning, Flight. The crew is ready.'
            : 'Morning, Retro. Get me a good splashdown point.',
        '',
        6,
      );
    }
    if (flightOf())
      say(
        engineer() ? 'hollis' : 'dorsey',
        engineer()
          ? "Morning, Engineering. You're in the back room on the loop. If the spacecraft does anything odd, you answer for it."
          : flightDirector()
            ? "Morning, Flight. The room is yours from the count. I've the night shift."
            : 'Morning, Retro. Get on your console.',
        '',
        6,
      );
    else
      say(
        'hollis',
        engineer()
          ? 'Morning, Engineering. Back room. If the hardware does anything odd, you answer for it.'
          : 'Morning, Retro. Get on your console. We pick up the count at T minus fifteen.',
        '',
        6,
      );
  },
  mFlight() {},
  // The count was scrubbed: the launch is tomorrow, in whatever weather tomorrow brings.
  mScrub() {
    g.objective = 'The launch is scrubbed until tomorrow. End the day when you are ready.';
    g.dayDone = true;
  },
  // The capsule is on the pad on a live booster, left overnight.
  mPadNight() {
    g.objective = 'The capsule sits on the pad overnight while the batteries run down. End the day.';
    g.dayDone = true;
  },
  mPadSafe() {
    seatPeople();
    g.objective = `The pad crew is safing the capsule. Then ${nameOf('hollis')} wants the review in Mercury Control.`;
    say('vega', "Batteries are flat and the oxygen's boiled off. We're going out to her now.", '', 6);
    g.mission.pad = 'safed';
    note(
      'Next morning the pad crew safed the capsule and drained the booster. The capsule and the booster can both fly again.',
    );
    setBeat('mReview');
  },
  // The route-to-the-Moon meeting, a scene after the round whose SEASON entry names it in `after`.
  sRoute() {
    seatPeople();
    g.objective = `The centres are arguing how Apollo goes to the Moon. ${nameOf('hollis')} wants you in the meeting in Mercury Control.`;
    say(
      'hollis',
      "Retro, you're in the meeting this morning. Headquarters wants to know what the flights have taught us about hitting a point from orbit.",
      '',
      8,
    );
  },
  // August 1968: the lander is late, and somebody asks whether the next Saturn V could go round the Moon without it.
  sApollo8() {
    seatPeople();
    g.objective = `${nameOf('hollis')} has called a meeting in Mission Control about the next Apollo flight. Go in.`;
    say('hollis', "Closed door this morning. Nobody outside this room hears what we're about to talk about.", '', 8);
  },
  // 14 May 1973: the workshop is in orbit on the last Saturn V, and the first crew is due in a day.
  sWorkshop() {
    seatPeople();
    g.objective = `The workshop went up this morning. ${nameOf('hollis')} wants you in Mission Control. Go in.`;
    say('hollis', 'The workshop is up. Come and look at what the telemetry says before we send anyone to her.', '', 8);
  },
  mRecovery() {
    g.objective = 'Recovery is reporting. Read the board, then go to the review.';
    g.room = 'splash';
    if (pilotId()) g.people.pilot.hidden = true;
  },
  mReview() {
    seatPeople();
    if (pilotId()) {
      const alive = g.mission.fate !== 'killed';
      g.people.pilot.hidden = !alive;
      if (alive) place('pilot', 320);
    }
    g.objective = `${nameOf('hollis')} wants the review. Go into Mercury Control.`;
    g.round.flight = flightRecord();
    g.mission.reading = ellisReading(g.round);
  },
};
const cap = t => t[0].toUpperCase() + t.slice(1);
// Who flies this round, if anyone: his id, or null.
export const pilotId = () => (g.crewed && crewOf()?.[0]) || null;
const pilotName = () => ASTRONAUTS[pilotId()].name;
const first = () => pilotName().split(' ')[0];
// Whether you are the project engineer: Tate has the Retrofire console, and you answer for the hardware.
// The programme office checks the hardware out too, and watches flight day from the viewing room.
export const engineer = () => g.crewed && ['engineer', 'programme'].includes(g.record.seat);
export const programmeOffice = () => g.crewed && g.record.seat === 'programme';
// The flight director: in Houston, every call on the shift is yours.
export const flightDirector = () => g.crewed && g.record.seat === 'flight' && programOf() !== 'mercury';
const retroWho = con => (con.auto ? 'tate' : 'you');
const callsign = con =>
  con.auto ? (programmeOffice() ? 'Programme' : 'Engineering') : flightDirector() ? 'Flight' : 'Retro';

// The day before a flight from Houston: the team in the simulator, the crew on the Cape.
function houstonBrief(launch) {
  const plan = flightOf(),
    crew = crewNames();
  const flies = crew ? `flies ${crew}` : 'flies with no crew';
  const line = flightDirector()
    ? `${plan.craft} ${flies} on ${launch}: ${plan.objective}. It's your room on launch day, Flight. Today your team is in the sims, and the mission rules are on your console. Know them.`
    : `${plan.craft} ${flies} on ${launch}: ${plan.objective}. Today you're in the sims with the team.`;
  say('hollis', line, '', 8);
  note(`${cap(SEASON[g.roundIndex].name)}. ${nameOf('hollis')}: ${line}`);
  g.objective = 'Train in the simulator. When you have had enough, end the day.';
  g.dayDone = true;
}
// Everyone flying this round, by name.
// An Apollo crew: the commander and the lunar module pilot fly the lander (crew 0 and 2); the command module pilot (1) stays up.
export const lmCrew = () => {
  const n = (crewOf() || []).map(id => ASTRONAUTS[id].name);
  return { lm: `${n[0]} and ${n[2]}`, cm: n[1] };
};
export const crewNames = () => (crewOf() || []).map(id => ASTRONAUTS[id].name).join(' and ');

// Who is where in a Mercury round.
function seatPeople() {
  place('hollis', 180);
  place('reyes', 230);
  place('albrecht', 262);
  place('morgan', 150);
  place('brandt', 420);
  place('vega', 2010);
  place('kowalski', 1980);
  place('delgado', 2090);
  if (engineer() || (flightOf() && g.record.seat !== 'retro')) place('tate', 300);
  if (flightOf()) {
    place('kessler', 330);
    place('dorsey', 360);
  }
}

// A Mercury round starts the day before launch.
export function startMission() {
  g.mission = { sims: 0, trained: false, cond: null, scrubs: 0, pad: null, reading: null, calls: {} };
  morning('mBrief');
}

// ---- Which room each building opens in a Mercury round ----
export function missionRoomFor(id) {
  const flying = g.console && g.console.kind === 'flight';
  if (engineer() && ['mBrief', 'mScrub'].includes(g.beat)) {
    if (id === 'hangar') return 'checkout';
    if (id === 'dugout' || id === 'stand') return 'qual';
  }
  if (id === 'office' && g.beat === 'sRoute') return 'route';
  if (id === 'office' && g.beat === 'sApollo8') return 'apollo8';
  if (id === 'office' && g.beat === 'sWorkshop') return 'workshop';
  if (id === 'office')
    return ['mLaunch', 'mFlight'].includes(g.beat)
      ? 'console'
      : g.beat === 'mReview'
        ? 'mreview'
        : ['roundEnd', 'seasonEnd'].includes(g.beat)
          ? g.beat
          : 'watch';
  if (id === 'dugout' || id === 'stand') return flying || g.beat === 'mFlight' ? 'watch' : 'sim';
  if (id === 'truck') return g.beat === 'mRecovery' ? 'splash' : 'watch';
  return 'watch';
}

// ---- The console: one model for the real count and flight and for a training sim ----
// phase: count → poll → count → … → ascent → ip → coast → done (sim: debrief). The rooms read only these fields.
function newConsole(kind, round, cond, scenario = null, orbital = false) {
  const flightId = flightOf() ? flightIdOf() : null;
  return {
    kind,
    round,
    cond,
    scenario,
    orbital,
    flightId,
    auto: kind === 'flight' && engineer(),
    phase: kind === 'sim' ? 'poll' : 'count',
    clock: kind === 'sim' ? 600 : 900,
    next: 0,
    poll: kind === 'sim' ? 'recovery' : null,
    t: 0,
    trace: [],
    abortAt: null,
    ip: null,
    aim: null,
    holds: 0,
    calls: { poll: [], abort: null, ip: null },
    lines: [],
    chatter: [],
    lamps: {},
    live: true,
  };
}
// Who says what on the loop. A sim's loop is the simulator's own: nobody on the real site hears it.
function speak(con, who, text, tone = '', seconds = 4.5) {
  if (!con || con.kind === 'flight') return say(who, text, tone, seconds);
  con.chatter.push({ who: g.people[who].name, text, tone });
  if (con.chatter.length > 6) con.chatter.shift();
  roomChanged();
}
// A lamp lit on a station console: what the room saw, in the room own shorthand, in two short lines.
const lamp = (con, station, a, b, tone) => {
  (con.lamps = con.lamps || {})[station] = { a, b, tone: tone || 'go' };
};

// What the recovery board shows: every unit, on station or not, and the sea state. Visible to everyone.
const unitsOf = con => (con.orbital ? ORBIT_UNITS : UNITS);
export const board = con => ({
  sea: con.cond.seaState,
  units: Object.entries(unitsOf(con)).map(([id, text]) => ({ id, text, on: con.cond.late !== id })),
});
const boardGood = con => con.cond.seaState <= SEA_LIMIT && !con.cond.late;

// Open the console on launch day: the count begins.
export function consoleStart() {
  if (g.console || g.beat !== 'mLaunch') return;
  g.console = newConsole('flight', g.round, g.mission.cond, null, !!SEASON[g.roundIndex].orbital);
  place('you', 300);
  setBeat(
    'mFlight',
    flightDirector()
      ? "Run the count from the flight director's console, then work the flight: the climb, and every call on your shift."
      : engineer()
        ? `Listen on the loop from the back room. When ${nameOf('hollis')} asks about the hardware, answer ${himOf('hollis')}.`
        : `Work the count from your console. Give your status when ${nameOf('hollis')} polls you, and watch the plot once she flies.`,
  );
}

// From the flight director's console the recovery poll is Recovery's report, with Retro's concurrence, before your call.
function recoveryReport(con) {
  const ok = boardGood(con);
  speak(con, 'reyes', ok ? 'Flight, Recovery is go.' : 'Flight, Recovery is no-go.', ok ? 'go' : 'warn');
  speak(
    con,
    'tate',
    ok ? 'Retro concurs. The recovery area is ready.' : 'Retro concurs with the recovery hold.',
    ok ? 'go' : 'warn',
  );
}

// Your status at a poll: GO or NO-GO on the recovery area.
export function consolePoll(go) {
  const con = g.console;
  if (!con || !con.poll) return;
  // The Shuttle's joint call rides the poll buttons: go is press, no-go is hold for the afternoon warm.
  if (con.poll === 'joint') return jointAnswer(go);
  const b = board(con),
    ok = boardGood(con);
  con.calls.poll.push({ go, ok });
  const sim = con.kind === 'sim';
  if (!sim)
    note(
      `${con.auto ? `${nameOf('tate')}'s` : 'Your'} poll at T-${Math.ceil(con.clock)} s: the recovery board showed sea state ${b.sea}${con.cond.late ? `, and ${unitsOf(con)[con.cond.late].toLowerCase().replace(/^the /, 'the ')} not on station` : ', every unit on station'}. ${con.auto ? nameOf('tate') : 'You'} called ${go ? 'GO' : 'NO-GO'}.`,
    );
  const poll = con.poll;
  con.poll = null;
  const flight = flightDirector() && !con.auto;
  const station = flight ? 'Flight' : 'Retro';
  // The man on top has his own say at the final poll, and his no is binding.
  if (go && poll === 'final' && con.kind === 'flight' && pilotId()) {
    speak(con, retroWho(con), `${station} is go.`, 'go');
    const t = CREW_TRAITS[pilotId()],
      ok = consents(t, { sea: b.sea, late: con.cond.late });
    speak(con, flight ? 'you' : 'hollis', `${first()}, are you go?`);
    if (impatient(t, con.holds))
      speak(con, 'pilot', "Why don't you fix your little problem and light this candle?", 'warn', 6);
    if (ok) {
      speak(con, 'pilot', "I'm go.", 'go');
      roomChanged();
      return;
    }
    const why = b.sea > SEA_LIMIT ? `that sea out there` : `a ship off station`;
    speak(con, 'pilot', `I'm not going with ${why}. Sorry, Flight.`, 'bad', 6);
    note(`${pilotName()} would not consent to go with ${why}. The count holds.`);
    con.calls.pilotRefused = true;
    go = false;
    if (con.cond.seaState > SEA_LIMIT) {
      speak(con, 'hollis', 'His call. We scrub.', 'warn');
      return endCount('scrub');
    }
    con.phase = 'hold';
    con.holdLeft = 3;
    con.holdFor = 'ship';
    con.holds++;
    con.poll = null;
    roomChanged();
    return;
  }
  if (go) {
    speak(con, retroWho(con), `${station} is go.`, 'go');
    if (sim && con.phase === 'poll') {
      con.phase = 'count';
      con.clock = 10;
    }
    roomChanged();
    return;
  }
  // NO-GO: a ship off station is waited for; a rough sea scrubs the day; a clean board is a hold while Hollis asks why.
  if (con.cond.seaState > SEA_LIMIT) {
    lamp(con, 'RECOVERY', 'SEA ROUGH', 'SCRUB', 'warn');
    speak(
      con,
      retroWho(con),
      `${station} is no-go. Sea state ${b.sea} in the recovery area. The rule says four.`,
      'bad',
    );
    speak(con, flight ? 'you' : 'hollis', flight ? 'Scrub for today.' : 'Agreed. We scrub for today.', 'warn');
    return endCount('scrub');
  }
  if (con.cond.late) {
    speak(
      con,
      retroWho(con),
      `${station} is no-go until ${unitsOf(con)[con.cond.late].split(',')[0].toLowerCase()} is on station.`,
      'bad',
    );
    lamp(con, 'RECOVERY', '1 SHIP', 'NOT ON STN', 'warn');
    lamp(con, 'RETRO', 'NO-GO', 'HOLDING', 'warn');
    speak(con, flight ? 'you' : 'hollis', 'Holding. Recovery, get that ship on station.', 'warn');
    con.phase = 'hold';
    con.holdLeft = 3;
    con.holdFor = 'ship';
    con.holds++;
    roomChanged();
    return;
  }
  lamp(con, 'RETRO', 'NO-GO', 'LOOKING', 'warn');
  speak(con, retroWho(con), `${station} is no-go.`, 'bad');
  speak(
    con,
    flight ? 'reyes' : 'hollis',
    flight
      ? 'Flight, Recovery has all ships on station. Standing by during the hold.'
      : 'Retro, I have every ship on station and a flat sea. What are you seeing? Holding while you look.',
    'warn',
  );
  con.phase = 'hold';
  con.holdLeft = 1.5;
  con.holdFor = 'look';
  con.holds++;
  roomChanged();
}

// Call an abort: Retro recommends it, and the flight director commands it. The escape tower pulls the capsule away.
export function consoleAbort() {
  const con = g.console;
  if (!con || con.phase !== 'ascent' || con.abortAt != null) return;
  con.abortAt = Math.floor(con.t);
  con.calls.abort = { at: con.abortAt, off: con.trace.length ? con.trace[con.trace.length - 1].off : 0 };
  lamp(con, 'RETRO', 'ABORT', 'CALLED', 'bad');
  lamp(con, 'FLIGHT', 'ABORT', 'ABORT', 'bad');
  // From the flight director's console you command it yourself; from Retro's you recommend it and Hollis commands it.
  if (flightDirector() && !con.auto) speak(con, 'you', 'Abort! Abort!', 'bad');
  else {
    speak(con, retroWho(con), "Flight, Retro: she's off her line. Recommend abort!", 'bad');
    speak(con, 'hollis', 'Abort! Abort!', 'bad');
  }
  if (con.kind === 'flight')
    note(
      `T+${con.abortAt} s: ${con.auto ? nameOf('tate') : 'you'} called an abort with the flight-path angle ${Math.abs(con.calls.abort.off).toFixed(1)} degrees off the planned line.`,
    );
  finishAscent(con);
}

// Retro's landing point for Recovery after cutoff or entry: 'radar', 'telemetry', 'retro' or 'planned'. Retro computes
// the splashdown point and passes it to Recovery; Recovery directs the ships and helicopters. When you are the flight
// director, the Retrofire console is Tate's and you hear the exchange; it is not your call.
export function consoleAim(which) {
  const con = g.console;
  if (!con || con.phase !== 'ip') return;
  con.aim = which;
  con.calls.ip = which;
  const tate = con.auto || flightDirector();
  const retro = tate ? 'tate' : 'you';
  const actor = tate ? nameOf('tate') : 'You';
  if (con.orbital) {
    const where = which === 'planned' ? 'the planned point' : km(con.ip[which]) + ' of the planned point';
    const radar = con.flightId ? 'the tracking ship' : 'Grand Turk';
    const predicted = con.flightId ? "the spacecraft's computer" : 'the retrofire telemetry';
    speak(
      con,
      retro,
      which === 'radar'
        ? `Recovery, Retro: ${predicted} puts her ${km(con.ip.retro)} of the planned point, but I don't trust it. Recommend you hold the helicopters for ${radar}'s fix.`
        : `Recovery, Retro: best splashdown ${where}.`,
      'go',
    );
    if (which === 'radar')
      speak(
        con,
        'reyes',
        `Recovery copies. Holding the helicopters. ${cap(radar)} has her ${km(con.ip.radar)}. Helicopters launching.`,
        'go',
      );
    else speak(con, 'reyes', 'Recovery copies. Helicopters launching.', 'go');
    if (con.kind === 'flight')
      note(
        which === 'radar'
          ? `${actor} told Recovery not to trust the predicted point and to wait for ${radar}'s fix. Recovery held the helicopters for it and sent them to ${km(con.ip.radar)}.`
          : `${actor} gave Recovery ${where} as the best splashdown point. Recovery sent the helicopters there.`,
      );
    con.phase = 'coast';
    con.coastLeft = COAST_SECONDS;
    return roomChanged();
  }
  const kmDown = Math.round(con.ip[which]);
  speak(con, retro, `Recovery, Retro: best splashdown ${kmDown} kilometres downrange.`, 'go');
  speak(con, 'reyes', `Recovery copies. Helicopters launching for ${kmDown}.`, 'go');
  if (con.kind === 'flight')
    note(
      `${actor} gave Recovery ${kmDown} km downrange as the best splashdown point (the ${which === 'planned' ? 'planned point' : `${which} impact point`}). Recovery sent the helicopters there.`,
    );
  con.phase = 'coast';
  con.coastLeft = COAST_SECONDS;
  roomChanged();
}
// The landing point Tate gives Recovery: the radar's, unless its track dropped out.
const tateAim = con => (con.orbital ? 'radar' : con.ip.intermittent ? 'telemetry' : 'radar');

// The joint call answered. Press: fly into the cold. Hold: the launch slips a day, and the joint warms with it.
function jointAnswer(go) {
  const con = g.console;
  const sim = con.kind === 'sim';
  con.poll = null;
  if (go) {
    speak(con, retroWho(con), 'Flight is go. Light her on schedule.', 'go');
    if (!sim) note('You pressed the count over the engineers\u2019 joint call: a launch into the cold of the morning.');
    roomChanged();
    return;
  }
  speak(
    con,
    retroWho(con),
    `${flightDirector() && !con.auto ? 'Flight' : 'Retro'} is no-go on the joint. Hold for the afternoon.`,
  );
  speak(con, 'hollis', 'Agreed. We scrub. The joint warms with the day.', 'go');
  if (!sim) {
    note('You held the count for the booster joint: the launch slips a day, into the afternoon warm.');
    con.round.warm = true;
    g.mission.jointHold = true;
    endCount('joint');
    return;
  }
  finishSim(con, 'scrub');
}

// The flight or the count ended with you at your console: the console room goes with it, or the site would be drawn
// with every click still sent to buttons that are gone. When the next thing is the review, it opens where you sit.
function leaveConsole() {
  if (g.room !== 'console') return;
  g.room = g.beat === 'mReview' && missionRoomFor('office') === 'mreview' ? 'mreview' : null;
  roomChanged();
}

function endCount(why) {
  const con = g.console;
  con.phase = 'done';
  con.live = false;
  if (con.kind === 'sim') return finishSim(con, why);
  g.console = null;
  if (why === 'scrub' || why === 'joint') {
    g.slipDays += 1;
    g.mission.scrubs += 1;
    note(
      why === 'joint'
        ? 'The launch was held for the booster joint. It slips a day, into the afternoon warm.'
        : 'The launch was scrubbed for the sea in the recovery area. It slips a day.',
    );
    setBeat('mScrub');
  }
  leaveConsole();
  roomChanged();
}

// ---- The tick: the count, the climb, and the coast ----
export const consoleLive = () => !!(g.console && g.console.live);
export const consoleLocked = () => !!(g.console && g.console.kind === 'flight' && g.console.live);
export function tickConsole(dt) {
  const con = g.console;
  if (!con || !con.live) return;
  if (con.auto && tateCalls(con)) return;
  // From the flight director's console the landing point is Retro's call to Recovery: Tate makes it after a moment.
  if (con.phase === 'ip' && flightDirector()) {
    con.ipLeft = (con.ipLeft ?? 2.5) - dt;
    if (con.ipLeft <= 0) {
      con.ipLeft = null;
      consoleAim(tateAim(con));
    }
    return;
  }
  if (con.phase === 'hold') {
    con.holdLeft -= dt;
    g.clock += dt * 15;
    if (con.holdLeft <= 0) {
      if (con.holdFor === 'ship') {
        speak(con, 'reyes', `${unitsOf(con)[con.cond.late].split(',')[0]} is on station.`, 'go');
        con.cond.late = null;
        lamp(con, 'RECOVERY', 'ALL SHIPS', 'ON STATION', 'go');
      }
      con.phase = con.kind === 'sim' && con.clock >= 600 ? 'poll' : 'count';
      con.poll = con.clock <= 120 ? 'final' : 'recovery';
      if (flightDirector() && !con.auto && con.poll === 'recovery') recoveryReport(con);
      else speak(con, 'hollis', 'Retro, Recovery: status?');
      roomChanged();
    }
    return;
  }
  if (con.phase === 'count') {
    if (con.poll) return;
    const step = con.clock > 10 ? COUNT_RATE : 1;
    con.clock = Math.max(0, con.clock - step * dt);
    g.clock += (step * dt) / 60;
    // The Shuttle's telecall: on a cold morning, the booster contractor's engineers ask the flight director not to
    // press a field joint that has never flown this cold. A poll like any other: go is press, no-go is hold.
    if (
      con.kind === 'flight' &&
      con.round.vehicle === 'shuttle' &&
      con.round.cold &&
      !con.jointAsked &&
      !con.round.warm &&
      con.clock <= 540 &&
      con.clock > 520
    ) {
      con.jointAsked = true; // and on the round, so tomorrow's count does not ask twice
      con.round.jointAsked = true;
      con.poll = 'joint';
      speak(
        con,
        'albrecht',
        "Flight, Booster: the contractor's engineers are on the line about the right-hand booster's field joint. It has never flown this cold, and it leaked blow-through on a cold bench test. They recommend we wait for the afternoon warm.",
        'warn',
        9,
      );
      speak(
        con,
        'hollis',
        `${flightDirector() ? 'Flight' : 'Retro'}: the count is at your call. Press, or hold for the afternoon?`,
        'warn',
        6,
      );
      roomChanged();
      return;
    }
    while (con.next < MERCURY_COUNT.length && MERCURY_COUNT[con.next].at >= con.clock) {
      const s = MERCURY_COUNT[con.next++];
      if (con.kind === 'sim' && s.at > 10) continue; // a sim picks up at the recovery poll, then counts the last ten seconds
      const flight = flightDirector() && !con.auto;
      if (flight && s.poll === 'recovery') recoveryReport(con);
      else speak(con, s.who, s.text, s.tone || '', s.quick ? 1 : 4);
      if (s.poll) {
        con.poll = s.poll;
        con.clock = s.at;
        roomChanged();
        return;
      }
      if (s.at === 0) return liftoff(con);
    }
    return;
  }
  if (con.phase === 'ascent') {
    const a = con.round.ascent,
      before = con.t;
    // An orbital climb plays in about the same real time whatever its booster: a Saturn V's 700 s run faster than an Atlas's 300.
    const pace = con.orbital ? 2 * ((a.planned || ORBIT_PLAN.burn) / ORBIT_PLAN.burn) : 1;
    con.t = Math.min(a.burn, con.t + ASCENT_RATE * pace * Math.min(4, g.speed) * dt);
    g.clock += (con.t - before) / 60;
    for (let t = Math.floor(before) + 1; t <= Math.floor(con.t); t++) {
      const s = stepAt(a, t);
      con.trace.push({
        t,
        gamma: s.gamma + flutter(con.round.seed, t),
        off: s.off,
        v: s.v,
        acc: s.acc,
        stage: s.stage,
      });
      if (
        con.kind === 'flight' &&
        pilotId() &&
        con.abortAt == null &&
        Math.abs(s.off) > ownAbortAt(CREW_TRAITS[pilotId()])
      )
        return pilotAbort(con, t);
      if (t === 36 && con.kind === 'flight' && con.round.lightning) {
        lamp(con, 'EECOM', 'PWR AUX', 'PLT LOST', 'bad');
        speak(
          con,
          'pilot',
          "What the hell was that? Everything in the world just dropped out. We've got a whole bunch of lights here.",
          'bad',
          6,
        );
        speak(
          con,
          'kessler',
          'Flight, EECOM: the fuel cells are off the line and I have garbage on the telemetry. Have them try SCE to AUX.',
          'bad',
          6,
        );
        speak(
          con,
          'pilot',
          "SCE to AUX… there it is. We have power. The platform's gone, but the Saturn's flying.",
          'warn',
          6,
        );
      }
      if (t === 60) speak(con, 'albrecht', 'Booster: one minute, steady.', 'go');
      // Staging, a stage at a time as the stack flies it (data/stacks.js), and the tower where she has one.
      const staged = a.staging?.find(x => x.t === t);
      if (staged?.call) speak(con, 'albrecht', staged.call, 'go');
      if (con.orbital && a.tower === t) speak(con, 'morgan', 'Escape tower jettisoned.', 'go');
      if (a.breakupAt != null && t >= a.breakupAt) return breakup(con);
    }
    if (con.shift?.pending) {
      con.shift.pending.left -= con.t - before;
      if (con.shift.pending.left <= 0) finishShiftReport(con);
    }
    if (con.t >= a.burn) finishAscent(con);
    return;
  }
  if (con.phase === 'insertion' && con.shift) {
    const shift = con.shift;
    const elapsed = windowMinutes(shift.remaining, dt);
    shift.remaining -= elapsed;
    passMinutes(elapsed);
    if (shift.pending) {
      shift.pending.left -= elapsed;
      if (shift.pending.left <= 0) finishShiftReport(con);
    }
    if (shift.remaining <= 0) {
      consoleInsertion('expire');
    }
    return;
  }
  if (con.phase === 'mission') return tickFlight(con, dt, speak);
  if (con.phase === 'orbit') return tickOrbit(con, dt);
  if (con.phase === 'entry') {
    con.coastLeft -= dt;
    g.clock += dt;
    if (con.coastLeft <= 0) afterEntry(con);
    return;
  }
  if (con.phase === 'coast') {
    con.coastLeft -= dt;
    g.clock += dt * 2;
    if (con.coastLeft <= 0) splash(con);
  }
}
// The telemetry needle's flutter: depends only on the round and the second, so the plot holds still when time does.
function flutter(seed, t) {
  let h = Math.imul((seed | 0) ^ Math.imul(t + 7, 2654435761), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296 - 0.5) * 1.2;
}

function liftoff(con) {
  if (con.kind === 'flight' && con.round.vehicle === 'titan' && Object.values(con.round.faults).includes('shutdown'))
    return titanShutdown(con);
  const a = con.orbital
    ? atlasAscent(con.round, con.kind === 'sim' ? orbitSimFailure(con) : null, boosterOf(con).names)
    : ascent(con.round, con.kind === 'sim' ? simFailure(con.scenario) : null);
  con.burn = a.burn; // the planned burn, from the flight plan: player-visible, and all the wall map needs
  if (con.kind === 'flight' && con.flightId === 'gem-6' && flightDirector() && !con.auto)
    con.shift = { plan: 'rendezvous', reports: {} };
  if (con.kind === 'flight') {
    g.launchDay = g.day;
    g.rocket.where = 'flying';
    g.rocket.rise = 0;
  }
  if (a.padAbort) {
    outcome(con.round);
    con.phase = 'pad';
    con.live = false;
    lamp(con, 'BOOSTER', 'CUTOFF', 'ON THE PAD', 'bad');
    lamp(con, 'PAD', 'CHUTES', 'CAPSULE OK', 'warn');
    speak(con, 'albrecht', "Engine cutoff! She's back on the pad!", 'bad', 6);
    speak(con, 'morgan', "The escape tower's gone! It flew off on its own!", 'bad', 6);
    speak(con, 'vega', "The capsule's chutes are out. They're hanging off the top of the rocket.", 'warn', 7);
    if (con.kind === 'flight') {
      g.rocket.where = 'tower';
      g.rocket.padAbort = true;
      note(
        "At ignition the engine lit and shut down at once. The booster rose about four inches and settled back on the pad. The escape tower fired away and the capsule's parachutes came out on top of the rocket.",
      );
    }
    roomChanged();
    return;
  }
  con.phase = 'ascent';
  con.t = 0;
  speak(con, 'vega', 'Liftoff!', 'go');
  speak(con, 'hollis', 'Liftoff, and the clock has started.', 'go');
  roomChanged();
}

// He pulls the abort handle himself: binding, whatever the ground says.
function pilotAbort(con, t) {
  con.abortAt = t;
  con.calls.pilotAbort = { at: t };
  lamp(con, 'FLIGHT', 'ABORT', 'PILOT', 'bad');
  speak(con, 'pilot', "She's going off! I'm pulling the handle! Abort!", 'bad', 6);
  speak(con, 'hollis', 'Abort! The pilot has aborted!', 'bad');
  note(`T+${t} s: ${pilotName()} pulled the abort handle himself.`);
  finishAscent(con);
}

function breakup(con) {
  const a = con.round.ascent;
  lamp(con, 'BOOSTER', 'BREAKUP', a.asis ? 'CAPSULE AWAY' : 'NO SIGNAL', 'bad');
  speak(con, 'albrecht', "She's breaking up!", 'bad', 5);
  speak(
    con,
    'morgan',
    a.asis ? 'Escape tower fired! The capsule is away!' : 'No escape! I have no capsule signal!',
    a.asis ? 'warn' : 'bad',
    6,
  );
  if (con.kind === 'flight')
    note(
      `T+${a.breakupAt} s: the booster broke up off her line. ${a.asis ? 'The abort sensing fired the escape tower and pulled the capsule clear.' : 'The escape tower never fired.'}`,
    );
  finishAscent(con);
}

function finishAscent(con) {
  if (con.orbital) return finishAtlas(con);
  const a = con.round.ascent,
    end = outcome(con.round, con.abortAt);
  if (con.kind === 'flight') g.rocket.where = 'gone';
  if (end.outcome === 'nominal' || end.outcome === 'short' || end.outcome === 'long') {
    lamp(con, 'BOOSTER', 'SEPARATION', 'NOMINAL', 'go');
    speak(con, 'albrecht', `Booster cutoff at ${a.burn} seconds. Capsule separation.`, 'go');
  }
  if (end.outcome === 'asis') {
    lamp(con, 'BOOSTER', 'RAN DRY', 'TOWER FIRED', 'warn');
    speak(con, 'albrecht', `Cutoff at ${a.burn} seconds. She ran dry!`, 'warn');
    speak(con, 'morgan', 'Abort light! The escape tower fired at cutoff.', 'warn');
  }
  if (con.kind === 'flight') {
    const last = con.trace[con.trace.length - 1];
    if (last && end.outcome !== 'breakup')
      note(
        `At ${end.abortedAt ?? a.burn} s the plot showed ${last.v.toFixed(2)} km/s at ${last.gamma.toFixed(1)} degrees (planned at cutoff: ${PLAN.v} km/s at ${PLAN.gamma} degrees).`,
      );
  }
  if (end.capsule === 'lost') {
    con.phase = 'coast';
    con.coastLeft = 2;
    con.aim = null;
    roomChanged();
    return;
  }
  con.ip = impactPredictions(con.round);
  con.phase = 'ip';
  speak(
    con,
    'morgan',
    `Impact points: radar ${Math.round(con.ip.radar)} kilometres${con.ip.intermittent ? ', track intermittent' : ''}; computer from cutoff ${Math.round(con.ip.telemetry)}.`,
    con.ip.intermittent ? 'warn' : '',
  );
  roomChanged();
}

// Splashdown, and how long the recovery forces take to reach her.
function splash(con) {
  const end = con.round.end,
    trained = g.mission ? g.mission.trained : true;
  const lines = [];
  if (con.orbital) splashOrbit(con, end, trained, lines);
  else if (end.capsule === 'lost') {
    con.hours = null;
    lines.push('There was nothing to recover. The capsule went down with the booster.');
  } else {
    con.hours = recoveryHours(end.landing, con.ip[con.aim], con.cond, trained);
    con.sank = con.kind === 'flight' && sinks(con.round, con.hours);
    const mins = Math.round(con.hours * 60);
    lines.push(`Splashdown about ${Math.round(end.landing / 10) * 10} km downrange.`);
    lines.push(
      con.cond.seaState > SEA_LIMIT
        ? `With the sea at state ${con.cond.seaState} the helicopters could not lift her. A ship had to steam to her.`
        : `The helicopters reached her ${mins} minutes after splashdown.`,
    );
    if (con.cond.seaState > SEA_LIMIT) lines.push(`She was picked up ${mins} minutes after splashdown.`);
    if (con.sank)
      lines.push(
        'She had been in the water too long. She took on water through the hatch seals and sank before the ship reached her.',
      );
    else if (end.capsule === 'damaged')
      lines.push('The capsule came back scorched and dented: she took more than she was built for.');
    else lines.push('The capsule came back whole.');
  }
  if (con.kind === 'flight' && pilotId()) {
    const fate = crewFate(con.round, end, con.hours ?? 0, con.sank),
      many = (crewOf() || []).length > 1,
      n = many ? crewNames() : pilotName();
    con.fate = fate;
    if (con.sank)
      lines.push(
        fate === 'killed'
          ? many
            ? `${n} got out as she went down, but they were in the water too long. The swimmers could not reach them in time.`
            : `${n} got out of the hatch as she went down, but he was in the water too long. The swimmers could not reach him in time. He drowned.`
          : `${n} got out of the hatch as she went down and ${many ? 'were' : 'was'} pulled from the water, exhausted.`,
      );
    else if (fate === 'killed') lines.push(`${n} ${many ? 'were' : 'was'} killed.`);
    else if (fate === 'hurt')
      lines.push(
        `${n} ${many ? 'are' : 'is'} alive but hurt: the flight surgeons have ${many ? 'them' : 'him'} on the ${end.secondary ? 'destroyer' : 'carrier'}.`,
      );
    else if (end.lmLost)
      lines.push(`${lmCrew().cm} is safe aboard the carrier, alone. ${lmCrew().lm} did not come back from the Moon.`);
    else
      lines.push(`${n} ${many ? 'are' : 'is'} safe aboard the ${end.secondary ? 'destroyer' : 'carrier'}, grinning.`);
  }
  con.lines = lines;
  con.phase = 'done';
  con.live = false;
  if (con.kind === 'sim') return finishSim(con);
  for (const l of lines) note(`Recovery: ${l}`);
  g.clock += Math.round((con.hours ?? 0.5) * 60);
  setBeat('mRecovery');
}

// ---- Gemini on the pad: the Titan lights and shuts down ----
// The commander has the D-ring between his knees. Whether he ejects is his call, not the ground's; he has a second and a
// half to make it. If he sits tight, the flight director decides how hard to look for the cause.
export const SHUTDOWN_OPTIONS = {
  plug: 'The tail plug fell out early: re-seat it and recycle the count. A day.',
  teardown: 'Stop and find every cause: borescope the engines, check everything. Three days.',
};
function titanShutdown(con) {
  const t = CREW_TRAITS[pilotId()],
    eject = t.risk < 0.4;
  g.launchDay = g.day;
  con.round.shutdownSeen = true;
  speak(con, 'vega', "Ignition… shutdown! The engines lit and shut down. She's still on the pad!", 'bad', 6);
  speak(con, 'albrecht', 'Liftoff clock started, but she never moved. Malfunction detection shut her down.', 'bad', 6);
  if (eject) {
    speak(con, 'pilot', 'Ejecting!', 'bad', 4);
    speak(con, 'morgan', "Both seats have fired. Chutes… they're down by the pad, both of them, alive.", 'warn', 7);
    note(
      `At ignition the Titan's engines lit and shut down. ${pilotName()} pulled the D-ring: both seats fired through the oxygen-soaked cabin and the crew came down beside the pad, burned and bruised. The spacecraft is wrecked.`,
    );
    g.mission.pad = 'ejected';
    g.mission.fate = 'hurt';
    con.round.end = { outcome: 'pad', landing: 0, apogee: 0, entryG: 0, capsule: 'damaged', abortedAt: null };
    con.round.ascent = { steps: [], burn: 0, failure: 'shutdown' };
    con.phase = 'done';
    con.live = false;
    g.console = null;
    setBeat('mReview');
    return leaveConsole();
  }
  speak(con, 'pilot', "We're all right, Houston. Sitting tight. Get her safed.", 'warn', 6);
  note(
    `At ignition the Titan's engines lit and shut down. ${pilotName()} kept his hand off the D-ring: the clock had started, but the spacecraft never moved, and he trusted his own instruments over the clock.`,
  );
  con.calls.shutdown = { sat: true };
  con.phase = 'shutdown';
  con.live = false;
  if (!flightDirector()) return shutdownChoose('teardown');
  roomChanged();
}
export function shutdownChoose(choice) {
  const con = g.console;
  if (!con || con.phase !== 'shutdown' || !SHUTDOWN_OPTIONS[choice]) return;
  const r = con.round,
    again = choice === 'plug' && r.dustcap && !r.plugTried;
  con.calls.shutdown.choice = choice;
  if (flightDirector()) speak(con, 'you', SHUTDOWN_OPTIONS[choice], '', 5);
  if (choice === 'plug' && !again) delete r.faults[Object.keys(r.faults).find(k => r.faults[k] === 'shutdown')];
  if (choice === 'plug') r.plugTried = true;
  if (choice === 'teardown') {
    delete r.faults[Object.keys(r.faults).find(k => r.faults[k] === 'shutdown')];
    note(
      `The pad crew found the tail plug had dropped out early.${r.dustcap ? ' Borescoping the engines, they found a plastic dust cap left in a gas generator: she would not have lit properly on the next try either.' : ' Nothing else was wrong.'} Three days' slip.`,
    );
    g.slipDays += 3;
    g.day += 2;
    g.clock += 2 * 1440;
    if (r.dustcap) con.calls.shutdown.foundCap = true;
  } else {
    note('The tail plug was re-seated and the count recycled for tomorrow.');
    g.slipDays += 1;
    if (again) con.calls.shutdown.missedCap = true;
  }
  g.mission.scrubs += 1;
  g.mission.shutdown = { ...(g.mission.shutdown || {}), ...con.calls.shutdown };
  g.console = null;
  setBeat('mScrub');
  leaveConsole();
  roomChanged();
}

// Hollis on the pad shutdown: how hard you looked before the next try.
function shutdownJudgement(s) {
  if (!s.choice || !flightDirector()) return;
  let line;
  if (s.missedCap) {
    shiftTrust(g.record, -1);
    line =
      'We re-seated the plug and she shut down again on the next try: a dust cap left in a gas generator. A proper look would have found it the first time.';
  } else if (s.foundCap) {
    shiftTrust(g.record, 1);
    line =
      "The teardown found a dust cap in a gas generator. She'd never have lit right. That look was worth three days.";
  } else if (s.choice === 'teardown')
    line = 'Three days to find the plug and nothing else. Careful, and Gemini 7 waited.';
  else line = 'The plug was the whole story. Back on the pad in a day.';
  g.mission.shutdownText = `${nameOf('hollis')} on the pad shutdown: "${line}"`;
}

// ---- The pad after a shutdown ----
export function padChoose(choice) {
  const con = g.console;
  if (!con || con.phase !== 'pad') return;
  if (choice === 'shoot') {
    speak(con, 'you', 'What if the range shoots holes in the tanks and drains her?');
    speak(con, 'hollis', 'Nobody is shooting at a fuelled rocket on my pad. Think again, Retro.', 'warn', 6);
    con.shootAsked = true;
    return roomChanged();
  }
  con.padChoice = choice;
  const sim = con.kind === 'sim';
  if (choice === 'wait') {
    speak(con, 'you', "Leave her. By morning the batteries are flat and the oxygen's gone. Then we safe her.");
    speak(con, 'hollis', 'Agreed. Nobody goes near that pad tonight.', 'go');
    if (!sim) {
      g.mission.pad = 'waiting';
      note(`You advised leaving the capsule on the pad overnight. ${nameOf('hollis')} agreed.`);
    }
  } else {
    speak(con, 'you', "Send the pad crew out now. The sooner she's safe the better.");
    speak(con, 'hollis', `Your call, Retro. ${nameOf('vega')}, take your crew out. Carefully.`, 'warn');
    const topple = padCrewNow(con.round);
    con.toppled = topple;
    if (!sim) {
      g.mission.pad = topple ? 'toppled' : 'safed';
      note(
        topple
          ? 'The pad crew went out at once. The wind filled the parachutes and pulled the capsule over: the booster toppled and burned on the pad. The crew got clear.'
          : 'The pad crew went out at once and safed the capsule without trouble.',
      );
      speak(
        con,
        'vega',
        topple ? "She's going over! Everybody clear! Clear!" : "Capsule's safe. Booster draining now.",
        topple ? 'bad' : 'go',
        7,
      );
    }
  }
  con.phase = 'done';
  if (sim) return finishSim(con);
  g.console = null;
  if (choice === 'wait') setBeat('mPadNight');
  else setBeat('mReview');
  leaveConsole();
}

// ---- The review in Mercury Control ----
// Hollis reads the tapes and the pad himself, and can be wrong. As at White Sands, he goes with his reading unless your
// record has earned his trust. Your calls in the flight are judged on what the plot showed.
export function missionPresent(key) {
  if (g.beat !== 'mReview') return;
  const view = g.mission.reading ?? ellisReading(g.round);
  let decision, reply, tone, agree;
  if (key === 'unknown') {
    decision = null;
    agree = true;
    tone = '';
    reply =
      view === 'nominal'
        ? 'Fine. Marshall will look her over anyway.'
        : `Fair. I'd say ${SHORT[view]}, but we won't fix a guess.`;
  } else if (key === view) {
    decision = view;
    agree = true;
    tone = 'go';
    shiftTrust(g.record, 1);
    reply =
      view === 'nominal'
        ? 'Agreed. She did what she was built for.'
        : "That's how I read the tapes too. Marshall fixes it before the next one.";
  } else if (g.record.trust >= TRUST.defer) {
    decision = key;
    agree = false;
    tone = 'go';
    reply = `I'd have said ${SHORT[view]}. You've been right before. We'll go with yours.`;
  } else {
    decision = view;
    agree = false;
    tone = 'warn';
    shiftTrust(g.record, -1);
    reply = `I don't read it that way. The tapes say ${SHORT[view]} to me, and that's what goes to Marshall.`;
  }
  const fix = decision && decision !== 'nominal' ? adopt(g.programme, decision) : null;
  g.review = { key, view, agree, decision, fix };
  if (g.mission.fate === 'killed') reply = `We lost ${pilotName()}. Whatever we find, we find all of it. ${reply}`;
  say('hollis', reply, tone, 8);
  const judged = judgeCalls();
  note(
    `Review: you said "${KITS[g.vehicle].explanations[key]}" ${nameOf('hollis')}: ${reply}${fix ? ` ${fix}` : ''}${judged.text ? ` ${judged.text}` : ''}`,
  );
  finishReview({
    yourCall: key,
    ellis: decision ?? view,
    ellisView: view,
    agreed: agree,
    wentWithYou: !agree && decision === key,
    fix,
    boss: 'hollis',
    calls: judged.calls,
  });
}

// What the plot showed about your abort call, as Hollis sees it on the tape. The trust it earns or costs.
function judgeCalls() {
  const end = g.round.end || {},
    a = g.round.ascent || {},
    calls = g.mission.calls || {};
  if (g.mission.shutdown) shutdownJudgement(g.mission.shutdown);
  if (calls.auto) {
    const j = engineerJudgement(calls);
    j.text = [j.text, ...flightJudgement(g.mission.decisions)].filter(Boolean).join(' ');
    return j;
  }
  if (calls.pilotAbort && !calls.abort)
    return {
      text: `${pilotName()} pulled the handle himself at ${calls.pilotAbort.at} seconds, before anyone on the ground called it.`,
      calls: { abort: 'pilot abort', aim: calls.aim || null, hours: calls.hours ?? null },
    };
  const sd = g.mission.shutdownText || '';
  const abort = calls.abort,
    overLine = (a.steps || []).find(s => Math.abs(s.off) > ABORT_LIMIT);
  let text = '',
    verdict = null;
  if (abort && overLine && abort.at >= overLine.t) {
    verdict = 'good abort';
    shiftTrust(g.record, 1);
    text = `${nameOf('hollis')} on your abort: "She was over the line and you called it. That's the job."`;
  } else if (abort && overLine) {
    verdict = 'early abort';
    text = `${nameOf('hollis')} on your abort: "You called it a little before the line. I'd have done the same."`;
  } else if (abort) {
    verdict = 'false abort';
    shiftTrust(g.record, -1);
    text = `${nameOf('hollis')} on your abort: "The tape never crossed the line. We threw away a good flight."`;
  } else if (end.outcome === 'breakup') {
    verdict = 'missed abort';
    shiftTrust(g.record, -1);
    text = `${nameOf('hollis')}: "She was over the line from ${overLine ? overLine.t : '?'} seconds and nobody called it."`;
  }
  if (g.round.orbit || calls.insertion)
    text = [sd, text, ...orbitJudgement(calls), ...flightJudgement(g.mission.decisions)].filter(Boolean).join(' ');
  return {
    text,
    calls: {
      abort: verdict,
      aim: calls.aim || null,
      hours: calls.hours ?? null,
      insertion: calls.insertion ? (calls.insertion.right ? 'right' : 'wrong') : undefined,
      pack: calls.pack,
      retro: calls.retro,
    },
  };
}
// Hollis on the orbital calls, from what the tapes and the capsule showed afterwards.
function orbitJudgement(calls) {
  const out = [],
    o = g.round.orbit,
    end = g.round.end;
  if (calls.insertion) {
    const i = calls.insertion;
    if (i.right) {
      if (i.go !== i.goddard) {
        shiftTrust(g.record, 1);
        out.push(`${nameOf('hollis')} on insertion: "You called it against Goddard, and you were right."`);
      }
    } else {
      shiftTrust(g.record, -1);
      out.push(
        i.go
          ? `${nameOf('hollis')} on insertion: "The orbit was never going to hold. We put him where no ship could reach him."`
          : `${nameOf('hollis')} on insertion: "She had a good orbit. We brought her down for nothing."`,
      );
    }
  }
  if (o && o.signal && calls.pack) {
    if (o.loose && calls.pack === 'keep') {
      shiftTrust(g.record, 1);
      out.push(`${nameOf('hollis')} on the retro pack: "The shield was loose. Those straps held it on. Good call."`);
    } else if (o.loose) {
      shiftTrust(g.record, -1);
      out.push(
        `${nameOf('hollis')} on the retro pack: "The shield was loose, and we threw away the only thing holding it."`,
      );
    } else
      out.push(
        calls.pack === 'keep'
          ? `${nameOf('hollis')} on the retro pack: "It was a bad switch. Keeping the pack cost us nothing this time."`
          : `${nameOf('hollis')} on the retro pack: "It was a bad switch. You read it right."`,
      );
  }
  if (o && calls.retro) {
    if (o.scanner && calls.retro === 'auto')
      out.push(
        `${nameOf('hollis')} on retrofire: "The scanner had her ${Math.round(Math.abs(o.scannerYaw))} degrees off in yaw, and the automatic system fired her that way. ${Math.round(Math.abs(end.miss || 0))} km off the point."`,
      );
    else if (o.scanner) {
      shiftTrust(g.record, 1);
      out.push(`${nameOf('hollis')} on retrofire: "The scanner was bad. Firing on the window saved a long swim."`);
    }
  }
  return out;
}

// The flight as your record puts it: only what Mercury Control knew.
function flightRecord() {
  const end = g.round.end || { outcome: 'pad' },
    a = g.round.ascent || {},
    m = g.mission;
  const hrs = m.calls.hours != null ? `, picked up after ${Math.round(m.calls.hours * 60)} minutes` : '';
  const text =
    g.round.flightTruth && end.outcome === 'entry'
      ? flightText(end, hrs)
      : end.outcome in ORBIT_RECORD
        ? ORBIT_RECORD[end.outcome](end, a, hrs)
        : {
            pad:
              m.pad === 'ejected'
                ? 'Lost: the Titan shut down at ignition and the crew ejected beside the pad.'
                : `Lost: the engine shut down at liftoff and the booster settled back on the pad.${m.pad === 'toppled' ? ' The booster toppled and burned.' : ' Capsule and booster saved.'}`,
            aborted: `Lost: aborted at ${end.abortedAt} seconds; the capsule came down about ${Math.round(end.landing / 10) * 10} km out${hrs}.`,
            breakup:
              end.capsule === 'lost'
                ? `Lost: the booster broke up at ${end.breakup} seconds and took the capsule with it.`
                : `Lost: the booster broke up at ${end.breakup} seconds; the escape tower pulled the capsule clear${hrs}.`,
            asis: `Lost: the booster ran dry early and the abort sensing fired the escape tower; splashdown about ${Math.round(end.landing / 10) * 10} km downrange${hrs}.`,
            short: `Lost: the engine cut off at ${a.burn} seconds; splashdown about ${Math.round(end.landing / 10) * 10} km downrange${hrs}.`,
            long: `Splashdown about ${Math.round(end.landing / 10) * 10} km downrange, long${hrs}.`,
            nominal: `Splashdown about ${Math.round(end.landing / 10) * 10} km downrange${hrs}.`,
          }[end.outcome];
  let out = m.sank ? `${text} The capsule sank before it was reached.` : text;
  const many = (crewOf() || []).length > 1,
    who = many ? `The crew, ${crewNames()},` : pilotId() ? pilotName() : '';
  if (pilotId() && m.fate && end.lmLost && m.fate !== 'killed')
    out = `Lost: ${out} ${lmCrew().lm} died in lunar orbit; ${lmCrew().cm} came home alone.`;
  else if (pilotId() && m.fate)
    out += {
      killed: ` ${who} ${many ? 'were' : 'was'} killed.`,
      hurt: ` ${who} ${many ? 'were' : 'was'} hurt.`,
      safe: ` ${who} came home safe.`,
    }[m.fate];
  if (m.fate === 'killed' && !/^Lost/.test(out)) out = `Lost: ${out}`;
  return {
    failure: a.failure || (g.round.flightTruth ? flightCause(g.round) : orbitCause()),
    failAt: a.failure ? (a.breakupAt ?? a.burn) : null,
    radar: end.apogee || null,
    text: out,
  };
}

// How the record puts an orbital flight.
const ORBIT_RECORD = {
  orbit: (e, a, hrs) => `In orbit${hrs}.`,
  nogo: (e, a, hrs) => `Lost: no-go at insertion; the capsule came down in the abort area${hrs}.`,
  decay: (e, a, hrs) => `Lost: the orbit did not hold and she came down within the first orbit${hrs}.`,
  entry: (e, a, hrs) =>
    e.capsule === 'lost' && !hrs
      ? 'Lost: the capsule did not survive the entry.'
      : `${ORBIT_PLAN.orbits} orbits; splashdown ${Math.round(Math.abs(e.miss))} km ${e.miss >= 0 ? 'long' : 'short'} of the planned point${hrs}.`,
};
// A long flight in the record: how long she stayed up, and where she came down.
function flightText(e, hrs) {
  const m = g.mission;
  if (e.capsule === 'lost' && !hrs) return `Lost: ${m.craft} did not survive the entry.`;
  // A winged spacecraft lands on a runway, not in the water.
  const where =
    g.vehicle === 'shuttle'
      ? `down on ${m.calls?.edwards ? 'the lakebed runway at Edwards' : "the Cape's runway"}, ${Math.round(Math.abs(e.miss))} km ${e.miss >= 0 ? 'long' : 'short'} of the mark`
      : `splashdown ${Math.round(Math.abs(e.miss))} km ${e.miss >= 0 ? 'long' : 'short'} of the planned point`;
  return `${m.craft}: ${m.flightHours} hours${m.capabilities?.length ? `. Shown: ${m.capabilities.join('; ')}` : ''}; ${where}${hrs}.`;
}
// What went wrong on an orbital flight, if the booster did not: the shield, or the scanner.
function orbitCause() {
  const o = g.round.orbit;
  if (!o) return null;
  return o.loose ? 'shield' : o.scanner ? 'scanner' : null;
}

// What the review has to go on: the tapes, and what came back.
export function evidence() {
  const a = g.round.ascent || {},
    end = g.round.end || {};
  if (a.orbital) return orbitEvidence(a, end);
  const lines = [...(TAPES[a.failure || 'nominal'] || [])];
  if (a.controlFrom && a.failure === 'control') lines[0] = `${lines[0]} It starts at about ${a.controlFrom} seconds.`;
  if (g.mission.sank) lines.push('The capsule is on the sea floor. All there is to go on is the telemetry.');
  if (end.capsule === 'damaged') lines.push('The capsule came back scorched and dented.');
  return lines;
}

function orbitEvidence(a, end) {
  if (g.round.flightTruth || ['titan', 'saturn5'].includes(g.vehicle)) return flightEvidence(a, end);
  const lines = [...(ORBIT_TAPES[a.failure || 'nominal'] || [])],
    o = g.round.orbit,
    back = end.capsule !== 'lost' && !g.mission.sank;
  if (a.controlFrom && a.failure === 'guidance') lines[0] = `${lines[0]} It starts at about ${a.controlFrom} seconds.`;
  if (o && o.signal)
    lines.push(
      back
        ? o.loose
          ? "In Hangar S the heat shield is found free of its latches, held on only by the landing bag's straps."
          : 'In Hangar S the shield is latched tight. The Segment 51 switch is found faulty.'
        : 'Segment 51 showed in orbit. With the capsule gone, nobody can say whether the shield was loose.',
    );
  if (o)
    lines.push(
      o.scanner
        ? back
          ? 'On the bench, one horizon scanner reads more than twenty degrees off.'
          : 'The attitude tapes and the fuel use point at the horizon scanners.'
        : 'The horizon scanners check out on the bench.',
    );
  if (end.miss != null && end.capsule !== 'lost')
    lines.push(
      `She came down ${Math.round(Math.abs(end.miss))} km ${end.miss >= 0 ? 'long' : 'short'} of the planned point.`,
    );
  if (g.mission.sank) lines.push('The capsule is on the sea floor. All there is to go on is the telemetry.');
  if (end.capsule === 'damaged') lines.push('The capsule came back scorched and damaged.');
  return lines;
}

// What the review of a long flight has to go on: the launch tapes, what the spacecraft did, and what came back.
const FLIGHT_EVIDENCE = {
  fuelcell: [
    "In flight the fuel cells' oxygen supply pressure fell from about 850 psi to 70 in the first hours.",
    "On the ground, the supply's heater is found open-circuit.",
  ],
  hatch: [
    'The crew reported the hatch latch stiff in orbit and hard to close after the spacewalk.',
    "On the bench the latch's spring guide is found bent.",
  ],
  computer: [
    'The guidance computer dropped off the line in flight and would not come back.',
    'On the bench, a power-supply transient trips it.',
  ],
  shutdown: [
    'At ignition the Titan lit and shut down: the malfunction detection saw a tail plug drop out early.',
    "The plug's pull-out force is found well under the specification.",
  ],
  thruster: [
    'Out of contact over China the docked stack began to roll; undocked, Gemini 8 rolled faster.',
    "On the bench, thruster 8's wiring shows a short that can hold its valve open.",
  ],
  pogo: [
    'Two minutes into the climb the stack shook end to end at about five cycles a second.',
    "The ground vibration tests find the first stage's propellant lines tuned to the stage's own resonance.",
  ],
  j2: [
    "Two of the second stage's engines shut down early, one after another.",
    'In a vacuum chamber an igniter line cracks after a few hundred flexes.',
  ],
  relight: ['The third stage would not restart in orbit.', "The restart system's helium bottle is found leaking."],
  sps: [
    "The service engine's chamber pressure fell away on the long burn.",
    'A ball valve actuator is found slow to close.',
  ],
  tank: [
    "Oxygen tank two's pressure went off the scale, then to nothing, and the spacecraft lost two fuel cells.",
    "The tank's heater switches are found welded shut: they were rated for 28 volts and the ground supply was 65.",
  ],
  cabin: [
    'A main bus dropped out and the crew smelled burning insulation.',
    'Under the couches a wire bundle is found chafed through to the copper.',
  ],
  alarm: [
    "The lander's computer threw program alarms all through the descent: executive overflow.",
    'With the rendezvous radar switch where the checklist put it, the computer runs out of time.',
  ],
  ascent: [
    "The ascent engine's thrust sagged a few percent and the lander reached a low orbit.",
    'The injector is found burred.',
  ],
  chute: [
    'One of the three main parachutes collapsed on the way down.',
    'The thruster fuel dumped under the chutes is found to have burned through a riser.',
  ],
  lightning: [
    'Thirty-six seconds after liftoff every alarm in the spacecraft lit at once, and again at fifty-two seconds.',
    'The vehicle and its exhaust plume had made a path for lightning through the cloud.',
  ],
  navdata: [
    'She came down well short of the planned point, though the computer steered her all the way.',
    "Retro's people find the number for the Earth's rotation in the ground program was wrong.",
  ],
};
function flightEvidence(a, end) {
  const lines = [...((BOOSTERS[g.vehicle] || BOOSTERS.titan).tapes[a.failure || 'nominal'] || [])];
  if (a.controlFrom && ['titanctl', 'saturnctl'].includes(a.failure))
    lines[0] = `${lines[0]} It starts at about ${a.controlFrom} seconds.`;
  const t = g.round.flightTruth;
  if (t) {
    const cause = flightCause(g.round);
    for (const [k, l] of Object.entries(FLIGHT_EVIDENCE))
      if (k === cause || g.round.flightFaultsSeen?.includes(k)) lines.push(...l);
    if (!lines.slice(1).length && !a.failure)
      lines.push('The spacecraft systems stayed in their bands from insertion to retrofire.');
  }
  if (end.miss != null && end.capsule !== 'lost')
    lines.push(
      `She came down ${Math.round(Math.abs(end.miss))} km ${end.miss >= 0 ? 'long' : 'short'} of the planned point.`,
    );
  if (g.mission.sank) lines.push('The spacecraft is on the sea floor. All there is to go on is the telemetry.');
  if (end.capsule === 'damaged') lines.push('The spacecraft came back scorched and damaged.');
  return lines;
}

// ---- Training sims ----
// Run at any time outside a real count or flight. The sim supervisor chooses the trouble; you do not know which.
// A sim never touches the real round: it has its own seed and its own round.
export const simOpen = () =>
  g.crewed &&
  !consoleLocked() &&
  !['mFlight', 'mRecovery'].includes(g.beat) &&
  !(g.console && g.console.kind === 'sim' && g.console.live);
export function simStart() {
  if (!simOpen()) return;
  const n = (g.record.sims || []).length,
    orbital = !!SEASON[g.roundIndex].orbital;
  const round = newRound((g.seed + 50000 + n * 7907) >>> 0, g.programme, orbital ? g.vehicle : 'redstone');
  const list = orbital ? (BOOSTERS[g.vehicle] || BOOSTERS.atlas).sims : SIMS,
    keys = Object.keys(list),
    scenario = keys[Math.floor(draw(round.rng.forecast) * keys.length)];
  if (scenario === 'radar') round.forceRadar = true;
  if (orbital) {
    // The sim supervisor sets the capsule's troubles himself.
    round.faults = {
      ...(scenario === 'seg51loose' ? { 'heat-shield': 'shield' } : {}),
      ...(scenario === 'scanner' ? { scanners: 'scanner' } : {}),
    };
    round.seg51Risk = scenario === 'seg51false' ? 1 : 0;
  }
  const con = (g.console = newConsole(
    'sim',
    round,
    conditions(round, ['seastate', 'offstation'].includes(scenario) ? scenario : 'calm'),
    scenario,
    orbital,
  ));
  speak(con, 'hollis', 'Sim supervisor has the board. We pick up at T minus ten. Retro, recovery status?');
  g.clock += SIM_MINUTES;
  roomChanged();
}
const simFailure = scenario => (['control', 'lox', 'thrust'].includes(scenario) ? scenario : 'nominal');

function finishSim(con, why = null) {
  const s = con.scenario,
    end = con.round.end;
  const graded = [];
  const poll = con.calls.poll[0];
  graded.push({ what: 'Your recovery poll', right: poll ? poll.go === poll.ok : true });
  if (why !== 'scrub' && con.orbital) gradeOrbitSim(con, graded);
  else if (why !== 'scrub') {
    const control = s === 'control';
    const abort = con.calls.abort;
    const rightAbort = control
      ? !!abort && (!con.round.ascent.breakupAt || abort.at < con.round.ascent.breakupAt)
      : !abort;
    graded.push({ what: control ? 'The abort' : 'Not aborting', right: rightAbort });
    // The best point on the board: the radar's, unless its track dropped out.
    if (end && end.capsule !== 'lost' && con.aim)
      graded.push({
        what: 'The landing point you gave Recovery',
        right: con.aim === (con.ip.intermittent ? 'telemetry' : 'radar'),
      });
  }
  const right = graded.filter(x => x.right).length;
  const simList = con.orbital ? boosterOf(con).sims : SIMS;
  con.debrief = { scenario: simList[s], graded, right, of: graded.length, lines: con.lines };
  addSim(g.record, { day: g.day, scenario: s, right, of: graded.length });
  if (g.mission) g.mission.trained = true;
  note(`Training sim: ${simList[s]} You got ${right} of ${graded.length} calls right.`);
  speak(
    con,
    'hollis',
    right === graded.length ? 'Clean sim, Retro.' : 'Debrief, Retro. Look at what you missed.',
    right === graded.length ? 'go' : 'warn',
  );
  con.phase = 'debrief';
  con.live = false;
  roomChanged();
}
// The calls in an orbital sim, against what the supervisor really set up.
function gradeOrbitSim(con, graded) {
  const a = con.round.ascent,
    end = con.round.end || {},
    o = con.round.orbit,
    calls = con.calls;
  const off = s => s === boosterOf(con).names.guidance;
  graded.push({
    what: off(con.scenario) ? 'The abort' : 'Not aborting',
    right: off(con.scenario) ? !!calls.abort && (!a.breakupAt || calls.abort.at < a.breakupAt) : !calls.abort,
  });
  if (calls.insertion) graded.push({ what: 'Go or no-go for orbit', right: calls.insertion.right });
  if (o && o.signal) graded.push({ what: 'The retro pack', right: o.loose ? calls.pack === 'keep' : true });
  if (o && calls.retro)
    graded.push({ what: 'How to fire the retros', right: o.scanner ? calls.retro === 'manual' : true });
  if (con.ip && con.aim && end.miss != null)
    graded.push({
      what: 'The landing point you gave Recovery',
      right: con.aim === 'radar' || Math.abs(con.ip[con.aim] - end.miss) <= 30,
    });
}

export function simClose() {
  if (g.console && g.console.kind === 'sim' && !g.console.live) {
    g.console = null;
    roomChanged();
  }
}

// After splashdown: Recovery's board, then the review.
export function toReview() {
  if (g.beat !== 'mRecovery') return;
  const con = g.console;
  if (con && con.flight) {
    g.mission.decisions = con.flight.decisions;
    g.mission.capabilities = recordCapabilities(con);
    g.mission.craft = con.flight.craft;
    g.mission.flightHours = Math.round(con.flight.at);
  }
  if (con) {
    g.mission.calls = { ...con.calls, aim: con.aim, hours: con.hours, auto: !!con.auto };
    g.mission.sank = !!con.sank;
    g.mission.lines = con.lines;
    g.mission.fate = con.fate || null;
  }
  if (con && con.orbital && con.round.end?.outcome === 'entry' && con.round.end.capsule !== 'lost')
    (g.record.orbitMisses = g.record.orbitMisses || []).push(con.round.end.miss);
  if (con && con.round.end?.lmLost && g.mission.fate !== 'killed') {
    const [commander, , landerPilot] = crewOf();
    recordDeaths([commander, landerPilot]);
  }
  if (g.mission.fate === 'killed') recordDeaths(crewOf() || []);
  g.console = null;
  g.room = null;
  setBeat('mReview');
}

// Hours of game time the coast takes, for the notebook; the plot jumps over it.
export const coastMinutes = () => Math.round(((g.round.end && g.round.end.coast) || 300) / 60);

// ---- Orbital flights: insertion, the orbits, retrofire and entry ----
const km = x => `${Math.round(Math.abs(x))} km ${x >= 0 ? 'long' : 'short'}`;
const pctFuel = f => `${Math.round(f * 100)} percent`;

// Sustainer cutoff, or an abort on the way up.
function finishAtlas(con) {
  const a = con.round.ascent,
    end = atlasOutcome(con.round, con.abortAt);
  if (con.kind === 'flight') g.rocket.where = 'gone';
  if (end.outcome === 'orbit') {
    con.goddard = goddard(con.round);
    const engine =
      con.round.vehicle === 'titan'
        ? 'Second stage'
        : con.round.vehicle === 'atlas'
          ? 'Sustainer'
          : 'Final powered stage';
    speak(con, 'albrecht', `${engine} cutoff at ${a.burn} seconds. Capsule separation.`, 'go');
    if (a.makeup)
      speak(
        con,
        'albrecht',
        `The S-IVB burned ${a.makeup} seconds long to make up for the S-II.${a.tliShort ? ' That was translunar propellant: there is not enough left for TLI.' : ''}`,
        'warn',
        6,
      );
    speak(
      con,
      'morgan',
      `Goddard's computers: ${con.goddard.go ? 'GO for orbit' : 'NO-GO, the orbit will not hold'}.`,
      con.goddard.go ? 'go' : 'bad',
      6,
    );
    if (con.kind === 'flight')
      note(
        `At cutoff the plot showed ${con.goddard.v.toFixed(3)} km/s, ${con.goddard.gammaOff.toFixed(1)} degrees off the planned angle (orbit needs about ${ORBIT_PLAN.need} km/s, level). Goddard said ${con.goddard.go ? 'GO' : 'NO-GO'}.`,
      );
    con.phase = 'insertion';
    if (con.shift) {
      con.shift.remaining = 12;
      if (con.shift.pending?.desk === 'network') {
        con.shift.pending.left = 4;
        con.insertionFix = 4;
      } else if (con.shift.pending) finishShiftReport(con);
    }
    return roomChanged();
  }
  const shuttle = con.round.vehicle === 'shuttle';
  if (end.outcome === 'aborted' || end.outcome === 'breakup') {
    if (end.outcome === 'aborted')
      speak(
        con,
        'morgan',
        shuttle
          ? 'Abort flying. The engines that are left carry her down short of orbit, to the abort site.'
          : 'The escape system fired. The capsule is coming down in the Atlantic abort area.',
        'warn',
      );
    else
      speak(
        con,
        'morgan',
        shuttle
          ? 'She broke up! Both boosters are gone and the stack is coming apart. There is no way out from that seat.'
          : 'She broke up! The abort sensing pulled the capsule clear. She is coming down in the Atlantic.',
        'bad',
        6,
      );
    if (con.kind === 'flight')
      note(
        `T+${end.abortedAt} s: the flight was aborted and the ${shuttle ? 'orbiter came down at the abort site' : 'capsule came down'} about ${Math.round(end.landing / 10) * 10} km downrange${shuttle ? '' : ', in the Atlantic abort area'}.`,
      );
  }
  con.aim = null;
  con.phase = 'coast';
  con.coastLeft = 3;
  roomChanged();
}

// Your answer to the flight's open question, from the console.
export function consoleDecide(choice) {
  const con = g.console;
  if (!con || con.phase !== 'mission' || !con.flight?.decision?.mine) return;
  answer(con, choice, speak);
}

export function consoleShift(action) {
  const c = g.console,
    shift = c?.shift;
  if (!shift || !['ascent', 'insertion'].includes(c.phase)) return;
  if (action === 'checkout' || action === 'rendezvous') {
    shift.plan = action;
    note(`Flight's working plan: ${action === 'checkout' ? 'orbital checkout only' : 'rendezvous'}.`);
  } else {
    if (shift.pending || !['booster', 'network'].includes(action)) return;
    if (c.phase === 'insertion') {
      if (action !== 'network' || c.insertionFix) return;
      c.insertionFix = 4;
    }
    shift.pending = { desk: action, left: c.phase === 'ascent' ? 12 : 4 };
    speak(
      c,
      'you',
      action === 'booster'
        ? 'Booster, confirm the active stage and thrust.'
        : 'Network, give me an independent tracking fix.',
    );
  }
  roomChanged();
}

function finishShiftReport(c) {
  const shift = c.shift,
    { desk } = shift.pending;
  shift.pending = null;
  const last = c.trace.at(-1);
  let report;
  if (desk === 'booster') {
    report =
      c.phase === 'insertion'
        ? 'Booster: cutoff confirmed.'
        : `Booster: ${last.stage || 'boost'} active, ${last.acc.toFixed(1)} g.`;
  } else if (c.phase === 'insertion') {
    c.goddard = goddard(c.round);
    report = `Network: independent fix reads ${c.goddard.go ? 'a holding orbit' : 'an orbit below the limit'}.`;
  } else {
    report = `Network: tracking puts us ${Math.abs(last.off).toFixed(1)}° off the planned path. Orbit fix follows cutoff.`;
  }
  shift.reports[desk] = report;
  speak(c, desk === 'booster' ? 'albrecht' : 'morgan', report, 'go', 7);
  note(report);
  roomChanged();
}

// Flight's call at insertion: commit the working plan or return while the abort area is still reachable.
export function consoleInsertion(choice) {
  const con = g.console;
  if (!con || con.phase !== 'insertion') return;
  const gemini = con.kind === 'flight' && con.flightId === 'gem-6' && !con.auto;
  if (choice === 'fix') {
    if (!gemini || con.insertionFix) return;
    if (con.shift) return consoleShift('network');
    con.insertionFix = 4;
    passMinutes(con.insertionFix);
    con.goddard = goddard(con.round);
    const report = `Network: second fix is in. Goddard reads ${con.goddard.go ? 'a holding orbit' : 'an orbit below the limit'}. Four minutes spent.`;
    speak(con, 'morgan', report, 'warn', 7);
    note(report);
    return roomChanged();
  }
  const expired = choice === 'expire' && con.shift?.remaining === 0;
  if (!expired && typeof choice !== 'boolean' && (!gemini || !['correct', 'reduced'].includes(choice))) return;
  // A window that closes without a call from Flight goes with Goddard's reading (Aaron, 11 November 2026): a good orbit
  // is kept, and a bad one comes home. Flight's chance to correct the orbit or change the plan has gone.
  const go = expired ? con.goddard.go : choice !== false;
  const correction = choice === 'correct' ? 0.04 : 0;
  const end = con.round.end,
    good = end.margin + correction >= 0;
  con.calls.insertion = { go, right: go === good, goddard: con.goddard.go, ...(expired ? { expired: true } : {}) };
  insertion(con.round, go, correction);
  if (gemini && go) {
    con.insertionPlan = {
      reserve: correction ? 55 : 100,
      reduced: choice === 'reduced' || con.shift?.plan === 'checkout',
      delay: con.shift ? 12 - con.shift.remaining : con.insertionFix || 0,
    };
    if (correction)
      speak(con, 'kessler', 'Orbit correction committed. We have 55 percent of the maneuver reserve left.', 'warn');
    if (con.insertionPlan.reduced)
      speak(con, 'you', 'Keep the orbital checkout. Stand down the rendezvous team.', 'warn');
  }
  if (con.kind === 'flight')
    note(
      expired
        ? `The insertion window closed without a call from Flight. The team went with Goddard: ${go ? 'GO for orbit' : 'NO-GO, and the early return'}.`
        : `Insertion: ${con.auto ? nameOf('tate') : 'you'} called ${go ? 'GO for orbit' : 'NO-GO'}${go === con.goddard.go ? ', with Goddard' : ', against Goddard'}.`,
    );
  if (!go) {
    if (expired) {
      speak(
        con,
        'tate',
        "Retro: the window's closed, and Goddard has her below the limit. Executing the early return.",
        'warn',
      );
    } else if (flightDirector() && !con.auto) {
      speak(con, 'you', 'Flight is no-go for orbit. Retro, bring her down in the abort area.', 'bad');
      speak(con, 'tate', 'Retro copies. Recovery, stand by for the early return.', 'warn');
    } else {
      speak(con, retroWho(con), 'Flight, Retro: no-go. Bring her down in the abort area.', 'bad');
      speak(con, 'hollis', "Fire the retros. Recovery, she's yours.", 'warn');
    }
    con.aim = null;
    con.phase = 'coast';
    con.coastLeft = 3;
    return roomChanged();
  }
  const directing = flightDirector() && !con.auto;
  if (expired) speak(con, 'tate', "Retro: the window's closed. Going with Goddard: we are go for orbit.", 'warn');
  else speak(con, retroWho(con), directing ? 'Flight is go for orbit.' : 'Flight, Retro: we are go for orbit.', 'go');
  if (end.outcome === 'decay') {
    speak(con, 'hollis', 'We have a go!', 'go');
    speak(
      con,
      'morgan',
      "Flight, Network: Bermuda's radar has her perigee too low. She will not make one orbit.",
      'bad',
      7,
    );
    if (con.kind === 'flight')
      note(
        "Bermuda's radar showed the orbit too low to hold. The capsule came down within the first orbit, far from any ship.",
      );
    con.aim = null;
    con.phase = 'coast';
    con.coastLeft = 3;
    return roomChanged();
  }
  if (con.flightId) {
    if (!directing) speak(con, 'hollis', 'We have a go!', 'go');
    if (con.kind === 'sim') return finishSim(con);
    return startFlight(con);
  }
  const o = inOrbit(con.round);
  con.status = { orbit: 1, station: 'Bermuda', fuel: 1, seg51: 'off', attitude: 'normal', window: null };
  con.orbitT = 5;
  con.pass = 0;
  con.retroAt = (ORBIT_PLAN.orbits - 1) * ORBIT_PLAN.period + STATIONS.find(s => s.name === 'California').at;
  con.orbitInfo = { signal: o.signal, flicker: o.flicker };
  con.phase = 'orbit';
  speak(con, 'hollis', 'We have a go for at least seven orbits!', 'go');
  roomChanged();
}

// The orbits go by as the stations report. The clock runs fast between them.
function tickOrbit(con, dt) {
  const o = con.round.orbit,
    P = ORBIT_PLAN,
    before = con.orbitT;
  con.orbitT = Math.min(con.retroAt, con.orbitT + ORBIT_RATE * Math.min(4, g.speed) * dt);
  g.clock += con.orbitT - before;
  con.status.fuel = fuelAfter(o, con.orbitT / P.period);
  con.status.orbit = Math.min(P.orbits, 1 + Math.floor(con.orbitT / P.period));
  const passes = [];
  for (let n = 0; n < P.orbits; n++) for (const st of STATIONS) passes.push({ n, st, at: n * P.period + st.at });
  while (con.pass < passes.length && passes[con.pass].at <= con.orbitT) stationPass(con, passes[con.pass++]);
  if (con.orbitT >= con.retroAt) {
    con.phase = o.signal && !con.pack ? 'pack' : 'retro';
    speak(
      con,
      'hollis',
      con.phase === 'pack'
        ? `${callsign(con)}, we are coming up on retrofire. What about that retro pack?`
        : con.auto
          ? `Engineering, ${nameOf('tate')} fires on the automatic system unless you tell me those scanners are bad. Well?`
          : 'Retro, California has her. Give me retrofire.',
      'warn',
      6,
    );
    roomChanged();
  }
}

// What a ground station reports as the capsule passes over. Only some passes have anything to say.
function stationPass(con, { n, st }) {
  const o = con.round.orbit,
    s = con.status,
    t = pilotId() ? CREW_TRAITS[pilotId()] : null;
  s.station = st.name;
  if (st.name === 'Bermuda' && n > 0)
    speak(con, 'morgan', `Bermuda has her on orbit ${n + 1}. Fuel ${pctFuel(s.fuel)}.`, s.fuel < 0.4 ? 'warn' : '');
  // The window against the gauges: a bad scanner shows here, if the pilot says so plainly.
  if (st.name === 'Muchea, Australia' && n === 0 && pilotId()) {
    const plain = t.candour >= 0.5;
    s.window = o.scanner
      ? plain
        ? 'The horizon through the window is well off where the gauges have it: twenty degrees or more in yaw.'
        : 'The gauges look normal. The view out the window looks a little odd.'
      : 'The window and the gauges agree.';
    speak(
      con,
      'pilot',
      `Muchea, ${s.window[0].toLowerCase()}${s.window.slice(1)}`,
      o.scanner && plain ? 'warn' : '',
      6,
    );
    if (con.kind === 'flight') note(`Over Muchea, ${pilotName()}: "${s.window}"`);
  }
  if (st.name === 'Hawaii' && o.scanner && n >= 1)
    speak(con, 'morgan', `Hawaii: fuel is going fast on the automatic system. ${pctFuel(s.fuel)} left.`, 'warn', 6);
  // Segment 51: the landing-bag light, first seen as she comes over Texas at the end of the first orbit.
  if (st.name === 'Texas' && n === 0 && o.signal) {
    s.seg51 = o.flicker ? 'flickering' : 'steady';
    speak(
      con,
      'morgan',
      `Flight, Network: Segment 51 is showing on telemetry. Landing bag deployed. It is ${s.seg51}.`,
      'bad',
      7,
    );
    speak(
      con,
      'hollis',
      `If that bag is down, the heat shield is only held by the retro pack straps. ${con.auto ? 'Engineering, is that shield loose?' : 'Retro, think about it.'}`,
      'warn',
      7,
    );
    if (con.kind === 'flight')
      note(
        `Over Texas at the end of the first orbit, Segment 51 showed: the landing bag deployed, which would mean the heat shield is loose. The signal was ${s.seg51}. ${pilotName()} has no light in the cabin and has heard nothing.`,
      );
  }
  if (st.name === 'Muchea, Australia' && n === 1 && o.signal)
    speak(con, 'morgan', `Muchea: Segment 51 still ${s.seg51}.`, 'warn');
}

// Keep the retro pack on through entry, or jettison it as planned.
export function consolePack(choice) {
  const con = g.console;
  if (!con || con.phase !== 'pack') return;
  con.pack = choice;
  con.calls.pack = choice;
  speak(
    con,
    'you',
    choice === 'keep'
      ? `Flight, ${callsign(con)}: leave the retro pack on through entry. The straps hold the shield until the air does.`
      : `Flight, ${callsign(con)}: jettison the pack as planned. I read Segment 51 as a bad switch.`,
    choice === 'keep' ? 'warn' : '',
  );
  speak(con, 'hollis', choice === 'keep' ? 'Pass it to him. Keep the pack on.' : 'Your call. Jettison as planned.', '');
  if (con.kind === 'flight')
    note(
      `You advised ${choice === 'keep' ? 'keeping the retro pack on through entry' : 'jettisoning the retro pack as planned'}.`,
    );
  con.phase = 'retro';
  roomChanged();
}

// Retrofire: on the automatic system, or by hand on the window.
export function consoleRetro(how) {
  const con = g.console;
  if (!con || con.phase !== 'retro') return;
  con.calls.retro = how;
  const e = retrofire(con.round, how, con.pack || 'jettison');
  if (con.auto)
    speak(
      con,
      'you',
      how === 'auto'
        ? 'Flight, Engineering: the scanners are good. Fire on the automatic system.'
        : "Flight, Engineering: I don't trust those scanners. Have him fire by hand on the window.",
      how === 'auto' ? 'go' : 'warn',
    );
  speak(
    con,
    retroWho(con),
    how === 'auto'
      ? 'Retrofire on the automatic sequence. Five, four, three, two, one, fire.'
      : `${first()}, fire them by hand on the window. Five, four, three, two, one, fire.`,
    'go',
    6,
  );
  speak(
    con,
    'pilot',
    'Retros firing. One… two… three. Retro pack jettison ' + (con.pack === 'keep' ? 'held.' : 'green.'),
    'go',
    6,
  );
  if (con.kind === 'flight')
    note(
      `Retrofire over California, ${how === 'auto' ? 'on the automatic system' : 'fired by hand'}${con.pack === 'keep' ? ', retro pack kept on' : ''}. Fuel at retrofire ${pctFuel(con.status.fuel)}.`,
    );
  if (e.oscillated) speak(con, 'pilot', "Fuel's gone. She's swinging. I can't hold her.", 'bad', 6);
  speak(con, 'morgan', 'Blackout. We have lost her signal.', 'warn');
  con.phase = 'entry';
  con.coastLeft = 3;
  roomChanged();
}

// Out of the blackout, or not.
function afterEntry(con) {
  const e = con.round.end;
  if (e.capsule === 'lost') {
    speak(con, 'morgan', 'No signal. Nothing on the radars. She has not come out of blackout.', 'bad', 8);
    if (con.kind === 'flight') note('The capsule never came out of the blackout.');
    con.aim = null;
    con.phase = 'coast';
    con.coastLeft = 2;
    return roomChanged();
  }
  // A winged orbiter lands on a runway: no parachutes, no splashdown point, and nothing for Recovery to aim at.
  if (con.round.vehicle === 'shuttle') {
    speak(con, pilotId() ? 'pilot' : 'morgan', 'Main gear touchdown… nose gear down. Wheels stop.', 'go', 6);
    con.aim = null;
    con.phase = 'coast';
    con.coastLeft = 2;
    return roomChanged();
  }
  con.ip = con.flightId ? flightPredictions(con.round) : orbitPredictions(con.round);
  speak(
    con,
    pilotId() ? 'pilot' : 'reyes',
    pilotId()
      ? 'Out of the blackout. Drogue is out… main chute is out and good!'
      : 'Recovery has her beacon. Mains are out.',
    'go',
    6,
  );
  speak(
    con,
    'morgan',
    con.flightId
      ? `Splashdown predictions, from the planned point: the spacecraft's computer says ${km(con.ip.retro)}. The tracking ship's radar can give a fix if Recovery waits for it.`
      : `Splashdown predictions, from the planned point: retrofire telemetry says ${km(con.ip.retro)}. Grand Turk's radar can give a fix if Recovery waits for it.`,
    '',
    7,
  );
  con.phase = 'ip';
  roomChanged();
}

// Recovery's board after an orbital flight.
// A Shuttle's homecoming: the runway, the convoy, and no ships at all.
function splashRunway(con, end, lines) {
  if (end.capsule === 'lost' && end.outcome === 'entry') {
    con.hours = null;
    lines.push(
      end.skip
        ? 'She came in too shallow and skipped back out of the atmosphere. Nothing was heard from her again.'
        : 'There was nothing to recover. The search aircraft found a slick and some charred pieces of the tiles.',
    );
    return;
  }
  con.hours = 0.4;
  con.sank = false;
  const mins = Math.round(con.hours * 60);
  const site = con.flight?.state?.edwards ? 'the lakebed runway at Edwards' : "the Cape's runway";
  if (end.outcome === 'entry') lines.push(`Down on ${site}, ${km(end.miss)} of the mark.`);
  else if (end.outcome === 'decay')
    lines.push('She came down within the first orbit, short of any runway, far from any convoy.');
  else
    lines.push(
      `She came down at the abort landing site, about ${Math.round(end.landing / 10) * 10} km downrange of the Cape.`,
    );
  lines.push(`The convoy reached her ${mins} minutes after she rolled to a stop.`);
  if (end.capsule === 'damaged')
    lines.push('She rolled out scorched and battered: the tiles took more than they were built for.');
  else lines.push('She rolled out whole, and the ground crew swarmed her with sniffers and cameras.');
}

function splashOrbit(con, end, trained, lines) {
  // The orbiter comes home on a runway: the convoy reaches her in minutes, and there is nothing to sink.
  if (con.round.vehicle === 'shuttle') return splashRunway(con, end, lines);
  if (end.capsule === 'lost' && end.outcome === 'entry') {
    con.hours = null;
    lines.push(
      end.stranded
        ? 'There was nothing to recover. The spacecraft is still in lunar orbit.'
        : end.fire
          ? 'The ships reached her in the Pacific. The cabin was burnt out.'
          : end.skip
            ? 'She came in too shallow and skipped back out of the atmosphere. Nothing was heard from her again.'
            : 'There was nothing to recover. The search aircraft found a slick and some charred pieces of the heat shield.',
    );
    return;
  }
  const aim = con.aim ? con.ip[con.aim] : 0,
    waited = con.aim === 'radar';
  con.hours = con.flightId
    ? flightRecoveryHours(end, aim, con.cond, trained, waited, orbitRecoveryHours)
    : orbitRecoveryHours(end, aim, con.cond, trained, waited);
  if (end.secondary) lines.push('She came down in the secondary area, where one destroyer waits and no carrier.');
  con.sank = con.kind === 'flight' && sinks(con.round, con.hours);
  const mins = Math.round(con.hours * 60);
  if (end.outcome === 'entry') lines.push(`Splashdown ${km(end.miss)} of the planned point.`);
  else if (end.outcome === 'decay')
    lines.push(
      `She came down within the first orbit, about ${Math.round(end.landing / 100) * 100} km downrange of the Cape, far from any recovery ship.`,
    );
  else
    lines.push(
      `She came down in the Atlantic abort area, about ${Math.round(end.landing / 10) * 10} km downrange of the Cape.`,
    );
  lines.push(
    con.hours > 3
      ? `She was picked up ${con.hours.toFixed(1)} hours after splashdown.`
      : `She was picked up ${mins} minutes after splashdown.`,
  );
  if (end.chute)
    lines.push(
      'One of her three main parachutes collapsed on the way down. She came down on two, harder than she was meant to.',
    );
  if (con.sank) lines.push('She took on water and sank before she was reached.');
  else if (end.capsule === 'damaged')
    lines.push(
      end.oscillated
        ? 'She swung through the entry with no fuel to damp her, and came back scorched and battered.'
        : 'The capsule came back scorched and damaged: she took more than she was built for.',
    );
  else lines.push(con.flightId ? 'The spacecraft came back whole.' : 'The capsule came back whole.');
}

const orbitSimFailure = con => (Object.values(boosterOf(con).names).includes(con.scenario) ? con.scenario : 'nominal');

// ---- The route to the Moon, 1962 ----
// After a round whose SEASON entry has `after: 'route'`: the calendar goes to the meeting, once.
export function sceneAfterReview() {
  const after = SEASON[g.roundIndex].after;
  if (after === 'workshop' && !g.record.scenes?.workshop?.done) {
    g.day = Math.max(g.day, WORKSHOP_DAY);
    g.clock = g.day * 1440 + 14 * 60;
    return 'sWorkshop';
  }
  if (after === 'apollo8' && !g.record.scenes?.apollo8) {
    g.day = Math.max(g.day, APOLLO8_DAY);
    g.clock = g.day * 1440 + 8 * 60;
    return 'sApollo8';
  }
  if (after !== 'route' || g.record.scenes?.route) return null;
  g.day = Math.max(g.day, ROUTE_DAY);
  g.clock = g.day * 1440 + 7 * 60 + 30;
  return 'sRoute';
}
// What the meeting can see of your record: how close your orbital flights came down to the planned point.
export function orbitMisses() {
  return (g.record.orbitMisses || []).slice();
}
// Your case in the meeting. The decision is NASA's, and it went to lunar-orbit rendezvous; your view goes on your record,
// and earns trust where your flights back it.
export function routeArgue(mode) {
  if (g.beat !== 'sRoute' || !ROUTE_MODES[mode] || g.record.scenes?.route) return null;
  const misses = orbitMisses(),
    best = misses.length ? Math.min(...misses.map(Math.abs)) : null;
  const evidence =
    best == null
      ? 'none of your flights reached orbit and came home on a computed point'
      : `your best orbital splashdown was ${Math.round(best)} km from the planned point`;
  let lines,
    tone = '';
  if (mode === 'lor') {
    const backed = best != null && best <= 60;
    if (backed) {
      shiftTrust(g.record, 1);
      tone = 'go';
    }
    lines = [
      [
        'hollis',
        backed
          ? `Retro's numbers are why I believe we can find the mother ship from the Moon: ${evidence}.`
          : "It's the light way, and I'll back it. I'd like better navigation numbers than we have, Retro.",
      ],
    ];
  } else if (mode === 'eor')
    lines = [
      ['albrecht', 'Huntsville thanks you.'],
      ['hollis', 'Close to home is safer, I grant you. It is also four Saturns and a fuel transfer nobody has tried.'],
    ];
  else
    lines = [
      [
        'hollis',
        "Nobody has a Nova, Retro, and nobody wants to land a ten-storey ship backwards on ground we haven't seen.",
      ],
    ];
  (g.record.scenes = g.record.scenes || {}).route = { view: mode, day: g.day, evidence };
  for (const [who, text] of lines) say(who, text, tone, 9);
  const reply = lines.map(([who, text]) => `${g.people[who].name.split(' ').pop()}: "${text}"`).join(' ');
  note(
    `The route to the Moon: you argued for ${ROUTE_MODES[mode].name.toLowerCase()}, citing that ${evidence}. ${reply}`,
  );
  note(
    `${nameOf('albrecht')} came back from Huntsville: Marshall has come round to lunar-orbit rendezvous. NASA announced it on ${ROUTE_ANNOUNCED}. Apollo will fly a command ship and a lunar lander.`,
  );
  g.mission.route = { mode, reply };
  roomChanged();
  return reply;
}
// Leave the meeting: on to the next round, or the end of the years in this build.
export function routeDone() {
  if (g.beat !== 'sRoute' || !g.record.scenes?.route) return;
  g.room = null;
  morning(nextIndexFn() != null ? 'roundEnd' : 'seasonEnd');
}

// ---- The Apollo 8 decision, August 1968 ----
export const APOLLO8_DAY = dayOf(1968, 8, 9);
export const APOLLO8_OPTIONS = {
  moon: 'Send it round the Moon in December: ten orbits and home, without the lander.',
  earth: 'Fly it as planned, in Earth orbit, and wait for the lander to be ready.',
};
// What the room knows: the lander is months late, the last Saturn V shook, and the intelligence says the Russians may
// send men round the Moon in a Zond before the year is out.
export function apollo8Brief() {
  const zond = raceHeard(g.seed, 'zond', g.day);
  return { zond, slip: g.programme.apolloSlip || 0, pogoFixed: g.programme.adopted.includes('pogo') };
}
// Your view in the meeting decides what Apollo 8 flies. It goes on your record, and the review judges it against what
// the Russians did.
export function apollo8Decide(choice) {
  if (g.beat !== 'sApollo8' || !APOLLO8_OPTIONS[choice] || g.record.scenes?.apollo8) return;
  (g.record.scenes = g.record.scenes || {}).apollo8 = { choice, day: g.day };
  g.record.apollo8 = choice;
  const lines =
    choice === 'moon'
      ? [['hollis', "Then that's what I take to Washington. Round the Moon at Christmas. God help us if we're wrong."]]
      : [['hollis', 'Earth orbit, then. The lander will be ready in the spring, and we go round the Moon with it.']];
  for (const [who, text] of lines) say(who, text, choice === 'moon' ? 'go' : '', 9);
  note(
    `The Apollo 8 meeting: you argued to ${APOLLO8_OPTIONS[choice].toLowerCase()} ${nameOf('hollis')}: "${lines[0][1]}"`,
  );
  roomChanged();
}
export function apollo8Done() {
  if (g.beat !== 'sApollo8' || !g.record.scenes?.apollo8) return;
  g.room = null;
  morning(nextIndexFn() != null ? 'roundEnd' : 'seasonEnd');
}

// ---- The workshop, 14 May 1973 ----
// Skylab went up on the last Saturn V. Whether her shield tore away in the climb is the hidden layer's draw from the
// game's seed (skylabShield), but once she is in orbit the telemetry shows it to everyone: the temperatures climb, and
// the main wings never report deployed. The room decides how to fly her empty, and when the crew goes.
export const WORKSHOP_DAY = dayOf(1973, 5, 14);
export const WORKSHOP_CALLS = {
  attitude: {
    q: 'How does she fly until the crew gets there?',
    options: {
      pitch:
        "Pitch her nose up off the Sun, about fifty degrees. The inside comes down toward forty degrees, and the telescope mount's wings give less power: the batteries will cycle hard.",
      sun: 'Keep her pointed at the Sun for full power from the telescope mount, and let the inside bake past fifty.',
    },
  },
  crew: {
    q: 'When does the first crew go?',
    options: {
      wait: 'Hold them ten days. Build the parasol and the sail, and try them and the cable cutters in the Huntsville water tank first.',
      rush: 'Fly them as soon as the stack is ready, with whatever shade the engineers can build in a week.',
    },
  },
};
// What the room can see: the workshop's telemetry.
export function workshopBrief() {
  return { shield: skylabShield(g.seed), done: g.record.scenes?.workshop || {} };
}
// The open calls, in order: none at all if she came up whole.
export const workshopOpen = () => {
  const b = workshopBrief();
  return b.shield ? Object.keys(WORKSHOP_CALLS).filter(k => !b.done[k]) : [];
};
export function workshopDecide(call, choice) {
  if (g.beat !== 'sWorkshop' || !WORKSHOP_CALLS[call]?.options[choice] || workshopOpen()[0] !== call) return;
  (g.record.scenes = g.record.scenes || {}).workshop = { ...g.record.scenes.workshop, [call]: choice, day: g.day };
  const lines = {
    pitch: ["Pitch her up, then. EECOM, watch those batteries like they're your own.", 'go'],
    sun: ["Full power it is. She'll be an oven when they open the hatch.", 'warn'],
    wait: [
      'Ten days. Huntsville gets the tank tonight, and the crew gets the parasol in their hands before they fly.',
      'go',
    ],
    rush: ["We fly as soon as the stack's ready. They'll have to work it out up there.", 'warn'],
  }[choice];
  say('hollis', lines[0], lines[1], 9);
  note(`The workshop meeting: ${WORKSHOP_CALLS[call].options[choice]}`);
  roomChanged();
}
export function workshopDone() {
  if (g.beat !== 'sWorkshop' || workshopOpen().length) return;
  (g.record.scenes = g.record.scenes || {}).workshop = { ...g.record.scenes.workshop, done: true };
  g.room = null;
  morning(nextIndexFn() != null ? 'roundEnd' : 'seasonEnd');
}

// ---- The project engineer: Hangar S, the test rooms, and the back room on flight day ----
function engineerBrief() {
  g.mission.checkout = g.mission.checkout || {};
  g.mission.flags = g.mission.flags || {};
  g.mission.quals = g.mission.quals || {};
  const launch = dateText(g.roundStart + LAUNCH_DAY);
  const line = flightOf()
    ? `${flightOf().craft} flies${crewNames() ? ` ${crewNames()}` : ', with no crew,'} on ${launch}. ${programmeOffice() ? "The stack's yours today" : "The spacecraft's yours today, Engineering"}: the checkout in the ${placeName('hangar')}, and whatever tests you want run. Flag anything you don't like. A flag means a day's rework and a day's slip, so make it count.`
    : `We fly ${pilotName()} on ${launch}. The capsule's yours today, Engineering: Hangar S, and whatever tests you want run. Flag anything you don't like. A flag means a day's rework and a day's slip, so make it count.`;
  say('hollis', line, '', 8);
  note(`${cap(SEASON[g.roundIndex].name)}. ${nameOf('hollis')}: ${line}`);
  if (pilotId()) {
    place('pilot', 1180);
    g.people.pilot.hidden = false;
  }
  g.objective = `Check the spacecraft out in ${placeName('hangar')} and run qualification tests in the ${placeName('stand').toLowerCase()}. Flag what you don't like, then end the day.`;
  g.dayDone = true;
}
// A reading that depends only on the round and what is looked at: no draw is taken, so looking never shifts the flight.
function glance(seed, key) {
  let h = Math.imul(
    (seed | 0) ^ [...key].reduce((a, ch) => Math.imul(a ^ ch.charCodeAt(0), 16777619), 2166136261),
    2246822507,
  );
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const busy = minutes => {
  g.clock += minutes;
  roomChanged();
};
// Look over one of the capsule's spots: what McDonnell's crew shows you, and whether anything catches your eye.
export function lookSpot(id) {
  if (!engineer() || !capsuleSpots().includes(id) || g.mission.checkout[id]) return;
  const spot = KITS[g.vehicle].spots[id],
    cue = g.round.cues[id];
  g.mission.checkout[id] = { name: spot.name, text: cue ? `${spot.sound} ${spot.cue}` : spot.sound, cue };
  note(`Hangar S, ${spot.name.toLowerCase()}: ${g.mission.checkout[id].text}`);
  busy(LOOK_MINUTES);
}
// Run a qualification test: its trace is in band or not. A fault shows most of the time; a sound part now and then
// shows a bad trace too.
export function runQual(id) {
  const t = qualTests()[id];
  if (!engineer() || !t || g.mission.quals[id]) return;
  const fault = t.fault && Object.values(g.round.faults).includes(t.fault),
    r = glance(g.round.seed, id);
  const bad = t.fault ? (fault ? r < 0.75 : r < 0.1) : false;
  g.mission.quals[id] = { name: t.name, what: t.what, text: bad ? t.bad : t.good, bad };
  note(`${t.name}: ${g.mission.quals[id].text}`);
  busy(t.minutes);
}
export function flagSpot(id) {
  if (!engineer() || !capsuleSpots().includes(id) || g.beat !== 'mBrief') return;
  g.mission.flags[id] = !g.mission.flags[id];
  roomChanged();
}
// Overnight before launch, Hangar S reworks what you flagged. Any flag slips the launch a day.
function rework() {
  if (g.mission.reworked) return;
  g.mission.reworked = true;
  const flagged = Object.keys(g.mission.flags || {}).filter(id => g.mission.flags[id]);
  g.mission.found = [];
  if (!flagged.length) return;
  for (const id of flagged) {
    const name = KITS[g.vehicle].spots[id].name.toLowerCase();
    if (g.round.faults[id]) {
      g.mission.found.push(id);
      delete g.round.faults[id];
      note(
        `Hangar S took the ${name} apart on your flag and found ${FAULT_AT_SPOT_TEXT[KITS[g.vehicle].spots[id].fault]}. Reworked.`,
      );
    } else note(`Hangar S took the ${name} apart on your flag and found nothing wrong.`);
  }
  g.slipDays += 1;
  g.day += 1;
  g.clock += 1440;
  say('hollis', `Hangar S worked your flags overnight. We fly a day late, ${dateText()}.`, 'warn', 6);
}
const FAULT_AT_SPOT_TEXT = new Proxy(
  { shield: 'a landing-bag latch that did not seat', scanner: 'a horizon scanner out of calibration' },
  { get: (o, k) => o[k] || (FAULT_AT_SPOT[k] ? FAULT_AT_SPOT[k][0].toLowerCase() + FAULT_AT_SPOT[k].slice(1) : k) },
);

// Tate's calls on the Retrofire console when you are in the back room. Returns true when he made one this frame.
function tateCalls(con) {
  if (con.poll) {
    consolePoll(boardGood(con));
    return true;
  }
  if (con.phase === 'insertion') {
    consoleInsertion(con.goddard.go);
    return true;
  }
  if (con.phase === 'ip') {
    consoleAim(tateAim(con));
    return true;
  }
  if (con.phase === 'pad') {
    padChoose('wait');
    return true;
  }
  const last = con.trace[con.trace.length - 1];
  if (con.phase === 'ascent' && con.abortAt == null && last && Math.abs(last.off) > ABORT_LIMIT + 0.5) {
    consoleAbort();
    return true;
  }
  return false;
}

// How Hollis sees the project engineer's work: what Hangar S found on your flags, and your answers on flight day.
function engineerJudgement(calls) {
  const out = [],
    o = g.round.orbit,
    m = g.mission;
  if ((m.found || []).length) {
    shiftTrust(g.record, 1);
    out.push(
      `${nameOf('hollis')} on your flags: "Hangar S found ${m.found.map(id => FAULT_AT_SPOT_TEXT[KITS[g.vehicle].spots[id].fault]).join(' and ')} because you flagged it."`,
    );
  } else if (Object.values(m.flags || {}).some(Boolean))
    out.push(`${nameOf('hollis')} on your flags: "Nothing in what you flagged, and a day gone."`);
  if (o && o.signal && calls.pack) {
    if (o.loose && calls.pack === 'keep') {
      shiftTrust(g.record, 1);
      out.push(
        `${nameOf('hollis')} on the retro pack: "You told me the shield might be loose, and it was. Those straps held it."`,
      );
    } else if (o.loose) {
      shiftTrust(g.record, -1);
      out.push(`${nameOf('hollis')} on the retro pack: "You told me the shield was tight. It wasn't."`);
    } else out.push(`${nameOf('hollis')} on the retro pack: "A bad switch, as it turned out."`);
  }
  if (o && calls.retro) {
    if (o.scanner && calls.retro === 'manual') {
      shiftTrust(g.record, 1);
      out.push(`${nameOf('hollis')} on retrofire: "You said not to trust the scanners. You were right."`);
    } else if (o.scanner)
      out.push(
        `${nameOf('hollis')} on retrofire: "You cleared the scanners, and one was bad. ${Math.round(Math.abs(g.round.end.miss || 0))} km off the point."`,
      );
    else if (calls.retro === 'manual')
      out.push(
        `${nameOf('hollis')} on retrofire: "The scanners were good. We gave away a few seconds and some fuel for nothing."`,
      );
  }
  return {
    text: out.join(' '),
    calls: {
      abort: null,
      aim: calls.aim || null,
      hours: calls.hours ?? null,
      pack: calls.pack,
      retro: calls.retro,
      engineer: true,
    },
  };
}

// Registered with game.js at load, so game.js need not import this file (see registerCrewed there).
registerCrewed(MERCURY_BEATS, { startMission, missionRoomFor, tickConsole, consoleLive, sceneAfterReview });
