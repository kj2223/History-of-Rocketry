// MERCURY CONTROL: a Mercury flight worked from the Retrofire officer's console, and the training sims. No DOM, no drawing.
// The day before launch is for the simulator; on launch day you give your status in the count, watch the trajectory plot
// and call an abort if she goes off her line, then tell Recovery where to send the helicopters. Afterwards the flight
// director reviews the flight with you, the way Ellis did at White Sands.
//
// The console shows only what Mercury Control could see: the flight-path angle, velocity and acceleration on telemetry,
// the radar's and the computers' impact points, and the recovery board. The truth behind them is in truth/capsule.js.
// What the rooms read is g.console and g.mission, never the round itself.
import { g, say, note, walk, place, placeName, roomChanged, morning, setBeat, finishReview, dateText, nextIndex as nextIndexFn } from './game.js';
import { ascent, outcome, stepAt, impactPredictions, recoveryHours, sinks, padCrewNow, conditions, plannedGamma, crewFate, PLAN, ABORT_LIMIT } from './truth/capsule.js';
import { atlasAscent, atlasOutcome, goddard, insertion, inOrbit, fuelAfter, retrofire, orbitPredictions, orbitRecoveryHours, orbitGamma, ORBIT_PLAN, FUEL_LOW } from './truth/orbit.js';
import { CREW_TRAITS, consents, ownAbortAt, impatient } from './world/crew.js';
import { ASTRONAUTS } from './data/crew.js';
import { newRound, ellisReading } from './truth/round.js';
import { draw } from './core/rng.js';
import { KITS, SHORT } from './data/kits.js';
import { SEASON } from './data/campaign.js';
import { MERCURY_COUNT, UNITS, SEA_LIMIT, TAPES, PAD_OPTIONS, SIMS, SIM_MINUTES, ORBIT_UNITS, STATIONS, PACK_OPTIONS, RETRO_OPTIONS, ORBIT_TAPES, ORBIT_SIMS, CAPSULE_SPOTS, LOOK_MINUTES, QUAL_TESTS } from './data/mercury.js';
import { addSim, shiftTrust, TRUST } from './career/record.js';
import { ROUTE_DAY, ROUTE_MODES, ROUTE_ANNOUNCED } from './data/route.js';
import { adopt } from './world/programme.js';
import { startFlight, tickFlight, answer, flightOf, recordCapabilities, flightJudgement, flightCause } from './houston.js';
import { flightPredictions, flightRecoveryHours } from './truth/flights.js';
import { GEMINI_TAPES, GEMINI_SIMS, GEMINI_SPOTS, GEMINI_QUALS } from './data/gemini.js';
import { FAULT_AT_SPOT } from './data/kits.js';

export { ABORT_LIMIT, PLAN, UNITS, SEA_LIMIT, PAD_OPTIONS, SIMS, SIM_MINUTES, PACK_OPTIONS, RETRO_OPTIONS, ORBIT_PLAN, CAPSULE_SPOTS, QUAL_TESTS };
export const plannedAngle = plannedGamma;
// The programme this round belongs to: 'mercury', 'gemini' or 'apollo'.
export const programOf = () => (g.crewed && SEASON[g.roundIndex].crewed) || null;
// The spacecraft's spots and qualification tests for the checkout seats, by programme.
export const capsuleSpots = () => (programOf() === 'gemini' ? GEMINI_SPOTS : CAPSULE_SPOTS);
export const qualTests = () => (programOf() === 'gemini' ? GEMINI_QUALS : QUAL_TESTS);
// The booster's own names for its control failure and its early cutoff, and the tapes and sims that go with it.
const BOOSTERS = {
  atlas: { names: { guidance: 'guidance', shortburn: 'shortburn', booster: 'Atlas' }, tapes: ORBIT_TAPES, sims: ORBIT_SIMS },
  titan: { names: { guidance: 'titanctl', shortburn: 'stage2', booster: 'Titan II' }, tapes: GEMINI_TAPES, sims: GEMINI_SIMS },
};
const boosterOf = c => BOOSTERS[c.round.vehicle] || BOOSTERS.atlas;
// The planned flight-path angle at second t, for this console's booster.
export const plannedAngleFor = (c, t) => (c.orbital ? orbitGamma(t) : plannedGamma(t));
// The plan the console's plot is drawn against: burn time, cutoff velocity and angle.
export const planFor = c => (c.orbital ? ORBIT_PLAN : PLAN);
// Launch is planned the day after the round starts: a sim day, then launch day.
export const LAUNCH_DAY = 1;
// Count seconds per real second in Mercury Control, and flight seconds per real second on the trajectory plot.
const COUNT_RATE = 30, ASCENT_RATE = 2, COAST_SECONDS = 5, ORBIT_RATE = 12;

// ---- The days of a Mercury round ----
export const MERCURY_BEATS = {
  // The day before: the capsule and the booster are on the pad. The sims are open, and the day can end at any time.
  mBrief() {
    seatPeople();
    if (engineer()) return engineerBrief();
    g.rocket.where = 'tower'; g.rocket.mated = true;
    const launch = dateText(g.roundStart + LAUNCH_DAY);
    if (flightOf()) return houstonBrief(launch);
    const line = pilotId() ? `We fly ${pilotName()} on ${launch}. Today you're in the simulator, and so is he: the sim supervisor will throw everything he has at you both. If he has to trust your numbers, they had better be right.`
      : `We fly on ${launch}. Today you're in the simulator: the sim supervisor will throw everything he has at you. Learn the plot, Retro.`;
    if (pilotId()) { place('pilot', 1180); g.people.pilot.hidden = false; }
    say('hollis', line, '', 8);
    note(`${cap(SEASON[g.roundIndex].name)}. Hollis: ${line}`);
    g.objective = 'Train in the simulator in the training building. When you have had enough, end the day.';
    g.dayDone = true;
  },
  // Launch day: the recovery area's conditions are what they are this morning.
  mLaunch() {
    seatPeople();
    g.rocket.where = 'tower'; g.rocket.mated = true;
    if (engineer()) rework();
    g.mission.cond = conditions(g.round);
    g.objective = engineer() ? `Launch day. Go to the back room in ${placeName('office')}: Hollis will want the hardware answered for.` : `Launch day. Go to your console in ${placeName('office')} for the count.`;
    // Suited up in Hangar S, then out to the gantry and up into the capsule.
    if (pilotId()) { g.people.pilot.hidden = false; place('pilot', 690); walk('pilot', 2050); say('pilot', engineer() ? 'Morning. Is she a good one?' : 'Morning, Retro. Get me a good splashdown point.', '', 6); }
    if (flightOf()) say(engineer() ? 'hollis' : 'dorsey', engineer() ? 'Morning, Engineering. You\'re in the back room on the loop. If the spacecraft does anything odd, you answer for it.' : flightDirector() ? 'Morning, Flight. The room is yours from the count. I\'ve the night shift.' : 'Morning, Retro. Get on your console.', '', 6);
    else say('hollis', engineer() ? 'Morning, Engineering. Back room. If the hardware does anything odd, you answer for it.' : 'Morning, Retro. Get on your console. We pick up the count at T minus fifteen.', '', 6);
  },
  mFlight() {},
  // The count was scrubbed: the launch is tomorrow, in whatever weather tomorrow brings.
  mScrub() { g.objective = 'The launch is scrubbed until tomorrow. End the day when you are ready.'; g.dayDone = true; },
  // The capsule is on the pad on a live booster, left overnight.
  mPadNight() { g.objective = 'The capsule sits on the pad overnight while the batteries run down. End the day.'; g.dayDone = true; },
  mPadSafe() {
    seatPeople();
    g.objective = 'The pad crew is safing the capsule. Then Hollis wants the review in Mercury Control.';
    say('vega', 'Batteries are flat and the oxygen\'s boiled off. We\'re going out to her now.', '', 6);
    g.mission.pad = 'safed';
    note('Next morning the pad crew safed the capsule and drained the booster. The capsule and the booster can both fly again.');
    setBeat('mReview');
  },
  // The route-to-the-Moon meeting, a scene after the round whose SEASON entry names it in `after`.
  sRoute() {
    seatPeople();
    g.objective = 'The centres are arguing how Apollo goes to the Moon. Hollis wants you in the meeting in Mercury Control.';
    say('hollis', 'Retro, you\'re in the meeting this morning. Headquarters wants to know what the flights have taught us about hitting a point from orbit.', '', 8);
  },
  mRecovery() { g.objective = 'Recovery is reporting. Read the board, then go to the review.'; g.room = 'splash'; if (pilotId()) g.people.pilot.hidden = true; },
  mReview() {
    seatPeople();
    if (pilotId()) { const alive = g.mission.fate !== 'killed'; g.people.pilot.hidden = !alive; if (alive) place('pilot', 320); }
    g.objective = 'Hollis wants the review. Go into Mercury Control.';
    g.round.flight = flightRecord();
    g.mission.reading = ellisReading(g.round);
  },
};
const cap = t => t[0].toUpperCase() + t.slice(1);
// Who flies this round, if anyone: his id, or null.
export const pilotId = () => (g.crewed && SEASON[g.roundIndex].crew?.[0]) || null;
const pilotName = () => ASTRONAUTS[pilotId()].name;
const first = () => pilotName().split(' ')[0];
// Whether you are the project engineer: Tate has the Retrofire console, and you answer for the hardware.
export const engineer = () => g.crewed && g.record.seat === 'engineer';
// The flight director: in Houston, every call on the shift is yours.
export const flightDirector = () => g.crewed && g.record.seat === 'flight' && programOf() !== 'mercury';
const retroWho = c => (c.auto ? 'tate' : 'you');
const callsign = c => (c.auto ? 'Engineering' : flightDirector() ? 'Flight' : 'Retro');

