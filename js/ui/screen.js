// THE SCREEN: the header, era and control-room theme, the directive panel, the desk drawer, and redrawing every panel.
// The game clock marks the screen dirty when something changes; main.js redraws it then, and refreshes the timers otherwise.
import { formatMoney } from '../core/util.js';
import { DIRECTIVES, DIRECTIVE_NEWS, ERAS } from '../data/history.js';
import { ROOMS, STATIONS } from '../data/launch-site.js';
import { S, load, logSink, today, formatDate, findJob } from '../core/state.js';
import { era } from '../rules/design.js';
import { grant } from '../rules/economy.js';
import { nasaReady, SPACE_ACT_DAY } from '../rules/race.js';
import { roomLevel } from '../rules/launch-site.js';
import { buildRate } from '../rules/factory.js';
import { itemAsSeen } from '../rules/research.js';
import { catchUp, ensureStarter } from '../rules/game.js';
import { renderControlRoom, renderLaunchForm, renderCampaign } from './launch-panel.js';
import { launchView, renderPad } from './launch-view.js';
import { renderResearchDesk } from './design-bureau.js';
import { renderConsoles } from './consoles.js';
import { renderPlot } from './plot.js';
import { renderTrajectory } from './trajectory.js';
import { renderHangar, renderFacilities } from './hangar.js';
import { renderStaff, renderLaunchCrew } from './personnel.js';
import { renderRace } from './race-and-summaries.js';
import { renderAstronautOffice, renderMissionPlanner, mercuryDirectiveHTML, memorialHTML, sectionSummaryHTML } from './mercury-panels.js';
import { $, setHTML } from './dom.js';

let dirty = 1, shownEra = -1, shownRoom = -1, desk = '';
export const markDirty = () => {
  dirty = 1;
};
export const needsRender = () => dirty;
// Forget the era and room shown, so a new game does not announce them.
export const resetScreen = () => {
  shownEra = shownRoom = -1;
};

// Log lines go to the teleprinter log. While a countdown is open, the calls also go to the command loop under the
// plotting board, newest first: a line's time and call sign ("T+12s | [PROP] ...") get their own columns, and the
// radar's running plots ("T+12s | RADAR ~2.5 km"), payroll and the press stay on the teleprinter.
const LOOP_LINES = 12;
// Untimed lines reach the loop only from a voice on it: the stations, the pad crew and the range (not payroll or the press).
const LOOP_VOICES = new Set([...Object.values(STATIONS).map(station => station.callSign), 'PAD', 'RANGE']);
logSink.fn = (text, style) => {
  const line = document.createElement('div');
  line.className = style;
  line.textContent = text;
  $('#lg').append(line);
  $('#lg').scrollTop = 1e9;
  const loop = $('#padlog'), call = text.match(/^(?:T\+(\d+)s \| )?(?:\[([A-Z]+)\] )?(.*)$/);
  if (!loop || !launchView.count) return;
  if (call[1] ? !call[2] && /^(RADAR|ACCEL|DOPPLER|INERTIAL|RANGE-RATE|PROP)\b/.test(call[3]) : !LOOP_VOICES.has(call[2])) return;
  const entry = document.createElement('div');
  entry.className = `loopl ${style || ''}`;
  entry.innerHTML = '<span class="d"></span><b></b><span></span>';
  entry.children[0].textContent = call[1] ? `T+${call[1]}s` : '';
  entry.children[1].textContent = call[2] || (call[1] ? 'RANGE' : '');
  entry.children[2].textContent = call[3];
  loop.prepend(entry);
  while (loop.children.length > LOOP_LINES) loop.lastChild.remove();
};

// THE DESKS: '' is the control room alone; any other desk opens its drawer over the room. Picking the open desk again closes it.
const DESK_TITLES = { rd: 'RESEARCH & DESIGN', hangar: 'DRAWING OFFICE, FACTORY & HANGAR', base: 'LAUNCH SITE & BASE', crew: 'PERSONNEL & LAUNCH CREW', astro: 'ASTRONAUT OFFICE' };
export function showDesk(name) {
  desk = name == desk ? '' : name;
  applyDesk();
}
// Open a desk without toggling (the flight result's incident button).
export function openDesk(name) {
  desk = name;
  applyDesk();
}
// The R&D button counts incidents waiting for you: records analysis, a call on the findings, or a fix.
function applyDesk() {
  if (desk == 'astro' && !S.nasa) desk = '';
  $('#drawer').hidden = !desk;
  $('#drawer-t').textContent = DESK_TITLES[desk] || '';
  document.querySelectorAll('[data-deskpane]').forEach(pane => pane.hidden = pane.dataset.deskpane != desk);
  document.querySelectorAll('.rail [data-desk]').forEach(button => button.classList.toggle('on', button.dataset.desk == desk));
  const waiting = S.inc.filter(incident => incident.st == 'open' || incident.st == 'found' || incident.st == 'diag').length, badge = $('#badge-rd');
  badge.hidden = !waiting;
  badge.textContent = waiting;
  renderMiniClock();
}

