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
import { LANES, LANE_CAPS, LANE_RAISE, laneLead, laneJob, laneIdleReason } from '../rules/lanes.js';
import { AIRFRAMES_ON_HAND, WORKS_CAPS, WORKS_RAISE } from '../rules/factory-lead.js';
import { remitUnlocked, referredFindings, incidentsWithEllis, authorityText, REMIT_CAPS, REMIT_RAISE } from '../rules/remit.js';
import { launchView } from './launch-view.js';
import { $, setHTML, escapeHtml } from './dom.js';

// Which message is open. pane: the reader block that shows its body (the directive, race and log panels are drawn elsewhere).
export const mail = { open: 'dir' };
const KIND_NAMES = { decision: 'Decision', directive: 'Directive', report: 'Report', log: 'Log' };

const waitingIncidents = () => incidentsWithEllis() ? [] : S.inc.filter(incident => incident.st == 'open' || incident.st == 'found' || incident.st == 'diag');

// ELLIS'S REMIT (rules/remit.js): her offer once she has earned it, then the running remit, which asks for a decision when the cap
// cannot cover her next job or she has referred findings to you.
// CHEN'S RESEARCH LANES (rules/lanes.js): her offer once she has joined, then the lanes at work, which ask for a decision when the
// budget cannot cover the next package.
const laneRows = () => Object.keys(LANES).map(area => {
  const lead = laneLead(area);
  return `<div class="r"><span>${AREAS[area]}</span><b class="${lead ? '' : 'd'}">${lead ? escapeHtml(lead.name) + (lead.pace < 1 ? ' (covering, slower)' : '') : `no ${STATIONS[LANES[area]].callSign} yet`}</b></div>`;
}).join('');
function lanesMessage() {
  const lanes = S.lanes, from = memberName('chen'), role = memberRole('chen');
  if (!memberJoined('chen')) return null;
  if (!lanes) {
    if (!PROGRAMMES[S.cur]) return null;
    return {
      id: 'lanes', kind: 'report', from, role, subject: 'Research lanes for the ' + PROGRAMMES[S.cur].name, pane: 'note',
      body: `<p>Give me a research budget for the ${escapeHtml(PROGRAMMES[S.cur].name)} and each station engineer runs the routine research in their own system, on a team of their own. Your engineering teams stay yours for milestones, experiments and anything urgent.</p>${laneRows()}<p class="m">A lane with no engineer waits for one; hire them at the Crew desk. The lanes will not move together: expect the tanks to come in before the engines now and then, and watch the rocket's weight.</p><div class="acts">${LANE_CAPS.map(cap => `<button data-a="lstart" data-id="${cap}">${formatMoney(cap)} BUDGET</button>`).join('')}</div>`,
    };
  }
  const name = PROGRAMMES[lanes.prog].name;
  return {
    id: 'lanes', kind: lanes.dry ? 'decision' : 'report', from, role, pane: 'note',
    subject: lanes.dry ? `The ${name} research budget is spent` : `Research lanes on the ${name}`,
    body: (lanes.dry ? `<p>The budget cannot cover ${escapeHtml(lanes.dry)}. Raise it, or close the lanes and the research comes back to you.</p>` : '')
      + `<p>${lanes.jobs} package${lanes.jobs == 1 ? '' : 's'} started, ${formatMoney(lanes.spent)} of ${formatMoney(lanes.cap)} spent.</p>${laneRows()}`
      + `<div class="acts"><button data-a="lraise">RAISE BY ${formatMoney(LANE_RAISE)}</button><button data-a="lend">CLOSE THE LANES</button></div>`,
  };
}

// REED'S FACTORY BUDGET (rules/factory-lead.js): her offer once she has joined, then production at work, which asks for a decision
// when she is holding an unbalanced blueprint or the budget cannot cover her next order.
const airframesOnHand = programme => S.air.filter(airframe => airframe.prog == programme && (airframe.st == 'r' || airframe.st == 'queued')).length
  + S.aq.filter(item => item.k == 'build' && item.prog == programme).length;
