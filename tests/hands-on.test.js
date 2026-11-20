// The hands-on ideas (plans-review/HANDS-ON-GAMEPLAY.md, Aaron 20 November 2026): reading the needles yourself, the
// red-line card and the grease pencil on the dugout's recorder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame, standStart, standMark, standWipe, standMarked, standDecide } from '../js/game.js';
import { redlineRows } from '../js/scenes/redlines.js';
import { playRound, until } from './play.js';

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
