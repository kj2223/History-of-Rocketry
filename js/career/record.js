// YOUR RECORD: what you did on each round and how it was received. Only what you could know: the flight as the range
// saw it, the cause you put forward, what Ellis concluded and the fix that came of it. Never the hidden truth.
// Ellis's trust in your judgement is hidden too: you learn it from how she treats your calls.

export const initRecord = () => ({ rounds: [], trust: 0 });
export const TRUST = { min: -3, max: 3, defer: 2 };

export function addRound(record, entry) { record.rounds.push(entry); }
export const shiftTrust = (record, by) => { record.trust = Math.max(TRUST.min, Math.min(TRUST.max, record.trust + by)); };
