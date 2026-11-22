// The hands-on ideas (plans-review/HANDS-ON-GAMEPLAY.md, Aaron 20 November 2026): reading the needles yourself, the
// red-line card and the grease pencil on the dugout's recorder.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  g,
  newGame,
  tick,
  standStart,
  standMark,
  standWipe,
  standMarked,
  standDecide,
  countAnswer,
  POLL_WINDOW,
  trackStick,
  trackShare,
  TRACK,
  standPanelOpen,
  standTakePanel,
  standSwitch,
  standArmed,
  pressValve,
  pressByHand,
  countTank,
  meterSpot,
} from '../js/game.js';
import { newRound, meterReading, METERS } from '../js/truth/round.js';
import { initProgramme } from '../js/world/programme.js';
import { KITS } from '../js/data/kits.js';
import { estimate } from '../js/world/programme.js';
import { tickConsole, INSERT_WINDOW } from '../js/mercury.js';
import { redlineRows } from '../js/scenes/redlines.js';
import { playRound, until, passFlow } from './play.js';

const toRead = () => {
  newGame(7);
  playRound(undefined, undefined, 'staticPrep');
  until(() => g.beat === 'static');
  standStart();
  until(() => g.stand.phase === 'read');
};

test('the red-line card lists every banded channel, and the count room only the pressurisation and firing ones', () => {
  toRead();
  const all = redlineRows('static').map(r => r[0]),
    count = redlineRows('count').map(r => r[0]);
  assert.ok(all.includes('Chamber pressure') && all.includes('Thrust'), all.join(', '));
  assert.ok(count.includes('Firing bus') && !count.includes('Chamber pressure'), count.join(', '));
  assert.ok(count.includes('Igniter continuity'));
  for (const [, lim] of redlineRows('static')) assert.match(lim, /\d+(\.\d)? to \d+|lit before firing/);
});

test('the grease pencil ticks the boxes for what it rings, and wipes off', () => {
  toRead();
  assert.deepEqual(standMarked(), { rework: false, leak: false });
  standMark({ t0: 0, t1: 1, lo: 10, hi: 20, tank: false, chamber: false });
  assert.equal(g.stand.marks?.length ?? 0, 0, 'a ring round nothing is not kept');
  standMark({ t0: 0.2, t1: 2, lo: 10, hi: 20, tank: false, chamber: true });
  assert.deepEqual(standMarked(), { rework: true, leak: false });
  standMark({ t0: 5, t1: 7, lo: 20, hi: 25, tank: true, chamber: false });
  assert.deepEqual(standMarked(), { rework: true, leak: true });
  standWipe();
  assert.deepEqual(standMarked(), { rework: false, leak: false });
  standMark({ t0: 0.2, t1: 2, lo: 10, hi: 20, tank: false, chamber: true });
  standDecide({ rework: true, leak: false });
  assert.ok(
    g.notes.some(n => /ringed the chamber trace in grease pencil/.test(n.text)),
    'the ring goes in the notebook',
  );
  standMark({ t0: 0.2, t1: 2, lo: 10, hi: 20, tank: true, chamber: false });
  assert.equal(g.stand.marks.length, 1, 'no ringing once the call is made');
});

// ---- Idea 2: the clock keeps running ----
const toPoll = () => {
  newGame(7);
  playRound(undefined, undefined, 'poll');
  assert.ok(g.count?.poll, 'at the first poll');
};
const wait = seconds => {
  for (let t = 0; t < seconds; t += 0.05) tick(0.05);
};

test('a poll waits on your call only for its window, then the lead reads your gauge and calls it', () => {
  toPoll();
  assert.equal(g.count.pollLeft, POLL_WINDOW);
  wait(POLL_WINDOW - 1);
  assert.ok(g.count.poll, 'still waiting just inside the window');
  wait(1.5);
  assert.equal(g.count.poll, null, 'the window closed');
  assert.ok(g.count.readings.at(-1).missed);
  assert.ok(g.notes.some(n => /you missed the poll/.test(n.text)));
  assert.ok(
    g.record.memory.some(m => /read your gauge for you/.test(m.text)),
    'the lead remembers',
  );
});

