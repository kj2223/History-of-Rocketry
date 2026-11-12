// MISSION CONTROL, HOUSTON: a Gemini or Apollo flight once she is in orbit. No DOM, no drawing.
// The climb is worked on the same console as Mercury (mercury.js). From insertion on, a long flight is worked the way
// Houston worked it: in shifts. The flight plan's steps (data/flights.js) come up one at a time; the calendar jumps over
// the hours between them, with a handover note for what happened while your team was off. When a step asks a question,
// whoever's seat owns it answers: you, if it is yours (the flight director owns them all), otherwise the flight director
// on the other shift, who makes the call Houston made.
//
// The truth behind each answer is in truth/flights.js. What the rooms read is g.console.flight, never the round.
import { g, crewOf, note, roomChanged, who, heOf } from './game.js';
const cap = s => s[0].toUpperCase() + s.slice(1);
import { FLIGHTS, DECISIONS, CAPABILITIES } from './data/flights.js';
import { flightTruth, flag, resolve, geminiEntry, lunarEntry, measure } from './truth/flights.js';
import { SEASON } from './data/campaign.js';
import { ASTRONAUTS } from './data/crew.js';
import { shiftTrust } from './career/record.js';
import { adopt } from './world/programme.js';
import { sovietHas } from './world/race.js';

// Real seconds between one step and the next, and the hours of quiet after which the handover note is written.
export const STEP_SECONDS = 1.6,
  SHIFT_HOURS = 8;
// The flight plan a round flies. Apollo 8's depends on the August meeting.
export const flightIdOf = (id = SEASON[g.roundIndex].id) =>
  id === 'apollo-8' && g.record.apollo8 === 'earth' ? 'apollo-8e' : id;
export const flightOf = (id = SEASON[g.roundIndex].id) => FLIGHTS[flightIdOf(id)] || null;
// Whose seat answers a question. The flight director owns every call; the others own their own.
// The programme's own calls are the programme office's, not the flight director's.
export const owns = (seat, decision) => {
  const o = DECISIONS[decision].owner || 'flight';
  return seat === o || (seat === 'flight' && o !== 'programme');
};
// The second crewman, by name, for the loop.
const crewName = i => ASTRONAUTS[crewOf()?.[i]]?.name;

// Into the flight proper: the console's phase becomes 'mission'.
export function startFlight(c) {
  const id = c.flightId,
    plan = FLIGHTS[id];
  // What Mission Control did with the workshop before the first crew flew (the May 1973 meeting) rides with Skylab 2.
  if (c.kind === 'flight' && id === 'skylab-2') c.round.workshop = g.record.scenes?.workshop || null;
  if (c.kind === 'flight') flightTruth(c.round, id, g.seed);
  c.flight = {
    id,
    craft: plan.craft,
    phases: plan.phases || null,
    where: null,
    at: 0.2,
    step: 0,
    wait: STEP_SECONDS,
    state: {},
    status: { ...(plan.status || {}) },
    decision: null,
    decisions: [],
    capabilities: [],
    phase: plan.steps[0]?.phase || 'Earth orbit',
    phaseNo: 1,
  };
  c.phase = 'mission';
  if (c.insertionPlan) {
    const { reserve, reduced, delay } = c.insertionPlan;
    Object.assign(c.flight.state, { reserve, reduced, rendezvousDelay: delay });
    c.flight.status.RESERVE = [`${reserve}%`, reserve < 60];
    c.flight.status.OBJECTIVE = [reduced ? 'orbital checkout' : 'rendezvous'];
  }
  if (g.people.crew2 && crewName(1)) g.people.crew2.name = crewName(1);
  note(`${plan.craft} is in orbit. The flight plan: ${plan.objective}. The mission rules: ${plan.rules.join(' ')}`);
  roomChanged();
}

// Mission time passing: the clock moves on, and the calendar with it.
export function passMinutes(minutes) {
  g.clock += minutes;
  g.day = Math.floor(g.clock / 1440);
}
// How much of a timed decision window a real-time tick spends: a mission minute a second, faster at speed (up to 4x).
export const windowMinutes = (left, dt) => Math.min(left, dt * Math.min(4, g.speed));

