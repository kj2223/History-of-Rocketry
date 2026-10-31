// MAIL, THE HOME SCREEN: the inbox of messages from your staff and from outside, the open message, and the work already in your
// team's hands. The messages are built fresh on every redraw from the game state; nothing here is saved.
//   kind: decision (asks you for something, counted on the Mail button), directive, report or log
import { formatMoney } from '../core/util.js';
import { DIRECTIVES, RIDE_FEE, BUMPER_FLIGHTS, BUMPER_COST, CORPORAL_MILESTONES, CORPORAL_LATE_SHARE } from '../data/history.js';
import { corporalJob, nextMilestone, milestoneDue } from '../rules/corporal.js';
import { v2Flying, ridePayloads, rideCost, separationChance } from '../rules/neighbours.js';
import { CORE_TEAM } from '../data/team.js';
import { S, withProgramme, formatDate } from '../core/state.js';
import { nasaReady } from '../rules/race.js';
import { itemAsSeen } from '../rules/research.js';
import { queueLock, queuePosition } from '../rules/queue.js';
import { memberName, memberRole, joinedMembers, memberJoined } from '../rules/team.js';
import { PROGRAMMES } from '../data/programmes.js';
import { stagesOf } from '../rules/programs.js';
import { STATIONS } from '../data/launch-site.js';
import { AREAS } from '../data/research.js';
import { LANES, LANE_RAISE, laneLead, laneJob, laneIdleReason, laneProposals } from '../rules/lanes.js';
import { AIRFRAMES_ON_HAND, WORKS_RAISE, airframesOnHand, airframesWanted, worksIdleReason } from '../rules/factory-lead.js';
import { remitUnlocked, referredFindings, incidentsWithEllis, authorityText, REMIT_CAPS, REMIT_RAISE } from '../rules/remit.js';
import { ORDER_RAISE, standingOrder, orderWaiting, requestText } from '../rules/orders.js';
import { DIRECTOR_CADENCE } from '../rules/auto.js';
import { LEAD_POSTS } from '../data/leads.js';
import { openPosts, hiredLead, postCandidates } from '../rules/leads.js';
import { SHARED_AREAS, SHARED_CAPS, SHARED_RAISE, proposals, isChoice, sharedIdleReason } from '../rules/shared-research.js';
import { BRIEF_SIZES, briefLines, briefTotal } from '../rules/brief.js';
import { STUDY_SIZES, ARCHITECTURES, ARCHITECTURE_ORDER } from '../data/apollo.js';
import { apollo, apolloLead, studyDays, estimate } from '../rules/apollo.js';
import { TARGET_RANGE, LIMIT_RANGE, TESTS_RANGE } from '../data/safety.js';
import { PRESSURES, SHIELDS } from '../data/pressure.js';
import { HEARINGS } from '../data/hearing.js';
import { hearingOpen } from '../rules/hearing.js';
import { openRequest, requestText as leadRequestText, reasonOnFile, shieldReady } from '../rules/requests.js';
import { pressure, pressureLevel, pressureWords } from '../rules/pressure.js';
import { safetyBar, crewRockets, estimates, estimatedSafety, limitFor, componentName, designKey, testCost, testsWaived, dataSheets } from '../rules/safety.js';
import { capabilityShown } from '../rules/mercury.js';
import { OPS_CAPS, OPS_RAISE, SERIES_ORBITS, opsUnlocked, opsDirectiveName, seriesLock } from '../rules/flight-ops.js';
import { MISSION_TYPES } from '../data/mercury.js';
import { HABITS, TEAM_LINES, cultureWords, confidenceWords, recentHabits, budgetPressure, acceptedRisks } from '../rules/culture.js';
import { launchView } from './launch-view.js';
import { $, setHTML, escapeHtml } from './dom.js';

// Which message is open. pane: the reader block that shows its body (the directive, race and log panels are drawn elsewhere).
export const mail = { open: 'dir' };
const KIND_NAMES = { decision: 'Decision', directive: 'Directive', report: 'Report', log: 'Log' };

const waiting = () => S.inc.filter(incident => incident.st == 'open' || incident.st == 'found' || incident.st == 'diag');
// The rocket's incidents and its lower stages' (rules/stages.js).
const waitingIncidents = () => incidentsWithEllis() ? [] : [...waiting(), ...stagesOf(S.cur).flatMap(stage => withProgramme(stage, waiting))];

