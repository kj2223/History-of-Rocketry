// The launch flow (world/flow.js, data/flow.js): the tests between a round's arrival and its first morning proper.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame, flowRun, flowCut, flowTest, roomFor, checkpoint, checkCheckpoint, dateText } from '../js/game.js';
import { newFlow, flowRisk, runTest, cutTest, practiced, YOU_EXTRA } from '../js/world/flow.js';
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
