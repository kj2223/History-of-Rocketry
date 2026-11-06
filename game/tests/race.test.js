// V2 slice 4 (V2 freeze §4, §5, §8): missions and their scope, demonstrated capabilities, and the Soviet
// firsts with imperfect intelligence. Acceptance V2-03 (scope), V2-09 and V2-10.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGameAt1958 as newGame, dispatch, project } from '../js/rules/index.js';
import { raceDay } from '../js/rules/race.js';
import { planMission, scopeInFlight, recordCapabilities, cite, nextMission } from '../js/rules/mission.js';
import { runTest } from '../js/rules/physics.js';
import { addPerson } from '../js/rules/people.js';
import { SOVIET_ANCHORS } from '../js/data/race.js';
import { FLIGHT_CONDITIONS } from '../js/data/engineering.js';
import { START_DAY, END_DAY, dayOf } from '../js/core/calendar.js';
import { assertNoLeak } from './game.js';

const G1 = { 'titan-ii': 'titan-ii/glv-r2', gemini: 'gemini/r1' };

// Run only the race, day by day, from the opening to a given day.
const raceTo = (s, until) => { while (s.day < until) { s.day++; raceDay(s); } return s; };

test('V2-10: every Soviet first happens on its date, is reported, announced and recorded', () => {
  const s = raceTo(newGame(3), END_DAY);
  for (const a of SOVIET_ANCHORS) {
    const f = s.race.firsts.find(x => x.id === a.id);
    assert.equal(f.sovietDay, a.day, a.id);
    assert.ok(f.known);
    const mine = s.race.reports.filter(r => r.anchorId === a.id);
    const announcement = mine.find(r => r.kind === 'announcement'), report = mine.find(r => r.kind === 'report');
    assert.equal(announcement.day, a.day + a.announced);
    assert.ok(report.day >= a.day && report.day <= a.day + 3, `${a.id} reported on day ${report.day - a.day}`);
    assert.ok(mine.every(r => r.day >= a.day - 21));
  }
  assert.equal(s.race.pending.length, 0);
});

test('V2-10: intelligence can be partial, late or wrong; a bad report is revised later and the record links them', () => {
  let bad = 0, rumours = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const s = raceTo(newGame(seed), END_DAY);
    rumours += s.race.reports.filter(r => r.kind === 'rumour').length;
    for (const r of s.race.reports.filter(x => x.kind === 'report')) {
      const a = SOVIET_ANCHORS.find(x => x.id === r.anchorId);
      if (r.text === a.report) { assert.equal(r.revisedBy, undefined); continue; }
      bad++;
      assert.ok([a.partial, a.wrong].includes(r.text));
      const fix = s.race.reports.find(x => x.id === r.revisedBy);
      assert.equal(fix.kind, 'revision');
      assert.equal(fix.revises, r.id);
      assert.equal(fix.text, a.report);
      assert.ok(fix.day > r.day);
    }
  }
  assert.ok(bad > 5, `${bad} partial or wrong reports in six campaigns`);
  assert.ok(rumours > 3, `${rumours} rumours`);
});

test('V2-10: what intelligence has not yet delivered stays out of the projection, and so does a first nobody has heard of', () => {
  const vostok = SOVIET_ANCHORS.find(a => a.id === 'luna-3');
  const s = raceTo(newGame(3), vostok.day);
  assert.ok(s.race.pending.length > 0);
  const v = project(s);
  assert.ok(!v.race.firsts.some(f => f.id === 'luna-3'), 'the far-side pictures were not yet announced or reported');
  for (const p of s.race.pending) assert.equal(v.race.reports.some(r => r.text === p.text && r.anchorId === p.anchorId && r.kind === p.kind), false);
  assert.doesNotMatch(JSON.stringify(v.race), /pending/);
  assertNoLeak(s);
});

