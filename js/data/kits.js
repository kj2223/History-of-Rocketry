// What the player can see and say about each kind of round: the spots on the hardware, the explanations they can put
// forward at the review, the calls on the net and what a recovery party finds. Content only: which spots are really bad,
// and what really brought a flight down, are decided in truth/round.js.
//
// A spot's fault is the real defect when present; cue is what a careful look shows. A real fault shows its cue most of the
// time; a sound part sometimes shows something that looks like one.

const WAC_SPOTS = {
  'weld-fwd': { name: 'Forward tank weld', fault: 'weld', sound: 'The bead is even all the way round.', cue: 'A hairline of discolouration runs along part of the seam.' },
  'weld-mid': { name: 'Tank girth weld', fault: 'weld', sound: 'Clean, regular ripples in the bead.', cue: 'The bead thins out and there is a pinhole you could miss.' },
  'weld-aft': { name: 'Aft tank weld', fault: 'weld', sound: 'Smooth and bright, ground flush.', cue: 'Spatter and a slight undercut at the edge of the bead.' },
  'fitting': { name: 'Acid feed fitting', fault: 'leak', sound: 'Dry to the touch, safety wire in place.', cue: 'A faint green stain under the union nut.' },
  'pressure': { name: 'Helium pressurisation line', fault: 'leak', sound: 'Tight, no hiss with the line charged.', cue: 'You think you hear a faint hiss, but the hangar is noisy.' },
  'fins': { name: 'Fin attachment', fault: null, sound: 'Rivets tight, fins true.', cue: 'One fin looks a degree off true by eye.' },
};
const VANES = { name: 'Graphite jet vanes', fault: 'vanes', sound: 'All four vanes are whole, their edges sharp.', cue: 'A hairline crack runs in from the edge of one vane.' };
const WIRING = { name: 'Control compartment wiring', fault: null, sound: 'Every plug seated and laced down.', cue: 'One plug looks half seated, though it may be the light.' };

// The short names for each cause, used in what people say and in your record.
export const SHORT = {
  nominal: 'a good flight', ignition: 'a rough ignition', weld: 'a weld failure', leak: 'a leak', turbopump: 'a tired turbopump',
  vanes: 'a broken jet vane', separation: 'a separation failure', unknown: 'not enough evidence',
};

