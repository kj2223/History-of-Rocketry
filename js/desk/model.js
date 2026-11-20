// DESK MODE: the EECOM desk's state through the pre-launch count, and its rules. Pure: no DOM, no clock of its own.
// The view calls tickDesk with the seconds that pass (already multiplied by the speed) and act() for each thing the
// player does. Attention is the resource: lines on a loop that is not turned up are lost (only the key lights), while
// the teletype prints for everyone. The state is plain JSON, so it is also the save.
import {
  START_T,
  LOOPS,
  MAX_UP,
  START_UP,
  ASKS,
  TASKS,
  SCRIPT,
  RESEAL,
  LIFTOFF_UTC,
  EDT,
  LOG_ROWS,
  LOG_OPEN,
  LOG_FIELDS,
} from './data.js';

export const WHAT_IFS = ['leak', 'o2'];
const REPEAT = 60; // Flight asks again after a minute with no answer
const POLL_HOLD_AT = -230; // T-3:50: no GO from EECOM, Flight holds the count
const LATE_HOLD_AT = -240; // T-4:00: the Cape catches a cabin that will not hold

// A small deterministic hash for the readings' noise, so the same seed and second give the same reading.
const hash = (a, b, c) => {
  let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(c + 0x27d4eb2f, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// whatIf: false for the real count; true to add one seeded fault (not historical); or 'leak' / 'o2' to choose it.
export function newDesk(seed = Math.floor(Math.random() * 1e9), { whatIf = false } = {}) {
  const fault = whatIf === true ? WHAT_IFS[seed % WHAT_IFS.length] : WHAT_IFS.includes(whatIf) ? whatIf : null;
  return {
    kind: 'desk',
    mission: 'apollo11',
    slice: 'prelaunch',
    seed,
    fault,
    t: START_T, // count time
    clock: 0, // seconds since the desk opened, holds included
    next: 0, // the next line of SCRIPT
    up: [...START_UP],
    lights: {}, // loop -> clock of the last line said on it while it was down
    sys: { power: 'ground', hatch: 'open', suit: 'off', batTie: false, fixed: false, o2Called: false },
    asks: {}, // id -> { opened, said, answer, result }
    tasks: {}, // id -> { at, result }
    hold: null, // { why, since, next, offset, forced }
    holds: [],
    log: [], // { clock, t, loop, who, text, heard }
    tty: [], // { clock, t, text }
    calls: [], // what the player said: { clock, t, to, id, result }
    done: false,
  };
}

// Throws on anything that is not a desk this version can carry on.
export function checkDesk(d) {
  if (!d || typeof d !== 'object' || d.kind !== 'desk' || d.mission !== 'apollo11') throw new Error('not a desk');
  if (!Number.isInteger(d.seed) || typeof d.t !== 'number' || typeof d.clock !== 'number') throw new Error('no clock');
  if (!Array.isArray(d.up) || d.up.some(l => !(l in LOOPS))) throw new Error('bad loops');
  if (!Array.isArray(d.log) || !Array.isArray(d.tty) || typeof d.sys !== 'object') throw new Error('bad desk');
}

export const leaking = d => d.fault === 'leak' && !d.sys.fixed && d.sys.hatch === 'closed';

// The desk's readings now. Nominal values are plausible, not archival (data.js). Noise is seeded.
export function readings(d) {
  const n = (k, size) => (hash(d.seed, Math.floor(d.clock / 4), k) - 0.5) * 2 * size;
  const internal = d.sys.power === 'internal';
  // Cabin: at ambient with the hatch open; pressurised a little above after the purge; a leak bleeds it down.
  let cabin = 14.7;
  if (d.sys.hatch === 'closed') {
    const since = Math.max(0, d.t - (d.sys.closedAt ?? d.t));
    const rate = leaking(d) ? 0.06 : 0.004; // psi a minute
    cabin = Math.max(14.7, 15.6 - (rate * since) / 60);
  }
  const fc = internal ? 24.5 : 9.5;
  return {
    cabin: +(cabin + n(1, 0.01)).toFixed(2),
    suit: d.sys.suit === 'on' ? +(cabin - 0.25 + n(2, 0.02)).toFixed(2) : null,
    o2p: [+(902 + n(3, 4)).toFixed(0), +(900 + n(4, 4)).toFixed(0)],
    o2q: [+(99.4 + n(5, 0.3)).toFixed(1), d.fault === 'o2' && d.t >= -3600 ? 104.9 : +(99.1 + n(6, 0.3)).toFixed(1)],
    h2p: [+(245 + n(7, 2)).toFixed(0), +(244 + n(8, 2)).toFixed(0)],
    h2q: [+(99.6 + n(9, 0.3)).toFixed(1), +(99.3 + n(10, 0.3)).toFixed(1)],
    fc: [0, 1, 2].map(i => +(fc + n(11 + i, 0.8)).toFixed(1)),
    busA: +((internal ? 28.6 : 28.0) + n(14, 0.1)).toFixed(1),
    busB: +((internal ? 28.5 : 28.0) + n(15, 0.1)).toFixed(1),
    bat: d.sys.batTie && internal ? [+(3.1 + n(16, 0.3)).toFixed(1), +(3.0 + n(17, 0.3)).toFixed(1)] : [0, 0],
    power: internal ? 'INTERNAL' : 'GROUND',
  };
}

// The console's event lights: what the hardware would light, from the readings.
export function eventLights(d) {
  const r = readings(d);
  return {
    'CABIN P': leaking(d) && d.t - (d.sys.closedAt ?? d.t) > 240,
    'O2 QTY 2': r.o2q[1] > 102,
    'BUS UV': r.busA < 26.25 || r.busB < 26.25,
    'GSE PWR': !(d.sys.power === 'internal'),
  };
}

const say = (d, loop, who, text) => {
  const heard = who === 'eecom' || d.up.includes(loop);
  d.log.push({ clock: d.clock, t: d.t, loop, who, text, heard });
  if (!heard) d.lights[loop] = d.clock;
};
const print = (d, text) => d.tty.push({ clock: d.clock, t: d.t, text });

function openAsk(d, id) {
  if (d.asks[id]) return;
  if (id === 'o2' && d.sys.o2Called) return; // EECOM already called it
  d.asks[id] = { opened: d.t, said: d.t, answer: null, result: null };
  say(d, 'flight', 'flight', ASKS[id].q);
}

function fire(d, e) {
  if (e.when && d.fault !== e.when) return;
  if (e.unless && d.fault === e.unless) return;
  if (e.set) Object.assign(d.sys, e.set);
  if (e.set?.hatch === 'closed') d.sys.closedAt = d.t;
  if (e.ask) openAsk(d, e.ask);
  else say(d, e.loop, e.who, e.text);
  if (e.tty) print(d, e.tty);
}

// The teletype: a page of the desk's data every ten minutes of count, every minute through the leak check, and
// whenever a milestone moves the spacecraft's state.
function teletype(d, before) {
  const r = () => readings(d);
  const crossed = step => Math.floor(d.t / step) > Math.floor(before / step);
  const at = step => count(Math.floor(d.t / step) * step); // stamped on the minute it crossed
  if (crossed(600)) {
    const x = r();
    print(
      d,
      `${at(600)}  CAB ${x.cabin.toFixed(2)}  O2 ${x.o2p.join('/')} PSIA ${x.o2q.join('/')}%  H2 ${x.h2p.join('/')} PSIA  FC ${x.fc.join('/')} A  MNA ${x.busA} MNB ${x.busB} V  ${x.power}`,
    );
  } else if (d.sys.leakCheck && d.t < -4800 && crossed(60)) {
    print(d, `${at(60)}  CABIN P ${r().cabin.toFixed(2)} PSIA`);
  }
}

function startHold(d, why, forced = false) {
  if (d.hold) return;
  const offset = d.t > -2580 ? 600 : 0; // the access arm has to swing back first
  d.hold = { why, since: d.clock, next: 0, offset, forced, at: d.t };
  d.holds.push({ why, at: d.t, forced });
  if (why === 'poll') say(d, 'flight', 'flight', 'Hold the count. I don’t have a GO from EECOM.');
  else if (forced) say(d, 'launch', 'launch', 'Hold, hold, hold. Spacecraft cabin pressure is out of limits.');
  else say(d, 'flight', 'flight', 'Copy, EECOM. Launch, Houston, we’d like to hold the count.');
}

function holdTick(d) {
  const h = d.hold;
  if (h.why === 'poll') {
    // A hold for an unanswered poll lasts until EECOM answers; then a minute to pick the count back up.
    if (d.asks.poll?.answer && d.clock - (h.answeredAt ?? d.clock) >= 60) endHold(d);
    return;
  }
  if (h.why === 'unneeded') {
    if (d.clock - h.since >= 300) {
      say(d, 'flight', 'flight', 'Okay, we’re picking up the count.');
      endHold(d);
    }
    return;
  }
  const into = d.clock - h.since;
  while (h.next < RESEAL.length && RESEAL[h.next].at + (h.next ? h.offset : 0) <= into) {
    const e = RESEAL[h.next++];
    if (e.fix) {
      d.sys.fixed = true;
      d.sys.closedAt = d.t;
    }
    say(d, e.loop, e.who, e.text);
  }
  if (h.next >= RESEAL.length) endHold(d);
}

function endHold(d) {
  d.holds.at(-1).length = d.clock - d.hold.since;
  d.hold = null;
}

// Asks that nobody has answered: Flight asks again each minute, and gives up at the end of the ask's time.
function chase(d) {
  for (const [id, a] of Object.entries(d.asks)) {
    if (a.result) continue;
    if (id === 'poll') {
      if (d.t >= POLL_HOLD_AT && !a.answer) {
        a.result = 'missed';
        startHold(d, 'poll');
      } else if (d.t - a.said >= REPEAT / 2 && !a.answer) {
        a.said = d.t;
        say(d, 'flight', 'flight', 'EECOM, Flight?');
      }
      continue;
    }
    if (d.t - a.opened >= ASKS[id].lasts) {
      a.result = 'missed';
      say(d, 'flight', 'flight', 'Okay, I’ll come back to EECOM.');
    } else if (d.t - a.said >= REPEAT) {
      a.said = d.t;
      say(d, 'flight', 'flight', 'EECOM, Flight?');
    }
  }
}

function step(d, dt) {
  d.clock += dt;
  if (d.hold) return holdTick(d);
  const before = d.t;
  d.t = Math.min(0, d.t + dt);
  while (d.next < SCRIPT.length && SCRIPT[d.next].t <= d.t) fire(d, SCRIPT[d.next++]);
  teletype(d, before);
  chase(d);
  if (d.hold) return;
  if (before < LATE_HOLD_AT && d.t >= LATE_HOLD_AT && leaking(d)) startHold(d, 'leak', true);
  if (d.t >= 0 && d.next >= SCRIPT.length) {
    d.done = true;
    for (const id of Object.keys(TASKS)) if (!d.tasks[id]) d.tasks[id] = { at: null, result: 'missed' };
    d.verdict = verdict(d);
  }
}

// Let seconds pass. Steps a second at a time so nothing in the count is jumped over.
export function tickDesk(d, seconds) {
  let left = seconds;
  while (left > 0 && !d.done) {
    const dt = Math.min(1, left);
    step(d, dt);
    left -= dt;
  }
  return d;
}

// Turn a loop up or down. Turning one up past MAX_UP turns the oldest down.
export function toggleLoop(d, loop) {
  if (!(loop in LOOPS)) return;
  if (d.up.includes(loop)) d.up = d.up.filter(l => l !== loop);
  else {
    d.up.push(loop);
    while (d.up.length > MAX_UP) d.up.shift();
    delete d.lights[loop];
  }
}

// THE LOG SHEET. The row open to write now (the latest log time passed, if it has not been written), or -1. A row
// whose time has been overtaken by the next one can no longer be written: it stays blank on the sheet.
export function logDue(d) {
  for (let i = LOG_ROWS.length - 1; i >= 0; i--) if (d.t >= LOG_ROWS[i]) return d.logbook?.[i] ? -1 : i;
  return -1;
}

// One entry as the player wrote it, against the screen now. "OFF HI" (or "HI") is right for a probe off scale.
function entryOk(field, text, r) {
  const v = String(text ?? '')
    .trim()
    .toUpperCase();
  const truth = field.read(r);
  if (/HI/.test(v)) return truth > 102;
  const x = Number(v.replace(',', '.'));
  return v !== '' && Number.isFinite(x) && Math.abs(x - truth) <= field.tol + 1e-9;
}

// Write the open row in, from what the player typed ({ cabin: '15.58', o2q1: '99.4', ... }). Returns the row, or null
// if nothing is open. The sheet does not mark it: Flight finds out at the read-up, and the debrief says.
export function writeLog(d, values) {
  const i = logDue(d);
  if (i < 0 || d.done) return null;
  const r = readings(d);
  const wrong = LOG_FIELDS.filter(f => !entryOk(f, values?.[f.id], r)).map(f => f.id);
  const kept = Object.fromEntries(LOG_FIELDS.map(f => [f.id, String(values?.[f.id] ?? '').trim()]));
  const result = wrong.length ? 'wrong' : d.t - LOG_ROWS[i] > LOG_OPEN ? 'late' : 'good';
  return ((d.logbook ??= {})[i] = { at: d.t, values: kept, wrong, result });
}

// The newest row written, for the read-up.
const lastLogged = d => {
  for (let i = LOG_ROWS.length - 1; i >= 0; i--) if (d.logbook?.[i]) return { i, row: d.logbook[i] };
  return null;
};
const QUANTS = ['o2q1', 'o2q2', 'h2q1', 'h2q2'];
function readupText(d) {
  const got = lastLogged(d);
  if (!got) return 'Flight, EECOM. I don’t have them on the log.';
  const v = got.row.values,
    q = id => v[id] || 'blank';
  return `From my log at ${count(LOG_ROWS[got.i])}: O2 ${q('o2q1')} and ${q('o2q2')}, H2 ${q('h2q1')} and ${q('h2q2')} percent.`;
}

// What the player can say now: answers to Flight's open questions, calls up to the crew, and calls to Flight.
export function callOptions(d) {
  const out = [];
  for (const [id, a] of Object.entries(d.asks))
    if (id === 'poll' ? !a.answer : !a.result)
      for (const o of ASKS[id].options)
        out.push({
          to: 'flight',
          id: `${id}:${o.id}`,
          text: id === 'readup' && o.id === 'log' ? readupText(d) : o.text,
          answer: true,
        });
  for (const [id, task] of Object.entries(TASKS))
    if (!d.tasks[id]) out.push({ to: 'capcom', id: `task:${id}`, text: task.call });
  // Offered all through the count, fault or not, so the comms stack never gives a fault away.
  if (!d.sys.o2Called && !d.asks.o2)
    out.push({
      to: 'flight',
      id: 'report:o2',
      text: 'Flight, EECOM. O2 tank 2 quantity probe has failed; the pressure is good and agrees with tank 1. No constraint.',
    });
  if (!d.hold && d.t < -30) out.push({ to: 'flight', id: 'hold', text: 'Flight, EECOM. Recommend we hold the count.' });
  return out;
}

const right = (d, ask, answer) => {
  if (ask === 'leak') return answer === (leaking(d) ? 'hold' : 'good');
  if (ask === 'poll') return answer === (leaking(d) ? 'nogo' : 'go');
  if (ask === 'o2') return answer === 'probe';
  if (ask === 'readup') {
    const got = lastLogged(d);
    return answer === 'log' && !!got && !got.row.wrong.some(id => QUANTS.includes(id));
  }
  return answer === 'good';
};

// The player says something. Returns false if it is not a call that can be made now.
export function act(d, id) {
  if (d.done || !callOptions(d).some(o => o.id === id)) return false;
  const log = (to, result) => d.calls.push({ clock: d.clock, t: d.t, to, id, result });
  const [kind, which] = id.split(':');
  const text = callOptions(d).find(o => o.id === id).text;
  if (kind === 'task') {
    const task = TASKS[which];
    if (d.t < task.from) {
      say(d, 'flight', 'capcom', 'EECOM, CAPCOM. Bit early for that one. Give me a call in the window.');
      log('capcom', 'early');
      return true;
    }
    const result = d.t <= task.to ? 'done' : 'late';
    d.tasks[which] = { at: d.t, result };
    if (which === 'battie') d.sys.batTie = true;
    say(
      d,
      'ag',
      'capcom',
      `Apollo 11, Houston. ${task.call.replace(/^Ask the crew (to |for )/, 'We’d like ').replace(/\.$/, ', please.')}`,
    );
    say(d, 'ag', which === 'battie' ? 'cmp' : 'lmp', 'Roger, Houston. Done.');
    log('capcom', result);
    return true;
  }
  say(d, 'flight', 'eecom', text);
  if (id === 'hold') {
    if (leaking(d)) {
      log('flight', 'good');
      if (d.asks.leak && !d.asks.leak.result) d.asks.leak.result = 'good';
      startHold(d, 'leak');
    } else {
      log('flight', 'unneeded');
      say(d, 'flight', 'flight', 'What have you got, EECOM? … I don’t see it. Negative, we’re not holding.');
    }
    return true;
  }
  if (id === 'report:o2') {
    if (!(d.fault === 'o2' && d.t >= -3600)) {
      log('flight', 'unneeded');
      say(d, 'flight', 'flight', 'I’ve got O2 tank 2 quantity reading normal, EECOM. Check your display.');
      return true;
    }
    d.sys.o2Called = true;
    log('flight', 'good');
    say(d, 'flight', 'flight', 'Copy, EECOM. Probe on O2 tank 2, no constraint.');
    return true;
  }
  const a = d.asks[kind];
  if (which === 'standby') {
    a.said = d.t;
    log('flight', 'standby');
    say(d, 'flight', 'flight', 'Okay, come back to me.');
    return true;
  }
  a.answer = which;
  const ok = right(d, kind, which);
  a.result = !ok ? 'wrong' : a.result === 'missed' ? 'missed' : d.t - a.opened > REPEAT ? 'slow' : 'good';
  log('flight', a.result);
  if (kind === 'o2') d.sys.o2Called = true;
  if (kind === 'poll' && d.hold?.why === 'poll') d.hold.answeredAt = d.clock;
  if (kind === 'readup') {
    say(
      d,
      'flight',
      'flight',
      ok ? 'Copy, EECOM. Got them.' : 'That’s not what I have on my data, EECOM. Check your log.',
    );
    return true;
  }
  if (which === 'hold' || which === 'nogo') {
    if (leaking(d)) {
      say(d, 'flight', 'flight', 'Copy. Launch, Houston: we need to hold for the spacecraft hatch.');
      if (!d.hold) startHold(d, 'leak');
    } else {
      a.result = 'wrong';
      d.calls.at(-1).result = 'wrong';
      say(
        d,
        'flight',
        'flight',
        which === 'nogo'
          ? 'Say again your reason, EECOM? … I’ve got a GO from everyone else on the data. We’ll hold five and look.'
          : kind === 'o2'
            ? 'Negative, EECOM. The pressure is fine; we’re not holding for a quantity probe.'
            : 'Negative, EECOM. The cabin’s holding on my data. We’re not holding.',
      );
      if (which === 'nogo') startHold(d, 'unneeded');
    }
  } else say(d, 'flight', 'flight', kind === 'poll' ? 'Copy.' : 'Copy, EECOM.');
  return true;
}

// Count time as the room wrote it: T-2:40:00, T-0:00:09, T+0:00:00.
export function count(t) {
  const s = Math.round(Math.abs(t)),
    p = n => String(n).padStart(2, '0');
  return `T${t > 0 ? '+' : '-'}${Math.floor(s / 3600)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}
// The wall clock in Houston and at the Cape, for the desk's clock. Holds push the launch later.
export function wall(d) {
  const ms = LIFTOFF_UTC + (START_T + d.clock) * 1000,
    at = new Date(ms + EDT * 1000),
    p = n => String(n).padStart(2, '0');
  return {
    edt: `${p(at.getUTCHours())}:${p(at.getUTCMinutes())}:${p(at.getUTCSeconds())}`,
    gmt: new Date(ms).toISOString().slice(11, 19),
  };
}
// How late the launch went, in seconds, from the holds.
export const slip = d => d.clock - (d.t - START_T);

// The Flight Director's write-up of the desk, at liftoff. Plain sentences, not a score.
export function verdict(d) {
  const notes = [],
    good = [],
    asks = d.asks;
  const late = Math.round(slip(d) / 60);
  if (asks.ingress?.result === 'good') good.push('you had the suit loop for me the moment I asked');
  else if (asks.ingress?.result === 'missed')
    notes.push('I asked about the suit loop after ingress and never heard from you');
  if (d.fault === 'leak') {
    const held = d.holds.find(h => h.why === 'leak');
    if (held && !held.forced)
      good.push(
        `you called the cabin leak and asked for the hold at ${count(held.at)}, so the closeout crew could reseat the hatch while we still had time`,
      );
    else if (held?.forced)
      notes.push(
        'the Cape caught the cabin leak at T-4 minutes, after EECOM had let it go. That one was ours to call, and the late hold cost us',
      );
    const ssr = d.log.find(l => l.loop === 'ssr' && /faster than it ought/.test(l.text));
    if (ssr && !ssr.heard)
      notes.push(`your back room called the decay at ${count(ssr.t)}, but you weren’t on their loop`);
  } else if (asks.leak?.result === 'good' || asks.leak?.result === 'slow')
    good.push('the leak check report was clean and on time');
  else if (asks.leak?.result === 'missed') notes.push('I never got the leak check from you');
  if (d.fault === 'o2') {
    if (d.sys.o2Called && !d.calls.some(c => c.id === 'o2:hold' || c.id === 'poll:nogo'))
      good.push('you read the O2 tank 2 quantity as the probe and said so, which kept the count running');
    else if (d.calls.some(c => c.id === 'o2:hold' || c.id === 'poll:nogo'))
      notes.push(
        'you wanted to hold for an O2 quantity probe whose pressure never moved. Read the pressure before the quantity',
      );
    else notes.push('the O2 tank 2 quantity went off scale and EECOM never said a word about it');
  }
  if (asks.internal?.result === 'good') good.push('the power transfer at T-15 was called clean');
  else if (asks.internal?.result === 'wrong')
    notes.push('you called the buses low on internal power, and they weren’t');
  else if (asks.internal?.result === 'missed') notes.push('nothing from you after the transfer to internal power');
  for (const [id, task] of Object.entries(TASKS)) {
    const r = d.tasks[id]?.result;
    if (r === 'done') good.push(`the ${task.short} went up in the window`);
    else if (r === 'late') notes.push(`the ${task.short} went up late`);
    else notes.push(`the ${task.short} never went up to the crew`);
  }
  const sheet = LOG_ROWS.map((at, i) => ({ at: count(at).replace(/:00$/, ''), row: d.logbook?.[i] }));
  const list = rows => rows.map(x => x.at).join(rows.length > 2 ? ', ' : ' and ');
  const blank = sheet.filter(x => !x.row),
    off = sheet.filter(x => x.row?.result === 'wrong'),
    slow = sheet.filter(x => x.row?.result === 'late');
  if (!blank.length && !off.length && !slow.length) good.push('your log sheet went in on time and matched the data');
  if (blank.length) notes.push(`the ${list(blank)} line${blank.length > 1 ? 's' : ''} on the log sheet never went in`);
  if (off.length)
    notes.push(`the ${list(off)} log line${off.length > 1 ? 's' : ''} had numbers that weren’t on the screen`);
  if (slow.length) notes.push(`the ${list(slow)} log line${slow.length > 1 ? 's' : ''} went in late`);
  if (asks.readup?.result === 'good' || asks.readup?.result === 'slow')
    good.push('you read the cryo quantities up off your log when I asked');
  else if (asks.readup?.result === 'wrong') notes.push('the quantities you read up off the log didn’t match my data');
  else if (asks.readup?.result === 'missed') notes.push('I asked for the cryo quantities and never got them');
  const poll = asks.poll;
  if (poll?.result === 'missed') notes.push('I held the count at T-3:50 because I couldn’t get a GO out of EECOM');
  else if (poll?.result === 'wrong')
    notes.push(
      `you answered the poll ${poll.answer === 'go' ? 'GO with a cabin that would not hold' : 'NO-GO without a reason on the data'}`,
    );
  const unneeded = d.calls.filter(c => c.result === 'unneeded' || c.result === 'early').length;
  if (unneeded) notes.push(`${unneeded === 1 ? 'one call' : `${unneeded} calls`} we didn’t need`);
  const heard = d.log.filter(l => l.text && l.who !== 'eecom'),
    missed = heard.filter(l => !l.heard).length;
  const listen = `You heard ${heard.length - missed} of the ${heard.length} things said on the loops.`;
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const lines = [];
  lines.push(
    late > 0
      ? `Apollo 11 lifted off ${late} minute${late === 1 ? '' : 's'} late, at ${wall(d).edt} Eastern.`
      : 'Apollo 11 lifted off on time, at 09:32 Eastern.',
  );
  if (good.length) lines.push(`${cap(good.join('; '))}.`);
  if (notes.length) lines.push(`For the debrief: ${notes.join('; ')}.`);
  lines.push(listen);
  const clean = notes.length === 0;
  lines.push(
    clean
      ? 'That’s a clean count from EECOM. Same again for the rest of the flight.'
      : notes.length <= 2
        ? 'Good enough to fly, and close to clean. Tighten it up.'
        : 'We flew, but EECOM was behind the count. Go over the tapes before the next shift.',
  );
  return { lines, clean, notes: notes.length, slip: late, fault: d.fault };
}

// Where a desk game stands, for the title screen.
export const deskWhere = d =>
  d.done ? 'Apollo 11, the count is flown' : `Apollo 11, ${count(d.t)}${d.fault ? ' (what if)' : ''}`;
