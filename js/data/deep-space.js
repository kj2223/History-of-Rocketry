// THE PLANETS AND THE ROBOTIC MISSIONS' ROUTES, for JPL's plotting board (js/stage/deep.js). The planets go round on
// circles at their real mean speeds from their J2000 mean longitudes, so the board shows them where they really were
// on the day; each craft's route is its real encounters with their dates. The board draws the distances on a square-root
// scale (not to scale, and it says so), so Venus and Neptune fit on the same board.
import { dayOf } from '../core/calendar.js';

// au: the orbit's radius; L0: mean longitude at 1 January 2000 (degrees); P: the period in days.
export const PLANETS = {
  venus: { name: 'Venus', au: 0.723, L0: 181.98, P: 224.701, color: 0xe8d6a8, r: 7 },
  earth: { name: 'Earth', au: 1, L0: 100.46, P: 365.256, color: 0x5b93c8, r: 7 },
  mars: { name: 'Mars', au: 1.524, L0: 355.45, P: 686.98, color: 0xc8643c, r: 6 },
  jupiter: { name: 'Jupiter', au: 5.203, L0: 34.4, P: 4332.59, color: 0xd8b48a, r: 12 },
  saturn: { name: 'Saturn', au: 9.537, L0: 49.94, P: 10759.2, color: 0xe2cf92, r: 11, ring: true },
  uranus: { name: 'Uranus', au: 19.19, L0: 313.23, P: 30688.5, color: 0x9fd6dc, r: 9 },
  neptune: { name: 'Neptune', au: 30.07, L0: 304.88, P: 60182, color: 0x5d7fd6, r: 9 },
};
const J2000 = dayOf(2000, 1, 1);

// Where a planet is on a game day: [angle in radians, distance from the Sun in au].
export function planetAt(id, day) {
  const p = PLANETS[id];
  const deg = p.L0 + (360 / p.P) * (day - J2000);
  return [(((deg % 360) + 360) % 360) * (Math.PI / 180), p.au];
}

// Each round's craft: the places they pass and the days they pass them. The first is the launch from Earth.
// The Moon missions (Surveyor 1) have no route here: they go on the Earth–Moon board instead.
const leg = (planet, y, m, d, what) => ({ planet, day: dayOf(y, m, d), what });
export const ROUTES = {
  'mariner-2': [
    { name: 'Mariner 2', legs: [leg('earth', 1962, 8, 27, 'launch'), leg('venus', 1962, 12, 14, 'flyby')] },
  ],
  'mariner-4': [{ name: 'Mariner 4', legs: [leg('earth', 1964, 11, 28, 'launch'), leg('mars', 1965, 7, 15, 'flyby')] }],
  'mariner-9': [{ name: 'Mariner 9', legs: [leg('earth', 1971, 5, 30, 'launch'), leg('mars', 1971, 11, 14, 'orbit')] }],
  'viking-mars': [
    { name: 'Viking 1', legs: [leg('earth', 1975, 8, 20, 'launch'), leg('mars', 1976, 6, 19, 'orbit')] },
    { name: 'Viking 2', legs: [leg('earth', 1975, 9, 9, 'launch'), leg('mars', 1976, 8, 7, 'orbit')] },
  ],
  voyager: [
    {
      name: 'Voyager 2',
      legs: [
        leg('earth', 1977, 8, 20, 'launch'),
        leg('jupiter', 1979, 7, 9, 'flyby'),
        leg('saturn', 1981, 8, 26, 'flyby'),
        leg('uranus', 1986, 1, 24, 'flyby'),
        leg('neptune', 1989, 8, 25, 'flyby'),
      ],
    },
    {
      name: 'Voyager 1',
      legs: [
        leg('earth', 1977, 9, 5, 'launch'),
        leg('jupiter', 1979, 3, 5, 'flyby'),
        leg('saturn', 1980, 11, 12, 'flyby'),
      ],
    },
  ],
  galileo: [
    {
      name: 'Galileo',
      legs: [
        leg('earth', 1989, 10, 18, 'launch'),
        leg('venus', 1990, 2, 10, 'flyby'),
        leg('earth', 1990, 12, 8, 'flyby'),
        leg('earth', 1992, 12, 8, 'flyby'),
        leg('jupiter', 1995, 12, 7, 'orbit'),
      ],
    },
  ],
  pathfinder: [{ name: 'Pathfinder', legs: [leg('earth', 1996, 12, 4, 'launch'), leg('mars', 1997, 7, 4, 'landing')] }],
  cassini: [
    {
      name: 'Cassini',
      legs: [
        leg('earth', 1997, 10, 15, 'launch'),
        leg('venus', 1998, 4, 26, 'flyby'),
        leg('venus', 1999, 6, 24, 'flyby'),
        leg('earth', 1999, 8, 18, 'flyby'),
        leg('jupiter', 2000, 12, 30, 'flyby'),
        leg('saturn', 2004, 7, 1, 'orbit'),
      ],
    },
  ],
  perseverance: [
    { name: 'Perseverance', legs: [leg('earth', 2020, 7, 30, 'launch'), leg('mars', 2021, 2, 18, 'landing')] },
  ],
};

// Where a craft is on a day: [angle, au]. Between two places it sweeps forward (the way the planets go) from one to
// the other, its distance from the Sun changing smoothly; a loop back to the same planet goes once round. After the last place
// it stays with that planet (in orbit or landed) or, after a last flyby, carries on outwards on its last heading.
export function craftAt(craft, day) {
  const L = craft.legs;
  if (day <= L[0].day) return planetAt(L[0].planet, day);
  for (let i = 0; i < L.length - 1; i++) {
    const a = L[i],
      b = L[i + 1];
    if (day > b.day) continue;
    const [a0, r0] = planetAt(a.planet, a.day),
      [a1, r1] = planetAt(b.planet, b.day);
    let sweep = a1 - a0;
    while (sweep <= 0.2) sweep += Math.PI * 2;
    const k = (day - a.day) / (b.day - a.day),
      ease = k * k * (3 - 2 * k);
    const loop = a.planet === b.planet || r1 < r0 ? Math.sin(Math.PI * k) * 0.25 * Math.max(r0, r1) : 0;
    return [a0 + sweep * k, r0 + (r1 - r0) * ease + loop];
  }
  const last = L[L.length - 1];
  if (last.what !== 'flyby') return planetAt(last.planet, day);
  const [a, r] = planetAt(last.planet, last.day);
  return [a + 0.02 * Math.log1p((day - last.day) / 365), r + ((day - last.day) / 365) * 3.5];
}

// The furthest planet a round's board has to show.
export function routeReach(id) {
  const routes = ROUTES[id] || [];
  return Math.max(1.6, ...routes.flatMap(c => c.legs.map(l => PLANETS[l.planet].au)));
}
