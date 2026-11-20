// MANAGEMENT MODE: PAD EMERGENCIES (hands-on idea 7, November 2026). Now and then something goes wrong on a pad while a
// rocket stands on it: a propellant line lets go, or the spill lights. The base clock stops turning days and the
// emergency runs on its own clock, a minute a second, while you direct three crews on the map: pad safety clears the
// people, the pad crew closes the valves, and the fire crew fights the fire. Nothing waits for you. A leak left alone
// lights; a fire fed by open valves grows until the rocket goes; anyone still on the pad when it lights is hurt. If you
// give no order for a while, the head of launch operations sends the crews in the book's order, later than you could.
// History: the early Cape lost rockets on and over the pads (Vanguard TV-3 in December 1957, early Atlas and Thor
// stands); the pad crews, safety officers and the fire service worked exactly this way. The incidents are
// hand-built and fictional; the rates are tuned for play, not taken from a record.
// Pure functions over the saved game: game.emergency = { kind, pad, flight, t, stage, heat, peak, cleared, valves,
// crews: { id: { x, y, to, work } }, ordered, lastOrder, auto, hurt, lost } while one is live; game.emergencies is the record.
import { PREFABS } from './base.js';

export const CHANCE = 0.012; // a day with a rocket standing on a pad
export const QUIET_DAYS = 120; // at least this long between two emergencies
export const SPEED = 2.5; // tiles a minute along the ground
export const AUTO_AFTER = 4; // minutes with no order before the head of launch operations sends the crews
export const PEOPLE = 8; // the pad's work crew, on the stand when it starts

export const INCIDENTS = {
  leak: {
    name: 'Propellant leak',
    text: 'A fuel line has let go on the stand. Kerosene is running into the flame pit and the work crew is still up on the tower.',
  },
  fire: {
    name: 'Fire on the pad',
    text: 'A spill at the foot of the stand has lit. The work crew is still on the tower and the propellant valves are open.',
  },
};

// The crews. home: where each one waits (a building id, or 'blockhouse' for the pad's own); job: what it does on the pad.
export const CREWS = {
  safety: { name: 'Pad safety', home: 'blockhouse', job: 'clear', work: 2, colour: '#ffd23f' },
  pad: { name: 'Pad crew', home: 'hangar-s', job: 'valves', work: 3, colour: '#e9ece4' },
  fire: { name: 'Fire crew', home: 'offices', job: 'fire', colour: '#d8442b' },
};
export const ORDER = ['safety', 'pad', 'fire']; // the book's order, as the head of launch operations sends them

// Rates, a minute: how fast a leak builds to lighting, how a fire grows, how fast the fire crew knocks it down.
const LEAK_RATE = 0.07,
  FIRE_GROW = 0.04,
  FED = 0.06, // more while the valves are open
  KNOCK = 0.16,
  LOSE_AT = 1.5, // a fire this big takes the rocket
  VALVES_UNDER = 0.6; // the pad crew can reach the valves only while the fire is smaller than this

