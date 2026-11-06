// V2-01 (V2 freeze §3, §12): both openings, the read-only V1 import, and what V2 adds to either.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, continueFromV1, project, advance, exportGame, checkSave } from '../js/rules/index.js';
import { parseV1Save, memoryStorage, KEYS } from '../js/core/save.js';
import { dateLabel, dayOf } from '../js/core/calendar.js';
import { inferTraits, questionItems } from '../js/rules/opening.js';
import { v1Concluded } from './v1-fixture.js';
import { assertNoLeak } from './game.js';

const openItems = s => project(s).inherited.filter(i => i.status === 'open');

test('V2-01 fresh: the standard 1958 agency loads on 1 October 1958 with heads, NACA laboratories and live inherited items', () => {
  const s = newGame();
  const v = project(s);
  assert.equal(v.date, '1 October 1958');
  assert.equal(v.opening.kind, 'fresh');
  assert.deepEqual(v.people.map(p => p.role), ['technical-director', 'financial-officer', 'department-head']);
  for (const id of ['pad-1', 'pad-2', 'stand-1', 'env-1', 'struct-1', 'tracking-1']) assert.equal(s.facilities.units[id].status, 'operational', id);
  assert.deepEqual(v.inherited.map(i => [i.kind, i.status]), [['obligation', 'open'], ['disagreement', 'open']]);
  // It is authored content, not a roll: every seed opens the same agency.
  const other = newGame(4);
  assert.deepEqual(project(other).inherited, v.inherited);
  assert.deepEqual(other.people, s.people);
  assertNoLeak(s);
});

test('V2-01 fresh: an inherited obligation is a live item that closes when it is paid', () => {
  let s = newGame();
  const item = project(s).inherited.find(i => i.kind === 'obligation');
  s = advance(s, dayOf(1959, 4, 2) - s.day).state;
  assert.equal(s.fiscal.ledger.find(e => e.id === item.refs.ledger).status, 'paid');
  assert.equal(project(s).inherited.find(i => i.id === item.id).status, 'closed');
});

test('V2-01 fresh: the Mercury programmes arrive in the first week', () => {
  const s = advance(newGame(), 7).state;
  assert.deepEqual(['mercury-redstone', 'mercury-atlas'].map(id => s.programmes[id]?.stage), ['feasibility', 'feasibility']);
  assert.ok(project(s).inbox.some(i => i.kind === 'proposal' && /Mercury suborbital/.test(i.text)));
});

test('V2-01 import: a V1 NASA-formation save continues with its restrictions, obligations, dissent and untested claims live', () => {
  const { state: v1, text } = v1Concluded();
  const s = continueFromV1(text);
  const v = project(s);
  assert.equal(v.date, dateLabel(v1.day));
  assert.equal(v.opening.kind, 'v1-import');
  assert.equal(s.concluded, false);
  // Everything V1 recorded is still there.
  assert.deepEqual(s.evidence.observations, v1.evidence.observations);
  assert.deepEqual(s.launches, v1.launches);
  assert.deepEqual(Object.keys(s.programmes), Object.keys(v1.programmes));
  // The sixth section arrives as one live item per entry, all open on the first day.
  const sixth = v1.continuation.summary.sections.find(x => x.id === 'open-questions').items;
  assert.equal(v.inherited.length, questionItems(sixth).length);
  assert.ok(v.inherited.length > 0, 'the fixture campaign leaves open questions');
  assert.deepEqual(openItems(s).length, v.inherited.length);
  // V1's summary is kept for the record; the V2 continuation starts empty.
  assert.deepEqual(v.opening.v1Summary, v1.continuation.summary);
  assert.deepEqual(s.continuation, { summary: null, hook: null });
  assertNoLeak(s);
});

test('V2-01 import: the V1 save is read, never changed, and its storage is untouched', () => {
  const { text } = v1Concluded();
  const storage = memoryStorage();
  storage.setItem('pa-v1', text);
  storage.setItem('pa-v1-last-good', text);
  const before = [...storage.keys()].map(k => [k, storage.getItem(k)]);
  const s = continueFromV1(storage.getItem('pa-v1'));
  advance(s, 30);
  assert.deepEqual([...storage.keys()].map(k => [k, storage.getItem(k)]), before);
  assert.equal(Object.values(KEYS).some(k => k.startsWith('pa-v1')), false);
});

test('V2-01 import: a V1 save that has not reached NASA formation, or at another version, is refused with a clear message', () => {
  const { text } = v1Concluded();
  const env = JSON.parse(text);
  const early = { ...env, state: { ...env.state, concluded: false, continuation: { summary: null, hook: null } } };
  assert.throws(() => parseV1Save(JSON.stringify(early)), /not reached NASA formation/);
  assert.throws(() => parseV1Save(JSON.stringify({ ...env, contentVersion: 3 })), /cannot be continued/);
  assert.throws(() => parseV1Save(JSON.stringify({ ...env, format: 'per-aspera-v2' })), /not a Per Aspera V1 save/);
  assert.throws(() => parseV1Save('{nope'), /not a readable save/);
  assert.throws(() => checkSave(text), /This is a V1 save/);
});

test('V2-01 import: V1 heads get hidden traits inferred from what the administrator did, and they never show', () => {
  const { state: v1, text } = v1Concluded();
  const s = continueFromV1(text);
  const accepted = v1.decisions.filter(d => d.type === 'failure-review' && d.choice === 'accept-known-risk').length;
  assert.ok(accepted > 0, 'the fixture accepted known risks');
  assert.ok(s.people['head-td'].traits.risk > 0.5, 'accepting known risks makes the heads more risk-tolerant');
  // A V1 record with nothing in it leaves the heads neutral.
  const blank = inferTraits({ decisions: [], launches: [], assurance: { challenges: [] }, staff: { proposals: [] }, delegation: { programmes: {} } });
  for (const t of Object.values(blank)) assert.deepEqual(t, { risk: 0.5, candour: 0.5, independence: 0.5 });
  const shown = JSON.stringify(project(s).people);
  assert.doesNotMatch(shown, /traits|risk|candour|independence/);
});

test('V2-01 import: the continued campaign saves in the V2 namespace and reloads identically', () => {
  const s = advance(continueFromV1(v1Concluded().text), 20).state;
  const back = checkSave(exportGame(s));
  assert.deepEqual(project(back), project(s));
  assert.equal(JSON.parse(exportGame(s)).format, 'per-aspera-v2');
});
