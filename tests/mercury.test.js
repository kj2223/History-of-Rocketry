// Mercury Control: the Space Task Group's offer after Pioneer 4, the Retrofire officer's console on Mercury-Redstone 1,
// the training sims, and what the flight model does with the booster's faults.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame, checkpoint, checkCheckpoint, nextIndex } from '../js/game.js';
import { SEASON, onPath } from '../js/data/campaign.js';
import { newRound } from '../js/truth/round.js';
import { ascent, outcome, arc, PLAN, recoveryHours, ABORT_LIMIT } from '../js/truth/capsule.js';
import { initProgramme, adopt } from '../js/world/programme.js';
import { standing } from '../js/career/record.js';
import { toRoundId, playMission, runSim, playRound, advance } from './play.js';
import { routeArgue, routeDone } from '../js/mercury.js';
import { dateText } from '../js/game.js';
import { dayOf } from '../js/core/calendar.js';

const redstone = (s, p = initProgramme()) => newRound(s, p, 'redstone');

test('a good Mercury-Redstone flies the MR-3 numbers: about 187 km up and 486 km down the range at about 11 g', () => {
  const r = arc(PLAN.v, PLAN.gamma, PLAN.cutoffH, 40);
  assert.ok(Math.abs(r.apogee - 187) < 10, `apogee ${r.apogee}`);
  assert.ok(Math.abs(r.range - 486) < 25, `range ${r.range}`);
  assert.ok(Math.abs(r.entryG - 11) < 0.5);
});

test('each booster fault shows on the plot the way it really flew', () => {
  const seen = new Set();
  for (let s = 1; s < 400; s++) {
    const r = redstone(s), a = ascent(r), end = outcome(r);
    seen.add(a.failure || 'nominal');
    if (a.failure === 'plug') assert.equal(end.outcome, 'pad');
    if (a.failure === 'control') assert.ok(a.steps.some(x => Math.abs(x.off) > ABORT_LIMIT), 'a control failure crosses the abort line before it breaks her up');
    if (a.failure === 'lox') assert.ok(end.landing < 420 && a.burn < PLAN.burn);
    if (a.failure === 'thrust') assert.ok(end.landing > 520);
    if (!a.failure) assert.ok(Math.abs(end.landing - 486) < 60 && a.steps.every(x => Math.abs(x.off) < ABORT_LIMIT));
  }
  assert.deepEqual([...seen].sort(), ['control', 'lox', 'nominal', 'plug', 'thrust']);
});

test('an abort called in time saves the capsule from a booster going off her line; one not called may lose it', () => {
  for (let s = 1; s < 800; s++) {
    const r = redstone(s), a = ascent(r);
    if (a.failure !== 'control') continue;
    const over = a.steps.find(x => Math.abs(x.off) > ABORT_LIMIT).t;
    assert.equal(outcome(structuredClone(r), over + 1).capsule, 'safe');
    const late = outcome(r);
    assert.equal(late.outcome, 'breakup');
    assert.ok(['damaged', 'lost'].includes(late.capsule));
    return;
  }
  assert.fail('no control failure found');
});

test('the review\'s fix for the tail plug makes the four-inch flight rare', () => {
  const p = initProgramme(); adopt(p, 'plug');
  const count = prog => { let n = 0; for (let s = 1; s < 400; s++) n += ascent(redstone(s, prog)).failure === 'plug' ? 1 : 0; return n; };
  assert.ok(count(p) < count(initProgramme()) * 0.25);
});

test('the helicopters find her fast at the right point, slowly at the wrong one, and not at all in a rough sea', () => {
  const calm = { seaState: 2, late: null };
  assert.ok(recoveryHours(486, 490, calm, true) < 0.4);
  assert.ok(recoveryHours(560, 486, calm, true) > recoveryHours(560, 555, calm, true) + 0.5);
  assert.ok(recoveryHours(486, 486, { seaState: 5, late: null }, true) > 1);
  assert.ok(recoveryHours(486, 486, calm, false) > recoveryHours(486, 486, calm, true));
});

