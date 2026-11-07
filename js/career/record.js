// YOUR RECORD: what you did on each round and how it was received. Only what you could know: the flight as the range
// saw it, the cause you put forward, what Ellis concluded and the fix that came of it. Never the hidden truth.
// Ellis's trust in your judgement is hidden too: you learn it from how she treats your calls.
// Your seat: where you sit now. Offers come at turning points; you are never fired, but a poor record moves you to
// quieter work and slows the next offer, and turning an offer down keeps you where you are.

export const initRecord = () => ({ rounds: [], trust: 0, seat: 'junior', offers: [] });
export const TRUST = { min: -3, max: 3, defer: 2 };
export const SEATS = { junior: 'Junior engineer', 'test-conductor': 'Test conductor', retro: 'Retrofire officer', engineer: 'Project engineer, Mercury', flight: 'Flight director', programme: 'Apollo programme office', director: 'Director, Manned Spacecraft Center' };
// The seat in a sentence: "You are now …".
export const SEAT_PHRASE = { junior: 'a junior engineer', 'test-conductor': 'a test conductor', retro: 'the Retrofire officer in Mercury Control', engineer: 'a project engineer on the Mercury capsules', flight: 'a flight director in Mission Control, Houston', programme: 'in the Apollo programme office', director: 'the director of the Manned Spacecraft Center, Houston' };

export function addRound(record, entry) { record.rounds.push(entry); }
export const shiftTrust = (record, by) => { record.trust = Math.max(TRUST.min, Math.min(TRUST.max, record.trust + by)); };

// Whether your boss will put your name forward: her trust in your calls, and how the last rounds you worked went.
export function standing(record) {
  const recent = record.rounds.slice(-3), good = recent.filter(r => !/^Lost/.test(r.flight)).length;
  // Each fiscal year you ran over your budget line counts against you.
  return record.trust + (good >= 2 ? 1 : 0) - (record.overspent || 0) + simStanding(record);
}
// Training sims count too, once you have run a few: the last three, mostly called right, are worth a point.
export function simStanding(record) {
  const last = (record.sims || []).slice(-3);
  return last.length === 3 && last.reduce((a, s) => a + s.right, 0) >= 0.66 * last.reduce((a, s) => a + s.of, 0) ? 1 : 0;
}
export function addSim(record, sim) { (record.sims = record.sims || []).push(sim); }
export const OFFER_STANDING = 1;

// A turning point: an offer if your standing is good enough, otherwise you are passed over this time. An offer marked
// always is made whatever the standing: it comes at a branch's last round, where not making it would strand the player.
// The entry carries the offer's own words and sender, so a card renders rightly whatever path the player came from.
export function turningPoint(record, offer, day) {
  const made = offer.always || standing(record) >= OFFER_STANDING;
  const entry = { seat: offer.seat, title: offer.title, day, made, answer: null, text: offer.text, from: offer.from,
    takeNote: offer.takeNote, declineNote: offer.declineNote, ...(offer.path ? { path: offer.path } : {}) };
  record.offers.push(entry);
  if (!made) record.sidelined = true;
  return entry;
}
// An offer made and not yet answered holds the next round until you answer it.
export const pendingOffer = record => { const o = record.offers[record.offers.length - 1]; return !!o && o.made && !o.answer; };
export function answerOffer(record, take) {
  const o = record.offers[record.offers.length - 1];
  if (!o || !o.made || o.answer) return null;
  o.answer = take ? 'taken' : 'declined';
  if (take) { record.seat = o.seat; record.sidelined = false; if (o.path) record.path = o.path; }
  return o;
}
