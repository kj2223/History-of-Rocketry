// PRESSURE ON APOLLO (rules/pressure.js): what the press, the public and Congress react to, and how hard. Each pressure runs
// from 0 (calm) to 100. Tune here. The keys are stored in saves.

// The three pressures, each with its own effect, and the words Mail uses for each level (from calm up).
export const PRESSURES = {
  press: { name: 'The press', effect: 'Watching closely, they leak what NASA would rather keep quiet.', words: ['quiet', 'watchful', 'digging', 'hounding NASA'] },
  pub: { name: 'The public', effect: 'The keener they are, the more an American first is worth.', words: ['indifferent', 'interested', 'gripped', 'demanding the Moon'] },
  cong: { name: 'Congress', effect: 'Members want results before they vote more money.', words: ['supportive', 'asking questions', 'impatient', 'threatening the budget'] },
};
// Where each pressure settles with nothing happening, and the share of the gap it closes each month.
export const BASELINE = 20;
export const SETTLE_PER_MONTH = .06;
// WHAT MOVES THEM: { press, pub, cong } added (a minus eases).
export const EVENTS = {
  sovietFirst: { press: 14, pub: 10, cong: 12, headline: 'Another Soviet first. Where is America?' },
  ourFirst: { press: -8, pub: -6, cong: -10, headline: 'An American first. The country cheers.' },
  goodFlight: { press: -2, pub: -2, cong: -3, headline: 'A clean crewed flight.' },
  failedFlight: { press: 8, pub: 6, cong: 5, headline: 'A crewed flight goes wrong.' },
  crewLost: { press: 30, pub: 25, cong: 20, headline: 'Astronauts lost. The nation mourns, and asks why.' },
  scrub: { press: 2, pub: 0, cong: 1, headline: 'Another scrub at the Cape.' },
  overBar: { press: 3, pub: 0, cong: 0, headline: '' },
};
// SCHEDULE: once the architecture is chosen, every month past the study's estimate for the first landing attempt adds this to
// Congress (and half to the press).
export const SLIP_PER_MONTH = 2;
// THE EFFECTS. Congress's and the press's start at EFFECT_FROM and are full at 100:
// Congress trims the share of the budget request it grants by up to CONGRESS_TRIM;
// the press leaks a crewed launch ordered past the safety bar, costing LEAK_REPUTATION at full pressure;
// the public's interest scales reputation won from a first from PUBLIC_RANGE[0] times (no interest) to PUBLIC_RANGE[1] (full).
export const EFFECT_FROM = 50;
export const CONGRESS_TRIM = .15;
export const LEAK_REPUTATION = 6;
export const PUBLIC_RANGE = [.75, 1.5];
// How many headlines Mail keeps.
export const HEADLINES = 8;
