import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DEFAULT_PROGRAMME } from '../js/truth/round.js';
import { atlasAscent } from '../js/truth/orbit.js';

for (const [vehicle, from, to] of [['titan', 'First stage', 'Second stage'], ['atlas', 'Boosters and sustainer', 'Sustainer']]) {
  test(`${vehicle} telemetry shows the load drop at staging and build again`, () => {
    const round = newRound(14, DEFAULT_PROGRAMME, vehicle);
    const { steps } = atlasAscent(round, 'nominal');
    assert.equal(steps[129].stage, from);
    assert.equal(steps[130].stage, to);
    assert.ok(steps[130].acc < steps[129].acc);
    assert.ok(steps[190].acc > steps[130].acc);
  });
}
