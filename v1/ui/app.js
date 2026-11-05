// The V1 playable UI. Mail first. It renders only from project() and changes the game only by dispatching
// commands or advancing days. It never reads game state directly, and imports nothing but the façade,
// the calendar's date label and the storage fallback.

import { newGame, dispatch, advance, project, saveGame, loadGame, exportGame, importGame, resetGame } from '../js/rules/index.js';
import { dateLabel } from '../js/core/calendar.js';
import { memoryStorage } from '../js/core/save.js';

const storage = (() => { try { const s = window.localStorage; s.setItem('pa-probe', '1'); s.removeItem('pa-probe'); return s; } catch { return memoryStorage(); } })();
const UI_KEY = 'pa-v1-ui';
const ACTS = { wac: 'WAC at White Sands', 'aerobee-viking': 'Aerobee and Viking', 'vanguard-explorer': 'Vanguard and Explorer', 'nasa-formation': 'NASA formation' };
const VIEWS = [['mail', 'Mail'], ['programmes', 'Programmes'], ['engineering', 'Engineering'], ['flights', 'Test and flight'], ['production', 'Production and stores'], ['site', 'Site and funds'], ['records', 'Records']];

// ---- game and interface state ----
let game, view, notice = null;
const prefs = (() => { try { return JSON.parse(storage.getItem(UI_KEY)) ?? {}; } catch { return {}; } })();
const THEMES = [['ledger', 'Ledger (dark)'], ['ledger-light', 'Ledger (light)'], ['dossier', 'Dossier'], ['console', 'Console'], ['blueprint', 'Blueprint']];
const queryTheme = new URLSearchParams(location.search).get('theme');
const ui = { view: 'mail', mailId: null, seen: new Set(prefs.seen ?? []), open: new Set(), confirmReset: false,
  theme: [queryTheme, prefs.theme].find(t => THEMES.some(([k]) => k === t)) ?? 'ledger' };
const persistUi = () => storage.setItem(UI_KEY, JSON.stringify({ seen: [...ui.seen], theme: ui.theme }));
// The dossier look lives in style.css; every other theme is a small override file loaded on top.
const applyTheme = () => {
  document.getElementById('theme-link')?.remove();
  if (ui.theme !== 'dossier') document.head.append(Object.assign(document.createElement('link'), { id: 'theme-link', rel: 'stylesheet', href: `ui/themes/${ui.theme}.css` }));
};

const refresh = () => { view = project(game); };
// After anything new arrives, open the newest unread decision, else the newest unread item.
const selectNew = () => { const fresh = view.inbox.filter(i => !ui.seen.has(i.id)); const next = fresh.find(i => i.kind === 'decision') ?? fresh[0]; if (next) ui.mailId = next.id; };
const persist = () => { try { saveGame(game, storage); } catch { say('This browser would not keep the save. Export it to be safe.', true); } };

let counter = 0;
const uid = p => `${p}-${Date.now().toString(36)}-${++counter}`;

// ---- messages to the player ----
const say = (text, isError = false) => {
  notice = { text, isError };
  const region = document.getElementById(isError ? 'alert' : 'status');
  region.textContent = '';
  setTimeout(() => { region.textContent = text; }, 30);
};

// ---- commands ----
const send = (type, actor, payload = {}) => {
  const r = dispatch(game, { id: uid('c'), type, actor, payload });
  if (r.rejection) { say(r.rejection.reason, true); render(); return null; }
  game = r.state; refresh(); persist(); selectNew();
  return r;
};
// Run a chain of commands; stop at the first that is rejected or that raises a decision instead of acting.
const chain = (steps, done) => {
  const out = [];
  for (const step of steps) {
    const r = send(...step(out));
    if (!r) return;
    if (r.result?.decision) { say('That needs your decision. See Mail.'); render(); return; }
    out.push(r.result);
  }
  say(done); render();
};
const act = (type, actor, payload, done) => { const r = send(type, actor, payload); if (r) { say(r.result?.decision ? 'Raised for your decision. See Mail.' : done); render(); } };

const step = (days, untilMail = false) => {
  let events = 0, n = 0;
  const limit = untilMail ? 366 : days;
  while (n < limit && !view.concluded) {
    const r = advance(game, 1); game = r.state; refresh(); n++; events += r.events.length;
    if (untilMail && events) break;
  }
  persist(); selectNew();
  say(view.concluded ? 'The campaign has concluded. The summary is ready.' : `${view.date}. ${events ? `${events} new item${events === 1 ? '' : 's'} in Mail.` : 'Nothing new in Mail.'}`);
  if (view.concluded) ui.view = 'summary';
  render();
};

// ---- small DOM helpers ----
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat(Infinity).filter(k => k != null && k !== false));
  return el;
};
const money = n => `$${Math.round(n).toLocaleString('en-US')}`;
const words = s => String(s ?? '').replace(/[-_.|]/g, ' ');
const cap = s => words(s).replace(/^./, c => c.toUpperCase());
const day = d => dateLabel(d);
const subject = t => (t.length > 70 ? `${t.slice(0, 67)}…` : t);

// A collapsible form. `fields`: { name, label, type, value, options: [[value, label]], required }.
const formBox = (key, summary, fields, submitLabel, onSubmit, { primary = false } = {}) => {
  const form = h('form', { novalidate: true, onsubmit: e => {
    e.preventDefault();
    const values = {};
    for (const f of fields) {
      const el = form.elements[f.name];
      values[f.name] = f.type === 'checkbox' ? el.checked : f.type === 'number' ? Number(el.value) : el.value.trim();
    }
    const missing = fields.find(f => f.required && values[f.name] === '');
    if (missing) { say(`${missing.label} is needed.`, true); return; }
    onSubmit(values);
  } },
  fields.map(f => {
    const control = f.options ? h('select', { name: f.name, id: `${key}-${f.name}` }, f.options.map(([v, l]) => h('option', { value: v, selected: v === f.value }, l)))
      : f.type === 'textarea' ? h('textarea', { name: f.name, id: `${key}-${f.name}`, rows: 2, cols: 40 }, f.value ?? '')
      : h('input', { name: f.name, id: `${key}-${f.name}`, type: f.type ?? 'text', value: f.type === 'checkbox' ? null : f.value ?? '', checked: f.type === 'checkbox' && f.value, min: f.min });
    return f.type === 'checkbox' ? h('label', {}, control, ' ', f.label) : h('label', { for: control.id }, h('span', {}, f.label), control);
  }),
  h('button', { type: 'submit', class: primary ? 'primary' : '' }, submitLabel));
  return h('details', { open: ui.open.has(key), ontoggle: e => { e.target.open ? ui.open.add(key) : ui.open.delete(key); } },
    h('summary', { 'data-key': `fb-${key}` }, summary), form);
};
const button = (label, onclick, { key, primary, danger, disabled } = {}) =>
  h('button', { type: 'button', onclick, 'data-key': key, class: [primary && 'primary', danger && 'danger'].filter(Boolean).join(' '), disabled }, label);

const stance = p => !p ? null : h('div', { class: 'position' },
  h('span', { class: `stamp ${p.stance === 'veto' ? 'veto' : 'approve'}` }, p.stance === 'veto' ? 'Veto' : cap(p.stance)), ' ', p.reason);

