// Sounding rockets and the lunar shots' first minutes, flown a stage at a time (data/stacks.js, truth/stages.js): a good
// round reaches the physical layer's apogee, and a round that loses its thrust, or whose upper stage never lights, flies on
// from where its stages really left her.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SOUNDING_STACKS } from '../js/data/stacks.js';
import { flySounding } from '../js/truth/stages.js';
import { BASE } from '../js/truth/physical.js';
import { newRound, fly } from '../js/truth/round.js';
import { initProgramme } from '../js/world/programme.js';

const tilt = (4 * Math.PI) / 180;

for (const v of ['wac', 'v2', 'aerobee', 'viking', 'bumper']) {
  test(`${v}: a good round reaches the physical layer's apogee and comes down`, () => {
    const apogee = BASE[v]['vehicle.apogee'],
      f = flySounding(SOUNDING_STACKS[v], { apogee, tilt });
    assert.ok(Math.abs(f.apogee - apogee) / apogee < 0.01, `${f.apogee} km`);
    assert.equal(f.path.at(-1).h, 0);
    assert.equal(
      f.burn,
      SOUNDING_STACKS[v].stages.reduce((a, s) => a + s.burn, 0),
    );
    // The later the thrust is lost, the higher she goes.
    let last = 0;
    for (let at = 5; at < f.burn; at += 5) {
      const cut = flySounding(SOUNDING_STACKS[v], { apogee, tilt, cutAt: at }).apogee;
      assert.ok(cut >= last && cut < apogee, `cut at ${at}: ${cut}`);
      last = cut;
    }
  });
}

test('Bumper: a WAC that never lights leaves her at the height the V-2 alone threw her', () => {
  const apogee = BASE.bumper['vehicle.apogee'],
    stack = SOUNDING_STACKS.bumper;
  const good = flySounding(stack, { apogee, tilt }),
    noWac = flySounding(stack, { apogee, tilt, cutAt: stack.stages[0].burn });
  assert.ok(noWac.apogee < good.apogee * 0.5, `${noWac.apogee} km against ${good.apogee}`);
  // Where she was at V-2 burnout: still climbing, and the peak is that height plus what her speed carries her.
  const atSep = noWac.path[stack.stages[0].burn];
  assert.ok(atSep.h > 0 && atSep.h < noWac.apogee);
});

test('the flight a round flies comes from its stages: a lost round stops climbing where its thrust ended', () => {
  for (let s = 1; s < 120; s++) {
    const r = newRound(s, initProgramme(), 'bumper'),
      f = fly(r);
    if (!f.failure) continue;
    const peakAt = f.path.find(p => p.h === f.apogee).t;
    assert.ok(peakAt >= f.failAt, `seed ${s}: peak at ${peakAt}, thrust lost at ${f.failAt}`);
    const burnout = f.path[f.failAt];
    assert.ok(burnout.h <= f.apogee);
    return;
  }
  assert.fail('no lost Bumper round in 120 seeds');
});
