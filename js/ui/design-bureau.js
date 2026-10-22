// THE DESIGN BUREAU tab: the programme bar and card, the engineering file for each system (knowledge, failure modes, research,
// milestones), and the panel of unexplained failures.
import { formatMoney } from '../core/util.js';
import { MILESTONES, AREAS } from '../data/research.js';
import { FAILURE_MODES, SYMPTOMS, findFix } from '../data/failures.js';
import { PROGRAMMES, MATURE, FLIGHTS_TO_MATURE, DESIGN_STATS, traitByKey } from '../data/programmes.js';
import { S, formatDate, isResearched, isConfirmed, freeTeams, findJob } from '../core/state.js';
import { trackingTiers, designation } from '../rules/design.js';
import { isVehicleArea, itemsInArea, itemAsSeen, breakthroughNeedsHere, areaCounts, hasFirstMilestone, firstMilestoneOptions, milestoneLock, describeResearch, researchLock, isProposed, costAfterEarmark } from '../rules/research.js';
import { breakthroughNeeds } from '../data/research.js';
import { knowledge, levelName, SYSTEMS, REVIEW_COST, reviewTime, reviewOdds } from '../rules/knowledge.js';
import { maturity, candidates, startLock, believedWindow, successfulFlights } from '../rules/programs.js';
import { groundTestLock } from '../rules/launch-site.js';
import { INVESTIGATION_COST, investigationTime } from '../rules/jobs.js';
import { $, setHTML } from './dom.js';

// The job researching an item, for the programme it belongs to (vehicle areas) or the global bundle.
const researchJob = item => findJob(job => job.k == 'pk' && job.id == item.id && job.prog == (isVehicleArea(item.area) ? S.cur : null));

// ONE AREA'S CARD: the engineering file, finished work (with ground tests), ideas on offer, and the milestone block.
function areaCard(area) {
  const counts = areaCounts(area), open = itemsInArea(area).filter(item => !isResearched(item.id)), offered = open.filter(isProposed), later = open.length - offered.length;
  const vehicle = isVehicleArea(area);
  const breakthroughNote = vehicle ? (PROGRAMMES[S.cur].hasMilestones && firstMilestoneOptions(area).length ? ` (${breakthroughNeedsHere(area)[0]} for a breakthrough)` : '') : ` (${breakthroughNeeds(area)[0]} for a breakthrough, ${breakthroughNeeds(area)[1]} for the second milestone)`;
  let html = `<div class="c"><div class="t">${vehicle ? PROGRAMMES[S.cur].name.toUpperCase() + ': ' : ''}${AREAS[area].toUpperCase()}${vehicle ? '' : ' <span class="d">(all rockets)</span>'}</div>${engineeringFile(area)}<div class="t" style="margin-top:8px;font-size:.8em">RESEARCH</div><div class="m">Complete ${counts.done}/${counts.total} | confirmed ${counts.confirmed}${breakthroughNote}</div>`;
  itemsInArea(area).filter(item => isResearched(item.id)).forEach(item => {
    html += `<div class="m">✓ ${item.name}: ${describeResearch(item)}</div>`;
    html += groundTestHTML(area, item);
  });
  offered.forEach(item => html += commissionHTML(item, 1));
  if (later) html += `<div class="m">${later} more idea${later > 1 ? 's' : ''} will be proposed as your engineers prove what they have.</div>`;
  if (vehicle && (!PROGRAMMES[S.cur].hasMilestones || !firstMilestoneOptions(area).length)) return html + '</div>';
  return html + milestoneBlock(area, counts) + '</div>';
}
// Unconfirmed propulsion work can be fired on the test stand; spacecraft work qualified on the ground.
function groundTestHTML(area, item) {
  const qualification = area == 'c' || area == 'e';
  if (!((area == 'p' && S.fac.stand) || qualification) || isConfirmed(item.id)) return '';
  const job = findJob(candidate => candidate.k == 'gt' && candidate.id == item.id), lock = groundTestLock(item.id);
  return job ? `<div class="m wn">${qualification ? 'Qualification tests' : 'Static firing'}: <span data-j="gt${item.id}">${job.t}s</span></div>`
    : `<button data-a="gt" data-id="${item.id}"${lock ? ' disabled' : ''}>${qualification ? 'QUALIFICATION TEST ($4,000, 110s)' : 'GROUND TEST ($2,000, 30s)'}</button>`;
}
// The first milestone (a choice of approaches once the breakthrough lands) and, outside the rocket areas, the second.
function milestoneBlock(area, counts) {
  const firstOptions = firstMilestoneOptions(area), second = isVehicleArea(area) ? null : MILESTONES.find(milestone => milestone.area == area && milestone.tier == 2);
  const chosen = firstOptions.find(milestone => isResearched(milestone.id) || findJob(job => job.k == 'pk' && job.id == milestone.id));
  let inner;
  if (chosen) inner = `<div class="t">FIRST MILESTONE</div>${milestoneRow(chosen)}${second ? `<div class="t" style="margin-top:8px">SECOND MILESTONE</div>${milestoneRow(second)}` : ''}`;
  else if (S.bt[area]) inner = `<div class="t">BREAKTHROUGH: CHOOSE ONE APPROACH</div>${S.ear && S.ear[area] ? `<div class="m ok">Congress has earmarked ${formatMoney(S.ear[area])} toward this programme.</div>` : ''}${firstOptions.map(milestoneRow).join('<div class="or">or</div>')}`;
  else inner = `<div class="m">A breakthrough after ${breakthroughNeedsHere(area)[0]} confirmed packages (${counts.confirmed}/${breakthroughNeedsHere(area)[0]}) will open a choice of approaches.</div>`;
  return `<div class="msb">` + inner + '</div>';
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
    + (job ? `<div class="wn">In progress: <span data-j="pk${item.id}">${job.t}s</span></div>`
      : `<button data-a="com" data-id="${item.id}"${lock ? ' disabled' : ''}>COMMISSION (${costAfterEarmark(item) < item.cost ? `${formatMoney(costAfterEarmark(item))} after earmark` : formatMoney(item.cost)}, ${item.time}s)</button>${lock ? `<div class="m">${lock}</div>` : ''}`)
    + '</div>';
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
    const proposed = PROGRAMMES[candidate], lock = startLock(candidate);
    return `<div class="c"><div class="r"><b>${proposed.name}</b><span class="d">${proposed.year}</span></div><div class="m">${proposed.why}</div><button data-a="pstart" data-id="${candidate}"${lock ? ' disabled' : ''}>START THE ${proposed.name.toUpperCase()} PROGRAMME (${formatMoney(proposed.cost)}, ${proposed.designTime}s of design)</button>${lock ? `<div class="m">${lock}</div>` : ''}</div>`;
  }).join('');
  return html + '</div>';
}