// ELLIS'S REMIT (rules/remit.js): her offer once she has earned it, then the running remit, which asks for a decision when the cap
// cannot cover her next job or she has referred findings to you.
// THE PROGRAMME BRIEF (rules/brief.js): one letter per rocket for its flights (Ellis's standing order), production (Reed) and
// research (Chen's lanes). The offer for the rocket in focus while a lead is free; a running brief asks for a decision when any of
// its lines is held for you.
const laneRows = () => Object.keys(LANES).map(area => {
  const lead = laneLead(area), idle = S.lanes && laneIdleReason(area);
  return `<div class="r"><span>${AREAS[area]}</span><b class="${lead && !idle ? '' : 'd'}">${lead ? escapeHtml(lead.name) + (lead.cover ? ' (covering, slower)' : '') + (idle ? `: ${idle}` : '') : `no ${STATIONS[LANES[area]].callSign} or lead yet`}</b></div>`;
}).join('');
// A lane lead's milestone proposal, drawn for the lanes' rocket: approve it onto the lane, queue it for your teams, or not now.
function laneProposalHTML(area) {
  const lead = laneLead(area), busy = !!laneJob(area), milestones = laneProposals(area);
  return `<div class="c"><div class="lbl">PROPOSAL · ${escapeHtml(lead.name)} · ${AREAS[area]}</div>${milestones.filter(milestone => milestone.tier == 1).length > 1 ? '<p class="wn">A choice: starting one approach closes the others.</p>' : ''}`
    + milestones.map(milestone => `<div class="r"><span><b>${escapeHtml(milestone.name)}</b> · <span class="m">${escapeHtml(milestone.why || '')}</span></span>${proposalButton(milestone, busy, 'l')}</div>`).join('')
    + `${busy ? '<div class="m">The lane is finishing a package: approve once it is done, or queue the milestone for your own teams.</div>' : ''}<div class="acts"><button data-a="lnot" data-id="${area}">NOT NOW</button></div></div>`;
}
const LINE_OFFERS = {
  flights: () => 'Ellis flies routine customer flights under a cap, each on the cheapest rocket you own that reaches it, ordering airframes of that rocket when none is ready.',
  production: () => `Reed keeps ${AIRFRAMES_ON_HAND} airframes ready or on the floor, upgrades them and publishes the blueprint, holding any change that makes it heavier for its thrust.`,
  research: () => 'Chen runs the routine research in each of its systems, one lane each, led by its development lead or, until you hire one, its station engineer. Your teams stay yours for milestones.',
};
const LINE_NAMES = { flights: 'FLIGHTS', production: 'PRODUCTION', research: 'RESEARCH' };
// A running line: its account, its question for you if any, why it is quiet, and its buttons. { html, ask }
function runningLine(line, prog) {
  if (line == 'flights') {
    const order = standingOrder(), waiting = !order.hold && orderWaiting();
    return { ask: !!order.hold, html: `<div class="r"><span>${order.n} flight${order.n == 1 ? '' : 's'}, ${order.okn} good, ${formatMoney(order.paid)} paid</span><b>${formatMoney(order.spent)} of ${formatMoney(order.cap)}</b></div>`
      + (order.hold ? `<p class="wn">${escapeHtml(order.hold)}</p>` : `<div class="m">${waiting ? `Waiting: ${waiting}.` : 'Flying as requests come in.'}</div>`)
      + `<div class="acts">${order.hold ? '<button data-a="ores">GO AHEAD</button>' : ''}<button data-a="oraise">RAISE BY ${formatMoney(ORDER_RAISE)}</button><button data-a="oraise" data-n="2">DOUBLE TO ${formatMoney(2 * order.cap)}</button><button data-a="oend">CLOSE THE ORDER</button></div>` };
  }
  if (line == 'production') {
    const works = S.works, idle = worksIdleReason();
    const ask = works.hold ? `<p class="wn">Holding the draft blueprint: it would cut liftoff thrust-to-weight by ${Math.round(-works.hold * 100)}%. Reed publishes once the engine work catches up; publish now if you would rather fly the extra propellant.</p>` : works.dry ? `<p class="wn">The budget cannot cover ${escapeHtml(works.dry)}.</p>` : '';
    return { ask: !!ask, html: `<div class="r"><span>${works.built} ordered, ${works.retro} upgraded, ${airframesOnHand(prog)} of ${airframesWanted()} on hand</span><b>${formatMoney(works.spent)} of ${formatMoney(works.cap)}</b></div>`
      + (ask || (idle ? `<div class="m">Idle: ${escapeHtml(idle)}.</div>` : '<div class="m">Work on the factory floor.</div>'))
      + `<div class="acts">${works.hold ? '<button data-a="wpub">PUBLISH NOW</button>' : ''}<button data-a="wraise">RAISE BY ${formatMoney(WORKS_RAISE)}</button><button data-a="wraise" data-n="2">DOUBLE TO ${formatMoney(2 * works.cap)}</button><button data-a="wend">HAND PRODUCTION BACK</button></div>` };
  }
  const lanes = S.lanes, asks = Object.keys(LANES).filter(area => laneProposals(area).length);
  return { ask: !!lanes.dry || !!asks.length, html: `<div class="r"><span>${lanes.jobs} package${lanes.jobs == 1 ? '' : 's'} started</span><b>${formatMoney(lanes.spent)} of ${formatMoney(lanes.cap)}</b></div>`
    + (lanes.dry ? `<p class="wn">The budget cannot cover ${escapeHtml(lanes.dry)}.</p>` : '') + withProgramme(lanes.prog, () => asks.map(laneProposalHTML).join('')) + laneRows()
    + `<div class="acts"><button data-a="lraise">RAISE BY ${formatMoney(LANE_RAISE)}</button><button data-a="lraise" data-n="2">DOUBLE TO ${formatMoney(2 * S.lanes.cap)}</button><button data-a="lend">CLOSE THE LANES</button></div>` };
}
function briefMessage(prog) {
  const name = escapeHtml(PROGRAMMES[prog].name), lines = briefLines(prog), free = lines.filter(line => line.state == 'free');
  const running = lines.filter(line => line.state == 'running').map(line => ({ ...line, ...runningLine(line.line, prog) }));
  const offer = prog == S.cur && free.length && S.progs[prog]
    ? `<div class="acts">${BRIEF_SIZES.map((size, index) => `<button data-a="bstart" data-id="${index}">${running.length ? 'ADD' : 'APPROVE'} ${size.name.toUpperCase()} · ${formatMoney(briefTotal(prog, index))}</button>`).join('')}</div>` : '';
  if (!running.length && !offer) return null;
  const sections = lines.map(line => {
    const run = running.find(candidate => candidate.line == line.line);
    const head = `<div class="lbl">${LINE_NAMES[line.line]} · ${memberName(line.lead)}</div>`;
    if (run) return `<div class="c">${head}${run.html}</div>`;
    return `<div class="c">${head}<div class="m">${line.state == 'free' ? LINE_OFFERS[line.line]() : `Not in this brief: ${escapeHtml(line.state)}.`}</div></div>`;
  }).join('');
  const asks = running.filter(line => line.ask).length;
  const requests = standingOrder() && standingOrder().prog == prog ? `<div class="lbl">OPEN REQUESTS</div>${S.orders.reqs.length ? S.orders.reqs.map(request => `<div class="m">${escapeHtml(requestText(request))}${request.why ? ` <span class="d">(${escapeHtml(request.why)})</span>` : ''}</div>`).join('') : '<div class="m">No requests open. The next is expected soon.</div>'}` : '';
  return {
    id: 'brief-' + prog, kind: asks ? 'decision' : 'report', from: 'Programme office', role: 'Ellis, Reed and Chen', pane: 'note',
    subject: !running.length ? `A brief for the ${PROGRAMMES[prog].name}` : asks ? `The ${PROGRAMMES[prog].name} brief needs you` : `The ${PROGRAMMES[prog].name} brief`,
    body: (running.length ? '' : `<p>One approval and the ${name} runs day to day: flights, production and research, each under its own cap held by its lead. The money stays in the treasury until it is spent. Each line comes back to you here when it needs you.</p>`)
      + sections + requests + (offer ? `<p class="m">${running.length ? 'Add the free leads to this brief:' : 'Approve the brief at a size (the total of the caps for the free leads):'}</p>${offer}` : ''),
  };
}
// The rockets with a brief letter: any a lead runs, and the one in focus.
const briefProgrammes = () => [...new Set([S.cur, S.orders.o?.prog, S.works?.prog, S.lanes?.prog].filter(prog => prog && PROGRAMMES[prog]))];

