import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newDesk,
  tickDesk,
  act,
  callOptions,
  toggleLoop,
  readings,
  eventLights,
  checkDesk,
  count,
  wall,
  slip,
  deskWhere,
} from '../js/desk/model.js';
import { SCRIPT, START_T, MAX_UP, TASKS } from '../js/desk/data.js';
import { exportSave, parseSave, DESK, MANAGEMENT, FLIGHT } from '../js/core/save.js';

// Run the count to a count time, then do what's asked.
const to = (d, t) => {
  while (!d.done && d.t < t && !d.hold) tickDesk(d, 1);
  return d;
};
const through = d => {
  let guard = 0;
  while (!d.done && guard++ < 50000) {
    tickDesk(d, 1);
    if (d.hold?.why === 'poll') act(d, 'poll:go'); // a desk that never answers the poll would hold for ever
  }
  return d;
};
// A good desk: answers every ask right as soon as it opens, makes each task in its window.
const playWell = d => {
  let guard = 0;
  while (!d.done && guard++ < 50000) {
    tickDesk(d, 1);
    for (const o of callOptions(d)) {
      const [k, w] = o.id.split(':');
      if (k === 'task' && d.t >= TASKS[w].from) act(d, o.id);
    }
    const open = callOptions(d).filter(o => o.answer);
    for (const o of open) {
      const [k, w] = o.id.split(':');
      const want =
        k === 'leak' ? (d.fault === 'leak' ? 'hold' : 'good') : k === 'poll' ? 'go' : k === 'o2' ? 'probe' : 'good';
      if (w === want) act(d, o.id);
    }
  }
  return d;
};

test('the count runs from T-2:40:00 to liftoff and the script is in time order', () => {
  assert.equal(count(START_T), 'T-2:40:00');
  assert.equal(count(-9), 'T-0:00:09');
  for (let i = 1; i < SCRIPT.length; i++) assert.ok(SCRIPT[i].t >= SCRIPT[i - 1].t, `line ${i} out of order`);
  const d = through(newDesk(7));
  assert.ok(d.done);
  assert.equal(d.t, 0);
  assert.ok(d.verdict.lines.length >= 3);
});

test('the real count, played well, lifts off on time at 09:32 with a clean write-up', () => {
  const d = playWell(newDesk(11));
  assert.equal(d.fault, null);
  assert.equal(slip(d), 0);
  assert.equal(wall(d).edt, '09:32:00');
  assert.equal(wall(d).gmt, '13:32:00');
  assert.ok(d.verdict.clean, d.verdict.lines.join(' '));
  assert.match(d.verdict.lines[0], /on time/);
});

test('a loop that is down is not heard: only its key lights', () => {
  const d = newDesk(3);
  assert.deepEqual(d.up, ['flight', 'launch']);
  to(d, -8800); // the back room calls the suit loop at T-2:28
  const ssr = d.log.find(l => l.loop === 'ssr');
  assert.equal(ssr.heard, false);
  assert.ok(d.lights.ssr != null);
  toggleLoop(d, 'ssr');
  assert.equal(d.up.length, MAX_UP);
  assert.ok(d.up.includes('ssr'));
  assert.ok(!d.up.includes('flight'), 'the oldest loop goes down');
  assert.equal(d.lights.ssr, undefined);
});

test('the teletype prints for everyone, loops or not', () => {
  const d = newDesk(5);
  d.up = [];
  to(d, -7000);
  assert.ok(d.tty.length >= 3);
  assert.match(d.tty[0].text, /CAB .* O2 .* FC .* MNA/);
});

test('Flight asks again, then gives up, when EECOM does not answer', () => {
  const d = to(newDesk(9), -8400);
  const a = d.asks.ingress;
  assert.equal(a.result, 'missed');
  assert.ok(d.log.some(l => l.text === 'EECOM, Flight?'));
});

test('no answer to the poll holds the count at T-3:50, and a GO picks it back up', () => {
  const d = newDesk(13);
  to(d, -100);
  assert.ok(d.hold);
  assert.equal(d.hold.why, 'poll');
  assert.equal(d.t, -230);
  assert.ok(act(d, 'poll:go'));
  through(d);
  assert.ok(d.done);
  assert.ok(slip(d) >= 60);
  assert.ok(d.verdict.lines.some(l => /couldn’t get a GO/.test(l)));
});

