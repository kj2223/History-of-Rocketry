// The v0.8 flight views: JPL's tracking room (js/stage/deep.js) and the recovery (js/stage/recovery.js). The drawing
// needs a browser; here the data it draws from is checked: the planets and the routes, and which view a room gets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, ROUTES, planetAt, craftAt, routeReach } from '../js/data/deep-space.js';
import { SEASON } from '../js/data/campaign.js';
import { dayOf } from '../js/core/calendar.js';

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const angleGap = (a, b) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

test('the planets are where they really were (Earth opposite the Sun at the March equinox)', () => {
  // On 20 March the Sun is at 0 degrees seen from Earth, so Earth is at 180 degrees from the Sun.
  const [a] = planetAt('earth', dayOf(1969, 3, 20));
  assert.ok(angleGap(a, Math.PI) < 0.05, `Earth at ${(a * 180) / Math.PI}`);
  // Saturn's 1981 encounter: Saturn in Virgo, about 186 degrees.
  const [s] = planetAt('saturn', dayOf(1981, 8, 26));
  assert.ok(angleGap(s, (186 * Math.PI) / 180) < 0.1);
});

test('every robotic mission but the Moon landers has a route, starting from Earth on its launch', () => {
  for (const r of SEASON.filter(s => s.probe)) {
    if (r.id === 'surveyor-1') {
      assert.equal(ROUTES[r.id], undefined);
      continue;
    }
    assert.ok(ROUTES[r.id], `${r.id} has no route`);
    for (const craft of ROUTES[r.id]) {
      assert.equal(craft.legs[0].planet, 'earth');
      for (let i = 1; i < craft.legs.length; i++) assert.ok(craft.legs[i].day > craft.legs[i - 1].day);
    }
  }
});

test('a craft leaves Earth and arrives at each planet on the day', () => {
  for (const crafts of Object.values(ROUTES))
    for (const craft of crafts)
      for (const leg of craft.legs) {
        const [a, r] = craftAt(craft, leg.day),
          [pa, pr] = planetAt(leg.planet, leg.day);
        assert.ok(near(r, pr, 0.02 * pr + 0.01) && angleGap(a, pa) < 0.02, `${craft.name} at ${leg.planet}`);
      }
});

test('the board reaches out to the furthest planet on the route', () => {
  assert.equal(routeReach('voyager'), PLANETS.neptune.au);
  assert.equal(routeReach('mariner-2'), 1.6);
});

test('the range plot and its camera are told what went wrong, and a pad blast is left to the pad', async () => {
  const { flightTrouble } = await import('../js/game.js');
  const g = failure => ({ vehicle: 'wac', flight: { result: { failure, failAt: 14 } } });
  assert.equal(flightTrouble({ vehicle: 'wac', flight: { result: {} } }), null);
  assert.equal(flightTrouble(g('weld')).kind, 'break');
  assert.equal(flightTrouble(g('weld')).at, 14);
  assert.equal(flightTrouble(g('fin')).kind, 'tumble');
  assert.equal(flightTrouble(g('leak')).kind, 'cut');
  assert.equal(
    flightTrouble({ vehicle: 'bumper', flight: { result: { failure: 'ignition', failAt: 30 } } }).upper,
    true,
  );
  assert.equal(flightTrouble({ vehicle: 'vanguard', flight: { result: { failure: 'injector', failAt: 0 } } }), null);
});
