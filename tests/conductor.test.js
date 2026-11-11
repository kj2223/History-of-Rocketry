// The test conductor's seat on the Aerobee rounds: planning the round against the range slot, crew who inspect in your
// place with their own hidden habits, the full-duration firing that shows the liner, polling the stations in the count,
// and chairing the review, where your conclusion becomes the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, staticFire, hasLinerFault, standRework, crewInspect, fly, wreckage } from '../js/truth/round.js';
import { initProgramme, adopt } from '../js/world/programme.js';
import { TRAITS } from '../js/world/people.js';
import { SEASON } from '../js/data/campaign.js';
import { g, newGame, conducting, finishPlan, countAnswer, checkpoint, checkCheckpoint } from '../js/game.js';
import { playRound, advance, until } from './play.js';

const seedWhere = ok => {
  for (let s = 1; s < 800; s++) if (ok(newRound(s, initProgramme(), 'aerobee'))) return s;
  throw new Error('no seed');
};

test('a failing liner shows only on a full-duration firing, as a hot chamber wall', () => {
  const r = newRound(seedWhere(hasLinerFault), initProgramme(), 'aerobee');
  const short = staticFire(r, 'short');
  assert.equal(short.wall, null, 'a short firing has no wall reading');
  assert.ok(short.steady > 17, 'and its chamber pressure looks normal');
  const long = staticFire(r, 'long');
  assert.ok(long.wall > 700, `wall ${long.wall}`);
  standRework(r);
  assert.equal(hasLinerFault(r), false);
  assert.ok(staticFire(r, 'long').wall < 700);
});

test('a sound liner runs cool on a full-duration firing', () => {
  const r = newRound(
    seedWhere(r => !hasLinerFault(r)),
    initProgramme(),
    'aerobee',
  );
  assert.ok(staticFire(r, 'long').wall < 680);
});

test('Aerobees fail by the liner as well as welds and leaks, and the wreck shows a burn-through', () => {
  let liner = 0;
  for (let s = 1; s < 300; s++) {
    const r = newRound(s, initProgramme(), 'aerobee'),
      f = fly(r);
    if (f.failure === 'liner') {
      liner++;
      assert.match(wreckage(r).join(' '), /burnt clean through/);
    }
  }
  assert.ok(liner > 15, `${liner} liner failures`);
  const p = initProgramme();
  adopt(p, 'liner');
  for (let s = 1; s < 200; s++)
    assert.equal(hasLinerFault(newRound(s, p, 'aerobee')), false, "the review's liner fix carries");
});

test('Kowalski finds more real faults than Delgado and cries wolf less', () => {
  let k = { hit: 0, miss: 0, fa: 0 },
    d = { hit: 0, miss: 0, fa: 0 };
  for (let s = 1; s < 400; s++) {
    for (const [who, tally] of [
      ['kowalski', k],
      ['delgado', d],
    ]) {
      const r = newRound(s, initProgramme(), 'aerobee'),
        seen = crewInspect(r, TRAITS[who]);
      for (const id of Object.keys(r.faults)) seen.includes(id) ? tally.hit++ : tally.miss++;
      tally.fa += seen.filter(id => !r.faults[id]).length;
    }
  }
  assert.ok(k.hit / (k.hit + k.miss) > d.hit / (d.hit + d.miss) + 0.15);
  assert.ok(k.fa < d.fa / 2);
});

// Play to the Aerobee rounds having taken the offer at Bumper 5.
function toAerobee(seed) {
  newGame(seed);
  for (let i = 0; i < 7; i++) {
    playRound(() => 'nominal');
    if (i === 6) {
      g.record.offers[0].made = true;
      g.record.offers[0].answer = null;
    }
    advance(true);
  }
  assert.equal(g.vehicle, 'aerobee');
  assert.equal(g.record.seat, 'test-conductor');
}

test('taking the offer makes you conductor of the Aerobee rounds: you plan, run the count and chair the review', () => {
  toAerobee(3);
  assert.ok(conducting());
  assert.equal(g.people.brandt.hidden, false, 'the Navy project officer is on site');
  finishPlan({ inspector: 'kowalski', burn: 'long', leak: true });
  until(() => g.beat === 'board');
  assert.ok(g.notes.some(n => /Sgt. Kowalski (flagged|found nothing)/.test(n.text)));
  playRound(() => 'liner', { inspector: 'you' }); // carries on from the board; the plan is already made
  assert.ok(g.record.rounds.at(-1).chaired);
  assert.ok(g.record.rounds.at(-1).slipDays >= 1, 'a full-duration firing costs a day');
  assert.ok(g.programme.adopted.includes('liner'), "the conductor's finding becomes the fix");
  assert.ok(g.notes.some(n => /Full-duration firing: .* Chamber wall temperature ended at/.test(n.text)));
});

test('as conductor the stations report at each poll, and the call is yours', () => {
  toAerobee(8);
  playRound(() => 'nominal', { inspector: 'you', burn: 'short', leak: false }, 'poll');
  assert.ok(g.count.poll, 'the count stops at the poll');
  assert.deepEqual(
    g.count.reports.map(r => r.station),
    ['PRESS', 'RANGE', 'PAD'],
  );
  countAnswer(false);
  assert.ok(g.count.held);
});

test('turning the offer down keeps you a junior engineer on the Aerobee rounds, and the offer comes again', () => {
  newGame(3);
  for (let i = 0; i < 7; i++) {
    playRound(() => 'nominal');
    if (i === 6) {
      g.record.offers[0].made = true;
      g.record.offers[0].answer = null;
    }
    advance(false);
  }
  assert.equal(g.record.seat, 'junior');
  assert.equal(conducting(), false);
  // Turning everything down keeps you with JPL to Perseverance.
  for (let i = 7; i < 60 && g.beat !== 'seasonEnd'; i++) {
    playRound(() => 'nominal');
    if (g.beat !== 'seasonEnd') advance(false);
  }
  assert.equal(g.beat, 'seasonEnd');
  assert.equal(
    g.record.offers.filter(o => o.seat === 'test-conductor').length,
    2,
    'a second turning point after the Aerobee rounds',
  );
  assert.equal(g.record.rounds.at(-1).id, 'perseverance');
  checkCheckpoint(JSON.parse(JSON.stringify(checkpoint())));
});

test('the plan is saved with the morning checkpoints', () => {
  toAerobee(4);
  playRound(() => 'nominal', { inspector: 'you', burn: 'long', leak: false }, 'staticPrep');
  assert.equal(g.beat, 'staticPrep');
  const saved = JSON.parse(JSON.stringify(checkpoint()));
  assert.equal(saved.plan.burn, 'long');
  newGame(1, saved);
  until(() => g.beat === 'static');
  assert.equal(g.stand.burn, 'long');
});
