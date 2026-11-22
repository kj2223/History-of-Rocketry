// THE RANGE SLOT (Aaron, 22 November 2026: "price every check"). Each early round has a slot on the range and a few
// hours of crew time before it. Everything you ask for before rollout, a close look, the test kit, a flag the crew opens
// up, a leak check, comes out of those hours. Run past them and the range gives the slot away: the round waits a day for
// each working day you ran over, and a round that flies late goes on your record. So looking costs something, and the
// question every round asks is which checks are worth the time.
// A round that was lost leaves the next one short: the crew spent the hours building its replacement.
// No DOM, no drawing. Visible to the player: they always see the hours left.

// Crew hours before the slot, by kind of round. A WAC round's six spots cannot all be looked at, metered and opened up.
export const SLOT_HOURS = {
  wac: 6,
  v2: 7,
  bumper: 8,
  aerobee: 7,
  viking: 8,
  vanguard: 9,
  juno: 9,
  ranger: 9,
};
// Hours the next round loses after a round is lost, and the fewest a slot can be left with.
export const REBUILD_HOURS = 2,
  MIN_HOURS = 3;
// Crew hours in a working day: running over by any part of one costs the day.
export const DAY_HOURS = 8;

export function newSlot(vehicle, short = 0) {
  const full = SLOT_HOURS[vehicle];
  if (!full) return null;
  return { budget: Math.max(MIN_HOURS, full - short), short: Math.min(short, full - MIN_HOURS), spent: 0, items: [] };
}
export function spendHours(slot, hours, what) {
  if (!slot || !(hours > 0)) return;
  slot.spent = Math.round((slot.spent + hours) * 100) / 100;
  slot.items.push({ what, hours });
}
export const hoursLeft = slot => (slot ? Math.max(0, Math.round((slot.budget - slot.spent) * 100) / 100) : Infinity);
export const overrun = slot => (slot ? Math.max(0, slot.spent - slot.budget) : 0);
// Whole days the round waits for running past its hours.
export const daysOver = slot => Math.max(0, Math.ceil(overrun(slot) / DAY_HOURS - 1e-9));

// Hours as people say them: "45 min", "2 h", "1 h 30 min".
export function hoursText(h) {
  const m = Math.round(h * 60);
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`;
}

// Late rounds count against you when your name could go forward: two of your last three flown late costs a point.
export const LATE_ROUNDS = 2;
export const lateMark = rounds => (rounds.slice(-3).filter(r => r.late).length >= LATE_ROUNDS ? 1 : 0);
