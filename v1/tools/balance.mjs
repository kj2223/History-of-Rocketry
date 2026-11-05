// Headless bot: plays the V1 rules through the façade from 1945 to NASA formation and prints pacing.
// Run: node tools/balance.mjs        SEED=1,2,3 picks seeds (default 1..4)    ROUNDTRIP=1 saves and reloads on 1 Jan 1950.
// It plays by the book: every programme through the four stages, a short ground test and a build before each launch,
// every open decision answered by its first option and, if a veto refuses that, its last. Seeded, so the same code prints the
// same report: diff the output before and after a rules or tuning change. Exit code 1 means a dead end (see DEAD ENDS below).
import { newGame, dispatch, advance, project, exportGame, checkSave } from '../js/rules/index.js';
import { dayOf, END_DAY, dateLabel } from '../js/core/calendar.js';

const SEEDS = (process.env.SEED ?? '1,2,3,4').split(',').map(Number);
const ROUNDTRIP = !!process.env.ROUNDTRIP;
const STUCK_DAYS = 400;           // a decision open this long, or a programme that never leaves a stage, is a dead end
const LAUNCH_EVERY = 120;         // days between launch requests per programme
const STEP = 7;                   // the bot looks at the game once a week; state grows, so a daily look is quadratic

const play = seed => {
  let state = newGame(seed), n = 0;
  const stats = { rejections: {}, vetoes: 0, decisions: 0, built: 0, tests: 0, delegatedOn: null, peakOpen: 0, years: {} };
  const deadEnds = [];
  const act = (type, actor, payload = {}) => {
    const r = dispatch(state, { id: `b${++n}`, type, actor, payload });
    if (r.rejection) { const k = `${type}: ${r.rejection.reason}`.replace(/\d+/g, '#').slice(0, 90); stats.rejections[k] = (stats.rejections[k] ?? 0) + 1; return null; }
    state = r.state;
    return r;
  };
  const lastLaunch = {}, held = {};
  const book = (unit, programmeId, days) => {
    const id = `res-${++n}`;
    const r = act('reserve-facility', 'administrator', { id, unitId: unit, programmeId, from: state.day, to: state.day + days, purpose: 'bot' });
    return r?.result.reservation ? id : null;
  };
  const answerDecisions = () => {
    for (const d of state.decisions.filter(x => x.status === 'open')) {
      if (act('decide', 'administrator', { decisionId: d.id, choice: d.options[0] })) { stats.decisions++; continue; }
      stats.vetoes++;
      act('decide', 'administrator', { decisionId: d.id, choice: d.options.at(-1) });
      if (state.day - d.day > STUCK_DAYS) deadEnds.push(`decision ${d.id} (${d.type}) open since day ${d.day}`);
    }
  };
  const proposals = () => {
    for (const p of Object.values(state.programmes)) {
      const id = p.id;
      if (p.stage === 'feasibility') act('authorise-feasibility', 'administrator', { programmeId: id });
      else if (p.stage === 'investigation') {
        if (!p.cases.engineering) act('complete-case', 'technical-director', { programmeId: id, summary: 'bot' });
        if (!p.cases.funding) act('complete-case', 'financial-officer', { programmeId: id, summary: 'bot' });
        if (!p.meeting) act('record-meeting', 'administrator', { programmeId: id, cost: 300000, contribution: 'client vehicles', timeline: '18 months', requirements: 'bot' });
        if (p.cases.engineering && p.cases.funding && p.meeting) act('submit-dossier', 'administrator', { programmeId: id });
      } else if (p.stage === 'preliminary') act('request-greenlight', 'administrator', { programmeId: id });
    }
  };
  const fly = p => {
    if (!p.vehicle || p.stage !== 'greenlit' || state.work.some(j => j.programmeId === p.id && j.status === 'running')) return;
    if (state.day - (lastLaunch[p.id] ?? -LAUNCH_EVERY) < LAUNCH_EVERY) return;
    const stand = book('stand-1', p.id, 6);
    if (stand) {
      const stages = Object.keys(p.baseline), stage = stages.at(-1);
      const channels = [`${stage}.chamber-pressure`];
      if (act('schedule-test', 'administrator', { jobId: `gt-${++n}`, programmeId: p.id, stage, stages: {}, conditions: { burn: 'short' }, channels, reservation: stand })) stats.tests++;
    }
    const article = `art-${++n}`;
    if (!act('build-article', 'production', { id: article, programmeId: p.id })) return;
    stats.built++;
    const pad = book('pad-1', p.id, 5), tracking = book('tracking-1', p.id, 5);
    if (pad && tracking) { act('request-launch', 'administrator', { id: `L-${n}`, articleId: article, pad, tracking, cost: 20000, replacementCost: 20000 }); lastLaunch[p.id] = state.day; }
  };
  // From 1948 the bot appoints leadership, so the delegation path (FRZ-04) is played, not just tested.
  const appoint = () => {
    if (state.day < dayOf(1948, 1, 1) || stats.appointed) return;
    stats.appointed = true;
    act('appoint', 'administrator', { id: 'bot-head', role: 'department-head', person: 'Bot Head', remit: { programmes: ['wac', 'aerobee'], scheduling: true } });
    for (const id of ['wac', 'aerobee']) act('appoint', 'administrator', { id: `bot-pm-${id}`, role: 'project-manager', person: `Bot PM ${id}`, programmeId: id });
  };
  const stagesSeen = {};
  const watch = () => {
    for (const p of Object.values(state.programmes)) {
      const key = `${p.id}:${p.stage}`;
      stagesSeen[key] ??= state.day;
      if (['investigation', 'dossier'].includes(p.stage) && state.day - stagesSeen[key] > STUCK_DAYS) { deadEnds.push(`${key} for over ${STUCK_DAYS} days`); stagesSeen[key] = Infinity; }
    }
    stats.peakOpen = Math.max(stats.peakOpen, state.decisions.filter(d => d.status === 'open').length);
    if (!stats.delegatedOn && Object.values(state.delegation.programmes).some(d => d.active)) stats.delegatedOn = dateLabel(state.day);
  };

  try {
    while (!state.concluded) {
      answerDecisions();
      proposals();
      appoint();
      for (const p of Object.values(state.programmes)) fly(p);
      watch();
      if (ROUNDTRIP && state.day >= dayOf(1950, 1, 1) && !stats.saved) { stats.saved = true; state = checkSave(exportGame(state)); }
      state = advance(state, STEP).state;
      const year = dateLabel(state.day).slice(-4);
      if (!stats.years[year]) stats.years[year] = { cash: Math.round(state.fiscal.cash), flights: 0, failures: 0 };
    }
  } catch (e) { deadEnds.push(`exception: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }

  const flown = state.launches.filter(l => l.status === 'flown');
  const pub = project(state);
  // A decision raised in the last step before NASA formation had no chance to be answered; that is not a dead end.
  const open = state.decisions.filter(d => d.status === 'open' && state.day - d.day >= STEP);
  if (!state.concluded) deadEnds.push('campaign did not reach NASA formation');
  if (open.length) deadEnds.push(`${open.length} decisions still open at the end: ${open.map(d => d.type).join(', ')}`);
  return { seed, state, pub, stats, flown, deadEnds };
};

const lines = [];
let failed = 0;
for (const seed of SEEDS) {
  const r = play(seed), { stats } = r;
  const ok = r.flown.filter(l => l.outcome === 'success').length, bad = r.flown.filter(l => l.outcome === 'failure').length;
  lines.push(`== seed ${seed}: ${dateLabel(r.state.day)}`);
  lines.push(`  flights ${r.flown.length} (${ok} success, ${bad} failure, ${r.flown.length - ok - bad} indeterminate); articles built ${stats.built}; ground tests ${stats.tests}`);
  lines.push(`  decisions answered ${stats.decisions}, vetoes met ${stats.vetoes}, peak open ${stats.peakOpen}; delegation opened ${stats.delegatedOn ?? 'never'}`);
  lines.push(`  programmes: ${Object.values(r.state.programmes).map(p => `${p.id}=${p.stage}`).join(', ')}`);
  lines.push(`  cash at end $${Math.round(r.state.fiscal.cash)}; award ${r.state.fiscal.award}; overdue payments ${r.state.fiscal.ledger.filter(e => e.status === 'overdue').length}`);
  lines.push(`  anomalies: ${r.pub.anomalies.map(a => `${a.id}=${a.status}`).join(', ') || 'none'}`);
  lines.push(`  summary sections: ${r.pub.summary?.sections.length ?? 'none'}`);
  const top = Object.entries(stats.rejections).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length) lines.push('  top rejections: ' + top.map(([k, v]) => `${v}× ${k}`).join('; '));
  if (r.deadEnds.length) { failed++; lines.push('  DEAD ENDS:'); for (const d of [...new Set(r.deadEnds)]) lines.push(`    - ${d}`); }
}
console.log(lines.join('\n'));
console.log(failed ? `BOT FOUND ${failed} dead end run(s).` : 'No dead ends.');
process.exitCode = failed ? 1 : 0;
