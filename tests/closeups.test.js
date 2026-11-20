import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshot, cueOf, paintShot, SHOT_W, SHOT_H } from '../js/site/closeups.js';

const base = { flying: false, staged: 0, surface: false, home: false };

test('no shot on the first frame or when nothing changes', () => {
  assert.equal(cueOf(null, { ...base, flying: true }), null);
  assert.equal(cueOf(base, base), null);
});

test('each key moment calls for its shot once, on the change', () => {
  assert.equal(cueOf(base, { ...base, flying: true }), 'fire');
  assert.equal(cueOf({ ...base, flying: true }, { ...base, flying: true }), null);
  assert.equal(cueOf({ ...base, staged: 1 }, { ...base, staged: 2 }), 'stage');
  assert.equal(cueOf(base, { ...base, surface: true }), 'contact');
  assert.equal(cueOf(base, { ...base, home: true }), 'home');
});

test('snapshot counts the staging events passed during the climb', () => {
  const g = { console: { phase: 'ascent', t: 170, round: { ascent: { staging: [{ t: 160 }, { t: 540 }] } } } };
  assert.equal(snapshot(g).staged, 1);
  assert.equal(snapshot({ console: { ...g.console, phase: 'count' } }).staged, 0);
  assert.equal(snapshot({ rocket: { where: 'flying' } }).flying, true);
  assert.equal(snapshot({ console: { flight: { phase: 'On the surface' } } }).surface, true);
  assert.deepEqual(snapshot({}), base);
});

test('every shot paints inside its frame, in every era', () => {
  for (const kind of ['fire', 'stage', 'contact', 'home'])
    for (const year of [1950, 1969, 1985, 2026])
      for (const k of [0, 0.5, 0.99]) {
        let n = 0;
        paintShot(
          (x, y, w, h, c) => {
            n++;
            assert.ok(Number.isInteger(c) && c >= 0 && c <= 0xffffff, `${kind} colour`);
            assert.ok(
              x >= 0 && y >= -16 && x + w <= SHOT_W + 0.01 && y + h <= SHOT_H + 0.01,
              `${kind} ${x},${y} ${w}x${h}`,
            );
          },
          kind,
          k,
          { year, name: 'Ruth Calder', clock: 161 },
        );
        assert.ok(n > 5);
      }
});

test('the lamps come on gradually, not in one frame', () => {
  const lampAt = k => {
    let c = null;
    paintShot((x, y, w, h, col) => x === 40 && y === 38 && (c = col), 'contact', k, {});
    return c;
  };
  const a = lampAt(0.2),
    b = lampAt(0.27),
    z = lampAt(0.5);
  assert.notEqual(a, b);
  assert.notEqual(b, z);
});
