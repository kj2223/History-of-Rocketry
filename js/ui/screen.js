// THE SCREEN: the header, era and control-room theme, the directive panel, tabs, and redrawing every panel.
// The game clock marks the screen dirty when something changes; main.js redraws it then, and refreshes the timers otherwise.
import { formatMoney } from '../core/util.js';
import { DIRECTIVES, DIRECTIVE_NEWS, ERAS } from '../data/history.js';
import { ROOMS } from '../data/launch-site.js';
import { S, load, logSink, today, formatDate, findJob } from '../core/state.js';
import { era } from '../rules/design.js';
import { grant } from '../rules/economy.js';
import { nasaReady, SPACE_ACT_DAY } from '../rules/race.js';
import { roomLevel } from '../rules/launch-site.js';
import { buildRate } from '../rules/factory.js';
import { catchUp, ensureStarter } from '../rules/game.js';
import { renderControlRoom, renderLaunchForm } from './launch-panel.js';
import { launchView, renderPad } from './launch-view.js';
import { renderDesignBureau, renderIncidents } from './design-bureau.js';
import { renderHangar, renderFacilities } from './hangar.js';
import { renderStaff, renderLaunchCrew } from './personnel.js';
import { renderRace } from './race-and-summaries.js';
import { renderAstronautOffice, renderMissionPlanner, mercuryDirectiveHTML, memorialHTML, sectionSummaryHTML } from './mercury-panels.js';
import { $, setHTML } from './dom.js';

let dirty = 1, shownEra = -1, shownRoom = -1, tab = 'launch';
export const markDirty = () => {
  dirty = 1;
};
export const needsRender = () => dirty;
// Forget the era and room shown, so a new game does not announce them.
export const resetScreen = () => {
  shownEra = shownRoom = -1;
};

// Log lines go to the log panel, and the last six to the pad while a countdown is open.
logSink.fn = (text, style) => {
  const line = document.createElement('div');
  line.className = style;
  line.textContent = text;
  $('#lg').append(line);
  $('#lg').scrollTop = 1e9;
  const padLog = $('#padlog');
  if (padLog && launchView.count) {
    padLog.append(line.cloneNode(true));
    while (padLog.children.length > 6) padLog.firstChild.remove();
  }
};

export function showTab(name) {
  tab = name;
  applyTab();
}
// The Design Bureau tab counts incidents waiting for analysis or a fix.
function applyTab() {
  document.querySelectorAll('[data-tab]').forEach(section => section.hidden = section.dataset.tab != tab);
  document.querySelectorAll('[data-tab-btn]').forEach(button => button.classList.toggle('on', button.dataset.tabBtn == tab));
  const waiting = S.inc.filter(incident => incident.st == 'open' || incident.st == 'diag').length;
  $('#tb-design').textContent = waiting ? `DESIGN BUREAU (${waiting})` : 'DESIGN BUREAU';
}

// THE HEADER: speed, date (and catch-up), the next appropriation, budget, reputation and records.
export function renderHeader() {
  document.querySelectorAll('[data-spd]').forEach(button => button.classList.toggle('on', +button.dataset.spd == (S.speed ?? 1)));
  $('#dt').textContent = today();
  const speedUp = catchUp();
  $('#cu').textContent = speedUp > 1.05 ? ` ×${speedUp.toFixed(1)}, catching up with history` : '';
  $('#gt').textContent = S.gt;
  $('#ga').textContent = formatMoney(grant());
  $('#bg').textContent = formatMoney(S.b);
  $('#rp').textContent = Math.round(S.rep) + '%';
  $('#ra').textContent = Math.round(S.hi || 0).toLocaleString() + ' m';
  $('#rv').textContent = Math.round(S.hs || 0).toLocaleString() + ' m/s';
  $('#rd').textContent = ((S.hd || 0) / 1000).toFixed(S.hd < 1e5 ? 1 : 0) + ' km';
}
function banner(subtitle, title, body) {
  const box = $('#bn');
  box.className = '';
  void box.offsetWidth; // restart the animation
  box.innerHTML = `<div class="d">${subtitle}</div><h1>${title}</h1><div>${body}</div>`;
  box.className = 's';
}
// The era and the control room set the page theme; a new one (or a bigger room) is announced with a banner.
function applyEra() {
  const current = era(), level = roomLevel(), root = document.documentElement;
  root.dataset.era = current;
  root.dataset.room = level;
  $('#era').textContent = `${S.nasa ? 'PROJECT MERCURY' : ERAS[current].name} • ${1946 + Math.floor(S.day / 360)}`;
  $('#site').textContent = ROOMS[level].name;
  // Labels that change with the era: data-l="early|middle|late".
  document.querySelectorAll('[data-l]').forEach(node => node.textContent = node.dataset.l.split('|')[current]);
  if (current != shownEra) {
    if (shownEra >= 0) banner(today(), ERAS[current].name, ERAS[current].tagline);
    shownEra = current;
  }
  if (level != shownRoom) {
    if (shownRoom >= 0 && level > shownRoom) banner('THE CONTROL ROOM GROWS', ROOMS[level].name, ROOMS[level].description);
    shownRoom = level;
  }
}

