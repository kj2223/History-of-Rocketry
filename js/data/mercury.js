// PROJECT MERCURY: mission types, Phase Two directives, crew decisions, the Astronaut Office calendar. Tune Phase Two here.
// Mission keys (bj, lj, mr, ma, mo), directive keys and decision keys are stored in saves.

// FLIGHT PROFILES: [mission seconds, altitude km, speed m/s, g]. Real figures, rounded: Freedom 7 peaked at 187 km and pulled 11 g on re-entry.
// Each flight scales its profile to what your booster actually delivers with the capsule aboard.
const MERCURY_REDSTONE_PROFILE = [[0, 0, 0, 1], [30, 3, 250, 1.5], [60, 11, 600, 2.4], [100, 30, 1300, 4], [142, 60, 2290, 6.3], [150, 70, 2280, 0], [300, 187, 1980, 0], [440, 90, 2100, 0], [480, 50, 2200, .5], [500, 30, 1200, 11], [530, 15, 300, 3], [560, 6.4, 150, 1], [600, 3, 10, 1.5], [900, .1, 9, 1], [922, 0, 0, 1]];
const BIG_JOE_PROFILE = [[0, 0, 0, 1], [120, 60, 2500, 4], [260, 150, 5000, 6], [420, 153, 4900, 0], [600, 110, 5000, 0], [700, 60, 5100, .5], [730, 30, 2500, 16], [760, 12, 400, 3], [800, 3, 10, 1], [1000, 0, 0, 1]];
const LITTLE_JOE_PROFILE = [[0, 0, 0, 1], [20, 3, 450, 5], [35, 9, 600, 3], [37, 9.5, 620, 15], [45, 10.5, 200, 1], [80, 4, 60, 1], [190, .1, 9, 1], [200, 0, 0, 1]];
const MERCURY_ATLAS_PROFILE = [[0, 0, 0, 1], [150, 70, 3000, 5], [300, 180, 5500, 7], [500, 185, 5400, 0], [750, 120, 5500, 0], [860, 60, 5600, .5], [890, 30, 2800, 14], [920, 12, 400, 3], [960, 3, 10, 1], [1150, 0, 0, 1]];

// ORBITAL FLIGHT (Section 2). An orbital flight's timeline depends on how many orbits it flies, so rules/mission.js builds its
// profile from these figures: the climb to orbit, then the descent counted from retrofire. Friendship 7 (three orbits) fired its
// retros 4 h 33 min after liftoff and splashed down 22 minutes later, after 7.7 g of re-entry.
export const ORBIT_SECONDS = 5310; // one orbit: 88.5 minutes
export const RETROFIRE_AFTER_ORBITS = 460; // retrofire comes this many seconds after the last planned orbit is complete
export const ORBITAL_ASCENT = [[0, 0, 0, 1], [60, 11, 500, 1.6], [130, 58, 2600, 6.7], [190, 110, 4300, 2.2], [300, 160, 7840, 7.7]];
// [seconds after retrofire, altitude km, speed m/s, g]
export const ORBITAL_DESCENT = [[0, 160, 7840, 0], [30, 159, 7700, .4], [600, 90, 7650, .1], [690, 55, 6500, 7.7], [760, 30, 2000, 4], [1030, 6.4, 120, 1], [1080, 3, 10, 1.5], [1300, .1, 9, 1], [1336, 0, 0, 1]];
export const ORBITAL_TIMES = { reentry: 600, drogue: 1030, chute: 1080, end: 1336 }; // seconds after retrofire
// The orbit counts the planner offers. A capsule's endurance (capsuleSystems) decides which it can fly.
export const ORBIT_CHOICES = [1, 2, 3, 6, 22];
export const BASE_ENDURANCE_ORBITS = 3;
// ATTITUDE-CONTROL FUEL (hydrogen peroxide for the thrusters), in % of a full load. Holding attitude on the automatics costs
// FUEL_PER_ORBIT for each of the first three orbits; after that the capsule drifts and spends far less. Research cuts both.
// A thruster fault costs THRUSTER_FAULT_FUEL; retrofire needs RETRO_FUEL to hold the capsule steady while the retros burn.
export const FUEL_PER_ORBIT = 8, DRIFTING_FUEL_PER_ORBIT = 2.5, THRUSTER_FAULT_FUEL = 22, RETRO_FUEL = 15, LOW_FUEL = 35;
// SPLASHDOWN: how far from the recovery ships the capsule comes down, in km. A good retrofire lands within a few km of the
// ships; a late or crooked one hundreds of km away (Aurora 7 came down 400 km long). Beyond LONG_WAIT_KM the ships are hours away.
export const SPLASH_SPREAD_KM = 25, LONG_WAIT_KM = 120;
// The tracking stations an orbit passes over, in order. The network (Base desk) puts a CAPCOM at each one.
export const TRACKING_STATIONS = ['Bermuda', 'the Canary Islands', 'Kano', 'Zanzibar', 'Muchea', 'Hawaii', 'Guaymas', 'Texas', 'the Cape'];

