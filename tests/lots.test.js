// Faults come in production lots: a cause that brought a round down and was never fixed is likelier on the next rounds
// (playtest, 11 November 2026: "the third WAC flies the same as the first regardless of fix").
import test from 'node:test';
import assert from 'node:assert/strict';
import { initProgramme, adopt, recordFlight, LOT_ROUNDS } from '../js/world/programme.js';
import { newRound, hasIgniterFault } from '../js/truth/round.js';

const share = (p, has, vehicle = 'wac', n = 400) => {
  let k = 0;
  for (let s = 1; s <= n; s++) if (has(newRound(s * 7919, p, vehicle))) k++;
  return k / n;
};
const weldBad = r => Object.values(r.faults).includes('weld');

test('an unfixed ignition failure makes the next rounds likelier to have the igniter fault', () => {
  const p = initProgramme();
  const before = share(p, hasIgniterFault);
  recordFlight(p, { vehicle: 'wac', load: 1, failure: 'ignition' });
  const after = share(p, hasIgniterFault);
  assert.ok(after > before + 0.2, `${before} -> ${after}`);
});

test('the right fix clears the lot; a wrong one does not', () => {
  const right = initProgramme();
  adopt(right, 'ignition');
  recordFlight(right, { vehicle: 'wac', load: 1, failure: 'ignition' });
  assert.equal(right.batch.ignition, undefined);
  assert.equal(share(right, hasIgniterFault), 0);

  const wrong = initProgramme();
  adopt(wrong, 'leak');
  recordFlight(wrong, { vehicle: 'wac', load: 1, failure: 'weld' });
  assert.equal(wrong.batch.weld, LOT_ROUNDS);
  assert.ok(share(wrong, weldBad) > share(initProgramme(), weldBad) + 0.15);
});

test('the lot runs out after its rounds, and a hidden failure says nothing about it', () => {
  const p = initProgramme();
  recordFlight(p, { vehicle: 'wac', load: 1, failure: 'leak' });
  for (let i = 0; i < LOT_ROUNDS; i++) recordFlight(p, { vehicle: 'wac', load: 1, apogee: 70 });
  assert.deepEqual(p.batch, {});
  recordFlight(p, { vehicle: 'wac', load: 1, failure: 'weld', hidden: true });
  assert.deepEqual(p.batch, {});
});

test('the lot moves no draws: a round with no lot in play is unchanged', () => {
  const a = newRound(123, initProgramme(), 'wac');
  const p = initProgramme();
  p.batch = { turbopump: 2 }; // a V-2 lot: nothing on a WAC round reads it
  const b = newRound(123, p, 'wac');
  assert.deepEqual(a.faults, b.faults);
  assert.deepEqual(a.physical.latentMechanisms, b.physical.latentMechanisms);
});

test('a lot belongs to one vehicle: a V-2 round does not inherit a WAC lot', () => {
  const p = initProgramme();
  recordFlight(p, { vehicle: 'wac', load: 1, failure: 'weld' });
  const v2 = initProgramme();
  assert.equal(share(p, weldBad, 'v2'), share(v2, weldBad, 'v2'));
  recordFlight(p, { vehicle: 'v2', load: 1, apogee: 160 });
  assert.deepEqual(p.batch, {});
});
