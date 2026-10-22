// THE LAUNCH SITE: base upgrades, control rooms and the launch crew. Tune facility and crew costs here.
// The keys are stored in saves.

// Base upgrades.
//   cost ($), requires: another facility needed first, fromDirective: available once this many Phase One directives are met,
//   consoles: launch-crew consoles it adds, controlRoom: 1 if it is a step up in control room (see ROOMS),
//   nasa: 1 if it opens only with NASA, buildDays: construction time in game days (ordered now, in service later).
export const FACILITIES = {
  tty: { name: 'Teleprinter & Range Communications', cost: 12000, description: 'Teleprinters link the blockhouse to the range. Unlocks the Telemetry Engineer.', requires: null, fromDirective: 0, consoles: 1, controlRoom: 1 },
  plot: { name: 'Plotting Board', cost: 18000, description: 'A live trajectory plot on the wall. Unlocks the Structures & Booster Engineer.', requires: 'tty', fromDirective: 0, consoles: 1, controlRoom: 1 },
  comp: { name: 'Range Computer (IBM 704)', cost: 40000, description: 'Halves the uncertainty of pre-flight estimates. Unlocks the Flight Dynamics Officer.', requires: 'plot', fromDirective: 1, consoles: 2, controlRoom: 1 },
  mcc: { name: 'Mercury-Style Control Center', cost: 60000, description: 'Rows of consoles and a world map. Unlocks the Flight Director.', requires: 'comp', fromDirective: 2, consoles: 3, controlRoom: 1 },
  wall: { name: 'Wall Displays & World Tracking Map', cost: 45000, description: 'The big board. Pre-flight estimates a further 20% tighter.', requires: 'mcc', fromDirective: 3, consoles: 2, controlRoom: 1 },
  radar: { name: 'Tracking Radar Network', cost: 30000, description: 'Sharper, faster plots and a velocity track.', requires: null, fromDirective: 0, consoles: 0, controlRoom: 0 },
  ship: { name: 'Downrange Tracking Ship', cost: 25000, description: 'Tracks horizontal velocity, raises grants and helps find payloads downrange.', requires: 'radar', fromDirective: 1, consoles: 0, controlRoom: 0 },
  wx: { name: 'Range Weather Station', cost: 8000, description: 'Forecasts winds before each launch. Gusts raise aerodynamic loads; with a Range Safety Officer, high winds become a NO-GO.', requires: null, fromDirective: 0, consoles: 0, controlRoom: 0 },
  stand: { name: 'Static Engine Test Stand', cost: 22000, description: 'Ground-test finished propulsion packages to confirm them without risking a flight.', requires: null, fromDirective: 0, consoles: 0, controlRoom: 0 },
  recov: { name: 'Recovery Force & Helicopter Pad', cost: 20000, description: 'Search odds for payloads +20%. Unlocks the Recovery Controller.', requires: null, fromDirective: 1, consoles: 0, controlRoom: 0 },
  jigs: { name: 'Assembly Jigs & Fixtures', cost: 25000, description: 'Purpose-built jigs hold every airframe and capsule the same way. All factory work 25% faster.', requires: null, fromDirective: 1, consoles: 0, controlRoom: 0 },
  nc: { name: 'Numerically Controlled Machining', cost: 60000, description: 'Tape-driven machine tools cut parts straight from the drawings. All factory work a further 25% faster.', requires: 'jigs', fromDirective: 3, consoles: 0, controlRoom: 0 },
  centrifuge: { name: 'Human Centrifuge', cost: 35000, description: 'Full-rate g-tolerance training. Without it, physical training runs at 40%.', requires: null, fromDirective: 0, consoles: 0, controlRoom: 0, nasa: 1 },
  zerog: { name: 'Zero-G Training Aircraft', cost: 20000, description: 'Parabolic flights give astronauts seconds of weightlessness at a time: composure training at full rate.', requires: null, fromDirective: 0, consoles: 0, controlRoom: 0, nasa: 1 },
  egress: { name: 'Water Egress Tank', cost: 12000, description: 'Practise getting out of a capsule in the water. Egress training at full rate.', requires: null, fromDirective: 0, consoles: 0, controlRoom: 0, nasa: 1 },
  ptrain: { name: 'Mercury Procedures Trainer', cost: 25000, description: 'Simulator tier 1: analog computers behind a mock instrument panel. Training value doubles over classroom work.', requires: null, fromDirective: 0, consoles: 0, controlRoom: 0, nasa: 1 },
  msim: { name: 'Mercury Mission Simulator', cost: 60000, description: 'Simulator tier 2: digital computers drive a flight-faithful cockpit. Full training value and more rehearsed failures.', requires: 'ptrain', fromDirective: 0, consoles: 0, controlRoom: 0, nasa: 1 },
  clean: { name: 'Spacecraft Clean Room', cost: 40000, description: 'A dust-free hall for capsule assembly and checkout. Capsules build 30% faster.', requires: null, fromDirective: 0, consoles: 0, controlRoom: 0, nasa: 1 },
  trknet: { name: 'Mercury Worldwide Tracking Network', cost: 150000, description: 'Eighteen ground stations and two ships around the world, linked to the Cape by teleprinter. Required before a crew flies. With full coverage, CAPCOM advice in flight is better. Construction takes about ten months.', requires: null, fromDirective: 0, consoles: 0, controlRoom: 0, nasa: 1, buildDays: 300 },
};
// The control-room upgrades in order; the number built is the room level (0 to 5), an index into ROOMS.
export const CONTROL_ROOM_FACILITIES = ['tty', 'plot', 'comp', 'mcc', 'wall'];
export const ROOMS = [
  { name: 'Blockhouse, White Sands Proving Ground', description: 'A concrete bunker, a periscope and a handful of engineers.' },
  { name: 'Blockhouse with Range Communications', description: 'Teleprinters chatter. The range can finally talk back.' },
  { name: 'Range Control Center', description: 'A plotting board tracks every flight across the wall.' },
  { name: 'Range Control & Computing Center', description: 'Tape reels spin. The computer predicts what the slide rule guessed.' },
  { name: 'Mercury Control Center', description: 'Rows of consoles, a world map, and a Flight Director running the poll.' },
  { name: 'Mission Operations Control Room', description: 'The big board. Every station on the loop, every flight on the screen.' },
];