// The day before a flight from Houston: the team in the simulator, the crew on the Cape.
function houstonBrief(launch) {
  const plan = flightOf(), crew = crewNames();
  const line = flightDirector() ? `${plan.craft} flies ${crew} on ${launch}: ${plan.objective}. It's your room on launch day, Flight. Today your team is in the sims, and the mission rules are on your console. Know them.`
    : `${plan.craft} flies ${crew} on ${launch}: ${plan.objective}. Today you're in the sims with the team.`;
  say('hollis', line, '', 8);
  note(`${cap(SEASON[g.roundIndex].name)}. Hollis: ${line}`);
  g.objective = 'Train in the simulator. When you have had enough, end the day.';
  g.dayDone = true;
}
// Everyone flying this round, by name.
export const crewNames = () => (SEASON[g.roundIndex].crew || []).map(id => ASTRONAUTS[id].name).join(' and ');

// Who is where in a Mercury round.
function seatPeople() {
  place('hollis', 180); place('reyes', 230); place('albrecht', 262); place('morgan', 150); place('brandt', 420);
  place('vega', 2010); place('kowalski', 1980); place('delgado', 2090);
  if (engineer() || (flightOf() && g.record.seat !== 'retro')) place('tate', 300);
  if (flightOf()) { place('kessler', 330); place('dorsey', 360); }
}

// A Mercury round starts the day before launch.
export function startMission() {
  g.mission = { sims: 0, trained: false, cond: null, scrubs: 0, pad: null, reading: null, calls: {} };
  morning('mBrief');
}

// ---- Which room each building opens in a Mercury round ----
export function missionRoomFor(id) {
  const flying = g.console && g.console.kind === 'flight';
  if (engineer() && ['mBrief', 'mScrub'].includes(g.beat)) { if (id === 'hangar') return 'checkout'; if (id === 'dugout' || id === 'stand') return 'qual'; }
  if (id === 'office' && g.beat === 'sRoute') return 'route';
  if (id === 'office') return ['mLaunch', 'mFlight'].includes(g.beat) ? 'console' : g.beat === 'mReview' ? 'mreview' : ['roundEnd', 'seasonEnd'].includes(g.beat) ? g.beat : 'watch';
  if (id === 'dugout' || id === 'stand') return flying || g.beat === 'mFlight' ? 'watch' : 'sim';
  if (id === 'truck') return g.beat === 'mRecovery' ? 'splash' : 'watch';
  return 'watch';
}

// ---- The console: one model for the real count and flight and for a training sim ----
// phase: count → poll → count → … → ascent → ip → coast → done (sim: debrief). The rooms read only these fields.
function newConsole(kind, round, cond, scenario = null, orbital = false) {
  const flightId = flightOf() ? SEASON[g.roundIndex].id : null;
  return { kind, round, cond, scenario, orbital, flightId, auto: kind === 'flight' && engineer(), phase: kind === 'sim' ? 'poll' : 'count', clock: kind === 'sim' ? 600 : 900, next: 0, poll: kind === 'sim' ? 'recovery' : null,
    t: 0, trace: [], abortAt: null, ip: null, aim: null, holds: 0, calls: { poll: [], abort: null, ip: null }, lines: [], chatter: [], live: true };
}
// Who says what on the loop. A sim's loop is the simulator's own: nobody on the real site hears it.
function speak(c, who, text, tone = '', seconds = 4.5) {
  if (!c || c.kind === 'flight') return say(who, text, tone, seconds);
  c.chatter.push({ who: g.people[who].name, text, tone });
  if (c.chatter.length > 6) c.chatter.shift();
  roomChanged();
}
// What the recovery board shows: every unit, on station or not, and the sea state. Visible to everyone.
const unitsOf = c => (c.orbital ? ORBIT_UNITS : UNITS);
export const board = c => ({ sea: c.cond.seaState, units: Object.entries(unitsOf(c)).map(([id, text]) => ({ id, text, on: c.cond.late !== id })) });
const boardGood = c => c.cond.seaState <= SEA_LIMIT && !c.cond.late;

// Open the console on launch day: the count begins.
export function consoleStart() {
  if (g.console || g.beat !== 'mLaunch') return;
  g.console = newConsole('flight', g.round, g.mission.cond, null, !!SEASON[g.roundIndex].orbital);
  place('you', 300);
  setBeat('mFlight', flightDirector() ? 'Run the count from the flight director\'s console, then work the flight: the climb, and every call on your shift.' : engineer() ? 'Listen on the loop from the back room. When Hollis asks about the hardware, answer him.' : 'Work the count from your console. Give your status when Hollis polls you, and watch the plot once she flies.');
}

// Your status at a poll: GO or NO-GO on the recovery area.
export function consolePoll(go) {
  const c = g.console;
  if (!c || !c.poll) return;
  const b = board(c), ok = boardGood(c);
  c.calls.poll.push({ go, ok });
  const sim = c.kind === 'sim';
  if (!sim) note(`${c.auto ? 'Tate\'s' : 'Your'} poll at T-${Math.ceil(c.clock)} s: the recovery board showed sea state ${b.sea}${c.cond.late ? `, and ${unitsOf(c)[c.cond.late].toLowerCase().replace(/^the /, 'the ')} not on station` : ', every unit on station'}. ${c.auto ? 'Tate' : 'You'} called ${go ? 'GO' : 'NO-GO'}.`);
  const poll = c.poll;
  c.poll = null;
  // The man on top has his own say at the final poll, and his no is binding.
  if (go && poll === 'final' && c.kind === 'flight' && pilotId()) {
    speak(c, retroWho(c), 'Retro is go.', 'go');
    const t = CREW_TRAITS[pilotId()], ok = consents(t, { sea: b.sea, late: c.cond.late });
    speak(c, 'hollis', `${first()}, are you go?`);
    if (impatient(t, c.holds)) speak(c, 'pilot', 'Why don\'t you fix your little problem and light this candle?', 'warn', 6);
    if (ok) { speak(c, 'pilot', 'I\'m go.', 'go'); roomChanged(); return; }
    const why = b.sea > SEA_LIMIT ? `that sea out there` : `a ship off station`;
    speak(c, 'pilot', `I'm not going with ${why}. Sorry, Flight.`, 'bad', 6);
    note(`${pilotName()} would not consent to go with ${why}. The count holds.`);
    c.calls.pilotRefused = true;
    go = false;
    if (c.cond.seaState > SEA_LIMIT) { speak(c, 'hollis', 'His call. We scrub.', 'warn'); return endCount('scrub'); }
    c.phase = 'hold'; c.holdLeft = 3; c.holdFor = 'ship'; c.holds++; c.poll = null;
    roomChanged(); return;
  }
  if (go) {
    speak(c, retroWho(c), 'Retro is go.', 'go');
    if (sim && c.phase === 'poll') { c.phase = 'count'; c.clock = 10; }
    roomChanged(); return;
  }
  // NO-GO: a ship off station is waited for; a rough sea scrubs the day; a clean board is a hold while Hollis asks why.
  if (c.cond.seaState > SEA_LIMIT) {
    speak(c, retroWho(c), `Retro is no-go. Sea state ${b.sea} in the recovery area. The rule says four.`, 'bad');
    speak(c, 'hollis', 'Agreed. We scrub for today.', 'warn');
    return endCount('scrub');
  }
  if (c.cond.late) {
    speak(c, retroWho(c), `Retro is no-go until ${unitsOf(c)[c.cond.late].split(',')[0].toLowerCase()} is on station.`, 'bad');
    speak(c, 'hollis', 'Holding. Recovery, get that ship on station.', 'warn');
    c.phase = 'hold'; c.holdLeft = 3; c.holdFor = 'ship'; c.holds++;
    roomChanged(); return;
  }
  speak(c, retroWho(c), 'Retro is no-go.', 'bad');
  speak(c, 'hollis', 'Retro, I have every ship on station and a flat sea. What are you seeing? Holding while you look.', 'warn');
  c.phase = 'hold'; c.holdLeft = 1.5; c.holdFor = 'look'; c.holds++;
  roomChanged();
}

// Call an abort: Retro recommends it, and the flight director commands it. The escape tower pulls the capsule away.
export function consoleAbort() {
  const c = g.console;
  if (!c || c.phase !== 'ascent' || c.abortAt != null) return;
  c.abortAt = Math.floor(c.t);
  c.calls.abort = { at: c.abortAt, off: c.trace.length ? c.trace[c.trace.length - 1].off : 0 };
  speak(c, retroWho(c), 'Flight, Retro: she\'s off her line. Recommend abort!', 'bad');
  speak(c, 'hollis', 'Abort! Abort!', 'bad');
  if (c.kind === 'flight') note(`T+${c.abortAt} s: ${c.auto ? 'Tate' : 'you'} called an abort with the flight-path angle ${Math.abs(c.calls.abort.off).toFixed(1)} degrees off the planned line.`);
  finishAscent(c);
}

