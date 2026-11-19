// MANAGEMENT MODE: the round scheduler. In the Flight Director's game the rounds are a fixed script
// (js/data/campaign.js). In management the player's plan decides them: this turns a list of planned flights and the
// pads that exist into dated launches. A flight goes on its own pad if it names one, otherwise on the first pad of the
// right kind; it flies on its planned date, or later if the pad is still busy with the flight before it or the
// vehicle is not ready. The answer has the same shape as a campaign round (id, name, vehicle, site, start), so the
// truth layer can make rounds from it as it does for the script. Pure: same plan, same schedule.
import { PAD_KINDS } from './manifest.js';

const PREP = 2; // a round opens two days before its launch, as in the campaign (js/data/campaign.js)

export const padFits = (pad, vehicle) => PAD_KINDS[pad.kind]?.vehicles.includes(vehicle) ?? false;

// plan: { pads: [{ id, kind }], flights: [{ id, name, vehicle, planned, pad?, ready? }] }, where ready is the first day
// the vehicle can be on the pad (a late delivery). from: the first day anything can fly.
// Returns { flights: [{ ...flight, pad, launch, start, slip }], unplaced: [{ ...flight, why }] } in launch order.
export function schedule(plan, { from = -Infinity, site = 'cape' } = {}) {
  const free = Object.fromEntries(plan.pads.map(p => [p.id, -Infinity])), // first day each pad can take a vehicle
    flights = [],
    unplaced = [];
  const order = [...plan.flights].sort((a, b) => a.planned - b.planned || a.id.localeCompare(b.id));
  for (const f of order) {
    const pads = f.pad ? plan.pads.filter(p => p.id === f.pad) : plan.pads.filter(p => padFits(p, f.vehicle));
    if (!pads.length || !pads.every(p => padFits(p, f.vehicle))) {
      unplaced.push({ ...f, why: f.pad ? `${f.pad} cannot fly a ${f.vehicle}` : `no pad for a ${f.vehicle}` });
      continue;
    }
    // The pad that can fly it soonest.
    const when = p =>
      Math.max(
        f.planned,
        from,
        free[p.id] + PAD_KINDS[p.kind].before,
        (f.ready ?? -Infinity) + PAD_KINDS[p.kind].before,
      );
    const pad = pads.reduce((best, p) => (when(p) < when(best) ? p : best));
    const launch = when(pad);
    free[pad.id] = launch + PAD_KINDS[pad.kind].after;
    flights.push({ ...f, site, pad: pad.id, launch, start: launch - PREP, slip: launch - f.planned });
  }
  flights.sort((a, b) => a.launch - b.launch || a.id.localeCompare(b.id));
  return { flights, unplaced };
}

// The flights whose rounds open on this day.
export const opening = (scheduled, day) => scheduled.flights.filter(f => f.start === day);

// The next flight to open on or after this day, or null.
export const nextFlight = (scheduled, day) => scheduled.flights.find(f => f.start >= day) ?? null;