test('§8: who was first follows what actually happened; an unmatched first brings political pressure, never a decision', () => {
  const gagarin = SOVIET_ANCHORS.find(a => a.id === 'vostok-1');
  const lagging = raceTo(newGame(3), gagarin.day - 1);
  const award = lagging.fiscal.award, decisions = lagging.decisions.length;
  raceDay(Object.assign(lagging, { day: gagarin.day }));
  assert.equal(lagging.race.firsts.find(f => f.id === 'vostok-1').firstBy, 'soviet');
  assert.ok(lagging.fiscal.award > award, 'Congress adds money');
  assert.equal(lagging.decisions.length, decisions, 'no decision is forced');
  // An agency that had already flown a crew in orbit is recorded as first, and the anchor still happens.
  const ahead = raceTo(newGame(3), gagarin.day - 1);
  ahead.capabilities.push({ id: 'cap-x', kind: 'orbit', status: 'demonstrated', vehicle: 'mercury-atlas', stages: {}, conditions: { crew: 1 }, launchId: 'L', day: gagarin.day - 30, evidence: [], unresolved: [] });
  const before = ahead.fiscal.award;
  raceDay(Object.assign(ahead, { day: gagarin.day }));
  const f = ahead.race.firsts.find(x => x.id === 'vostok-1');
  assert.deepEqual([f.firstBy, f.agencyDay], ['agency', gagarin.day - 30]);
  assert.equal(ahead.fiscal.award, before);
});

test('§5: a mission is checked against what the vehicle can do', () => {
  assert.throws(() => planMission('mercury-atlas', { eva: true }), /cannot attempt eva/);
  assert.throws(() => planMission('gemini-titan', { docking: true }), /needs a rendezvous/);
  assert.throws(() => planMission('gemini-titan', { days: 30 }), /up to 14 days/);
  assert.deepEqual(planMission('gemini-titan', { days: 8, eva: true }), { days: 8, eva: true, rendezvous: false, docking: false });
  assert.equal(planMission('atlas-icbm'), null);
});

test('§5: the hidden truth shows in objective readings: the first spacecraft overworks a spacewalker and its fuel cells sag on long flights', () => {
  const read = (stages, mission) => {
    const s = newGame(8);
    runTest(s, 'k', { kind: 'flight', vehicle: 'gemini-titan', stages, conditions: { ...FLIGHT_CONDITIONS }, mission });
    return Object.fromEntries(s.physical.traces.k.filter(x => x.objective).map(x => [x.quantity, x.value]));
  };
  const first = read(G1, { days: 8, eva: true, rendezvous: true, docking: true });
  assert.ok(first['gemini.eva-workload'] > 1 && first['gemini.fuel-cell-output'] < 0.8);
  assert.ok(first['gemini.rendezvous-error'] < 3);
  const fixed = read({ 'titan-ii': 'titan-ii/glv-r2', gemini: 'gemini/r3' }, { days: 8, eva: true });
  assert.ok(fixed['gemini.eva-workload'] < 1 && fixed['gemini.fuel-cell-output'] > 0.8);
  assert.deepEqual(Object.keys(read(G1, { days: 1 })), [], 'a one-day flight attempts nothing');
});

// A Gemini flight in progress, for scope questions.
const inFlight = (seed = 4) => {
  const s = newGame(seed);
  for (const [id, risk] of [['c1', 0.9], ['c2', 0.9]]) addPerson(s, { id, name: id.toUpperCase(), role: 'astronaut', kind: 'crew', traits: { risk, candour: 0.5, independence: 0.5 } });
  const l = { id: 'L1', articleId: 'A1', vehicle: 'gemini-titan', stages: { ...G1 }, status: 'in-flight', crew: ['c1', 'c2'], mission: planMission('gemini-titan', { days: 8 }), jobId: 'j' };
  s.launches.push(l);
  return { s, l };
};
const reading = (s, quantity, value) => { const o = { id: `obs-${s.evidence.observations.length + 1}`, quantity, value, state: 'measured', normal: false }; s.evidence.observations.push(o); return o; };

test('V2-03: crew scope advice is advice: with time and two supportable options only the administrator decides, and may decline it', () => {
  const { s, l } = inFlight();
  const cuts = [];
  scopeInFlight(s, l, null, [reading(s, 'gemini.fuel-cell-output', 0.7)], (_, x) => cuts.push(x));
  const d = s.decisions.find(x => x.type === 'mission-scope');
  assert.deepEqual([d.status, d.owner, d.options], ['open', 'administrator', ['cut-short', 'continue']]);
  assert.equal(d.positions.crew.stance, 'advice');
  assert.equal(cuts.length, 0);
  for (const actor of ['flight-control', 'crew', 'technical-director']) {
    const r = dispatch(s, { id: `x-${actor}`, type: 'decide', actor, payload: { decisionId: d.id, choice: 'continue' } });
    assert.ok(r.rejection, `${actor} cannot decide the scope`);
  }
  // Whatever the crew advised, the administrator may choose either option.
  const r = dispatch(s, { id: 'x-admin', type: 'decide', actor: 'administrator', payload: { decisionId: d.id, choice: 'continue' } });
  assert.equal(r.state.decisions.find(x => x.id === d.id).choice, 'continue');
  assert.equal(r.state.launches.find(x => x.id === 'L1').mission.cut, undefined);
});