// ---- mail ----
// A report that cites a test links to its readings in Records.
const readingsLink = jobId => {
  const j = jobId && view.workload.find(x => x.id === jobId);
  return j && j.observations > 0 ? button('See the readings in Records', () => { ui.openJob = jobId; go('records'); document.querySelector(`[data-key="rec-${jobId}"]`)?.scrollIntoView(); }, { key: `readings-${jobId}` }) : null;
};
const jobLabel = j => `${cap(j.kind)}${j.subject ? ` of ${j.subject}` : ''}${j.programmeId ? `, ${programmeName(j.programmeId)}` : ''}, started ${day(j.started)}`;
const mailView = () => {
  const items = view.inbox;
  const current = items.find(i => i.id === ui.mailId) ?? items[0] ?? null;
  if (current) { ui.mailId = current.id; if (!ui.seen.has(current.id)) { ui.seen.add(current.id); persistUi(); } }
  const list = h('ul', { 'aria-label': 'Inbox' }, items.map(i => h('li', {},
    h('button', { type: 'button', class: `mail-row${ui.seen.has(i.id) ? '' : ' unread'}`, 'data-key': `mail-${i.id}`,
      'aria-current': i === current ? 'true' : null, onclick: () => { ui.mailId = i.id; render(); } },
    h('span', { class: 'from' }, `${i.kind === 'decision' ? 'For decision · ' : ''}${cap(i.from)} · ${day(i.day)}`), h('span', { class: 'subject' }, subject(i.text))))));
  const pane = !current ? h('p', { class: 'muted' }, 'Nothing in the inbox. Advance the calendar to receive mail.') : h('article', { class: 'letter', 'aria-label': 'Selected message' },
    h('div', { class: 'head' }, `From: ${cap(current.from)} · ${day(current.day)} · ${cap(current.kind)}`),
    h('p', {}, current.text),
    readingsLink(current.refs?.job),
    current.kind === 'decision' && [
      current.positions && h('div', { class: 'positions' },
        h('div', {}, h('h4', {}, 'Financial officer'), stance(current.positions.finance)),
        h('div', {}, h('h4', {}, 'Technical director'), stance(current.positions.technical))),
      h('div', { class: 'actions', role: 'group', 'aria-label': 'Your decision' }, current.options.map((o, n) =>
        button(cap(o), () => act('decide', 'administrator', { decisionId: current.id, choice: o }, `Decided: ${words(o)}.`), { primary: n === 0, key: `opt-${o}` }))),
    ]);
  return h('div', {}, h('h2', {}, 'Mail'), h('div', { class: 'mail' }, h('div', {}, list), pane));
};

// ---- programmes ----
const STAGE_TEXT = { feasibility: 'Proposal', investigation: 'Investigation', dossier: 'Awaiting preliminary decision', preliminary: 'Preliminary acceptance', greenlit: 'Greenlit', closing: 'Closing', closed: 'Closed', lapsed: 'Window lapsed' };
const MATERIAL = ['destination', 'funding-ceiling', 'deadline', 'partner-terms'], ROUTINE = ['resequence', 'meeting', 'calendar'];

const programmeActions = p => {
  const id = p.id, k = `p-${id}`;
  switch (p.stage) {
    case 'feasibility': return [button('Authorise feasibility work', () => act('authorise-feasibility', 'administrator', { programmeId: id }, `Feasibility work authorised for ${p.name}.`), { key: `${k}-feas`, primary: true })];
    case 'investigation': {
      const ready = p.cases.engineering && p.cases.funding && p.meeting;
      return [
        h('ul', {},
          h('li', {}, 'Engineering case: ', p.cases.engineering ? p.cases.engineering.summary : 'not yet'),
          h('li', {}, 'Funding case: ', p.cases.funding ? p.cases.funding.summary : 'not yet'),
          h('li', {}, 'Client meeting: ', p.meeting ? `${money(p.meeting.cost)}, ${p.meeting.timeline}` : 'not yet')),
        formBox(`${k}-eng`, 'Record the engineering case', [{ name: 'summary', label: 'Summary', required: true }], 'Technical director files it', v => act('complete-case', 'technical-director', { programmeId: id, summary: v.summary }, 'Engineering case filed.')),
        formBox(`${k}-fin`, 'Record the funding case', [{ name: 'summary', label: 'Summary', required: true }], 'Financial officer files it', v => act('complete-case', 'financial-officer', { programmeId: id, summary: v.summary }, 'Funding case filed.')),
        formBox(`${k}-meet`, 'Record the client meeting', [
          { name: 'cost', label: 'Estimated cost ($)', type: 'number', value: 300000, min: 0 }, { name: 'contribution', label: 'Client contribution', required: true },
          { name: 'timeline', label: 'Timeline', required: true }, { name: 'requirements', label: 'Requirements', required: true }], 'Record meeting', v => act('record-meeting', 'administrator', { programmeId: id, ...v }, 'Meeting recorded.')),
        button('Submit dossier', () => act('submit-dossier', 'administrator', { programmeId: id }, 'Dossier submitted.'), { key: `${k}-dossier`, primary: ready, disabled: !ready }),
      ];
    }
    case 'dossier': return [h('p', { class: 'muted' }, 'The dossier is awaiting your decision in Mail.')];
    case 'preliminary': return [
      h('p', {}, `Greenlight window closes ${day(p.window.closes)}.`),
      button('Request greenlight', () => act('request-greenlight', 'administrator', { programmeId: id }, 'Greenlight raised for your decision.'), { key: `${k}-gl`, primary: true }),
      formBox(`${k}-ext`, 'Extend the window', [{ name: 'question', label: 'Question to answer', required: true }, { name: 'resources', label: 'Resources', required: true }, { name: 'days', label: 'Days', type: 'number', value: 30, min: 1 }],
        'Extend', v => act('extend-window', 'administrator', { programmeId: id, ...v }, 'Window extended.')),
    ];
    case 'greenlit': return [
      formBox(`${k}-chg`, 'Request a change', [{ name: 'kind', label: 'Kind', options: [...ROUTINE, ...MATERIAL].map(c => [c, cap(c)]) }, { name: 'detail', label: 'Detail', required: true }],
        'Request', v => act('request-change', 'administrator', { programmeId: id, kind: v.kind, detail: v.detail }, 'Change recorded or raised.')),
      formBox(`${k}-stop`, 'Recommend stopping', [{ name: 'reason', label: 'Reason', required: true }], 'Project manager recommends stop',
        v => act('recommend-stop', 'project-manager', { programmeId: id, reason: v.reason }, 'Stop recommendation raised for your decision.')),
    ];
    case 'closing': return closureView(p);
    default: return [];
  }
};

const OWNER_ACTOR = o => o; // closure step owners are role names and act as themselves
const closureView = p => [
  h('h4', {}, 'Closure steps'),
  h('ul', {}, p.closure.steps.map(s => h('li', {}, `${cap(s.id)} (${cap(s.owner)}): `, s.done ? `done${s.output ? `, ${s.output}` : ''}` :
    formBox(`cl-${p.id}-${s.id}`, 'Complete', [{ name: 'output', label: 'Output', required: true }], `Complete as ${cap(s.owner)}`,
      v => act('complete-closure-step', OWNER_ACTOR(s.owner), { programmeId: p.id, step: s.id, output: v.output }, `${cap(s.id)} done.`))))),
  h('h4', {}, `Unresolved obligations (${p.closure.unresolved.length})`),
  h('ul', {}, p.closure.unresolved.map(o => h('li', {}, `${cap(o.kind)} ${o.id}${o.amount ? ` ${o.amount}` : ''} `,
    button('Fund under financial officer', () => act('resolve-obligation', 'financial-officer', { programmeId: p.id, obligationId: o.id, owner: 'financial-officer', funded: true }, 'Obligation funded.'), { key: `ob-f-${o.id}` }), ' ',
    button('Discharged', () => act('resolve-obligation', 'financial-officer', { programmeId: p.id, obligationId: o.id, status: 'discharged' }, 'Obligation discharged.'), { key: `ob-d-${o.id}` }), ' ',
    button('Transferred', () => act('resolve-obligation', 'financial-officer', { programmeId: p.id, obligationId: o.id, status: 'transferred' }, 'Obligation transferred.'), { key: `ob-t-${o.id}` })))),
];

