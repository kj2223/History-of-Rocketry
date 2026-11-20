// Programmes: start, slow and stop them; the budget pays; a short line slips dates, capped; Moon probes keep to windows.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROGRAMMES,
  programmesOf,
  planFor,
  programmeSchedule,
  advanceProgrammes,
  commitOpen,
  setProgramme,
  canStop,
  funding,
  allFlights,
  SQUEEZE_CAP,
  TUTORIAL_CAP,
  LUNAR_MONTH,
} from '../js/manage/programmes.js';
import { schedule, inWindow } from '../js/manage/schedule.js';
import { CAPE_1958 } from '../js/manage/manifest.js';
import { newManagement, checkManagement, START_DAY } from '../js/manage/state.js';
import { appropriation, DEFAULT_SPLIT } from '../js/manage/budget.js';
import { flyDue } from '../js/manage/view.js';
import { dayOf } from '../js/core/calendar.js';
import { initPressure } from '../js/manage/pressure.js';

const fresh = (seed = 3) => {
  const g = newManagement(seed);
  g.split = { ...DEFAULT_SPLIT };
  g.budget = appropriation(g.day, START_DAY, []);
  return g;
};
const launchOf = (sched, id) => sched.flights.find(f => f.id === id)?.launch;

// The day as the base view runs it (view.js newDay), without the screen.
function play(game, n) {
  let sched = programmeSchedule(game, START_DAY);
  commitOpen(game, sched);
  const log = [];
  for (let i = 0; i < n; i++) {
    game.day += 1;
    log.push(...flyDue(game, sched, game.day));
    if (game.day > game.budget.end) game.budget = appropriation(game.day, START_DAY, game.flown);
    log.push(...advanceProgrammes(game, game.budget, START_DAY));
    sched = programmeSchedule(game, START_DAY);
    commitOpen(game, sched);
  }
  return { sched, log };
}

test('every flight on the 1958 manifest belongs to an inherited programme', () => {
  for (const f of CAPE_1958.flights) assert.ok(PROGRAMMES[f.programme] && !PROGRAMMES[f.programme].startable, f.id);
});

test('a new game keeps the real dates: programmes change nothing until you touch them', () => {
  const g = fresh(),
    old = schedule(CAPE_1958, { from: START_DAY }),
    now = programmeSchedule(g, START_DAY);
  for (const f of old.flights) assert.equal(launchOf(now, f.id), f.launch, f.id);
  assert.equal(launchOf(now, 'pioneer-1'), dayOf(1958, 10, 11));
  assert.equal(launchOf(now, 'explorer-6'), dayOf(1959, 8, 7));
  assert.ok(funding(g, g.budget, START_DAY) >= 1, 'the default split pays for the inherited programmes');
});

test('slowing a programme makes its dates fall back; stopping takes its flights off the manifest', () => {
  const g = fresh();
  const before = launchOf(programmeSchedule(g, START_DAY), 'vanguard-2');
  assert.match(setProgramme(g, 'vanguard', 'slowed'), /slowed/);
  play(g, 40);
  const after = launchOf(programmeSchedule(g, START_DAY), 'vanguard-2');
  assert.ok(after - before >= 19 && after - before <= 21, `${after - before}`);
  setProgramme(g, 'vanguard', 'stopped');
  const s = programmeSchedule(g, START_DAY);
  assert.equal(s.flights.filter(f => f.programme === 'vanguard').length, 0);
  // Started again, they come back later still.
  play(g, 10);
  setProgramme(g, 'vanguard', 'running');
  assert.ok(launchOf(programmeSchedule(g, START_DAY), 'vanguard-2') >= after + 10);
});

test('starting a programme puts its flights on the manifest and costs money', () => {
  const g = fresh(),
    cover = funding(g, g.budget, START_DAY);
  assert.equal(setProgramme(g, 'tiros', 'slowed'), null, 'a programme starts at full pace');
  assert.match(setProgramme(g, 'tiros', 'running'), /TIROS starts/);
  const tiros = programmeSchedule(g, START_DAY).flights.filter(f => f.programme === 'tiros');
  assert.equal(tiros.length, 3);
  assert.ok(tiros.every(f => f.pad === 'lc-17a' && f.launch >= START_DAY + PROGRAMMES.tiros.lead));
  assert.ok(funding(g, g.budget, START_DAY) < cover);
  assert.ok(allFlights(g).some(f => f.id === 'tiros-1'));
});

