// Corrections from the 10 and 11 November 2026 source pass (V0.7.5-RELEASE-PLAN.md, "10 November source pass").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FLIGHTS, DECISIONS } from '../js/data/flights.js';

const said = id => JSON.stringify(FLIGHTS[id].steps);

test("Apollo 12's tracking puts the landing point short of the target, as it was in 1969", () => {
  assert.match(said('apollo-12'), /4,200 ft short/);
  assert.doesNotMatch(said('apollo-12'), /4,200 ft long|downrange of the target/);
  assert.match(DECISIONS.landpoint.q, /short of the target/);
});

test('The Artemis flybys pass the Moon at their real distances', () => {
  assert.match(said('artemis-1'), /a hundred and thirty kilometres/);
  assert.match(said('artemis-2'), /Six and a half thousand kilometres/);
  assert.doesNotMatch(said('artemis-1') + said('artemis-2'), /ixty-eight kilometres/);
});

test('MR-1 rose about four inches, not one', () => {
  assert.doesNotMatch(readFileSync(new URL('../js/mercury.js', import.meta.url), 'utf8'), /rose about an inch/);
});

test('The packaged app is tamper-checked: electron fuses on', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.build.electronFuses.onlyLoadAppFromAsar, true);
  assert.equal(pkg.build.electronFuses.enableEmbeddedAsarIntegrityValidation, true);
});
