// THE PROGRAMME AS THE TEAM KNOWS IT: what has been flown, what has been fixed, and the drawing office's estimates.
// It carries from round to round, and from the WAC rounds into Bumper, whose upper stage is a WAC. The fixes are what the
// reviews decided, right or wrong: a fix for the wrong cause changes nothing that matters, and the real fault stays as
// likely as before.

import { DEFAULT_PROGRAMME } from '../truth/round.js';
// How likely each fault is on a new round before any fix (hidden from the player, but the team's fixes move them).
// The build standard is the one newRound falls back on (truth/round.js), so the two can never disagree.
export const initProgramme = () => ({ ...DEFAULT_PROGRAMME, flights: [], adopted: [] });

// What the review decided, turned into a standing change to how rounds are built. Returns the line Ellis gives, or null.
const FIXES = {
  ignition: {
    text: 'Every WAC upper stage now gets the reworked igniter as standard.',
    apply: p => {
      p.igniter = 'wac-upper/r3';
    },
  },
  weld: {
    text: 'Every tank seam is now X-rayed before the stage leaves the shop.',
    apply: p => {
      p.weldRisk *= 0.4;
    },
  },
  leak: {
    text: 'Every fitting is now pressure-tested and safety-wired before rollout.',
    apply: p => {
      p.leakRisk *= 0.4;
    },
  },
  turbopump: {
    text: 'Every V-2 now has its turbopump and steam generator refurbished before it leaves the hangar.',
    apply: p => {
      p.turbopump = 'v2/r2';
    },
  },
  vanes: {
    text: 'Every graphite jet vane now goes under a lens, and any with a crack is replaced.',
    apply: p => {
      p.vaneRisk *= 0.4;
    },
  },
  liner: {
    text: 'Every Aerobee sustainer now has its chamber liner rebonded, with a wall-temperature pickup to watch it.',
    apply: p => {
      p.sustainer = 'aerobee-sustainer/r2';
    },
  },
  cutoff: {
    text: 'Every Viking turbine casing is now welded up and its steam feed reworked before the engine is installed.',
    apply: p => {
      p.viking = 'viking/r2';
    },
  },
  injector: {
    text: 'Every Vanguard first stage now gets the reworked injector before it goes on the stand.',
    apply: p => {
      p.vanguard = 'vanguard-1/r2';
    },
  },
  depletion: {
    text: 'Every Jupiter now has its propellant utilisation recalibrated before it leaves the hangar.',
    apply: p => {
      p.juno = 'jupiter/r2';
    },
  },
  agena: {
    text: 'Every Agena now gets the reworked restart system before it goes on the stack.',
    apply: p => {
      p.ranger = 'agena/r2';
    },
  },
  // After 51-L, whatever the review said: the booster field joint redesigned with a third O-ring, a capture feature
  // and heaters (flown from STS-26, September 1988). The five-segment boosters on SLS carry it on.
  oring: {
    text: "Every solid booster's field joints are now the redesigned joint: a capture feature, a third O-ring and heaters.",
    apply: p => {
      p.oringRisk = (p.oringRisk ?? 0.15) * 0.15; // 0.15: the build standard before (truth/round.js)
    },
  },
  miss: {
    text: 'From now on the midcourse burn waits on the best tracking fix the stations can give.',
    apply: () => {},
  },
  camera: {
    text: 'Every Ranger camera supply is now run for hours in a vacuum chamber before the spacecraft is closed up.',
    apply: p => {
      p.cameraRisk *= 0.3;
    },
  },
  plug: {
    text: "Every Redstone's tail plug is now tied down with a lanyard, so the control and power plugs part in the right order.",
    apply: p => {
      p.plugRisk *= 0.1;
    },
  },
  control: {
    text: 'Every Redstone autopilot now gets a full gyro run on the bench before it goes into the control compartment.',
    apply: p => {
      p.controlRisk *= 0.4;
    },
  },
  lox: {
    text: 'Every Redstone oxygen valve is now cold-flowed and leak-checked on the pad the day before.',
    apply: p => {
      p.loxRisk *= 0.4;
    },
  },
  thrust: {
    text: "Every Redstone's thrust controller is now recalibrated, with an over-speed check before flight.",
    apply: p => {
      p.thrustRisk *= 0.2;
    },
  },
  guidance: {
    text: 'Every Atlas autopilot and programmer is now run through a full flight profile on the bench at Convair.',
    apply: p => {
      p.guidanceRisk *= 0.4;
    },
  },
  shortburn: {
    text: 'Every Atlas sustainer now gets a full-duration static firing and a propellant-feed inspection before it ships.',
    apply: p => {
      p.shortburnRisk *= 0.4;
    },
  },
  shield: {
    text: "Every Mercury heat shield and landing-bag latch is now proof-loaded in Hangar S, and Segment 51's sensor rewired.",
    apply: p => {
      p.shieldRisk *= 0.3;
    },
  },
  scanner: {
    text: 'The horizon scanners are now checked against a heated horizon target in Hangar S before every flight.',
    apply: p => {
      p.scannerRisk *= 0.3;
    },
  },
  titanctl: {
    text: 'Every Titan autopilot and actuator is now run through a full flight profile at Martin before it ships.',
    apply: p => {
      p.titanctlRisk *= 0.4;
    },
  },
  stage2: {
    text: 'Every Titan second-stage injector is now inspected under a lens and its feed flushed before it ships.',
    apply: p => {
      p.stage2Risk *= 0.4;
    },
  },
  fuelcell: {
    text: "The fuel cells' oxygen supply heaters are redesigned and run for days in a chamber before flight.",
    apply: p => {
      p.fuelcellRisk *= 0.3;
    },
  },
  hatch: {
    text: 'The hatch latches are reworked, and every hatch is cycled in the altitude chamber before flight.',
    apply: p => {
      p.hatchRisk *= 0.3;
    },
  },
  computer: {
    text: "The guidance computer's power supply is filtered against transients and soak-tested.",
    apply: p => {
      p.computerRisk *= 0.3;
    },
  },
  navdata: {
    text: 'Every number sent up to a spacecraft is now checked independently in the back room before it goes.',
    apply: p => {
      p.navRisk *= 0.2;
    },
  },
  shutdown: {
    text: "The Titan's tail plugs are now safety-wired and pull-tested, and every gas generator is borescoped before stacking.",
    apply: p => {
      p.shutdownRisk *= 0.3;
    },
  },
  thruster: {
    text: "Every thruster's wiring is now checked for shorts under vibration, and each thruster gets its own circuit breaker.",
    apply: p => {
      p.thrusterRisk *= 0.3;
    },
  },
  saturnctl: {
    text: 'Every instrument unit now runs a full flight on the bench at IBM before it ships.',
    apply: p => {
      p.saturnctlRisk *= 0.4;
    },
  },
  j2: {
    text: 'The J-2 igniter lines are now rigid tubing, not bellows: they cannot crack in vacuum.',
    apply: p => {
      p.j2Risk *= 0.2;
    },
  },
  pogo: {
    text: "Helium-filled accumulators now damp the first stage's propellant lines against pogo.",
    apply: p => {
      p.pogoRisk *= 0.15;
    },
  },
  relight: {
    text: 'The S-IVB restart system is redesigned and every bottle leak-checked twice.',
    apply: p => {
      p.relightRisk *= 0.3;
    },
  },
  sps: {
    text: 'Every service engine valve is now cycled a hundred times on the bench.',
    apply: p => {
      p.spsRisk *= 0.4;
    },
  },
  tank: {
    text: "The oxygen tanks' heater switches are rated for the ground supply, and no tank is boiled dry again.",
    apply: p => {
      p.tankRisk *= 0.2;
    },
  },
  cabin: {
    text: 'The command module is rewired, its materials made fireproof, the hatch opens outward, and the cabin holds air, not pure oxygen, on the pad.',
    apply: p => {
      p.cabinRisk *= 0.1;
    },
  },
  alarm: {
    text: "The rendezvous radar switch goes to a setting that cannot load the lander's computer during descent.",
    apply: p => {
      p.alarmRisk *= 0.2;
    },
  },
  ascent: {
    text: 'Every ascent-engine injector now goes under the lens and through a hot firing.',
    apply: p => {
      p.ascentRisk *= 0.4;
    },
  },
  chute: {
    text: 'The reaction control fuel is no longer dumped under the main parachutes.',
    apply: p => {
      p.chuteRisk *= 0.3;
    },
  },
  lightning: {
    text: 'The launch rules now forbid launching through cloud that can carry a charge.',
    apply: p => {
      p.lightningRisk *= 0.2;
    },
  },
  fin: {
    text: 'Every Viking fin fitting is now magnafluxed for cracks before the fins go on.',
    apply: p => {
      p.finRisk *= 0.4;
    },
  },
  holddown: {
    text: "The stand's hold-down fittings are now proof-loaded before every full-duration firing.",
    apply: p => {
      p.holddownRisk *= 0.3;
    },
  },
  separation: {
    text: 'Every separation bolt and firing lead is now tested on the bench before it goes on the stack.',
    apply: p => {
      p.sepRisk *= 0.4;
    },
  },
};
export function adopt(programme, cause) {
  const fix = FIXES[cause];
  if (!fix || programme.adopted.includes(cause)) return null;
  fix.apply(programme);
  programme.adopted.push(cause);
  return fix.text;
}
// The standing fixes so far, in Ellis's words, for the news between rounds.
export const fixesInForce = programme => programme.adopted.map(c => FIXES[c]?.text).filter(Boolean);
// The standing fixes not yet told in a "while you were away", marked as told: each is news once, not at every jump.
export function newFixes(programme) {
  const fresh = programme.adopted.slice(programme.told ?? 0);
  programme.told = programme.adopted.length;
  return fresh.map(c => FIXES[c]?.text).filter(Boolean);
}

