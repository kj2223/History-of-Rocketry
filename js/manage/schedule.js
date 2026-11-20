// MANAGEMENT MODE: the round scheduler. In the Flight Director's game the rounds are a fixed script
// (js/data/campaign.js). In management the player's plan decides them: this turns a list of planned flights and the
// pads that exist into dated launches. A flight goes on its own pad if it names one, otherwise on whichever pad of the
// right kind can take it soonest; it flies on its planned date, or later if the pad is busy or the vehicle is late.
// Each launch books its pad for the days before it (stacking and checkout) and after it (clearing), and a flight fits
// into any free gap, so a late vehicle never holds a pad that another flight could use first.
// The answer has the same shape as a campaign round (id, name, vehicle, site, start), so the truth layer can make
// rounds from it as it does for the script. Pure: same plan, same schedule.
import { PAD_KINDS, VEHICLE_NAMES } from './manifest.js';

const PREP = 2; // a round opens two days before its launch, as in the campaign (js/data/campaign.js)

export const padFits = (pad, vehicle) => PAD_KINDS[pad.kind]?.vehicles.includes(vehicle) ?? false;
const vehicleName = v => VEHICLE_NAMES[v] ?? v;

// The first launch day on or after `day` whose booking fits around the pad's other bookings.
function firstFit(bookings, day, kind) {
  let launch = day;
  for (let moved = true; moved;) {
    moved = false;
    for (const b of bookings)
      if (launch - kind.before <= b.to && launch + kind.after - 1 >= b.from) {
        launch = b.to + kind.before + 1;
        moved = true;
      }
  }
  return launch;
}

// The first day on or after `day` inside a launch window: `days` days long, opening every `period` days from `epoch`
// (a Moon probe's monthly window).
export function inWindow(day, { epoch, period, days }) {
  for (let k = Math.max(0, Math.floor((day - epoch) / period) - 1); ; k++) {
    const open = epoch + Math.round(k * period);
    if (day <= open + days - 1) return Math.max(day, open);
  }
}

// The first launch day that fits the pad and, for a flight with a window, falls inside it.
function fit(bookings, day, kind, window) {
  for (let launch = day; ;) {
    launch = firstFit(bookings, launch, kind);
    const w = window ? inWindow(launch, window) : launch;
    if (w === launch) return launch;
    launch = w;
  }
}

// plan: { pads: [{ id, kind }], flights: [{ id, name, vehicle, planned, pad?, ready?, window? }] }, where ready is the
// first day the vehicle can be on the pad (a late delivery) and window limits the launch to a monthly window. from: the first day anything can fly.
// Returns { flights: [{ ...flight, pad, launch, start, slip }], unplaced: [{ ...flight, why }] } in launch order.
export function schedule(plan, { from = -Infinity, site = 'cape' } = {}) {
  const bookings = Object.fromEntries(plan.pads.map(p => [p.id, []])),
    flights = [],
    unplaced = [];
  const earliest = f => p => Math.max(f.planned, from, (f.ready ?? -Infinity) + PAD_KINDS[p.kind].before);
  // Flights that can go soonest are booked first.
  const soonest = f => Math.max(f.planned, from, f.ready ?? -Infinity);
  const order = [...plan.flights].sort(
    (a, b) => soonest(a) - soonest(b) || a.planned - b.planned || a.id.localeCompare(b.id),
  );
  for (const f of order) {
    const named = f.pad ? plan.pads.find(p => p.id === f.pad) : null;
    if (f.pad && !named) {
      unplaced.push({ ...f, why: `its pad, ${f.pad}, is not on the base` });
      continue;
    }
    if (named && !padFits(named, f.vehicle)) {
      unplaced.push({ ...f, why: `${named.name ?? named.id} cannot fly a ${vehicleName(f.vehicle)}` });
      continue;
    }
    const pads = named ? [named] : plan.pads.filter(p => padFits(p, f.vehicle));
    if (!pads.length) {
      unplaced.push({ ...f, why: `there is no pad for a ${vehicleName(f.vehicle)}` });
      continue;
    }
    const when = p => fit(bookings[p.id], earliest(f)(p), PAD_KINDS[p.kind], f.window);
    const pad = pads.reduce((best, p) => (when(p) < when(best) ? p : best));
    const launch = when(pad),
      kind = PAD_KINDS[pad.kind];
    bookings[pad.id].push({ from: launch - kind.before, to: launch + kind.after - 1 }); // busy days, inclusive
    flights.push({ ...f, site, pad: pad.id, launch, start: launch - PREP, slip: launch - f.planned });
  }
  flights.sort((a, b) => a.launch - b.launch || a.id.localeCompare(b.id));
  return { flights, unplaced };
}

// The flights whose rounds are open on this day: opened on or before it, not yet flown. A game loaded mid-round finds
// its round open.
export const opening = (scheduled, day) => scheduled.flights.filter(f => f.start <= day && day <= f.launch);

// The next flight to open on or after this day, or null.
export const nextFlight = (scheduled, day) => scheduled.flights.find(f => f.start >= day) ?? null;

// A management game's schedule, worked out from the start of the game and the saved plan (programmes.js planFor), so the
// dates never move when a game is saved and loaded, and a flight already on the record is never flown again: it stays in
// `flown`, out of the flights to come.
export function gameSchedule(game, plan, start) {
  const s = schedule(plan, { from: start, site: game.site }),
    done = new Set((game.flown ?? []).map(f => f.id));
  return {
    ...s,
    flown: s.flights.filter(f => done.has(f.id)),
    flights: s.flights.filter(f => !done.has(f.id)),
  };
}
