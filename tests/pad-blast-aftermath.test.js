// Issue #250 (Aaron's playtest mark 18, Vanguard TV-3 lost on the pad, 7 Dec 1957): he watched the blast from the
// blockhouse and the range plot, came out to the site an hour later, and the whole fireball played then, as big dark
// discs over the trucks going out for the telemetry. The site now knows when it happened, by the game's clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { aftermath, blastAge, columnRate, landing, AFTERMATH_MIN } from '../js/stage/fx/blast-time.js';

test('the blast is the moment on the site only while it is happening; an hour later it is the aftermath', () => {
  const b = { clock: 6801908 };
  assert.equal(aftermath(b, { clock: 6801908.5 }), false);
  assert.equal(aftermath(b, { clock: 6801908 + AFTERMATH_MIN + 1 }), true);
  // Mark 18: blast at 13:08, the site seen at 14:06.
  assert.ok(aftermath(b, { clock: 6801966.9 }));
  assert.ok(Math.abs(blastAge(b, { clock: 6801966.9 }) - 58.9) < 1e-6);
  // An old save's blast without a clock still plays as it did.
  assert.equal(aftermath({}, { clock: 5 }), false);
});

test('the smoke column is thick at first and thins through the day, never to nothing', () => {
  assert.equal(columnRate(0, 0), 6);
  assert.ok(columnRate(60, 60) < columnRate(60, 5));
  assert.ok(columnRate(60, 59) < 2);
  assert.ok(columnRate(600, 400) >= 0.3);
});

test('pieces thrown out come to rest on the ground beyond where they started, on their side', () => {
  const x = landing(1000, 500, 100, -200, 530);
  assert.ok(x > 1000);
  assert.ok(landing(1000, 500, -100, -200, 530) < 1000);
});
