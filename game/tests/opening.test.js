// NASA formation (GAME-DESIGN §3.2, §17.0b): reached by a campaign played from 1945 or opened there with the
// standard 1958 agency, and saves from the two earlier builds carrying on in the one campaign.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, newGameAt1958, project, advance, exportGame, checkSave, loadGame, earlierSave } from '../js/rules/index.js';
import { memoryStorage } from '../js/core/save.js';
import { dateLabel, dayOf, NASA_DAY } from '../js/core/calendar.js';
import { inferTraits, questionItems } from '../js/rules/opening.js';
import { played, legacyV1 } from './played-1945.js';
import { assertNoLeak } from './game.js';

const openItems = s => project(s).inherited.filter(i => i.status === 'open');

test('fresh 1958: the standard agency loads on 1 October 1958 with heads, NACA laboratories and live inherited items', () => {
  const s = newGameAt1958();
  const v = project(s);
  assert.equal(v.date, '1 October 1958');
  assert.equal(v.opening.kind, 'fresh');
  assert.deepEqual(v.people.map(p => p.role), ['technical-director', 'financial-officer', 'department-head', 'retrofire-officer']);
  for (const id of ['pad-1', 'pad-2', 'stand-1', 'env-1', 'struct-1', 'tracking-1']) assert.equal(s.facilities.units[id].status, 'operational', id);
  assert.deepEqual(v.inherited.map(i => [i.kind, i.status]), [['obligation', 'open'], ['disagreement', 'open']]);
  // It is authored content, not a roll: every seed opens the same agency.
  const other = newGameAt1958(4);
  assert.deepEqual(project(other).inherited, v.inherited);
  assert.deepEqual(other.people, s.people);
  // Nothing from before 1958 arrives.
  assert.deepEqual(Object.keys(advance(s, 30).state.programmes).sort(), ['mercury-atlas', 'mercury-redstone']);
  assertNoLeak(s);
});

test('fresh 1958: an inherited obligation is a live item that closes when it is paid', () => {
  let s = newGameAt1958();
  const item = project(s).inherited.find(i => i.kind === 'obligation');
  s = advance(s, dayOf(1959, 4, 2) - s.day).state;
  assert.equal(s.fiscal.ledger.find(e => e.id === item.refs.ledger).status, 'paid');
  assert.equal(project(s).inherited.find(i => i.id === item.id).status, 'closed');
});

test('fresh 1958: the Mercury programmes arrive in the first week', () => {
  const s = advance(newGameAt1958(), 7).state;
  assert.deepEqual(['mercury-redstone', 'mercury-atlas'].map(id => s.programmes[id]?.stage), ['feasibility', 'feasibility']);
  assert.ok(project(s).inbox.some(i => i.kind === 'proposal' && /Mercury suborbital/.test(i.text)));
});

test('from 1945: the campaign starts at White Sands with no NASA people, crews or race yet', () => {
  const s = newGame();
  const v = project(s);
  assert.equal(v.date, '1 January 1945');
  assert.equal(v.opening.kind, '1945');
  assert.deepEqual(v.people, []);
  assert.deepEqual(v.inherited, []);
  assert.equal(s.facilities.units['env-1'], undefined);
  assertNoLeak(s);
});

test('from 1945: NASA formation is a milestone; everything recorded carries on and the open questions go live', () => {
  const { before, after: s } = played();
  const v = project(s);
  assert.equal(v.date, dateLabel(NASA_DAY));
  assert.equal(v.opening.kind, 'continued');
  assert.equal(s.concluded, false);
  // Everything recorded is still there.
  assert.deepEqual(s.evidence.observations.slice(0, before.evidence.observations.length), before.evidence.observations);
  assert.deepEqual(Object.keys(s.programmes), Object.keys(before.programmes));
  // The summary is kept as the milestone, and its sixth section arrives as one live item per entry.
  assert.deepEqual(v.opening.summary.sections.map(x => x.id).length, 6);
  const sixth = s.opening.summary.sections.find(x => x.id === 'open-questions').items;
  assert.equal(v.inherited.length, questionItems(sixth).length);
  assert.ok(v.inherited.length > 0, 'the played campaign leaves open questions');
  assert.equal(openItems(s).length, v.inherited.length);
  assert.deepEqual(s.continuation, { summary: null, hook: null });
  for (const id of ['env-1', 'struct-1']) assert.equal(s.facilities.units[id].status, 'operational', id);
  assert.ok(s.memos.some(m => m.refs?.opening === 'continued' && /carry forward everything/.test(m.text)));
  // The Mercury programmes arrive as they would in a 1958 start.
  const week = advance(s, 7).state;
  assert.deepEqual(['mercury-redstone', 'mercury-atlas'].map(id => week.programmes[id]?.stage), ['feasibility', 'feasibility']);
  assertNoLeak(s);
});

