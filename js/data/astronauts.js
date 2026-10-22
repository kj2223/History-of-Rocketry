// ASTRONAUTS: the fictional candidate pool, skills, training focus and simulator rehearsals.

export const FIRST_NAMES = ['Walter', 'Donald', 'Robert', 'James', 'Richard', 'Thomas', 'Frank', 'Edward', 'Charles', 'William', 'George', 'Harold', 'Raymond', 'Kenneth', 'Paul', 'Henry', 'Arthur', 'Eugene', 'Lawrence', 'Martin', 'Russell', 'Vernon', 'Glen', 'Howard', 'Lloyd', 'Dale', 'Curtis', 'Warren'];
export const LAST_NAMES = ['Hartley', 'Brennan', 'Calloway', 'Doyle', 'Whitfield', 'Marsh', 'Kessler', 'Lund', 'Avery', 'Garrity', 'Holloway', 'Pruitt', 'Sorensen', 'Talbot', 'Wyatt', 'Ferris', 'McAllister', 'Rourke', 'Stanton', 'Tremaine', 'Voss', 'Ingram', 'Brandt', 'Ashby', 'Corwin', 'Dunlap', 'Ellery', 'Fenwick', 'Hollis', 'Kearney', 'Lathrop', 'Mercer', 'Nyland', 'Oakes', 'Pendry', 'Quist', 'Rowell', 'Sayer', 'Tolliver', 'Winslow'];
export const SERVICES = ['US Navy', 'US Marine Corps', 'US Air Force'];
export const DEGREES = ['Aeronautical Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Mathematics', 'Physics', 'Military Science'];

// Skills run 0 to 100. The keys are stored in saves.
export const SKILLS = { pil: 'Piloting', sys: 'Systems', end: 'Endurance', com: 'Composure' };
// What each astronaut spends training days on. msn (mission training) is only offered to an assigned pilot.
export const TRAINING_FOCUS = { bal: 'Balanced', phys: 'Physical (centrifuge, zero-g)', sim: 'Simulator', egr: 'Egress and survival', msn: 'Mission training', rest: 'Rest' };
export const QUALIFICATION_DAYS = 500; // general training before an astronaut can be assigned to fly

// Emergencies an astronaut can rehearse in the simulator; a rehearsed one goes better in flight.
// long: how the simulator log names it; short: how the astronaut's card lists it.
export const REHEARSALS = {
  att: { long: 'attitude-control failure', short: 'attitude failure' },
  ecs: { long: 'cabin cooling failure', short: 'cooling failure' },
  tj: { long: 'tower jettison failure', short: 'tower jettison' },
  abort: { long: 'launch abort', short: 'launch abort' },
  retro: { long: 'retrofire failure', short: 'retrofire failure' },
  hatch: { long: 'emergency egress', short: 'emergency egress' },
};
// The order the simulator picks rehearsals from (it matters for random draws).
export const REHEARSAL_KEYS = ['att', 'ecs', 'tj', 'abort', 'retro', 'hatch'];
