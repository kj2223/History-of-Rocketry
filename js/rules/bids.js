// BIDS: several parties propose, each proposal is shaded by what its bidder stands to gain, a track record shows how far to trust
// it, and whoever you turn down remembers. Built for the Apollo centres (rules/apollo.js) and meant for later supplier choices:
// a bidder is any record with { opt, coop, mood }. Tune AWARD and the recovery here. No DOM.
//
// bidder: { opt: hidden optimism (0 to 1), coop: cooperation (COOP_RANGE), mood: 'keen'|'accepted'|'resentful', cons: 1 once
//           given a consolation }
import { S } from '../core/state.js';

// What an award does to cooperation: the winner gains WIN; a loser overruled with the evidence on your side loses LOSE_SUPPORTED,
// against it LOSE_UNSUPPORTED. A consolation restores CONSOLATION. Cooperation drifts back toward 1 by RECOVERY_PER_MONTH of the
// gap each month, half as fast for a resentful bidder.
export const AWARD = { WIN: .05, LOSE_SUPPORTED: .1, LOSE_UNSUPPORTED: .3, CONSOLATION: .2 };
export const COOP_RANGE = [.5, 1.1];
export const RECOVERY_PER_MONTH = .04;

export const newBidder = opt => ({ opt, coop: 1, mood: 'keen', cons: 0 });
const clampCoop = value => Math.max(COOP_RANGE[0], Math.min(COOP_RANGE[1], value));

// A bidder's claim for a figure where lower is better (cost, time, risk): the truth cut by its optimism times its stake.
export const claim = (truth, bidder, stake) => truth * (1 - bidder.opt * stake);
// Its track record as shown: how far its past estimates fell short, to within noise (a fixed offset per bidder, not a new roll).
export const recordShown = (bidder, stake, noise) => Math.max(0, bidder.opt * stake + (bidder.recNoise || 0) * noise);

// Award: winners gain, losers lose more when the evidence did not back the award. bidders: { key: { bidder, wins } }.
export function award(bidders, supported) {
  for (const { bidder, wins } of Object.values(bidders)) {
    if (wins) {
      bidder.coop = clampCoop(bidder.coop + AWARD.WIN);
      bidder.mood = 'keen';
    } else {
      bidder.coop = clampCoop(bidder.coop - (supported ? AWARD.LOSE_SUPPORTED : AWARD.LOSE_UNSUPPORTED));
      bidder.mood = supported ? 'accepted' : 'resentful';
    }
  }
}
// A consolation (a visible share of the work) for a bidder you turned down. Returns an error text, or null.
export function consolation(bidder, cost) {
  if (bidder.cons) return 'You have already given them a share of the work.';
  if (bidder.mood == 'keen') return 'They won; they need no consolation.';
  if (S.b < cost) return 'Not enough money.';
  S.b -= cost;
  bidder.cons = 1;
  bidder.coop = clampCoop(bidder.coop + AWARD.CONSOLATION);
  bidder.mood = 'accepted';
  return null;
}
// Each month's drift back toward full cooperation.
export function recover(bidder, days) {
  const rate = RECOVERY_PER_MONTH * (bidder.mood == 'resentful' ? .5 : 1) * days / 30;
  bidder.coop = clampCoop(bidder.coop + (1 - bidder.coop) * Math.min(1, rate));
}
