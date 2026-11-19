// WHAT PEOPLE REMEMBER: the people you work with keep what you did that mattered to them. The flight director who
// overruled you and was proved wrong, the engineer who flagged a seal you signed off, the crew you lost. A memory belongs
// to the person, not the desk: when someone retires or is posted away (data/cast.js), what they remembered goes with them.
// Each memory is said once, at the start of a later mission, and some change how far that person trusts your judgement.

// seat: the desk (g.people id). trust: a change to your boss's trust when it is said (only the boss's memories carry one).
export function remember(record, people, seat, text, { tone = '', trust = 0 } = {}, day = 0) {
  const p = people[seat];
  if (!p) return;
  (record.memory = record.memory || []).push({ seat, name: p.name, day, text, tone, trust, said: false });
}

// The next memory still to be said, by someone still at their desk. Marks it said. Returns it, or null.
export function recall(record, people) {
  for (const m of record.memory || []) {
    if (m.said) continue;
    if (people[m.seat]?.name !== m.name) {
      m.said = true; // they have gone, and the memory with them
      continue;
    }
    m.said = true;
    return m;
  }
  return null;
}

// What someone at a desk remembers of you, oldest first (said or not), for as long as they hold it.
export const memoriesOf = (record, people, seat) =>
  (record.memory || []).filter(m => m.seat === seat && people[seat]?.name === m.name);
