// Golden traces for the stand's reworks (js/truth/round.js: the has*Fault checks, reworkIgniter and its kin, and
// standRework, which picks the rework for the round's stand stage). record(write) writes rework.json; the C# replays it
// in ad-astra's AdAstra.Rules.Tests/ReworkGoldenTests.cs. No draws: a rework changes a revision and adds an event.
import {
  newRound,
  hasIgniterFault,
  hasPumpFault,
  hasTurbineFault,
  hasInjectorFault,
  hasDepletionFault,
  hasAgenaFault,
  hasLinerFault,
  hasHolddownFault,
  standRework,
} from '../../js/truth/round.js';

const SEEDS = [0, 1, 2, 7, 42, 1945, 123456789, 0x7fffffff, 0xffffffff, 314159];
const VEHICLES = ['wac', 'aerobee', 'v2', 'bumper', 'viking', 'vanguard', 'juno', 'ranger'];
const REVISION_KEYS = ['igniter', 'turbopump', 'sustainer', 'viking', 'vanguard', 'juno', 'ranger'];

const checks = r => ({
  igniter: hasIgniterFault(r),
  pump: hasPumpFault(r),
  turbine: hasTurbineFault(r),
  injector: hasInjectorFault(r),
  depletion: hasDepletionFault(r),
  agena: hasAgenaFault(r),
  liner: hasLinerFault(r),
  holddown: hasHolddownFault(r),
});
const revisions = r => Object.fromEntries(REVISION_KEYS.map(k => [k, r[k] ?? null]));

export function record(write) {
  const cases = [];
  for (const vehicle of VEHICLES)
    for (const seed of SEEDS) {
      const r = newRound(seed, null, vehicle);
      const before = checks(r);
      const eventsBefore = r.events.length;
      standRework(r);
      cases.push({
        vehicle,
        seed,
        latent: r.physical.latentMechanisms,
        before,
        after: checks(r),
        events: r.events.slice(eventsBefore),
        revisions: revisions(r),
      });
    }
  write('rework.json', cases);
}