test('V2-03: when only one option is supportable, or there is no time, Flight Control decides and the crew\'s advice is recorded', () => {
  const { s, l } = inFlight();
  const cuts = [];
  scopeInFlight(s, l, null, [reading(s, 'gemini.fuel-cell-output', 0.4), reading(s, 'gemini.eva-workload', 1.4)], (_, x) => cuts.push(x));
  const [power, eva] = s.decisions.filter(x => x.type === 'mission-scope');
  assert.deepEqual([power.status, power.decidedBy, power.choice], ['closed', 'flight-control', 'cut-short']);
  assert.deepEqual(cuts, [{ launchId: 'L1' }]);
  assert.deepEqual([eva.decidedBy, eva.choice], ['flight-control', 'end-spacewalk']);
  assert.match(power.positions.crew.reason, /C1 advises/);
  assert.equal(l.scope.length, 2);
  assert.ok(l.scope.every(x => x.advice.length === 2));
});

test('V2-09: capabilities are recorded with their configuration, conditions and unresolved issues, and never certify another configuration', () => {
  const s = newGame(5);
  const obs = [
    { id: 'o1', quantity: 'gemini.eva-workload', state: 'measured', value: 1.3, normal: false },
    { id: 'o2', quantity: 'gemini.fuel-cell-output', state: 'measured', value: 0.92, normal: true },
  ];
  const l = { id: 'L2', vehicle: 'gemini-titan', stages: { ...G1 }, crew: ['a', 'b'], outcome: 'success', mission: planMission('gemini-titan', { days: 4, eva: true }), entry: { contact: true, capsuleRecovered: true } };
  const caps = recordCapabilities(s, l, obs);
  assert.deepEqual(caps.map(c => [c.kind, c.status]), [['orbital-recovery', 'demonstrated'], ['orbit', 'demonstrated'], ['multi-crew', 'demonstrated'], ['duration', 'demonstrated'], ['eva', 'attempted']]);
  const eva = caps.find(c => c.kind === 'eva'), duration = caps.find(c => c.kind === 'duration');
  assert.match(eva.unresolved.join(), /spacewalk workload was outside normal limits/);
  assert.deepEqual([duration.conditions.days, duration.conditions.crew, duration.stages.gemini], [4, 2, 'gemini/r1']);
  // A later spacecraft revision is not certified by the earlier flight's record.
  const r3 = { vehicle: 'gemini-titan', stages: { ...G1, gemini: 'gemini/r3' } };
  assert.equal(cite(s, 'duration', { vehicle: 'gemini-titan', stages: G1 }).status, 'demonstrated');
  assert.equal(cite(s, 'duration', r3).status, 'demonstrated on another configuration only');
  assert.equal(cite(s, 'eva', r3).status, 'unproven');
  // The planners still have the spacewalk to do.
  assert.deepEqual(nextMission(s, 'gemini-titan'), { days: 4, eva: true });
  // A flight that did not come home demonstrates nothing.
  assert.deepEqual(recordCapabilities(s, { ...l, id: 'L3', entry: { contact: false } }, obs), []);
  assert.deepEqual(project(s).capabilities.length, 5);
});

test('§8: the agency records its own firsts where nothing Soviet compares', () => {
  const s = raceTo(newGame(5), dayOf(1965, 12, 1));
  const l = { id: 'L4', vehicle: 'gemini-titan', stages: { ...G1 }, crew: ['a', 'b'], outcome: 'success', mission: planMission('gemini-titan', { days: 1, rendezvous: true }), entry: { contact: true, capsuleRecovered: true } };
  recordCapabilities(s, l, [{ id: 'o3', quantity: 'gemini.rendezvous-error', state: 'measured', value: 1.2, normal: true }]);
  const f = project(s).race.firsts.find(x => x.id === 'agency-rendezvous');
  assert.deepEqual([f.firstBy, f.agencyDay], ['agency', s.day]);
  assert.ok(START_DAY < s.day);
});
