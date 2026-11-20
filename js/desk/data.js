// DESK MODE, APOLLO 11 AT THE EECOM CONSOLE: THE PRE-LAUNCH COUNT (spec plans-review/DESK-MODE-APOLLO11-EECOM.md).
// The last two hours and forty minutes of the count on 16 July 1969, ending at liftoff at 09:32 EDT. Times are count
// time in seconds (negative before liftoff). src says where a line stands: 'record' (the count's published milestones,
// the launch commentary and the air-to-ground transcript) or 'plausible' (the record is silent on EECOM's own loop and
// the exact minute; the line is a nominal one, written to fit). The people on the loops follow the main rule (M6):
// fictional names, based on the real Green Team and launch crew. The crew are heard only by their stations.
// Apollo 11 was close to nominal for EECOM, so the default count is the real one. The two "what if" faults are clearly
// not historical: a cabin leak check that fails after the hatch is closed, and an O2 tank quantity probe that fails
// high on the pad (the kind of probe that failed in flight on Apollo 13, not on Apollo 11).

export const START_T = -(2 * 3600 + 40 * 60); // T-2:40:00, the crew going aboard
export const LIFTOFF_UTC = Date.UTC(1969, 6, 16, 13, 32, 0); // 09:32 EDT
export const EDT = -4 * 3600;

// The voice loops on the EECOM console. At most two can be turned up at once; the others only light their key.
export const LOOPS = {
  flight: { name: 'FLIGHT', what: 'The Flight Director’s loop: every desk in the room, and Flight asking you.' },
  ssr: { name: 'EECOM SSR', what: 'Your own back room, the staff support room: they watch the data with you.' },
  launch: { name: 'LAUNCH CONTROL', what: 'The Cape: the test conductor and the count.' },
  ag: { name: 'AIR/GROUND', what: 'CAPCOM and the crew.' },
};
export const MAX_UP = 2;
export const START_UP = ['flight', 'launch'];

export const PEOPLE = {
  eecom: 'EECOM (you)',
  flight: 'Flight (Hargrove)',
  ssr: 'SSR (Danner)',
  launch: 'Test conductor',
  pao: 'Launch commentary',
  capcom: 'CAPCOM (Mercer)',
  cdr: 'Commander',
  cmp: 'Command module pilot',
  lmp: 'Lunar module pilot',
};

// The questions Flight puts to EECOM. Each has the answers on the comms stack; model.js judges them.
export const ASKS = {
  ingress: {
    q: 'EECOM, Flight. Crew’s on the suit loop. How does it look?',
    lasts: 240,
    options: [
      { id: 'good', text: 'Suit loop looks good, Flight. Flow and pressure normal with three aboard.' },
      { id: 'standby', text: 'Stand by, Flight. Still looking.' },
    ],
  },
  leak: {
    q: 'EECOM, Flight. Where are we on the cabin leak check?',
    lasts: 300,
    options: [
      { id: 'good', text: 'Leak check is good, Flight. Cabin is holding.' },
      { id: 'hold', text: 'Cabin decay is out of limits. Recommend we hold and reseal the hatch.' },
      { id: 'standby', text: 'Stand by, Flight. Still watching the decay.' },
    ],
  },
  o2: {
    q: 'EECOM, Flight. I see a jump on O2 tank 2 quantity. What have you got?',
    lasts: 300,
    options: [
      {
        id: 'probe',
        text: 'That’s the quantity probe, Flight. Pressure is steady and agrees with tank 1. No constraint.',
      },
      { id: 'hold', text: 'Recommend we hold on O2 tank 2 until we understand it.' },
      { id: 'standby', text: 'Stand by, Flight. Still looking at it.' },
    ],
  },
  internal: {
    q: 'EECOM, Flight. How do we look on internal power?',
    lasts: 240,
    options: [
      { id: 'good', text: 'Good on internal, Flight. Fuel cells are carrying the load; both main buses look good.' },
      { id: 'low', text: 'Main buses look low, Flight. Recommend we watch them.' },
      { id: 'standby', text: 'Stand by, Flight.' },
    ],
  },
  poll: {
    q: 'All flight controllers, go/no-go for launch. EECOM?',
    lasts: 130, // unanswered by T-3:50, Flight holds the count
    options: [
      { id: 'go', text: 'EECOM is GO.' },
      { id: 'nogo', text: 'EECOM is NO-GO, Flight.' },
    ],
  },
};

