// Headless bot: plays the real rules in virtual time and prints pacing. Run: node tools/balance.mjs [runs] [maxMinutes]
// Phase One runs to orbit; then tools/mercury-bot.mjs plays Phase Two (Section 1, then Section 2) for up to maxMinutes more.
// Seeded, so the same code prints the same report: diff the output before and after a balance change.
// DELEGATE=1 plays the delegation route: at the Aerobee it appoints the launch director, hires the cheaper candidate for every
// lead post, gives Ellis a remit and authorises a lean programme brief for the newest rocket (moving production and research to
// each new rocket as it is ready), opens the shared research line and approves each lead's first proposal.
import { S, resetState, formatDate, freeTeams, withProgramme } from '../js/core/state.js';
import { PACKAGES, BY_ID } from '../js/data/research.js';
import { DIRECTIVES } from '../js/data/history.js';
import { MERCURY_DIRECTIVES, sectionDirectives } from '../js/data/mercury.js';
import { FAILURE_MODES } from '../js/data/failures.js';
import { FACILITIES, STATIONS } from '../js/data/launch-site.js';
import { PROGRAMMES } from '../js/data/programmes.js';
import { researchLock, commission, itemsInArea } from '../js/rules/research.js';
import { hasBoosterStage, quoteLaunch } from '../js/rules/design.js';
import { unitCost, draftChanges, draftSize } from '../js/rules/production.js';
import { candidates, startLock, startProgramme, maturity, stagesOf } from '../js/rules/programs.js';
import { tickSecond, hire, engineeringTeamCost, ensureStarter } from '../js/rules/game.js';
import { orderAirframes, publishBlueprint } from '../js/rules/factory.js';
import { startInvestigation, chooseFix, startReview, acceptAllFindings, INVESTIGATION_COST } from '../js/rules/jobs.js';
import { beginFlight, previewFlight, step, takeReadings, endFlight } from '../js/rules/flight.js';
import { runPoll, scrub, facilityLock, buildFacility, stationLock, hireStation, troubleshoot, PAD_FIX_COST } from '../js/rules/launch-site.js';
import { playMercury } from './mercury-bot.mjs';
import { autoLaunch } from '../js/rules/auto.js';
import { directorUnlocked } from '../js/rules/campaign.js';
import { openPosts, hireLead, leadsPayroll, postCandidates } from '../js/rules/leads.js';
import { SHARED_AREAS, SHARED_CAPS, startShared, raiseShared, proposals, approveProposal } from '../js/rules/shared-research.js';
import { briefFree, approveBrief } from '../js/rules/brief.js';
import { standingOrder, raiseOrder, resumeOrder } from '../js/rules/orders.js';
import { LANES, endLanes, raiseLanes, laneProposals, approveLaneMilestone, laneNotNow } from '../js/rules/lanes.js';
import { endWorks, raiseWorks, reedPublishes } from '../js/rules/factory-lead.js';
import { remitUnlocked, startRemit, raiseRemit, REMIT_CAPS } from '../js/rules/remit.js';
import { curesReady, startCure } from '../js/rules/cures.js';

const BUY = [['crew', 'prop'], ['crew', 'rso'], ['fac', 'wx'], ['fac', 'tty'], ['crew', 'tlm'], ['fac', 'radar'], ['fac', 'plot'], ['crew', 'bstr'], ['fac', 'comp'], ['crew', 'fido']];
const RUNS = +process.argv[2] || 6, MAX_MINUTES = +process.argv[3] || 240, GOAL = 5, DELEGATE = !!process.env.DELEGATE;
// After Gemini the bot gets this long to put a boilerplate in orbit on a Saturn I.
const SATURN_MINUTES = 120;
const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const BOT_MILESTONES = ['ms_rel', 'ms_eng', 'ms_in', 'ms_rg', 'ms_aero', 'ms_blunt'];
// Research everything the programme offers, cheapest first, plus the first approach of each milestone choice and four recovery packages.
const researchList = () => [...['p', 's', 'i', 'a'].flatMap(itemsInArea), ...BOT_MILESTONES.map(id => BY_ID[id]), ...PACKAGES.filter(item => item.area == 'r' && !item.dud).slice(0, 4)]
  .sort((first, second) => first.cost - second.cost).map(item => item.id);
