// TELEMETRY CHANNELS (v0.8, scene layer step 1): the standard set of readings for each stage that goes on the stand,
// before ignition (the count) and while it fires (the static fire). The PixiJS scenes draw these as dials, lamps,
// tachometers and pen traces, so nearly every reading about the rocket is in the scene and only the decision is in the
// panel.
//
// Rules:
// - The channels are driven by the same hidden faults as the rest of the game, and show a fault only where the game
//   already lets it show: a leak bleeds tank pressure (tankGauge), a start-up fault is a rough chamber, a late sag is a
//   sagging chamber, a bad liner is a hot wall on the long firing. The new channels move with those (a pump's tachometer
//   sags with its chamber, thrust follows the chamber), so they add things to read but no new way to find a fault that
//   was hidden before. The one new tell: a leak now shows on the tank it is really on (oxidiser, fuel, or the
//   pressurant bottle), not on one generic gauge.
// - The tank that leaks reads exactly what tankGauge reads, so the existing count gauge and these channels agree.
// - Gauge noise comes from a hash of the round's seed and the moment, never from the round's random streams, so reading
//   the channels every frame changes nothing in the game.
// Figures marked ~ are stand-in values close to the real engines, for the gauges' scale; the game's rules don't use them.
import { tankGauge, hasLeak } from './round.js';
import { KITS } from '../data/kits.js';

export const TANK_BAND = [22, 24]; // bar, as NORMAL_TANK in game.js

// Each stage family: its propellants, how it feeds them, ~rated thrust (kN), ~full burn (s), ~pump speed (rpm).
export const FAMILIES = {
  'wac-upper': { fuel: 'Aniline', ox: 'Nitric acid', feed: 'helium', thrust: 6.7, burn: 47 },
  v2: { fuel: 'Alcohol', ox: 'Liquid oxygen', feed: 'pump', gas: 'Steam generator', thrust: 270, burn: 65, rpm: 3800 },
  'aerobee-sustainer': { fuel: 'Aniline', ox: 'Nitric acid', feed: 'helium', thrust: 18, burn: 50 },
  viking: {
    fuel: 'Alcohol',
    ox: 'Liquid oxygen',
    feed: 'pump',
    gas: 'Steam generator',
    thrust: 89,
    burn: 75,
    rpm: 7200,
  },
  'vanguard-1': {
    fuel: 'Kerosene',
    ox: 'Liquid oxygen',
    feed: 'pump',
    gas: 'Gas generator',
    thrust: 125,
    burn: 145,
    rpm: 9000,
  },
  jupiter: {
    fuel: 'Kerosene',
    ox: 'Liquid oxygen',
    feed: 'pump',
    gas: 'Gas generator',
    thrust: 670,
    burn: 157,
    rpm: 6300,
  },
  agena: { fuel: 'UDMH', ox: 'Nitric acid', feed: 'pump', gas: 'Gas generator', thrust: 71, burn: 120, rpm: 24000 },
};
const NOMINAL_PC = {
  'wac-upper': 20,
  v2: 15.5,
  'aerobee-sustainer': 20.5,
  viking: 21,
  'vanguard-1': 21,
  jupiter: 21,
  agena: 20,
};

// The stage on the stand for a round's vehicle (the same choice as standStage in round.js).
export const standStageOf = vehicle =>
  ({
    juno: 'jupiter',
    ranger: 'agena',
    vanguard: 'vanguard-1',
    viking: 'viking',
    aerobee: 'aerobee-sustainer',
    v2: 'v2',
    bumper: 'v2',
  })[vehicle || 'wac'] || 'wac-upper';

// Which tank a leak at an inspection spot drains: the oxidiser side, the fuel side, or the pressurant.
const LEAK_SIDE = {
  fitting: 'ox',
  'lox-valve': 'ox',
  'lox-line': 'ox',
  'lox-feed': 'ox',
  'atlas-lox': 'ox',
  'alc-valve': 'fuel',
  'fuel-valve': 'fuel',
  'fuel-press': 'fuel',
  pressure: 'bottle',
  'atlas-press': 'bottle',
};
export function leakSide(round) {
  if (!hasLeak(round)) return null;
  const id = Object.keys(round.faults).find(k => round.faults[k] === 'leak');
  return LEAK_SIDE[id] || 'ox';
}

