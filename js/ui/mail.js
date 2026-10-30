// MAIL, THE HOME SCREEN: the inbox of messages from your staff and from outside, the open message, and the work already in your
// team's hands. The messages are built fresh on every redraw from the game state; nothing here is saved.
//   kind: decision (asks you for something, counted on the Mail button), directive, report or log
import { formatMoney } from '../core/util.js';
import { DIRECTIVES } from '../data/history.js';
import { CORE_TEAM } from '../data/team.js';
import { S } from '../core/state.js';
import { nasaReady } from '../rules/race.js';
import { itemAsSeen } from '../rules/research.js';
import { memberName, memberRole } from '../rules/team.js';
import { launchView } from './launch-view.js';
import { $, setHTML, escapeHtml } from './dom.js';

// Which message is open. pane: the reader block that shows its body (the directive, race and log panels are drawn elsewhere).
export const mail = { open: 'dir' };
const KIND_NAMES = { decision: 'Decision', directive: 'Directive', report: 'Report', log: 'Log' };

const waitingIncidents = () => S.inc.filter(incident => incident.st == 'open' || incident.st == 'found' || incident.st == 'diag');

function messages() {
  const list = [], camp = S.auto.camp;
  if (camp && camp.hold) list.push({
    id: 'camp', kind: 'decision', from: memberName('vega'), role: memberRole('vega'), subject: 'The campaign needs your guidance', pane: 'note',
    body: `<p>${escapeHtml(camp.hold)}</p><p class="m">Fly the next one yourself from Watch, or tell me to go ahead.</p><div class="acts"><button data-a="cgo">GO AHEAD</button><button data-desk="watch">OPEN WATCH</button></div>`,
  });
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
  const research = S.jobs.filter(job => job.k == 'pk').sort((a, b) => a.t - b.t);
  html += '<div class="lbl sub">IN YOUR TEAM\'S HANDS</div>';
  html += card(`RESEARCH · ${research.length} of ${S.teams} team${S.teams == 1 ? '' : 's'}`, research.length
    ? research.map(job => `<div class="r"><span>${escapeHtml(itemAsSeen(job.id).name)}</span><b data-j="${job.k + job.id}">${job.t}s</b></div><div class="bar"><i data-jb="${job.k + job.id}" style="width:${Math.round((1 - job.t / Math.max(1, job.tot)) * 100)}%"></i></div>`).join('')
    : '<div class="m">No research in work. Teams are idle.</div>');
  html += card(`FACTORY · ${S.aq.length} in the queue`, S.aq.length ? `<div class="m">Next out: ${S.aq[0].k == 'build' ? 'airframe' : S.aq[0].k == 'retro' ? 'retrofit' : 'spacecraft'} <span data-q="0"></span></div><div class="bar"><i data-qb="0"></i></div>` : '<div class="m">The factory floor is empty.</div>');
  const camp = S.auto.camp;
  if (camp) html += card(`CAMPAIGN · ${memberName('vega')}`, `<div class="r"><span>Flights flown</span><b>${camp.n}</b></div><div class="r"><span>Spent</span><b>${formatMoney(camp.spent)} of ${formatMoney(camp.budget)}</b></div><div class="bar"><i style="width:${Math.min(100, Math.round(camp.spent / camp.budget * 100))}%"></i></div>`);
  html += '<div class="lbl sub">CORE TEAM</div>' + Object.keys(CORE_TEAM).map(id => `<div class="who"><i>${CORE_TEAM[id].name.split(' ').map(word => word[0]).join('')}</i><span><b>${memberName(id)}</b><span class="m">${memberRole(id)}</span></span></div>`).join('');
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