// The flight plan, a step at a time.
export function tickFlight(c, dt, speak) {
  const f = c.flight;
  if (f.decision) {
    const d = f.decision;
    if (d.remaining == null) return;
    const elapsed = windowMinutes(d.remaining, dt);
    d.remaining -= elapsed;
    f.at += elapsed / 60;
    passMinutes(elapsed);
    if (d.remaining <= 0) return answer(c, 'stand-down', speak);
    if (d.fixIn != null) {
      d.fixIn -= elapsed;
      if (d.fixIn <= 0) {
        d.fixIn = null;
        const reset = f.status.COMPUTER?.[0] === 'resets';
        const report = reset
          ? 'FIDO: the new ground fix is steady. EECOM confirms the onboard reset invalidated its solution.'
          : 'FIDO: the new ground fix agrees with the onboard solution.';
        f.status['GROUND FIX'] = ['confirmed'];
        speak(c, 'morgan', report, 'go', 8);
        note(report);
      }
    }
    return;
  }
  f.wait -= dt * Math.min(4, g.speed);
  if (f.wait > 0) return;
  const plan = FLIGHTS[f.id];
  while (f.step < plan.steps.length) {
    const s = plan.steps[f.step];
    if (!applies(c, s)) {
      f.step++;
      continue;
    }
    // Coming home early: the rest of the plan goes, except the last checks before retrofire and retrofire itself.
    const at = f.endAt != null && s.at > f.endAt ? f.endAt : s.at;
    if (f.endAt != null && s.at > f.endAt && !s.retro && !['navcheck', 'mcc'].includes(s.decide) && !s.measure) {
      f.step++;
      continue;
    }
    advanceTo(c, at, s);
    f.step++;
    f.wait = STEP_SECONDS;
    return runStep(c, s, speak);
  }
}

function applies(c, s) {
  const st = c.flight.state;
  // Steps at the Moon go if she is not going there; steps beyond Earth orbit go if she never left it.
  if (s.moon && (st.home || st.earthOnly)) return false;
  if (s.lunar && st.earthOnly) return false;
  if (s.when && !st[s.when]) return false;
  if (s.not && st[s.not]) return false;
  if (s.if && !(c.kind === 'flight' ? flag(c.round, s.if) : (c.simFlags || {})[s.if])) return false;
  if (s.unless && (c.kind === 'flight' ? flag(c.round, s.unless) : (c.simFlags || {})[s.unless])) return false;
  return true;
}

// The calendar jumps to the step. A long quiet stretch is the other shifts': a handover note says what they saw.
function advanceTo(c, at, s) {
  const f = c.flight,
    gap = at - f.at;
  if (gap <= 0) return;
  f.at = at;
  if (c.kind !== 'flight') return;
  passMinutes(Math.round(gap * 60));
  if (gap >= SHIFT_HOURS)
    note(
      `Handover, ${Math.round(at)} hours into the flight: ${s.offShift || 'the other shifts had a quiet flight. Nothing for your team.'}`,
    );
}

function runStep(c, s, speak) {
  const f = c.flight;
  if (s.if && c.kind === 'flight') {
    const seen = (c.round.flightFaultsSeen ??= []);
    if (!seen.includes(s.if)) seen.push(s.if);
  }
  if (s.phase && s.phase !== f.phase) {
    f.phase = s.phase;
    f.phaseNo += 1;
  }
  if (s.where) f.where = { x: s.where[0], label: s.where[1] };
  if (s.set) Object.assign(f.state, s.set);
  if (s.measure && c.kind === 'flight') Object.assign(f.status, measure(c.round, s.measure));
  if (s.show) for (const [k, v] of Object.entries(s.show)) f.status[k] = v;
  for (const [who, text, tone] of s.say || []) speak(c, who, text, tone || '', 6);
  if (s.note && c.kind === 'flight') note(s.note);
  if (s.capability) f.capabilities.push(s.capability);
  if (s.offShift && !s.say) speak(c, 'morgan', `Handover. ${s.offShift}`, '', 5);
  if (s.decide) return ask(c, s.decide, speak);
  if (s.retro) return retrofire(c, speak);
  roomChanged();
}

