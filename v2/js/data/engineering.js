// Engineering belief vocabulary: anomalies teams can open and the hypotheses they weigh.
// Hypothesis IDs are a separate vocabulary from physical mechanism IDs and never name them.

// A prediction says whether a reading of `quantity` under matching conditions should be normal.
export const HYPOTHESES = {
  'liner-debond': {
    name: 'Chamber liner debonding under sustained heat',
    predicts: [
      { quantity: 'aerobee-sustainer.wall-temp', when: { burn: 'long' }, normal: false },
      { quantity: 'aerobee-sustainer.wall-temp', when: { burn: 'short' }, normal: true },
      { quantity: 'aerobee-sustainer.chamber-pressure', when: {}, normal: true },
    ],
  },
  'injector-blockage': {
    name: 'Partial injector blockage',
    predicts: [
      { quantity: 'aerobee-sustainer.wall-temp', when: {}, normal: false },
      { quantity: 'aerobee-sustainer.chamber-pressure', when: {}, normal: false },
    ],
  },
  'igniter-hangfire': {
    name: 'Upper-stage igniter hang-fire',
    predicts: [
      { quantity: 'wac-upper.chamber-pressure', when: { burn: 'short' }, normal: false },
      { quantity: 'wac-upper.chamber-pressure', when: { burn: 'long' }, normal: true },
    ],
  },
  'feed-starvation': {
    name: 'Upper-stage propellant feed starvation',
    predicts: [{ quantity: 'wac-upper.chamber-pressure', when: {}, normal: false }],
  },
  'turbopump-wear': {
    name: 'Worn V-2 turbopump',
    predicts: [{ quantity: 'v2.chamber-pressure', when: { burn: 'short' }, normal: false }],
  },
  'viking-steam-generator': {
    name: 'Viking steam generator failing late in the burn',
    predicts: [
      { quantity: 'viking.chamber-pressure', when: { burn: 'long' }, normal: false },
      { quantity: 'viking.chamber-pressure', when: { burn: 'short' }, normal: true },
    ],
  },
  'viking-gimbal-fault': {
    name: 'Viking gimbal or control fault',
    predicts: [{ quantity: 'viking.chamber-pressure', when: {}, normal: true }],
  },
  // ---- V2 ----
  'redstone-cutoff-sequence': {
    name: 'Premature cutoff from the ground disconnect sequence',
    predicts: [
      { quantity: 'redstone.chamber-pressure', when: { burn: 'short' }, normal: false },
      { quantity: 'redstone.chamber-pressure', when: { burn: 'long' }, normal: true },
    ],
  },
  'redstone-thrust-regulator': {
    name: 'Redstone thrust regulator overshoot',
    predicts: [{ quantity: 'redstone.chamber-pressure', when: {}, normal: false }],
  },
  'atlas-combustion-instability': {
    name: 'Rough combustion at Atlas engine ignition',
    predicts: [
      { quantity: 'atlas.chamber-pressure', when: { burn: 'short' }, normal: false },
      { quantity: 'atlas.chamber-pressure', when: { burn: 'long' }, normal: true },
    ],
  },
  'atlas-turbopump-cavitation': {
    name: 'Atlas turbopump cavitation',
    predicts: [{ quantity: 'atlas.chamber-pressure', when: {}, normal: false }],
  },
  'titan-pogo': {
    name: 'Longitudinal oscillation (pogo) coupling with the propellant feed',
    predicts: [
      { quantity: 'titan-ii.chamber-pressure', when: { burn: 'long' }, normal: false },
      { quantity: 'titan-ii.chamber-pressure', when: { burn: 'short' }, normal: true },
    ],
  },
  'titan-combustion-instability': {
    name: 'Titan II combustion instability',
    predicts: [{ quantity: 'titan-ii.chamber-pressure', when: {}, normal: false }],
  },
  'capsule-hatch-seal': {
    name: 'Mercury hatch seal leaking over a long soak',
    predicts: [
      { quantity: 'mercury-capsule.cabin-pressure', when: { burn: 'long' }, normal: false },
      { quantity: 'mercury-capsule.cabin-pressure', when: { burn: 'short' }, normal: true },
    ],
  },
  'capsule-valve-leak': {
    name: 'Mercury cabin relief valve leaking',
    predicts: [{ quantity: 'mercury-capsule.cabin-pressure', when: {}, normal: false }],
  },
  'steering-vane-erosion': {
    name: 'Eroded V-2 steering vanes',
    predicts: [{ quantity: 'v2.chamber-pressure', when: {}, normal: true }],
  },
};

