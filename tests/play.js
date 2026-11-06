// Shared by the tests: play the current round end to end, as a careful but quiet player would.
import assert from 'node:assert/strict';
import { g, tick, finishInspection, finishBoard, endDay, standStart, standDecide, countStart, countAnswer, rideOut, returnFromRecovery, present, closeAway,
  conducting, finishPlan, chair, nextRound, answerFirstOffer } from '../js/game.js';
import { pendingOffer } from '../js/career/record.js';

export const until = (done, limit = 40000) => { for (let i = 0; i < limit && !done(); i++) { g.speed = 16; tick(0.05); } assert.ok(done(), `stuck at beat ${g.beat}`); };
const nextDay = () => { endDay(); until(() => !g.fading); closeAway(); };

// Play the current round end to end the way a careful but quiet player would, and give `call` at the review.
// call(g) returns the explanation key, so a test can answer from what the player saw.
// plan: the test conductor's plan, on rounds you conduct.
// stopAt: 'staticPrep' stops on the morning of the static fire, 'poll' at the count's first poll.
export function playRound(call = () => 'unknown', plan = { inspector: 'you', burn: 'short', leak: false }, stopAt = null) {
  closeAway();
  if (conducting()) { finishPlan(plan); if (g.plan.inspector !== 'you') until(() => g.beat === 'board'); }
  if (g.beat === 'brief') finishInspection({});
  finishBoard(); nextDay();
  if (stopAt === 'staticPrep') return;
  until(() => g.beat === 'static');
  standStart(); until(() => g.stand.phase === 'read');
  standDecide({ rework: false, leak: false }); nextDay();
  until(() => g.beat === 'countReady');
  countStart();
  until(() => g.beat === 'recovery' || (g.count && g.count.poll));
  if (stopAt === 'poll') return;
  while (g.count && g.count.poll) { countAnswer(true); until(() => g.beat === 'recovery' || (g.count && g.count.poll)); }
  rideOut(); until(() => g.room === 'recovery');
  returnFromRecovery();
  if (conducting()) chair(call(g)); else present(call(g));
}

// On to the next round, answering any offer first (take: whether to take it).
export function advance(take = false) {
  if (pendingOffer(g.record)) answerFirstOffer(take);
  nextRound();
}