test('a short Programmes line slips dates, but no more than the cap in a fiscal year', () => {
  const g = fresh();
  g.split = { programmes: 0, building: 50, staff: 50 };
  const { log } = play(g, 250);
  const ps = programmesOf(g);
  for (const id of ['pioneer', 'vanguard', 'mercury']) {
    assert.ok(ps[id].lag <= SQUEEZE_CAP + 1e-9, `${id} ${ps[id].lag}`);
    assert.ok(ps[id].lag >= SQUEEZE_CAP - 1, `${id} ${ps[id].lag}`);
  }
  // One warning per programme per year, not one a day.
  assert.equal(log.filter(l => l.startsWith('The Programmes line covers')).length, 1);
  // The new fiscal year opens a new cap.
  assert.ok(g.budget.fy === 1960 || g.day < dayOf(1959, 7, 1));
});

test('Explorer 6 never slips more than its cap, and Explorer cannot be stopped before it flies', () => {
  const g = fresh();
  setProgramme(g, 'explorer', 'slowed');
  assert.equal(canStop(g, 'explorer'), false);
  assert.equal(setProgramme(g, 'explorer', 'stopped'), null);
  play(g, 200);
  const e6 = launchOf(programmeSchedule(g, START_DAY), 'explorer-6');
  assert.ok(e6 <= dayOf(1959, 8, 7) + TUTORIAL_CAP + 21, `${e6 - dayOf(1959, 8, 7)}`); // within the cap, plus pad time
  assert.ok(programmesOf(g).explorer.lag > TUTORIAL_CAP);
});

test('a Moon probe that slips moves to its next monthly window', () => {
  assert.equal(inWindow(10, { epoch: 10, period: LUNAR_MONTH, days: 3 }), 10);
  assert.equal(inWindow(12, { epoch: 10, period: LUNAR_MONTH, days: 3 }), 12);
  assert.equal(inWindow(13, { epoch: 10, period: LUNAR_MONTH, days: 3 }), 40);
  const g = fresh();
  setProgramme(g, 'pioneer', 'slowed');
  play(g, 30); // 15 days of lag
  const s = programmeSchedule(g, START_DAY),
    p3 = s.flights.find(f => f.id === 'pioneer-3'),
    orig = dayOf(1958, 12, 6),
    into = (p3.launch - orig) % LUNAR_MONTH;
  assert.ok(p3.launch > orig + 14, `${p3.launch - orig}`);
  assert.ok(into < 3 || into > LUNAR_MONTH - 1, `${p3.launch - orig} days after its first window`);
});

test('a flight whose round has opened keeps its date, and nothing ever flies in the past or twice', () => {
  const g = fresh(5);
  const s0 = programmeSchedule(g, START_DAY),
    p1 = launchOf(s0, 'pioneer-1');
  play(g, p1 - 1 - g.day); // the round is open
  setProgramme(g, 'pioneer', 'slowed');
  const { sched } = play(g, 1);
  assert.equal(launchOf(sched, 'pioneer-1'), p1);
  setProgramme(g, 'vanguard', 'slowed');
  g.split = { programmes: 20, building: 40, staff: 40 };
  for (let i = 0; i < 400; i++) {
    const { sched: s } = play(g, 1);
    assert.ok(
      s.flights.every(f => f.launch >= g.day),
      'no flight left behind',
    );
  }
  const ids = g.flown.map(f => f.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('explorer-6'));
});

test('stopping a programme with a date announced costs standing', () => {
  const g = fresh();
  g.pressure = initPressure();
  g.pressure.announced['vanguard-2'] = dayOf(1959, 2, 17);
  assert.match(setProgramme(g, 'vanguard', 'stopped'), /will not keep/);
  assert.equal(g.pressure.standing, -1);
  assert.equal(g.pressure.announced['vanguard-2'], undefined);
});

test('programmes save and load, and a bad record is refused', () => {
  const g = fresh();
  setProgramme(g, 'tiros', 'running');
  play(g, 20);
  const back = JSON.parse(JSON.stringify(g));
  checkManagement(back);
  assert.deepEqual(planFor(back), planFor(g));
  assert.throws(() => checkManagement({ ...back, programmes: { nowhere: { status: 'running', lag: 0 } } }));
  assert.throws(() => checkManagement({ ...back, programmes: { pioneer: { status: 'fast', lag: 0 } } }));
  assert.throws(() => checkManagement({ ...back, committed: { 'pioneer-1': 'soon' } }));
  checkManagement({ ...back, programmes: undefined, committed: undefined }); // older saves
});