const programmesView = () => h('div', {}, h('h2', {}, 'Programmes'),
  view.programmes.map(p => h('section', { class: 'card', 'aria-labelledby': `h-${p.id}` },
    h('header', {}, h('h3', { id: `h-${p.id}` }, p.name), h('span', { class: 'stamp warn' }, STAGE_TEXT[p.stage] ?? p.stage),
      h('span', { class: 'meta' }, `${cap(p.source)}${p.client ? ` · ${p.client}` : ''}${p.vehicle ? ` · ${vehicleName(p.vehicle)}` : ''}${p.delegated ? ' · schedules its own routine work' : ''}`)),
    programmeActions(p),
    p.vehicle && p.stage === 'greenlit' && h('details', {}, h('summary', {}, 'Delegation conditions'), h('ul', {}, p.delegationConditions.map(c => h('li', {}, `${c.met ? 'Met' : 'Not met'}: ${c.detail}`)))),
    p.delegated && formBox(`${p.id}-dfail`, 'Report a failure beyond remit', [{ name: 'text', label: 'What went wrong', required: true }],
      'Technical director reports it', v => act('report-delegation-failure', 'technical-director', { programmeId: p.id, beyondRemit: true, text: v.text },
        'Failure recorded. One failure is an anecdote; delegation is withdrawn only on a pattern.')),
    h('details', {}, h('summary', {}, 'History'), h('ul', {}, p.history.map(e => h('li', {}, `${day(e.day)}: ${e.event}`)))))),
  proposalView(), staffView());

// Programme sources (freeze §8.1): administrator objectives and team initiatives. External requests arrive by mail.
const vehicleName = id => view.vehicles.find(v => v.id === id)?.name ?? cap(id);
const proposalView = () => h('section', { class: 'card' }, h('h3', {}, 'New proposals'),
  h('p', { class: 'muted' }, 'A proposal starts at feasibility and goes through the same four stages as an outside request.'),
  formBox('propose', 'Propose a programme', [
    { name: 'name', label: 'Name', required: true },
    { name: 'source', label: 'Source', options: [['administrator', 'Your objective'], ['department-head', 'A team initiative (department head)']] },
    { name: 'vehicle', label: 'Vehicle', options: [['', 'None yet'], ...view.vehicles.map(v => [v.id, v.name])] },
    { name: 'client', label: 'Client (optional)' }],
  'Propose', v => act('create-programme', v.source, { id: uid('prog'), name: v.name, vehicle: v.vehicle || null, client: v.client || null }, `${v.name} proposed.`)));

const staffView = () => {
  const greenlit = view.programmes.filter(p => p.stage === 'greenlit' && p.vehicle);
  return h('section', { class: 'card' }, h('h3', {}, 'Appointments'),
    h('p', { class: 'muted' }, 'A programme schedules its own routine work once it has two successful experimental flights, a project manager and a department head with scheduling remit.'),
    view.appointments.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Name', 'Role', 'Programme', 'Since', 'Status', 'Handover'].map(t => h('th', {}, t)))),
      h('tbody', {}, view.appointments.map(a => h('tr', {}, h('td', {}, a.person), h('td', {}, cap(a.role)), h('td', {}, a.programmeId ? programmeName(a.programmeId) : '—'), h('td', {}, day(a.day)), h('td', {}, cap(a.status)),
        h('td', {}, a.handover ? `Inherited ${a.handover.records} records (${Math.round(a.handover.retrievalQuality * 100)}% retrievable), ${a.handover.commitments.length} commitments, ${a.handover.concerns.length} open concerns` : '—')))))
      : h('p', { class: 'muted' }, 'Nobody appointed yet.'),
    formBox('appoint', 'Appoint someone', [
      { name: 'role', label: 'Role', options: [['project-manager', 'Project manager'], ['department-head', 'Department head']] },
      { name: 'person', label: 'Name', required: true },
      { name: 'programmeId', label: 'Programme', options: greenlit.map(p => [p.id, p.name]) },
      { name: 'scheduling', label: 'Department head holds routine scheduling remit', type: 'checkbox', value: true }],
    'Appoint', v => {
      if (!v.programmeId) { say('There is no greenlit programme to appoint to yet.', true); return; }
      act('appoint', 'administrator', { id: uid('appt'), role: v.role, person: v.person, programmeId: v.programmeId,
        remit: v.role === 'department-head' ? { programmes: [v.programmeId], scheduling: v.scheduling } : {} }, `${v.person} appointed.`);
    }));
};

// ---- engineering ----
const flightProgrammes = () => view.programmes.filter(p => p.vehicle && p.stage === 'greenlit');
const STATUS_TEXT = { 'measured-normal': 'Measured, normal', adverse: 'Adverse finding', unknown: 'Unknown', unmeasured: 'Not instrumented', lost: 'Reading lost' };

const engineeringView = () => {
  const hw = view.hardware.revisions;
  const pick = key => [{ name: 'programmeId', label: 'Programme', options: flightProgrammes().map(p => [p.id, p.name]) }];
  const needProgramme = (v, fn) => v.programmeId ? fn() : say('No greenlit programme has a vehicle yet.', true);
  return h('div', {}, h('h2', {}, 'Engineering'),
    h('div', { class: 'cols' },
      h('section', { class: 'card' }, h('h3', {}, 'What we know'),
        flightProgrammes().map(p => h('div', {}, h('h4', {}, p.name), h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Claim'), h('th', {}, 'Status'), h('th', { class: 'num' }, 'Tests'))),
          h('tbody', {}, p.claims.map(c => h('tr', {}, h('td', {}, c.name), h('td', {}, STATUS_TEXT[c.status] ?? c.status), h('td', { class: 'num' }, c.tests))))))),
        !flightProgrammes().length && h('p', { class: 'muted' }, 'No programme has a vehicle yet.')),
      h('section', { class: 'card' }, h('h3', {}, 'Open questions'),
        view.anomalies.length ? view.anomalies.map(a => h('div', {}, h('h4', {}, `${a.name} (${words(a.status)})`),
          h('ul', {}, a.hypotheses.map(x => h('li', {}, `${x.name}: ${words(x.status)}`))),
          a.proposedTests.length ? h('p', {}, 'Engineering proposes: ', a.proposedTests.map(t => `${words(t.stage)} ${t.conditions.burn} burn, reading ${t.channels.map(words).join(' and ')}`).join('; '), '.') : null))
          : h('p', { class: 'muted' }, 'No anomalies have appeared.'))),
    h('section', { class: 'card' }, h('h3', {}, 'Design revisions'),
      view.revisionCatalogue.map(r => {
        const st = hw[r.id];
        const state = !st ? 'Not proposed' : st.adoptedFor.some(x => x !== 'baseline') ? `Adopted for ${st.adoptedFor.join(', ')}` : st.trial ? 'Authorised for trial articles' : cap(st.status);
        return h('div', {}, h('h4', {}, `${r.label} — ${r.stageName}`), h('p', {}, `${state}. Changes: ${r.affects.map(words).join(', ') || 'nothing measured'}.`),
          !st && formBox(`rev-${r.id}`, 'Propose', [{ name: 'reason', label: 'Reason', required: true }], 'Department head proposes', v => act('propose-revision', 'department-head', { revId: r.id, reason: v.reason }, 'Proposal filed.')),
          st?.status === 'proposed' && formBox(`rev-${r.id}`, 'Approve for prototype', pick(), 'Technical director approves', v => needProgramme(v, () => act('approve-prototype', 'technical-director', { programmeId: v.programmeId, revId: r.id }, 'Prototype defined.'))),
          st?.status === 'defined' && !st.trial && formBox(`rev-${r.id}`, 'Request a trial', pick(), 'Department head requests', v => needProgramme(v, () => act('request-trial', 'department-head', { programmeId: v.programmeId, revId: r.id }, 'Trial raised for your decision.'))),
          st?.trial && formBox(`rev-${r.id}`, 'Adopt for future articles', pick(), 'Raise adoption', v => needProgramme(v, () => act('adopt-revision', 'administrator', { revId: r.id, programmeIds: [v.programmeId] }, 'Adoption raised for your decision.'))));
      })));
};

