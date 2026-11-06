// MERCURY CONTROL: a Mercury flight worked from the Retrofire officer's console, and the training sims. No DOM, no drawing.
// The day before launch is for the simulator; on launch day you give your status in the count, watch the trajectory plot
// and call an abort if she goes off her line, then tell Recovery where to send the helicopters. Afterwards the flight
// director reviews the flight with you, the way Ellis did at White Sands.
//
// The console shows only what Mercury Control could see: the flight-path angle, velocity and acceleration on telemetry,
// the radar's and the computers' impact points, and the recovery board. The truth behind them is in truth/capsule.js.
// What the rooms read is g.console and g.mission, never the round itself.
import { g, say, note, walk, place, roomChanged, morning, setBeat, finishReview, dateText } from './game.js';
import { ascent, outcome, stepAt, impactPredictions, recoveryHours, sinks, padCrewNow, conditions, plannedGamma, PLAN, ABORT_LIMIT } from './truth/capsule.js';
import { newRound, ellisReading } from './truth/round.js';
import { draw } from './core/rng.js';
import { KITS, SHORT } from './data/kits.js';
import { SEASON } from './data/campaign.js';
import { MERCURY_COUNT, UNITS, SEA_LIMIT, TAPES, PAD_OPTIONS, SIMS, SIM_MINUTES } from './data/mercury.js';
import { addSim, shiftTrust, TRUST } from './career/record.js';
import { adopt } from './world/programme.js';

export { ABORT_LIMIT, PLAN, UNITS, SEA_LIMIT, PAD_OPTIONS, SIMS, SIM_MINUTES };
export const plannedAngle = plannedGamma;
// Launch is planned the day after the round starts: a sim day, then launch day.
export const LAUNCH_DAY = 1;
// Count seconds per real second in Mercury Control, and flight seconds per real second on the trajectory plot.
const COUNT_RATE = 30, ASCENT_RATE = 2, COAST_SECONDS = 5;

