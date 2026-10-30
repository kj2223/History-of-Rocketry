// RULE TESTS: small checks on the game rules, run in Node with no page. Run: npm test
// Each test starts from a fresh game (resetState) and a seeded random generator, so results do not depend on test order.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, resetState, withProgramme } from '../js/core/state.js';
import { BY_ID, isMilestone } from '../js/data/research.js';
import { commission, crashProgramme, crashLock, crashCost, itemAsSeen, itemsInArea } from '../js/rules/research.js';
import { queueResearch, queueLock, queuePosition, unqueue, moveUpQueue, queueAnalysis, analysisPosition, queueFix, fixPosition, queueReview, reviewPosition, RESEARCH_QUEUE_LENGTH } from '../js/rules/queue.js';
import { MISSION_TYPES } from '../js/data/mercury.js';
import { FAILURE_MODES } from '../js/data/failures.js';
import { grant } from '../js/rules/economy.js';
import { ensureStarter, hire, tickSecond, catchUp } from '../js/rules/game.js';
import { createProgramme, isMature, startLock, startProgramme, candidates, programmePackages } from '../js/rules/programs.js';
import { MATURE, FLIGHTS_TO_MATURE } from '../js/data/programmes.js';
import { makeAirframe, retrofitQuote } from '../js/rules/production.js';
import { publishBlueprint } from '../js/rules/factory.js';
import { previewFlight, beginFlight, step, hasEvent } from '../js/rules/flight.js';
import { designSpec } from '../js/rules/design.js';
import { manRatingRecord, recordBoosterFlight, isManRated, startNewFamilyIfRedesigned, CLEAN_FLIGHTS_NEEDED, MAN_RATING_RESEARCH } from '../js/rules/manrate.js';
import { boosterPlan, crewLock, newPhaseTwo, requirementText, MIN_MERCURY_LOAD } from '../js/rules/mercury.js';
import { selectCrew, makePool } from '../js/rules/astronauts.js';
import { autoLaunch } from '../js/rules/auto.js';
import { filedModes, systemOf } from '../js/rules/knowledge.js';
import { startInvestigation, acceptFinding, nameCause, extendInvestigation } from '../js/rules/jobs.js';
import { startCampaign, goAhead, directorMargin, recordCampaignFlight, provenProgramme, AEROBEE_FLIGHTS_TO_UNLOCK, DIRECTOR_FULL_SKILL, FLIGHTS_TO_PROVE } from '../js/rules/campaign.js';
import { runPoll } from '../js/rules/launch-site.js';

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

// A programme marked mature without flying it.
const matureProgramme = kind => {
  readyProgramme(kind);
  S.progs[kind].matured = 1;
};

test('Vanguard straight from Viking skips Redstone: Redstone closes and Vanguard pays for it', () => {
  matureProgramme('viking');
  for (const area of ['p', 's', 'i', 'a']) S.progs.viking.kn[area] = 100;
  S.b = 1000000;
  assert.deepEqual(candidates().filter(kind => kind != 'aerobee'), ['redstone', 'vanguard']);
  assert.equal(startProgramme('vanguard'), true);
  assert.equal(S.progs.vanguard.skip, 1);
  assert.match(startLock('redstone'), /Closed/);
  assert.ok(!candidates().includes('redstone'));
  assert.equal(S.jobs.find(job => job.k == 'dev').tot, 96, 'a longer design phase');
  assert.equal(S.progs.vanguard.traits.length, 4, 'one more hidden flaw');
  for (const area of ['p', 's', 'i', 'a']) {
    assert.ok(S.progs.vanguard.kn[area] <= 10, `${area} starts at ${S.progs.vanguard.kn[area]}`);
    const redstoneWork = programmePackages('redstone', area).map(item => item.id), vanguardWork = programmePackages('vanguard', area).map(item => item.id);
    assert.ok(redstoneWork.every(id => vanguardWork.includes(id)), 'Redstone research is folded into Vanguard');
  }
});