// ---- test and flight ----
const stagesOf = p => [...new Set(p.claims.map(c => c.quantity.split('.')[0]).filter(s => !s.includes('|') && s !== 'vehicle'))];
const nextArticleId = p => { let n = view.hardware.articles ? Object.keys(view.hardware.articles).length + 1 : 1; while (view.hardware.articles[`${p.id}-${n}`]) n++; return `${p.id}-${n}`; };

const groundTestForm = p => {
  const trial = view.revisionCatalogue.filter(r => view.hardware.revisions[r.id]?.status === 'defined' && stagesOf(p).includes(r.stage));
  const channels = stagesOf(p).flatMap(s => p.claims.filter(c => c.quantity.startsWith(`${s}.`)).map(c => ({ ...c, stage: s })));
  return formBox(`gt-${p.id}`, 'Schedule a ground test', [
    { name: 'stage', label: 'Stage', options: stagesOf(p).map(s => [s, cap(s)]) },
    { name: 'rev', label: 'Revision under test (overrides the stage)', options: [['', 'Current baseline'], ...trial.map(r => [r.id, r.label])] },
    { name: 'burn', label: 'Burn', options: [['short', 'Short'], ['long', 'Long']] },
    ...channels.map(c => ({ name: `ch:${c.quantity}`, label: `Instrument: ${c.name}`, type: 'checkbox', value: true }))],
  'Technical director schedules', v => {
    const rev = v.rev ? view.revisionCatalogue.find(r => r.id === v.rev) : null, stage = rev ? rev.stage : v.stage;
    const chosen = channels.filter(c => c.stage === stage && v[`ch:${c.quantity}`]).map(c => c.quantity);
    if (!chosen.length) { say('Choose at least one instrument on that stage.', true); return; }
    const jobId = uid('gt'), res = uid('res'), from = view.day;
    chain([
      () => ['reserve-facility', 'administrator', { id: res, unitId: 'stand-1', programmeId: p.id, from, to: from + 10, purpose: 'ground test' }],
      () => ['schedule-test', 'technical-director', { jobId, programmeId: p.id, stage, stages: rev ? { [stage]: rev.id } : {}, conditions: { burn: v.burn }, channels: chosen, reservation: res }],
    ], 'Ground test under way. Results arrive as it runs.');
  });
};

const buildForm = p => {
  const trial = view.revisionCatalogue.filter(r => view.hardware.revisions[r.id]?.trial && stagesOf(p).includes(r.stage));
  return formBox(`bld-${p.id}`, 'Build an article', [{ name: 'rev', label: 'Configuration', options: [['', 'Current baseline'], ...trial.map(r => [r.id, `Trial: ${r.label}`])] }],
    'Production builds', v => { const rev = trial.find(r => r.id === v.rev); act('build-article', 'production', { id: nextArticleId(p), programmeId: p.id, stages: rev ? { [rev.stage]: rev.id } : null }, 'Article built.'); });
};

const launchForm = a => formBox(`ln-${a.id}`, 'Request launch', [
  { name: 'cost', label: 'Cost of this flight ($)', type: 'number', value: 20000, min: 0 }, { name: 'replacementCost', label: 'Cost to replace the article ($)', type: 'number', value: 20000, min: 0 }],
'Request launch', v => {
  const id = uid('launch'), pad = uid('res'), trk = uid('res'), from = view.day;
  chain([
    () => ['reserve-facility', 'administrator', { id: pad, unitId: 'pad-1', programmeId: a.programmeId, from, to: from + 5, purpose: 'launch' }],
    () => ['reserve-facility', 'administrator', { id: trk, unitId: 'tracking-1', programmeId: a.programmeId, from, to: from + 5, purpose: 'tracking' }],
    () => ['request-launch', 'administrator', { id, articleId: a.id, pad, tracking: trk, cost: v.cost, replacementCost: v.replacementCost }],
  ], 'Launch raised for your decision.');
});

// Interrupted work (freeze §6.3): pausing is neither free nor a write-off. Tests run to completion.
const TESTS = ['ground-test', 'flight'];
const workControls = j => {
  if (j.status === 'running' && TESTS.includes(j.kind)) return h('span', { class: 'muted' }, 'A test runs to completion');
  if (j.status === 'running') return formBox(`pause-${j.id}`, 'Pause', [
    { name: 'preserve', label: `Fund preservation while paused (${money(view.preservationCostPerDay)} a day, billed on resuming)`, type: 'checkbox', value: true }],
  'Technical director pauses', v => act('pause-work', 'technical-director', { jobId: j.id, preserve: v.preserve }, 'Paused. The team\'s assessment is shown with it.'));
  if (j.status === 'paused') {
    const a = j.assessment;
    return h('div', {}, h('ul', {},
      h('li', {}, `Paused ${day(a.paused)}; ${a.completedPreserved} days of work preserved`),
      h('li', {}, `Materials ${a.materials}; records ${a.records}`),
      h('li', {}, a.reworkDays ? `${a.reworkDays} days of rework before it can continue` : 'No rework needed'),
      h('li', {}, a.preserve ? `Preservation so far: ${money((view.day - a.paused) * a.preservationCostPerDay)}` : 'Not preserved')),
    button('Resume', () => act('resume-work', 'technical-director', { jobId: j.id }, 'Resumed.'), { key: `resume-${j.id}`, primary: true }));
  }
  return null;
};

