// Golden traces for the round as the game saves it (ad-astra RoundState.ToJObject / FromJObject): the canonical text
// (campaign.mjs canonical) of rounds of every kind, fresh, after a static firing, after the stand's rework, and after
// a flight or a round that broke loose. record(write) writes roundjson.json.
import { canonical } from './campaign.mjs';
import { newRound, staticFire, standRework, fly, flyLoose } from '../../js/truth/round.js';
import { KITS } from '../../js/data/kits.js';

const SEEDS = [0, 1, 7, 1945, 0xffffffff];
const STAND = ['wac', 'aerobee', 'v2', 'bumper', 'viking', 'vanguard', 'juno', 'ranger'];
const LOT = { lotVehicle: 'wac', batch: { weld: true }, weldRisk: 0.9 };
const SHUTTLE = { cold: true, boostRisk: 0.7 };

export function record(write) {
  const cases = [];
  const add = (step, vehicle, seed, programme, r) => cases.push({ step, vehicle, seed, programme, canonical: canonical(r) });
  for (const vehicle of Object.keys(KITS))
    for (const seed of SEEDS) {
      const programme = vehicle === 'wac' && seed === 7 ? LOT : vehicle === 'shuttle' && seed === 1 ? SHUTTLE : null;
      const r = newRound(seed, programme, vehicle);
      add('new', vehicle, seed, programme, r);
      if (!STAND.includes(vehicle)) continue;
      staticFire(r, seed % 2 ? 'long' : 'short');
      add('stand', vehicle, seed, programme, r);
      standRework(r);
      add('rework', vehicle, seed, programme, r);
      if (seed === 0xffffffff) flyLoose(r);
      else fly(r);
      add('flight', vehicle, seed, programme, r);
    }
  write('roundjson.json', cases);
}