// THE SMALL MISSION CLOCK under the consoles: a copy of the pad's clock, phase, milestones and readouts, shown while a
// desk drawer covers the pad. The pad's phase line (#padph) can start with the count or mission time ("T-00:10 COUNTING");
// in flight the clock strip (#mclock) holds the time, so the phase is shown without it.
function renderMiniClock() {
  const box = $('#miniclock');
  box.hidden = !launchView.count || !desk;
  if (box.hidden) return;
  const phase = $('#padph').textContent.match(/^(T[+-][\d:]+)?\s*(.*)$/), flying = !$('#fl').hidden;
  $('#miniclockt').textContent = flying ? $('#mclock').textContent : phase[1] || '';
  $('#miniclockph').textContent = phase[2];
  setHTML($('#miniphases'), flying ? $('#phases').innerHTML : '');
  setHTML($('#minireads'), flying ? $('#readouts').innerHTML : '');
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
  renderHeaderResearch();
}
// THE HEADER RESEARCH BAR: the research package closest to finishing, and how many others are in work.
function renderHeaderResearch() {
  const research = S.jobs.filter(job => job.k == 'pk').sort((a, b) => a.t - b.t), nearest = research[0];
  const others = research.length > 1 ? ` +${research.length - 1} more` : '';
  // The name is cut short if it must be; the time left and the count of others always show.
  $('#hres').textContent = nearest ? itemAsSeen(nearest.id).name : 'None in work';
  $('#hres').title = $('#hres').textContent;
  $('#hrest').textContent = nearest ? ` · ${nearest.t}s${others}` : '';
  $('#hresbar').style.width = nearest ? Math.round((1 - nearest.t / Math.max(1, nearest.tot)) * 100) + '%' : '0';
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
  const ourSatellite = S.fs.f_orbit == 'us' || S.fs.f_orbit == 'second'; // f_orbit is 'sov' when only the Soviets have one
  if (!S.nasa && ourSatellite && !nasaReady()) html += `<div class="c nasa"><div class="t">THE NATIONAL AERONAUTICS AND SPACE ACT</div><div class="m">Your satellite has Washington talking about a civilian space agency, but Congress moves at its own pace. The Act is expected around <b>${formatDate(SPACE_ACT_DAY)}</b>; the calendar runs fast until then. Keep flying: science payloads still pay.</div></div>`;
  if (nasaReady()) html += `<div class="c nasa"><div class="t">THE NATIONAL AERONAUTICS AND SPACE ACT</div><div class="m">${ourSatellite ? 'With a satellite in orbit,' : 'Whatever your progress,'} Washington wants a civilian space agency, with your programme at its core. Establishing it closes Phase One and sets up crewed flight.</div><button data-a="nasa">ESTABLISH NASA</button></div>`;
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
  $('#desk-astro').hidden = !S.nasa;
  renderAstronautOffice();
  renderMissionPlanner();
  showOverlays();
  renderControlRoom();
  renderConsoles();
  renderPlot();
  renderTrajectory();
  renderRace();
  renderLaunchForm();
  renderCampaign();
  if (launchView.count && launchView.count.phase != 'flight') renderPad();
  renderResearchDesk();
  renderHangar();
  renderFacilities();
  renderStaff();
  renderLaunchCrew();
  applyDesk();
}
// Between redraws, only the header, the countdown figures and bars on jobs, and the factory queue change.
export function refreshTimers() {
  renderHeader();
  document.querySelectorAll('[data-j]').forEach(node => {
    const job = findJob(candidate => candidate.k + candidate.id == node.dataset.j);
    if (job) node.textContent = job.t + 's';
  });
  // Research cards' progress bars (data-jb names the job).
  document.querySelectorAll('[data-jb]').forEach(node => {
    const job = findJob(candidate => candidate.k + candidate.id == node.dataset.jb);
    if (job) node.style.width = Math.round((1 - job.t / Math.max(1, job.tot)) * 100) + '%';
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
  // The small clock follows the pad's clock strip as it changes, many times a second in flight.
  const followPad = new MutationObserver(renderMiniClock);
  for (const node of [$('#padph'), $('#mclock'), $('#phases'), $('#readouts')]) followPad.observe(node, { childList: true, characterData: true, subtree: true, attributes: true });
  logSink.fn('[SYSTEM] Radar tracking and a radio beacon are online. Expect approximate data only.', '');
  logSink.fn('[SYSTEM] Appropriations arrive every 30 seconds.', '');
  render();
}