// CHEN'S RESEARCH STAFF (rules/leads.js, rules/shared-research.js): the posts open to fill, each with its two candidates; the
// shared research line and its lanes; and the leads' milestone proposals, which ask for a decision.
// A milestone proposal: approve it onto the lead's lane, or, while the lane is busy or the money is short, queue it for your own
// teams as the research desk would (rules/queue.js).
// prefix: 's' for the shared line, 'l' for a rocket's lanes (whose queue entries belong to the lanes' rocket).
function proposalButton(milestone, busy, prefix = 's') {
  const position = queuePosition(milestone.id);
  if (position >= 0) return `<b class="wn">Queued #${position + 1} for your teams</b>`;
  if (!busy && S.b >= milestone.cost) return `<button data-a="${prefix}approve" data-id="${milestone.id}">APPROVE · ${formatMoney(milestone.cost)}</button>`;
  const lock = queueLock(milestone.id);
  return `<button data-a="${prefix == 'l' ? 'lqueue' : 'rq'}" data-id="${milestone.id}"${lock ? ` disabled title="${escapeHtml(lock)}"` : ''}>QUEUE FOR YOUR TEAMS · ${formatMoney(milestone.cost)}</button>`;
}
function researchStaffMessage() {
  if (!memberJoined('chen')) return null;
  const posts = openPosts(), shared = S.shared, staffed = SHARED_AREAS.filter(area => hiredLead(area));
  const asks = SHARED_AREAS.filter(area => proposals(area).length);
  if (!posts.length && !staffed.length) return null;
  const postsHTML = posts.length ? `<div class="lbl">POSTS TO FILL</div>` + posts.map(area => `<div class="c"><div class="r"><b>${escapeHtml(LEAD_POSTS[area].title)}</b><span class="d">${AREAS[area]}</span></div>`
    + postCandidates(area).map(candidate => `<div class="r"><span><b>${escapeHtml(candidate.name)}</b> · <span class="m">${escapeHtml(candidate.note)}</span></span><button data-a="leadhire" data-id="${area}:${candidate.id}">HIRE · ${candidate.pace > 1 ? 'quicker' : candidate.pace < 1 ? 'slower' : 'steady'} · ${formatMoney(candidate.salary)}/cycle</button></div>`).join('') + '</div>').join('') : '';
  const lanesHTML = staffed.length ? `<div class="lbl">SHARED RESEARCH LINE</div><div class="c">` + SHARED_AREAS.map(area => {
    const lead = hiredLead(area), job = laneJob(area), idle = sharedIdleReason(area);
    return `<div class="r"><span>${AREAS[area]}</span><b class="${job ? '' : 'd'}">${lead ? escapeHtml(lead.name) : 'no lead'}${job ? `: ${escapeHtml(itemAsSeen(job.id).name)}, ${job.t}s` : idle ? `: ${idle}` : ''}</b></div>`;
  }).join('') + (shared.cap
    ? `<div class="r"><span>${shared.jobs} started</span><b>${formatMoney(shared.spent)} of ${formatMoney(shared.cap)}</b></div>${shared.dry ? `<p class="wn">The line cannot cover ${escapeHtml(shared.dry)}.</p>` : ''}<div class="acts"><button data-a="sraise">RAISE BY ${formatMoney(SHARED_RAISE)}</button><button data-a="sraise" data-n="2">DOUBLE TO ${formatMoney(2 * shared.cap)}</button><button data-a="sclose">CLOSE THE LINE</button></div>`
    : `<div class="m">Open the line and each lead runs the routine research of their area under it. Milestones still come to you first.</div><div class="acts">${SHARED_CAPS.map(cap => `<button data-a="sstart" data-id="${cap}">${formatMoney(cap)} LINE</button>`).join('')}</div>`) + '</div>' : '';
  const proposalsHTML = asks.map(area => {
    const lead = hiredLead(area), busy = !!laneJob(area);
    return `<div class="c"><div class="lbl">PROPOSAL · ${escapeHtml(lead.name)}</div>${isChoice(area) ? '<p class="wn">A choice: starting one approach closes the others.</p>' : ''}`
      + proposals(area).map(milestone => `<div class="r"><span><b>${escapeHtml(milestone.name)}</b> · <span class="m">${escapeHtml(milestone.why || '')}</span></span>${proposalButton(milestone, busy)}</div>`).join('')
      + `${busy ? '<div class="m">The lane is finishing a package: approve once it is done, or queue the milestone for your own teams.</div>' : ''}<div class="acts"><button data-a="snot" data-id="${area}">NOT NOW</button></div></div>`;
  }).join('');
  return {
    id: 'staff', kind: asks.length || shared.dry ? 'decision' : 'report', from: memberName('chen'), role: memberRole('chen'), pane: 'note',
    subject: asks.length ? `${asks.length == 1 ? 'A milestone proposal' : 'Milestone proposals'} for you` : posts.length ? `${posts.length == 1 ? 'A research post' : 'Research posts'} to fill` : 'The shared research line',
    body: proposalsHTML + postsHTML + lanesHTML,
  };
}