// The desk's scheduled work for this phase: a call up to the crew through CAPCOM, inside its window.
export const TASKS = {
  cryo: {
    from: -5400,
    to: -3900,
    title: 'Cryo fans, O2 and H2',
    short: 'cryo fan cycle',
    paper:
      'T-1:30 to T-1:05. Have the crew run the O2 and H2 tank fans for two minutes, then off, so the tanks are stirred before the quantities are read for launch.',
    call: 'Ask the crew to run the cryo fans, O2 and H2, for two minutes, then off.',
    src: 'plausible',
  },
  battie: {
    from: -1500,
    to: -960,
    title: 'Entry batteries on the main buses',
    short: 'battery bus ties',
    paper:
      'T-25 to T-16, before the spacecraft goes to internal power at T-15. Have the crew tie entry batteries A and B to the main buses, so they back up the fuel cells through the boost.',
    call: 'Ask the crew for main bus ties, battery A and B, ON.',
    src: 'plausible',
  },
};

// The procedures stack: what the papers say for this phase, in the desk's own words.
export const PROCEDURES = [
  'LAUNCH DAY, PRE-LAUNCH COUNT. EECOM watches the command and service module’s power, cryogenics and cabin. Not the lunar module (TELMU), not the booster (BOOSTER).',
  'Crew ingress, about T-2:40. Confirm the suit loop with three crewmen on it when Flight asks.',
  'Hatch closure and cabin purge, about T-1:45. Then the cabin leak check: the cabin must hold its pressure. Decay above 0.02 psi a minute is out of limits: the hatch must be reseated before launch.',
  'Keep an eye on the cryo tanks: a quantity that moves on its own while its pressure does not is the probe, not the oxygen.',
  'T-15:00. The spacecraft goes to full internal power: the fuel cells take the load from the ground supply. Report to Flight when asked.',
  'The go/no-go poll, about T-6. Answer GO or NO-GO for EECOM. A cabin that will not hold pressure is NO-GO.',
  'A hold can be recommended to Flight at any time. It costs the launch window minutes; ask for one only with a reason on the data.',
];

