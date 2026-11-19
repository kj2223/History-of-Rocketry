// SIM CARDS: what a clean sim teaches you, written on a card and taped to your console for the real flights.
// A card is earned by getting every call right in a sim of that trouble (mercury.js, finishSim). On a real flight the
// console shows the cards for the call in front of you, whatever the flight's hidden truth: a card says what to do if you
// see the trouble, never that the trouble is there. (Apollo 11's program-alarm list began this way: a sim on 5 July 1969
// threw a 1201 alarm at the descent team, they called an abort they did not need, and Jack Garman wrote down which
// alarms were safe to fly through.)

// phase: the console phase the card belongs to ('poll' covers the recovery poll and the final status check).
const OFF_LINE = {
  phase: 'ascent',
  text: 'Off the line and still walking away: abort before she passes the limit. She will not come back on her own.',
};
const SHORT = {
  phase: 'insertion',
  text: 'Short cutoff: check her speed against what orbit needs, less the angle. If it will not hold, NO-GO while the ships can still reach her.',
};
const SEA = { phase: 'poll', text: 'Sea above state 4: NO-GO, however good the rest of the board looks.' };
const SHIP = { phase: 'poll', text: 'A ship off station under a landing point: NO-GO until it is back.' };

export const SIM_CARDS = {
  control: OFF_LINE,
  guidance: OFF_LINE,
  titanctl: OFF_LINE,
  saturnctl: OFF_LINE,
  lox: { phase: 'ip', text: 'Engine out early, she falls short: a solid radar track is your best point.' },
  thrust: { phase: 'ip', text: 'Hot and fast and dry early, she goes long: a solid radar track is your best point.' },
  radar: { phase: 'ip', text: "Dropouts on the radar plot: give Recovery the computer's point, not the radar's." },
  shortburn: SHORT,
  stage2: SHORT,
  s2cutoff: SHORT,
  seastate: SEA,
  offstation: SHIP,
  seg51loose: {
    phase: 'pack',
    text: 'Segment 51 lit: you cannot tell a loose shield from a bad switch. Keep the pack on: it costs little, a shield costs everything.',
  },
  seg51false: {
    phase: 'pack',
    text: 'Segment 51 lit: you cannot tell a loose shield from a bad switch. Keep the pack on: it costs little, a shield costs everything.',
  },
  scanner: {
    phase: 'retro',
    text: 'Attitude wandering and fuel burning on automatic: have him fire by hand, lined up on the horizon.',
  },
};

// The phase a console is in, for the cards: a poll outranks the count.
const phaseOf = c => (c.poll || c.phase === 'poll' ? 'poll' : c.phase);

// The cards you hold for the call in front of you on a real flight, oldest first, one line each (shared cards once).
export function cardsFor(record, c) {
  if (!c || c.kind === 'sim' || !record?.cards) return [];
  const phase = phaseOf(c);
  const out = [];
  for (const key of Object.keys(record.cards)) {
    const card = SIM_CARDS[key];
    if (card && card.phase === phase && !out.includes(card.text)) out.push(card.text);
  }
  return out;
}

// Earn the card for a sim, if it teaches one. Returns its text, or null.
export function earnCard(record, scenario, day) {
  const card = SIM_CARDS[scenario];
  if (!card) return null;
  record.cards = record.cards || {};
  const fresh = !record.cards[scenario];
  if (fresh) record.cards[scenario] = { day };
  return fresh ? card.text : null;
}
