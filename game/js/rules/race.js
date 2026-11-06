// The race (V2 freeze §8). Soviet firsts happen on their real dates whatever the player does. The agency
// hears of them through intelligence that can be early, late, partial or wrong, and is revised; the public
// announcement is a separate event. Anchors feed political pressure and award conditions; they never force a
// decision or an accident. Who was first is read from what actually happened. Draws only from the
// intelligence stream. Reports not yet delivered stay out of the projection.

import { SOVIET_ANCHORS, PRESSURE_SUPPLEMENTARY } from '../data/race.js';
import { draw } from '../core/rng.js';
import { memo } from './authority.js';
import { supplementary } from './fiscal.js';
import { money } from './reports.js';
import { dateLabel } from '../core/calendar.js';

export const initRace = () => ({ reports: [], pending: [], firsts: [] });

// Firsts the agency can claim where no Soviet anchor compares (V2 freeze §8: the record follows what happened).
const AGENCY_FIRSTS = { rendezvous: 'first rendezvous in orbit', docking: 'first docking in orbit' };

const matches = (cap, comparable) => comparable === 'day-in-orbit' ? cap.kind === 'duration' && cap.conditions.days >= 1 && cap.conditions.crew > 0 : cap.kind === comparable;

const deliver = (state, item) => {
  const r = { id: `intel-${state.race.reports.length + 1}`, day: state.day, anchorId: item.anchorId, kind: item.kind, text: item.text, revises: null };
  if (item.kind === 'revision') {
    const earlier = state.race.reports.filter(x => x.anchorId === item.anchorId && x.kind === 'report').at(-1);
    if (earlier) { earlier.revisedBy = r.id; r.revises = earlier.id; }
  }
  state.race.reports.push(r);
  // The record of firsts shows a Soviet first once the agency has heard of it.
  for (const f of state.race.firsts.filter(x => x.id === item.anchorId)) f.known = true;
  const from = item.kind === 'announcement' ? 'administrator-office' : 'intelligence';
  const lead = { rumour: 'Intelligence passes on a rumour, unconfirmed:', report: 'Intelligence reports that', revision: 'Intelligence revises its earlier report:', announcement: 'Moscow has announced it:' }[item.kind];
  memo(state, { from, refs: { intelligence: r.id }, text: `${lead} ${item.text}` });
};

export const raceDay = state => {
  const race = state.race;
  for (const a of SOVIET_ANCHORS) {
    if (state.day === a.day - 21) {
      // Two draws whatever the anchor: whether a rumour reaches us, and when.
      const heard = draw(state.rng.intelligence), when = draw(state.rng.intelligence);
      if (a.rumour && heard < 0.6) race.pending.push({ day: state.day + Math.floor(when * 14), anchorId: a.id, kind: 'rumour', text: a.rumour });
    }
    if (state.day !== a.day) continue;
    // Three draws: how late the report is, how good it is, and how long until it is put right.
    const late = draw(state.rng.intelligence), quality = draw(state.rng.intelligence), fix = draw(state.rng.intelligence);
    const accuracy = quality < 0.55 ? 'accurate' : quality < 0.8 ? 'partial' : 'wrong';
    const at = state.day + Math.floor(late * 4);
    race.pending.push({ day: at, anchorId: a.id, kind: 'report', text: accuracy === 'accurate' ? a.report : accuracy === 'partial' ? a.partial : a.wrong });
    if (accuracy !== 'accurate') race.pending.push({ day: at + 5 + Math.floor(fix * 15), anchorId: a.id, kind: 'revision', text: a.report });
    race.pending.push({ day: state.day + a.announced, anchorId: a.id, kind: 'announcement', text: a.report });
    if (a.comparable) {
      const ours = state.capabilities.filter(c => c.status === 'demonstrated' && matches(c, a.comparable) && c.day <= a.day).sort((x, y) => x.day - y.day)[0];
      race.firsts.push({ id: a.id, first: a.first, sovietDay: a.day, agencyDay: ours?.day ?? null, firstBy: ours ? 'agency' : 'soviet', comparable: a.comparable, known: false });
      if (!ours && a.pressure) {
        const amount = PRESSURE_SUPPLEMENTARY[a.pressure];
        supplementary(state, amount, a.id);
        memo(state, { from: 'administrator-office', kind: 'warning', refs: { anchor: a.id },
          text: `The Soviet Union has made the ${a.first} before us. Congress wants an answer and has added ${money(amount)} to this year's award. Nothing obliges us to change our plans; the pressure is political.` });
      }
    } else race.firsts.push({ id: a.id, first: a.first, sovietDay: a.day, agencyDay: null, firstBy: 'soviet', comparable: null, known: false });
  }
  const due = race.pending.filter(p => p.day <= state.day);
  race.pending = race.pending.filter(p => p.day > state.day);
  for (const item of due.sort((x, y) => x.day - y.day)) deliver(state, item);
};

// When the agency demonstrates something, the record of who was first takes it in.
export const capabilityRecorded = (state, cap) => {
  for (const f of state.race.firsts.filter(x => x.comparable && x.agencyDay === null && matches(cap, x.comparable))) f.agencyDay = cap.day;
  if (AGENCY_FIRSTS[cap.kind] && !state.race.firsts.some(f => f.comparable === cap.kind)) {
    state.race.firsts.push({ id: `agency-${cap.kind}`, first: AGENCY_FIRSTS[cap.kind], sovietDay: null, agencyDay: cap.day, firstBy: 'agency', comparable: cap.kind, known: true });
    memo(state, { from: 'administrator-office', refs: { capability: cap.id }, text: `The agency has made the ${AGENCY_FIRSTS[cap.kind]}, on ${dateLabel(cap.day)}.` });
  }
};

// What the agency knows: delivered reports and the record of firsts. Pending reports never leave the rules.
export const projectRace = race => ({ reports: structuredClone(race.reports), firsts: structuredClone(race.firsts.filter(f => f.known)) });
