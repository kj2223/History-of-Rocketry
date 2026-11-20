// MANAGEMENT MODE: PROGRAMMES. Every flight on the manifest belongs to a programme. You inherit four on 1 October 1958
// (Pioneer, Vanguard, Explorer and Mercury, with their real flights and dates, manifest.js) and can start others. Each
// programme runs, is slowed or is stopped:
// - running: its flights keep their dates, and it costs its full figure a year;
// - slowed: it costs half, and its dates fall back half a day for every day it stays slowed;
// - stopped: it costs nothing and its flights leave the manifest; started again, they come back as late as it was
//   stopped.
// The Programmes line of the budget pays for them. When it is short, every running programme slips by the part it is
// short each day, at most SQUEEZE_CAP days in a fiscal year (BUDGET-RULES.md: overspending slips dates, and the loop is
// capped; a slip costs no money, so it cannot feed more overspend). Explorer 6, the tutorial flight, never slips more
// than TUTORIAL_CAP days, and its programme cannot be stopped before it flies. A Moon probe that slips moves to its
// next monthly window (schedule.js).
// Pure functions over the saved game: game.programmes = { id: { status, lag, started?, squeeze?: { fy, days } } }.
import { CAPE_1958, VEHICLE_NAMES } from './manifest.js';
import { gameSchedule } from './schedule.js';
import { padsOf } from './build.js';
import { lines } from './budget.js';
import { STANDING_LIMIT } from './pressure.js';

export const PACE = { running: 1, slowed: 0.5, stopped: 0 };
export const SQUEEZE_CAP = 90; // days a short Programmes line can slip a programme in one fiscal year
export const TUTORIAL_CAP = 30; // days Explorer 6 can slip in all
export const LUNAR_MONTH = 29.53;
const PREP = 2; // as schedule.js: a flight's dates are fixed once its round opens, two days before launch
const YEAR = 365.25;

// cost: millions of dollars a year when running. Assumed round figures, to be tuned in play.
// Startable programmes bring their own flights: the first `lead` days after you start them, then one every `every` days.
export const PROGRAMMES = {
  pioneer: {
    name: 'Pioneer',
    text: 'Probes to the Moon for the Army, the Air Force and now NASA.',
    cost: 6,
    lunar: true,
  },
  vanguard: { name: 'Vanguard', text: 'The Navy’s satellite programme, handed to NASA.', cost: 5 },
  explorer: { name: 'Explorer', text: 'Science satellites from the laboratories.', cost: 4 },
  mercury: { name: 'Project Mercury', text: 'A man in orbit. Big Joe tests the capsule’s heat shield first.', cost: 8 },
  tiros: {
    name: 'TIROS',
    text: 'Weather satellites that photograph the clouds from orbit.',
    cost: 4,
    startable: true,
    vehicle: 'thor-able',
    lead: 300,
    every: 120,
    count: 3,
    flight: n => `TIROS ${n}`,
  },
  'mercury-redstone': {
    name: 'Mercury-Redstone',
    text: 'Short up-and-down flights in the Mercury capsule on the Redstone: the first Americans in space.',
    cost: 7,
    startable: true,
    vehicle: 'redstone',
    lead: 420,
    every: 90,
    count: 4,
    flight: n => `Mercury-Redstone ${n}`,
  },
};

// The programmes as the game has them: the four inherited ones run from the first day.
export function programmesOf(game) {
  game.programmes ??= {};
  for (const [id, p] of Object.entries(PROGRAMMES))
    if (!p.startable) game.programmes[id] ??= { status: 'running', lag: 0 };
  return game.programmes;
}

// Every flight a programme brings, with its original date (before any slip).
function flightsOf(id, state) {
  const p = PROGRAMMES[id];
  if (!p.startable) return CAPE_1958.flights.filter(f => f.programme === id);
  if (state?.started == null) return [];
  return Array.from({ length: p.count }, (_, i) => ({
    id: `${id}-${i + 1}`,
    name: p.flight(i + 1),
    vehicle: p.vehicle,
    planned: state.started + p.lead + i * p.every,
    programme: id,
  }));
}

// Every flight any programme has brought so far, flown or not (for reports and the people panel).
export function allFlights(game) {
  const ps = programmesOf(game);
  return Object.keys(PROGRAMMES).flatMap(id => flightsOf(id, ps[id]));
}

// The plan the scheduler works from on this day. Flown flights stay on their day (so their pads are booked as they
// were); a flight whose round has opened keeps its date (game.committed); every other flight goes back by its
// programme's lag, never to a day before its round could open, and a stopped programme's flights are left out.
export function planFor(game) {
  const ps = programmesOf(game),
    flown = new Map((game.flown ?? []).map(f => [f.id, f])),
    committed = game.committed ?? {},
    flights = [];
  for (const id of Object.keys(PROGRAMMES)) {
    const state = ps[id];
    for (const f of flightsOf(id, state)) {
      const done = flown.get(f.id);
      if (done) {
        flights.push({ ...f, planned: done.day, pad: done.pad ?? f.pad });
        continue;
      }
      if (committed[f.id] != null) {
        flights.push({ ...f, planned: committed[f.id] });
        continue;
      }
      if (!state || state.status === 'stopped') continue;
      const lag = Math.floor(f.tutorial ? Math.min(state.lag, TUTORIAL_CAP) : state.lag);
      const planned = Math.max(f.planned + lag, game.day + PREP);
      flights.push({
        ...f,
        planned,
        // A Moon probe flies only in a few days each lunar month, counted from its original date.
        ...(PROGRAMMES[id].lunar ? { window: { epoch: f.planned, period: LUNAR_MONTH, days: 3 } } : {}),
      });
    }
  }
  return { pads: padsOf(game), flights };
}

