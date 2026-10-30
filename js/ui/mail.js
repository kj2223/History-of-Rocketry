// MAIL, THE HOME SCREEN: the inbox of messages from your staff and from outside, the open message, and the work already in your
// team's hands. The messages are built fresh on every redraw from the game state; nothing here is saved.
//   kind: decision (asks you for something, counted on the Mail button), directive, report or log
import { formatMoney } from '../core/util.js';
import { DIRECTIVES } from '../data/history.js';
import { CORE_TEAM } from '../data/team.js';
import { S } from '../core/state.js';
import { nasaReady } from '../rules/race.js';
import { itemAsSeen } from '../rules/research.js';
import { memberName, memberRole, joinedMembers, memberJoined } from '../rules/team.js';
import { PROGRAMMES } from '../data/programmes.js';
import { STATIONS } from '../data/launch-site.js';
import { AREAS } from '../data/research.js';
import { LANES, LANE_RAISE, laneLead, laneJob, laneIdleReason } from '../rules/lanes.js';
import { AIRFRAMES_ON_HAND, WORKS_RAISE, airframesOnHand, airframesWanted, worksIdleReason } from '../rules/factory-lead.js';
import { remitUnlocked, referredFindings, incidentsWithEllis, authorityText, REMIT_CAPS, REMIT_RAISE } from '../rules/remit.js';
import { ORDER_RAISE, standingOrders, orderFor, orderWaiting, ordersTotals, requestText } from '../rules/orders.js';
import { DIRECTOR_CADENCE } from '../rules/auto.js';
import { LEAD_POSTS } from '../data/leads.js';
import { openPosts, hiredLead } from '../rules/leads.js';
import { SHARED_AREAS, SHARED_CAPS, SHARED_RAISE, proposals, isChoice, sharedIdleReason } from '../rules/shared-research.js';
import { BRIEF_SIZES, briefLines, briefTotal } from '../rules/brief.js';
import { launchView } from './launch-view.js';
import { $, setHTML, escapeHtml } from './dom.js';

// Which message is open. pane: the reader block that shows its body (the directive, race and log panels are drawn elsewhere).
export const mail = { open: 'dir' };
const KIND_NAMES = { decision: 'Decision', directive: 'Directive', report: 'Report', log: 'Log' };

const waitingIncidents = () => incidentsWithEllis() ? [] : S.inc.filter(incident => incident.st == 'open' || incident.st == 'found' || incident.st == 'diag');

