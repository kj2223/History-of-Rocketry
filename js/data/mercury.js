// MERCURY CONTROL: the people, the count, the training sims and what the tapes show, for the Mercury flights worked from a
// console at the Cape. Content only: what really happens on a flight is decided in truth/capsule.js.
// The people you work with are fictional, as at White Sands; the dates and the flights are the real ones.

// Who sits where in Mercury Control, and who is on the pad. x: where they stand on the site (world units).
export const MERCURY_PEOPLE = {
  hollis: { name: 'Frank Hollis', role: 'Flight director, Mercury Control', color: '#3d4f6e', x: 180 },
  reyes: { name: 'Cmdr. Luis Reyes', role: 'Recovery, U.S. Navy', color: '#2f3f66', hat: '#e9e9e4', x: 240 },
  albrecht: { name: 'Kurt Albrecht', role: 'Booster, Marshall', color: '#6b5a4a', x: 270 },
  // Takes the Retrofire console when you move to the project office.
  tate: { name: 'Bill Tate', role: 'Retrofire officer, Mercury Control', color: '#4a5560', x: 300 },
};
// What the other people do in Mercury rounds.
export const MERCURY_ROLES = {
  morgan: 'Network, Mercury Control',
  vega: 'Pad leader, Launch Complex 5',
  brandt: 'NASA operations, the Cape schedule',
  kowalski: 'Pad crew',
  delgado: 'Pad crew',
};
// The buildings, as they are at the Cape in the Mercury years.
export const MERCURY_PLACES = {
  office: 'Mercury Control',
  hangar: 'Hangar S',
  stand: 'Training building',
  dugout: 'Training building: the simulator',
  blockhouse: 'Blockhouse, Launch Complex 5',
  tower: 'Gantry, Launch Complex 5',
  truck: 'Recovery room',
};

// The count in Mercury Control, from T minus 15 minutes. poll: the flight director asks for your status.
export const MERCURY_COUNT = [
  { at: 900, who: 'hollis', text: 'All flight controllers, we are picking up the count at T minus fifteen.' },
  { at: 840, who: 'albrecht', text: 'Booster: oxygen topping, all pressures normal.' },
  { at: 720, who: 'morgan', text: 'Network: Bermuda and the range radars are up and tracking the balloon.' },
  { at: 600, who: 'hollis', text: 'Retro, Recovery: give me the recovery area.', poll: 'recovery' },
  { at: 480, who: 'vega', text: 'Pad: gantry is back. Pad is clear.' },
  { at: 300, who: 'reyes', text: 'Recovery: the forces are standing by.' },
  { at: 120, who: 'hollis', text: 'All flight controllers, final status check.', poll: 'final' },
  { at: 60, who: 'albrecht', text: 'Booster: one minute. Everything in the band.' },
  ...[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => ({ at: n, who: 'vega', text: `${n}…`, quick: true })),
  { at: 0, who: 'vega', text: 'Ignition!', tone: 'go' },
];

// What the recovery board says about each unit.
export const UNITS = {
  carrier: 'The carrier, with its helicopters, on the planned splashdown point at 486 km',
  uprange: 'The uprange destroyer, at 300 km',
  downrange: 'The downrange destroyer, at 640 km',
};
// Mission rule: no launch with the sea above state 4 in the recovery area. The helicopters cannot pick up in it.
export const SEA_LIMIT = 4;

// What the tapes and the pad show afterwards, by what really happened to the booster. The review works from these.
export const TAPES = {
  plug: [
    'The engine lit and shut down within a second. The booster rose about four inches and settled back on its pad.',
    'The cutoff signal came at the instant the tail plug pulled out of the booster.',
    'The escape tower fired away on its own, and the capsule put its parachutes out on top of the rocket.',
  ],
  control: [
    'On the tape the flight-path angle walks off the planned line, steadily, in one direction.',
    "Marshall's readout of the autopilot shows one pitch gyro drifting.",
  ],
  lox: [
    'The engine stopped early, the chamber pressure falling away over a second or two.',
    'The oxygen inlet pressure sags in the seconds before the cutoff.',
  ],
  thrust: [
    'The velocity ran above the planned line all the way up, and the engine ran dry at 137 seconds.',
    "The thrust controller's channel sits pinned at its limit from early in the burn.",
  ],
  nominal: ['Every booster channel on the tape stays in its band from liftoff to cutoff.'],
};

// The pad after a Redstone shuts down on it: what Mercury Control can do with a live capsule on a fuelled rocket.
export const PAD_OPTIONS = {
  wait: 'Leave her overnight. By morning the batteries will have run down and the oxygen boiled off, and the pad crew can safe her.',
  now: 'Send the pad crew out now to safe the capsule and drain the booster.',
  shoot: 'Have the range shoot holes in the tanks with a rifle and drain her.',
};