// MISSION TYPES. Capsules are built in the factory; the booster is one of your airframes from the hangar.
//   cost ($) and buildTime (factory seconds) of the capsule; crewed: can carry an astronaut
//   needs: what the booster must deliver with a capsule aboard (alt in m, or v in m/s)
//   reference: the profile's peak altitude (km) and speed, used to scale it to your booster
//   boostEnd, sep (capsule separation), reentry, chute, end, abortAt: mission times in seconds
export const MISSION_TYPES = {
  bj: {
    name: 'Big Joe', fullName: 'Big Joe heat-shield test', capsuleName: 'Big Joe boilerplate capsule', cost: 30000, buildTime: 120, profile: BIG_JOE_PROFILE, crewed: 0,
    needs: { v: 5500 }, reference: { alt: 153, v: 5100 }, boostEnd: 260, sep: 260, reentry: 700, chute: 760, end: 1000,
    why: 'A boilerplate capsule thrown fast enough to prove the heat shield. Needs a booster that reaches 5,500 m/s with a capsule aboard.',
  },
  lj: {
    name: 'Little Joe', fullName: 'Little Joe escape-system test', capsuleName: 'Little Joe test capsule', cost: 15000, buildTime: 60, profile: LITTLE_JOE_PROFILE, crewed: 0,
    needs: { alt: 8000 }, reference: { alt: 10.5, v: 620 }, boostEnd: 35, abortAt: 35, chute: 45, end: 200,
    why: 'Any booster that can climb through maximum aerodynamic load. The escape tower must pull the capsule clear. A rhesus monkey can ride along.',
  },
  mr: {
    name: 'Mercury suborbital', fullName: 'Mercury suborbital flight', capsuleName: 'Mercury capsule', cost: 45000, buildTime: 150, profile: MERCURY_REDSTONE_PROFILE, crewed: 1,
    needs: { alt: 80000 }, reference: { alt: 187, v: 2290 }, boostEnd: 142, sep: 150, reentry: 480, chute: 560, end: 922,
    why: 'Your booster throws the capsule above 80 km, the 50-mile line that earns astronaut wings, and down into the Atlantic. Minutes of weightlessness, then 11 g.',
  },
  ma: {
    name: 'Orbital qualification', fullName: 'Orbital-booster qualification flight', capsuleName: 'Mercury capsule (orbital adapter)', cost: 50000, buildTime: 160, profile: MERCURY_ATLAS_PROFILE, crewed: 0,
    needs: { v: 6500 }, reference: { alt: 185, v: 5600 }, boostEnd: 300, sep: 300, reentry: 860, chute: 920, end: 1150,
    why: 'Optional. A production capsule on your orbital-class booster (6,500 m/s with a capsule), proving the pair work together before Mercury goes to orbit. A success gives the next section a head start.',
  },
  // Section 2. Its timeline (sep, retro, reentry, chute, end) and profile are built for each flight from the orbit count.
  mo: {
    name: 'Mercury orbital', fullName: 'Mercury orbital flight', capsuleName: 'Mercury capsule (orbital)', cost: 60000, buildTime: 170, crewed: 1, orbital: 1,
    needs: { v: 7000 }, reference: { alt: 160, v: 7840 }, boostEnd: 300, sep: 300, gLoad: 7.7,
    why: 'Section 2. Your orbital-class booster puts the capsule into orbit (7,000 m/s with a capsule aboard). Choose how many orbits to fly; the capsule must fire its retrorockets to come home.',
  },
};

