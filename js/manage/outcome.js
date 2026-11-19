// MANAGEMENT MODE: how a flight your staff fly turns out. As in the Flight Director's game, the truth is decided when the
// flight is put on the manifest and never shown directly: each vehicle carries hidden fault risks, one per stage or
// system, drawn once from the game's seed. You learn the result only as a report after the flight, worded as what the
// range's instruments could show (the seeing rule). Testing and development campaigns will lower these risks later;
// `mods` already lets a cause's risk be scaled.
// Starting risks are set from each vehicle's record in 1958–60 (Vanguard 3 good flights in 11, Thor-Able and Juno II
// about half, early Atlas about two in three), split across the causes that brought them down.
import { draw } from '../core/rng.js';

// cause: [risk per flight, 'lost' (no mission) or 'short' (partly done), what the report says]
export const VEHICLE_RISKS = {
  'thor-able': [
    ['thor', 0.15, 'lost', 'the Thor first stage failed during the climb'],
    ['able', 0.15, 'short', 'the Able second stage cut off early, short of the speed it needed'],
    ['kick', 0.2, 'lost', 'the third stage did not fire'],
  ],
  juno: [
    ['jupiter', 0.15, 'short', 'the Jupiter first stage cut off early'],
    ['cluster', 0.15, 'lost', 'the clustered upper stages did not light properly'],
    ['guidance', 0.1, 'lost', 'the rocket went off course and the range safety officer destroyed it'],
  ],
  vanguard: [
    ['first', 0.3, 'lost', 'the first stage lost thrust soon after liftoff'],
    ['second', 0.3, 'lost', 'the second stage failed'],
    ['third', 0.1, 'short', 'the third stage tumbled as it separated'],
  ],
  atlas: [
    ['booster', 0.2, 'lost', 'the Atlas lost an engine during the boost'],
    ['staging', 0.15, 'short', 'the booster engines did not drop away cleanly'],
  ],
  'atlas-able': [
    ['shroud', 0.25, 'lost', 'the nose shroud broke away early and took the probe with it'],
    ['booster', 0.2, 'lost', 'the Atlas lost an engine during the boost'],
    ['able', 0.15, 'short', 'the Able upper stage cut off early'],
  ],
};

// A number from a flight's id, so each flight has its own draw from the game's seed.
const hashId = id => [...id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

// The hidden truth of one flight: { result: 'good' | 'short' | 'lost', cause, text }.
export function flightOutcome(seed, flight, mods = {}) {
  const stream = { algorithm: 'mulberry32-v1', state: (seed ^ hashId(flight.id)) >>> 0 };
  for (const [cause, risk, kind, text] of VEHICLE_RISKS[flight.vehicle] ?? []) {
    const r = risk * (mods[`${flight.vehicle}:${cause}`] ?? 1);
    if (draw(stream) < r) return { result: kind, cause, text };
  }
  return { result: 'good', cause: null, text: null };
}

// The report the base gets after the flight.
export function report(flight, o) {
  if (o.result === 'good') return `${flight.name}: a good flight. Every stage did its job.`;
  if (o.result === 'short') return `${flight.name}: partly done. Telemetry shows ${o.text}.`;
  return `${flight.name}: lost. Telemetry shows ${o.text}.`;
}
