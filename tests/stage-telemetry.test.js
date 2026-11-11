// Every orbital booster is flown a stage at a time from its own stages (data/stacks.js): the load builds as each stage
// burns its propellant, falls back when it drops away and the next one lights, and a stage that cuts off early leaves its
// share of the speed unflown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DEFAULT_PROGRAMME } from '../js/truth/round.js';
import { atlasAscent, ORBIT_PLAN, insertionMargin } from '../js/truth/orbit.js';
import { ORBITAL_STACKS } from '../js/data/stacks.js';
import { burnStack, liftoffMass, stackBurn } from '../js/truth/stages.js';
import { flightTruth, resolve } from '../js/truth/flights.js';

const NAMES = {
  atlas: { guidance: 'guidance', shortburn: 'shortburn', booster: 'Atlas' },
  titan: { guidance: 'titanctl', shortburn: 'stage2', booster: 'Titan II' },
  saturn5: { guidance: 'saturnctl', shortburn: 's2cutoff', booster: 'Saturn V' },
  saturnib: { guidance: 'saturnctl', shortburn: 's2cutoff', booster: 'Saturn IB' },
  shuttle: { guidance: 'computer', shortburn: 'ssme', boost: 'oring', booster: 'Shuttle' },
  sls: { guidance: 'guidance', shortburn: 'shortburn', booster: 'SLS' },
  dragon: { guidance: 'guidance', shortburn: 'shortburn', booster: 'Falcon 9' },
};
const climb = (vehicle, force = 'nominal', seed = 14) =>
  atlasAscent(newRound(seed, DEFAULT_PROGRAMME, vehicle), force, NAMES[vehicle]);

for (const [vehicle, stack] of Object.entries(ORBITAL_STACKS)) {
  test(`${vehicle}: each staging drops the load and it builds again on the next stage`, () => {
    const a = climb(vehicle);
    assert.equal(a.burn, stackBurn(stack));
    assert.equal(a.staging.length, stack.stages.length - 1);
    let start = 0;
    stack.stages.forEach((s, i) => {
      const end = start + s.burn;
      assert.equal(a.steps[start + 1].stage, s.name);
      assert.ok(a.steps[end - 1].acc > a.steps[start + 1].acc, `${s.name} builds load as it burns`);
      if (i < stack.stages.length - 1) {
        assert.equal(a.staging[i].t, end);
        assert.ok(a.steps[end].acc < a.steps[end - 1].acc, `the load falls back at ${s.name}'s staging`);
        assert.equal(a.steps[end].stage, stack.stages[i + 1].name);
      }
      start = end;
    });
    for (const p of a.steps) assert.ok(p.acc <= (stack.maxG ?? Infinity) + 1e-9 && p.acc > 0.3, `${p.acc} g at ${p.t}`);
  });

  test(`${vehicle}: a good climb cuts off at orbital speed; an early cutoff on its stage leaves her short`, () => {
    const good = climb(vehicle);
    assert.ok(Math.abs(good.steps.at(-1).v - ORBIT_PLAN.v) < 0.05, `${good.steps.at(-1).v} km/s`);
    for (let i = 1; i < good.steps.length; i++) assert.ok(good.steps[i].v >= good.steps[i - 1].v - 1e-9);
    const short = climb(vehicle, NAMES[vehicle].shortburn);
    if (stack.reserve) return; // the Saturn V's S-IVB makes it up: see below
    assert.ok(short.burn < good.burn, 'she cuts off before the plan');
    assert.ok(insertionMargin(short.steps.at(-1).v, 0) < 0, `${short.steps.at(-1).v} km/s is not orbit`);
  });
}

test('Saturn V: an S-II that cuts off early stages at once, and the S-IVB burns long on its TLI propellant to make orbit', () => {
  const stack = ORBITAL_STACKS.saturn5,
    sii = stack.stages[0].burn + stack.stages[1].burn;
  for (const seed of [1, 3, 5, 7]) {
    const a = climb('saturn5', 's2cutoff', seed);
    assert.equal(a.staging.length, 2);
    assert.ok(a.staging[1].t < sii, 'the S-IVB lights early');
    assert.equal(a.steps.at(-1).stage, 'S-IVB');
    assert.ok(a.makeup > 0 && a.burn - a.staging[1].t === stack.stages[2].burn + a.makeup);
    assert.ok(insertionMargin(a.steps.at(-1).v, 0) > 0, `${a.steps.at(-1).v} km/s is orbit`);
    // What it burned past its plan came out of the propellant kept for the Moon.
    const tonnes = (a.makeup * stack.stages[2].prop) / stack.stages[2].burn;
    assert.ok(tonnes <= stack.reserve);
    assert.equal(a.tliShort, tonnes > stack.spare);
  }
  assert.equal(climb('saturn5', 'nominal').makeup, 0);
});

test('a Saturn IB has no propellant kept back: an early S-IVB cutoff leaves her short', () => {
  const a = climb('saturnib', 's2cutoff', 3);
  assert.equal(a.makeup, 0);
  assert.ok(insertionMargin(a.steps.at(-1).v, 0) < 0);
});

test('an S-IVB that spent its TLI propellant keeps her in Earth orbit, whatever the call', () => {
  const r = newRound(7, DEFAULT_PROGRAMME, 'saturn5');
  atlasAscent(r, 's2cutoff', NAMES.saturn5);
  assert.equal(r.ascent.tliShort, true);
  flightTruth(r, 'apollo-11');
  const out = resolve(r, 'tli', 'go', {});
  assert.equal(out.set.earthOnly, true);
  assert.match(out.lines[0][1], /not enough for TLI/);
});

test('the stacks weigh what the boosters weighed on the pad, and lift off', () => {
  const pad = { atlas: 116, titan: 154, saturnib: 590, saturn5: 2900, shuttle: 2030, sls: 2600, dragon: 549 };
  for (const [v, stack] of Object.entries(ORBITAL_STACKS)) {
    const m = liftoffMass(stack);
    assert.ok(Math.abs(m - pad[v]) / pad[v] < 0.06, `${v} ${m} t`);
    assert.ok(burnStack(stack).rows[0].acc > 1.1, `${v} lifts off`);
  }
});