test('what if: the cabin leak, called at the leak check, holds the count and the hatch is reseated', () => {
  const d = newDesk(1, { whatIf: 'leak' });
  to(d, -5650);
  assert.ok(eventLights(d)['CABIN P']);
  const before = readings(d).cabin;
  tickDesk(d, 60);
  assert.ok(readings(d).cabin < before, 'the cabin bleeds down');
  assert.ok(act(d, 'leak:hold'));
  assert.equal(d.hold.why, 'leak');
  playWell(d);
  assert.ok(d.sys.fixed);
  assert.ok(slip(d) > 1200);
  assert.ok(
    d.verdict.lines.some(l => /called the cabin leak/.test(l)),
    d.verdict.lines.join(' '),
  );
});

test('what if: a leak called good is caught by the Cape at T-4, late and long', () => {
  const d = newDesk(1, { whatIf: 'leak' });
  to(d, -5690);
  act(d, 'leak:good');
  assert.equal(d.asks.leak.result, 'wrong');
  to(d, -360);
  to(d, -350);
  act(d, 'poll:go');
  to(d, -100);
  assert.ok(d.hold?.forced);
  through(d);
  assert.ok(d.sys.fixed);
  assert.ok(d.verdict.lines.some(l => /Cape caught the cabin leak/.test(l)));
});

test('what if: the O2 probe is instrumentation; calling it right keeps the count, holding for it is wrong', () => {
  const good = newDesk(2, { whatIf: 'o2' });
  to(good, -3500);
  assert.ok(eventLights(good)['O2 QTY 2']);
  assert.equal(readings(good).o2p[1] > 880, true, 'the pressure does not move');
  assert.ok(act(good, 'report:o2'));
  playWell(good);
  assert.equal(good.asks.o2, undefined, 'Flight never had to ask');
  assert.ok(good.verdict.lines.some(l => /read the O2 tank 2 quantity as the probe/.test(l)));

  const bad = newDesk(2, { whatIf: 'o2' });
  to(bad, -3290);
  assert.ok(act(bad, 'o2:hold'));
  assert.equal(bad.asks.o2.result, 'wrong');
  assert.equal(bad.hold, null, 'Flight does not hold for a probe');
  through(bad);
  assert.ok(bad.verdict.lines.some(l => /Read the pressure before the quantity/.test(l)));
});

test('a task called early is turned back; in its window it is done; the battery ties show on the buses', () => {
  const d = to(newDesk(4), -2000);
  assert.ok(act(d, 'task:battie'));
  assert.equal(d.tasks.battie, undefined);
  assert.equal(d.calls.at(-1).result, 'early');
  to(d, -1400);
  act(d, 'task:battie');
  assert.equal(d.tasks.battie.result, 'done');
  to(d, -800);
  assert.ok(readings(d).bat[0] > 0);
  assert.equal(readings(d).power, 'INTERNAL');
});

test('the O2 probe report is always on the comms stack, and with nothing wrong it is an unneeded call', () => {
  const d = to(newDesk(12), -9000);
  assert.ok(callOptions(d).some(o => o.id === 'report:o2'));
  assert.ok(act(d, 'report:o2'));
  assert.equal(d.calls.at(-1).result, 'unneeded');
  assert.equal(d.sys.o2Called, false);
});

test('a hold without a reason on the data is refused and counted', () => {
  const d = to(newDesk(6), -7000);
  assert.ok(act(d, 'hold'));
  assert.equal(d.hold, null);
  assert.equal(d.calls.at(-1).result, 'unneeded');
});

test('a what-if game picks its fault from the seed; the real one has none', () => {
  assert.equal(newDesk(10).fault, null);
  assert.equal(newDesk(10, { whatIf: true }).fault, 'leak');
  assert.equal(newDesk(11, { whatIf: true }).fault, 'o2');
});

test('the desk saves in its own slot and loads back mid-count', () => {
  const d = to(newDesk(8), -6000);
  checkDesk(d);
  const text = exportSave(d, DESK);
  const back = parseSave(text, checkDesk, DESK);
  assert.deepEqual(back, JSON.parse(JSON.stringify(d)));
  assert.throws(() => parseSave(text, checkDesk, MANAGEMENT));
  assert.throws(() => parseSave(text, checkDesk, FLIGHT));
  assert.notEqual(DESK.keys.current, MANAGEMENT.keys.current);
  assert.match(deskWhere(d), /Apollo 11, T-1:40:00/);
  tickDesk(back, 120);
  assert.ok(back.t > d.t);
});
