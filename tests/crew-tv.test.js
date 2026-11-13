// The crew on Mission Control's television (js/site/crew-tv.js): the count's replays, the spacecraft's own television
// only in the years and vehicles that had it live, and the suits by era. The drawing needs a browser; the rules are here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { countReplay, hasCabinTv, cabinOn, suitOf, WALKOUT_FROM, WHITE_ROOM_FROM } from '../js/site/crew-tv.js';

test('the count shows the walkout, then the white room, then hands over to the live pad camera', () => {
  assert.equal(countReplay(900), 'walkout');
  assert.equal(countReplay(WALKOUT_FROM - 1), 'whiteRoom');
  assert.equal(countReplay(WHITE_ROOM_FROM - 1), null);
  assert.equal(countReplay(10), null);
});

test('no live television from Mercury or Gemini; from Apollo 7 on, there is', () => {
  for (const v of ['redstone', 'atlas', 'titan']) assert.equal(hasCabinTv(v, 1965), false);
  assert.equal(hasCabinTv('saturnib', 1967), false);
  assert.equal(hasCabinTv('saturnib', 1968), true);
  assert.equal(hasCabinTv('saturn5', 1969), true);
  assert.equal(hasCabinTv('shuttle', 1981), true);
});

test('the board gets the screen back whenever a lamp is lit or a call waits', () => {
  const quiet = { status: { LM: ['docked'] } };
  assert.equal(cabinOn(quiet, 10), true);
  assert.equal(cabinOn(quiet, 100), false);
  assert.equal(cabinOn({ status: { SPS: ['low', true] } }, 10), false);
  assert.equal(cabinOn({ status: {}, decision: { id: 'loi' } }, 10), false);
});

test('the suits follow the years: Mercury silver, the Shuttle blue then orange', () => {
  assert.equal(suitOf('atlas', 1962).body, '#c7cbd0');
  assert.equal(suitOf('shuttle', 1984).body, '#3e5c8c');
  assert.equal(suitOf('shuttle', 1990).body, '#e3752d');
});
