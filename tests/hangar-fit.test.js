// Issue #255 (Aaron's playtest mark 20, Ranger 7 at the Cape, 26 Jul 1964): the Atlas-Agena lying in the assembly
// hangar stuck its nose out through the wall. Every round laid in the hangar must lie inside it, nose to tail.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hangarTail, TRUCK_LOADS, PLACES } from '../js/site/draw.js';

test('every round lies inside the hangar, nose and tail', () => {
  const h = PLACES.hangar;
  for (const [v, load] of Object.entries(TRUCK_LOADS)) {
    if (v === 'wac' || v === 'aerobee') continue; // the WAC rides its own cradle
    const tail = hangarTail(v),
      nose = tail - load.length;
    assert.ok(nose >= h.x + 10, `${v}: nose at ${nose}, wall at ${h.x}`);
    assert.ok(tail <= h.x + h.w - 10, `${v}: tail at ${tail}, wall at ${h.x + h.w}`);
  }
  // The short rounds stay where they always lay.
  assert.equal(hangarTail('v2'), h.x + 230);
  assert.equal(hangarTail('viking'), h.x + 230);
});