// Where to send the helicopters after cutoff: 'radar', 'telemetry' or 'planned'.
export function consoleAim(which) {
  const c = g.console;
  if (!c || c.phase !== 'ip') return;
  c.aim = which; c.calls.ip = which;
  if (c.orbital) {
    const where = which === 'planned' ? 'the planned point' : km(c.ip[which]) + ' of the planned point';
    const radar = c.flightId ? 'the tracking ship' : 'Grand Turk';
    speak(c, retroWho(c), which === 'radar' ? `Recovery, ${callsign(c)}: hold the helicopters for ${radar}'s fix.` : `Recovery, ${callsign(c)}: best splashdown ${where}.`, 'go');
    if (which === 'radar') speak(c, 'reyes', `${cap(radar)} has her ${km(c.ip.radar)}. Helicopters launching.`, 'go');
    else speak(c, 'reyes', 'Copy. Helicopters launching.', 'go');
    if (c.kind === 'flight') note(`${c.auto ? 'Tate' : 'You'} sent the recovery forces to ${which === 'radar' ? `the radar fix, ${km(c.ip.radar)}` : where}${which === 'radar' ? ', after holding them for it' : ''}.`);
    c.phase = 'coast'; c.coastLeft = COAST_SECONDS;
    return roomChanged();
  }
  const kmDown = Math.round(c.ip[which]);
  speak(c, retroWho(c), `Recovery, Retro: best splashdown ${kmDown} kilometres downrange.`, 'go');
  speak(c, 'reyes', `Copy. Helicopters launching for ${kmDown}.`, 'go');
  if (c.kind === 'flight') note(`${c.auto ? 'Tate' : 'You'} sent the recovery forces to ${kmDown} km downrange (the ${which === 'planned' ? 'planned point' : `${which} impact point`}).`);
  c.phase = 'coast'; c.coastLeft = COAST_SECONDS;
  roomChanged();
}

function endCount(why) {
  const c = g.console;
  c.phase = 'done'; c.live = false;
  if (c.kind === 'sim') return finishSim(c, why);
  g.console = null;
  if (why === 'scrub') {
    g.slipDays += 1; g.mission.scrubs += 1;
    note('The launch was scrubbed for the sea in the recovery area. It slips a day.');
    setBeat('mScrub');
  }
  roomChanged();
}

