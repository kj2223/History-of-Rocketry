// Staff behaviour carried from V1 into V2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextStep } from '../js/rules/staff.js';
import { mercuryRedstone } from './game.js';

// Ported from V1 (cc012ee).
test('a team does not ask for the pad while an unaccepted finding would make the technical director veto it', () => {
  const g = mercuryRedstone();
  const p = g.state.programmes['mercury-redstone'], stages = { ...p.baseline };
  // Pretend the stand and chamber work is done and a flight came back off course: the deviation finding is open.
  for (const [quantity, value] of [['redstone.chamber-pressure', 22], ['mercury-capsule.cabin-pressure', 0.38]])
    for (const burn of ['short', 'long'])
      g.state.evidence.observations.push({ id: `x-${quantity}-${burn}`, day: 0, workId: `w-${quantity}-${burn}`, kind: 'ground', vehicle: 'mercury-redstone', stages, conditions: { burn }, quantity, state: 'measured', value, normal: true });
  assert.equal(nextStep(g.state, p).kind, 'fly');
  g.state.evidence.observations.push({ id: 'x-dev', day: 0, workId: 'w-f', kind: 'flight', vehicle: 'mercury-redstone', stages, conditions: { burn: 'long' }, quantity: 'vehicle.deviation', state: 'measured', value: 9, normal: false });
  assert.notEqual(nextStep(g.state, p).kind, 'fly');
  g.state.beliefs.assessed = ['x-dev'];
  assert.equal(nextStep(g.state, p).kind, 'fly', 'once you accept the known risk the team may ask again');
});

// V2 slice 2: an administrator who says yes to everything sees the teams fly uncrewed, ask for the readiness
// decision, train crews, and then fly them, each crew member consenting for themselves.
test('teams move from uncrewed flights to a readiness decision, crew training and crewed flights', async () => {
  const { newGame, dispatch, advance } = await import('../js/rules/index.js');
  const { dayOf } = await import('../js/core/calendar.js');
  let s = newGame(1), n = 0;
  const act = (type, payload) => { const r = dispatch(s, { id: `y${++n}`, type, actor: 'administrator', payload }); if (!r.rejection) s = r.state; return !r.rejection; };
  while (s.day < dayOf(1962, 7, 1)) {
    for (const p of s.staff.proposals.filter(x => x.status === 'open')) act('approve-proposal', { proposalId: p.id });
    for (const d of s.decisions.filter(x => x.status === 'open')) if (!act('decide', { decisionId: d.id, choice: d.options[0] })) act('decide', { decisionId: d.id, choice: d.options.at(-1) });
    s = advance(s, 7).state;
  }
  assert.ok(s.decisions.some(d => d.type === 'crew-readiness' && d.choice === 'approve'));
  assert.ok(s.work.some(j => j.kind === 'crew-training' && j.status === 'done'));
  const crewed = s.launches.filter(l => l.crew.length && l.status === 'flown');
  assert.ok(crewed.length > 0, 'crewed flights flew');
  const first = crewed[0], uncrewedBefore = s.launches.filter(l => l.programmeId === first.programmeId && !l.crew.length && l.day < first.day);
  assert.ok(uncrewedBefore.length >= 3, 'after uncrewed flights built the evidence');
  assert.ok(first.crew.every(id => s.people[id].record.consents.some(c => c.launchId === first.id && c.consent)));
  // The teams' status reads the astronaut office; the projection still shows no traits.
  const { project } = await import('../js/rules/index.js');
  assert.ok(project(s).programmes.every(p => typeof p.team === 'object' || typeof p.team === 'string' || p.team === null));
  assert.doesNotMatch(JSON.stringify(project(s)), /"traits"|candour/);
});

test('§8.6: Mercury-Redstone is recommended for closure once orbital Mercury flies regularly', async () => {
  const { runItsCourse } = await import('../js/rules/staff.js');
  const state = { programmes: { 'mercury-redstone': { id: 'mercury-redstone', name: 'Mercury suborbital (Redstone)', stage: 'greenlit' }, 'mercury-atlas': { id: 'mercury-atlas', name: 'Mercury orbital (Atlas)', stage: 'greenlit' } }, launches: [] };
  assert.equal(runItsCourse(state, state.programmes['mercury-redstone']), null);
  for (let i = 0; i < 3; i++) state.launches.push({ programmeId: 'mercury-atlas', status: 'flown', outcome: 'success' });
  assert.match(runItsCourse(state, state.programmes['mercury-redstone']), /Mercury orbital \(Atlas\) now does the same work/);
});
