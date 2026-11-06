// GEMINI, FROM HOUSTON: the people, the rooms, what the tapes show and the sims for the Gemini flights worked from
// the new Mission Control at the Manned Spacecraft Center. Content only: the flight plans are in data/flights.js, and what really happens is decided in truth/flights.js.
// The people you work with are fictional; the dates, the flights and the troubles are the real ones.

// The flight control team in Houston. Hollis has moved up to director of flight operations.
export const GEMINI_PEOPLE = {
  kessler: { name: 'Walt Kessler', role: 'EECOM, spacecraft systems', color: '#4b5a48', x: 330 },
  // The flight director on the other shift: the calls that are not yours are his.
  dorsey: { name: 'Carl Dorsey', role: 'Flight director, Houston', color: '#3a4a3a', x: 360 },
};
export const GEMINI_ROLES = { hollis: 'Director of flight operations', tate: 'Retrofire officer, Houston', albrecht: 'Booster, Martin and the Air Force', morgan: 'Network, Houston', reyes: 'Recovery, U.S. Navy' };
export const GEMINI_PLACES = {
  office: 'Mission Control, Houston', hangar: 'Spacecraft checkout, Launch Complex 19', stand: 'Training and test building', dugout: 'Gemini mission simulator',
  blockhouse: 'Blockhouse, Launch Complex 19', tower: 'Erector, Launch Complex 19', truck: 'Recovery room',
};

// What the tapes show afterwards for the Titan II, by what really happened.
export const GEMINI_TAPES = {
  titanctl: ['On the tape the flight-path angle walks off the planned line, steadily, in one direction.', 'The Titan\'s autopilot readout shows one gimbal actuator lagging its command.'],
  stage2: ['The second stage stopped early, its chamber pressure falling away.', 'The velocity on the tape stops short of what orbit needs.'],
  nominal: ['Every Titan channel on the tape stays in its band from liftoff to second-stage cutoff.'],
};
// The sims the supervisor runs for a Gemini flight: the climb and insertion.
export const GEMINI_SIMS = {
  nominal: 'A clean climb to orbit. Nothing was wrong.',
  titanctl: 'A Titan guidance failure: she went off her line.',
  stage2: 'A second stage that cut off early, short of orbit.',
  seastate: 'The sea in the landing area was above state 4.',
  offstation: 'A recovery ship was not on station.',
};

// ---- The project engineer's day at Complex 19 ----
// The spacecraft's spots the project engineer checks out: the Titan is Martin's.
export const GEMINI_SPOTS = ['fuel-cells', 'hatch', 'computer', 'thrusters'];
export const GEMINI_QUALS = {
  fuelcell: { name: 'Fuel-cell soak in the chamber', fault: 'fuelcell', minutes: 240, what: 'A section runs for hours in a vacuum chamber, and its oxygen supply pressure is traced.', good: 'The supply pressure holds flat for the whole soak.', bad: 'The supply pressure sags an hour in and the heater cycles hard to catch it.' },
  hatch: { name: 'Hatch cycling in the altitude chamber', fault: 'hatch', minutes: 150, what: 'The hatch is opened and latched again at vacuum, twenty times, with the latch forces traced.', good: 'Every cycle latches with one hand\'s force.', bad: 'On the twelfth cycle the latch force doubles and stays high.' },
  computer: { name: 'Computer power-transient test', fault: 'computer', minutes: 120, what: 'The spacecraft bus is switched through its worst transients while the computer runs.', good: 'The computer rides every transient.', bad: 'On one transient the computer drops off the line and does not come back by itself.' },
  thruster: { name: 'Thruster firing under vibration', fault: 'thruster', minutes: 180, what: 'The attitude thrusters are fired on the shaker table, and every valve\'s current traced.', good: 'Every valve opens on command and shuts clean.', bad: 'Under vibration, one valve draws current with no command.' },
  chutes: { name: 'Parachute drop', fault: null, minutes: 180, what: 'A boilerplate spacecraft is dropped and the drogue and main traced.', good: 'Drogue and main open on time and the loads stay in their bands.', bad: '' },
};
