// THE LAUNCH-MORNING CALL (Aaron, 22 November 2026: "one launch-morning call that you agonise over"). The WAC Corporal
// and the Aerobee flew unguided off a tower, and the towers were set in azimuth and inclination against the wind on the
// day (Newell, Sounding Rockets, 1959): a fin-stabilised round weathercocks into a crosswind as she leaves the rail, so
// the tower is laid downwind to bring her back onto the range line. The balloons tell you the wind, but late and not
// exactly, and the wind keeps moving. This file is the hidden part: the wind as it really is, minute by minute, what a
// balloon reads of it, and where she comes down across the range. No DOM, no drawing, no draws from the round's streams.
import { windOf } from './round.js';

// The kinds of round flown unguided off a tower at White Sands.
export const AIMED = ['wac', 'aerobee'];
// Degrees she turns upwind for each km/h of crosswind as she leaves the rail. Tuned, not sourced: a slow round off a
// short tower turns a lot.
export const WEATHERCOCK = 0.45;
// Across the range line: the strip the range cleared each side of it (km), and beyond this she is off the range.
export const CLEARED_KM = 5,
  OFF_RANGE_KM = 12;
// The furthest the crew can lay the tower either way (degrees).
export const MAX_LAY = 10;

function hash01(seed, salt) {
  let h = Math.imul((seed | 0) ^ Math.imul(salt + 17, 0x9e3779b1), 2654435761);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// The crosswind across the range line at a campaign minute, km/h: positive blows toward the east. The day's wind
// (round.js windOf) sets its size and side; it wanders through the day on two slow swells and a gust.
export function crosswindAt(seed, minute) {
  const { kmh } = windOf(seed),
    side = hash01(seed, 1) < 0.5 ? -1 : 1,
    base = side * kmh * 0.8,
    swing = 5 + kmh * 0.6,
    p1 = hash01(seed, 2) * Math.PI * 2,
    p2 = hash01(seed, 3) * Math.PI * 2,
    gust = (hash01(seed, 1000 + Math.floor(minute / 6)) - 0.5) * 4;
  return base + swing * (0.65 * Math.sin(minute / 70 + p1) + 0.35 * Math.sin(minute / 23 + p2)) + gust;
}
// What a balloon reads of it, released at `minute`: whole km/h, a few km/h out either way.
export const balloonAt = (seed, minute) =>
  Math.round(crosswindAt(seed, minute) + (hash01(seed, 5000 + Math.floor(minute)) - 0.5) * 8);
// The figure the range gives for a crosswind: the lay that would bring her back on the line, to the half degree.
export const layFor = cross => Math.max(-MAX_LAY, Math.min(MAX_LAY, Math.round(WEATHERCOCK * cross * 2) / 2));
// Where she comes down across the range (km, positive east), flying `x` km downrange off a tower laid `lay` degrees
// east in a crosswind of `cross` km/h at liftoff.
export const crossImpact = (x, lay, cross) => x * Math.tan(((lay - WEATHERCOCK * cross) * Math.PI) / 180);
// 'line' inside the cleared strip, 'wide' outside it, 'off' off the range.
export const landingOf = y => (Math.abs(y) <= CLEARED_KM ? 'line' : Math.abs(y) <= OFF_RANGE_KM ? 'wide' : 'off');
// Whether the recovery party finds her: always on the line, half the time out wide, never off the range.
export const wreckFound = (seed, y) =>
  landingOf(y) === 'line' ? true : landingOf(y) === 'wide' ? hash01(seed, 9001) < 0.5 : false;
// Words for a side and a lay: "4 km east", "2.5° west".
export const sideText = (v, unit) =>
  Math.abs(v) < 0.05 ? `0${unit}` : `${Math.abs(+v.toFixed(1))}${unit} ${v > 0 ? 'east' : 'west'}`;