// ELLIS'S REMIT (rules/remit.js): her offer once she has earned it, then the running remit, which asks for a decision when the cap
// cannot cover her next job or she has referred findings to you.
// THE PROGRAMME BRIEF (rules/brief.js): one letter per rocket for its flights (Ellis's standing order), production (Reed) and
// research (Chen's lanes). The offer for the rocket in focus while a lead is free; a running brief asks for a decision when any of
// its lines is held for you.
const laneRows = () => Object.keys(LANES).map(area => {
  const lead = laneLead(area), idle = S.lanes && laneIdleReason(area);
  return `<div class="r"><span>${AREAS[area]}</span><b class="${lead && !idle ? '' : 'd'}">${lead ? escapeHtml(lead.name) + (lead.pace < 1 ? ' (covering, slower)' : '') + (idle ? `: ${idle}` : '') : `no ${STATIONS[LANES[area]].callSign} yet`}</b></div>`;
}).join('');
const LINE_OFFERS = {
  flights: () => 'Ellis flies routine customer flights on it under a cap, on the cheapest rocket under order that reaches each request.',
  production: () => `Reed keeps ${AIRFRAMES_ON_HAND} airframes ready or on the floor (one more while it flies routine flights), upgrades them and publishes the blueprint, holding any change that makes it heavier for its thrust.`,
  research: () => 'Chen runs the routine research in each of its systems, one station engineer to a lane. Your teams stay yours for milestones.',
};
const LINE_NAMES = { flights: 'FLIGHTS', production: 'PRODUCTION', research: 'RESEARCH' };
// A running line: its account, its question for you if any, why it is quiet, and its buttons. { html, ask }
function runningLine(line, prog) {
  if (line == 'flights') {
    const order = orderFor(prog), waiting = !order.hold && orderWaiting(prog);
    return { ask: !!order.hold, html: `<div class="r"><span>${order.n} flight${order.n == 1 ? '' : 's'}, ${order.okn} good, ${formatMoney(order.paid)} paid</span><b>${formatMoney(order.spent)} of ${formatMoney(order.cap)}</b></div>`
      + (order.hold ? `<p class="wn">${escapeHtml(order.hold)}</p>` : `<div class="m">${waiting ? `Waiting: ${waiting}.` : 'Flying as requests come in.'}</div>`)
      + `<div class="acts">${order.hold ? `<button data-a="ores" data-id="${prog}">GO AHEAD</button>` : ''}<button data-a="oraise" data-id="${prog}">RAISE BY ${formatMoney(ORDER_RAISE)}</button><button data-a="oend" data-id="${prog}">CLOSE THE ORDER</button></div>` };
  }
  if (line == 'production') {
    const works = S.works, idle = worksIdleReason();
    const ask = works.hold ? `<p class="wn">Holding the draft blueprint: it would cut liftoff thrust-to-weight by ${Math.round(-works.hold * 100)}%. Reed publishes once the engine work catches up; publish now if you would rather fly the extra propellant.</p>` : works.dry ? `<p class="wn">The budget cannot cover ${escapeHtml(works.dry)}.</p>` : '';
    return { ask: !!ask, html: `<div class="r"><span>${works.built} ordered, ${works.retro} upgraded, ${airframesOnHand(prog)} of ${airframesWanted(prog)} on hand</span><b>${formatMoney(works.spent)} of ${formatMoney(works.cap)}</b></div>`
      + (ask || (idle ? `<div class="m">Idle: ${escapeHtml(idle)}.</div>` : '<div class="m">Work on the factory floor.</div>'))
      + `<div class="acts">${works.hold ? '<button data-a="wpub">PUBLISH NOW</button>' : ''}<button data-a="wraise">RAISE BY ${formatMoney(WORKS_RAISE)}</button><button data-a="wend">HAND PRODUCTION BACK</button></div>` };
  }
  const lanes = S.lanes;
  return { ask: !!lanes.dry, html: `<div class="r"><span>${lanes.jobs} package${lanes.jobs == 1 ? '' : 's'} started</span><b>${formatMoney(lanes.spent)} of ${formatMoney(lanes.cap)}</b></div>`
    + (lanes.dry ? `<p class="wn">The budget cannot cover ${escapeHtml(lanes.dry)}.</p>` : '') + laneRows()
    + `<div class="acts"><button data-a="lraise">RAISE BY ${formatMoney(LANE_RAISE)}</button><button data-a="lend">CLOSE THE LANES</button></div>` };
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
  const requests = orderFor(prog) ? `<div class="lbl">OPEN REQUESTS</div>${S.orders.reqs.length ? S.orders.reqs.map(request => `<div class="m">${escapeHtml(requestText(request))}${request.why ? ` <span class="d">(${escapeHtml(request.why)})</span>` : ''}</div>`).join('') : '<div class="m">No requests open. The next is expected soon.</div>'}` : '';
  return {
    id: 'brief-' + prog, kind: asks ? 'decision' : 'report', from: 'Programme office', role: 'Ellis, Reed and Chen', pane: 'note',
    subject: !running.length ? `A brief for the ${PROGRAMMES[prog].name}` : asks ? `The ${PROGRAMMES[prog].name} brief needs you` : `The ${PROGRAMMES[prog].name} brief`,
    body: (running.length ? '' : `<p>One approval and the ${name} runs day to day: flights, production and research, each under its own cap held by its lead. The money stays in the treasury until it is spent. Each line comes back to you here when it needs you.</p>`)
      + sections + requests + (offer ? `<p class="m">${running.length ? 'Add the free leads to this brief:' : 'Approve the brief at a size (the total of the caps for the free leads):'}</p>${offer}` : ''),
  };
}
// The rockets with a brief letter: any a lead runs, and the one in focus.
const briefProgrammes = () => [...new Set([S.cur, ...standingOrders(), S.works?.prog, S.lanes?.prog].filter(prog => prog && PROGRAMMES[prog]))];

