// V2 slice 3 (V2 freeze §6): the point-mass entry, the heat shield's evidenced envelope, the Retrofire officer
// and recovery. Acceptance V2-05, V2-06 and V2-07.
import test from 'node:test';
import assert from 'node:assert/strict';
import { flyEntry, KM_PER_MILE } from '../js/rules/entry-model.js';
import { flyAndLand, burnThroughChance } from '../js/rules/physics.js';
import { retrofireData } from '../js/rules/operations.js';
import { readiness } from '../js/rules/belief.js';
import { envelope } from '../js/rules/evidence.js';
import { pickupHours, RECOVERY_FORCES, CONTINGENCY_AREAS } from '../js/data/flight.js';
import { ENTRY_VEHICLES, SPACECRAFT_TRUTH } from '../js/data/physical.js';
import { newGameAt1958 as newGame, project } from '../js/rules/index.js';
import { BASELINE } from '../js/data/vehicles.js';
import { crewedReady, askLaunch, cleanRecord, assertNoLeak } from './game.js';

const DEG = Math.PI / 180, miles = m => m / 1000 / KM_PER_MILE;

test('V2-05: MA-7\'s recorded retrofire errors land it roughly 250 miles long', () => {
  const ma7 = flyEntry(ENTRY_VEHICLES['mercury-atlas'], { yawError: 25 * DEG, late: 3, dvScale: -0.03 });
  assert.ok(miles(ma7.miss) > 200 && miles(ma7.miss) < 300, `${miles(ma7.miss).toFixed(0)} miles`);
  // The yaw error does most of it, as it did on the day.
  const yaw = flyEntry(ENTRY_VEHICLES['mercury-atlas'], { yawError: 25 * DEG });
  assert.ok(miles(yaw.miss) > 0.6 * miles(ma7.miss));
  // A nominal retrofire lands on the aim point.
  assert.ok(Math.abs(flyEntry(ENTRY_VEHICLES['mercury-atlas']).miss) < 1);
});

test('V2-05: Gemini 5\'s wrong rotation rate lands it roughly 80 miles short; its guidance otherwise flies out the errors', () => {
  const v = ENTRY_VEHICLES['gemini-titan'];
  // The ground-supplied rotation rate moved the computer's target by about 129 km.
  const g5 = flyEntry(v, {}, -129e3);
  assert.ok(miles(g5.miss) < -60 && miles(g5.miss) > -100, `${miles(g5.miss).toFixed(0)} miles`);
  // A modest burn error that a ballistic capsule cannot correct, Gemini's lift can.
  const off = { dvScale: -0.03, late: 3 };
  assert.ok(Math.abs(flyEntry(v, off).miss) < Math.abs(flyEntry({ ...v, ld: 0 }, off).miss) / 5);
  assert.ok(flyEntry(v).peakG < flyEntry(ENTRY_VEHICLES['mercury-atlas']).peakG, 'lift keeps Gemini\'s loads lower than Mercury\'s');
});

test('§6.1: a Redstone arc is a hard, short, cool entry with no blackout', () => {
  const r = flyEntry(ENTRY_VEHICLES['mercury-redstone']);
  assert.ok(r.peakG > 8 && r.peakG < 13, `${r.peakG.toFixed(1)} g`);
  assert.ok(r.heatLoad < 0.05 * flyEntry(ENTRY_VEHICLES['mercury-atlas']).heatLoad);
  assert.equal(r.blackout, 0);
});

