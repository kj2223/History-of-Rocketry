// Freeze gates FRZ-01–FRZ-10 (freeze §12), proven through the façade. Each test names its gate.
// FRZ-08 and FRZ-10 also have a UI half; it is checked here only once v1/ui exists (see the notes in those tests).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { project, checkSave, exportGame, saveGame, loadGame, newGame } from '../js/rules/index.js';
import { exportSave, memoryStorage, KEYS, CONTENT_VERSION, SCENARIO } from '../js/core/save.js';
import { dayOf, fiscalQuarter, END_DAY } from '../js/core/calendar.js';
import { capacityRemaining, protectedBaseline, available } from '../js/rules/fiscal.js';
import { LAUNCH_TIERS } from '../js/rules/authority.js';
import { PROGRAMMES } from '../js/data/scenario.js';
import { VEHICLES } from '../js/data/vehicles.js';
import { conditions } from '../js/rules/delegation.js';
import { claimStatus } from '../js/rules/evidence.js';
import { bareState, fire, bumper, flight, nominalFlights } from './helpers.js';
import { game, greenlightProgramme, groundTest, fly, book } from './game-1945.js';

const here = new URL('../', import.meta.url);
const sourceFiles = dir => existsSync(new URL(dir, here))
  ? readdirSync(new URL(dir, here)).filter(f => f.endsWith('.js')).map(f => [f, readFileSync(new URL(dir + f, here), 'utf8')]) : [];
const reload = s => checkSave(exportGame(s));

test('FRZ-01: v1 ends at NASA formation and nothing out of scope is playable', () => {
  const g = game(1);
  g.days(END_DAY + 50);
  assert.equal(g.state.day, END_DAY);
  assert.equal(g.state.concluded, true);
  assert.match(g.try('create-programme', 'administrator', { id: 'late', name: 'Late', vehicle: 'wac' }).rejection.reason, /concluded/);
  const content = JSON.stringify({ PROGRAMMES, VEHICLES }).toLowerCase();
  for (const word of ['mercury', 'gemini', 'apollo', 'lunar', 'astronaut', 'orbital-station']) assert.equal(content.includes(word), false, `content mentions ${word}`);
  assert.equal(Object.values(VEHICLES).some(v => v.crewed), false);
  assert.ok(PROGRAMMES.every(p => p.arrives < END_DAY), 'every programme arrives before NASA formation');
});

test('FRZ-02: only cv 4 loads; every other version, including future ones, is rejected with a message', () => {
  const s = newGame(2);
  assert.equal(CONTENT_VERSION, 4);
  const withCv = cv => JSON.stringify({ ...JSON.parse(exportSave(s)), contentVersion: cv });
  assert.doesNotThrow(() => checkSave(withCv(4)));
  for (const cv of [1, 2, 3]) assert.throws(() => checkSave(withCv(cv)), /not supported/, `cv ${cv}`);
  for (const cv of [5, 99]) assert.throws(() => checkSave(withCv(cv)), /newer version/, `cv ${cv}`);
  const storage = memoryStorage();
  saveGame(s, storage);
  assert.equal(JSON.parse(storage.getItem(KEYS.current)).contentVersion, 4, 'new saves are written at the current version');
  assert.deepEqual(loadGame(storage), JSON.parse(JSON.stringify(s)));
});

