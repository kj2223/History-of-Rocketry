// The Moon on Mission Control's big screen (js/stage/moon-wall.js): which picture the wall shows at each part of a
// flight to the Moon, the descent's profile, and the landing sites where they really are. The drawing needs a browser;
// here the rules it draws from are checked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHTS } from '../js/data/flights.js';
import {
  moonWallMode,
  descentShare,
  descentAltitude,
  descentRange,
  legOf,
  behindMoon,
  LANDING_SITES,
} from '../js/stage/moon-wall.js';

const con = (id, phase, x, at = 50) => ({ flight: { id, phase, at, where: x == null ? null : { x, label: '' } } });

test('the world map stays up in Earth orbit and on flights that do not go to the Moon', () => {
  assert.equal(moonWallMode(null), null);
  assert.equal(moonWallMode(con('apollo-11', 'Launch and Earth orbit', 0.02)), null);
  assert.equal(moonWallMode(con('apollo-11', 'Translunar injection', 0.03)), null);
  assert.equal(moonWallMode(con('gem-8', 'Docked', 0.5)), null);
});

test('out to the Moon, round it, down to it and home again, the big screen follows her', () => {
  assert.equal(moonWallMode(con('apollo-11', 'Translunar coast', 0.3)), 'translunar');
  assert.equal(moonWallMode(con('apollo-11', 'Lunar orbit insertion', 1)), 'orbit');
  assert.equal(moonWallMode(con('apollo-11', 'Powered descent', 1)), 'descent');
  assert.equal(moonWallMode(con('apollo-11', 'On the surface', 1)), 'surface');
  assert.equal(moonWallMode(con('apollo-11', 'Trans-Earth injection', 0.97)), 'translunar');
  assert.equal(moonWallMode(con('apollo-11', 'Coast home', 0.4)), 'translunar');
  assert.equal(legOf({ phase: 'Translunar coast' }), 'out');
  assert.equal(legOf({ phase: 'Coast home' }), 'home');
});

test('the descent runs from 15 km up and 480 km out to the ground, and the low-fuel call comes near the bottom', () => {
  assert.equal(descentAltitude(0), 15000);
  assert.equal(descentRange(0), 480);
  assert.ok(descentAltitude(1) === 0 && descentRange(1) === 0);
  // Apollo's high gate was at about 2 km up.
  assert.ok(descentAltitude(0.68) > 1500 && descentAltitude(0.68) < 3000);
  const steps = FLIGHTS['apollo-11'].steps;
  const start = steps.find(s => s.phase === 'Powered descent').at;
  const fuel = steps.find(s => s.decide === 'lowfuel').at;
  assert.equal(descentShare({ id: 'apollo-11', at: start }), 0);
  assert.ok(descentShare({ id: 'apollo-11', at: fuel }) > 0.8);
  assert.ok(descentShare({ id: 'apollo-11', at: start + 5 }) <= 0.97);
});

test('every landing flight has its site on the near side, where it really was', () => {
  for (const [id, f] of Object.entries(FLIGHTS))
    if (f.steps.some(s => s.phase === 'Powered descent')) assert.ok(LANDING_SITES[id], `${id} has a landing site`);
  const [lat, lon] = LANDING_SITES['apollo-11'];
  assert.ok(Math.abs(lat - 0.67) < 0.1 && Math.abs(lon - 23.47) < 0.1);
  for (const [lat2, lon2] of Object.values(LANDING_SITES)) assert.ok(Math.abs(lat2) <= 90 && Math.abs(lon2) < 90);
});

test('in lunar orbit she is out of sight of Earth for half of every orbit', () => {
  let behind = 0;
  for (let i = 0; i < 200; i++) if (behindMoon({ at: 100 + i * 0.01 })) behind++;
  assert.ok(behind > 80 && behind < 120);
});
