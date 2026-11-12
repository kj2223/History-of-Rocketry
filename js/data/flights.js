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
//   set:     flight state this step sets (the lander undocking, say)
// The last step of each flight is { at, retro: true }: retrofire (or, coming home from the Moon, entry interface).
// Steps every Saturn V flight with a crew carries: a lightning strike on the climb, and a cabin that smells of hot wiring
// (when Apollo 1's fire never happened, the wiring was never rebuilt).
const EARLY = [
  {
    at: 0.25,
    if: 'lightning',
    say: [
      [
        'kessler',
        "Flight, EECOM: the buses are back since SCE to AUX, all three fuel cells on line. But the platform tumbled and we can't see the parachute pyros from here. They took the strike too.",
        'warn',
      ],
    ],
    note: "Lightning struck the Saturn V twice on the climb. The spacecraft's fuel cells dropped off line until EECOM had the crew switch the signal conditioning to its auxiliary supply. Nobody could tell from the ground whether the parachutes' pyrotechnics survived.",
    show: { 'PYRO BUSES': ['not known', true] },
  },
  { at: 0.3, if: 'lightning', decide: 'lightning' },
  {
    at: 1.5,
    if: 'cabin',
    say: [
      [
        'pilot',
        "Houston, we've got a smell of burning insulation down in the lower equipment bay. No smoke we can see.",
        'warn',
      ],
    ],
    show: { CABIN: ['burning smell', true] },
  },
  { at: 1.6, if: 'cabin', decide: 'smoke' },
];
// The oxygen tank, on the way out, on any flight that carries a lander.
const TANK = [
  {
    lunar: true,
    at: 55.9,
    if: 'tank',
    where: [0.85, '320,000 km out'],
    say: [['crew2', "Houston, we've had a problem. Main B bus undervolt, and we're venting something.", 'bad']],
    note: 'At about 56 hours oxygen tank two in the service module failed. The spacecraft lost two of its three fuel cells and was venting its oxygen into space.',
    show: { 'O2 TANK 2': ['zero', true], 'FUEL CELLS': ['one of three', true] },
  },
  { lunar: true, at: 56.2, if: 'tank', decide: 'tank' },
];
// The lander's climb back to the command module, from the surface or from an abort in the descent. A weak ascent engine
// leaves her low, and somebody has to close the gap.
const ASCENT = (at, docked = "Houston, we're docked. Two tired men coming through the tunnel.") => [
  {
    at,
    phase: 'Ascent and rendezvous',
    moon: true,
    when: 'lmFlown',
    say: [['pilot', "Houston, the ascent engine's lit. We're climbing.", 'go']],
    show: { 'ASCENT ENGINE': ['burning'] },
  },
  {
    at: at + 0.15,
    moon: true,
    when: 'lmFlown',
    if: 'ascent',
    say: [
      [
        'kessler',
        "Flight, the ascent engine's chamber pressure came up low all the way. She's in orbit, but low: fifteen by forty kilometres, well under the command module.",
        'bad',
      ],
    ],
    show: { 'ASCENT ENGINE': ['chamber pressure low', true], 'LM ORBIT': ['15 by 40 km', true] },
  },
  { at: at + 0.2, moon: true, when: 'lmFlown', if: 'ascent', decide: 'rescue' },
  {
    at: at + 3.5,
    moon: true,
    when: 'lmFlown',
    not: 'lmLost',
    say: [['crew2', docked, 'go']],
    show: { LM: ['docked'] },
  },
];
// The flight plan, a step at a time. (Fragment: the Saturn IB steps, sorted.)
const IB = [
  {
    at: 0.2,
    phase: 'Launch and Earth orbit',
    where: [0.02, 'Earth orbit'],
    say: [['kessler', 'Flight, EECOM: spacecraft is good. Platform good.', 'go']],
    show: { 'S-IVB': ['safed'], SPS: ['not yet fired'], DOCKING: ['workshop ahead'] },
  },
  {
    at: 2.2,
    if: 'h1',
    say: [
      [
        'albrecht',
        'Flight, Booster: number six H-1 was rough from liftoff and its turbopump read hot. She made orbit, but that pump is finished.',
        'bad',
      ],
    ],
    show: { 'H-1 6': ['hot, made orbit', true] },
  },
].sort((a, b) => a.at - b.at);

// The SLS steps: Orion in orbit on the core stage and the upper stage, and a core-stage engine that shut down early.
const SLS = [
  {
    at: 0.2,
    phase: 'Launch and Earth orbit',
    where: [0.02, 'Earth orbit'],
    say: [['kessler', 'Flight, EECOM: Orion is in orbit. Solar wings are out. Platform good.', 'go']],
    show: { 'UPPER STAGE': ['in orbit'], 'SERVICE ENGINE': ['not yet fired'], ORION: ['wings out'] },
  },
  {
    at: 1.8,
    if: 'ssme',
    say: [
      [
        'albrecht',
        'Flight, Booster: one core-stage engine shut down early in the climb. The upper stage burned long to make it up.',
        'bad',
      ],
    ],
    show: { 'CORE STAGE': ['one engine down early', true] },
  },
].sort((a, b) => a.at - b.at);

// The Shuttle's steps: the orbiter in orbit, and a main engine that shut down early.
const STS = [
  {
    at: 0.2,
    phase: 'Launch and Earth orbit',
    where: [0.02, 'Earth orbit'],
    say: [['kessler', 'Flight, EECOM: the orbiter is in orbit. Payload bay doors are open.', 'go']],
    show: { ORBITER: ['in orbit'], 'PAYLOAD BAY': ['doors open'] },
  },
  {
    at: 1.8,
    if: 'ssme',
    say: [
      [
        'albrecht',
        'Flight, Booster: one main engine shut down early in the climb. The orbit came up low, and the OMS burned long to make it up.',
        'bad',
      ],
    ],
    show: { 'MAIN ENGINES': ['one down early', true] },
  },
].sort((a, b) => a.at - b.at);