test('FRZ-03: quarterly capacity limits payments, the ledger holds commitments, the protected baseline works', () => {
  const g = game(3);
  const cap = capacityRemaining(g.state);
  // Limits payments, not commitments; the ledger carries the full commitment with due dates.
  g.cmd('commit-funds', 'department-head', { id: 'big', dept: 'engineering', payments: [{ amount: cap * 0.6, due: dayOf(1945, 5, 1) }, { amount: cap * 0.6, due: dayOf(1945, 6, 1) }] });
  assert.equal(g.state.fiscal.ledger.filter(e => e.commitmentId === 'big').length, 2);
  assert.equal(project(g.state).fiscal.ledger.filter(e => e.commitmentId === 'big').length, 2, 'the ledger is visible to the UI');
  // Case 1: two affordable orders whose combined payments exceed a release escalate.
  const g1 = game(3), room = available(g1.state), due = fiscalQuarter(g1.state.day).end;
  g1.cmd('commit-funds', 'department-head', { id: 'a', dept: 'propulsion', payments: [{ amount: room * 0.7, due }] });
  g1.cmd('commit-funds', 'department-head', { id: 'b', dept: 'instruments', payments: [{ amount: room * 0.7, due }] });
  assert.ok(g1.state.decisions.some(d => d.type === 'timing-conflict'));
  // Protected baseline: a paid protected invoice reduces funds and requirement once.
  const g2 = game(3);
  g2.cmd('commit-funds', 'department-head', { id: 'inv', dept: 'engineering', payments: [{ amount: 5000, due: g2.state.day + 3 }] });
  const [c0, p0, a0] = [capacityRemaining(g2.state), protectedBaseline(g2.state), available(g2.state)];
  g2.days(3);
  assert.deepEqual([capacityRemaining(g2.state), protectedBaseline(g2.state), available(g2.state)], [c0 - 5000, p0 - 5000, a0]);
  // Case 2: stock bought for one programme serves another; cash changes once.
  const g3 = game(3);
  g3.cmd('create-programme', 'administrator', { id: 'wac-2', name: 'Second series', vehicle: 'wac' });
  g3.cmd('commit-funds', 'department-head', { id: 'alcohol', dept: 'propulsion', programmeId: 'wac', payments: [{ amount: 8000, due: g3.state.day + 1, delivers: { material: 'alcohol', qty: 10, compatible: ['wac'] } }] });
  g3.days(1);
  const cash = g3.state.fiscal.cash, item = Object.values(g3.state.stock.items)[0];
  g3.cmd('reserve-stock', 'department-head', { itemId: item.id, programmeId: 'wac-2', qty: 4 });
  g3.cmd('consume-stock', 'department-head', { itemId: item.id, programmeId: 'wac-2', qty: 4, vehicle: 'wac' });
  assert.equal(g3.state.stock.items[item.id].qty, 6);
  assert.equal(g3.state.fiscal.cash, cash);
  // Case 3: cancellation stops avoidable work; supplier terms hold; sunk cost is not refunded.
  const g4 = game(3);
  g4.cmd('commit-funds', 'department-head', { id: 'motor', dept: 'propulsion', payments: [{ amount: 3000, due: g4.state.day + 1 }, { amount: 3000, due: g4.state.day + 40 }], terms: { cancellable: true, cancelFee: 500 } });
  g4.days(2);
  assert.deepEqual(g4.cmd('cancel-commitment', 'financial-officer', { commitmentId: 'motor' }), { stopped: 1, remaining: 1, paid: 3000 });
  // Case 5: the year closes with obligations and stock intact.
  const g5 = game(3);
  g5.cmd('commit-funds', 'department-head', { id: 'stock', dept: 'propulsion', programmeId: 'wac', payments: [{ amount: 2000, due: g5.state.day + 1, delivers: { material: 'steel', qty: 5, compatible: ['wac'] } }] });
  g5.approve(g5.cmd('commit-funds', 'department-head', { id: 'later', dept: 'propulsion', payments: [{ amount: 7000, due: dayOf(1945, 9, 1) }] }).decision);
  g5.until(1945, 6, 30);
  const open = JSON.stringify(g5.state.fiscal.ledger.filter(e => e.status === 'open' && e.commitmentId)), stock = JSON.stringify(g5.state.stock);
  g5.days(1);
  assert.equal(JSON.stringify(g5.state.fiscal.ledger.filter(e => e.status === 'open' && e.commitmentId)), open);
  assert.equal(JSON.stringify(g5.state.stock), stock);
  // Case 4 (failed mission: evidence, loss and replacement kept apart) is covered end to end by the seed search below.
  for (let seed = 1; seed < 200; seed++) {
    const f = game(seed);
    f.until(1946, 5, 17);
    greenlightProgramme(f, 'aerobee');
    f.cmd('build-article', 'production', { id: 'a1', programmeId: 'aerobee' });
    const l = fly(f, 'aerobee', 'a1', { cost: 20000, replacementCost: 40000 });
    if (l.outcome !== 'failure') continue;
    const d = f.state.decisions.find(x => x.type === 'replacement');
    assert.deepEqual(d.options, ['defer', 'fund-replacement', 'seek-supplementary']);
    assert.equal(f.state.hardware.articles.a1.status, 'lost', 'the loss is recorded apart from the evidence');
    assert.ok(f.state.evidence.observations.some(o => o.kind === 'flight'), 'useful evidence survives the loss');
    return;
  }
  assert.fail('no seed produced a failed flight');
});