// A question. Yours, if your seat owns it; otherwise the other flight director answers it.
function ask(c, id, speak) {
  const D = DECISIONS[id],
    plan = FLIGHTS[c.flight.id];
  c.flight.decision = {
    id,
    q: D.q,
    options: D.options,
    rule: D.rule != null ? plan.rules[D.rule] : null,
    mine: c.kind !== 'flight' || owns(g.record.seat, id),
  };
  if (!c.flight.decision.mine) {
    c.flight.decision.who = D.owner === 'programme' || D.advise ? 'hollis' : 'dorsey';
    speak(c, c.flight.decision.who, `${D.q} ${D.options[D.auto]}`, 'warn', 6);
    return answer(c, D.auto, speak);
  }
  if (id === 'rdvplan' && c.kind === 'flight') {
    const d = c.flight.decision;
    d.remaining = 30 - (c.flight.state.rendezvousDelay || 0);
    d.options = { ...d.options, 'request-fix': 'Request a fresh ground fix' };
    c.flight.status['GROUND FIX'] = ['provisional', true];
  }
  if (id === 'navcheck' && c.kind === 'flight' && g.record.seat === 'flight') {
    c.flight.decision.options = {
      send: 'Authorize Retro to uplink.',
      check: 'Ask for an independent check before authorizing.',
    };
  }
  const fd = g.record.seat === 'flight';
  // A console's recommendation: the flight director concurs or overrules.
  if (D.rec && fd) {
    const [by, line, pick] = D.rec;
    const d = c.flight.decision;
    d.rec = pick;
    d.options = Object.fromEntries(
      Object.entries(d.options).map(([k, t]) => [k, `${k === pick ? 'Concur' : 'Overrule'}: ${t}`]),
    );
    speak(c, by, line, 'warn', 6);
  }
  // The programme's or the management team's decision: the flight director's recommendation goes to them.
  if (D.advise && fd) {
    const d = c.flight.decision;
    d.advise = true;
    d.q = `${D.q} It is the programme's decision; ${who('hollis')} wants Flight's recommendation.`;
    d.options = Object.fromEntries(Object.entries(d.options).map(([k, t]) => [k, `Recommend: ${t}`]));
  }
  speak(
    c,
    c.kind === 'flight' && !fd ? 'dorsey' : D.advise && fd ? 'hollis' : 'kessler',
    fd ? `Flight: ${D.q}${D.advise ? ' What do you recommend?' : ''}` : `${D.q} Your call.`,
    'warn',
    6,
  );
  roomChanged();
}

// Whether the programme takes Flight's recommendation: always when it matches their own leaning, otherwise only when
// they trust Flight's judgement.
const takesAdvice = (choice, D) => choice === D.auto || g.record.trust >= 1;

