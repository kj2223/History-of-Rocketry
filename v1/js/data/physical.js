// HIDDEN PHYSICAL TRUTH (freeze §4.1). Only js/rules/physics.js may import this file.
// Mechanism IDs here are deliberately opaque and unrelated to engineering hypothesis IDs.

// True nominal value of each quantity for the baseline vehicle.
export const BASE = {
  wac: { 'wac-upper.chamber-pressure': 20, 'vehicle.apogee': 70, 'vehicle.deviation': 2.5 },
  aerobee: { 'aerobee-sustainer.wall-temp': 610, 'aerobee-sustainer.chamber-pressure': 20.5, 'vehicle.apogee': 110, 'vehicle.deviation': 1.5 },
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
};

// Mechanisms every new campaign starts with, besides the worked-case defect.
export const LATENT = ['pm-03', 'pm-11'];
