// FAILURE MODES: the ways a booster can fail, what each looks like in the records, and the fixes engineers can design.
// The one-letter keys (c, p, i, v, x, h, f, s) and fix ids are stored in saves.
//
// Each mode: name, symptoms (keys of SYMPTOMS below) and fixes.
// A fix: riskMultiplier scales that mode's chance of striking (.3 = 70% less: a strong cure, above .3 a partial one),
//   cost ($), time (seconds of a team's work), effects on the rocket: d dry mass (kg), t thrust (multiplier),
//   g g-limit, h heat tolerance, q aero load limit, c drag.
export const FAILURE_MODES = {
  c: {
    name: 'Combustion instability', symptoms: ['cut', 'osc'],
    fixes: [
      { id: 'tune', name: 'Propellant mixture tuning', riskMultiplier: .6, cost: 1500, time: 10, effects: {} },
      { id: 'baffle', name: 'Baffled injector plate', riskMultiplier: .3, cost: 4000, time: 20, effects: { d: 2, t: .99 } },
      { id: 'chamber', name: 'Chamber redesign', riskMultiplier: .25, cost: 12000, time: 45, effects: { t: 1.03 } },
    ],
  },
  p: {
    name: 'Pump cavitation', symptoms: ['cut', 'decay'],
    fixes: [
      { id: 'ind', name: 'Pump inducer stage', riskMultiplier: .3, cost: 5000, time: 25, effects: { d: 1 } },
      { id: 'pfed', name: 'Pressure-fed tanks', riskMultiplier: .4, cost: 3000, time: 15, effects: { d: 4, t: .98 } },
    ],
  },
  i: {
    name: 'Hard start at ignition', symptoms: ['hard', 'cut'],
    fixes: [
      { id: 'igniter', name: 'Pyrotechnic igniter redesign', riskMultiplier: .35, cost: 3000, time: 15, effects: { d: 1 } },
      { id: 'slug', name: 'Hypergolic start slug', riskMultiplier: .25, cost: 6000, time: 25, effects: { d: 2 } },
    ],
  },
  v: {
    name: 'Propellant valve or line leak', symptoms: ['leak', 'cut'],
    fixes: [
      { id: 'valve', name: 'Valve seat rework', riskMultiplier: .4, cost: 2500, time: 12, effects: {} },
      { id: 'qual', name: 'Component qualification program', riskMultiplier: .2, cost: 9000, time: 35, effects: { d: 1 } },
    ],
  },
  x: {
    name: 'Stage separation failure', symptoms: ['stuck'],
    fixes: [
      { id: 'spring', name: 'Separation spring tuning', riskMultiplier: .4, cost: 3500, time: 15, effects: {} },
      { id: 'charge', name: 'Redundant separation charges', riskMultiplier: .2, cost: 8000, time: 30, effects: { d: 3 } },
    ],
  },
  h: {
    name: 'Aerodynamic heating (skin overheats and deforms)', symptoms: ['hot', 'break'],
    fixes: [
      { id: 'nose', name: 'Ablative nose tip', riskMultiplier: .4, cost: 3500, time: 18, effects: { h: .12, d: 1 } },
      { id: 'coat', name: 'Heat-resistant skin coating', riskMultiplier: .25, cost: 7000, time: 30, effects: { h: .225, d: 3 } },
    ],
  },
  f: {
    name: 'Fin flutter at high dynamic pressure', symptoms: ['wob', 'break'],
    fixes: [
      { id: 'fin', name: 'Fin redesign and stiffening', riskMultiplier: .35, cost: 3000, time: 15, effects: { d: 1, q: .16 } },
      { id: 'span', name: 'Smaller, thicker fins', riskMultiplier: .2, cost: 6500, time: 28, effects: { d: 2, q: .3, c: .02 } },
    ],
  },
  s: {
    name: 'Tank buckling under load', symptoms: ['break', 'pdrop'],
    fixes: [
      { id: 'ring', name: 'Stiffening rings', riskMultiplier: .3, cost: 3500, time: 20, effects: { d: 4, g: .7 } },
      { id: 'pstab', name: 'Pressure-stabilized tanks', riskMultiplier: .45, cost: 6000, time: 30, effects: { g: .3 } },
    ],
  },
};

// What the records can show. visible(tr) says whether the flight's instruments could see it:
// tr.v is the airframe's instrument tier (0 to 3), tr.g the ground tracking tier (0 to 2).
export const SYMPTOMS = {
  cut: { text: 'engine cutoff earlier than planned', visible: tr => tr.v >= 1 },
  osc: { text: 'chamber pressure oscillation', visible: tr => tr.v >= 2 },
  decay: { text: 'thrust tailing off before cutoff', visible: tr => tr.v >= 2 },
  hot: { text: 'skin temperature spike', visible: tr => tr.v >= 2 },
  wob: { text: 'fin flutter and pitch oscillation', visible: tr => tr.v >= 2 },
  hard: { text: 'violent pressure spike at ignition', visible: tr => tr.v >= 1 },
  leak: { text: 'propellant leak signature', visible: tr => tr.v >= 2 },
  stuck: { text: 'stage separation anomaly', visible: tr => tr.v >= 1 || tr.g >= 1 },
  break: { text: 'radar shows multiple returns (breakup)', visible: tr => tr.g >= 1 || tr.v >= 1 },
  pdrop: { text: 'tank pressure drop', visible: tr => tr.v >= 2 },
};
// The symptoms of a mode that these instruments would show.
export const visibleSymptoms = (mode, tracking) => FAILURE_MODES[mode].symptoms.filter(symptom => SYMPTOMS[symptom].visible(tracking));
// A lower stage's fix rides as mode@stage (rules/stages.js); it is the same fix.
export const findFix = (mode, fixId) => FAILURE_MODES[mode.split('@')[0]].fixes.find(fix => fix.id == fixId);

// What a launch-crew station reports when it catches a latent fault in the pre-launch poll.
export const FAULT_REPORTS = {
  c: 'chamber pressure transducer erratic on the static check', p: 'turbopump spin-up shows rough bearings', i: 'igniter continuity check failed',
  v: 'LOX valve slow to seat', s: 'tank pressure decaying on the leak check', x: 'separation squib circuit reads high resistance',
  h: 'nose-cone skin joint out of tolerance', f: 'play found in a fin attachment',
};
export const WIND_NAMES = ['calm', 'gusty', 'high'];