test('as test conductor, a missed poll holds the count', () => {
  toPoll();
  g.record.seat = 'test-conductor';
  g.vehicle = 'aerobee';
  wait(POLL_WINDOW + 0.5);
  assert.equal(g.count.held, true);
  assert.ok(g.notes.some(n => /Delgado called the hold/.test(n.text)));
});

test('answering in time clears the window', () => {
  toPoll();
  wait(3);
  countAnswer(true);
  assert.equal(g.count.pollLeft, null);
  assert.ok(!g.count.readings.at(-1).missed);
});

test('the go / no-go for orbit has a window too: when it closes the team goes with Goddard', () => {
  newGame(11);
  g.record.seat = 'flight';
  g.round.end = { outcome: 'orbit', margin: 0.02, v: 7.8, gammaOff: 0, capsule: 'safe' };
  const c = (g.console = {
    phase: 'insertion',
    live: true,
    kind: 'flight',
    flightId: 'gem-6',
    round: g.round,
    goddard: { go: true },
    calls: {},
    log: [],
  });
  for (let i = 0; i < (INSERT_WINDOW - 1) * 2; i++) tickConsole(0.5);
  assert.equal(c.phase, 'insertion', 'still open inside the window');
  for (let i = 0; i < 4 && c.phase === 'insertion'; i++) tickConsole(0.5);
  assert.equal(c.calls.insertion.expired, true);
  assert.equal(c.calls.insertion.go, true);
  assert.ok(g.notes.some(n => /window closed without a call from (Flight|Retro)/.test(n.text)));
});

// ---- Idea 3: the tracking camera on your hands ----
const flyTracking = steer => {
  newGame(7);
  playRound(undefined, undefined, 'poll');
  while (g.count && g.count.poll) {
    countAnswer(true);
    until(() => !g.count || g.count.poll || g.flight);
  }
  g.speed = 1;
  for (let n = 0; n < 6000 && g.flight.view !== 'done'; n++) {
    const tr = g.flight.track;
    if (tr && steer) trackStick(Math.max(-1, Math.min(1, tr.x * 3)), Math.max(-1, Math.min(1, tr.y * 3)));
    tick(1 / 30);
  }
  return trackShare(g.flight);
};

test('left alone, the tracking camera loses her; kept on her, the film counts double for the drawing office', () => {
  assert.ok(flyTracking(false) < 0.1, 'an untouched mount loses her');
  const share = flyTracking(true);
  assert.ok(share >= TRACK.good, `a careful tracker keeps her ${share}`);
  assert.equal(g.decided.trackShare, share);
  const before = estimate(g.programme, 'wac').flights;
  playRound();
  const flown = g.programme.flights.at(-1);
  if (flown.apogee != null) {
    assert.equal(flown.tracked, true);
    assert.equal(estimate(g.programme, 'wac').flights, before + 2, 'a tracked flight counts twice');
  }
  assert.ok(g.notes.some(n => /Your tracking film/.test(n.text)));
});

// ---- Idea 4: throw the switches ----
test('the firing panel takes its switches in order; out of order it is safed', () => {
  newGame(7);
  playRound(undefined, undefined, 'staticPrep');
  until(() => g.beat === 'static');
  standPanelOpen();
  assert.equal(g.stand.switches, undefined, 'the crew has the panel until you take it');
  standTakePanel();
  assert.deepEqual(g.stand.switches, { power: false, press: false, arm: false });
  standStart();
  assert.equal(g.stand.phase, 'ready', 'the key does nothing on an unarmed panel');
  standSwitch('power');
  const clock = g.clock;
  standSwitch('arm');
  assert.deepEqual(g.stand.switches, { power: false, press: false, arm: false }, 'safed');
  assert.ok(g.clock >= clock + 10);
  for (const k of ['power', 'press', 'arm']) standSwitch(k);
  assert.ok(standArmed());
  standSwitch('power');
  assert.equal(g.stand.switches.power, true, 'no dropping power under an armed stage');
  standStart();
  assert.equal(g.stand.phase, 'count');
});

