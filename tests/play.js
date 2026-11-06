// Shared by the tests: play the current round end to end, as a careful but quiet player would.
import assert from 'node:assert/strict';
import { g, tick, finishInspection, finishBoard, endDay, standStart, standDecide, countStart, countAnswer, rideOut, returnFromRecovery, present, closeAway } from '../js/game.js';

const until = (done, limit = 40000) => { for (let i = 0; i < limit && !done(); i++) { g.speed = 16; tick(0.05); } assert.ok(done(), `stuck at beat ${g.beat}`); };
const nextDay = () => { endDay(); until(() => !g.fading); closeAway(); };

// Play the current round end to end the way a careful but quiet player would, and give `call` at the review.
// call(g) returns the explanation key, so a test can answer from what the player saw.
export function playRound(call = () => 'unknown') {
  closeAway();
  finishInspection({}); finishBoard(); nextDay();
  until(() => g.beat === 'static');
  standStart(); until(() => g.stand.phase === 'read');
  standDecide({ rework: false, leak: false }); nextDay();
  until(() => g.beat === 'countReady');
  countStart();
  until(() => g.beat === 'recovery' || (g.count && g.count.poll));
  while (g.count && g.count.poll) { countAnswer(true); until(() => g.beat === 'recovery' || (g.count && g.count.poll)); }
  rideOut(); until(() => g.room === 'recovery');
  returnFromRecovery();
  present(call(g));
}

