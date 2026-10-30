// HANGAR tab: the drawing office (blueprint revisions), the factory queue (new builds and upgrades, cancellable)
// and the hangar. The base is on its own desk (ui/site-plan.js).
import { formatMoney } from '../core/util.js';
import { BY_ID } from '../data/research.js';
import { findFix } from '../data/failures.js';
import { PROGRAMMES } from '../data/programmes.js';
import { MISSION_TYPES } from '../data/mercury.js';
import { S, findJob, withProgramme } from '../core/state.js';
import { designation } from '../rules/design.js';
import { unitCost, batchCost, buildTime, draftChanges, draftSize, experienceCarryover, lineLearning, lineExperience, retrofitQuote, blueprintConfig, rocketFixes } from '../rules/production.js';
import { buildTeams, buildRate, refundFor } from '../rules/factory.js';
import { reedPublishes } from '../rules/factory-lead.js';
import { programmeBar } from './design-bureau.js';
import { $, setHTML } from './dom.js';

const AUTO_PUBLISH_CHOICES = [1, 2, 3, 4, 5, 6, 8, 10];
// Each lower stage's revision on a configuration or airframe (rules/stages.js), e.g. " / Titan II first stage Rev 2".
const stagePackageCount = () => Object.values(blueprintConfig().stg).reduce((sum, each) => sum + each.pk.length, 0);
const stageRevisions = config => Object.entries(config.stg || {}).map(([stage, each]) => ` / ${PROGRAMMES[stage].name} Rev ${each.rev}`).join('');
export function renderHangar() {
  setHTML($('#bp'), programmeBar() + drawingOfficeHTML());
  setHTML($('#as'), factoryHTML());
  setHTML($('#hg'), S.air.length ? S.air.slice().reverse().map(airframeCard).join('') : '<div class="m">The hangar is empty.</div>');
}
function drawingOfficeHTML() {
  const draft = draftChanges(), changes = draftSize(draft), fixCount = Object.keys(S.bp.fix).length;
  return `<div class="r"><span class="d">Published blueprint</span><b>${PROGRAMMES[S.cur].name} ${designation(S.bp.pk)}, Rev ${S.bp.rev}${stageRevisions(blueprintConfig())}</b></div><div class="m">${S.bp.pk.length} package${S.bp.pk.length == 1 ? '' : 's'}${stagePackageCount() ? ` (and ${stagePackageCount()} on the lower stages)` : ''} and ${fixCount} corrective fix${fixCount == 1 ? '' : 'es'} on the drawings.</div>`
    + (changes ? `<div class="c"><div class="t">DRAFT CHANGES${draft.packages.length + draft.fixes.length ? ` FOR REV ${S.bp.rev + 1}` : ''}</div><div class="m">${[...draft.packages.map(id => BY_ID[id].name), ...draft.stages.map(change => `${BY_ID[change.id].name} (${PROGRAMMES[change.stage].name})`), ...draft.fixes.map(mode => findFix(mode.split('@')[0], rocketFixes()[mode]).name)].join('; ')}.</div><div class="m">Publishing keeps about ${Math.round(experienceCarryover() * 100)}% of the production line's experience${draft.packages.some(id => id.startsWith('ms_')) ? ': a milestone means retooling the line' : ''}. Batching changes into fewer revisions keeps the line learning.</div><button data-a="publish">PUBLISH ${draft.packages.length + draft.fixes.length ? `BLUEPRINT REV ${S.bp.rev + 1}` : 'STAGE REVISIONS'}</button><div class="m">Airframes already ordered keep their revision. Cancel them in the queue if you would rather wait.</div></div>`
      : '<div class="m">Every finished package and fix is on the published blueprint.</div>')
    + (reedPublishes() ? `<div class="m" style="margin-top:8px">Margaret Reed publishes this rocket's blueprint while she runs its production${S.works.hold ? '. She is holding this draft: it would make the rocket heavier for its thrust' : ''}.</div>` : '')
    + `<div class="r" style="margin-top:8px"><span class="d">Auto-publish when draft changes reach</span><select data-ap="n" style="width:auto;margin:0">${AUTO_PUBLISH_CHOICES.map(count => `<option${S.ap.n == count ? ' selected' : ''}>${count}</option>`).join('')}</select></div><button data-a="aptog">AUTO-PUBLISH: ${S.ap.on ? 'ON' : 'OFF'}</button>`;
}
// The factory: ordering, line experience, build teams and the queue. Items on the floor show progress and refund half.
function factoryHTML() {
  const unit = unitCost(), fiveUnits = batchCost(5), ready = S.progs[S.cur].ready, programmeName = PROGRAMMES[S.cur].name;
  const progress = item => Math.max(0, Math.round((item.tot - item.t) / item.tot * 100));
  const queued = lineExperience() > S.line.xp ? ` (+${lineExperience() - S.line.xp} queued)` : '';
  const tooling = S.fac.jigs || S.fac.nc || S.fac.clean ? ` • tooling ${Math.round((buildRate() - 1) * 100)}% faster${S.fac.clean ? ', capsules +30%' : ''}` : '';
  return `<div class="m">${ready ? `New ${programmeName} airframe to Rev ${S.bp.rev}: ${formatMoney(unit)}, ${buildTime()}s on the floor.` : `The ${programmeName} is still in detailed design: no airframes yet.`}</div><div class="r"><span class="d">Line experience</span><b>${S.line.xp.toFixed(1)} unit${S.line.xp == 1 ? '' : 's'} of Rev ${S.bp.rev}${queued} • ${Math.round((1 - lineLearning(lineExperience())) * 100)}% faster and cheaper</b></div><div class="two"><button data-a="ord" data-n="1"${S.b < unit || !ready ? ' disabled' : ''}>ORDER x1 (${formatMoney(unit)})</button><button data-a="ord" data-n="5"${S.b < fiveUnits || !ready ? ' disabled' : ''}>ORDER x5 (${formatMoney(fiveUnits)})</button></div>`
    + `<div class="r" style="margin-top:8px"><span class="d">Build teams</span><b>${buildTeams()} working at once${tooling}</b></div>`
    + (S.aq.length ? S.aq.map((item, index) => queueItemHTML(item, index, progress)).join('') : '<div class="m">The factory floor is idle.</div>');
}
function queueItemHTML(item, index, progress) {
  const onFloor = index < buildTeams();
  const outdated = item.cfg && S.progs[item.prog] && item.cfg.rev < S.progs[item.prog].bp.rev ? ' <span class="bad">(outdated)</span>' : '';
  const what = item.k == 'msn' ? `${MISSION_TYPES[item.mt].capsuleName} (Rev ${item.cfg.rev})${item.refurb ? ' refurbishment' : ''}`
    : item.k == 'retro' ? `Upgrade airframe #${item.af} to Rev ${item.cfg.rev}`
    : `New ${PROGRAMMES[item.prog] ? PROGRAMMES[item.prog].name : ''} airframe, Rev ${(item.cfg && item.cfg.rev) || 1}${outdated}`;
  return `<div class="c qi"><div class="r"><span>${onFloor ? '<b class="wn">ON THE FLOOR</b> ' : `<span class="d">${index + 1}.</span> `}${what}</span><span class="d">${onFloor ? `<span data-q="${index}">${progress(item)}% (${Math.ceil(item.t / buildRate(item))}s)</span>` : Math.ceil(item.tot / buildRate(item)) + 's'}</span></div>${onFloor ? `<div class="bar"><i data-qb="${index}" style="width:${progress(item)}%"></i></div>` : ''}<button data-a="cancelq" data-id="${index}" class="danger">CANCEL (refund ${formatMoney(refundFor(index))})</button></div>`;
}
// An up-to-date airframe: say so, and point at finished changes still waiting in the draft (they reach airframes only once published).
function unpublishedNote(airframe) {
  const draft = withProgramme(airframe.prog, draftChanges), waiting = draftSize(draft);
  return '<div class="m">Built to the current blueprint.'
    + (waiting ? ` ${waiting} finished change${waiting > 1 ? 's are' : ' is'} waiting in the draft: publish the next blueprint revision${airframe.prog != S.cur ? ` of the ${PROGRAMMES[airframe.prog].name}` : ' above'} to upgrade.` : '') + '</div>';
}
function airframeCard(airframe) {
  const quote = retrofitQuote(airframe), retrofit = findJob(job => job.k == 'retro' && job.id == airframe.id), latest = S.progs[airframe.prog] ? S.progs[airframe.prog].bp.rev : 1;
  const status = airframe.st == 'queued' ? '<div class="wn">Waiting in the factory queue for its upgrade.</div>'
    : airframe.st == 'retro' && retrofit ? `<div class="wn">Retrofit: <span data-j="retro${airframe.id}">${retrofit.t}s</span></div>`
    : quote ? `<div class="m">${quote.changes} change${quote.changes > 1 ? 's' : ''} behind Rev ${latest}.</div><button data-a="upgrade" data-id="${airframe.id}"${S.b < quote.cost ? ' disabled' : ''}>QUEUE UPGRADE TO REV ${latest} (${formatMoney(quote.cost)}, ${quote.time}s)</button>`
    : unpublishedNote(airframe);
  return `<div class="c"><div class="t">${airframe.label}, Rev ${airframe.rev || 1}${stageRevisions(airframe)} | built ${airframe.built}</div>` + status + '</div>';
}