export const KITS = {
  wac: {
    name: 'WAC Corporal', range: 'WAC CORPORAL', crew: ['kowalski', 'delgado'],
    inspect: { title: 'Hangar: the WAC upper stage', objective: 'Go to the assembly hangar and look the WAC upper stage over before tomorrow\'s static fire.',
      intro: 'The stage lies on its cradle with the panels off. Kowalski hands you a torch.' },
    brief: 'Static fire tomorrow. Check the tank welds first, would you?',
    stand: { thing: 'upper stage', pc: [17, 23], rework: 'Rework the igniter', reworkJob: 'Reworking the igniter', reworkDay: 'The crew spent the day reworking the igniter in the hangar.', reworkSay: 'An igniter rework. That puts the launch back a day.' },
    spots: WAC_SPOTS,
    explanations: {
      nominal: 'The round flew as planned. Nothing to fix.',
      ignition: 'A rough ignition. The igniter needs reworking.',
      weld: 'A tank weld let go under load.',
      leak: 'A propellant leak starved the motor.',
      unknown: 'Not enough evidence. I want another static firing.',
    },
    calls: {
      lift: 'Liftoff! She\'s off the tower.',
      steady: [{ t: 1, text: 'Booster burnout. Sustainer lit.', tone: 'go' }, { t: 10, text: 'Sustainer burning steady. Track is good.' }],
      burnout: burn => `Burnout at ${burn} seconds. Coasting.`,
      fail: {
        ignition: [{ t: 2, text: 'No sustainer light! She\'s going over!' }],
        weld: [{ t: 1, text: 'Booster burnout. Sustainer lit.', tone: 'go' }, { t: 14, text: 'A flash! Pieces coming off her!' }],
        leak: [{ t: 1, text: 'Booster burnout. Sustainer lit.', tone: 'go' }, { t: 10, text: 'Sustainer burning. Track is good.' }, { t: 24, text: 'Flame\'s out early! Burnout at 24 seconds.' }],
      },
    },
    wreck: {
      ignition: ['The upper stage came down close in, nearly whole.', 'The injector face is streaked with unburnt propellant.', 'The igniter housing is scorched on one side only.'],
      weld: ['Pieces are spread over a long strip of the range.', 'The propellant tank is torn open along a weld seam, the edges peeled outward.', 'The motor itself looks undamaged.'],
      leak: ['The round came down short of the planned impact.', 'Green acid staining runs back from the feed fitting along the skin.', 'The motor shows a clean burn that simply stopped.'],
      nominal: ['The round dug itself a crater well downrange.', 'The motor nozzle shows an even burn all the way round.', 'Nothing unusual on what is left of the tank.'],
    },
  },

  v2: {
    name: 'V-2', range: 'V-2', crew: ['kowalski', 'delgado'],
    inspect: { title: 'Hangar: the V-2', objective: 'Go to the assembly hangar and look the V-2 over with Hoyt\'s crew before tomorrow\'s static fire.',
      intro: 'The V-2 lies on its trailer with the access panels off: captured German hardware, rebuilt from crates of parts. Hoyt hands you a lamp.' },
    brief: 'Hoyt\'s crew has the V-2 on the trailer. Look her over: the jet vanes, the valves. Static fire tomorrow.',
    stand: { thing: 'V-2', pc: [13, 18], rework: 'Refurbish the turbopump and steam generator', reworkJob: 'Refurbishing the turbopump', reworkDay: 'Hoyt\'s crew spent the day stripping and refurbishing the turbopump and steam generator.', reworkSay: 'A pump refurbishment. That puts the launch back a day.' },
    spots: {
      vanes: VANES,
      'alc-valve': { name: 'Main alcohol valve', fault: 'leak', sound: 'Dry and seated.', cue: 'A damp ring round the flange, and a smell of alcohol.' },
      'lox-valve': { name: 'Main oxygen valve', fault: 'leak', sound: 'The gaskets are new and sit square.', cue: 'The gasket edge looks pinched on one side.' },
      wiring: WIRING,
      fins: { name: 'Tail fins', fault: null, sound: 'All four fins true, rivets tight.', cue: 'A dent near the root of one fin, from the crate perhaps.' },
    },
    explanations: {
      nominal: 'She flew as planned. Nothing to fix.',
      turbopump: 'The turbopump lost power. Refurbish the pumps and steam generators.',
      vanes: 'A jet vane broke and she lost control.',
      leak: 'A propellant valve leaked and cut the burn short.',
      unknown: 'Not enough evidence. I want another static firing.',
    },
    calls: {
      lift: 'Liftoff! She\'s climbing straight and slow.',
      steady: [{ t: 10, text: 'Pitch programme started. Track is good.', tone: 'go' }],
      burnout: burn => `Brennschluss at ${burn} seconds. Coasting.`,
      fail: {
        turbopump: [{ t: 10, text: 'Track is good.' }, { t: 28, text: 'She\'s losing thrust! The flame\'s gone ragged. Cutoff at 28 seconds!' }],
        vanes: [{ t: 10, text: 'Pitch programme started.' }, { t: 35, text: 'She\'s rolling! She\'s off the line and tumbling!' }],
        leak: [{ t: 10, text: 'Track is good.' }, { t: 45, text: 'Early cutoff! Burn stopped at 45 seconds.' }],
      },
    },
    wreck: {
      turbopump: ['The V-2 came down not far from the pad.', 'The turbopump casing is blackened, and the steam generator\'s catalyst pack is burnt through.', 'The jet vanes look whole.'],
      vanes: ['Wreckage is scattered well off the line of flight.', 'One graphite jet vane is missing, snapped at the root. The others are worn evenly.', 'The pumps look sound.'],
      leak: ['The V-2 came down short of the planned area.', 'The alcohol and oxygen valve housings are stained and frosted. The burn stopped clean.', 'The vanes and pumps look sound.'],
      nominal: ['A deep crater far up the range.', 'The motor shows an even burn, and the vanes are worn down evenly to stubs.', 'Nothing unusual in what is left.'],
    },
  },

  bumper: {
    name: 'Bumper', range: 'BUMPER (V-2 + WAC)', crew: ['kowalski', 'delgado'],
    inspect: { title: 'Hangar: the Bumper stack', objective: 'Go to the assembly hangar and look over the whole Bumper stack, the V-2 and the WAC on its nose, before tomorrow\'s static fire.',
      intro: 'The V-2 lies on its trailer with the WAC Corporal beside it, ready to be mated on the nose. Hoyt has the V-2; Kowalski has the WAC.' },
    brief: 'Look over the whole stack: the V-2\'s vanes, the separation joint, the WAC\'s welds and fittings. We fire the V-2 on the stand tomorrow.',
    stand: { thing: 'V-2 lower stage', pc: [13, 18], rework: 'Refurbish the V-2 turbopump and steam generator', reworkJob: 'Refurbishing the turbopump', reworkDay: 'Hoyt\'s crew spent the day stripping and refurbishing the V-2 turbopump and steam generator.', reworkSay: 'A pump refurbishment. That puts the launch back a day.' },
    spots: {
      vanes: VANES,
      interstage: { name: 'Separation joint and bolts', fault: 'separation', sound: 'Every bolt and its firing lead check out on the meter.', cue: 'One firing lead reads high on the meter, then normal again.' },
      'weld-mid': { ...WAC_SPOTS['weld-mid'], name: 'WAC tank girth weld' },
      fitting: { ...WAC_SPOTS.fitting, name: 'WAC acid feed fitting' },
      pressure: { ...WAC_SPOTS.pressure, name: 'WAC helium pressurisation line' },
      wiring: WIRING,
    },
    explanations: {
      nominal: 'Both stages flew as planned. Nothing to fix.',
      turbopump: 'The V-2 turbopump lost power. Refurbish the pumps and steam generators.',
      vanes: 'A V-2 jet vane broke and the stack lost control.',
      separation: 'The stages did not separate.',
      ignition: 'The WAC failed to light after separation. Its igniter needs reworking.',
      weld: 'A WAC tank weld let go under load.',
      leak: 'A leak starved the WAC motor.',
      unknown: 'Not enough evidence. I want another static firing.',
    },
    calls: {
      lift: 'Liftoff! The stack is climbing.',
      steady: [{ t: 10, text: 'V-2 burning steady. Track is good.', tone: 'go' }, { t: 65, text: 'V-2 burnout. Separation!', tone: 'go' }, { t: 66, text: 'Upper stage lit! She\'s going like a bullet!', tone: 'go' }],
      burnout: burn => `WAC burnout at ${burn} seconds. Coasting up.`,
      fail: {
        turbopump: [{ t: 10, text: 'Track is good.' }, { t: 30, text: 'The V-2\'s losing thrust! Cutoff at 30 seconds!' }],
        vanes: [{ t: 10, text: 'V-2 burning steady.' }, { t: 40, text: 'She\'s rolling! The whole stack is tumbling!' }],
        separation: [{ t: 10, text: 'V-2 burning steady.', tone: 'go' }, { t: 65, text: 'V-2 burnout… no separation! The WAC is still on her nose!' }],
        ignition: [{ t: 10, text: 'V-2 burning steady.', tone: 'go' }, { t: 65, text: 'V-2 burnout. Separation!', tone: 'go' }, { t: 67, text: 'No upper-stage light! The WAC didn\'t fire!' }],
        weld: [{ t: 10, text: 'V-2 burning steady.', tone: 'go' }, { t: 65, text: 'V-2 burnout. Separation!', tone: 'go' }, { t: 66, text: 'Upper stage lit.', tone: 'go' }, { t: 75, text: 'A flash up there! The WAC is breaking up!' }],
        leak: [{ t: 10, text: 'V-2 burning steady.', tone: 'go' }, { t: 65, text: 'V-2 burnout. Separation!', tone: 'go' }, { t: 66, text: 'Upper stage lit.', tone: 'go' }, { t: 85, text: 'The WAC\'s flame is out early! Burnout at 85 seconds.' }],
      },
    },
    wreck: {
      turbopump: ['The V-2 came down not far from the pad, the WAC still on its nose.', 'The turbopump casing is blackened, and the steam generator\'s catalyst pack is burnt through.', 'The jet vanes look whole.'],
      vanes: ['Wreckage of both stages is scattered off the line of flight.', 'One graphite jet vane is missing, snapped at the root. The others are worn evenly.', 'The pumps look sound.'],
      separation: ['The V-2 and the WAC came down together, still joined.', 'The separation bolts have not fired; their firing leads are scorched through at one connector.', 'The WAC\'s tanks are still full.'],
      ignition: ['The WAC came down apart from the V-2, short of the planned area.', 'Its injector face is streaked with unburnt propellant.', 'The igniter housing is scorched on one side only.'],
      weld: ['Pieces of the WAC are strewn over a long strip far up the range.', 'Its propellant tank is torn open along a weld seam, the edges peeled outward.', 'The V-2 crater looks normal.'],
      leak: ['The WAC came down well short of where it should have.', 'Green acid staining runs back from its feed fitting along the skin.', 'Its motor shows a clean burn that simply stopped.'],
      nominal: ['The V-2 dug a crater up the range. Its motor shows an even burn.', 'The WAC came down so far out that the search party could not find it.', 'Nothing unusual on the V-2.'],
    },
  },
};

// How each cause reads in the prototype's debrief, which shows the truth for testing.
export const FAILED_BECAUSE = {
  ignition: 'the WAC motor did not light properly', weld: 'a tank weld let go', leak: 'a leak starved the motor',
  turbopump: 'the V-2 turbopump lost power', vanes: 'a jet vane broke and she tumbled', separation: 'the stages never separated',
};
export const FAULT_AT_SPOT = { weld: 'A bad weld', leak: 'A leak', vanes: 'A cracked jet vane', separation: 'A faulty separation bolt lead' };
