// Public engineering content: vehicles, stages, revisions and the quantities teams can measure.
// Nothing here describes hidden physical truth; that lives in physical.js.
// Quantity keys are '<stage>.<name>', 'vehicle.<name>' (integrated) or '<stageA>|<stageB>.<name>' (interface).
// V2 keeps the V1 content, so records imported from a V1 save still resolve, and adds Mercury and Gemini.
// Vehicle data for Mercury and Gemini is Provisional (V2 freeze §5): figures are period-plausible, tuned in play.

export const STAGES = {
  'aerobee-booster': { name: 'Aerobee solid booster', developable: false },
  'aerobee-sustainer': { name: 'Aerobee liquid sustainer', developable: true },
  'tiny-tim': { name: 'Tiny Tim solid booster', developable: false },
  // Captured hardware: not redesigned, but it can be refurbished to a corrected standard.
  'v2': { name: 'V-2 first stage', developable: true },
  'wac-upper': { name: 'WAC Corporal upper stage', developable: true },
  // Contractor-built airframe around a motor our own team develops; gimballed for steering.
  viking: { name: 'Viking motor and airframe', developable: true },
  // V2 boosters. Atlas and Titan II arrive as military missiles; the agency changes them for crewed use.
  redstone: { name: 'Mercury-Redstone booster', developable: true },
  atlas: { name: 'Atlas booster', developable: true },
  'titan-ii': { name: 'Titan II booster', developable: true },
  // Spacecraft are tested in the environmental chamber, not on a firing stand. A "short" or "long" run there
  // is a short or a mission-length soak at flight cabin conditions.
  'mercury-capsule': { name: 'Mercury spacecraft', developable: true, testedOn: 'environmental-chamber' },
  gemini: { name: 'Gemini spacecraft', developable: true, testedOn: 'environmental-chamber' },
};

// Where a stage is ground-tested. Firing stands unless the stage says otherwise.
export const testFacility = stage => STAGES[stage].testedOn ?? 'static-stand';

export const VEHICLES = {
  wac: { name: 'WAC Corporal', stages: ['tiny-tim', 'wac-upper'], crewed: false },
  aerobee: { name: 'Aerobee', stages: ['aerobee-booster', 'aerobee-sustainer'], crewed: false },
  bumper: { name: 'Bumper', stages: ['v2', 'wac-upper'], crewed: false },
  viking: { name: 'Viking', stages: ['viking'], crewed: false },
  // `profile` says what kind of flight the vehicle flies. Military configurations exist so their flight
  // records can be held as evidence (V2 freeze §5); the agency never builds or flies them.
  'mercury-redstone': { name: 'Mercury-Redstone', stages: ['redstone', 'mercury-capsule'], crewed: true, profile: 'suborbital' },
  'mercury-atlas': { name: 'Mercury-Atlas', stages: ['atlas', 'mercury-capsule'], crewed: true, profile: 'orbital' },
  'gemini-titan': { name: 'Gemini-Titan II', stages: ['titan-ii', 'gemini'], crewed: true, profile: 'orbital' },
  'atlas-icbm': { name: 'Atlas missile', stages: ['atlas'], crewed: false, profile: 'ballistic', military: true },
  'titan-icbm': { name: 'Titan II missile', stages: ['titan-ii'], crewed: false, profile: 'ballistic', military: true },
};