test('V2-06: the shield\'s failure odds come from hidden truth alone, never from what the evidence covers', () => {
  const craft = 'mercury-capsule', cap = SPACECRAFT_TRUTH[craft].heatCapacity;
  assert.equal(burnThroughChance(craft, 85), 0, 'a nominal orbital entry is inside the truth');
  assert.ok(burnThroughChance(craft, 0.95 * cap) > 0 && burnThroughChance(craft, 1.1 * cap) > burnThroughChance(craft, 0.95 * cap));
  assert.equal(burnThroughChance(craft, 1.25 * cap), 1);
  // Two agencies with the same random streams, one with a covering heat-shield record and one with none, fly
  // the same entry and get the same physical result.
  const a = newGame(5), b = newGame(5);
  cleanRecord({ state: a }, 'mercury-atlas', { ...BASELINE['mercury-atlas'] });
  const ea = flyAndLand(a, 'x', { vehicle: 'mercury-atlas' }), eb = flyAndLand(b, 'x', { vehicle: 'mercury-atlas' });
  assert.deepEqual(ea, eb);
  assert.deepEqual(a.physical.entries.x, b.physical.entries.x);
});

test('V2-06 / §6.2: a suborbital heat-shield record does not cover an orbital entry, so Mercury-Atlas is not ready for crew on it', () => {
  const s = newGame(5);
  const atlas = { vehicle: 'mercury-atlas', stages: { ...BASELINE['mercury-atlas'] } };
  // Clean Atlas records, but the capsule's entry evidence comes only from Redstone arcs.
  cleanRecord({ state: s }, 'mercury-atlas', atlas.stages);
  for (const o of s.evidence.observations) if (o.quantity === 'mercury-capsule.heat-load') o.value = 1.4;
  assert.equal(envelope(s, atlas, 'mercury-capsule.heat-load'), 1.4);
  assert.match(readiness(s, 'crewed-flight', atlas).blockers.join(), /heat-load evidence covers 1.4 of the predicted 80/);
  for (const o of s.evidence.observations) if (o.quantity === 'mercury-capsule.heat-load') o.value = 85;
  assert.deepEqual(readiness(s, 'crewed-flight', atlas).blockers, []);
});

test('V2-07: time to pickup follows the actual landing point and the force positioned for it', () => {
  // Pure rule: near the ships helicopters pick up fast; far from any station a ship has to steam there.
  assert.ok(pickupHours(10, 'primary') < 1);
  assert.ok(pickupHours(10, 'minimal') > pickupHours(10, 'primary'));
  assert.ok(pickupHours(400, 'primary') > 5 * pickupHours(10, 'primary'));
  assert.ok(pickupHours(CONTINGENCY_AREAS[0], 'extended') < 1, 'a contingency ship is waiting');
  assert.ok(pickupHours(CONTINGENCY_AREAS[0], 'primary') > 24);
  // In the physical layer: the same entry, two forces, the same landing point and different pickup times.
  const a = newGame(9), b = newGame(9);
  flyAndLand(a, 'x', { vehicle: 'mercury-atlas', recovery: 'primary', early: true });
  flyAndLand(b, 'x', { vehicle: 'mercury-atlas', recovery: 'extended', early: true });
  const [ta, tb] = [a.physical.entries.x, b.physical.entries.x];
  assert.equal(ta.miss, tb.miss);
  assert.equal(ta.hours, pickupHours(ta.miss / 1000, 'primary'));
  assert.equal(tb.hours, pickupHours(tb.miss / 1000, 'extended'));
  assert.ok(tb.hours < ta.hours);
  // A long wait in the water fills the capsule; it can sink.
  assert.ok(ta.water > tb.water);
});

test('§6.3: an independent check catches most wrong retrofire numbers, and an error is a time for Mercury and a target for Gemini', () => {
  const count = (policy, vehicle) => {
    const s = newGame(11);
    s.operations.retrofireChecking = policy;
    let wrong = 0;
    for (let i = 0; i < 3000; i++) {
      const { ground } = retrofireData(s, { id: `t${i}`, vehicle, articleId: 'a' });
      if (Object.keys(ground).length) { wrong++; assert.deepEqual(Object.keys(ground), [vehicle === 'gemini-titan' ? 'navError' : 'late']); }
    }
    return wrong;
  };
  const single = count('single', 'mercury-atlas'), checked = count('independent', 'mercury-atlas');
  assert.ok(single > 150 && single < 450, `${single} of 3000`);
  assert.ok(checked < single / 2.5, `${checked} with a check`);
  assert.ok(count('single', 'gemini-titan') > 150);
  // A Redstone arc needs no retrofire data at all.
  const s = newGame(11);
  assert.deepEqual(retrofireData(s, { id: 'r', vehicle: 'mercury-redstone', articleId: 'a' }).ground, {});
});