export const FLIGHTS = {
  'gem-4': {
    program: 'gemini',
    craft: 'Gemini 4',
    entry: 'gemini',
    completes: 'fourdays',
    objective: 'four days in orbit and the first American spacewalk',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'The spacewalk goes only with a good cabin and a good hatch check.',
      'A spacecraft without its guidance computer comes home on a rolling, Mercury-style entry.',
    ],
    steps: [
      {
        at: 0.3,
        phase: 'Earth orbit',
        say: [['kessler', 'Flight, EECOM: platform is good, cabin is holding at five point one.', 'go']],
        show: { CABIN: ['5.1 psi'], BATTERIES: ['good'], COMPUTER: ['up'] },
      },
      {
        at: 1.6,
        if: 'hatch',
        say: [['crew2', 'Houston, the hatch check was stiff. The latch took both of us to work it.', 'warn']],
        note: 'On the hatch check, the crew reported the latch stiff: it took both of them to work it.',
        show: { HATCH: ['stiff', true] },
      },
      { at: 1.6, unless: 'hatch', say: [['crew2', 'Hatch check is good, Houston.', 'go']], show: { HATCH: ['good'] } },
      { at: 4.3, decide: 'eva' },
      {
        at: 30,
        if: 'computer',
        say: [['kessler', 'Flight, EECOM: the computer has dropped off the line. It will not come back up.', 'bad']],
        note: "At about thirty hours the spacecraft's guidance computer failed.",
        show: { COMPUTER: ['down', true] },
      },
      { at: 30.2, if: 'computer', decide: 'computer' },
      {
        at: 60,
        offShift: 'Experiments, sleep periods and a lot of drifting flight to save fuel. Nothing for your team.',
      },
      { at: 96, decide: 'navcheck' },
      { at: 97, retro: true },
    ],
  },
  'gem-5': {
    program: 'gemini',
    craft: 'Gemini 5',
    entry: 'gemini',
    completes: 'duration',
    objective: 'eight days, the length of a trip to the Moon and back',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'The fuel cells stay on the line while their oxygen supply holds above its 22 psi minimum. Below it, come home at the next good landing area.',
      'Eight days, if the spacecraft can do it: Apollo needs to know a crew can last the trip.',
    ],
    steps: [
      {
        at: 0.3,
        phase: 'Earth orbit',
        say: [['kessler', 'Flight, EECOM: fuel cells on the line, both sections.', 'go']],
        show: { 'FUEL CELLS': ['both sections'], 'O2 PRESSURE': ['normal'] },
      },
      {
        at: 2.4,
        if: 'fuelcell',
        say: [
          [
            'kessler',
            "Flight, EECOM: the fuel cells' oxygen supply pressure is falling. Three hundred psi and dropping. The minimum is twenty-two.",
            'bad',
          ],
        ],
        note: "At about two and a half hours the fuel cells' oxygen supply pressure began to fall.",
        show: { 'O2 PRESSURE': ['falling', true] },
      },
      { at: 2.6, if: 'fuelcell', decide: 'fuelcell1' },
      {
        at: 2.7,
        when: 'poweredDown',
        say: [
          [
            'dorsey',
            'The rendezvous pod is away, but the chase is cancelled. Preserve power for the crew and recovery.',
            'warn',
          ],
        ],
        show: { EXPERIMENTS: ['rendezvous cancelled', true], 'FUEL CELLS': ['minimum load', true] },
      },
      {
        at: 21,
        when: 'poweredDown',
        not: 'batteries',
        offShift:
          'The night shift watched the fuel-cell pressure fall to about seventy psi and hold there under minimum load, well above the minimum.',
        say: [
          [
            'kessler',
            'EECOM handover: the pressure fell to about seventy psi and held there overnight. Still steady under minimum load, well above the minimum.',
            'go',
          ],
        ],
        show: { 'O2 PRESSURE': ['70 psi, steady'], 'FUEL CELLS': ['minimum load', true] },
      },
      {
        at: 21,
        when: 'batteries',
        offShift:
          'The night shift watched the fuel-cell pressure fall through the minimum. On the rule the cells are off the line, and she is on batteries for recovery.',
        say: [
          [
            'kessler',
            'EECOM handover: the pressure went below the minimum. The fuel cells are off the line on the rule. We are on batteries for recovery.',
            'bad',
          ],
        ],
        show: { 'O2 PRESSURE': ['no usable supply', true], 'FUEL CELLS': ['off line', true] },
      },
      { at: 26, when: 'poweredDown', not: 'batteries', decide: 'fuelcell2' },
      {
        at: 80,
        when: 'poweredDown',
        offShift:
          'Long powered-down days: the crew is bored and cold, and the experiments run behind. Nothing for your team.',
      },
      { at: 80, not: 'poweredDown', offShift: 'The crew works through the planned experiments.' },
      {
        at: 150,
        offShift: 'Thruster trouble on day six; the crew drifts most of the time to save fuel. Nothing for your team.',
      },
      { at: 189, decide: 'navcheck' },
      { at: 190, retro: true },
    ],
  },
  // Gemini 6A goes up eleven days into Gemini 7's fourteen, to meet it.
  'gem-6': {
    program: 'gemini',
    craft: 'Gemini 6A',
    entry: 'gemini',
    completes: null,
    objective: 'to find Gemini 7 in orbit and fly alongside it',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      "Rendezvous burns from the ground's solution unless the spacecraft's radar and computer are both good.",
      'Stop closing at less than a foot a second inside a hundred feet.',
    ],
    steps: [
      {
        at: 0.3,
        phase: 'The chase',
        say: [['kessler', 'Flight, EECOM: platform good, radar is warming up.', 'go']],
        show: { RANGE: ['1,900 km'], RADAR: ['warming'] },
      },
      {
        at: 3.2,
        if: 'computer',
        say: [
          [
            'kessler',
            "Flight, EECOM: the computer reset itself twice on the radar handover. It's back, but I don't like it.",
            'warn',
          ],
        ],
        show: { COMPUTER: ['resets', true] },
      },
      {
        at: 3.4,
        show: { RANGE: ['400 km'], RADAR: ['lock'] },
        say: [['pilot', 'Houston, radar lock on Gemini 7. Two hundred and forty-six miles.', 'go']],
      },
      { at: 3.6, not: 'reduced', decide: 'rdvplan' },
      {
        at: 5.8,
        when: 'reduced',
        phase: 'Orbital checkout',
        say: [['morgan', 'Flight, Network: orbit is holding. Gemini 6A is staying clear of the target.', 'go']],
      },
      {
        at: 5.8,
        phase: 'Station-keeping',
        when: 'rendezvousComplete',
        say: [['morgan', 'Flight, Network: the two spacecraft are on the screen together.', 'go']],
      },
      {
        at: 5.8,
        when: 'rendezvousMissed',
        phase: 'Separate orbits',
        say: [['morgan', 'Flight, Network: both spacecraft are tracked. Gemini 6A is staying clear.', 'warn']],
      },
      { at: 24, decide: 'navcheck' },
      { at: 25, retro: true },
    ],
  },
  // Gemini 8: the first docking, with an Agena target.
  'gem-8': {
    program: 'gemini',
    craft: 'Gemini 8',
    entry: 'gemini',
    completes: 'threedays',
    objective: 'the first docking with another spacecraft, an Agena, and three days of work docked',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Once the re-entry thrusters have been used, come home at the next landing area that can be reached.',
      "Undock at once if the stack's attitude cannot be held.",
    ],
    steps: [
      {
        at: 0.3,
        phase: 'The chase',
        say: [['kessler', 'Flight, EECOM: the Agena is in a good orbit. Platform good.', 'go']],
        show: { AGENA: ['good orbit'], THRUSTERS: ['normal'] },
      },
      {
        at: 6.5,
        phase: 'Docked',
        say: [['pilot', "Flight, we are docked! It's a real smoothie.", 'go']],
        capability: 'docking',
      },
      {
        at: 7.0,
        if: 'thruster',
        say: [
          [
            'crew2',
            "Houston, we have serious problems here. We're tumbling end over end. We're disengaged from the Agena.",
            'bad',
          ],
        ],
        note: 'At about seven hours, out of contact over China, the docked stack began to roll. The crew undocked; Gemini 8 alone rolled faster, toward a revolution a second. They shut the attitude thrusters down and stopped her with the re-entry thrusters.',
        show: { THRUSTERS: ['thruster 8 stuck', true], 'RE-ENTRY THRUSTERS': ['in use', true] },
      },
      { at: 7.4, if: 'thruster', decide: 'tumble' },
      {
        at: 10,
        unless: 'thruster',
        say: [['crew2', 'Agena is answering every command we send it. What a ship.', 'go']],
      },
      {
        at: 30,
        unless: 'thruster',
        offShift:
          'A day of Agena work: the docked engine burns, and the spacewalk plans for tomorrow. Nothing for your team.',
      },
      { at: 70, decide: 'navcheck' },
      { at: 71, retro: true },
    ],
  },
  // Gemini 12, the last: what a man can really do outside.
  'gem-12': {
    program: 'gemini',
    craft: 'Gemini 12',
    entry: 'gemini',
    completes: null,
    objective: 'to show that a man can do useful work outside a spacecraft without wearing himself out',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Stop the spacewalk if the suit cannot keep up with the man in it: a fogged visor or a heart rate held over 160.',
      'Every task outside is rehearsed underwater first.',
    ],
    steps: [
      {
        at: 0.3,
        phase: 'Earth orbit',
        say: [['kessler', 'Flight, EECOM: platform good, the Agena is up and waiting.', 'go']],
        show: { AGENA: ['good orbit'], 'HANDHOLDS AND RESTRAINTS': ['fitted'] },
      },
      {
        at: 4.2,
        phase: 'Docked',
        say: [['pilot', 'Houston, docked with the Agena. The radar quit on us; we did it on the charts.', 'go']],
      },
      { at: 18.5, phase: 'The spacewalk', decide: 'evaplan' },
      { at: 50, offShift: 'Experiments, photography and a stand-up spacewalk. Nothing for your team.' },
      { at: 93, decide: 'navcheck' },
      { at: 94, retro: true },
    ],
  },
  // Apollo 6, the second Saturn V, flown without a crew: the last test before men ride it.
  'apollo-6': {
    program: 'apollo',
    craft: 'Apollo 6',
    entry: 'lunar',
    completes: 'lunarentry',
    phases: 3,
    objective:
      "the Saturn V's second flight, with no crew: a restart of the third stage and an entry at the speed of a return from the Moon",
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      "If the third stage will not restart, the service module's engine may fly the high-speed entry test instead.",
      'No crew rides a Saturn V until every failure on this flight is understood.',
    ],
    steps: [
      {
        at: 0.04,
        phase: 'Launch',
        where: [0.02, 'Climbing'],
        say: [['albrecht', "Flight, Booster: the Saturn's tapes from the climb are in.", '']],
      },
      {
        at: 0.05,
        if: 'pogo',
        say: [
          [
            'albrecht',
            'Flight, Booster: the first stage is shaking. Pogo, plus or minus ten g at the top of the stack. Something came off the adapter.',
            'bad',
          ],
        ],
        note: 'Two minutes into the climb the first stage set the stack shaking end to end, pogo, at about five cycles a second. Panels came off the lander adapter.',
        show: { POGO: ['severe', true] },
      },
      {
        at: 0.06,
        if: 'j2',
        say: [
          [
            'albrecht',
            'Flight, Booster: two J-2s out on the second stage. The other three are burning long to make it up.',
            'bad',
          ],
        ],
        note: "Two of the second stage's five engines shut down early. The rest burned longer and the third stage made up the difference.",
        show: { 'SECOND STAGE': ['two engines out', true] },
      },
      {
        at: 3.0,
        if: 'relight',
        say: [['albrecht', 'Flight, Booster: no restart. The third stage will not relight.', 'bad']],
        show: { 'S-IVB RESTART': ['failed', true] },
      },
      { at: 3.1, if: 'relight', decide: 'sps6' },
      {
        at: 2.9,
        phase: 'Earth orbit',
        where: [0.04, 'Earth orbit'],
        say: [['albrecht', 'Flight, Booster: coming up on the third-stage restart.', '']],
      },
      {
        at: 3.0,
        unless: 'relight',
        say: [
          [
            'albrecht',
            "Flight, Booster: good restart on the third stage. She's climbing to twenty-two thousand kilometres.",
            'go',
          ],
        ],
        show: { 'S-IVB RESTART': ['good'] },
      },
      { at: 9.5, phase: 'Entry', where: [0.03, 'Falling back'], decide: 'pogo' },
      { at: 9.8, retro: true },
    ],
  },
  // Apollo 8: round the Moon at Christmas, 1968, if the August meeting sends it.
  'apollo-8': {
    program: 'apollo',
    craft: 'Apollo 8',
    entry: 'lunar',
    completes: 'lunarorbit',
    phases: 7,
    objective: 'ten orbits of the Moon and home: the first men to leave the Earth',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good third stage and a good spacecraft after one and a half Earth orbits.',
      'No lunar orbit insertion without a service engine that has passed its checks: without it there is no way home.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      {
        at: 0.3,
        phase: 'Launch and Earth orbit',
        where: [0.02, 'Earth orbit'],
        say: [['kessler', 'Flight, EECOM: spacecraft is good. Platform good.', 'go']],
        show: { 'S-IVB': ['safed for restart'], SPS: ['not yet fired'] },
      },
      {
        at: 2.4,
        if: 'relight',
        say: [['albrecht', "Flight, Booster: the S-IVB's restart bottle pressure is low. She may not light.", 'warn']],
        show: { 'S-IVB': ['bottle pressure low', true] },
      },
      { at: 2.5, phase: 'Translunar injection', where: [0.03, 'Earth orbit'], decide: 'tli' },
      {
        at: 11,
        lunar: true,
        phase: 'Translunar coast',
        where: [0.3, '120,000 km out'],
        say: [['crew2', 'Houston, we can see the whole Earth now, out of the centre window.', 'go']],
      },
      {
        lunar: true,
        at: 30,
        where: [0.6, '240,000 km out'],
        offShift:
          'Midcourse correction one, navigation sightings, and a crew sick for the first day. Nothing for your team.',
      },
      {
        lunar: true,
        at: 60,
        if: 'sps',
        show: { SPS: ['chamber pressure low on the check', true] },
        say: [
          [
            'kessler',
            "Flight, EECOM: the service engine's test firing came up a little short on chamber pressure.",
            'warn',
          ],
        ],
      },
      { lunar: true, at: 60, unless: 'sps', show: { SPS: ['good on the check'] } },
      { at: 66, phase: 'Lunar orbit insertion', where: [0.97, 'Approaching the Moon'], moon: true, decide: 'loi' },
      {
        at: 69.2,
        phase: 'In lunar orbit',
        where: [1, 'Lunar orbit'],
        moon: true,
        say: [['crew2', 'The Moon is essentially grey, no colour. Like plaster of Paris.', '']],
      },
      {
        at: 75,
        moon: true,
        offShift:
          'Ten orbits of the Moon, photographs of the landing sites, and on Christmas Eve the crew read from Genesis to half the world. Nothing for your team.',
      },
      {
        at: 89,
        phase: 'Trans-Earth injection',
        where: [0.97, 'Behind the Moon'],
        moon: true,
        say: [
          [
            'morgan',
            "Flight, Network: she's behind the Moon. Trans-Earth injection is out of our sight. Waiting for acquisition.",
            'warn',
          ],
        ],
      },
      {
        at: 89.3,
        moon: true,
        when: 'stranded',
        say: [
          [
            'morgan',
            "Flight, Network: no acquisition. She should have come round two minutes ago… We have her. She's still in lunar orbit. The engine did not burn.",
            'bad',
          ],
        ],
      },
      {
        at: 89.4,
        moon: true,
        not: 'stranded',
        say: [['pilot', 'Houston, please be informed there is a Santa Claus.', 'go']],
      },
      { at: 120, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      { at: 140, lunar: true, decide: 'mcc' },
      { at: 146.9, retro: true },
    ],
  },
  // Apollo 8 if the August meeting keeps it in Earth orbit: ten days testing the spacecraft, as Apollo 7 had.
  'apollo-8e': {
    program: 'apollo',
    craft: 'Apollo 8',
    entry: 'gemini',
    completes: 'csmorbit',
    phases: 2,
    objective: 'ten days in Earth orbit, testing the command and service module before the lander is ready',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Every service engine burn is checked before the next.',
    ],
    steps: [
      {
        at: 0.3,
        phase: 'Earth orbit',
        where: [0.02, 'Earth orbit'],
        say: [['kessler', 'Flight, EECOM: spacecraft is good. Platform good.', 'go']],
        show: { SPS: ['not yet fired'] },
      },
      {
        at: 26,
        if: 'sps',
        say: [
          [
            'kessler',
            "Flight, EECOM: the service engine came up short on chamber pressure on its second burn. We'll fly the rest on the small thrusters.",
            'warn',
          ],
        ],
        show: { SPS: ['chamber pressure low', true] },
      },
      {
        at: 26,
        unless: 'sps',
        say: [['kessler', 'Flight, EECOM: eight burns on the service engine, all good.', 'go']],
        show: { SPS: ['eight good burns'] },
      },
      {
        at: 120,
        offShift:
          'Rendezvous with the spent third stage, television from orbit, and a crew with heavy colds. Nothing for your team.',
      },
      { at: 239, phase: 'Coming home', decide: 'navcheck' },
      { at: 240, retro: true },
    ],
  },
  // Apollo 10: the full rehearsal, down to fifteen kilometres over the landing site.
  'apollo-10': {
    program: 'apollo',
    craft: 'Apollo 10',
    entry: 'lunar',
    completes: 'rehearsal',
    phases: 8,
    objective:
      'everything but the landing: the lunar module down to fifteen kilometres over the landing site, and back',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good third stage and a good spacecraft after one and a half Earth orbits.',
      'No lunar orbit insertion without a service engine that has passed its checks: without it there is no way home.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
      'No low pass with a lander computer that restarts by itself.',
    ],
    steps: [
      {
        at: 0.3,
        phase: 'Launch and Earth orbit',
        where: [0.02, 'Earth orbit'],
        say: [['kessler', 'Flight, EECOM: spacecraft is good. Platform good.', 'go']],
        show: { 'S-IVB': ['safed for restart'], SPS: ['not yet fired'], LM: ['docked'] },
      },
      {
        at: 2.4,
        if: 'relight',
        say: [['albrecht', "Flight, Booster: the S-IVB's restart bottle pressure is low. She may not light.", 'warn']],
        show: { 'S-IVB': ['bottle pressure low', true] },
      },
      { at: 2.5, phase: 'Translunar injection', where: [0.03, 'Earth orbit'], decide: 'tli' },
      {
        at: 11,
        lunar: true,
        phase: 'Translunar coast',
        where: [0.3, '120,000 km out'],
        say: [['crew2', "Houston, the lander's pulled out of the third stage clean. She's on our nose.", 'go']],
      },
      {
        lunar: true,
        at: 55,
        if: 'tank',
        where: [0.85, '320,000 km out'],
        say: [['crew2', "Houston, we've had a problem. Main B bus undervolt, and we're venting something.", 'bad']],
        note: 'At about 55 hours oxygen tank two in the service module failed. The spacecraft lost two of its three fuel cells and was venting its oxygen into space.',
        show: { 'O2 TANK 2': ['zero', true], 'FUEL CELLS': ['one of three', true] },
      },
      { lunar: true, at: 55.3, if: 'tank', decide: 'tank' },
      {
        lunar: true,
        at: 60,
        if: 'sps',
        show: { SPS: ['chamber pressure low on the check', true] },
        say: [
          [
            'kessler',
            "Flight, EECOM: the service engine's test firing came up a little short on chamber pressure.",
            'warn',
          ],
        ],
      },
      { lunar: true, at: 60, unless: 'sps', show: { SPS: ['good on the check'] } },
      { at: 76, phase: 'Lunar orbit insertion', where: [0.97, 'Approaching the Moon'], moon: true, decide: 'loi' },
      {
        at: 97.8,
        phase: 'The low pass',
        where: [1, 'Lunar orbit'],
        moon: true,
        say: [['crew2', 'Houston, the lander is powered up and checked out.', '']],
      },
      {
        at: 98,
        moon: true,
        if: 'alarm',
        say: [
          [
            'kessler',
            "Flight, the lander's computer restarted twice on the checkout with the rendezvous radar on.",
            'warn',
          ],
        ],
        show: { 'LM COMPUTER': ['restarts', true] },
      },
      { at: 98.5, moon: true, decide: 'lowpass' },
      {
        at: 137,
        phase: 'Trans-Earth injection',
        where: [0.97, 'Behind the Moon'],
        moon: true,
        say: [
          [
            'morgan',
            "Flight, Network: she's behind the Moon. Trans-Earth injection is out of our sight. Waiting for acquisition.",
            'warn',
          ],
        ],
      },
      {
        at: 137.3,
        moon: true,
        when: 'stranded',
        say: [
          ['morgan', "Flight, Network: we have her, and she's still in lunar orbit. The engine did not burn.", 'bad'],
        ],
      },
      {
        at: 137.4,
        moon: true,
        not: 'stranded',
        say: [['pilot', "Houston, please be informed we're on our way home.", 'go']],
      },
      { at: 160, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      { at: 185, lunar: true, decide: 'mcc' },
      { at: 191.9, retro: true },
    ],
  },
  // Apollo 11: the landing.
  'apollo-11': {
    program: 'apollo',
    craft: 'Apollo 11',
    entry: 'lunar',
    completes: 'landing',
    phases: 9,
    objective: 'land two men on the Moon and bring all three home',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good third stage and a good spacecraft after one and a half Earth orbits.',
      'No lunar orbit insertion without a service engine that has passed its checks: without it there is no way home.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
      'In the descent, abort on any computer alarm that stops the computer flying the lander.',
      'Bingo fuel: land within twenty seconds of the bingo call, or abort.',
    ],
    steps: [
      {
        at: 0.2,
        phase: 'Launch and Earth orbit',
        where: [0.02, 'Earth orbit'],
        say: [['kessler', 'Flight, EECOM: spacecraft is good. Platform good.', 'go']],
        show: { 'S-IVB': ['safed for restart'], SPS: ['not yet fired'], LM: ['in the adapter'] },
      },
      ...EARLY,
      {
        at: 2.4,
        if: 'relight',
        say: [['albrecht', "Flight, Booster: the S-IVB's restart bottle pressure is low. She may not light.", 'warn']],
        show: { 'S-IVB': ['bottle pressure low', true] },
      },
      { at: 2.6, phase: 'Translunar injection', where: [0.03, 'Earth orbit'], decide: 'tli' },
      {
        at: 11,
        lunar: true,
        phase: 'Translunar coast',
        where: [0.3, '120,000 km out'],
        say: [['crew2', "Houston, the lander's out of the third stage and on our nose.", 'go']],
        show: { LM: ['docked'] },
      },
      {
        lunar: true,
        at: 30,
        where: [0.6, '240,000 km out'],
        offShift: 'A midcourse correction, a television broadcast and a quiet night. Nothing for your team.',
      },
      ...TANK,
      {
        lunar: true,
        at: 60,
        if: 'sps',
        show: { SPS: ['chamber pressure low on the check', true] },
        say: [
          [
            'kessler',
            "Flight, EECOM: the service engine's test firing came up a little short on chamber pressure.",
            'warn',
          ],
        ],
      },
      { lunar: true, at: 60, unless: 'sps', show: { SPS: ['good on the check'] } },
      { at: 75.8, phase: 'Lunar orbit insertion', where: [0.97, 'Approaching the Moon'], moon: true, decide: 'loi' },
      {
        at: 100.2,
        moon: true,
        where: [1, 'Lunar orbit'],
        set: { lmFlown: true },
        say: [['pilot', "Houston, the lander has undocked. She's flying.", 'go']],
        show: { LM: ['undocked'] },
      },
      {
        at: 102.5,
        phase: 'Powered descent',
        moon: true,
        say: [['kessler', "Flight, the descent engine has lit. She's coming down.", 'go']],
        show: { 'LM COMPUTER': ['flying the descent'] },
      },
      {
        at: 102.55,
        moon: true,
        if: 'alarm',
        say: [['pilot', "Houston, program alarm. It's a 1202. Give us a reading on the 1202.", 'bad']],
        show: { 'LM COMPUTER': ['1202 alarms', true] },
      },
      { at: 102.6, moon: true, if: 'alarm', decide: 'alarm' },
      {
        at: 102.7,
        moon: true,
        not: 'noLanding',
        say: [
          [
            'pilot',
            "The computer's taking us into a crater full of boulders. I'm taking over. Flying her long.",
            'warn',
          ],
        ],
        show: { 'DESCENT FUEL': ['bingo in 60 s', true] },
      },
      { at: 102.72, moon: true, not: 'noLanding', decide: 'lowfuel' },
      {
        at: 103,
        phase: 'On the surface',
        moon: true,
        when: 'landed',
        where: [1, 'On the Moon'],
        offShift:
          'The first walk on the Moon: the flag, the experiments, rocks in the boxes, and a phone call from the President. Nothing for your team.',
      },
      ...ASCENT(124.4),
      {
        at: 135.4,
        phase: 'Trans-Earth injection',
        where: [0.97, 'Behind the Moon'],
        moon: true,
        say: [
          [
            'morgan',
            "Flight, Network: she's behind the Moon. Trans-Earth injection is out of our sight. Waiting for acquisition.",
            'warn',
          ],
        ],
      },
      {
        at: 135.7,
        moon: true,
        when: 'stranded',
        say: [
          ['morgan', "Flight, Network: we have her, and she's still in lunar orbit. The engine did not burn.", 'bad'],
        ],
      },
      {
        at: 135.8,
        moon: true,
        not: 'stranded',
        say: [['crew2', "Houston, the engine burned on time. We're coming home.", 'go']],
      },
      { at: 160, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      { at: 190, lunar: true, decide: 'mcc' },
      { at: 195.2, retro: true },
    ],
  },
  // Apollo 12: a pinpoint landing beside Surveyor 3, and the Saturn V that was struck by lightning.
  'apollo-12': {
    program: 'apollo',
    craft: 'Apollo 12',
    entry: 'lunar',
    completes: 'landing',
    phases: 9,
    objective: 'land beside Surveyor 3 in the Ocean of Storms, close enough to walk to it, and bring all three home',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good third stage and a good spacecraft after one and a half Earth orbits.',
      'No lunar orbit insertion without a service engine that has passed its checks: without it there is no way home.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
      'In the descent, abort on any computer alarm that stops the computer flying the lander.',
    ],
    steps: [
      {
        at: 0.2,
        phase: 'Launch and Earth orbit',
        where: [0.02, 'Earth orbit'],
        say: [['kessler', "Flight, EECOM: spacecraft is in orbit. We're checking her over.", 'go']],
        show: { 'S-IVB': ['safed for restart'], SPS: ['not yet fired'], LM: ['in the adapter'] },
      },
      ...EARLY,
      {
        at: 2.4,
        if: 'relight',
        say: [['albrecht', "Flight, Booster: the S-IVB's restart bottle pressure is low. She may not light.", 'warn']],
        show: { 'S-IVB': ['bottle pressure low', true] },
      },
      { at: 2.7, phase: 'Translunar injection', where: [0.03, 'Earth orbit'], decide: 'tli' },
      {
        at: 11,
        lunar: true,
        phase: 'Translunar coast',
        where: [0.3, '120,000 km out'],
        say: [
          ['crew2', "Houston, the lander's out and on our nose. The third stage is heading off past the Moon.", 'go'],
        ],
        show: { LM: ['docked'] },
      },
      {
        lunar: true,
        at: 30,
        where: [0.6, '240,000 km out'],
        offShift: 'A midcourse correction to a hybrid trajectory, off the free return. Nothing for your team.',
      },
      ...TANK,
      {
        lunar: true,
        at: 60,
        if: 'sps',
        show: { SPS: ['chamber pressure low on the check', true] },
        say: [
          [
            'kessler',
            "Flight, EECOM: the service engine's test firing came up a little short on chamber pressure.",
            'warn',
          ],
        ],
      },
      { lunar: true, at: 60, unless: 'sps', show: { SPS: ['good on the check'] } },
      { at: 83.4, phase: 'Lunar orbit insertion', where: [0.97, 'Approaching the Moon'], moon: true, decide: 'loi' },
      {
        at: 107.9,
        moon: true,
        where: [1, 'Lunar orbit'],
        set: { lmFlown: true },
        say: [['pilot', "Houston, the lander has undocked. She's flying.", 'go']],
        show: { LM: ['undocked'] },
      },
      {
        at: 110.3,
        phase: 'Powered descent',
        moon: true,
        say: [['kessler', "Flight, the descent engine has lit. She's coming down.", 'go']],
        show: { 'LM COMPUTER': ['flying the descent'] },
      },
      {
        at: 110.33,
        moon: true,
        if: 'alarm',
        say: [['pilot', 'Houston, program alarm. 1202.', 'bad']],
        show: { 'LM COMPUTER': ['1202 alarms', true] },
      },
      { at: 110.35, moon: true, if: 'alarm', decide: 'alarm' },
      {
        at: 110.4,
        moon: true,
        not: 'noLanding',
        say: [
          [
            'tate',
            'Flight, Retro: the tracking has her landing point four thousand two hundred feet short of the target.',
            'warn',
          ],
        ],
        show: { 'LANDING POINT': ['4,200 ft short', true] },
      },
      { at: 110.42, moon: true, not: 'noLanding', decide: 'landpoint' },
      {
        at: 111,
        phase: 'On the surface',
        moon: true,
        when: 'landed',
        where: [1, 'On the Moon'],
        offShift:
          'Two moonwalks, the second to Surveyor 3 to cut off its camera and bring it home. Nothing for your team.',
      },
      ...ASCENT(142),
      {
        at: 172.5,
        phase: 'Trans-Earth injection',
        where: [0.97, 'Behind the Moon'],
        moon: true,
        say: [
          [
            'morgan',
            "Flight, Network: she's behind the Moon. Trans-Earth injection is out of our sight. Waiting for acquisition.",
            'warn',
          ],
        ],
      },
      {
        at: 172.8,
        moon: true,
        when: 'stranded',
        say: [
          ['morgan', "Flight, Network: we have her, and she's still in lunar orbit. The engine did not burn.", 'bad'],
        ],
      },
      {
        at: 172.9,
        moon: true,
        not: 'stranded',
        say: [['crew2', "Houston, the engine burned on time. We're coming home.", 'go']],
      },
      { at: 200, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      { at: 238, lunar: true, decide: 'mcc' },
      { at: 244.3, retro: true },
    ],
  },
  // Apollo 13: Fra Mauro, the first landing in the highlands. Whether oxygen tank two fails on the way out is the hidden
  // layer's (C3). If it does, the lander is the lifeboat, and the flight is a power budget: how fast to come home, and
  // whether the air holds out on the way.
  'apollo-13': {
    program: 'apollo',
    craft: 'Apollo 13',
    entry: 'lunar',
    completes: 'landing',
    phases: 9,
    objective: 'land in the Fra Mauro highlands, the first landing off the mare plains, and bring all three home',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good third stage and a good spacecraft after one and a half Earth orbits.',
      'No lunar orbit insertion without a service engine that has passed its checks: without it there is no way home.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
      'In the descent, abort on any computer alarm that stops the computer flying the lander.',
      'With the lander as a lifeboat, its batteries, water and air must last to entry, with a margin.',
    ],
    steps: [
      {
        at: 0.2,
        phase: 'Launch and Earth orbit',
        where: [0.02, 'Earth orbit'],
        say: [['kessler', 'Flight, EECOM: spacecraft is good. Platform good.', 'go']],
        show: { 'S-IVB': ['safed for restart'], SPS: ['not yet fired'], LM: ['in the adapter'] },
      },
      ...EARLY,
      {
        at: 1.7,
        if: 'j2',
        say: [
          [
            'albrecht',
            "Flight, Booster: the second stage's centre engine shut down two minutes early. The others ran long and made it up; orbit is as planned.",
            'warn',
          ],
        ],
        show: { 'S-II': ['centre engine down', true] },
      },
      {
        at: 2.4,
        if: 'relight',
        say: [['albrecht', "Flight, Booster: the S-IVB's restart bottle pressure is low. She may not light.", 'warn']],
        show: { 'S-IVB': ['bottle pressure low', true] },
      },
      { at: 2.6, phase: 'Translunar injection', where: [0.03, 'Earth orbit'], decide: 'tli' },
      {
        at: 11,
        lunar: true,
        phase: 'Translunar coast',
        where: [0.3, '120,000 km out'],
        say: [
          [
            'crew2',
            "Houston, the lander's out and on our nose. The third stage is off to hit the Moon for the seismometers.",
            'go',
          ],
        ],
        show: { LM: ['docked'] },
      },
      {
        lunar: true,
        at: 30.7,
        where: [0.6, '240,000 km out'],
        offShift: 'A midcourse correction to a hybrid trajectory, off the free return. Nothing for your team.',
      },
      ...TANK,
      // The lifeboat: the command module is shut down, and the lander has to keep three men alive to entry.
      {
        lunar: true,
        at: 57.5,
        when: 'lifeboat',
        say: [
          [
            'kessler',
            "Flight, the command module is powered down. At the lander's lowest load her batteries last to about 133 hours. On the free return as she is, entry is at about 152, in the Indian Ocean.",
            'bad',
          ],
        ],
        show: { 'LM POWER': ['to about 133 h', true], ENTRY: ['about 152 h, Indian Ocean', true] },
      },
      {
        lunar: true,
        at: 61.5,
        when: 'lifeboat',
        say: [
          ['pilot', "Houston, descent engine burn complete. We're back on a free return.", 'go'],
          ['tate', 'Flight, Retro: confirmed. She swings round the Moon and comes home on her own.', 'go'],
        ],
        show: { TRAJECTORY: ['free return'] },
      },
      {
        lunar: true,
        at: 77,
        when: 'lifeboat',
        where: [0.97, 'Round the Moon'],
        phase: 'Round the Moon',
        say: [
          [
            'morgan',
            "Flight, Network: she's behind the Moon. Two hundred and fifty kilometres over the far side.",
            'warn',
          ],
        ],
      },
      { lunar: true, at: 79.3, when: 'lifeboat', decide: 'pc2' },
      {
        lunar: true,
        at: 85,
        when: 'lifeboat',
        say: [
          [
            'kessler',
            "Flight, EECOM: carbon dioxide in the lander is coming up through seven millimetres. Her filters were never meant for three men this long, and the command module's square canisters won't fit her round sockets.",
            'warn',
          ],
        ],
        show: { CO2: ['7 mm and rising', true] },
      },
      { lunar: true, at: 85.2, when: 'lifeboat', decide: 'co2' },
      {
        lunar: true,
        at: 105,
        when: 'lifeboat',
        where: [0.5, 'Coming home'],
        offShift:
          'A short burn on the descent engine, steered by hand with the Earth in the window, to bring the entry back into the corridor. Nothing for your team.',
      },
      {
        lunar: true,
        at: 125,
        when: 'lifeboat',
        not: 'powerShort',
        say: [
          [
            'kessler',
            "Flight, EECOM: the lander's power holds to entry with a margin. The command module comes up from cold on her own batteries at about 137 hours.",
            'go',
          ],
        ],
      },
      {
        lunar: true,
        at: 125,
        when: 'powerShort',
        say: [
          [
            'kessler',
            "Flight, EECOM: the lander's batteries won't make entry at this load. We're shutting down everything we can: the guidance, the heaters, the radios but one.",
            'bad',
          ],
        ],
        show: { 'LM POWER': ['short of entry', true] },
      },
      // No tank failure: the landing at Fra Mauro.
      {
        lunar: true,
        at: 60,
        not: 'home',
        if: 'sps',
        show: { SPS: ['chamber pressure low on the check', true] },
        say: [
          [
            'kessler',
            "Flight, EECOM: the service engine's test firing came up a little short on chamber pressure.",
            'warn',
          ],
        ],
      },
      { lunar: true, at: 60, not: 'home', unless: 'sps', show: { SPS: ['good on the check'] } },
      { at: 77.5, phase: 'Lunar orbit insertion', where: [0.97, 'Approaching the Moon'], moon: true, decide: 'loi' },
      {
        at: 103.5,
        moon: true,
        where: [1, 'Lunar orbit'],
        set: { lmFlown: true },
        say: [['pilot', "Houston, the lander has undocked. She's flying.", 'go']],
        show: { LM: ['undocked'] },
      },
      {
        at: 103.7,
        phase: 'Powered descent',
        moon: true,
        say: [['kessler', "Flight, the descent engine has lit. She's coming down over the Fra Mauro hills.", 'go']],
        show: { 'LM COMPUTER': ['flying the descent'] },
      },
      {
        at: 103.73,
        moon: true,
        if: 'alarm',
        say: [['pilot', 'Houston, program alarm. 1202.', 'bad']],
        show: { 'LM COMPUTER': ['1202 alarms', true] },
      },
      { at: 103.75, moon: true, if: 'alarm', decide: 'alarm' },
      {
        at: 103.8,
        moon: true,
        not: 'noLanding',
        set: { landed: true },
        say: [['pilot', "Contact. Houston, we're down in the hills at Fra Mauro. Rough ground out there.", 'go']],
      },
      {
        at: 105,
        phase: 'On the surface',
        moon: true,
        when: 'landed',
        where: [1, 'On the Moon'],
        offShift:
          "Two moonwalks: the seismometer set out to hear the third stage's impact, and rocks from the Cone crater ejecta. Nothing for your team.",
      },
      ...ASCENT(137),
      {
        at: 167,
        phase: 'Trans-Earth injection',
        where: [0.97, 'Behind the Moon'],
        moon: true,
        say: [
          [
            'morgan',
            "Flight, Network: she's behind the Moon. Trans-Earth injection is out of our sight. Waiting for acquisition.",
            'warn',
          ],
        ],
      },
      {
        at: 167.3,
        moon: true,
        when: 'stranded',
        say: [
          ['morgan', "Flight, Network: we have her, and she's still in lunar orbit. The engine did not burn.", 'bad'],
        ],
      },
      {
        at: 167.4,
        moon: true,
        not: 'stranded',
        say: [['crew2', "Houston, the engine burned on time. We're coming home.", 'go']],
      },
      { at: 200, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      { at: 236, lunar: true, decide: 'mcc' },
      { at: 240, retro: true },
    ],
  },
  // Apollo 15: three days at Hadley Rille with the rover, the first of the long expeditions.
  'apollo-15': {
    program: 'apollo',
    craft: 'Apollo 15',
    entry: 'lunar',
    completes: 'rover',
    phases: 9,
    objective: 'three days at Hadley Rille under the Apennine mountains, with the rover, and all three home',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good third stage and a good spacecraft after one and a half Earth orbits.',
      'No lunar orbit insertion without a service engine that has passed its checks: without it there is no way home.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
      'In the descent, abort on any computer alarm that stops the computer flying the lander.',
      'The rover never goes farther than the crew can walk back on what is left in their suits.',
    ],
    steps: [
      {
        at: 0.2,
        phase: 'Launch and Earth orbit',
        where: [0.02, 'Earth orbit'],
        say: [['kessler', 'Flight, EECOM: spacecraft is good. Platform good.', 'go']],
        show: { 'S-IVB': ['safed for restart'], SPS: ['not yet fired'], LM: ['in the adapter'] },
      },
      ...EARLY,
      {
        at: 2.4,
        if: 'relight',
        say: [['albrecht', "Flight, Booster: the S-IVB's restart bottle pressure is low. She may not light.", 'warn']],
        show: { 'S-IVB': ['bottle pressure low', true] },
      },
      { at: 2.9, phase: 'Translunar injection', where: [0.03, 'Earth orbit'], decide: 'tli' },
      {
        at: 11,
        lunar: true,
        phase: 'Translunar coast',
        where: [0.3, '120,000 km out'],
        say: [
          [
            'crew2',
            "Houston, the lander's out and on our nose. The rover's folded up on her side, where it should be.",
            'go',
          ],
        ],
        show: { LM: ['docked'] },
      },
      {
        at: 28,
        lunar: true,
        where: [0.55, '220,000 km out'],
        say: [
          [
            'kessler',
            "Flight, EECOM: the service engine's light is on with the engine off. There's a short in the delta-V thrust switch, bank A. On bank A the engine could fire when nobody asked it to.",
            'warn',
          ],
        ],
        show: { 'SPS BANK A': ['short', true] },
      },
      { at: 28.3, lunar: true, decide: 'spsbank' },
      ...TANK,
      {
        lunar: true,
        at: 60,
        if: 'sps',
        show: { SPS: ['chamber pressure low on the check', true] },
        say: [
          [
            'kessler',
            "Flight, EECOM: the service engine's test firing came up a little short on chamber pressure.",
            'warn',
          ],
        ],
      },
      { lunar: true, at: 60, unless: 'sps', show: { SPS: ['good on the check'] } },
      { at: 78.5, phase: 'Lunar orbit insertion', where: [0.97, 'Approaching the Moon'], moon: true, decide: 'loi' },
      {
        at: 100.6,
        moon: true,
        where: [1, 'Lunar orbit'],
        set: { lmFlown: true },
        say: [['pilot', "Houston, the lander has undocked. She's flying.", 'go']],
        show: { LM: ['undocked'] },
      },
      {
        at: 104.3,
        phase: 'Powered descent',
        moon: true,
        say: [['kessler', "Flight, the descent engine has lit. She's coming down, steep, over the mountains.", 'go']],
        show: { 'LM COMPUTER': ['flying the descent'] },
      },
      {
        at: 104.33,
        moon: true,
        if: 'alarm',
        say: [['pilot', 'Houston, program alarm. 1202.', 'bad']],
        show: { 'LM COMPUTER': ['1202 alarms', true] },
      },
      { at: 104.35, moon: true, if: 'alarm', decide: 'alarm' },
      {
        at: 104.7,
        moon: true,
        not: 'noLanding',
        set: { landed: true },
        say: [
          [
            'pilot',
            "Contact. Houston, we're down at Hadley. One leg's in a crater; she's sitting at a tilt, but she's fine.",
            'go',
          ],
        ],
      },
      {
        at: 106,
        phase: 'On the surface',
        moon: true,
        when: 'landed',
        where: [1, 'On the Moon'],
        offShift:
          "The first moonwalk: the rover unfolded off the lander's side and drove to the edge of Hadley Rille. Nothing for your team.",
      },
      {
        at: 145,
        moon: true,
        when: 'landed',
        say: [
          [
            'pilot',
            "Houston, we're five kilometres out at the Apennine Front, and there's a white rock on a pedestal up here. Stuart wants twenty minutes with it.",
            'warn',
          ],
        ],
        show: { ROVER: ['5 km out'], WALKBACK: ['limit', true] },
      },
      { at: 145.1, moon: true, when: 'landed', decide: 'traverse' },
      ...ASCENT(171.6),
      {
        at: 223.8,
        phase: 'Trans-Earth injection',
        where: [0.97, 'Behind the Moon'],
        moon: true,
        say: [
          [
            'morgan',
            "Flight, Network: she's behind the Moon. Trans-Earth injection is out of our sight. Waiting for acquisition.",
            'warn',
          ],
        ],
      },
      {
        at: 224.1,
        moon: true,
        when: 'stranded',
        say: [
          ['morgan', "Flight, Network: we have her, and she's still in lunar orbit. The engine did not burn.", 'bad'],
        ],
      },
      {
        at: 224.2,
        moon: true,
        not: 'stranded',
        say: [['crew2', "Houston, the engine burned on time. We're coming home.", 'go']],
      },
      { at: 260, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      { at: 289, lunar: true, decide: 'mcc' },
      { at: 294.6, retro: true },
    ],
  },
  // Apollo 16: the Descartes highlands. The command module drifted on the approach, the lander's throttle fluttered at
  // the low gate, and the ascent engine's checkout read low before the climb home.
  'apollo-16': {
    program: 'apollo',
    craft: 'Apollo 16',
    entry: 'lunar',
    completes: 'landing',
    phases: 9,
    objective: 'land in the Descartes highlands, three days among the mountains, and bring all three home',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good third stage and a good spacecraft after one and a half Earth orbits.',
      'No lunar orbit insertion without a service engine that has passed its checks: without it there is no way home.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
      'In the descent, abort on any computer alarm that stops the computer flying the lander.',
      'The rover never goes farther than the crew can walk back on what is left in their suits.',
      'An engine that will not hold its thrust does not land the lander.',
      'An ascent engine that cannot be trusted does not wait for its scheduled hour.',
    ],
    steps: [
      {
        at: 0.2,
        phase: 'Launch and Earth orbit',
        where: [0.02, 'Earth orbit'],
        say: [['kessler', 'Flight, EECOM: spacecraft is good. Platform good.', 'go']],
        show: { 'S-IVB': ['safed for restart'], SPS: ['not yet fired'], LM: ['in the adapter'] },
      },
      ...EARLY,
      {
        at: 2.4,
        if: 'relight',
        say: [['albrecht', "Flight, Booster: the S-IVB's restart bottle pressure is low. She may not light.", 'warn']],
        show: { 'S-IVB': ['bottle pressure low', true] },
      },
      { at: 2.8, phase: 'Translunar injection', where: [0.03, 'Earth orbit'], decide: 'tli' },
      {
        at: 11,
        lunar: true,
        phase: 'Translunar coast',
        where: [0.3, '120,000 km out'],
        say: [
          [
            'crew2',
            "Houston, the lander's out and on our nose. The rover's folded up on her side, where it should be.",
            'go',
          ],
        ],
        show: { LM: ['docked'] },
      },
      {
        at: 13,
        lunar: true,
        where: [0.35, '160,000 km out'],
        say: [
          [
            'kessler',
            "Flight, EECOM: the command module's number-four thruster is fighting the hand control. She drifts off and comes back. It was the same in practice; we can dock with it, but I don't love it.",
            'warn',
          ],
        ],
        show: { 'CM RCS': ['drifting on the hand control', true] },
      },
      {
        lunar: true,
        at: 30,
        where: [0.55, '220,000 km out'],
        offShift: 'A midcourse correction to a hybrid trajectory, off the free return. Nothing for your team.',
      },
      ...TANK,
      {
        lunar: true,
        at: 60,
        if: 'sps',
        show: { SPS: ['chamber pressure low on the check', true] },
        say: [
          [
            'kessler',
            "Flight, EECOM: the service engine's test firing came up a little short on chamber pressure.",
            'warn',
          ],
        ],
      },
      { lunar: true, at: 60, unless: 'sps', show: { SPS: ['good on the check'] } },
      { at: 81, phase: 'Lunar orbit insertion', where: [0.97, 'Approaching the Moon'], moon: true, decide: 'loi' },
      {
        at: 104,
        moon: true,
        where: [1, 'Lunar orbit'],
        set: { lmFlown: true },
        say: [['pilot', "Houston, the lander has undocked. She's flying.", 'go']],
        show: { LM: ['undocked'] },
      },
      {
        at: 107.5,
        phase: 'Powered descent',
        moon: true,
        say: [['kessler', "Flight, the descent engine has lit. She's coming down over the mountains.", 'go']],
        show: { 'LM COMPUTER': ['flying the descent'] },
      },
      {
        at: 107.53,
        moon: true,
        if: 'alarm',
        say: [['pilot', 'Houston, program alarm. 1202.', 'bad']],
        show: { 'LM COMPUTER': ['1202 alarms', true] },
      },
      { at: 107.55, moon: true, if: 'alarm', decide: 'alarm' },
      {
        at: 107.6,
        moon: true,
        not: 'noLanding',
        if: 'throttle',
        say: [
          [
            'kessler',
            "Flight, EECOM: the descent engine's throttle is fluttering as she comes through the low gate. It was steady in the checkout. She's holding, but I want the call.",
            'warn',
          ],
        ],
        show: { 'DESCENT ENGINE': ['throttle flutter', true] },
      },
      { at: 107.62, moon: true, not: 'noLanding', if: 'throttle', decide: 'throttle' },
      {
        at: 107.7,
        moon: true,
        not: 'noLanding',
        unless: 'linspect',
        set: { landed: true },
        say: [
          [
            'pilot',
            "Contact. Houston, we're down on the Cayley plain at Descartes. She's sitting level, a mile from the mountains.",
            'go',
          ],
        ],
      },
      {
        at: 110,
        moon: true,
        when: 'linspect',
        set: { landed: true },
        say: [
          [
            'tate',
            "Flight, Retro: two hours around, and the command module pilot has had the lander's numbers back. The throttle is sound. They're going down on the next pass.",
            'go',
          ],
        ],
      },
      {
        at: 111.5,
        phase: 'On the surface',
        moon: true,
        when: 'landed',
        where: [1, 'On the Moon'],
        offShift:
          'Moonwalks up the slope of Stone Mountain and out to the rille, and the first drill cores of the highlands. Nothing for your team.',
      },
      {
        at: 150,
        moon: true,
        when: 'landed',
        say: [
          [
            'pilot',
            "Houston, we're two kilometres up the mountain, and there's House Rock ahead: a boulder the size of a house, thrown here from the basin. I want twenty minutes with it.",
            'warn',
          ],
        ],
        show: { ROVER: ['2 km up the slope'], WALKBACK: ['limit', true] },
      },
      { at: 150.1, moon: true, when: 'landed', decide: 'traverse' },
      {
        at: 170,
        moon: true,
        when: 'landed',
        if: 'ascent',
        say: [
          [
            'kessler',
            "Flight, EECOM: the ascent engine's chamber pressure came up low all the way on the checkout. If she quits on the burn, they're stranded.",
            'bad',
          ],
        ],
        show: { 'ASCENT ENGINE': ['chamber pressure low', true] },
      },
      { at: 170.4, moon: true, when: 'landed', decide: 'ascentEarly' },
      ...ASCENT(172),
      {
        at: 224,
        phase: 'Trans-Earth injection',
        where: [0.97, 'Behind the Moon'],
        moon: true,
        say: [
          [
            'morgan',
            "Flight, Network: she's behind the Moon. Trans-Earth injection is out of our sight. Waiting for acquisition.",
            'warn',
          ],
        ],
      },
      {
        at: 224.3,
        moon: true,
        when: 'stranded',
        say: [
          ['morgan', "Flight, Network: we have her, and she's still in lunar orbit. The engine did not burn.", 'bad'],
        ],
      },
      {
        at: 224.4,
        moon: true,
        not: 'stranded',
        say: [['crew2', "Houston, the engine burned on time. We're coming home.", 'go']],
      },
      { at: 260, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      { at: 289, lunar: true, decide: 'mcc' },
      { at: 294.6, retro: true },
    ],
  },
  // Apollo 17: the last landing, three days in the valley of Taurus-Littrow, and the orange soil at Shorty.
  'apollo-17': {
    program: 'apollo',
    craft: 'Apollo 17',
    entry: 'lunar',
    completes: 'landing',
    phases: 9,
    objective: 'three days in the valley of Taurus-Littrow, and the last men home from the Moon',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good third stage and a good spacecraft after one and a half Earth orbits.',
      'No lunar orbit insertion without a service engine that has passed its checks: without it there is no way home.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
      'In the descent, abort on any computer alarm that stops the computer flying the lander.',
      'The rover never goes farther than the crew can walk back on what is left in their suits.',
    ],
    steps: [
      {
        at: 0.2,
        phase: 'Launch and Earth orbit',
        where: [0.02, 'Earth orbit'],
        say: [['kessler', 'Flight, EECOM: spacecraft is good. Platform good.', 'go']],
        show: { 'S-IVB': ['safed for restart'], SPS: ['not yet fired'], LM: ['in the adapter'] },
      },
      ...EARLY,
      {
        at: 1.7,
        if: 'j2',
        say: [
          [
            'albrecht',
            "Flight, Booster: the second stage's centre engine shut down two minutes early. The others ran long and made it up; orbit is as planned.",
            'warn',
          ],
        ],
        show: { 'S-II': ['centre engine down', true] },
      },
      {
        at: 2.4,
        if: 'relight',
        say: [['albrecht', "Flight, Booster: the S-IVB's restart bottle pressure is low. She may not light.", 'warn']],
        show: { 'S-IVB': ['bottle pressure low', true] },
      },
      { at: 2.6, phase: 'Translunar injection', where: [0.03, 'Earth orbit'], decide: 'tli' },
      {
        at: 11,
        lunar: true,
        phase: 'Translunar coast',
        where: [0.3, '120,000 km out'],
        say: [
          [
            'crew2',
            "Houston, the lander's out and on our nose. The rover's folded up on her side, where it should be.",
            'go',
          ],
        ],
        show: { LM: ['docked'] },
      },
      {
        lunar: true,
        at: 30,
        where: [0.55, '220,000 km out'],
        offShift: 'A midcourse correction to a hybrid trajectory, off the free return. Nothing for your team.',
      },
      ...TANK,
      {
        lunar: true,
        at: 60,
        if: 'sps',
        show: { SPS: ['chamber pressure low on the check', true] },
        say: [
          [
            'kessler',
            "Flight, EECOM: the service engine's test firing came up a little short on chamber pressure.",
            'warn',
          ],
        ],
      },
      { lunar: true, at: 60, unless: 'sps', show: { SPS: ['good on the check'] } },
      { at: 83.5, phase: 'Lunar orbit insertion', where: [0.97, 'Approaching the Moon'], moon: true, decide: 'loi' },
      {
        at: 109.5,
        moon: true,
        where: [1, 'Lunar orbit'],
        set: { lmFlown: true },
        say: [['pilot', "Houston, the lander has undocked. She's flying.", 'go']],
        show: { LM: ['undocked'] },
      },
      {
        at: 112,
        phase: 'Powered descent',
        moon: true,
        say: [['kessler', "Flight, the descent engine has lit. She's coming down into the valley.", 'go']],
        show: { 'LM COMPUTER': ['flying the descent'] },
      },
      {
        at: 112.03,
        moon: true,
        if: 'alarm',
        say: [['pilot', 'Houston, program alarm. 1202.', 'bad']],
        show: { 'LM COMPUTER': ['1202 alarms', true] },
      },
      { at: 112.05, moon: true, if: 'alarm', decide: 'alarm' },
      {
        at: 112.2,
        moon: true,
        not: 'noLanding',
        set: { landed: true },
        say: [
          [
            'pilot',
            "Contact. Houston, we're down in the valley of Taurus-Littrow, right between the mountains. It's steep on both sides and the ground is level.",
            'go',
          ],
        ],
      },
      {
        at: 113,
        phase: 'On the surface',
        moon: true,
        when: 'landed',
        where: [1, 'On the Moon'],
        offShift:
          'Three moonwalks down the valley and up the mountain behind the lander, and the deepest set of samples Apollo brought home. Nothing for your team.',
      },
      {
        at: 146,
        moon: true,
        when: 'landed',
        say: [
          [
            'pilot',
            "Houston, we're out at the edge of the landslide, and the white rock is straight ahead. I want twenty minutes with it before the rule says turn around.",
            'warn',
          ],
        ],
        show: { ROVER: ['5 km out'], WALKBACK: ['limit', true] },
      },
      { at: 146.1, moon: true, when: 'landed', decide: 'traverse' },
      {
        at: 152,
        moon: true,
        when: 'landed',
        say: [
          [
            'pilot',
            "Houston, there's orange soil underfoot here at Shorty. Orange as rust, all along the rim of the crater.",
            'go',
          ],
        ],
        show: { SURFACE: ['orange soil at Shorty', true] },
      },
      ...ASCENT(172.5),
      {
        at: 224.8,
        phase: 'Trans-Earth injection',
        where: [0.97, 'Behind the Moon'],
        moon: true,
        say: [
          [
            'morgan',
            "Flight, Network: she's behind the Moon. Trans-Earth injection is out of our sight. Waiting for acquisition.",
            'warn',
          ],
        ],
      },
      {
        at: 225.1,
        moon: true,
        when: 'stranded',
        say: [
          ['morgan', "Flight, Network: we have her, and she's still in lunar orbit. The engine did not burn.", 'bad'],
        ],
      },
      {
        at: 225.2,
        moon: true,
        not: 'stranded',
        say: [['crew2', "Houston, the engine burned on time. We're coming home.", 'go']],
      },
      { at: 260, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      { at: 289, lunar: true, decide: 'mcc' },
      { at: 294.6, retro: true },
    ],
  },

  // ---- The workshop years, 1973-75. The Saturn IB's steps (IB) have no lightning fragment: the Saturn IB has
  // never been hit. The workshop's launch damage rides with the seed, not the round. ----

  'skylab-2': {
    program: 'apollo',
    craft: 'Skylab 2',
    entry: 'orbit',
    completes: 'evawork',
    phases: 5,
    objective: 'rendezvous with the workshop, save her if she needs saving, twenty-eight days of work, and home',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Dock on the third revolution; the crew has two free drift orbits in hand.',
      'The workshop is not occupied without a shade over a lost shield.',
      'One spacewalk a day, never two: the suits must dry out between them.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      ...IB,
      ...EARLY,
      {
        at: 5,
        if: 'shield',
        say: [
          [
            'pilot',
            "Houston, we have the workshop. She's flying odd: the micrometeoroid shield is gone, torn back over the solar panel bay. One wing is jammed shut and the other did not open.",
            'bad',
          ],
        ],
        note: "The workshop's micrometeoroid shield was torn away sixty-three seconds into her launch, and one solar wing jammed against the hull. Temperatures inside climbed past fifty degrees.",
        show: { WORKSHOP: ['shield gone, one wing jammed', true] },
      },
      { at: 5.2, if: 'shield', decide: 'parasol' },
      {
        at: 6,
        unless: 'shield',
        say: [['pilot', 'Houston, the workshop is bright gold and whole. Docking on the next pass.', 'go']],
      },
      {
        at: 7.5,
        where: [0.02, 'Earth orbit'],
        say: [['pilot', "Houston, hard dock. We're aboard the first American space station.", 'go']],
        show: { DOCKING: ['hard dock'] },
      },
      {
        at: 26,
        when: 'shaded',
        say: [
          [
            'kessler',
            'Flight, EECOM: the parasol is out through the solar airlock. Cabin temperature is coming down already: thirty-two degrees and falling.',
            'go',
          ],
        ],
        show: { WORKSHOP: ['shaded', true] },
      },
      { at: 30, decide: 'panel' },
      {
        at: 40,
        when: 'panelFree',
        say: [['kessler', 'Flight, EECOM: the wing is out and tracking the Sun. The workshop has full power.', 'go']],
        show: { 'SOLAR WING': ['free and tracking', true] },
      },
      {
        at: 100,
        offShift:
          "The crew's weeks aboard: experiments on schedule, the workshop standing to it, and a crew working well together. Nothing for your team.",
      },
      {
        at: 660,
        where: [0.02, 'Earth orbit'],
        say: [['pilot', "Houston, we're loose. The workshop looks good from out here. See you in the spring.", 'go']],
      },
      { at: 668, retro: true },
    ],
  },

  // Skylab 3: fifty-nine days, and a leaking thruster quad to weigh the mission against.
  'skylab-3': {
    program: 'apollo',
    craft: 'Skylab 3',
    entry: 'orbit',
    completes: null,
    phases: 5,
    objective: 'fifty-nine days aboard, the full science programme, and all three home',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Dock on the third revolution; the crew has two free drift orbits in hand.',
      'A leaking thruster quad is watched hour by hour: if it worsens, the mission comes home.',
      'With two quads leaking, a rescue Apollo is readied on the pad: ten days from rollout to launch.',
      'One spacewalk a day, never two: the suits must dry out between them.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      ...IB,
      ...EARLY,
      {
        at: 8,
        say: [
          [
            'kessler',
            'Flight, EECOM: a leak in an attitude thruster quad on the service module. Three quads in that system are still good. It is not getting worse, but it is not getting better.',
            'warn',
          ],
        ],
        show: { 'RCS QUAD': ['leaking', true] },
      },
      { at: 8.2, decide: 'quad' },
      {
        at: 130,
        when: 'stayed',
        not: 'short',
        say: [
          [
            'kessler',
            "Flight, EECOM: a second quad on the service module is leaking now. Two good quads left. She can still fly home on them, but nothing's spare.",
            'bad',
          ],
        ],
        show: { 'RCS QUAD': ['two leaking', true] },
      },
      { at: 130.2, when: 'stayed', not: 'short', decide: 'quad2' },
      {
        at: 200,
        offShift:
          'Five weeks in: medicine, the Sun through the telescopes, and six hundred hours of experiments. Nothing for your team.',
      },
      {
        at: 900,
        offShift: 'The crew is working eight-hour days and asking for more. The flight surgeons keep an eye on them.',
      },
      {
        at: 1370,
        where: [0.02, 'Earth orbit'],
        say: [['pilot', 'Houston, undocked. Fifty-nine days, and the workshop took everything we threw at her.', 'go']],
      },
      { at: 1378, retro: true },
    ],
  },

  // Skylab 4: the last crew, the comet, and a crew that pushed back.
  'skylab-4': {
    program: 'apollo',
    craft: 'Skylab 4',
    entry: 'orbit',
    completes: null,
    phases: 5,
    objective: 'eighty-four days aboard, the comet through the telescopes, and the workshop handed over safe',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Dock on the third revolution; the crew has two free drift orbits in hand.',
      'The timeline serves the crew; the crew do not serve the timeline.',
      'One spacewalk a day, never two: the suits must dry out between them.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      ...IB,
      ...EARLY,
      {
        at: 12,
        say: [
          [
            'pilot',
            "Houston, we're an hour behind by noon every day. The timeline you sent up was written for men who don't sleep. We need a day to reset it.",
            'warn',
          ],
        ],
        show: { SCHEDULE: ['falling behind', true] },
      },
      { at: 12.2, decide: 'pace' },
      {
        at: 90,
        say: [
          [
            'crew2',
            "Houston, the comet is naked-eye from here, and through the telescope it's worth every mile we flew. Photographing until the pass ends.",
            'go',
          ],
        ],
        show: { TELESCOPE: ['on the comet', true] },
      },
      {
        at: 500,
        offShift: 'Two months in: the comet photographed, the Earth surveyed, and a crew in rhythm with the workshop.',
      },
      {
        at: 1980,
        where: [0.02, 'Earth orbit'],
        say: [
          ['pilot', "Houston, undocked. Eighty-four days, and she's still good. Somebody ought to come back.", 'go'],
        ],
      },
      { at: 1988, retro: true },
    ],
  },

  // Apollo-Soyuz, July 1975: the last Apollo, flown with the other side.
  astp: {
    program: 'apollo',
    craft: 'Apollo-Soyuz',
    entry: 'orbit',
    completes: 'intl',
    phases: 4,
    objective: 'dock with the Soyuz, open the hatches both ways, fly two days together, and come home',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'The docking is at a walking pace: stop and realign whenever either craft is off her line.',
      'Nothing is powered in the docking module while the hatches are open.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      ...IB,
      ...EARLY,
      {
        at: 20,
        say: [
          [
            'morgan',
            'Flight, Network: the Soyuz is on the radar, forty kilometres out. Their crew reports all well.',
            'go',
          ],
        ],
        show: { SOYUZ: ['acquiring'] },
      },
      { at: 21.5, decide: 'align' },
      {
        at: 22.5,
        where: [0.02, 'Earth orbit'],
        say: [['pilot', 'Houston, hard dock. Both probes read capture. Tell Moscow.', 'go']],
        show: { SOYUZ: ['hard dock', true] },
      },
      {
        at: 30,
        offShift:
          'The hatches open both ways and the crews trade capsules, dinners and bad jokes through interpreters. Nothing for your team.',
      },
      {
        at: 40,
        where: [0.02, 'Earth orbit'],
        say: [['pilot', "Houston, we're loose of the Soyuz. Tell them we'll see them down the road.", 'go']],
      },
      { at: 46, retro: true },
    ],
  },

  // ---- The Shuttle years, 1981-2000 (A8, A9) ----

  // STS-1, April 1981: the first winged spacecraft to orbit, flown home to the lakebed at Edwards by hand.
  'sts-1': {
    program: 'shuttle',
    craft: 'Columbia, STS-1',
    entry: 'orbit',
    completes: 'reusable',
    phases: 4,
    objective: 'fly the orbiter to orbit, check her tiles, and bring her home on a runway',
    rules: [
      'The lakebed at Edwards is the primary landing site; the Cape only if the weather holds.',
      'Two good fuel cells, or the flight comes home at the next opportunity.',
      'The tiles are checked before entry is certified.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      ...STS,
      {
        at: 0.25,
        if: 'cabin',
        say: [
          [
            'pilot',
            "Houston, there's a smell of burning insulation back in the avionics bay. No smoke we can see.",
            'warn',
          ],
        ],
      },
      {
        at: 2.6,
        if: 'foam',
        say: [
          [
            'kessler',
            'Flight, EECOM: the photographs from the tank show foam off the bipod ramp, and the belly took it. We are looking at the tiles.',
            'warn',
          ],
        ],
        note: "Foam came off the external tank's bipod ramp during the climb and struck the tiles on the belly. Nobody could say how deep it went from the ground.",
        show: { TILES: ['strike suspected', true] },
      },
      { at: 2.7, if: 'foam', decide: 'tiles' },
      {
        at: 5,
        if: 'fuelcell',
        say: [
          [
            'kessler',
            'Flight, EECOM: one fuel cell is dropping off the bus. Two remain. She is good for the plan.',
            'warn',
          ],
        ],
        show: { 'FUEL CELLS': ['two of three', true] },
      },
      {
        at: 8,
        offShift:
          'Two days of systems tests: opening and closing the doors, the radiators, and the first look at the tiles in orbit. Nothing for your team.',
      },
      {
        at: 20,
        phase: 'The entry',
        where: [0.4, 'Coming home'],
        decide: 'tald',
      },
      { at: 24, retro: true },
    ],
  },

  // STS-51-L, January 1986: the coldest launch morning in the programme's history. The joint is the hidden layer's.
  'sts-51l': {
    program: 'shuttle',
    craft: 'Challenger, STS-51-L',
    entry: 'orbit',
    completes: null,
    phases: 3,
    objective: 'carry the tracking satellite and the first teacher to orbit, and come home two days later',
    rules: [
      'The solid-rocket joints have never flown colder than the coldest launch before this one.',
      'A joint that has leaked on the bench does not fly without a retest.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      ...STS,
      {
        at: 3,
        if: 'foam',
        say: [
          [
            'kessler',
            'Flight, EECOM: foam off the tank at the ramp, and the belly took it. The tiles are being looked at.',
            'warn',
          ],
        ],
        show: { TILES: ['strike suspected', true] },
      },
      {
        at: 5,
        phase: 'In orbit',
        where: [0.02, 'Earth orbit'],
        offShift:
          'The tracking satellite is up and spinning free. Schoolchildren across the country are watching live: one of the crew teaches her lesson from orbit.',
      },
      { at: 25, retro: true },
    ],
  },

  // STS-26, September 1988: the return to flight, on the redesigned joint.
  'sts-26': {
    program: 'shuttle',
    craft: 'Discovery, STS-26',
    entry: 'orbit',
    completes: null,
    phases: 3,
    objective: 'return the fleet to flight on the redesigned joint, and bring every one of them home',
    rules: [
      'The redesigned joint flies with heaters on and seals warm; no launch if any seal reads cold.',
      'The relay satellite is deployed only by a crew working inside its own limits: cabin no hotter than thirty degrees.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      ...STS,
      {
        at: 1.5,
        say: [
          [
            'albrecht',
            "Flight, Booster: the redesigned joint's heaters are reading good. Seals warm all the way round.",
            'go',
          ],
        ],
        show: { 'SRB JOINT': ['heaters good'] },
      },
      {
        at: 3,
        where: [0.02, 'Earth orbit'],
        say: [
          [
            'kessler',
            "Flight, EECOM: the flash evaporator has iced up. The cabin's warming: twenty-nine degrees.",
            'warn',
          ],
        ],
        show: { CABIN: ['29 °C, evaporator iced', true] },
      },
      {
        at: 4.5,
        if: 'hotCabin',
        say: [['kessler', 'Flight, EECOM: cabin is thirty-two degrees and still climbing.', 'bad']],
        show: { CABIN: ['32 °C, climbing', true] },
      },
      { at: 5, phase: 'The deploy', decide: 'tdrs' },
      {
        at: 8,
        where: [0.02, 'Earth orbit'],
        offShift: 'The satellite is up. The crew keeps the timeline loose and the loop quiet. Nothing for your team.',
      },
      { at: 24, retro: true },
    ],
  },

  // Discovery, STS-31, April 1990: the telescope goes up, and one of her solar arrays stops unrolling.
  'sts-31': {
    program: 'shuttle',
    craft: 'Discovery, STS-31',
    entry: 'orbit',
    completes: null,
    phases: 3,
    objective: 'carry the space telescope up, open her out on the arm, and let her go working',
    rules: [
      'No spacewalk without a partner at the airlock and a ready path home.',
      'The telescope is released only with both solar arrays out and making power.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      ...STS,
      {
        at: 18,
        phase: 'The deploy',
        where: [0.02, 'Earth orbit, 600 km'],
        say: [
          [
            'crew2',
            'Houston, the telescope is out of the bay on the arm. First solar array is unrolling. Pretty as a picture.',
            'go',
          ],
        ],
        show: { TELESCOPE: ['on the arm'], 'ARRAY 1': ['out'] },
      },
      {
        at: 19,
        say: [
          [
            'kessler',
            'Flight, EECOM: the second array has stopped part way. The tension monitor tripped and shut the motor off. Two spacewalkers are suiting up in the airlock as a precaution.',
            'warn',
          ],
        ],
        show: { 'ARRAY 2': ['stalled part way', true] },
      },
      {
        at: 19.1,
        if: 'arrayBind',
        say: [['kessler', 'Flight, EECOM: the motor current spiked hard just before it stopped.', 'warn']],
        show: { 'ARRAY 2': ['stalled, current spike', true] },
      },
      { at: 19.2, decide: 'hubbledeploy' },
      {
        at: 22,
        say: [['pilot', 'Houston, the telescope is released. She is flying on her own.', 'go']],
        show: { TELESCOPE: ['released'] },
      },
      {
        at: 40,
        offShift:
          'The crew is watching the telescope from a distance in case she needs them. She does not. Nothing for your team.',
      },
      { at: 118, retro: true },
    ],
  },
  // STS-61, December 1993: the repair flight, four spacewalks to fix the telescope's eyesight.
  'sts-61': {
    program: 'shuttle',
    craft: 'Endeavour, STS-61',
    entry: 'orbit',
    completes: 'hubble',
    phases: 4,
    objective: 'catch the telescope, fix her eyesight on five spacewalks, and bring her home seeing',
    rules: [
      'No spacewalk without a partner at the airlock and a ready path home.',
      'The corrective optics are installed only with the telescope latched and the aperture closed.',
      'Old hardware that will not stow safely for the trip home is let go, not fought.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      ...STS,
      {
        at: 5,
        say: [
          [
            'pilot',
            'Houston, we have the telescope on the arm. She looks tired: solar panels warped, and she needs her glasses.',
            'warn',
          ],
        ],
        show: { TELESCOPE: ['on the arm', true] },
      },
      {
        at: 18,
        phase: 'The spacewalks',
        where: [0.02, 'Earth orbit'],
        say: [
          [
            'crew2',
            "Houston, one of the old solar arrays won't roll up. It went two-thirds of the way and stopped. The boom looks kinked from here, but it's hard to say.",
            'warn',
          ],
        ],
        show: { 'OLD ARRAY': ['will not roll', true] },
      },
      { at: 18.2, decide: 'array' },
      {
        at: 30,
        phase: 'The repair',
        where: [0.02, 'Earth orbit'],
        decide: 'hubblefix',
      },
      {
        at: 36,
        when: 'fixed',
        say: [
          ['crew2', "Houston, the corrective optics are in and latched. She'll see better than she ever has.", 'go'],
        ],
        show: { TELESCOPE: ['new eyes', true] },
      },
      {
        at: 60,
        offShift: 'Five spacewalks across five days, the busiest EVA week anyone has flown. Nothing for your team.',
      },
      { at: 70, retro: true },
    ],
  },

  // STS-88, December 1998: the first pieces of the station joined in orbit.
  'sts-88': {
    program: 'shuttle',
    craft: 'Endeavour, STS-88',
    entry: 'orbit',
    completes: 'station',
    phases: 4,
    objective: 'mate the second module to the first, open the hatches between them, and come home',
    rules: [
      'The docking is at a walking pace: stop and realign whenever either craft is off her line.',
      'The module is berthed by the arm before the ring is latched.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      ...STS,
      {
        at: 20,
        say: [
          [
            'morgan',
            'Flight, Network: the module is on the radar, thirty kilometres out. She has been up alone for a fortnight.',
            'go',
          ],
        ],
        show: { MODULE: ['acquiring'] },
      },
      {
        at: 21.5,
        decide: 'berth',
      },
      {
        at: 22.5,
        where: [0.02, 'Earth orbit'],
        say: [['pilot', 'Houston, the module is on the arm. Bringing her in to mate.', 'go']],
        show: { MODULE: ['on the arm', true] },
      },
      {
        at: 30,
        where: [0.02, 'Earth orbit'],
        set: { station: true },
        say: [['pilot', 'Houston, hatches open. Two modules of a space station, joined in orbit.', 'go']],
        show: { STATION: ['two modules', true] },
      },
      {
        at: 36,
        offShift: 'Three spacewalks connect power and data between the modules. Nothing for your team.',
      },
      { at: 46, retro: true },
    ],
  },

  // STS-97, December 2000: the solar wings up, and the first expedition handed her keys.
  'sts-97': {
    program: 'shuttle',
    craft: 'Endeavour, STS-97',
    entry: 'orbit',
    completes: null,
    phases: 4,
    objective: 'carry up the solar wings, hand the station to its first long-stay crew, and come home',
    rules: [
      'The docking is at a walking pace: stop and realign whenever either craft is off her line.',
      'The wings deploy only in daylight and one at a time.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      ...STS,
      {
        at: 21,
        where: [0.02, 'Earth orbit'],
        say: [['pilot', 'Houston, docked to the station. The crew aboard has been up for three weeks.', 'go']],
        show: { STATION: ['docked'] },
      },
      {
        at: 26,
        decide: 'wings',
      },
      {
        at: 32,
        when: 'wingsOut',
        say: [
          ['kessler', 'Flight, EECOM: the wings are out and tracking. The station is making her own power now.', 'go'],
        ],
        show: { 'SOLAR WINGS': ['out and tracking', true] },
      },
      {
        at: 40,
        offShift:
          'The handover: the first expedition stays, the ferry crew goes home, and the station keeps flying between visits.',
      },
      { at: 48, retro: true },
    ],
  },

  // ---- Commercial crew and Artemis, 2020-2030 (A10, A11) ----

  // The first crewed flight of a spacecraft a company built: up on a nine-engine launcher, docked to the station in a day.
  'demo-2': {
    program: 'dragon',
    craft: 'Dragon, Demo-2',
    entry: 'orbit',
    completes: 'commercial',
    phases: 4,
    objective: 'fly a company-built spacecraft and its two crew to the station, and bring them home on the water',
    rules: [
      'No launch while thunderstorms stand within ten miles of the pad.',
      'Docking is automatic; the crew takes over only on the system\u2019s own say-so.',
      'Hold at twenty metres: the capsule closes the last stretch only when the station and the capsule\u2019s teams both say go.',
      'Four good parachutes or she does not leave the station.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      {
        at: 0.2,
        phase: 'Launch and Earth orbit',
        where: [0.02, 'Earth orbit'],
        say: [
          ['kessler', 'Flight, EECOM: Dragon is in orbit and SpaceX has her on their loop. Nose cone is open.', 'go'],
        ],
        show: { DRAGON: ['in orbit'], 'NOSE CONE': ['open'] },
      },
      ...STS.slice(1),
      {
        at: 6,
        where: [0.02, 'Earth orbit'],
        say: [
          [
            'pilot',
            'Houston, holding at two hundred metres. I flew her by hand for a few minutes there: she handles like the simulator. Giving her back to the automatics.',
            'go',
          ],
        ],
        show: { DOCKING: ['200 m hold'] },
      },
      {
        at: 6.6,
        if: 'ranging',
        say: [
          [
            'kessler',
            "Flight, EECOM: the capsule's laser ranging dropped out twice on the way in. It came back each time, and the camera solution agrees with it now.",
            'warn',
          ],
        ],
        show: { RANGING: ['dropped out twice', true] },
      },
      {
        at: 7,
        say: [['pilot', 'Houston, holding at twenty metres. Standing by for go.', '']],
        show: { DOCKING: ['20 m hold'] },
      },
      { at: 7.1, decide: 'waypoint' },
      {
        at: 8,
        where: [0.02, 'Earth orbit'],
        say: [['pilot', 'Houston, hard dock. First crew on a new American spacecraft in nine years.', 'go']],
        show: { STATION: ['docked', true] },
      },
      {
        at: 300,
        offShift:
          'Two months aboard: the crew works the station\u2019s science and sleeps in a spacecraft built by a rocket company.',
      },
      {
        at: 900,
        where: [0.02, 'Earth orbit'],
        say: [['pilot', 'Houston, undocked. She flies like the simulator said she would.', 'go']],
      },
      { at: 908, retro: true },
    ],
  },

  // Artemis I, 2022: the big rocket round the Moon with nobody aboard, flown from the same room as Apollo.
  'artemis-1': {
    program: 'apollo',
    craft: 'Artemis I',
    entry: 'lunar',
    completes: 'distantorbit',
    phases: 5,
    objective:
      'send Orion out to a distant orbit round the Moon and back with nobody aboard, and prove the rocket and the heat shield for the crews behind her',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good upper stage and a good spacecraft after one and a half Earth orbits.',
      'The flight plan is set before launch; nobody aboard can change it.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
      'Into the distant orbit only on a service engine that has passed its check; without one, home on the flyby path.',
    ],
    steps: [
      ...SLS,
      ...EARLY,
      {
        at: 2.4,
        if: 'relight',
        say: [
          ['albrecht', "Flight, Booster: the upper stage's restart bottle pressure is low. She may not light.", 'warn'],
        ],
        show: { 'UPPER STAGE': ['bottle pressure low', true] },
      },
      { at: 2.9, phase: 'Translunar injection', where: [0.03, 'Earth orbit'], decide: 'tlii' },
      {
        at: 11,
        lunar: true,
        phase: 'Translunar coast',
        where: [0.3, '120,000 km out'],
        say: [
          ['morgan', 'Flight, Network: Orion is outbound. Nobody aboard but the mannequins and the instruments.', 'go'],
        ],
      },
      {
        at: 120,
        phase: 'The flyby',
        where: [0.97, 'Approaching the Moon'],
        moon: true,
        say: [
          [
            'morgan',
            "Flight, Network: she's behind the Moon, a hundred and thirty kilometres over the far side at closest. The flyby burn is hers. Out of sight for half an hour.",
            'warn',
          ],
        ],
      },
      {
        at: 121,
        moon: true,
        say: [
          [
            'morgan',
            'Flight, Network: we have her. Flyby burn good. She is climbing out toward the distant orbit.',
            'go',
          ],
        ],
      },
      {
        at: 205,
        lunar: true,
        if: 'sps',
        show: { 'SERVICE ENGINE': ['chamber pressure low on the check', true] },
        say: [
          [
            'kessler',
            "Flight, EECOM: the service engine's check firing came up short on chamber pressure. The insertion burn into the distant orbit is hers.",
            'warn',
          ],
        ],
      },
      { at: 205, lunar: true, unless: 'sps', show: { 'SERVICE ENGINE': ['good on the check'] } },
      { at: 216, lunar: true, phase: 'The distant orbit', where: [1, 'Distant retrograde orbit'], decide: 'dro' },
      {
        at: 360,
        lunar: true,
        when: 'inDro',
        say: [
          [
            'morgan',
            'Flight, Network: departure burn good. She is out of the distant orbit, farther from Earth than any spacecraft built for a crew has been.',
            'go',
          ],
        ],
      },
      {
        at: 456,
        lunar: true,
        when: 'inDro',
        where: [0.97, 'Return flyby'],
        say: [
          [
            'morgan',
            'Flight, Network: return flyby burn good, a hundred and thirty kilometres over the Moon again. She is coming home.',
            'go',
          ],
        ],
      },
      { at: 580, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      { at: 600, lunar: true, decide: 'mcc' },
      {
        at: 605,
        say: [
          [
            'tate',
            'Flight, Retro: she skips once off the top of the air and comes back in to steer for the ships. The shield takes it twice.',
            '',
          ],
        ],
      },
      { at: 606, retro: true },
    ],
  },

  // Artemis II: a crew of four round the Moon, the farthest any human has flown since 1972.
  'artemis-2': {
    program: 'apollo',
    craft: 'Artemis II',
    entry: 'lunar',
    completes: 'crewedflyby',
    phases: 5,
    objective:
      'fly a crew of four round the Moon on the free return, farther than anyone has gone since 1972, and home',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good spacecraft after a day of checkout in high Earth orbit.',
      'The free return is the plan; the engine is there to change it, not to rely on.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
      'A heat shield is flown only on an entry its flight evidence covers.',
    ],
    steps: [
      ...SLS,
      ...EARLY,
      {
        at: 2.4,
        if: 'relight',
        say: [
          [
            'albrecht',
            "Flight, Booster: the upper stage's restart bottle pressure is low. Her burn to high orbit may come up short, and Orion will have to make it up.",
            'warn',
          ],
        ],
        show: { 'UPPER STAGE': ['bottle pressure low', true] },
      },
      { at: 25, phase: 'Translunar injection', where: [0.05, 'High Earth orbit'], decide: 'tlio' },
      {
        at: 30,
        lunar: true,
        phase: 'Translunar coast',
        where: [0.3, '120,000 km out'],
        say: [
          [
            'crew2',
            "Houston, we're outbound. From here the Earth is getting smaller and nobody has flown this far in fifty years.",
            'go',
          ],
        ],
      },
      {
        at: 60,
        lunar: true,
        if: 'sps',
        show: { SPS: ['chamber pressure low on the check', true] },
        say: [
          [
            'kessler',
            "Flight, EECOM: the service engine's test firing came up a little short on chamber pressure.",
            'warn',
          ],
        ],
      },
      { lunar: true, at: 60, unless: 'sps', show: { SPS: ['good on the check'] } },
      {
        at: 80,
        phase: 'The flyby',
        where: [0.97, 'Approaching the Moon'],
        moon: true,
        say: [
          [
            'pilot',
            "Houston, we're about to lose you behind the Moon. Six and a half thousand kilometres over the far side. Tell everybody to look up.",
            'warn',
          ],
        ],
      },
      {
        at: 82,
        moon: true,
        say: [
          [
            'crew2',
            "Houston, there it is. The far side, and then the Earth rising over the limb. We'll take pictures the whole way round.",
            'go',
          ],
        ],
      },
      { at: 200, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      {
        at: 210,
        lunar: true,
        if: 'char',
        say: [
          [
            'kessler',
            "Flight, EECOM: for the entry plan, remember Artemis I's shield. It came home with chunks of char gone out of it after the skip, more than any model said. Same shield on this ship.",
            'warn',
          ],
        ],
        show: { 'HEAT SHIELD': ['Artemis I char loss', true] },
      },
      {
        at: 210,
        lunar: true,
        unless: 'char',
        say: [['kessler', "Flight, EECOM: Artemis I's shield came home charred evenly, as the models said.", 'go']],
        show: { 'HEAT SHIELD': ['Artemis I as predicted'] },
      },
      { at: 212, lunar: true, decide: 'entryplan' },
      { at: 228, lunar: true, decide: 'mcc' },
      { at: 234, retro: true },
    ],
  },

  // Artemis III: Orion and the commercial lander meet in Earth orbit, the rehearsal for the landing. NASA's own plan
  // since 2026; the date is the game's.
  'artemis-3': {
    program: 'apollo',
    craft: 'Artemis III',
    entry: 'orbit',
    completes: 'landerdock',
    phases: 4,
    objective:
      'meet the commercial lander in Earth orbit, dock, and check her out with a crew aboard before anyone trusts her at the Moon',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Docking is the lander’s automatic system; the crew takes over only if it drops out.',
      'No crew into the lander until her cabin pressure has held for an hour.',
      'The lander is certified for the Moon only on two clean days of checkout with a crew aboard.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      {
        at: 0.2,
        phase: 'Launch and Earth orbit',
        where: [0.02, 'Earth orbit'],
        say: [
          [
            'kessler',
            'Flight, EECOM: Orion is in orbit. Platform good. The lander is two hundred kilometres ahead.',
            'go',
          ],
        ],
        show: { ORION: ['in orbit'], LANDER: ['ahead, station-keeping'] },
      },
      ...EARLY,
      {
        at: 20,
        phase: 'Rendezvous and docking',
        where: [0.02, 'Earth orbit'],
        say: [
          [
            'pilot',
            "Houston, three hundred metres and closing. The lander's docking sensors have dropped a channel and come back twice.",
            'warn',
          ],
        ],
        show: { DOCKING: ['sensor channel dropping', true] },
      },
      { at: 20.2, decide: 'landerdock' },
      {
        at: 24,
        where: [0.02, 'Earth orbit'],
        not: 'noDock',
        phase: 'Lander checkout',
        say: [
          [
            'crew2',
            "Houston, the hatch is open and we're in the lander. Her cabin held its pressure for the hour. It's big in here.",
            'go',
          ],
        ],
        show: { LANDER: ['docked, crew aboard'] },
      },
      {
        at: 60,
        where: [0.02, 'Earth orbit'],
        not: 'noDock',
        offShift:
          "Two days of tests with the crew aboard the lander: her life support, her suits' connections, and her radios to the ground. Nothing for your team.",
      },
      {
        at: 88,
        where: [0.02, 'Earth orbit'],
        not: 'noDock',
        if: 'landerLeak',
        say: [
          [
            'kessler',
            "Flight, EECOM: the lander's cabin lost a tenth of a psi overnight with the hatch closed. The company can't find where it went.",
            'warn',
          ],
        ],
        show: { LANDER: ['slow leak, cause unknown', true] },
      },
      { at: 90, not: 'noDock', decide: 'certify' },
      {
        at: 96,
        where: [0.02, 'Earth orbit'],
        say: [['pilot', "Houston, undocked and backing away. She'll do.", 'go']],
      },
      { at: 100, retro: true },
    ],
  },
  // Artemis IV: the return to the Moon, at the south pole, in the build's last year.
  'artemis-4': {
    program: 'apollo',
    craft: 'Artemis IV',
    entry: 'lunar',
    completes: 'landing',
    phases: 9,
    objective: 'land at the south pole of the Moon, the first landing in more than fifty years, and bring them home',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good spacecraft after a day of checkout in high Earth orbit.',
      'No lunar orbit insertion without a service engine that has passed its checks: without it there is no way home.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
      'In the descent, abort on any computer alarm that stops the computer flying the lander.',
      'The rover never goes farther than the crew can walk back on what is left in their suits.',
    ],
    steps: [
      ...SLS,
      ...EARLY,
      {
        at: 2.4,
        if: 'relight',
        say: [
          [
            'albrecht',
            "Flight, Booster: the upper stage's restart bottle pressure is low. Her burn to high orbit may come up short, and Orion will have to make it up.",
            'warn',
          ],
        ],
        show: { 'UPPER STAGE': ['bottle pressure low', true] },
      },
      { at: 25, phase: 'Translunar injection', where: [0.05, 'High Earth orbit'], decide: 'tlio' },
      {
        at: 30,
        lunar: true,
        phase: 'Translunar coast',
        where: [0.3, '120,000 km out'],
        say: [
          [
            'crew2',
            "Houston, we're outbound. The lander went up ahead of us and is waiting for us round the Moon.",
            'go',
          ],
        ],
        show: { LANDER: ['waiting in lunar orbit'] },
      },
      ...TANK,
      {
        lunar: true,
        at: 60,
        if: 'sps',
        show: { SPS: ['chamber pressure low on the check', true] },
        say: [
          [
            'kessler',
            "Flight, EECOM: the service engine's test firing came up a little short on chamber pressure.",
            'warn',
          ],
        ],
      },
      { lunar: true, at: 60, unless: 'sps', show: { SPS: ['good on the check'] } },
      { at: 80, phase: 'Lunar orbit insertion', where: [0.97, 'Approaching the Moon'], moon: true, decide: 'loi' },
      {
        at: 102,
        moon: true,
        where: [1, 'Lunar orbit'],
        set: { lmFlown: true },
        say: [
          [
            'pilot',
            "Houston, we're docked to the lander, and two of us are aboard her. Undocking now. She's flying.",
            'go',
          ],
        ],
        show: { LANDER: ['undocked, two aboard'] },
      },
      {
        at: 105,
        phase: 'Powered descent',
        moon: true,
        say: [['kessler', "Flight, the descent engine has lit. She's coming down over the Shackleton rim.", 'go']],
        show: { 'LANDER COMPUTER': ['flying the descent'] },
      },
      {
        at: 105.03,
        moon: true,
        if: 'alarm',
        say: [['pilot', 'Houston, program alarm. 1202.', 'bad']],
        show: { 'LM COMPUTER': ['1202 alarms', true] },
      },
      { at: 105.05, moon: true, if: 'alarm', decide: 'alarm' },
      {
        at: 105.2,
        moon: true,
        not: 'noLanding',
        set: { landed: true },
        say: [
          [
            'pilot',
            "Contact. Houston, we're down near the pole, on the rim of Shackleton. The Sun never sets here, and there's ice in the dark over the crater wall.",
            'go',
          ],
        ],
      },
      {
        at: 107,
        phase: 'On the surface',
        moon: true,
        when: 'landed',
        where: [1, 'On the Moon'],
        offShift:
          'Six days at the pole: the drill into the permanently shadowed soil, and the first humans at the south pole of the Moon. Nothing for your team.',
      },
      {
        at: 140,
        moon: true,
        when: 'landed',
        say: [
          [
            'pilot',
            "Houston, we're three kilometres out at the crater wall, and the drill has ice in its first metre. I want twenty more minutes before we turn.",
            'warn',
          ],
        ],
        show: { 'WALK LIMIT': ['reached', true] },
      },
      { at: 140.1, moon: true, when: 'landed', decide: 'traverse' },
      ...ASCENT(
        166,
        "Houston, we're docked to Orion. Two tired moonwalkers coming through the hatch, and a box of polar ice.",
      ),
      {
        at: 218,
        phase: 'Trans-Earth injection',
        where: [0.97, 'Behind the Moon'],
        moon: true,
        say: [
          [
            'morgan',
            "Flight, Network: she's behind the Moon. Trans-Earth injection is out of our sight. Waiting for acquisition.",
            'warn',
          ],
        ],
      },
      {
        at: 218.3,
        moon: true,
        when: 'stranded',
        say: [
          ['morgan', "Flight, Network: we have her, and she's still in lunar orbit. The engine did not burn.", 'bad'],
        ],
      },
      {
        at: 218.4,
        moon: true,
        not: 'stranded',
        say: [['crew2', "Houston, the engine burned on time. We're coming home.", 'go']],
      },
      { at: 254, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      { at: 282, lunar: true, decide: 'mcc' },
      { at: 288, retro: true },
    ],
  },
};

