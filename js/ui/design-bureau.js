// THE R&D DESK (a drawer over the control room). Four views:
//   research          one column per area: breakthrough progress, the milestone, and a compact card per package. Picking a card
//                     (or hovering it) shows it in the dossier along the bottom: what it is, the numbers, what the engineers
//                     expect, and its COMMISSION (or ground test) button. Work that cannot start yet can be QUEUED for the next
//                     free team (so can the records analysis of an unexplained failure); the queue shows as a row above the
//                     columns while it holds anything.
//   programme         the programme bar and the focused rocket's card: maturity, performance window, flaws, next programmes.
//   engineering file  what the team knows about each system, its failure modes and design reviews.
//   incidents         failures not yet explained.
import { formatMoney } from '../core/util.js';
import { MILESTONES, AREAS, BY_ID, EFFECTS, formatEffect, isMilestone } from '../data/research.js';
import { EXPLAINERS, CONFIDENCE_LEVELS, EXPERIMENTAL_SAYS } from '../data/research-notes.js';
import { FAILURE_MODES, SYMPTOMS, findFix } from '../data/failures.js';
import { PROGRAMMES, MATURE, FLIGHTS_TO_MATURE, DESIGN_STATS, traitByKey } from '../data/programmes.js';
import { S, formatDate, isResearched, isConfirmed, freeTeams, findJob, withProgramme } from '../core/state.js';
import { trackingTiers, designation, designSpec } from '../rules/design.js';
import { isVehicleArea, itemsInArea, itemAsSeen, researchJob, fullyResearched, breakthroughNeedsHere, areaCounts, hasFirstMilestone, firstMilestoneOptions, milestoneLock, describeResearch, researchLock, isProposed, estimateSpread, costAfterEarmark, crashCost, crashLock } from '../rules/research.js';
import { queueLock, queuePosition, queueWait, queueEntries, analysisPosition, queueAnalysisLock, fixPosition, queueFixLock, reviewPosition, queueReviewLock, RESEARCH_QUEUE_LENGTH } from '../rules/queue.js';
import { knowledge, levelName, SYSTEMS, REVIEW_COST, reviewTime, reviewOdds, filedModes } from '../rules/knowledge.js';
import { maturity, candidates, startLock, believedWindow, successfulFlights, isShortcut, designTimeFor, stagesOf, isInProgramme, researchTarget, STAGE_AREAS } from '../rules/programs.js';
import { groundTestLock } from '../rules/launch-site.js';
import { INVESTIGATION_COST, investigationTime, recordsQuality } from '../rules/jobs.js';
import { chiefOnFindings, rangeOnRecords } from '../rules/team.js';
import { $, setHTML } from './dom.js';

// On a rocket with stage designs, how many of its stages have a package ("1/2"), while some still lack it; otherwise ''.
const stageShare = id => {
  const stages = stagesOf(S.cur), all = [...stages, S.cur].filter(kind => isInProgramme(kind, id));
  const done = all.filter(kind => S.progs[kind].pk[id]).length;
  return stages.length && !isMilestone(id) && all.length > 1 && done && done < all.length ? `${done}/${all.length} stages` : '';
};