test('§6.3, §6.4: a crewed flight comes home with a recovery report from instruments and ships, and costs its recovery force', () => {
  const g = crewedReady(['cand-01'], 1);
  const { id, decision } = askLaunch(g, ['cand-01'], 'rec-1', { recovery: 'minimal' });
  assert.match(g.state.decisions.find(d => d.id === decision).text, /for recovery by one destroyer/);
  assert.match(g.try('position-recovery', 'administrator', { launchId: id, force: 'nowhere' }).rejection.reason, /No recovery force/);
  g.cmd('position-recovery', 'administrator', { launchId: id, force: 'primary' });
  g.approve(decision);
  assert.match(g.try('position-recovery', 'administrator', { launchId: id, force: 'extended' }).rejection.reason, /before launch/);
  g.finish(`flight-${id}`);
  const l = g.state.launches.find(x => x.id === id);
  assert.equal(l.abort, null, 'this seed flies the whole profile');
  assert.equal(l.recovery, 'primary');
  assert.ok(l.entry.contact);
  assert.ok(l.entry.pickupHours > 0);
  assert.ok(['good', 'tired', 'exhausted'].includes(l.entry.crewCondition));
  const report = g.state.memos.filter(m => m.refs?.job === `flight-${id}`).at(-1).text;
  assert.match(report, /Pickup took [\d.]+ hours/);
  assert.match(report, /The crew (reported|came out)/);
  const view = project(g.state).launches.find(x => x.id === id);
  assert.equal(view.entry.pickupHours, l.entry.pickupHours);
  assertNoLeak(g.state);
});

test('V2-06: a shield that burns through loses the spacecraft and its crew; the record shows only what tracking and recovery saw', () => {
  const truth = SPACECRAFT_TRUTH['mercury-capsule'], keep = truth.heatCapacity;
  truth.heatCapacity = 1; // far below even a Redstone arc's load
  try {
    const g = crewedReady(['cand-01'], 1);
    const { id, decision } = askLaunch(g, ['cand-01'], 'burn-1');
    g.approve(decision);
    g.finish(`flight-${id}`);
    const l = g.state.launches.find(x => x.id === id);
    assert.equal(l.abort, null, 'this seed reaches entry');
    assert.equal(l.outcome, 'failure');
    assert.equal(l.entry.contact, false);
    assert.equal(g.state.people['cand-01'].record.availability, 'killed');
    assert.match(g.state.memos.filter(m => m.refs?.job === `flight-${id}`).at(-1).text, /was lost on entry. Thomas Rourke was lost with it. Tracking never regained contact/);
    assertNoLeak(g.state);
  } finally { truth.heatCapacity = keep; }
});

test('§6.4: an early retrofire comes down in a contingency area, and only the extended force is waiting there', () => {
  for (const [force, slow] of [['primary', true], ['extended', false]]) {
    const s = newGame(13);
    flyAndLand(s, 'x', { vehicle: 'mercury-atlas', recovery: force, early: true });
    const e = s.physical.entries.x;
    assert.ok(CONTINGENCY_AREAS.some(a => Math.abs(e.miss / 1000 - a) < 150), `${Math.round(e.miss / 1000)} km`);
    assert.equal(e.hours > 12, slow, `${force}: ${e.hours} h`);
  }
  assert.ok(RECOVERY_FORCES.extended.cost > RECOVERY_FORCES.primary.cost);
});
