// Houston: the flight director's offer at the end of Mercury, Gemini 4 and 5 worked in shifts, the mission rules, and
// the entry physics coming home short (Gemini 5) and from the Moon.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, newGame, checkpoint, checkCheckpoint } from '../js/game.js';
import { SEASON } from '../js/data/campaign.js';
import { FLIGHTS, DECISIONS } from '../js/data/flights.js';
import { newRound } from '../js/truth/round.js';
import { initProgramme } from '../js/world/programme.js';
import { flightTruth, resolve, geminiEntry, NAV_ERROR_KM } from '../js/truth/flights.js';
import { flyLunarEntry, LUNAR_ENTRY, KM_PER_MILE } from '../js/truth/entry.js';
import { owns } from '../js/houston.js';
import { toRoundId, playMission, advance } from './play.js';
import { routeArgue, routeDone } from '../js/mercury.js';
import { pendingOffer } from '../js/career/record.js';

// Play to Gemini 4: the Mercury flights from the Retrofire console, then the flight director's offer (take: whether to take it).
export function toGemini(seed, take = true, opts = {}) {
  newGame(seed);
  toRoundId('mr-1');
  playMission(); advance(true); g.room = null; // MR-1
  playMission();
  if (opts.engineer) { const e = g.record.offers.at(-1); if (!e.made) { e.made = true; e.answer = null; } }
  advance(!!opts.engineer); g.room = null; // MR-3: stay on the console, or go to the project office
  playMission(); advance(false); g.room = null; // MA-6
  playMission(); routeArgue('lor'); routeDone(); // MA-7 and the route meeting
  const o = g.record.offers.at(-1);
  if (o.seat === 'flight' && !o.made) { o.made = true; o.answer = null; }
  assert.ok(pendingOffer(g.record));
  advance(take); g.room = null;
  assert.equal(SEASON[g.roundIndex].id, 'gem-4');
  return g;
}

const titan = (s, p = initProgramme()) => newRound(s, p, 'titan');

test('the end of Mercury brings the flight director\'s offer, and Gemini 4 is flown from Houston', () => {
  toGemini(8);
  assert.equal(g.record.seat, 'flight');
  assert.equal(g.program, 'gemini');
  assert.equal(g.people.kessler.hidden, false);
  assert.match(g.people.pilot.name, /Boateng/);
  assert.doesNotThrow(() => checkCheckpoint(checkpoint()));
});

test('Gemini 4 and 5 play from the count through the shifts, retrofire and recovery to the review, with every call yours', () => {
  toGemini(8);
  const asked = [];
  playMission({ sims: 1, decide: d => { asked.push(d.id); return Object.keys(d.options)[0]; } });
  let e = g.record.rounds.at(-1);
  assert.equal(e.id, 'gem-4');
  assert.match(e.flight, /Gemini 4|Lost/);
  if (!/^Lost/.test(e.flight)) assert.ok(asked.includes('eva') && asked.includes('navcheck'), asked.join());
  advance(true); g.room = null;
  assert.equal(SEASON[g.roundIndex].id, 'gem-5');
  assert.doesNotThrow(() => checkCheckpoint(checkpoint()));
  playMission({ sims: 0 });
  e = g.record.rounds.at(-1);
  assert.equal(e.id, 'gem-5');
  assert.equal(typeof e.flight, 'string');
});

test('a long flight jumps the calendar over the days, with handover notes for the other shifts', () => {
  toGemini(8);
  const day0 = g.day;
  playMission({ sims: 0 });
  if (/^Lost/.test(g.record.rounds.at(-1).flight)) return;
  assert.ok(g.day >= day0 + 4, `four days up: ${g.day - day0}`);
  assert.ok(g.notes.some(n => /^Handover/.test(n.text)));
});

test('turn the offer down and you keep the Retrofire console: Dorsey makes the flight director\'s calls, and the retrofire numbers are yours', () => {
  toGemini(8, false);
  assert.equal(g.record.seat, 'retro');
  const asked = [];
  playMission({ sims: 0, decide: d => { asked.push(d.id); return 'send'; } });
  const e = g.record.rounds.at(-1);
  if (!/^Lost/.test(e.flight)) assert.deepEqual(asked, ['navcheck']);
  assert.ok(owns('flight', 'eva') && owns('retro', 'navcheck') && !owns('retro', 'eva') && owns('engineer', 'computer'));
});

