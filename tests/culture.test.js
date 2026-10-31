// CULTURE TESTS: the programme's culture, the team's confidence and each team's own lean (rules/culture.js). Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, resetState } from '../js/core/state.js';
import { ensureStarter } from '../js/rules/game.js';
import { itemsInArea } from '../js/rules/research.js';
import { noteHabit, noteLaunch, noteFix, recordConfidence, cultureLean, teamConfidence, riskAppetite, teamLean, budgetPressure, cultureWords, HABITS_TO_SPEAK } from '../js/rules/culture.js';

beforeEach(() => {
  resetState();
  ensureStarter();
});

test('careful habits build a safety culture, rushed ones a chaotic culture, and one lapse does not change who you are', () => {
  for (let index = 0; index < 30; index++) noteHabit('test');
  const careful = cultureLean();
  assert.ok(careful < -.5, `lean ${careful}`);
  noteHabit('rush');
  assert.ok(cultureLean() < -.4, 'one rushed launch only nudges it');
  for (let index = 0; index < 60; index++) noteHabit('override');
  assert.ok(cultureLean() > .5, 'a long run of overrides turns it chaotic');
});

test('a launch you fly shows whether its new work was tested, whether you tested since the last one, and open incidents', () => {
  const airframe = S.air[0], untested = itemsInArea('p')[0].id;
  airframe.pk = [untested];
  noteLaunch(airframe);
  assert.deepEqual(S.cult.ev.map(habit => habit.k), ['rush', 'notest']);
  noteHabit('test');
  S.pk[untested] = { a: {}, c: 1, m: {} };
  S.inc.push({ id: 1, st: 'diag' });
  noteLaunch(airframe, true);
  assert.deepEqual(S.cult.ev.slice(3).map(habit => habit.k), ['wait', 'openfly', 'override'], 'tested work, an open incident and a NO-GO override');
  assert.equal(S.cult.tests, 0, 'tests count again from the launch');
});

test('a fix choice says something only when the safest and the cheapest differ', () => {
  const safe = { name: 'safe', riskMultiplier: .2, cost: 4000 }, cheap = { name: 'cheap', riskMultiplier: .6, cost: 1000 };
  noteFix([safe, cheap], safe);
  noteFix([safe, cheap], cheap);
  noteFix([safe], safe);
  assert.deepEqual(S.cult.ev.map(habit => habit.k), ['safefix', 'quickfix']);
});

test("confidence grows only with the team's own good flights and is knocked back by a failure", () => {
  recordConfidence(true, 'ok', false);
  assert.equal(teamConfidence(), 0, 'your own flights do not count');
  for (let index = 0; index < 10; index++) recordConfidence(true, 'ok', true);
  const sure = teamConfidence();
  assert.ok(sure > .5, `confidence ${sure}`);
  recordConfidence(false, 'fail', true);
  assert.ok(teamConfidence() < sure - .2);
});

test('a safety culture at full confidence is about as bold as a new chaotic team', () => {
  S.cult.lean = -1;
  S.cult.conf = 0;
  const cautious = riskAppetite();
  S.cult.conf = 1;
  const safetyConfident = riskAppetite();
  S.cult.lean = 1;
  S.cult.conf = 0;
  const chaoticNew = riskAppetite();
  S.cult.conf = 1;
  assert.ok(cautious < safetyConfident);
  assert.ok(Math.abs(safetyConfident - chaoticNew) < .01);
  assert.equal(riskAppetite(), 1);
});

test('a team short of money leans towards chaos even in a safety culture', () => {
  S.cult.lean = -.6;
  S.works = { cap: 50000, spent: 10000 };
  assert.equal(budgetPressure('reed'), 0);
  assert.equal(teamLean('reed'), -.6);
  S.works.spent = 49000;
  assert.ok(teamLean('reed') > -.3, `reed ${teamLean('reed')}`);
  assert.equal(teamLean('chen'), -.6, 'the other teams follow the organisation');
  S.works.dry = 'the next airframe';
  assert.equal(budgetPressure('reed'), 1);
});

test('the team says nothing about the culture until it has seen enough habits', () => {
  for (let index = 1; index < HABITS_TO_SPEAK; index++) noteHabit('test');
  assert.equal(cultureWords(), null);
  noteHabit('test');
  assert.ok(cultureWords().name);
});