// Normal limits teams judge readings against: [low, high].
export const QUANTITIES = {
  'aerobee-sustainer.wall-temp': { name: 'Sustainer chamber wall temperature', unit: 'K', normal: [0, 700] },
  'aerobee-sustainer.chamber-pressure': { name: 'Sustainer chamber pressure', unit: 'bar', normal: [17, 23] },
  'wac-upper.chamber-pressure': { name: 'Upper stage chamber pressure', unit: 'bar', normal: [17, 23] },
  'v2.chamber-pressure': { name: 'V-2 chamber pressure', unit: 'bar', normal: [13, 18] },
  'viking.chamber-pressure': { name: 'Viking motor chamber pressure', unit: 'bar', normal: [18, 24] },
  'redstone.chamber-pressure': { name: 'Redstone chamber pressure', unit: 'bar', normal: [19, 25] },
  'atlas.chamber-pressure': { name: 'Atlas engine chamber pressure', unit: 'bar', normal: [37, 45] },
  'titan-ii.chamber-pressure': { name: 'Titan II first-stage chamber pressure', unit: 'bar', normal: [49, 59] },
  'mercury-capsule.cabin-pressure': { name: 'Mercury cabin pressure', unit: 'bar', normal: [0.33, 0.43] },
  'gemini.cabin-pressure': { name: 'Gemini cabin pressure', unit: 'bar', normal: [0.32, 0.42] },
  // Escape coverage on crewed vehicles: how long the abort sensing system takes to call an abort.
  'vehicle.abort-sensing': { name: 'Abort sensing response time', unit: 's', normal: [0, 0.5] },
  // Entry and recovery (V2 freeze §6.2). Claims about the spacecraft, scoped to the loads their evidence covers.
  // Only a flight produces them: no ground facility reproduces an entry.
  'mercury-capsule.heat-load': { name: 'Mercury heat shield heat load', unit: 'MJ/m²', normal: [0, 100], flightOnly: true },
  'mercury-capsule.entry-g': { name: 'Mercury peak entry deceleration', unit: 'g', normal: [0, 12], flightOnly: true },
  'mercury-capsule.water-ingress': { name: 'Water in the Mercury capsule at pickup', unit: 'L', normal: [0, 40], flightOnly: true },
  'gemini.heat-load': { name: 'Gemini heat shield heat load', unit: 'MJ/m²', normal: [0, 140], flightOnly: true },
  'gemini.entry-g': { name: 'Gemini peak entry deceleration', unit: 'g', normal: [0, 9], flightOnly: true },
  'gemini.water-ingress': { name: 'Water in the Gemini spacecraft at pickup', unit: 'L', normal: [0, 40], flightOnly: true },
  // Records of the flight, not claims: where recovery sighted the spacecraft, and how long tracking lost it.
  'vehicle.landing-miss': { name: 'Landing point from the predicted point', unit: 'km', normal: [-100, 100] },
  'vehicle.blackout': { name: 'Communications blackout', unit: 's', normal: [0, 400] },
  'v2|wac-upper.separation': { name: 'Stage separation timing error', unit: 's', normal: [0, 0.5] },
  'vehicle.apogee': { name: 'Apogee', unit: 'km', normal: [60, Infinity] },
  'vehicle.deviation': { name: 'Trajectory deviation', unit: 'deg', normal: [0, 5] },
};