test('from 1945: the heads get hidden traits inferred from what the administrator did, and they never show', () => {
  const { after: s } = played();
  const accepted = s.decisions.filter(d => d.type === 'failure-review' && d.choice === 'accept-known-risk').length;
  assert.ok(accepted > 0, 'the played campaign accepted known risks');
  assert.ok(s.people['head-td'].traits.risk > 0.5, 'accepting known risks makes the heads more risk-tolerant');
  // A record with nothing in it leaves the heads neutral.
  const blank = inferTraits({ decisions: [], launches: [], assurance: { challenges: [] }, staff: { proposals: [] }, delegation: { programmes: {} } });
  for (const t of Object.values(blank)) assert.deepEqual(t, { risk: 0.5, candour: 0.5, independence: 0.5 });
  assert.doesNotMatch(JSON.stringify(project(s).people), /traits|risk|candour|independence/);
});

test('from 1945: the campaign saves across NASA formation and reloads identically', () => {
  const s = advance(played().after, 20).state;
  const back = checkSave(exportGame(s));
  assert.deepEqual(project(back), project(s));
  assert.equal(JSON.parse(exportGame(s)).format, 'per-aspera');
});

test('earlier saves: a 1945–1958 save that reached NASA formation carries on, with its records and open questions', () => {
  const text = legacyV1('v1-nasa');
  const old = JSON.parse(text).state;
  const s = checkSave(text);
  const v = project(s);
  assert.equal(v.opening.kind, 'continued');
  assert.equal(s.concluded, false);
  assert.deepEqual(s.evidence.observations, old.evidence.observations);
  assert.deepEqual(s.launches, old.launches);
  assert.deepEqual(v.opening.summary, old.continuation.summary);
  assert.equal(v.inherited.length, questionItems(old.continuation.summary.sections.find(x => x.id === 'open-questions').items).length);
  // It plays on into Mercury and saves in the new format.
  const on = advance(s, 7).state;
  assert.ok(on.programmes['mercury-redstone']);
  assert.deepEqual(project(checkSave(exportGame(on))), project(on));
  assertNoLeak(s);
});

test('earlier saves: a 1947 save carries on and reaches NASA formation in place', () => {
  const s = checkSave(legacyV1('v1-1947'));
  assert.equal(s.opening.kind, '1945');
  const at = advance(s, NASA_DAY - s.day).state;
  assert.equal(at.opening.kind, 'continued');
  assert.equal(at.concluded, false);
});

test('earlier saves: a Mercury and Gemini save carries on, and the earlier storage is only read', () => {
  const env = JSON.parse(exportGame(advance(newGameAt1958(), 10).state));
  const old = { ...env, format: 'per-aspera-v2', scenario: 'v2-1958-1966', state: { ...env.state, opening: { kind: 'fresh', day: env.state.opening.day } } };
  const storage = memoryStorage();
  storage.setItem('pa-v2', JSON.stringify(old));
  storage.setItem('pa-v1', legacyV1('v1-1947'));
  const before = [...storage.keys()].map(k => [k, storage.getItem(k)]);
  assert.equal(loadGame(storage), null);
  const offered = earlierSave(storage);
  assert.equal(offered.label, 'your Mercury and Gemini campaign');
  const s = checkSave(offered.text);
  assert.equal(project(s).opening.kind, 'fresh');
  assert.deepEqual([...storage.keys()].map(k => [k, storage.getItem(k)]), before);
});

test('earlier saves: one whose contents cannot be shown is refused with a clear message', () => {
  const env = JSON.parse(legacyV1('v1-nasa'));
  env.state.memos.push(null);
  assert.throws(() => checkSave(JSON.stringify(env)), /damaged/);
  assert.throws(() => checkSave(JSON.stringify({ ...env, contentVersion: 3 })), /not supported/);
});
