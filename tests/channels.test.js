import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, staticFire, tankGauge, hasLeak } from '../js/truth/round.js';
import {
  channelsFor,
  countReadings,
  fireReadings,
  leakSide,
  bandOf,
  FAMILIES,
  standStageOf,
} from '../js/truth/channels.js';

const VEHICLES = ['wac', 'v2', 'bumper', 'aerobee', 'viking', 'vanguard', 'juno', 'ranger'];
const roundWhere = (vehicle, want) => {
  for (let seed = 1; seed < 4000; seed++) {
    const r = newRound(seed, undefined, vehicle);
    if (want(r)) return r;
  }
  throw new Error(`no ${vehicle} round found`);
};

test('every stand stage has a channel set, and every reading belongs to a channel', () => {
  for (const v of VEHICLES) {
    const r = newRound(7, undefined, v);
    const ids = new Set(channelsFor(r).map(c => c.id));
    assert.ok(FAMILIES[standStageOf(v)], v);
    for (const id of Object.keys(countReadings(r, 100))) assert.ok(ids.has(id), `${v} count ${id}`);
    for (const id of Object.keys(fireReadings(r, staticFire(r, 'short'), 4))) assert.ok(ids.has(id), `${v} fire ${id}`);
    assert.ok(ids.size >= 9, v);
  }
});

test('a sound round reads in band through the whole count', () => {
  for (const v of VEHICLES) {
    const r = roundWhere(v, x => !hasLeak(x));
    const chans = channelsFor(r);
    for (let s = 0; s <= 600; s += 15) {
      const read = countReadings(r, s);
      for (const c of chans)
        if (c.id in read && c.station === 'press')
          assert.equal(bandOf(c, read[c.id]), 'in', `${v} ${c.id} at ${s}: ${read[c.id]}`);
    }
  }
});

test('a leak bleeds the tank it is really on, and that tank reads what the count gauge reads', () => {
  for (const v of VEHICLES) {
    const r = roundWhere(v, hasLeak);
    const side = leakSide(r);
    const read = countReadings(r, 400);
    if (side === 'bottle') assert.ok(read.bottle < 140, `${v} bottle ${read.bottle}`);
    const tank = side === 'fuel' ? 'tank.fuel' : 'tank.ox';
    assert.equal(read[tank], tankGauge(r, 400), v);
    assert.ok(read[tank] < 22, `${v} ${tank} ${read[tank]}`);
  }
});

test('reading the channels takes nothing from the round', () => {
  const r = newRound(42, undefined, 'viking');
  const before = JSON.stringify(r);
  for (let s = 0; s < 600; s += 1) countReadings(r, s);
  assert.equal(JSON.stringify(r), before);
});

test('the firing channels follow the chamber: thrust, and a pump speed that sags with it', () => {
  const r = newRound(11, undefined, 'v2');
  const fire = staticFire(r, 'short');
  for (const t of [1, 3, 6]) {
    const read = fireReadings(r, fire, t);
    const ratio = read.pc / 15.5;
    assert.ok(Math.abs(read.thrust / FAMILIES.v2.thrust - ratio) < 0.01, `thrust at ${t}`);
    assert.ok(Math.abs(read.rpm / FAMILIES.v2.rpm - Math.min(1.1, ratio)) < 0.03, `rpm at ${t}`);
    assert.equal(read.igniter, false);
  }
  assert.equal(fireReadings(r, fire, 0).igniter, true);
  assert.ok(fireReadings(r, fire, 6).left < 100);
});
