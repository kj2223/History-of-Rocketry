// NASA's first lunar shots: Juno II's Pioneers aimed past the Moon, and Ranger 7 aimed to hit it with its cameras running.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newRound,
  staticFire,
  standRework,
  fly,
  wreckage,
  hasDepletionFault,
  hasAgenaFault,
  flagSpots,
} from '../js/truth/round.js';
import { initProgramme, adopt } from '../js/world/programme.js';
import { firstFix, midcourse, finalFix, encounter, fallBack, MOON_RADIUS, LATE_REACH } from '../js/truth/lunar.js';
import { SEASON, BETWEEN, onPath } from '../js/data/campaign.js';

const round = (v, s, p = initProgramme()) => newRound(s, p, v);
const seedWhere = (v, ok) => {
  for (let s = 1; s < 800; s++) if (ok(round(v, s))) return s;
  throw new Error('no seed');
};
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
  const p = initProgramme();
  adopt(p, 'agena');
  for (let s = 1; s < 100; s++) assert.equal(hasAgenaFault(round('ranger', s, p)), false);
});

// Fly a lunar shot all the way: the launch, then the cruise (the midcourse on the second fix), then the encounter.
function flyAll(r, when = 'wait', lead = 20) {
  const f = fly(r);
  if (f.deep?.phase !== 'cruise') return f;
  if (f.deep.fallsBack) {
    fallBack(r);
    return f;
  }
  if (r.vehicle === 'ranger') {
    firstFix(r);
    midcourse(r, when);
  }
  finalFix(r);
  return encounter(r, lead);
}

test('a good Pioneer passes the Moon and a good Ranger hits it with pictures; the failures read as the real ones did', () => {
  const seen = { juno: new Set(), ranger: new Set() };
  for (const v of ['juno', 'ranger'])
    for (let s = 1; s < 300; s++) {
      const r = round(v, s),
        f = flyAll(r);
      seen[v].add(f.failure || 'nominal');
      if (!f.failure)
        assert.match(
          f.deep.text,
          v === 'juno'
            ? /^Passed the Moon at about [\d,]+ km/
            : /^Hit the Moon (about [\d,]+ km from|within 100 km of) the aim point, sending [\d,]+ pictures in the last 20 minutes/,
        );
      if (f.failure === 'depletion') assert.match(f.deep.text, /fell back to Earth/);
      if (f.failure === 'camera') assert.match(wreckage(r, true).join(' '), /no video/);
      if (f.failure === 'miss') assert.match(f.deep.text, /^Lost: she missed the Moon/);
    }
  assert.deepEqual([...seen.juno].sort(), ['depletion', 'leak', 'nominal', 'separation']);
  assert.deepEqual([...seen.ranger].sort(), ['agena', 'camera', 'leak', 'miss', 'nominal']);
});

test('the launch ends when she is away: the cruise is followed on the tracking, and only an Agena that will not restart ends at the Cape', () => {
  for (let s = 1; s < 200; s++) {
    const f = fly(round('ranger', s));
    if (f.failure === 'agena') assert.match(f.deep.text, /parking orbit|low orbit/);
    else if (f.deep) {
      assert.equal(f.deep.phase, 'cruise');
      assert.equal(f.path[f.path.length - 1].t, 600);
      assert.equal(f.deep.done, false);
    }
  }
});

test('the midcourse: on a small first fix, waiting for the good fix hits more often; on a big one, burning early does', () => {
  const tally = { small: { now: 0, wait: 0, n: 0 }, big: { now: 0, wait: 0, n: 0 } };
  for (let s = 1; s < 3000; s++) {
    const probe = when => {
      const r = round('ranger', s),
        f = fly(r);
      if (f.deep?.phase !== 'cruise') return null;
      const fix = Math.abs(firstFix(r));
      return { fix, hit: Math.abs(midcourse(r, when)) < MOON_RADIUS };
    };
    const a = probe('now'),
      b = probe('wait');
    if (!a) continue;
    const t = a.fix < LATE_REACH ? tally.small : a.fix > LATE_REACH + 2500 ? tally.big : null;
    if (!t) continue;
    t.n++;
    t.now += a.hit;
    t.wait += b.hit;
  }
  assert.ok(tally.small.n > 50 && tally.big.n > 10, JSON.stringify(tally));
  assert.ok(tally.small.wait > tally.small.now, JSON.stringify(tally.small));
  assert.ok(tally.big.now > tally.big.wait, JSON.stringify(tally.big));
});

test('the cameras: switched on earlier, more pictures, but a weak supply is likelier to arc over', () => {
  const s = 1;
  const arcs = lead => {
    let n = 0;
    for (let k = 0; k < 400; k++) {
      const r = round('ranger', s + k * 1000);
      r.faults = { 'camera-hv': 'camera' };
      r.physical.latentMechanisms = [];
      const f = fly(r);
      if (f.deep?.phase !== 'cruise' || f.deep.hiddenCamera) continue;
      f.deep.residual = 0;
      if (encounter(r, lead).failure === 'camera') n++;
    }
    return n;
  };
  assert.ok(arcs(30) > arcs(10));
  const good = round('ranger', 1);
  good.faults = {};
  good.physical.latentMechanisms = [];
  const f = fly(good);
  if (f.deep?.phase === 'cruise' && !f.deep.hiddenCamera) {
    f.deep.residual = 0;
    assert.ok(encounter(good, 30).deep.pictures > 6000);
  }
});

test('flagging the arcing camera supply saves the pictures', () => {
  const s = seedWhere('ranger', r => Object.values(r.faults).includes('camera'));
  const r = round('ranger', s);
  flagSpots(r, ['camera-hv']);
  assert.ok(!Object.values(r.faults).includes('camera'));
});

test("JPL's lunar shots fly from the Cape, after the Soviet Lunas and six failed Rangers", () => {
  const jpl = SEASON.filter(r => onPath(r, 'jpl') && !r.probe),
    ids = jpl.map(r => r.id);
  assert.deepEqual(ids.slice(-3), ['pioneer-3', 'pioneer-4', 'ranger-7']);
  assert.ok(jpl.slice(-3).every(r => r.site === 'cape'));
  assert.match(BETWEEN['pioneer-4'].join(' '), /Luna 1/);
  assert.match(BETWEEN['ranger-7'].join(' '), /Ranger 6/);
});
