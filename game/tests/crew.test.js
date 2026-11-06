// V2 slice 2 (V2 freeze §4, §5, §7): selection, training, readiness for crewed use, consent and the binding abort.
// Acceptance V2-02, V2-03, V2-04 and V2-08.
import test from 'node:test';
import assert from 'node:assert/strict';
import { project } from '../js/rules/index.js';
import { qualified, boardSlate } from '../js/rules/crew.js';
import { SELECTIONS } from '../js/data/crew.js';
import { mercuryRedstone, book, assertNoLeak, cleanRecord, selected, train, crewedReady, askLaunch } from './game.js';

const MR = 'mercury-redstone';

test('§7: the selection board recommends a slate from records; the administrator approves it or picks from the records', () => {
  const g = mercuryRedstone();
  const d = g.state.decisions.find(x => x.type === 'crew-selection');
  assert.equal(d.subject, 'group-1');
  assert.deepEqual(d.effect.payload.ids, boardSlate(SELECTIONS[0]));
  assert.match(d.text, /hours/);
  assert.match(g.try('select-crew', 'administrator', { group: 'group-1', ids: ['cand-09'] }).rejection.reason, /not medically eligible/);
  assert.match(g.try('select-crew', 'administrator', { group: 'group-1', ids: ['cand-11'] }).rejection.reason, /did not apply/);
  selected(g);
  const crew = project(g.state).people.filter(p => p.kind === 'crew');
  assert.equal(crew.length, 7);
  assert.ok(crew.every(p => p.record.background.flightHours > 0 && p.record.history.length === 1));
  assert.match(g.try('select-crew', 'administrator', { group: 'group-1', ids: ['cand-10'] }).rejection.reason, /already been selected/);
  assertNoLeak(g.state);
});

test('§7: training is mission-specific; a Mercury crew is not qualified for Gemini; a new pairing retrains together', () => {
  const g = mercuryRedstone();
  selected(g, ['cand-01', 'cand-02', 'cand-06']);
  assert.match(qualified(g.state, MR, ['cand-01']).join(), /has not trained/);
  train(g, MR, ['cand-01']);
  assert.deepEqual(qualified(g.state, MR, ['cand-01']), []);
  assert.match(qualified(g.state, 'mercury-atlas', ['cand-01']).join(), /has not trained/, 'Redstone training does not qualify for Atlas');
  train(g, 'gemini-titan', ['cand-01', 'cand-02']);
  assert.deepEqual(qualified(g.state, 'gemini-titan', ['cand-01', 'cand-02']), []);
  train(g, 'gemini-titan', ['cand-01', 'cand-06'].reverse());
  assert.deepEqual(qualified(g.state, 'gemini-titan', ['cand-06', 'cand-01']), []);
  assert.match(qualified(g.state, 'gemini-titan', ['cand-02', 'cand-06']).join(), /teamwork for Gemini-Titan II with this crew/);
});

test('V2-04: no crewed launch without a readiness decision for that configuration; flights alone do not grant it', () => {
  const g = mercuryRedstone();
  selected(g, ['cand-01']);
  train(g, MR, ['cand-01']);
  assert.match(askLaunch(g, ['cand-01']).rejection, /no readiness decision for crewed use/);
  g.days(6); // let the unused pad booking run out
  // Thin evidence: the technical director vetoes the readiness decision.
  const thin = g.cmd('request-crew-readiness', 'technical-director', { programmeId: MR });
  assert.match(g.try('decide', 'administrator', { decisionId: thin, choice: 'approve' }).rejection.reason, /Vetoed by technical/);
  g.approve(thin, 'reject');
  cleanRecord(g, MR, g.state.programmes[MR].baseline);
  g.approve(g.cmd('request-crew-readiness', 'technical-director', { programmeId: MR }));
  const ok = askLaunch(g, ['cand-01']).decision;
  assert.ok(ok);
  g.approve(ok, 'reject');
  // A different configuration of the same vehicle needs its own decision.
  g.cmd('propose-revision', 'department-head', { revId: 'redstone/r2', reason: 'test' });
  g.cmd('approve-prototype', 'technical-director', { programmeId: MR, revId: 'redstone/r2' });
  g.state.hardware.revisions['redstone/r2'].trial = true;
  g.cmd('build-article', 'production', { id: 'r2-art', programmeId: MR, stages: { redstone: 'redstone/r2' } });
  const pad = book(g, 'pad-1', MR, 5), tracking = book(g, 'tracking-1', MR, 5);
  assert.match(g.try('request-launch', 'administrator', { id: 'Lr2', articleId: 'r2-art', pad, tracking, cost: 1, replacementCost: 1, crew: ['cand-01'] }).rejection.reason, /no readiness decision/);
});

