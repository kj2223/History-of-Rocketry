// NASA's first lunar shots: Juno II's Pioneers aimed past the Moon, and Ranger 7 aimed to hit it with its cameras running.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, staticFire, standRework, fly, wreckage, hasDepletionFault, hasAgenaFault, flagSpots } from '../js/truth/round.js';
import { initProgramme, adopt } from '../js/world/programme.js';
import { SEASON, BETWEEN, onPath } from '../js/data/campaign.js';

const round = (v, s, p = initProgramme()) => newRound(s, p, v);
const seedWhere = (v, ok) => { for (let s = 1; s < 800; s++) if (ok(round(v, s))) return s; throw new Error('no seed'); };
const tail = trace => trace.slice(-12).reduce((a, p) => a + p.pc, 0) / 12;

test('a Jupiter that will run short shows it only late in a full-duration firing', () => {
  const r = round('juno', seedWhere('juno', hasDepletionFault));
  assert.ok(tail(staticFire(r, 'short').trace) > 19.5);
  const long = staticFire(r, 'long').trace;
  assert.ok(long.find(p => p.t === 15).pc > 19.5 && tail(long) < 18);
  standRework(r);
  assert.equal(hasDepletionFault(r), false);
});

test('an Agena that will not restart shows a rough start, and the fix carries', () => {
  const r = round('ranger', seedWhere('ranger', hasAgenaFault));
  assert.ok(tail(staticFire(r, 'short').trace) < 18.5);
  const p = initProgramme(); adopt(p, 'agena');
  for (let s = 1; s < 100; s++) assert.equal(hasAgenaFault(round('ranger', s, p)), false);
});

test('a good Pioneer passes the Moon and a good Ranger hits it with pictures; the failures read as the real ones did', () => {
  const seen = { juno: new Set(), ranger: new Set() };
  for (const v of ['juno', 'ranger']) for (let s = 1; s < 300; s++) {
    const r = round(v, s), f = fly(r);
    seen[v].add(f.failure || 'nominal');
    if (!f.failure) assert.match(f.deep.text, v === 'juno' ? /^Passed the Moon at about [\d,]+ km/ : /^Hit the Moon on target, sending [\d,]+ pictures/);
    if (f.failure === 'depletion') assert.match(f.deep.text, /fell back to Earth/);
    if (f.failure === 'camera') assert.match(wreckage(r, true).join(' '), /no video/);
  }
  assert.deepEqual([...seen.juno].sort(), ['depletion', 'leak', 'nominal', 'separation']);
  assert.deepEqual([...seen.ranger].sort(), ['agena', 'camera', 'leak', 'nominal']);
});

test('flagging the arcing camera supply saves the pictures', () => {
  const s = seedWhere('ranger', r => Object.values(r.faults).includes('camera'));
  const r = round('ranger', s);
  flagSpots(r, ['camera-hv']);
  assert.ok(!Object.values(r.faults).includes('camera'));
});

test('the campaign ends with NASA\'s lunar shots from the Cape, after the Soviet Lunas and six failed Rangers', () => {
  const jpl = SEASON.filter(r => onPath(r, 'jpl')), ids = jpl.map(r => r.id);
  assert.deepEqual(ids.slice(-3), ['pioneer-3', 'pioneer-4', 'ranger-7']);
  assert.ok(jpl.slice(-3).every(r => r.site === 'cape'));
  assert.match(BETWEEN['pioneer-4'].join(' '), /Luna 1/);
  assert.match(BETWEEN['ranger-7'].join(' '), /Ranger 6/);
});
