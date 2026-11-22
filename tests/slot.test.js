// The range slot (plans-review/LAUNCH-FUN-RETHINK.md, Aaron 22 November 2026: "price every check"). Each early round
// has a few crew hours before its slot; every look, test and job comes out of them, running past them loses the slot,
// a round flown late counts against you, and a lost round leaves the next one short.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  g,
  newGame,
  lookAt,
  meterSpot,
  finishInspection,
  finishBoard,
  standStart,
  standDecide,
  standLeakCheck,
  slotHours,
  countAnswer,
  pressValve,
  pressByHand,
  tick,
  kit,
  checkpoint,
  nextRound,
} from '../js/game.js';
import { newSlot, spendHours, hoursLeft, daysOver, hoursText, lateMark, SLOT_HOURS } from '../js/world/slot.js';
import { standing } from '../js/career/record.js';
import { playRound, passFlow, nextDay, until } from './play.js';

test('a slot counts its hours, and running over by any part of a day costs the day', () => {
  const s = newSlot('wac');
  assert.equal(s.budget, SLOT_HOURS.wac);
  spendHours(s, 2.5, 'a');
  assert.equal(hoursLeft(s), SLOT_HOURS.wac - 2.5);
  assert.equal(daysOver(s), 0);
  spendHours(s, SLOT_HOURS.wac - 2.5, 'b');
  assert.equal(daysOver(s), 0, 'exactly used up is still on time');
  spendHours(s, 0.25, 'c');
  assert.equal(daysOver(s), 1);
  spendHours(s, 8, 'd');
  assert.equal(daysOver(s), 2);
  assert.equal(newSlot('wac', 2).budget, SLOT_HOURS.wac - 2, 'short after a lost round');
  assert.equal(newSlot('wac', 99).budget, 3, 'never below the floor');
  assert.equal(newSlot('saturn5'), null, 'crewed rounds have no slot');
  assert.equal(hoursText(0.75), '45 min');
  assert.equal(hoursText(2), '2 h');
  assert.equal(hoursText(1.5), '1 h 30 min');
});

test('every look, meter reading and flag comes out of the slot', () => {
  newGame(7);
  passFlow();
  const start = slotHours();
  assert.equal(start.left, SLOT_HOURS.wac);
  lookAt('fitting');
  assert.equal(slotHours().spent, 0.25);
  meterSpot('fitting');
  assert.equal(slotHours().spent, 0.75);
  finishInspection({ fins: true }); // fins never have a fault: a false alarm, 3 h
  assert.equal(slotHours().spent, 3.75);
});

// Look at, meter and flag everything on the first WAC round: more than the slot holds.
const checkEverything = () => {
  newGame(7);
  passFlow();
  const spots = Object.keys(kit().spots);
  for (const id of spots) {
    lookAt(id);
    meterSpot(id);
  }
  finishInspection(Object.fromEntries(spots.map(id => [id, true])));
  finishBoard();
  nextDay();
  until(() => g.beat === 'static');
  standStart();
  until(() => g.stand.phase === 'read');
};

test('checking everything runs past the slot: the round waits, and it goes down as late', () => {
  checkEverything();
  const slip = g.slipDays;
  standDecide({ rework: false, leak: false });
  assert.ok(daysOver(g.slot) >= 1, `spent ${g.slot.spent} of ${g.slot.budget}`);
  assert.equal(g.slipDays, slip + daysOver(g.slot));
  assert.equal(g.decided.late, daysOver(g.slot));
  assert.ok(g.notes.some(n => /lost its slot/.test(n.text)));
  nextDay();
  until(() => g.beat === 'countReady');
  assert.ok(g.day > g.roundStart + 2, 'the launch day moved');
});

test('a light touch keeps the slot, and the round is on time', () => {
  newGame(7);
  playRound();
  assert.ok(!g.record.rounds.at(-1).late);
});

test('a rework or a full-duration firing makes the round late too: caution now costs something', () => {
  newGame(7);
  playRound(undefined, undefined, 'staticPrep');
  until(() => g.beat === 'static');
  standStart();
  until(() => g.stand.phase === 'read');
  standDecide({ rework: true, leak: false });
  assert.equal(g.decided.late, 1);
});

test('a leak check on the stand spends the slot', () => {
  newGame(7);
  playRound(undefined, undefined, 'staticPrep');
  until(() => g.beat === 'static');
  const before = slotHours().spent;
  standLeakCheck();
  assert.ok(slotHours().spent >= before + 2);
});

test('two late rounds of the last three cost a point of standing', () => {
  const record = { trust: 0, overspent: 0, rounds: [{ flight: 'ok' }, { flight: 'ok', late: 1 }, { flight: 'ok' }] };
  const one = standing(record);
  assert.equal(lateMark(record.rounds), 0);
  record.rounds.push({ flight: 'ok', late: 1 });
  assert.equal(lateMark(record.rounds), 1);
  assert.equal(standing(record), one - 1);
});

test('a lost round leaves the next round short of crew hours', () => {
  // Find a campaign whose first round is lost, played the quiet way.
  let seed = 1;
  for (; seed < 200; seed++) {
    newGame(seed);
    playRound();
    if (/^Lost/.test(g.record.rounds.at(-1).flight)) break;
  }
  assert.ok(seed < 200, 'some first round is lost');
  assert.ok(g.programme.rebuild > 0);
  assert.equal(g.beat, 'roundEnd');
  nextRound();
  passFlow();
  assert.equal(g.slot.budget, SLOT_HOURS[g.vehicle] - 2);
  assert.ok(g.notes.some(n => /replacement for the round we lost/.test(n.text)));
});

test('the slot is kept in the morning checkpoint', () => {
  newGame(7);
  passFlow();
  lookAt('fitting');
  // The checkpoint is taken each morning; the next one carries the hours spent so far.
  finishInspection({});
  finishBoard();
  nextDay();
  const saved = checkpoint();
  assert.equal(saved.slot.spent, 0.25);
  newGame(7, saved);
  assert.equal(g.slot.spent, 0.25);
});

test('at PRESS the regulator keeps the tank until you take the valve', () => {
  newGame(7);
  playRound(undefined, undefined, 'poll');
  countAnswer(true);
  until(() => g.count?.poll);
  g.room = 'count';
  countAnswer(true);
  assert.equal(pressByHand(), false);
  for (let i = 0; i < 30 * 25 && g.count; i++) tick(1 / 30);
  assert.ok(!g.count?.held, 'left to the regulator, nothing drops out of limits');
  pressValve(false);
  assert.equal(pressByHand(), false, 'letting go of nothing takes nothing');
});
