// RULE TESTS: small checks on the game rules, run in Node with no page. Run: npm test
// Each test starts from a fresh game (resetState) and a seeded random generator, so results do not depend on test order.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, resetState, withProgramme } from '../js/core/state.js';
import { BY_ID } from '../js/data/research.js';
import { MISSION_TYPES } from '../js/data/mercury.js';
import { grant } from '../js/rules/economy.js';
import { ensureStarter, hire, tickSecond } from '../js/rules/game.js';
import { createProgramme, isMature, startLock } from '../js/rules/programs.js';
import { MATURE, FLIGHTS_TO_MATURE } from '../js/data/programmes.js';
import { makeAirframe } from '../js/rules/production.js';
import { previewFlight, beginFlight, step } from '../js/rules/flight.js';
import { manRatingRecord, recordBoosterFlight, isManRated, startNewFamilyIfRedesigned, CLEAN_FLIGHTS_NEEDED, MAN_RATING_RESEARCH } from '../js/rules/manrate.js';
import { boosterPlan, crewLock, newPhaseTwo, requirementText, MIN_MERCURY_LOAD } from '../js/rules/mercury.js';
import { selectCrew, makePool } from '../js/rules/astronauts.js';
import { autoLaunch } from '../js/rules/auto.js';
import { startCampaign, goAhead, directorMargin, recordCampaignFlight, AEROBEE_FLIGHTS_TO_UNLOCK, DIRECTOR_FULL_SKILL } from '../js/rules/campaign.js';

// The same small generator the balance bot uses.
const seeded = seed => () => {
  seed |= 0;
  seed = seed + 0x6D2B79F5 | 0;
  let mixed = Math.imul(seed ^ seed >>> 15, 1 | seed);
  mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed;
  return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
};
// Mark research done (and confirmed) without running the jobs.
const giveResearch = ids => ids.forEach(id => {
  S.pk[id] = { a: { ...BY_ID[id].effects }, c: 1, m: { ...BY_ID[id].effects }, dud: false };
});
// A ready programme with one airframe built to its blueprint.
const readyProgramme = kind => {
  createProgramme(kind);
  S.progs[kind].ready = 1;
  return withProgramme(kind, () => makeAirframe({ pk: [], fix: {}, rev: S.progs[kind].bp.rev }, 0, kind));
};

beforeEach(() => {
  Math.random = seeded(42);
  resetState();
  ensureStarter();
});

test('a new game starts with the WAC Corporal, one free airframe and $60,000', () => {
  assert.equal(S.cur, 'wac');
  assert.equal(S.air.length, 1);
  assert.equal(S.b, 60000);
});

test('the appropriation rises with each directive met', () => {
  const before = grant();
  S.dir = 2;
  assert.ok(grant() > before);
});

test('man-rating needs three clean flights in a row and the man-rating research', () => {
  const airframe = readyProgramme('redstone');
  S.nasa = 1;
  for (let i = 0; i < CLEAN_FLIGHTS_NEEDED; i++) recordBoosterFlight(airframe, true);
  assert.equal(isManRated(airframe), false, 'no certification without the research');
  giveResearch(MAN_RATING_RESEARCH);
  recordBoosterFlight(airframe, true);
  assert.equal(isManRated(airframe), true);
});

test('a failure restarts the clean-flight count', () => {
  const airframe = readyProgramme('redstone');
  S.nasa = 1;
  giveResearch(MAN_RATING_RESEARCH);
  recordBoosterFlight(airframe, true);
  recordBoosterFlight(airframe, true);
  recordBoosterFlight(airframe, false);
  recordBoosterFlight(airframe, true);
  assert.equal(isManRated(airframe), false);
  assert.equal(manRatingRecord('redstone').streak, 1);
});

test('a booster milestone starts a new family; airframes already certified stay certified', () => {
  const airframe = readyProgramme('redstone');
  S.nasa = 1;
  giveResearch(MAN_RATING_RESEARCH);
  for (let i = 0; i < CLEAN_FLIGHTS_NEEDED; i++) recordBoosterFlight(airframe, true);
  withProgramme('redstone', () => startNewFamilyIfRedesigned(['ms_rel'], airframe.rev + 1));
  assert.equal(isManRated(airframe), true);
  assert.equal(isManRated({ ...airframe, rev: airframe.rev + 1 }), false);
});

test('a Mercury booster plan never counts a booster that is over its heating or aero limits', () => {
  const airframe = readyProgramme('atlas');
  for (const missionType of Object.keys(MISSION_TYPES)) {
    const plan = boosterPlan(airframe, 'Kerosene & LOX', missionType);
    assert.ok(plan.load >= MIN_MERCURY_LOAD && plan.load <= 1);
    if (plan.ok) assert.ok(plan.preview.maxHeat < 1 && plan.preview.maxQ < 1, `${missionType} plan is over its limits`);
  }
});

test('capsules need their research before they can be ordered', () => {
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  assert.match(requirementText('lj'), /Launch escape tower/);
  giveResearch(['esc_tower']);
  assert.equal(requirementText('lj'), null);
});