test('after Redstone, Vanguard and Jupiter-C are a choice: starting one closes the other', () => {
  matureProgramme('viking');
  matureProgramme('redstone');
  S.b = 1000000;
  assert.deepEqual(candidates().filter(kind => kind != 'aerobee'), ['vanguard', 'jupc']);
  assert.equal(startProgramme('vanguard'), true);
  assert.equal(S.progs.vanguard.skip, undefined, 'no shortcut penalty on the full route');
  assert.equal(S.jobs.find(job => job.k == 'dev').tot, 60);
  assert.match(startLock('jupc'), /Closed/);
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

test('a new campaign stays on the proven rocket until the new one has three successful flights', () => {
  readyProgramme('aerobee');
  readyProgramme('viking');
  S.progs.aerobee.okf = FLIGHTS_TO_PROVE;
  S.progs.viking.okf = FLIGHTS_TO_PROVE - 1;
  assert.equal(provenProgramme(), 'aerobee');
  S.progs.viking.okf = FLIGHTS_TO_PROVE;
  assert.equal(provenProgramme(), 'viking');
});

test('unconfirmed Phase Two (capsule) packages do not make the booster less reliable', () => {
  S.b = 1e7;
  const phaseTwo = ['cap_shape', 'cap_ecs', 'cmd', 'mr_mods'];
  phaseTwo.forEach(id => S.pk[id] = { a: { ...BY_ID[id].effects }, c: 0, m: {}, dud: false });
  const first = readyProgramme('aerobee');
  const fly = pk => {
    const airframe = { ...first, pk };
    S.air.push(airframe);
    Math.random = seeded(7);
    const faults = [...Array(400)].filter(() => withProgramme('aerobee', () => runPoll(airframe, 'Alcohol & LOX', 0)).fault).length;
    return { reliability: withProgramme('aerobee', () => beginFlight(airframe, 'Alcohol & LOX', 'Inert Ballast', 0, 1)).reliability, faults };
  };
  assert.deepEqual(fly(phaseTwo), fly([]));
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

test('the engine builds up, pushes harder as the air thins, and tails off leaving a little propellant unburned', () => {
  const airframe = readyProgramme('viking');
  S.b = 1e6;
  const flight = withProgramme('viking', () => beginFlight(airframe, 'Alcohol & LOX', 'Inert Ballast', 0, 1));
  flight.noFail = true;
  step(flight);
  assert.ok(flight.chamberShare < 1, 'still building up in the first second');
  let peakShare = 0;
  while (!hasEvent(flight, 'cutoff')) {
    step(flight);
    peakShare = Math.max(peakShare, flight.thrustShare);
  }
  assert.ok(peakShare > 1.05, 'thrust above its sea-level rating high up');
  assert.equal(flight.stages[0].fuel, 0);
  assert.ok(flight.stages[0].dry > withProgramme('viking', () => designSpec(airframe.pk).dry), 'the unburned residual rides as dead weight');
  assert.deepEqual(flight.events.slice(0, 2).map(event => event.key), ['liftoff', 'mach1']);
});

test('staging: the booster separates a second after cutoff and the upper stage lights after a short coast', () => {
  const airframe = readyProgramme('jupc');
  S.b = 1e6;
  const flight = withProgramme('jupc', () => beginFlight(airframe, 'Alcohol & LOX', 'Inert Ballast', 1, 1));
  flight.noFail = true;
  while (step(flight) != 'sep');
  assert.equal(flight.time, flight.cutoffs[0] + 1);
  assert.ok(hasEvent(flight, 'boco') && !hasEvent(flight, 'ign2'));
  step(flight);
  step(flight);
  assert.ok(hasEvent(flight, 'ign2'));
});

test('an unguided rocket flies a gravity turn: only the rail steers it, not the pitch program', () => {
  const airframe = readyProgramme('aerobee');
  const predict = plan => withProgramme('aerobee', () => previewFlight(airframe, 'Alcohol & LOX', 'Inert Ballast', 0, 1, 0, plan));
  assert.equal(predict({ elevation: 85, program: 'lofted' }).peakAltitude, predict({ elevation: 85, program: 'flat' }).peakAltitude);
});

test('a flight plan steers the trajectory: no plan flies the default, a vertical rail stays over the range, a low rail goes long', () => {
  const airframe = readyProgramme('aerobee');
  const predict = plan => withProgramme('aerobee', () => previewFlight(airframe, 'Alcohol & LOX', 'Inert Ballast', 0, 1, 0, plan));
  const standard = predict(null), vertical = predict({ elevation: 90, program: 'lofted' }), long = predict({ elevation: 75, program: 'flat' });
  assert.equal(standard.path.altitude.length, standard.path.downrange.length);
  assert.ok(vertical.downrange < 1000 && vertical.peakAltitude > standard.peakAltitude);
  assert.ok(long.downrange > standard.downrange && long.peakAltitude < standard.peakAltitude);
  assert.ok(long.maxHeat > vertical.maxHeat, 'a flat climb spends longer fast in the thick air');
});

test('a staged plan can aim the upper stage higher than the guidance does, never flatter', () => {
  const airframe = readyProgramme('vanguard');
  const predict = plan => withProgramme('vanguard', () => previewFlight(airframe, 'Kerosene & LOX', 'Inert Ballast', 1, 1, 0, plan));
  const guided = predict(null), flattest = guided.flattestAim;
  assert.ok(flattest >= 0, 'a staged rocket has an upper stage to aim');
  const steep = predict({ elevation: 81, program: 'standard', aim: 30 }), flatter = predict({ elevation: 81, program: 'standard', aim: flattest - 10 });
  assert.ok(steep.peakAltitude > guided.peakAltitude, 'aiming the upper stage up climbs higher');
  assert.equal(flatter.peakHorizontalSpeed, predict({ elevation: 81, program: 'standard' }).peakHorizontalSpeed, 'aimed flatter than the guidance holds, the upper stage flies the guidance\'s own aim');
  assert.equal(withProgramme('aerobee', () => previewFlight(readyProgramme('aerobee'), 'Alcohol & LOX', 'Inert Ballast', 0, 1)).flattestAim, null);
});

test('trajectory analysts need the range computer and FIDO; their search finds the best plan the engineers can see', async () => {
  const { analystLock, hireAnalyst, analysts, newSearch, workSearch, scorePlan, candidatePlans, SAFE_LOAD } = await import('../js/rules/trajectory.js');
  const { TRAJECTORY_ANALYSTS } = await import('../js/data/launch-site.js');
  const airframe = readyProgramme('aerobee');
  S.b = 1e6;
  assert.ok(analystLock(), 'no range computer yet');
  S.fac.comp = 1;
  assert.ok(analystLock(), 'no FIDO on console');
  S.crew.fido = 1;
  hireAnalyst();
  assert.equal(analysts(), 1);
  const predict = plan => withProgramme('aerobee', () => previewFlight(airframe, 'Alcohol & LOX', 'Inert Ballast', 0, 1, 0, plan));
  const search = newSearch('test', null);
  assert.equal(search.total, candidatePlans(null).length);
  workSearch(search, 2 / TRAJECTORY_ANALYSTS.runsPerDay, 'height', predict);
  assert.equal(search.worked, 2, 'one analyst works runsPerDay candidates a day');
  workSearch(search, 1e4, 'height', predict);
  assert.equal(search.untried.length, 0);
  const everyScore = candidatePlans(null).map(plan => scorePlan(predict(plan), 'height'));
  assert.equal(search.best.score, Math.max(...everyScore), 'with every candidate worked, the team has the true best');
  assert.ok(search.best.preview.maxQ <= SAFE_LOAD && search.best.preview.maxHeat <= SAFE_LOAD);
  assert.ok(search.best.preview.peakAltitude >= predict(null).peakAltitude, 'the best for height beats the default');
  S.crew.fido = 0;
  const idle = newSearch('idle', null);
  workSearch(idle, 1e4, 'height', predict);
  assert.equal(idle.worked, 0, 'without FIDO the analysts do not work');
});

test('a payload is recovered step by step, and a stronger chute or a ballute fixes a chute that opens too fast', async () => {
  const { recoveryPlan } = await import('../js/rules/recovery.js');
  readyProgramme('aerobee');
  giveResearch(['chute', 'ribbon']);
  const flight = pk => ({ airframe: { pk }, spec: { rv: 700, rc: .35 }, peakAltitude: 40000, peakHorizontalSpeed: 200, downrange: 30000 });
  assert.equal(recoveryPlan(flight([])).system, false, 'no parachute, nothing to recover');
  const plain = recoveryPlan(flight(['chute'])), ribbon = recoveryPlan(flight(['chute', 'ribbon'])), ballute = recoveryPlan(flight(['chute', 'ball']));
  assert.ok(plain.chuteLoad > .75, 'a plain chute opening at terminal speed is near its limit');
  assert.ok(ribbon.chuteSurvival > plain.chuteSurvival && ballute.chuteSurvival > plain.chuteSurvival);
  const higher = recoveryPlan({ ...flight(['chute']), peakAltitude: 90000 });
  assert.ok(higher.heat > plain.heat && higher.heatSurvival < 1, 'a higher flight comes back hotter');
});

test('search odds improve with every payload recovered', async () => {
  const { recoveryPlan } = await import('../js/rules/recovery.js');
  const flight = { airframe: { pk: ['chute'] }, spec: { rv: 700, rc: .35 }, peakAltitude: 30000, peakHorizontalSpeed: 100, downrange: 20000 };
  const before = recoveryPlan(flight).search;
  S.recn = 5;
  assert.ok(recoveryPlan(flight).search > before);
});

test('part channels need the FM telemetry transmitter, and each multiplexing package carries one more', async () => {
  const { channelCapacity, watchedChannels } = await import('../js/rules/telemetry.js');
  assert.equal(channelCapacity({ pk: ['str', 'xdc'] }), 0, 'no transmitter, no part channels');
  assert.deepEqual(watchedChannels({ pk: ['str', 'xdc'] }, ['q', 'pc']), []);
  assert.deepEqual(watchedChannels({ pk: ['fm', 'str', 'xdc'] }, ['q', 'pc']), ['q'], 'one channel on the bare transmitter');
  assert.deepEqual(watchedChannels({ pk: ['fm', 'mux', 'str', 'xdc'] }, ['q', 'pc', 'g']), ['q', 'pc'], 'no accelerometer aboard, so no payload g');
});

test('a station calls the flight only when it is staffed or covered, and only the parts it is watching', async () => {
  const { crewCallouts } = await import('../js/rules/callouts.js');
  const { logSink } = await import('../js/core/state.js');
  const heard = [];
  logSink.fn = text => heard.push(text);
  const flight = (watch) => ({ time: 20, watch, stageIndex: 0, stages: [{ fuel: 50, thrust: 20000, isp: 200, flow: 10, residual: 0, litAt: 0 }], burnTime: 40, verticalSpeed: 500, altitude: 8000, downrange: 0, horizontalSpeed: 0, aeroLoad: .7, thrustShare: 1, payload: 'Inert Ballast' });
  crewCallouts(flight([]));
  assert.ok(heard.some(line => line.includes('[PROP] Ellis: Ten seconds to cutoff.')), 'Ellis covers the empty PROP console and speaks by name');
  assert.ok(!heard.some(line => line.includes('[BSTR]')), 'no one covers BSTR');
  heard.length = 0;
  S.crew.prop = 1;
  S.crew.bstr = 1;
  crewCallouts(flight([]));
  assert.ok(heard.some(line => line.includes('[PROP] Ten seconds to cutoff.')), 'the hired engineer takes the console');
  assert.ok(!heard.some(line => line.includes('[BSTR]')), 'the aero load is not being watched');
  crewCallouts(flight(['q']));
  assert.ok(heard.some(line => line.includes('[BSTR] Max Q.')));
  S.crew.rec = 1;
  crewCallouts(flight([]));
  assert.ok(!heard.some(line => line.includes('[REC]')), 'nothing aboard to recover');
  crewCallouts({ ...flight([]), payload: 'Sensor Suite' });
  assert.ok(heard.some(line => line.includes('[REC] Recovery force standing by')), 'the recovery force needs no channel');
  logSink.fn = null;
});

test('on a planned flight FIDO and RSO call the track against the plan, and REC waits on station at the planned impact', async () => {
  const { crewCallouts } = await import('../js/rules/callouts.js');
  const { onPlannedStation, recoveryPlan } = await import('../js/rules/recovery.js');
  const { logSink } = await import('../js/core/state.js');
  const heard = [];
  logSink.fn = text => heard.push(text);
  const airframe = readyProgramme('aerobee'), plan = { elevation: 85, program: 'standard' };
  S.b = 1e6;
  Object.assign(S.crew, { fido: 1, rso: 1, rec: 1 });
  const flight = beginFlight(airframe, 'Alcohol & LOX', 'Sensor Suite', 0, 1, { plan });
  flight.prediction = withProgramme('aerobee', () => previewFlight(airframe, 'Alcohol & LOX', 'Sensor Suite', 0, 1, 0, plan));
  flight.noFail = true;
  while (step(flight) == 'tick') crewCallouts(flight);
  assert.ok(heard.some(line => /\[REC\] Recovery force on station at \d+ kilometres/.test(line)));
  assert.ok(heard.some(line => /\[FIDO\] Trajectory (nominal|high|low|long|short)/.test(line)), 'FIDO calls the track against the plan at cutoff');
  assert.ok(heard.some(line => /\[FIDO\] Apogee, .* Plan was/.test(line)));
  assert.ok(heard.some(line => /\[RSO\] Impact predicted .* Plan was/.test(line)));
  // The search: easier inside the planned footprint, no help far outside it.
  const planned = flight.prediction.downrange;
  assert.ok(onPlannedStation(flight, planned) && !onPlannedStation(flight, planned + 50000));
  const withChute = { ...flight, airframe: { ...flight.airframe, pk: [...flight.airframe.pk, 'chute'] } };
  const searchAt = downrange => recoveryPlan({ ...withChute, downrange }).search;
  assert.ok(searchAt(planned) > searchAt(planned + 50000));
  assert.ok(!onPlannedStation({ ...flight, plan: null }, planned), 'no plan, nobody on station');
  logSink.fn = null;
});

test('an engine failure shows on chamber pressure for a few seconds first, and aborting in time still opens the incident', async () => {
  const { partReading } = await import('../js/rules/telemetry.js');
  const { endFlight } = await import('../js/rules/flight.js');
  const airframe = readyProgramme('aerobee');
  S.b = 1e6;
  const flight = beginFlight(airframe, 'Alcohol & LOX', 'Inert Ballast', 0, 1, { latent: 'p' });
  let result;
  do result = step(flight); while (result == 'tick' && !flight.pending);
  assert.ok(flight.pending && !flight.failure, 'the pump fault is showing, not yet struck');
  const steady = flight.chamberShare * 100;
  while (flight.time < flight.pending.at - 1) step(flight);
  assert.ok(partReading(flight, 'pc').value < steady * .75, 'chamber pressure falls away before the failure');
  const incidents = () => withProgramme('aerobee', () => S.inc.length), before = incidents();
  endFlight(flight, false, 'abort');
  assert.equal(flight.failure, 'p');
  assert.equal(incidents(), before + 1);
});

// THE CORE TEAM: Ellis, Vega and Morgan keep their record across every flight and review.
test('the core team records every flight, and the director\'s flights as Ellis\'s', () => {
  const report = runCampaign(2, 400000, 48);
  assert.equal(S.team.n, report.n);
  assert.equal(S.team.ok, report.okn);
  assert.equal(S.team.dir, report.n, 'every campaign flight was run by Ellis as launch director');
  assert.ok(S.team.top > 0, 'Morgan measured the peaks');
});

test('Vega calls the liftoff with the crew\'s flight count, and Morgan calls a peak above the best measured', async () => {
  const { crewCallouts } = await import('../js/rules/callouts.js');
  const { logSink } = await import('../js/core/state.js');
  const heard = [];
  logSink.fn = text => heard.push(text);
  S.team.n = 4;
  S.team.top = 20000;
  const flight = { time: 1, watch: [], stageIndex: 0, stages: [{ fuel: 0, thrust: 0, isp: 200, flow: 0, residual: 0, litAt: 0, out: 1 }], burnTime: 40, verticalSpeed: -1, altitude: 30000, downrange: 0, horizontalSpeed: 0, aeroLoad: 0, thrustShare: 0, payload: 'Inert Ballast', events: [{ key: 'liftoff' }] };
  crewCallouts(flight);
  flight.time = 60;
  crewCallouts(flight);
  logSink.fn = null;
  assert.ok(heard.some(line => line.includes('[PAD] Vega: Liftoff. Flight 5 for this crew.')));
  assert.ok(heard.some(line => line.includes('[RANGE] Morgan: Radar puts the peak near 30.0 kilometres. Higher than anything we have tracked.')));
});

test('a records analysis is led by Ellis, and a fix she signs goes on her record', () => {
  const incident = analysedIncident();
  assert.equal(S.team.rev, 1);
  acceptFinding(1);
  S.jobs.push({ k: 'fix', id: incident.id, prog: 'aerobee', m: incident.dx, f: FAILURE_MODES[incident.dx].fixes[0].id, t: 1, tot: 1 });
  tickSecond();
  assert.equal(S.team.fix, 1);
});

test('a crash programme halves the time left on a NASA-era research job, once, for twice its cost', () => {
  S.nasa = 1;
  S.b = 200000;
  commission('esc_tower');
  const job = S.jobs.find(candidate => candidate.id == 'esc_tower'), before = job.t, budget = S.b;
  crashProgramme('esc_tower');
  assert.equal(job.t, Math.ceil(before / 2));
  assert.equal(S.b, budget - crashCost(BY_ID.esc_tower));
  assert.equal(crashCost(BY_ID.esc_tower), 2 * BY_ID.esc_tower.cost);
  assert.ok(crashLock('esc_tower'), 'only once per job');
});

test('crash programmes are not offered before NASA', () => {
  S.b = 200000;
  commission('inj');
  assert.ok(crashLock('inj'));
});

// Aaron asked for a research queue so teams do not idle while he is launching.
test('queued research starts, and is paid for, when a team comes free', () => {
  S.b = 100000;
  commission('inj');
  commission('gauge');
  queueResearch('bea');
  assert.equal(queuePosition('bea'), 0);
  assert.ok(!S.jobs.some(job => job.id == 'bea'), 'both teams are busy');
  const inj = S.jobs.find(job => job.id == 'inj');
  inj.t = 1;
  S.gt = 99; // no appropriation this second
  const budget = S.b;
  tickSecond();
  assert.ok(S.jobs.some(job => job.id == 'bea'), 'the freed team takes the queued work');
  assert.equal(queuePosition('bea'), -1);
  assert.equal(S.b, budget - itemAsSeen('bea').cost, 'paid when it starts');
});

test('the queue waits for funds in order, and work is not queued twice', () => {
  S.b = 0;
  queueResearch('inj');
  queueResearch('bea');
  assert.equal(S.rq.length, 2);
  assert.ok(queueLock('inj'), 'already queued');
  assert.equal(S.jobs.filter(job => job.k == 'pk').length, 0, 'nothing starts without money');
  S.b = itemAsSeen('inj').cost;
  tickSecond();
  assert.ok(S.jobs.some(job => job.id == 'inj'));
  assert.deepEqual(S.rq.map(entry => entry.id), ['bea']);
  queueResearch('gauge');
  moveUpQueue(1);
  assert.deepEqual(S.rq.map(entry => entry.id), ['gauge', 'bea'], 'moved up one place');
  unqueue(0);
  assert.deepEqual(S.rq.map(entry => entry.id), ['bea']);
});

test('commissioning queued work by hand takes it out of the queue, and the queue has a limit', () => {
  S.b = 0;
  queueResearch('inj');
  S.b = 100000;
  S.rq.push({ id: 'gauge', prog: 'wac' });
  commission('gauge');
  assert.deepEqual(S.rq.map(entry => entry.id), ['inj']);
  S.b = 0;
  for (const id of ['mix', 'vol', 'bea', 'fm', 'ogive']) queueResearch(id);
  assert.equal(S.rq.length, RESEARCH_QUEUE_LENGTH);
  assert.ok(queueLock('fins'));
});

test('a queued records analysis goes ahead of queued research and starts when a team comes free', () => {
  readyProgramme('aerobee');
  S.cur = 'aerobee';
  S.b = 100000;
  S.inc.push({ id: 1, mode: 's', sym: [], cand: ['s', 'c'], ev: 1, st: 'open', t: 30, lab: 'test' });
  commission('chute');
  commission('bcn');
  const next = itemsInArea('p').find(item => !queueLock(item.id)).id;
  queueResearch(next);
  queueAnalysis(1);
  assert.equal(analysisPosition(1), 0, 'the analysis jumps the research');
  S.jobs[0].t = 1;
  tickSecond();
  assert.equal(S.inc[0].st, 'inv');
  assert.equal(analysisPosition(1), -1);
  assert.equal(queuePosition(next), 0);
});

// Aaron's report: fixes, design reviews and extended analyses in the engineering file could not be queued.
test('engineering-file work queues and starts when a team comes free', () => {
  readyProgramme('aerobee');
  S.cur = 'aerobee';
  S.b = 100000;
  S.inc.push({ id: 1, mode: 's', sym: [], cand: ['s', 'c'], ev: 1, st: 'diag', dx: 's', conf: 'high', t: 30, lab: 'test' });
  S.inc.push({ id: 2, mode: 'c', sym: [], cand: ['c', 'p'], ev: 1, st: 'found', dx: 'c', p: .6, conf: 'moderate', t: 30, lab: 'test' });
  commission('chute');
  commission('bcn');
  const fix = FAILURE_MODES.s.fixes[0].id;
  queueFix(1, fix);
  queueReview('p');
  queueAnalysis(2);
  assert.equal(analysisPosition(2), 0, 'the extended analysis goes first');
  assert.equal(fixPosition(1), 1);
  assert.equal(reviewPosition('p'), 2);
  S.jobs.forEach(job => job.t = 1);
  tickSecond();
  assert.equal(S.inc[1].st, 'inv');
  assert.ok(S.jobs.some(job => job.k == 'inv' && job.id == 2 && job.x), 'started as an extended analysis');
  assert.equal(S.inc[0].st, 'fixing');
  assert.ok(S.jobs.some(job => job.k == 'fix' && job.f == fix));
  assert.equal(S.rq.length, 1, 'the review waits for the next team');
  assert.equal(reviewPosition('p'), 0);
});

// Aaron's report: the R&D badge counted two incidents that were nowhere on the desk. A wrong diagnosis was filed under the true cause.
test('a wrongly diagnosed incident is filed under the mode the engineers blame', () => {
  readyProgramme('aerobee');
  withProgramme('aerobee', () => {
    S.inc.push({ id: 1, mode: 's', sym: [], cand: ['s', 'c'], ev: 1, st: 'diag', dx: 'c', conf: 'low', t: 30, lab: 'test' });
    assert.ok(filedModes('p').includes('c'), 'shown where the engineers think it belongs');
    assert.ok(!filedModes('s').includes('s'), 'the true cause stays hidden');
  });
});

// THE FINDINGS: records analysis ends with the team's lead and the player's call.
// An Aerobee incident whose true cause (s) shares its signature with two other modes; the analysis is run to its end.
const analysedIncident = (extend = false) => {
  readyProgramme('aerobee');
  S.cur = 'aerobee';
  S.b = 200000;
  S.inc.push({ id: 1, mode: 's', sym: [], cand: ['s', 'c', 'p'], ev: 1, st: 'open', t: 30, lab: 'test' });
  const finish = () => { S.jobs.forEach(job => job.t = 1); tickSecond(); };
  startInvestigation(1);
  finish();
  if (extend) {
    extendInvestigation(1);
    finish();
  }
  return S.inc[0];
};

test('records analysis waits for the player with a lead and its odds', () => {
  const incident = analysedIncident();
  assert.equal(incident.st, 'found');
  assert.ok(incident.cand.includes(incident.dx));
  assert.ok(incident.p > 0 && incident.p < 1);
  assert.ok(!filedModes(systemOf(incident.dx)).includes(incident.dx), 'not filed before the call');
  acceptFinding(1);
  assert.equal(incident.st, 'diag');
});

test('the player can overrule the team and name another suspect', () => {
  const incident = analysedIncident(), other = incident.cand.find(mode => mode != incident.dx);
  nameCause(1, other);
  assert.equal(incident.st, 'diag');
  assert.equal(incident.dx, other);
  assert.equal(incident.conf, 'your call');
});

test('extending the analysis rules out a wrong suspect, never the true cause', () => {
  const incident = analysedIncident(true);
  assert.equal(incident.st, 'found');
  assert.equal(incident.cand.length, 2);
  assert.ok(incident.cand.includes('s'));
});

test('with a command receiver aboard, the Uplink Engineer can switch telemetry channels in flight', async () => {
  const { retuneChannel, offLinkWarning } = await import('../js/rules/telemetry.js');
  const flight = { airframe: { pk: ['fm', 'str', 'xdc'] }, payload: 'Inert Ballast', watch: ['q'], time: 3, pending: { mode: 'p', from: 0, at: 4 } };
  assert.ok(offLinkWarning(flight), 'a pump fault builds on chamber pressure, which the link is not carrying');
  S.crew.upl = 1;
  retuneChannel(flight, 'pc');
  assert.deepEqual(flight.watch, ['q'], 'an airframe built before the ground command link has no receiver');
  flight.payload = 'Command Receiver Test Package';
  retuneChannel(flight, 'pc');
  assert.deepEqual(flight.watch, ['pc'], 'the link carries one channel, so aero load is dropped');
  assert.ok(!offLinkWarning(flight));
  retuneChannel(flight, 'g');
  assert.deepEqual(flight.watch, ['pc'], 'no accelerometer aboard');
});

test('on an uncrewed Mercury flight the ground decides only when a command can reach the capsule', async () => {
  const { stepMission, decisionOptions, chooseOption } = await import('../js/rules/mission.js');
  const { capsuleSystems } = await import('../js/rules/mercury.js');
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  giveResearch(['cmd']);
  const failedRetros = config => ({
    systems: capsuleSystems(config), missionType: 'mr', type: MISSION_TYPES.mr, crew: null, time: 0, events: [{ time: 1, kind: 'retro' }],
    retroWillFail: 1, log: [], transcript: [], pending: null, outcome: {}, done: 0,
  });
  S.crew.upl = 1;
  assert.equal(stepMission(failedRetros({ pk: [] }), 2), 'tick', 'no command receiver aboard: the automatics handle it');
  S.crew.upl = 0;
  assert.equal(stepMission(failedRetros({ pk: ['cmd'] }), 2), 'tick', 'no Uplink Engineer to send the command');
  S.crew.upl = 1;
  const mission = failedRetros({ pk: ['cmd'] });
  assert.equal(stepMission(mission, 2), 'decide');
  assert.ok(mission.pending.uncrewed);
  const options = decisionOptions(mission, 'retro');
  assert.deepEqual(options.map(option => !!option.automatic), [true, false], 'leave it to the automatics, or send the command');
  chooseOption(mission, options[1].index);
  assert.equal(mission.pending, null);
  assert.match(mission.log.join(' '), /Test Conductor: "Command retrofire from the ground."/);
});

test('the ground command link goes into new blueprints; older airframes take it by retrofit or fly the test package', async () => {
  const { endFlight } = await import('../js/rules/flight.js');
  const airframe = readyProgramme('aerobee');
  S.nasa = 1;
  S.b = 1e6;
  S.pk.cmd = { a: { cmd: 1 }, c: 0, m: null, dud: false };
  withProgramme('aerobee', () => publishBlueprint());
  assert.ok(S.progs.aerobee.bp.pk.includes('cmd'), 'new airframes are built with the receiver');
  assert.equal(retrofitQuote(airframe).changes, 1, 'the old airframe can be retrofitted with it');
  const flight = beginFlight(airframe, 'Alcohol & LOX', 'Command Receiver Test Package', 0, 1);
  let result;
  do result = step(flight); while (result == 'tick' || result == 'sep');
  endFlight(flight, true, 'land');
  assert.equal(S.pk.cmd.c, 1, 'a good flight with the test package confirms the ground command link');
});

// SECTION 2: ORBITAL MERCURY
test('orbital Mercury opens in Section 2, and needs a shield for orbital re-entry', () => {
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  assert.match(requirementText('mo'), /Section 2/);
  S.p2.secDone = 1;
  assert.match(requirementText('mo'), /orbital re-entry/);
  giveResearch(['mo_shield']);
  assert.equal(requirementText('mo'), null);
});

test('a capsule lasts three orbits, six with the extra consumables, and 22 with the long-duration work on top', async () => {
  const { orbitChoices } = await import('../js/rules/mercury.js');
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  assert.deepEqual(orbitChoices({ pk: [] }), [1, 2, 3]);
  assert.deepEqual(orbitChoices({ pk: ['mo_cons'] }), [1, 2, 3, 6]);
  assert.deepEqual(orbitChoices({ pk: ['mo_long'] }), [1, 2, 3], 'the long-duration work builds on the extra consumables');
  assert.deepEqual(orbitChoices({ pk: ['mo_cons', 'mo_long'] }), [1, 2, 3, 6, 22]);
});

// An orbital flight already in orbit with no faults: only its orbits, retrofire and the descent to come.
const orbitalFlight = async (orbits, extra = {}) => {
  const { orbitalTimeline } = await import('../js/rules/mission.js');
  const { capsuleSystems } = await import('../js/rules/mercury.js');
  const { ORBIT_SECONDS } = await import('../js/data/mercury.js');
  const type = orbitalTimeline(orbits);
  const events = [...Array(orbits)].map((_, index) => ({ time: type.sep + (index + 1) * ORBIT_SECONDS, kind: 'orbit' }));
  events.push({ time: type.retro, kind: 'retro' }, { time: type.reentry + 10, kind: 'reentry' }, { time: type.chute, kind: 'chute' }, { time: type.end - 2, kind: 'splash' });
  return {
    systems: capsuleSystems({ pk: [] }), missionType: 'mo', type, crew: null, time: type.sep + 30, events, booster: { label: 'Atlas' },
    log: [], transcript: [], pending: null, outcome: {}, done: 0, fuel: 100, orbitsFlown: 0, ...extra,
  };
};
const flyToTheEnd = async mission => {
  const { stepMission, missionStepSeconds } = await import('../js/rules/mission.js');
  let result, steps = 0;
  do result = stepMission(mission, missionStepSeconds(mission));
  while (result != 'end' && ++steps < 5000);
  return { result, steps };
};

test('an orbital flight flies its orbits on a fast clock, spends attitude fuel, and comes down where retrofire puts it', async () => {
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  const mission = await orbitalFlight(3);
  const { result, steps } = await flyToTheEnd(mission);
  assert.equal(result, 'end');
  assert.ok(steps < 700, `three orbits took ${steps} steps`);
  assert.equal(mission.orbitsFlown, 3);
  assert.ok(mission.fuel < 100 && mission.fuel > 0);
  assert.ok(mission.missKm >= 0);
  assert.match(mission.log.join(' '), /Splashdown, \d+ km from the recovery ships/);
});

test('with the retros dead an orbital flight waits an orbit for a second try, then is stranded', async () => {
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  const mission = await orbitalFlight(1, { retroWillFail: 1 });
  const firstRetro = mission.type.retro;
  Math.random = () => .99; // every attempt fails
  const { result } = await flyToTheEnd(mission);
  assert.equal(result, 'end');
  assert.equal(mission.retroTries, 2);
  assert.ok(mission.type.retro > firstRetro, 'the second try came an orbit later');
  assert.equal(mission.outcome.lost, 1);
  assert.match(mission.log.join(' '), /stranded in orbit/);
});

test('short of fuel, coming home early brings retrofire forward and the planned orbits are not flown', async () => {
  const { chooseOption, decisionOptions } = await import('../js/rules/mission.js');
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  S.p2.astros = [{ id: 1, name: 'Test Pilot', t: { pil: 60, sys: 60, end: 60, com: 60 }, reh: {}, fat: 0 }];
  const mission = await orbitalFlight(6, { fuel: 40, crew: S.p2.astros[0], callSign: 'Test 1' });
  const { stepMission, missionStepSeconds } = await import('../js/rules/mission.js');
  let result;
  do result = stepMission(mission, missionStepSeconds(mission));
  while (result == 'tick');
  assert.equal(result, 'decide');
  assert.equal(mission.pending.key, 'fuel');
  const plannedRetro = mission.type.retro;
  chooseOption(mission, decisionOptions(mission, 'fuel').find(option => option.soft).index);
  assert.ok(mission.type.retro < plannedRetro);
  await flyToTheEnd(mission);
  assert.ok(mission.orbitsFlown < 6);
});

test('the Section 2 Soviet dates run as early or late as Vostok 1 did', async () => {
  const { openSovietSectionTwo } = await import('../js/rules/race.js');
  const lateness = S.rv.r_gagarin - 5502;
  openSovietSectionTwo();
  assert.equal(S.rv.r_titov, 5616 + lateness);
  assert.equal(S.rv.r_woman, 6286 + lateness);
});

test('in Section 2 an orbital-class booster is man-rated after two clean flights in a row; a suborbital one still needs three', () => {
  const atlas = readyProgramme('atlas'), redstone = readyProgramme('redstone');
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  S.p2.secDone = 1;
  giveResearch(MAN_RATING_RESEARCH);
  for (let i = 0; i < 2; i++) {
    recordBoosterFlight(atlas, true);
    recordBoosterFlight(redstone, true);
  }
  assert.equal(isManRated(atlas), true);
  assert.equal(isManRated(redstone), false);
});

test('a backup pilot trains alongside the pilot and moves up, training kept, once the pilot has flown', async () => {
  const { assignPilot, assignBackup, promoteBackup, assignedPilot, backupPilot } = await import('../js/rules/astronauts.js');
  const { QUALIFICATION_DAYS } = await import('../js/data/astronauts.js');
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  S.p2.astros = [1, 2].map(id => ({ id, name: `Pilot ${id}`, st: 'active', tday: QUALIFICATION_DAYS, t: { pil: 60, sys: 60, end: 60, com: 60 }, reh: {}, fat: 0, mt: 0, asg: null, bk: null }));
  assignPilot(1, 'mo');
  assignBackup(2, 'mo');
  assignBackup(1, 'mo');
  assert.equal(backupPilot('mo').id, 2, 'the pilot cannot also be the backup');
  backupPilot('mo').mt = .6;
  assignedPilot('mo').asg = null;
  promoteBackup('mo');
  assert.equal(assignedPilot('mo').id, 2);
  assert.equal(assignedPilot('mo').mt, .6);
  assert.equal(backupPilot('mo'), undefined);
});

// THE NASA BUDGET
const openNasaBudget = async () => {
  const { budgetTick } = await import('../js/rules/budget.js');
  S.day = S.nasa = 4400; // March 1958: FY1958 ends on 1 July 1958, day 4500
  S.p2 = newPhaseTwo();
  budgetTick(0);
  return budgetTick;
};

test('NASA\'s first budget carries on the Phase One grant rate and is paid as the days pass', async () => {
  const { payAppropriation } = await import('../js/rules/budget.js');
  const { phaseOneGrant } = await import('../js/rules/economy.js');
  const rate = phaseOneGrant();
  await openNasaBudget();
  assert.equal(S.fy.yr, 1958);
  assert.ok(Math.abs(S.fy.bud - rate * 360 / 13.5) < 1000, 'the same money a year as the Phase One grant');
  const before = S.b;
  S.day += 36;
  assert.equal(payAppropriation(), Math.round(S.fy.bud / 10));
  assert.equal(S.b, before + Math.round(S.fy.bud / 10));
});

test('a year that leaves money unspent brings a smaller budget, and cash above the carry-over goes back to the Treasury', async () => {
  const budgetTick = await openNasaBudget();
  const { CARRY_OVER } = await import('../js/rules/budget.js');
  const budget = S.fy.bud;
  S.day = 4500;
  budgetTick(0);
  assert.equal(S.fy.yr, 1959);
  assert.ok(S.fy.bud < budget, 'nothing was spent, so next year is cut');
  assert.ok(S.fy.bud >= .75 * budget, 'but by no more than a quarter');
  assert.equal(S.b, Math.round(CARRY_OVER * budget));
  assert.ok(S.fy.last.lapsed > 0);
});

test('a year that spends more than its budget earns a bigger one', async () => {
  const budgetTick = await openNasaBudget();
  const budget = S.fy.bud;
  S.day = 4500;
  S.b = -budget; // spent the year's appropriation and as much again
  budgetTick(0);
  assert.ok(S.fy.bud > budget);
  assert.ok(S.fy.bud <= 1.35 * budget);
});

test('without a Mercury flight reputation slips, and a flight ends the quiet spell', async () => {
  const budgetTick = await openNasaBudget();
  const { recordMercuryFlight, QUIET_DAYS } = await import('../js/rules/budget.js');
  S.day += QUIET_DAYS - 1;
  budgetTick(30);
  assert.equal(S.rep, 100);
  S.day += 2;
  budgetTick(30);
  assert.equal(S.rep, 99);
  assert.equal(S.fy.q, 1);
  recordMercuryFlight();
  budgetTick(30);
  assert.equal(S.rep, 99);
  assert.equal(S.fy.q, 0);
});

// THE SITE (rules/site.js): construction crews, upkeep, mothballing and launch pads.
test('in Phase One a building is in service at once; from NASA on it waits for a contractor crew and its construction days', async () => {
  const { buildFacility } = await import('../js/rules/launch-site.js');
  const { constructionTick, upkeep, buildDaysOf } = await import('../js/rules/site.js');
  const { SITE } = await import('../js/data/launch-site.js');
  S.b = 1e6;
  buildFacility('wx');
  assert.equal(S.fac.wx, 1);
  assert.equal(upkeep(), 0, 'no upkeep before NASA');
  S.day = S.nasa = 4400;
  for (const id of ['centrifuge', 'egress', 'zerog']) buildFacility(id);
  assert.equal(Object.keys(S.fb).length, SITE.contractorCrews);
  assert.deepEqual(S.cq, ['zerog'], 'the third order waits its turn');
  assert.ok(!S.fac.centrifuge);
  S.day += buildDaysOf('egress');
  constructionTick();
  assert.equal(S.fac.egress, 1);
  assert.equal(S.fb.zerog, Math.round(S.day + buildDaysOf('zerog')), 'the freed crew starts the waiting order');
  assert.ok(upkeep() > 0, 'buildings in service cost upkeep under NASA');
});

test('a mothballed building stops costing upkeep and loses its effect until it is reopened', async () => {
  const { mothball, mothballLock, reopen, constructionTick, upkeep } = await import('../js/rules/site.js');
  const { SITE } = await import('../js/data/launch-site.js');
  S.day = S.nasa = 4400;
  S.fac.centrifuge = 1;
  S.fac.tty = 1;
  const running = upkeep();
  assert.ok(mothballLock('tty'), 'the control room stays staffed');
  mothball('centrifuge');
  assert.ok(!S.fac.centrifuge);
  assert.ok(upkeep() < running);
  reopen('centrifuge');
  S.day += SITE.reopenDays;
  constructionTick();
  assert.equal(S.fac.centrifuge, 1);
  assert.ok(!S.mb.centrifuge);
});

test('an Atlas launches only from a free Atlas pad, which is refurbished after each launch and wrecked by a failure at liftoff', async () => {
  const { padLock, usePad, damagePad } = await import('../js/rules/site.js');
  const { quoteLaunch } = await import('../js/rules/design.js');
  const { SITE } = await import('../js/data/launch-site.js');
  S.day = S.nasa = 4400;
  S.b = 1e6;
  const atlas = readyProgramme('atlas'), redstone = readyProgramme('redstone');
  assert.match(quoteLaunch(atlas, 'Kerosene & LOX', 'Inert Ballast', 1).error, /Launch Complex 14/);
  assert.equal(padLock(redstone), null, 'rockets without a launch complex of their own fly from the range pads');
  S.fac.lc14 = 1;
  assert.equal(padLock(atlas), null);
  assert.equal(usePad(atlas), 'lc14');
  assert.match(padLock(atlas), /being readied/);
  S.day += SITE.padTurnaround;
  assert.equal(padLock(atlas), null);
  damagePad(usePad(atlas), 3);
  S.day += SITE.padTurnaround;
  assert.ok(padLock(atlas), 'a damaged pad takes longer than a turnaround');
});

test('the second Atlas pad is earned by success: it opens once an uncrewed orbital flight has been made', async () => {
  const { facilityLock } = await import('../js/rules/launch-site.js');
  S.day = S.nasa = 4400;
  S.b = 1e6;
  S.p2 = newPhaseTwo();
  S.fac.lc14 = 1;
  assert.match(facilityLock('lc12'), /Opens after/);
  S.p2.dir = 7;
  assert.equal(facilityLock('lc12'), null);
});

// GEMINI
test('meeting the last Mercury directive completes Mercury and opens Gemini, with a second astronaut group', async () => {
  const { fulfilDirective } = await import('../js/rules/mercury.js');
  const { MERCURY_DIRECTIVES, LAST_MERCURY_DIRECTIVE, SECOND_GROUP_SIZE } = await import('../js/data/mercury.js');
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  S.p2.secDone = 1;
  S.p2.astros = makePool(7).map(astronaut => ({ ...astronaut, st: 'active' }));
  S.p2.dir = LAST_MERCURY_DIRECTIVE;
  S.day = 6000;
  assert.match(startLock('titan'), /Gemini/);
  fulfilDirective(MERCURY_DIRECTIVES[LAST_MERCURY_DIRECTIVE]);
  assert.ok(S.p2.mercDone);
  assert.equal(S.p2.fl.gem, 1);
  assert.equal(S.p2.astros.length, 7 + SECOND_GROUP_SIZE);
  assert.equal(new Set(S.p2.astros.map(astronaut => astronaut.id)).size, S.p2.astros.length, 'every astronaut keeps a distinct id');
  assert.equal(MERCURY_DIRECTIVES[S.p2.dir].key, 'g1');
});

test('the last Gemini goals open together and can be met in any order', async () => {
  const { fulfilDirective, openDirectives, directiveDone } = await import('../js/rules/mercury.js');
  const { MERCURY_DIRECTIVES } = await import('../js/data/mercury.js');
  const goal = key => MERCURY_DIRECTIVES.find(directive => directive.key == key);
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  S.p2.dir = MERCURY_DIRECTIVES.findIndex(directive => directive.key == 'g5');
  S.day = 7000;
  assert.deepEqual(openDirectives().map(directive => directive.key), ['g5']);
  fulfilDirective(goal('g5'));
  assert.deepEqual(openDirectives().map(directive => directive.key), ['g7', 'g6', 'g8']);
  // Rendezvous first: the fourteen-day flight is still open, and the count waits for it.
  fulfilDirective(goal('g6'));
  assert.ok(directiveDone('g6') && !directiveDone('g7'));
  assert.deepEqual(openDirectives().map(directive => directive.key), ['g7', 'g8']);
  fulfilDirective(goal('g7'));
  assert.equal(MERCURY_DIRECTIVES[S.p2.dir].key, 'g8');
  assert.ok(!S.p2.gemDone);
  fulfilDirective(goal('g8'));
  assert.equal(S.p2.dir, MERCURY_DIRECTIVES.length);
  assert.ok(S.p2.gemDone);
});

test('a Gemini spacecraft lasts four days on batteries, eight with fuel cells and fourteen with the long-duration stores', async () => {
  const { orbitChoices } = await import('../js/rules/mercury.js');
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  assert.deepEqual(orbitChoices({ pk: [] }, 'gt'), [3, 16, 62]);
  assert.deepEqual(orbitChoices({ pk: ['gm_fc'] }, 'gt'), [3, 16, 62, 120]);
  assert.deepEqual(orbitChoices({ pk: ['gm_fc', 'gm_long'] }, 'gt'), [3, 16, 62, 120, 206]);
});

test('a Gemini crew needs an uncrewed Gemini first, the ejection seats, and a trained astronaut in both seats', async () => {
  const { assignPilot } = await import('../js/rules/astronauts.js');
  const { QUALIFICATION_DAYS } = await import('../js/data/astronauts.js');
  const { LAST_MERCURY_DIRECTIVE } = await import('../js/data/mercury.js');
  const titan = readyProgramme('titan');
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  Object.assign(S.p2, { secDone: 1, dir: LAST_MERCURY_DIRECTIVE + 1 });
  S.p2.fl.gem = 1;
  S.fac.trknet = 1;
  manRatingRecord('titan').cert.push([1, null]);
  giveResearch(['ms_hbolt']);
  S.p2.astros = [1, 2].map(id => ({ id, name: `Pilot ${id}`, st: 'active', tday: QUALIFICATION_DAYS, t: { pil: 60, sys: 60, end: 60, com: 60 }, reh: {}, fat: 0, mt: 0, asg: null, bk: null }));
  assert.match(crewLock(1, titan, 'gt'), /uncrewed Gemini/);
  S.p2.dir++;
  assert.match(crewLock(1, titan, 'gt'), /Ejection seats/);
  giveResearch(['gm_seat']);
  assert.match(crewLock(1, titan, 'gt'), /command pilot/);
  assignPilot(1, 'gt');
  assert.match(crewLock(1, titan, 'gt'), /as pilot/);
  assignPilot(2, 'gtp');
  assert.match(crewLock(1, titan, 'gt'), /mission training/);
  S.p2.astros.forEach(astronaut => astronaut.mt = 1);
  assert.equal(crewLock(1, titan, 'gt'), null);
});

// GEMINI PART 2: the Agena target, rendezvous and docking, with the Python design's rules: capabilities are recorded per
// configuration, docking follows a flown rendezvous, and the crew train for rendezvous as part of mission training.
test('rendezvous needs the radar, an Agena in orbit and a trained crew; docking needs a rendezvous flown first', async () => {
  const { targetLock, targetUp, recordCapability, capabilityShown } = await import('../js/rules/mercury.js');
  const { TARGET_DAYS } = await import('../js/data/mercury.js');
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  S.day = 7000;
  const crew = [1, 2].map(id => ({ id, name: `Pilot ${id}`, reh: {} }));
  const bare = { mt: 'gt', cfg: { pk: [], rev: 2 } }, radar = { mt: 'gt', cfg: { pk: ['gm_rdv'], rev: 3 } };
  assert.match(targetLock(bare, 'rdv', ...crew), /rendezvous radar/);
  assert.match(targetLock(radar, 'rdv', ...crew), /no Agena/);
  S.p2.tgt = S.day + TARGET_DAYS;
  assert.ok(targetUp());
  assert.match(targetLock(radar, 'rdv', ...crew), /Pilot 1 has not trained/);
  crew.forEach(astronaut => astronaut.reh.rdv = 1);
  assert.equal(targetLock(radar, 'rdv', ...crew), null);
  assert.match(targetLock(radar, 'dock', ...crew), /after a rendezvous/);
  recordCapability('rdv', radar, { prog: 'titan' });
  assert.ok(capabilityShown('rdv'));
  assert.deepEqual(S.p2.cap[0], { k: 'rdv', mt: 'gt', rev: 3, pk: ['gm_rdv'], by: 'titan', d: 7000 }, 'recorded with the configuration that flew it');
  assert.equal(targetLock(radar, 'dock', ...crew), null);
  S.day += TARGET_DAYS;
  assert.ok(!targetUp(), 'the Agena runs out after about three months');
});

test('a Gemini crew trains for rendezvous in mission training once the radar is researched', async () => {
  const { trainingTick, RENDEZVOUS_TRAINING } = await import('../js/rules/astronauts.js');
  S.nasa = 1;
  S.p2 = newPhaseTwo();
  S.p2.selDone = 1;
  const astronaut = { id: 1, name: 'Pilot 1', st: 'active', tday: 0, t: { pil: 60, sys: 60, end: 60, com: 60 }, reh: {}, fat: 0, mt: RENDEZVOUS_TRAINING, asg: 'gt', bk: null, focus: 'msn', med: 0 };
  S.p2.astros = [astronaut];
  trainingTick(1);
  assert.ok(!astronaut.reh.rdv, 'not before the radar exists');
  giveResearch(['gm_rdv']);
  trainingTick(1);
  assert.equal(astronaut.reh.rdv, 1);
});

test('Titan II needs its pogo cured before it can be man-rated', async () => {
  const { manRatingResearchDone } = await import('../js/rules/manrate.js');
  S.nasa = 1;
  giveResearch(MAN_RATING_RESEARCH);
  assert.equal(manRatingResearchDone('atlas'), true);
  assert.equal(manRatingResearchDone('titan'), false);
  giveResearch(['gm_pogo']);
  assert.equal(manRatingResearchDone('titan'), true);
});

test('paydays come sooner while the calendar catches up with history', () => {
  S.fs.f_orbit = 1; // a satellite up before the Space Act: the calendar runs up to ten times faster
  S.gt = 30;
  const speed = catchUp(), budget = S.b;
  assert.ok(speed > 2, 'the calendar is catching up');
  for (let second = 0; second < Math.ceil(30 / speed); second++) tickSecond();
  assert.ok(S.b > budget, 'one funding cycle of calendar has passed, so the appropriation is paid');
});

// THE CORE TEAM AT THE CONSOLES: Ellis, Vega and Morgan cover empty stations until a specialist is hired or they move on.
test('the core team covers empty consoles until a specialist is hired or they take a bigger job', async () => {
  const { boardCrew, coveringMember, crewOnConsole } = await import('../js/rules/launch-site.js');
  assert.deepEqual(boardCrew(), ['tc', 'prop', 'rso'], 'Ellis on PROP and Vega on RSO from the first countdown');
  assert.equal(coveringMember('prop'), 'ellis');
  assert.deepEqual(crewOnConsole(), ['tc'], 'covers are not hires: the consoles stay free to hire into');
  S.crew.prop = 1;
  assert.equal(coveringMember('prop'), null, 'the hired engineer frees Ellis');
  S.crew.prop = 0;
  S.fac.tty = 1;
  assert.equal(coveringMember('tlm'), 'morgan', 'Morgan takes TLM once the teleprinters are in');
  S.staff.director = 1;
  assert.equal(coveringMember('prop'), null, 'Ellis leaves PROP when appointed launch director');
  assert.equal(coveringMember('rso'), 'vega', 'Vega stays on the pad and on RSO');
  const airframe = readyProgramme('aerobee');
  assert.deepEqual(runPoll(airframe, 'Alcohol & LOX', 0).lines.map(line => line.id), ['tc', 'rso', 'tlm'], 'covered stations answer the poll');
});

// ELLIS'S ENGINEERING REMIT (rules/remit.js).
const remitReady = () => {
  readyProgramme('aerobee');
  S.cur = 'aerobee';
  S.b = 200000;
  S.team.rev = 3;
  S.team.fix = 2;
};
test('Ellis earns a remit by her record, and leaves the PROP console to run it', async () => {
  const { startRemit } = await import('../js/rules/remit.js');
  const { coveringMember } = await import('../js/rules/launch-site.js');
  readyProgramme('aerobee');
  S.cur = 'aerobee';
  assert.ok(startRemit(10000), 'not before she has led reviews and signed fixes');
  remitReady();
  assert.equal(startRemit(10000), null);
  assert.equal(S.remit.prog, 'aerobee');
  assert.equal(coveringMember('prop'), null);
  assert.equal(S.b, 200000, 'a cap: nothing leaves the treasury until she spends it');
});

test('inside her remit Ellis analyses failures, signs off confident findings, refers the rest and builds the strongest fix the cap allows', async () => {
  const { startRemit, remitTick, raiseRemit } = await import('../js/rules/remit.js');
  remitReady();
  startRemit(10000);
  S.inc.push({ id: 1, mode: 's', sym: [], cand: ['s', 'c'], ev: 1, st: 'open', t: 30, lab: 'open' });
  remitTick();
  assert.equal(S.inc[0].st, 'inv', 'she starts the records analysis');
  assert.equal(S.remit.spent, 1500);
  S.inc.push({ id: 2, mode: 'c', sym: [], cand: ['c', 'p'], ev: 1, st: 'found', dx: 'c', conf: 'high', t: 30, lab: 'sure' });
  S.inc.push({ id: 3, mode: 'p', sym: [], cand: ['c', 'p'], ev: 1, st: 'found', dx: 'p', conf: 'moderate', t: 30, lab: 'unsure' });
  remitTick();
  assert.equal(S.inc[1].st, 'fixing', 'signed off and the fix started');
  assert.equal(S.jobs.find(job => job.k == 'fix').f, 'baffle', 'the chamber redesign is past the cap, so the baffled injector');
  assert.equal(S.inc[2].st, 'found');
  assert.equal(S.inc[2].ref, 1, 'moderate confidence is referred to you');
  assert.equal(S.remit.spent, 5500);
  // With teams free but the cap nearly spent, she asks for more.
  S.teams = 6;
  S.inc.push({ id: 4, mode: 'p', sym: [], cand: ['p'], ev: 1, st: 'diag', dx: 'p', conf: 'high', t: 30, lab: 'pump' });
  S.remit.cap = 6000;
  remitTick();
  assert.ok(S.remit.dry, 'the cap cannot cover a pump fix');
  raiseRemit();
  assert.equal(S.remit.dry, null);
  remitTick();
  assert.equal(S.inc[3].st, 'fixing');
});

test('a fix holds after three good flights, and her authority grows to moderate findings', async () => {
  const { recordFix, recordFixTrials, fixesHeld, FLIGHTS_FOR_A_FIX_TO_HOLD } = await import('../js/rules/team.js');
  const { signsOff, FIXES_HELD_FOR_MODERATE } = await import('../js/rules/remit.js');
  remitReady();
  assert.ok(!signsOff('moderate'));
  for (const mode of ['c', 'p', 's']) {
    S.fix[mode] = mode + '_fix';
    recordFix(mode);
  }
  S.inc.push({ id: 1, mode: 's', sym: [], cand: ['s'], ev: 1, st: 'found', dx: 's', conf: 'high', t: 30, lab: 'again' });
  acceptFinding(1);
  const unfixed = { fix: {} }, fixed = { fix: { ...S.fix } };
  for (let flight = 0; flight < FLIGHTS_FOR_A_FIX_TO_HOLD; flight++) recordFixTrials('aerobee', true, unfixed);
  assert.equal(fixesHeld(), 0, 'good flights of airframes without the fixes prove nothing');
  for (let flight = 0; flight < FLIGHTS_FOR_A_FIX_TO_HOLD; flight++) recordFixTrials('aerobee', true, fixed);
  assert.equal(fixesHeld(), 2, 'the separation fix came back, so only two held');
  assert.equal(FIXES_HELD_FOR_MODERATE, 2);
  assert.ok(signsOff('moderate'));
  assert.ok(!signsOff('low'), 'low confidence always comes to you');
});

// CHEN'S RESEARCH LANES (rules/lanes.js): each station engineer researches their own system, on a team of their own.
test('Chen joins with the Aerobee unlock, and each lane is led by its station engineer or the core-team cover', async () => {
  const { chenJoinTick, laneLead } = await import('../js/rules/lanes.js');
  const { memberJoined } = await import('../js/rules/team.js');
  assert.ok(!chenJoinTick() && !memberJoined('chen'), 'not before the Aerobee is routine');
  readyProgramme('aerobee');
  S.progs.aerobee.okf = AEROBEE_FLIGHTS_TO_UNLOCK;
  assert.ok(chenJoinTick() && memberJoined('chen'));
  S.fac.tty = 1;
  S.crew.bstr = 1;
  assert.equal(laneLead('p').name, 'Ruth Ellis', 'Ellis covers PROP, so she leads propulsion at the cover pace');
  assert.ok(laneLead('p').pace < 1);
  assert.equal(laneLead('s').pace, 1, 'a hired BSTR leads structures at full pace');
  assert.equal(laneLead('a'), null, 'no FIDO yet: the aero lane waits');
});

test('the lanes start routine packages cheapest first on their own teams, at the lead\'s pace, within the budget', async () => {
  const { chenJoinTick, startLanes, lanesTick, laneJob, raiseLanes } = await import('../js/rules/lanes.js');
  const { freeTeams } = await import('../js/core/state.js');
  readyProgramme('aerobee');
  S.cur = 'aerobee';
  S.progs.aerobee.okf = AEROBEE_FLIGHTS_TO_UNLOCK;
  chenJoinTick();
  S.b = 200000;
  S.crew.prop = 1;
  S.crew.bstr = 1;
  S.fac.tty = 1;
  S.fac.plot = 1; // a console for Morgan to cover TLM from, after Vega takes RSO
  assert.equal(startLanes(30000), null);
  const teamsBefore = freeTeams();
  lanesTick();
  for (const area of ['p', 's', 'i']) assert.ok(laneJob(area), `the ${area} lane is working`);
  assert.equal(laneJob('a'), undefined, 'no FIDO, no aero work');
  assert.equal(freeTeams(), teamsBefore, 'lane work takes none of the shared teams');
  const propulsion = laneJob('p'), telemetry = laneJob('i');
  assert.equal(propulsion.tot, itemAsSeen(propulsion.id).time, 'a hired engineer works at full pace');
  assert.ok(telemetry.tot > itemAsSeen(telemetry.id).time, 'Morgan, covering TLM, is slower');
  assert.ok(itemsInArea('p').every(item => item.dud || isMilestone(item.id) || itemAsSeen(item.id).cost >= itemAsSeen(propulsion.id).cost || S.pk[item.id]), 'cheapest routine package first');
  S.jobs = S.jobs.filter(job => !job.ln);
  S.lanes.cap = S.lanes.spent + 100;
  lanesTick();
  assert.ok(S.lanes.dry, 'the budget cannot cover the next package');
  raiseLanes();
  assert.equal(S.lanes.dry, null);
});

// Aaron's report: the lanes stalled with experiments still on offer. Once the routine work is done, a lead takes the experiments.
test('a lane takes its experiments once the routine work is done, and says why when it is idle', async () => {
  const { chenJoinTick, startLanes, lanesTick, laneJob, laneIdleReason, nextPackage } = await import('../js/rules/lanes.js');
  readyProgramme('aerobee');
  S.progs.aerobee.okf = AEROBEE_FLIGHTS_TO_UNLOCK;
  chenJoinTick();
  readyProgramme('viking'); // the Viking's propulsion slice has experiments in it
  S.cur = 'viking';
  S.b = 200000;
  S.crew.prop = 1;
  startLanes(100000);
  const routine = itemsInArea('p').filter(item => !item.dud && !isMilestone(item.id));
  giveResearch(routine.map(item => item.id));
  const next = nextPackage('p');
  assert.ok(next && next.dud, 'only experiments left, and the lead takes one');
  lanesTick();
  assert.equal(laneJob('p').id, next.id);
  assert.equal(laneIdleReason('s'), 'no BSTR yet');
});

// REED'S FACTORY BUDGET (rules/factory-lead.js): she keeps airframes on hand, upgrades them and publishes balanced blueprints.
const reedOnTheAerobee = async cap => {
  const factoryLead = await import('../js/rules/factory-lead.js');
  S.air.push(readyProgramme('aerobee'));
  S.cur = 'aerobee';
  S.b = 200000;
  S.staff.director = 1;
  factoryLead.reedJoinTick();
  assert.equal(factoryLead.startWorks(cap), null);
  return factoryLead;
};

test('Reed joins with the launch director and keeps airframes on hand within her budget', async () => {
  const { reedJoinTick, startWorks, worksTick, raiseWorks, AIRFRAMES_ON_HAND } = await import('../js/rules/factory-lead.js');
  const { memberJoined } = await import('../js/rules/team.js');
  assert.ok(!reedJoinTick() && !memberJoined('reed'), 'not before a launch director');
  assert.ok(startWorks(20000), 'no budget before she joins');
  await reedOnTheAerobee(20000);
  assert.ok(memberJoined('reed'));
  worksTick();
  worksTick();
  const onHand = () => S.air.filter(airframe => airframe.prog == 'aerobee').length + S.aq.filter(item => item.k == 'build' && item.prog == 'aerobee').length;
  assert.equal(onHand(), AIRFRAMES_ON_HAND, 'one airframe ready, one ordered, no more');
  assert.equal(S.works.built, 1);
  S.air = S.air.filter(airframe => airframe.prog != 'aerobee');
  S.works.cap = S.works.spent + 100;
  worksTick();
  assert.equal(S.works.dry, 'another airframe', 'the budget cannot cover the next order');
  raiseWorks();
  assert.equal(S.works.dry, null);
});

test('Reed holds a blueprint that lowers thrust-to-weight until the engine work catches up, or you say publish', async () => {
  const { worksTick, publishHeld, draftThrustToWeightChange, BALANCE_TOLERANCE } = await reedOnTheAerobee(80000);
  giveResearch(['prs']); // more propellant and a little dry mass: heavier for the same thrust
  assert.ok(draftThrustToWeightChange() < -BALANCE_TOLERANCE);
  worksTick();
  assert.equal(S.bp.rev, 1, 'held, not published');
  assert.ok(S.works.hold < 0);
  giveResearch(['noz']); // more thrust
  assert.ok(draftThrustToWeightChange() >= -BALANCE_TOLERANCE);
  worksTick();
  assert.equal(S.bp.rev, 2, 'balanced again: published');
  assert.equal(S.works.hold, null);
  giveResearch(['alloy']);
  S.pk.alloy.c = 0;
  S.pk.alloy.a = { t: .5 }; // the truth is a big thrust gain, but nobody has measured it yet
  S.pk.alloy.m = null;
  assert.ok(draftThrustToWeightChange() < -BALANCE_TOLERANCE, 'Reed judges on the estimate (more propellant), not the hidden truth');
  worksTick();
  assert.equal(S.bp.rev, 2);
  publishHeld();
  assert.equal(S.bp.rev, 3, 'you can publish the held draft yourself');
});

test('Reed upgrades a ready airframe that is behind the published blueprint', async () => {
  const { worksTick } = await reedOnTheAerobee(80000);
  giveResearch(['noz']);
  worksTick();
  assert.equal(S.bp.rev, 2);
  const upgrade = S.aq.find(item => item.k == 'retro' && item.prog == 'aerobee');
  assert.ok(upgrade, 'the ready airframe goes back for an upgrade');
  assert.equal(S.works.retro, 1);
  assert.equal(S.aq.filter(item => item.k == 'build').length, 1, 'the airframe away for its upgrade still counts as on hand');
});
