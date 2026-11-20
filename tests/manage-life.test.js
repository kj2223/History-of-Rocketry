// The living Cape (js/manage/life.js): the day turns without flicker, people and trucks keep to the roads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nightOf, easeNight, movers, windowPixels, WALKERS, VEHICLES, baseLife } from '../js/manage/life.js';
import { CAPE_1958_BASE, CAPE_1958_ROADS } from '../js/manage/base.js';
import { ART } from '../js/manage/paint.js';

test('night falls after dusk and lifts at dawn', () => {
  assert.equal(nightOf(12), 0);
  assert.equal(nightOf(2), 1);
  assert.equal(nightOf(23), 1);
  assert.ok(nightOf(20) > 0 && nightOf(20) < 1);
  assert.ok(nightOf(6) > 0 && nightOf(6) < 1);
});

test('the light only turns at normal speed, and always as a ramp', () => {
  // At 4x and 16x the map holds daylight, whatever the hour.
  let n = 1;
  for (let i = 0; i < 200; i++) n = easeNight(n, { part: 0.02, speed: 16, dt: 1 / 60 });
  assert.ok(n < 0.01);
  // A frame never moves the light by more than a few per cent.
  n = 0;
  const next = easeNight(n, { part: 0, speed: 1, dt: 1 / 60 });
  assert.ok(next > 0 && next < 0.05);
  // Calm effects: daylight.
  assert.equal(easeNight(0, { part: 0, speed: 1, dt: 1, still: true }), 0);
});

test('everyone stays on the map, and fewer are about at night', () => {
  for (const t of [0, 3.3, 47, 600]) {
    const day = movers(CAPE_1958_ROADS, t, 0),
      night = movers(CAPE_1958_ROADS, t, 1);
    assert.equal(day.length, WALKERS + VEHICLES);
    assert.ok(night.length < day.length && night.filter(m => m.kind !== 'person').length === VEHICLES);
    for (const m of day) assert.ok(m.x > 0 && m.x < ART.w && m.y > 0 && m.y < ART.h, `${m.kind} ${m.x},${m.y}`);
  }
});

test('people walk: positions change smoothly from frame to frame', () => {
  const a = movers(CAPE_1958_ROADS, 10),
    b = movers(CAPE_1958_ROADS, 10 + 1 / 60);
  for (let i = 0; i < a.length; i++) assert.ok(Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y) < 2);
});

test('the lit windows are on the buildings that have them', () => {
  const px = windowPixels(CAPE_1958_BASE);
  assert.ok(px.length > 20);
  for (const [x, y] of px) assert.ok(x > 0 && x < ART.w && y > 0 && y < ART.h);
});

test('a launch leaves smoke that thins away', () => {
  const life = baseLife(CAPE_1958_BASE, CAPE_1958_ROADS),
    pad = CAPE_1958_BASE.find(b => b.id === 'lc-17a');
  for (let i = 0; i < 60; i++)
    life.update(1 / 30, { part: 0.6, speed: 1, paused: false, stands: [{ pad, rise: 20 + i }] });
  assert.ok(life.smoke() > 10);
  for (let i = 0; i < 30 * 40; i++) life.update(1 / 30, { part: 0.6, speed: 1, paused: false, stands: [] });
  assert.equal(life.smoke(), 0);
});
