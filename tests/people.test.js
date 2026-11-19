// People you can read (stage/people.js, site/portraits.js): stable looks, unsynchronised idle actions, portraits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lookOf, idleAt, IDLE } from '../js/stage/people.js';
import { paintPortrait, PORTRAIT } from '../js/site/portraits.js';

test('a person looks the same every time, and people differ', () => {
  assert.deepEqual(lookOf('Kurt Albrecht', 1969), lookOf('Kurt Albrecht', 1969));
  const looks = ['Kurt Albrecht', 'Carl Dorsey', 'Frank Hollis', 'Neil Fairbanks', 'Daniel Vega'].map(n =>
    JSON.stringify(lookOf(n, 1969)),
  );
  assert.ok(new Set(looks).size >= 4);
});

test('each person keeps their own slow timetable, so the room is never in step', () => {
  const kinds = new Set();
  for (let t = 0; t < 600; t += 5) kinds.add(idleAt('Carl Dorsey', 1, t).kind);
  assert.ok(kinds.size >= 4, 'several different things over ten minutes');
  for (const k of kinds) assert.ok(IDLE.includes(k));
  // A spell lasts seconds, not a frame: no twitching.
  let changes = 0;
  for (let t = 0; t < 60; t += 0.1)
    if (idleAt('Carl Dorsey', 1, t).kind !== idleAt('Carl Dorsey', 1, t + 0.1).kind) changes++;
  assert.ok(changes <= 10);
  // Two people are not doing the same thing at the same moments all the time.
  let same = 0;
  for (let t = 0; t < 600; t += 3) if (idleAt('A', 1, t).kind === idleAt('B', 2, t).kind) same++;
  assert.ok(same < 150);
});

test('a portrait fills its square, and wears a headset from 1958', () => {
  const paint = year => {
    const px = new Map();
    paintPortrait((x, y, c) => px.set(`${x},${y}`, c), 'Kurt Albrecht', year);
    return px;
  };
  const p69 = paint(1969),
    p47 = paint(1947);
  assert.equal(p69.size, PORTRAIT * PORTRAIT);
  assert.equal(p69.get('3,5'), 0x26282c, 'the headset band by the ear');
  assert.notEqual(p47.get('3,5'), 0x26282c);
});
