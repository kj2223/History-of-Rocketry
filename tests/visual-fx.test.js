// The v0.8 visual pass (js/stage/fx): the era's film grade and the launch's camera and shake. The Pixi parts need a
// browser; these check the numbers they are built on.
import test from 'node:test';
import assert from 'node:assert/strict';

import * as film from '../js/stage/fx/film.js';
import * as launch from '../js/stage/fx/launch.js';

test('each era has its own film, and the grade fades to nothing at strength 0', () => {
  const names = [1947, 1962, 1981, 2005, 2028].map(y => film.filmLookFor(y).name);
  assert.deepEqual(names, ['newsreel', 'kodachrome', 'video', 'digital', 'clean']);
  const id = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  const m = film.filmMatrix(film.filmLookFor(1947), 0);
  m.forEach((v, i) => assert.ok(Math.abs(v - id[i]) < 1e-9, `matrix[${i}] = ${v}`));
  // Full newsreel: grey goes warm (red above blue), and the screens get a lighter hand than the site.
  const n = film.filmMatrix(film.filmLookFor(1947), 1);
  const grey = r => n[r * 5] * 0.5 + n[r * 5 + 1] * 0.5 + n[r * 5 + 2] * 0.5 + n[r * 5 + 4];
  assert.ok(grey(0) > grey(2));
  assert.ok(film.FILM_STRENGTH.tracking < film.FILM_STRENGTH.site);
});

test('the camera holds on the pad, follows her up, then lets her go; big vehicles shake hardest', () => {
  assert.equal(launch.tiltFor(0), 0);
  assert.equal(launch.tiltFor(100), 0);
  assert.ok(launch.tiltFor(400) > 0);
  assert.equal(launch.tiltFor(5000), launch.TILT_MAX);
  assert.ok(launch.might('saturn5') > launch.might('redstone'));
  assert.ok(launch.might('wac') > 0);
  // The plume warms the dusk tint, and leaves it alone with no glow.
  assert.equal(launch.warmTint(0xb4a6bf, 0, true), 0xb4a6bf);
  assert.ok(launch.warmTint(0xb4a6bf, 1, true) >> 16 > 0xb4);
});

test('the light follows the clock: lamps at night, shadows by day, the sun sets in the west', async () => {
  const { lightAt } = await import('../js/stage/fx/daylight.js');
  const at = h => lightAt(h * 60);
  assert.equal(at(12).night, 0);
  assert.ok(at(12).shadow.alpha > 0 && at(22).shadow.alpha === 0);
  assert.equal(at(12).lamps, 0);
  assert.equal(at(22).lamps, 1);
  assert.ok(at(22).stars > 0.9 && at(12).stars === 0);
  // Shadows point away from the sun: west in the morning, east in the evening; long when it is low.
  assert.equal(at(8).shadow.dir, -1);
  assert.equal(at(17).shadow.dir, 1);
  assert.ok(at(17.8).shadow.length > at(12).shadow.length);
  // The old two-look sky: day by noon, dusk lamps by 19:00 (the evening the day ends on).
  assert.equal(at(19).dusk, true);
  assert.equal(at(12).dusk, false);
});

// Aaron, 13 Nov: the film's flicker was hard to look at and a seizure risk. Nothing may pulse the screen's brightness.
test('photosensitivity: the film never flickers, and one-off flashes are capped and smooth', async () => {
  const { swell, FLASH_MAX } = await import('../js/stage/fx/calm.js');
  for (const y of [1947, 1962, 1981, 2005, 2028]) {
    const look = film.filmLookFor(y);
    assert.equal(look.flicker, undefined, `${look.name} has no flicker`);
    // The grade is the same every frame.
    assert.deepEqual(film.filmMatrix(look, 1), film.filmMatrix(look, 1));
  }
  let peak = 0,
    prev = 0,
    biggestStep = 0;
  for (let t = 0; t < 2; t += 1 / 60) {
    const v = swell(t, 1, 0.15, 0.9);
    peak = Math.max(peak, v);
    biggestStep = Math.max(biggestStep, Math.abs(v - prev));
    prev = v;
  }
  assert.ok(peak <= FLASH_MAX + 1e-9 && FLASH_MAX <= 0.25);
  assert.ok(biggestStep < 0.05, `a frame-to-frame jump of ${biggestStep}`);
});

