// THE ANOMALY LEDGER: the small things the tapes and the hardware showed after a flight that nobody called a failure.
// A scorched seal, a gyro a little out of spec, foam off the tank. Each goes on the ledger, and before the next flight
// someone has to sign it off as "in family" or hold it open and work it. Most are nothing. A few are the start of a
// loss: Challenger's O-ring erosion and Columbia's foam strikes were both seen, flight after flight, and signed off.
//
// What the player sees: the item, the flights it was seen on, and whether it came back worse. What stays hidden: whether
// it is real (entry.real). A real item left signed off makes its fault likelier on later rounds of that family (only the
// threshold moves, never the draws: truth/round.js). Working a real one finds it and cuts its fault; working one that is
// nothing costs the time and some of your boss's patience.

import { newStreams, draw } from '../core/rng.js';

// The vehicles that share hardware, so an item seen on one can come back on another.
export const FAMILY = {
  redstone: 'mercury',
  atlas: 'mercury',
  titan: 'gemini',
  saturnib: 'saturn',
  saturn5: 'saturn',
  shuttle: 'shuttle',
  sls: 'sls',
  dragon: 'dragon',
};

// fault: the hidden fault kind it bears on (its risk is `${fault}Risk`). real: how often an item like it is the real
// thing. seen / again / worse: what the post-flight report says the first time, on a later flight the same, or worse.
export const ANOMALIES = {
  mercury: [
    {
      fault: 'control',
      real: 0.3,
      seen: "The autopilot's pitch gyro drifted a little past its spec on the tapes.",
      again: 'The pitch gyro drifted again, about as much as last time.',
      worse: 'The pitch gyro drifted further than last time.',
    },
    {
      fault: 'shield',
      real: 0.3,
      seen: 'A landing-bag latch showed a load spike at separation, then settled.',
      again: 'The landing-bag latch spiked again, about as before.',
      worse: 'The landing-bag latch spiked harder, and took longer to settle.',
    },
  ],
  gemini: [
    {
      fault: 'fuelcell',
      real: 0.3,
      seen: "The fuel cells' oxygen pressure sagged an hour in, then came back.",
      again: 'The fuel-cell oxygen pressure sagged again, and came back again.',
      worse: 'The fuel-cell oxygen pressure sagged lower this time, and was slower to come back.',
    },
    {
      fault: 'thruster',
      real: 0.3,
      seen: 'One roll thruster ran warm on its temperature pickup.',
      again: 'The same roll thruster ran warm again.',
      worse: 'The roll thruster ran hotter this time, and twitched once on the rate gyro.',
    },
  ],
  saturn: [
    {
      fault: 'pogo',
      real: 0.4,
      seen: 'The first stage shook at about five cycles a second for a few seconds before cutoff.',
      again: 'The first stage shook again before cutoff, about as much.',
      worse: 'The first stage shook harder before cutoff, and for longer.',
    },
    {
      fault: 'tank',
      real: 0.3,
      seen: "A service-module oxygen tank's heater cycled oddly in the checkout before flight.",
      again: 'The tank heater cycled oddly again in the checkout.',
      worse: 'The tank heater cycled oddly again, and the tank was slow to detank.',
    },
    {
      fault: 'chute',
      real: 0.3,
      seen: 'One main parachute came out a second slower than the other two.',
      again: 'A main parachute was slow again.',
      worse: 'A main parachute was slower still, and its riser showed scorching.',
    },
  ],
  shuttle: [
    {
      fault: 'oring',
      real: 0.5,
      seen: 'Soot past the primary O-ring on one booster field joint, and a little erosion of the ring.',
      again: 'Soot past a primary O-ring again, about the same.',
      worse: 'Soot past the primary O-ring again, more erosion, and a trace past the secondary.',
    },
    {
      fault: 'foam',
      real: 0.5,
      seen: "Foam came off the tank's bipod ramp. The orbiter's tiles came back with dings.",
      again: 'Foam off the tank again, and dings in the tiles about as before.',
      worse: 'A bigger piece of foam came off this time, and a tile came back gouged.',
    },
  ],
  sls: [
    {
      fault: 'oring',
      real: 0.3,
      seen: 'Soot past a primary O-ring on one booster field joint.',
      again: 'Soot past a primary O-ring again.',
      worse: 'More soot past the primary O-ring, and the ring eroded.',
    },
    {
      fault: 'chute',
      real: 0.3,
      seen: "One of Orion's main parachutes came out slow.",
      again: "One of Orion's mains was slow again.",
      worse: "One of Orion's mains was slower still, and a riser came back scorched.",
    },
  ],
  dragon: [
    {
      fault: 'merlin',
      real: 0.3,
      seen: "One Merlin's turbopump ran a little rough at throttle-up.",
      again: 'The same kind of roughness at throttle-up again.',
      worse: 'Rougher at throttle-up this time, on two engines.',
    },
  ],
};

