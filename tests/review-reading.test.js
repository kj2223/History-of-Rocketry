// The crewed review (12 November 2026 playtest): Hollis overruled a right finding on Gemini 8 by calling a flight with a
// stuck thruster and an emergency return "a good flight", and sent a Gemini spacecraft's fix "to Marshall".
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame, nextRound } from '../js/game.js';
import { SEASON } from '../js/data/campaign.js';
import { KITS, fixerOf, shortFor } from '../js/data/kits.js';
import {
  reviewReading,
  routeArgue,
  routeDone,
  workshopDecide,
  workshopDone,
  apollo8Decide,
  apollo8Done,
} from '../js/mercury.js';
import { skipTo } from '../js/dev/skip.js';
import { playMission, playRound, advance, carefulDecide } from './play.js';

const CREWED = ['redstone', 'atlas', 'titan', 'saturnib', 'saturn5', 'shuttle', 'dragon', 'sls'];

test("Gemini 8 on the playtest's seed: the stuck thruster is read as what it was, and the fix goes to McDonnell", () => {
  skipTo('gem-8', { seed: 919316 });
  g.round.faults = { thrusters: 'thruster' };
  g.record.trust = 0; // a record that has not earned Hollis's trust: he must still agree with a right finding
  playMission({ sims: 0, call: () => 'thruster' });
  const r = g.record.rounds.at(-1),
    review = g.notes.filter(n => /^Review: you said/.test(n.text)).at(-1).text;
  assert.equal(r.id, 'gem-8');
  assert.equal(r.ellisView, 'thruster');
  assert.equal(r.agreed, true);
  assert.doesNotMatch(review, /a good flight/);
  assert.doesNotMatch(review, /Marshall/);
  assert.match(review, /McDonnell/);
});

const round = (vehicle, failure, extra = {}) => ({ vehicle, flight: { failure }, end: {}, ...extra });

test('Hollis reads a clean flight clean, and a fault the room lived through as itself', () => {
  assert.equal(reviewReading(round('atlas', null), 'guidance'), 'nominal');
  assert.equal(reviewReading(round('titan', 'thruster', { flightFaultsSeen: ['thruster'] }), 'nominal'), 'thruster');
  assert.equal(reviewReading(round('titan', 'thruster', { flightFaultsSeen: ['thruster'] }), 'hatch'), 'thruster');
  assert.equal(reviewReading(round('titan', 'shutdown', { shutdownSeen: true }), 'computer'), 'shutdown');
  assert.equal(reviewReading(round('redstone', 'plug', { end: { outcome: 'pad' } }), 'lox'), 'plug');
  assert.equal(reviewReading(round('shuttle', 'oring', { end: { outcome: 'breakup' } }), 'computer'), 'oring');
  assert.equal(reviewReading(round('saturn5', 'chute', { end: { chute: true } }), 'sps'), 'chute');
});

test('where the tapes leave room, he misreads as a like failure of the same hardware, never as a good flight', () => {
  // The climb: off the line, or short.
  for (const view of ['nominal', 'oring', 'fuelcell', 'cabin', 'foam']) {
    const r = round('shuttle', 'computer', { ascent: { failure: 'computer' } });
    assert.equal(reviewReading(r, view), 'ssme', view);
  }
  const atlas = round('atlas', 'guidance', { ascent: { failure: 'guidance' } });
  assert.equal(reviewReading(atlas, 'scanner'), 'shortburn');
  // The capsule: one McDonnell failure for another.
  assert.equal(reviewReading(round('atlas', 'scanner'), 'shield'), 'shield');
  assert.equal(reviewReading(round('atlas', 'scanner'), 'nominal'), 'shield');
});

test('every crewed kit names who answers for each of its causes, and Hollis has words for each', () => {
  for (const v of CREWED)
    for (const c of Object.keys(KITS[v].explanations)) {
      assert.equal(typeof fixerOf(v, c), 'string', `${v} ${c}`);
      if (c !== 'unknown') assert.equal(typeof shortFor(v, c), 'string', `${v} ${c}`);
    }
  assert.equal(fixerOf('titan', 'thruster'), 'McDonnell');
  assert.equal(fixerOf('titan', 'titanctl'), 'Martin');
  assert.equal(fixerOf('atlas', 'guidance'), 'Convair');
  assert.equal(fixerOf('redstone', 'control'), 'Marshall');
  assert.equal(fixerOf('saturn5', 'alarm'), 'Grumman');
});

// Every crewed round, played through on a few seeds with the right answer given at each review.
function campaign(seed, each) {
  newGame(seed);
  for (let guard = 160; guard && g.beat !== 'seasonEnd'; guard--) {
    const scene = g.beat;
    if (scene === 'sRoute') {
      routeArgue('lor');
      routeDone();
    } else if (scene === 'sWorkshop') {
      workshopDecide('attitude', 'pitch');
      workshopDecide('crew', 'wait');
      workshopDone();
    } else if (scene === 'sApollo8') {
      apollo8Decide('moon');
      apollo8Done();
    }
    if (['sRoute', 'sWorkshop', 'sApollo8'].includes(scene)) {
      nextRound();
      g.room = null;
      continue;
    }
    let truth = null;
    if (g.crewed)
      playMission({
        decide: carefulDecide,
        call: gg => (truth = gg.round.flight.failure || 'nominal'),
      });
    else playRound(() => 'nominal', { inspector: 'you', burn: 'short', leak: false });
    if (truth) each(truth);
    const o = g.record.offers.at(-1);
    if (o && !o.made && o.day >= g.record.rounds.at(-1).day) {
      o.made = true;
      o.answer = null;
    }
    advance(true);
    g.room = null;
  }
}

test('at every crewed review the right answer is on the table, and a flight with trouble is never "a good flight"', () => {
  let reviews = 0;
  for (const seed of [104729, 919316]) {
    try {
      campaign(seed, truth => {
        reviews += 1;
        const r = g.record.rounds.at(-1),
          id = SEASON[g.roundIndex].id,
          text = g.notes.filter(n => /^Review: you said/.test(n.text)).at(-1).text;
        assert.ok(truth in KITS[g.vehicle].explanations, `${id}: no answer for ${truth}`);
        assert.doesNotMatch(text, /undefined/, id);
        if (truth !== 'nominal') assert.notEqual(r.ellisView, 'nominal', id);
        if (!['redstone', 'saturnib', 'saturn5', 'shuttle', 'sls'].includes(g.vehicle))
          assert.doesNotMatch(text, /Marshall/, id);
      });
    } catch (e) {
      if (e instanceof assert.AssertionError) throw e;
      // A bot crew lost before the end stops this seed early; the reviews it reached still count.
    }
  }
  assert.ok(reviews > 40, `${reviews} reviews`);
});