test('every flight plan step asks only questions that exist, and each flight ends on retrofire', () => {
  for (const [id, f] of Object.entries(FLIGHTS)) {
    for (const s of f.steps) if (s.decide) assert.ok(DECISIONS[s.decide], `${id}: ${s.decide}`);
    assert.ok(f.steps.at(-1).retro, id);
    for (const s of f.steps) if (s.decide && DECISIONS[s.decide].rule != null) assert.ok(f.rules[DECISIONS[s.decide].rule], `${id}: rule for ${s.decide}`);
  }
});

test('Gemini 5\'s wrong number from the ground brings her down about 80 miles short; a back-room check catches it', () => {
  const r = titan(3);
  r.navdata = true;
  flightTruth(r, 'gem-5');
  const sent = geminiEntry(r, {});
  assert.ok(Math.abs(sent.miss / KM_PER_MILE + 80) < 12, `${(sent.miss / KM_PER_MILE).toFixed(0)} miles`);
  assert.equal(NAV_ERROR_KM, -129);
  const state = {};
  Object.assign(state, resolve(r, 'navcheck', 'check', state).set);
  const checked = geminiEntry(r, state);
  assert.ok(Math.abs(checked.miss) < 30, `${checked.miss.toFixed(0)} km`);
  assert.ok(checked.secondary);
});

test('falling fuel-cell pressure: come home on the rule, or drift and see. The truth decides which was right', () => {
  let recovered = 0, died = 0;
  for (let s = 1; s <= 40; s++) {
    const r = titan(s);
    r.faults = { 'fuel-cells': 'fuelcell' };
    const t = flightTruth(r, 'gem-5');
    const drift = resolve(r, 'fuelcell1', 'drift', {});
    if (t.fuelcellRecovers) { recovered++; assert.equal(drift.endAt, undefined); assert.notEqual(drift.verdict, 'bad'); }
    else { died++; assert.equal(drift.verdict, 'bad'); assert.ok(drift.endAt < 30); }
    const home = resolve(r, 'fuelcell1', 'home', {});
    assert.equal(home.endAt, 7);
  }
  assert.ok(recovered > died && died > 0, `${recovered} settled, ${died} failed`);
});

test('a spacewalk on a bad hatch can go wrong; held for an orbit it mostly comes good', () => {
  let jammedGo = 0, jammedDelay = 0;
  for (let s = 1; s <= 60; s++) {
    const r = titan(s);
    r.faults = { hatch: 'hatch' };
    flightTruth(r, 'gem-4');
    if (resolve(r, 'eva', 'go', {}).verdict === 'bad') jammedGo++;
    if (resolve(r, 'eva', 'delay', {}).verdict === 'bad') jammedDelay++;
    assert.equal(resolve(r, 'eva', 'cancel', {}).capability, undefined);
  }
  assert.ok(jammedGo > jammedDelay, `${jammedGo} against ${jammedDelay}`);
});

test('coming home from the Moon: the entry corridor. Too shallow skips out, too steep crushes, the middle lands on the point', () => {
  const mid = flyLunarEntry(LUNAR_ENTRY, 0, 0);
  assert.ok(mid.peakG > 5 && mid.peakG < 9, `${mid.peakG.toFixed(1)} g`);
  assert.ok(Math.abs(mid.miss) < 5000);
  assert.ok(flyLunarEntry(LUNAR_ENTRY, 0.8, 0).skip);
  assert.ok(flyLunarEntry(LUNAR_ENTRY, -1.4, 0).peakG > 12);
});

test('the Gemini launch can still go wrong on the Titan: a hidden fault in the autopilot or second stage', () => {
  const p = { ...initProgramme(), titanctlRisk: 1, stage2Risk: 1 };
  const r = newRound(5, p, 'titan');
  const kinds = Object.values(r.faults);
  assert.ok(kinds.includes('titanctl') && kinds.includes('stage2'));
});

test('a project engineer who stays in the back room answers for the spacecraft\'s hardware on Gemini, and checks it out first', async () => {
  const { lookSpot, runQual, capsuleSpots } = await import('../js/mercury.js');
  toGemini(8, false, { engineer: true });
  assert.equal(g.record.seat, 'engineer');
  assert.deepEqual(capsuleSpots(), ['fuel-cells', 'hatch', 'computer', 'thrusters']);
  lookSpot('hatch'); runQual('computer');
  assert.ok(g.mission.checkout.hatch && g.mission.quals.computer);
  const asked = [];
  playMission({ sims: 0, decide: d => { asked.push(d.id); return Object.keys(d.options)[0]; } });
  assert.ok(asked.every(id => ['computer', 'fuelcell1'].includes(id)), asked.join());
  assert.equal(g.record.rounds.at(-1).id, 'gem-4');
});