// The game's schedule on its current day.
export const programmeSchedule = (game, start) => gameSchedule(game, planFor(game), start);

// Fix the dates of flights whose rounds have opened, so nothing moves under a rocket on its pad.
export function commitOpen(game, sched) {
  game.committed ??= {};
  for (const f of sched.flights) if (f.start <= game.day) game.committed[f.id] ??= f.launch;
}

// What the running and slowed programmes cost in the budget's year, prorated as the budget is (millions).
export function needed(game, budget, startDay) {
  const ps = programmesOf(game),
    from = Math.max(budget.start, startDay),
    part = (budget.end - from + 1) / YEAR;
  return (
    Object.keys(PROGRAMMES).reduce((s, id) => s + PROGRAMMES[id].cost * PACE[ps[id]?.status ?? 'stopped'], 0) * part
  );
}

// How much of what the programmes need the Programmes line covers, 0 to 1.
export function funding(game, budget, startDay) {
  const need = needed(game, budget, startDay);
  if (!need) return 1;
  const line = lines(budget, game.split, game.day, startDay).find(l => l.id === 'programmes').amount;
  return Math.min(1, line / need);
}

// One day passes for the programmes: slowed and stopped ones fall back; a short Programmes line slips the running and
// slowed ones, within the year's cap. Returns a line for the log when the line first runs short for a programme in a year.
export function advanceProgrammes(game, budget, startDay) {
  const ps = programmesOf(game),
    cover = budget ? funding(game, budget, startDay) : 1;
  let warn = false;
  for (const [id, s] of Object.entries(ps)) {
    s.lag += 1 - PACE[s.status];
    if (s.status === 'stopped' || cover >= 1) continue;
    if (s.squeeze?.fy !== budget.fy) s.squeeze = { fy: budget.fy, days: 0 };
    const add = Math.min(1 - cover, SQUEEZE_CAP - s.squeeze.days);
    if (add <= 0) continue;
    if (s.squeeze.days === 0) warn = true;
    s.squeeze.days += add;
    s.lag += add;
  }
  return warn
    ? [
        `The Programmes line covers ${Math.floor(cover * 100)}% of what the programmes need: their dates are slipping. Move money to Programmes to stop it.`,
      ]
    : [];
}

// Can this programme be stopped now? Explorer cannot until Explorer 6, the tutorial flight, has flown.
export function canStop(game, id) {
  const done = new Set((game.flown ?? []).map(f => f.id));
  return !flightsOf(id, programmesOf(game)[id]).some(f => f.tutorial && !done.has(f.id));
}

// Start, slow, resume or stop a programme. Returns a line for the log, or null if nothing changed.
export function setProgramme(game, id, status) {
  const ps = programmesOf(game),
    p = PROGRAMMES[id];
  if (!p || !(status in PACE)) return null;
  const s = ps[id];
  if (!s) {
    if (status !== 'running' || !p.startable) return null;
    ps[id] = { status: 'running', lag: 0, started: game.day };
    return `${p.name} starts. Its first flight, on a ${VEHICLE_NAMES[p.vehicle] ?? p.vehicle}, is planned about ${Math.round(p.lead / 30)} months from now.`;
  }
  if (s.status === status) return null;
  if (status === 'stopped' && !canStop(game, id)) return null;
  s.status = status;
  if (status === 'stopped') {
    // Flights announced in public and now cancelled cost standing, as a slip would.
    const done = new Set((game.flown ?? []).map(f => f.id)),
      announced = game.pressure?.announced ?? {},
      cancelled = flightsOf(id, s).filter(
        f => !done.has(f.id) && game.committed?.[f.id] == null && announced[f.id] != null,
      );
    for (const f of cancelled) delete announced[f.id];
    if (cancelled.length && game.pressure)
      game.pressure.standing = Math.max(-STANDING_LIMIT, game.pressure.standing - cancelled.length);
    return `${p.name} is stopped. Its flights are off the manifest.${cancelled.length ? ' The press notes the dates the centre announced and will not keep.' : ''}`;
  }
  if (status === 'slowed') return `${p.name} is slowed: half the money, and its dates fall back.`;
  return `${p.name} is running at full pace again.`;
}

// Throws on a saved programmes record this version cannot carry on. Optional: games saved before programmes load.
export function checkProgrammes(ps) {
  if (ps === undefined) return;
  if (!ps || typeof ps !== 'object') throw new Error('bad programmes');
  for (const [id, s] of Object.entries(ps)) {
    if (!PROGRAMMES[id]) throw new Error(`unknown programme ${id}`);
    if (!(s?.status in PACE) || typeof s.lag !== 'number' || !(s.lag >= 0)) throw new Error(`bad programme ${id}`);
  }
}