test('after Pioneer 4 the paths split: Mercury Control if you take the offer, Ranger 7 if you stay with JPL', () => {
  const p4 = SEASON.findIndex(r => r.id === 'pioneer-4');
  assert.equal(SEASON[p4].turningPoint, 'nasa');
  assert.deepEqual(SEASON.filter(r => onPath(r, 'nasa')).map(r => r.id).slice(-7), ['pioneer-4', 'mr-1', 'mr-3', 'ma-6', 'ma-7', 'gem-4', 'gem-5']);
  assert.deepEqual(SEASON.filter(r => onPath(r, 'jpl')).map(r => r.id).slice(-2), ['pioneer-4', 'ranger-7']);
  assert.ok(SEASON.find(r => r.id === 'mr-1').start > SEASON[p4].start);
});

test('take the Space Task Group\'s offer and the next round is Mercury-Redstone 1, worked from the Retrofire officer\'s console', () => {
  newGame(8);
  toRoundId('mr-1');
  assert.equal(g.record.seat, 'retro');
  assert.equal(g.record.path, 'nasa');
  assert.equal(g.beat, 'mBrief');
  assert.ok(g.crewed && !g.people.hollis.hidden && g.people.ellis.hidden);
  assert.doesNotThrow(() => checkCheckpoint(checkpoint()));
  playMission({ sims: 2 });
  const e = g.record.rounds.at(-1);
  assert.equal(e.id, 'mr-1');
  assert.ok(e.boss === 'hollis' && typeof e.flight === 'string');
  assert.equal(SEASON[nextIndex()].id, 'mr-3');
});

test('turn it down and you stay at JPL for Ranger 7', () => {
  newGame(8);
  while (SEASON[g.roundIndex].id !== 'pioneer-4') { playRound(() => 'nominal'); const o = g.record.offers.at(-1); if (o && !o.made) { o.made = true; o.answer = null; } advance(true); }
  playRound(() => 'nominal');
  const o = g.record.offers.at(-1);
  o.made = true; o.answer = null;
  advance(false);
  assert.equal(SEASON[g.roundIndex].id, 'ranger-7');
  assert.notEqual(g.record.path, 'nasa');
});

test('every kind of MR-1 can be worked to its review: the four-inch flight, aborts, short and long flights', () => {
  const kinds = new Set();
  for (let seed = 1; seed < 60 && kinds.size < 4; seed++) {
    newGame(seed);
    toRoundId('mr-1');
    playMission({ pad: seed % 2 ? 'wait' : 'now' });
    kinds.add(g.round.end.outcome);
    assert.ok(g.record.rounds.at(-1).flight.length > 10);
  }
  assert.ok(kinds.has('pad') && kinds.size >= 3, [...kinds].join(','));
});

test('the simulator is a training tool: no risk to the real round, and a good sim record counts toward your standing', () => {
  newGame(8);
  toRoundId('mr-1');
  const before = JSON.stringify(g.round);
  const base = standing(g.record);
  const results = [runSim(), runSim(), runSim(), runSim()];
  assert.equal(JSON.stringify(g.round), before, 'the sims never touch the real round');
  assert.ok(results.every(d => d && d.of >= 1 && d.scenario));
  assert.equal(g.record.sims.length, 4);
  const good = g.record.sims.slice(-3).every(s => s.right === s.of);
  assert.equal(standing(g.record), base + (good ? 1 : 0));
  assert.ok(g.mission.trained);
});

// ---- M2: the astronauts, and Mercury-Redstone 3 ----
import { crewFate, DROWN_AFTER } from '../js/truth/capsule.js';
import { CREW_TRAITS, consents, ownAbortAt } from '../js/world/crew.js';
import { ASTRONAUTS, SEVEN } from '../js/data/crew.js';

const toMR3 = seed => { newGame(seed); toRoundId('mr-1'); playMission(); advance(true); closeAwayIfAny(); };
const closeAwayIfAny = () => { g.room = null; };

