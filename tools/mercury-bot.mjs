// Phase Two bot: plays Project Mercury (Sections 1 and 2) with the real rules, after tools/balance.mjs has reached orbit.
// It forms NASA, picks astronauts, researches the spacecraft, buys the training and tracking facilities, earns man-rating
// and flies each Mercury directive in turn, the way a sensible player would. It reports when each directive was met.
// Section 2 (orbital Mercury, then Gemini) is played after Section 1 unless game.sectionOneOnly is set; Section 1's figures are
// taken the moment it completes, so they read the same either way.
import { S, freeTeams, withProgramme } from '../js/core/state.js';
import { PACKAGES, BY_ID, isMilestone } from '../js/data/research.js';
import { MISSION_TYPES, MERCURY_DIRECTIVES, OFFICE_DECISIONS, TESTING_REGIMES, CHIMP_TRAINING_COST, GEMINI_SEATS } from '../js/data/mercury.js';
import { FACILITIES, STATIONS } from '../js/data/launch-site.js';
import { FAILURE_MODES } from '../js/data/failures.js';
import { PROGRAMMES } from '../js/data/programmes.js';
import { researchLock, commission, itemsInArea } from '../js/rules/research.js';
import { unitCost, draftChanges, draftSize } from '../js/rules/production.js';
import { candidates, startLock, startProgramme, stagesOf, maturity } from '../js/rules/programs.js';
import { hire, engineeringTeamCost } from '../js/rules/game.js';
import { orderAirframes, publishBlueprint, buildTeams, buildTeamCost } from '../js/rules/factory.js';
import { startInvestigation, chooseFix, INVESTIGATION_COST } from '../js/rules/jobs.js';
import { runPoll, scrub, facilityLock, buildFacility, stationLock, hireStation, troubleshoot, groundTest, groundTestLock, PAD_FIX_COST } from '../js/rules/launch-site.js';
import { nasaReady, formNasa } from '../js/rules/race.js';
import { directiveDone, openDirectives, boosterPlan, crewLock, orderCapsule, requirementText, capsuleSystems, targetUp } from '../js/rules/mercury.js';
import { beginMission, stepMission, endMission, decisionOptions, decisionOdds, chooseOption, missionStepSeconds } from '../js/rules/mission.js';
import { chooseTestingRegime, startChimpTraining, answerOfficeDecision } from '../js/rules/astronaut-office.js';
import { selectCrew, skillEstimate, isQualified, assignPilot, assignedPilot, assignBackup, backupPilot, assignThirdCrew, thirdCrew } from '../js/rules/astronauts.js';
import { manRatingResearchDone, isManRated, isFamilyCertified } from '../js/rules/manrate.js';
import { setRequest, REQUEST_RANGE, operationsPerYear } from '../js/rules/budget.js';
import { STUDY_SIZES, ARCHITECTURE_ORDER } from '../js/data/apollo.js';
import { decideRollover, startStudy, estimate, chooseArchitecture } from '../js/rules/apollo.js';
import { capabilityShown } from '../js/rules/mercury.js';
import { curesReady, startCure } from '../js/rules/cures.js';
import { barVerdict, testsPending } from '../js/rules/safety.js';
import { openRequest, reasonOnFile, answerRequest, shield, shieldReady } from '../js/rules/requests.js';
import { pressure } from '../js/rules/pressure.js';

// Facilities and launch-crew stations, in the order the bot buys them. The tracking network takes ten months to build, so it goes first.
// The Gemini buildings open once Mercury is complete.
const BUY = [['fac', 'trknet'], ['fac', 'centrifuge'], ['fac', 'ptrain'], ['fac', 'mcc'], ['crew', 'capcom'], ['crew', 'surg'], ['fac', 'egress'], ['fac', 'recov'], ['fac', 'clean'], ['fac', 'msim'], ['crew', 'upl'], ['fac', 'gsim'], ['fac', 'altch']];
// Spacecraft and escape research: every package as it is proposed (cheapest first, the Gemini spacecraft design before the rest),
// and one approach for each milestone. The bolted hatch never blows on its own; the ablative shield also works for orbit.
const SPACECRAFT_MILESTONES = ['ms_ablh', 'ms_hbolt', 'ms_mqual', 'ms_mrman'];
const spacecraftResearch = () => [...PACKAGES.filter(item => (item.area == 'c' || item.area == 'e') && !item.dud), ...SPACECRAFT_MILESTONES.map(id => BY_ID[id])]
  .sort((first, second) => (first.id == 'gm_cap' ? 0 : first.cost) - (second.id == 'gm_cap' ? 0 : second.cost)).map(item => item.id);