// The questions, the options for each, who owns the call (the flight director unless said otherwise) and what the
// flight director on the other shift does when the call is not yours (auto, the historical choice).
// rule: the mission rule the call is made against, if there is one.
// A question's fields: q, the options, auto (what the other shift or the programme picks), rule (the flight's mission
// rule it touches), owner (whose seat answers it; none is the flight director's). rec: [who, line, option] when a
// console owns the substance and recommends: the flight director concurs or overrules. advise: the decision is the
// programme's or the management team's; the flight director recommends, and they decide on how far they trust Flight.
export const DECISIONS = {
  eva: {
    q: 'The spacewalk. The pilot is suited and the cabin is ready to depressurise. Go?',
    auto: 'go',
    rule: 1,
    options: {
      go: 'Go for the spacewalk now.',
      delay: 'Hold it one orbit: rest, and work the hatch again before he opens it.',
      cancel: 'Cancel the spacewalk.',
    },
  },
  computer: {
    q: 'The guidance computer will not come up. Without it there is no guided entry.',
    auto: 'ballistic',
    owner: 'engineer',
    rule: 2,
    options: {
      ballistic: 'Fly a rolling entry, Mercury style. She lands where she lands.',
      retry: 'Have them work the computer for another orbit and try again.',
    },
  },
  fuelcell1: {
    q: "The fuel cells' oxygen pressure is falling, but it is still above the minimum. The mission rule keeps her up on the cells until it goes below.",
    auto: 'drift',
    owner: 'engineer',
    rule: 1,
    options: {
      drift:
        'Follow the rule: power down to minimum load and stay up. Come home if the pressure goes below the minimum.',
      home: 'Play it safe: come home at the next good area now, before the rule calls for it.',
    },
  },
  fuelcell2: {
    q: 'The pressure held under minimum load, but the rendezvous objective is gone. Keep the duration test or take the next recovery area?',
    auto: 'eight',
    rule: 2,
    options: { eight: 'Go for the full eight days, powered down.', home: 'Come home at the next good area.' },
  },
  rdvplan: {
    rec: [
      'morgan',
      "Flight, FIDO: the spacecraft's radar has a solid lock. The ground solution is still provisional. Recommend the onboard solution.",
      'onboard',
    ],
    q: 'Gemini 7 is on radar. Which tracking solution are we using for the intercept?',
    auto: 'onboard',
    rule: 1,
    options: { onboard: "Fly it from the spacecraft's radar and computer.", ground: "Fly the ground's solution." },
  },
  tumble: {
    q: 'The crew has stopped the tumble with the re-entry thrusters. The rule says come home at the next area they can reach: the western Pacific, one destroyer, tonight. The primary area is a day away.',
    auto: 'secondary',
    rule: 1,
    options: {
      secondary: 'Bring them down in the Pacific tonight, on the rule.',
      primary: 'Hold them up a day for the primary area and the carrier.',
    },
  },
  evaplan: {
    advise: true,
    q: "The spacewalk. After Gemini 9A's exhausted spacewalker, the plan can be paced: handholds, foot restraints and a rest after every task. Or fly the full task list, as Gemini 9A tried.",
    auto: 'rest',
    rule: 1,
    options: {
      rest: 'Pace it: the restraints and a rest after every task.',
      full: 'Fly the full task list.',
      standup: 'A stand-up spacewalk only, from the hatch.',
    },
  },
  sps6: {
    q: "The third stage will not restart. The service module's engine could push her up for the high-speed entry test, though it was never meant to do the job.",
    auto: 'sps',
    options: {
      sps: "Burn the service module's engine for the entry test.",
      stay: 'Bring her home from Earth orbit. No high-speed test.',
    },
  },
  pogo: {
    q: "The programme's call, before the spacecraft is even home: is the Saturn V ready for a crew on the next flight, or do we fly a third one empty?",
    auto: 'crew',
    owner: 'programme',
    rule: 2,
    options: {
      crew: 'Fix what this flight found, and put a crew on the next one.',
      third: 'Fly a third Saturn V without a crew. Two months.',
    },
  },
  tli: {
    rec: [
      'morgan',
      'Flight, FIDO: the trajectory is good, Booster and the spacecraft consoles are go. Recommend go for TLI.',
      'go',
    ],
    q: 'Translunar injection. The third stage relights over the Pacific and sends them to the Moon. Go or no-go?',
    auto: 'go',
    rule: 1,
    options: { go: 'Go for translunar injection.', nogo: 'No-go. Stay in Earth orbit and test the spacecraft there.' },
  },
  tlii: {
    rec: [
      'morgan',
      'Flight, the management team has polled go for TLI. FIDO and Booster are go. Your go, Flight.',
      'go',
    ],
    q: 'Translunar injection. The upper stage relights over the Pacific and sends Orion to the Moon. Go or no-go?',
    auto: 'go',
    rule: 1,
    options: {
      go: 'Go for translunar injection.',
      nogo: 'No-go. Keep her in Earth orbit and test the spacecraft there.',
    },
  },
  tlio: {
    rec: [
      'morgan',
      'Flight, the management team has polled go for TLI. FIDO and the propulsion console are go. Your go, Flight.',
      'go',
    ],
    q: "Translunar injection. After a day's checkout in high Earth orbit, Orion's own engine burns for six minutes and sends them to the Moon. Go or no-go?",
    auto: 'go',
    rule: 1,
    options: { go: 'Go for translunar injection.', nogo: 'No-go. Stay in Earth orbit and test the spacecraft there.' },
  },
  landerdock: {
    rec: [
      'morgan',
      "Flight, Rendezvous: the lander's team want an orbit to reset the sensors. Recommend we back off.",
      'reset',
    ],
    q: "The lander's docking sensors keep dropping a channel at three hundred metres. Let the automatic system fly it in, have the commander take over and fly it in by hand, or back off an orbit while the lander's team resets the sensors?",
    auto: 'reset',
    rule: 1,
    options: {
      auto: 'Let the automatics fly it in.',
      manual: 'The commander flies it in by hand.',
      reset: 'Back off an orbit and reset the sensors.',
    },
  },
  loi: {
    rec: ['tate', 'Flight, Retro: the burn pad is up to them. Every console is go. Recommend go for LOI.', 'go'],
    q: 'Lunar orbit insertion. The service engine burns behind the Moon, out of contact. If it does not burn they swing round and come home on their own. If it burns and will not burn again, they never come home. Go?',
    auto: 'go',
    rule: 2,
    options: {
      go: 'Go for lunar orbit insertion.',
      nogo: 'No-go. Let her swing round the Moon and come home on the free return.',
    },
  },
  mcc: {
    q: 'The last midcourse correction before entry. Tracking has the entry angle on the board. Burn to trim it, or leave it?',
    auto: 'burn',
    rule: 3,
    // The board lines the call is judged on, drawn with the call itself (issue: the angle was off the wall board's four).
    board: ['ENTRY ANGLE', 'CORRIDOR'],
    options: { burn: 'Burn the midcourse correction.', skip: 'Leave it. Save the propellant.' },
  },
  tank: {
    q: "An oxygen tank has failed. The service module is dying. The lander has power, oxygen and an engine. Bring them home: the service engine now, straight back, or the lander's engine and the long way round the Moon?",
    auto: 'freereturn',
    options: {
      freereturn: 'Power down the command module. The lander is the lifeboat: round the Moon and home.',
      direct: 'Burn the service engine now for a direct abort, before the Moon.',
    },
  },
  pc2: {
    rec: [
      'tate',
      'Flight, Retro: three ways home on the board. Retro recommends the Pacific burn: the ships are there and it keeps the service module on for the heat shield.',
      'pacific',
    ],
    q: "Two hours past the Moon. Retro has three ways home. A long descent-engine burn brings them in at about 142 hours in the Pacific, where the ships are. A longer one, after dropping the service module, brings them in at 133, in the Indian Ocean, with the heat shield out in the cold the whole way. Or no burn: entry at 152, past the lander's batteries.",
    auto: 'pacific',
    rule: 5,
    options: {
      pacific: 'The burn for the Pacific, at about 142 hours.',
      fast: 'Drop the service module and burn for the fastest way home.',
      none: 'No burn. Save the descent engine and stretch the power.',
    },
  },
  co2: {
    rec: [
      'kessler',
      "Flight, EECOM: Crew Systems have built the adapter on the bench and it works. Recommend we read it up now, while they're fresh.",
      'build',
    ],
    q: "The lander's carbon dioxide is climbing. The ground has a way to fit the command module's square canisters to the lander's hoses with hose, cardboard, a plastic bag and tape. Read it up to them now, or wait and see how fast it climbs?",
    auto: 'build',
    options: { build: 'Read up the procedure. Build it now.', wait: 'Wait. Watch the gauge another few hours.' },
  },
  lowpass: {
    q: 'The low pass. The lander undocks and goes down to fifteen kilometres over the landing site, then climbs back. Go?',
    auto: 'go',
    rule: 4,
    options: { go: 'Go for the low pass.', skip: 'Keep the lander docked. No low pass.' },
  },
  lightning: {
    q: 'Lightning struck her on the way up. The spacecraft is running, but nobody can tell whether the parachute pyros survived, and there is no way to check them from orbit. Go on to the Moon, or bring her home from Earth orbit?',
    auto: 'go',
    options: {
      go: 'Go on. If the pyros are dead, they are dead in Earth orbit too.',
      stay: 'Stay in Earth orbit and bring her home.',
    },
  },
  smoke: {
    q: 'A smell of burning insulation in the cabin, and no smoke. The cabin is pure oxygen at five psi. Press on, with the suspect bus off line, or come home from Earth orbit?',
    auto: 'press',
    options: { press: 'Take the bus off line and press on.', home: 'Bring her home from Earth orbit, now.' },
  },
  alarm: {
    rec: [
      'morgan',
      "Flight, Guidance: twelve-oh-two. The back room says if it doesn't recur too often we're go. Recommend go.",
      'go',
    ],
    q: "Program alarms in the descent: the lander's computer is overloaded and restarting. Guidance has a second to say go or abort.",
    auto: 'go',
    owner: 'flight',
    rule: 4,
    options: {
      go: 'Go. If the computer is still flying her, we are go on that alarm.',
      abort: 'Abort. Stage and climb back to the command module.',
    },
  },
  lowfuel: {
    q: 'The commander is flying her long over boulders, looking for a place. Bingo fuel is coming. Let him fly, or call the abort?',
    auto: 'land',
    rule: 5,
    options: { land: 'Let him fly. Call out the seconds.', abort: 'Call the abort at bingo.' },
  },
  landpoint: {
    q: "The tracking says the lander will come down four thousand two hundred feet short of the target. FIDO has a correction for the lander's computer: CAPCOM can voice it up now for the crew to key in, or the commander can fly it out by eye at the end.",
    auto: 'update',
    options: { update: "Go on FIDO's correction: voice it up.", eye: 'Leave it. He flies it by eye at the end.' },
  },
  rescue: {
    q: 'The lander is in a low orbit with her ascent engine spent. The command module can come down and get her, using most of its own margin. Or the lander can climb on her small thrusters, all she has left. Or wait an orbit for a better phase.',
    auto: 'csm',
    options: {
      csm: 'The command module goes down and gets her.',
      lmburn: 'The lander climbs on her own thrusters.',
      wait: 'Wait an orbit and plan it properly.',
    },
  },
  spsbank: {
    rec: [
      'kessler',
      "Flight, EECOM: the short is in bank A's thrust switch only. Recommend every burn on bank B, bank A by hand once she's lit.",
      'bankb',
    ],
    q: "A short in the service engine's thrust switch, bank A. EECOM's plan: fly every burn on bank B, with bank A switched on by hand only after the engine has lit. Or bring them home now, before the Moon.",
    auto: 'bankb',
    rule: 2,
    options: { bankb: 'Fly the burns on bank B, bank A by hand.', home: 'Bring them home on the free return.' },
  },
  traverse: {
    q: 'The rover is at the walkback limit, five kilometres from the lander. The geologist wants twenty more minutes at the white rock. The rule says turn back now.',
    auto: 'turn',
    rule: 5,
    options: { turn: 'Turn back now. Bag what you can reach.', stay: 'Give him twenty minutes.' },
  },
  navcheck: {
    q: "Retrofire is next. Retro has the landing-point numbers ready for the spacecraft's computer. An independent check costs a revolution: retrofire one orbit later, into the secondary area with one destroyer.",
    auto: 'send',
    owner: 'retro',
    options: { send: 'Send the numbers now.', check: 'Have the back room check them first.' },
  },
  throttle: {
    q: "The descent engine's throttle is fluttering through the low gate. Press the descent, or abort to lunar orbit and have the command module pilot inspect her?",
    auto: 'descend',
    rule: 6,
    options: {
      descend: 'Press on. The flutter was steady in the checkout and she is holding.',
      abort: 'Abort the descent. Go around once and inspect the lander from the command module.',
    },
  },
  ascentEarly: {
    q: "The ascent engine's chamber pressure came up low on the checkout. Fly the climb early, or hold the planned hour and check her again?",
    auto: 'early',
    rule: 7,
    options: {
      early: 'Fly the ascent early, as soon as the crew is buttoned up.',
      hold: 'Hold the planned hour and run the checks again.',
    },
  },
  parasol: {
    rec: [
      'kessler',
      'Flight, the parasol is built and checked in the tank at Houston. The programme has picked it. Recommend we give the crew the go to deploy.',
      'parasol',
    ],
    q: 'The workshop has lost her shield and the temperatures inside are climbing. The parasol shade is made up on the ground: send it up with the crew tomorrow, and deploy it through the solar airlock?',
    auto: 'parasol',
    rule: 2,
    options: {
      parasol: 'Deploy the parasol through the solar airlock, and let the workshop cool.',
      standby: 'Hold off. Let the crew work from inside and re-ask the question at the end of the week.',
    },
  },
  panel: {
    advise: true,
    q: 'One solar wing is jammed shut against the hull. Send a spacewalker up to cut her free?',
    auto: 'free',
    rule: 3,
    options: {
      free: 'Fly the EVA and cut the wing free: stand-off foot restraints, cable cutters, the long way round.',
      leave: 'Leave her folded. The workshop runs on one wing, and the EVA day goes to experiments.',
    },
  },
  quad: {
    rec: [
      'albrecht',
      'Flight, Propulsion: the leak rate is slow and the other quads are healthy. Recommend we stay up and watch it.',
      'stay',
    ],
    q: 'A service-module thruster quad is leaking. Hold the fifty-nine days, or come home early?',
    auto: 'stay',
    rule: 2,
    options: {
      stay: 'Stay the full fifty-nine days, with the quad watched hour by hour.',
      home: 'Come home early. The workshop keeps; the science schedule does not.',
    },
  },
  pace: {
    q: 'The crew says the timeline is written for men who do not sleep, and they are falling behind by noon every day. Give them a quiet day to reset it, or hold the schedule?',
    auto: 'quiet',
    rule: 2,
    options: {
      quiet: 'Give them one quiet day, and rebuild the timeline from what they actually do.',
      hold: 'Hold the schedule. The work is the work.',
    },
  },
  align: {
    rec: [
      'morgan',
      'Flight, FIDO: she is off her line by more than the docking limit. Recommend they stop at a hundred and fifty metres and realign.',
      'stop',
    ],
    q: 'The Soyuz is off her attitude line for the docking. Stop at a hundred and fifty metres and realign, or press?',
    auto: 'stop',
    rule: 1,
    options: {
      stop: 'Stop at a hundred and fifty metres. Wait for them to realign, then close the last metres slowly.',
      press: 'Press. The closing rate is small and the probes can take it.',
    },
  },
  tiles: {
    rec: [
      'kessler',
      'Flight, MMACS: we cannot clear the belly from the ascent film. Recommend the OMS burn and a look before entry.',
      'inspect',
    ],
    q: 'The belly took a foam hit from the tank\u2019s ramp. Burn the OMS to look her over, or trust the design and fly her home as planned?',
    auto: 'inspect',
    rule: 2,
    options: {
      inspect: 'Burn the OMS and tip her belly to the cameras. Look her over before entry.',
      trust: 'Trust the design. She was built with this tank, and the schedule holds.',
    },
  },
  tald: {
    q: 'She is coming home. Primary is the lakebed at Edwards: long, flat, and far from home port. The Cape\u2019s runway is shorter. Which do you fly?',
    auto: 'edwards',
    rule: 0,
    options: {
      edwards: 'The lakebed at Edwards. The long, sure way down.',
      cape: "The Cape's runway. Home in one hop, with less margin.",
    },
  },
  waypoint: {
    rec: [
      'morgan',
      "Flight, SpaceX reports Dragon's sensors and approach are nominal at the waypoint. NASA's consoles concur. Recommend go.",
      'go',
    ],
    q: 'Dragon is holding at twenty metres, the last go/no-go before she touches the station. Go for the final approach on the automatics, or back her out to two hundred metres for the capsule\u2019s team to look again?',
    auto: 'go',
    rule: 2,
    options: {
      go: 'Go for the final approach.',
      back: 'Back her out to two hundred metres and run the sensors again. An orbit late.',
    },
  },
  tdrs: {
    q: 'Six hours in, and the relay satellite is due out of the bay: the first deploy since Challenger. The cabin is hot. Deploy on the timeline, or spend an orbit on the cooling first?',
    auto: 'deploy',
    rule: 1,
    options: {
      deploy: 'Deploy on the timeline. The crew has trained for it hot and cold.',
      cool: 'Point her tail at the Sun, thaw the evaporator, and deploy an orbit late.',
    },
  },
  quad2: {
    advise: true,
    q: 'A second quad is leaking. Two good quads are enough to fly home on, with nothing spare. Roll the rescue Apollo out to the pad as a standby, bring them home now, or carry on without one?',
    auto: 'standby',
    rule: 3,
    options: {
      standby: 'Roll the rescue ship out as a standby. The crew stays aboard and works.',
      home: 'Bring them home now, on the two good quads.',
      press: 'Carry on without a rescue ship. Watch the quads.',
    },
  },
  array: {
    q: 'An old solar array will not roll up for the trip home. Let it go from the arm, or have the spacewalkers try to roll it by hand?',
    auto: 'jettison',
    rule: 2,
    options: {
      jettison: 'Release it from the arm and let it drift off. Keep the day for the optics.',
      roll: 'Have them try to roll it by hand and bring it home for the engineers.',
    },
  },
  certify: {
    advise: true,
    q: 'Two days of checkout with a crew aboard the lander. Certify her for the landing on Artemis IV, or ask for another test first?',
    auto: 'certify',
    rule: 3,
    options: {
      certify: 'Certify her for the Moon.',
      retest: 'Not yet. Find and fix anything open, then test again.',
    },
  },
  dro: {
    rec: [
      'morgan',
      'Flight, the management team is go for the distant orbit. FIDO has the burn ready. Your go, Flight.',
      'go',
    ],
    q: 'Insertion into the distant retrograde orbit: the service engine burns her into a wide orbit round the Moon for a week, then burns her out again. Go, or skip it and come home on the flyby path?',
    auto: 'go',
    rule: 4,
    options: {
      go: 'Go for the distant orbit.',
      skip: 'Skip it. Home on the flyby path, ten days early.',
    },
  },
  entryplan: {
    advise: true,
    q: "The entry. The plan is Artemis I's long skip: off the top of the air and back in, steering for the ships. The review offers a shorter, steeper entry that keeps the shield hot for less time and lands her nearer the coast. Which does she fly?",
    auto: 'loft',
    rule: 4,
    options: {
      skip: "Fly Artemis I's long skip entry, as planned.",
      loft: 'Fly the shorter, steeper entry the review drew up.',
    },
  },
  hubbledeploy: {
    q: 'The second solar array has stalled part way out. Have the ground command it on with the tension monitor overridden, send the spacewalkers out to crank it by hand, or release the telescope as she is?',
    auto: 'override',
    rule: 1,
    options: {
      override: 'Override the tension monitor from the ground and drive the array out.',
      eva: 'Send the spacewalkers out to crank it by hand.',
      release: 'Release her as she is. The telescope teams can work the array from the ground later.',
    },
  },
  hubblefix: {
    advise: true,
    q: 'The telescope is on the arm and the corrective optics are in the bay. Install them, or bring her home for the ground to decide?',
    auto: 'install',
    rule: 1,
    options: {
      install: 'Install the corrective optics on the spacewalks, as rehearsed in the pool.',
      abort: 'Bring her home with the telescope unfixed. The ground will decide what next.',
    },
  },
  berth: {
    advise: true,
    q: 'The module is drifting free and unpowered. Grab her with the arm now, or let her coast and dock the old way?',
    auto: 'arm',
    rule: 1,
    options: {
      arm: 'Take her on the arm at a walking pace, and berth her gently.',
      dock: 'Close and dock directly. It is how every other docking has been done.',
    },
  },
  wings: {
    q: 'The solar wings are folded in the bay. Deploy both in today\u2019s sunlight, or hold the second for tomorrow\u2019s pass?',
    auto: 'both',
    rule: 1,
    options: {
      both: 'Both wings out today, one at a time, in the sunlight.',
      one: 'One wing today. Hold the second for tomorrow, and check her overnight.',
    },
  },
};

