// The launch flow (world/flow.js, data/flow.js): the tests between a round's arrival and its first morning proper.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame, flowRun, flowCut, flowTest, roomFor, checkpoint, checkCheckpoint, dateText } from '../js/game.js';
import {
  newFlow,
  flowRisk,
  runTest,
  cutTest,
  practiced,
  YOU_EXTRA,
  newRehearsal,
  rehearsalCall,
  rehearsalGrade,
  rehearsalMark,
} from '../js/world/flow.js';
import { REHEARSALS } from '../js/data/flow.js';
import {
  flowRehearse,
  flowRehearsalCall,
  flowRehearsalMark,
  flowRerunnable,
  flowRerun,
  flowLedgerItems,
  flowLedgerWork,
} from '../js/game.js';
import { FLOWS } from '../js/data/flow.js';
import { KITS } from '../js/data/kits.js';
import { newRound, DEFAULT_PROGRAMME } from '../js/truth/round.js';
import { nextDay, passFlow, toRoundId, playRound } from './play.js';
import { nextRound, answerFirstOffer } from '../js/game.js';
import { pendingOffer } from '../js/career/record.js';
import { SEASON } from '../js/data/campaign.js';

test('every flow test looks only for faults its vehicle can have, in a building with a room', () => {
  for (const [vehicle, tests] of Object.entries(FLOWS)) {
    const kinds = new Set(Object.values(KITS[vehicle].spots).map(s => s.fault));
    for (const t of tests) {
      assert.ok(['office', 'hangar', 'blockhouse'].includes(t.where), `${vehicle} ${t.id} ${t.where}`);
      for (const kind of Object.keys(t.finds)) assert.ok(kinds.has(kind), `${vehicle} ${t.id} ${kind}`);
    }
  }
});

test("a flow lays out one test a day, and tests already past are the team's", () => {
  const f = newFlow('titan', 1000, -Infinity);
  const days = f.tests.map(t => t.day);
  assert.equal(new Set(days).size, days.length);
  assert.ok(days.every(d => d < 1000));
  const late = newFlow('titan', 1000, 995);
  assert.ok(late.tests.some(t => t.status === 'early') && late.tests.some(t => t.status === 'due'));
  assert.equal(newFlow('ranger', 1000, 0, true), null, 'a probe has no flow');
});

test('the risk the team catches is priced in: a flow the team runs leaves about the old rate of faults', () => {
  const risks = flowRisk(DEFAULT_PROGRAMME, 'titan');
  assert.ok(risks.shutdownRisk > DEFAULT_PROGRAMME.shutdownRisk);
  let before = 0,
    after = 0;
  const n = 4000;
  for (let s = 1; s <= n; s++) {
    const round = newRound(s, risks, 'titan');
    const f = newFlow('titan', 1000, -Infinity);
    for (const t of f.tests) runTest(f, round, t, 'team');
    after += Object.values(round.faults).filter(k => k === 'shutdown').length;
    before += Object.values(newRound(s, DEFAULT_PROGRAMME, 'titan').faults).filter(k => k === 'shutdown').length;
  }
  assert.ok(Math.abs(after - before) < n * 0.02, `${before} before, ${after} after the flow`);
});

test('sitting in catches everything the team would, and more; a cut test catches nothing', () => {
  let team = 0,
    you = 0;
  for (let s = 1; s <= 600; s++) {
    const risks = flowRisk(DEFAULT_PROGRAMME, 'vanguard');
    const a = newRound(s, risks, 'vanguard'),
      b = newRound(s, risks, 'vanguard');
    const fa = newFlow('vanguard', 1000, -Infinity),
      fb = newFlow('vanguard', 1000, -Infinity);
    const ta = fa.tests.map(t => runTest(fa, a, t, 'team').found.length).reduce((x, y) => x + y, 0);
    const tb = fb.tests.map(t => runTest(fb, b, t, 'you').found.length).reduce((x, y) => x + y, 0);
    assert.ok(tb >= ta);
    team += ta;
    you += tb;
  }
  assert.ok(you > team * (1 + YOU_EXTRA / 2), `${team} by the team, ${you} with you`);
  const f = newFlow('vanguard', 1000, -Infinity);
  assert.equal(cutTest(f, f.tests[0]), 0, 'nothing to win back on a flow that has not slipped');
  f.slip = 2;
  assert.equal(cutTest(f, f.tests[0]), 1);
  assert.equal(f.slip, 1);
  f.tests[1].status = 'you';
  assert.deepEqual(practiced(f), {}, 'a rehearsal counts only when run clean');
  f.tests[1].grade = 'clean';
  assert.deepEqual(practiced(f), { count: 1 });
});