// The launch crew. cost to hire ($), salary per 30-second funding cycle, requires: facility needed,
// catches: failure modes (data/failures.js) the station can catch in the pre-launch poll, nasa: opens with NASA.
export const STATIONS = {
  tc: { name: 'Test Conductor (you)', callSign: 'TC', cost: 0, salary: 0, requires: null, catches: '', description: 'Runs the count and the walkdown. Always on the net.' },
  prop: { name: 'Propulsion Engineer', callSign: 'PROP', cost: 6000, salary: 400, requires: null, catches: 'cpiv', description: 'Checks engine, pumps, igniters and valves before launch.' },
  rso: { name: 'Range Safety Officer', callSign: 'RSO', cost: 5000, salary: 300, requires: null, catches: '', description: 'Commands destruct on a failing vehicle, cutting reputation lost to failures by 30%. With a weather station, calls NO-GO on high winds.' },
  tlm: { name: 'Telemetry Engineer', callSign: 'TLM', cost: 8000, salary: 500, requires: 'tty', catches: 'v', description: 'Watches the telemetry checkout and steers failure investigations toward the right answer.' },
  bstr: { name: 'Structures & Booster Engineer', callSign: 'BSTR', cost: 9000, salary: 600, requires: 'plot', catches: 'sx', description: 'Leak and pressure checks on tankage; arms and checks staging circuits.' },
  fido: { name: 'Flight Dynamics Officer', callSign: 'FIDO', cost: 12000, salary: 700, requires: 'comp', catches: 'hf', description: 'Checks the airframe against aero and heating loads and tightens the pre-flight estimate.' },
  rec: { name: 'Recovery Controller', callSign: 'REC', cost: 8000, salary: 500, requires: 'recov', catches: '', description: 'Coordinates recovery forces: search odds +15%.' },
  fd: { name: 'Flight Director', callSign: 'FLIGHT', cost: 20000, salary: 1200, requires: 'mcc', catches: '', description: 'Runs the go/no-go poll: every station catches faults 15% more often.' },
  capcom: { name: 'Capsule Communicator', callSign: 'CAPCOM', cost: 6000, salary: 500, requires: 'mcc', catches: '', nasa: 1, description: 'An astronaut on the ground who talks to the crew. Every crew decision in flight goes better.' },
  surg: { name: 'Flight Surgeon', callSign: 'SURG', cost: 8000, salary: 600, requires: null, catches: '', nasa: 1, description: 'Watches the crew\'s heart rate and breathing in flight and halves the time injured astronauts are grounded.' },
};
