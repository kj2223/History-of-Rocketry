// ROCKET PROGRAMMES: the ladder of real American rockets the player can build, and the flaws a new rocket can hide.
// Tune each rocket here. The keys (wac, aerobee, ...) are stored in saves.
//
// Each programme:
//   name, year (first flight), generation (its rung on the ladder; later rockets get later research)
//   requires: programmes that must reach maturity first (all of them, or any one with anyRequirement)
//   closes: programmes that can no longer be started once this one is (the other branch of a fork)
//   skip: a shortcut past a generation: start from mature `from` without `past` (which it closes), at a price. The work on `past`
//     is folded into this rocket's research; designTime is multiplied, it hides extraTraits more flaws, r is added to its
//     reliability, and its team keeps only headStart (instead of HEAD_START.best) of the best earlier knowledge
//   derivedFrom: the programme it grows out of (it inherits more of that team's knowledge), needsNasa: opens only with NASA
//   design: the nominal bare rocket. The true figures are rolled inside a window when the programme starts (rules/programs.js).
//     dry mass (kg), f propellant capacity (kg of alcohol-equivalent), thr thrust (N), g structural g-limit,
//     h heat tolerance, q aero load limit, c drag, r reliability offset, i instrument tier
//   cost ($) and designTime (seconds) to start it; unitCost ($) and unitTime (seconds) per airframe
//   sizeScale scales research that adds kilograms; costScale and timeScale scale research cost and time
//   packagesPerArea: research packages per vehicle area; learningRate: how fast the team learns it (small rockets learn fast)
//   traitRange: [fewest, most] hidden flaws it is born with
//   propellants it can burn; hasMilestones: big enough for major programmes; canOrbit: a satellite launcher
//   igyFunding: a one-off appropriation when it starts; contract: paid when it matures
//   needsGemini: opens only with Project Gemini; manRatingResearch: research its own man-rating needs as well as the usual
//   headStart: share of the best earlier knowledge its team starts with, instead of HEAD_START.best (a missile already flight-tested)
//   booster: the booster stage under the core (staged rockets): dry mass, fuel (kg), thr thrust (N), isp
//   needsApollo: opens once Project Apollo has chosen its architecture; dryScale: sizes dry-mass effects apart from sizeScale
//   stages: instead of a booster, the lower stages that are designs of their own (STAGE DESIGNS below, rules/stages.js)
export const PROGRAMMES = {
  wac: {
    name: 'WAC Corporal', year: 1946, generation: 0,
    design: { dry: 40, f: 12, thr: 2500, g: 6, h: .5, q: 1, c: 1, r: 0, i: 0 },
    unitCost: 3000, unitTime: 10, sizeScale: 1, costScale: 1, timeScale: 1, packagesPerArea: 3, learningRate: 5, traitRange: [2, 2],
    propellants: ['Alcohol & LOX'], contract: 20000,
    why: 'A slim liquid-fuelled sounding rocket boosted off the pad by a solid kicker. Small, cheap and simple: the place to learn.',
  },
  aerobee: {
    name: 'Aerobee', year: 1947, generation: 1, requires: ['wac'],
    design: { dry: 70, f: 55, thr: 4200, g: 7, h: .6, q: 1.1, c: .95, r: .01, i: .4 },
    cost: 25000, designTime: 30, unitCost: 6000, unitTime: 14, sizeScale: 2, costScale: 1.3, timeScale: 1, packagesPerArea: 4, learningRate: 4.5, traitRange: [2, 3],
    propellants: ['Alcohol & LOX'], contract: 30000,
    why: 'A bigger, workhorse sounding rocket for the upper atmosphere. More capacity, and more ways to go wrong.',
  },
  viking: {
    name: 'Viking', year: 1949, generation: 2, requires: ['aerobee'],
    design: { dry: 150, f: 150, thr: 8500, g: 8, h: .8, q: 1.3, c: .9, r: .02, i: .9 },
    cost: 45000, designTime: 40, unitCost: 12000, unitTime: 20, sizeScale: 4, costScale: 1.7, timeScale: 1, packagesPerArea: 5, learningRate: 4, traitRange: [2, 3],
    propellants: ['Alcohol & LOX'], hasMilestones: 1, contract: 45000,
    why: 'A research rocket with a gimballed engine and real telemetry. The first American design meant to fly far above the weather.',
  },
  redstone: {
    name: 'Redstone', year: 1953, generation: 3, requires: ['viking'],
    design: { dry: 420, f: 560, thr: 26000, g: 8, h: .9, q: 1.5, c: .9, r: .05, i: 1.3 },
    cost: 80000, designTime: 50, unitCost: 24000, unitTime: 28, sizeScale: 8, costScale: 2.2, timeScale: 1.05, packagesPerArea: 5, learningRate: 4, traitRange: [2, 3],
    propellants: ['Alcohol & LOX'], hasMilestones: 1, contract: 90000,
    why: 'A heavy, conservative Army ballistic missile. Short ranged but dependable: the kind of rocket you would trust with a man.',
  },
  vanguard: {
    name: 'Vanguard', year: 1955, generation: 4, requires: ['redstone'], closes: ['redstone', 'jupc'],
    skip: { from: 'viking', past: 'redstone', designTime: 1.6, extraTraits: 1, r: -.03, headStart: .1 },
    design: { dry: 110, f: 165, thr: 9000, g: 8, h: 1.8, q: 1.6, c: .85, r: -.04, i: 1.8 },
    cost: 110000, designTime: 60, unitCost: 30000, unitTime: 34, sizeScale: 3, costScale: 2.4, timeScale: .9, packagesPerArea: 6, learningRate: 4, traitRange: [3, 3],
    propellants: ['Kerosene & LOX', 'Alcohol & LOX'], hasMilestones: 1, canOrbit: 1, igyFunding: 100000, booster: { dry: 1000, fuel: 9000, thr: 170000, isp: 265 },
    why: 'An all-new three-stage satellite launcher from the Navy\'s Viking team. Light and efficient on paper, but every stage is new.',
  },
  jupc: {
    name: 'Jupiter-C', year: 1956, generation: 4, requires: ['redstone'], derivedFrom: 'redstone', closes: ['vanguard'],
    design: { dry: 90, f: 270, thr: 10500, g: 10.5, h: 1.8, q: 1.7, c: .85, r: -.01, i: 1.6 },
    cost: 90000, designTime: 50, unitCost: 28000, unitTime: 32, sizeScale: 3, costScale: 2.2, timeScale: .9, packagesPerArea: 5, learningRate: 4, traitRange: [2, 2],
    propellants: ['Alcohol & LOX'], hasMilestones: 1, canOrbit: 1, booster: { dry: 1100, fuel: 10500, thr: 200000, isp: 262 },
    why: 'An elongated Redstone carrying clusters of small solid rockets. Built from parts the Army already trusts.',
  },
  atlas: {
    name: 'Atlas', year: 1958, generation: 5, requires: ['vanguard', 'jupc'], anyRequirement: 1, needsNasa: 1,
    design: { dry: 300, f: 600, thr: 20000, g: 8, h: 2.8, q: 1.8, c: .8, r: -.05, i: 2.2 },
    cost: 200000, designTime: 75, unitCost: 60000, unitTime: 48, sizeScale: 6, costScale: 3, timeScale: 1.2, packagesPerArea: 6, learningRate: 3, traitRange: [3, 3],
    propellants: ['Kerosene & LOX'], hasMilestones: 1, canOrbit: 1, stages: ['atlas1'],
    why: 'An intercontinental missile with steel-balloon tanks thin as a coin. Enough power to put a man in orbit, if it can be tamed.',
  },
  // Gemini's booster (Phase Two, Section 2). Opens with Project Gemini; a crew rides it only once its pogo is cured (manRatingResearch).
  titan: {
    name: 'Titan II', year: 1962, generation: 6, requires: ['atlas', 'vanguard', 'jupc'], anyRequirement: 1, needsNasa: 1, needsGemini: 1, manRatingResearch: ['gm_pogo'], headStart: .6,
    design: { dry: 420, f: 900, thr: 33000, g: 9, h: 3, q: 2, c: .8, r: 0, i: 2.4 },
    cost: 240000, designTime: 80, unitCost: 75000, unitTime: 52, sizeScale: 7, costScale: 3.2, timeScale: 1.2, packagesPerArea: 6, learningRate: 3, traitRange: [1, 2],
    propellants: ['Aerozine & N2O4'], hasMilestones: 1, canOrbit: 1, stages: ['titan1'],
    why: 'An Air Force missile burning propellants that ignite on contact: no igniters, and it can sit fuelled for months. Strong enough to lift the two-man Gemini, but it shakes along its length (pogo) until that is cured.',
  },
  // The first Saturn (Apollo step 3). Opens once Apollo has chosen how to reach the Moon (needsApollo): the rocket the Moon rocket
  // grows from. Its own design is the S-IV, the first hydrogen stage; under it the S-I, eight H-1 engines round a cluster of tanks.
  saturn1: {
    name: 'Saturn I', year: 1961, generation: 7, requires: ['titan', 'atlas'], anyRequirement: 1, needsNasa: 1, needsApollo: 1, headStart: .5,
    design: { dry: 750, f: 6500, thr: 45000, g: 8, h: 3, q: 2, c: .8, r: -.04, i: 2.6 },
    cost: 400000, designTime: 100, unitCost: 150000, unitTime: 64, sizeScale: 40, dryScale: 12, costScale: 4, timeScale: 1.3, packagesPerArea: 6, learningRate: 3, traitRange: [2, 3],
    propellants: ['Hydrogen & LOX'], hasMilestones: 1, canOrbit: 1, stages: ['sat1_si'],
    why: 'Von Braun\'s team clusters eight proven engines under tanks borrowed from Redstone and Jupiter, and tops them with a stage burning liquid hydrogen: the most efficient fuel there is, and the hardest to handle.',
  },
  // STAGE DESIGNS (Apollo step 3): a lower stage with its own true figures, flaws, research, failures and fixes, kept in a bundle of
  // its own (rules/stages.js). The rocket's own design is its top stage. stageOf: the rocket it belongs to; it is never started,
  // built or flown alone. design: as a rocket's, but f is the propellant it carries (kg) and isp its engine's specific impulse (s).
  // A stage researches the rocket's propulsion and structures packages (the development lead picks the stage for each one);
  // sizeScale sizes their propellant effects to the stage, dryScale their dry-mass effects (a stage is mostly tank).
  atlas1: {
    name: 'Atlas booster section', engine: 'two LR89s', stageOf: 'atlas', year: 1958, generation: 5,
    design: { dry: 1900, f: 15000, thr: 250000, isp: 280, g: 8, h: 2.8, q: 1.8, c: .8, r: -.02, i: 2.2 },
    sizeScale: 150, dryScale: 38, costScale: 3, timeScale: 1.2, packagesPerArea: 0, learningRate: 3, traitRange: [1, 2],
    propellants: ['Kerosene & LOX'],
    why: 'The Atlas is a stage and a half: two booster engines and their skirt drop away two minutes up, and the sustainer flies on alone on the same tanks.',
  },
  titan1: {
    name: 'Titan II first stage', engine: 'LR87', stageOf: 'titan', year: 1962, generation: 6,
    design: { dry: 2300, f: 26000, thr: 380000, isp: 285, g: 9, h: 3, q: 2, c: .8, r: 0, i: 2.4 },
    sizeScale: 200, dryScale: 38, costScale: 3.2, timeScale: 1.2, packagesPerArea: 0, learningRate: 3, traitRange: [1, 2],
    propellants: ['Aerozine & N2O4'],
    why: 'Twin-chamber LR87 engines on a stage of thin aluminium tanks: most of the Titan II\'s weight and nearly all of its thrust at liftoff.',
  },
  sat1_si: {
    name: 'Saturn I first stage (S-I)', engine: 'eight H-1s', stageOf: 'saturn1', year: 1961, generation: 7,
    design: { dry: 6500, f: 70000, thr: 1000000, isp: 289, g: 8, h: 3, q: 2, c: .8, r: -.02, i: 2.6 },
    sizeScale: 540, dryScale: 110, costScale: 4, timeScale: 1.3, packagesPerArea: 0, learningRate: 3, traitRange: [1, 2],
    propellants: ['Kerosene & LOX'],
    why: 'Eight H-1 engines, each a cousin of the Jupiter\'s, under a cluster of nine tanks. If one engine stops, the others can burn longer and still make orbit.',
  },
};
export const PROGRAMME_ORDER = ['wac', 'aerobee', 'viking', 'redstone', 'vanguard', 'jupc', 'atlas', 'titan', 'saturn1'];
export const MATURE = 45; // programme maturity (average team knowledge of the rocket) that opens the next programme
export const FLIGHTS_TO_MATURE = 3; // and the rocket must also have flown this many successful flights of its own
// What a new programme's team already knows: a share of the best knowledge on any earlier rocket, or of the rocket it grows out of.
// Kept low so a new rocket starts as a problem to work out ("Familiar" at most), not as a rocket the team already understands.
export const HEAD_START = { best: .25, parent: .4 };

