// Mercury Control: the Space Task Group's offer after Pioneer 4, the Retrofire officer's console on Mercury-Redstone 1,
// the training sims, and what the flight model does with the booster's faults.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame, checkpoint, checkCheckpoint, nextIndex } from '../js/game.js';
import { SEASON, onPath } from '../js/data/campaign.js';
import { newRound } from '../js/truth/round.js';
import { ascent, outcome, arc, PLAN, recoveryHours, ABORT_LIMIT } from '../js/truth/capsule.js';
import { initProgramme, adopt } from '../js/world/programme.js';
import { standing } from '../js/career/record.js';
import { toRoundId, playMission, runSim, playRound, advance } from './play.js';

const redstone = (s, p = initProgramme()) => newRound(s, p, 'redstone');

test('a good Mercury-Redstone flies the MR-3 numbers: about 187 km up and 486 km down the range at about 11 g', () => {
  const r = arc(PLAN.v, PLAN.gamma, PLAN.cutoffH, 40);
  assert.ok(Math.abs(r.apogee - 187) < 10, `apogee ${r.apogee}`);
  assert.ok(Math.abs(r.range - 486) < 25, `range ${r.range}`);
  assert.ok(Math.abs(r.entryG - 11) < 0.5);
});

test('each booster fault shows on the plot the way it really flew', () => {
  const seen = new Set();
  for (let s = 1; s < 400; s++) {
    const r = redstone(s), a = ascent(r), end = outcome(r);
    seen.add(a.failure || 'nominal');
    if (a.failure === 'plug') assert.equal(end.outcome, 'pad');
    if (a.failure === 'control') assert.ok(a.steps.some(x => Math.abs(x.off) > ABORT_LIMIT), 'a control failure crosses the abort line before it breaks her up');
    if (a.failure === 'lox') assert.ok(end.landing < 420 && a.burn < PLAN.burn);
    if (a.failure === 'thrust') assert.ok(end.landing > 520);
    if (!a.failure) assert.ok(Math.abs(end.landing - 486) < 60 && a.steps.every(x => Math.abs(x.off) < ABORT_LIMIT));
  }
  assert.deepEqual([...seen].sort(), ['control', 'lox', 'nominal', 'plug', 'thrust']);
});

test('an abort called in time saves the capsule from a booster going off her line; one not called may lose it', () => {
  for (let s = 1; s < 800; s++) {
    const r = redstone(s), a = ascent(r);
    if (a.failure !== 'control') continue;
    const over = a.steps.find(x => Math.abs(x.off) > ABORT_LIMIT).t;
    assert.equal(outcome(structuredClone(r), over + 1).capsule, 'safe');
    const late = outcome(r);
    assert.equal(late.outcome, 'breakup');
    assert.ok(['damaged', 'lost'].includes(late.capsule));
    return;
  }
  assert.fail('no control failure found');
});

test('the review\'s fix for the tail plug makes the four-inch flight rare', () => {
  const p = initProgramme(); adopt(p, 'plug');
  const count = prog => { let n = 0; for (let s = 1; s < 400; s++) n += ascent(redstone(s, prog)).failure === 'plug' ? 1 : 0; return n; };
  assert.ok(count(p) < count(initProgramme()) * 0.25);
});

test('the helicopters find her fast at the right point, slowly at the wrong one, and not at all in a rough sea', () => {
  const calm = { seaState: 2, late: null };
  assert.ok(recoveryHours(486, 490, calm, true) < 0.4);
  assert.ok(recoveryHours(560, 486, calm, true) > recoveryHours(560, 555, calm, true) + 0.5);
  assert.ok(recoveryHours(486, 486, { seaState: 5, late: null }, true) > 1);
  assert.ok(recoveryHours(486, 486, calm, false) > recoveryHours(486, 486, calm, true));
});

test('after Pioneer 4 the paths split: Mercury Control if you take the offer, Ranger 7 if you stay with JPL', () => {
  const p4 = SEASON.findIndex(r => r.id === 'pioneer-4');
  assert.equal(SEASON[p4].turningPoint, 'nasa');
  assert.deepEqual(SEASON.filter(r => onPath(r, 'nasa')).map(r => r.id).slice(-2), ['pioneer-4', 'mr-1']);
  assert.deepEqual(SEASON.filter(r => onPath(r, 'jpl')).map(r => r.id).slice(-2), ['pioneer-4', 'ranger-7']);
  assert.ok(SEASON.find(r => r.id === 'mr-1').start > SEASON[p4].start);
});

test('take the Space Task Group\'s offer and the next round is Mercury-Redstone 1, worked from the Retrofire officer\'s console', () => {
  newGame(8);
  toRoundId('mr-1');
  assert.equal(g.record.seat, 'retro');
  assert.equal(g.record.path, 'nasa');
  assert.equal(g.beat, 'mBrief');
  assert.ok(g.crewed && !g.people.hollis.hidden && g.people.ellis.hidden);
  assert.doesNotThrow(() => checkCheckpoint(checkpoint()));
  playMission({ sims: 2 });
  assert.equal(g.beat, 'seasonEnd');
  const e = g.record.rounds.at(-1);
  assert.equal(e.id, 'mr-1');
  assert.ok(e.boss === 'hollis' && typeof e.flight === 'string');
  assert.equal(nextIndex(), null);
});

test('turn it down and you stay at JPL for Ranger 7', () => {
  newGame(8);
  while (SEASON[g.roundIndex].id !== 'pioneer-4') { playRound(() => 'nominal'); const o = g.record.offers.at(-1); if (o && !o.made) { o.made = true; o.answer = null; } advance(true); }
  playRound(() => 'nominal');
  const o = g.record.offers.at(-1);
  o.made = true; o.answer = null;
  advance(false);
  assert.equal(SEASON[g.roundIndex].id, 'ranger-7');
  assert.notEqual(g.record.path, 'nasa');
});

test('every kind of MR-1 can be worked to its review: the four-inch flight, aborts, short and long flights', () => {
  const kinds = new Set();
  for (let seed = 1; seed < 60 && kinds.size < 4; seed++) {
    newGame(seed);
    toRoundId('mr-1');
    playMission({ pad: seed % 2 ? 'wait' : 'now' });
    kinds.add(g.round.end.outcome);
    assert.ok(g.record.rounds.at(-1).flight.length > 10);
  }
  assert.ok(kinds.has('pad') && kinds.size >= 3, [...kinds].join(','));
});

test('the simulator is a training tool: no risk to the real round, and a good sim record counts toward your standing', () => {
  newGame(8);
  toRoundId('mr-1');
  const before = JSON.stringify(g.round);
  const base = standing(g.record);
  const results = [runSim(), runSim(), runSim(), runSim()];
  assert.equal(JSON.stringify(g.round), before, 'the sims never touch the real round');
  assert.ok(results.every(d => d && d.of >= 1 && d.scenario));
  assert.equal(g.record.sims.length, 4);
  const good = g.record.sims.slice(-3).every(s => s.right === s.of);
  assert.equal(standing(g.record), base + (good ? 1 : 0));
  assert.ok(g.mission.trained);
});