const flightsView = () => {
  const articles = Object.values(view.hardware.articles);
  return h('div', {}, h('h2', {}, 'Test and flight'),
    h('div', { class: 'cols' }, flightProgrammes().map(p => h('section', { class: 'card' }, h('h3', {}, p.name), buildForm(p), groundTestForm(p)))),
    !flightProgrammes().length && h('p', { class: 'muted' }, 'No programme has a vehicle yet.'),
    h('section', { class: 'card' }, h('h3', {}, 'Articles'),
      articles.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Article', 'Vehicle', 'Configuration', 'Status', ''].map(t => h('th', {}, t)))),
        h('tbody', {}, articles.map(a => h('tr', {}, h('td', {}, a.id), h('td', {}, cap(a.vehicle)), h('td', {}, Object.values(a.stages).map(words).join(', ')), h('td', {}, cap(a.status)),
          h('td', {}, a.status === 'built' && launchForm(a)))))) : h('p', { class: 'muted' }, 'Nothing built yet.')),
    h('section', { class: 'card' }, h('h3', {}, 'Work under way and finished'),
      view.workload.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Work', 'Status', 'Progress', 'Readings', ''].map(t => h('th', {}, t)))),
        h('tbody', {}, view.workload.slice().reverse().map(j => h('tr', {}, h('td', {}, jobLabel(j)), h('td', {}, j.result ? `${cap(j.status)} (${j.result})` : cap(j.status)),
          h('td', {}, h('progress', { max: j.total || 1, value: j.cursor, 'aria-label': `${jobLabel(j)} progress` }), ` ${j.cursor}/${j.total}`), h('td', { class: 'num' }, j.observations), h('td', {}, workControls(j)))))) : h('p', { class: 'muted' }, 'No work yet.')),
    h('section', { class: 'card' }, h('h3', {}, 'Launch record'),
      view.launches.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Launch', 'Article', 'Kind', 'Status', 'Outcome'].map(t => h('th', {}, t)))),
        h('tbody', {}, view.launches.map(l => h('tr', {}, h('td', {}, l.id), h('td', {}, l.articleId), h('td', {}, l.experimental ? 'Experimental' : 'Routine'), h('td', {}, cap(l.status)),
          h('td', {}, l.outcome ? `${cap(l.outcome)}${l.rangeAction ? ` (${l.rangeAction})` : ''}` : '—'))))) : h('p', { class: 'muted' }, 'Nothing has flown.')));
};

// ---- production and stores (freeze §5.4, §5.5, §7.6) ----
const programmeName = id => view.programmes.find(p => p.id === id)?.name ?? cap(id);
const FINDING_SOURCES = ['manufacture', 'inspection', 'acceptance', 'test', 'operation'];
const hypothesisOptions = () => {
  const seen = new Map();
  for (const a of view.anomalies) for (const x of a.hypotheses) seen.set(x.id, x.name);
  return [['', 'No suspected cause'], ...seen];
};

const articleActions = a => {
  const k = `art-${a.id}`, usable = a.status === 'built' || a.status === 'stored';
  const others = view.programmes.filter(p => p.vehicle === a.vehicle && p.id !== a.programmeId && p.stage === 'greenlit');
  return [
    a.status !== 'recycled' && formBox(`${k}-find`, 'Record a finding', [
      { name: 'source', label: 'Found during', options: FINDING_SOURCES.map(x => [x, cap(x)]) },
      { name: 'note', label: 'What was found', required: true },
      { name: 'hypothesis', label: 'Suspected cause', options: hypothesisOptions() }],
    'Production records it', v => act('record-finding', 'production', { source: v.source, articleId: a.id, note: v.note, hypothesis: v.hypothesis || null }, 'Finding recorded and sent to engineering.')),
    a.status === 'built' && button('Store', () => act('store-article', 'production', { articleId: a.id }, `${a.id} stored.`), { key: `${k}-store` }),
    usable && others.length > 0 && formBox(`${k}-reuse`, 'Reuse for another programme', [{ name: 'programmeId', label: 'Programme', options: others.map(p => [p.id, p.name]) }],
      'Start integration assessment', v => {
        const res = uid('res'), from = view.day;
        chain([
          () => ['reserve-facility', 'administrator', { id: res, unitId: 'integration-1', programmeId: v.programmeId, from, to: from + 10, purpose: 'integration assessment' }],
          () => ['reuse-article', 'production', { jobId: uid('reuse'), articleId: a.id, programmeId: v.programmeId, reservation: res }],
        ], 'Integration assessment under way. The article keeps its evidence but gains no new qualification.');
      }),
    usable && button('Recycle', () => act('recycle-article', 'production', { jobId: uid('recycle'), articleId: a.id }, 'Recycling under way. It recovers material by its own yield.'), { key: `${k}-recycle` }),
  ];
};

const stockActions = it => {
  const free = it.qty - Object.values(it.reserved).reduce((n, q) => n + q, 0);
  const progs = view.programmes.filter(p => p.vehicle && p.stage === 'greenlit' && it.compatible.includes(p.vehicle));
  if (!progs.length) return h('span', { class: 'muted' }, 'No compatible programme');
  const fields = [{ name: 'programmeId', label: 'Programme', options: progs.map(p => [p.id, p.name]) }, { name: 'qty', label: 'Quantity', type: 'number', value: Math.min(1, it.qty), min: 0 }];
  return [
    formBox(`stk-r-${it.id}`, 'Reserve', fields, 'Department head reserves', v => act('reserve-stock', 'department-head', { itemId: it.id, programmeId: v.programmeId, qty: v.qty }, 'Reserved, or raised for your decision if it is already spoken for.')),
    formBox(`stk-u-${it.id}`, 'Use', fields, 'Production uses it', v => act('consume-stock', 'production', { itemId: it.id, programmeId: v.programmeId, qty: v.qty, vehicle: view.programmes.find(p => p.id === v.programmeId)?.vehicle }, `Used. ${free} was unreserved before this.`)),
  ];
};

const orderForm = () => {
  const progs = view.programmes.filter(p => p.vehicle && p.stage !== 'closed');
  return formBox('order', 'Order materials', [
    { name: 'dept', label: 'Ordering department', options: [['engineering', 'Engineering'], ['production', 'Production'], ['administration', 'Administration']] },
    { name: 'programmeId', label: 'Bought for', options: [['', 'The agency generally'], ...progs.map(p => [p.id, p.name])] },
    { name: 'material', label: 'Material', required: true },
    { name: 'qty', label: 'Quantity', type: 'number', value: 10, min: 1 },
    ...view.vehicles.map(v => ({ name: `fit:${v.id}`, label: `Fits ${v.name}`, type: 'checkbox', value: true })),
    { name: 'deposit', label: 'Deposit on order ($)', type: 'number', value: 5000, min: 0 },
    { name: 'balance', label: 'Balance on delivery ($)', type: 'number', value: 15000, min: 0 },
    { name: 'days', label: 'Days to delivery', type: 'number', value: 60, min: 1 },
    { name: 'cancellable', label: 'Undelivered payments can be cancelled', type: 'checkbox', value: true },
    { name: 'cancelFee', label: 'Cancellation fee ($)', type: 'number', value: 0, min: 0 }],
  'Department head commits', v => {
    const compatible = view.vehicles.filter(x => v[`fit:${x.id}`]).map(x => x.id);
    if (!compatible.length) { say('Say which vehicles the material fits.', true); return; }
    const delivers = { material: v.material, qty: v.qty, compatible };
    const payments = [...(v.deposit ? [{ amount: v.deposit, due: view.day }] : []), { amount: v.balance, due: view.day + v.days, delivers }];
    act('commit-funds', 'department-head', { id: uid('order'), dept: v.dept, programmeId: v.programmeId || null, kind: 'materials', payments, terms: { cancellable: v.cancellable, cancelFee: v.cancelFee } },
      'Order committed, or raised for decision if it is consequential. Stock arrives when the delivery is paid.');
  });
};

