// Corrections from the 10 and 11 November 2026 source pass (V0.7.5-RELEASE-PLAN.md, "10 November source pass").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FLIGHTS, DECISIONS } from '../js/data/flights.js';
import { FLIGHT_DRAWS } from '../js/truth/flights.js';

const said = id => JSON.stringify(FLIGHTS[id].steps);

test("Apollo 12's tracking puts the landing point short of the target, as it was in 1969", () => {
  assert.match(said('apollo-12'), /4,200 ft short/);
  assert.doesNotMatch(said('apollo-12'), /4,200 ft long|downrange of the target/);
  assert.match(DECISIONS.landpoint.q, /short of the target/);
});

test('The Artemis flybys pass the Moon at their real distances', () => {
  assert.match(said('artemis-1'), /a hundred and thirty kilometres/);
  assert.match(said('artemis-2'), /Six and a half thousand kilometres/);
  assert.doesNotMatch(said('artemis-1') + said('artemis-2'), /ixty-eight kilometres/);
});

test('MR-1 rose about four inches, not one', () => {
  assert.doesNotMatch(readFileSync(new URL('../js/mercury.js', import.meta.url), 'utf8'), /rose about an inch/);
});

test('The packaged app is tamper-checked: electron fuses on', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.build.electronFuses.onlyLoadAppFromAsar, true);
  assert.equal(pkg.build.electronFuses.enableEmbeddedAsarIntegrityValidation, true);
});

test('every draw a long-flight call reads is one the flight actually makes', () => {
  const src = readFileSync(new URL('../js/truth/flights.js', import.meta.url), 'utf8');
  const used = [...src.matchAll(/\bd\[(\d+)\]/g)].map(m => +m[1]);
  assert.ok(Math.max(...used) < FLIGHT_DRAWS, `d[${Math.max(...used)}] read, ${FLIGHT_DRAWS} drawn`);
});

// The calls-audit history fixes (13 November 2026, plans-review/CALLS-SEAT-AUDIT.md, "Other errors found").
test('The Artemis rounds carry no Saturn faults that SLS never draws', () => {
  for (const id of ['artemis-1', 'artemis-2', 'artemis-3', 'artemis-4'])
    for (const step of FLIGHTS[id].steps)
      assert.ok(!['lightning', 'cabin', 'tank', 'alarm', 'ascent'].includes(step.if), `${id} waits on ${step.if}`);
});

test("STS-1's tiles came off the OMS pods, and its backup was Northrup Strip, not the Cape", () => {
  assert.doesNotMatch(said('sts-1'), /bipod/);
  assert.match(said('sts-1'), /OMS pods/);
  assert.deepEqual(Object.keys(DECISIONS.tald.options), ['edwards', 'northrup']);
});

test("STS-97 held the second wing a day; Skylab 4's crew spoke up six weeks in; Dragon has no Shuttle engines", () => {
  assert.equal(DECISIONS.wings.auto, 'one');
  const pace = FLIGHTS['skylab-4'].steps.find(s => s.decide === 'pace');
  assert.ok(pace.at > 900, `pace at ${pace.at} h`);
  assert.doesNotMatch(said('demo-2'), /main engine shut down|OMS/);
});

test('Pioneer: JPL runs the spacecraft part of the count, and the Jupiter was fired in Huntsville, on tape', async () => {
  const { skipTo } = await import('../js/dev/skip.js');
  const G = await import('../js/game.js');
  const bot = await import('../js/dev/bot.js');
  skipTo('pioneer-3', { seed: 107, route: 'nasa' });
  const g = G.g;
  assert.ok(G.conducting(), 'the test conductor plays Pioneer');
  bot.playRound(() => 'nominal', undefined, 'staticPrep');
  bot.until(() => g.beat === 'static');
  assert.notEqual(g.rocket.where, 'stand', 'the Jupiter never goes on a stand at the Cape');
  G.standStart();
  bot.until(() => g.stand.phase === 'read');
  assert.equal(g.standFlame, 0);
  G.standDecide({ rework: false, leak: false });
  bot.nextDay();
  bot.until(() => g.beat === 'countReady');
  G.countStart();
  bot.until(() => g.count?.poll);
  assert.deepEqual(
    g.count.reports.map(r => r.station),
    ['LAUNCH TEAM', 'SPACECRAFT', 'TRACKING', 'RANGE'],
  );
});

test("V-2 and Bumper: GE's Hoyt runs the count, and on Bumper you answer for the WAC stage", async () => {
  const { skipTo } = await import('../js/dev/skip.js');
  const G = await import('../js/game.js');
  const bot = await import('../js/dev/bot.js');
  skipTo('bumper-1', { seed: 107, route: 'nasa' });
  const g = G.g;
  bot.playRound(() => 'nominal', undefined, 'countReady');
  G.countStart();
  bot.until(() => g.count?.poll);
  const asked = g.loop.filter(l => /report the WAC stage/.test(l.text));
  assert.equal(asked.at(-1)?.who, g.people.hoyt.name);
});