test('seven astronauts, each with a hidden way of flying that only shows in what he does', () => {
  assert.equal(SEVEN.length, 7);
  for (const id of SEVEN) assert.ok(CREW_TRAITS[id] && ASTRONAUTS[id].name);
  assert.equal(consents(CREW_TRAITS.moreau, { sea: 3, late: null }), true);
  assert.equal(consents(CREW_TRAITS.moreau, { sea: 3, late: 'uprange' }), false);
  assert.equal(consents(CREW_TRAITS.whitcomb, { sea: 3, late: 'uprange' }), true);
  assert.ok(ownAbortAt(CREW_TRAITS.whitcomb) < ownAbortAt(CREW_TRAITS.price));
});

test('a man can die: lost with the capsule, or drowned after a long wait in the water; never scripted', () => {
  const r = redstone(5);
  assert.equal(crewFate(r, { capsule: 'lost' }, 0, false), 'killed');
  assert.equal(crewFate(redstone(6), { capsule: 'ok', entryG: 11 }, 0.5, false), 'safe');
  assert.equal(crewFate(redstone(7), { capsule: 'damaged', entryG: 11 }, 0.5, false), 'hurt');
  let drowned = 0, n = 300;
  for (let s = 1; s <= n; s++) if (crewFate(redstone(s), { capsule: 'ok', entryG: 11 }, DROWN_AFTER + 1, true) === 'killed') drowned++;
  assert.ok(drowned > n * 0.15 && drowned < n * 0.45, `drowned ${drowned}`);
});

test('after MR-1 comes Mercury-Redstone 3, with Rourke on top; the flight record says how he came home', () => {
  toMR3(8);
  assert.equal(SEASON[g.roundIndex].id, 'mr-3');
  assert.equal(g.beat, 'mBrief');
  assert.ok(!g.people.pilot.hidden && g.people.pilot.name === 'Thomas Rourke');
  assert.doesNotThrow(() => checkCheckpoint(checkpoint()));
  playMission({ sims: 1 });
  const e = g.record.rounds.at(-1);
  assert.equal(e.id, 'mr-3');
  assert.match(e.flight, /Rourke (was killed|was hurt|came home safe)|Lost/);
  assert.equal(g.record.rounds.filter(r => r.id === 'mr-3').length, 1);
  assert.equal(SEASON[nextIndex()].id, 'ma-6');
});

test('with a ship off station and Retro calling GO, a cautious pilot can refuse at the final poll, and his no holds the count', () => {
  let seen = false;
  for (let s = 1; s < 120 && !seen; s++) {
    toMR3(s);
    const crew = SEASON[g.roundIndex].crew;
    const was = crew[0]; crew[0] = 'moreau';
    try {
      playMission({ poll: () => true });
      seen = !!g.mission.calls?.pilotRefused;
    } finally { crew[0] = was; }
  }
  assert.ok(seen, 'never saw a refusal');
});

test('if the booster walks off her line and nobody calls it, the pilot pulls the handle himself', () => {
  let seen = false;
  for (let s = 1; s < 200 && !seen; s++) {
    toMR3(s);
    if (!Object.values(g.round.faults || {}).includes('control')) continue;
    playMission({ abort: () => false });
    seen = !!g.mission.calls?.pilotAbort;
  }
  assert.ok(seen, 'never saw a pilot abort');
});

// ---- M3: orbit on the Atlas ----
import { flyEntry, MERCURY_ENTRY, KM_PER_MILE } from '../js/truth/entry.js';
import { atlasAscent, atlasOutcome, insertion, inOrbit, retrofire, orbitRecoveryHours, ORBIT_PLAN } from '../js/truth/orbit.js';

const DEG = Math.PI / 180;
const atlas = (s, extra = {}) => newRound(s, { ...initProgramme(), ...extra }, 'atlas');
const toOrbit = (r) => { atlasAscent(r, 'nominal'); const e = atlasOutcome(r); insertion(r, true); return e; };

