// Your history against the real one: milestones you flew, set beside history's dates and outcomes, and crews lost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MILESTONES, chronicle, milestoneRow, REAL_LOSSES } from '../js/career/chronicle.js';
import { SEASON } from '../js/data/campaign.js';
import { dayOf } from '../js/core/calendar.js';

const dateText = d => `day ${d}`;

test('every milestone is a round in the campaign, near its real date', () => {
  for (const m of MILESTONES) {
    const r = SEASON.find(s => s.id === m.id);
    assert.ok(r, m.id);
    assert.ok(Math.abs(r.start - m.real) < 40, `${m.id} starts near its real date`);
  }
});

test('a flight on its day reads as history; a good flight where history lost one changes history', () => {
  const record = {
    rounds: [
      { id: 'ma-6', day: dayOf(1962, 2, 20), flight: 'In orbit.' },
      { id: 'sts-51l', day: dayOf(1986, 1, 28), flight: 'In orbit.' },
      { id: 'apollo-11', day: dayOf(1969, 8, 30), flight: 'Landed.' },
    ],
    losses: [],
  };
  const ma6 = milestoneRow(
    record,
    MILESTONES.find(m => m.id === 'ma-6'),
    dateText,
  );
  assert.doesNotMatch(ma6.yours, /later|earlier/);
  assert.equal(
    milestoneRow(
      record,
      MILESTONES.find(m => m.id === 'sts-51l'),
      dateText,
    ).turned.trim(),
    'You changed history here.',
  );
  assert.match(
    milestoneRow(
      record,
      MILESTONES.find(m => m.id === 'apollo-11'),
      dateText,
    ).yours,
    /45 days later/,
  );
  const c = chronicle(record, dateText);
  assert.equal(c.rows.length, 3);
  assert.equal(c.real, 2, 'Apollo 1 and Challenger by 1986');
  assert.equal(REAL_LOSSES.length, 3);
});

test('a crew lost reads as yours, and history went better', () => {
  const record = {
    rounds: [{ id: 'mr-3', day: dayOf(1961, 5, 5), flight: 'Lost at 40 seconds.' }],
    losses: [{ round: 'mr-3', day: dayOf(1961, 5, 5), ids: ['x'] }],
  };
  const row = milestoneRow(
    record,
    MILESTONES.find(m => m.id === 'mr-3'),
    dateText,
  );
  assert.match(row.yours, /lost the crew/);
  assert.match(row.turned, /History went better/);
  assert.equal(chronicle(record, dateText).yours, 1);
});