function worksMessage() {
  const works = S.works, from = memberName('reed'), role = memberRole('reed');
  if (!memberJoined('reed')) return null;
  if (!works) {
    if (!PROGRAMMES[S.cur] || !S.progs[S.cur].ready) return null;
    return {
      id: 'works', kind: 'report', from, role, subject: 'Production of the ' + PROGRAMMES[S.cur].name, pane: 'note',
      body: `<p>Give me a factory budget for the ${escapeHtml(PROGRAMMES[S.cur].name)} and I keep ${AIRFRAMES_ON_HAND} airframes ready or on the floor, upgrade the ready ones to each new blueprint and publish the blueprint as the research comes in, paying for each order as it starts.</p><p class="m">If a change would make the rocket heavier for its thrust (the tanks in before the engines), I hold it and ask you first.</p><div class="acts">${WORKS_CAPS.map(cap => `<button data-a="wstart" data-id="${cap}">${formatMoney(cap)} BUDGET</button>`).join('')}</div>`,
    };
  }
  const name = PROGRAMMES[works.prog].name, asks = [];
  if (works.hold) asks.push(`<p>I am holding the draft blueprint: it would cut liftoff thrust-to-weight by ${Math.round(-works.hold * 100)}%. I will publish once the engine work catches up. Publish now if you would rather fly the extra propellant and plan the loads around it.</p>`);
  if (works.dry) asks.push(`<p>The budget cannot cover ${escapeHtml(works.dry)}. Raise it, or hand production back to you.</p>`);
  return {
    id: 'works', kind: asks.length ? 'decision' : 'report', from, role, pane: 'note',
    subject: works.hold ? `Holding the ${name} blueprint` : works.dry ? `The ${name} factory budget is spent` : `Running ${name} production`,
    body: asks.join('') + `<p>${works.built} airframe${works.built == 1 ? '' : 's'} ordered and ${works.retro} upgraded, ${formatMoney(works.spent)} of ${formatMoney(works.cap)} spent. ${airframesOnHand(works.prog)} of ${AIRFRAMES_ON_HAND} on hand.</p>`
      + `<div class="acts">${works.hold ? '<button data-a="wpub">PUBLISH NOW</button>' : ''}<button data-a="wraise">RAISE BY ${formatMoney(WORKS_RAISE)}</button><button data-a="wend">HAND PRODUCTION BACK</button></div>`,
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
  const list = [], camp = S.auto.camp;
  if (camp && camp.hold) list.push({
    id: 'camp', kind: 'decision', from: memberName('ellis'), role: memberRole('ellis'), subject: 'The campaign needs your guidance', pane: 'note',
    body: `<p>${escapeHtml(camp.hold)}</p><p class="m">Fly the next one yourself from Watch, or tell me to go ahead.</p><div class="acts"><button data-a="cgo">GO AHEAD</button><button data-desk="watch">OPEN WATCH</button></div>`,
  });
  const remit = remitMessage();
  if (remit) list.push(remit);
  const lanes = lanesMessage();
  if (lanes) list.push(lanes);
  const works = worksMessage();
  if (works) list.push(works);
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
  if (works) html += card(`PRODUCTION · ${memberName('reed')}`, `<div class="r"><span>${escapeHtml(PROGRAMMES[works.prog].name)}</span><b>${airframesOnHand(works.prog)} of ${AIRFRAMES_ON_HAND} on hand</b></div>${works.hold ? '<div class="m">Holding an unbalanced blueprint.</div>' : ''}<div class="r"><span>Spent</span><b>${formatMoney(works.spent)} of ${formatMoney(works.cap)}</b></div><div class="bar"><i style="width:${Math.min(100, Math.round(works.spent / works.cap * 100))}%"></i></div>`);
  html += card(`FACTORY · ${S.aq.length} in the queue`, S.aq.length ? `<div class="m">Next out: ${S.aq[0].k == 'build' ? 'airframe' : S.aq[0].k == 'retro' ? 'retrofit' : 'spacecraft'} <span data-q="0"></span></div><div class="bar"><i data-qb="0"></i></div>` : '<div class="m">The factory floor is empty.</div>');
  const camp = S.auto.camp;
  if (camp) html += card(`CAMPAIGN · ${memberName('ellis')}`, `<div class="r"><span>Flights flown</span><b>${camp.n}</b></div><div class="r"><span>Spent</span><b>${formatMoney(camp.spent)} of ${formatMoney(camp.budget)}</b></div><div class="bar"><i style="width:${Math.min(100, Math.round(camp.spent / camp.budget * 100))}%"></i></div>`);
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
