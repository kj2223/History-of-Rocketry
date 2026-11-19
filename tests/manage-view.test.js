// The base view's rockets: a flight stands on its pad in the weeks before it flies and lifts off on its day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { standsOn } from '../js/manage/view.js';
import { schedule } from '../js/manage/schedule.js';
import { CAPE_1958, PAD_KINDS } from '../js/manage/manifest.js';
import { CAPE_1958_BASE, PREFABS, buildingAt } from '../js/manage/base.js';
import { START_DAY } from '../js/manage/state.js';

const sched = schedule(CAPE_1958, { from: START_DAY }),
  p1 = sched.flights.find(f => f.id === 'pioneer-1');

test('every pad on the manifest is a pad on the map', () => {
  for (const pad of CAPE_1958.pads) {
    const b = CAPE_1958_BASE.find(x => x.id === pad.id);
    assert.ok(b, pad.id);
    assert.equal(b.padKind, pad.kind);
  }
});

test('buildings do not overlap', () => {
  for (const a of CAPE_1958_BASE)
    for (let i = 0; i < PREFABS[a.kind].w; i++)
      for (let j = 0; j < PREFABS[a.kind].d; j++) assert.equal(buildingAt(CAPE_1958_BASE, a.tx + i, a.ty + j), a);
});

test('Pioneer 1 stands on 17A before its day and lifts off at noon on it', () => {
  const before = PAD_KINDS.thor.before;
  assert.equal(standsOn(sched, CAPE_1958_BASE, p1.launch - before - 1).filter(s => s.flight === p1).length, 0);
  const waiting = standsOn(sched, CAPE_1958_BASE, p1.launch - 3).find(s => s.flight === p1);
  assert.equal(waiting.pad.id, 'lc-17a');
  assert.equal(waiting.rise, 0);
  assert.equal(standsOn(sched, CAPE_1958_BASE, p1.launch, 0.4).find(s => s.flight === p1).rise, 0);
  assert.ok(standsOn(sched, CAPE_1958_BASE, p1.launch, 0.8).find(s => s.flight === p1).rise > 0);
  assert.equal(standsOn(sched, CAPE_1958_BASE, p1.launch + 1).filter(s => s.flight === p1).length, 0);
});