// CHEN'S RESEARCH STAFF (rules/leads.js, rules/shared-research.js): the posts open to fill, each with its two candidates; the
// shared research line and its lanes; and the leads' milestone proposals, which ask for a decision.
function researchStaffMessage() {
  if (!memberJoined('chen')) return null;
  const posts = openPosts(), shared = S.shared, staffed = SHARED_AREAS.filter(area => hiredLead(area));
  const asks = SHARED_AREAS.filter(area => proposals(area).length);
  if (!posts.length && !staffed.length) return null;
  const postsHTML = posts.length ? `<div class="lbl">POSTS TO FILL</div>` + posts.map(area => `<div class="c"><div class="r"><b>${escapeHtml(LEAD_POSTS[area].title)}</b><span class="d">${AREAS[area]}</span></div>`
    + LEAD_POSTS[area].candidates.map(candidate => `<div class="r"><span><b>${escapeHtml(candidate.name)}</b> · <span class="m">${escapeHtml(candidate.note)}</span></span><button data-a="leadhire" data-id="${area}:${candidate.id}">HIRE · ${candidate.pace > 1 ? 'quicker' : candidate.pace < 1 ? 'slower' : 'steady'} · ${formatMoney(candidate.salary)}/cycle</button></div>`).join('') + '</div>').join('') : '';
  const lanesHTML = staffed.length ? `<div class="lbl">SHARED RESEARCH LINE</div><div class="c">` + SHARED_AREAS.map(area => {
    const lead = hiredLead(area), job = laneJob(area), idle = sharedIdleReason(area);
    return `<div class="r"><span>${AREAS[area]}</span><b class="${job ? '' : 'd'}">${lead ? escapeHtml(lead.name) : 'no lead'}${job ? `: ${escapeHtml(itemAsSeen(job.id).name)}, ${job.t}s` : idle ? `: ${idle}` : ''}</b></div>`;
  }).join('') + (shared.cap
    ? `<div class="r"><span>${shared.jobs} started</span><b>${formatMoney(shared.spent)} of ${formatMoney(shared.cap)}</b></div>${shared.dry ? `<p class="wn">The line cannot cover ${escapeHtml(shared.dry)}.</p>` : ''}<div class="acts"><button data-a="sraise">RAISE BY ${formatMoney(SHARED_RAISE)}</button><button data-a="sclose">CLOSE THE LINE</button></div>`
    : `<div class="m">Open the line and each lead runs the routine research of their area under it. Milestones still come to you first.</div><div class="acts">${SHARED_CAPS.map(cap => `<button data-a="sstart" data-id="${cap}">${formatMoney(cap)} LINE</button>`).join('')}</div>`) + '</div>' : '';
  const proposalsHTML = asks.map(area => {
    const lead = hiredLead(area), busy = !!laneJob(area);
    return `<div class="c"><div class="lbl">PROPOSAL · ${escapeHtml(lead.name)}</div>${isChoice(area) ? '<p class="wn">A choice: starting one approach closes the others.</p>' : ''}`
      + proposals(area).map(milestone => `<div class="r"><span><b>${escapeHtml(milestone.name)}</b> · <span class="m">${escapeHtml(milestone.why || '')}</span></span><button data-a="sapprove" data-id="${milestone.id}"${busy || S.b < milestone.cost ? ' disabled' : ''}>APPROVE · ${formatMoney(milestone.cost)}</button></div>`).join('')
      + `${busy ? '<div class="m">The lane is finishing a package; approve once it is done.</div>' : ''}<div class="acts"><button data-a="snot" data-id="${area}">NOT NOW</button></div></div>`;
  }).join('');
  return {
    id: 'staff', kind: asks.length || shared.dry ? 'decision' : 'report', from: memberName('chen'), role: memberRole('chen'), pane: 'note',
    subject: asks.length ? `${asks.length == 1 ? 'A milestone proposal' : 'Milestone proposals'} for you` : posts.length ? `${posts.length == 1 ? 'A research post' : 'Research posts'} to fill` : 'The shared research line',
    body: proposalsHTML + postsHTML + lanesHTML,
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
      + `<div class="acts">${referred.length ? '<button data-a="mailremit">OPEN THE INCIDENTS</button>' : ''}<button data-a="rraise">RAISE BY ${formatMoney(REMIT_RAISE)}</button><button data-a="rend">CLOSE THE REMIT</button></div>`,
  };
}