// The rocket's own research, as the Phase One bot does it.
const boosterResearch = () => ['p', 's', 'i', 'a'].flatMap(itemsInArea).sort((first, second) => first.cost - second.cost).map(item => item.id);
const readyProgrammes = () => Object.keys(S.progs).filter(kind => S.progs[kind].ready);

// game: { advance(seconds), now() in seconds, flyLaunch(airframe, ballastOnly, payload) returning the flight's result, maxSeconds, saturnSeconds, sectionOneOnly }
// Returns { nasaAt, directiveTimes, missions, missionFails, astronautsLost, launches, done, sectionOne, sectionTwoDone, mercuryAt, geminiDone, geminiAt, saturnAt, saturnLaunches, barOverrides, requests, briefings, peakPressure }.
// sectionTwoDone: Mercury is complete, at mercuryAt (seconds), with the counts and budget then in atMercury;
// geminiDone: every Gemini directive built so far is met, at geminiAt; saturnAt: a Saturn I first put a boilerplate in orbit, after saturnLaunches;
// barOverrides: crewed launches flown past the safety bar; requests: lead requests answered; briefings: press briefings held; peakPressure: the highest any pressure on Apollo reached.
// sectionOne: { at (seconds), budget, date day, missions, missionFails, astronautsLost, launches, human } when Section 1 completed.
export function playMercury(game) {
  const report = { nasaAt: null, directiveTimes: [], missions: 0, missionFails: 0, astronautsLost: 0, launches: 0, done: false, sectionOne: null, sectionTwoDone: false, mercuryAt: null, geminiDone: false, geminiAt: null, saturnAt: null, saturnLaunches: 0, barOverrides: 0, requests: 0, briefings: 0, peakPressure: 0 };
  const financialReserve = () => Math.max(15000, Math.ceil(operationsPerYear() / 6));
  // Programmes known not to deliver a mission type: "mr:wac" and so on, so the bot does not keep building them.
  // For the orbital flight the blueprint revision is part of the key: research can make a rocket fast enough later.
  const tooSmall = {};
  const shortKey = (missionType, kind, revision) => MISSION_TYPES[missionType].orbital ? `${missionType}:${kind}:${revision}` : missionType + ':' + kind;
  // Programmes fast enough but over their heating or aero limits with a capsule aboard: their aerodynamics research comes first.
  const overLimit = {};
  const markDirectives = () => {
    // Parallel goals met out of order count when they are met.
    while (S.p2 && report.directiveTimes.length < MERCURY_DIRECTIVES.filter(directive => directiveDone(directive.key)).length) report.directiveTimes.push(game.now() - report.nasaAt);
  };
  // Pressure on Apollo: refuse a lead's request with the evidence on file when there is some, else have it proved by a test first,
  // and refuse if the test still gives no reason; brief the press when they are hounding NASA.
  const answerPressure = () => {
    const request = openRequest();
    if (request && !request.prove) {
      const answer = reasonOnFile(request) ? 'reasoned' : request.pv ? 'refuse' : 'prove';
      answerRequest(answer);
      if (answer != 'prove') report.requests++;
    }
    if (pressure()) report.peakPressure = Math.max(report.peakPressure, pressure().press, pressure().pub, pressure().cong);
    if (pressure() && pressure().press >= 75 && shieldReady('briefing') && !shield('briefing')) report.briefings++;
  };
  const advance = seconds => {
    game.advance(seconds);
    markDirectives();
    answerPressure();
  };

  // The best ready airframe for a mission type: the cheapest programme whose airframe delivers what the mission needs.
  const boosterFor = missionType => {
    const ready = S.air.filter(airframe => airframe.st == 'r').sort((first, second) => PROGRAMMES[first.prog].unitCost - PROGRAMMES[second.prog].unitCost);
    for (const airframe of ready) {
      for (const propellant of PROGRAMMES[airframe.prog].propellants) {
        const plan = boosterPlan(airframe, propellant, missionType);
        if (plan.ok) return { airframe, propellant, plan };
        if (plan.overLimit) overLimit[airframe.prog] = 1;
      }
      if (!overLimit[airframe.prog]) tooSmall[shortKey(missionType, airframe.prog, airframe.rev)] = 1;
    }
    return null;
  };
  // Order one airframe of the cheapest programme not yet known to fall short (one airframe on order at a time).
  // Gemini flies only on its own booster.
  const orderBoosterFor = (missionType, reserve) => {
    if (S.aq.some(item => item.k == 'build')) return;
    const kinds = readyProgrammes().filter(kind => !MISSION_TYPES[missionType].gemini || PROGRAMMES[kind].needsGemini).filter(kind => !tooSmall[shortKey(missionType, kind, S.progs[kind].bp.rev)] && !S.air.some(airframe => airframe.st == 'r' && airframe.prog == kind && airframe.rev == S.progs[kind].bp.rev)).sort((first, second) => PROGRAMMES[first].unitCost - PROGRAMMES[second].unitCost);
    if (!kinds.length) return;
    withProgramme(kinds[0], () => {
      if (S.b >= unitCost() + reserve) orderAirframes(1);
    });
  };
  // Fly the newest orbital-class rocket as an ordinary launch, ordering an airframe of it first if none is in the hangar.
  const testFlyOrbitalRocket = reserve => {
    const kind = readyProgrammes().filter(each => PROGRAMMES[each].canOrbit).sort((first, second) => PROGRAMMES[second].generation - PROGRAMMES[first].generation)[0];
    const airframe = kind && S.air.find(each => each.st == 'r' && each.prog == kind);
    if (!airframe) {
      if (kind && !S.aq.some(item => item.k == 'build')) withProgramme(kind, () => {
        if (S.b >= unitCost() + reserve) orderAirframes(1);
      });
      return advance(2);
    }
    game.flyLaunch(airframe);
    report.launches++;
    markDirectives();
  };
  // Choose the option most likely to work, as a pilot (or the automatics) would. Short of fuel or power with orbits still needed
  // for the directive, try to stretch them before settling for coming home early; push on with a spacewalk the directive needs.
  const decide = mission => {
    const key = mission.pending.key, directive = MERCURY_DIRECTIVES[S.p2.dir];
    let options = decisionOptions(mission, key).filter(option => option.available);
    const stillNeeded = directive && ((key == 'fuel' || key == 'cells') && mission.orbitsFlown < (directive.orbits || 0) || key == 'eva' && directive.eva || key == 'rdv' && (directive.rendezvous || directive.dock));
    if (stillNeeded && options.some(option => !option.soft)) options = options.filter(option => !option.soft);
    const best = options.sort((first, second) => decisionOdds(mission, key, second) - decisionOdds(mission, key, first))[0];
    chooseOption(mission, best.index);
  };
  // Fly one Mercury mission. Real time on screen: a 30 s count, a quarter-second per step, and five seconds for each decision.
  // The safety bar: a crew waits for the ground tests on its rocket's revision, then flies, past the bar if it must (a player
  // with a schedule to keep would).
  const flyMission = (capsule, booster, crew, orbits, target = null) => {
    const barred = !['none', 'chimp', 'monkey'].includes(crew) && barVerdict(booster.airframe.prog, booster.airframe);
    if (barred && testsPending(booster.airframe.prog)) return advance(5);
    if (barred) report.barOverrides++;
    const poll = runPoll(booster.airframe, booster.propellant, booster.plan.staged);
    if (poll.nogo && S.b > PAD_FIX_COST) troubleshoot(poll);
    if (poll.nogo) {
      scrub(poll);
      return advance(3);
    }
    const eva = !!(directive => directive && directive.eva)(MERCURY_DIRECTIVES[S.p2.dir]);
    const mission = beginMission(capsule.id, crew, { af: booster.airframe.id, fuel: booster.propellant, latent: poll.fault, wind: poll.wind, orbits, eva, target, overBar: !!barred });
    if (!mission) return advance(1);
    let steps = 0, decisions = 0, result;
    do {
      result = stepMission(mission, missionStepSeconds(mission));
      steps++;
      if (result == 'decide') {
        decide(mission);
        decisions++;
      }
    } while (result != 'end');
    const outcome = endMission(mission);
    report.missions++;
    if (!outcome.ok) report.missionFails++;
    if (outcome.lost && mission.crew && !mission.crew.species) report.astronautsLost++;
    if (process.env.TRACE) console.log(`  P2 t=${(game.now() / 60).toFixed(1)}m dir ${S.p2.dir} ${mission.type.name} on ${booster.airframe.label} crew ${crew} -> ${outcome.ok ? 'ok' : 'FAIL'}${outcome.met ? ' MET' : ''}${outcome.lost ? ' LOST' : ''} $${Math.round(S.b)}`);
    advance(30 + Math.ceil(steps / 4) + 5 * decisions);
  };

  // Each rocket's incidents, then those of its lower stages (rules/stages.js).
  const workIncidents = reserve => {
    for (const kind of readyProgrammes().flatMap(kind => [kind, ...stagesOf(kind)])) withProgramme(kind, () => {
      for (const incident of S.inc) {
        if (!freeTeams()) break;
        if (incident.st == 'open' && S.b - INVESTIGATION_COST >= reserve) startInvestigation(incident.id);
        else if (incident.st == 'diag') for (const fix of FAILURE_MODES[incident.dx].fixes.slice().sort((first, second) => first.riskMultiplier - second.riskMultiplier)) if (S.b - fix.cost >= reserve && freeTeams()) {
          chooseFix(incident.id, fix.id);
          break;
        }
      }
      // A flaw whose cause the team has found: order its cure (rules/cures.js).
      for (const cure of curesReady(kind)) if (freeTeams() && S.b - cure.cost >= reserve) startCure(kind, cure.traitKey);
    });
  };
  // Apollo: the Mercury lead goes with the team, the full study once affordable, and the lowest-risk estimate once Gemini has
  // docked (or when Gemini is complete, whatever it has flown).
  const planApollo = () => {
    const project = S.p2.ap;
    if (!project) return;
    if (project.lead === undefined) decideRollover(true);
    if (!project.sz) startStudy(S.b > STUDY_SIZES.full.cost + 100000 ? 'full' : 'quick');
    if (project.done && !project.arch && (capabilityShown('dock') || S.p2.gemDone))
      chooseArchitecture(ARCHITECTURE_ORDER.slice().sort((first, second) => estimate(first, 'risk').mid - estimate(second, 'risk').mid)[0]);
  };
  // Research a rocket and fly one of its airframes (ordering one when the hangar has none): cargo as for game.flyLaunch.
  const workRocket = (kind, reserve, cargo) => {
    withProgramme(kind, () => {
      if (draftSize(draftChanges())) publishBlueprint();
    });
    if (S.teams < 6 && S.b > engineeringTeamCost() + reserve + 30000) hire('team');
    workIncidents(reserve);
    withProgramme(kind, () => {
      for (const id of boosterResearch()) if (freeTeams() && !researchLock(id) && S.b - BY_ID[id].cost * PROGRAMMES[S.cur].costScale >= reserve) commission(id);
    });
    const airframe = S.air.find(each => each.st == 'r' && each.prog == kind);
    if (!airframe) {
      if (!S.aq.some(item => item.k == 'build')) withProgramme(kind, () => {
        if (S.b >= unitCost() + reserve) orderAirframes(1);
      });
      advance(5);
      return null;
    }
    return game.flyLaunch(airframe, false, cargo);
  };
  // SATURN I, once Gemini is complete: start it when the architecture is chosen (maturing the Titan II or Atlas first if neither
  // has), build LC-34, and research and fly it with Apollo boilerplates until one reaches orbit, for up to game.saturnSeconds.
  // Commission sends each propulsion and structures package to the S-I or S-IV, whichever is behind.
  const flySaturn = () => {
    const reserve = 15000, until = game.now() + (game.saturnSeconds || 0);
    while (game.now() < until && report.saturnAt === null) {
      planApollo();
      if (S.fy && S.b < 150000) setRequest(REQUEST_RANGE[1]);
      if (!S.progs.saturn1) {
        const lock = startLock('saturn1');
        if (!lock && S.b - PROGRAMMES.saturn1.cost > reserve) startProgramme('saturn1');
        const unripe = lock && lock.startsWith('Needs') && PROGRAMMES.saturn1.requires.filter(kind => S.progs[kind] && S.progs[kind].ready).sort((first, second) => maturity(second) - maturity(first))[0];
        if (unripe) workRocket(unripe, reserve);
        else advance(5);
        continue;
      }
      if (!facilityLock('lc34') && S.b - FACILITIES.lc34.cost > reserve) buildFacility('lc34');
      if (!S.progs.saturn1.ready) {
        advance(5);
        continue;
      }
      const result = workRocket('saturn1', reserve, 'Apollo Boilerplate');
      if (result) report.saturnLaunches++;
      if (result == 'orbit') report.saturnAt = game.now();
    }
  };

  while (game.now() < game.maxSeconds) {
    if (!S.nasa) {
      if (nasaReady()) formNasa();
      else advance(5);
      continue;
    }
    if (report.nasaAt === null) report.nasaAt = game.now();
    const state = S.p2;
    if (!state) {
      advance(1);
      continue;
    }
    markDirectives();
    if (state.secDone && !report.done) {
      report.done = true;
      report.sectionOne = { at: game.now(), budget: S.b, date: S.p2.secDone, missions: report.missions, missionFails: report.missionFails, astronautsLost: report.astronautsLost, launches: report.launches, human: S.fs.f_human };
      if (game.sectionOneOnly) break;
    }
    if (state.mercDone && !report.sectionTwoDone) {
      report.sectionTwoDone = true;
      report.mercuryAt = game.now();
      report.atMercury = { missions: report.missions, missionFails: report.missionFails, astronautsLost: report.astronautsLost, launches: report.launches, budget: S.b };
    }
    planApollo();
    if (state.gemDone) {
      report.geminiDone = true;
      break;
    }
    // The parallel Gemini goals: the rendezvous or docking once both seats have trained for it, the long flight meanwhile.
    const open = openDirectives(), trained = GEMINI_SEATS.every(seat => (assignedPilot(seat) || { reh: {} }).reh.rdv);
    const directive = (trained && open.find(each => each.rendezvous || each.dock)) || open.find(each => !each.rendezvous && !each.dock) || open[0];
    const reserve = financialReserve(), key = directive.key, orbital = state.secDone, gemini = state.fl.gem;

    // Blueprints, staff and facilities.
    // A booster milestone starts a new man-rating family, so a certified booster's blueprint only takes fixes and packages.
    for (const kind of readyProgrammes()) withProgramme(kind, () => {
      const draft = draftChanges();
      if (isFamilyCertified(kind) && draft.packages.some(isMilestone)) return;
      if (draftSize(draft)) publishBlueprint();
    });
    if (S.teams < 6 && S.b > engineeringTeamCost() + reserve + 30000) hire('team');
    // Short of money: ask Congress for more next year.
    if (S.fy && S.b < 150000) setRequest(REQUEST_RANGE[1]);
    if (orbital && buildTeams() < 3 && S.b > buildTeamCost() + reserve + 30000) hire('bteam');
    // A rocket with launch complexes of its own needs its first pad as soon as the programme starts (construction takes months).
    for (const id of Object.keys(FACILITIES).filter(each => FACILITIES[each].pad && S.progs[FACILITIES[each].pad] && !FACILITIES[each].requires))
      if (!facilityLock(id) && S.b - FACILITIES[id].cost > reserve) buildFacility(id);
    for (const [kind, id] of BUY) {
      if (kind == 'fac' && !facilityLock(id) && S.b - FACILITIES[id].cost > reserve) buildFacility(id);
      if (kind == 'crew' && !stationLock(id) && S.b - STATIONS[id].cost > reserve) hireStation(id);
    }

    // The Astronaut Office: test thoroughly, pick the seven best estimates, train the chimpanzees, and accept what is affordable.
    if (state.sel.st == 1) chooseTestingRegime(S.b > TESTING_REGIMES.full.cost + reserve ? 'full' : 'std');
    if (state.sel.st == 3) {
      const total = candidate => ['pil', 'sys', 'end', 'com'].reduce((sum, skill) => sum + skillEstimate(candidate, skill).value, 0);
      selectCrew(state.pool.filter(candidate => !candidate.dq).sort((first, second) => total(second) - total(first)).slice(0, 7).map(candidate => candidate.id));
    }
    if (!state.ch.on && state.dir >= 1 && S.b > CHIMP_TRAINING_COST + reserve) startChimpTraining();
    if (state.od) answerOfficeDecision(S.b > (OFFICE_DECISIONS[state.od].cost || 0) + reserve);
    // Section 2 assigns the orbital pilot early, so mission training is done by the time a crew may fly. Gemini fills both seats.
    const pilotFor = gemini ? 'gt' : orbital ? 'mo' : 'mr', seats = gemini ? GEMINI_SEATS : [pilotFor];
    const skill = astronaut => astronaut.t.pil + astronaut.t.sys;
    for (const seat of seats) if ((key == 'crew' || orbital) && !assignedPilot(seat)) {
      const best = state.astros.filter(astronaut => isQualified(astronaut) && !(gemini && (seats.includes(astronaut.asg) || astronaut.bk))).sort((first, second) => skill(second) - skill(first))[0];
      if (best) assignPilot(best.id, seat);
    }
    // In orbit a backup trains alongside, so the next pilot is ready when this one has flown.
    for (const seat of seats) if (orbital && assignedPilot(seat) && !backupPilot(seat)) {
      const best = state.astros.filter(astronaut => isQualified(astronaut) && !astronaut.asg && !(gemini && astronaut.bk)).sort((first, second) => skill(second) - skill(first))[0];
      if (best) assignBackup(best.id, seat);
    }
    // Gemini rotates three crews, as NASA did: a third crew trains for the flight after the backup's.
    for (const seat of seats) if (gemini && backupPilot(seat) && !thirdCrew(seat)) {
      const best = state.astros.filter(astronaut => isQualified(astronaut) && !astronaut.asg && !astronaut.bk && !astronaut.nx).sort((first, second) => skill(second) - skill(first))[0];
      if (best) assignThirdCrew(best.id, seat);
    }

    // Research: spacecraft first, then the newest rocket; ground-test spacecraft work so it counts toward breakthroughs.
    for (const id of spacecraftResearch()) if (freeTeams() && !researchLock(id) && S.b - BY_ID[id].cost >= reserve) commission(id);
    for (const id of Object.keys(S.g.pk)) if (freeTeams() && !groundTestLock(id) && S.b > reserve) groundTest(id);
    for (const candidate of candidates()) if (!startLock(candidate) && S.b - PROGRAMMES[candidate].cost > reserve + 40000) startProgramme(candidate);
    workIncidents(reserve);
    for (const kind in overLimit) withProgramme(kind, () => {
      for (const id of itemsInArea('a').map(item => item.id)) if (freeTeams() && !researchLock(id) && S.b - BY_ID[id].cost * PROGRAMMES[S.cur].costScale >= reserve) commission(id);
    });
    const newest = readyProgrammes().sort((first, second) => PROGRAMMES[second].generation - PROGRAMMES[first].generation)[0];
    withProgramme(newest, () => {
      for (const id of boosterResearch()) if (freeTeams() && !researchLock(id) && S.b - BY_ID[id].cost * PROGRAMMES[S.cur].costScale >= reserve + 20000) commission(id);
    });

    // MAN-RATING: three clean flights in a row by the booster family (suborbital in Section 1, orbital in Section 2), flown as ordinary launches.
    const ratedFor = gemini ? 'gt' : orbital ? 'mo' : 'mr', crewKey = key == 'crew' || key == 'ocrew' || key == 'oday' || !!directive.crew;
    const needsRating = key == 'rate' || key == 'orate' || (crewKey && (booster => booster && !isManRated(booster.airframe))(boosterFor(ratedFor)));
    if (needsRating) {
      const booster = boosterFor(ratedFor);
      if (!booster) {
        orderBoosterFor(ratedFor, reserve);
        advance(1);
        continue;
      }
      if (!manRatingResearchDone(booster.airframe.prog)) {
        advance(2);
        continue;
      }
      if (!S.aq.some(item => item.k == 'build')) withProgramme(booster.airframe.prog, () => {
        if (S.b >= unitCost() + reserve) orderAirframes(1);
      });
      game.flyLaunch(booster.airframe, true);
      report.launches++;
      markDirectives();
      continue;
    }

    // THE MISSION for this directive: a capsule (one that lasts the orbits needed), a booster that can deliver it, and who rides.
    const missionType = directive.missionType, orbits = directive.orbits;
    if (requirementText(missionType)) {
      advance(2);
      continue;
    }
    const lastsLongEnough = each => !orbits || capsuleSystems(each.cfg, missionType).endurance >= orbits;
    // Gemini spacecraft need the manoeuvring system, the spacewalk suit and the rendezvous radar aboard for the directives that use them.
    const target = directive.dock ? 'dock' : directive.rendezvous ? 'rdv' : null;
    const builtFor = each => lastsLongEnough(each) && (!directive.manoeuvre || each.cfg.pk.includes('gm_oams')) && (!directive.eva || each.cfg.pk.includes('gm_eva')) && (!target || each.cfg.pk.includes('gm_rdv'));
    const blueprint = { cfg: { pk: Object.keys(S.g.pk), rev: S.g.bp.rev } };
    if (!builtFor(blueprint) || directive.eva && !S.fac.altch) {
      advance(2);
      continue;
    }
    const capsule = state.veh.find(each => each.mt == missionType && builtFor(each));
    // An Agena target takes a while to build: start one as soon as a rendezvous or docking directive is coming.
    if (gemini && MERCURY_DIRECTIVES.slice(state.dir).some(each => each.rendezvous || each.dock) && !state.veh.some(each => each.mt == 'ag') && !S.aq.some(item => item.k == 'msn' && item.mt == 'ag') && !requirementText('ag') && S.b >= MISSION_TYPES.ag.cost + reserve) orderCapsule('ag');
    if (!capsule && !S.aq.some(item => item.k == 'msn' && item.mt == missionType && builtFor(item)) && S.b >= MISSION_TYPES[missionType].cost + reserve) orderCapsule(missionType);
    const booster = boosterFor(missionType);
    if (!booster) orderBoosterFor(missionType, reserve);
    // In orbit there is money to spare, so keep the next booster and capsule coming while this one flies, as a player would.
    if (orbital && booster && !S.aq.some(item => item.k == 'build') && S.air.filter(each => each.st == 'r' && each.prog == booster.airframe.prog).length < 2) withProgramme(booster.airframe.prog, () => {
      if (S.b >= unitCost() + reserve) orderAirframes(1);
    });
    if (orbital && capsule && state.veh.filter(each => each.mt == missionType && builtFor(each)).length < 2 && !S.aq.some(item => item.k == 'msn' && item.mt == missionType && builtFor(item)) && S.b >= MISSION_TYPES[missionType].cost + reserve) orderCapsule(missionType);
    // No rocket fast enough for orbit with a capsule yet: test-fly the newest orbital-class rocket, so its research is confirmed
    // and the engineers propose more (a rocket that never flies never improves).
    if (!booster && orbital) {
      testFlyOrbitalRocket(reserve);
      continue;
    }
    const crew = key == 'lj' ? (!state.lj.mk && !crewLock('monkey') ? 'monkey' : 'none')
      : key == 'animal' || key == 'oanimal' ? 'chimp'
      : crewKey ? (assignedPilot(pilotFor) || {}).id
      : 'none';
    if (!capsule || !booster || crew === undefined || crewLock(crew, booster.airframe, missionType)) {
      advance(2);
      continue;
    }
    // RENDEZVOUS AND DOCKING: keep an Agena target built ahead, as a player would. Once the Gemini flight is otherwise ready and both
    // crew have trained for rendezvous, put the Agena up first (it lasts three months), on the cheapest booster that can carry it.
    if (target) {
      const agena = state.veh.find(each => each.mt == 'ag'), agenaBooster = boosterFor('ag');
      if (!agena && !S.aq.some(item => item.k == 'msn' && item.mt == 'ag') && !requirementText('ag') && S.b >= MISSION_TYPES.ag.cost + reserve) orderCapsule('ag');
      if (!agenaBooster) orderBoosterFor('ag', reserve);
      if (!trained) {
        advance(2);
        continue;
      }
      if (!targetUp()) {
        if (agena && agenaBooster) flyMission(agena, agenaBooster, 'none', 1);
        else advance(2);
        continue;
      }
    }
    flyMission(capsule, booster, crew, orbits, target);
  }
  markDirectives();
  if (report.geminiDone) {
    report.geminiAt = game.now();
    report.geminiBudget = S.b;
    flySaturn();
  }
  return report;
}