// An abnormal reading on a trigger quantity opens the anomaly with its candidate hypotheses.
export const ANOMALIES = {
  'sustainer-overtemp': { name: 'Sustainer runs hot', stage: 'aerobee-sustainer', trigger: 'aerobee-sustainer.wall-temp', hypotheses: ['liner-debond', 'injector-blockage'] },
  // A flight lost off course, or an abnormal stand reading, opens an investigation of the stage.
  'upper-stage-loss': { name: 'Upper-stage start or flight fault', stage: 'wac-upper', vehicles: ['wac', 'bumper'], trigger: ['vehicle.deviation', 'wac-upper.chamber-pressure'], hypotheses: ['igniter-hangfire', 'feed-starvation'] },
  'viking-loss': { name: 'Viking motor or control fault', stage: 'viking', vehicles: ['viking'], trigger: ['vehicle.deviation', 'viking.chamber-pressure'], hypotheses: ['viking-steam-generator', 'viking-gimbal-fault'] },
  'v2-loss': { name: 'V-2 start or flight fault', stage: 'v2', vehicles: ['bumper'], trigger: ['vehicle.deviation', 'v2.chamber-pressure'], hypotheses: ['turbopump-wear', 'steering-vane-erosion'] },
  // ---- V2 ----
  'redstone-loss': { name: 'Redstone start or cutoff fault', stage: 'redstone', vehicles: ['mercury-redstone'], trigger: ['vehicle.deviation', 'redstone.chamber-pressure'], hypotheses: ['redstone-cutoff-sequence', 'redstone-thrust-regulator'] },
  'atlas-loss': { name: 'Atlas engine fault', stage: 'atlas', vehicles: ['mercury-atlas', 'atlas-icbm'], trigger: ['vehicle.deviation', 'atlas.chamber-pressure'], hypotheses: ['atlas-combustion-instability', 'atlas-turbopump-cavitation'] },
  'titan-loss': { name: 'Titan II first-stage fault', stage: 'titan-ii', vehicles: ['gemini-titan', 'titan-icbm'], trigger: ['vehicle.deviation', 'titan-ii.chamber-pressure'], hypotheses: ['titan-pogo', 'titan-combustion-instability'] },
  'capsule-leak': { name: 'Mercury cabin losing pressure', stage: 'mercury-capsule', vehicles: ['mercury-redstone', 'mercury-atlas'], trigger: 'mercury-capsule.cabin-pressure', hypotheses: ['capsule-hatch-seal', 'capsule-valve-leak'] },
};

// Ground test plans engineering can propose.
export const CANDIDATE_TESTS = [
  { kind: 'ground', stage: 'aerobee-sustainer', conditions: { burn: 'short' }, channels: ['aerobee-sustainer.wall-temp', 'aerobee-sustainer.chamber-pressure'] },
  { kind: 'ground', stage: 'aerobee-sustainer', conditions: { burn: 'long' }, channels: ['aerobee-sustainer.wall-temp', 'aerobee-sustainer.chamber-pressure'] },
  { kind: 'ground', stage: 'aerobee-sustainer', conditions: { burn: 'long' }, channels: ['aerobee-sustainer.wall-temp'] },
  { kind: 'ground', stage: 'wac-upper', conditions: { burn: 'short' }, channels: ['wac-upper.chamber-pressure'] },
  { kind: 'ground', stage: 'wac-upper', conditions: { burn: 'long' }, channels: ['wac-upper.chamber-pressure'] },
  { kind: 'ground', stage: 'v2', conditions: { burn: 'short' }, channels: ['v2.chamber-pressure'] },
  { kind: 'ground', stage: 'viking', conditions: { burn: 'short' }, channels: ['viking.chamber-pressure'] },
  { kind: 'ground', stage: 'viking', conditions: { burn: 'long' }, channels: ['viking.chamber-pressure'] },
  { kind: 'ground', stage: 'v2', conditions: { burn: 'long' }, channels: ['v2.chamber-pressure'] },
  ...['redstone', 'atlas', 'titan-ii'].flatMap(stage => ['short', 'long'].map(burn => ({ kind: 'ground', stage, conditions: { burn }, channels: [`${stage}.chamber-pressure`] }))),
  ...['short', 'long'].map(burn => ({ kind: 'ground', stage: 'mercury-capsule', conditions: { burn }, channels: ['mercury-capsule.cabin-pressure'] })),
];

// Flight conditions: every flight is a full-duration burn.
export const FLIGHT_CONDITIONS = { burn: 'long' };
