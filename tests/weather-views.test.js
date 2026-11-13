// Issue #249 (Aaron's playtest mark 17, Vanguard TV-0 rollout at the Cape, 8 Dec 1956): it was raining on the site but
// the blockhouse periscopes showed a clear sky. Every view of the outdoors takes the day's weather from weatherNow(g).
import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherNow, weatherFor, weatherLook, weatherBelow, weatherWash } from '../js/stage/fx/weather-day.js';
import { dateOf } from '../js/core/calendar.js';

const markDay = { day: 4359, clock: 6277484, site: 'cape' };

test("the mark's day is rain, and weatherNow gives the site's own weather", () => {
  const w = weatherNow(markDay);
  assert.equal(w.kind, 'rain');
  const hour = (markDay.clock % 1440) / 60;
  assert.deepEqual(w, weatherFor({ day: 4359, month: dateOf(4359).month, hour, cape: true }));
  const L = weatherLook(w);
  assert.ok(L.grey > 0.5 && L.rain > 0.5);
});

test('a clear day leaves the picture alone; above the cloud the weather is gone', () => {
  const clear = weatherFor({ day: 1, month: 5, hour: 10, cape: false, force: 'clear' });
  assert.equal(weatherLook(clear).rain, 0);
  assert.equal(weatherLook(clear).fog, 0);
  const high = weatherLook(weatherBelow(weatherNow(markDay), 0));
  assert.equal(high.grey, 0);
  assert.equal(high.rain, 0);
});

// A stand-in canvas that records what is drawn: the rain draws streaks, a clear day draws nothing over the picture.
function recorder() {
  const ops = [];
  const ctx = new Proxy(
    {},
    {
      get: (o, k) => (k in o ? o[k] : (...a) => ops.push([k, ...a])),
      set: (o, k, v) => {
        if (k === 'fillStyle' || k === 'strokeStyle') ops.push([k, v]);
        return true;
      },
    },
  );
  return { ctx, ops };
}

test('the wash greys the sky and rains on a rainy day, with the same brightness every frame (no flashing)', () => {
  const draw = time => {
    const r = recorder();
    weatherWash(r.ctx, weatherNow(markDay), 0, 0, 200, 150, time);
    return r.ops;
  };
  const a = draw(0),
    b = draw(0.5);
  assert.ok(
    a.some(o => o[0] === 'lineTo'),
    'rain streaks',
  );
  assert.ok(
    a.some(o => o[0] === 'fillRect'),
    'grey sky',
  );
  const styles = ops => ops.filter(o => o[0].endsWith('Style')).map(o => o[1]);
  assert.deepEqual(styles(a), styles(b), 'the same colours and alphas as the rain moves');
  const clear = recorder();
  weatherWash(clear.ctx, weatherFor({ day: 1, month: 5, hour: 10, cape: false, force: 'clear' }), 0, 0, 200, 150, 0);
  assert.ok(!clear.ops.some(o => o[0] === 'fillRect' || o[0] === 'lineTo'));
});