const productionView = () => {
  const articles = Object.values(view.hardware.articles), batches = Object.values(view.hardware.batches);
  return h('div', {}, h('h2', {}, 'Production and stores'),
    h('div', { class: 'cols' },
      h('section', { class: 'card' }, h('h3', {}, 'Batches'),
        batches.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Batch', 'Vehicle', 'Articles', 'Status', ''].map(t => h('th', {}, t)))),
          h('tbody', {}, batches.map(b => h('tr', {}, h('td', {}, b.id), h('td', {}, vehicleName(b.vehicle)), h('td', { class: 'num' }, b.articles.length), h('td', {}, b.held ? 'On hold' : 'Open'),
            h('td', {}, b.held ? button('Release', () => act('release-batch', 'production', { batchId: b.id }, `${b.id} released.`), { key: `rel-${b.id}` })
              : formBox(`hold-${b.id}`, 'Hold', [{ name: 'reason', label: 'Reason', required: true }], 'Production holds it', v => act('hold-batch', 'production', { batchId: b.id, reason: v.reason }, `${b.id} on hold. An early memo has gone out.`)))))))
          : h('p', { class: 'muted' }, 'Nothing built yet, so no batches.')),
      h('section', { class: 'card' }, h('h3', {}, 'Findings'),
        view.findings.length ? h('ul', {}, view.findings.slice().reverse().map(f => h('li', {}, `${day(f.day)}, ${f.articleId} (${f.batchId}), ${words(f.source)}: ${f.note}${f.hypothesis ? `. Suspected: ${hypothesisOptions().find(([id]) => id === f.hypothesis)?.[1] ?? words(f.hypothesis)}` : ''}`)))
          : h('p', { class: 'muted' }, 'No findings recorded. A recurring defect in one batch comes to you as a decision.'))),
    h('section', { class: 'card' }, h('h3', {}, 'Articles and disposition'),
      articles.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Article', 'Programme', 'Batch', 'Status', ''].map(t => h('th', {}, t)))),
        h('tbody', {}, articles.map(a => h('tr', {}, h('td', {}, a.id), h('td', {}, programmeName(a.programmeId), a.reusedFrom ? ` (from ${programmeName(a.reusedFrom)})` : ''), h('td', {}, a.batchId), h('td', {}, cap(a.status)), h('td', {}, articleActions(a))))))
        : h('p', { class: 'muted' }, 'Nothing built yet.')),
    h('section', { class: 'card' }, h('h3', {}, 'Agency stores'),
      h('p', { class: 'muted' }, 'Materials belong to the agency. Programmes reserve them; they do not own them.'),
      view.stock.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Material', 'Held', 'Unreserved', 'Reserved for', 'Fits', 'Bought by', ''].map(t => h('th', {}, t)))),
        h('tbody', {}, view.stock.map(it => {
          const reserved = Object.entries(it.reserved), free = it.qty - reserved.reduce((n, [, q]) => n + q, 0), from = it.provenance ?? {};
          return h('tr', {}, h('td', {}, it.material), h('td', { class: 'num' }, fmt(it.qty)), h('td', { class: 'num' }, fmt(free)),
            h('td', {}, reserved.length ? reserved.map(([pid, q]) => `${programmeName(pid)} ${fmt(q)}`).join(', ') : '—'), h('td', {}, it.compatible.map(vehicleName).join(', ')),
            h('td', {}, from.recycledFrom ? `Recycled from ${from.recycledFrom}` : from.programmeId ? programmeName(from.programmeId) : from.commitmentId ? 'The agency' : '—'), h('td', {}, stockActions(it)));
        }))) : h('p', { class: 'muted' }, 'The stores are empty. Ordered materials arrive when their delivery payment is made.'),
      orderForm()));
};

// ---- site and funds ----
const siteView = () => {
  const f = view.fiscal, open = e => e.status === 'open' || e.status === 'overdue';
  return h('div', {}, h('h2', {}, 'Site and funds'),
    h('div', { class: 'cols' },
      h('section', { class: 'card' }, h('h3', {}, `Fiscal ${f.fy}`),
        h('table', {}, h('tbody', {}, [['Annual award', f.award], ['Cash held', f.cash], ['Capacity remaining this year', f.capacityRemaining], ['Already owed in this quarter', f.protectedBaseline], ['Available to commit', f.available]]
          .map(([k, v]) => h('tr', {}, h('th', { scope: 'row' }, k), h('td', { class: 'num' }, money(v)))))),
        f.conditions.length > 0 && [h('h4', {}, 'Award conditions'), h('ul', {}, f.conditions.map(c => h('li', {}, `${c.fy}: ${c.text} — ${c.honoured ? 'honoured' : 'missed'}`)))]),
      h('section', { class: 'card' }, h('h3', {}, 'Recovery exposures'),
        h('p', { class: 'muted' }, 'What a failed flight would leave us needing. Stated and recorded, never charged.'),
        f.exposures.length ? h('ul', {}, f.exposures.slice().reverse().map(x => h('li', {}, `${day(x.day)}, ${x.launchId}: ${x.text} Replacement ${money(x.replacementCost)}. ${cap(x.status)}.`)))
          : h('p', { class: 'muted' }, 'No launch has carried an exposure yet.'))),
    h('section', { class: 'card' }, h('h3', {}, 'Facilities'),
        h('table', {}, h('thead', {}, h('tr', {}, ['Unit', 'Kind', 'Capacity', 'Status', ''].map(t => h('th', {}, t)))),
          h('tbody', {}, view.facilities.map(u => h('tr', {}, h('td', {}, u.id), h('td', {}, kindName(u.kind)), h('td', { class: 'num' }, u.capacity), h('td', {}, facilityStatus(u)), h('td', {}, facilityActions(u)))))),
        newFacilityForm()),
    h('section', { class: 'card' }, h('h3', {}, 'Reservations'),
      view.calendar.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Unit', 'Programme', 'From', 'To', 'Purpose', 'Status'].map(t => h('th', {}, t)))),
        h('tbody', {}, view.calendar.slice(-15).map(r => h('tr', {}, h('td', {}, r.unitId), h('td', {}, cap(r.programmeId)), h('td', {}, day(r.from)), h('td', {}, day(r.to)), h('td', {}, r.purpose), h('td', {}, cap(r.status)))))) : h('p', { class: 'muted' }, 'Nothing reserved.')),
    commitmentsView(),
    h('section', { class: 'card' }, h('h3', {}, 'Open obligations'),
      f.ledger.filter(open).length ? h('table', {}, h('thead', {}, h('tr', {}, ['Due', 'Programme', 'Kind', 'Status', 'Amount'].map(t => h('th', {}, t)))),
        h('tbody', {}, f.ledger.filter(open).map(e => h('tr', {}, h('td', {}, day(e.due)), h('td', {}, cap(e.programmeId ?? e.dept)), h('td', {}, cap(e.kind)), h('td', {}, cap(e.status)), h('td', { class: 'num' }, money(e.amount)))))) : h('p', { class: 'muted' }, 'Nothing owed.')),
    h('section', { class: 'card' }, h('h3', {}, 'Year-end retention'),
        f.retentions.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Year', 'Unspent', 'Continuing commitments', 'Savings', 'Proposed use', 'Retained'].map(t => h('th', {}, t)))),
          h('tbody', {}, f.retentions.map(r => h('tr', {}, h('td', {}, r.fy), h('td', { class: 'num' }, money(r.unspent)), h('td', { class: 'num' }, money(r.continuing)), h('td', { class: 'num' }, money(r.savings)), h('td', {}, r.proposedUse), h('td', { class: 'num' }, money(r.granted))))))
          : h('p', { class: 'muted' }, 'No fiscal year has closed yet. Finance negotiates retention with a documented case at each year end.')));
};

// Facilities (freeze §6.1, §6.4): existence is not readiness; an upgrading unit is out of service until done.
const kindName = id => view.facilityKinds.find(k => k.id === id)?.name ?? cap(id);
const facilityStatus = u => u.status === 'upgrading' ? `Upgrading, out of service (capacity ${u.capacity} to ${u.capacityAfter})` : u.status === 'commissioning' ? 'Being commissioned, not yet usable' : cap(u.status);
const facilityActions = u => u.status !== 'operational' ? null : formBox(`upg-${u.id}`,
  view.facilities.filter(x => x.kind === u.kind && x.status === 'operational').length === 1 ? 'Upgrade (our only one in service)' : 'Upgrade', [{ name: 'capacityAfter', label: 'Capacity afterwards', type: 'number', value: u.capacity + 1, min: 1 }],
  'Technical director starts it', v => act('begin-upgrade', 'technical-director', { jobId: uid('upgrade'), unitId: u.id, capacityAfter: v.capacityAfter }, `${u.id} taken out of service for its upgrade. The benefit arrives when the work finishes.`));
