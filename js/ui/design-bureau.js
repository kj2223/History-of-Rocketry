// THE R&D DESK (a drawer over the control room). Four views:
//   research          one column per area: breakthrough progress, the milestone, and a compact card per package. Picking a card
//                     shows it in the bar along the bottom, with its COMMISSION (or ground test) button.
//   programme         the programme bar and the focused rocket's card: maturity, performance window, flaws, next programmes.
//   engineering file  what the team knows about each system, its failure modes and design reviews.
//   incidents         failures not yet explained.
import { formatMoney } from '../core/util.js';
import { MILESTONES, AREAS, BY_ID } from '../data/research.js';
import { FAILURE_MODES, SYMPTOMS, findFix } from '../data/failures.js';
import { PROGRAMMES, MATURE, FLIGHTS_TO_MATURE, DESIGN_STATS, traitByKey } from '../data/programmes.js';
import { S, formatDate, isResearched, isConfirmed, freeTeams, findJob } from '../core/state.js';
import { trackingTiers, designation } from '../rules/design.js';
import { isVehicleArea, itemsInArea, itemAsSeen, breakthroughNeedsHere, areaCounts, hasFirstMilestone, firstMilestoneOptions, milestoneLock, describeResearch, researchLock, isProposed, costAfterEarmark, crashCost, crashLock } from '../rules/research.js';
import { knowledge, levelName, SYSTEMS, REVIEW_COST, reviewTime, reviewOdds } from '../rules/knowledge.js';
import { maturity, candidates, startLock, believedWindow, successfulFlights, isShortcut, designTimeFor } from '../rules/programs.js';
import { groundTestLock } from '../rules/launch-site.js';
import { INVESTIGATION_COST, investigationTime } from '../rules/jobs.js';
import { $, setHTML } from './dom.js';

// The job researching an item, for the programme it belongs to (vehicle areas) or the global bundle.
const researchJob = item => findJob(job => job.k == 'pk' && job.id == item.id && job.prog == (isVehicleArea(item.area) ? S.cur : null));