test('FRZ-04: delegation needs all three conditions, and reverses only on repeated demonstrated failure', () => {
  let g;
  for (let seed = 1; seed < 100; seed++) {
    g = game(seed);
    let ok = true;
    for (let i = 0; i < 2 && ok; i++) { g.cmd('build-article', 'production', { id: `w${i}`, programmeId: 'wac' }); ok = fly(g, 'wac', `w${i}`).outcome === 'success'; }
    if (ok) break;
  }
  const active = () => g.state.delegation.programmes.wac?.active ?? false;
  assert.deepEqual(conditions(g.state, 'wac').map(c => c.met), [true, false, false]);
  g.cmd('appoint', 'administrator', { id: 'pm-1', role: 'project-manager', person: 'A', programmeId: 'wac' });
  g.days(1);
  assert.equal(active(), false, 'a project manager without the leadership remit is not enough');
  g.cmd('appoint', 'administrator', { id: 'head-1', role: 'department-head', person: 'B', remit: { programmes: ['wac'], scheduling: true } });
  g.days(1);
  assert.equal(active(), true);
  g.cmd('report-delegation-failure', 'technical-director', { programmeId: 'wac', beyondRemit: true, text: 'one anecdote' });
  assert.equal(active(), true);
  g.cmd('report-delegation-failure', 'technical-director', { programmeId: 'wac', beyondRemit: true, text: 'a second, beyond remit' });
  assert.equal(active(), false);
});

test('FRZ-05: closure needs a report and dispositions, and unresolved obligations stay visible', () => {
  const g = game(5);
  g.cmd('commit-funds', 'department-head', { id: 'motors', dept: 'propulsion', programmeId: 'wac', payments: [{ amount: 5000, due: g.state.day + 60 }], terms: { cancellable: false, cancelFee: 0 } });
  g.approve(g.cmd('recommend-stop', 'project-manager', { programmeId: 'wac', reason: 'superseded' }), 'stop');
  const p = () => g.state.programmes.wac;
  const steps = p().closure.steps.map(s => s.id);
  for (const needed of ['contract-settlements', 'hardware-disposition', 'records', 'closure-report']) assert.ok(steps.some(id => id.includes(needed.split('-')[0])), `a ${needed} step exists`);
  for (const s of p().closure.steps.filter(x => !x.done)) g.cmd('complete-closure-step', s.owner, { programmeId: 'wac', step: s.id, output: 'done' });
  assert.equal(p().stage, 'closing');
  assert.equal(project(g.state).programmes.find(x => x.id === 'wac').closure.unresolved.length > 0, true, 'the open obligation is visible in the projection');
  for (const o of p().closure.obligations) g.cmd('resolve-obligation', 'financial-officer', { programmeId: 'wac', obligationId: o.id, owner: 'finance', funded: true });
  assert.equal(p().stage, 'closed');
});

test('FRZ-06: ground tiers are exercised and the crew tier is present but inactive', () => {
  const g = game(6);
  g.until(1946, 5, 17);
  greenlightProgramme(g, 'aerobee');
  g.cmd('build-article', 'production', { id: 'a1', programmeId: 'aerobee' });
  const l = fly(g, 'aerobee', 'a1');
  assert.deepEqual(Object.keys(l.tiers), LAUNCH_TIERS.map(t => t.tier));
  const stances = Object.fromEntries(Object.entries(l.tiers).map(([k, v]) => [k, v.stance]));
  assert.equal(stances.flight, 'inactive');
  assert.ok(Object.entries(stances).filter(([k]) => k !== 'flight').every(([, s]) => s !== 'inactive'), 'every ground tier took a stance');
});

test('FRZ-07: the Tank Case is not canon: its structure is built, its numbers are absent', () => {
  // Structure: independent stage revisions, evidence kept for the untouched stage, interface and integrated re-assessed (§5.3).
  const s = nominalFlights([flight(bumper(), ['v2.chamber-pressure', 'v2|wac-upper.separation', 'vehicle.apogee'])]);
  const r2 = bumper('wac-upper/r2');
  assert.equal(claimStatus(s, r2, 'v2.chamber-pressure').status, 'measured-normal');
  assert.equal(claimStatus(s, r2, 'v2|wac-upper.separation').status, 'unknown');
  // Numbers: nothing in js/ names the Tank Case or its sources.
  for (const dir of ['js/data/', 'js/rules/', 'ui/']) for (const [f, src] of sourceFiles(dir)) assert.doesNotMatch(src, /tank[- ]case|TANK-CASE|tank-candidate|tank-test/i, `${dir}${f}`);
});