// The answer to the open question: yours from the console, or the other flight director's.
export function answer(c, choice, speak) {
  const f = c.flight,
    d = f.decision;
  if (!d) return;
  if (choice === 'request-fix' && d.options[choice]) {
    delete d.options[choice];
    d.fixIn = 8;
    speak(c, 'morgan', 'FIDO: fresh tracking requested. Expect a solution in eight mission minutes.', '', 6);
    roomChanged();
    return;
  }
  const timedOut = choice === 'stand-down' && d.remaining === 0;
  const option = timedOut ? 'Stand down. The intercept window closed.' : d.options[choice];
  if (!option) return;
  f.decision = null;
  // Flight recommended; the programme decides.
  if (d.advise && d.mine) {
    const D = DECISIONS[d.id];
    speak(c, 'you', option, '', 5);
    const taken = c.kind !== 'flight' || takesAdvice(choice, D);
    if (!taken) {
      speak(c, 'hollis', `Thank you, Flight. The programme is going the other way: ${D.options[D.auto]}`, 'warn', 6);
      if (c.kind === 'flight')
        note(`You recommended: ${D.options[choice]} ${who('hollis')} and the programme decided otherwise.`);
      choice = D.auto;
      d.mine = false;
      d.who = 'hollis';
    } else speak(c, 'hollis', 'Agreed. That is what we will do.', 'go', 4);
    return settle(c, d, choice, D.options[choice], speak);
  }
  return settle(c, d, choice, option, speak, timedOut);
}
function settle(c, d, choice, option, speak, timedOut = false) {
  const f = c.flight;
  if (d.remaining != null) f.state.groundFix = f.status['GROUND FIX'][0];
  const r = resolve(c.round, d.id, choice, f.state);
  if (d.mine && !d.advise) speak(c, timedOut ? 'morgan' : 'you', option, timedOut ? 'warn' : '', 5);
  for (const [who, text, tone] of r.lines) speak(c, who, text, tone || '', 6);
  Object.assign(f.state, r.set);
  if (r.hurt) f.state.hurt = Math.max(f.state.hurt || 0, r.hurt);
  if (d.id === 'tald') c.calls.edwards = choice === 'edwards';
  if (r.endAt != null) f.endAt = Math.min(f.endAt ?? Infinity, r.endAt);
  if (r.capability) f.capabilities.push(r.capability);
  if (c.kind === 'flight' && r.slip) {
    g.programme.apolloSlip = (g.programme.apolloSlip || 0) + r.slip;
    note(`Every Apollo flight after this one slips ${r.slip} days.`);
  }
  if (c.kind === 'flight' && r.fixes)
    for (const k of r.fixes) {
      const t = adopt(g.programme, k);
      if (t) note(t);
    }
  if (r.set.computer) f.status.COMPUTER = [r.set.computer, r.set.computer === 'down'];
  f.decisions.push({
    id: d.id,
    choice,
    mine: d.mine,
    verdict: r.verdict,
    judge: r.judge,
    rule: d.rule,
    against: d.rule ? againstRule(d.id, choice) : false,
  });
  if (c.kind === 'flight') {
    note(
      timedOut
        ? option
        : `${d.mine && d.advise ? 'On your recommendation, the programme' : d.mine ? 'You' : who(d.who === 'hollis' ? 'hollis' : 'dorsey')} decided: ${option}${r.note ? ` ${r.note}` : ''}`,
    );
    if (r.endAt != null) note(`${c.flight.craft} comes home early, at about ${Math.round(f.endAt)} hours.`);
  }
  roomChanged();
}
// Whether an answer went against the flight's own mission rule. The review asks why.
const AGAINST = { tumble: 'primary', traverse: 'stay' };
const againstRule = (id, choice) => AGAINST[id] === choice;

// Retrofire, or entry interface coming home from the Moon. Sets the round's end; the console carries on through the
// blackout and the recovery as for Mercury.
function retrofire(c, speak) {
  const f = c.flight,
    plan = FLIGHTS[f.id];
  if (!f.state.short && !f.state.stranded && plan.completes) f.capabilities.push(plan.completes);
  if (c.kind !== 'flight') return roomChanged();
  if (f.state.fire) {
    c.round.end = { ...(c.round.end || {}), outcome: 'entry', capsule: 'lost', fire: true, miss: 0, entryG: 0 };
    speak(c, 'hollis', 'Keep the loop quiet. Bring her down on the automatics and get the ships to her.', 'bad', 8);
    note(`${plan.craft} came down on her automatic sequence in the Pacific. Nobody aboard had survived the fire.`);
    c.aim = null;
    c.phase = 'coast';
    c.coastLeft = 2;
    return roomChanged();
  }
  if (f.state.stranded) {
    c.round.end = { ...(c.round.end || {}), outcome: 'entry', capsule: 'lost', stranded: true, miss: 0, entryG: 0 };
    speak(
      c,
      'hollis',
      'There is nothing more we can do for them. Keep the line open as long as they want to talk.',
      'bad',
      8,
    );
    note(
      `The service engine never burned again. ${plan.craft} stayed in lunar orbit, and her crew died there when the oxygen ran out.`,
    );
    c.aim = null;
    c.phase = 'coast';
    c.coastLeft = 2;
    return roomChanged();
  }
  const e =
    plan.entry === 'lunar' && !f.state.earthEntry ? lunarEntry(c.round, f.state) : geminiEntry(c.round, f.state);
  speak(
    c,
    'tate',
    plan.entry === 'lunar' && !f.state.earthEntry
      ? 'Flight, Retro: entry interface. She is in the corridor we gave her.'
      : `Retrofire on time${e.secondary ? ', into the secondary area' : ''}${e.ballistic ? ', rolling entry' : ''}. Four, three, two, one, fire.`,
    'go',
    6,
  );
  speak(c, 'morgan', 'Blackout. We have lost her signal.', 'warn');
  note(
    `${plan.entry === 'lunar' && !f.state.earthEntry ? 'Entry interface' : 'Retrofire'} at ${Math.round(f.at)} hours${e.secondary ? ', one orbit late into the secondary area' : ''}${e.ballistic ? ', on a rolling entry with no computer' : ''}.`,
  );
  c.phase = 'entry';
  c.coastLeft = 3;
  roomChanged();
}

