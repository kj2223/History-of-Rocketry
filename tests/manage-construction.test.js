// Construction you can watch (js/manage/construction.js) and rockets rolling out to their pads (js/manage/life.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { stageOf, wallsAt, paintWorks, drawWorks, HEIGHT } from '../js/manage/construction.js';
import { rolloutRoute, alongRoute, rolloutsOn } from '../js/manage/life.js';
import { CAPE_1958_BASE, CAPE_1958_ROADS, PREFABS } from '../js/manage/base.js';
import { PAD_KINDS } from '../js/manage/manifest.js';

test('a building goes through its stages in order, and is done at 1', () => {
  const names = [0, 0.05, 0.13, 0.3, 0.6, 0.9, 0.99].map(p => stageOf(p).name);
  assert.deepEqual(names, ['site', 'site', 'slab', 'frame', 'frame', 'cladding', 'cladding']);
  assert.equal(stageOf(1).name, 'done');
  assert.equal(stageOf(1.5).name, 'done');
});

test('the walls rise floor by floor and never come down', () => {
  for (const kind of Object.keys(HEIGHT)) {
    let last = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      const h = wallsAt(kind, p);
      assert.ok(h >= last, `${kind} at ${p}`);
      assert.ok(h <= HEIGHT[kind]);
      if (stageOf(p).name === 'frame' && h < HEIGHT[kind]) assert.equal(h % 3, 0);
      last = h;
    }
  }
});

test('every kind paints at every stage, and nothing once it is done', () => {
  const calls = [];
  const P = new Proxy(
    { at: (tx, ty, z = 0) => ({ x: (tx - ty) * 8, y: (tx + ty) * 4 - z }) },
    { get: (o, k) => o[k] ?? ((...a) => calls.push(k)) },
  );
  for (const kind of Object.keys(PREFABS))
    for (const p of [0.05, 0.2, 0.5, 0.9]) {
      calls.length = 0;
      paintWorks(P, { kind, tx: 5, ty: 5 }, p, 3);
      assert.ok(calls.length > 3, `${kind} ${p}`);
    }
  calls.length = 0;
  paintWorks(P, { kind: 'hangar', tx: 5, ty: 5 }, 1, 3);
  assert.equal(calls.length, 0);
  drawWorks(null, []); // no works, no drawing
});

test('a rocket rolls out from the hangar to its own pad the day before it stands there', () => {
  for (const pad of CAPE_1958_BASE.filter(b => b.kind === 'pad')) {
    const route = rolloutRoute(CAPE_1958_BASE, CAPE_1958_ROADS, pad);
    assert.ok(route.length >= 2);
    const end = alongRoute(route, 1);
    assert.equal(end.tx, pad.tx + 2.5);
    assert.equal(end.ty, pad.ty + 2.5);
    let prev = alongRoute(route, 0);
    for (let k = 0.01; k <= 1; k += 0.01) {
      const p = alongRoute(route, k);
      assert.ok(Math.hypot(p.tx - prev.tx, p.ty - prev.ty) < 1.5, 'no jumps');
      prev = p;
    }
  }
  const pad = CAPE_1958_BASE.find(b => b.id === 'lc-17a'),
    f = { pad: 'lc-17a', launch: 100, vehicle: 'thor-able' },
    day = f.launch - PAD_KINDS[pad.padKind].before - 1;
  assert.equal(rolloutsOn([f], CAPE_1958_BASE, day).length, 1);
  assert.equal(rolloutsOn([f], CAPE_1958_BASE, day + 1).length, 0);
});
