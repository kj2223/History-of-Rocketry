// Side panels: glanceable views of what is going on around the player (site, teams, funds, calendar,
// last flights, the wider world). Built only from the projection the main UI already holds; they send
// no commands. `ctx` carries the main UI's DOM and wording helpers so both read the same way.

import { dateOf, dayOf, fiscalQuarter, fiscalYearEnd } from '../js/core/calendar.js';
import { HEADLINES } from './world.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const short = d => { const { year, month, date } = dateOf(d); return `${date} ${MONTHS[month - 1].slice(0, 3)} ${String(year).slice(2)}`; };
const OUTCOME = { success: 'good', failure: 'failed', indeterminate: 'indeterminate' };
const PURPOSE = { launch: 'launch', tracking: 'tracking', 'ground test': 'ground firing', 'integration assessment': 'integration check' };
const ENDED = ['closed', 'lapsed'];
const UNIT = { range: 'Launch pad', 'static-stand': 'Static stand', 'instrumentation-lab': 'Instrument lab', 'integration-space': 'Assembly', tracking: 'Tracking' };

export const sidePanels = (view, { h, day, cap, money, programmeName, openMail }) => {
  const panel = (title, aside, ...body) => h('section', { class: 'panel', 'aria-label': title }, h('h3', {}, title, aside && h('span', {}, aside)), ...body);
  const row = (label, dot, main, ...sub) => h('div', { class: 'prow' }, h('div', { class: 'pk' }, label),
    h('div', {}, h('span', { class: `dot ${dot}`, 'aria-hidden': 'true' }), main, ...sub.filter(Boolean).map(s => typeof s === 'string' ? h('div', { class: 'psub' }, s) : s)));
  const link = (label, id) => h('button', { type: 'button', class: 'plink', 'data-key': `panel-${id}`, onclick: () => openMail(id) }, label);
  // 'wac-7' reads as 'WAC Corporal 7'.
  const article = id => { const a = view.hardware.articles[id]; const name = a && view.vehicles.find(v => v.id === a.vehicle)?.name; return name ? `${name} ${id.split('-').pop()}` : cap(id); };
  const held = view.calendar.filter(r => r.status === 'held');
  const openDecision = launchId => view.decisions.find(d => d.status === 'open' && d.type === 'launch' && d.subject === launchId);

  // ---- the site today ----
  const unitRow = u => {
    const name = UNIT[u.kind] ?? view.facilityKinds.find(k => k.id === u.kind)?.name ?? cap(u.kind);
    if (u.status === 'upgrading') return row(name, 'warn', 'Being upgraded', 'Out of service until the work is done');
    if (u.status === 'commissioning') return row(name, 'warn', 'Being commissioned', 'Not yet usable');
    if (u.kind === 'range') {
      const waiting = view.launches.find(l => l.status === 'awaiting-decision'), flying = view.launches.find(l => l.status === 'in-flight');
      if (flying) return row(name, 'ok', h('b', {}, `${article(flying.articleId)} in flight`));
      if (waiting) { const d = openDecision(waiting.id);
        return row(name, 'alert', h('b', {}, `${article(waiting.articleId)} on the pad`), `Waiting for your go since ${day(waiting.day)}.`, d && link('Open the decision', d.id)); }
    }
    if (u.kind === 'integration-space') {
      const onPad = new Set(view.launches.filter(l => l.status === 'awaiting-decision' || l.status === 'in-flight').map(l => l.articleId));
      const ready = Object.values(view.hardware.articles).filter(a => a.status === 'built' && !onPad.has(a.id)).sort((a, b) => a.built - b.built);
      if (ready.length) return row(name, 'warn', h('b', {}, `${ready.map(a => article(a.id)).join(', ')} assembled`), `Ready since ${day(ready[0].built)}, waiting for the pad.`);
    }
    const now = held.filter(r => r.unitId === u.id && r.from <= view.day && view.day <= r.to);
    if (now.length) return row(name, 'ok', h('b', {}, now.map(r => `${programmeName(r.programmeId)} ${PURPOSE[r.purpose] ?? r.purpose}`).join(', ')), `Booked until ${day(Math.max(...now.map(r => r.to)))}`);
    const next = held.filter(r => r.unitId === u.id && r.from > view.day).sort((a, b) => a.from - b.from)[0];
    const last = view.calendar.filter(r => r.unitId === u.id && r.to < view.day && r.status !== 'displaced').sort((a, b) => b.to - a.to)[0];
    return row(name, 'idle', next ? 'Idle for now' : last ? `Idle since ${day(last.to)}` : 'Not used yet',
      next ? `Next: ${programmeName(next.programmeId)} ${PURPOSE[next.purpose] ?? next.purpose}, ${day(next.from)}` : last && `Last: ${programmeName(last.programmeId)} ${PURPOSE[last.purpose] ?? last.purpose}`);
  };
  const site = panel('The site today', 'White Sands', ...view.facilities.filter(u => u.kind !== 'archive').map(unitRow));

  // ---- teams ----
  const live = view.programmes.filter(p => !ENDED.includes(p.stage));
  const record = p => { const flown = view.launches.filter(l => l.programmeId === p.id && l.status === 'flown');
    return flown.length ? `${flown.filter(l => l.outcome === 'success').length} good of ${flown.length} flights` : null; };
  const teams = panel('Teams', `${live.length} programme${live.length === 1 ? '' : 's'}`, ...live.map(p => {
    const wait = /your|you asked/i.test(p.team ?? '');
    return row(p.name, wait ? 'alert' : p.team ? 'ok' : 'idle', p.team ?? 'No team work yet.', record(p));
  }));

  // ---- funds ----
  const f = view.fiscal, fyStart = dayOf(f.fy - 1, 7, 1), fyEnd = fiscalYearEnd(f.fy);
  const months = Math.max(0, Math.round((fyEnd - view.day) / 30.4));
  const funds = panel('Funds', `Fiscal ${f.fy}`,
    h('div', {}, h('b', {}, money(f.available)), ' free to commit'),
    h('div', { class: 'psub' }, `${money(f.cash)} cash in hand · ${money(f.award)} awarded this year`),
    h('div', { class: 'pbar', role: 'img', 'aria-label': 'How far through the fiscal year' }, h('i', { style: `width:${Math.min(100, Math.round(100 * (view.day - fyStart) / (fyEnd - fyStart + 1)))}%` })),
    h('div', { class: 'psub' }, `The year closes ${day(fyEnd)}${months ? `, in ${months} month${months === 1 ? '' : 's'}` : ''}. Next release ${day(fiscalQuarter(view.day).end + 1)}.`));

  // ---- coming up ----
  const { year, month } = dateOf(view.day), first = dayOf(year, month, 1);
  const length = dayOf(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1) - first;
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const booked = d => held.some(r => r.from <= d && d <= r.to);
  const grid = h('div', { class: 'pcal', 'aria-hidden': 'true' }, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => h('i', {}, d)),
    Array.from({ length: lead }, () => h('b', { class: 'e' })),
    Array.from({ length }, (_, n) => h('b', { class: [first + n === view.day && 't', booked(first + n) && 'r', first + n < view.day && 'p'].filter(Boolean).join(' ') }, n + 1)));
  const events = [];
  const decisions = view.inbox.filter(i => i.kind === 'decision').length, proposals = view.inbox.filter(i => i.kind === 'proposal').length;
  if (decisions || proposals) events.push([view.day, 'Now', [decisions && `${decisions} decision${decisions === 1 ? '' : 's'}`, proposals && `${proposals} proposal${proposals === 1 ? '' : 's'}`].filter(Boolean).join(' and ') + ' waiting for you in Mail']);
  for (const r of held.filter(r => r.from > view.day)) events.push([r.from, short(r.from), `${programmeName(r.programmeId)} ${PURPOSE[r.purpose] ?? r.purpose}`]);
  const nextMonth = dayOf(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1), quarter = fiscalQuarter(view.day).end + 1;
  const teamsReport = live.some(p => p.stage === 'greenlit');
  if (nextMonth === quarter) events.push([quarter, short(quarter), `Quarter report and funds release${teamsReport ? ', monthly team updates' : ''}`]);
  else { if (teamsReport) events.push([nextMonth, short(nextMonth), 'Monthly team updates']); events.push([quarter, short(quarter), 'Quarter report and funds release']); }
  events.push([fyEnd, short(fyEnd), `Fiscal ${f.fy} closes`]);
  const coming = panel(`${MONTHS[month - 1]} ${year}`, 'Coming up', grid,
    ...events.sort((a, b) => a[0] - b[0]).slice(0, 6).map(([, when, what]) => h('div', { class: 'pev' }, h('div', { class: 'pd' }, when), h('div', {}, what))));

  // ---- the wider world ----
  const news = HEADLINES.map(([y, m, d, place, text]) => ({ day: dayOf(y, m, d || 1), when: d ? `${d} ${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${y}`, place, text }))
    .filter(n => n.day <= view.day).sort((a, b) => b.day - a.day).slice(0, 3);
  const world = panel('The wider world', 'From the papers',
    ...(news.length ? news.map(n => h('div', { class: 'pnews' }, h('div', { class: 'pd' }, `${n.when} · ${n.place}`), n.text)) : [h('p', { class: 'psub' }, 'Nothing in the papers yet.')]),
    h('div', { class: 'pfoot' }, 'Period background. It never changes your results.'));

  // ---- last flights ----
  const flown = view.launches.filter(l => l.status === 'flown' || l.status === 'in-flight').sort((a, b) => b.day - a.day).slice(0, 5);
  const flights = panel('Last flights', null, ...(flown.length ? flown.map(l => h('div', { class: 'pev' }, h('div', { class: 'pd' }, short(l.day)),
    h('div', {}, article(l.articleId), ' ', h('span', { class: `ptag ${l.outcome ?? 'flying'}` }, l.status === 'in-flight' ? 'in flight' : OUTCOME[l.outcome] ?? cap(l.outcome)))))
    : [h('p', { class: 'psub' }, 'Nothing has flown yet.')]));

  return [h('aside', { class: 'side left', 'aria-label': 'Around the site' }, site, teams, funds),
    h('aside', { class: 'side right', 'aria-label': 'Calendar and news' }, coming, world, flights)];
};
