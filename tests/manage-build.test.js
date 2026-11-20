// Building: new pads and a hangar on open plots, upgrades fitted to pads, the Building line paying for the work.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLOTS,
  BUILDS,
  UPGRADES,
  baseOf,
  padsOf,
  openPlots,
  startBuilding,
  startFitting,
  advanceBuilding,
  buildCover,
} from '../js/manage/build.js';
import { CAPE_1958_BASE, PREFABS, SIZE, coast } from '../js/manage/base.js';
import { newManagement, checkManagement, START_DAY } from '../js/manage/state.js';
import { appropriation, DEFAULT_SPLIT } from '../js/manage/budget.js';
import { programmeSchedule, setProgramme } from '../js/manage/programmes.js';
import { PAD_KINDS } from '../js/manage/manifest.js';

const fresh = () => {
  const g = newManagement(4);
  g.split = { ...DEFAULT_SPLIT };
  g.budget = appropriation(g.day, START_DAY, []);
  return g;
};
const days = (g, n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    g.day += 1;
    if (g.day > g.budget.end) g.budget = appropriation(g.day, START_DAY, []);
    out.push(...advanceBuilding(g, g.budget, START_DAY));
  }
  return out;
};
const tiles = b => {
  const p = PREFABS[b.kind],
    out = [];
  for (let x = b.tx; x < b.tx + p.w; x++) for (let y = b.ty; y < b.ty + p.d; y++) out.push([x, y]);
  return out;
};

test('every plot is on land, inside the map and clear of the 1958 base and of each other', () => {
  const used = new Set(CAPE_1958_BASE.flatMap(b => tiles(b).map(t => t.join())));
  for (const p of PLOTS) {
    const kind = BUILDS[p.kinds[0]].kind;
    for (const [x, y] of tiles({ kind, tx: p.tx, ty: p.ty })) {
      assert.ok(x >= 0 && y >= 0 && y < SIZE && x < coast(y), `${p.id} off the land at ${x},${y}`);
      assert.ok(!used.has(`${x},${y}`), `${p.id} overlaps at ${x},${y}`);
      used.add(`${x},${y}`);
    }
  }
});

test('a pad goes up on the works list, then joins the base and takes flights', () => {
  const g = fresh();
  assert.equal(startBuilding(g, 'lc-34', 'hangar'), null, 'a pad plot takes pads');
  assert.match(startBuilding(g, 'lc-34', 'thor'), /Work starts on Launch Complex 34/);
  assert.equal(startBuilding(g, 'lc-34', 'atlas'), null, 'one thing to a plot');
  assert.deepEqual(
    g.works.map(w => [w.id, w.kind, w.tx, w.ty, w.progress]),
    [['lc-34', 'pad', 20, 38, 0]],
  );
  assert.ok(!openPlots(g).some(p => p.id === 'lc-34'));
  const log = days(g, BUILDS.thor.days + 5);
  assert.ok(log.some(l => /Launch Complex 34 is finished/.test(l)));
  assert.deepEqual(g.works, []);
  assert.ok(baseOf(g).some(b => b.id === 'lc-34' && b.padKind === 'thor'));
  assert.ok(padsOf(g).some(p => p.id === 'lc-34' && p.kind === 'thor'));
  // TIROS flights (no pad named) can now go from either Thor pad.
  setProgramme(g, 'tiros', 'running');
  const pads = new Set(
    programmeSchedule(g, START_DAY)
      .flights.filter(f => f.programme === 'tiros')
      .map(f => f.pad),
  );
  assert.ok([...pads].every(p => p === 'lc-17a' || p === 'lc-34'));
});

test('work slows in proportion when the Building line is short, and never stops for good', () => {
  const g = fresh();
  g.split = { programmes: 90, building: 5, staff: 5 };
  startBuilding(g, 'lc-12', 'atlas');
  startBuilding(g, 'lc-19', 'atlas');
  const cover = buildCover(g, g.budget, START_DAY);
  assert.ok(cover < 0.5, `${cover}`);
  days(g, 30);
  for (const w of g.works) assert.ok(Math.abs(w.progress - (30 * cover) / BUILDS.atlas.days) < 1e-9);
});

test('upgrades shorten a pad’s turnaround, and the scheduler uses it', () => {
  const g = fresh();
  g.split = { programmes: 50, building: 40, staff: 10 }; // enough to pay for both at once
  const before = padsOf(g).find(p => p.id === 'lc-17a');
  assert.deepEqual([before.before, before.after], [PAD_KINDS.thor.before, PAD_KINDS.thor.after]);
  assert.match(startFitting(g, 'lc-17a', 'tower'), /fitted with a taller service tower/);
  assert.equal(startFitting(g, 'lc-17a', 'tower'), null, 'not twice');
  startFitting(g, 'lc-17a', 'deflector');
  const log = days(g, UPGRADES.tower.days + 1);
  assert.ok(log.some(l => l.startsWith('Launch Complex 17A now has a taller service tower')));
  assert.deepEqual(g.fitted['lc-17a'].sort(), ['deflector', 'tower']);
  const after = padsOf(g).find(p => p.id === 'lc-17a');
  assert.ok(after.before < before.before && after.after < before.after);
  const f = programmeSchedule(g, START_DAY).flights.find(x => x.pad === 'lc-17a');
  assert.equal(f.onPad, f.launch - after.before);
});

test('a finished hangar shortens every pad’s time before a launch', () => {
  const g = fresh();
  const was = padsOf(g).map(p => p.before);
  startBuilding(g, 'hangar-ae', 'hangar');
  days(g, BUILDS.hangar.days + 1);
  padsOf(g).forEach((p, i) => assert.ok(p.before < was[i], p.id));
});

test('building saves and loads, and bad records are refused', () => {
  const g = fresh();
  startBuilding(g, 'lc-34', 'redstone');
  startFitting(g, 'lc-5', 'umbilical');
  days(g, 70);
  const back = JSON.parse(JSON.stringify(g));
  checkManagement(back);
  assert.deepEqual(baseOf(back), baseOf(g));
  assert.throws(() => checkManagement({ ...back, works: [{ ...back.works[0], id: 'the-moon' }] }));
  assert.throws(() => checkManagement({ ...back, fitted: { 'lc-5': ['laser'] } }));
  assert.throws(() =>
    checkManagement({ ...back, fitting: [{ pad: 'lc-5', slot: 'tower', cost: 1, days: 0, progress: 0 }] }),
  );
});