// ONE AREA'S COLUMN: breakthrough progress, the milestone slot, then a card per package (finished, in work, or on offer).
function researchColumn(area) {
  const counts = areaCounts(area), vehicle = isVehicleArea(area), needs = breakthroughNeedsHere(area)[0];
  const hasMilestones = !vehicle || (PROGRAMMES[S.cur].hasMilestones && firstMilestoneOptions(area).length);
  const open = itemsInArea(area).filter(item => !isResearched(item.id)), offered = open.filter(isProposed), later = open.length - offered.length;
  let html = `<div class="rcol"><div class="rcol-hd">${AREAS[area].toUpperCase()}${vehicle ? '' : ' <span class="d">all rockets</span>'}</div>`;
  if (hasMilestones) html += `<div class="r m"><span>Breakthrough</span><span>${Math.min(counts.confirmed, needs)} of ${needs} confirmed</span></div><div class="bar"><i style="width:${Math.min(100, counts.confirmed / needs * 100)}%"></i></div>` + milestoneSlot(area, needs, counts);
  else html += `<div class="m">${counts.done} of ${counts.total} done · ${counts.confirmed} confirmed</div>`;
  itemsInArea(area).filter(item => isResearched(item.id)).forEach(item => html += packageCard(item));
  offered.forEach(item => html += packageCard(item));
  if (later) html += `<div class="m">${later} more idea${later > 1 ? 's' : ''} will be proposed as the engineers prove what they have.</div>`;
  return html + '</div>';
}
// The milestone slot at the top of a column: locked, a choice to make (one card per approach), or the chosen programme.
function milestoneSlot(area, needs, counts) {
  const options = firstMilestoneOptions(area), second = isVehicleArea(area) ? null : MILESTONES.find(milestone => milestone.area == area && milestone.tier == 2);
  const chosen = options.find(milestone => isResearched(milestone.id) || findJob(job => job.k == 'pk' && job.id == milestone.id));
  if (chosen) return `<div class="ms-slot">${packageCard(chosen, '★')}${second && isResearched(chosen.id) ? packageCard(second, '★★') : ''}</div>`;
  if (S.bt[area]) return `<div class="ms-slot ready"><div class="t">BREAKTHROUGH: CHOOSE ONE</div>${options.map(milestone => packageCard(milestone, '★')).join('')}</div>`;
  return `<div class="ms-slot"><span class="d">Milestone opens after ${needs - Math.min(needs, counts.confirmed)} more confirmed</span></div>`;
}
// A compact card. Picking it shows it in the detail bar. mark: shown before the name (milestones).
function packageCard(entry, mark = '') {
  const item = itemAsSeen(entry.id), job = researchJob(item), done = isResearched(item.id), confirmed = done && isConfirmed(item.id);
  const look = done ? (confirmed ? 'done' : 'flown') : job ? 'work' : item.dud ? 'exp' : 'open';
  const tag = done ? (confirmed ? '■' : '□ unproven') : job ? '' : item.dud ? '◆' : '';
  const meta = done ? (confirmed ? 'confirmed' : 'finished, not yet confirmed') : job ? `in work: <span data-j="pk${item.id}">${job.t}s</span> left`
    : `${formatMoney(costAfterEarmark(item))} · ${item.time}s${item.dud ? ' · experimental' : ''}`;
  const progress = job ? `<div class="bar"><i data-jb="pk${item.id}" style="width:${Math.round((1 - job.t / Math.max(1, job.tot)) * 100)}%"></i></div>` : '';
  return `<button data-a="rpick" data-id="${item.id}" class="rcard ${look}${researchDesk.pick == item.id ? ' on' : ''}"><span class="r"><b>${mark ? mark + ' ' : ''}${item.name}</b><span>${tag}</span></span><span class="m">${meta}</span>${progress}</button>`;
}
// A finished package not yet confirmed can be proven on the ground: a static firing (propulsion, with a test stand) or
// qualification tests (areas c and e).
function groundTestHTML(area, item) {
  const qualification = area == 'c' || area == 'e';
  if (!((area == 'p' && S.fac.stand) || qualification) || isConfirmed(item.id)) return '';
  const job = findJob(candidate => candidate.k == 'gt' && candidate.id == item.id), lock = groundTestLock(item.id);
  return job ? `<div class="m wn">${qualification ? 'Qualification tests' : 'Static firing'}: <span data-j="gt${item.id}">${job.t}s</span></div>`
    : `<button data-a="gt" data-id="${item.id}"${lock ? ' disabled' : ''}>${qualification ? 'QUALIFICATION TEST ($4,000, 110s)' : 'GROUND TEST ($2,000, 30s)'}</button>`;
}
// THE DETAIL BAR: the picked package or milestone in full, with what can be done with it.
function detailBar() {
  const id = researchDesk.pick;
  if (!id || !BY_ID[id]) return '<div class="rdetail m">Pick a card to see what the engineers expect from it and to commission it.</div>';
  const item = itemAsSeen(id), milestone = item.tier != null;
  let html = `<div class="rdetail"><div class="grow"><b>${item.name}</b>${item.dud ? ' <span class="exp-t">◆ experimental</span>' : ''}${milestone && item.why ? `<div class="m"><i>${item.why}</i></div>` : ''}`;
  if (isResearched(id)) return html + `<div class="m">${describeResearch(item)}</div></div><div>${groundTestHTML(item.area, item)}</div></div>`;
  return html + `</div><div class="rdetail-act">${commissionHTML(item)}</div></div>`;
}
function milestoneRow(milestone) {
  if (isResearched(milestone.id)) return `<div class="ok">★ ${milestone.name}</div><div class="m">${describeResearch(milestone)}</div>`;
  const lock = milestoneLock(milestone);
  return `<div class="ms${lock && lock != 'Complete.' ? ' locked' : ''}"><b>${milestone.name}</b><div class="m"><i>${milestone.why}</i></div>${commissionHTML(milestone)}</div>`;
}
// A package or milestone with its estimate and a COMMISSION button (or its progress). showName: print the item's name first.
function commissionHTML(entry, showName) {
  const item = itemAsSeen(entry.id), job = researchJob(item), lock = researchLock(item.id);
  return `<div style="margin:6px 0">${showName ? `<div>${item.name}${item.dud ? ' <span class="d">(experimental)</span>' : ''}</div>` : ''}<div class="m">${describeResearch(item)}${item.contract ? ` Contract pays ${formatMoney(item.contract)} on completion.` : ''}</div>`
    + (job ? `<div class="wn">In progress: <span data-j="pk${item.id}">${job.t}s</span>${job.cr ? ' (crash schedule)' : ''}</div>${crashHTML(item, job)}`
      : `<button data-a="com" data-id="${item.id}"${lock ? ' disabled' : ''}>COMMISSION (${costAfterEarmark(item) < item.cost ? `${formatMoney(costAfterEarmark(item))} after earmark` : formatMoney(item.cost)}, ${item.time}s)</button>${lock ? `<div class="m">${lock}</div>` : ''}`)
    + '</div>';
}
// NASA era: a running job can be put on a crash schedule once, halving the time left.
function crashHTML(item, job) {
  if (!S.nasa || job.cr) return '';
  const lock = crashLock(item.id);
  return `<button data-a="crash" data-id="${item.id}"${lock ? ' disabled' : ''}>CRASH PROGRAMME (${formatMoney(crashCost(item))}, halves the time left)</button>${lock ? `<div class="m">${lock}</div>` : ''}`;
}
// Joint programmes (milestones drawing on two areas). Not shown at present: it returns nothing before building its card.
const SHOW_JOINT_PROGRAMMES = false;
function jointProgrammesCard() {
  if (!SHOW_JOINT_PROGRAMMES) return '';
  const joint = MILESTONES.filter(milestone => milestone.tier == 'x');
  const open = joint.filter(milestone => isResearched(milestone.id) || !milestoneLock(milestone) || findJob(job => job.id == milestone.id));
  const near = joint.filter(milestone => !open.includes(milestone) && [...milestone.jointAreas].some(hasFirstMilestone));
  if (!open.length && !near.length) return '';
  return `<div class="c"><div class="t">JOINT PROGRAMMES</div><div class="m">${near.length ? `${near.length} more programme${near.length > 1 ? 's' : ''} will open as other areas reach their first milestone.` : ''}</div>`
    + open.map(milestone => `<div class="msb">${milestoneRow(milestone)}<div class="m">Draws on ${[...milestone.jointAreas].map(area => AREAS[area]).join(' + ')}.</div></div>`).join('') + '</div>';
}