test('the game opens on the flow board, and a flow day is a working morning that saves and reloads', () => {
  newGame(42);
  assert.equal(g.beat, 'flow');
  assert.equal(roomFor('office'), 'flow');
  assert.equal(roomFor(FLOWS.wac.find(t => t.id === flowTest().id).where === 'office' ? 'hangar' : 'office'), 'watch');
  const saved = JSON.parse(JSON.stringify(checkpoint()));
  checkCheckpoint(saved);
  newGame(saved.seed, saved);
  assert.equal(g.beat, 'flow');
  assert.equal(flowTest().id, 'range');
  flowRun('you');
  assert.equal(g.flow.tests[0].status, 'you');
  assert.ok(g.dayDone);
  assert.ok(g.notes.some(n => /You sat in on the range readiness check/.test(n.text)));
  nextDay();
  assert.equal(g.beat, 'flow');
  assert.equal(roomFor('blockhouse'), 'flowTest', 'the dry run is sat in on in the blockhouse');
  assert.equal(flowCut(), false, 'nothing to win back');
  flowRun('team');
  nextDay();
  assert.equal(g.beat, 'brief');
  assert.equal(dateText(), 'Tuesday 9 October 1945');
});

// To the first morning of Mercury-Redstone 1's flow, the offer taken at Pioneer 4.
function toMr1Flow(seed) {
  newGame(seed);
  toRoundId('pioneer-4');
  playRound(() => 'nominal');
  const o = g.record.offers.at(-1);
  if (o && !o.made) {
    o.made = true;
    o.answer = null;
  }
  if (pendingOffer(g.record)) answerFirstOffer(true);
  nextRound();
  assert.equal(SEASON[g.roundIndex].id, 'mr-1');
}

test('a crewed round arrives at its flow weeks before launch, and the day before launch follows it', () => {
  toMr1Flow(8);
  assert.equal(g.beat, 'flow');
  assert.equal(flowTest().id, 'checkout');
  assert.ok(g.roundStart - g.day >= 14, 'the capsule checkout is weeks out');
  passFlow();
  assert.equal(g.beat, 'mBrief');
  assert.ok(g.flow.tests.every(t => t.status !== 'due'));
});

test('a fault the flow finds is fixed and slips the launch, and the slip survives a reload', () => {
  toMr1Flow(8);
  g.round.faults = { 'tail-plug': 'plug' };
  const start = g.roundStart;
  for (let n = 0; n < 10 && g.beat === 'flow' && g.round.faults['tail-plug']; n++) {
    flowRun('you');
    if (g.round.faults['tail-plug']) nextDay();
  }
  assert.equal(g.round.faults['tail-plug'], undefined, 'sitting in on the simulated flight found the tail plug');
  assert.equal(g.flow.slip, 1);
  assert.equal(g.roundStart, start + 1);
  assert.equal(g.slipDays, 1);
  assert.ok(g.notes.some(n => /found a fault at the/.test(n.text)));
  nextDay();
  const saved = JSON.parse(JSON.stringify(checkpoint()));
  newGame(saved.seed, saved);
  assert.equal(g.roundStart, start + 1);
  assert.equal(g.flow.slip, 1);
});

test('every count test has a rehearsal, and a rehearsal is clean only with a hold on the glitch and nowhere else', () => {
  for (const tests of Object.values(FLOWS))
    for (const t of tests) if (t.practice === 'count') assert.ok(REHEARSALS[t.id], t.id);
  const f = newFlow('saturn5', 1000, -Infinity),
    round = newRound(3, DEFAULT_PROGRAMME, 'saturn5');
  const test = f.tests.find(t => t.id === 'cddt');
  const play = calls => {
    const reh = newRehearsal(f, round, test);
    let done = false;
    for (let i = 0; !done; i++) {
      assert.equal(!!rehearsalMark(reh).glitch, i === reh.glitchAt);
      done = rehearsalCall(reh, calls(i, reh));
    }
    return rehearsalGrade(reh);
  };
  assert.equal(play((i, r) => i === r.glitchAt).grade, 'clean');
  assert.ok(play(() => false).missed);
  assert.equal(play(() => true).needless, REHEARSALS.cddt.steps.length - 1);
  assert.deepEqual(newRehearsal(f, round, test), newRehearsal(f, round, test), 'the same glitch every time');
});

test('a clean dry run of the count on the site drills the crew, and a clean crewed rehearsal earns a console card', () => {
  newGame(42);
  flowRun('team');
  nextDay();
  flowRehearse();
  for (let n = 0; n < 10 && g.rehearsal; n++) flowRehearsalCall(!!flowRehearsalMark().glitch);
  assert.equal(g.flow.tests[1].grade, 'clean');
  assert.equal(practiced(g.flow).count, 1);
  assert.ok(g.notes.some(n => /a clean rehearsal/.test(n.text)));

  toMr1Flow(8);
  for (let n = 0; n < 10 && g.beat === 'flow'; n++) {
    if (flowTest().id === 'simflight') {
      flowRehearse();
      for (let k = 0; k < 10 && g.rehearsal; k++) flowRehearsalCall(!!flowRehearsalMark().glitch);
      assert.ok(g.record.cards?.plug, 'the pad card is on your console');
    } else flowRun('team');
    nextDay();
  }
  assert.equal(g.beat, 'mBrief');
});