// PHASE TWO DIRECTIVES, in order. missionType: the mission that can meet it (rate is met by any flight record).
export const MERCURY_DIRECTIVES = [
  { key: 'bj', name: 'Big Joe', description: 'Prove the heat shield: fly a boilerplate capsule on your orbital-class booster and recover it.', reward: 60000, missionType: 'bj' },
  { key: 'lj', name: 'Little Joe series', description: 'Qualify the escape system across its envelope: three good aborts, at least one with a rhesus monkey aboard.', reward: 60000, missionType: 'lj' },
  { key: 'mr', name: 'Uncrewed suborbital flight', description: 'Fly a Mercury capsule on a suborbital booster with no one aboard, and recover it.', reward: 80000, missionType: 'mr' },
  { key: 'animal', name: 'Animal flight', description: 'Fly a trained chimpanzee on a suborbital flight and recover it alive.', reward: 100000, missionType: 'mr' },
  { key: 'rate', name: 'Man-rate a booster', description: 'Three clean flights in a row by one booster design, with the booster man-rating modifications, abort sensing and the Man-Rated Booster Program complete. Any flight counts: Mercury or ordinary launches.', reward: 40000, missionType: null },
  { key: 'crew', name: 'First American in space', description: 'Fly an astronaut on a certified booster and bring them home. The tracking network must be in service.', reward: 200000, missionType: 'mr' },
  // SECTION 2: Mercury goes to orbit. orbits: the fewest orbits that count.
  { key: 'mo', section: 2, name: 'Uncrewed orbital flight', description: 'Put a Mercury capsule into orbit with no one aboard, fly at least one orbit and recover it.', reward: 120000, missionType: 'mo', orbits: 1 },
  { key: 'oanimal', section: 2, name: 'Animal in orbit', description: 'Orbit a trained chimpanzee for at least two orbits and recover it alive.', reward: 120000, missionType: 'mo', orbits: 2 },
  { key: 'orate', section: 2, name: 'Man-rate an orbital booster', description: 'Certify an orbital-class booster (Jupiter-C, Vanguard or Atlas) for crews: two clean flights in a row by one booster family, as Atlas managed before Glenn.', reward: 60000, missionType: null },
  { key: 'ocrew', section: 2, name: 'First American in orbit', description: 'Fly an astronaut for at least three orbits on a certified booster and bring them home.', reward: 250000, missionType: 'mo', orbits: 3 },
  { key: 'oday', section: 2, name: 'A day in orbit', description: 'Fly an astronaut for 22 orbits, a day and a half, and bring them home. Needs the long-duration capsule modifications.', reward: 200000, missionType: 'mo', orbits: 22 },
];
// Directives of a section: [first index, one past the last].
export const sectionDirectives = section => {
  const indexes = MERCURY_DIRECTIVES.map((directive, index) => (directive.section || 1) == section ? index : -1).filter(index => index >= 0);
  return [indexes[0], indexes[indexes.length - 1] + 1];
};

export const CHIMPANZEE_NAMES = ['Jasper', 'Bongo', 'Duke', 'Rusty', 'Kip', 'Moe', 'Bertie'];
export const MONKEY_NAMES = ['Pip', 'Dot', 'Tilly', 'Bo', 'Juno'];
export const CAPSULE_NAMES = ['Valiant', 'Pioneer', 'Endeavour', 'Patriot', 'Constitution', 'Independence', 'Vigilant', 'Resolute', 'Courage', 'Horizon'];
export const ELECTION_DAY = 5340, INAUGURATION_DAY = 5420; // November 1960 and January 1961