test('without the panel opened, a count starts as before (the bot, the tapes)', () => {
  newGame(7);
  playRound(undefined, undefined, 'staticPrep');
  until(() => g.beat === 'static');
  standStart();
  assert.equal(g.stand.phase, 'count');
  assert.equal(g.stand.switches, undefined);
});

const toTerminal = () => {
  newGame(7);
  playRound(undefined, undefined, 'poll');
  countAnswer(true);
  until(() => g.count?.poll);
  g.room = 'count';
  countAnswer(true);
};
test('in the terminal count at PRESS, the tank bleeds away unless you hold the valve; out of limits holds the count', () => {
  toTerminal();
  assert.ok(!pressByHand(), 'the regulator keeps the tank until you take the valve');
  pressValve(true);
  pressValve(false);
  assert.ok(pressByHand());
  for (let i = 0; i < 30 * 25 && !g.count.held; i++) tick(1 / 30);
  assert.equal(g.count.held, true, 'left alone, the tank drops out of limits and the count holds');
  assert.ok(g.notes.some(n => /out of limits; the count was held/.test(n.text)));
  toTerminal();
  pressValve(true);
  for (let i = 0; i < 30 * 60 && g.count; i++) {
    pressValve(countTank() < 22.6);
    assert.ok(!g.count.held, 'a careful hand on the valve keeps the count going');
    tick(1 / 30);
  }
  assert.ok(g.flight, 'she flew');
});

test('away from the blockhouse, the regulator keeps the tank and nothing changes', () => {
  newGame(7);
  playRound(undefined, undefined, 'poll');
  countAnswer(true);
  until(() => g.count?.poll);
  countAnswer(true);
  assert.equal(pressByHand(), false);
  pressValve(true);
  assert.ok(!g.count.valve);
});

// ---- Idea 5: the test kit in the hangar ----
test('the test kit reads real defects out of limits far more often than sound parts', () => {
  let faultOut = 0,
    faults = 0,
    soundOut = 0,
    sound = 0;
  for (let seed = 1; seed < 400; seed++) {
    const r = newRound(seed, initProgramme(), 'wac');
    for (const id of Object.keys(KITS.wac.spots)) {
      const read = meterReading(r, id);
      if (!read) continue;
      if (r.faults[id]) (faults++, (faultOut += read.out));
      else (sound++, (soundOut += read.out));
    }
  }
  assert.ok(faults > 20 && faultOut / faults > 0.75, `faults ${faultOut}/${faults}`);
  assert.ok(soundOut / sound < 0.15, `sound ${soundOut}/${sound}`);
});

test('putting the meter on a part costs its time, goes in the notebook, and changes nothing else', () => {
  newGame(7);
  passFlow();
  const before = g.clock;
  meterSpot('fitting');
  assert.equal(g.clock - before, METERS.leak.minutes);
  assert.ok(g.decided.meter.fitting);
  meterSpot('fitting');
  assert.equal(g.clock - before, METERS.leak.minutes, 'once only');
  assert.ok(g.notes.some(n => /Pressure-decay test/i.test(n.text)));
  const flightWith = (() => {
    playRound();
    return g.programme.flights.at(-1);
  })();
  newGame(7);
  passFlow();
  playRound();
  assert.deepEqual(g.programme.flights.at(-1), flightWith, 'the meter draws on nothing the flight uses');
});

// ---------------------------------------------------------------------------------------------------------------------
// 6. Fill in the log (Desk mode): EECOM copies the screen onto the log sheet by hand, and reads it up to Flight.
import { newDesk, tickDesk, act as deskAct, readings as deskReadings, logDue, writeLog } from '../js/desk/model.js';
import { LOG_ROWS, LOG_FIELDS } from '../js/desk/data.js';

const deskTo = (d, t) => {
  while (!d.done && d.t < t) {
    tickDesk(d, 1);
    if (d.hold?.why === 'poll') deskAct(d, 'poll:go');
  }
  return d;
};
const screen = d => Object.fromEntries(LOG_FIELDS.map(f => [f.id, String(f.read(deskReadings(d)))]));