test('the entry physics: a clean retrofire lands on the point, and MA-7\'s yaw error and late burn put her about 250 miles long', () => {
  assert.ok(Math.abs(flyEntry(MERCURY_ENTRY).miss) < 1000);
  const ma7 = flyEntry(MERCURY_ENTRY, { yawError: 25 * DEG, late: 3, dvScale: -0.03 }).miss / 1000 / KM_PER_MILE;
  assert.ok(ma7 > 200 && ma7 < 300, `${ma7.toFixed(0)} miles`);
});

test('a good Atlas reaches orbit; a sustainer that cuts off early leaves her short of it', () => {
  const r = atlas(3); atlasAscent(r, 'nominal'); assert.equal(atlasOutcome(r).outcome, 'orbit'); assert.ok(r.end.margin > 0);
  const q = atlas(3); atlasAscent(q, 'shortburn'); const e = atlasOutcome(q); assert.equal(e.outcome, 'orbit'); assert.ok(e.margin < 0);
  insertion(q, true); assert.equal(q.end.outcome, 'decay');
  assert.ok(orbitRecoveryHours(q.end, 0, { seaState: 2, late: null }, true) > 5, 'down far from any ship');
});

test('a loose heat shield: keeping the retro pack on usually brings him home; jettisoning it usually loses him', () => {
  let keptLost = 0, dumpedLost = 0, n = 200;
  for (let s = 1; s <= n; s++) {
    for (const pack of ['keep', 'jettison']) {
      const r = atlas(s); r.faults = { 'heat-shield': 'shield' }; toOrbit(r); inOrbit(r);
      assert.ok(r.orbit.signal && r.orbit.loose);
      const e = retrofire(r, 'auto', pack);
      if (e.capsule === 'lost') pack === 'keep' ? keptLost++ : dumpedLost++;
    }
  }
  assert.equal(keptLost, 0);
  assert.ok(dumpedLost > n * 0.6, `${dumpedLost}`);
});

test('a bad horizon scanner: on the automatic system she lands hundreds of km off; fired by hand on the window she lands close', () => {
  let auto = 0, hand = 0, n = 60;
  for (let s = 1; s <= n; s++) {
    const a = atlas(s); a.faults = { scanners: 'scanner' }; toOrbit(a); inOrbit(a); auto += Math.abs(retrofire(a, 'auto', 'jettison').miss);
    const b = atlas(s); b.faults = { scanners: 'scanner' }; toOrbit(b); inOrbit(b); hand += Math.abs(retrofire(b, 'manual', 'jettison').miss);
  }
  assert.ok(auto / n > 150, `auto ${auto / n}`);
  assert.ok(hand / n < auto / n / 2, `hand ${hand / n}`);
});

// Turn down the project office's offer after MR-3: these tests stay on the Retrofire console.
const toMA6 = (seed, take = false) => { toMR3(seed); playMission({ sims: 0 }); advance(take); g.room = null; };

test('after MR-3 come the orbital flights: MA-6 and MA-7 play from the count through orbit, retrofire and recovery to the review', () => {
  toMA6(8);
  assert.equal(SEASON[g.roundIndex].id, 'ma-6');
  assert.ok(g.crewed && g.people.pilot.name === 'Daniel Okafor');
  assert.doesNotThrow(() => checkCheckpoint(checkpoint()));
  playMission({ sims: 1 });
  let e = g.record.rounds.at(-1);
  assert.equal(e.id, 'ma-6');
  assert.equal(typeof e.flight, 'string');
  advance(true); g.room = null;
  assert.equal(SEASON[g.roundIndex].id, 'ma-7');
  playMission({ sims: 1 });
  e = g.record.rounds.at(-1);
  assert.equal(e.id, 'ma-7');
  assert.equal(g.beat, 'sRoute');
  assert.doesNotThrow(() => checkCheckpoint(checkpoint()));
  routeArgue('lor'); routeDone();
  assert.equal(g.beat, 'roundEnd');
  assert.equal(SEASON[nextIndex()].id, 'gem-4');
});

