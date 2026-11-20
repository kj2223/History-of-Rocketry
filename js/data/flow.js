// THE LAUNCH FLOW: the real tests a round went through on its way to the pad, before the count. Each era had its own.
// A test is run on its day by the team, or by you sitting in, or it is cut to win back a slipped day. A test can find
// a fault the hidden layer put in the round (truth/round.js: the spot faults), which is fixed and costs repair days.
//
// The fault rates were set against the real flights, which all went through their flows. So the flow is priced in: the
// round is built with the risk the flow can catch added back on (flowRisk in world/flow.js), and a test the team runs
// takes it out again. A test you sit in on catches more than the team alone; a test you cut catches nothing.
//
// Each test:
//   id, name     what it was called
//   where        the building it happens in: you attend by going there (office: from the flow board itself)
//   lead         days before the round's first morning (the existing brief, or the day before a crewed launch)
//   finds        fault kind → the chance the team running it catches that fault, when the round has it
//   text         what happens, as the room tells it; true to the era
//   practice     what sitting in on it rehearses: 'count' (the launch count), 'range', 'pad' (the pad crew's work)
//   fix          repair days a fault it finds costs (default 1)

// White Sands, 1945–1955: a few days of checks in the hangar and the blockhouse before the stage goes to the stand.
const RANGE = {
  id: 'range',
  name: 'Range readiness check',
  where: 'office',
  lead: 3,
  finds: {},
  practice: 'range',
  text: "Morgan's people run the range end to end: the radar locks on a balloon, the Askania cinetheodolites are timed against the range clock, the Doppler and the telemetry receivers are tuned, and the range safety officer's destruct line is checked with a dummy load.",
};
const DRY_RUN = (finds = {}) => ({
  id: 'dryrun',
  name: 'Dry run of the count',
  where: 'blockhouse',
  lead: 2,
  finds,
  practice: 'count',
  text: 'The whole count, run in the blockhouse with no propellants aboard and dummy squibs on the firing leads. Every call, every switch, every hold, timed against the range clock.',
});

// The Cape, 1956–1964: the vehicle on the pad weeks ahead, loaded with propellants before the real count.
const TANKING = (finds, name = 'Propellant loading test') => ({
  id: 'tanking',
  name,
  where: 'blockhouse',
  lead: 5,
  finds,
  practice: 'pad',
  text: 'The vehicle is loaded with propellants on the pad as if for flight, held, and drained again. The pad crew walk the lines with soap solution and listen at every valve.',
});
const FRF = finds => ({
  id: 'frf',
  name: 'Flight readiness firing',
  where: 'blockhouse',
  lead: 6,
  finds,
  practice: 'count',
  fix: 2,
  text: 'The first stage is fired on the pad for a few seconds with the vehicle held down: the whole count to ignition and a short burn, the blockhouse reading the engine exactly as it will on launch day.',
});

// Crewed flights: the spacecraft and booster tested together on the pad, with the crew aboard for the last of them.
const SIM_FLIGHT = finds => ({
  id: 'simflight',
  name: 'Simulated flight test',
  where: 'blockhouse',
  lead: 8,
  finds,
  practice: 'count',
  text: 'The astronaut suited and strapped in on the gantry, the capsule powered as for flight. First plugs-in, on ground power; then plugs-out, the umbilicals pulled and the capsule on its own batteries, through a simulated launch, flight and splashdown.',
});
const CHECKOUT = finds => ({
  id: 'checkout',
  name: 'Spacecraft checkout',
  where: 'hangar',
  lead: 20,
  finds,
  practice: 'pad',
  text: "The spacecraft on its stand in the checkout building, every system powered and run against the test procedures, the contractor's engineers and NASA's inspectors reading the same meters.",
});
const NETWORK = {
  id: 'network',
  name: 'Network simulation',
  where: 'office',
  lead: 4,
  finds: {},
  practice: 'range',
  text: 'Mission Control and the tracking stations around the world run the flight together on the sim tapes, every station on the loop, the teletypes and the radar data running as if it were real.',
};

