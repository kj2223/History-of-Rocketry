// THE LONG FLIGHTS, FROM HOUSTON: the flight plan of each Gemini and Apollo flight that is played, the mission rules it
// carries, and the questions the flight director has to answer on it. Content only: what really happens is decided in
// truth/flights.js, and what anyone hears of it comes through the controller (houston.js).
//
// A flight plan is a list of steps in hours after liftoff (at). A step can:
//   say:     lines on the loop, [who, text, tone]; 'pilot' is the commander, 'crew2' the second crewman
//   note:    a line for your notebook
//   if/unless: only when the spacecraft really has (or has not) that trouble (a truth flag; never shown to the rooms)
//   decide:  a question from DECISIONS, answered by whoever's seat owns it
//   phase:   the name of the mission phase that starts here (lunar flights are played in phases)
//   show:    lamps on the board, { LABEL: [value, warn] }
//   offShift: what the handover note says happened while your team was off
// The last step of each flight is { at, retro: true }: retrofire (or, coming home from the Moon, entry interface).
export const FLIGHTS = {
  'gem-4': {
    program: 'gemini', craft: 'Gemini 4', entry: 'gemini', completes: 'fourdays', objective: 'four days in orbit and the first American spacewalk',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'The spacewalk goes only with a good cabin and a good hatch check.',
      'A spacecraft without its guidance computer comes home on a rolling, Mercury-style entry.',
    ],
    steps: [
      { at: 0.3, phase: 'Earth orbit', say: [['kessler', 'Flight, EECOM: platform is good, cabin is holding at five point one.', 'go']], show: { CABIN: ['5.1 psi'], BATTERIES: ['good'], COMPUTER: ['up'] } },
      { at: 1.6, if: 'hatch', say: [['crew2', 'Houston, the hatch check was stiff. The latch took both of us to work it.', 'warn']], note: 'On the hatch check, the crew reported the latch stiff: it took both of them to work it.', show: { HATCH: ['stiff', true] } },
      { at: 1.6, unless: 'hatch', say: [['crew2', 'Hatch check is good, Houston.', 'go']], show: { HATCH: ['good'] } },
      { at: 4.3, decide: 'eva' },
      { at: 30, if: 'computer', say: [['kessler', 'Flight, EECOM: the computer has dropped off the line. It will not come back up.', 'bad']], note: 'At about thirty hours the spacecraft\'s guidance computer failed.', show: { COMPUTER: ['down', true] } },
      { at: 30.2, if: 'computer', decide: 'computer' },
      { at: 60, offShift: 'Experiments, sleep periods and a lot of drifting flight to save fuel. Nothing for your team.' },
      { at: 96, decide: 'navcheck' },
      { at: 97, retro: true },
    ],
  },
  'gem-5': {
    program: 'gemini', craft: 'Gemini 5', entry: 'gemini', completes: 'duration', objective: 'eight days, the length of a trip to the Moon and back',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Two fuel-cell sections working, or come home at the next good landing area.',
      'Eight days, if the spacecraft can do it: Apollo needs to know a crew can last the trip.',
    ],
    steps: [
      { at: 0.3, phase: 'Earth orbit', say: [['kessler', 'Flight, EECOM: fuel cells on the line, both sections.', 'go']], show: { 'FUEL CELLS': ['both sections'], 'O2 PRESSURE': ['normal'] } },
      { at: 2.4, if: 'fuelcell', say: [['kessler', 'Flight, EECOM: the fuel cells\' oxygen supply pressure is falling. Sixty-five psi and dropping.', 'bad']], note: 'At about two and a half hours the fuel cells\' oxygen supply pressure began to fall.', show: { 'O2 PRESSURE': ['falling', true] } },
      { at: 2.6, if: 'fuelcell', decide: 'fuelcell1' },
      { at: 26, if: 'fuelcell', decide: 'fuelcell2' },
      { at: 80, offShift: 'Long powered-down days: the crew is bored and cold, and the experiments run behind. Nothing for your team.' },
      { at: 150, offShift: 'Thruster trouble on day six; the crew drifts most of the time to save fuel. Nothing for your team.' },
      { at: 189, decide: 'navcheck' },
      { at: 190, retro: true },
    ],
  },
  // Gemini 6A goes up eleven days into Gemini 7's fourteen, to meet it.
  'gem-6': {
    program: 'gemini', craft: 'Gemini 6A', entry: 'gemini', completes: null, objective: 'to find Gemini 7 in orbit and fly alongside it',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Rendezvous burns from the ground\'s solution unless the spacecraft\'s radar and computer are both good.',
      'Stop closing at less than a foot a second inside a hundred feet.',
    ],
    steps: [
      { at: 0.3, phase: 'The chase', say: [['kessler', 'Flight, EECOM: platform good, radar is warming up.', 'go']], show: { RANGE: ['1,900 km'], RADAR: ['warming'] } },
      { at: 3.2, if: 'computer', say: [['kessler', 'Flight, EECOM: the computer reset itself twice on the radar handover. It\'s back, but I don\'t like it.', 'warn']], show: { COMPUTER: ['resets', true] } },
      { at: 3.4, show: { RANGE: ['400 km'], RADAR: ['lock'] }, say: [['pilot', 'Houston, radar lock on Gemini 7. Two hundred and forty-six miles.', 'go']] },
      { at: 3.6, decide: 'rdvplan' },
      { at: 5.8, phase: 'Station-keeping', say: [['morgan', 'Flight, Network: the two spacecraft are on the screen together.', 'go']] },
      { at: 24, decide: 'navcheck' },
      { at: 25, retro: true },
    ],
  },
  // Gemini 8: the first docking, with an Agena target.
  'gem-8': {
    program: 'gemini', craft: 'Gemini 8', entry: 'gemini', completes: 'threedays', objective: 'the first docking with another spacecraft, an Agena, and three days of work docked',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Once the re-entry thrusters have been used, come home at the next landing area that can be reached.',
      'Undock at once if the stack\'s attitude cannot be held.',
    ],
    steps: [
      { at: 0.3, phase: 'The chase', say: [['kessler', 'Flight, EECOM: the Agena is in a good orbit. Platform good.', 'go']], show: { AGENA: ['good orbit'], THRUSTERS: ['normal'] } },
      { at: 6.5, phase: 'Docked', say: [['pilot', 'Flight, we are docked! It\'s a real smoothie.', 'go']], capability: 'docking' },
      { at: 7.0, if: 'thruster', say: [['crew2', 'Houston, we have serious problems here. We\'re tumbling end over end. We\'re disengaged from the Agena.', 'bad']], note: 'At about seven hours, out of contact over China, the docked stack began to roll. The crew undocked; Gemini 8 alone rolled faster, toward a revolution a second. They shut the attitude thrusters down and stopped her with the re-entry thrusters.', show: { THRUSTERS: ['thruster 8 stuck', true], 'RE-ENTRY THRUSTERS': ['in use', true] } },
      { at: 7.4, if: 'thruster', decide: 'tumble' },
      { at: 10, unless: 'thruster', say: [['crew2', 'Agena is answering every command we send it. What a ship.', 'go']] },
      { at: 30, unless: 'thruster', offShift: 'A day of Agena work: the docked engine burns, and the spacewalk plans for tomorrow. Nothing for your team.' },
      { at: 70, decide: 'navcheck' },
      { at: 71, retro: true },
    ],
  },
};