// ---- G2: rendezvous and docking ----
const toGem6 = seed => { toGemini(seed); playMission(); advance(true); g.room = null; playMission(); advance(true); g.room = null; assert.equal(SEASON[g.roundIndex].id, 'gem-6'); };

test('Gemini 6A and Gemini 8 play end to end from the flight director\'s console', () => {
  toGem6(8);
  const asked = [];
  playMission({ sims: 0, decide: d => { asked.push(d.id); return Object.keys(d.options)[0]; } });
  let e = g.record.rounds.at(-1);
  assert.equal(e.id, 'gem-6');
  if (!/^Lost/.test(e.flight)) assert.ok(asked.includes('rdvplan'), asked.join());
  advance(true); g.room = null;
  assert.equal(SEASON[g.roundIndex].id, 'gem-8');
  playMission({ sims: 0 });
  e = g.record.rounds.at(-1);
  assert.equal(e.id, 'gem-8');
  assert.equal(g.beat, 'roundEnd');
});

test('Gemini 12, the last: a paced spacewalk, and the Apollo programme office\'s offer', () => {
  toGem6(8);
  playMission(); advance(true); g.room = null; playMission(); advance(true); g.room = null;
  assert.equal(SEASON[g.roundIndex].id, 'gem-12');
  const asked = [];
  playMission({ sims: 0, decide: d => { asked.push(d.id); return Object.keys(d.options)[0]; } });
  if (!/^Lost/.test(g.record.rounds.at(-1).flight)) {
    assert.ok(asked.includes('evaplan'));
    assert.ok(g.record.capabilities.some(c => c.id === 'evawork'));
  }
  const o = g.record.offers.at(-1);
  assert.equal(o.seat, 'programme');
});

test('the full task list outside wears a man out more often than the paced plan', () => {
  let tired = 0;
  for (let s = 1; s <= 40; s++) { const r = titan(s); flightTruth(r, 'gem-12'); if (resolve(r, 'evaplan', 'full', {}).verdict === 'bad') tired++; assert.equal(resolve(r, 'evaplan', 'rest', {}).verdict, 'good'); }
  assert.ok(tired > 10, `${tired}`);
});

test('the Titan lights and shuts down on the pad: the commander sits tight, and a quick fix misses a second cause', async () => {
  const { consoleStart, consolePoll, shutdownChoose } = await import('../js/mercury.js');
  const { nextDay, until } = await import('./play.js');
  toGem6(8);
  g.round.faults = { 'tail-plug': 'shutdown' }; g.round.dustcap = true;
  nextDay();
  const count = () => { consoleStart(); until(() => g.console?.poll || g.console?.phase === 'shutdown'); while (g.console?.poll) { consolePoll(true); until(() => g.console?.poll || g.console?.phase === 'shutdown'); } };
  count();
  assert.equal(g.console.phase, 'shutdown');
  shutdownChoose('plug');
  assert.equal(g.beat, 'mScrub');
  nextDay(); count();
  assert.equal(g.console.phase, 'shutdown', 'the dust cap shuts her down again');
  shutdownChoose('teardown');
  assert.ok(!Object.values(g.round.faults).includes('shutdown'));
  assert.ok(g.mission.shutdown.missedCap);
  assert.ok(g.slipDays >= 4);
});

test('a stuck thruster: the rule says come home at the next area, and holding them up a day is against it', () => {
  const r = titan(4);
  r.faults = { thrusters: 'thruster' };
  flightTruth(r, 'gem-8');
  const home = resolve(r, 'tumble', 'secondary', {});
  assert.equal(home.verdict, 'good'); assert.ok(home.set.secondary); assert.ok(home.endAt < 12);
  assert.equal(resolve(r, 'tumble', 'primary', {}).verdict, 'bad');
  const state = { secondary: true };
  assert.ok(geminiEntry(r, state).secondary);
});

