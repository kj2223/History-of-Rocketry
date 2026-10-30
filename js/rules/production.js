// PRODUCTION: blueprint revisions, the production line's learning curve, airframe costs and retrofits. No DOM.
// Player actions that use these (ordering, publishing, upgrades) are in rules/factory.js.
import { gaussian } from '../core/util.js';
import { isMilestone } from '../data/research.js';
import { findFix } from '../data/failures.js';
import { S, today, withProgramme } from '../core/state.js';
import { programmeOf, programmeData, stagesOf, fixKeyFor } from './programs.js';
import { packageCounts, airframeLabel } from './design.js';
import { itemAsSeen } from './research.js';

// PRODUCTION LINE LEARNING (Wright's law): each doubling of airframes built to the current blueprint cuts time and cost by about 20%, down to 45%.
// Experience counts builds already queued to the current revision, so a batch order gets cheaper unit by unit.
export const lineLearning = experience => Math.max(.45, Math.pow(Math.max(0, experience) + 1, -.322));
const queuedToCurrentRevision = () => S.aq.filter(item => item.k == 'build' && item.prog == S.cur && item.cfg && item.cfg.rev == S.bp.rev).length;
export const lineExperience = (extra = 0) => (S.line ? S.line.xp : 0) + queuedToCurrentRevision() + extra;

// An airframe before line learning: the programme's unit cost and time, plus 4% (3% of time) per package and 20% (15%) per milestone, up to 8.
const baseUnitCost = () => {
  const counts = packageCounts(S.bp.pk), programme = programmeData() || { unitCost: 4000 };
  return programme.unitCost * (1 + .04 * counts.packages + .2 * Math.min(counts.milestones, 8));
};
const baseBuildTime = () => {
  const counts = packageCounts(S.bp.pk), programme = programmeData() || { unitTime: 10 };
  return programme.unitTime * (1 + .03 * counts.packages + .15 * Math.min(counts.milestones, 8));
};
// The cost and factory time of the next airframe (extra: how many more are ordered ahead of it).
export const unitCost = (extra = 0) => Math.round(baseUnitCost() * lineLearning(lineExperience(extra)));
export const batchCost = count => [...Array(count)].reduce((sum, _, index) => sum + unitCost(index), 0);
export const buildTime = (extra = 0) => Math.round(baseBuildTime() * lineLearning(lineExperience(extra)));

// BLUEPRINTS. The draft is everything finished since the published revision: { packages, fixes } (failure modes whose fix changed).
// The fixes a blueprint of the rocket in focus would carry: its own, and each lower stage's as mode@stage (rules/stages.js).
export const rocketFixes = () => {
  const fixes = { ...S.fix };
  for (const stage of stagesOf(S.cur)) for (const mode in S.progs[stage].fix) fixes[fixKeyFor(stage, mode)] = S.progs[stage].fix[mode];
  return fixes;
};
// A lower stage's finished packages ride in its own blueprint (S.progs[stage].bp), listed in the draft as stages: [{ stage, id }].
export const draftChanges = () => {
  const fixes = rocketFixes();
  return {
    packages: Object.keys(S.pk).filter(id => !S.bp.pk.includes(id)),
    fixes: Object.keys(fixes).filter(mode => S.bp.fix[mode] != fixes[mode]),
    stages: stagesOf(S.cur).flatMap(stage => Object.keys(S.progs[stage].pk).filter(id => !S.progs[stage].bp.pk.includes(id)).map(id => ({ stage, id }))),
  };
};
export const draftSize = draft => draft.packages.length + draft.fixes.length + draft.stages.length;
// How much line experience publishing the draft keeps: small packages 85% each (a stage's too), a milestone (retooling) 40%,
// a corrective fix 97%.
export function experienceCarryover() {
  const draft = draftChanges(), milestones = draft.packages.filter(isMilestone).length;
  return Math.pow(.85, draft.packages.length - milestones + draft.stages.length) * Math.pow(.4, milestones) * Math.pow(.97, draft.fixes.length);
}
// The published configuration of the rocket in focus, as airframes are built to it: its packages, fixes and revision, and each
// lower stage's packages and revision (stg).
export const blueprintConfig = () => ({
  pk: [...S.bp.pk], fix: { ...S.bp.fix }, rev: S.bp.rev,
  stg: Object.fromEntries(stagesOf(S.cur).map(stage => [stage, { pk: [...S.progs[stage].bp.pk], rev: S.progs[stage].bp.rev }])),
});
const copyStages = stages => Object.fromEntries(Object.entries(stages || {}).map(([stage, config]) => [stage, { pk: [...config.pk], rev: config.rev }]));

