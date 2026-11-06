// The V-2 and Bumper rounds: the captured V-2's own faults and how they show, a WAC season's fixes carried into the
// Bumper's upper stage, two-stage flights and their failures, and the first promotion offer at the end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, staticFire, standRework, hasPumpFault, hasIgniterFault, fly, wreckage, flagSpots } from '../js/truth/round.js';
import { initProgramme, adopt, estimate } from '../js/world/programme.js';
import { initRecord, turningPoint, answerOffer, shiftTrust } from '../js/career/record.js';
import { SEASON, FIRST_OFFER } from '../js/data/campaign.js';
import { KITS } from '../js/data/kits.js';
import { g, newGame, nextRound, answerFirstOffer, checkpoint, checkCheckpoint } from '../js/game.js';
import { playRound, advance } from './play.js';

const seedWhere = (vehicle, ok, programme = initProgramme()) => { for (let s = 1; s < 800; s++) if (ok(newRound(s, programme, vehicle))) return s; throw new Error('no seed'); };

test('a worn V-2 turbopump shows on the stand as a low, rough start, and refurbishing it clears it', () => {
  const r = newRound(seedWhere('v2', hasPumpFault), initProgramme(), 'v2');
  assert.ok(staticFire(r).steady < KITS.v2.stand.pc[0], 'below the V-2 chamber band');
  standRework(r);
  assert.equal(hasPumpFault(r), false);
  assert.ok(staticFire(r).steady > 14.5);
});

test('a V-2 round only has faults a V-2 can have, at its own spots', () => {
  for (let s = 1; s < 200; s++) {
    const r = newRound(s, initProgramme(), 'v2');
    for (const [id, kind] of Object.entries(r.faults)) { assert.ok(KITS.v2.spots[id], id); assert.ok(['vanes', 'leak'].includes(kind), kind); }
    assert.equal(hasIgniterFault(r), false, 'a V-2 has no WAC igniter');
  }
});

test('the igniter fix from the WAC rounds carries into every Bumper\'s upper stage', () => {
  const p = initProgramme();
  const before = [...Array(300).keys()].filter(s => hasIgniterFault(newRound(s + 1, p, 'bumper'))).length;
  assert.ok(before > 80);
  adopt(p, 'ignition');
  for (let s = 1; s < 300; s++) assert.equal(hasIgniterFault(newRound(s, p, 'bumper')), false);
});

test('a clean Bumper climbs far above anything a single stage reaches, and its wreck shows nothing wrong', () => {
  const r = newRound(9, initProgramme(), 'bumper');
  r.faults = {}; r.igniter = 'wac-upper/r3'; r.turbopump = 'v2/r2';
  const f = fly(r);
  assert.equal(f.failure, null);
  assert.ok(f.apogee > 330 && f.apogee < 450, `apogee ${f.apogee}`);
  assert.match(wreckage(r).join(' '), /could not find it/);
});

test('every kind of round fails in its own ways, and the wreck points at the cause', () => {
  const words = { ignition: /igniter housing/, weld: /weld seam/, leak: /acid staining|valve housings/, turbopump: /turbopump casing/, vanes: /jet vane is missing/, separation: /bolts have not fired/ };
  for (const vehicle of ['wac', 'v2', 'bumper']) {
    const seen = new Set();
    let failures = 0;
    for (let s = 1; s < 400; s++) {
      const r = newRound(s, initProgramme(), vehicle), f = fly(r);
      if (!f.failure) continue;
      failures++; seen.add(f.failure);
      assert.ok(KITS[vehicle].explanations[f.failure], `${vehicle} can be explained as ${f.failure}`);
      assert.match(wreckage(r).join(' '), words[f.failure]);
    }
    assert.ok(failures > 80 && failures < 320, `${vehicle}: ${failures} failures`);
    assert.ok(seen.size >= 3, `${vehicle} failed in ${[...seen]}`);
  }
});

test('flagging a cracked vane or a bad separation lead gets it fixed before the round flies', () => {
  const r = newRound(seedWhere('bumper', r => Object.values(r.faults).includes('separation')), initProgramme(), 'bumper');
  const id = Object.keys(r.faults).find(k => r.faults[k] === 'separation');
  flagSpots(r, [id]);
  assert.ok(!Object.values(r.faults).includes('separation'));
  assert.match(r.events[0], /bad firing lead/);
});

test('each kind of round has its own drawing-office estimate', () => {
  const p = initProgramme();
  const w = estimate(p, 'wac', 1), b = estimate(p, 'bumper', 1);
  assert.ok(b.low > w.high * 2);
  assert.ok((b.high - b.low) / b.high > (w.high - w.low) / w.high, 'a Bumper has never flown, so its spread is wider');
});

test('the campaign runs from the WAC rounds through a V-2 round to Bumper 5, then comes to the first offer', () => {
  assert.deepEqual(SEASON.slice(0, 7).map(r => r.vehicle), ['wac', 'wac', 'wac', 'wac', 'v2', 'bumper', 'bumper']);
  newGame(5);
  for (let i = 0; i < 7; i++) {
    assert.equal(g.vehicle, SEASON[i].vehicle);
    assert.equal(g.people.hoyt.hidden, SEASON[i].vehicle === 'wac', 'Hoyt is on the V-2 and Bumper rounds');
    playRound(() => 'nominal');
    if (i < 6) advance();
  }
  assert.equal(g.beat, 'roundEnd');
  assert.equal(g.record.offers.length, 1);
  checkCheckpoint(JSON.parse(JSON.stringify(checkpoint())));
});

test('a good standing brings the offer; taking it changes your seat, turning it down keeps yours', () => {
  const take = initRecord(); shiftTrust(take, 2);
  assert.ok(turningPoint(take, FIRST_OFFER, 100).made);
  answerOffer(take, true);
  assert.equal(take.seat, 'test-conductor');
  const keep = initRecord(); shiftTrust(keep, 2);
  turningPoint(keep, FIRST_OFFER, 100); answerOffer(keep, false);
  assert.equal(keep.seat, 'junior');
  assert.equal(answerOffer(keep, true), null, 'an answered offer is not answered again');
});

test('a poor standing passes you over: sidelined, never fired', () => {
  const r = initRecord(); shiftTrust(r, -2);
  const o = turningPoint(r, FIRST_OFFER, 100);
  assert.equal(o.made, false);
  assert.equal(r.sidelined, true);
  assert.equal(r.seat, 'junior');
  assert.equal(answerOffer(r, true), null);
});

test('answering the offer in the game is saved, survives a resume, and an unanswered offer holds the next round', () => {
  newGame(5);
  for (let i = 0; i < 7; i++) { playRound(() => 'nominal'); if (i < 6) advance(); }
  g.record.offers[0].made = true; g.record.offers[0].answer = null; // whatever the rounds went like, make the offer for this test
  nextRound();
  assert.equal(g.roundIndex, 6, 'the offer must be answered first');
  answerFirstOffer(true);
  const saved = JSON.parse(JSON.stringify(checkpoint()));
  newGame(1, saved);
  assert.equal(g.record.seat, 'test-conductor');
  assert.equal(g.beat, 'roundEnd');
});