// A flight the radar tracked to its peak. Only good flights tell the drawing office about the vehicle's performance.
export function recordFlight(programme, { vehicle = 'wac', load, apogee, failure }) {
  programme.flights.push({ vehicle, load, apogee: failure ? null : apogee, failure: failure || null });
}
// The highest peak the radar has seen on this range so far, in km (0 before anything has flown well).
export const rangeRecord = programme => Math.max(0, ...programme.flights.map(f => f.apogee ?? 0));

// The drawing office's apogee estimate for a propellant load (share of full, 0.85–1). Before anything has flown it is
// the paper figure with a wide spread. Each good flight of the same kind pulls the middle toward what the radar saw and
// narrows it.
const loadFactor = load => (0.55 + 0.45 * load) ** 2;
// km for a full load: the office's pre-flight figures, a little pessimistic. A Bumper has never flown, so its spread is widest.
export const PAPER = {
  wac: { apogee: 62, spread: 0.18 },
  v2: { apogee: 140, spread: 0.22 },
  bumper: { apogee: 300, spread: 0.3 },
  aerobee: { apogee: 95, spread: 0.2 },
  viking: { apogee: 150, spread: 0.22 },
  vanguard: { apogee: 560, spread: 0.3 },
  juno: { apogee: 110000, spread: 0.1 },
  ranger: { apogee: 110000, spread: 0.1 },
  redstone: { apogee: 187, spread: 0.1 },
  atlas: { apogee: 260, spread: 0.1 },
  titan: { apogee: 300, spread: 0.1 },
  saturn5: { apogee: 300, spread: 0.1 },
  saturnib: { apogee: 300, spread: 0.1 },
  shuttle: { apogee: 300, spread: 0.08 },
  dragon: { apogee: 400, spread: 0.08 },
  sls: { apogee: 300, spread: 0.08 },
};
export const PAPER_APOGEE = PAPER.wac.apogee;
export function estimate(programme, vehicle = 'wac', load = 1) {
  if (typeof vehicle === 'number') {
    load = vehicle;
    vehicle = 'wac';
  } // estimate(programme, load) means a WAC
  const paper = PAPER[vehicle];
  const good = programme.flights.filter(f => (f.vehicle || 'wac') === vehicle && f.apogee != null);
  const seen = good.map(f => f.apogee / loadFactor(f.load));
  const full = (paper.apogee + seen.reduce((a, b) => a + b, 0)) / (1 + seen.length);
  const spread = paper.spread / (1 + 0.8 * seen.length);
  const mid = full * loadFactor(load);
  return { low: Math.round(mid * (1 - spread)), high: Math.round(mid * (1 + spread)), flights: seen.length };
}