const lox = fam => fam.ox === 'Liquid oxygen';

// The channels a stage carries: id, label, unit, the station that watched it, how the scene shows it, its green band.
export function channelsFor(round) {
  const stage = standStageOf(round.vehicle),
    fam = FAMILIES[stage],
    pc = KITS[round.vehicle || 'wac']?.stand?.pc || [17, 23];
  const list = [
    {
      id: 'tank.ox',
      label: `${fam.ox} tank`,
      unit: 'bar',
      station: 'press',
      show: 'dial',
      band: TANK_BAND,
      range: [0, 30],
    },
    {
      id: 'tank.fuel',
      label: `${fam.fuel} tank`,
      unit: 'bar',
      station: 'press',
      show: 'dial',
      band: TANK_BAND,
      range: [0, 30],
    },
    fam.feed === 'helium'
      ? {
          id: 'bottle',
          label: 'Helium bottle',
          unit: 'bar',
          station: 'press',
          show: 'dial',
          band: [140, 160],
          range: [0, 200],
        }
      : {
          id: 'bottle',
          label: `${fam.gas} supply`,
          unit: 'bar',
          station: 'press',
          show: 'dial',
          band: [28, 34],
          range: [0, 40],
        },
    {
      id: 'loaded',
      label: 'Propellant loaded',
      unit: '%',
      station: 'press',
      show: 'bar',
      band: [97, 100],
      range: [0, 100],
    },
    { id: 'igniter', label: 'Igniter continuity', unit: '', station: 'firing', show: 'lamp' },
    { id: 'bus', label: 'Firing bus', unit: 'V', station: 'firing', show: 'dial', band: [26, 30], range: [0, 35] },
    { id: 'pc', label: 'Chamber pressure', unit: 'bar', station: 'stand', show: 'trace', band: pc, range: [0, 30] },
    {
      id: 'thrust',
      label: 'Thrust',
      unit: 'kN',
      station: 'stand',
      show: 'dial',
      band: [fam.thrust * 0.9, fam.thrust * 1.1],
      range: [0, fam.thrust * 1.3],
    },
    { id: 'left', label: 'Propellant left', unit: '%', station: 'stand', show: 'bar', range: [0, 100] },
  ];
  if (lox(fam))
    list.push({
      id: 'lox.temp',
      label: 'Oxygen temperature',
      unit: '°C',
      station: 'press',
      show: 'dial',
      band: [-185, -180],
      range: [-200, -150],
    });
  if (fam.rpm)
    list.push({
      id: 'rpm',
      label: 'Turbopump speed',
      unit: 'rpm',
      station: 'stand',
      show: 'tach',
      band: [fam.rpm * 0.95, fam.rpm * 1.05],
      range: [0, fam.rpm * 1.25],
    });
  if (stage === 'aerobee-sustainer')
    list.push({
      id: 'wall',
      label: 'Chamber wall',
      unit: 'K',
      station: 'stand',
      show: 'trace',
      band: [300, 900],
      range: [250, 1200],
    });
  return list;
}