const INSTRUMENT_NAMES = ['Radio beacon only', 'FM telemetry (few channels)', 'Instrumented airframe', 'Full telemetry + inertial platform'];
const TRACKING_NAMES = ['Optical & radar tracking', 'Tracking radar network', 'Radar network + downrange ship'];
export function renderDesignBureau() {
  const tiers = trackingTiers(), bundle = S.progs[S.cur];
  // Rocket areas once the programme is ready; recovery always; the spacecraft areas after NASA.
  const areas = (bundle && bundle.ready ? ['p', 's', 'i', 'a'] : []).concat(['r'], S.nasa ? ['c', 'e'] : []);
  setHTML($('#db'), programmeBar() + programmeCard()
    + `<div class="r"><span class="d">Current design</span><b>${PROGRAMMES[S.cur].name} ${designation(S.bp.pk)}, Rev ${S.bp.rev}</b></div><div class="r"><span class="d">Airframe instruments</span><b>${INSTRUMENT_NAMES[tiers.v]}</b></div><div class="r"><span class="d">Ground tracking</span><b>${TRACKING_NAMES[tiers.g]}</b></div><div class="r"><span class="d">Teams free</span><b>${freeTeams()} of ${S.teams}</b></div><div class="r"><span class="d">Successful flights</span><b>${S.ok}</b></div>`
    + `<div class="m">Packages improve the rocket in small, uncertain steps. Finished work goes into airframes when you publish a blueprint revision (Hangar & Base), and its real effect is confirmed when one flies${S.fac.stand ? ' or a propulsion package is ground tested' : ''}. Engineers propose new ideas as earlier ones are proven. On the bigger rockets, enough confirmed work in an area opens a breakthrough and a choice of major programmes.</div>`
    + `<div class="m">Each system below is an entry in the <b>engineering file</b>: what your team knows about it, the failure modes it has met and how they were cured, and the research still open. Knowledge carries from flight to flight and makes every later judgement better.</div>`
    + `<div class="areas">${areas.map(areaCard).join('')}</div>`);
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
export function renderIncidents() {
  const unexplained = S.inc.filter(incident => incident.st == 'open' || incident.st == 'inv');
  $('#pi').hidden = !unexplained.length;
  setHTML($('#ic'), unexplained.slice().reverse().map(incidentHTML).join(''));
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