// The questions, the options for each, who owns the call (the flight director unless said otherwise) and what the
// flight director on the other shift does when the call is not yours (auto, the historical choice).
// rule: the mission rule the call is made against, if there is one.
export const DECISIONS = {
  eva: { q: 'The spacewalk. The pilot is suited and the cabin is ready to depressurise. Go?', auto: 'go', rule: 1,
    options: { go: 'Go for the spacewalk now.', delay: 'Hold it one orbit: rest, and work the hatch again before he opens it.', cancel: 'Cancel the spacewalk.' } },
  computer: { q: 'The guidance computer will not come up. Without it there is no guided entry.', auto: 'ballistic', owner: 'engineer', rule: 2,
    options: { ballistic: 'Fly a rolling entry, Mercury style. She lands where she lands.', retry: 'Have them work the computer for another orbit and try again.' } },
  fuelcell1: { q: 'The fuel cells\' oxygen pressure is falling. The mission rule says two good sections, or come home at the next good area.', auto: 'drift', owner: 'engineer', rule: 1,
    options: { home: 'Follow the rule: come home at the next good area.', drift: 'Power down, drift and watch the pressure. Decide again tomorrow.' } },
  fuelcell2: { q: 'A day on, the fuel-cell pressure is holding, low but steady. Eight days, or home?', auto: 'eight', rule: 2,
    options: { eight: 'Go for the full eight days, powered down.', home: 'Come home at the next good area.' } },
  rdvplan: { q: 'Gemini 7 is on the radar. The terminal burns can be flown from the ground\'s solution or from the spacecraft\'s own radar and computer, which uses less fuel. Which?', auto: 'onboard', rule: 1,
    options: { onboard: 'Fly it from the spacecraft\'s radar and computer.', ground: 'Fly the ground\'s solution.' } },
  tumble: { q: 'The crew has stopped the tumble with the re-entry thrusters. The rule says come home at the next area they can reach: the western Pacific, one destroyer, tonight. The primary area is a day away.', auto: 'secondary', rule: 1,
    options: { secondary: 'Bring them down in the Pacific tonight, on the rule.', primary: 'Hold them up a day for the primary area and the carrier.' } },
  navcheck: { q: 'Retrofire is next. Retro has the landing-point numbers ready for the spacecraft\'s computer. An independent check costs a revolution: retrofire one orbit later, into the secondary area with one destroyer.', auto: 'send', owner: 'retro',
    options: { send: 'Send the numbers now.', check: 'Have the back room check them first.' } },
};

// What each flight can show, when it is shown: scoped capability evidence that later plans can cite. It never certifies
// other hardware.
export const CAPABILITIES = {
  eva: 'A spacewalk from Gemini, outside the cabin on an umbilical',
  duration: 'Eight days in orbit in Gemini, the length of a lunar trip',
  fourdays: 'Four days in orbit in Gemini',
  rendezvous: 'A rendezvous in orbit, Gemini 6A with Gemini 7, closing to a foot',
  docking: 'A docking in orbit, Gemini 8 with an Agena target',
  threedays: 'Three days of docked work with an Agena',
};