test('no crew flies before an animal has flown', () => {
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  assert.equal(crewLock('none'), null);
  assert.match(crewLock(1), /animal/);
});

test('selection takes three to seven finalists and refuses the medically disqualified', () => {
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  S.p2.pool = makePool(16);
  S.p2.sel.st = 3;
  S.p2.pool[0].dq = 1;
  assert.equal(selectCrew([1, 2]), false, 'too few');
  assert.equal(selectCrew([1, 2, 3]), false, 'includes a disqualified finalist');
  assert.equal(selectCrew([2, 3, 4]), true);
  assert.equal(S.p2.astros.length, 3);
});

test('a programme matures only with the knowledge and its own successful flights', () => {
  readyProgramme('aerobee');
  for (const area of ['p', 's', 'i', 'a']) S.progs.aerobee.kn[area] = MATURE + 5;
  assert.equal(isMature('aerobee'), false, 'knowledge alone is not enough');
  assert.match(startLock('viking'), /mature/);
  S.progs.aerobee.okf = FLIGHTS_TO_MATURE;
  assert.equal(isMature('aerobee'), true);
});

test('a new programme starts well short of maturity, however well the last rocket is known', () => {
  readyProgramme('aerobee');
  for (const area of ['p', 's', 'i', 'a']) S.progs.aerobee.kn[area] = 100;
  createProgramme('viking');
  for (const area of ['p', 's', 'i', 'a']) assert.ok(S.progs.viking.kn[area] < 35, `${area} starts at ${S.progs.viking.kn[area]}`);
});

test('the launch director can be hired only after three successful Aerobee flights', () => {
  readyProgramme('aerobee');
  S.b = 100000;
  hire('director');
  assert.equal(S.staff.director, 0);
  S.progs.aerobee.okf = AEROBEE_FLIGHTS_TO_UNLOCK;
  hire('director');
  assert.equal(S.staff.director, 1);
});

// A campaign for the Aerobee with money to spare, run second by second until it closes.
const runCampaign = (goal, budget, months) => {
  readyProgramme('aerobee');
  S.cur = 'aerobee';
  S.staff.director = 1;
  assert.equal(startCampaign({ prog: 'aerobee', fuel: 'Alcohol & LOX', pay: 'Inert Ballast', st: 0, kind: 'ok', goal, months, budget }), null);
  for (let second = 0; second < 5000 && S.auto.camp; second++) {
    tickSecond();
    autoLaunch();
    if (S.auto.camp && S.auto.camp.hold) goAhead();
    S.b = Math.max(S.b, 200000);
  }
  return S.auto.last;
};

test('a campaign orders airframes and flies until its target is met', () => {
  const report = runCampaign(2, 400000, 48);
  assert.equal(report.outcome, 'met');
  assert.equal(report.okn, 2);
  assert.ok(report.spent > 0 && report.spent <= report.budget);
  assert.equal(S.auto.xp, report.n, 'the director gains a flight of experience for each flight it ran');
});

test('a campaign closes when its budget cannot cover another airframe or flight', () => {
  const report = runCampaign(50, 20000, 48);
  assert.equal(report.outcome, 'budget');
  assert.ok(report.spent <= 20000);
});

test('a campaign closes at its deadline', () => {
  const report = runCampaign(50, 1e7, 6);
  assert.equal(report.outcome, 'deadline');
});

test('flights you fly yourself count towards the campaign; the director learns only from its own', () => {
  readyProgramme('aerobee');
  S.staff.director = 1;
  startCampaign({ prog: 'aerobee', fuel: 'Alcohol & LOX', pay: 'Inert Ballast', st: 0, kind: 'alt', goal: 25, months: 12, budget: 50000 });
  recordCampaignFlight({ programme: 'aerobee' }, true, 30000, false);
  assert.equal(S.auto.last.outcome, 'met');
  assert.equal(S.auto.xp, 0);
});

test('an experienced director flies closer to the limits', () => {
  const rookie = directorMargin();
  S.auto.xp = DIRECTOR_FULL_SKILL;
  assert.ok(directorMargin() > rookie);
});

test('no two airframes are built alike, but the pre-flight estimate uses the drawings', () => {
  const first = readyProgramme('aerobee'), second = withProgramme('aerobee', () => makeAirframe({ pk: [], fix: {}, rev: 1 }, 0, 'aerobee'));
  assert.notDeepEqual(first.vr, second.vr);
  const estimate = airframe => withProgramme('aerobee', () => previewFlight(airframe, 'Alcohol & LOX', 'Inert Ballast', 0, 1).peakAltitude);
  assert.equal(estimate(first), estimate(second));
  const fly = airframe => {
    S.air.push(airframe);
    const flight = beginFlight(airframe, 'Alcohol & LOX', 'Inert Ballast', 0, 1);
    flight.noFail = true;
    while (step(flight) == 'tick');
    return flight.peakAltitude;
  };
  S.b = 1e6;
  assert.notEqual(fly(first), fly(second));
});
