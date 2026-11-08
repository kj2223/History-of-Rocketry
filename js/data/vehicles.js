// Public engineering content: vehicles, stages, revisions and the quantities teams can measure.
// Nothing here describes hidden physical truth; that lives in physical.js.
// Quantity keys are '<stage>.<name>', 'vehicle.<name>' (integrated) or '<stageA>|<stageB>.<name>' (interface).

export const STAGES = {
  'aerobee-booster': { name: 'Aerobee solid booster', developable: false },
  'aerobee-sustainer': { name: 'Aerobee liquid sustainer', developable: true },
  'tiny-tim': { name: 'Tiny Tim solid booster', developable: false },
  // Captured hardware: not redesigned, but it can be refurbished to a corrected standard.
  v2: { name: 'V-2 first stage', developable: true },
  'wac-upper': { name: 'WAC Corporal upper stage', developable: true },
  // Contractor-built airframe around a motor our own team develops; gimballed for steering.
  viking: { name: 'Viking motor and airframe', developable: true },
  // Vanguard's first stage, built by General Electric on the Viking's lines: the stage that goes on the stand.
  'vanguard-1': { name: 'Vanguard first stage', developable: true },
  // Juno II's first stage: the Army's Jupiter missile. Ranger's upper stage: Lockheed's Agena, restarted in orbit.
  jupiter: { name: 'Jupiter first stage', developable: true },
  agena: { name: 'Agena upper stage', developable: true },
};

export const VEHICLES = {
  wac: { name: 'WAC Corporal', stages: ['tiny-tim', 'wac-upper'], crewed: false },
  aerobee: { name: 'Aerobee', stages: ['aerobee-booster', 'aerobee-sustainer'], crewed: false },
  v2: { name: 'V-2', stages: ['v2'], crewed: false },
  bumper: { name: 'Bumper', stages: ['v2', 'wac-upper'], crewed: false },
  viking: { name: 'Viking', stages: ['viking'], crewed: false },
  vanguard: { name: 'Vanguard', stages: ['vanguard-1'], crewed: false },
  juno: { name: 'Juno II', stages: ['jupiter'], crewed: false },
  ranger: { name: 'Atlas-Agena B', stages: ['agena'], crewed: false },
};

// Normal limits teams judge readings against: [low, high].
export const QUANTITIES = {
  'aerobee-sustainer.wall-temp': { name: 'Sustainer chamber wall temperature', unit: 'K', normal: [0, 700] },
  'aerobee-sustainer.chamber-pressure': { name: 'Sustainer chamber pressure', unit: 'bar', normal: [17, 23] },
  'wac-upper.chamber-pressure': { name: 'Upper stage chamber pressure', unit: 'bar', normal: [17, 23] },
  'v2.chamber-pressure': { name: 'V-2 chamber pressure', unit: 'bar', normal: [13, 18] },
  'viking.chamber-pressure': { name: 'Viking motor chamber pressure', unit: 'bar', normal: [18, 24] },
  'vanguard-1.chamber-pressure': { name: 'Vanguard first-stage chamber pressure', unit: 'bar', normal: [18, 24] },
  'jupiter.chamber-pressure': { name: 'Jupiter chamber pressure', unit: 'bar', normal: [18, 24] },
  'agena.chamber-pressure': { name: 'Agena chamber pressure', unit: 'bar', normal: [17, 23] },
  'v2|wac-upper.separation': { name: 'Stage separation timing error', unit: 's', normal: [0, 0.5] },
  'vehicle.apogee': { name: 'Apogee', unit: 'km', normal: [60, Infinity] },
  'vehicle.deviation': { name: 'Trajectory deviation', unit: 'deg', normal: [0, 5] },
};

