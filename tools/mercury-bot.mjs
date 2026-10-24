// Phase Two bot: plays Project Mercury (Sections 1 and 2) with the real rules, after tools/balance.mjs has reached orbit.
// It forms NASA, picks astronauts, researches the spacecraft, buys the training and tracking facilities, earns man-rating
// and flies each Mercury directive in turn, the way a sensible player would. It reports when each directive was met.
// Section 2 (orbital Mercury) is played after Section 1 unless game.sectionOneOnly is set; Section 1's figures are taken the
// moment it completes, so they read the same either way.
import { S, freeTeams, withProgramme } from '../js/core/state.js';
import { PACKAGES, BY_ID, isMilestone } from '../js/data/research.js';
import { MISSION_TYPES, MERCURY_DIRECTIVES, OFFICE_DECISIONS, TESTING_REGIMES, CHIMP_TRAINING_COST } from '../js/data/mercury.js';
import { FACILITIES, STATIONS } from '../js/data/launch-site.js';
import { FAILURE_MODES } from '../js/data/failures.js';
import { PROGRAMMES } from '../js/data/programmes.js';
import { researchLock, commission, itemsInArea } from '../js/rules/research.js';
import { unitCost, draftChanges } from '../js/rules/production.js';
import { candidates, startLock, startProgramme } from '../js/rules/programs.js';
import { hire, engineeringTeamCost } from '../js/rules/game.js';
import { orderAirframes, publishBlueprint } from '../js/rules/factory.js';
import { startInvestigation, chooseFix, INVESTIGATION_COST } from '../js/rules/jobs.js';
import { runPoll, scrub, facilityLock, buildFacility, stationLock, hireStation, troubleshoot, groundTest, groundTestLock, PAD_FIX_COST } from '../js/rules/launch-site.js';
import { nasaReady, formNasa } from '../js/rules/race.js';
import { directiveKey, boosterPlan, crewLock, orderCapsule, requirementText, capsuleSystems } from '../js/rules/mercury.js';
import { beginMission, stepMission, endMission, decisionOptions, decisionOdds, chooseOption, missionStepSeconds } from '../js/rules/mission.js';
import { chooseTestingRegime, startChimpTraining, answerOfficeDecision } from '../js/rules/astronaut-office.js';
import { selectCrew, skillEstimate, isQualified, assignPilot, assignedPilot } from '../js/rules/astronauts.js';
import { manRatingResearchDone, isManRated, isFamilyCertified } from '../js/rules/manrate.js';

// Facilities and launch-crew stations, in the order the bot buys them. The tracking network takes ten months to build, so it goes first.
const BUY = [['fac', 'trknet'], ['fac', 'centrifuge'], ['fac', 'ptrain'], ['fac', 'mcc'], ['crew', 'capcom'], ['crew', 'surg'], ['fac', 'egress'], ['fac', 'recov'], ['fac', 'clean'], ['fac', 'msim'], ['crew', 'upl']];
// Spacecraft and escape research: every package as it is proposed (cheapest first), and one approach for each milestone.
// The bolted hatch never blows on its own; the ablative shield also works for orbit.
const SPACECRAFT_MILESTONES = ['ms_ablh', 'ms_hbolt', 'ms_mqual', 'ms_mrman'];
const spacecraftResearch = () => [...PACKAGES.filter(item => (item.area == 'c' || item.area == 'e') && !item.dud), ...SPACECRAFT_MILESTONES.map(id => BY_ID[id])]
  .sort((first, second) => first.cost - second.cost).map(item => item.id);
// The rocket's own research, as the Phase One bot does it.
const boosterResearch = () => ['p', 's', 'i', 'a'].flatMap(itemsInArea).sort((first, second) => first.cost - second.cost).map(item => item.id);
const readyProgrammes = () => Object.keys(S.progs).filter(kind => S.progs[kind].ready);

