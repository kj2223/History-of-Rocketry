// YOUR HISTORY AGAINST THE REAL ONE: at the end of your years, and on the write-up of each milestone flight, your
// timeline set beside what really happened. Only what you could know: the flight as it went for you, the day it flew,
// and the crews you lost. The real dates are history's (NASA's own chronologies).
import { dayOf } from '../core/calendar.js';

// id: the round. what: the milestone. real: the day it happened. history: how it went (lost: the real flight failed).
export const MILESTONES = [
  { id: 'bumper-5', what: 'A rocket above 390 km, the first into space from America', real: dayOf(1949, 2, 24) },
  {
    id: 'vanguard-tv3',
    what: "America's first satellite attempt",
    real: dayOf(1957, 12, 6),
    history: 'lost',
    note: 'Vanguard TV-3 rose four feet and blew up on the pad.',
  },
  { id: 'pioneer-4', what: 'The first American probe past the Moon', real: dayOf(1959, 3, 3) },
  { id: 'mr-3', what: 'The first American in space', real: dayOf(1961, 5, 5) },
  { id: 'ma-6', what: 'The first American in orbit', real: dayOf(1962, 2, 20) },
  { id: 'gem-4', what: 'The first American spacewalk', real: dayOf(1965, 6, 3) },
  { id: 'gem-6', what: 'The first rendezvous in orbit', real: dayOf(1965, 12, 15) },
  { id: 'gem-8', what: 'The first docking in orbit', real: dayOf(1966, 3, 16) },
  { id: 'apollo-8', what: 'The first crew around the Moon', real: dayOf(1968, 12, 21) },
  { id: 'apollo-11', what: 'The first landing on the Moon', real: dayOf(1969, 7, 16) },
  {
    id: 'apollo-13',
    what: 'Apollo 13',
    real: dayOf(1970, 4, 11),
    history: 'saved',
    note: 'An oxygen tank burst on the way out; the crew came home in the lunar module.',
  },
  { id: 'sts-1', what: 'The first Space Shuttle', real: dayOf(1981, 4, 12) },
  {
    id: 'sts-51l',
    what: 'Challenger, STS-51-L',
    real: dayOf(1986, 1, 28),
    history: 'lost',
    note: 'A booster field joint burned through 73 seconds after a cold launch. Seven died.',
  },
  { id: 'demo-2', what: 'The first commercial crew to the station', real: dayOf(2020, 5, 30) },
];
// The crews America really lost: Apollo 1 on the pad, Challenger, and Columbia on entry in 2003.
export const REAL_LOSSES = [
  { what: 'Apollo 1', day: dayOf(1967, 1, 27), people: 3 },
  { what: 'Challenger, STS-51-L', day: dayOf(1986, 1, 28), people: 7 },
  { what: 'Columbia, STS-107', day: dayOf(2003, 2, 1), people: 7 },
];

// How a round went for you: 'lost' (a crew or the vehicle), 'good', or null if you never worked it.
export function yourOutcome(record, id) {
  const r = record.rounds.find(x => x.id === id);
  if (!r) return null;
  if ((record.losses || []).some(l => l.round === id)) return 'crew';
  return /^Lost/.test(r.flight || '') ? 'lost' : 'good';
}

// One milestone, as a line: what it was, how it went for you, and how it went in history.
export function milestoneRow(record, m, dateText) {
  const r = record.rounds.find(x => x.id === m.id);
  if (!r) return null;
  const out = yourOutcome(record, m.id),
    late = r.day - m.real;
  const yours =
    out === 'crew'
      ? `You lost the crew, ${dateText(r.day)}.`
      : out === 'lost'
        ? `Lost, ${dateText(r.day)}.`
        : `Flown ${dateText(r.day)}${Math.abs(late) > 3 ? `, ${Math.abs(late)} days ${late > 0 ? 'later' : 'earlier'} than history` : ''}.`;
  const real =
    m.history === 'lost'
      ? `History: ${m.note}`
      : m.history === 'saved'
        ? `History: ${m.note}`
        : `History: ${dateText(m.real)}.`;
  const turned =
    m.history === 'lost' && out === 'good'
      ? ' You changed history here.'
      : !m.history && out && out !== 'good'
        ? ' History went better here.'
        : '';
  return { id: m.id, what: m.what, yours, real, turned };
}

// The whole chronicle so far: the milestone rows you reached, and the crews lost, yours against history's to that day.
export function chronicle(record, dateText, upTo = Infinity) {
  const rows = MILESTONES.map(m => milestoneRow(record, m, dateText)).filter(Boolean);
  const last = Math.min(upTo, Math.max(0, ...record.rounds.map(r => r.day ?? 0)));
  const yourLosses = (record.losses || []).filter(l => l.day <= last),
    realLosses = REAL_LOSSES.filter(l => l.day <= last);
  return {
    rows,
    yours: yourLosses.length,
    real: realLosses.length,
    realText: realLosses.map(l => l.what).join(', '),
    yourText: yourLosses.map(l => l.round).join(', '),
  };
}