// Quantities each vehicle has, in a fixed order (the physical draw order).
export const VEHICLE_QUANTITIES = {
  wac: ['wac-upper.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
  aerobee: ['aerobee-sustainer.wall-temp', 'aerobee-sustainer.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
  v2: ['v2.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
  bumper: [
    'v2.chamber-pressure',
    'wac-upper.chamber-pressure',
    'v2|wac-upper.separation',
    'vehicle.apogee',
    'vehicle.deviation',
  ],
  viking: ['viking.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
  vanguard: ['vanguard-1.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
  juno: ['jupiter.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
  ranger: ['agena.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
};

// Flight channels: tracking always sees the integrated trajectory; telemetry depends on the revisions flown.
export const TRACKING_CHANNELS = ['vehicle.apogee', 'vehicle.deviation'];

// Revisions. `affects` lists the claims a revision changes (§4.2): evidence for every other claim carries over.
// `remedies` names the engineering hypothesis a corrective change addresses (§5.4).
export const REVISIONS = {
  'aerobee-booster/r1': {
    stage: 'aerobee-booster',
    parent: null,
    label: 'Production booster',
    affects: [],
    telemetry: [],
  },
  'aerobee-sustainer/r1': {
    stage: 'aerobee-sustainer',
    parent: null,
    label: 'Production sustainer',
    affects: [],
    telemetry: ['aerobee-sustainer.chamber-pressure'],
  },
  'aerobee-sustainer/r2': {
    stage: 'aerobee-sustainer',
    parent: 'aerobee-sustainer/r1',
    label: 'Rebonded chamber liner with wall-temperature pickup',
    affects: ['aerobee-sustainer.wall-temp', 'vehicle.apogee'],
    remedies: ['liner-debond'],
    telemetry: ['aerobee-sustainer.chamber-pressure', 'aerobee-sustainer.wall-temp'],
  },
  'tiny-tim/r1': { stage: 'tiny-tim', parent: null, label: 'Tiny Tim booster', affects: [], telemetry: [] },
  'v2/r1': { stage: 'v2', parent: null, label: 'Captured V-2', affects: [], telemetry: ['v2.chamber-pressure'] },
  'wac-upper/r1': {
    stage: 'wac-upper',
    parent: null,
    label: 'WAC Corporal upper stage',
    affects: [],
    telemetry: ['wac-upper.chamber-pressure'],
  },
  'wac-upper/r2': {
    stage: 'wac-upper',
    parent: 'wac-upper/r1',
    label: 'Revised upper-stage ignition timer',
    affects: ['v2|wac-upper.separation', 'vehicle.apogee'],
    telemetry: ['wac-upper.chamber-pressure'],
  },
  // Corrective revisions for in-flight losses. They change the flight-outcome claims, so a loss on the
  // old revision is not held against the corrected one.
  'wac-upper/r3': {
    stage: 'wac-upper',
    parent: 'wac-upper/r1',
    label: 'Reworked upper-stage igniter',
    affects: ['wac-upper.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
    remedies: ['igniter-hangfire'],
    telemetry: ['wac-upper.chamber-pressure'],
  },
  'v2/r2': {
    stage: 'v2',
    parent: 'v2/r1',
    label: 'Refurbished V-2 turbopump and steam generator',
    affects: ['v2.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
    remedies: ['turbopump-wear'],
    telemetry: ['v2.chamber-pressure'],
  },
  'viking/r1': {
    stage: 'viking',
    parent: null,
    label: 'First Viking airframes and motor',
    affects: [],
    telemetry: ['viking.chamber-pressure'],
  },
  'viking/r2': {
    stage: 'viking',
    parent: 'viking/r1',
    label: 'Redesigned Viking steam generator and turbine feed',
    affects: ['viking.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
    remedies: ['viking-steam-generator'],
    telemetry: ['viking.chamber-pressure'],
  },
  'vanguard-1/r1': {
    stage: 'vanguard-1',
    parent: null,
    label: 'First Vanguard first stages',
    affects: [],
    telemetry: ['vanguard-1.chamber-pressure'],
  },
  'vanguard-1/r2': {
    stage: 'vanguard-1',
    parent: 'vanguard-1/r1',
    label: 'Reworked first-stage injector',
    affects: ['vanguard-1.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
    remedies: ['vanguard-injector'],
    telemetry: ['vanguard-1.chamber-pressure'],
  },
  'jupiter/r1': {
    stage: 'jupiter',
    parent: null,
    label: 'Jupiter first stage as delivered',
    affects: [],
    telemetry: ['jupiter.chamber-pressure'],
  },
  'jupiter/r2': {
    stage: 'jupiter',
    parent: 'jupiter/r1',
    label: 'Recalibrated propellant utilisation',
    affects: ['jupiter.chamber-pressure', 'vehicle.apogee'],
    remedies: ['jupiter-depletion'],
    telemetry: ['jupiter.chamber-pressure'],
  },
  'agena/r1': {
    stage: 'agena',
    parent: null,
    label: 'Agena B as delivered',
    affects: [],
    telemetry: ['agena.chamber-pressure'],
  },
  'agena/r2': {
    stage: 'agena',
    parent: 'agena/r1',
    label: 'Reworked Agena restart system',
    affects: ['agena.chamber-pressure', 'vehicle.apogee'],
    remedies: ['agena-restart'],
    telemetry: ['agena.chamber-pressure'],
  },
};

export const BASELINE = {
  wac: { 'tiny-tim': 'tiny-tim/r1', 'wac-upper': 'wac-upper/r1' },
  aerobee: { 'aerobee-booster': 'aerobee-booster/r1', 'aerobee-sustainer': 'aerobee-sustainer/r1' },
  v2: { v2: 'v2/r1' },
  bumper: { v2: 'v2/r1', 'wac-upper': 'wac-upper/r1' },
  viking: { viking: 'viking/r1' },
  vanguard: { 'vanguard-1': 'vanguard-1/r1' },
  juno: { jupiter: 'jupiter/r1' },
  ranger: { agena: 'agena/r1' },
};

// A revision and its ancestors, newest first.
export const lineage = revId => {
  const out = [];
  for (let r = revId; r; r = REVISIONS[r].parent) out.push(r);
  return out;
};