// PROJECT APOLLO (rules/apollo.js): who leads it, the study, and the choice of architecture.
const millions = amount => `$${(amount / 1e6).toFixed(1)}M`;
const ESTIMATE_TEXT = {
  cost: range => `${millions(range.low)} to ${millions(range.high)}`,
  years: range => `${range.low.toFixed(1)} to ${range.high.toFixed(1)} years`,
  risk: range => `${(range.low * 100).toFixed(1)}% to ${(range.high * 100).toFixed(1)}%`,
};
const ESTIMATE_LABELS = { cost: 'Development cost', years: 'To the first landing attempt', risk: 'Crew lost on a landing' };
function apolloMessage() {
  const state = apollo();
  if (!state) return null;
  const lead = apolloLead(), base = { id: 'apollo', from: lead ? lead.name : 'NASA Headquarters', role: lead ? 'Apollo Spacecraft Manager' : 'Office of Manned Space Flight', pane: 'note' };
  if (state.lead === undefined) {
    const mercuryLead = hiredLead('c');
    return { ...base, kind: 'decision', subject: 'Apollo begins: who goes with the Mercury team?',
      body: `<p>Mercury is complete. Its engineers move to Apollo while Gemini flies, and their first job is to study how to reach the Moon.</p><p>${escapeHtml(mercuryLead.name)} could go with them. The study would be quicker and firmer for it, but Gemini would need a new spacecraft lead, hired from scratch.</p><div class="acts"><button class="pri" data-a="aproll" data-id="1">SEND ${escapeHtml(mercuryLead.name.toUpperCase())} TO APOLLO</button><button data-a="aproll" data-id="0">KEEP ${escapeHtml(mercuryLead.name.toUpperCase())} ON GEMINI</button></div>` };
  }
  if (!state.sz) return { ...base, kind: 'decision', subject: 'Commission the Apollo study',
    body: `<p>${lead ? `I have the Mercury spacecraft team with me.` : 'The Mercury engineers are here, without their lead.'} They bring ${state.xp} crewed Mercury flight${state.xp == 1 ? '' : 's'} of experience. How thorough should the study be?</p>`
      + Object.entries(STUDY_SIZES).map(([key, study]) => `<div class="r"><span><b>${study.name}</b> · <span class="m">${study.why} About ${Math.round(studyDays(key) / 30)} months.</span></span><button data-a="apstudy" data-id="${key}"${S.b < study.cost ? ' disabled' : ''}>COMMISSION · ${formatMoney(study.cost)}</button></div>`).join('') };
  if (!state.done) return { ...base, kind: 'report', subject: 'The Apollo study is under way',
    body: `<p>${STUDY_SIZES[state.sz].name}: about ${Math.max(1, Math.round(state.t / 30))} month${Math.round(state.t / 30) > 1 ? 's' : ''} to go. Direct ascent, Earth-orbit rendezvous and lunar-orbit rendezvous are each being costed.</p><div class="bar"><i style="width:${Math.round((1 - state.t / state.tot) * 100)}%"></i></div>` };
  const evidence = ['rdv', 'dock', 'eva'].filter(capabilityShown).length;
  const table = ARCHITECTURE_ORDER.map(key => {
    const architecture = ARCHITECTURES[key], chosen = state.arch == key;
    return `<div class="c"><div class="r"><b>${architecture.name}</b><span class="d">${architecture.launches} ${architecture.booster} launch${architecture.launches > 1 ? 'es' : ''}</span></div><div class="m">${escapeHtml(architecture.why)}</div>`
      + ['cost', 'years', 'risk'].map(stat => `<div class="r"><span>${ESTIMATE_LABELS[stat]}</span><b>${ESTIMATE_TEXT[stat](estimate(key, stat))}</b></div>`).join('')
      + (state.arch ? (chosen ? '<div class="m"><b>Chosen.</b></div>' : '') : `<div class="acts"><button data-a="aparch" data-id="${key}">GO WITH ${architecture.name.toUpperCase()}</button></div>`) + '</div>';
  }).join('');
  if (state.arch) return { ...base, kind: 'report', subject: `Apollo goes by ${ARCHITECTURES[state.arch].name.toLowerCase()}`, body: table };
  return { ...base, kind: 'decision', subject: 'The Apollo study has reported: choose the way to the Moon',
    body: `<p>Here are the three approaches, costed. The ranges are how sure the study is.</p><p class="m">${evidence < 3 ? 'Gemini has not yet flown everything a rendezvous needs. Each rendezvous, docking or spacewalk it flies firms up the risk figures of the two rendezvous approaches, so waiting buys certainty at the cost of schedule.' : 'Gemini has flown rendezvous, docking and spacewalks: the rendezvous risk figures are as firm as this study can make them.'}</p>${table}` };
}

// THE SAFETY BAR (rules/safety.js): the engineers' estimates for each crew rocket against the bar you set.
const percent = chance => chance < .005 ? 'under 0.5%' : `${(chance * 100).toFixed(1)}%`;
const stepper = (action, value, low, high, id = '') => `<button class="step" data-a="${action}" data-n="-1"${id ? ` data-id="${id}"` : ''}${value <= low ? ' disabled' : ''}>−</button><button class="step" data-a="${action}" data-n="1"${id ? ` data-id="${id}"` : ''}${value >= high ? ' disabled' : ''}>+</button>`;
// PRESSURE ON APOLLO (rules/pressure.js): the press, the public and Congress, in words and headlines.
function pressureMessage() {
  const state = pressure();
  if (!state) return null;
  const rows = Object.entries(PRESSURES).map(([key, each]) => `<div class="r"><span>${each.name}</span><b class="${pressureLevel(key) >= 2 ? 'wn' : ''}">${pressureWords(key)}</b></div><div class="m">${each.effect}</div>`).join('');
  const headlines = state.hl.slice().reverse().map(line => `<div class="m"><span class="d">${formatDate(line.d)}</span> ${escapeHtml(line.t)}</div>`).join('');
  // SHIELDING THE CREW (rules/requests.js): what you can do yourself, and when each is ready again.
  const hearing = hearingOpen();
  const shields = Object.entries(SHIELDS).map(([key, each]) => shieldReady(key) && !(key == 'testify' && hearing)
    ? `<button data-a="shield" data-id="${key}">${each.name.toUpperCase()}</button>`
    : `<button disabled>${each.name.toUpperCase()}${state.sh && state.sh[key] > S.day ? ` (FROM ${formatDate(state.sh[key]).toUpperCase()})` : ''}</button>`).join('');
  const notes = [
    hearing && `${HEARINGS[hearing.k].name} sits on ${formatDate(hearing.d)}. ${memberName(hearing.lead)} is preparing and is off other work until then. The committee will read the record: risks accepted under pressure, and ground tests run.`,
    state.vouch > S.day && `You vouched for Apollo at a briefing: a crewed flight that fails before ${formatDate(state.vouch)} costs more.`,
    state.sd > S.day && `The crews are stood down until ${formatDate(state.sd)}.`,
  ].filter(Boolean).map(line => `<p class="m">${escapeHtml(line)}</p>`).join('');
  return {
    id: 'pressure', kind: 'report', from: 'Public Affairs Office', role: 'Press, public and Congress', pane: 'note', subject: 'How Washington sees Apollo',
    body: rows + notes + `<div class="acts">${shields}</div>` + (headlines ? `<div class="lbl">HEADLINES</div>${headlines}` : ''),
  };
}
function safetyMessage() {
  const bar = safetyBar();
  if (!bar) return null;
  const rockets = crewRockets().map(kind => {
    const { tests, evidence, figures } = estimates(kind), safety = estimatedSafety(figures), testing = bar.j && bar.j.k == designKey(kind);
    // The record behind the figures: tests signed off against data sheets on file (a skipped test leaves a gap), any letters.
    const sheets = dataSheets(kind), letters = (S.p2.lt || []).filter(letter => letter.k == kind)
      .map(letter => `<div class="m wn"><span class="d">${formatDate(letter.d)}</span> An engineer writes: a test on this rocket was signed off, but nobody saw it run.</div>`).join('');
    const record = `<div class="m">${tests ? `${sheets} data sheet${sheets == 1 ? '' : 's'} on file. ` : ''}${testsWaived(kind) ? 'The tests still owed on this revision were waived. ' : ''}</div>`
      + letters + (tests ? `<div class="acts"><button data-a="sfretest" data-id="${kind}">RE-RUN ITS TESTS</button></div>` : '');
    const rows = Object.entries(figures).map(([key, risk]) => `<div class="r"><span>${escapeHtml(componentName(key))}</span><span class="nw"><span class="d">tests ${percent(evidence[key])} · lead</span> <b class="${risk > limitFor(key) ? 'wn' : ''}">${percent(risk)}</b> <span class="d">limit ${percent(limitFor(key))}</span> ${stepper('sflim', limitFor(key), LIMIT_RANGE[0], LIMIT_RANGE[1], key)}</span></div>`).join('');
    return `<div class="c"><div class="r"><b>${escapeHtml(PROGRAMMES[kind].name)}</b><span><span class="d">tests ${percent(estimatedSafety(evidence))} · lead</span> <b class="${safety < bar.tgt ? 'wn' : ''}">${percent(safety)} to orbit</b></span></div>`
      + `<div class="m">${tests} ground test${tests == 1 ? '' : 's'} signed off on this revision${testing ? `, one under way (${Math.max(1, Math.round(bar.j.d))} days)` : tests < bar.n ? `, ${formatMoney(testCost(kind))} each` : ''}.</div>${record}${rows}</div>`;
  }).join('');
  return {
    id: 'safety', kind: 'report', from: 'Office of Manned Space Flight', role: 'Safety and reliability', pane: 'note', subject: 'The safety bar for crewed launches',
    body: '<p>Every crewed launch must clear this bar. For each part of a rocket\'s current revision you see two figures: the failure chance the tests support, and the lead\'s reading of it, which is what the launch is judged on. Each ground test firms the evidence up; none is ever exact.</p>'
      + `<div class="r"><span>Target: chance of reaching orbit</span><span><b>${percent(bar.tgt)}</b> ${stepper('sftgt', bar.tgt, TARGET_RANGE[0], TARGET_RANGE[1])}</span></div>`
      + `<div class="r"><span>Ground tests per new revision</span><span><b>${bar.n}</b> ${stepper('sftests', bar.n, TESTS_RANGE[0], TESTS_RANGE[1])}</span></div>`
      + (rockets || '<div class="m">No crew rocket is in production yet.</div>'),
  };
}