test('FRZ-08: projections are stable across reload and the rules never read presentation state', () => {
  const g = game(8);
  g.until(1946, 5, 17);
  greenlightProgramme(g, 'aerobee');
  groundTest(g, 'aerobee', 'short');
  assert.deepEqual(project(reload(g.state)), project(g.state));
  const before = JSON.stringify(g.state);
  project(g.state); project(g.state);
  assert.equal(JSON.stringify(g.state), before, 'projecting changes nothing');
  // UI half: ui/ may not draw randomness, read the physical layer, or reach past the façade.
  const ui = sourceFiles('ui/');
  if (!ui.length) return;
  for (const [f, src] of ui) {
    assert.doesNotMatch(src, /Math\.random|crypto\.getRandomValues|\.rng\b|\.physical\b|physical:/, `ui/${f} draws randomness or reads physical truth`);
    assert.doesNotMatch(src, /from ['"](\.\.\/)+(rules\/(?!index\.js)|data\/physical)/, `ui/${f} bypasses the façade`);
    assert.doesNotMatch(src, /\bstate\.(?!day\b)\w+(\.\w+)*\s*=[^=]/, `ui/${f} assigns into game state`);
  }
});

test('FRZ-09: V1 and legacy saves do not cross, and the legacy suite stays green', () => {
  const storage = memoryStorage();
  storage.setItem('vg3', 'legacy campaign');
  saveGame(newGame(9), storage);
  assert.equal(storage.getItem('vg3'), 'legacy campaign');
  assert.ok(Object.values(KEYS).every(k => k.startsWith('pa-v1')), 'v1 keys are in their own namespace');
  const legacyLooking = JSON.stringify({ format: 'vg3', version: 3, state: {} });
  assert.throws(() => checkSave(legacyLooking), /not a Per Aspera V1 save/);
  const fork = JSON.stringify({ ...JSON.parse(exportSave(newGame(9))), scenario: 'wac-slice' });
  assert.throws(() => checkSave(fork), /another scenario/);
  assert.equal(SCENARIO, 'v1-1945-1958');
  // V1 imports nothing from the legacy tree.
  for (const dir of ['js/core/', 'js/data/', 'js/rules/']) for (const [f, src] of sourceFiles(dir)) assert.doesNotMatch(src, /from ['"](\.\.\/){2,}js\//, `${dir}${f} reaches into legacy js`);
  // The legacy suite is run from the repository root, when it is present.
  const root = fileURLToPath(new URL('../../', import.meta.url));
  if (!existsSync(root + 'tests/rules.test.js')) return;
  const files = readdirSync(root + 'tests').filter(f => f.endsWith('.test.js')).map(f => 'tests/' + f);
  const r = spawnSync(process.execPath, ['--test', ...files], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, 'legacy suite failed:\n' + (r.stdout || '').split('\n').filter(l => /^not ok|^# (pass|fail)/.test(l)).join('\n'));
});

test('FRZ-10: the summary is a persisted six-section projection and the continuation hook is inert', () => {
  const g = game(10);
  g.days(END_DAY);
  const p = project(g.state);
  assert.equal(p.concluded, true);
  assert.deepEqual(p.summary.sections.map(s => s.id), ['technical', 'institutional', 'stewardship', 'political', 'narrative', 'open-questions']);
  assert.deepEqual(project(reload(g.state)).summary, p.summary, 'the summary persists');
  const { hook } = reload(g.state).continuation;
  assert.equal(hook.active, false);
  // Inert: nothing in the rules reads the hook.
  for (const [f, src] of sourceFiles('js/rules/')) if (f !== 'summary.js') assert.doesNotMatch(src, /continuation\.hook|\.hook\b/, `${f} reads the continuation hook`);
  // No new game state: the summary is not a score and does not alter the concluded state.
  assert.equal(g.try('decide', 'administrator', { decisionId: 'x', choice: 'approve' }).rejection.reason, 'The campaign has concluded');
  assert.ok(!('score' in p.summary) && !('grade' in p.summary));
  // UI half: the summary screen reads the projection, never the raw continuation or its hook.
  const ui = sourceFiles('ui/');
  if (!ui.length) return;
  const all = ui.map(([, src]) => src).join('\n');
  assert.match(all, /view\.summary/, 'a summary screen reads the projected summary');
  assert.doesNotMatch(all, /continuation|\.hook\b/, 'the UI does not touch the continuation hook');
});