test('a round lost on the pad blows up in sight of the site, and the site watches before the plot', async () => {
  const src = await import('node:fs').then(fs => fs.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8'));
  assert.match(src, /PAD_BLAST = \{ vanguard: 'injector' \}/);
  const { breakupAge } = await import('../js/site/tv-shots.js');
  const c = { trace: [{ t: 72 }], round: { ascent: { breakupAt: 73 } } };
  assert.equal(breakupAge({ time: 10 }, c), null);
  c.trace.push({ t: 73 });
  assert.equal(breakupAge({ time: 10 }, c), 0);
  assert.equal(breakupAge({ time: 15 }, c), 5);
  assert.equal(breakupAge({ time: 40 }, c), null);
});

test('each day has its weather, true to the place and season, and the forecast wind drives the dust', async () => {
  const { weatherFor } = await import('../js/stage/fx/weather.js');
  const days = [...Array(400).keys()].map(d => d + 5000);
  const kinds = (o, hour = 15) => days.map(day => weatherFor({ day, hour, ...o }).kind);
  // White Sands: the monsoon's storms only in July and August; no sea fog or rain days.
  assert.ok(kinds({ month: 7, cape: false }).includes('storms'));
  assert.ok(!kinds({ month: 3, cape: false }).includes('storms'));
  assert.ok(!kinds({ month: 1, cape: false }).some(k => k === 'fog' || k === 'rain'));
  // The Cape: summer afternoon storms, winter morning fog that burns off.
  assert.ok(kinds({ month: 8, cape: true }).includes('storms'));
  const fogDay = days.find(day => weatherFor({ day, month: 1, hour: 8, cape: true }).kind === 'fog');
  assert.ok(weatherFor({ day: fogDay, month: 1, hour: 8, cape: true }).fog > 0.5);
  assert.equal(weatherFor({ day: fogDay, month: 1, hour: 12, cape: true }).fog, 0);
  // A stiff forecast wind blows dust at White Sands; a rough sea brings low cloud at the Cape.
  assert.equal(weatherFor({ day: 5001, month: 4, hour: 12, cape: false, windKmh: 35 }).kind, 'dust');
  assert.equal(weatherFor({ day: 5001, month: 4, hour: 12, cape: true, seaState: 5 }).kind, 'rough');
  // The same day always looks the same.
  assert.deepEqual(
    weatherFor({ day: 6000, month: 7, hour: 16, cape: true }),
    weatherFor({ day: 6000, month: 7, hour: 16, cape: true }),
  );
});

test('only the liquid-oxygen rockets breathe vapour on the pad', async () => {
  const { breathes } = await import('../js/stage/fx/life.js');
  for (const v of ['saturn5', 'atlas', 'redstone', 'shuttle', 'viking']) assert.ok(breathes(v), v);
  // Acid and aniline (WAC, Aerobee) and the Titan II's storable propellants do not boil off.
  for (const v of ['wac', 'aerobee', 'titan']) assert.ok(!breathes(v), v);
});

test('ending the day on the site plays the night as a slower time-lapse; scenes open in the era manner', async () => {
  const src = await import('node:fs').then(fs => fs.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8'));
  assert.match(src, /lapse: \{ from: g\.clock % 1440 \}/);
  const { transitionKind, LENGTH } = await import('../js/stage/fx/transition.js');
  assert.equal(transitionKind('control', 1969), 'crt');
  assert.equal(transitionKind('hangar', 1951), 'iris');
  assert.equal(transitionKind('site', 1985), 'lift');
  assert.ok(Object.values(LENGTH).every(s => s <= 0.6));
});

test('the swing arms go back on time: the crew arm before the last minutes, the rest as she lifts', async () => {
  const { armSwing } = await import('../js/site/draw.js');
  const pad = (clock, where = 'tower', phase = 'count', t = 0) => ({ rocket: { where }, console: { phase, clock, t } });
  assert.equal(armSwing(pad(600), 300), 0); // T-10 minutes: the crew arm still across
  assert.equal(armSwing(pad(280), 300), 1); // T-4:40: parked
  assert.ok(armSwing(pad(294), 300) > 0 && armSwing(pad(294), 300) < 1); // on its way
  assert.equal(armSwing(pad(5), 0), 0); // the service arms stay until lift-off
  assert.equal(armSwing(pad(0, 'flying', 'ascent', 2), 0), 1);
});

test('the site road: the fleet of the place and years, and closed for counts, firings and flights', async () => {
  const { fleetFor, roadClosed } = await import('../js/stage/fx/traffic.js');
  assert.ok(fleetFor('sands', 1947).some(([k]) => k === 'jeep'));
  assert.ok(fleetFor('cape', 1962).every(([k]) => k !== 'suv'));
  assert.ok(fleetFor('cape', 2026).some(([k]) => k === 'suv'));
  assert.equal(roadClosed({ rocket: { where: 'hangar' } }), false);
  assert.equal(roadClosed({ count: {}, rocket: { where: 'tower' } }), true);
  assert.equal(roadClosed({ standFlame: 0.5, rocket: {} }), true);
});
