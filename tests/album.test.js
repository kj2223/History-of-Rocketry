// The photographs of the remembered rounds (js/site/album.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MILESTONES, cropOf, photoMoment, goodFlight, photoOf, roundPrint } from '../js/site/album.js';
import { SEASON } from '../js/data/campaign.js';

test('every remembered round is a real round of the campaign', () => {
  const ids = new Set(SEASON.map(r => r.id));
  for (const id of Object.keys(MILESTONES)) assert.ok(ids.has(id), id);
});

test('the picture is taken as she clears the tower, or while Mission Control watches her climb', () => {
  const site = rise => ({ rocket: { where: 'flying', rise } });
  assert.equal(photoMoment(site(20), 'site'), null);
  assert.equal(photoMoment(site(100), 'site'), 'site');
  assert.equal(photoMoment(site(400), 'site'), null);
  assert.equal(photoMoment({ ...site(100), flight: { blast: {} } }, 'site'), null, 'never of a pad loss');
  const con = t => ({ rocket: { where: 'flying' }, console: { phase: 'ascent', t, trace: [{ t }] } });
  assert.equal(photoMoment(con(10), 'control'), null);
  assert.equal(photoMoment(con(30), 'control'), 'console');
});

test('only a good flight with nobody lost keeps its print', () => {
  const record = { losses: [{ round: 'mr-3' }], rounds: [] };
  assert.equal(goodFlight(record, { id: 'ma-6', flight: 'Splashdown about 60 km downrange.' }), true);
  assert.equal(goodFlight(record, { id: 'ma-6', flight: 'Lost: aborted at 40 seconds.' }), false);
  assert.equal(goodFlight(record, { id: 'mr-3', flight: 'Splashdown.' }), false);
});

test('prints are kept per campaign, outside the save', () => {
  const mem = new Map();
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  storage.setItem(
    'pa-album',
    JSON.stringify({ seed: 5, photos: { 'ma-6': { url: 'data:x', from: 'console', day: 6260 } } }),
  );
  assert.equal(photoOf(6, 'ma-6', storage), null, 'another campaign has none');
  assert.equal(photoOf(5, 'ma-6', storage).from, 'console');
  assert.equal(
    roundPrint({ seed: 5, record: { rounds: [] } }, { id: 'wac-2', flight: 'x' }, () => ''),
    '',
  );
});

test('a print from the site is framed on the pad, inside the screen', () => {
  assert.deepEqual(cropOf(1600, 600, null), { sx: 0, sw: 1600 });
  assert.deepEqual(cropOf(1600, 600, 0.5), { sx: 400, sw: 800 });
  assert.deepEqual(cropOf(1600, 600, 0.98), { sx: 800, sw: 800 });
  assert.deepEqual(cropOf(1600, 600, -0.2), { sx: 0, sw: 800 });
});
