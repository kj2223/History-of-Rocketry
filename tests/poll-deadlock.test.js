// Playtest mark 11: from Flight's seat a ship hold left Retro's desk lit NO-GO for the rest of the count, the final
// status check had no reports, and a no-go on a clean board held and re-polled forever.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g } from '../js/game.js';
import { consoleStart, consolePoll, tickConsole } from '../js/mercury.js';
import { campaignTo, nextDay } from './play.js';

function launchDay(seat, roundId = 'gem-12') {
  campaignTo(21, roundId, { sims: 0 });
  nextDay();
  assert.equal(g.beat, 'mLaunch');
  g.record.seat = seat;
  consoleStart();
  const con = g.console;
  con.cond = { seaState: 3, late: 'downrange' };
  return con;
}
const runTo = (con, what) => {
  for (let i = 0; i < 20000 && !what(); i++) tickConsole(0.05);
  assert.ok(what(), 'the count reached the expected point');
};
const lines = () => [g.people.reyes, g.people.tate, g.people.hollis, g.people.you].map(p => p.bubble?.text || '');

test("Flight's ship hold clears Retro's lamp, and the final status check opens with the stations' reports", () => {
  const con = launchDay('flight');
  runTo(con, () => con.poll === 'recovery');
  assert.equal(con.lamps.RETRO.a, 'NO-GO');
  consolePoll(false); // hold for the ship
  assert.equal(con.lamps.FLIGHT.a, 'NO-GO');
  runTo(con, () => con.poll === 'recovery');
  assert.equal(con.cond.late, null);
  assert.equal(con.lamps.RETRO.a, 'GO');
  assert.equal(con.lamps.RECOVERY.a, 'ALL SHIPS');
  assert.equal(con.lamps.FLIGHT, undefined);
  consolePoll(true);
  runTo(con, () => con.poll === 'final');
  assert.equal(con.lamps.RETRO.a, 'GO');
  assert.ok(lines().some(t => /Retro is go/.test(t)));
});

for (const seat of ['flight', 'retro'])
  test(`A no-go on a clean board from the ${seat} seat holds once, then scrubs: the poll never loops`, () => {
    const con = launchDay(seat);
    con.cond.late = null;
    runTo(con, () => con.poll === 'recovery');
    consolePoll(false);
    assert.equal(con.phase, 'hold');
    runTo(con, () => con.poll === 'recovery');
    consolePoll(false);
    assert.equal(g.console, null);
    assert.equal(g.beat, 'mScrub');
  });