const hash = (a, b) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x27d4eb2f, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
const centre = b => ({ x: b.tx + PREFABS[b.kind].w / 2, y: b.ty + PREFABS[b.kind].d / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Where a crew starts: its building, or the blockhouse nearest the pad.
function homeOf(base, pad, crew) {
  const p = centre(pad);
  if (CREWS[crew].home === 'blockhouse') {
    const near = base.filter(b => b.kind === 'blockhouse').sort((a, b) => dist(centre(a), p) - dist(centre(b), p))[0];
    if (near) return centre(near);
  }
  const b = base.find(x => x.id === CREWS[crew].home) ?? base.find(x => x.kind !== 'pad');
  return b ? centre(b) : { x: p.x - 8, y: p.y };
}

// Does an emergency start today? stands: what stands on the pads (view.js standsOn). Not on a launch day, not before
// the first flight is on the record, and never twice in QUIET_DAYS.
export function emergencyToday(game, stands) {
  if (game.emergency || !(game.flown?.length >= 1)) return null;
  const last = game.emergencies?.at(-1)?.day;
  if (last != null && game.day - last < QUIET_DAYS) return null;
  const standing = stands.filter(s => s.flight.launch !== game.day);
  if (!standing.length || hash(game.seed, game.day) >= CHANCE) return null;
  const s = standing[Math.floor(hash(game.seed, game.day + 7919) * standing.length)];
  return { kind: hash(game.seed, game.day + 104729) < 0.7 ? 'leak' : 'fire', pad: s.pad.id, flight: s.flight.id };
}

// Start one. Returns the line for the log.
export function startEmergency(game, base, { kind, pad, flight }) {
  const p = base.find(b => b.id === pad);
  game.emergency = {
    kind,
    pad,
    flight,
    t: 0,
    stage: kind === 'fire' ? 'fire' : 'leak',
    heat: kind === 'fire' ? 0.3 : 0,
    peak: kind === 'fire' ? 0.3 : 0,
    cleared: false,
    valves: 'open',
    crews: Object.fromEntries(ORDER.map(id => [id, { ...homeOf(base, p, id), to: null, work: 0 }])),
    ordered: false,
    auto: false,
    hurt: 0,
    lost: false,
  };
  return `${INCIDENTS[kind].name} at ${p.name}. The base clock stops while you deal with it.`;
}

// Send a crew to the pad, or back home. Returns false if there is nothing live.
export function orderCrew(game, base, crew, to) {
  const e = game.emergency;
  if (!e || !CREWS[crew]) return false;
  e.crews[crew].to = to === 'pad' ? 'pad' : 'home';
  e.crews[crew].work = 0;
  e.ordered = true;
  e.lastOrder = e.t;
  return true;
}

export const onPad = (e, base, crew) => {
  const p = base.find(b => b.id === e.pad);
  return dist(e.crews[crew], centre(p)) < 0.6;
};

// Let minutes pass. Returns lines for the log (things that happened), and sets e.done when it is over.
export function tickEmergency(game, base, minutes) {
  const e = game.emergency,
    out = [];
  if (!e || e.done) return out;
  const pad = base.find(b => b.id === e.pad),
    padAt = centre(pad);
  let left = minutes;
  while (left > 0 && !e.done) {
    const dt = Math.min(0.1, left);
    left -= dt;
    e.t += dt;
    // No order for a while: the head of launch operations sends the crews still out in the book's order, a minute
    // apart, so an emergency never waits on you for ever.
    const quiet = e.t - (e.lastOrder ?? 0);
    if (quiet >= AUTO_AFTER) {
      const n = Math.min(ORDER.length, Math.floor(quiet - AUTO_AFTER) + 1);
      for (const id of ORDER.slice(0, n))
        if (e.crews[id].to !== 'pad') {
          e.crews[id].to = 'pad';
          if (!e.auto) out.push('No orders from you: the head of launch operations is sending the crews in.');
          e.auto = true;
        }
    }
    // The crews move, straight across the ground, and work when they are on the pad.
    for (const id of ORDER) {
      const c = e.crews[id];
      if (!c.to) continue;
      const goal = c.to === 'pad' ? padAt : homeOf(base, pad, id),
        d = dist(c, goal),
        step = SPEED * dt;
      if (d > step) {
        c.x += ((goal.x - c.x) / d) * step;
        c.y += ((goal.y - c.y) / d) * step;
        continue;
      }
      c.x = goal.x;
      c.y = goal.y;
      if (c.to !== 'pad') continue;
      const job = CREWS[id].job;
      if (job === 'clear' && !e.cleared) {
        c.work += dt;
        if (c.work >= CREWS[id].work) {
          e.cleared = true;
          out.push('Pad safety has everyone off the tower and back behind the blockhouse.');
        }
      } else if (job === 'valves' && e.valves === 'open') {
        if (e.stage === 'fire' && e.heat >= VALVES_UNDER) continue; // too hot to reach them yet
        c.work += dt;
        if (c.work >= CREWS[id].work) {
          e.valves = 'closed';
          out.push('The pad crew has the propellant valves closed. Nothing more is feeding it.');
        }
      } else if (job === 'fire' && e.stage === 'fire') e.heat -= KNOCK * dt;
    }
    // The pad itself.
    if (e.stage === 'leak') {
      if (e.valves === 'closed') {
        e.done = true;
        break;
      }
      e.heat += LEAK_RATE * dt;
      if (e.heat >= 1) {
        e.stage = 'fire';
        e.heat = 0.35;
        out.push(`The spill has lit at ${pad.name}.`);
        if (!e.cleared) {
          e.hurt = Math.max(e.hurt, 3);
          out.push('Three of the work crew were still on the tower and are hurt.');
        }
      }
    } else if (e.stage === 'fire') {
      e.heat += (FIRE_GROW + (e.valves === 'open' ? FED : 0)) * dt;
      if (!e.lost && e.heat >= LOSE_AT) {
        e.lost = true;
        e.heat = 1;
        out.push(`The rocket on ${pad.name} has gone up in the fire.`);
        if (!e.cleared) {
          e.hurt = PEOPLE;
          out.push('The work crew was still on the pad.');
        }
      }
      if (e.heat <= 0) {
        e.heat = 0;
        if (e.valves === 'closed') e.done = true;
        else {
          e.stage = 'leak';
          e.heat = 0.6; // out, but still pouring: it can light again
          out.push('The fire is out, but the valves are still open and the spill is still running.');
        }
      }
    }
    e.peak = Math.max(e.peak, e.stage === 'fire' ? e.heat + 1 : e.heat);
  }
  return out;
}

// What it cost, once it is over: days the flight on the pad slips, the rocket, and people hurt.
export function emergencyCost(e) {
  const burned = e.peak > 1; // it lit at some point
  return {
    slip: e.lost ? 0 : burned ? Math.round(6 + (e.peak - 1) * 30) : 2,
    lost: e.lost,
    hurt: e.hurt,
  };
}

// Close it: the flight slips or is lost, the record keeps it. Returns the lines for the log.
export function endEmergency(game, base, flights) {
  const e = game.emergency;
  if (!e?.done) return [];
  const cost = emergencyCost(e),
    pad = base.find(b => b.id === e.pad),
    f = flights.find(x => x.id === e.flight),
    lines = [];
  if (f && cost.lost) {
    game.flown = [...(game.flown ?? []), { id: f.id, day: game.day, pad: e.pad, result: 'lost', cause: 'pad' }];
    lines.push(`${f.name} is lost on the pad.`);
  } else if (f) {
    game.committed ??= {};
    game.committed[f.id] = (game.committed[f.id] ?? f.launch) + cost.slip;
    lines.push(`${f.name} slips ${cost.slip} day${cost.slip === 1 ? '' : 's'} while ${pad.name} is cleaned up.`);
  }
  if (cost.hurt) lines.push(`${cost.hurt} of the pad crew are in the hospital.`);
  else lines.push('Nobody was hurt.');
  game.emergencies = [
    ...(game.emergencies ?? []),
    { day: game.day, kind: e.kind, pad: e.pad, flight: e.flight, minutes: Math.round(e.t), ...cost, auto: e.auto },
  ];
  game.emergency = null;
  return lines;
}