// After the flight: what it showed, on your record as scoped evidence, and the calls as the review will judge them.
export function recordCapabilities(c) {
  const f = c.flight;
  if (!f || c.kind !== 'flight') return [];
  const list = (g.record.capabilities = g.record.capabilities || []);
  for (const id of f.capabilities)
    if (!list.some(x => x.id === id)) list.push({ id, text: CAPABILITIES[id], flight: f.craft, day: g.day });
  return f.capabilities.map(id => CAPABILITIES[id]);
}
// The director of flight operations on the calls that were yours. Another flight director's calls are his, not yours.
export function flightJudgement(decisions) {
  const out = [];
  // The August meeting, judged against what the other side did by Christmas.
  if (SEASON[g.roundIndex].id === 'apollo-8' && g.record.apollo8 && !g.record.scenes.apollo8.judged) {
    g.record.scenes.apollo8.judged = true;
    const zond = sovietHas(g.seed, 'zond-crewed', g.day);
    if (g.record.apollo8 === 'earth' && zond) {
      shiftTrust(g.record, -1);
      out.push(
        `${who('hollis')} on the August meeting: "We waited for the lander, and the Russians went round the Moon first."`,
      );
    } else if (g.record.apollo8 === 'moon' && g.mission.capabilities?.length) {
      shiftTrust(g.record, 1);
      out.push(
        `${who('hollis')} on the August meeting: "You said send them round the Moon. They went, and they came home."`,
      );
    }
  }
  for (const d of decisions || []) {
    if (!d.mine || !d.judge) continue;
    if (d.verdict === 'good') shiftTrust(g.record, 1);
    if (d.verdict === 'bad') shiftTrust(g.record, -1);
    out.push(
      `${who('hollis')} on ${DECISION_NAMES[d.id] || d.id}: "${d.judge}"${d.against ? ` ${cap(heOf('hollis'))} adds: "And you went against the mission rule. Write down why."` : ''}`,
    );
  }
  return out;
}
export const DECISION_NAMES = {
  sps6: 'the service engine burn',
  pogo: 'putting a crew on the next Saturn V',
  evaplan: 'the spacewalk plan',
  rdvplan: 'the rendezvous',
  tumble: 'bringing Gemini 8 home',
  eva: 'the spacewalk',
  computer: 'the computer',
  fuelcell1: 'the fuel cells',
  fuelcell2: 'eight days',
  navcheck: 'the retrofire numbers',
  lightning: 'going on after the lightning',
  smoke: 'the burning smell',
  alarm: 'the program alarms',
  lowfuel: 'the low-fuel landing',
  landpoint: 'the landing point',
  rescue: 'getting the lander back',
  spsbank: 'the service engine switch',
  traverse: 'the walkback limit',
  tli: 'translunar injection',
  loi: 'lunar orbit insertion',
  mcc: 'the last midcourse correction',
  tank: 'the oxygen tank',
  lowpass: 'the low pass',
};
// What the flight's own troubles were, in flight-plan order, for the review: the first one that showed.
export function flightCause(round) {
  if (round.shutdownSeen) return 'shutdown';
  if (round.flightFaultsSeen?.length) return round.flightFaultsSeen[0];
  if (flag(round, 'chute') && round.end?.chute) return 'chute';
  if (flag(round, 'navdata') && round.end?.nav) return 'navdata';
  return null;
}