test('the route to the Moon, June 1962: you argue a mode once, NASA chooses lunar-orbit rendezvous, and your flights count', () => {
  toMA6(8);
  playMission(); advance(true); g.room = null; playMission();
  assert.equal(g.beat, 'sRoute');
  assert.equal(dateText(), dateText(dayOf(1962, 6, 7)));
  g.record.orbitMisses = [12, -40];
  const before = g.record.trust;
  routeArgue('lor');
  assert.equal(g.record.scenes.route.view, 'lor');
  assert.equal(g.record.trust, before + 1, 'a close splashdown backs the case');
  assert.ok(g.notes.some(n => /announced it on 11 July 1962/.test(n.text)));
  assert.equal(routeArgue('eor'), null, 'one say only');
  routeDone();
  assert.equal(g.beat, 'roundEnd');
});

test('an orbital flight reaches every call: insertion, the orbits, retrofire and the splashdown point', () => {
  let seen = { insertion: 0, retro: 0, pack: 0, aim: 0 };
  for (let s = 1; s <= 6; s++) {
    toMA6(s);
    playMission({ sims: 0 });
    const c = g.mission.calls;
    if (c.insertion) seen.insertion++;
    if (c.retro) seen.retro++;
    if (c.pack) seen.pack++;
    if (c.aim) seen.aim++;
  }
  assert.ok(seen.insertion >= 5 && seen.retro >= 4 && seen.aim >= 4, JSON.stringify(seen));
  assert.ok(seen.pack >= 1, 'Segment 51 lit at least once on MA-6');
});

test('the simulator runs orbital sims on the Atlas flights, and grades them', () => {
  toMA6(4);
  const kinds = new Set();
  for (let n = 0; n < 8; n++) { const d = runSim(); kinds.add(d.scenario); assert.ok(d.of >= 1 && d.right <= d.of, JSON.stringify(d)); }
  assert.ok(kinds.size >= 3);
});

// ---- M4: the project engineer ----
import { lookSpot, flagSpot, runQual, engineer } from '../js/mercury.js';
import { offerFor } from '../js/data/campaign.js';

test('after MR-3 the project office offers the capsule engineer\'s job; turn it down and you keep the console', () => {
  assert.equal(SEASON.find(r => r.id === 'mr-3').turningPoint, 'engineer');
  assert.equal(offerFor('engineer').seat, 'engineer');
  toMA6(8, false);
  assert.equal(g.record.seat, 'retro');
  assert.ok(!engineer() && g.people.tate.hidden);
});

test('as project engineer: Hangar S and the test rooms the day before, Tate on the console, and the hardware questions are yours', () => {
  let played = 0;
  for (let s = 1; s <= 12 && played < 2; s++) {
    newGame(s); toRoundId('mr-1'); playMission(); advance(true); g.room = null; playMission();
    const o = g.record.offers.at(-1);
    if (!o || o.seat !== 'engineer' || !o.made) continue;
    advance(true); g.room = null;
    assert.equal(g.record.seat, 'engineer');
    assert.equal(SEASON[g.roundIndex].id, 'ma-6');
    assert.ok(engineer() && !g.people.tate.hidden);
    assert.equal(g.beat, 'mBrief');
    const t0 = g.clock;
    lookSpot('heat-shield'); runQual('bag');
    assert.ok(g.clock > t0 + 150, 'the work takes time');
    assert.ok(g.mission.checkout['heat-shield'].text && g.mission.quals.bag.text);
    lookSpot('programmer'); assert.equal(g.mission.checkout.programmer, undefined, 'the Atlas is Convair\'s');
    // Plant a loose shield; a flag finds it overnight and costs a day.
    g.round.faults['heat-shield'] = 'shield';
    flagSpot('heat-shield');
    const slips = g.slipDays;
    playMission({ sims: 0 });
    assert.deepEqual(g.mission.found, ['heat-shield']);
    assert.equal(g.slipDays, slips + 1 + g.mission.scrubs);
    assert.ok(g.mission.calls.auto && g.mission.calls.retro, 'Hollis asked Engineering about the scanners');
    const e = g.record.rounds.at(-1);
    assert.equal(e.id, 'ma-6');
    assert.ok(e.calls.engineer);
    played++;
  }
  assert.ok(played >= 1, 'the offer was made on some seed');
});