// A LEAD REQUEST (rules/requests.js): Ellis's team asks for a limit raised or tests waived, under pressure.
function requestMessage() {
  const request = openRequest();
  if (!request) return null;
  const reason = reasonOnFile(request);
  return {
    id: 'request', kind: request.prove ? 'report' : 'decision', from: memberName('ellis'), role: memberRole('ellis'), pane: 'note',
    subject: request.prove ? 'Waiting on the test you asked for' : 'My team is asking for something',
    body: `<p>${escapeHtml(leadRequestText(request))}</p>`
      + (request.prove
        ? '<p class="m">A ground test is running first, as you asked. The request comes back with its result.</p>'
        : '<p class="m">Granting it eases the pressure and puts the risk on the record. A refusal with the test results behind it costs little; one with no reason costs more.</p>'
          + `<div class="acts"><button data-a="rqans" data-id="accept">GRANT IT</button>${reason ? '<button data-a="rqans" data-id="reasoned">REFUSE: THE TESTS SAY NO</button>' : ''}<button data-a="rqans" data-id="refuse">REFUSE</button><button class="pri" data-a="rqans" data-id="prove">PROVE IT WITH A TEST FIRST</button></div>`),
  };
}

function remitMessage() {
  const remit = S.remit, from = memberName('ellis'), role = memberRole('ellis');
  if (!remit) {
    if (!remitUnlocked() || !PROGRAMMES[S.cur]) return null;
    const empty = !S.crew.prop ? ' I would leave the PROP console: hire a Propulsion Engineer at the Crew desk if you want it staffed.' : '';
    return {
      id: 'remit', kind: 'report', from, role, subject: 'I can take the routine engineering off your desk', pane: 'note',
      body: `<p>Give me a spending cap for the ${escapeHtml(PROGRAMMES[S.cur].name)} and I will run its records analyses, fixes and test-stand runs myself, paying for each as it starts.${empty}</p><p class="m">${authorityText()} Anything outside that comes to you here.</p><div class="acts">${REMIT_CAPS.map(cap => `<button data-a="rstart" data-id="${cap}">${formatMoney(cap)} CAP</button>`).join('')}</div>`,
    };
  }
  const referred = referredFindings(), name = escapeHtml(PROGRAMMES[remit.prog].name);
  const asks = [];
  if (referred.length) asks.push(`<p>I need your call on ${referred.map(incident => `#${incident.id} ${escapeHtml(incident.lab)} (${incident.conf} confidence)`).join(', ')}.</p>`);
  if (remit.dry) asks.push(`<p>The cap cannot cover ${escapeHtml(remit.dry)}. Raise it, or close the remit and the work comes back to you.</p>`);
  return {
    id: 'remit', kind: asks.length ? 'decision' : 'report', from, role, pane: 'note',
    subject: asks.length ? `The ${PROGRAMMES[remit.prog].name} remit needs you` : `Running the ${PROGRAMMES[remit.prog].name} engineering`,
    body: asks.join('') + `<p>${remit.jobs} job${remit.jobs == 1 ? '' : 's'} started on the ${name}, ${formatMoney(remit.spent)} of ${formatMoney(remit.cap)} spent.</p><p class="m">${authorityText()}</p>`
      + `<div class="acts">${referred.length ? '<button data-a="mailremit">OPEN THE INCIDENTS</button>' : ''}<button data-a="rraise">RAISE BY ${formatMoney(REMIT_RAISE)}</button><button data-a="rraise" data-n="2">DOUBLE TO ${formatMoney(2 * S.remit.cap)}</button><button data-a="rend">CLOSE THE REMIT</button></div>`,
  };
}

// THE MERCURY TESTS (rules/flight-ops.js): Ellis's offer once NASA is formed, then the running tests. A launch she has ready is a
// decision: greenlight it (or the next three of its kind), attend it in Watch, or not yet. A crewed series you can authorise here.
function opsMessage() {
  const record = S.ops, from = memberName('ellis'), role = memberRole('ellis');
  if (!record) {
    if (!opsUnlocked()) return null;
    return { id: 'ops', kind: 'report', from, role, pane: 'note', subject: 'I can run the Mercury tests',
      body: `<p>Give me a spending cap and I will plan each Mercury test: order the capsules and boosters, fly the man-rating flights and bring each launch to the pad. Every launch waits for your greenlight; once you have greenlit three of a kind of uncrewed flight, its repeats fly on that approval. Crewed flights always need your go-ahead.</p><div class="acts">${OPS_CAPS.map(cap => `<button data-a="fstart" data-id="${cap}">${formatMoney(cap)} CAP</button>`).join('')}</div>` };
  }
  const ready = record.ready, account = `<div class="r"><span>${record.n} launch${record.n == 1 ? '' : 'es'}, ${record.okn} good</span><b>${formatMoney(record.spent)} of ${formatMoney(record.cap)}</b></div>`;
  const series = record.series ? `<div class="r"><span>Crewed series: ${record.series.n} ${escapeHtml(MISSION_TYPES[record.series.mt].fullName)} flight${record.series.n == 1 ? '' : 's'} left</span><b><button data-a="fsend">END</button></b></div>`
    : `<div class="m">Authorise a crewed series to give the astronauts flight time; she flies it while the directive waits on something.</div><div class="acts">${['mr', 'mo'].filter(type => !seriesLock(type)).map(type => `<button data-a="fseries" data-id="${type}" data-n="3">3 CREWED ${type == 'mo' ? `ORBITAL (${SERIES_ORBITS} ORBITS)` : 'SUBORBITAL'}</button>`).join('') || '<span class="d">No crewed series can fly yet.</span>'}</div>`;
  const tail = `${account}${series}<div class="acts"><button data-a="fraise">RAISE BY ${formatMoney(OPS_RAISE)}</button><button data-a="fraise" data-n="2">DOUBLE TO ${formatMoney(2 * record.cap)}</button><button data-a="fend">TAKE THE TESTS BACK</button></div>`;
  if (ready) return { id: 'ops', kind: 'decision', from, role, pane: 'note', subject: `Ready to fly: ${ready.what}`,
    body: `<p>${escapeHtml(ready.what[0].toUpperCase() + ready.what.slice(1))} is ready.${ready.crewed ? ' A crew flies: it needs your go-ahead.' : ''}</p><div class="acts"><button class="pri" data-a="fgo">GREENLIGHT</button><button data-a="fgo" data-n="3">GREENLIGHT THE NEXT 3</button>${ready.rating ? '' : '<button data-a="fattend">ATTEND IN WATCH</button>'}<button data-a="fnot">NOT YET</button></div>${tail}` };
  if (record.hold) return { id: 'ops', kind: 'decision', from, role, pane: 'note', subject: 'The Mercury tests need you', body: `<p class="wn">${escapeHtml(record.hold)}</p>${tail}` };
  const directive = opsDirectiveName();
  return { id: 'ops', kind: 'report', from, role, pane: 'note', subject: directive ? `Working on: ${directive}` : 'The Mercury tests',
    body: `${record.wait ? `<div class="m">Waiting: ${escapeHtml(record.wait)}.</div>` : '<div class="m">Planning the next launch.</div>'}${tail}` };
}

// THE CULTURE (rules/culture.js): Ellis's note on how the programme works, in words, once the team has seen enough of your habits.
// With a launch director, a line on how sure of themselves the crews are.
function cultureMessage() {
  const words = cultureWords();
  if (!words) return null;
  // A team short of money leans its own way: say so for each lead whose budget is nearly spent.
  const pressed = Object.keys(TEAM_LINES).filter(lead => memberJoined(lead) && budgetPressure(lead) >= .3)
    .map(lead => `<p class="wn">${escapeHtml(memberName(lead))}'s team is running short of money. Teams in that position take more chances and play faults down.</p>`).join('');
  const risks = acceptedRisks().slice(0, 4).map(risk => `<div class="r"><span>${escapeHtml(risk.t)}</span><b class="d">${formatDate(risk.d)}</b></div>`).join('');
  const recent = recentHabits().slice(0, 5).map(habit => `<div class="r"><span>${escapeHtml(habit.t || HABITS[habit.k].name)}</span><b class="d">${formatDate(habit.d)}</b></div>`).join('');
  return {
    id: 'culture', kind: 'report', from: memberName('ellis'), role: memberRole('ellis'), pane: 'note',
    subject: `How we do things here: ${words.name}`,
    body: `<p>${escapeHtml(words.line)}</p>${S.staff.director ? `<p>${escapeHtml(confidenceWords())}</p>` : ''}${pressed}${risks ? `<p class="m">Risks the teams have accepted lately:</p>${risks}` : ''}<p class="m">What the team has seen lately:</p>${recent}`
      + '<p class="m">The team works the way you do: when they run things themselves, they run them in this style. Crewed flights always come to you.</p>',
  };
}

// THE V-2 PANEL: nose space on the next Army V-2 (rules/neighbours.js), and the Army's Bumper offer.
function v2PanelMessage() {
  if (!v2Flying()) return null;
  const ride = S.v2.ride, bumperOn = S.v2.bump && S.v2.bump.st == 'on', choices = ridePayloads();
  const body = ride ? `<p>Your ${escapeHtml(ride)} is booked in the nose of the next Army V-2. If the V-2 flies well, you get half the data back; if it fails, the payload is lost with it.</p>`
    : bumperOn ? '<p>The next V-2s carry Bumper, so there is no nose space to sell.</p>'
    : `<p>The Army's V-2s fly about once a month, and we sell nose space to anyone with instruments ready: the payload, plus our fee of ${formatMoney(RIDE_FEE)}. You share the nose and the telemetry, so you get half the science a flight of your own would bring, and your instrument people learn from it. About a third of the V-2s fail, and the payload goes with them. Film has to survive the fall.</p><div class="acts">${choices.map(name => `<button data-a="v2ride" data-id="${escapeHtml(name)}"${S.b < rideCost(name) ? ' disabled' : ''}>BOOK THE ${escapeHtml(name.toUpperCase())} (${formatMoney(rideCost(name))})</button>`).join('')}</div>`;
  return { id: 'v2', kind: 'report', from: 'V-2 Upper Atmosphere Panel', role: 'White Sands', pane: 'note', subject: ride ? `Your ${ride} rides the next V-2` : 'Nose space on the next V-2', body };
}
function bumperMessage() {
  const bump = S.v2.bump;
  if (!bump || bump.st != 'offer') return null;
  return {
    id: 'bump', kind: 'decision', from: 'Army Ordnance', role: 'with General Electric', pane: 'note', subject: 'Project Bumper: your WAC Corporal on a V-2',
    body: `<p>Your WAC Corporal has proved itself. We propose putting it on top of a V-2: the V-2 lifts it out of the thick air, and it lights and climbs on its own. Nobody has staged a rocket like that yet.</p><p>The next ${BUMPER_FLIGHTS} V-2s would carry it, at ${formatMoney(BUMPER_COST)} a flight for the rocket and the integration work, paid as each one flies. The last two would fly long and low from the new range in Florida.</p><p class="m">Your staging engineers rate the chance of a clean separation and light at about ${Math.round(separationChance() * 100)}%. Every flight teaches them about staging, the failures most of all. Bumper counts for the multi-stage and downrange firsts, not for your altitude records.</p><div class="acts"><button class="pri" data-a="bumpyes">FLY BUMPER</button><button data-a="bumpno">NO, THANK YOU</button></div>`,
  };
}

// THE CORPORAL CONTRACT (rules/corporal.js): the Army's offer, then a running report while it lasts.
function corporalMessage() {
  const corp = S.corp;
  if (!corp || corp.st == 'no' || (corp.st == 'done' && S.nasa)) return null;
  const total = CORPORAL_MILESTONES.reduce((sum, each) => sum + each.pay, 0);
  if (corp.st == 'offer') return {
    id: 'corp', kind: 'decision', from: 'Army Ordnance', role: 'Guided missiles', pane: 'note', subject: 'Develop the Corporal guided missile for us',
    body: `<p>The people who built your WAC Corporal know more about liquid rockets than anyone we have. We want a guided missile from them: the Corporal. Your sounding rockets carry on beside it.</p><p>${CORPORAL_MILESTONES.length} milestones, ${formatMoney(total)} in all. Each takes one of your engineering teams while it runs, and each has a date: one finished late pays ${Math.round(CORPORAL_LATE_SHARE * 100)}%. The work teaches your own rockets a little as it goes.</p>`
      + CORPORAL_MILESTONES.map(each => `<div class="r"><span>${escapeHtml(each.name)}</span><b class="d">${formatMoney(each.pay)}</b></div>`).join('')
      + '<p class="m">If you decline, the Army takes the Corporal elsewhere. If you deliver it, the Army backs your next missile programme.</p><div class="acts"><button class="pri" data-a="corpyes">TAKE THE CONTRACT</button><button data-a="corpno">DECLINE</button></div>',
  };
  const job = corporalJob(), next = nextMilestone();
  return {
    id: 'corp', kind: 'report', from: 'Army Ordnance', role: 'Guided missiles', pane: 'note', subject: corp.st == 'done' ? 'The Corporal is delivered' : `Corporal: ${corp.m} of ${CORPORAL_MILESTONES.length} milestones`,
    body: corp.st == 'done' ? `<p>The Corporal is ours. The Army paid ${formatMoney(corp.paid)}${corp.late ? `, less for ${corp.late} late milestone${corp.late == 1 ? '' : 's'}` : ''}. When we want our next missile, we come to you first.</p>`
      : `<p>${escapeHtml(next.name)}: ${job ? `a team is on it, ${job.t}s to go` : '<span class="wn">waiting for a free engineering team</span>'}. Due ${formatDate(milestoneDue(corp.m))}.</p><div class="r"><span>Paid so far</span><b>${formatMoney(corp.paid)} of ${formatMoney(total)}</b></div>`,
  };
}

function messages() {
  const list = [], camp = S.auto.camp, invitation = S.auto.inv;
  // ELLIS'S INVITATION to a first (rules/invitations.js): a decision until you answer it, then a note while you are to fly it.
  if (invitation && !invitation.ok) list.push({
    id: 'inv', kind: invitation.attend ? 'report' : 'decision', from: memberName('ellis'), role: memberRole('ellis'), pane: 'note',
    subject: `You are invited to ${invitation.what}`,
    body: invitation.attend
      ? `<p>I am bringing ${escapeHtml(invitation.what)} to the pad. My crews run the count in Watch; you watch, and you can still hold or scrub.</p><div class="acts"><button class="pri" data-desk="watch">OPEN WATCH</button><button data-a="iproceed">LET FLIGHT CONTROL PROCEED AFTER ALL</button></div>`
      : `<p>The campaign's next flight is ${escapeHtml(invitation.what)}. Attend and watch it from the control room while my crews fly it, or let Flight Control proceed without you.</p><p class="m">If I hear nothing in about ${invitation.turns * DIRECTOR_CADENCE} seconds, Flight Control proceeds.</p><div class="acts"><button class="pri" data-a="iattend">ATTEND</button><button data-a="iproceed">LET FLIGHT CONTROL PROCEED</button></div>`,
  });
  if (camp && camp.hold) list.push({
    id: 'camp', kind: 'decision', from: memberName('ellis'), role: memberRole('ellis'), subject: 'The campaign needs your guidance', pane: 'note',
    body: `<p>${escapeHtml(camp.hold)}</p><p class="m">Fly the next one yourself from Watch, or tell me to go ahead.</p><div class="acts"><button data-a="cgo">GO AHEAD</button><button data-desk="watch">OPEN WATCH</button></div>`,
  });
  for (const prog of briefProgrammes()) {
    const brief = briefMessage(prog);
    if (brief) list.push(brief);
  }
  const staff = researchStaffMessage();
  if (staff) list.push(staff);
  const apolloNote = apolloMessage();
  if (apolloNote) list.push(apolloNote);
  const request = requestMessage();
  if (request) list.push(request);
  const safety = safetyMessage();
  if (safety) list.push(safety);
  const press = pressureMessage();
  if (press) list.push(press);
  const remit = remitMessage();
  if (remit) list.push(remit);
  const operations = opsMessage();
  if (operations) list.push(operations);
  const culture = cultureMessage();
  if (culture) list.push(culture);
  const corporal = corporalMessage();
  if (corporal) list.push(corporal);
  const bumper = bumperMessage();
  if (bumper) list.push(bumper);
  const v2Panel = v2PanelMessage();
  if (v2Panel) list.push(v2Panel);
  const incidents = waitingIncidents();
  if (incidents.length) list.push({
    id: 'inc', kind: 'decision', from: memberName('ellis'), role: memberRole('ellis'), subject: `${incidents.length} incident${incidents.length == 1 ? '' : 's'} waiting for you`, pane: 'note',
    body: `<p>${incidents.map(incident => `#${incident.id} ${escapeHtml(incident.lab)}`).join(', ')}. Each needs records analysis, a call on the findings, or a fix before the rocket flies again with confidence.</p><div class="acts"><button data-a="mailinc">OPEN THE INCIDENTS</button></div>`,
  });
  const directive = DIRECTIVES[S.dir];
  list.push({
    id: 'dir', kind: nasaReady() ? 'decision' : 'directive', from: S.nasa ? 'NASA Headquarters' : 'Defense Department', pane: 'dir',
    subject: nasaReady() ? 'The National Aeronautics and Space Act' : S.nasa && S.p2 ? 'Your Mercury directive' : directive ? `Directive ${S.dir + 1}: ${directive.name}` : 'All directives complete',
  });
  list.push({ id: 'race', kind: 'report', from: 'Intelligence', subject: S.nasa ? 'The space race' : 'Firsts and the Soviet programme', pane: 'race' });
  list.push({ id: 'log', kind: 'log', from: 'Teleprinter', subject: 'Range and programme log', pane: 'log' });
  return list;
}
// How many messages ask for a decision (the Mail button's badge).
export const mailWaiting = () => messages().filter(message => message.kind == 'decision').length;

const card = (title, body) => `<div class="card"><div class="lbl">${title}</div>${body}</div>`;
// THE RIGHT COLUMN: the next launch, the work in your team's hands, and the core team.
function sideHTML() {
  const ready = S.air.filter(airframe => airframe.st == 'r').length;
  let html = card('NEXT LAUNCH', launchView.count
    ? `<div class="big">${escapeHtml(launchView.count.label)}</div><div class="m">Countdown or flight under way.</div><button class="pri" data-desk="watch">WATCH</button>`
    : `<div class="big">${ready ? `${ready} rocket${ready == 1 ? '' : 's'} ready` : 'Nothing ready to fly'}</div><div class="m">${ready ? 'Set up the launch in Watch.' : 'Order airframes in Hangar.'}</div><button class="pri" data-desk="watch">OPEN WATCH</button>`);
  const research = S.jobs.filter(job => job.k == 'pk' && !job.ln).sort((a, b) => a.t - b.t);
  html += '<div class="lbl sub">IN YOUR TEAM\'S HANDS</div>';
  html += card(`RESEARCH · ${research.length} of ${S.teams} team${S.teams == 1 ? '' : 's'}`, research.length
    ? research.map(job => `<div class="r"><span>${escapeHtml(itemAsSeen(job.id).name)}</span><b data-j="${job.k + job.id}">${job.t}s</b></div><div class="bar"><i data-jb="${job.k + job.id}" style="width:${Math.round((1 - job.t / Math.max(1, job.tot)) * 100)}%"></i></div>`).join('')
    : '<div class="m">No research in work. Teams are idle.</div>');
  if (S.lanes) html += card(`RESEARCH LANES · ${memberName('chen')}`, Object.keys(LANES).map(area => {
    const job = laneJob(area);
    return `<div class="r"><span>${AREAS[area]}</span><b class="${job ? '' : 'd'}">${job ? `${job.t}s` : laneIdleReason(area)}</b></div>`
      + (job ? `<div class="m">${escapeHtml(itemAsSeen(job.id).name)}</div><div class="bar"><i data-jb="${job.k + job.id}" style="width:${Math.round((1 - job.t / Math.max(1, job.tot)) * 100)}%"></i></div>` : '');
  }).join('') + `<div class="r"><span>Spent</span><b>${formatMoney(S.lanes.spent)} of ${formatMoney(S.lanes.cap)}</b></div>`);
  const works = S.works;
  if (works) html += card(`PRODUCTION · ${memberName('reed')}`, `<div class="r"><span>${escapeHtml(PROGRAMMES[works.prog].name)}</span><b>${airframesOnHand(works.prog)} of ${airframesWanted()} on hand</b></div>${worksIdleReason() ? `<div class="m">Idle: ${escapeHtml(worksIdleReason())}.</div>` : ''}<div class="r"><span>Spent</span><b>${formatMoney(works.spent)} of ${formatMoney(works.cap)}</b></div><div class="bar"><i style="width:${Math.min(100, Math.round(works.spent / works.cap * 100))}%"></i></div>`);
  html += card(`FACTORY · ${S.aq.length} in the queue`, S.aq.length ? `<div class="m">Next out: ${S.aq[0].k == 'build' ? 'airframe' : S.aq[0].k == 'retro' ? 'retrofit' : 'spacecraft'} <span data-q="0"></span></div><div class="bar"><i data-qb="0"></i></div>` : '<div class="m">The factory floor is empty.</div>');
  const camp = S.auto.camp;
  if (camp) html += card(`CAMPAIGN · ${memberName('ellis')}`, `<div class="r"><span>Flights flown</span><b>${camp.n}</b></div><div class="r"><span>Spent</span><b>${formatMoney(camp.spent)} of ${formatMoney(camp.budget)}</b></div><div class="bar"><i style="width:${Math.min(100, Math.round(camp.spent / camp.budget * 100))}%"></i></div>`);
  const order = standingOrder();
  if (order) html += card(`STANDING ORDER · ${memberName('ellis')}`, `<div class="r"><span>Flights flown</span><b class="${order.hold ? 'wn' : ''}">${order.hold ? 'waiting for you' : orderWaiting() || `${order.n}, ${order.okn} good`}</b></div><div class="r"><span>Paid by customers</span><b>${formatMoney(order.paid)}</b></div><div class="r"><span>Requests open</span><b>${S.orders.reqs.length}</b></div>`);
  const remit = S.remit;
  if (remit) html += card(`REMIT · ${memberName('ellis')}`, `<div class="r"><span>${escapeHtml(PROGRAMMES[remit.prog].name)}</span><b>${remit.jobs} job${remit.jobs == 1 ? '' : 's'}</b></div><div class="r"><span>Spent</span><b>${formatMoney(remit.spent)} of ${formatMoney(remit.cap)}</b></div><div class="bar"><i style="width:${Math.min(100, Math.round(remit.spent / remit.cap * 100))}%"></i></div>`);
  html += '<div class="lbl sub">CORE TEAM</div>' + joinedMembers().map(id => `<div class="who"><i>${CORE_TEAM[id].name.split(' ').map(word => word[0]).join('')}</i><span><b>${memberName(id)}</b><span class="m">${memberRole(id)}</span></span></div>`).join('');
  return html;
}

export function renderMail() {
  const list = messages();
  if (!list.some(message => message.id == mail.open)) mail.open = list.find(message => message.kind == 'decision')?.id || 'dir';
  const open = list.find(message => message.id == mail.open);
  setHTML($('#mlist'), list.map(message => `<button class="msg${message.id == mail.open ? ' on' : ''}" data-a="mailopen" data-id="${message.id}"><span class="from">${escapeHtml(message.from)}</span><span class="subj">${escapeHtml(message.subject)}</span><span class="tag ${message.kind}">${KIND_NAMES[message.kind]}</span></button>`).join(''));
  setHTML($('#mhd'), `<div class="from">${escapeHtml(open.from)}${open.role ? ` · <span class="d">${escapeHtml(open.role)}</span>` : ''}</div><h2 class="subj">${escapeHtml(open.subject)}</h2>`);
  document.querySelectorAll('[data-mailpane]').forEach(pane => pane.hidden = pane.dataset.mailpane != open.pane);
  if (open.pane == 'note') setHTML($('#mnote'), open.body);
  setHTML($('#mside'), sideHTML());
  // Keep the log scrolled to its newest line when it is opened.
  if (open.pane == 'log') $('#lg').scrollTop = 1e9;
}
// Picking a message.
export function openMail(id) {
  mail.open = id;
  renderMail();
}