// game: { advance(seconds), now() in seconds, flyLaunch(airframe, ballastOnly), maxSeconds, sectionOneOnly }
// Returns { nasaAt, directiveTimes, missions, missionFails, astronautsLost, launches, done, sectionOne, sectionTwoDone }.
// sectionOne: { at (seconds), budget, date day, missions, missionFails, astronautsLost, launches, human } when Section 1 completed.
export function playMercury(game) {
  const report = { nasaAt: null, directiveTimes: [], missions: 0, missionFails: 0, astronautsLost: 0, launches: 0, done: false, sectionOne: null, sectionTwoDone: false };
  // Programmes known not to deliver a mission type: "mr:wac" and so on, so the bot does not keep building them.
  // For the orbital flight the blueprint revision is part of the key: research can make a rocket fast enough later.
  const tooSmall = {};
  const shortKey = (missionType, kind, revision) => missionType == 'mo' ? `${missionType}:${kind}:${revision}` : missionType + ':' + kind;
  // Programmes fast enough but over their heating or aero limits with a capsule aboard: their aerodynamics research comes first.
  const overLimit = {};
  const markDirectives = () => {
    while (S.p2 && report.directiveTimes.length < S.p2.dir) report.directiveTimes.push(game.now() - report.nasaAt);
  };
  const advance = seconds => {
    game.advance(seconds);
    markDirectives();
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
  const orderBoosterFor = (missionType, reserve) => {
    if (S.aq.some(item => item.k == 'build')) return;
    const kinds = readyProgrammes().filter(kind => !tooSmall[shortKey(missionType, kind, S.progs[kind].bp.rev)] && !S.air.some(airframe => airframe.st == 'r' && airframe.prog == kind && airframe.rev == S.progs[kind].bp.rev)).sort((first, second) => PROGRAMMES[first].unitCost - PROGRAMMES[second].unitCost);
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
  // Choose the option most likely to work, as a pilot (or the automatics) would. Short of fuel with orbits still needed for the
  // directive, try to stretch the fuel before settling for coming home early.
  const decide = mission => {
    const key = mission.pending.key, directive = MERCURY_DIRECTIVES[S.p2.dir];
    let options = decisionOptions(mission, key).filter(option => option.available);
    if (key == 'fuel' && directive && mission.orbitsFlown < (directive.orbits || 0) && options.some(option => !option.soft)) options = options.filter(option => !option.soft);
    const best = options.sort((first, second) => decisionOdds(mission, key, second) - decisionOdds(mission, key, first))[0];
    chooseOption(mission, best.index);
  };
  // Fly one Mercury mission. Real time on screen: a 30 s count, a quarter-second per step, and five seconds for each decision.
  const flyMission = (capsule, booster, crew, orbits) => {
    const poll = runPoll(booster.airframe, booster.propellant, booster.plan.staged);
    if (poll.nogo && S.b > PAD_FIX_COST) troubleshoot(poll);
    if (poll.nogo) {
      scrub(poll);
      return advance(3);
    }
    const mission = beginMission(capsule.id, crew, { af: booster.airframe.id, fuel: booster.propellant, latent: poll.fault, wind: poll.wind, orbits });
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
    if (state.mercDone) {
      report.sectionTwoDone = true;
      break;
    }
    const reserve = 15000, key = directiveKey();
    const directive = MERCURY_DIRECTIVES[state.dir], orbital = state.secDone;

    // Blueprints, staff and facilities.
    // A booster milestone starts a new man-rating family, so a certified booster's blueprint only takes fixes and packages.
    for (const kind of readyProgrammes()) withProgramme(kind, () => {
      const draft = draftChanges();
      if (isFamilyCertified(kind) && draft.packages.some(isMilestone)) return;
      if (draft.packages.length + draft.fixes.length) publishBlueprint();
    });
    if (S.teams < 6 && S.b > engineeringTeamCost() + reserve + 30000) hire('team');
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
    // Section 2 assigns the orbital pilot early, so mission training is done by the time a crew may fly.
    const pilotFor = orbital ? 'mo' : 'mr';
    if ((key == 'crew' || orbital) && !assignedPilot(pilotFor)) {
      const skill = astronaut => astronaut.t.pil + astronaut.t.sys;
      const best = state.astros.filter(isQualified).sort((first, second) => skill(second) - skill(first))[0];
      if (best) assignPilot(best.id, pilotFor);
    }

    // Research: spacecraft first, then the newest rocket; ground-test spacecraft work so it counts toward breakthroughs.
    for (const id of spacecraftResearch()) if (freeTeams() && !researchLock(id) && S.b - BY_ID[id].cost >= reserve) commission(id);
    for (const id of Object.keys(S.g.pk)) if (freeTeams() && !groundTestLock(id) && S.b > reserve) groundTest(id);
    for (const candidate of candidates()) if (!startLock(candidate) && S.b - PROGRAMMES[candidate].cost > reserve + 40000) startProgramme(candidate);
    for (const kind of readyProgrammes()) withProgramme(kind, () => {
      for (const incident of S.inc) {
        if (!freeTeams()) break;
        if (incident.st == 'open' && S.b - INVESTIGATION_COST >= reserve) startInvestigation(incident.id);
        else if (incident.st == 'diag') for (const fix of FAILURE_MODES[incident.dx].fixes.slice().sort((first, second) => first.riskMultiplier - second.riskMultiplier)) if (S.b - fix.cost >= reserve && freeTeams()) {
          chooseFix(incident.id, fix.id);
          break;
        }
      }
    });
    for (const kind in overLimit) withProgramme(kind, () => {
      for (const id of itemsInArea('a').map(item => item.id)) if (freeTeams() && !researchLock(id) && S.b - BY_ID[id].cost * PROGRAMMES[S.cur].costScale >= reserve) commission(id);
    });
    const newest = readyProgrammes().sort((first, second) => PROGRAMMES[second].generation - PROGRAMMES[first].generation)[0];
    withProgramme(newest, () => {
      for (const id of boosterResearch()) if (freeTeams() && !researchLock(id) && S.b - BY_ID[id].cost * PROGRAMMES[S.cur].costScale >= reserve + 20000) commission(id);
    });

    // MAN-RATING: three clean flights in a row by the booster family (suborbital in Section 1, orbital in Section 2), flown as ordinary launches.
    const ratedFor = orbital ? 'mo' : 'mr', crewKey = key == 'crew' || key == 'ocrew' || key == 'oday';
    const needsRating = key == 'rate' || key == 'orate' || (crewKey && (booster => booster && !isManRated(booster.airframe))(boosterFor(ratedFor)));
    if (needsRating) {
      const booster = boosterFor(ratedFor);
      if (!booster) {
        orderBoosterFor(ratedFor, reserve);
        advance(1);
        continue;
      }
      if (!manRatingResearchDone()) {
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
    const lastsLongEnough = each => !orbits || capsuleSystems(each.cfg).endurance >= orbits;
    if (orbits && orbits > capsuleSystems({ pk: Object.keys(S.g.pk), rev: S.g.bp.rev }).endurance) {
      advance(2);
      continue;
    }
    const capsule = state.veh.find(each => each.mt == missionType && lastsLongEnough(each));
    if (!capsule && !S.aq.some(item => item.k == 'msn' && item.mt == missionType && lastsLongEnough(item)) && S.b >= MISSION_TYPES[missionType].cost + reserve) orderCapsule(missionType);
    const booster = boosterFor(missionType);
    if (!booster) orderBoosterFor(missionType, reserve);
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
    flyMission(capsule, booster, crew, orbits);
  }
  markDirectives();
  return report;
}