// ROCKET PROGRAMMES: a bar to switch the programme in focus (also on Hangar & Base), and the focused programme's card.
export function programmeBar() {
  return `<div class="pbar">${Object.keys(S.progs).map(kind => `<button data-a="prog" data-id="${kind}" class="${kind == S.cur ? 'on' : ''}">${PROGRAMMES[kind].name}<span class="d"> ${S.progs[kind].ready ? Math.round(maturity(kind)) : 'design'}</span></button>`).join('')}</div>`;
}
const formatStat = (stat, value) => stat == 'thr' ? `${Math.round(value / 100) / 10} kN` : stat == 'dry' || stat == 'f' ? `${Math.round(value)} kg` : stat == 'g' ? `${value.toFixed(1)} g` : stat == 'r' ? `${value >= 0 ? '+' : ''}${Math.round(value * 100)} pts` : `${Math.round(value * 100)}%`;
function programmeCard() {
  const kind = S.cur, bundle = S.progs[kind];
  if (!bundle) return '';
  const programme = PROGRAMMES[kind], level = maturity(kind), design = findJob(job => job.k == 'dev' && job.prog == kind);
  let html = `<div class="c prog"><div class="r"><b>${programme.name.toUpperCase()} PROGRAMME</b><span class="d">since ${formatDate(bundle.start)}</span></div><div class="m"><i>${programme.why}</i></div>`;
  if (!bundle.ready) return html + `<div class="wn">Detailed design under way: <span data-j="dev${kind}">${design ? design.t : 0}s</span>.</div></div>`;
  const flown = successfulFlights(kind);
  html += `<div class="r"><span class="d">Maturity (team knowledge of the rocket)</span><b class="${level >= MATURE ? 'ok' : ''}">${Math.round(level)} / ${MATURE}</b></div><div class="bar"><i style="width:${Math.min(100, level / MATURE * 100)}%"></i></div>`
    + `<div class="r"><span class="d">Successful flights</span><b class="${flown >= FLIGHTS_TO_MATURE ? 'ok' : ''}">${Math.min(flown, FLIGHTS_TO_MATURE)} / ${FLIGHTS_TO_MATURE}</b></div>`;
  // The performance window: a range narrower than 6% (1.2 points for reliability) shows as one figure.
  html += `<div class="t" style="margin-top:8px">PERFORMANCE WINDOW</div><div class="m">What the team believes the bare rocket can do. Each range narrows as the system behind it is understood.</div>` + DESIGN_STATS.map(({ key, label }) => {
    const range = believedWindow(kind, key), narrow = (range.hi - range.lo) / Math.max(1e-9, Math.abs(range.mid)) < .06 || key == 'r' && range.hi - range.lo < .012;
    return `<div class="r"><span class="d">${label}</span><b>${narrow ? formatStat(key, range.mid) : `${formatStat(key, range.lo)} – ${formatStat(key, range.hi)}`}</b></div>`;
  }).join('');
  const found = bundle.traits.filter(trait => trait.found);
  html += `<div class="t" style="margin-top:8px">KNOWN FLAWS</div>` + (found.length ? found.map(trait => {
    const flaw = traitByKey(trait.k), cured = flaw.mode && S.fix[flaw.mode];
    return `<div class="m ${cured ? 'ok' : 'wn'}">${cured ? '✓ ' : ''}${flaw.name}: ${flaw.why}${flaw.mode ? (cured ? ' Cured by the fix in the design.' : ' A fix for ' + FAILURE_MODES[flaw.mode].name.toLowerCase() + ' will cure it.') : ''}</div>`;
  }).join('') : '<div class="m">None found yet.</div>')
    + (found.length < bundle.traits.length ? '<div class="m">New rockets always hide flaws. Failures, investigations and design reviews bring them out.</div>' : '<div class="m ok">The engineers believe every flaw in the design is now known.</div>');
  const next = candidates();
  if (next.length) html += `<div class="t" style="margin-top:8px">NEXT PROGRAMMES</div>` + next.map(candidate => {
    const proposed = PROGRAMMES[candidate], lock = startLock(candidate), skipped = isShortcut(candidate) && PROGRAMMES[proposed.skip.past].name;
    const warning = skipped ? `<div class="m wn">Skips the ${skipped} generation: the ${skipped} closes for good, its research is folded into this rocket, the design takes longer, it hides more flaws and the team starts knowing little of it.</div>` : '';
    const closes = (proposed.closes || []).filter(other => !S.progs[other]).map(other => PROGRAMMES[other].name);
    const fork = !skipped && closes.length ? `<div class="m">Starting it closes the ${closes.join(' and ')}.</div>` : '';
    return `<div class="c"><div class="r"><b>${proposed.name}</b><span class="d">${proposed.year}</span></div><div class="m">${proposed.why}</div>${warning}${fork}<button data-a="pstart" data-id="${candidate}"${lock ? ' disabled' : ''}>START THE ${proposed.name.toUpperCase()} PROGRAMME (${formatMoney(proposed.cost)}, ${designTimeFor(candidate)}s of design)</button>${lock ? `<div class="m">${lock}</div>` : ''}</div>`;
  }).join('');
  return html + '</div>';
}