// From MR-1's flow, every test before the review handed to the team: the morning of the Flight Readiness Review.
function toMr1Review(seed) {
  toMr1Flow(seed);
  for (let n = 0; n < 10 && flowTest().id !== 'frr'; n++) {
    flowRun('team');
    nextDay();
  }
  assert.equal(flowTest().id, 'frr');
}

test('every crewed flow ends at the Flight Readiness Review, which cannot be cut', () => {
  for (const v of ['redstone', 'atlas', 'titan', 'saturnib', 'saturn5', 'shuttle', 'dragon', 'sls'])
    assert.equal(FLOWS[v].at(-1).id, 'frr', v);
  assert.ok(!FLOWS.wac.some(t => t.id === 'frr'));
  toMr1Review(8);
  g.flow.slip = 1;
  assert.equal(flowCut(), false);
});

test('the review can send a test back for one more run, a day on the schedule, once', () => {
  toMr1Review(8);
  const start = g.roundStart,
    slip = g.slipDays;
  const id = flowRerunnable()[0].id;
  g.round.faults = { 'tail-plug': 'plug' };
  flowRerun(id);
  assert.ok(g.roundStart >= start + 1);
  assert.ok(g.slipDays >= slip + 1);
  assert.ok(!flowRerunnable().some(t => t.id === id), 'once each');
  flowRun('you');
  assert.ok(g.notes.some(n => /sent the .* back for one more run/.test(n.text)));
  assert.ok(g.notes.some(n => /The go was given/.test(n.text)));
  nextDay();
  assert.equal(g.beat, 'mBrief');
});

test('a signed-off ledger item reopened at the review is worked on this vehicle too', () => {
  toMr1Review(8);
  g.programme.ledger = [
    {
      id: 'x1',
      family: 'mercury',
      fault: 'control',
      real: true,
      status: 'accepted',
      seen: ['MR-0'],
      grade: 1,
      text: 'gyro',
    },
  ];
  g.round.faults = { autopilot: 'control' };
  assert.equal(flowLedgerItems().length, 1);
  const start = g.roundStart;
  const r = flowLedgerWork('x1');
  assert.ok(r.found);
  assert.equal(g.round.faults.autopilot, undefined);
  assert.equal(g.roundStart, start + 2);
  assert.equal(flowLedgerItems().length, 0);
});

test("the history's moments: Apollo 13's tank is seen and left to the review, Artemis I's wet dress takes four tries, STS-1 fires on the pad", () => {
  const base = { ...DEFAULT_PROGRAMME, tankRisk: 0.5 };
  assert.equal(
    flowRisk(base, 'saturn5', false, 'apollo-13').tankRisk,
    0.5,
    'nothing priced in for a fault never fixed',
  );
  assert.ok(flowRisk(base, 'saturn5', false, 'apollo-12').tankRisk > 0.5);
  const round = newRound(5, base, 'saturn5');
  round.faults = { 'o2-tanks': 'tank' };
  const f = newFlow('saturn5', 1000, -Infinity, false, 'apollo-13');
  const r = runTest(
    f,
    round,
    f.tests.find(t => t.id === 'cddt'),
    'you',
  );
  assert.equal(round.faults['o2-tanks'], 'tank', 'the CDDT cannot fix it');
  assert.equal(f.moment, 'seen');
  assert.match(r.history, /would not drain/);
  const reh = newRehearsal(
    f,
    round,
    f.tests.find(t => t.id === 'cddt'),
  );
  assert.match(REHEARSALS.cddt.glitches[reh.glitch], /oxygen tanks will not drain/);

  const a = newFlow('sls', 1000, -Infinity, false, 'artemis-1');
  const sls = newRound(5, DEFAULT_PROGRAMME, 'sls');
  sls.faults = {};
  assert.equal(
    runTest(
      a,
      sls,
      a.tests.find(t => t.id === 'wdr'),
      'team',
    ).days,
    4,
  );

  const s = newFlow('shuttle', 1000, -Infinity, false, 'sts-1');
  assert.equal(s.tests[0].id, 'frf');
  assert.equal(s.tests[0].day, 1000 - 51);
  assert.ok(!newFlow('shuttle', 1000, -Infinity, false, 'sts-26').tests.some(t => t.id === 'frf'));
});
