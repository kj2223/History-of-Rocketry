// Golden traces for the port's count: the launch-morning call (js/truth/aim.js), the decay test (js/truth/decay.js)
// and a station's call in the count (js/truth/round.js stationCall). record(write) writes count.json; the C# replays it
// in ad-astra's AdAstra.Rules.Tests/CountGoldenTests.cs.
import { newRound, hasLeak, windOf, stationCall } from '../../js/truth/round.js';
import {
  AIMED,
  WEATHERCOCK,
  CLEARED_KM,
  OFF_RANGE_KM,
  MAX_LAY,
  crosswindAt,
  balloonAt,
  layFor,
  crossImpact,
  landingOf,
  wreckFound,
  sideText,
} from '../../js/truth/aim.js';
import { DECAY_MINUTES_PER_SECOND, DECAY_START, decayRates, decayReading, airTemp } from '../../js/truth/decay.js';

const SEEDS = [0, 1, 2, 7, 42, 1945, 123456789, 0x7fffffff, 0xffffffff, 314159];
// Campaign minutes across a launch morning (and the day after), whole and fractional, either side of the gust and
// balloon steps.
const MINUTES = [
  0, 1, 5.5, 6, 11.99, 59, 300, 360, 365.25, 419.5, 420, 480, 540, 599, 600, 719, 720, 1000, 1439, 1800, 3280,
];
const CROSSES = [
  -40, -30, -23, -22.3, -22.2, -15, -8, -5, -3.3, -1, -0.5, 0, 0.5, 1, 1.5, 3.3, 5, 8.9, 15, 22.2, 22.3, 23, 30, 40,
];
const LAYS = [-12, -10, -6.5, -2.5, 0, 0.5, 3, 7.5, 10, 12];
const RANGES = [0, 18, 30, 60, 120];
const YS = [0, 1.2, -4.99, 5, -5, 5.0001, -5.0001, 8, -11.5, 12, -12, 12.01, -12.01, 30, -60];
const SIDES = [
  0, 0.04, -0.049, 0.05, -0.05, 0.15, 0.25, 0.35, -0.95, 0.96, 1.05, 1.25, -2.45, 2.5, 4, -4, 10.04, 12.3456, -33.75,
];
const MINUTE_OF_DAY = [0, 300, 359, 360, 420, 479, 480, 600, 719, 720, 839, 840, 900, 959, 960, 1080, 1199, 1200, 1439];
const LOCKED = [0, 0.25, 0.5, 0.75, 1, 2.75, 5, 10, 15, 30, 59.9];
const CALLS = [
  [true, 0],
  [false, 0],
  [false, 0.3],
  [false, 1],
  [true, 0.5],
  [false, 0.09],
  [false, 0.3 * 0.3],
  [false, 0.5],
  [true, 1],
  [false, 0.15],
];

export function record(write) {
  write('count.json', {
    constants: { AIMED, WEATHERCOCK, CLEARED_KM, OFF_RANGE_KM, MAX_LAY, DECAY_MINUTES_PER_SECOND, DECAY_START },
    aim: SEEDS.map(seed => ({
      seed,
      kmh: windOf(seed).kmh,
      minutes: MINUTES.map(minute => ({ minute, cross: crosswindAt(seed, minute), balloon: balloonAt(seed, minute) })),
      wreck: YS.map(y => ({ y, found: wreckFound(seed, y) })),
    })),
    lays: CROSSES.map(cross => ({ cross, lay: layFor(cross) })),
    impacts: RANGES.flatMap(x =>
      LAYS.flatMap(lay => CROSSES.map(cross => ({ x, lay, cross, y: crossImpact(x, lay, cross) }))),
    ),
    landings: YS.map(y => ({ y, landing: landingOf(y) })),
    sides: SIDES.flatMap(v => [' km', '°'].map(unit => ({ v, unit, text: sideText(v, unit) }))),
    decay: SEEDS.flatMap(seed =>
      ['wac', 'aerobee', 'v2'].map(vehicle => {
        const r = newRound(seed, null, vehicle);
        return {
          seed,
          vehicle,
          leak: hasLeak(r),
          day: MINUTE_OF_DAY.map(minuteOfDay => {
            const rates = decayRates(r, minuteOfDay);
            return {
              minuteOfDay,
              rates,
              air: airTemp(seed, minuteOfDay),
              readings: LOCKED.map(minutes => decayReading(r, rates, minutes)),
            };
          }),
        };
      }),
    ),
    calls: SEEDS.flatMap(seed =>
      ['wac', 'aerobee'].map(vehicle => {
        const r = newRound(seed, null, vehicle);
        const start = r.rng.observation.state;
        return {
          seed,
          vehicle,
          start,
          calls: CALLS.map(([inBand, lazyGo]) => ({
            inBand,
            lazyGo,
            go: stationCall(r, inBand, lazyGo),
            observation: r.rng.observation.state,
          })),
          streamEnd: { physical: r.rng.physical.state, forecast: r.rng.forecast.state },
        };
      }),
    ),
  });
}
