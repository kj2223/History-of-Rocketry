// Project Vanguard at Cape Canaveral: the first stage's injector, the orbit a good round reaches, the range reading the
// rounds from telemetry, the pressure after Sputnik, and the faults no inspection can find.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newRound,
  staticFire,
  hasInjectorFault,
  standRework,
  fly,
  wreckage,
  flagSpots,
  HIDDEN_FAILURE,
} from '../js/truth/round.js';
import { initProgramme, adopt } from '../js/world/programme.js';
import { SEASON, BETWEEN } from '../js/data/campaign.js';
import { standing } from '../js/career/record.js';
import { g, newGame, atSea, standDecide, finishPlan } from '../js/game.js';
import { playRound, advance, until } from './play.js';

const vanguard = (s, p = initProgramme()) => newRound(s, p, 'vanguard');
const seedWhere = ok => {
  for (let s = 1; s < 800; s++) if (ok(vanguard(s))) return s;
  throw new Error('no seed');
};
const avg = pts => pts.reduce((a, p) => a + p.pc, 0) / pts.length;

test('a burning injector shows as a rough, low start on a short firing, and the rework clears it', () => {
  const r = vanguard(seedWhere(hasInjectorFault));
  assert.ok(avg(staticFire(r, 'short').trace.slice(-20)) < 18.5);
  standRework(r);
  assert.equal(hasInjectorFault(r), false);
  assert.ok(avg(staticFire(r, 'short').trace.slice(-20)) > 19.5);
  const p = initProgramme();
  adopt(p, 'injector');
  for (let s = 1; s < 100; s++) assert.equal(hasInjectorFault(vanguard(s, p)), false);
});

test('a good Vanguard goes into orbit, and a bad one falls back on the pad or into the Atlantic', () => {
  const seen = new Set();
  let orbits = 0;
  for (let s = 1; s < 300; s++) {
    const r = vanguard(s),
      f = fly(r);
    if (f.failure) {
      seen.add(f.failure);
      assert.ok(!f.orbit);
      assert.ok(wreckage(r, true).length);
      continue;
    }
    orbits++;
    assert.ok(f.orbit.perigee > 400 && f.orbit.perigee < 800, `perigee ${f.orbit.perigee}`);
    assert.ok(f.orbit.apogee > 5 * f.orbit.perigee);
    assert.match(wreckage(r, true).join(' '), /Minitrack/);
  }
  assert.deepEqual([...seen].sort(), ['injector', 'leak', 'separation']);
  assert.ok(orbits > 20, `${orbits} orbits`);
});

test('however carefully a round is looked over, some are lost to faults nobody could find', () => {
  for (const [vehicle, rate] of Object.entries(HIDDEN_FAILURE)) {
    let lost = 0;
    const n = 400;
    for (let s = 1; s <= n; s++) {
      const r = newRound(s * 13, initProgramme(), vehicle);
      r.faults = {};
      r.physical.latentMechanisms = [];
      const f = fly(r);
      if (f.failure || f.deep?.hiddenCamera) lost++; // a Ranger's hidden camera fault shows only at the Moon
    }
    assert.ok(Math.abs(lost / n - rate) < 0.06, `${vehicle}: ${lost / n} against ${rate}`);
  }
});

test('the Vanguard rounds fly from the Cape, TV-0 a Viking, and the news follows Sputnik and Explorer', () => {
  const tv0 = SEASON.find(r => r.id === 'vanguard-tv0'),
    tv3 = SEASON.find(r => r.id === 'vanguard-tv3');
  assert.equal(tv0.vehicle, 'viking');
  assert.equal(tv0.site, 'cape');
  assert.ok(SEASON.filter(r => r.vehicle === 'vanguard').every(r => r.site === 'cape' && r.pressure));
  assert.match(BETWEEN['vanguard-tv3'].join(' '), /Sputnik 1/);
  assert.match(BETWEEN['vanguard-tv4'].join(' '), /Explorer 1/);
  assert.ok(tv3.start > SEASON.find(r => r.id === 'viking-9').start);
});

function toRound(seed, id) {
  newGame(seed);
  while (SEASON[g.roundIndex].id !== id) {
    playRound(() => 'nominal');
    if (g.record.offers.length && !g.record.offers[0].made) {
      g.record.offers[0].made = true;
      g.record.offers[0].answer = null;
    }
    advance(true);
  }
}

test('at the Cape the range reads the round from telemetry, and the write-up gives the orbit', () => {
  for (let seed = 1; seed < 40; seed++) {
    toRound(seed, 'vanguard-tv4');
    assert.ok(atSea());
    playRound(() => 'nominal');
    const e = g.record.rounds.at(-1);
    if (!/^In orbit/.test(e.flight)) continue;
    assert.match(e.flight, /perigee about \d+ km, apogee about \d+ km/);
    assert.ok(g.notes.some(n => /From the telemetry and radar records/.test(n.text)));
    return;
  }
  assert.fail('no orbit');
});

test('after Sputnik a slipped round costs you standing', () => {
  toRound(4, 'vanguard-tv3');
  const before = standing(g.record);
  finishPlan({ inspector: 'you', burn: 'long', leak: false });
  playRound(() => 'unknown', { inspector: 'you', burn: 'long' });
  const e = g.record.rounds.at(-1);
  if (/^Lost at 55/.test(e.flight)) return; // broke loose on the stand: no slip to count
  assert.equal(e.pressured, true);
  assert.ok(standing(g.record) < before + 1);
});
