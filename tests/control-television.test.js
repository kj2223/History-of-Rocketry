import test from 'node:test';
import assert from 'node:assert/strict';
import { controlTelevision } from '../js/site/draw.js';

test('the control-room TV hands off from the pad camera to observed telemetry', () => {
  const text = [];
  const ctx = new Proxy(
    {
      createLinearGradient: () => ({ addColorStop() {} }),
      fillText: line => text.push(line),
    },
    {
      get: (target, key) => target[key] ?? (() => {}),
    },
  );
  const sample = { t: 12, v: 1.23, acc: 2.4, gamma: 76.5, off: -1.2 };
  const g = { clock: 720, rocket: { where: 'gone' }, console: { phase: 'ascent', trace: [sample] } };
  controlTelevision(ctx, g, 0, 0, 480, 140);
  assert.deepEqual(text, []);

  // From T+13 the tracking camera follows her up, with the readings in its caption.
  sample.t = 13;
  controlTelevision(ctx, g, 0, 0, 480, 140);
  assert.ok(text.includes('TRACKING · SHORT RANGE'));
  assert.ok(text.includes('T+0:00:13'));
  for (const value of ['1.23 km/s', '2.4 g', '76.5°', '-1.2°']) assert.ok(text.includes(value));

  // Once the tracker has lost her (no onboard camera in these years) the readings board takes the screen.
  sample.t = 170;
  text.length = 0;
  controlTelevision(ctx, g, 0, 0, 480, 140);
  assert.match(text[0], /Ascent telemetry.*T\+0:02:50/);
  sample.t = 13;

  g.console.phase = 'insertion';
  text.length = 0;
  controlTelevision(ctx, g, 0, 0, 480, 140);
  assert.match(text[0], /Last ascent sample.*T\+0:00:13/);
});

test('the telemetry heading gives way before it runs into a long stage name (Shuttle)', () => {
  const text = [];
  const ctx = new Proxy(
    { measureText: s => ({ width: String(s).length * 8 }), fillText: (line, x, y, max) => text.push({ line, x, max }) },
    { get: (target, key) => target[key] ?? (() => {}) },
  );
  const sample = { t: 81, v: 1.1, acc: 2.1, gamma: 60, off: 0.2, stage: 'Solid boosters and main engines' };
  controlTelevision(ctx, { clock: 720, console: { phase: 'insertion', trace: [sample] } }, 0, 0, 480, 140);
  const [head, stage] = text;
  assert.equal(head.line, 'T+0:01:21');
  assert.equal(stage.line, sample.stage);
  // the heading ends before the stage begins
  assert.ok(head.x + head.line.length * 8 <= 480 * 0.96 - Math.min(stage.max, stage.line.length * 8));
});

test('the television has only the cameras its years had live', async () => {
  const { tvSources, tvShot } = await import('../js/site/tv-shots.js');
  // Mercury: black and white, pad then tracker. No onboard camera on the Saturn V (its camera pods were film).
  assert.equal(tvSources(1962, 'atlas').colour, false);
  assert.equal(tvSources(1969, 'saturn5').onboard, null);
  assert.deepEqual(
    [5, 20, 100, 170].map(t => tvShot(t, tvSources(1969, 'saturn5'))),
    ['pad', 'track', 'track', 'board'],
  );
  // The Shuttle's tank camera from STS-112 (October 2002), not before.
  assert.equal(tvSources(1988, 'shuttle').onboard, null);
  assert.equal(tvSources(2005, 'shuttle').onboard, 'tank');
  const shots = new Set([...Array(300).keys()].map(t => tvShot(t, tvSources(2005, 'shuttle'))));
  assert.deepEqual([...shots].sort(), ['onboard', 'pad', 'track']);
  assert.equal(tvShot(200, tvSources(2022, 'sls')), 'onboard');
});
