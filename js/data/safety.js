// THE SAFETY BAR (rules/safety.js): what the engineers estimate for each part of a crew rocket, and the bar you set for crewed
// launches once Apollo has chosen its architecture. Tune the components, the estimates and the ground tests here. The keys are
// stored in saves.

// COMPONENTS: each stage of a rocket is judged as its engines, its structure and (above the first) its staging. modes: the
// failure modes (data/failures.js) that count against it. limit: the failure chance per launch you allow it at first.
export const COMPONENTS = {
  eng: { name: 'engines', modes: ['c', 'p', 'i', 'v'], limit: .04 },
  str: { name: 'structure', modes: ['s', 'f', 'h'], limit: .03 },
  sep: { name: 'staging', modes: ['x'], limit: .02 },
};
// The chance a crewed launch reaches orbit that you aim for at first, and the range and step of the panel's buttons.
export const TARGET_SAFETY = .9;
export const TARGET_RANGE = [.7, .99];
export const TARGET_STEP = .01;
// A component's limit moves in steps of LIMIT_STEP, between LIMIT_RANGE.
export const LIMIT_STEP = .005;
export const LIMIT_RANGE = [.005, .2];
// The engineers fly each design this many times in simulation to find its true failure chances (a fixed seed, so a design always
// gives the same figures and the game's own dice are left alone).
export const RISK_SAMPLES = 200;
// HOW FAR OFF an estimate is: each component's figure is off from the truth by a factor of e to the power of (a roll of the
// normal curve times ESTIMATE_SPREAD), and each ground test of the revision narrows it: the spread is divided by the square root
// of one plus the tests run. A confident, careless team reads its figures low: the lead's reading is the evidence times
// 1 - OPTIMISM times the team's risk appetite (rules/culture.js).
export const ESTIMATE_SPREAD = .6;
export const OPTIMISM = .3;
// GROUND TESTS: the staff test each new revision of a crew rocket this many times before its figures settle (you set the number,
// from 0 to TESTS_RANGE[1]). One test at a time; each takes TEST_DAYS and costs TEST_COST_SHARE of the rocket's airframe.
export const TESTS_PER_REVISION = 2;
export const TESTS_RANGE = [0, 6];
export const TEST_DAYS = 30;
export const TEST_COST_SHARE = .15;