test('a rendezvous flown on a computer that keeps resetting can miss; on the ground\'s solution it does not', () => {
  let missed = 0;
  for (let s = 1; s <= 40; s++) {
    const r = titan(s);
    r.faults = { computer: 'computer' };
    flightTruth(r, 'gem-6');
    if (!resolve(r, 'rdvplan', 'onboard', {}).capability) missed++;
    assert.equal(resolve(r, 'rdvplan', 'ground', {}).capability, 'rendezvous');
  }
  assert.ok(missed > 5 && missed < 35, `${missed}`);
});

// ---- A1: the Soviet programme ----
import { raceOf, raceNews, ATTEMPTS } from '../js/world/race.js';

test('the Soviet programme from 1966 goes differently from game to game, and waits on its own failures', () => {
  const runs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(raceOf);
  const soyuzWins = runs.filter(r => r.find(e => e.id === 'soyuz1').win).length;
  assert.ok(soyuzWins > 0 && soyuzWins < 12, `${soyuzWins}`);
  for (const r of runs) {
    // A crewed Zond flies only after Soyuz has worked.
    const z = r.find(e => e.id === 'zond-crewed');
    if (z) assert.ok(r.find(e => e.id === 'soyuz1').win);
    for (const e of r) assert.ok(ATTEMPTS.some(a => a.id === e.id));
  }
  assert.deepEqual(raceOf(5), raceOf(5));
  assert.ok(raceNews(5, 0, 1e9).length >= 4);
});

test('between Gemini flights from 1966, the notes carry the Soviet news', () => {
  toGem6(8);
  playMission(); advance(true);
  assert.equal(SEASON[g.roundIndex].id, 'gem-8');
  const soviet = raceNews(g.seed, SEASON.find(r => r.id === 'gem-6').start, SEASON[g.roundIndex].start);
  for (const l of soviet) assert.ok(g.away.lines.includes(l));
});

// ---- A2: the programme office and Apollo 6 ----
const toApollo6 = (seed, takeProgramme = true) => {
  toGem6(seed);
  playMission(); advance(true); g.room = null; playMission(); advance(true); g.room = null; // Gemini 6A, 8
  playMission(); // Gemini 12
  const o = g.record.offers.at(-1); if (!o.made) { o.made = true; o.answer = null; }
  advance(takeProgramme); g.room = null;
  assert.equal(SEASON[g.roundIndex].id, 'apollo-6');
};

test('the programme office runs Apollo 6: the Saturn V checked out, flight day from the viewing room, the programme\'s call yours', async () => {
  const { lookSpot, capsuleSpots } = await import('../js/mercury.js');
  toApollo6(8);
  assert.equal(g.record.seat, 'programme');
  assert.equal(g.vehicle, 'saturn5');
  assert.ok(capsuleSpots().includes('o2-tanks'));
  lookSpot('f1-engines');
  assert.ok(g.mission.checkout['f1-engines']);
  const asked = [];
  playMission({ sims: 0, decide: d => { asked.push(d.id); return Object.keys(d.options)[0]; } });
  const e = g.record.rounds.at(-1);
  assert.equal(e.id, 'apollo-6');
  if (!/^Lost/.test(e.flight)) assert.deepEqual(asked, ['pogo']);
});

test('as flight director you fly Apollo 6, and the programme\'s call is Hollis\'s', () => {
  toApollo6(8, false);
  assert.equal(g.record.seat, 'flight');
  const asked = [];
  playMission({ sims: 0, decide: d => { asked.push(d.id); return Object.keys(d.options)[0]; } });
  assert.ok(!asked.includes('pogo'));
  assert.equal(g.record.rounds.at(-1).id, 'apollo-6');
});

test('Apollo 1\'s fire is the hidden layer\'s, not a script: some games have it and some do not, and it brings the cabin fix', async () => {
  const { apolloFire } = await import('../js/world/race.js');
  const fires = Array.from({ length: 30 }, (_, i) => apolloFire(i + 1, initProgramme())).filter(Boolean).length;
  assert.ok(fires > 5 && fires < 25, `${fires}`);
  assert.equal(apolloFire(3, { ...initProgramme(), cabinRisk: 0 }), false);
});

test('flying a third empty Saturn V slips every Apollo flight after it', () => {
  const r = newRound(4, initProgramme(), 'saturn5');
  flightTruth(r, 'apollo-6');
  assert.equal(resolve(r, 'pogo', 'third', {}).slip, 60);
  assert.equal(resolve(r, 'pogo', 'crew', {}).verdict, 'good');
});