// Quantities each vehicle has, in a fixed order (the physical draw order). A crewed vehicle's entry claims
// come last: the entry model produces them, after the ascent.
export const VEHICLE_QUANTITIES = {
  wac: ['wac-upper.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
  aerobee: ['aerobee-sustainer.wall-temp', 'aerobee-sustainer.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
  bumper: ['v2.chamber-pressure', 'wac-upper.chamber-pressure', 'v2|wac-upper.separation', 'vehicle.apogee', 'vehicle.deviation'],
  viking: ['viking.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
  'mercury-redstone': ['redstone.chamber-pressure', 'mercury-capsule.cabin-pressure', 'vehicle.apogee', 'vehicle.deviation', 'vehicle.abort-sensing',
    'mercury-capsule.heat-load', 'mercury-capsule.entry-g', 'mercury-capsule.water-ingress'],
  'mercury-atlas': ['atlas.chamber-pressure', 'mercury-capsule.cabin-pressure', 'vehicle.apogee', 'vehicle.deviation', 'vehicle.abort-sensing',
    'mercury-capsule.heat-load', 'mercury-capsule.entry-g', 'mercury-capsule.water-ingress'],
  'gemini-titan': ['titan-ii.chamber-pressure', 'gemini.cabin-pressure', 'vehicle.apogee', 'vehicle.deviation', 'vehicle.abort-sensing',
    'gemini.heat-load', 'gemini.entry-g', 'gemini.water-ingress'],
  'atlas-icbm': ['atlas.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
  'titan-icbm': ['titan-ii.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
};

// Flight channels: tracking always sees the integrated trajectory; telemetry depends on the revisions flown.
export const TRACKING_CHANNELS = ['vehicle.apogee', 'vehicle.deviation'];

// Revisions. `affects` lists the claims a revision changes (§4.2): evidence for every other claim carries over.
// `remedies` names the engineering hypothesis a corrective change addresses (§5.4).
export const REVISIONS = {
  'aerobee-booster/r1': { stage: 'aerobee-booster', parent: null, label: 'Production booster', affects: [], telemetry: [] },
  'aerobee-sustainer/r1': { stage: 'aerobee-sustainer', parent: null, label: 'Production sustainer', affects: [], telemetry: ['aerobee-sustainer.chamber-pressure'] },
  'aerobee-sustainer/r2': {
    stage: 'aerobee-sustainer', parent: 'aerobee-sustainer/r1',
    label: 'Rebonded chamber liner with wall-temperature pickup',
    affects: ['aerobee-sustainer.wall-temp', 'vehicle.apogee'],
    remedies: ['liner-debond'],
    telemetry: ['aerobee-sustainer.chamber-pressure', 'aerobee-sustainer.wall-temp'],
  },
  'tiny-tim/r1': { stage: 'tiny-tim', parent: null, label: 'Tiny Tim booster', affects: [], telemetry: [] },
  'v2/r1': { stage: 'v2', parent: null, label: 'Captured V-2', affects: [], telemetry: ['v2.chamber-pressure'] },
  'wac-upper/r1': { stage: 'wac-upper', parent: null, label: 'WAC Corporal upper stage', affects: [], telemetry: ['wac-upper.chamber-pressure'] },
  'wac-upper/r2': {
    stage: 'wac-upper', parent: 'wac-upper/r1', label: 'Revised upper-stage ignition timer',
    affects: ['v2|wac-upper.separation', 'vehicle.apogee'],
    telemetry: ['wac-upper.chamber-pressure'],
  },
  // Corrective revisions for in-flight losses. They change the flight-outcome claims, so a loss on the
  // old revision is not held against the corrected one.
  'wac-upper/r3': {
    stage: 'wac-upper', parent: 'wac-upper/r1', label: 'Reworked upper-stage igniter',
    affects: ['wac-upper.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
    remedies: ['igniter-hangfire'], telemetry: ['wac-upper.chamber-pressure'],
  },
  'v2/r2': {
    stage: 'v2', parent: 'v2/r1', label: 'Refurbished V-2 turbopump and steam generator',
    affects: ['v2.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
    remedies: ['turbopump-wear'], telemetry: ['v2.chamber-pressure'],
  },
  'viking/r1': { stage: 'viking', parent: null, label: 'First Viking airframes and motor', affects: [], telemetry: ['viking.chamber-pressure'] },
  'viking/r2': {
    stage: 'viking', parent: 'viking/r1', label: 'Redesigned Viking steam generator and turbine feed',
    affects: ['viking.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
    remedies: ['viking-steam-generator'], telemetry: ['viking.chamber-pressure'],
  },

  // ---- V2: Mercury and Gemini ----
  'redstone/r1': { stage: 'redstone', parent: null, label: 'Mercury-Redstone booster', affects: [], telemetry: ['redstone.chamber-pressure'] },
  'redstone/r2': {
    stage: 'redstone', parent: 'redstone/r1', label: 'Revised tail-plug disconnect and cutoff circuit',
    affects: ['redstone.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
    remedies: ['redstone-cutoff-sequence'], telemetry: ['redstone.chamber-pressure'],
  },
  // Military Atlas D. Its flight records are evidence for the crewed booster only where the crewed changes
  // leave a claim unaffected: the engines carry over, the flight-outcome claims do not.
  'atlas/d': { stage: 'atlas', parent: null, label: 'Atlas D (military)', affects: [], telemetry: ['atlas.chamber-pressure'] },
  'atlas/lv3b': {
    stage: 'atlas', parent: 'atlas/d', label: 'Atlas LV-3B for Mercury: thicker forward skin and abort sensing',
    affects: ['vehicle.apogee', 'vehicle.deviation'], telemetry: ['atlas.chamber-pressure'],
  },
  'atlas/lv3b-r2': {
    stage: 'atlas', parent: 'atlas/lv3b', label: 'Baffled Atlas injectors with a rough-combustion cutoff',
    affects: ['atlas.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
    remedies: ['atlas-combustion-instability'], telemetry: ['atlas.chamber-pressure'],
  },
  'titan-ii/military': { stage: 'titan-ii', parent: null, label: 'Titan II (military)', affects: [], telemetry: ['titan-ii.chamber-pressure'] },
  'titan-ii/glv': {
    stage: 'titan-ii', parent: 'titan-ii/military', label: 'Gemini Launch Vehicle: redundant guidance and malfunction detection',
    affects: ['vehicle.apogee', 'vehicle.deviation'], telemetry: ['titan-ii.chamber-pressure'],
  },
  'titan-ii/glv-r2': {
    stage: 'titan-ii', parent: 'titan-ii/glv', label: 'Titan II pogo suppression: standpipes and feed-line accumulators',
    affects: ['titan-ii.chamber-pressure', 'vehicle.apogee', 'vehicle.deviation'],
    remedies: ['titan-pogo'], telemetry: ['titan-ii.chamber-pressure'],
  },
  'mercury-capsule/r1': { stage: 'mercury-capsule', parent: null, label: 'Mercury spacecraft', affects: [], telemetry: ['mercury-capsule.cabin-pressure', 'vehicle.abort-sensing'] },
  'mercury-capsule/r2': {
    stage: 'mercury-capsule', parent: 'mercury-capsule/r1', label: 'Reworked Mercury hatch seal and cabin relief valve',
    affects: ['mercury-capsule.cabin-pressure', 'vehicle.apogee', 'vehicle.deviation'],
    remedies: ['capsule-hatch-seal'], telemetry: ['mercury-capsule.cabin-pressure', 'vehicle.abort-sensing'],
  },
  'gemini/r1': { stage: 'gemini', parent: null, label: 'Gemini spacecraft', affects: [], telemetry: ['gemini.cabin-pressure', 'vehicle.abort-sensing'] },
};

export const BASELINE = {
  wac: { 'tiny-tim': 'tiny-tim/r1', 'wac-upper': 'wac-upper/r1' },
  aerobee: { 'aerobee-booster': 'aerobee-booster/r1', 'aerobee-sustainer': 'aerobee-sustainer/r1' },
  bumper: { 'v2': 'v2/r1', 'wac-upper': 'wac-upper/r1' },
  viking: { viking: 'viking/r1' },
  'mercury-redstone': { redstone: 'redstone/r1', 'mercury-capsule': 'mercury-capsule/r1' },
  'mercury-atlas': { atlas: 'atlas/lv3b', 'mercury-capsule': 'mercury-capsule/r1' },
  'gemini-titan': { 'titan-ii': 'titan-ii/glv', gemini: 'gemini/r1' },
  'atlas-icbm': { atlas: 'atlas/d' },
  'titan-icbm': { 'titan-ii': 'titan-ii/military' },
};

// A revision and its ancestors, newest first.
export const lineage = revId => { const out = []; for (let r = revId; r; r = REVISIONS[r].parent) out.push(r); return out; };