const FOLD_CONFIRMED_OVER = 3; // more confirmed packages than this in a column fold into one row
// ONE AREA'S COLUMN: breakthrough progress, the milestone slot, then a card per package (finished, in work, or on offer).
function researchColumn(area) {
  const counts = areaCounts(area), vehicle = isVehicleArea(area), needs = breakthroughNeedsHere(area)[0];
  const hasMilestones = !vehicle || (PROGRAMMES[S.cur].hasMilestones && firstMilestoneOptions(area).length);
  const open = itemsInArea(area).filter(item => !fullyResearched(item.id)), offered = open.filter(isProposed), later = open.length - offered.length;
  let html = `<div class="rcol"><div class="rcol-hd">${AREAS[area].toUpperCase()}${vehicle ? '' : ' <span class="d">all rockets</span>'}</div>`;
  if (hasMilestones) html += `<div class="r m"><span>Breakthrough</span><span>${Math.min(counts.confirmed, needs)} of ${needs} confirmed</span></div><div class="bar"><i style="width:${Math.min(100, counts.confirmed / needs * 100)}%"></i></div>` + milestoneSlot(area, needs, counts);
  else html += `<div class="m">${counts.done} of ${counts.total} done · ${counts.confirmed} confirmed</div>`;
  const finished = itemsInArea(area).filter(item => fullyResearched(item.id)), confirmed = finished.filter(item => isConfirmed(item.id));
  // A long run of confirmed work folds into one row (click to unfold) so the column still fits above the dossier.
  const folded = confirmed.length > FOLD_CONFIRMED_OVER && !researchDesk.unfolded[area];
  if (confirmed.length > FOLD_CONFIRMED_OVER) html += `<button data-a="rfold" data-id="${area}" class="rcard done chip"><span class="r"><b>${confirmed.length} confirmed</b><span>${folded ? '▸' : '▾'}</span></span></button>`;
  finished.filter(item => !(folded && confirmed.includes(item))).forEach(item => html += packageCard(item));
  offered.forEach(item => html += packageCard(item));
  if (later) html += `<div class="m">${later} more idea${later > 1 ? 's' : ''} to come.</div>`;
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
// A compact card. Picking it shows it in the dossier. mark: shown before the name (milestones). Confirmed work shrinks to a
// one-line chip so long columns still fit above the dossier; hovering it shows it in full there.
function packageCard(entry, mark = '') {
  const item = itemAsSeen(entry.id), job = researchJob(item), done = fullyResearched(item.id), confirmed = done && isConfirmed(item.id), queued = queuePosition(item.id), share = stageShare(item.id);
  const look = done ? (confirmed ? 'done' : 'flown') : job ? 'work' : queued >= 0 ? 'queued' : item.dud ? 'exp' : 'open';
  const tag = done ? (confirmed ? '■' : '□') : job ? '' : queued >= 0 ? `#${queued + 1}` : item.dud ? '◆' : '';
  const meta = done ? (confirmed ? 'confirmed' : 'finished, not yet confirmed') : job ? `in work: <span data-j="pk${item.id}">${job.t}s</span> left`
    : queued >= 0 ? `queued · ${formatMoney(costAfterEarmark(item))} · ${item.time}s`
    : `${formatMoney(costAfterEarmark(item))} · ${item.time}s${item.dud ? ' · experimental' : ''}${share ? ` · done on ${share}` : ''}`;
  const progress = job ? `<div class="bar"><i data-jb="pk${item.id}" style="width:${Math.round((1 - job.t / Math.max(1, job.tot)) * 100)}%"></i></div>` : '';
  if (confirmed) return `<button data-a="rpick" data-id="${item.id}" class="rcard done chip${researchDesk.pick == item.id ? ' on' : ''}" title="${item.name}"><span class="r"><b>${mark ? mark + ' ' : ''}${item.name}</b><span>${tag}</span></span></button>`;
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
// THE DOSSIER: the card being hovered (or else the one picked) in full, filling the space under the columns in four parts:
// what it is, the numbers, what the engineers expect, and what can be done with it. With nothing picked, how research works.
const shownInDossier = () => researchDesk.hover || researchDesk.pick;
function dossier() {
  const id = shownInDossier();
  if (!id || !BY_ID[id]) return `<div class="dossier"><div class="dossier-part wide"><div class="t">HOW RESEARCH WORKS</div>`
    + '<p>Each card is a package of work the engineers propose, and more are proposed as they prove what they have. It improves the rocket in a small, uncertain step: the figures on the card are estimates, and the real ones are fixed when the work finishes.</p>'
    + '<p>Finished work goes into airframes when you publish a blueprint revision on the Hangar desk, and its effect is measured, or confirmed, when an airframe carrying it flies. Enough confirmed packages in an area make a breakthrough, which opens a major programme.</p>'
    + '<p class="m">Hover over a card to read about it here. Click it to keep it here while you look at others.</p></div></div>';
  const item = itemAsSeen(id);
  return `<div class="dossier">${dossierAbout(item)}${dossierNumbers(item)}${dossierExpectations(item)}${dossierActions(item)}</div>`;
}
// What it is: the name, the explainer, and what it counts toward.
function dossierAbout(item) {
  const milestone = item.tier != null, counts = areaCounts(item.area), needs = breakthroughNeedsHere(item.area)[0];
  const hasMilestones = !isVehicleArea(item.area) || (PROGRAMMES[S.cur] && PROGRAMMES[S.cur].hasMilestones);
  let html = `<div class="dossier-part wide"><div class="t">${item.name.toUpperCase()} <span class="d">· ${AREAS[item.area]}${item.dud ? ' · <span class="exp-t">◆ experimental</span>' : ''}</span></div>`;
  if (milestone && item.why) html += `<p><i>${item.why}</i></p>`;
  if (EXPLAINERS[item.id]) html += `<p>${EXPLAINERS[item.id]}</p>`;
  if (milestone && item.tier == 1 && !isResearched(item.id)) html += '<p class="m">A major programme. Choosing it rules out the other approach in this area.</p>';
  else if (!milestone && hasMilestones && !isConfirmed(item.id)) html += `<p class="m">Counts toward the ${AREAS[item.area].toLowerCase()} breakthrough once confirmed (${Math.min(counts.confirmed, needs)} of ${needs} confirmed so far).</p>`;
  return html + '</div>';
}
// ON THE ROCKET: how an effect would change the figures the team believes for the rocket in focus. [formatStat key, the figure from a design spec]
const ROCKET_FIGURES = {
  t: ['thr', spec => spec.thr * spec.t], d: ['dry', spec => spec.dry + spec.d], f: ['f', spec => spec.f], g: ['g', spec => spec.g], c: ['c', spec => spec.c], h: ['h', spec => spec.h], q: ['q', spec => spec.q], rv: ['rv', spec => spec.rv],
};
// One effect's figure without its name, e.g. "+5% (±1.3)" from "thrust +5% (±1.3)".
const effectFigure = (key, value, uncertainty) => formatEffect(key, value, uncertainty).slice(EFFECTS[key][0].length + 1);
const capitalise = text => text[0].toUpperCase() + text.slice(1);
// The numbers: each effect (estimated, or measured once confirmed) with what it means for the rocket, then cost and time.
function dossierNumbers(item) {
  const done = S.pk[item.id], measured = done && done.c, job = researchJob(item), spread = estimateSpread(item);
  const effects = measured ? done.m : item.effects, now = designSpec(Object.keys(S.pk), true);
  let html = `<div class="dossier-part"><div class="t">THE NUMBERS <span class="d">· ${measured ? 'measured' : 'estimate'}${S.cur && !done ? ` for the ${PROGRAMMES[S.cur].name}` : ''}</span></div>`;
  for (const [key, value] of Object.entries(effects)) {
    html += `<div class="r"><span>${capitalise(EFFECTS[key][0])}</span><b>${effectFigure(key, value, measured ? null : Math.abs(value) * spread)}</b></div>`;
    const figure = ROCKET_FIGURES[key];
    if (figure && !done && S.cur) {
      const after = { ...now, [key]: now[key] + value };
      html += `<div class="m">&nbsp; now ${formatStat(figure[0], figure[1](now))} → about ${formatStat(figure[0], figure[1](after))}</div>`;
    }
  }
  html += '<div class="gap"></div>';
  if (done) return html + `<div class="r"><span>Status</span><b class="${measured ? 'ok' : ''}">${measured ? 'Confirmed' : 'Finished, not yet confirmed'}</b></div></div>`;
  const cost = costAfterEarmark(item);
  html += `<div class="r"><span>Cost</span><b>${formatMoney(cost)}</b></div>${cost < item.cost ? `<div class="r d"><span>&nbsp; before the earmark</span><span>${formatMoney(item.cost)}</span></div>` : ''}`
    + `<div class="r"><span>Time</span><b>${job ? `<span data-j="pk${item.id}">${job.t}s</span> left` : `${item.time}s`} · one team</b></div>`
    + (item.dud ? `<div class="r"><span>Chance of a dead end</span><b class="exp-t">${Math.round(item.dud * 100)}%</b></div>` : '')
    + (item.contract ? `<div class="r"><span>Contract pays</span><b>${formatMoney(item.contract)}</b></div>` : '');
  if (!job) html += `<div class="r"><span>Treasury after</span><b class="${S.b < cost ? 'bad' : ''}">${formatMoney(S.b - cost)}</b></div>`;
  return html + '</div>';
}
// What the engineers expect: how sure they are, in their words, and what the estimate rests on.
function dossierExpectations(item) {
  const done = S.pk[item.id], tiers = trackingTiers();
  let html = '<div class="dossier-part"><div class="t">WHAT THE ENGINEERS EXPECT</div>';
  if (done && done.c) return html + `<p>The results are in. Measured: ${describeResearch(item).replace(' (measured)', '')}.</p><p class="m">Estimated beforehand: ${Object.entries(item.effects).map(([key, value]) => formatEffect(key, value)).join(', ')}.</p></div>`;
  if (done) return html + '<p>The work is finished and its real figures are fixed, but nobody has measured them yet.</p><p class="m">They are confirmed when an airframe carrying this work flies (publish a blueprint revision on the Hangar desk)'
    + `${groundTestHTML(item.area, item) ? ', or sooner with a ground test' : ''}.</p></div>`;
  const spread = estimateSpread(item), level = CONFIDENCE_LEVELS.find(candidate => spread < candidate.under);
  html += `<div class="r"><span>Confidence</span><b>${level.name}, ±${Math.round(spread * 100)}%</b></div>`
    + `<div class="quote">"${item.dud ? EXPERIMENTAL_SAYS : level.says}"</div>`
    + `<p class="m">Working from: ${AREAS[item.area].toLowerCase()} knowledge ${levelName(knowledge(item.area)).toLowerCase()}, ${INSTRUMENT_NAMES[tiers.v].toLowerCase()}, ${TRACKING_NAMES[tiers.g].toLowerCase()}.</p>`;
  return html + `<p class="m">${item.tier != null ? 'Major programmes are planned in detail, so their estimates are tighter. ' : item.dud ? 'Experimental work is the hardest to predict. ' : ''}Better instruments, tracking and knowledge of the area narrow every estimate.</p></div>`;
}
// What can be done: commission it (or speed it up), or ground test finished work.
function dossierActions(item) {
  const job = researchJob(item);
  let html = '<div class="dossier-part act"><div class="t">' + (isConfirmed(item.id) ? 'CONFIRMED' : fullyResearched(item.id) ? 'GROUND TEST' : job ? 'IN WORK' : 'COMMISSION') + '</div>';
  if (fullyResearched(item.id)) return html + (groundTestHTML(item.area, item) || `<p class="m">${isConfirmed(item.id) ? 'Nothing more to do: the work is confirmed.' : 'No ground test for this area. Fly it to confirm it.'}</p>`) + '</div>';
  if (job) html += `<div class="bar"><i data-jb="pk${item.id}" style="width:${Math.round((1 - job.t / Math.max(1, job.tot)) * 100)}%"></i></div><p class="wn">In progress: <span data-j="pk${item.id}">${job.t}s</span> left${job.cr ? ' (crash schedule)' : ''}</p>${crashHTML(item, job)}`;
  else html += commissionButton(item) + queueHTML(item);
  if (isVehicleArea(item.area)) html += `<p class="m">${stagesOf(S.cur).length && researchTarget(item.id) != S.cur && !job ? `The development lead would put this on the ${PROGRAMMES[researchTarget(item.id)].name}, the stage furthest behind. ` : ''}Finished work goes into airframes when you publish the next blueprint revision (Hangar desk).</p>`;
  return html + '</div>';
}
function milestoneRow(milestone) {
  if (isResearched(milestone.id)) return `<div class="ok">★ ${milestone.name}</div><div class="m">${describeResearch(milestone)}</div>`;
  const lock = milestoneLock(milestone);
  return `<div class="ms${lock && lock != 'Complete.' ? ' locked' : ''}"><b>${milestone.name}</b><div class="m"><i>${milestone.why}</i></div>${commissionHTML(milestone)}</div>`;
}
// A package or milestone with its estimate and a COMMISSION button (or its progress). showName: print the item's name first.
function commissionHTML(entry, showName) {
  const item = itemAsSeen(entry.id), job = researchJob(item);
  return `<div style="margin:6px 0">${showName ? `<div>${item.name}${item.dud ? ' <span class="d">(experimental)</span>' : ''}</div>` : ''}<div class="m">${describeResearch(item)}${item.contract ? ` Contract pays ${formatMoney(item.contract)} on completion.` : ''}</div>`
    + (job ? `<div class="wn">In progress: <span data-j="pk${item.id}">${job.t}s</span>${job.cr ? ' (crash schedule)' : ''}</div>${crashHTML(item, job)}`
      : commissionButton(item))
    + '</div>';
}
// The COMMISSION button, with why it is locked if it is.
function commissionButton(item) {
  const lock = researchLock(item.id);
  return `<button data-a="com" data-id="${item.id}"${lock ? ' disabled' : ''}>COMMISSION (${costAfterEarmark(item) < item.cost ? `${formatMoney(costAfterEarmark(item))} after earmark` : formatMoney(item.cost)}, ${item.time}s)</button>${lock ? `<div class="m">${lock}</div>` : ''}`;
}
// Work not yet running: its place in the queue (and a way out), or a QUEUE button when it cannot be commissioned right now.
function queueHTML(item) {
  const position = queuePosition(item.id);
  if (position >= 0) return `<p class="wn">Queued #${position + 1}: ${position ? `starts after ${position} more` : queueWait() || 'starting'}</p>${position ? `<button data-a="qup" data-id="${position}">MOVE UP THE QUEUE</button>` : ''}<button data-a="unq" data-id="${position}">REMOVE FROM QUEUE</button>`;
  const commissionLock = researchLock(item.id), lock = queueLock(item.id);
  if (!commissionLock || lock == commissionLock) return '';
  return `<button data-a="rq" data-id="${item.id}"${lock ? ' disabled' : ''}>QUEUE FOR THE NEXT FREE TEAM</button>${lock ? `<div class="m">${lock}</div>` : ''}`;
}
// THE QUEUE ROW: the queued work in order, each with its rocket (if not the one in focus), a button to move it up one place
// and a button to take it out.
function queueRow() {
  const entries = queueEntries(), research = entries.filter(entry => !entry.analysis).length;
  if (!entries.length) return '';
  return `<div class="rqueue"><span class="t">QUEUE${research ? ` ${research}/${RESEARCH_QUEUE_LENGTH}` : ''}</span>`
    + entries.map((entry, index) => `<span class="rq-item">${index + 1}. ${entry.name}${entry.prog && entry.prog != S.cur ? ` <span class="d">(${PROGRAMMES[entry.prog].name})</span>` : ''}${index ? `<button data-a="qup" data-id="${index}" title="Move up the queue">▲</button>` : ''}<button data-a="unq" data-id="${index}" title="Remove from the queue">×</button></span>`).join('')
    + `<span class="m">${queueWait() || ''}</span></div>`;
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
  return `<div class="pbar">${Object.keys(S.progs).filter(kind => !PROGRAMMES[kind].stageOf).map(kind => `<button data-a="prog" data-id="${kind}" class="${kind == S.cur ? 'on' : ''}">${PROGRAMMES[kind].name}<span class="d"> ${S.progs[kind].ready ? Math.round(maturity(kind)) : 'design'}</span></button>`).join('')}</div>`;
}
const formatStat = (stat, value) => stat == 'thr' ? `${Math.round(value / 100) / 10} kN` : stat == 'dry' || stat == 'f' ? `${Math.round(value)} kg` : stat == 'g' ? `${value.toFixed(1)} g` : stat == 'r' ? `${value >= 0 ? '+' : ''}${Math.round(value * 100)} pts` : stat == 'rv' ? `${Math.round(value).toLocaleString('en-US')} m/s` : `${Math.round(value * 100)}%`;
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
// What the desk shows: view (research | programme | file | incidents), pick: the research card kept in the dossier, hover: the one
// under the mouse, shown instead while it is there; unfolded: the areas whose folded confirmed packages are opened out.
export const researchDesk = { view: 'research', pick: null, hover: null, unfolded: {} };
const VIEWS = { research: 'RESEARCH', programme: 'ROCKET PROGRAMME', file: 'ENGINEERING FILE', incidents: 'UNEXPLAINED FAILURES' };
// LOWER STAGES (rules/stages.js): their incidents and engineering files show under the rocket's, each in a block that carries the
// stage (data-stage), so its buttons act with that stage in focus (ui/input.js).
const isUnexplained = incident => incident.st == 'open' || incident.st == 'inv' || incident.st == 'found';
const stageCount = test => stagesOf(S.cur).reduce((sum, stage) => sum + S.progs[stage].inc.filter(test).length, 0);
const inStage = (stage, html) => `<div data-stage="${stage}"><div class="lbl sub">${PROGRAMMES[stage].name.toUpperCase()}</div>${html}</div>`;
// One compact row per lower stage: its engine and revision, its research, the widest of the team's windows on it, the flaws found
// and fixes fitted, and its open incidents.
function stageRows() {
  return stagesOf(S.cur).map(stage => withProgramme(stage, () => {
    const bundle = S.progs[stage], open = S.inc.filter(isUnexplained).length;
    const widest = DESIGN_STATS.filter(({ key }) => key != 'r' && key != 'h' && key != 'q').map(({ key, label }) => {
      const range = believedWindow(stage, key);
      return { label, share: (range.hi - range.lo) / 2 / Math.max(1e-9, Math.abs(range.mid)) };
    }).sort((first, second) => second.share - first.share)[0];
    const research = STAGE_AREAS.flatMap(area => itemsInArea(area)), done = research.filter(item => isResearched(item.id)).length;
    return `<div class="r stage"><span><b>${PROGRAMMES[stage].name}</b> <span class="d">${PROGRAMMES[stage].engine} · Rev ${bundle.bp.rev}</span></span><span class="d">research ${done} of ${research.length} · ${widest.label} ±${Math.round(widest.share * 100)}% · flaws found ${bundle.traits.filter(trait => trait.found).length} of ${bundle.traits.length} · ${Object.keys(S.fix).length} fix${Object.keys(S.fix).length == 1 ? '' : 'es'} fitted</span><button data-a="rview" data-id="${open ? 'incidents' : 'file'}">${open ? `${open} INCIDENT${open > 1 ? 'S' : ''}` : 'FILE'}</button></div>`;
  })).join('');
}
export function renderResearchDesk() {
  const tiers = trackingTiers(), bundle = S.progs[S.cur], unexplained = S.inc.filter(isUnexplained), awaitingFix = S.inc.filter(incident => incident.st == 'diag').length + stageCount(incident => incident.st == 'diag');
  const stageUnexplained = stageCount(isUnexplained);
  // Rocket areas once the programme is ready; recovery always; the spacecraft areas after NASA.
  const areas = (bundle && bundle.ready ? ['p', 's', 'i', 'a'] : []).concat(['r'], S.nasa ? ['c', 'e'] : []);
  const view = researchDesk.view;
  let html = `<div class="rtabs">${Object.keys(VIEWS).map(key => `<button data-a="rview" data-id="${key}" class="${key == view ? 'on' : ''}">${VIEWS[key]}${key == 'incidents' && unexplained.length + stageUnexplained ? ` (${unexplained.length + stageUnexplained})` : ''}${key == 'file' && awaitingFix ? ` (${awaitingFix})` : ''}</button>`).join('')}`
    + `<span class="m">${PROGRAMMES[S.cur].name} ${designation(S.bp.pk)}, Rev ${S.bp.rev} · ${INSTRUMENT_NAMES[tiers.v]} · ${TRACKING_NAMES[tiers.g]} · <b>teams free ${freeTeams()} of ${S.teams}</b></span></div>`;
  if (view == 'research') html += programmeBar() + stageRows() + queueRow() + `<div class="rcols" style="--areas:${areas.length}">${areas.map(researchColumn).join('')}</div>` + dossier();
  else if (view == 'programme') html += programmeBar() + programmeCard() + `<div class="m">Packages improve the rocket in small, uncertain steps. Finished work goes into airframes when you publish a blueprint revision (Hangar desk), and its real effect is confirmed when one flies${S.fac.stand ? ' or a propulsion package is ground tested' : ''}.</div>`;
  else if (view == 'file') html += `<div class="m">Each system's entry in the engineering file: what your team knows about it, the failure modes it has met and how they were cured. Knowledge carries from flight to flight.</div><div class="rcols" style="--areas:${areas.length}">${areas.map(area => `<div class="rcol"><div class="rcol-hd">${AREAS[area].toUpperCase()}</div>${engineeringFile(area)}</div>`).join('')}</div>`
    + stagesOf(S.cur).map(stage => inStage(stage, withProgramme(stage, () => `<div class="rcols" style="--areas:2">${['p', 's'].map(area => `<div class="rcol"><div class="rcol-hd">${AREAS[area].toUpperCase()}</div>${engineeringFile(area)}</div>`).join('')}</div>`))).join('');
  else {
    const stageCards = stagesOf(S.cur).map(stage => withProgramme(stage, () => {
      const open = S.inc.filter(isUnexplained);
      return open.length ? inStage(stage, `<div class="cards">${open.slice().reverse().map(incidentHTML).join('')}</div>`) : '';
    })).join('');
    html += unexplained.length || stageCards ? (unexplained.length ? `<div class="cards">${unexplained.slice().reverse().map(incidentHTML).join('')}</div>` : '') + stageCards : '<div class="m">No unexplained failures on file.</div>';
  }
  setHTML($('#rdesk'), html);
}

// Queued work's place in the queue, with a way to move it up or take it out.
const queuedHTML = position => `<div class="wn">Queued #${position + 1}: ${position ? `starts after ${position} more` : queueWait() || 'starting'}</div>${position ? `<button data-a="qup" data-id="${position}">MOVE UP THE QUEUE</button>` : ''}<button data-a="unq" data-id="${position}">REMOVE FROM QUEUE</button>`;
// INCIDENTS: a failure (or a design-review finding) from records analysis to diagnosis to fix.
// Unexplained ones stay in their own panel; once diagnosed they move into the engineering file of the system at fault.
function incidentHTML(incident) {
  let html = `<div class="c"><div class="t">${incident.review ? `Design review finding #${incident.id}` : `Incident #${incident.id} | ${incident.lab} | T+${incident.t}s${incident.plot ? ' | last plot ' + incident.plot : ''}`}</div>${incident.review ? '<div class="m">Found on the drawings before it ever failed in flight.</div>' : `<div class="m">Records show: ${incident.sym.length ? incident.sym.map(symptom => SYMPTOMS[symptom].text).join('; ') : 'radio carrier and radar track lost only'}</div>`}`;
  if (incident.st == 'open') {
    const lock = S.b < INVESTIGATION_COST ? 'Need funds.' : freeTeams() < 1 ? 'Teams busy.' : null, queued = analysisPosition(incident.id);
    html += `<div>Cannot yet tell apart: ${incident.cand.map(mode => FAILURE_MODES[mode].name).join(' / ')}</div><div class="m">Evidence on file: ${incident.ev}</div><button data-a="inv" data-id="${incident.id}"${lock ? ' disabled' : ''}>RECORDS ANALYSIS (${formatMoney(INVESTIGATION_COST)}, ${investigationTime(incident)}s)</button>`
      + (queued >= 0 ? queuedHTML(queued)
        : lock && !queueAnalysisLock(incident.id) ? `<button data-a="qinv" data-id="${incident.id}">QUEUE FOR THE NEXT FREE TEAM</button>` : '');
  } else if (incident.st == 'found') html += findingsHTML(incident);
  else if (incident.st == 'inv') html += `<div class="wn">Investigating: <span data-j="inv${incident.id}">${(findJob(job => job.k == 'inv' && job.id == incident.id) || { t: 0 }).t}s</span></div>`;
  else if (incident.st == 'diag') {
    html += `<div>${incident.review ? 'Risk' : incident.conf == 'your call' ? 'You concluded' : 'Engineers conclude'}: ${FAILURE_MODES[incident.dx].name}${incident.review || incident.conf == 'your call' ? '' : ` (${incident.conf} confidence)`}</div>`
      + FAILURE_MODES[incident.dx].fixes.map(fix => `<div class="m">${fix.name}: ${fix.riskMultiplier <= .3 ? 'strong' : 'partial'} cure</div>${fixButtons(incident, fix)}`).join('');
  } else if (incident.st == 'fixing') html += `<div class="wn">Implementing: <span data-j="fix${incident.id}">${(findJob(job => job.k == 'fix' && job.id == incident.id) || { t: 0 }).t}s</span></div>`;
  return html + '</div>';
}
// A corrective fix: start it now, or queue it when the money or a team is not there yet. Once one fix is queued, it shows in its place.
function fixButtons(incident, fix) {
  const queued = fixPosition(incident.id);
  if (queued >= 0) return S.rq[queued].f == fix.id ? queuedHTML(queued) : '';
  const locked = S.b < fix.cost || freeTeams() < 1;
  return `<button data-a="fix" data-id="${incident.id}" data-f="${fix.id}"${locked ? ' disabled' : ''}>${fix.name.toUpperCase()} (${formatMoney(fix.cost)}, ${fix.time}s)</button>`
    + (locked && !queueFixLock(incident.id) ? `<button data-a="qfix" data-id="${incident.id}" data-f="${fix.id}">QUEUE FOR THE NEXT FREE TEAM</button>` : '');
}
// THE FINDINGS CARD: the suspects ranked by the team's belief, and your call. The lead carries the team's chance of being right;
// the rest share what is left evenly (that is how a wrong lead is picked, so the figures are honest).
function findingsHTML(incident) {
  const others = incident.cand.filter(mode => mode != incident.dx), rest = others.length ? (1 - incident.p) / others.length : 0;
  const lock = S.b < INVESTIGATION_COST ? ' (need funds)' : freeTeams() < 1 ? ' (teams busy)' : '', queued = analysisPosition(incident.id);
  return `<div><b>Findings:</b> the team suspects <b>${FAILURE_MODES[incident.dx].name}</b> (${incident.conf} confidence).</div>`
    + `<div class="m">${[incident.dx, ...others].map(mode => `${FAILURE_MODES[mode].name} ${Math.round((mode == incident.dx ? incident.p : rest) * 100)}%`).join(' · ')}</div>`
    + `<div class="m"><b>Ruth Ellis, Chief Engineer:</b> "${chiefOnFindings(incident)}" <b>Samuel Morgan, Range:</b> "${rangeOnRecords(recordsQuality())}"</div>`
    + `<button data-a="accept" data-id="${incident.id}">ACCEPT: ${FAILURE_MODES[incident.dx].name.toUpperCase()}</button>`
    + (others.length ? (queued >= 0 ? queuedHTML(queued) : `<button data-a="extend" data-id="${incident.id}"${lock ? ' disabled' : ''}>EXTEND THE ANALYSIS: RULE ONE OUT (${formatMoney(INVESTIGATION_COST)}, ${investigationTime(incident)}s)${lock}</button>`
        + (lock && !queueAnalysisLock(incident.id) ? `<button data-a="qinv" data-id="${incident.id}">QUEUE THE EXTENDED ANALYSIS</button>` : ''))
      + `<div class="m">Or overrule the team and name the cause yourself:</div>${others.map(mode => `<button data-a="name" data-id="${incident.id}" data-f="${mode}">IT WAS ${FAILURE_MODES[mode].name.toUpperCase()}</button>`).join('')}` : '');
}
// THE ENGINEERING FILE: what the team knows about one system, what that knowledge buys, its failure modes and their status.
function engineeringFile(area) {
  const value = knowledge(area), modes = [...SYSTEMS[area].modes];
  let html = `<div class="kn"><div class="r"><span class="d">Team knowledge</span><b>${levelName(value)} (${Math.round(value)})</b></div><div class="bar"><i style="width:${value}%"></i></div>`;
  const benefits = [`estimates ${Math.round(50 * value / 100)}% tighter`];
  if (modes.length) benefits.push(`poll +${Math.round(30 * value / 100)} pts on faults here`, `failures recognised on the spot ${Math.round(70 * value / 100)}%`, `investigations ${Math.round(40 * value / 100)}% faster`);
  html += `<div class="m">${benefits.join(' • ')}</div>`;
  if (modes.length) {
    const seen = filedModes(area);
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
    const reviewLocked = S.b < REVIEW_COST || freeTeams() < 1, queued = reviewPosition(area);
    html += review ? `<div class="wn">Design review under way: <span data-j="rev${area}">${review.t}s</span></div>` : queued >= 0 ? queuedHTML(queued) : `<button data-a="rev" data-id="${area}"${reviewLocked ? ' disabled' : ''}>DESIGN REVIEW (${formatMoney(REVIEW_COST)}, ${reviewTime(area)}s, ~${Math.round(reviewOdds(area) * 100)}% to find a hidden risk if one exists)</button>`
      + (reviewLocked && !queueReviewLock(area) ? `<button data-a="qrev" data-id="${area}">QUEUE FOR THE NEXT FREE TEAM</button>` : '');
  }
  return html + '</div>';
}