// ---- A3: the Apollo 8 decision, Apollo 8 and Apollo 10 ----
const toApollo8 = (seed, takeProgramme = false, choice = 'moon') => {
  toApollo6(seed, takeProgramme);
  playMission();
  assert.equal(g.beat, 'sApollo8');
  return choice;
};

test('August 1968: the Apollo 8 meeting decides whether Apollo 8 goes round the Moon, and it is played in phases', async () => {
  const { apollo8Decide, apollo8Done } = await import('../js/mercury.js');
  toApollo8(8);
  apollo8Decide('moon'); apollo8Done();
  assert.equal(g.beat, 'roundEnd');
  advance(true); g.room = null;
  assert.equal(SEASON[g.roundIndex].id, 'apollo-8');
  const asked = [];
  let phases = 0;
  playMission({ sims: 0, decide: (d, c) => { asked.push(d.id); phases = Math.max(phases, c.flight.phaseNo); return Object.keys(d.options)[0]; } });
  const e = g.record.rounds.at(-1);
  assert.equal(e.id, 'apollo-8');
  if (!/^Lost/.test(e.flight)) { assert.deepEqual(asked.filter(x => x !== 'navcheck'), ['tli', 'loi', 'mcc']); assert.ok(phases >= 6, `${phases}`); }
});

test('kept in Earth orbit, Apollo 8 flies ten days testing the spacecraft', async () => {
  const { apollo8Decide, apollo8Done } = await import('../js/mercury.js');
  toApollo8(8);
  apollo8Decide('earth'); apollo8Done(); advance(true); g.room = null;
  const asked = [];
  playMission({ sims: 0, decide: d => { asked.push(d.id); return Object.keys(d.options)[0]; } });
  if (!/^Lost/.test(g.record.rounds.at(-1).flight)) assert.ok(!asked.includes('tli'));
});

test('a service engine that failed its check, taken into lunar orbit, can strand a crew; the free return brings them home', () => {
  let stranded = 0;
  for (let s = 1; s <= 30; s++) {
    const r = newRound(s, initProgramme(), 'saturn5');
    r.faults = { sps: 'sps' };
    flightTruth(r, 'apollo-8');
    const go = resolve(r, 'loi', 'go', {});
    if (go.set.stranded) { stranded++; assert.equal(go.verdict, 'bad'); }
    const no = resolve(r, 'loi', 'nogo', {});
    assert.ok(no.set.home); assert.equal(no.verdict, 'good');
  }
  assert.ok(stranded > 5 && stranded < 25, `${stranded}`);
});

test('the last midcourse puts her in the corridor; skipping it leaves her where the trans-Earth burn pointed her', async () => {
  const { lunarEntry, entryAngleError } = await import('../js/truth/flights.js');
  let bad = 0;
  for (let s = 1; s <= 30; s++) {
    const r = newRound(s, initProgramme(), 'saturn5');
    const t = flightTruth(r, 'apollo-8');
    const burn = lunarEntry(r, resolve(r, 'mcc', 'burn', {}).set);
    assert.notEqual(burn.capsule, 'lost');
    const skip = lunarEntry(r, resolve(r, 'mcc', 'skip', {}).set);
    if (skip.capsule !== 'safe') bad++;
    assert.ok(Math.abs(entryAngleError(t)) <= 1.1);
  }
  assert.ok(bad > 2, `${bad}`);
});

test('an oxygen tank fails on the way out: the lander is the lifeboat', () => {
  const r = newRound(6, initProgramme(), 'saturn5');
  r.faults = { 'o2-tanks': 'tank' };
  flightTruth(r, 'apollo-10');
  const life = resolve(r, 'tank', 'freereturn', {});
  assert.ok(life.set.home); assert.equal(life.verdict, 'good');
});

test('Apollo 10 flies the rehearsal down to fifteen kilometres', async () => {
  const { apollo8Decide, apollo8Done } = await import('../js/mercury.js');
  toApollo8(8);
  apollo8Decide('moon'); apollo8Done(); advance(true); g.room = null;
  playMission({ sims: 0 }); advance(true); g.room = null;
  assert.equal(SEASON[g.roundIndex].id, 'apollo-10');
  const asked = [];
  playMission({ sims: 0, decide: d => { asked.push(d.id); return Object.keys(d.options)[0]; } });
  if (!/^Lost/.test(g.record.rounds.at(-1).flight) && !asked.includes('tank')) assert.ok(asked.includes('lowpass'), asked.join());
});

