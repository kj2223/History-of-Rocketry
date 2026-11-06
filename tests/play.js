// Shared by the tests: play the current round end to end, as a careful but quiet player would.
import assert from 'node:assert/strict';
import { g, tick, finishInspection, finishBoard, endDay, standStart, standDecide, countStart, countAnswer, rideOut, returnFromRecovery, present, closeAway,
  conducting, finishPlan, chair, nextRound, answerFirstOffer } from '../js/game.js';
import { pendingOffer } from '../js/career/record.js';

export const until = (done, limit = 40000) => { for (let i = 0; i < limit && !done(); i++) { g.speed = 16; tick(0.05); } assert.ok(done(), `stuck at beat ${g.beat}`); };
export const nextDay = () => { endDay(); until(() => !g.fading); closeAway(); };

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


// ---- Mercury rounds, worked from the Retrofire officer's console ----
import { consoleStart, consolePoll, consoleAbort, consoleAim, padChoose, missionPresent, simStart, simClose, toReview, consoleInsertion, consolePack, consoleRetro } from '../js/mercury.js';
import { SEASON } from '../js/data/campaign.js';

// Play rounds, taking every offer and making sure it is made, until the round with this id.
export function toRoundId(id, call = () => 'nominal') {
  while (SEASON[g.roundIndex].id !== id) {
    playRound(call);
    const o = g.record.offers[g.record.offers.length - 1];
    if (o && !o.made && o.day >= g.record.rounds[g.record.rounds.length - 1].day) { o.made = true; o.answer = null; }
    advance(true);
  }
  closeAway();
}

// One console decision point at a time: a poll, the climb (abort or not), the impact points, the pad.
const waiting = () => g.beat !== 'mFlight' || (g.console && g.console.auto ? ['pack', 'retro'].includes(g.console.phase) : g.console && (g.console.poll || g.console.phase === 'poll' || g.console.phase === 'ip' || ['pad', 'ascent', 'insertion', 'pack', 'retro'].includes(g.console.phase)));
function work(c, opts) {
  if (c.poll || c.phase === 'poll') return consolePoll(opts.poll(c));
  if (c.phase === 'ip') return consoleAim(opts.aim(c));
  if (c.phase === 'pad') return padChoose(opts.pad);
  if (c.phase === 'insertion') return consoleInsertion(opts.insert(c));
  if (c.phase === 'pack') return consolePack(opts.packCall(c));
  if (c.phase === 'retro') return consoleRetro(opts.retro(c));
  if (c.phase === 'ascent') {
    if (c.abortAt == null && opts.abort(c)) return consoleAbort();
    for (let i = 0; i < 1000 && g.console && g.console.phase === 'ascent' && !(c.abortAt == null && opts.abort(c)); i++) { g.speed = 4; tick(0.05); }
  }
}
export const MERCURY_DEFAULTS = {
  poll: c => c.cond.seaState <= 4 && !c.cond.late,
  abort: c => c.trace.length > 0 && Math.abs(c.trace[c.trace.length - 1].off) > 6.5,
  aim: c => (c.orbital ? 'radar' : c.ip.intermittent ? 'telemetry' : 'radar'),
  insert: c => c.goddard.go,
  packCall: () => 'keep',
  retro: c => (c.status.window && /off|odd/.test(c.status.window) ? 'manual' : 'auto'),
  pad: 'wait',
  call: () => 'unknown',
  sims: 0,
};
// A training sim, played with the same calls.
export function runSim(opts = {}) {
  const o = { ...MERCURY_DEFAULTS, ...opts };
  simStart();
  for (let n = 0; n < 50 && g.console && g.console.kind === 'sim' && g.console.phase !== 'debrief'; n++) {
    const c = g.console;
    if (c.poll || ['poll', 'ip', 'pad', 'ascent', 'insertion', 'pack', 'retro'].includes(c.phase)) work(c, o);
    else for (let i = 0; i < 400 && g.console && !(g.console.poll || ['poll', 'ip', 'pad', 'ascent', 'insertion', 'pack', 'retro', 'debrief'].includes(g.console.phase)); i++) { g.speed = 4; tick(0.05); }
  }
  const d = g.console.debrief;
  simClose();
  return d;
}
// A Mercury round end to end: sims on the first day, then the launch day's count, the flight, recovery and the review.
export function playMission(opts = {}) {
  const o = { ...MERCURY_DEFAULTS, ...opts };
  closeAway();
  for (let n = 0; n < o.sims; n++) runSim(o);
  nextDay();
  for (let tries = 0; tries < 6 && ['mLaunch', 'mScrub'].includes(g.beat); tries++) {
    if (g.beat === 'mScrub') { nextDay(); continue; }
    consoleStart();
    for (let n = 0; n < 60 && g.beat === 'mFlight'; n++) { until(waiting); if (g.console && g.beat === 'mFlight') work(g.console, o); }
    if (g.beat === 'mPadNight') nextDay();
  }
  if (g.beat === 'mRecovery') toReview();
  assert.equal(g.beat, 'mReview');
  missionPresent(o.call(g));
}