test('desk log: a row opens at its time, is judged against the screen, and is not marked on the sheet', () => {
  const d = newDesk(5);
  assert.equal(logDue(d), -1);
  deskTo(d, LOG_ROWS[0]);
  assert.equal(logDue(d), 0);
  const row = writeLog(d, screen(d));
  assert.equal(row.result, 'good');
  assert.equal(logDue(d), -1);
  assert.equal(writeLog(d, screen(d)), null, 'a written row cannot be written again');
  deskTo(d, LOG_ROWS[1]);
  const bad = writeLog(d, { ...screen(d), o2q1: '87.0', cabin: '' });
  assert.equal(bad.result, 'wrong');
  assert.deepEqual(bad.wrong.sort(), ['cabin', 'o2q1']);
});

test('desk log: a row left too long goes in late, and an overtaken row stays blank', () => {
  const d = newDesk(6);
  deskTo(d, LOG_ROWS[0] + 700);
  assert.equal(writeLog(d, screen(d)).result, 'late');
  deskTo(d, LOG_ROWS[2] + 5);
  assert.equal(logDue(d), 2, 'the T-1:00 row was overtaken');
  assert.equal(d.logbook[1], undefined);
});

test('desk log: an off-scale probe is logged as OFF HI', () => {
  const d = newDesk(8, { whatIf: 'o2' });
  deskTo(d, LOG_ROWS[1]);
  assert.ok(deskReadings(d).o2q[1] > 102);
  assert.equal(writeLog(d, { ...screen(d), o2q2: 'OFF HI' }).result, 'good');
});

test('desk read-up: Flight hears the numbers off the log and checks them', () => {
  const good = newDesk(9);
  deskTo(good, LOG_ROWS[2]);
  writeLog(good, screen(good));
  deskTo(good, -650);
  assert.ok(good.asks.readup, 'Flight asks for the read-up');
  assert.ok(deskAct(good, 'readup:log'));
  assert.equal(good.asks.readup.result, 'good');
  assert.match(
    good.calls.length ? good.log.filter(l => l.who === 'eecom').at(-1).text : '',
    /From my log at T-0:20:00/,
  );

  const wrong = newDesk(9);
  deskTo(wrong, LOG_ROWS[2]);
  writeLog(wrong, { ...screen(wrong), h2q2: '50' });
  deskTo(wrong, -650);
  deskAct(wrong, 'readup:log');
  assert.equal(wrong.asks.readup.result, 'wrong');

  const none = deskTo(newDesk(9), -650);
  deskAct(none, 'readup:log');
  assert.equal(none.asks.readup.result, 'wrong');
  deskTo(none, 1);
  assert.ok(!none.verdict.clean);
  assert.match(none.verdict.lines.join(' '), /log sheet never went in/);
});

// ---------------------------------------------------------------------------------------------------------------------
// 7. Run the pad emergency (Management): a leak or a fire on a pad, crews directed on the map against its own clock.
import {
  CHANCE,
  QUIET_DAYS,
  AUTO_AFTER,
  emergencyToday,
  startEmergency,
  orderCrew,
  tickEmergency,
  endEmergency,
  emergencyCost,
} from '../js/manage/emergency.js';
import { CAPE_1958_BASE } from '../js/manage/base.js';

const PAD = CAPE_1958_BASE.find(b => b.id === 'lc-14');
const standing = day => [{ pad: PAD, flight: { id: 'atlas-x', name: 'Atlas X', launch: day + 10 } }];
const run = (game, minutes) => {
  const lines = [];
  for (let m = 0; m < minutes && game.emergency && !game.emergency.done; m++)
    lines.push(...tickEmergency(game, CAPE_1958_BASE, 1));
  return lines;
};
const freshGame = () => ({ seed: 3, day: 1000, flown: [{ id: 'explorer-6' }], committed: { 'atlas-x': 1010 } });