// DECISIONS IN FLIGHT. Each has a question and options.
//   text: what the option says; skill: the astronaut skill it leans on (pil, sys, end, com); baseChance of it working
//   needs: 'man' (manual control fitted) or 'capcom' (a CAPCOM on the loop); soft: the safe choice, always works
//   backup: 'tjb' = the backup sequencer (its chance depends on research); heli: waits for the helicopter
//   crew, shoot: ground options for the pad emergency. ground: 1 = the Test Conductor decides, whoever is aboard.
//   retropack: what the heat-shield option does with the retropack (keep it on, or jettison it as planned).
//   command: what the Test Conductor can send over the ground command link (research 'cmd'), and its baseChance. With a crew
//            aboard it is one more option; with no one aboard the decision comes to the ground instead of the automatics.
export const DECISIONS = {
  abort: { question: 'The booster is failing and the abort system has not fired.', options: [
    { text: 'Pull the abort handle', skill: 'com', baseChance: .75 },
    { text: 'Hold on and trust the booster', baseChance: .04 }],
    command: { text: 'Send the abort command from the ground', baseChance: .7 } },
  tj: { question: 'The escape tower failed to jettison after booster separation. The parachutes cannot deploy with it attached.', options: [
    { text: 'Fire the tower jettison by hand', skill: 'pil', baseChance: .6 },
    { text: 'Wait for the backup sequencer', baseChance: .3, backup: 'tjb' }],
    command: { text: 'Command tower jettison from the ground', baseChance: .75 } },
  att: { question: 'The capsule is drifting off attitude: the automatic stabilization is misbehaving.', options: [
    { text: 'Take manual control', skill: 'pil', baseChance: .6, needs: 'man' },
    { text: 'Let the automatics recover', baseChance: .45 },
    { text: 'Follow CAPCOM through the backup procedure', skill: 'com', baseChance: .55, needs: 'capcom' }],
    command: { text: 'Command the backup control mode from the ground', baseChance: .55 } },
  ecs: { question: 'Suit and cabin temperatures are climbing.', options: [
    { text: 'Turn up the suit coolant', skill: 'sys', baseChance: .6 },
    { text: 'Ride it out', skill: 'end', baseChance: .5 },
    { text: 'Cut the experiments and conserve', baseChance: .8, soft: 1 }] },
  retro: { question: 'The retrorockets did not fire on the timer.', options: [
    { text: 'Fire the retros manually', skill: 'pil', baseChance: .6, needs: 'man' },
    { text: 'Leave them: they are not needed to come home on this arc', baseChance: 1, soft: 1 }],
    command: { text: 'Command retrofire from the ground', baseChance: .8 } },
  // In orbit the retros are the only way home. A failed attempt waits a whole orbit for the next chance; two fail and the capsule is stranded.
  oretro: { question: 'The retrorockets did not fire on the timer. Without them the capsule cannot leave orbit.', options: [
    { text: 'Fire the retros manually', skill: 'pil', baseChance: .65, needs: 'man' },
    { text: 'Fire on the backup retro timer', baseChance: .55, backup: 'timer' }],
    command: { text: 'Command retrofire from the ground', baseChance: .8 } },
  // Friendship 7's "Segment 51": a signal that the landing bag had deployed, which would mean the heat shield was loose.
  shield: { question: 'Telemetry says the landing bag has deployed: the heat shield may be loose. If it is, it could fall away in re-entry.', options: [
    { text: 'Keep the retropack strapped on through re-entry to hold the shield', skill: 'sys', baseChance: .8, retropack: 'keep' },
    { text: 'Jettison the retropack as planned and trust the shield', baseChance: .7, retropack: 'jettison' }],
    command: { text: 'Command the retropack to stay on from the ground', baseChance: .75, retropack: 'keep' } },
  fuel: { question: 'Attitude-control fuel is running low with orbits still to fly. The capsule needs fuel to hold attitude for retrofire.', options: [
    { text: 'Come home early: retrofire at the end of this orbit', baseChance: 1, soft: 1 },
    { text: 'Power down and drift to stretch the fuel', skill: 'sys', baseChance: .55 },
    { text: 'Follow CAPCOM\'s fuel plan from the ground', skill: 'com', baseChance: .65, needs: 'capcom' }] },
  hatch: { question: 'The hatch has blown on the water and the capsule is flooding.', options: [
    { text: 'Get out through the hatch now', skill: 'end', baseChance: .55 },
    { text: 'Stay with the capsule until the helicopter hooks it', baseChance: .3, heli: 1 }] },
  pad: { ground: 1, question: 'The booster is back on the pad, fuelled, with its destruct system armed and the parachutes draped down its side. Nobody can go near it while the capsule batteries are live.', options: [
    { text: 'Wait for the batteries to drain overnight', baseChance: 1, soft: 1 },
    { text: 'Send a pad crew out to make it safe now', baseChance: .7, crew: 1 },
    { text: 'Shoot holes in the tanks to vent the propellant', baseChance: .95, shoot: 1 }] },
};