// Flaws a new rocket can be born with. The keys are stored in saves.
//   mode: the failure mode it feeds (with weight times the usual chance) until a fix for that mode is in the design
//   statPenalty: a performance penalty (fraction of the stat), lifted from airframes built with the flaw's cure (rules/cures.js)
//   cure: for a flaw with no failure mode, the one fix that cures it: id (stored in saves), name, cost ($, times the rocket's
//         costScale), time (seconds of a team's work). A flaw with a mode is cured by any fix for that mode.
//   stagedOnly: rolled only for rockets with a booster stage
export const TRAITS = [
  { key: 'rough', name: 'Rough combustion', mode: 'c', weight: 3, why: 'The injector and chamber resonate under load.' },
  { key: 'pump', name: 'Marginal turbopump', mode: 'p', weight: 3, why: 'The pump runs close to cavitation at full thrust.' },
  { key: 'start', name: 'Hard-starting engine', mode: 'i', weight: 3, why: 'Ignition is violent and inconsistent.' },
  { key: 'leak', name: 'Leak-prone plumbing', mode: 'v', weight: 3, why: 'Valves and lines weep under pressure.' },
  { key: 'thin', name: 'Thin tank walls', mode: 's', weight: 3, statPenalty: { g: -.15 }, why: 'The tanks buckle under the loads the engine can deliver.' },
  { key: 'sep', name: 'Unreliable separation', mode: 'x', weight: 4, stagedOnly: 1, why: 'Stages hang up or tumble at separation.' },
  { key: 'soak', name: 'Heat-soaked skin', mode: 'h', weight: 3, statPenalty: { h: -.15 }, why: 'The skin heats faster than the drawings predicted.' },
  { key: 'flut', name: 'Flutter-prone fins', mode: 'f', weight: 3, statPenalty: { q: -.15 }, why: 'The fins start to flutter well below their design load.' },
  { key: 'heavy', name: 'Overweight structure', statPenalty: { dry: .15 }, why: 'The airframe came out heavier than the drawings.',
    cure: { id: 'lighten', name: 'Weight-reduction programme', cost: 12000, time: 60 } },
  { key: 'weak', name: 'Engine short of rated thrust', statPenalty: { thr: -.08 }, why: 'The engine never quite delivers its rated thrust.',
    cure: { id: 'uprate', name: 'Engine uprating', cost: 15000, time: 60 } },
];
// A flaw that costs performance can always be cured, but the team must first fly the flawed design this many times after
// finding the flaw before they know exactly what causes it (rules/cures.js).
export const FLIGHTS_TO_FIND_CURE = 4;
export const traitByKey = key => TRAITS.find(trait => trait.key == key);
// The flaws a lower stage can be born with: its engine, plumbing and tanks. Heating, fins and separation belong to the whole stack.
export const STAGE_TRAITS = ['rough', 'pump', 'start', 'leak', 'thin', 'heavy', 'weak'];

// The design figures the team does not know exactly. area: the knowledge area that narrows the window.
// startWidth: how wide the window starts, as a fraction of the value either side (reliability: in points).
export const DESIGN_STATS = [
  { key: 'thr', label: 'Thrust', area: 'p', startWidth: .25 },
  { key: 'dry', label: 'Dry mass', area: 's', startWidth: .2 },
  { key: 'f', label: 'Propellant capacity', area: 's', startWidth: .15 },
  { key: 'g', label: 'Structural limit', area: 's', startWidth: .2 },
  { key: 'h', label: 'Heat tolerance', area: 'a', startWidth: .25 },
  { key: 'q', label: 'Aero load limit', area: 'a', startWidth: .25 },
  { key: 'r', label: 'Reliability', area: 'p', startWidth: .06 },
];
