// Aaron's playtest, 12 November: once the new blockhouse was built, standing at its left end did not open the
// blockhouse and the pointer only changed over the part the old one covered. Every hit test now reads the building
// as it stands that day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACES, footprint, atPlace, newBlockhouseStands } from '../js/data/white-sands.js';
import { dayOf } from '../js/core/calendar.js';

const at = (day, extra = {}) => ({ day, site: 'white-sands', crewed: false, truck: { x: 1800 }, ...extra });
const before = at(dayOf(1948, 6, 1)),
  after = at(dayOf(1952, 6, 1));

test('the old blockhouse keeps its own footprint before the new one is built', () => {
  assert.equal(newBlockhouseStands(before), false);
  assert.deepEqual(footprint('blockhouse', before), PLACES.blockhouse);
  assert.equal(atPlace('blockhouse', before, 1412), false);
});

test('the new blockhouse counts over its whole width, from its left end to its right', () => {
  const f = footprint('blockhouse', after);
  assert.equal(f.x, PLACES.blockhouse.x - 150);
  assert.equal(f.x + f.w, PLACES.blockhouse.x + PLACES.blockhouse.w - 10);
  assert.ok(f.h > PLACES.blockhouse.h);
  for (const x of [1355, 1412, 1500, 1595, 1675]) assert.ok(atPlace('blockhouse', after, x), `x ${x}`);
  assert.equal(atPlace('blockhouse', after, 1720), false);
  assert.ok(atPlace('blockhouse', at(dayOf(1950, 1, 1), { site: 'cape' }), 1412), 'the Cape has the new one');
});

test('in the crewed years the stand and dugout are one training building', () => {
  const crewed = at(dayOf(1961, 5, 1), { site: 'cape', crewed: true });
  const f = footprint('dugout', crewed);
  assert.equal(f.x, PLACES.stand.x - 10);
  assert.equal(f.x + f.w, PLACES.dugout.x + PLACES.dugout.w + 10);
  assert.ok(atPlace('dugout', crewed, 1225), 'between the old stand and dugout');
  assert.equal(atPlace('dugout', before, 1225), false);
});

test('the truck footprint follows the truck', () => {
  assert.equal(footprint('truck', at(0, { truck: { x: 2400 } })).x, 2400);
});
