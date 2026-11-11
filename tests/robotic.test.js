// JPL's robotic missions after Mariner 4: Viking 1 and 2, Voyager 2 and 1, Pathfinder, Cassini and Perseverance. Each
// round is a run of decision days (probe.steps). Every way through each round is played here on a few seeds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SEASON, onPath, LAST_WORD, BETWEEN } from '../js/data/campaign.js';
import * as game from '../js/game.js';

const { checkCheckpoint, checkpoint, newGame, nextIndex, roomFor, advanceProbe, probeStep } = game;
const ROBOTIC = [
  'surveyor-1',
  'mariner-9',
  'viking-mars',
  'voyager',
  'galileo',
  'pathfinder',
  'cassini',
  'perseverance',
];
const at = id => SEASON.findIndex(r => r.id === id);

// Play round `id` from its handover, making call picks[k] on the k-th decision day (0 when picks run out).
function play(id, picks, seed = 14) {
  newGame(seed);
  const round = SEASON[at(id)];
  newGame(seed, { ...checkpoint(), roundId: id, day: round.start, beat: 'probeHandover' });
  assert.equal(roomFor('office'), 'probeHandover');
  advanceProbe(true);
  const days = [],
    widths = [];
  for (let guard = 0; game.g.beat === 'probeEncounter' && guard < 20; guard++) {
    const step = probeStep();
    assert.ok(step, `${id}: no step on ${game.g.day}`);
    assert.equal(roomFor('office'), 'probeEncounter');
    days.push(game.g.day);
    widths.push(step.choices.length);
    // Every morning on the way is a checkpoint that resumes where it was.
    const saved = JSON.parse(JSON.stringify(checkpoint()));
    checkCheckpoint(saved);
    newGame(seed, saved);
    assert.equal(probeStep(), step);
    advanceProbe(picks[days.length - 1] ?? 0);
  }
  assert.ok(['roundEnd', 'seasonEnd'].includes(game.g.beat), `${id} stuck at ${game.g.beat}`);
  return { record: game.g.record.rounds.at(-1), days, widths };
}

// Every sequence of calls through a round.
function everyWay(id, seed) {
  const done = [];
  const queue = [[]];
  while (queue.length) {
    const picks = queue.shift();
    const run = play(id, picks, seed);
    if (picks.length < run.widths.length) for (let c = 0; c < run.widths[picks.length]; c++) queue.push([...picks, c]);
    else done.push({ picks, ...run });
  }
  return done;
}

test('the robotic missions follow Mariner 4 on the JPL route only, in launch order', () => {
  const jpl = SEASON.filter(r => onPath(r, 'jpl'))
    .sort((a, b) => a.start - b.start)
    .map(r => r.id);
  assert.deepEqual(jpl.slice(-(ROBOTIC.length + 1)), ['mariner-4', ...ROBOTIC]);
  for (const id of ROBOTIC) {
    assert.ok(!onPath(SEASON[at(id)], 'nasa'), id);
    assert.ok(BETWEEN[id]?.length, `${id} has news for the years before it`);
  }
  newGame(14);
  game.g.record.path = 'jpl';
  assert.equal(SEASON[nextIndex(at('mariner-4'))].id, 'surveyor-1');
  assert.ok(LAST_WORD.perseverance);
});

for (const id of ROBOTIC)
  test(`every way through ${id} closes the round before the next one starts`, () => {
    const round = SEASON[at(id)];
    const i = SEASON.map((r, n) => [r, n])
      .filter(([r]) => onPath(r, 'jpl') && r.start > round.start)
      .sort(([a], [b]) => a.start - b.start)[0];
    for (const seed of [14, 15, 16]) {
      const ways = everyWay(id, seed);
      assert.ok(ways.length >= 1);
      for (const w of ways) {
        assert.equal(w.record.id, id);
        assert.ok(w.record.flight.length > 20, `${id} ${w.picks}: ${w.record.flight}`);
        assert.ok(
          w.days.every((d, k) => d > round.start && (k === 0 || d >= w.days[k - 1])),
          `${id} ${w.picks}: days in order`,
        );
        assert.equal(w.record.day, w.days.at(-1));
        if (i) assert.ok(w.record.day < i[0].start, `${id} ${w.picks} runs into ${i[0].id}`);
      }
    }
  });

test('the same seed and the same calls end a round the same way', () => {
  const a = play('viking-mars', [1, 0, 1], 31).record.flight;
  assert.equal(play('viking-mars', [1, 0, 1], 31).record.flight, a);
});

test('a risky call loses spacecraft on some seeds and not others, and a loss leads the record', () => {
  const flights = [];
  for (let seed = 1; seed <= 40; seed++) flights.push(play('pathfinder', [1], seed).record.flight);
  const lost = flights.filter(f => /^Lost/.test(f)).length;
  assert.ok(lost > 4 && lost < 36, `${lost} of 40 lost`);
});

test("Voyager 1's call at Saturn decides whether Voyager 2 reaches Neptune", () => {
  for (let seed = 1; seed < 8; seed++) {
    const titan = play('voyager', [0, 0, 0], seed).record.flight;
    assert.match(titan, /Titan.*nitrogen/);
    assert.match(titan, /Neptune/);
    const pluto = play('voyager', [0, 0, 1], seed).record.flight;
    assert.match(pluto, /Pluto/);
    assert.doesNotMatch(pluto, /Neptune on/);
  }
});

test("Cassini's relay redesign is what brings Huygens's data home", () => {
  for (let seed = 1; seed < 8; seed++) {
    const fixed = play('cassini', [0, 0], seed).record.flight;
    if (/^Lost Cassini/.test(fixed)) continue;
    assert.match(fixed, /14 January 2005/);
    assert.match(play('cassini', [1, 0], seed).record.flight, /lost lock/);
  }
});

test('a probe round leaves no rocket on the site, and the JPL chief engineer changes over the decades', () => {
  newGame(14);
  newGame(14, {
    ...checkpoint(),
    roundId: 'perseverance',
    day: SEASON[at('perseverance')].start,
    beat: 'probeHandover',
  });
  assert.equal(game.g.rocket.where, 'gone');
  assert.notEqual(game.g.people.ellis.name, 'Ruth Ellis');
});
