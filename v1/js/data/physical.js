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
// chain is listed in `absentFrom`.
export const MECHANISMS = {
  'pm-07': {
    stage: 'aerobee-sustainer',
    absentFrom: ['aerobee-sustainer/r2'],
    when: { burn: 'long' },
    effects: { 'aerobee-sustainer.wall-temp': 180 },
    flightFailureChance: 0.25,
  },
};