const INSTRUMENT_NAMES = ['Radio beacon only', 'FM telemetry (few channels)', 'Instrumented airframe', 'Full telemetry + inertial platform'];
const TRACKING_NAMES = ['Optical & radar tracking', 'Tracking radar network', 'Radar network + downrange ship'];
// What the desk shows: view (research | programme | file | incidents), pick: the research card in the detail bar.
export const researchDesk = { view: 'research', pick: null };
const VIEWS = { research: 'RESEARCH', programme: 'ROCKET PROGRAMME', file: 'ENGINEERING FILE', incidents: 'UNEXPLAINED FAILURES' };
export function renderResearchDesk() {
  const tiers = trackingTiers(), bundle = S.progs[S.cur], unexplained = S.inc.filter(incident => incident.st == 'open' || incident.st == 'inv');
  // Rocket areas once the programme is ready; recovery always; the spacecraft areas after NASA.
  const areas = (bundle && bundle.ready ? ['p', 's', 'i', 'a'] : []).concat(['r'], S.nasa ? ['c', 'e'] : []);
  const view = researchDesk.view;
  let html = `<div class="rtabs">${Object.keys(VIEWS).map(key => `<button data-a="rview" data-id="${key}" class="${key == view ? 'on' : ''}">${VIEWS[key]}${key == 'incidents' && unexplained.length ? ` (${unexplained.length})` : ''}</button>`).join('')}`
    + `<span class="m">${PROGRAMMES[S.cur].name} ${designation(S.bp.pk)}, Rev ${S.bp.rev} · ${INSTRUMENT_NAMES[tiers.v]} · ${TRACKING_NAMES[tiers.g]} · <b>teams free ${freeTeams()} of ${S.teams}</b></span></div>`;
  if (view == 'research') html += programmeBar() + `<div class="rcols" style="--areas:${areas.length}">${areas.map(researchColumn).join('')}</div>` + detailBar();
  else if (view == 'programme') html += programmeBar() + programmeCard() + `<div class="m">Packages improve the rocket in small, uncertain steps. Finished work goes into airframes when you publish a blueprint revision (Hangar desk), and its real effect is confirmed when one flies${S.fac.stand ? ' or a propulsion package is ground tested' : ''}.</div>`;
  else if (view == 'file') html += `<div class="m">Each system's entry in the engineering file: what your team knows about it, the failure modes it has met and how they were cured. Knowledge carries from flight to flight.</div><div class="rcols" style="--areas:${areas.length}">${areas.map(area => `<div class="rcol"><div class="rcol-hd">${AREAS[area].toUpperCase()}</div>${engineeringFile(area)}</div>`).join('')}</div>`;
  else html += unexplained.length ? `<div class="cards">${unexplained.slice().reverse().map(incidentHTML).join('')}</div>` : '<div class="m">No unexplained failures on file.</div>';
  setHTML($('#rdesk'), html);
}