// What each flight can show, when it is shown: scoped capability evidence that later plans can cite. It never certifies
// other hardware.
export const CAPABILITIES = {
  reusable: 'A winged spacecraft flown to orbit and landed on a runway, ready to fly again',
  hubble: 'A telescope in orbit repaired by hand, and seeing clearly again',
  station: 'Two modules of a space station joined in orbit, hatched together',
  workshop: 'Weeks aboard a workshop in orbit: work, sleep, exercise and science on a station',
  intl: "A docking and a joint flight flown with another nation's crew",
  eva: 'A spacewalk from Gemini, outside the cabin on an umbilical',
  duration: 'Eight days in orbit in Gemini, the length of a lunar trip',
  fourdays: 'Four days in orbit in Gemini',
  rendezvous: 'A rendezvous in orbit, Gemini 6A with Gemini 7, closing to a foot',
  docking: 'A docking in orbit, Gemini 8 with an Agena target',
  landerdock: 'Orion docked to a commercial lander in Earth orbit, and a crew checked her out',
  threedays: 'Three days of docked work with an Agena',
  lunarentry: 'An entry at the speed of a return from the Moon, Apollo command module heat shield',
  csmorbit: 'Ten days in Earth orbit in the Apollo command and service module',
  lunarorbit: 'Ten orbits of the Moon and home: navigation to the Moon and back',
  crewedflyby: 'A crew of four round the far side of the Moon and home, the farthest anyone has flown since 1972',
  distantorbit: 'Orion out to a distant orbit round the Moon for a week, and home through a skip entry',
  rehearsal: 'A lander down to fifteen kilometres over the landing site and back to the command module',
  landing: 'Two men landed on the Moon, walked on it, and flew back to the command module',
  pinpoint: 'A landing within walking distance of a chosen point on the Moon',
  rover: 'Three days on the Moon and twenty-eight kilometres of driving on the lunar rover',
  evawork: 'Two hours of useful work outside, paced, with handholds and foot restraints',
};
