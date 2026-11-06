// YOUR RECORD: what you did on each round and how it was received. Only what you could know: the flight as the range
// saw it, the cause you put forward, what Ellis concluded and the fix that came of it. Never the hidden truth.
// Ellis's trust in your judgement is hidden too: you learn it from how she treats your calls.
// Your seat: where you sit now. Offers come at turning points; you are never fired, but a poor record moves you to
// quieter work and slows the next offer, and turning an offer down keeps you where you are.

export const initRecord = () => ({ rounds: [], trust: 0, seat: 'junior', offers: [] });
export const TRUST = { min: -3, max: 3, defer: 2 };
export const SEATS = { junior: 'Junior engineer', 'test-conductor': 'Test conductor' };

export function addRound(record, entry) { record.rounds.push(entry); }
export const shiftTrust = (record, by) => { record.trust = Math.max(TRUST.min, Math.min(TRUST.max, record.trust + by)); };

// Whether your boss will put your name forward: her trust in your calls, and how the last rounds you worked went.
export function standing(record) {
  const recent = record.rounds.slice(-3), good = recent.filter(r => !/^Lost/.test(r.flight)).length;
  return record.trust + (good >= 2 ? 1 : 0);
}
export const OFFER_STANDING = 1;

// A turning point: an offer if your standing is good enough, otherwise you are passed over this time.
export function turningPoint(record, offer, day) {
  const made = standing(record) >= OFFER_STANDING;
  const entry = { seat: offer.seat, title: offer.title, day, made, answer: null };
  record.offers.push(entry);
  if (!made) record.sidelined = true;
  return entry;
}
export function answerOffer(record, take) {
  const o = record.offers[record.offers.length - 1];
  if (!o || !o.made || o.answer) return null;
  o.answer = take ? 'taken' : 'declined';
  if (take) { record.seat = o.seat; record.sidelined = false; }
  return o;
}