// Gauge flutter from the seed, the channel and the moment: the same every time it is read.
function jitter(seed, salt, step) {
  let h = Math.imul((seed | 0) ^ Math.imul(salt + 1, 0x9e3779b1) ^ Math.imul(step + 7, 2654435761), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296 - 0.5;
}
const SALT = { 'tank.ox': 1, 'tank.fuel': 2, bottle: 3, loaded: 4, bus: 5, 'lox.temp': 6, rpm: 7, thrust: 8 };
const wobble = (round, id, s, size, every = 4) => jitter(round.seed ?? 1, SALT[id] ?? 9, Math.floor(s / every)) * size;
const round1 = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

// The readings before ignition, at count second s (seconds since the count began, as g.count.since).
export function countReadings(round, s) {
  const fam = FAMILIES[standStageOf(round.vehicle)],
    side = leakSide(round);
  const steadyTank = id => 23 + wobble(round, id, s, 0.3);
  const leaking = tankGauge(round, s);
  const r = {
    'tank.ox': side === 'ox' ? leaking : steadyTank('tank.ox'),
    'tank.fuel': side === 'fuel' ? leaking : steadyTank('tank.fuel'),
    loaded: round1(
      Math.min(
        100,
        100 - (side && side !== 'bottle' ? Math.min(4, s * 0.004) : 0) + wobble(round, 'loaded', s, 0.4, 10),
      ),
    ),
    igniter: true,
    bus: round1(28 + wobble(round, 'bus', s, 0.6)),
    // The engine channels read nothing until ignition: shown as a dash, never as out of band.
    pc: null,
    thrust: null,
    left: 100,
  };
  // The pressurant: a leak in its line drains the bottle and, more slowly, both tanks with it.
  if (fam.feed === 'helium')
    r.bottle = round1(150 - (side === 'bottle' ? Math.min(60, s * 0.1) : 0) + wobble(round, 'bottle', s, 1.5));
  else r.bottle = round1(31 + wobble(round, 'bottle', s, 0.6));
  if (side === 'bottle') r['tank.ox'] = r['tank.fuel'] = leaking;
  if (lox(fam)) r['lox.temp'] = round1(-183 + wobble(round, 'lox.temp', s, 0.8, 8));
  if (fam.rpm) r.rpm = null;
  return r;
}

// The readings while it fires, t seconds after ignition, from a firing staticFire returned ({ trace, wall }). Between
// trace points the values are interpolated; past the end they hold the last point.
export function fireReadings(round, fire, t) {
  const stage = standStageOf(round.vehicle),
    fam = FAMILIES[stage],
    nominal = NOMINAL_PC[stage],
    side = leakSide(round);
  const tr = fire.trace,
    last = tr[tr.length - 1];
  const at = key => {
    if (t <= tr[0].t) return tr[0][key];
    if (t >= last.t) return last[key];
    const i = tr.findIndex(p => p.t >= t),
      a = tr[i - 1],
      b = tr[i],
      k = (t - a.t) / (b.t - a.t);
    return a[key] == null ? b[key] : a[key] + (b[key] - a[key]) * k;
  };
  const pc = Math.max(0, at('pc')),
    tank = at('tank'),
    ratio = pc / nominal;
  const r = {
    pc: round1(pc, 2),
    thrust: round1(fam.thrust * ratio),
    'tank.ox':
      side === 'ox' || side === 'bottle' ? round1(tank, 2) : round1(23 + wobble(round, 'tank.ox', t * 10, 0.3), 2),
    'tank.fuel':
      side === 'fuel' || side === 'bottle' ? round1(tank, 2) : round1(23 + wobble(round, 'tank.fuel', t * 10, 0.3), 2),
    left: round1(Math.max(0, 100 * (1 - Math.min(t, last.t) / fam.burn))),
    loaded: 100,
    // The igniter lamp goes out once the chamber has lit and is holding pressure on its own.
    igniter: pc < nominal * 0.5,
    bus: round1(28 + wobble(round, 'bus', t * 10, 0.6) - (t < 1 ? 1.5 : 0)),
  };
  // The pressurant is spent as the tanks empty: a helium bottle falls, a gas generator's supply holds.
  r.bottle =
    fam.feed === 'helium'
      ? round1(150 - 90 * (1 - r.left / 100) - (side === 'bottle' ? 20 : 0))
      : round1(31 - 3 * (1 - r.left / 100));
  if (lox(fam)) r['lox.temp'] = round1(-183 + wobble(round, 'lox.temp', t * 10, 0.8));
  // A pump's speed follows its chamber: a sagging turbine shows on the tachometer as the chamber falls.
  if (fam.rpm) r.rpm = Math.round(fam.rpm * Math.min(1.1, ratio) + wobble(round, 'rpm', t * 10, fam.rpm * 0.01));
  if (stage === 'aerobee-sustainer') r.wall = at('wall') ?? null;
  return r;
}

// A reading against its channel's green band: 'in', 'low' or 'high' (lamps and unbanded channels are 'in').
export function bandOf(channel, value) {
  if (!channel.band || typeof value !== 'number') return 'in';
  return value < channel.band[0] ? 'low' : value > channel.band[1] ? 'high' : 'in';
}