const newFacilityForm = () => formBox('newfac', 'Build a new facility', [
  { name: 'kind', label: 'Kind', options: view.facilityKinds.map(k => [k.id, `${k.name}${k.exclusive ? ' (exclusive)' : ' (shared)'}`]) },
  { name: 'capacity', label: 'Capacity', type: 'number', value: 1, min: 1 }],
'Commission it', v => {
  let n = view.facilities.filter(u => u.kind === v.kind).length + 1;
  while (view.facilities.some(u => u.id === `${v.kind}-${n}`)) n++;
  act('add-facility', 'administrator', { jobId: uid('commission'), id: `${v.kind}-${n}`, kind: v.kind, capacity: v.capacity }, `${kindName(v.kind)} ${v.kind}-${n} is being commissioned. It cannot be reserved until that is done.`);
});

// Commitments (freeze §7.2, §7.7): cancellation stops avoidable payments under the terms; nothing paid comes back.
const commitmentsView = () => {
  const cs = view.fiscal.commitments, entry = id => view.fiscal.ledger.find(e => e.id === id);
  return h('section', { class: 'card' }, h('h3', {}, 'Commitments'),
    cs.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Commitment', 'Department', 'Programme', 'Total', 'Paid', 'Outstanding', 'Terms', 'Status', ''].map(t => h('th', {}, t)))),
      h('tbody', {}, cs.slice().reverse().map(c => {
        const es = c.entries.map(entry), paid = es.filter(e => e.status === 'paid').reduce((n, e) => n + e.amount, 0), owed = es.filter(e => e.status === 'open' || e.status === 'overdue').reduce((n, e) => n + e.amount, 0);
        return h('tr', {}, h('td', {}, c.id), h('td', {}, cap(c.dept)), h('td', {}, c.programmeId ? programmeName(c.programmeId) : '—'), h('td', { class: 'num' }, money(c.total)), h('td', { class: 'num' }, money(paid)), h('td', { class: 'num' }, money(owed)),
          h('td', {}, c.terms.cancellable ? `Cancellable${c.terms.cancelFee ? `, fee ${money(c.terms.cancelFee)}` : ''}` : 'Not cancellable'), h('td', {}, cap(c.status)),
          h('td', {}, c.status === 'active' && owed > 0 && button('Cancel', () => {
            const r = send('cancel-commitment', 'financial-officer', { commitmentId: c.id });
            if (r) { say(`Cancelled. ${r.result.stopped} payment${r.result.stopped === 1 ? '' : 's'} stopped, ${r.result.remaining} still owed, ${money(r.result.paid)} already paid and not refunded.`); render(); }
          }, { key: `cancel-${c.id}`, danger: true })));
      }))) : h('p', { class: 'muted' }, 'No commitments yet. Orders placed under Production and stores appear here.'));
};

// ---- records (freeze §3.3, §10.2): who decided what, when, on what evidence; and the readings behind it ----
const READING = { measured: 'Measured', unmeasured: 'Not instrumented', lost: 'Reading lost' };
const quantityNames = () => new Map(view.programmes.flatMap(p => p.claims.map(c => [c.quantity, c.name])));
const recordsView = () => {
  const closed = view.decisions.filter(d => d.status !== 'open').slice().reverse(), names = quantityNames();
  const jobs = view.workload.filter(j => j.observations > 0).slice().reverse();
  return h('div', {}, h('h2', {}, 'Records'),
    h('section', { class: 'card' }, h('h3', {}, 'Decision record'),
      closed.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Decided', 'Raised by', 'Question', 'Positions', 'Evidence cited', 'Decision'].map(t => h('th', {}, t)))),
        h('tbody', {}, closed.map(d => h('tr', {}, h('td', {}, day(d.decidedDay)), h('td', {}, `${cap(d.raisedBy)}, ${day(d.day)}`), h('td', {}, d.text),
          h('td', {}, d.positions ? [['Finance', d.positions.finance], ['Technical', d.positions.technical]].filter(([, x]) => x).map(([w, x]) => `${w}: ${x.stance}, ${x.reason}`).join('; ') : '—'),
          h('td', {}, d.evidence.length ? d.evidence.join(', ') : '—'), h('td', {}, `${cap(d.choice)} by ${words(d.decidedBy)}${d.consequence ? `. ${d.consequence}` : ''}`)))))
        : h('p', { class: 'muted' }, 'No decisions taken yet. Open ones wait in Mail.')),
    h('section', { class: 'card' }, h('h3', {}, 'Readings by test'),
      h('p', { class: 'muted' }, 'Every reading as recorded. Nothing here is new evidence; consulting a record does not repeat a test.'),
      jobs.length ? jobs.map(j => h('details', { open: ui.openJob === j.id, ontoggle: e => { if (!e.target.open && ui.openJob === j.id) ui.openJob = null; } }, h('summary', { 'data-key': `rec-${j.id}` }, `${jobLabel(j)}: ${j.observations} reading${j.observations === 1 ? '' : 's'}${j.result ? `, ${j.result}` : ''}`),
        h('table', {}, h('thead', {}, h('tr', {}, ['Day', 'Quantity', 'Configuration', 'Conditions', 'Reading', 'Value'].map(t => h('th', {}, t)))),
          h('tbody', {}, view.evidence.filter(o => o.workId === j.id).map(o => h('tr', {}, h('td', {}, day(o.day)), h('td', {}, names.get(o.quantity) ?? words(o.quantity)),
            h('td', {}, Object.values(o.stages).map(words).join(', ')), h('td', {}, Object.entries(o.conditions).map(([k, v]) => `${k} ${v}`).join(', ')),
            h('td', {}, READING[o.state] ?? cap(o.state)), h('td', { class: 'num' }, o.state === 'measured' ? `${o.value}${o.normal ? '' : ' (outside normal)'}` : 'no value')))))))
        : h('p', { class: 'muted' }, 'No test has produced readings yet.')));
};