export const NEW_CHANCE = 0.3; // after a flight, the chance of a new item on the ledger
export const MAX_GRADE = 3; // how much worse a real item can get
export const GROWTH = 0.35; // a real item signed off raises its fault's risk by this much per grade
export const WORKED = 0.6; // a real item worked and found cuts its fault's risk to this share
export const SLIP_DAYS = 7; // what working an item costs the Apollo schedule

export const initLedger = () => [];
const ledgerOf = programme => (programme.ledger = programme.ledger || initLedger());

// After a flight: items already signed off come back (the same, or worse if real), and maybe a new one appears.
// Returns the lines for the review. Seeded by the game's seed and the round, on its own stream.
export function afterFlight(programme, { vehicle, seed, index, name }) {
  const family = FAMILY[vehicle];
  if (!family) return [];
  const rng = newStreams(((seed ^ 0x1ed6e7) + index * 104729) >>> 0).observation;
  const ledger = ledgerOf(programme),
    lines = [];
  for (const e of ledger.filter(x => x.family === family && x.status === 'accepted')) {
    const spec = specOf(e);
    if (e.real) {
      e.grade = Math.min(MAX_GRADE, e.grade + 1);
      e.seen.push(name);
      e.trend = 'worse';
      e.status = 'new'; // back on the agenda: it needs a call again before the next flight
      lines.push(spec.worse);
    } else if (draw(rng) < 0.5) {
      e.seen.push(name);
      e.trend = 'same';
      e.status = 'new';
      lines.push(spec.again);
    }
  }
  const pick = draw(rng),
    which = draw(rng),
    real = draw(rng);
  const open = new Set(ledger.filter(x => x.family === family && x.status !== 'closed').map(x => x.fault));
  const fresh = ANOMALIES[family].filter(a => !open.has(a.fault));
  if (pick < NEW_CHANCE && fresh.length) {
    const spec = fresh[Math.floor(which * fresh.length)];
    ledger.push({
      id: `${family}-${spec.fault}-${index}`,
      family,
      fault: spec.fault,
      real: real < spec.real,
      grade: 0,
      seen: [name],
      trend: 'new',
      status: 'new',
    });
    lines.push(spec.seen);
  }
  return lines;
}

const specOf = e => ANOMALIES[e.family].find(a => a.fault === e.fault);
export const textOf = e => {
  const s = specOf(e);
  return e.trend === 'worse' ? s.worse : e.trend === 'same' ? s.again : s.seen;
};

// The items waiting on a call before the next flight, and the ones signed off, as the player can see them.
export const openItems = programme => (programme.ledger || []).filter(e => e.status === 'new');
export const signedOff = programme => (programme.ledger || []).filter(e => e.status === 'accepted');

// Sign an item off as in family. It stays on the ledger, and comes back after the next flights of its family.
export function accept(programme, id) {
  const e = (programme.ledger || []).find(x => x.id === id);
  if (!e || e.status === 'closed') return null;
  e.status = 'accepted';
  return 'Signed off as in family.';
}

// Hold an item open and work it before the next flight. Returns { found, text }: a real item is found and fixed; an item
// that is nothing is closed with nothing found.
export function work(programme, id) {
  const e = (programme.ledger || []).find(x => x.id === id);
  if (!e || e.status === 'closed') return null;
  e.status = 'closed';
  e.worked = true;
  return e.real
    ? { found: true, text: 'They found it: a real fault in the making, not a quirk. It is fixed in the build.' }
    : { found: false, text: 'They took it apart and found nothing out of family. It is closed.' };
}

// Before the next round: items nobody called are signed off by default, as they were in the real programme.
export function signOffUnclaimed(programme) {
  const n = openItems(programme);
  for (const e of n) accept(programme, e.id);
  return n.length;
}

// The round's risks with the ledger applied: real items signed off raise their fault, real items worked lower it.
export function withLedger(risks, programme, vehicle) {
  const family = FAMILY[vehicle];
  if (!family || !programme.ledger?.length) return risks;
  const out = { ...risks };
  for (const e of programme.ledger) {
    if (e.family !== family || !e.real) continue;
    const k = `${e.fault}Risk`;
    if (out[k] == null) continue;
    if (e.status === 'accepted') out[k] = Math.min(0.95, out[k] * (1 + GROWTH * Math.max(1, e.grade)));
    else if (e.worked) out[k] = out[k] * WORKED;
  }
  return out;
}

// The signed-off items that bore on a loss, for the review: "it was on the ledger since...".
export const onLedgerFor = (programme, vehicle, fault) =>
  (programme.ledger || []).filter(e => e.family === FAMILY[vehicle] && e.fault === fault && e.status === 'accepted');