export const FLOWS = {
  wac: [RANGE, DRY_RUN()],
  v2: [RANGE, DRY_RUN({ vanes: 0.3 })],
  bumper: [RANGE, DRY_RUN({ separation: 0.35 })],
  aerobee: [RANGE, DRY_RUN()],
  viking: [RANGE, DRY_RUN({ holddown: 0.3 })],
  vanguard: [FRF({ leak: 0.35 }), DRY_RUN({ separation: 0.35 })],
  juno: [TANKING({ leak: 0.35 }), DRY_RUN({ separation: 0.35 })],
  redstone: [
    CHECKOUT({}),
    TANKING({ lox: 0.3 }, 'Booster tanking test'),
    SIM_FLIGHT({ plug: 0.35, control: 0.25 }),
    NETWORK,
  ],
  atlas: [
    CHECKOUT({ scanner: 0.3 }),
    TANKING({ shortburn: 0.2 }, 'Booster tanking test'),
    SIM_FLIGHT({ guidance: 0.3 }),
    NETWORK,
  ],
  titan: [
    {
      ...CHECKOUT({ fuelcell: 0.3, computer: 0.25 }),
      name: 'Joint combined systems test',
      text: 'Spacecraft and Titan II wired together on the pad and run as one vehicle for the first time, every system through its sequence, the blockhouse and the spacecraft checkout station reading it together.',
    },
    {
      id: 'wetmock',
      name: 'Wet mock simulated flight',
      where: 'blockhouse',
      lead: 7,
      finds: { shutdown: 0.35, titanctl: 0.25, stage2: 0.2 },
      practice: 'count',
      fix: 2,
      text: 'The Titan loaded with her hypergolic propellants and the full count run to the moment of ignition, the crew suited in the spacecraft for the final hour. Everything but the fire.',
    },
    { ...SIM_FLIGHT({ hatch: 0.3 }), lead: 3, name: 'Simulated flight, crew aboard' },
    NETWORK,
  ],
  saturnib: [
    {
      id: 'plugsout',
      name: 'Plugs-out test',
      where: 'blockhouse',
      lead: 21,
      finds: { cabin: 0.25, saturnctl: 0.25 },
      practice: 'pad',
      text: 'The crew sealed in the command module on the pad, the umbilicals pulled, the spacecraft and the instrument unit on their own power through a simulated countdown and flight. It was not classed hazardous: no propellants aboard.',
    },
    {
      id: 'cddt',
      name: 'Countdown demonstration test',
      where: 'blockhouse',
      lead: 6,
      finds: { h1: 0.3, sps: 0.2 },
      practice: 'count',
      fix: 2,
      text: 'The whole countdown, run twice: wet, with the Saturn fuelled and the count stopped short of ignition, then dry, with the crew in the spacecraft for the final hours.',
    },
    NETWORK,
  ],
  saturn5: [
    {
      id: 'frt',
      name: 'Flight readiness test',
      where: 'blockhouse',
      lead: 18,
      finds: { saturnctl: 0.3, alarm: 0.2, cabin: 0.15 },
      practice: 'pad',
      text: 'Every stage, the spacecraft and the lunar module powered up together at Pad 39A and run through a simulated flight from liftoff to orbit, the Launch Control Center and Houston on the loops.',
    },
    {
      id: 'cddt',
      name: 'Countdown demonstration test',
      where: 'blockhouse',
      lead: 6,
      finds: { tank: 0.3, j2: 0.25, sps: 0.2 },
      practice: 'count',
      fix: 2,
      text: 'The whole countdown, run twice in the Launch Control Center: wet, with the Saturn V fuelled and the count stopped seconds short of ignition, then dry, with the crew in the spacecraft for the final hours. After it the tanks are drained.',
    },
    NETWORK,
  ],
  shuttle: [
    {
      id: 'tcdt',
      name: 'Terminal countdown demonstration test',
      where: 'blockhouse',
      lead: 14,
      finds: { computer: 0.3, fuelcell: 0.25, cabin: 0.15 },
      practice: 'count',
      text: 'The crew fly in to the Cape, suit up and are strapped into the orbiter on the pad for the last hours of a simulated count, down to a main engine cutoff at T minus 6 seconds. Then the drill for leaving the pad in a hurry, down the slide-wire baskets to the bunker.',
    },
    NETWORK,
  ],
  dragon: [
    {
      id: 'staticfire',
      name: 'Static fire on the pad',
      where: 'blockhouse',
      lead: 7,
      finds: { merlin: 0.35 },
      practice: 'count',
      text: 'The Falcon 9 fuelled on the pad and her nine first-stage engines fired for a few seconds, held down. The launch team runs the automated count exactly as on launch day.',
    },
    {
      id: 'dryrun',
      name: 'Dry dress rehearsal',
      where: 'blockhouse',
      lead: 4,
      finds: { computer: 0.25, abort: 0.2 },
      practice: 'count',
      text: 'The crew suited and taken out to the pad, up the crew access arm and strapped into the capsule, the hatch closed, and the count run through as on launch day with no propellants loaded.',
    },
    NETWORK,
  ],
  sls: [
    {
      id: 'wdr',
      name: 'Wet dress rehearsal',
      where: 'blockhouse',
      lead: 12,
      finds: { ssme: 0.3, relight: 0.3 },
      practice: 'count',
      fix: 3,
      text: 'The core stage and the upper stage loaded with liquid hydrogen and oxygen through the umbilicals, held, and run down the terminal count to a planned cutoff at T minus 10 seconds. Then drained, and every leak, valve and sensor read over.',
    },
    NETWORK,
  ],
};

// The flow a round goes through, or none: probes are handed over from the launch team, and a round with no flow here
// keeps the old start.
export const flowFor = (vehicle, probe = false) => (probe ? null : FLOWS[vehicle] || null);