// BUILD VARIATION: no two airframes come out the same. Each one's thrust, dry mass and drag differ a little from the drawings,
// typically by 3%, 2% and 4% (never more than two and a half times that). A practised line builds more consistently: the spread
// shrinks with line learning, to under half on a mature line. Stored on the airframe as vr: { t, m, d } multipliers.
const BUILD_SPREAD = { t: .03, m: .02, d: .04 };
const MAX_DEVIATIONS = 2.5;
export function buildVariation(experience) {
  const consistency = lineLearning(experience), variation = {};
  for (const key in BUILD_SPREAD) {
    const deviation = Math.max(-MAX_DEVIATIONS, Math.min(MAX_DEVIATIONS, gaussian()));
    variation[key] = Math.round((1 + deviation * BUILD_SPREAD[key] * consistency) * 1000) / 1000;
  }
  return variation;
}

// A new airframe built to a blueprint configuration { pk, fix, rev, stg }.
export const makeAirframe = (config, cost, programme = S.cur) => {
  const id = S.nid++, line = S.progs[programme] && S.progs[programme].line;
  return { id, prog: programme, pk: [...config.pk], fix: { ...config.fix }, rev: config.rev || 1, stg: copyStages(config.stg), cost, st: 'r', built: today(), label: airframeLabel(programme, config.pk, id), vr: buildVariation(line ? line.xp : 0) };
};
// Bring an airframe to a configuration (an upgrade).
export function fitConfig(airframe, config) {
  Object.assign(airframe, { pk: [...config.pk], fix: { ...config.fix }, rev: config.rev, stg: copyStages(config.stg) });
  airframe.label = airframeLabel(airframe.prog, airframe.pk, airframe.id);
}
// The packages an airframe's lower stage carries.
export const stagePackages = (airframe, stage) => airframe.stg && airframe.stg[stage] ? airframe.stg[stage].pk : [];

// Upgrading a built airframe to the published blueprint: one factory job however many changes it carries.
// $600 plus 15% of each missing package's and fix's cost; 6 seconds plus 2 per change; both reduced by line learning.
// Returns { changes, cost, time }, or null if the airframe is up to date.
export function retrofitQuote(airframe) {
  return withProgramme(programmeOf(airframe), () => retrofitQuoteForProgramme(airframe));
}
function retrofitQuoteForProgramme(airframe) {
  const missingPackages = S.bp.pk.filter(id => !airframe.pk.includes(id));
  const changedFixes = Object.keys(S.bp.fix).filter(mode => airframe.fix[mode] != S.bp.fix[mode]);
  const missingStagePackages = stagesOf(S.cur).flatMap(stage => S.progs[stage].bp.pk.filter(id => !stagePackages(airframe, stage).includes(id)));
  const changes = missingPackages.length + changedFixes.length + missingStagePackages.length;
  if (!changes) return null;
  let cost = 600;
  [...missingPackages, ...missingStagePackages].forEach(id => cost += itemAsSeen(id).cost * .15);
  changedFixes.forEach(mode => cost += findFix(mode, S.bp.fix[mode]).cost * .15);
  return { changes, cost: Math.round(cost * lineLearning(lineExperience())), time: Math.round((6 + 2 * changes) * lineLearning(lineExperience())) };
}
