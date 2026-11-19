// The anomaly ledger: small oddities after a flight, signed off or worked before the next one. Real ones signed off come
// back worse and raise their fault; worked ones are found and cut it. Nothing that is nothing changes a round.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANOMALIES,
  afterFlight,
  withLedger,
  accept,
  work,
  signOffUnclaimed,
  openItems,
  signedOff,
  GROWTH,
  WORKED,
} from '../js/world/ledger.js';
import { DEFAULT_PROGRAMME, newRound } from '../js/truth/round.js';

// A programme that has flown the Shuttle enough to have something on its ledger.
function withItem(real) {
  for (let seed = 1; seed < 500; seed++) {
    const p = {};
    afterFlight(p, { vehicle: 'shuttle', seed, index: 3, name: 'STS-1' });
    if (p.ledger?.length && p.ledger[0].real === real) return p;
  }
  throw new Error('no item found');
}

test('every item bears on a fault the family really draws', () => {
  for (const [family, list] of Object.entries(ANOMALIES))
    for (const a of list) assert.ok(`${a.fault}Risk` in DEFAULT_PROGRAMME, `${family}: ${a.fault}`);
});

test('a new item waits on a call, and unclaimed items are signed off by default', () => {
  const p = withItem(true);
  assert.equal(openItems(p).length, 1);
  assert.equal(signOffUnclaimed(p), 1);
  assert.equal(signedOff(p).length, 1);
});

test('a real item signed off comes back worse and raises its fault; worked, it is found and cuts it', () => {
  const p = withItem(true),
    e = p.ledger[0],
    k = `${e.fault}Risk`;
  accept(p, e.id);
  const lines = afterFlight(p, { vehicle: 'shuttle', seed: 9, index: 4, name: 'STS-2' });
  assert.ok(lines.includes(ANOMALIES.shuttle.find(a => a.fault === e.fault).worse));
  assert.equal(e.trend, 'worse');
  assert.equal(e.status, 'new', 'back on the agenda');
  accept(p, e.id);
  const raised = withLedger({ [k]: 0.1 }, p, 'shuttle');
  assert.ok(raised[k] >= 0.1 * (1 + GROWTH) - 1e-12);
  assert.equal(withLedger({ [k]: 0.1 }, p, 'titan')[k], 0.1, 'other families are untouched');
  const r = work(p, e.id);
  assert.equal(r.found, true);
  assert.ok(Math.abs(withLedger({ [k]: 0.1 }, p, 'shuttle')[k] - 0.1 * WORKED) < 1e-12);
});

test('an item that is nothing changes no risk, and working it finds nothing', () => {
  const p = withItem(false),
    e = p.ledger[0],
    k = `${e.fault}Risk`;
  accept(p, e.id);
  assert.equal(withLedger({ [k]: 0.1 }, p, 'shuttle')[k], 0.1);
  assert.equal(work(p, e.id).found, false);
});

test('the ledger moves thresholds only: a round with no ledger effect is the same round', () => {
  const p = withItem(false);
  accept(p, p.ledger[0].id);
  const base = { ...DEFAULT_PROGRAMME };
  const a = newRound(77, base, 'shuttle'),
    b = newRound(77, withLedger(base, p, 'shuttle'), 'shuttle');
  assert.deepEqual(a.faults, b.faults);
});

// In the game: a played crewed flight puts its post-flight report on the ledger, and the round-end card asks for calls.
import { g, newGame, ledgerCall } from '../js/game.js';
import { toRoundId, playMission } from './play.js';

test('a crewed flight can leave items on the ledger, and the round-end card asks for a call', async () => {
  const { ROOMS } = await import('../js/scenes/rooms.js');
  let found = false;
  for (let seed = 1; seed < 30 && !found; seed++) {
    newGame(seed);
    toRoundId('mr-1');
    playMission();
    if (g.programme.ledger?.length) {
      found = true;
      assert.equal(g.beat, 'roundEnd');
      const e = g.programme.ledger[0];
      assert.match(ROOMS.roundEnd(), /anomaly ledger/);
      ledgerCall(e.id, 'work');
      assert.equal(e.status, 'closed');
      assert.equal(g.record.ledgerCalls.length, 1);
    }
  }
  assert.ok(found, 'some Mercury flight left an item on the ledger');
});
