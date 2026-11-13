// Issue #248 (Aaron's playtest mark 16, Viking 9 rollout): the pad crew walking past the blockhouse showed up inside
// it for a moment. A building counts the people staying there, not the ones only passing its door.
import test from 'node:test';
import assert from 'node:assert/strict';
import { g, tick, closeAway, finishPlan, finishInspection, finishBoard, standStart, standDecide } from '../js/game.js';
import { inside } from '../js/site/interiors.js';
import { PLACES, staysNear } from '../js/data/white-sands.js';
import { campaignTo, until, nextDay } from './play.js';

test('someone walking past a building is not in it; someone walking in or standing there is', () => {
  const near = x => Math.abs(x - 500) < 100;
  assert.equal(staysNear({ x: 500, target: 1200 }, near), false);
  assert.equal(staysNear({ x: 450, target: 520 }, near), true);
  assert.equal(staysNear({ x: 500, target: 500 }, near), true);
  assert.equal(staysNear({ x: 500 }, near), true);
});

test('during a rollout nobody walking past the blockhouse is drawn inside it', () => {
  campaignTo(28, 'viking-9');
  closeAway();
  finishPlan({ inspector: 'you', burn: 'short', leak: false });
  if (g.plan.inspector !== 'you') until(() => g.beat === 'board');
  if (g.beat === 'brief') finishInspection({});
  finishBoard();
  nextDay();
  until(() => g.beat === 'static');
  standStart();
  until(() => g.stand.phase === 'read');
  standDecide({ rework: false, leak: false });
  if (g.beat === 'afterStatic') nextDay();
  until(() => g.beat === 'rollout' || g.beat === 'count');
  assert.equal(g.beat, 'rollout');
  const door = PLACES.blockhouse.door;
  let passers = 0;
  for (let i = 0; i < 20000 && g.beat === 'rollout'; i++) {
    g.speed = 4;
    tick(0.05);
    const here = new Set(inside(g, 'blockhouse', 180).map(p => p.id));
    for (const p of Object.values(g.people)) {
      if (p.hidden || Math.abs(p.x - door) >= 180 || Math.abs(p.target - door) < 400) continue;
      passers++;
      assert.ok(!here.has(p.id), `${p.id} walking past to ${Math.round(p.target)} is drawn in the blockhouse`);
    }
    if (g.dayDone) break;
  }
  assert.ok(passers > 0, 'someone walked past the blockhouse door during the rollout');
});
