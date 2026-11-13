// The site growing (js/stage/site-art.js): each replacement goes up over the years before it opens, in stages, and
// the static site is redrawn as each stage is reached.
import test from 'node:test';
import assert from 'node:assert/strict';
import { worksUnderway, siteKey } from '../js/stage/site-art.js';
import { dayOf } from '../js/core/calendar.js';

const at = (y, m = 1, d = 1) => ({ day: dayOf(y, m, d), site: 'cape', crewed: false });

test('nothing is being built outside the works years, and the new piece stands once it opens', () => {
  assert.deepEqual(worksUnderway(at(1950)), []);
  assert.deepEqual(worksUnderway(at(1960, 1, 2)), []);
  assert.deepEqual(worksUnderway(at(1985)), []);
});

test('the radar station, the tracking camera and the dome each go up in stages before their year', () => {
  const tv3 = worksUnderway(at(1957, 12, 6));
  assert.equal(tv3.length, 1);
  assert.equal(tv3[0].id, 'radar');
  assert.ok(tv3[0].stage >= 1 && tv3[0].stage <= 2);
  assert.equal(worksUnderway(at(1959, 12, 1))[0].stage, 3);
  assert.equal(worksUnderway(at(1962, 2, 20))[0].id, 'camera');
  assert.equal(worksUnderway(at(1975, 7, 15))[0].id, 'radome');
});

test('the static site is drawn again when the works move on a stage', () => {
  assert.notEqual(siteKey(at(1957, 1, 1)), siteKey(at(1959, 12, 1)));
});
