// Aaron, 13 Nov: the rocket made no sound during the static firing, only at launch. The dugout is a stone's throw from
// the stand, so the firing must be clearly heard there, nearly as loud as a launch, with the thump as she lights.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soundPlan } from '../js/stage/fx/sound.js';

const launch = v =>
  soundPlan(
    {
      vehicle: v,
      day: 0,
      loop: [],
      rocket: { rise: 50 },
      flight: {
        t: 1,
        view: 'site',
        result: {
          path: [
            { t: 0, h: 0 },
            { t: 1, h: 0.1 },
          ],
          burn: 60,
        },
      },
    },
    'site',
  ).engine;

for (const v of ['wac', 'v2', 'viking'])
  test(`the ${v}'s static firing is heard in the dugout and on the site`, () => {
    const firing = where => soundPlan({ vehicle: v, day: 0, loop: [], standFlame: 1 }, where);
    const dug = firing('interior:dugout'),
      site = firing('site');
    // Loud enough to hear clearly, and to light the thump (soundFrame: engine > 0.2 and muffle < 0.5).
    assert.ok(dug.engine > 0.4 && dug.muffle < 0.5, `dugout ${dug.engine} / ${dug.muffle}`);
    assert.ok(site.engine >= dug.engine && site.muffle < dug.muffle);
    assert.ok(dug.engine >= 0.6 * launch(v), 'nearly as loud as a launch');
    // Before ignition and after shutdown, silence.
    assert.equal(soundPlan({ vehicle: v, day: 0, loop: [], standFlame: 0 }, 'interior:dugout').engine, 0);
  });