function messages() {
  const list = [], camp = S.auto.camp, invitation = S.auto.inv;
  // ELLIS'S INVITATION to a first (rules/invitations.js): a decision until you answer it, then a note while you are to fly it.
  if (invitation && !invitation.ok) list.push({
    id: 'inv', kind: invitation.attend ? 'report' : 'decision', from: memberName('ellis'), role: memberRole('ellis'), pane: 'note',
    subject: `You are invited to ${invitation.what}`,
    body: invitation.attend
      ? `<p>The pad is yours for ${escapeHtml(invitation.what)}. Fly it from Watch; the campaign waits until you do.</p><div class="acts"><button class="pri" data-desk="watch">OPEN WATCH</button><button data-a="iproceed">LET FLIGHT CONTROL PROCEED AFTER ALL</button></div>`
      : `<p>The campaign's next flight is ${escapeHtml(invitation.what)}. Attend and fly it yourself from Watch, or let Flight Control proceed without you.</p><p class="m">If I hear nothing in about ${invitation.turns * DIRECTOR_CADENCE} seconds, Flight Control proceeds.</p><div class="acts"><button class="pri" data-a="iattend">ATTEND</button><button data-a="iproceed">LET FLIGHT CONTROL PROCEED</button></div>`,
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
  const remit = remitMessage();
  if (remit) list.push(remit);
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
  if (works) html += card(`PRODUCTION · ${memberName('reed')}`, `<div class="r"><span>${escapeHtml(PROGRAMMES[works.prog].name)}</span><b>${airframesOnHand(works.prog)} of ${airframesWanted(works.prog)} on hand</b></div>${worksIdleReason() ? `<div class="m">Idle: ${escapeHtml(worksIdleReason())}.</div>` : ''}<div class="r"><span>Spent</span><b>${formatMoney(works.spent)} of ${formatMoney(works.cap)}</b></div><div class="bar"><i style="width:${Math.min(100, Math.round(works.spent / works.cap * 100))}%"></i></div>`);
  html += card(`FACTORY · ${S.aq.length} in the queue`, S.aq.length ? `<div class="m">Next out: ${S.aq[0].k == 'build' ? 'airframe' : S.aq[0].k == 'retro' ? 'retrofit' : 'spacecraft'} <span data-q="0"></span></div><div class="bar"><i data-qb="0"></i></div>` : '<div class="m">The factory floor is empty.</div>');
  const camp = S.auto.camp;
  if (camp) html += card(`CAMPAIGN · ${memberName('ellis')}`, `<div class="r"><span>Flights flown</span><b>${camp.n}</b></div><div class="r"><span>Spent</span><b>${formatMoney(camp.spent)} of ${formatMoney(camp.budget)}</b></div><div class="bar"><i style="width:${Math.min(100, Math.round(camp.spent / camp.budget * 100))}%"></i></div>`);
  if (standingOrders().length) {
    const totals = ordersTotals();
    html += card(`STANDING ORDERS · ${memberName('ellis')}`, standingOrders().map(prog => `<div class="r"><span>${escapeHtml(PROGRAMMES[prog].name)}</span><b class="${orderFor(prog).hold ? 'wn' : ''}">${orderFor(prog).hold ? 'waiting for you' : orderWaiting(prog) || `${orderFor(prog).n} flown`}</b></div>`).join('') + `<div class="r"><span>Paid by customers</span><b>${formatMoney(totals.paid)}</b></div><div class="r"><span>Requests open</span><b>${S.orders.reqs.length}</b></div>`);
  }
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