// ASTRONAUT SELECTION: the testing programme the player chooses for the finalists.
//   cost ($), days it takes, insight: how much it reveals about each finalist, findChance: share of hidden medical problems it catches
export const TESTING_REGIMES = {
  std: { name: 'Standard medical examinations', cost: 15000, days: 45, insight: 60, findChance: .5 },
  full: { name: 'Full Lovelace Clinic and Wright-Patterson stress testing', cost: 40000, days: 75, insight: 160, findChance: 1 },
};

// ASTRONAUT OFFICE DECISIONS: offers and demands that land on the calendar after selection (rules/astronaut-office.js has their effects).
// answers: [yes button, no button]; cost of saying yes; yes / no: what the log says.
export const OFFICE_DECISIONS = {
  life: { who: 'PRESS', question: 'Life magazine offers the astronauts an exclusive contract for their personal stories, worth $500,000 shared among them.', answers: ['APPROVE THE CONTRACT', 'TURN IT DOWN'],
    yes: 'The astronauts become national heroes in Life. Public interest and appropriations rise, but the press now follows their every move.', no: 'The astronauts keep their privacy. The newspapers are cooler toward Mercury.' },
  win: { who: 'ASTRONAUT OFFICE', question: 'The astronauts want a real window in the capsule, not just a periscope. "We are pilots, not passengers."', answers: ['ADD A WINDOW ($25,000)', 'REFUSE: WEIGHT AND SCHEDULE COME FIRST'], cost: 25000,
    yes: 'The capsule is redesigned around a pilot\'s window. Attitude and retrofire decisions get easier.', no: 'The astronauts take it badly. Composure suffers.' },
  ovr: { who: 'ASTRONAUT OFFICE', question: 'The astronauts want a manual override for every automatic sequence: retrofire, attitude and parachutes.', answers: ['ADD THE OVERRIDES ($20,000)', 'REFUSE: THE AUTOMATICS ARE SAFER'], cost: 20000,
    yes: 'Manual overrides are wired into every capsule. Manual-control options are open in flight even before fly-by-wire research.', no: 'The astronauts complain to the press that they are passengers. Composure suffers.' },
  cock: { who: 'ASTRONAUT OFFICE', question: 'The astronauts ask to sit in on spacecraft design reviews, each following one system at the factory.', answers: ['AGREE: EACH FOLLOWS A SYSTEM', 'KEEP THEM ON THE TRAINING SCHEDULE'],
    yes: 'The astronauts learn their spacecraft from the inside. Systems knowledge rises, at the cost of some training time.', no: 'Training stays on schedule. The astronauts feel shut out.' },
};

// The chimpanzee colony at Holloman Air Force Base.
export const CHIMP_TRAINING_COST = 20000;
export const CHIMP_TRAINING_DAYS = 150;