// The training sims the sim supervisor can throw at you, and what each one was, for the debrief afterwards.
export const SIMS = {
  nominal: 'A clean flight. Nothing was wrong.',
  control: 'A control failure: the autopilot drifted and took her off her line.',
  lox: 'An oxygen leak: the engine cut off early and she fell short.',
  thrust: 'An over-thrust: she ran hot and fast, and ran dry early.',
  radar: "A radar dropout: the radar's impact point was off by a long way.",
  seastate: 'The sea in the recovery area was above state 4.',
  offstation: 'One of the destroyers was not on station.',
};
export const SIM_MINUTES = 45;

// ---- Orbital flights, on the Atlas (from 1962) ----
// The recovery board for an orbital flight: the carrier on the planned point in the Atlantic, destroyers up and down the
// track, and the ships in the abort areas under the climb.
export const ORBIT_UNITS = {
  carrier: 'The carrier, with its helicopters, on the planned splashdown point north of Grand Turk',
  uprange: 'The destroyer 300 km uprange of the planned point',
  downrange: 'The destroyer 300 km downrange of the planned point',
};
// The Mercury tracking network, in the order the capsule passes over it on each orbit, and the minute after liftoff on the
// first orbit. One orbit is about 88 minutes.
export const STATIONS = [
  { at: 7, name: 'Bermuda' },
  { at: 15, name: 'Canary Islands' },
  { at: 22, name: 'Kano, Nigeria' },
  { at: 30, name: 'Zanzibar' },
  { at: 40, name: 'The Indian Ocean ship' },
  { at: 50, name: 'Muchea, Australia' },
  { at: 55, name: 'Woomera' },
  { at: 65, name: 'Canton Island' },
  { at: 75, name: 'Hawaii' },
  { at: 82, name: 'California' },
  { at: 85, name: 'Guaymas, Mexico' },
  { at: 87, name: 'Texas' },
];
// Retrofire is over California on the last orbit.
export const RETRO_STATION = 'California';
export const PACK_OPTIONS = {
  keep: 'Leave the retro pack on through entry. Its straps would hold a loose shield against the capsule until the air does.',
  jettison: 'Jettison the retro pack as planned. A strapped-on pack burning off in entry could damage a good shield.',
};
export const RETRO_OPTIONS = {
  auto: 'Retrofire on the automatic system, holding the attitude the scanners give it.',
  manual:
    'Have him fire by hand, lined up on the horizon through his window. Late by a second or two, and it costs fuel.',
};
// What the tapes and the capsule show afterwards, for an orbital flight. The review works from these.
export const ORBIT_TAPES = {
  guidance: [
    'On the tape the flight-path angle walks off the planned line, steadily, in one direction.',
    "Convair's readout of the Atlas autopilot shows the programmer stepping late.",
  ],
  shortburn: [
    'The sustainer stopped early, its chamber pressure falling away over a second or two.',
    'The velocity on the tape stops short of what orbit needs.',
  ],
  nominal: ['Every channel on the Atlas tape stays in its band from liftoff to cutoff.'],
};
// The sims the supervisor can run for an orbital flight.
export const ORBIT_SIMS = {
  nominal: 'A clean flight to orbit and home. Nothing was wrong.',
  guidance: 'An Atlas guidance failure: she went off her line.',
  shortburn: 'An Atlas sustainer that cut off early, short of orbit.',
  seg51loose: 'Segment 51 lit, and the heat shield really was loose.',
  seg51false: 'Segment 51 lit, but it was a bad switch: the shield was tight.',
  scanner: 'A bad horizon scanner: the automatic system held the wrong attitude and burned fuel.',
  seastate: 'The sea in the recovery area was above state 4.',
};

// ---- The project engineer's day in Hangar S (from 1961) ----
// The capsule's spots the project engineer checks out: the Atlas is Convair's.
export const CAPSULE_SPOTS = ['heat-shield', 'scanners'];
export const LOOK_MINUTES = 40;
// The qualification tests in the test rooms, the fault kind each can show, and how long each takes.
export const QUAL_TESTS = {
  bag: {
    name: 'Landing-bag drop test',
    fault: 'shield',
    minutes: 150,
    what: 'The capsule is dropped onto the water tank with the bag deployed, and the latch loads are traced.',
    good: 'Every latch load stays in its band through the drop.',
    bad: 'One latch trace drops to nothing halfway through the drop, then comes back.',
  },
  horizon: {
    name: 'Heated-horizon scanner test',
    fault: 'scanner',
    minutes: 120,
    what: 'Each scanner is swept across a heated horizon target and its attitude output traced.',
    good: 'Both scanners track the target to within a degree.',
    bad: "One scanner's trace wanders more than twenty degrees off the target before it settles.",
  },
  chutes: {
    name: 'Parachute drop',
    fault: null,
    minutes: 180,
    what: 'A boilerplate capsule is dropped from a C-130 and the drogue and main traced.',
    good: 'Drogue and main open on time and the loads stay in their bands.',
    bad: '',
  },
  tower: {
    name: 'Escape tower firing',
    fault: null,
    minutes: 180,
    what: 'An escape tower fires a boilerplate capsule off a stand.',
    good: 'The tower pulls clean and the capsule separates on time.',
    bad: '',
  },
};