// THE DIRECTIVE PANEL: the Phase One directive, the Space Act and NASA, then the Mercury directive.
function directiveHTML() {
  const directive = DIRECTIVES[S.dir];
  let html = directive
    ? `<div class="t">Directive ${S.dir + 1}: ${directive.name}</div><div class="m">${directive.altitudeKm >= 120 ? 'Reach 120 km at orbital speed (7,000 m/s) with a satellite.' : `Reach ${directive.altitudeKm} km (as measured by your tracking).`} Reward ${formatMoney(directive.reward)}.</div><div class="m nar">${DIRECTIVE_NEWS[S.dir]}</div>`
    : '<div class="ok">All directives complete. First orbital flight achieved.</div>';
  if (!S.nasa && S.fs.f_orbit && !nasaReady()) html += `<div class="c nasa"><div class="t">THE NATIONAL AERONAUTICS AND SPACE ACT</div><div class="m">Your satellite has Washington talking about a civilian space agency, but Congress moves at its own pace. The Act is expected around <b>${formatDate(SPACE_ACT_DAY)}</b>; the calendar runs fast until then. Keep flying: science payloads still pay.</div></div>`;
  if (nasaReady()) html += `<div class="c nasa"><div class="t">THE NATIONAL AERONAUTICS AND SPACE ACT</div><div class="m">${S.fs.f_orbit ? 'With a satellite in orbit,' : 'Whatever your progress,'} Washington wants a civilian space agency, with your programme at its core. Establishing it closes Phase One and sets up crewed flight.</div><button data-a="nasa">ESTABLISH NASA</button></div>`;
  else if (S.nasa) html += `<div class="c nasa"><div class="ok">NASA established ${formatDate(S.nasa)}. Project Mercury (crewed flight) is the next chapter.</div><button data-a="summary">VIEW PHASE ONE SUMMARY</button></div>`;
  if (S.nasa && S.p2) html = mercuryDirectiveHTML() + `<button data-a="summary">VIEW PHASE ONE SUMMARY</button>`;
  return html;
}

// REDRAW EVERYTHING.
export function render() {
  dirty = 0;
  renderHeader();
  applyEra();
  setHTML($('#dr'), directiveHTML());
  $('#tb-astro').hidden = !S.nasa;
  renderAstronautOffice();
  renderMissionPlanner();
  showOverlays();
  renderControlRoom();
  renderRace();
  renderLaunchForm();
  if (launchView.count && launchView.count.phase != 'flight') renderPad();
  renderDesignBureau();
  renderIncidents();
  renderHangar();
  renderFacilities();
  renderStaff();
  renderLaunchCrew();
  applyTab();
}
// Between redraws, only the header and the countdown figures on jobs and the factory queue change.
export function refreshTimers() {
  renderHeader();
  document.querySelectorAll('[data-j]').forEach(node => {
    const job = findJob(candidate => candidate.k + candidate.id == node.dataset.j);
    if (job) node.textContent = job.t + 's';
  });
  document.querySelectorAll('[data-q]').forEach(node => {
    const item = S.aq[+node.dataset.q];
    if (!item) return;
    const progress = Math.round((item.tot - item.t) / item.tot * 100);
    node.textContent = `${progress}% (${Math.ceil(item.t / buildRate(item))}s)`;
    const bar = document.querySelector(`[data-qb="${node.dataset.q}"]`);
    if (bar) bar.style.width = progress + '%';
  });
}
// One-off overlays: the memorial after a crew is lost, then the Section 1 summary.
function showOverlays() {
  const state = S.p2;
  if (!state || launchView.count) return;
  const overlay = $('#sum');
  if (state.memo && overlay.hidden) {
    overlay.innerHTML = memorialHTML(state.memo);
    overlay.hidden = false;
    return;
  }
  if (state.secDone && !state.secShown && overlay.hidden) {
    state.secShown = 1;
    overlay.innerHTML = sectionSummaryHTML();
    overlay.hidden = false;
  }
}

export function initUI() {
  load();
  ensureStarter();
  $('#fl').hidden = true;
  $('#lc').hidden = false;
  logSink.fn('[SYSTEM] Radar tracking and a radio beacon are online. Expect approximate data only.', '');
  logSink.fn('[SYSTEM] Appropriations arrive every 30 seconds.', '');
  render();
}
