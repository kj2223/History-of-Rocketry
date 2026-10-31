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

// LEAD REQUESTS (rules/requests.js): once any pressure passes REQUEST_FROM, Ellis's team may pass it on as a request, at most one
// open at a time and no sooner than REQUEST_GAP days after the last. The monthly chance is REQUEST_CHANCE times the strongest
// pressure (as a share of 100), times one plus the team's lean (rules/culture.js: a chaotic team asks more, a careful one less).
export const REQUEST_FROM = 50;
export const REQUEST_GAP = 90;
export const REQUEST_CHANCE = .35;
// What each answer does to the pressures ({ press, pub, cong } added), and to reputation:
//   accept: the pressure eases, the risk goes on the record;
//   reasoned: a refusal with the evidence on file (offered only when the tests support it) costs little;
//   refuse: a refusal with no reason given costs more;
//   prove: "prove it with a test first" costs nothing now: a test runs and the request comes back with its result.
export const ANSWERS = {
  accept: { press: -2, pub: 0, cong: -5, rep: 0 },
  reasoned: { press: 1, pub: 0, cong: 2, rep: 0 },
  refuse: { press: 3, pub: 0, cong: 6, rep: 1 },
};
// SHIELDING THE CREW: what you can do yourself to take the heat off, each with its price and the days before you can do it again.
//   briefing: the press and public ease, but a crewed flight that fails within VOUCH_DAYS costs VOUCH_REPUTATION more;
//   standDown: the crews stand down for STAND_DOWN_DAYS (no crewed launches), and the public and press ease;
//   testify: you go before Congress (data/hearing.js): the hearing sits in about two weeks and its outcome reads your record.
export const SHIELDS = {
  briefing: { name: 'Hold a press briefing', press: -15, pub: -6, cong: 0, cooldown: 120 },
  standDown: { name: 'Stand the crews down for a month', press: -8, pub: -10, cong: 0, cooldown: 180 },
  testify: { name: 'Testify before Congress', press: 0, pub: 0, cong: 0, cooldown: 360 },
};
export const VOUCH_DAYS = 90, VOUCH_REPUTATION = 4;
export const STAND_DOWN_DAYS = 30;
