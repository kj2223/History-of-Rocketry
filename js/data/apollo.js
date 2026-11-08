// APOLLO, FROM HOUSTON AND PAD 39: the places, the checkout list, the qualification tests, what the tapes show and the
// sims for the Apollo flights. Content only: the flight plans are in data/flights.js, and what really happens is decided
// in truth/flights.js. The people are fictional; the dates, the flights and the troubles are the real ones.

export const APOLLO_PLACES = {
  office: 'Mission Control, Houston',
  hangar: 'Vehicle Assembly Building',
  stand: 'Manned Spacecraft Operations Building',
  dugout: 'Apollo mission simulator',
  blockhouse: 'Launch Control Center',
  tower: 'Pad 39A',
  truck: 'Recovery room',
};
// The spots the checkout seats look over: the programme office answers for all of it, the project engineer for the
// spacecraft.
export const APOLLO_SPOTS = [
  'f1-engines',
  's2-engines',
  's4b',
  'sps',
  'o2-tanks',
  'cabin-wiring',
  'lm-computer',
  'lm-ascent',
  'chutes',
];
export const APOLLO_QUALS = {
  pogo: {
    name: 'First-stage vibration test',
    fault: 'pogo',
    minutes: 240,
    what: 'The stage is shaken through its flight frequencies with the propellant lines full of water, and the line pressures traced.',
    good: 'The line pressures stay flat through the sweep.',
    bad: "Near five cycles a second the line pressures and the stage's own shaking climb together.",
  },
  j2: {
    name: 'J-2 igniter line vacuum test',
    fault: 'j2',
    minutes: 180,
    what: 'An igniter line is flexed in a vacuum chamber with propellant flowing, and its leak rate traced.',
    good: 'No leak through a thousand flexes.',
    bad: 'The line starts to leak after a few hundred flexes in vacuum.',
  },
  tank: {
    name: 'Oxygen tank detanking test',
    fault: 'tank',
    minutes: 200,
    what: 'Each oxygen tank is filled and emptied as in the countdown, and its heater and quantity traced.',
    good: 'Both tanks empty normally.',
    bad: 'Tank two will not empty normally and its heater runs for hours.',
  },
  alarm: {
    name: 'Lander computer descent run with the radar on',
    fault: 'alarm',
    minutes: 150,
    what: "The lander's computer flies a full descent in the simulator with every switch as the crew will set it.",
    good: "The computer's load stays well under its limit.",
    bad: 'With the rendezvous radar switched on, the computer runs out of time and restarts.',
  },
  ascent: {
    name: 'Ascent engine hot firing',
    fault: 'ascent',
    minutes: 240,
    what: 'A flight-type ascent engine is fired at White Sands for its full burn, and its thrust traced.',
    good: 'Thrust holds at 3,500 pounds for the whole burn.',
    bad: 'Thrust sags a few percent and the chamber pressure wanders.',
  },
  cabin: {
    name: 'Cabin wiring and materials inspection',
    fault: 'cabin',
    minutes: 300,
    what: "The command module's wiring is inspected bundle by bundle, and its materials burned in pure oxygen in the lab.",
    good: 'No chafing, and every material self-extinguishes.',
    bad: "Chafed insulation under the couches, and the cabin's netting burns fiercely in pure oxygen.",
  },
};
// What the tapes show for the Saturn V's climb, by what really happened.
export const APOLLO_TAPES = {
  saturnctl: [
    'On the tape the flight-path angle walks off the planned line, steadily, in one direction.',
    "The instrument unit's platform gimbal current climbs before it goes.",
  ],
  s2cutoff: [
    'The second stage stopped early, its chamber pressures falling away together.',
    'The velocity on the tape stops short of what orbit needs.',
  ],
  nominal: ['Every Saturn channel on the tape stays in its band from liftoff to orbit.'],
};
export const APOLLO_SIMS = {
  nominal: 'A clean climb to orbit. Nothing was wrong.',
  saturnctl: 'A Saturn guidance failure: she went off her line.',
  s2cutoff: 'A second stage that cut off early, short of orbit.',
  seastate: 'The sea in the landing area was above state 4.',
  offstation: 'A recovery ship was not on station.',
};