test('V2-02: a launch needs the ground chain and crew consent; consent is recorded and the flight is logged', () => {
  const g = crewedReady();
  const { id, decision } = askLaunch(g, ['cand-01']);
  const d = g.state.decisions.find(x => x.id === decision);
  assert.deepEqual(Object.keys(d.positions), ['finance', 'technical', 'crew']);
  assert.equal(d.positions.crew.stance, 'approve');
  const consent = g.state.people['cand-01'].record.consents.at(-1);
  assert.deepEqual([consent.launchId, consent.consent], [id, true]);
  assert.ok(Array.isArray(consent.evidence.gaps));
  g.approve(decision);
  g.finish(`flight-${id}`);
  const l = g.state.launches.find(x => x.id === id);
  assert.equal(g.state.people['cand-01'].record.flights.at(-1).launchId, id);
  assert.equal(g.state.people['cand-01'].record.availability, 'available');
  assert.ok(['success', 'failure', 'indeterminate', 'crew-abort'].includes(l.outcome));
});

test('V2-02 / V2-08: the same evidence, two crews: the cautious one refuses, the bold one consents; a refusal stops the launch', () => {
  const run = crew => {
    const g = crewedReady([crew]);
    // One recent loss of this vehicle, shown to both.
    g.state.launches.push({ id: 'past-loss', vehicle: MR, status: 'flown', outcome: 'failure', crew: [] });
    return { g, ...askLaunch(g, [crew]) };
  };
  const bold = run('cand-03'), cautious = run('cand-07');
  assert.equal(bold.g.state.decisions.find(d => d.id === bold.decision).positions.crew.stance, 'approve');
  const refused = cautious.g.state.decisions.find(d => d.id === cautious.decision);
  assert.equal(refused.positions.crew.stance, 'veto');
  assert.match(refused.consequence, /Scrubbed: vetoed by crew/);
  assert.equal(cautious.g.state.launches.find(l => l.id === cautious.id).status, 'scrubbed');
  const record = cautious.g.state.people['cand-07'].record.consents.at(-1);
  assert.deepEqual([record.consent, record.evidence.recentFailures], [false, 1]);
  // Nothing in the rules punishes a refusal.
  assert.deepEqual(cautious.g.state.people['cand-07'].traits, crewedReady(['cand-07']).state.people['cand-07'].traits);
  assert.doesNotMatch(JSON.stringify(project(cautious.g.state).people), /risk|candour|independence/);
});

test('V2-03: a crew abort binds: only the crew can call it, it ends the flight, and no ground command undoes it', () => {
  const g = crewedReady();
  const { id, decision } = askLaunch(g, ['cand-01']);
  g.approve(decision);
  for (const actor of ['administrator', 'flight-control', 'technical-director']) {
    assert.match(g.try('crew-abort', actor, { launchId: id, by: 'cand-01' }).rejection.reason, /may not/);
  }
  assert.match(g.try('crew-abort', 'crew', { launchId: id, by: 'cand-02' }).rejection.reason, /not aboard/);
  const mode = g.cmd('crew-abort', 'crew', { launchId: id, by: 'cand-01' });
  assert.equal(mode, 'escape tower');
  const l = g.state.launches.find(x => x.id === id);
  assert.deepEqual([l.status, l.outcome, l.abort.by], ['flown', 'crew-abort', 'cand-01']);
  assert.equal(g.state.work.find(j => j.id === `flight-${id}`).status, 'cancelled');
  assert.match(g.try('resume-work', 'administrator', { jobId: `flight-${id}` }).rejection.reason, /not paused/);
  assert.match(g.try('crew-abort', 'crew', { launchId: id, by: 'cand-01' }).rejection.reason, /not in flight/);
  assert.equal(g.state.people['cand-01'].record.flights.at(-1).abort, 'escape tower');
  g.days(10);
  assert.equal(g.state.launches.find(x => x.id === id).outcome, 'crew-abort', 'still aborted days later');
});

test('V2-03: after the launch phase an abort is an early end of flight, not the escape tower', () => {
  const g = crewedReady();
  const { id, decision } = askLaunch(g, ['cand-01']);
  g.approve(decision);
  g.days(2);
  if (g.state.launches.find(x => x.id === id).status !== 'in-flight') return; // the crew's own call came first
  assert.equal(g.cmd('crew-abort', 'crew', { launchId: id, by: 'cand-01' }), 'early end of flight');
});
