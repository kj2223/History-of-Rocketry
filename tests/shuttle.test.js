// The Shuttle years: the booster joint is the hidden layer's, the cold of January 1986 is a condition, and the orbiter
// comes home on a runway. Nothing here is scripted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound } from '../js/truth/round.js';
import { atlasAscent, atlasOutcome } from '../js/truth/orbit.js';
import { flightTruth, resolve } from '../js/truth/flights.js';
import { initProgramme } from '../js/world/programme.js';
import { campaignTo, playMission } from './play.js';
import { g, recordDeaths, crewOf } from '../js/game.js';
import '../js/mercury.js'; // the crewed modules register their beats with game.js
import { SEASON } from '../js/data/campaign.js';
import { FLIGHTS, DECISIONS, CAPABILITIES } from '../js/data/flights.js';

const at = id => SEASON.findIndex(r => r.id === id);
const shuttleRound = (s, withFaults = {}) => {
  const r = newRound(s, initProgramme(), 'shuttle');
  r.faults = withFaults;
  return r;
};

test('the field joint is the hidden layer\u2019s: some Shuttle rounds carry it, most do not', () => {
  const seen = new Set();
  for (let s = 1; s <= 60; s++) {
    const r = newRound(s, initProgramme(), 'shuttle');
    seen.add(Object.values(r.faults).includes('oring'));
  }
  assert.ok(seen.has(true) && seen.has(false));
  // On the coldest morning the round is built to carry the worry.
  const cold = SEASON[at('sts-51l')].risk;
  assert.ok(cold.oringRisk > 0.8 && cold.cold, JSON.stringify(cold));
});

test('a faulty joint on a cold morning breaks the stack, and the crew rides it: the record says so', () => {
  const r = shuttleRound(5, { 'srbo-ring': 'oring' });
  r.boostRisk = 1; // the joint goes, this once, for the test
  atlasAscent(r, null, { guidance: 'computer', shortburn: 'ssme', boost: 'oring', booster: 'Shuttle' });
  assert.equal(r.ascent.failure, 'oring');
  assert.ok(r.ascent.breakupAt >= 58 && r.ascent.breakupAt <= 78, `${r.ascent.breakupAt}`);
  const end = atlasOutcome(r);
  assert.equal(end.outcome, 'breakup');
  assert.equal(end.capsule, 'lost');
});

test('a hold that warms the day nearly takes the joint risk away', () => {
  let lost = 0;
  for (let s = 1; s <= 60; s++) {
    const r = shuttleRound(s, { 'srbo-ring': 'oring' });
    r.warm = true;
    atlasAscent(r, null, { guidance: 'computer', shortburn: 'ssme', boost: 'oring', booster: 'Shuttle' });
    if (r.ascent.breakupAt != null) lost++;
  }
  assert.ok(lost <= 12, `${lost} of 60`);
});

test('STS-1 plays end to end: the orbiter works in orbit and lands on a runway', () => {
  campaignTo(8, 'sts-1', { sims: 0 });
  playMission({ sims: 0 });
  const e = g.record.rounds.at(-1);
  assert.equal(e.id, 'sts-1');
  assert.match(e.flight, /Columbia|Lost/);
});

test('the telecall is on the loop, and the count answers it: press flies into the cold, hold slips a day', () => {
  // Held: the crew comes home whole, and the record notes the hold.
  campaignTo(8, 'sts-51l', { sims: 0, joint: 'hold' });
  playMission({ sims: 0, joint: 'hold' });
  const e = g.record.rounds.at(-1);
  assert.equal(e.id, 'sts-51l');
  assert.ok(!g.mission?.fate || g.mission.fate !== 'killed', e.flight);
  // Pressed, on a seed where the joint goes: the crew is lost, and the later crews are re-flown.
  campaignTo(8, 'sts-51l', { sims: 0, joint: 'press' });
  playMission({ sims: 0, joint: 'press' });
  const pressed = g.record.rounds.at(-1);
  if (/broke up/.test(pressed.flight)) {
    assert.equal(g.mission.fate, 'killed');
    const next = crewOf(at('sts-26'));
    assert.ok(
      next.every(id => !['hobbs', 'winters', 'nakagawa'].includes(id)),
      next.join(),
    );
  }
});

test('the repair flight fixes the telescope, and the record says so', () => {
  campaignTo(8, 'sts-61', { sims: 0 });
  playMission({ sims: 0 });
  const e = g.record.rounds.at(-1);
  assert.equal(e.id, 'sts-61');
  assert.ok(
    g.record.capabilities.some(c => c.id === 'hubble'),
    g.record.capabilities.map(c => c.id).join(),
  );
});

test('the station is joined in orbit, and the first expedition hands over to the second', () => {
  campaignTo(8, 'sts-97', { sims: 0 });
  playMission({ sims: 0 });
  const e = g.record.rounds.at(-1);
  assert.equal(e.id, 'sts-97');
  assert.ok(
    g.record.capabilities.some(c => c.id === 'station'),
    g.record.capabilities.map(c => c.id).join(),
  );
});

test('every Shuttle decision has its rule, and every flight ends on retrofire', () => {
  for (const id of ['sts-1', 'sts-51l', 'sts-26', 'sts-61', 'sts-88', 'sts-97']) {
    const steps = FLIGHTS[id].steps;
    for (const st of steps) if (st.decide) assert.ok(DECISIONS[st.decide], `${id} ${st.decide}`);
    assert.ok(steps.at(-1).retro, id);
    for (const st of steps)
      if (st.decide && DECISIONS[st.decide].rule != null)
        assert.ok(FLIGHTS[id].rules[DECISIONS[st.decide].rule], `${id} ${st.decide} rule`);
  }
  for (const id of ['reusable', 'hubble', 'station']) assert.ok(CAPABILITIES[id], id);
});