// ---- summary (freeze §8.8): six sections; the sixth lists what successors inherit ----
const fmt = v => v === true ? 'yes' : v === false ? 'no' : typeof v === 'number' ? v.toLocaleString('en-US') : v == null ? '—' : String(v);
const value = v => Array.isArray(v) ? (v.length ? h('ul', {}, v.map(x => h('li', {}, typeof x === 'object' ? Object.entries(x).map(([k, y]) => `${words(k)}: ${Array.isArray(y) ? y.length : fmt(y)}`).join(', ') : words(x)))) : 'none') : fmt(v);
const listOr = (items, empty, line) => items.length ? h('ul', {}, items.map(x => h('li', {}, line(x)))) : h('p', { class: 'muted' }, empty);
const openQuestionsView = q => [
  h('p', { class: 'muted' }, 'What NASA inherits from our records.'),
  h('h4', {}, 'Readiness restrictions still open'),
  listOr(q.readinessRestrictions, 'None.', r => `${programmeName(r.programmeId)}: ${r.restrictions.join('; ')}`),
  h('h4', {}, 'Obligations not yet settled'),
  listOr(q.unsettledObligations, 'None.', o => `${cap(o.kind)}${o.amount != null ? ` of ${money(o.amount)}` : ''}${o.due != null ? ` due ${day(o.due)}` : ''}${o.programmeId ? ` for ${programmeName(o.programmeId)}` : ''}, owner ${o.owner ? words(o.owner) : 'not named'} (${words(o.status)})`),
  h('h4', {}, 'Disagreements left on the record'),
  listOr(q.disagreements, 'None.', d => [d.text, d.vetoes.length ? ` Objections: ${d.vetoes.map(v => `${words(v.who)}, ${v.reason}`).join('; ')}.` : '']),
  h('h4', {}, 'Claims still untested or unsupported'),
  listOr(q.untestedClaims, 'None.', c => `${programmeName(c.programmeId)}: ${quantityNames().get(c.quantity) ?? words(c.quantity)}, ${(STATUS_TEXT[c.status] ?? words(c.status)).toLowerCase()}`),
];
const summaryView = () => {
  const s = view.summary;
  return h('div', { class: 'summary' }, h('h2', {}, 'NASA formation: where we stand'), h('p', { class: 'muted' }, `The campaign concluded on ${day(s.day)}. This is a record, not a score.`),
    s.sections.map((sec, n) => h('section', { class: 'card', 'aria-labelledby': `sum-${sec.id}` }, h('h3', { id: `sum-${sec.id}` }, `${n + 1}. ${sec.title}`),
      sec.placeholder ? h('p', { class: 'placeholder' }, 'Reserved. The content for this section has not been designed yet.')
        : sec.id === 'open-questions' ? openQuestionsView(sec.items)
        : sec.id === 'narrative' ? sec.items.map(p => h('div', {}, h('h4', {}, `${p.name} — ${words(p.stage)}`), h('ul', {}, p.history.map(e => h('li', {}, `${day(e.day)}: ${e.event}`)))))
        : h('dl', {}, Object.entries(sec.items).flatMap(([k, v]) => [h('dt', {}, cap(k.replace(/([A-Z])/g, ' $1').toLowerCase())), h('dd', {}, value(v))])))));
};

// ---- shell ----
const render = () => {
  const focusKey = document.activeElement?.dataset?.key;
  const app = document.getElementById('app');
  const views = view.summary ? [...VIEWS, ['summary', 'Summary']] : VIEWS;
  if (!views.some(([k]) => k === ui.view)) ui.view = 'mail';
  const body = { mail: mailView, programmes: programmesView, engineering: engineeringView, flights: flightsView, production: productionView, site: siteView, records: recordsView, summary: summaryView }[ui.view]();
  const unread = view.inbox.filter(i => !ui.seen.has(i.id)).length;
  const off = view.concluded;
  app.replaceChildren(h('div', { class: 'case' },
    h('header', { class: 'bar' }, h('h1', {}, 'Per Aspera'), h('span', { class: 'date' }, view.date), h('span', { class: 'meta' }, `${ACTS[view.act]} · available ${money(view.fiscal.available)}`),
      h('label', { class: 'theme' }, h('span', { class: 'sr-only' }, 'Theme'), h('select', { 'data-key': 'theme', 'aria-label': 'Theme', onchange: e => { ui.theme = e.target.value; applyTheme(); persistUi(); render(); } },
        THEMES.map(([k, l]) => h('option', { value: k, selected: k === ui.theme }, `Theme: ${l}`)))),
      h('div', { class: 'controls', role: 'group', 'aria-label': 'Calendar' },
        button('Next day', () => step(1), { key: 'adv-1', disabled: off }), button('One week', () => step(7), { key: 'adv-7', disabled: off }),
        button('One month', () => step(30), { key: 'adv-30', disabled: off }), button('To next mail', () => step(0, true), { key: 'adv-mail', primary: true, disabled: off }))),
    h('nav', { class: 'tabs', 'aria-label': 'Sections' }, views.map(([k, label], n) =>
      h('button', { type: 'button', 'data-key': `tab-${k}`, 'aria-current': k === ui.view ? 'page' : null, onclick: () => go(k) }, label, k === 'mail' && unread ? h('span', { class: 'badge', 'aria-label': `${unread} unread` }, unread) : null))),
    h('main', { id: 'main', tabindex: '-1' }, notice?.isError ? h('p', { class: 'stamp veto', 'aria-hidden': 'true' }, notice.text) : notice ? h('p', { class: 'muted', 'aria-hidden': 'true' }, notice.text) : null, body),
    h('footer', { class: 'keys' }, h('details', {}, h('summary', {}, 'Keyboard, saves and settings'),
      h('p', {}, h('kbd', {}, '1'), '–', h('kbd', {}, String(views.length)), ' switch section · ', h('kbd', {}, 'j'), '/', h('kbd', {}, 'k'), ' next and previous mail · ', h('kbd', {}, 'n'), ' advance to next mail. Tab and Enter work everywhere.'),
      h('div', { class: 'actions' },
        button('Export save', exportFile, { key: 'save-export' }), button('Import save', () => document.getElementById('import-file').click(), { key: 'save-import' }),
        h('input', { id: 'import-file', type: 'file', accept: '.json,application/json', class: 'sr-only', 'aria-label': 'Choose a save file', onchange: importFile }),
        ui.confirmReset ? [h('span', {}, 'Start over and lose this campaign?'), button('Yes, start over', startOver, { danger: true, key: 'reset-yes' }), button('Keep playing', () => { ui.confirmReset = false; render(); }, { key: 'reset-no' })]
          : button('New game', () => { ui.confirmReset = true; render(); setTimeout(() => document.querySelector('[data-key="reset-no"]')?.focus(), 0); }, { key: 'reset-new', danger: true }))))));
  const target = focusKey && document.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
  if (target) target.focus();
};

const go = k => { ui.view = k; notice = null; render(); document.getElementById('main').focus(); };

const exportFile = () => {
  const a = h('a', { href: URL.createObjectURL(new Blob([exportGame(game)], { type: 'application/json' })), download: `per-aspera-${view.date.replace(/ /g, '-')}.json` });
  a.click(); URL.revokeObjectURL(a.href); say('Save exported.');
};
const importFile = async e => {
  const file = e.target.files[0]; if (!file) return;
  try { importGame(storage, await file.text()); game = loadGame(storage); refresh(); ui.mailId = null; say(`Loaded the save from ${view.date}.`); }
  catch (err) { say(err.message, true); }
  render();
};
const startOver = () => {
  resetGame(storage); ui.seen.clear(); persistUi(); ui.mailId = null; ui.confirmReset = false; ui.view = 'mail';
  game = newGame(); refresh(); persist(); say('A new campaign begins on 1 January 1945.'); render();
};

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const views = view.summary ? [...VIEWS, ['summary']] : VIEWS;
  if (/^[1-9]$/.test(e.key) && views[Number(e.key) - 1]) { go(views[Number(e.key) - 1][0]); return; }
  if (e.key === 'n' && !view.concluded) { step(0, true); return; }
  if ((e.key === 'j' || e.key === 'k') && ui.view === 'mail') {
    const ids = view.inbox.map(i => i.id), at = ids.indexOf(ui.mailId), next = ids[at + (e.key === 'j' ? 1 : -1)];
    if (next) { ui.mailId = next; render(); document.querySelector(`[data-key="mail-${next}"]`)?.focus(); }
  }
});

try { game = loadGame(storage); } catch (err) { game = null; setTimeout(() => say(`${err.message} Starting a new campaign.`, true), 0); }
if (!game) { game = newGame(); persist(); }
refresh(); applyTheme();
if (view.summary) ui.view = 'summary';
render();