// ---- The days of a Mercury round ----
export const MERCURY_BEATS = {
  // The day before: the capsule and the booster are on the pad. The sims are open, and the day can end at any time.
  mBrief() {
    seatPeople();
    g.rocket.where = 'tower'; g.rocket.mated = true;
    const launch = dateText(g.roundStart + LAUNCH_DAY);
    const line = `We fly on ${launch}. Today you're in the simulator: the sim supervisor will throw everything he has at you. Learn the plot, Retro.`;
    say('hollis', line, '', 8);
    note(`${cap(SEASON[g.roundIndex].name)}. Hollis: ${line}`);
    g.objective = 'Train in the simulator in the training building. When you have had enough, end the day.';
    g.dayDone = true;
  },
  // Launch day: the recovery area's conditions are what they are this morning.
  mLaunch() {
    seatPeople();
    g.rocket.where = 'tower'; g.rocket.mated = true;
    g.mission.cond = conditions(g.round);
    g.objective = 'Launch day. Go to your console in Mercury Control for the count.';
    say('hollis', 'Morning, Retro. Get on your console. We pick up the count at T minus fifteen.', '', 6);
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
  mRecovery() { g.objective = 'Recovery is reporting. Read the board, then go to the review.'; g.room = 'splash'; },
  mReview() {
    seatPeople();
    g.objective = 'Hollis wants the review. Go into Mercury Control.';
    g.round.flight = flightRecord();
    g.mission.reading = ellisReading(g.round);
  },
};
const cap = t => t[0].toUpperCase() + t.slice(1);

// Who is where in a Mercury round.
function seatPeople() {
  place('hollis', 180); place('reyes', 230); place('albrecht', 262); place('morgan', 150); place('brandt', 420);
  place('vega', 2010); place('kowalski', 1980); place('delgado', 2090);
}

// A Mercury round starts the day before launch.
export function startMission() {
  g.mission = { sims: 0, trained: false, cond: null, scrubs: 0, pad: null, reading: null, calls: {} };
  morning('mBrief');
}

// ---- Which room each building opens in a Mercury round ----
export function missionRoomFor(id) {
  const flying = g.console && g.console.kind === 'flight';
  if (id === 'office') return ['mLaunch', 'mFlight'].includes(g.beat) ? 'console' : g.beat === 'mReview' ? 'mreview' : ['roundEnd', 'seasonEnd'].includes(g.beat) ? g.beat : 'watch';
  if (id === 'dugout' || id === 'stand') return flying || g.beat === 'mFlight' ? 'watch' : 'sim';
  if (id === 'truck') return g.beat === 'mRecovery' ? 'splash' : 'watch';
  return 'watch';
}

// ---- The console: one model for the real count and flight and for a training sim ----
// phase: count → poll → count → … → ascent → ip → coast → done (sim: debrief). The rooms read only these fields.
function newConsole(kind, round, cond, scenario = null) {
  return { kind, round, cond, scenario, phase: kind === 'sim' ? 'poll' : 'count', clock: kind === 'sim' ? 600 : 900, next: 0, poll: kind === 'sim' ? 'recovery' : null,
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
export const board = c => ({ sea: c.cond.seaState, units: Object.entries(UNITS).map(([id, text]) => ({ id, text, on: c.cond.late !== id })) });
const boardGood = c => c.cond.seaState <= SEA_LIMIT && !c.cond.late;

// Open the console on launch day: the count begins.
export function consoleStart() {
  if (g.console || g.beat !== 'mLaunch') return;
  g.console = newConsole('flight', g.round, g.mission.cond);
  place('you', 300);
  setBeat('mFlight', 'Work the count from your console. Give your status when Hollis polls you, and watch the plot once she flies.');
}

// Your status at a poll: GO or NO-GO on the recovery area.
export function consolePoll(go) {
  const c = g.console;
  if (!c || !c.poll) return;
  const b = board(c), ok = boardGood(c);
  c.calls.poll.push({ go, ok });
  const sim = c.kind === 'sim';
  if (!sim) note(`T-${Math.ceil(c.clock)} s poll: the recovery board showed sea state ${b.sea}${c.cond.late ? `, and ${UNITS[c.cond.late].toLowerCase().replace(/^the /, 'the ')} not on station` : ', every unit on station'}. You called ${go ? 'GO' : 'NO-GO'}.`);
  c.poll = null;
  if (go) {
    speak(c, 'you', 'Retro is go.', 'go');
    if (sim && c.phase === 'poll') { c.phase = 'count'; c.clock = 10; }
    roomChanged(); return;
  }
  // NO-GO: a ship off station is waited for; a rough sea scrubs the day; a clean board is a hold while Hollis asks why.
  if (c.cond.seaState > SEA_LIMIT) {
    speak(c, 'you', `Retro is no-go. Sea state ${b.sea} in the recovery area. The rule says four.`, 'bad');
    speak(c, 'hollis', 'Agreed. We scrub for today.', 'warn');
    return endCount('scrub');
  }
  if (c.cond.late) {
    speak(c, 'you', `Retro is no-go until ${UNITS[c.cond.late].split(',')[0].toLowerCase()} is on station.`, 'bad');
    speak(c, 'hollis', 'Holding. Recovery, get that ship on station.', 'warn');
    c.phase = 'hold'; c.holdLeft = 3; c.holdFor = 'ship'; c.holds++;
    roomChanged(); return;
  }
  speak(c, 'you', 'Retro is no-go.', 'bad');
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
  speak(c, 'you', 'Flight, Retro: she\'s off her line. Recommend abort!', 'bad');
  speak(c, 'hollis', 'Abort! Abort!', 'bad');
  if (c.kind === 'flight') note(`T+${c.abortAt} s: you called an abort with the flight-path angle ${Math.abs(c.calls.abort.off).toFixed(1)} degrees off the planned line.`);
  finishAscent(c);
}

// Where to send the helicopters after cutoff: 'radar', 'telemetry' or 'planned'.
export function consoleAim(which) {
  const c = g.console;
  if (!c || c.phase !== 'ip') return;
  c.aim = which; c.calls.ip = which;
  const km = Math.round(c.ip[which]);
  speak(c, 'you', `Recovery, Retro: best splashdown ${km} kilometres downrange.`, 'go');
  speak(c, 'reyes', `Copy. Helicopters launching for ${km}.`, 'go');
  if (c.kind === 'flight') note(`You sent the recovery forces to ${km} km downrange (the ${which === 'planned' ? 'planned point' : `${which} impact point`}).`);
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
  if (c.phase === 'hold') {
    c.holdLeft -= dt;
    g.clock += dt * 15;
    if (c.holdLeft <= 0) {
      if (c.holdFor === 'ship') { speak(c, 'reyes', `${UNITS[c.cond.late].split(',')[0]} is on station.`, 'go'); c.cond.late = null; }
      c.phase = c.kind === 'sim' && c.clock >= 600 ? 'poll' : 'count'; c.poll = 'recovery';
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
    c.t = Math.min(a.burn, c.t + ASCENT_RATE * Math.min(4, g.speed) * dt);
    g.clock += (c.t - before) / 60;
    for (let t = Math.floor(before) + 1; t <= Math.floor(c.t); t++) {
      const s = stepAt(a, t);
      c.trace.push({ t, gamma: s.gamma + flutter(c.round.seed, t), off: s.off, v: s.v, acc: s.acc });
      if (t === 60) speak(c, 'albrecht', 'Booster: one minute, steady.', 'go');
      if (a.breakupAt != null && t >= a.breakupAt) return breakup(c);
    }
    if (c.t >= a.burn) finishAscent(c);
    return;
  }
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
  const a = ascent(c.round, c.kind === 'sim' ? simFailure(c.scenario) : null);
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

function breakup(c) {
  const a = c.round.ascent;
  speak(c, 'albrecht', 'She\'s breaking up!', 'bad', 5);
  speak(c, 'morgan', a.asis ? 'Escape tower fired! The capsule is away!' : 'No escape! I have no capsule signal!', a.asis ? 'warn' : 'bad', 6);
  if (c.kind === 'flight') note(`T+${a.breakupAt} s: the booster broke up off her line. ${a.asis ? 'The abort sensing fired the escape tower and pulled the capsule clear.' : 'The escape tower never fired.'}`);
  finishAscent(c);
}

function finishAscent(c) {
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
  if (end.capsule === 'lost') {
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
  say('hollis', reply, tone, 8);
  const judged = judgeCalls();
  note(`Review: you said "${KITS.redstone.explanations[key]}" Hollis: ${reply}${fix ? ` ${fix}` : ''}${judged.text ? ` ${judged.text}` : ''}`);
  finishReview({ yourCall: key, ellis: decision ?? view, ellisView: view, agreed: agree, wentWithYou: !agree && decision === key, fix, boss: 'hollis', calls: judged.calls });
}

// What the plot showed about your abort call, as Hollis sees it on the tape. The trust it earns or costs.
function judgeCalls() {
  const end = g.round.end || {}, a = g.round.ascent || {}, calls = g.mission.calls || {};
  const abort = calls.abort, overLine = (a.steps || []).find(s => Math.abs(s.off) > ABORT_LIMIT);
  let text = '', verdict = null;
  if (abort && overLine && abort.at >= overLine.t) { verdict = 'good abort'; shiftTrust(g.record, 1); text = 'Hollis on your abort: "She was over the line and you called it. That\'s the job."'; }
  else if (abort && overLine) { verdict = 'early abort'; text = 'Hollis on your abort: "You called it a little before the line. I\'d have done the same."'; }
  else if (abort) { verdict = 'false abort'; shiftTrust(g.record, -1); text = 'Hollis on your abort: "The tape never crossed the line. We threw away a good flight."'; }
  else if (end.outcome === 'breakup') { verdict = 'missed abort'; shiftTrust(g.record, -1); text = `Hollis: "She was over the line from ${overLine ? overLine.t : '?'} seconds and nobody called it."`; }
  return { text, calls: { abort: verdict, aim: calls.aim || null, hours: calls.hours ?? null } };
}

// The flight as your record puts it: only what Mercury Control knew.
function flightRecord() {
  const end = g.round.end || { outcome: 'pad' }, a = g.round.ascent || {}, m = g.mission;
  const hrs = m.calls.hours != null ? `, picked up after ${Math.round(m.calls.hours * 60)} minutes` : '';
  const text = {
    pad: `Lost: the engine shut down at liftoff and the booster settled back on the pad.${m.pad === 'toppled' ? ' The booster toppled and burned.' : ' Capsule and booster saved.'}`,
    aborted: `Lost: aborted at ${end.abortedAt} seconds; the capsule came down about ${Math.round(end.landing / 10) * 10} km out${hrs}.`,
    breakup: end.capsule === 'lost' ? `Lost: the booster broke up at ${end.breakup} seconds and took the capsule with it.` : `Lost: the booster broke up at ${end.breakup} seconds; the escape tower pulled the capsule clear${hrs}.`,
    asis: `Lost: the booster ran dry early and the abort sensing fired the escape tower; splashdown about ${Math.round(end.landing / 10) * 10} km downrange${hrs}.`,
    short: `Lost: the engine cut off at ${a.burn} seconds; splashdown about ${Math.round(end.landing / 10) * 10} km downrange${hrs}.`,
    long: `Splashdown about ${Math.round(end.landing / 10) * 10} km downrange, long${hrs}.`,
    nominal: `Splashdown about ${Math.round(end.landing / 10) * 10} km downrange${hrs}.`,
  }[end.outcome];
  return { failure: a.failure || null, failAt: a.failure ? (a.breakupAt ?? a.burn) : null, radar: end.apogee || null, text: m.sank ? `${text} The capsule sank before it was reached.` : text };
}

// What the review has to go on: the tapes, and what came back.
export function evidence() {
  const a = g.round.ascent || {}, end = g.round.end || {};
  const lines = [...(TAPES[a.failure || 'nominal'] || [])];
  if (a.controlFrom && a.failure === 'control') lines[0] = `${lines[0]} It starts at about ${a.controlFrom} seconds.`;
  if (g.mission.sank) lines.push('The capsule is on the sea floor. All there is to go on is the telemetry.');
  if (end.capsule === 'damaged') lines.push('The capsule came back scorched and dented.');
  return lines;
}

// ---- Training sims ----
// Run at any time outside a real count or flight. The sim supervisor chooses the trouble; you do not know which.
// A sim never touches the real round: it has its own seed and its own round.
export const simOpen = () => g.crewed && !consoleLocked() && !['mFlight', 'mRecovery'].includes(g.beat) && !(g.console && g.console.kind === 'sim' && g.console.live);
export function simStart() {
  if (!simOpen()) return;
  const n = (g.record.sims || []).length;
  const round = newRound((g.seed + 50000 + n * 7907) >>> 0, g.programme, 'redstone');
  const keys = Object.keys(SIMS), scenario = keys[Math.floor(draw(round.rng.forecast) * keys.length)];
  if (scenario === 'radar') round.forceRadar = true;
  const c = g.console = newConsole('sim', round, conditions(round, ['seastate', 'offstation'].includes(scenario) ? scenario : 'calm'), scenario);
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
  if (why !== 'scrub') {
    const control = s === 'control';
    const abort = c.calls.abort;
    const rightAbort = control ? !!abort && (!c.round.ascent.breakupAt || abort.at < c.round.ascent.breakupAt) : !abort;
    graded.push({ what: control ? 'The abort' : 'Not aborting', right: rightAbort });
    // The best point on the board: the radar's, unless its track dropped out.
    if (end && end.capsule !== 'lost' && c.aim) graded.push({ what: 'Where you sent the helicopters', right: c.aim === (c.ip.intermittent ? 'telemetry' : 'radar') });
  }
  const right = graded.filter(x => x.right).length;
  c.debrief = { scenario: SIMS[s], graded, right, of: graded.length, lines: c.lines };
  addSim(g.record, { day: g.day, scenario: s, right, of: graded.length });
  if (g.mission) g.mission.trained = true;
  note(`Training sim: ${SIMS[s]} You got ${right} of ${graded.length} calls right.`);
  speak(c, 'hollis', right === graded.length ? 'Clean sim, Retro.' : 'Debrief, Retro. Look at what you missed.', right === graded.length ? 'go' : 'warn');
  c.phase = 'debrief'; c.live = false;
  roomChanged();
}
export function simClose() { if (g.console && g.console.kind === 'sim' && !g.console.live) { g.console = null; roomChanged(); } }

// After splashdown: Recovery's board, then the review.
export function toReview() {
  if (g.beat !== 'mRecovery') return;
  const c = g.console;
  if (c) { g.mission.calls = { ...c.calls, aim: c.aim, hours: c.hours }; g.mission.sank = !!c.sank; g.mission.lines = c.lines; }
  g.console = null; g.room = null;
  setBeat('mReview');
}

// Hours of game time the coast takes, for the notebook; the plot jumps over it.
export const coastMinutes = () => Math.round(((g.round.end && g.round.end.coast) || 300) / 60);