// ---- The tick: the count, the climb, and the coast ----
export const consoleLive = () => !!(g.console && g.console.live);
export const consoleLocked = () => !!(g.console && g.console.kind === 'flight' && g.console.live);
export function tickConsole(dt) {
  const c = g.console;
  if (!c || !c.live) return;
  if (c.auto && tateCalls(c)) return;
  if (c.phase === 'hold') {
    c.holdLeft -= dt;
    g.clock += dt * 15;
    if (c.holdLeft <= 0) {
      if (c.holdFor === 'ship') { speak(c, 'reyes', `${unitsOf(c)[c.cond.late].split(',')[0]} is on station.`, 'go'); c.cond.late = null; }
      c.phase = c.kind === 'sim' && c.clock >= 600 ? 'poll' : 'count'; c.poll = c.clock <= 120 ? 'final' : 'recovery';
      speak(c, 'hollis', 'Retro, Recovery: status?');
      roomChanged();
    }
    return;
  }
  if (c.phase === 'count') {
    if (c.poll) return;
    const step = c.clock > 10 ? COUNT_RATE : 1;
    c.clock = Math.max(0, c.clock - step * dt);
    g.clock += step * dt / 60;
    while (c.next < MERCURY_COUNT.length && MERCURY_COUNT[c.next].at >= c.clock) {
      const s = MERCURY_COUNT[c.next++];
      if (c.kind === 'sim' && s.at > 10) continue; // a sim picks up at the recovery poll, then counts the last ten seconds
      speak(c, s.who, s.text, s.tone || '', s.quick ? 1 : 4);
      if (s.poll) { c.poll = s.poll; c.clock = s.at; roomChanged(); return; }
      if (s.at === 0) return liftoff(c);
    }
    return;
  }
  if (c.phase === 'ascent') {
    const a = c.round.ascent, before = c.t;
    c.t = Math.min(a.burn, c.t + ASCENT_RATE * (c.orbital ? 2 : 1) * Math.min(4, g.speed) * dt);
    g.clock += (c.t - before) / 60;
    for (let t = Math.floor(before) + 1; t <= Math.floor(c.t); t++) {
      const s = stepAt(a, t);
      c.trace.push({ t, gamma: s.gamma + flutter(c.round.seed, t), off: s.off, v: s.v, acc: s.acc });
      if (c.kind === 'flight' && pilotId() && c.abortAt == null && Math.abs(s.off) > ownAbortAt(CREW_TRAITS[pilotId()])) return pilotAbort(c, t);
      if (t === 60) speak(c, 'albrecht', 'Booster: one minute, steady.', 'go');
      if (c.orbital && t === 130) speak(c, 'albrecht', 'Booster engines cutoff. Staging. The sustainer is carrying her.', 'go');
      if (c.orbital && t === 155) speak(c, 'morgan', 'Escape tower jettisoned.', 'go');
      if (a.breakupAt != null && t >= a.breakupAt) return breakup(c);
    }
    if (c.t >= a.burn) finishAscent(c);
    return;
  }
  if (c.phase === 'mission') return tickFlight(c, dt, speak);
  if (c.phase === 'orbit') return tickOrbit(c, dt);
  if (c.phase === 'entry') { c.coastLeft -= dt; g.clock += dt; if (c.coastLeft <= 0) afterEntry(c); return; }
  if (c.phase === 'coast') {
    c.coastLeft -= dt;
    g.clock += dt * 2;
    if (c.coastLeft <= 0) splash(c);
  }
}
// The telemetry needle's flutter: depends only on the round and the second, so the plot holds still when time does.
function flutter(seed, t) {
  let h = Math.imul((seed | 0) ^ Math.imul(t + 7, 2654435761), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
  return ((h >>> 0) / 4294967296 - 0.5) * 1.2;
}

function liftoff(c) {
  const a = c.orbital ? atlasAscent(c.round, c.kind === 'sim' ? orbitSimFailure(c) : null, boosterOf(c).names) : ascent(c.round, c.kind === 'sim' ? simFailure(c.scenario) : null);
  if (c.kind === 'flight') { g.launchDay = g.day; g.rocket.where = 'flying'; g.rocket.rise = 0; }
  if (a.padAbort) {
    outcome(c.round);
    c.phase = 'pad'; c.live = false;
    speak(c, 'albrecht', 'Engine cutoff! She\'s back on the pad!', 'bad', 6);
    speak(c, 'morgan', 'The escape tower\'s gone! It flew off on its own!', 'bad', 6);
    speak(c, 'vega', 'The capsule\'s chutes are out. They\'re hanging off the top of the rocket.', 'warn', 7);
    if (c.kind === 'flight') { g.rocket.where = 'tower'; g.rocket.padAbort = true; note('At ignition the engine lit and shut down at once. The booster rose about an inch and settled back on the pad. The escape tower fired away and the capsule\'s parachutes came out on top of the rocket.'); }
    roomChanged(); return;
  }
  c.phase = 'ascent'; c.t = 0;
  speak(c, 'vega', 'Liftoff!', 'go');
  speak(c, 'hollis', 'Liftoff, and the clock has started.', 'go');
  roomChanged();
}

// He pulls the abort handle himself: binding, whatever the ground says.
function pilotAbort(c, t) {
  c.abortAt = t; c.calls.pilotAbort = { at: t };
  speak(c, 'pilot', 'She\'s going off! I\'m pulling the handle! Abort!', 'bad', 6);
  speak(c, 'hollis', 'Abort! The pilot has aborted!', 'bad');
  note(`T+${t} s: ${pilotName()} pulled the abort handle himself.`);
  finishAscent(c);
}

function breakup(c) {
  const a = c.round.ascent;
  speak(c, 'albrecht', 'She\'s breaking up!', 'bad', 5);
  speak(c, 'morgan', a.asis ? 'Escape tower fired! The capsule is away!' : 'No escape! I have no capsule signal!', a.asis ? 'warn' : 'bad', 6);
  if (c.kind === 'flight') note(`T+${a.breakupAt} s: the booster broke up off her line. ${a.asis ? 'The abort sensing fired the escape tower and pulled the capsule clear.' : 'The escape tower never fired.'}`);
  finishAscent(c);
}

function finishAscent(c) {
  if (c.orbital) return finishAtlas(c);
  const a = c.round.ascent, end = outcome(c.round, c.abortAt);
  if (c.kind === 'flight') g.rocket.where = 'gone';
  if (end.outcome === 'nominal' || end.outcome === 'short' || end.outcome === 'long') speak(c, 'albrecht', `Booster cutoff at ${a.burn} seconds. Capsule separation.`, 'go');
  if (end.outcome === 'asis') { speak(c, 'albrecht', `Cutoff at ${a.burn} seconds. She ran dry!`, 'warn'); speak(c, 'morgan', 'Abort light! The escape tower fired at cutoff.', 'warn'); }
  if (c.kind === 'flight') {
    const last = c.trace[c.trace.length - 1];
    if (last && end.outcome !== 'breakup') note(`At ${end.abortedAt ?? a.burn} s the plot showed ${last.v.toFixed(2)} km/s at ${last.gamma.toFixed(1)} degrees (planned at cutoff: ${PLAN.v} km/s at ${PLAN.gamma} degrees).`);
  }
  if (end.capsule === 'lost') { c.phase = 'coast'; c.coastLeft = 2; c.aim = null; roomChanged(); return; }
  c.ip = impactPredictions(c.round);
  c.phase = 'ip';
  speak(c, 'morgan', `Impact points: radar ${Math.round(c.ip.radar)} kilometres${c.ip.intermittent ? ', track intermittent' : ''}; computer from cutoff ${Math.round(c.ip.telemetry)}.`, c.ip.intermittent ? 'warn' : '');
  roomChanged();
}

// Splashdown, and how long the recovery forces take to reach her.
function splash(c) {
  const end = c.round.end, trained = g.mission ? g.mission.trained : true;
  const lines = [];
  if (c.orbital) splashOrbit(c, end, trained, lines);
  else if (end.capsule === 'lost') {
    c.hours = null;
    lines.push('There was nothing to recover. The capsule went down with the booster.');
  } else {
    c.hours = recoveryHours(end.landing, c.ip[c.aim], c.cond, trained);
    c.sank = c.kind === 'flight' && sinks(c.round, c.hours);
    const mins = Math.round(c.hours * 60);
    lines.push(`Splashdown about ${Math.round(end.landing / 10) * 10} km downrange.`);
    lines.push(c.cond.seaState > SEA_LIMIT ? `With the sea at state ${c.cond.seaState} the helicopters could not lift her. A ship had to steam to her.` : `The helicopters reached her ${mins} minutes after splashdown.`);
    if (c.cond.seaState > SEA_LIMIT) lines.push(`She was picked up ${mins} minutes after splashdown.`);
    if (c.sank) lines.push('She had been in the water too long. She took on water through the hatch seals and sank before the ship reached her.');
    else if (end.capsule === 'damaged') lines.push('The capsule came back scorched and dented: she took more than she was built for.');
    else lines.push('The capsule came back whole.');
  }
  if (c.kind === 'flight' && pilotId()) {
    const fate = crewFate(c.round, end, c.hours ?? 0, c.sank), many = (SEASON[g.roundIndex].crew || []).length > 1, n = many ? crewNames() : pilotName();
    c.fate = fate;
    if (c.sank) lines.push(fate === 'killed' ? (many ? `${n} got out as she went down, but they were in the water too long. The swimmers could not reach them in time.` : `${n} got out of the hatch as she went down, but he was in the water too long. The swimmers could not reach him in time. He drowned.`) : `${n} got out of the hatch as she went down and ${many ? 'were' : 'was'} pulled from the water, exhausted.`);
    else if (fate === 'killed') lines.push(`${n} ${many ? 'were' : 'was'} killed.`);
    else if (fate === 'hurt') lines.push(`${n} ${many ? 'are' : 'is'} alive but hurt: the flight surgeons have ${many ? 'them' : 'him'} on the ${end.secondary ? 'destroyer' : 'carrier'}.`);
    else lines.push(`${n} ${many ? 'are' : 'is'} safe aboard the ${end.secondary ? 'destroyer' : 'carrier'}, grinning.`);
  }
  c.lines = lines;
  c.phase = 'done'; c.live = false;
  if (c.kind === 'sim') return finishSim(c);
  for (const l of lines) note(`Recovery: ${l}`);
  g.clock += Math.round((c.hours ?? 0.5) * 60);
  setBeat('mRecovery');
}

// ---- The pad after a shutdown ----
export function padChoose(choice) {
  const c = g.console;
  if (!c || c.phase !== 'pad') return;
  if (choice === 'shoot') { speak(c, 'you', 'What if the range shoots holes in the tanks and drains her?'); speak(c, 'hollis', 'Nobody is shooting at a fuelled rocket on my pad. Think again, Retro.', 'warn', 6); c.shootAsked = true; return roomChanged(); }
  c.padChoice = choice;
  const sim = c.kind === 'sim';
  if (choice === 'wait') {
    speak(c, 'you', 'Leave her. By morning the batteries are flat and the oxygen\'s gone. Then we safe her.');
    speak(c, 'hollis', 'Agreed. Nobody goes near that pad tonight.', 'go');
    if (!sim) { g.mission.pad = 'waiting'; note('You advised leaving the capsule on the pad overnight. Hollis agreed.'); }
  } else {
    speak(c, 'you', 'Send the pad crew out now. The sooner she\'s safe the better.');
    speak(c, 'hollis', 'Your call, Retro. Vega, take your crew out. Carefully.', 'warn');
    const topple = padCrewNow(c.round);
    c.toppled = topple;
    if (!sim) {
      g.mission.pad = topple ? 'toppled' : 'safed';
      note(topple ? 'The pad crew went out at once. The wind filled the parachutes and pulled the capsule over: the booster toppled and burned on the pad. The crew got clear.' : 'The pad crew went out at once and safed the capsule without trouble.');
      speak(c, 'vega', topple ? 'She\'s going over! Everybody clear! Clear!' : 'Capsule\'s safe. Booster draining now.', topple ? 'bad' : 'go', 7);
    }
  }
  c.phase = 'done';
  if (sim) return finishSim(c);
  g.console = null;
  if (choice === 'wait') setBeat('mPadNight'); else setBeat('mReview');
}

// ---- The review in Mercury Control ----
// Hollis reads the tapes and the pad himself, and can be wrong. As at White Sands, he goes with his reading unless your
// record has earned his trust. Your calls in the flight are judged on what the plot showed.
export function missionPresent(key) {
  if (g.beat !== 'mReview') return;
  const view = g.mission.reading ?? ellisReading(g.round);
  let decision, reply, tone, agree;
  if (key === 'unknown') { decision = null; agree = true; tone = ''; reply = view === 'nominal' ? 'Fine. Marshall will look her over anyway.' : `Fair. I'd say ${SHORT[view]}, but we won't fix a guess.`; }
  else if (key === view) { decision = view; agree = true; tone = 'go'; shiftTrust(g.record, 1); reply = view === 'nominal' ? 'Agreed. She did what she was built for.' : 'That\'s how I read the tapes too. Marshall fixes it before the next one.'; }
  else if (g.record.trust >= TRUST.defer) { decision = key; agree = false; tone = 'go'; reply = `I'd have said ${SHORT[view]}. You've been right before. We'll go with yours.`; }
  else { decision = view; agree = false; tone = 'warn'; shiftTrust(g.record, -1); reply = `I don't read it that way. The tapes say ${SHORT[view]} to me, and that's what goes to Marshall.`; }
  const fix = decision && decision !== 'nominal' ? adopt(g.programme, decision) : null;
  g.review = { key, view, agree, decision, fix };
  if (g.mission.fate === 'killed') reply = `We lost ${pilotName()}. Whatever we find, we find all of it. ${reply}`;
  say('hollis', reply, tone, 8);
  const judged = judgeCalls();
  note(`Review: you said "${KITS[g.vehicle].explanations[key]}" Hollis: ${reply}${fix ? ` ${fix}` : ''}${judged.text ? ` ${judged.text}` : ''}`);
  finishReview({ yourCall: key, ellis: decision ?? view, ellisView: view, agreed: agree, wentWithYou: !agree && decision === key, fix, boss: 'hollis', calls: judged.calls });
}

// What the plot showed about your abort call, as Hollis sees it on the tape. The trust it earns or costs.
function judgeCalls() {
  const end = g.round.end || {}, a = g.round.ascent || {}, calls = g.mission.calls || {};
  if (calls.auto) { const j = engineerJudgement(calls); j.text = [j.text, ...flightJudgement(g.mission.decisions)].filter(Boolean).join(' '); return j; }
  if (calls.pilotAbort && !calls.abort) return { text: `${pilotName()} pulled the handle himself at ${calls.pilotAbort.at} seconds, before anyone on the ground called it.`, calls: { abort: 'pilot abort', aim: calls.aim || null, hours: calls.hours ?? null } };
  const abort = calls.abort, overLine = (a.steps || []).find(s => Math.abs(s.off) > ABORT_LIMIT);
  let text = '', verdict = null;
  if (abort && overLine && abort.at >= overLine.t) { verdict = 'good abort'; shiftTrust(g.record, 1); text = 'Hollis on your abort: "She was over the line and you called it. That\'s the job."'; }
  else if (abort && overLine) { verdict = 'early abort'; text = 'Hollis on your abort: "You called it a little before the line. I\'d have done the same."'; }
  else if (abort) { verdict = 'false abort'; shiftTrust(g.record, -1); text = 'Hollis on your abort: "The tape never crossed the line. We threw away a good flight."'; }
  else if (end.outcome === 'breakup') { verdict = 'missed abort'; shiftTrust(g.record, -1); text = `Hollis: "She was over the line from ${overLine ? overLine.t : '?'} seconds and nobody called it."`; }
  if (g.round.orbit || calls.insertion) text = [text, ...orbitJudgement(calls), ...flightJudgement(g.mission.decisions)].filter(Boolean).join(' ');
  return { text, calls: { abort: verdict, aim: calls.aim || null, hours: calls.hours ?? null, insertion: calls.insertion ? (calls.insertion.right ? 'right' : 'wrong') : undefined, pack: calls.pack, retro: calls.retro } };
}
// Hollis on the orbital calls, from what the tapes and the capsule showed afterwards.
function orbitJudgement(calls) {
  const out = [], o = g.round.orbit, end = g.round.end;
  if (calls.insertion) {
    const i = calls.insertion;
    if (i.right) { if (i.go !== i.goddard) { shiftTrust(g.record, 1); out.push('Hollis on insertion: "You called it against Goddard, and you were right."'); } }
    else { shiftTrust(g.record, -1); out.push(i.go ? 'Hollis on insertion: "The orbit was never going to hold. We put him where no ship could reach him."' : 'Hollis on insertion: "She had a good orbit. We brought her down for nothing."'); }
  }
  if (o && o.signal && calls.pack) {
    if (o.loose && calls.pack === 'keep') { shiftTrust(g.record, 1); out.push('Hollis on the retro pack: "The shield was loose. Those straps held it on. Good call."'); }
    else if (o.loose) { shiftTrust(g.record, -1); out.push('Hollis on the retro pack: "The shield was loose, and we threw away the only thing holding it."'); }
    else out.push(calls.pack === 'keep' ? 'Hollis on the retro pack: "It was a bad switch. Keeping the pack cost us nothing this time."' : 'Hollis on the retro pack: "It was a bad switch. You read it right."');
  }
  if (o && calls.retro) {
    if (o.scanner && calls.retro === 'auto') out.push(`Hollis on retrofire: "The scanner had her ${Math.round(Math.abs(o.scannerYaw))} degrees off in yaw, and the automatic system fired her that way. ${Math.round(Math.abs(end.miss || 0))} km off the point."`);
    else if (o.scanner) { shiftTrust(g.record, 1); out.push('Hollis on retrofire: "The scanner was bad. Firing on the window saved a long swim."'); }
  }
  return out;
}

// The flight as your record puts it: only what Mercury Control knew.
function flightRecord() {
  const end = g.round.end || { outcome: 'pad' }, a = g.round.ascent || {}, m = g.mission;
  const hrs = m.calls.hours != null ? `, picked up after ${Math.round(m.calls.hours * 60)} minutes` : '';
  const text = g.round.flightTruth && end.outcome === 'entry' ? flightText(end, hrs) : end.outcome in ORBIT_RECORD ? ORBIT_RECORD[end.outcome](end, a, hrs) : {
    pad: `Lost: the engine shut down at liftoff and the booster settled back on the pad.${m.pad === 'toppled' ? ' The booster toppled and burned.' : ' Capsule and booster saved.'}`,
    aborted: `Lost: aborted at ${end.abortedAt} seconds; the capsule came down about ${Math.round(end.landing / 10) * 10} km out${hrs}.`,
    breakup: end.capsule === 'lost' ? `Lost: the booster broke up at ${end.breakup} seconds and took the capsule with it.` : `Lost: the booster broke up at ${end.breakup} seconds; the escape tower pulled the capsule clear${hrs}.`,
    asis: `Lost: the booster ran dry early and the abort sensing fired the escape tower; splashdown about ${Math.round(end.landing / 10) * 10} km downrange${hrs}.`,
    short: `Lost: the engine cut off at ${a.burn} seconds; splashdown about ${Math.round(end.landing / 10) * 10} km downrange${hrs}.`,
    long: `Splashdown about ${Math.round(end.landing / 10) * 10} km downrange, long${hrs}.`,
    nominal: `Splashdown about ${Math.round(end.landing / 10) * 10} km downrange${hrs}.`,
  }[end.outcome];
  let out = m.sank ? `${text} The capsule sank before it was reached.` : text;
  const many = (SEASON[g.roundIndex].crew || []).length > 1, who = many ? `The crew, ${crewNames()},` : pilotId() ? pilotName() : '';
  if (pilotId() && m.fate) out += { killed: ` ${who} ${many ? 'were' : 'was'} killed.`, hurt: ` ${who} ${many ? 'were' : 'was'} hurt.`, safe: ` ${who} came home safe.` }[m.fate];
  if (m.fate === 'killed' && !/^Lost/.test(out)) out = `Lost: ${out}`;
  return { failure: a.failure || (g.round.flightTruth ? flightCause(g.round) : orbitCause()), failAt: a.failure ? (a.breakupAt ?? a.burn) : null, radar: end.apogee || null, text: out };
}

// How the record puts an orbital flight.
const ORBIT_RECORD = {
  orbit: (e, a, hrs) => `In orbit${hrs}.`,
  nogo: (e, a, hrs) => `Lost: no-go at insertion; the capsule came down in the abort area${hrs}.`,
  decay: (e, a, hrs) => `Lost: the orbit did not hold and she came down within the first orbit${hrs}.`,
  entry: (e, a, hrs) => (e.capsule === 'lost' && !hrs ? 'Lost: the capsule did not survive the entry.' : `${ORBIT_PLAN.orbits} orbits; splashdown ${Math.round(Math.abs(e.miss))} km ${e.miss >= 0 ? 'long' : 'short'} of the planned point${hrs}.`),
};
// A long flight in the record: how long she stayed up, and where she came down.
function flightText(e, hrs) {
  const m = g.mission;
  if (e.capsule === 'lost' && !hrs) return `Lost: ${m.craft} did not survive the entry.`;
  return `${m.craft}: ${m.flightHours} hours${m.capabilities?.length ? `. Shown: ${m.capabilities.join('; ')}` : ''}; splashdown ${Math.round(Math.abs(e.miss))} km ${e.miss >= 0 ? 'long' : 'short'} of the planned point${hrs}.`;
}
// What went wrong on an orbital flight, if the booster did not: the shield, or the scanner.
function orbitCause() {
  const o = g.round.orbit;
  if (!o) return null;
  return o.loose ? 'shield' : o.scanner ? 'scanner' : null;
}

// What the review has to go on: the tapes, and what came back.
export function evidence() {
  const a = g.round.ascent || {}, end = g.round.end || {};
  if (a.orbital) return orbitEvidence(a, end);
  const lines = [...(TAPES[a.failure || 'nominal'] || [])];
  if (a.controlFrom && a.failure === 'control') lines[0] = `${lines[0]} It starts at about ${a.controlFrom} seconds.`;
  if (g.mission.sank) lines.push('The capsule is on the sea floor. All there is to go on is the telemetry.');
  if (end.capsule === 'damaged') lines.push('The capsule came back scorched and dented.');
  return lines;
}

function orbitEvidence(a, end) {
  if (g.round.flightTruth || BOOSTERS[g.vehicle]?.tapes === GEMINI_TAPES) return flightEvidence(a, end);
  const lines = [...(ORBIT_TAPES[a.failure || 'nominal'] || [])], o = g.round.orbit, back = end.capsule !== 'lost' && !g.mission.sank;
  if (a.controlFrom && a.failure === 'guidance') lines[0] = `${lines[0]} It starts at about ${a.controlFrom} seconds.`;
  if (o && o.signal) lines.push(back ? (o.loose ? 'In Hangar S the heat shield is found free of its latches, held on only by the landing bag\'s straps.' : 'In Hangar S the shield is latched tight. The Segment 51 switch is found faulty.') : 'Segment 51 showed in orbit. With the capsule gone, nobody can say whether the shield was loose.');
  if (o) lines.push(o.scanner ? (back ? 'On the bench, one horizon scanner reads more than twenty degrees off.' : 'The attitude tapes and the fuel use point at the horizon scanners.') : 'The horizon scanners check out on the bench.');
  if (end.miss != null && end.capsule !== 'lost') lines.push(`She came down ${Math.round(Math.abs(end.miss))} km ${end.miss >= 0 ? 'long' : 'short'} of the planned point.`);
  if (g.mission.sank) lines.push('The capsule is on the sea floor. All there is to go on is the telemetry.');
  if (end.capsule === 'damaged') lines.push('The capsule came back scorched and damaged.');
  return lines;
}

// What the review of a long flight has to go on: the launch tapes, what the spacecraft did, and what came back.
const FLIGHT_EVIDENCE = {
  fuelcell: ['In flight the fuel cells\' oxygen supply pressure fell from about 850 psi to 70 in the first hours.', 'On the ground, the supply\'s heater is found open-circuit.'],
  hatch: ['The crew reported the hatch latch stiff in orbit and hard to close after the spacewalk.', 'On the bench the latch\'s spring guide is found bent.'],
  computer: ['The guidance computer dropped off the line in flight and would not come back.', 'On the bench, a power-supply transient trips it.'],
  navdata: ['She came down well short of the planned point, though the computer steered her all the way.', 'Retro\'s people find the number for the Earth\'s rotation in the ground program was wrong.'],
};
function flightEvidence(a, end) {
  const lines = [...((BOOSTERS[g.vehicle] || BOOSTERS.titan).tapes[a.failure || 'nominal'] || [])];
  if (a.controlFrom && a.failure === 'titanctl') lines[0] = `${lines[0]} It starts at about ${a.controlFrom} seconds.`;
  const t = g.round.flightTruth;
  if (t) {
    for (const [k, l] of Object.entries(FLIGHT_EVIDENCE)) if (k === flightCause(g.round) || (k !== 'navdata' && t.flags[k] && (flightOf(t.id)?.steps || []).some(s => s.if === k))) lines.push(...l);
    if (!lines.slice(1).length && !a.failure) lines.push('The spacecraft systems stayed in their bands from insertion to retrofire.');
  }
  if (end.miss != null && end.capsule !== 'lost') lines.push(`She came down ${Math.round(Math.abs(end.miss))} km ${end.miss >= 0 ? 'long' : 'short'} of the planned point.`);
  if (g.mission.sank) lines.push('The spacecraft is on the sea floor. All there is to go on is the telemetry.');
  if (end.capsule === 'damaged') lines.push('The spacecraft came back scorched and damaged.');
  return lines;
}

// ---- Training sims ----
// Run at any time outside a real count or flight. The sim supervisor chooses the trouble; you do not know which.
// A sim never touches the real round: it has its own seed and its own round.
export const simOpen = () => g.crewed && !consoleLocked() && !['mFlight', 'mRecovery'].includes(g.beat) && !(g.console && g.console.kind === 'sim' && g.console.live);
export function simStart() {
  if (!simOpen()) return;
  const n = (g.record.sims || []).length, orbital = !!SEASON[g.roundIndex].orbital;
  const round = newRound((g.seed + 50000 + n * 7907) >>> 0, g.programme, orbital ? g.vehicle : 'redstone');
  const list = orbital ? (BOOSTERS[g.vehicle] || BOOSTERS.atlas).sims : SIMS, keys = Object.keys(list), scenario = keys[Math.floor(draw(round.rng.forecast) * keys.length)];
  if (scenario === 'radar') round.forceRadar = true;
  if (orbital) {
    // The sim supervisor sets the capsule's troubles himself.
    round.faults = { ...(scenario === 'seg51loose' ? { 'heat-shield': 'shield' } : {}), ...(scenario === 'scanner' ? { scanners: 'scanner' } : {}) };
    round.seg51Risk = scenario === 'seg51false' ? 1 : 0;
  }
  const c = g.console = newConsole('sim', round, conditions(round, ['seastate', 'offstation'].includes(scenario) ? scenario : 'calm'), scenario, orbital);
  speak(c, 'hollis', 'Sim supervisor has the board. We pick up at T minus ten. Retro, recovery status?');
  g.clock += SIM_MINUTES;
  roomChanged();
}
const simFailure = scenario => (['control', 'lox', 'thrust'].includes(scenario) ? scenario : 'nominal');

function finishSim(c, why = null) {
  const s = c.scenario, end = c.round.end;
  const graded = [];
  const poll = c.calls.poll[0];
  graded.push({ what: 'Your recovery poll', right: poll ? poll.go === poll.ok : true });
  if (why !== 'scrub' && c.orbital) gradeOrbitSim(c, graded);
  else if (why !== 'scrub') {
    const control = s === 'control';
    const abort = c.calls.abort;
    const rightAbort = control ? !!abort && (!c.round.ascent.breakupAt || abort.at < c.round.ascent.breakupAt) : !abort;
    graded.push({ what: control ? 'The abort' : 'Not aborting', right: rightAbort });
    // The best point on the board: the radar's, unless its track dropped out.
    if (end && end.capsule !== 'lost' && c.aim) graded.push({ what: 'Where you sent the helicopters', right: c.aim === (c.ip.intermittent ? 'telemetry' : 'radar') });
  }
  const right = graded.filter(x => x.right).length;
  const simList = c.orbital ? boosterOf(c).sims : SIMS;
  c.debrief = { scenario: simList[s], graded, right, of: graded.length, lines: c.lines };
  addSim(g.record, { day: g.day, scenario: s, right, of: graded.length });
  if (g.mission) g.mission.trained = true;
  note(`Training sim: ${simList[s]} You got ${right} of ${graded.length} calls right.`);
  speak(c, 'hollis', right === graded.length ? 'Clean sim, Retro.' : 'Debrief, Retro. Look at what you missed.', right === graded.length ? 'go' : 'warn');
  c.phase = 'debrief'; c.live = false;
  roomChanged();
}
// The calls in an orbital sim, against what the supervisor really set up.
function gradeOrbitSim(c, graded) {
  const a = c.round.ascent, end = c.round.end || {}, o = c.round.orbit, calls = c.calls;
  const off = s => s === boosterOf(c).names.guidance;
  graded.push({ what: off(c.scenario) ? 'The abort' : 'Not aborting', right: off(c.scenario) ? !!calls.abort && (!a.breakupAt || calls.abort.at < a.breakupAt) : !calls.abort });
  if (calls.insertion) graded.push({ what: 'Go or no-go for orbit', right: calls.insertion.right });
  if (o && o.signal) graded.push({ what: 'The retro pack', right: o.loose ? calls.pack === 'keep' : true });
  if (o && calls.retro) graded.push({ what: 'How to fire the retros', right: o.scanner ? calls.retro === 'manual' : true });
  if (c.ip && c.aim && end.miss != null) graded.push({ what: 'Where you sent the helicopters', right: c.aim === 'radar' || Math.abs(c.ip[c.aim] - end.miss) <= 30 });
}

export function simClose() { if (g.console && g.console.kind === 'sim' && !g.console.live) { g.console = null; roomChanged(); } }

// After splashdown: Recovery's board, then the review.
export function toReview() {
  if (g.beat !== 'mRecovery') return;
  const c = g.console;
  if (c && c.flight) { g.mission.decisions = c.flight.decisions; g.mission.capabilities = recordCapabilities(c); g.mission.craft = c.flight.craft; g.mission.flightHours = Math.round(c.flight.at); }
  if (c) { g.mission.calls = { ...c.calls, aim: c.aim, hours: c.hours, auto: !!c.auto }; g.mission.sank = !!c.sank; g.mission.lines = c.lines; g.mission.fate = c.fate || null; }
  if (c && c.orbital && c.round.end?.outcome === 'entry' && c.round.end.capsule !== 'lost') (g.record.orbitMisses = g.record.orbitMisses || []).push(c.round.end.miss);
  if (g.mission.fate === 'killed') { (g.record.losses = g.record.losses || []).push({ name: (SEASON[g.roundIndex].crew || []).length > 1 ? crewNames() : pilotName(), day: g.day, round: SEASON[g.roundIndex].id }); }
  g.console = null; g.room = null;
  setBeat('mReview');
}

// Hours of game time the coast takes, for the notebook; the plot jumps over it.
export const coastMinutes = () => Math.round(((g.round.end && g.round.end.coast) || 300) / 60);

// ---- Orbital flights: insertion, the orbits, retrofire and entry ----
const km = x => `${Math.round(Math.abs(x))} km ${x >= 0 ? 'long' : 'short'}`;
const pctFuel = f => `${Math.round(f * 100)} percent`;

// Sustainer cutoff, or an abort on the way up.
function finishAtlas(c) {
  const a = c.round.ascent, end = atlasOutcome(c.round, c.abortAt);
  if (c.kind === 'flight') g.rocket.where = 'gone';
  if (end.outcome === 'orbit') {
    c.goddard = goddard(c.round);
    speak(c, 'albrecht', `Sustainer engine cutoff at ${a.burn} seconds. Capsule separation.`, 'go');
    speak(c, 'morgan', `Goddard's computers: ${c.goddard.go ? 'GO for orbit' : 'NO-GO, the orbit will not hold'}.`, c.goddard.go ? 'go' : 'bad', 6);
    if (c.kind === 'flight') note(`At cutoff the plot showed ${c.goddard.v.toFixed(3)} km/s, ${c.goddard.gammaOff.toFixed(1)} degrees off the planned angle (orbit needs about ${ORBIT_PLAN.need} km/s, level). Goddard said ${c.goddard.go ? 'GO' : 'NO-GO'}.`);
    c.phase = 'insertion';
    return roomChanged();
  }
  if (end.outcome === 'aborted' || end.outcome === 'breakup') {
    if (end.outcome === 'aborted') speak(c, 'morgan', 'The escape system fired. The capsule is coming down in the Atlantic abort area.', 'warn');
    else speak(c, 'morgan', 'She broke up! The abort sensing pulled the capsule clear. She is coming down in the Atlantic.', 'bad', 6);
    if (c.kind === 'flight') note(`T+${end.abortedAt} s: the flight was aborted and the capsule came down about ${Math.round(end.landing / 10) * 10} km downrange, in the Atlantic abort area.`);
  }
  c.aim = null; c.phase = 'coast'; c.coastLeft = 3;
  roomChanged();
}

// Your answer to the flight's open question, from the console.
export function consoleDecide(choice) {
  const c = g.console;
  if (!c || c.phase !== 'mission' || !c.flight?.decision?.mine) return;
  answer(c, choice, speak);
}

// Retro's call at insertion: go for orbit, or bring her down now while the ships in the abort area can reach her.
export function consoleInsertion(go) {
  const c = g.console;
  if (!c || c.phase !== 'insertion') return;
  const end = c.round.end, good = end.margin >= 0;
  c.calls.insertion = { go, right: go === good, goddard: c.goddard.go };
  insertion(c.round, go);
  if (c.kind === 'flight') note(`Insertion: ${c.auto ? 'Tate' : 'you'} called ${go ? 'GO for orbit' : 'NO-GO'}${go === c.goddard.go ? ', with Goddard' : ', against Goddard'}.`);
  if (!go) {
    speak(c, retroWho(c), 'Flight, Retro: no-go. Bring her down in the abort area.', 'bad');
    speak(c, 'hollis', 'Fire the retros. Recovery, she\'s yours.', 'warn');
    c.aim = null; c.phase = 'coast'; c.coastLeft = 3;
    return roomChanged();
  }
  speak(c, retroWho(c), 'Flight, Retro: we are go for orbit.', 'go');
  if (end.outcome === 'decay') {
    speak(c, 'hollis', 'We have a go!', 'go');
    speak(c, 'morgan', 'Flight, Network: Bermuda\'s radar has her perigee too low. She will not make one orbit.', 'bad', 7);
    if (c.kind === 'flight') note('Bermuda\'s radar showed the orbit too low to hold. The capsule came down within the first orbit, far from any ship.');
    c.aim = null; c.phase = 'coast'; c.coastLeft = 3;
    return roomChanged();
  }
  if (c.flightId) {
    speak(c, 'hollis', 'We have a go!', 'go');
    if (c.kind === 'sim') return finishSim(c);
    return startFlight(c);
  }
  const o = inOrbit(c.round);
  c.status = { orbit: 1, station: 'Bermuda', fuel: 1, seg51: 'off', attitude: 'normal', window: null };
  c.orbitT = 5; c.pass = 0; c.retroAt = (ORBIT_PLAN.orbits - 1) * ORBIT_PLAN.period + STATIONS.find(s => s.name === 'California').at;
  c.orbitInfo = { signal: o.signal, flicker: o.flicker };
  c.phase = 'orbit';
  speak(c, 'hollis', 'We have a go for at least seven orbits!', 'go');
  roomChanged();
}

// The orbits go by as the stations report. The clock runs fast between them.
function tickOrbit(c, dt) {
  const o = c.round.orbit, P = ORBIT_PLAN, before = c.orbitT;
  c.orbitT = Math.min(c.retroAt, c.orbitT + ORBIT_RATE * Math.min(4, g.speed) * dt);
  g.clock += c.orbitT - before;
  c.status.fuel = fuelAfter(o, c.orbitT / P.period);
  c.status.orbit = Math.min(P.orbits, 1 + Math.floor(c.orbitT / P.period));
  const passes = [];
  for (let n = 0; n < P.orbits; n++) for (const st of STATIONS) passes.push({ n, st, at: n * P.period + st.at });
  while (c.pass < passes.length && passes[c.pass].at <= c.orbitT) stationPass(c, passes[c.pass++]);
  if (c.orbitT >= c.retroAt) {
    c.phase = o.signal && !c.pack ? 'pack' : 'retro';
    speak(c, 'hollis', c.phase === 'pack' ? `${callsign(c)}, we are coming up on retrofire. What about that retro pack?` : c.auto ? 'Engineering, Tate fires on the automatic system unless you tell me those scanners are bad. Well?' : 'Retro, California has her. Give me retrofire.', 'warn', 6);
    roomChanged();
  }
}

// What a ground station reports as the capsule passes over. Only some passes have anything to say.
function stationPass(c, { n, st }) {
  const o = c.round.orbit, s = c.status, t = pilotId() ? CREW_TRAITS[pilotId()] : null;
  s.station = st.name;
  if (st.name === 'Bermuda' && n > 0) speak(c, 'morgan', `Bermuda has her on orbit ${n + 1}. Fuel ${pctFuel(s.fuel)}.`, s.fuel < 0.4 ? 'warn' : '');
  // The window against the gauges: a bad scanner shows here, if the pilot says so plainly.
  if (st.name === 'Muchea, Australia' && n === 0 && pilotId()) {
    const plain = t.candour >= 0.5;
    s.window = o.scanner ? (plain ? 'The horizon through the window is well off where the gauges have it: twenty degrees or more in yaw.' : 'The gauges look normal. The view out the window looks a little odd.') : 'The window and the gauges agree.';
    speak(c, 'pilot', `Muchea, ${s.window[0].toLowerCase()}${s.window.slice(1)}`, o.scanner && plain ? 'warn' : '', 6);
    if (c.kind === 'flight') note(`Over Muchea, ${pilotName()}: "${s.window}"`);
  }
  if (st.name === 'Hawaii' && o.scanner && n >= 1) speak(c, 'morgan', `Hawaii: fuel is going fast on the automatic system. ${pctFuel(s.fuel)} left.`, 'warn', 6);
  // Segment 51: the landing-bag light, first seen as she comes over Texas at the end of the first orbit.
  if (st.name === 'Texas' && n === 0 && o.signal) {
    s.seg51 = o.flicker ? 'flickering' : 'steady';
    speak(c, 'morgan', `Flight, Network: Segment 51 is showing on telemetry. Landing bag deployed. It is ${s.seg51}.`, 'bad', 7);
    speak(c, 'hollis', `If that bag is down, the heat shield is only held by the retro pack straps. ${c.auto ? 'Engineering, is that shield loose?' : 'Retro, think about it.'}`, 'warn', 7);
    if (c.kind === 'flight') note(`Over Texas at the end of the first orbit, Segment 51 showed: the landing bag deployed, which would mean the heat shield is loose. The signal was ${s.seg51}. ${pilotName()} has no light in the cabin and has heard nothing.`);
  }
  if (st.name === 'Muchea, Australia' && n === 1 && o.signal) speak(c, 'morgan', `Muchea: Segment 51 still ${s.seg51}.`, 'warn');
}

// Keep the retro pack on through entry, or jettison it as planned.
export function consolePack(choice) {
  const c = g.console;
  if (!c || c.phase !== 'pack') return;
  c.pack = choice; c.calls.pack = choice;
  speak(c, 'you', choice === 'keep' ? `Flight, ${callsign(c)}: leave the retro pack on through entry. The straps hold the shield until the air does.` : `Flight, ${callsign(c)}: jettison the pack as planned. I read Segment 51 as a bad switch.`, choice === 'keep' ? 'warn' : '');
  speak(c, 'hollis', choice === 'keep' ? 'Pass it to him. Keep the pack on.' : 'Your call. Jettison as planned.', '');
  if (c.kind === 'flight') note(`You advised ${choice === 'keep' ? 'keeping the retro pack on through entry' : 'jettisoning the retro pack as planned'}.`);
  c.phase = 'retro';
  roomChanged();
}

// Retrofire: on the automatic system, or by hand on the window.
export function consoleRetro(how) {
  const c = g.console;
  if (!c || c.phase !== 'retro') return;
  c.calls.retro = how;
  const e = retrofire(c.round, how, c.pack || 'jettison');
  if (c.auto) speak(c, 'you', how === 'auto' ? 'Flight, Engineering: the scanners are good. Fire on the automatic system.' : 'Flight, Engineering: I don\'t trust those scanners. Have him fire by hand on the window.', how === 'auto' ? 'go' : 'warn');
  speak(c, retroWho(c), how === 'auto' ? 'Retrofire on the automatic sequence. Five, four, three, two, one, fire.' : `${first()}, fire them by hand on the window. Five, four, three, two, one, fire.`, 'go', 6);
  speak(c, 'pilot', 'Retros firing. One… two… three. Retro pack jettison ' + (c.pack === 'keep' ? 'held.' : 'green.'), 'go', 6);
  if (c.kind === 'flight') note(`Retrofire over California, ${how === 'auto' ? 'on the automatic system' : 'fired by hand'}${c.pack === 'keep' ? ', retro pack kept on' : ''}. Fuel at retrofire ${pctFuel(c.status.fuel)}.`);
  if (e.oscillated) speak(c, 'pilot', 'Fuel\'s gone. She\'s swinging. I can\'t hold her.', 'bad', 6);
  speak(c, 'morgan', 'Blackout. We have lost her signal.', 'warn');
  c.phase = 'entry'; c.coastLeft = 3;
  roomChanged();
}

// Out of the blackout, or not.
function afterEntry(c) {
  const e = c.round.end;
  if (e.capsule === 'lost') {
    speak(c, 'morgan', 'No signal. Nothing on the radars. She has not come out of blackout.', 'bad', 8);
    if (c.kind === 'flight') note('The capsule never came out of the blackout.');
    c.aim = null; c.phase = 'coast'; c.coastLeft = 2;
    return roomChanged();
  }
  c.ip = c.flightId ? flightPredictions(c.round) : orbitPredictions(c.round);
  speak(c, 'pilot', 'Out of the blackout. Drogue is out… main chute is out and good!', 'go', 6);
  speak(c, 'morgan', c.flightId ? `Splashdown predictions, from the planned point: the spacecraft's computer says ${km(c.ip.retro)}. The tracking ship's radar can give a fix if Recovery waits for it.` : `Splashdown predictions, from the planned point: retrofire telemetry says ${km(c.ip.retro)}. Grand Turk's radar can give a fix if Recovery waits for it.`, '', 7);
  c.phase = 'ip';
  roomChanged();
}

// Recovery's board after an orbital flight.
function splashOrbit(c, end, trained, lines) {
  if (end.capsule === 'lost' && end.outcome === 'entry') {
    c.hours = null;
    lines.push('There was nothing to recover. The search aircraft found a slick and some charred pieces of the heat shield.');
    return;
  }
  const aim = c.aim ? c.ip[c.aim] : 0, waited = c.aim === 'radar';
  c.hours = c.flightId ? flightRecoveryHours(end, aim, c.cond, trained, waited, orbitRecoveryHours) : orbitRecoveryHours(end, aim, c.cond, trained, waited);
  if (end.secondary) lines.push('She came down in the secondary area, where one destroyer waits and no carrier.');
  c.sank = c.kind === 'flight' && sinks(c.round, c.hours);
  const mins = Math.round(c.hours * 60);
  if (end.outcome === 'entry') lines.push(`Splashdown ${km(end.miss)} of the planned point.`);
  else if (end.outcome === 'decay') lines.push(`She came down within the first orbit, about ${Math.round(end.landing / 100) * 100} km downrange of the Cape, far from any recovery ship.`);
  else lines.push(`She came down in the Atlantic abort area, about ${Math.round(end.landing / 10) * 10} km downrange of the Cape.`);
  lines.push(c.hours > 3 ? `She was picked up ${(c.hours).toFixed(1)} hours after splashdown.` : `She was picked up ${mins} minutes after splashdown.`);
  if (c.sank) lines.push('She took on water and sank before she was reached.');
  else if (end.capsule === 'damaged') lines.push(end.oscillated ? 'She swung through the entry with no fuel to damp her, and came back scorched and battered.' : 'The capsule came back scorched and damaged: she took more than she was built for.');
  else lines.push(c.flightId ? 'The spacecraft came back whole.' : 'The capsule came back whole.');
}

const orbitSimFailure = c => (Object.values(boosterOf(c).names).includes(c.scenario) ? c.scenario : 'nominal');

// ---- The route to the Moon, 1962 ----
// After a round whose SEASON entry has `after: 'route'`: the calendar goes to the meeting, once.
export function sceneAfterReview() {
  const after = SEASON[g.roundIndex].after;
  if (after !== 'route' || g.record.scenes?.route) return null;
  g.day = Math.max(g.day, ROUTE_DAY);
  g.clock = g.day * 1440 + 7 * 60 + 30;
  return 'sRoute';
}
// What the meeting can see of your record: how close your orbital flights came down to the planned point.
export function orbitMisses() { return (g.record.orbitMisses || []).slice(); }
// Your case in the meeting. The decision is NASA's, and it went to lunar-orbit rendezvous; your view goes on your record,
// and earns trust where your flights back it.
export function routeArgue(mode) {
  if (g.beat !== 'sRoute' || !ROUTE_MODES[mode] || g.record.scenes?.route) return null;
  const misses = orbitMisses(), best = misses.length ? Math.min(...misses.map(Math.abs)) : null;
  const evidence = best == null ? 'none of your flights reached orbit and came home on a computed point' : `your best orbital splashdown was ${Math.round(best)} km from the planned point`;
  let lines, tone = '';
  if (mode === 'lor') {
    const backed = best != null && best <= 60;
    if (backed) { shiftTrust(g.record, 1); tone = 'go'; }
    lines = [['hollis', backed ? `Retro's numbers are why I believe we can find the mother ship from the Moon: ${evidence}.` : 'It\'s the light way, and I\'ll back it. I\'d like better navigation numbers than we have, Retro.']];
  } else if (mode === 'eor') lines = [['albrecht', 'Huntsville thanks you.'], ['hollis', 'Close to home is safer, I grant you. It is also four Saturns and a fuel transfer nobody has tried.']];
  else lines = [['hollis', 'Nobody has a Nova, Retro, and nobody wants to land a ten-storey ship backwards on ground we haven\'t seen.']];
  (g.record.scenes = g.record.scenes || {}).route = { view: mode, day: g.day, evidence };
  for (const [who, text] of lines) say(who, text, tone, 9);
  const reply = lines.map(([who, text]) => `${g.people[who].name.split(' ').pop()}: "${text}"`).join(' ');
  note(`The route to the Moon: you argued for ${ROUTE_MODES[mode].name.toLowerCase()}, citing that ${evidence}. ${reply}`);
  note(`Albrecht came back from Huntsville: Marshall has come round to lunar-orbit rendezvous. NASA announced it on ${ROUTE_ANNOUNCED}. Apollo will fly a command ship and a lunar lander.`);
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

// ---- The project engineer: Hangar S, the test rooms, and the back room on flight day ----
function engineerBrief() {
  g.mission.checkout = g.mission.checkout || {}; g.mission.flags = g.mission.flags || {}; g.mission.quals = g.mission.quals || {};
  const launch = dateText(g.roundStart + LAUNCH_DAY);
  const line = flightOf() ? `${flightOf().craft} flies ${crewNames()} on ${launch}. The spacecraft's yours today, Engineering: the checkout at Complex 19, and whatever tests you want run. Flag anything you don't like. A flag means a day's rework and a day's slip, so make it count.` : `We fly ${pilotName()} on ${launch}. The capsule's yours today, Engineering: Hangar S, and whatever tests you want run. Flag anything you don't like. A flag means a day's rework and a day's slip, so make it count.`;
  say('hollis', line, '', 8);
  note(`${cap(SEASON[g.roundIndex].name)}. Hollis: ${line}`);
  if (pilotId()) { place('pilot', 1180); g.people.pilot.hidden = false; }
  g.objective = `Check the spacecraft out in ${placeName('hangar')} and run qualification tests in the ${placeName('stand').toLowerCase()}. Flag what you don't like, then end the day.`;
  g.dayDone = true;
}
// A reading that depends only on the round and what is looked at: no draw is taken, so looking never shifts the flight.
function glance(seed, key) {
  let h = Math.imul((seed | 0) ^ [...key].reduce((a, ch) => Math.imul(a ^ ch.charCodeAt(0), 16777619), 2166136261), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const busy = minutes => { g.clock += minutes; roomChanged(); };
// Look over one of the capsule's spots: what McDonnell's crew shows you, and whether anything catches your eye.
export function lookSpot(id) {
  if (!engineer() || !capsuleSpots().includes(id) || g.mission.checkout[id]) return;
  const spot = KITS[g.vehicle].spots[id], cue = g.round.cues[id];
  g.mission.checkout[id] = { name: spot.name, text: cue ? `${spot.sound} ${spot.cue}` : spot.sound, cue };
  note(`Hangar S, ${spot.name.toLowerCase()}: ${g.mission.checkout[id].text}`);
  busy(LOOK_MINUTES);
}
// Run a qualification test: its trace is in band or not. A fault shows most of the time; a sound part now and then
// shows a bad trace too.
export function runQual(id) {
  const t = qualTests()[id];
  if (!engineer() || !t || g.mission.quals[id]) return;
  const fault = t.fault && Object.values(g.round.faults).includes(t.fault), r = glance(g.round.seed, id);
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
    if (g.round.faults[id]) { g.mission.found.push(id); delete g.round.faults[id]; note(`Hangar S took the ${name} apart on your flag and found ${FAULT_AT_SPOT_TEXT[KITS[g.vehicle].spots[id].fault]}. Reworked.`); }
    else note(`Hangar S took the ${name} apart on your flag and found nothing wrong.`);
  }
  g.slipDays += 1; g.day += 1; g.clock += 1440;
  say('hollis', `Hangar S worked your flags overnight. We fly a day late, ${dateText()}.`, 'warn', 6);
}
const FAULT_AT_SPOT_TEXT = new Proxy({ shield: 'a landing-bag latch that did not seat', scanner: 'a horizon scanner out of calibration' }, { get: (o, k) => o[k] || (FAULT_AT_SPOT[k] ? FAULT_AT_SPOT[k][0].toLowerCase() + FAULT_AT_SPOT[k].slice(1) : k) });

// Tate's calls on the Retrofire console when you are in the back room. Returns true when he made one this frame.
function tateCalls(c) {
  if (c.poll) { consolePoll(boardGood(c)); return true; }
  if (c.phase === 'insertion') { consoleInsertion(c.goddard.go); return true; }
  if (c.phase === 'ip') { consoleAim(c.orbital ? 'radar' : c.ip.intermittent ? 'telemetry' : 'radar'); return true; }
  if (c.phase === 'pad') { padChoose('wait'); return true; }
  const last = c.trace[c.trace.length - 1];
  if (c.phase === 'ascent' && c.abortAt == null && last && Math.abs(last.off) > ABORT_LIMIT + 0.5) { consoleAbort(); return true; }
  return false;
}

// How Hollis sees the project engineer's work: what Hangar S found on your flags, and your answers on flight day.
function engineerJudgement(calls) {
  const out = [], o = g.round.orbit, m = g.mission;
  if ((m.found || []).length) { shiftTrust(g.record, 1); out.push(`Hollis on your flags: "Hangar S found ${m.found.map(id => FAULT_AT_SPOT_TEXT[KITS[g.vehicle].spots[id].fault]).join(' and ')} because you flagged it."`); }
  else if (Object.values(m.flags || {}).some(Boolean)) out.push('Hollis on your flags: "Nothing in what you flagged, and a day gone."');
  if (o && o.signal && calls.pack) {
    if (o.loose && calls.pack === 'keep') { shiftTrust(g.record, 1); out.push('Hollis on the retro pack: "You told me the shield might be loose, and it was. Those straps held it."'); }
    else if (o.loose) { shiftTrust(g.record, -1); out.push('Hollis on the retro pack: "You told me the shield was tight. It wasn\'t."'); }
    else out.push('Hollis on the retro pack: "A bad switch, as it turned out."');
  }
  if (o && calls.retro) {
    if (o.scanner && calls.retro === 'manual') { shiftTrust(g.record, 1); out.push('Hollis on retrofire: "You said not to trust the scanners. You were right."'); }
    else if (o.scanner) out.push(`Hollis on retrofire: "You cleared the scanners, and one was bad. ${Math.round(Math.abs(g.round.end.miss || 0))} km off the point."`);
    else if (calls.retro === 'manual') out.push('Hollis on retrofire: "The scanners were good. We gave away a few seconds and some fuel for nothing."');
  }
  return { text: out.join(' '), calls: { abort: null, aim: calls.aim || null, hours: calls.hours ?? null, pack: calls.pack, retro: calls.retro, engineer: true } };
}
