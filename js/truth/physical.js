// HIDDEN PHYSICAL TRUTH (freeze §4.1). Only js/rules/physics.js may import this file.
// Mechanism IDs here are deliberately opaque and unrelated to engineering hypothesis IDs.

// True nominal value of each quantity for the baseline vehicle.
export const BASE = {
  wac: { 'wac-upper.chamber-pressure': 20, 'vehicle.apogee': 70, 'vehicle.deviation': 2.5 },
  aerobee: { 'aerobee-sustainer.wall-temp': 610, 'aerobee-sustainer.chamber-pressure': 20.5, 'vehicle.apogee': 110, 'vehicle.deviation': 1.5 },
  viking: { 'viking.chamber-pressure': 21, 'vehicle.apogee': 170, 'vehicle.deviation': 1 },
  // Vanguard's apogee here is the perigee of the orbit a good round reaches (Vanguard 1: about 650 km).
  vanguard: { 'vanguard-1.chamber-pressure': 21, 'vehicle.apogee': 650, 'vehicle.deviation': 1 },
  // The lunar shots' figure is the height a good round reaches before it leaves the range plot, in km.
  juno: { 'jupiter.chamber-pressure': 21, 'vehicle.apogee': 120000, 'vehicle.deviation': 1 },
  ranger: { 'agena.chamber-pressure': 20, 'vehicle.apogee': 120000, 'vehicle.deviation': 1 },
  // A V-2 from White Sands' rebuilt stock on a good day: nominal flights in 1946 reached about 170 km.
  v2: { 'v2.chamber-pressure': 15.5, 'vehicle.apogee': 165, 'vehicle.deviation': 2.5 },
  bumper: { 'v2.chamber-pressure': 15.5, 'wac-upper.chamber-pressure': 20, 'v2|wac-upper.separation': 0.2, 'vehicle.apogee': 390, 'vehicle.deviation': 2 },
};

// What each revision really does to true values (the coupled performance cost included).
export const REVISION_EFFECTS = {
  'aerobee-sustainer/r2': { 'aerobee-sustainer.wall-temp': -20, 'vehicle.apogee': -6 },
  'wac-upper/r2': { 'v2|wac-upper.separation': -0.1, 'vehicle.apogee': 4 },
};

// Relative noise of the true value from article to article and run to run.
export const SCATTER = 0.015;

// Mechanisms present in hardware. A mechanism acts on revisions of its stage unless a revision in the
// chain is listed in `absentFrom`. `effects` show whenever it is active; `onFailure` shows only on the
// flights it actually brings down.
export const MECHANISMS = {
  'pm-07': {
    stage: 'aerobee-sustainer',
    absentFrom: ['aerobee-sustainer/r2'],
    when: { burn: 'long' },
    effects: { 'aerobee-sustainer.wall-temp': 180 },
    flightFailureChance: 0.25,
  },
  // Captured V-2s were old, reassembled hardware; roughly a third failed at White Sands.
  // A short stand firing shows it as low chamber pressure at start-up.
  'pm-03': { stage: 'v2', absentFrom: ['v2/r2'], when: { burn: 'short' }, effects: { 'v2.chamber-pressure': -3.5 }, flightFailureChance: 0.3 },
  // Early WAC Corporal firings lost a fair share of rounds to ignition and feed trouble.
  // A short stand firing shows it as a rough, low-pressure start.
  'pm-11': { stage: 'wac-upper', absentFrom: ['wac-upper/r3'], when: { burn: 'short' }, effects: { 'wac-upper.chamber-pressure': -5 }, flightFailureChance: 0.2 },
  // Early Vikings lost flights to premature motor cutoff. Only a full-duration stand firing shows it,
  // as chamber pressure sagging late in the burn.
  'pm-19': { stage: 'viking', absentFrom: ['viking/r2'], when: { burn: 'long' }, effects: { 'viking.chamber-pressure': -5 }, flightFailureChance: 0.25 },
  // Vanguard's first-stage injector could burn through at ignition (TV-3, December 1957). A short stand firing shows it
  // as a rough, low start.
  // A Jupiter whose propellant utilisation is off runs out early (Pioneer 3, December 1958). Only a full-duration firing
  // shows it, as chamber pressure falling away before the end.
  'pm-29': { stage: 'jupiter', absentFrom: ['jupiter/r2'], when: { burn: 'long' }, effects: { 'jupiter.chamber-pressure': -5 }, flightFailureChance: 0.4 },
  // An Agena whose restart system is marginal will not light a second time in orbit (Rangers 1 and 2, 1961). A short
  // firing shows it as a rough start.
  'pm-31': { stage: 'agena', absentFrom: ['agena/r2'], when: { burn: 'short' }, effects: { 'agena.chamber-pressure': -4.5 }, flightFailureChance: 0.4 },
  'pm-23': { stage: 'vanguard-1', absentFrom: ['vanguard-1/r2'], when: { burn: 'short' }, effects: { 'vanguard-1.chamber-pressure': -4.5 }, flightFailureChance: 0.4 },
};

// Mechanisms every new campaign starts with, besides the worked-case defect.
export const LATENT = ['pm-03', 'pm-11', 'pm-19'];
