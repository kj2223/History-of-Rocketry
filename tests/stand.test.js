// Aaron's playtest, 9 November: the static test stand's top cross-braces stuck out above its top beam. Every member of
// the frame now ends on a leg, no higher than the top beam.
import test from 'node:test';
import assert from 'node:assert/strict';
import { standStructure, GROUND, PLACES } from '../js/site/draw.js';

test('the static test stand frame stays inside its legs and under its top beam', () => {
  const p = PLACES.stand,
    points = [];
  const ctx = new Proxy(
    {
      moveTo: (x, y) => points.push([x, y]),
      lineTo: (x, y) => points.push([x, y]),
    },
    { get: (target, key) => target[key] ?? (() => {}) },
  );
  standStructure(ctx, p);
  assert.ok(points.length > 10);
  for (const [x, y] of points) {
    const h = GROUND - y;
    assert.ok(h <= p.h + 1e-9, `a member reaches ${h} above the ground, over the ${p.h} top beam`);
    assert.ok(
      x >= p.x + 20 + (10 * h) / p.h - 1e-9 && x <= p.x + 100 - (10 * h) / p.h + 1e-9,
      `${x},${y} outside the legs`,
    );
  }
});