// ---- A4: Apollo 11 and 12, the landing, and getting the lander back ----
const toApollo11 = seed => {
  toApollo8(seed);
  return import('../js/mercury.js').then(({ apollo8Decide, apollo8Done }) => {
    apollo8Decide('moon'); apollo8Done(); advance(true); g.room = null;
    playMission({ sims: 0 }); advance(true); g.room = null; // Apollo 8
    playMission({ sims: 0 }); advance(true); g.room = null; // Apollo 10
    assert.equal(SEASON[g.roundIndex].id, 'apollo-11');
  });
};

test('Apollo 11 and 12 play from the count to the landing and home, in phases', async () => {
  await toApollo11(8);
  for (const id of ['apollo-11', 'apollo-12']) {
    assert.equal(SEASON[g.roundIndex].id, id);
    const asked = [];
    let phases = 0;
    playMission({ sims: 0, decide: (d, c) => { asked.push(d.id); phases = Math.max(phases, c.flight.phaseNo); return Object.keys(d.options)[0]; } });
    const e = g.record.rounds.at(-1);
    assert.equal(e.id, id);
    if (!/^Lost/.test(e.flight) && !asked.includes('tank') && asked.includes('loi')) {
      assert.ok(asked.includes(id === 'apollo-11' ? 'lowfuel' : 'landpoint'), asked.join());
      assert.ok(phases >= 7, `${phases}`);
    }
    if (id === 'apollo-11') { advance(true); g.room = null; }
  }
});

test('every new flight plan step asks a question that exists; the landing flights end on entry interface', () => {
  for (const id of ['apollo-11', 'apollo-12']) {
    const steps = FLIGHTS[id].steps;
    for (const s of steps) if (s.decide) assert.ok(DECISIONS[s.decide], `${id} ${s.decide}`);
    assert.ok(steps.at(-1).retro);
    for (const s of steps) if (s.decide && DECISIONS[s.decide].rule != null) assert.ok(FLIGHTS[id].rules[DECISIONS[s.decide].rule], `${id} ${s.decide} rule`);
  }
});

test('go on the program alarms usually lands; abort on them never does', () => {
  let landed = 0;
  for (let s = 1; s <= 40; s++) {
    const r = newRound(s, initProgramme(), 'saturn5');
    r.faults = { 'lm-computer': 'alarm' };
    flightTruth(r, 'apollo-11');
    if (!resolve(r, 'alarm', 'go', {}).set.noLanding) landed++;
    const ab = resolve(r, 'alarm', 'abort', {});
    assert.ok(ab.set.noLanding); assert.equal(ab.verdict, 'bad');
  }
  assert.ok(landed > 30, `${landed}`);
});

test('a weak ascent engine leaves the lander low: the command module going down for her is the best chance, and crews can be lost', () => {
  const won = { csm: 0, lmburn: 0, wait: 0 };
  for (let s = 1; s <= 60; s++) {
    const r = newRound(s, initProgramme(), 'saturn5');
    r.faults = { 'lm-ascent': 'ascent' };
    flightTruth(r, 'apollo-11');
    for (const k of Object.keys(won)) if (!resolve(r, 'rescue', k, {}).set.lmLost) won[k]++;
  }
  assert.ok(won.csm > won.lmburn && won.lmburn > won.wait, JSON.stringify(won));
  assert.ok(won.csm < 60, JSON.stringify(won));
});

test('a lander lost in lunar orbit: the command module pilot comes home alone, and two names go on the record', async () => {
  const { lunarEntry } = await import('../js/truth/flights.js');
  const r = newRound(3, initProgramme(), 'saturn5');
  flightTruth(r, 'apollo-11');
  const e = lunarEntry(r, { lmLost: true });
  assert.ok(e.lmLost);
});

test('the uplinked landing point puts Apollo 12 beside the Surveyor', () => {
  const r = newRound(5, initProgramme(), 'saturn5');
  flightTruth(r, 'apollo-12');
  const up = resolve(r, 'landpoint', 'update', {});
  assert.equal(up.capability, 'pinpoint'); assert.ok(up.set.landed);
  assert.ok(!resolve(r, 'landpoint', 'eye', {}).capability);
});