// The count. loop, who (PEOPLE), text, src; optional: set (spacecraft state), ask (ASKS id), tty (teletype line),
// when / unless (a what-if fault the line belongs to, or that silences it).
export const SCRIPT = [
  {
    t: -9600,
    loop: 'launch',
    who: 'pao',
    text: 'The commander is aboard the spacecraft, going into the left-hand couch.',
    src: 'record',
  },
  {
    t: -9420,
    loop: 'launch',
    who: 'pao',
    text: 'The command module pilot is aboard, in the right-hand couch.',
    src: 'record',
  },
  {
    t: -9180,
    loop: 'launch',
    who: 'pao',
    text: 'The lunar module pilot is aboard, in the centre couch. All three are aboard.',
    src: 'record',
  },
  {
    t: -9120,
    loop: 'flight',
    who: 'flight',
    text: 'All flight controllers, crew is aboard. Let’s settle in for the count.',
    src: 'plausible',
  },
  {
    t: -8880,
    loop: 'ssr',
    who: 'ssr',
    text: 'EECOM, SSR. Suit loop is up with three on it. Flow and pressure all normal.',
    src: 'plausible',
    set: { suit: 'on' },
  },
  { t: -8700, loop: 'flight', who: 'flight', ask: 'ingress', src: 'plausible' },
  { t: -8400, loop: 'ag', who: 'capcom', text: 'Apollo 11, Houston. Radio check. How do you read?', src: 'record' },
  { t: -8390, loop: 'ag', who: 'cdr', text: 'Loud and clear, Houston.', src: 'record' },
  {
    t: -7800,
    loop: 'launch',
    who: 'launch',
    text: 'Spacecraft checks in work. Comm checks complete with the crew.',
    src: 'plausible',
  },
  {
    t: -6900,
    loop: 'ssr',
    who: 'ssr',
    text: 'EECOM, SSR. Coming up on hatch closure. We’ll watch the cabin after the purge.',
    src: 'plausible',
  },
  {
    t: -6300,
    loop: 'launch',
    who: 'pao',
    text: 'The hatch is closed and locked.',
    src: 'record',
    set: { hatch: 'closed' },
  },
  {
    t: -6120,
    loop: 'launch',
    who: 'launch',
    text: 'Cabin purge under way. Leak check to follow.',
    src: 'plausible',
    set: { purge: true },
  },
  {
    t: -5880,
    loop: 'launch',
    who: 'launch',
    text: 'Purge complete. Cabin leak check in progress.',
    src: 'plausible',
    set: { leakCheck: true },
  },
  {
    t: -5820,
    loop: 'ssr',
    who: 'ssr',
    text: 'EECOM, SSR. Cabin’s holding nicely after the purge.',
    src: 'plausible',
    unless: 'leak',
  },
  {
    t: -5820,
    loop: 'ssr',
    who: 'ssr',
    text: 'EECOM, SSR. Cabin’s coming down faster than it ought to. I make it out of limits.',
    src: 'plausible',
    when: 'leak',
  },
  { t: -5700, loop: 'flight', who: 'flight', ask: 'leak', src: 'plausible' },
  { t: -5100, loop: 'ag', who: 'lmp', text: 'Houston, it’s a little warm in here.', src: 'plausible' },
  { t: -5090, loop: 'ag', who: 'capcom', text: 'Roger, we’ll see what we can do.', src: 'plausible' },
  { t: -4800, loop: 'launch', who: 'launch', text: 'Closeout crew is securing the white room.', src: 'plausible' },
  { t: -3600, loop: 'launch', who: 'pao', text: 'T minus one hour and counting.', src: 'record' },
  {
    t: -3540,
    loop: 'ssr',
    who: 'ssr',
    text: 'EECOM, SSR. O2 tank 2 quantity just went off scale high. Pressure’s flat, heaters aren’t cycling. Smells like the probe.',
    src: 'plausible',
    when: 'o2',
  },
  { t: -3300, loop: 'flight', who: 'flight', ask: 'o2', src: 'plausible', when: 'o2' },
  { t: -2580, loop: 'launch', who: 'pao', text: 'The crew access arm is moving to its park position.', src: 'record' },
  {
    t: -1800,
    loop: 'flight',
    who: 'flight',
    text: 'Thirty minutes, folks. Let’s have a clean count.',
    src: 'plausible',
  },
  {
    t: -1560,
    loop: 'ssr',
    who: 'ssr',
    text: 'EECOM, SSR. Coming up on the window for the battery bus ties.',
    src: 'plausible',
  },
  {
    t: -900,
    loop: 'launch',
    who: 'pao',
    text: 'T minus fifteen minutes. The spacecraft is on full internal power.',
    src: 'record',
    set: { power: 'internal' },
  },
  { t: -840, loop: 'flight', who: 'flight', ask: 'internal', src: 'plausible' },
  { t: -600, loop: 'launch', who: 'pao', text: 'T minus ten minutes and counting.', src: 'record' },
  { t: -360, loop: 'flight', who: 'flight', ask: 'poll', src: 'plausible' },
  { t: -300, loop: 'launch', who: 'pao', text: 'The crew access arm is retracting.', src: 'record' },
  {
    t: -190,
    loop: 'launch',
    who: 'pao',
    text: 'T minus three minutes ten seconds. The firing command is in; the automatic sequence has started.',
    src: 'record',
  },
  { t: -50, loop: 'launch', who: 'pao', text: 'The launch vehicle is on internal power.', src: 'record' },
  { t: -15, loop: 'launch', who: 'pao', text: 'Fifteen seconds. Guidance is internal.', src: 'record' },
  { t: -9, loop: 'launch', who: 'pao', text: 'Twelve, eleven, ten, nine, ignition sequence start.', src: 'record' },
  {
    t: -6,
    loop: 'launch',
    who: 'pao',
    text: 'Six, five, four, three, two, one, zero. All engines running.',
    src: 'record',
  },
  {
    t: 0,
    loop: 'launch',
    who: 'pao',
    text: 'Liftoff. We have a liftoff, thirty-two minutes past the hour. Liftoff on Apollo 11.',
    src: 'record',
  },
  { t: 0, loop: 'ag', who: 'cdr', text: 'Roger. Clock.', src: 'record' },
];

// While the count holds: the closeout crew goes back up to reseat the hatch. Seconds into the hold.
export const RESEAL = [
  {
    at: 30,
    loop: 'launch',
    who: 'launch',
    text: 'We are holding. Closeout crew going back up to the white room to open the hatch.',
  },
  { at: 600, loop: 'launch', who: 'launch', text: 'Hatch is open. The seal is being inspected and reseated.' },
  { at: 1200, loop: 'launch', who: 'launch', text: 'Hatch is closed and locked again. Purge in progress.' },
  { at: 1440, loop: 'ssr', who: 'ssr', text: 'EECOM, SSR. Cabin is holding now. Leak check is good.', fix: true },
  { at: 1500, loop: 'flight', who: 'flight', text: 'Okay, we’re picking up the count.' },
];
export const RESEAL_LONG = 2400; // a hold that had to bring the access arm back first (caught late in the count)
