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
  'steering-vane-erosion': {
    name: 'Eroded V-2 steering vanes',
    predicts: [{ quantity: 'v2.chamber-pressure', when: {}, normal: true }],
  },
};

// An abnormal reading on a trigger quantity opens the anomaly with its candidate hypotheses.
export const ANOMALIES = {
  'sustainer-overtemp': { name: 'Sustainer runs hot', stage: 'aerobee-sustainer', trigger: 'aerobee-sustainer.wall-temp', hypotheses: ['liner-debond', 'injector-blockage'] },
  // A flight lost off course, or an abnormal stand reading, opens an investigation of the stage.
  'upper-stage-loss': { name: 'Upper stage lost in flight', stage: 'wac-upper', vehicles: ['wac', 'bumper'], trigger: ['vehicle.deviation', 'wac-upper.chamber-pressure'], hypotheses: ['igniter-hangfire', 'feed-starvation'] },
  'v2-loss': { name: 'V-2 lost in flight', stage: 'v2', vehicles: ['bumper'], trigger: ['vehicle.deviation', 'v2.chamber-pressure'], hypotheses: ['turbopump-wear', 'steering-vane-erosion'] },
};

// Ground test plans engineering can propose.
export const CANDIDATE_TESTS = [
  { kind: 'ground', stage: 'aerobee-sustainer', conditions: { burn: 'short' }, channels: ['aerobee-sustainer.wall-temp', 'aerobee-sustainer.chamber-pressure'] },
  { kind: 'ground', stage: 'aerobee-sustainer', conditions: { burn: 'long' }, channels: ['aerobee-sustainer.wall-temp', 'aerobee-sustainer.chamber-pressure'] },
  { kind: 'ground', stage: 'aerobee-sustainer', conditions: { burn: 'long' }, channels: ['aerobee-sustainer.wall-temp'] },
  { kind: 'ground', stage: 'wac-upper', conditions: { burn: 'short' }, channels: ['wac-upper.chamber-pressure'] },
  { kind: 'ground', stage: 'wac-upper', conditions: { burn: 'long' }, channels: ['wac-upper.chamber-pressure'] },
  { kind: 'ground', stage: 'v2', conditions: { burn: 'short' }, channels: ['v2.chamber-pressure'] },
  { kind: 'ground', stage: 'v2', conditions: { burn: 'long' }, channels: ['v2.chamber-pressure'] },
];

// Flight conditions: every flight is a full-duration burn.
export const FLIGHT_CONDITIONS = { burn: 'long' };