test('pad emergency: rare, never before the first flight, never twice close together, never on launch day', () => {
  let hits = 0;
  for (let day = 0; day < 20000; day++)
    if (emergencyToday({ seed: 11, day, flown: [{ id: 'x' }] }, standing(day))) hits++;
  assert.ok(Math.abs(hits / 20000 - CHANCE) < 0.004, `rate ${hits / 20000}`);
  const day = [...Array(5000).keys()].find(d =>
    emergencyToday({ seed: 11, day: d, flown: [{ id: 'x' }] }, standing(d)),
  );
  assert.equal(emergencyToday({ seed: 11, day, flown: [] }, standing(day)), null);
  assert.equal(
    emergencyToday(
      { seed: 11, day, flown: [{ id: 'x' }], emergencies: [{ day: day - QUIET_DAYS + 1 }] },
      standing(day),
    ),
    null,
  );
  assert.equal(
    emergencyToday({ seed: 11, day, flown: [{ id: 'x' }] }, [{ ...standing(day)[0], flight: { launch: day } }]),
    null,
  );
});

test('pad emergency: a leak met at once is closed off before it lights, and nobody is hurt', () => {
  const game = freshGame();
  startEmergency(game, CAPE_1958_BASE, { kind: 'leak', pad: 'lc-14', flight: 'atlas-x' });
  for (const crew of ['safety', 'pad', 'fire']) orderCrew(game, CAPE_1958_BASE, crew, 'pad');
  run(game, 60);
  assert.ok(game.emergency.done);
  assert.equal(game.emergency.stage, 'leak', 'it never lit');
  assert.ok(game.emergency.cleared);
  const lines = endEmergency(game, CAPE_1958_BASE, [{ id: 'atlas-x', name: 'Atlas X', launch: 1010 }]);
  assert.equal(game.emergency, null);
  assert.equal(game.committed['atlas-x'], 1012);
  assert.match(lines.join(' '), /slips 2 days.*Nobody was hurt/);
  assert.equal(game.emergencies.length, 1);
});

test('pad emergency: with no orders the head of launch operations sends the crews, and it always ends', () => {
  for (const kind of ['leak', 'fire']) {
    const game = freshGame();
    startEmergency(game, CAPE_1958_BASE, { kind, pad: 'lc-14', flight: 'atlas-x' });
    tickEmergency(game, CAPE_1958_BASE, AUTO_AFTER - 0.5);
    assert.ok(!game.emergency.auto);
    const lines = run(game, 300);
    assert.ok(game.emergency.done, kind);
    assert.ok(game.emergency.auto);
    assert.match(lines.join(' '), /No orders from you/);
  }
});

test('pad emergency: a fire let grow takes the rocket, and the record keeps it as lost on the pad', () => {
  const game = freshGame();
  startEmergency(game, CAPE_1958_BASE, { kind: 'fire', pad: 'lc-14', flight: 'atlas-x' });
  orderCrew(game, CAPE_1958_BASE, 'safety', 'pad');
  game.emergency.heat = 1.45;
  const lines = run(game, 2);
  assert.ok(game.emergency.lost);
  assert.match(lines.join(' '), /gone up in the fire/);
  run(game, 400);
  assert.ok(game.emergency.done);
  assert.deepEqual(emergencyCost(game.emergency), { slip: 0, lost: true, hurt: game.emergency.hurt });
  endEmergency(game, CAPE_1958_BASE, [{ id: 'atlas-x', name: 'Atlas X', launch: 1010 }]);
  assert.deepEqual(game.flown.at(-1), { id: 'atlas-x', day: 1000, pad: 'lc-14', result: 'lost', cause: 'pad' });
});

test('pad emergency: anyone still on the tower when the spill lights is hurt', () => {
  const game = freshGame();
  startEmergency(game, CAPE_1958_BASE, { kind: 'leak', pad: 'lc-14', flight: 'atlas-x' });
  orderCrew(game, CAPE_1958_BASE, 'fire', 'pad'); // the fire crew first, nobody to clear the tower
  game.emergency.heat = 0.95;
  run(game, 1);
  assert.equal(game.emergency.stage, 'fire');
  assert.equal(game.emergency.hurt, 3);
});
