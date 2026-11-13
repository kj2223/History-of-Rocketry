// The morning paper on the write-up (js/site/paper.js): it says only what the record says, in its decade's type.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headlineOf, paperEra, priceOf, paperHTML } from '../js/site/paper.js';

const round = (flight, id = 'ma-6') => ({
  id,
  name: 'Mercury-Atlas 6, the first American in orbit',
  day: 6259,
  flight,
});

test('a good crewed flight is the crew home safe, with the milestone under it', () => {
  const h = headlineOf(round('3 orbits; splashdown. Daniel Okafor came home safe.'), { losses: [] }, true);
  assert.equal(h.head, 'Mercury-Atlas 6 crew home safe');
  assert.equal(h.tone, 'banner');
  assert.match(h.deck, /Friendship 7/);
});

test('a lost flight is reported lost, a lost crew so, and neither claims the milestone', () => {
  const lost = headlineOf(round('Lost at 60 seconds.'), { losses: [] }, true);
  assert.equal(lost.head, 'Mercury-Atlas 6 lost');
  assert.equal(lost.deck, 'Lost at 60 seconds.');
  const grave = headlineOf(round('Splashdown.'), { losses: [{ round: 'ma-6' }] }, true);
  assert.equal(grave.tone, 'grave');
  assert.match(grave.head, /crew lost/);
});

test('the paper changes its type and its price with the decades', () => {
  assert.equal(paperEra(1955), 'old');
  assert.equal(paperEra(1981), 'mid');
  assert.equal(paperEra(2026), 'new');
  assert.equal(priceOf(1957), '5 cents');
  assert.equal(priceOf(1988), '25 cents');
});

test("the front page carries the next morning's date and escapes what it prints", () => {
  const html = paperHTML(
    { day: 6259, seed: 1, record: { losses: [] } },
    { ...round('Up & <down>.'), id: 'mr-1' },
    false,
  );
  assert.match(html, /February 21, 1962/);
  assert.match(html, /Up &amp; &lt;down&gt;/);
});