// INCIDENTS: a failure (or a design-review finding) from records analysis to diagnosis to fix.
// Unexplained ones stay in their own panel; once diagnosed they move into the engineering file of the system at fault.
function incidentHTML(incident) {
  let html = `<div class="c"><div class="t">${incident.review ? `Design review finding #${incident.id}` : `Incident #${incident.id} | ${incident.lab} | T+${incident.t}s${incident.plot ? ' | last plot ' + incident.plot : ''}`}</div>${incident.review ? '<div class="m">Found on the drawings before it ever failed in flight.</div>' : `<div class="m">Records show: ${incident.sym.length ? incident.sym.map(symptom => SYMPTOMS[symptom].text).join('; ') : 'radio carrier and radar track lost only'}</div>`}`;
  if (incident.st == 'open') {
    const lock = S.b < INVESTIGATION_COST ? 'Need funds.' : freeTeams() < 1 ? 'Teams busy.' : null;
    html += `<div>Cannot yet tell apart: ${incident.cand.map(mode => FAILURE_MODES[mode].name).join(' / ')}</div><div class="m">Evidence on file: ${incident.ev}</div><button data-a="inv" data-id="${incident.id}"${lock ? ' disabled' : ''}>RECORDS ANALYSIS (${formatMoney(INVESTIGATION_COST)}, ${investigationTime(incident)}s)</button>`;
  } else if (incident.st == 'inv') html += `<div class="wn">Investigating: <span data-j="inv${incident.id}">${(findJob(job => job.k == 'inv' && job.id == incident.id) || { t: 0 }).t}s</span></div>`;
  else if (incident.st == 'diag') {
    html += `<div>${incident.review ? 'Risk' : 'Engineers conclude'}: ${FAILURE_MODES[incident.dx].name}${incident.review ? '' : ` (${incident.conf} confidence)`}</div>`
      + FAILURE_MODES[incident.dx].fixes.map(fix => `<div class="m">${fix.name}: ${fix.riskMultiplier <= .3 ? 'strong' : 'partial'} cure</div><button data-a="fix" data-id="${incident.id}" data-f="${fix.id}"${S.b < fix.cost || freeTeams() < 1 ? ' disabled' : ''}>${fix.name.toUpperCase()} (${formatMoney(fix.cost)}, ${fix.time}s)</button>`).join('');
  } else if (incident.st == 'fixing') html += `<div class="wn">Implementing: <span data-j="fix${incident.id}">${(findJob(job => job.k == 'fix' && job.id == incident.id) || { t: 0 }).t}s</span></div>`;
  return html + '</div>';
}
// THE ENGINEERING FILE: what the team knows about one system, what that knowledge buys, its failure modes and their status.
function engineeringFile(area) {
  const value = knowledge(area), modes = [...SYSTEMS[area].modes];
  let html = `<div class="kn"><div class="r"><span class="d">Team knowledge</span><b>${levelName(value)} (${Math.round(value)})</b></div><div class="bar"><i style="width:${value}%"></i></div>`;
  const benefits = [`estimates ${Math.round(50 * value / 100)}% tighter`];
  if (modes.length) benefits.push(`poll +${Math.round(30 * value / 100)} pts on faults here`, `failures recognised on the spot ${Math.round(70 * value / 100)}%`, `investigations ${Math.round(40 * value / 100)}% faster`);
  html += `<div class="m">${benefits.join(' • ')}</div>`;
  if (modes.length) {
    const seen = modes.filter(mode => S.fix[mode] || S.known[mode] || S.inc.some(incident => incident.mode == mode && incident.st != 'open' && incident.st != 'inv'));
    for (const mode of seen) {
      const incident = S.inc.find(candidate => candidate.dx == mode && (candidate.st == 'diag' || candidate.st == 'fixing'));
      if (incident) {
        html += incidentHTML(incident);
        continue;
      }
      html += S.fix[mode] ? `<div class="m ok">✓ ${FAILURE_MODES[mode].name}: cured by ${findFix(mode, S.fix[mode]).name.toLowerCase()}.</div>` : `<div class="m">${FAILURE_MODES[mode].name}: understood, no cure fitted.</div>`;
    }
    const unseen = modes.length - seen.length;
    if (unseen) html += `<div class="m">${unseen} failure mode${unseen > 1 ? 's' : ''} in this system ${unseen > 1 ? 'have' : 'has'} never been seen.</div>`;
    const review = findJob(job => job.k == 'rev' && job.a == area);
    html += review ? `<div class="wn">Design review under way: <span data-j="rev${area}">${review.t}s</span></div>` : `<button data-a="rev" data-id="${area}"${S.b < REVIEW_COST || freeTeams() < 1 ? ' disabled' : ''}>DESIGN REVIEW (${formatMoney(REVIEW_COST)}, ${reviewTime(area)}s, ~${Math.round(reviewOdds(area) * 100)}% to find a hidden risk if one exists)</button>`;
  }
  return html + '</div>';
}
