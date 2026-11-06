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
  { at: 0.25, if: 'lightning', say: [['kessler', 'Flight, EECOM: the buses are back since SCE to AUX, all three fuel cells on line. But the platform tumbled and we can\'t see the parachute pyros from here. They took the strike too.', 'warn']], note: 'Lightning struck the Saturn V twice on the climb. The spacecraft\'s fuel cells dropped off line until EECOM had the crew switch the signal conditioning to its auxiliary supply. Nobody could tell from the ground whether the parachutes\' pyrotechnics survived.', show: { 'PYRO BUSES': ['not known', true] } },
  { at: 0.3, if: 'lightning', decide: 'lightning' },
  { at: 1.5, if: 'cabin', say: [['pilot', 'Houston, we\'ve got a smell of burning insulation down in the lower equipment bay. No smoke we can see.', 'warn']], show: { 'CABIN': ['burning smell', true] } },
  { at: 1.6, if: 'cabin', decide: 'smoke' },
];
// The oxygen tank, on the way out, on any flight that carries a lander.
const TANK = [
  { lunar: true, at: 55.9, if: 'tank', where: [0.85, '320,000 km out'], say: [['crew2', 'Houston, we\'ve had a problem. Main B bus undervolt, and we\'re venting something.', 'bad']], note: 'At about 56 hours oxygen tank two in the service module failed. The spacecraft lost two of its three fuel cells and was venting its oxygen into space.', show: { 'O2 TANK 2': ['zero', true], 'FUEL CELLS': ['one of three', true] } },
  { lunar: true, at: 56.2, if: 'tank', decide: 'tank' },
];
// The lander's climb back to the command module, from the surface or from an abort in the descent. A weak ascent engine
// leaves her low, and somebody has to close the gap.
const ASCENT = at => [
  { at, phase: 'Ascent and rendezvous', moon: true, when: 'lmFlown', say: [['pilot', 'Houston, the ascent engine\'s lit. We\'re climbing.', 'go']], show: { 'ASCENT ENGINE': ['burning'] } },
  { at: at + 0.15, moon: true, when: 'lmFlown', if: 'ascent', say: [['kessler', 'Flight, the ascent engine\'s chamber pressure came up low all the way. She\'s in orbit, but low: fifteen by forty kilometres, well under the command module.', 'bad']], show: { 'ASCENT ENGINE': ['chamber pressure low', true], 'LM ORBIT': ['15 by 40 km', true] } },
  { at: at + 0.2, moon: true, when: 'lmFlown', if: 'ascent', decide: 'rescue' },
  { at: at + 3.5, moon: true, when: 'lmFlown', not: 'lmLost', say: [['crew2', 'Houston, we\'re docked. Two tired men coming through the tunnel.', 'go']], show: { LM: ['docked'] } },
];
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
  // Gemini 12, the last: what a man can really do outside.
  'gem-12': {
    program: 'gemini', craft: 'Gemini 12', entry: 'gemini', completes: null, objective: 'to show that a man can do useful work outside a spacecraft without wearing himself out',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Stop the spacewalk if the suit cannot keep up with the man in it: a fogged visor or a heart rate held over 160.',
      'Every task outside is rehearsed underwater first.',
    ],
    steps: [
      { at: 0.3, phase: 'Earth orbit', say: [['kessler', 'Flight, EECOM: platform good, the Agena is up and waiting.', 'go']], show: { AGENA: ['good orbit'], 'HANDHOLDS AND RESTRAINTS': ['fitted'] } },
      { at: 4.2, phase: 'Docked', say: [['pilot', 'Houston, docked with the Agena. The radar quit on us; we did it on the charts.', 'go']] },
      { at: 18.5, phase: 'The spacewalk', decide: 'evaplan' },
      { at: 50, offShift: 'Experiments, photography and a stand-up spacewalk. Nothing for your team.' },
      { at: 93, decide: 'navcheck' },
      { at: 94, retro: true },
    ],
  },
  // Apollo 6, the second Saturn V, flown without a crew: the last test before men ride it.
  'apollo-6': {
    program: 'apollo', craft: 'Apollo 6', entry: 'lunar', completes: 'lunarentry', phases: 3, objective: 'the Saturn V\'s second flight, with no crew: a restart of the third stage and an entry at the speed of a return from the Moon',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'If the third stage will not restart, the service module\'s engine may fly the high-speed entry test instead.',
      'No crew rides a Saturn V until every failure on this flight is understood.',
    ],
    steps: [
      { at: 0.04, phase: 'Launch', where: [0.02, 'Climbing'], say: [['albrecht', 'Flight, Booster: the Saturn\'s tapes from the climb are in.', '']] },
      { at: 0.05, if: 'pogo', say: [['albrecht', 'Flight, Booster: the first stage is shaking. Pogo, plus or minus ten g at the top of the stack. Something came off the adapter.', 'bad']], note: 'Two minutes into the climb the first stage set the stack shaking end to end, pogo, at about five cycles a second. Panels came off the lander adapter.', show: { POGO: ['severe', true] } },
      { at: 0.06, if: 'j2', say: [['albrecht', 'Flight, Booster: two J-2s out on the second stage. The other three are burning long to make it up.', 'bad']], note: 'Two of the second stage\'s five engines shut down early. The rest burned longer and the third stage made up the difference.', show: { 'SECOND STAGE': ['two engines out', true] } },
      { at: 3.0, if: 'relight', say: [['albrecht', 'Flight, Booster: no restart. The third stage will not relight.', 'bad']], show: { 'S-IVB RESTART': ['failed', true] } },
      { at: 3.1, if: 'relight', decide: 'sps6' },
      { at: 2.9, phase: 'Earth orbit', where: [0.04, 'Earth orbit'], say: [['albrecht', 'Flight, Booster: coming up on the third-stage restart.', '']] },
      { at: 3.0, unless: 'relight', say: [['albrecht', 'Flight, Booster: good restart on the third stage. She\'s climbing to twenty-two thousand kilometres.', 'go']], show: { 'S-IVB RESTART': ['good'] } },
      { at: 9.5, phase: 'Entry', where: [0.03, 'Falling back'], decide: 'pogo' },
      { at: 9.8, retro: true },
    ],
  },
  // Apollo 8: round the Moon at Christmas, 1968, if the August meeting sends it.
  'apollo-8': {
    program: 'apollo', craft: 'Apollo 8', entry: 'lunar', completes: 'lunarorbit', phases: 7, objective: 'ten orbits of the Moon and home: the first men to leave the Earth',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good third stage and a good spacecraft after one and a half Earth orbits.',
      'No lunar orbit insertion without a service engine that has passed its checks: without it there is no way home.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
    ],
    steps: [
      { at: 0.3, phase: 'Launch and Earth orbit', where: [0.02, 'Earth orbit'], say: [['kessler', 'Flight, EECOM: spacecraft is good. Platform good.', 'go']], show: { 'S-IVB': ['safed for restart'], SPS: ['not yet fired'] } },
      { at: 2.4, if: 'relight', say: [['albrecht', 'Flight, Booster: the S-IVB\'s restart bottle pressure is low. She may not light.', 'warn']], show: { 'S-IVB': ['bottle pressure low', true] } },
      { at: 2.5, phase: 'Translunar injection', where: [0.03, 'Earth orbit'], decide: 'tli' },
      { at: 11, lunar: true, phase: 'Translunar coast', where: [0.3, '120,000 km out'], say: [['crew2', 'Houston, we can see the whole Earth now, out of the centre window.', 'go']] },
      { lunar: true, at: 30, where: [0.6, '240,000 km out'], offShift: 'Midcourse correction one, navigation sightings, and a crew sick for the first day. Nothing for your team.' },
      { lunar: true, at: 60, if: 'sps', show: { SPS: ['chamber pressure low on the check', true] }, say: [['kessler', 'Flight, EECOM: the service engine\'s test firing came up a little short on chamber pressure.', 'warn']] },
      { lunar: true, at: 60, unless: 'sps', show: { SPS: ['good on the check'] } },
      { at: 66, phase: 'Lunar orbit insertion', where: [0.97, 'Approaching the Moon'], moon: true, decide: 'loi' },
      { at: 69.2, phase: 'In lunar orbit', where: [1, 'Lunar orbit'], moon: true, say: [['crew2', 'The Moon is essentially grey, no colour. Like plaster of Paris.', '']] },
      { at: 75, moon: true, offShift: 'Ten orbits of the Moon, photographs of the landing sites, and on Christmas Eve the crew read from Genesis to half the world. Nothing for your team.' },
      { at: 89, phase: 'Trans-Earth injection', where: [0.97, 'Behind the Moon'], moon: true, say: [['morgan', 'Flight, Network: she\'s behind the Moon. Trans-Earth injection is out of our sight. Waiting for acquisition.', 'warn']] },
      { at: 89.3, moon: true, when: 'stranded', say: [['morgan', 'Flight, Network: no acquisition. She should have come round two minutes ago… We have her. She\'s still in lunar orbit. The engine did not burn.', 'bad']] },
      { at: 89.4, moon: true, not: 'stranded', say: [['pilot', 'Houston, please be informed there is a Santa Claus.', 'go']] },
      { at: 120, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      { at: 140, lunar: true, decide: 'mcc' },
      { at: 146.9, retro: true },
    ],
  },
  // Apollo 8 if the August meeting keeps it in Earth orbit: ten days testing the spacecraft, as Apollo 7 had.
  'apollo-8e': {
    program: 'apollo', craft: 'Apollo 8', entry: 'gemini', completes: 'csmorbit', phases: 2, objective: 'ten days in Earth orbit, testing the command and service module before the lander is ready',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Every service engine burn is checked before the next.',
    ],
    steps: [
      { at: 0.3, phase: 'Earth orbit', where: [0.02, 'Earth orbit'], say: [['kessler', 'Flight, EECOM: spacecraft is good. Platform good.', 'go']], show: { SPS: ['not yet fired'] } },
      { at: 26, if: 'sps', say: [['kessler', 'Flight, EECOM: the service engine came up short on chamber pressure on its second burn. We\'ll fly the rest on the small thrusters.', 'warn']], show: { SPS: ['chamber pressure low', true] } },
      { at: 26, unless: 'sps', say: [['kessler', 'Flight, EECOM: eight burns on the service engine, all good.', 'go']], show: { SPS: ['eight good burns'] } },
      { at: 120, offShift: 'Rendezvous with the spent third stage, television from orbit, and a crew with heavy colds. Nothing for your team.' },
      { at: 239, phase: 'Coming home', decide: 'navcheck' },
      { at: 240, retro: true },
    ],
  },
  // Apollo 10: the full rehearsal, down to fifteen kilometres over the landing site.
  'apollo-10': {
    program: 'apollo', craft: 'Apollo 10', entry: 'lunar', completes: 'rehearsal', phases: 8, objective: 'everything but the landing: the lunar module down to fifteen kilometres over the landing site, and back',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good third stage and a good spacecraft after one and a half Earth orbits.',
      'No lunar orbit insertion without a service engine that has passed its checks: without it there is no way home.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
      'No low pass with a lander computer that restarts by itself.',
    ],
    steps: [
      { at: 0.3, phase: 'Launch and Earth orbit', where: [0.02, 'Earth orbit'], say: [['kessler', 'Flight, EECOM: spacecraft is good. Platform good.', 'go']], show: { 'S-IVB': ['safed for restart'], SPS: ['not yet fired'], LM: ['docked'] } },
      { at: 2.4, if: 'relight', say: [['albrecht', 'Flight, Booster: the S-IVB\'s restart bottle pressure is low. She may not light.', 'warn']], show: { 'S-IVB': ['bottle pressure low', true] } },
      { at: 2.5, phase: 'Translunar injection', where: [0.03, 'Earth orbit'], decide: 'tli' },
      { at: 11, lunar: true, phase: 'Translunar coast', where: [0.3, '120,000 km out'], say: [['crew2', 'Houston, the lander\'s pulled out of the third stage clean. She\'s on our nose.', 'go']] },
      { lunar: true, at: 55, if: 'tank', where: [0.85, '320,000 km out'], say: [['crew2', 'Houston, we\'ve had a problem. Main B bus undervolt, and we\'re venting something.', 'bad']], note: 'At about 55 hours oxygen tank two in the service module failed. The spacecraft lost two of its three fuel cells and was venting its oxygen into space.', show: { 'O2 TANK 2': ['zero', true], 'FUEL CELLS': ['one of three', true] } },
      { lunar: true, at: 55.3, if: 'tank', decide: 'tank' },
      { lunar: true, at: 60, if: 'sps', show: { SPS: ['chamber pressure low on the check', true] }, say: [['kessler', 'Flight, EECOM: the service engine\'s test firing came up a little short on chamber pressure.', 'warn']] },
      { lunar: true, at: 60, unless: 'sps', show: { SPS: ['good on the check'] } },
      { at: 76, phase: 'Lunar orbit insertion', where: [0.97, 'Approaching the Moon'], moon: true, decide: 'loi' },
      { at: 97.8, phase: 'The low pass', where: [1, 'Lunar orbit'], moon: true, say: [['crew2', 'Houston, the lander is powered up and checked out.', '']] },
      { at: 98, moon: true, if: 'alarm', say: [['kessler', 'Flight, the lander\'s computer restarted twice on the checkout with the rendezvous radar on.', 'warn']], show: { 'LM COMPUTER': ['restarts', true] } },
      { at: 98.5, moon: true, decide: 'lowpass' },
      { at: 137, phase: 'Trans-Earth injection', where: [0.97, 'Behind the Moon'], moon: true, say: [['morgan', 'Flight, Network: she\'s behind the Moon. Trans-Earth injection is out of our sight. Waiting for acquisition.', 'warn']] },
      { at: 137.3, moon: true, when: 'stranded', say: [['morgan', 'Flight, Network: we have her, and she\'s still in lunar orbit. The engine did not burn.', 'bad']] },
      { at: 137.4, moon: true, not: 'stranded', say: [['pilot', 'Houston, please be informed we\'re on our way home.', 'go']] },
      { at: 160, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      { at: 185, lunar: true, decide: 'mcc' },
      { at: 191.9, retro: true },
    ],
  },
  // Apollo 11: the landing.
  'apollo-11': {
    program: 'apollo', craft: 'Apollo 11', entry: 'lunar', completes: 'landing', phases: 9, objective: 'land two men on the Moon and bring all three home',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good third stage and a good spacecraft after one and a half Earth orbits.',
      'No lunar orbit insertion without a service engine that has passed its checks: without it there is no way home.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
      'In the descent, abort on any computer alarm that stops the computer flying the lander.',
      'Bingo fuel: land within twenty seconds of the bingo call, or abort.',
    ],
    steps: [
      { at: 0.2, phase: 'Launch and Earth orbit', where: [0.02, 'Earth orbit'], say: [['kessler', 'Flight, EECOM: spacecraft is good. Platform good.', 'go']], show: { 'S-IVB': ['safed for restart'], SPS: ['not yet fired'], LM: ['in the adapter'] } },
      ...EARLY,
      { at: 2.4, if: 'relight', say: [['albrecht', 'Flight, Booster: the S-IVB\'s restart bottle pressure is low. She may not light.', 'warn']], show: { 'S-IVB': ['bottle pressure low', true] } },
      { at: 2.6, phase: 'Translunar injection', where: [0.03, 'Earth orbit'], decide: 'tli' },
      { at: 11, lunar: true, phase: 'Translunar coast', where: [0.3, '120,000 km out'], say: [['crew2', 'Houston, the lander\'s out of the third stage and on our nose.', 'go']], show: { LM: ['docked'] } },
      { lunar: true, at: 30, where: [0.6, '240,000 km out'], offShift: 'A midcourse correction, a television broadcast and a quiet night. Nothing for your team.' },
      ...TANK,
      { lunar: true, at: 60, if: 'sps', show: { SPS: ['chamber pressure low on the check', true] }, say: [['kessler', 'Flight, EECOM: the service engine\'s test firing came up a little short on chamber pressure.', 'warn']] },
      { lunar: true, at: 60, unless: 'sps', show: { SPS: ['good on the check'] } },
      { at: 75.8, phase: 'Lunar orbit insertion', where: [0.97, 'Approaching the Moon'], moon: true, decide: 'loi' },
      { at: 100.2, moon: true, where: [1, 'Lunar orbit'], set: { lmFlown: true }, say: [['pilot', 'Houston, the lander has undocked. She\'s flying.', 'go']], show: { LM: ['undocked'] } },
      { at: 102.5, phase: 'Powered descent', moon: true, say: [['kessler', 'Flight, the descent engine has lit. She\'s coming down.', 'go']], show: { 'LM COMPUTER': ['flying the descent'] } },
      { at: 102.55, moon: true, if: 'alarm', say: [['pilot', 'Houston, program alarm. It\'s a 1202. Give us a reading on the 1202.', 'bad']], show: { 'LM COMPUTER': ['1202 alarms', true] } },
      { at: 102.6, moon: true, if: 'alarm', decide: 'alarm' },
      { at: 102.7, moon: true, not: 'noLanding', say: [['pilot', 'The computer\'s taking us into a crater full of boulders. I\'m taking over. Flying her long.', 'warn']], show: { 'DESCENT FUEL': ['bingo in 60 s', true] } },
      { at: 102.72, moon: true, not: 'noLanding', decide: 'lowfuel' },
      { at: 103, phase: 'On the surface', moon: true, when: 'landed', where: [1, 'On the Moon'], offShift: 'The first walk on the Moon: the flag, the experiments, rocks in the boxes, and a phone call from the President. Nothing for your team.' },
      ...ASCENT(124.4),
      { at: 135.4, phase: 'Trans-Earth injection', where: [0.97, 'Behind the Moon'], moon: true, say: [['morgan', 'Flight, Network: she\'s behind the Moon. Trans-Earth injection is out of our sight. Waiting for acquisition.', 'warn']] },
      { at: 135.7, moon: true, when: 'stranded', say: [['morgan', 'Flight, Network: we have her, and she\'s still in lunar orbit. The engine did not burn.', 'bad']] },
      { at: 135.8, moon: true, not: 'stranded', say: [['crew2', 'Houston, the engine burned on time. We\'re coming home.', 'go']] },
      { at: 160, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      { at: 190, lunar: true, decide: 'mcc' },
      { at: 195.2, retro: true },
    ],
  },
  // Apollo 12: a pinpoint landing beside Surveyor 3, and the Saturn V that was struck by lightning.
  'apollo-12': {
    program: 'apollo', craft: 'Apollo 12', entry: 'lunar', completes: 'landing', phases: 9, objective: 'land beside Surveyor 3 in the Ocean of Storms, close enough to walk to it, and bring all three home',
    rules: [
      'No launch with the sea above state 4 in the primary landing area.',
      'Go for translunar injection only with a good third stage and a good spacecraft after one and a half Earth orbits.',
      'No lunar orbit insertion without a service engine that has passed its checks: without it there is no way home.',
      'Enter the atmosphere inside the corridor: steeper than 7.2 degrees crushes, shallower than 5.5 skips out.',
      'In the descent, abort on any computer alarm that stops the computer flying the lander.',
    ],
    steps: [
      { at: 0.2, phase: 'Launch and Earth orbit', where: [0.02, 'Earth orbit'], say: [['kessler', 'Flight, EECOM: spacecraft is in orbit. We\'re checking her over.', 'go']], show: { 'S-IVB': ['safed for restart'], SPS: ['not yet fired'], LM: ['in the adapter'] } },
      ...EARLY,
      { at: 2.4, if: 'relight', say: [['albrecht', 'Flight, Booster: the S-IVB\'s restart bottle pressure is low. She may not light.', 'warn']], show: { 'S-IVB': ['bottle pressure low', true] } },
      { at: 2.7, phase: 'Translunar injection', where: [0.03, 'Earth orbit'], decide: 'tli' },
      { at: 11, lunar: true, phase: 'Translunar coast', where: [0.3, '120,000 km out'], say: [['crew2', 'Houston, the lander\'s out and on our nose. The third stage is heading off past the Moon.', 'go']], show: { LM: ['docked'] } },
      { lunar: true, at: 30, where: [0.6, '240,000 km out'], offShift: 'A midcourse correction to a hybrid trajectory, off the free return. Nothing for your team.' },
      ...TANK,
      { lunar: true, at: 60, if: 'sps', show: { SPS: ['chamber pressure low on the check', true] }, say: [['kessler', 'Flight, EECOM: the service engine\'s test firing came up a little short on chamber pressure.', 'warn']] },
      { lunar: true, at: 60, unless: 'sps', show: { SPS: ['good on the check'] } },
      { at: 83.4, phase: 'Lunar orbit insertion', where: [0.97, 'Approaching the Moon'], moon: true, decide: 'loi' },
      { at: 107.9, moon: true, where: [1, 'Lunar orbit'], set: { lmFlown: true }, say: [['pilot', 'Houston, the lander has undocked. She\'s flying.', 'go']], show: { LM: ['undocked'] } },
      { at: 110.3, phase: 'Powered descent', moon: true, say: [['kessler', 'Flight, the descent engine has lit. She\'s coming down.', 'go']], show: { 'LM COMPUTER': ['flying the descent'] } },
      { at: 110.33, moon: true, if: 'alarm', say: [['pilot', 'Houston, program alarm. 1202.', 'bad']], show: { 'LM COMPUTER': ['1202 alarms', true] } },
      { at: 110.35, moon: true, if: 'alarm', decide: 'alarm' },
      { at: 110.4, moon: true, not: 'noLanding', say: [['tate', 'Flight, Retro: the tracking has her landing point four thousand two hundred feet downrange of the target.', 'warn']], show: { 'LANDING POINT': ['4,200 ft long', true] } },
      { at: 110.42, moon: true, not: 'noLanding', decide: 'landpoint' },
      { at: 111, phase: 'On the surface', moon: true, when: 'landed', where: [1, 'On the Moon'], offShift: 'Two moonwalks, the second to Surveyor 3 to cut off its camera and bring it home. Nothing for your team.' },
      ...ASCENT(142),
      { at: 172.5, phase: 'Trans-Earth injection', where: [0.97, 'Behind the Moon'], moon: true, say: [['morgan', 'Flight, Network: she\'s behind the Moon. Trans-Earth injection is out of our sight. Waiting for acquisition.', 'warn']] },
      { at: 172.8, moon: true, when: 'stranded', say: [['morgan', 'Flight, Network: we have her, and she\'s still in lunar orbit. The engine did not burn.', 'bad']] },
      { at: 172.9, moon: true, not: 'stranded', say: [['crew2', 'Houston, the engine burned on time. We\'re coming home.', 'go']] },
      { at: 200, lunar: true, phase: 'Coast home', where: [0.4, 'Coming home'], measure: 'entryAngle' },
      { at: 238, lunar: true, decide: 'mcc' },
      { at: 244.3, retro: true },
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
  evaplan: { q: 'The spacewalk. After Gemini 9A\'s exhausted spacewalker, the plan can be paced: handholds, foot restraints and a rest after every task. Or fly the full task list, as Gemini 9A tried.', auto: 'rest', rule: 1,
    options: { rest: 'Pace it: the restraints and a rest after every task.', full: 'Fly the full task list.', standup: 'A stand-up spacewalk only, from the hatch.' } },
  sps6: { q: 'The third stage will not restart. The service module\'s engine could push her up for the high-speed entry test, though it was never meant to do the job.', auto: 'sps',
    options: { sps: 'Burn the service module\'s engine for the entry test.', stay: 'Bring her home from Earth orbit. No high-speed test.' } },
  pogo: { q: 'The programme\'s call, before the spacecraft is even home: is the Saturn V ready for a crew on the next flight, or do we fly a third one empty?', auto: 'crew', owner: 'programme', rule: 2,
    options: { crew: 'Fix what this flight found, and put a crew on the next one.', third: 'Fly a third Saturn V without a crew. Two months.' } },
  tli: { q: 'Translunar injection. The third stage relights over the Pacific and sends them to the Moon. Go or no-go?', auto: 'go', rule: 1,
    options: { go: 'Go for translunar injection.', nogo: 'No-go. Stay in Earth orbit and test the spacecraft there.' } },
  loi: { q: 'Lunar orbit insertion. The service engine burns behind the Moon, out of contact. If it does not burn they swing round and come home on their own. If it burns and will not burn again, they never come home. Go?', auto: 'go', rule: 2,
    options: { go: 'Go for lunar orbit insertion.', nogo: 'No-go. Let her swing round the Moon and come home on the free return.' } },
  mcc: { q: 'The last midcourse correction before entry. Tracking has the entry angle on the board. Burn to trim it, or leave it?', auto: 'burn', rule: 3,
    options: { burn: 'Burn the midcourse correction.', skip: 'Leave it. Save the propellant.' } },
  tank: { q: 'An oxygen tank has failed. The service module is dying. The lander has power, oxygen and an engine. Bring them home: the service engine now, straight back, or the lander\'s engine and the long way round the Moon?', auto: 'freereturn',
    options: { freereturn: 'Power down the command module. The lander is the lifeboat: round the Moon and home.', direct: 'Burn the service engine now for a direct abort, before the Moon.' } },
  lowpass: { q: 'The low pass. The lander undocks and goes down to fifteen kilometres over the landing site, then climbs back. Go?', auto: 'go', rule: 4,
    options: { go: 'Go for the low pass.', skip: 'Keep the lander docked. No low pass.' } },
  lightning: { q: 'Lightning struck her on the way up. The spacecraft is running, but nobody can tell whether the parachute pyros survived, and there is no way to check them from orbit. Go on to the Moon, or bring her home from Earth orbit?', auto: 'go',
    options: { go: 'Go on. If the pyros are dead, they are dead in Earth orbit too.', stay: 'Stay in Earth orbit and bring her home.' } },
  smoke: { q: 'A smell of burning insulation in the cabin, and no smoke. The cabin is pure oxygen at five psi. Press on, with the suspect bus off line, or come home from Earth orbit?', auto: 'press',
    options: { press: 'Take the bus off line and press on.', home: 'Bring her home from Earth orbit, now.' } },
  alarm: { q: 'Program alarms in the descent: the lander\'s computer is overloaded and restarting. Guidance has a second to say go or abort.', auto: 'go', owner: 'flight', rule: 4,
    options: { go: 'Go. If the computer is still flying her, we are go on that alarm.', abort: 'Abort. Stage and climb back to the command module.' } },
  lowfuel: { q: 'The commander is flying her long over boulders, looking for a place. Bingo fuel is coming. Let him fly, or call the abort?', auto: 'land', rule: 5,
    options: { land: 'Let him fly. Call out the seconds.', abort: 'Call the abort at bingo.' } },
  landpoint: { q: 'The tracking says the lander will come down four thousand two hundred feet long of the target. Retro can uplink the correction to the lander\'s computer now, or the commander can fly it out by eye at the end.', auto: 'update',
    options: { update: 'Uplink the correction.', eye: 'Leave it. He flies it by eye at the end.' } },
  rescue: { q: 'The lander is in a low orbit with her ascent engine spent. The command module can come down and get her, using most of its own margin. Or the lander can climb on her small thrusters, all she has left. Or wait an orbit for a better phase.', auto: 'csm',
    options: { csm: 'The command module goes down and gets her.', lmburn: 'The lander climbs on her own thrusters.', wait: 'Wait an orbit and plan it properly.' } },
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
  lunarentry: 'An entry at the speed of a return from the Moon, Apollo command module heat shield',
  csmorbit: 'Ten days in Earth orbit in the Apollo command and service module',
  lunarorbit: 'Ten orbits of the Moon and home: navigation to the Moon and back',
  rehearsal: 'A lander down to fifteen kilometres over the landing site and back to the command module',
  landing: 'Two men landed on the Moon, walked on it, and flew back to the command module',
  pinpoint: 'A landing within walking distance of a chosen point on the Moon',
  evawork: 'Two hours of useful work outside, paced, with handholds and foot restraints',
};
