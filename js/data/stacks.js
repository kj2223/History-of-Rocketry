// THE STACKS: each launch vehicle as the stages it really flew, bottom to top. Public engineering figures, rounded: what a
// booster's own handbook would give. The flight is worked out from these a stage at a time (truth/stages.js): each stage
// burns its own propellant at its own thrust, the stack gets lighter as it burns, and at staging the empty stage drops
// away and the next one lights, so the acceleration falls back and builds again.
//
// A stage, or a phase of one where engines drop away in flight (the Atlas's booster section, the Shuttle's and SLS's solid
// boosters):
//   name     what the console calls the stage that is burning
//   burn     seconds it burns
//   thrust   kN, averaged over the burn
//   prop     tonnes of propellant it burns
//   drop     tonnes that fall away when it is done (an empty stage, boosters, an interstage)
//   call     what Booster says on the loop when it is done and the next stage takes over
// dry: tonnes still on top after the last burn (the last stage empty, the spacecraft, any propellant kept for later).
// maxG: the most the engines are throttled to let her pull, where they are (the Shuttle, SLS and Falcon 9).
// shortburn: which stage an early cutoff strikes (the booster's own 'shortburn' fault: Atlas sustainer, Titan second
// stage, Saturn's S-II or S-IVB, the Shuttle's main engines).
// tower: second after liftoff that the escape tower is jettisoned, where she has one.
// Orbital boosters: the planned cutoff is ORBIT_PLAN's (about 7.84 km/s, level, 160 km up). Losses to gravity and air
// are taken off so that a good flight reaches it; a stage that cuts off early leaves its share of the speed unflown.

export const ORBITAL_STACKS = {
  // Mercury-Atlas (MA-6, 1962): the booster section drops at about 130 s, the sustainer burns on to about 300 s.
  atlas: {
    stages: [
      {
        name: 'Boosters and sustainer',
        burn: 130,
        thrust: 1600,
        prop: 86,
        drop: 3,
        call: 'Booster engines cutoff. The sustainer is still burning.',
      },
      { name: 'Sustainer', burn: 170, thrust: 360, prop: 19, drop: 0 },
    ],
    dry: 5,
    shortburn: 1,
    tower: 155,
  },
  // Titan II GLV (Gemini, 1965-66): first stage about 156 s, second stage about 180 s more.
  titan: {
    stages: [
      {
        name: 'First stage',
        burn: 156,
        thrust: 1900,
        prop: 117,
        drop: 4.3,
        call: 'First stage cutoff and separation. Second stage ignition confirmed.',
      },
      { name: 'Second stage', burn: 180, thrust: 445, prop: 27.4, drop: 0 },
    ],
    dry: 6.5,
    shortburn: 1,
  },
  // Saturn IB (Apollo 7, Skylab, Apollo-Soyuz): the S-IB for about 141 s, the S-IVB to orbit at about 10 minutes.
  saturnib: {
    stages: [
      {
        name: 'S-IB first stage',
        burn: 141,
        thrust: 7100,
        prop: 400,
        drop: 45,
        call: 'First stage cutoff and separation. S-IVB ignition.',
      },
      { name: 'S-IVB', burn: 470, thrust: 1000, prop: 104, drop: 0 },
    ],
    dry: 33,
    shortburn: 1,
    tower: 165,
  },
  // Saturn V (Apollo 11, 1969): S-IC to about 161 s, S-II to about 551 s, the S-IVB's first burn to orbit at about 700 s.
  // The S-IVB keeps most of its propellant for translunar injection.
  saturn5: {
    stages: [
      {
        name: 'S-IC first stage',
        burn: 161,
        thrust: 34000,
        prop: 2077,
        drop: 135,
        call: 'First stage cutoff and separation. Second stage ignition.',
      },
      {
        name: 'S-II second stage',
        burn: 390,
        thrust: 5100,
        prop: 440,
        drop: 41,
        call: 'Second stage cutoff and separation. S-IVB ignition.',
      },
      { name: 'S-IVB', burn: 150, thrust: 1000, prop: 33, drop: 0 },
    ],
    dry: 141,
    shortburn: 1,
    tower: 197,
  },
  // The Space Shuttle: the solid boosters to about 124 s, the main engines on the tank to cutoff at about 510 s, throttled
  // back so she never pulls more than 3 g.
  shuttle: {
    stages: [
      {
        name: 'Solid boosters and main engines',
        burn: 124,
        thrust: 30000,
        prop: 1190,
        drop: 174,
        call: 'Booster separation. The main engines are carrying her.',
      },
      { name: 'Main engines', burn: 386, thrust: 5250, prop: 543, drop: 0 },
    ],
    dry: 136,
    maxG: 3,
    shortburn: 1,
  },
  // SLS Block 1 (Artemis): the boosters to about 126 s, the core stage on to cutoff at about 480 s.
  sls: {
    stages: [
      {
        name: 'Solid boosters and core stage',
        burn: 126,
        thrust: 39000,
        prop: 1515,
        drop: 200,
        call: 'Booster separation. The core stage is carrying her.',
      },
      { name: 'Core stage', burn: 354, thrust: 7440, prop: 728, drop: 0 },
    ],
    dry: 145,
    maxG: 3.2,
    shortburn: 1,
    tower: 200,
  },
  // Falcon 9 with Crew Dragon (Demo-2, 2020): first stage to about 162 s, second stage to orbit at about 527 s. Dragon's
  // abort engines are built in: there is no tower to drop.
  dragon: {
    stages: [
      {
        name: 'First stage',
        burn: 162,
        thrust: 7600,
        prop: 395,
        drop: 25.6,
        call: 'Main engine cutoff and stage separation. Second stage ignition.',
      },
      { name: 'Second stage', burn: 365, thrust: 981, prop: 92, drop: 0 },
    ],
    dry: 16.5,
    maxG: 4,
    shortburn: 1,
  },
};