// The newest ready rocket.
const latestProgramme = () => Object.keys(S.progs).filter(kind => S.progs[kind].ready).sort((first, second) => PROGRAMMES[second].generation - PROGRAMMES[first].generation)[0];
// Army path: Redstone then Jupiter-C; navy path: Vanguard straight from Viking, skipping the Redstone generation.
const offPath = (kind, army) => ((kind == 'redstone' || kind == 'jupc') && !army) || (kind == 'vanguard' && army);

function run(seed) {
  Math.random = rng(seed);
  resetState();
  ensureStarter();
  const army = seed % 2 == 0, programmeStarted = {}, programmeMatured = {};
  let t = 0, flights = 0, fails = 0, scrubs = 0, lastSignature = '', lastFlown = -999;
  const directiveTimes = [];
  const advance = seconds => {
    for (let i = 0; i < seconds; i++) {
      tickSecond();
      autoLaunch();
      acceptAllFindings();
      t++;
      while (directiveTimes.length < S.dir) directiveTimes.push(t);
      // Programme maturity is reported up to the end of Section 1, as it was before Section 2 existed.
      if (!(S.p2 && S.p2.secDone)) for (const kind in S.progs) if (S.progs[kind].matured && !(kind in programmeMatured)) programmeMatured[kind] = t;
    }
  };
  // ONE ORDINARY LAUNCH of an airframe from the hangar, flown the way a sensible player would. ballastOnly: no satellite attempt;
  // cargo: the satellite to fly instead of the Explorer. Returns the flight's result ('orbit', 'fail', 'land'), if it flew.
  const flyLaunch = (ready, ballastOnly = false, cargo = null) => {
    const stage = hasBoosterStage(ready) ? 1 : 0, propellants = PROGRAMMES[ready.prog].propellants;
    const satellite = !!cargo || PROGRAMMES[ready.prog].canOrbit && S.dir >= 4 && !ballastOnly;
    const payload = cargo || (satellite ? 'Explorer Satellite' : 'Inert Ballast');
    // A sensible player picks the propellant and load whose estimate is highest while staying inside the airframe's aero and heating limits.
    let best = null;
    for (const propellant of propellants)
      for (let load = 1; load >= .3; load = Math.round((load - .1) * 10) / 10) {
        const preview = previewFlight(ready, propellant, payload, stage, load);
        if (preview.maxQ < .9 && preview.maxHeat < .9 && !/heavy/.test(quoteLaunch(ready, propellant, payload, stage, load).error || '')) {
          const measure = satellite ? preview.peakSpeed : preview.peakAltitude;
          if (!best || measure > best.measure) best = { propellant, load, measure };
          break;
        }
      }
    const propellant = best ? best.propellant : 'Alcohol & LOX', load = best ? best.load : .3;
    // A satellite attempt is worth flying when the estimate says orbit, or when the rocket has changed since the last try (new data to gather).
    if (satellite) {
      const preview = previewFlight(ready, propellant, payload, stage, load), signature = ready.pk.length + ':' + Object.keys(ready.fix).length + ':' + ready.id;
      if (lastSignature == signature && !(preview.peakSpeed >= 7000) && t - lastFlown < 150) return advance(5);
      lastSignature = signature;
      lastFlown = t;
    }
    if (quoteLaunch(ready, propellant, payload, stage, load).error) return advance(1);
    const poll = runPoll(ready, propellant, stage);
    if (poll.nogo && S.b > PAD_FIX_COST) troubleshoot(poll);
    if (poll.nogo) {
      scrub(poll);
      scrubs++;
      return advance(3);
    }
    const flight = beginFlight(ready, propellant, payload, stage, load, { latent: poll.fault, wind: poll.wind });
    if (!flight) return advance(1);
    let result;
    do {
      result = step(flight);
      if (result == 'tick') takeReadings(flight);
    } while (result == 'tick' || result == 'sep');
    if (process.env.TRACE) console.log(`t=${(t / 60).toFixed(1)}m ${formatDate(S.day)} dir ${S.dir} ${ready.label} pk ${ready.pk.length} load ${load} ${propellant[0]} -> ${result} peak ${(flight.peakAltitude / 1000).toFixed(0)}km spd ${Math.round(flight.peakSpeed)} hv ${Math.round(flight.peakHorizontalSpeed)} t ${flight.time} pay ${payload[0]} st ${stage} maxQ ${Math.round(flight.maxQ * 100)} heat ${Math.round(flight.maxHeat * 100)} fail ${flight.failure || ''} $${Math.round(S.b)}`);
    endFlight(flight, result != 'fail', result);
    flights++;
    if (result == 'fail') fails++;
    // Real time on screen: a 30 s count, powered flight at 8 steps a second, coasting at 100, and a few seconds to read the result.
    { const powered = Math.min(flight.time, flight.burnTime * (flight.stages.length > 1 ? 3 : 1)); advance(30 + 8 + Math.ceil(powered / 8 + (flight.time - powered) / 100)); }    return result;
  };
  // THE DELEGATION ROUTE (DELEGATE=1), once a turn before the bot's own work.
  const delegated = { at: null };
  const delegate = reserve => {
    if (!directorUnlocked()) return;
    if (!S.staff.director) {
      hire('director');
      if (!S.staff.director) return;
      delegated.at = t;
    }
    for (const area of openPosts()) hireLead(area, postCandidates(area).slice().sort((first, second) => first.salary - second.salary)[0].id);
    if (!S.remit && remitUnlocked() && S.b > reserve + REMIT_CAPS[0]) startRemit(REMIT_CAPS[0]);
    // Caps are raised only while the treasury can carry them; otherwise the line waits.
    const flush = S.b > reserve + 60000;
    if (S.remit && S.remit.dry && flush) raiseRemit();
    if (!S.shared.cap && S.b > reserve + SHARED_CAPS[0]) startShared(SHARED_CAPS[0]);
    if (S.shared.dry && flush) raiseShared();
    for (const area of SHARED_AREAS) if (proposals(area).length) approveProposal(proposals(area)[0].id);
    // Production and research follow the newest rocket; the older ones keep their standing orders.
    const latest = latestProgramme();
    if (S.lanes && S.lanes.prog != latest) endLanes();
    if (S.works && S.works.prog != latest) endWorks();
    S.cur = latest;
    if (briefFree(latest).length && S.b > reserve + 20000) approveBrief(0);
    if (S.lanes && S.lanes.dry && flush) raiseLanes();
    // A lane's milestone proposal: approve the cheapest of the ones the bot commissions itself, and not now to any others.
    if (S.lanes) for (const area in LANES) {
      const offered = laneProposals(area), pick = offered.filter(item => BOT_MILESTONES.includes(item.id)).sort((first, second) => first.cost - second.cost)[0];
      if (pick && S.b - pick.cost >= reserve) approveLaneMilestone(pick.id);
      else if (offered.length && !pick) laneNotNow(area);
    }
    if (S.works && S.works.dry && flush) raiseWorks();
    const order = standingOrder();
    if (order && order.hold && !order.hold.startsWith('The cap')) resumeOrder();
    else if (order && order.hold && flush) raiseOrder();
  };
  while (t < MAX_MINUTES * 60 && S.dir < GOAL) {
    const reserve = unitCost() + 6000;
    if (DELEGATE) delegate(reserve);
    { const draft = draftChanges(); if (!reedPublishes() && draftSize(draft)) publishBlueprint(); }
    if (S.teams < 4 && S.b > engineeringTeamCost() + reserve + 15000) hire('team');
    for (const [kind, id] of BUY) {
      if (kind == 'fac' && !facilityLock(id) && S.b - FACILITIES[id].cost > reserve + 20000) buildFacility(id);
      if (kind == 'crew' && !stationLock(id) && S.b - STATIONS[id].cost > reserve + 20000) hireStation(id);
    }
    {
      const latest = latestProgramme();
      S.cur = latest;
      if (!S.air.some(airframe => airframe.st == 'r' && airframe.prog == latest) && !S.aq.some(item => item.prog == latest) && S.b >= unitCost() + 4000) orderAirframes(1);
    }
    // The rocket's incidents, then those of its lower stages (rules/stages.js).
    for (const kind of [S.cur, ...stagesOf(S.cur)]) withProgramme(kind, () => {
      for (const incident of S.inc) {
        if (!freeTeams()) break;
        if (incident.st == 'open' && S.b - INVESTIGATION_COST >= reserve) startInvestigation(incident.id);
        else if (incident.st == 'diag') for (const fix of FAILURE_MODES[incident.dx].fixes.slice().sort((first, second) => first.riskMultiplier - second.riskMultiplier)) if (S.b - fix.cost >= reserve && freeTeams()) {
          chooseFix(incident.id, fix.id);
          break;
        }
      }
      for (const cure of curesReady(kind)) if (freeTeams() && S.b - cure.cost >= reserve) startCure(kind, cure.traitKey);
    });
    // Programmes: start the next rung once the current rocket is mature.
    for (const candidate of candidates()) {
      if (offPath(candidate, army)) continue;
      if (!startLock(candidate) && S.b - PROGRAMMES[candidate].cost > reserve) {
        startProgramme(candidate);
        programmeStarted[candidate] = t;
      }
    }
    S.cur = latestProgramme();
    // Save up for the next programme once its predecessor is half mature.
    const saving = candidates().find(candidate => !(PROGRAMMES[candidate].needsNasa && !S.nasa) && !offPath(candidate, army) && maturity(PROGRAMMES[candidate].requires.find(kind => S.progs[kind]) || 'wac') >= 50);
    const researchReserve = reserve + (saving ? PROGRAMMES[saving].cost : 0);
    for (const id of researchList()) if (freeTeams() && !researchLock(id) && S.b - BY_ID[id].cost * PROGRAMMES[S.cur].costScale >= researchReserve) commission(id);
    if (freeTeams() && S.b > reserve + 20000) {
      const area = ['p', 's', 'a'].sort((first, second) => (S.kn[first] || 0) - (S.kn[second] || 0))[0];
      if ((S.kn[area] || 0) > 25) startReview(area);
    }
    // Delegating, you fly only the newest rocket yourself: the airframes of the older ones are Ellis's for routine flights.
    const ready = S.air.filter(airframe => airframe.st == 'r' && (!DELEGATE || !S.staff.director || airframe.prog == latestProgramme())).sort((first, second) => PROGRAMMES[second.prog].generation - PROGRAMMES[first.prog].generation || second.pk.length - first.pk.length)[0];
    if (!ready) { advance(1); continue; }
    flyLaunch(ready);
  }
  const phaseOne = {
    programmeStarted, programmeMatured, maturity: Object.fromEntries(Object.keys(S.progs).map(kind => [kind, Math.round(maturity(kind))])), t, flights, fails, scrubs,
    crew: Object.keys(S.crew).filter(id => S.crew[id]).length, facilities: Object.keys(S.fac).length, directiveTimes, budget: S.b, packages: Object.keys(S.pk).length,
    orbit: S.dir >= GOAL, date: formatDate(S.day), sputnik: formatDate(S.rv.r_sat), race: S.fs.f_orbit || '-', sovietFirsts: Object.values(S.fs).filter(value => value == 'them' || value == 'second').length,
    lostFirstIds: Object.keys(S.fs).filter(id => S.fs[id] == 'them' || S.fs[id] == 'second'),
    delegation: DELEGATE && { at: delegated.at, orders: standingOrder() || { n: 0, okn: 0, paid: 0 }, lanes: S.lanes && S.lanes.jobs, works: S.works && S.works.built, shared: S.shared.jobs, remit: S.remit && S.remit.jobs, leads: Object.keys(S.leads).length, payroll: leadsPayroll() },
  };
  if (!phaseOne.orbit || process.env.PHASE_ONE_ONLY) return phaseOne;
  // Phase Two picks up where Phase One stopped, with the same clock and the same flying.
  // Section 1's figures are the ones taken when it completed (or the end of play, if it never did).
  const mercury = playMercury({ advance, now: () => t, flyLaunch, maxSeconds: t + MAX_MINUTES * 60, saturnSeconds: SATURN_MINUTES * 60, sectionOneOnly: !!process.env.SECTION_ONE_ONLY });
  const one = mercury.sectionOne || { at: t, budget: S.b, date: S.p2 && S.p2.secDone, missions: mercury.missions, missionFails: mercury.missionFails, astronautsLost: mercury.astronautsLost, launches: mercury.launches, human: S.fs.f_human };
  return {
    ...phaseOne, mercury, one, endMercury: one.at, budgetMercury: one.budget, sectionDate: one.date ? formatDate(one.date) : '-', gagarin: formatDate(S.rv.r_gagarin), human: one.human || '-',
    end: mercury.geminiAt === null ? t : mercury.geminiAt, budgetEnd: mercury.geminiBudget === undefined ? S.b : mercury.geminiBudget, saturnEnd: t, mercuryDate: S.p2 && S.p2.mercDone ? formatDate(S.p2.mercDone) : '-', titov: S.rv.r_titov ? formatDate(S.rv.r_titov) : '-', dayInOrbit: S.fs.f_day || '-',
    geminiDate: S.p2 && S.p2.gemDone ? formatDate(S.p2.gemDone) : '-', apollo: S.p2 && S.p2.ap && S.p2.ap.arch ? `${S.p2.ap.arch} ${formatDate(S.p2.ap.ad)}` : S.p2 && S.p2.ap && S.p2.ap.done ? 'study done, no choice' : '-', crew2: S.fs.f_crew2 || '-', eva: S.fs.f_eva || '-',
    voskhod: S.rv.r_voskhod ? formatDate(S.rv.r_voskhod) : '-', leonov: S.rv.r_leonov ? formatDate(S.rv.r_leonov) : '-',
    saturnDate: mercury.saturnAt === null ? '-' : formatDate(S.day), saturnRevs: S.progs.saturn1 ? ['saturn1', ...stagesOf('saturn1')].map(kind => S.progs[kind].bp.rev).join('/') : '-',
    dock: S.fs.f_dock || '-', kosmos: S.rv.r_kosmos ? formatDate(S.rv.r_kosmos) : '-',
  };
}
const minutes = seconds => seconds === undefined ? '  -- ' : (seconds / 60).toFixed(1).padStart(5);
// "programmes" lists each rocket as kind@started>matured (minutes). SEED=n plays only run n (with TRACE=1, one line per launch and per mission).
// SECTION_ONE_ONLY=1 stops Phase Two once Section 1 is complete. SEED takes a list too (SEED=5,7), and plays those runs whatever [runs] is.
// The last line is a summary of medians (play minutes). A run that never finishes a stage it reached is a stall: the summary names
// it and the bot exits with an error, which is how tools/acceptance.mjs checks for dead ends.
// The stage a run reached but never finished, or null.
const stallOf = r => {
  const mercury = r.mercury;
  if (!r.orbit) return 'Phase One';
  if (!mercury) return null;
  if (!mercury.done) return 'Mercury Section 1';
  if (process.env.SECTION_ONE_ONLY) return null;
  if (!mercury.sectionTwoDone) return 'Mercury Section 2';
  if (!mercury.geminiDone) return 'Gemini';
  return mercury.saturnAt === null ? 'Saturn I' : null;
};
const ONLY = process.env.SEED ? process.env.SEED.split(',').map(Number) : null, played = [], stalls = [];
for (let i = 0; i < (ONLY ? Math.max(...ONLY) + 1 : RUNS); i++) {
  if (ONLY && !ONLY.includes(i)) continue;
  const r = run(1000 + i * 7919);
  played.push(r);
  const stuck = stallOf(r);
  if (stuck) stalls.push(`seed ${i} (${stuck})`);
  console.log(`programmes ${Object.entries(r.programmeStarted).map(([kind, time]) => kind + '@' + minutes(time).trim() + (kind in r.programmeMatured ? '>' + minutes(r.programmeMatured[kind]).trim() : '')).join(' ')} | maturity ${JSON.stringify(r.maturity)}`);
  console.log(`seed ${i}: flights ${r.flights} fails ${r.fails} scrubs ${r.scrubs} crew ${r.crew} base ${r.facilities} pkgs ${r.packages} end ${minutes(r.t)}m budget ${Math.round(r.budget)} orbit ${r.orbit} ${r.date} (${r.race}, Sputnik ${r.sputnik}) lostFirsts ${r.sovietFirsts} | directives(min) ${DIRECTIVES.map((_, k) => minutes(r.directiveTimes[k])).join(' ')}`);
  console.log(`        lost to the Soviets in Phase One: ${r.lostFirstIds.join(' ') || 'none'}`);
  if (r.delegation) { const d = r.delegation; console.log(`        delegation from ${minutes(d.at)}m: routine flights ${d.orders.n} (${d.orders.okn} good, $${d.orders.paid} paid) | lane packages ${d.lanes} | airframes by Reed ${d.works} | shared packages ${d.shared} | remit jobs ${d.remit} | leads ${d.leads} at $${d.payroll}/cycle`); }
  const mercury = r.mercury;
  if (mercury) console.log(`        mercury: ${mercury.done ? 'done' : 'NOT DONE'} in ${minutes(r.endMercury - mercury.nasaAt)}m after NASA (play total ${minutes(r.endMercury)}m) ${r.sectionDate} (first human: ${r.human}, Gagarin ${r.gagarin}) missions ${r.one.missions} failed ${r.one.missionFails} astronautsLost ${r.one.astronautsLost} rating launches ${r.one.launches} budget ${Math.round(r.budgetMercury)} | directives(min after NASA) ${MERCURY_DIRECTIVES.filter(directive => !directive.section).map((_, k) => minutes(mercury.directiveTimes[k])).join(' ')}`);
  // Section 2: times counted from the end of Section 1.
  if (mercury && mercury.sectionOne && !process.env.SECTION_ONE_ONLY) {
    const [first, end] = sectionDirectives(2), since = k => mercury.directiveTimes[k] === undefined ? undefined : mercury.directiveTimes[k] + mercury.nasaAt - r.endMercury;
    const mercuryEnd = mercury.mercuryAt === null ? r.end : mercury.mercuryAt, atEnd = mercury.atMercury || { ...mercury, budget: r.budgetEnd };
    console.log(`        section 2: ${mercury.sectionTwoDone ? 'done' : 'NOT DONE'} in ${minutes(mercuryEnd - r.endMercury)}m after Section 1 (play total ${minutes(mercuryEnd)}m) ${r.mercuryDate} (day in orbit: ${r.dayInOrbit}, Titov ${r.titov}) missions ${atEnd.missions - r.one.missions} failed ${atEnd.missionFails - r.one.missionFails} astronautsLost ${atEnd.astronautsLost - r.one.astronautsLost} rating launches ${atEnd.launches - r.one.launches} budget ${Math.round(atEnd.budget)} | directives(min after Section 1) ${MERCURY_DIRECTIVES.slice(first, end).map((_, k) => minutes(since(first + k))).join(' ')}`);
    if (mercury.sectionTwoDone) console.log(`        gemini: ${mercury.geminiDone ? 'done' : 'NOT DONE'} in ${minutes(r.end - mercuryEnd)}m after Mercury (play total ${minutes(r.end)}m) ${r.geminiDate} (two-man crew: ${r.crew2}, Voskhod ${r.voskhod}; spacewalk: ${r.eva}, Leonov ${r.leonov}; docking: ${r.dock}, Kosmos ${r.kosmos}) missions ${mercury.missions - atEnd.missions} failed ${mercury.missionFails - atEnd.missionFails} astronautsLost ${mercury.astronautsLost - atEnd.astronautsLost} rating launches ${mercury.launches - atEnd.launches} budget ${Math.round(r.budgetEnd)} apollo ${r.apollo} safety-bar overrides ${mercury.barOverrides}`);
    if (mercury.geminiDone) console.log(`        saturn: ${mercury.saturnAt !== null ? 'orbit' : 'NOT DONE'} in ${minutes((mercury.saturnAt === null ? r.saturnEnd : mercury.saturnAt) - r.end)}m after Gemini (play total ${minutes(mercury.saturnAt === null ? r.saturnEnd : mercury.saturnAt)}m) ${r.saturnDate} launches ${mercury.saturnLaunches} stage revisions ${r.saturnRevs}`);
  }
}
{
  const median = values => { const sorted = values.filter(value => value !== undefined && value !== null).sort((first, second) => first - second); return sorted.length ? minutes(sorted[Math.floor((sorted.length - 1) / 2)]).trim() + 'm' : '-'; };
  const mercury = played.filter(r => r.mercury);
  console.log(`summary: ${played.length} runs | medians: orbit ${median(played.map(r => r.t))}, Mercury Section 1 ${median(mercury.filter(r => r.mercury.done).map(r => r.endMercury))}, Gemini ${median(mercury.filter(r => r.mercury.geminiDone).map(r => r.end))}, Saturn I orbit ${median(mercury.map(r => r.mercury.saturnAt))} | stalls ${stalls.length}${stalls.length ? ': ' + stalls.join(', ') : ''}`);
  if (stalls.length) process.exitCode = 1;
}
