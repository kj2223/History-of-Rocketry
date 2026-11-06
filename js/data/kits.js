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
  vanes: 'a broken jet vane', separation: 'a separation failure', liner: 'a liner burn-through', cutoff: 'a turbine steam leak', fin: 'a failed fin', holddown: 'a hold-down failure', injector: 'an injector burn-through', plug: 'a tail plug that came out in the wrong order', control: 'a control failure', lox: 'a propellant valve leak', thrust: 'a booster that burned too hot', depletion: 'a Jupiter running short', agena: 'an Agena that would not restart', camera: 'a failed camera supply', miss: 'a midcourse that left her off the Moon', guidance: 'an Atlas guidance failure', shortburn: 'an Atlas sustainer cutting off early', shield: 'a loose heat shield', scanner: 'a bad horizon scanner', titanctl: 'a Titan guidance failure', stage2: 'a Titan second stage cutting off early', fuelcell: 'a failing fuel-cell oxygen supply', hatch: 'a bad hatch latch', computer: 'a failed guidance computer', navdata: 'a wrong number from the ground', shutdown: 'a tail plug that dropped out on the pad', thruster: 'a thruster stuck open', saturnctl: 'a Saturn guidance failure', j2: 'J-2 engines shutting down early', s2cutoff: 'a second stage cutting off early', pogo: 'pogo in the first stage', relight: 'an S-IVB that would not restart', sps: 'a faulty service propulsion engine', tank: 'an oxygen tank failure', cabin: 'a cabin wiring short in oxygen', alarm: 'an overloaded lander computer', ascent: 'a weak ascent engine', chute: 'a failed main parachute', lightning: 'a lightning strike', unknown: 'not enough evidence',
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

  aerobee: {
    name: 'Aerobee', range: 'AEROBEE', crew: ['kowalski', 'delgado'],
    inspect: { title: 'Hangar: the Aerobee sustainer', objective: 'Go to the assembly hangar and look the Aerobee sustainer over before the static fire.',
      intro: 'Aerojet\'s sustainer lies on its cradle with the panels off, its solid booster on the rack beside it. Kowalski hands you a torch.' },
    brief: 'Aerojet\'s sustainer is in the hangar. Look her over, then we fire her on the stand.',
    stand: { thing: 'Aerobee sustainer', pc: [17, 23], wall: [0, 700], long: 'with thermocouples on the chamber. Shows the wall temperature.', rework: 'Rebond the chamber liner and fit a wall-temperature pickup', reworkJob: 'Rebonding the liner', reworkDay: 'The crew spent the day rebonding the sustainer\'s chamber liner.', reworkSay: 'A liner rebond. That puts the launch back a day.' },
    spots: {
      'weld-fwd': { ...WAC_SPOTS['weld-fwd'], name: 'Sustainer forward tank weld' },
      'weld-aft': { ...WAC_SPOTS['weld-aft'], name: 'Sustainer aft tank weld' },
      fitting: WAC_SPOTS.fitting,
      pressure: WAC_SPOTS.pressure,
      chamber: { name: 'Thrust chamber, outside', fault: null, sound: 'Clean metal, no heat marks from the last firing.', cue: 'A faint ring of discolouration round the chamber. Old, perhaps, or nothing.' },
      booster: { name: 'Booster attachment', fault: null, sound: 'The booster seats square and the shear pins are new.', cue: 'One shear pin sits a hair proud of the others.' },
    },
    explanations: {
      nominal: 'She flew as planned. Nothing to fix.',
      liner: 'The chamber liner came away and the wall burned through. Rebond the liners.',
      weld: 'A tank weld let go under load.',
      leak: 'A propellant leak starved the motor.',
      unknown: 'Not enough evidence. I want a full-duration firing on the stand.',
    },
    calls: {
      lift: 'Liftoff! She\'s off the tower.',
      steady: [{ t: 2, text: 'Booster burnout. Sustainer lit.', tone: 'go' }, { t: 15, text: 'Sustainer burning steady. Track is good.' }],
      burnout: burn => `Burnout at ${burn} seconds. Coasting.`,
      fail: {
        liner: [{ t: 2, text: 'Booster burnout. Sustainer lit.', tone: 'go' }, { t: 15, text: 'Sustainer burning steady.' }, { t: 31, text: 'A flare at the tail! She\'s yawing off! Thrust\'s gone!' }],
        weld: [{ t: 2, text: 'Booster burnout. Sustainer lit.', tone: 'go' }, { t: 12, text: 'A flash! Pieces coming off her!' }],
        leak: [{ t: 2, text: 'Booster burnout. Sustainer lit.', tone: 'go' }, { t: 25, text: 'Flame\'s out early! Burnout at 25 seconds.' }],
      },
    },
    wreck: {
      liner: ['The sustainer came down short, in one long piece.', 'There is a hole burnt clean through the chamber wall, and inside, the liner has come away from it in a sheet.', 'The feed lines and tanks are intact.'],
      weld: ['Pieces are spread over a long strip of the range.', 'The propellant tank is torn open along a weld seam, the edges peeled outward.', 'The chamber looks undamaged.'],
      leak: ['The round came down short of the planned impact.', 'Green acid staining runs back from the feed fitting along the skin.', 'The chamber shows a clean burn that simply stopped.'],
      nominal: ['The round dug itself a crater well up the range.', 'The chamber shows an even burn, the liner still bonded all round.', 'Nothing unusual on what is left of the tank.'],
    },
  },

  viking: {
    name: 'Viking', range: 'VIKING', crew: ['kowalski', 'delgado'],
    inspect: { title: 'Hangar: the Viking', objective: 'Go to the assembly hangar and look the Viking over before the static firing.',
      intro: 'Martin\'s Viking lies on its dolly, slimmer and longer than a V-2, its engine swung on a gimbal where a V-2 had vanes. The crew has the access panels off.' },
    brief: 'The Viking is in the hangar. Look her over, then she goes on the stand.',
    stand: { thing: 'Viking', pc: [18, 24], long: 'the whole burn on the stand. Shows whether chamber pressure holds up late in the burn. The hold-downs take full thrust for the whole firing.', rework: 'Weld up the turbine casing and rework the steam feed', reworkJob: 'Reworking the turbine', reworkDay: 'The crew spent the day welding up the turbine casing and reworking the steam feed.', reworkSay: 'A turbine rework. That puts the launch back a day.' },
    spots: {
      fins: { name: 'Fin attachment fittings', fault: 'fin', sound: 'The fittings are clean, the bolts torqued and marked.', cue: 'A hairline in the paint at the root of one fitting. A crack, or just paint.' },
      'lox-valve': { name: 'Main oxygen valve', fault: 'leak', sound: 'Seated square, new gaskets.', cue: 'Frost on the flange that shouldn\'t be there after a cold-flow test.' },
      'alc-valve': { name: 'Alcohol feed line', fault: 'leak', sound: 'Dry, the clamps tight.', cue: 'A damp ring and a smell of alcohol at one joint.' },
      holddown: { name: 'Stand hold-down fittings', fault: 'holddown', sound: 'The fittings and their pins are bright and true.', cue: 'One hold-down pin shows a faint ridge, as if it had been loaded before.' },
      turbine: { name: 'Turbine casing', fault: null, sound: 'Casing dry, the seams clean.', cue: 'A brown streak along one seam. Old staining, maybe.' },
      gimbal: { name: 'Gimbal actuators', fault: null, sound: 'Both actuators sweep smoothly through their travel.', cue: 'One actuator hesitates at the end of its travel, once.' },
    },
    explanations: {
      nominal: 'She flew as planned. Nothing to fix.',
      cutoff: 'The turbine leaked steam and the engine cut off early. Weld up the casings.',
      fin: 'A fin let go and she lost attitude control.',
      leak: 'A propellant leak starved the engine.',
      holddown: 'She broke loose from the stand: the hold-down fittings failed.',
      unknown: 'Not enough evidence. I want a full-duration firing on the stand.',
    },
    calls: {
      lift: 'Liftoff! She\'s climbing clean.',
      steady: [{ t: 10, text: 'Engine steady. Gimbals are steering her. Track is good.', tone: 'go' }],
      burnout: burn => `Cutoff at ${burn} seconds, on time. Coasting up.`,
      fail: {
        cutoff: [{ t: 10, text: 'Engine steady. Track is good.' }, { t: 42, text: 'Chamber pressure falling! Cutoff at 42 seconds, early!' }],
        fin: [{ t: 10, text: 'Engine steady.' }, { t: 30, text: 'She\'s rolling! Something came off her! She\'s lost attitude!' }],
        leak: [{ t: 10, text: 'Engine steady. Track is good.' }, { t: 55, text: 'Early cutoff! The engine stopped at 55 seconds.' }],
        holddown: [{ t: 2, text: 'She\'s off the stand! She\'s loose and climbing!' }, { t: 55, text: 'Cutoff sent. Engine is out. She\'s coming down to the southeast.' }],
      },
    },
    wreck: {
      cutoff: ['The Viking came down short of the planned area.', 'The turbine casing is streaked brown along a seam, and the steam lines are scorched.', 'The engine and fins look sound.'],
      fin: ['Wreckage is spread well off the line of flight.', 'One fin is missing. Its attachment fitting is cracked through at the root.', 'The engine looks sound.'],
      leak: ['The Viking came down short of the planned area.', 'There is frost-scoured staining round a feed joint, and the engine shows a clean burn that stopped.', 'The fins are all there.'],
      holddown: ['The Viking came down a few miles southeast of the stand, smashed flat.', 'At the stand, two hold-down fittings are sheared, their pins pulled through.', 'The engine shows a full-power burn to the cutoff.'],
      nominal: ['A deep crater far up the range.', 'The engine shows an even burn, the gimbal free.', 'All four fins accounted for.'],
    },
    // The same evidence as the range reads it at the Cape, from telemetry and radar, the round lost in the Atlantic.
    sea: {
      cutoff: ['Telemetry shows the chamber pressure falling from 42 seconds and the turbine speed with it.', 'Radar has her coming down short, in the Atlantic.', 'The fins and attitude were steady to the end.'],
      fin: ['Telemetry shows her rolling hard at 30 seconds, then tumbling.', 'One fin\'s strain gauge went dead at the same moment.', 'The engine ran normally until the range cut it.'],
      leak: ['Telemetry shows the tank pressure bleeding off, and the engine stopping clean at 55 seconds.', 'Radar has her coming down short, in the Atlantic.', 'The fins and attitude were steady.'],
      holddown: ['The Viking came down offshore, a few miles out.', 'At the stand, two hold-down fittings are sheared, their pins pulled through.', 'The engine shows a full-power burn to the cutoff.'],
      nominal: ['Telemetry is clean all the way to the peak.', 'Minitrack locked on her radio and followed her up and down.', 'Radar has her falling far out in the Atlantic, on the planned line.'],
    },
  },

  // Project Vanguard: Martin's three-stage satellite launcher, built on the Viking. A GE first stage, Aerojet's second
  // (the WAC's descendant, nitric acid again) and a solid third stage spun up on a turntable. Flown at Cape Canaveral.
  vanguard: {
    name: 'Vanguard', range: 'VANGUARD', crew: ['kowalski', 'delgado'],
    inspect: { title: 'Hangar S: the Vanguard', objective: 'Go to the hangar and look the Vanguard over, all three stages, before the first stage goes on the stand.',
      intro: 'The three stages lie on their dollies in the Cape\'s hangar: the long first stage, the second with its nitric acid tanks, and the small third stage and its sphere. The air smells of salt.' },
    brief: 'The Vanguard is in the hangar. Look her over, then the first stage goes on the stand.',
    stand: { thing: 'Vanguard first stage', pc: [18, 24], long: 'the whole first-stage burn on the stand. The hold-downs take full thrust for the whole firing.', rework: 'Replace the first-stage injector with the reworked design', reworkJob: 'Replacing the injector', reworkDay: 'The crew spent the day pulling the first-stage engine and fitting the reworked injector.', reworkSay: 'A new injector. That puts the launch back a day.' },
    spots: {
      'fuel-press': { name: 'First-stage fuel tank pressurisation', fault: 'leak', sound: 'The regulator holds steady on the bench, the lines dry.', cue: 'The regulator creeps down a fraction when the line is charged, then holds.' },
      'lox-line': { name: 'First-stage oxygen feed line', fault: 'leak', sound: 'Clean and tight, frost-free after the cold-flow.', cue: 'A patch of frost at one flange after the cold-flow.' },
      interstage: { name: 'Second-stage separation and ignition leads', fault: 'separation', sound: 'Every lead tests good on the bench.', cue: 'One lead reads high on the meter, then normal on the retest.' },
      'second-stage': { name: 'Second-stage acid tank', fault: null, sound: 'The tank holds pressure, no staining.', cue: 'A faint yellow tinge round one weld. Old, perhaps.' },
      'spin-table': { name: 'Third-stage spin table', fault: null, sound: 'Spins up smooth and true.', cue: 'A faint wobble at the top of the spin-up.' },
      sphere: { name: 'The satellite and its Minitrack radio', fault: null, sound: 'Both transmitters on frequency, the batteries charged.', cue: 'One transmitter drifts a little as it warms up.' },
    },
    explanations: {
      nominal: 'She made orbit. Nothing to fix.',
      injector: 'The first-stage injector burned through and she fell back on the pad. Rework the injector.',
      leak: 'A leak in the first stage cost it pressure and it cut off early.',
      separation: 'The second stage never separated or lit properly.',
      holddown: 'She broke loose from the stand: the hold-down fittings failed.',
      unknown: 'Not enough evidence. I want a full-duration firing on the stand.',
    },
    calls: {
      lift: 'Ignition. Liftoff!',
      steady: [{ t: 20, text: 'First stage steady. She\'s pitching over on time.', tone: 'go' }, { t: 145, text: 'First stage burnout. Separation. Second stage has lit!', tone: 'go' }, { t: 420, text: 'Second stage cutoff. Coasting. Third stage is spinning up.', tone: 'go' }],
      burnout: () => 'Third stage burnout. The sphere is away.',
      orbit: (perigee, apogee) => `Minitrack has her! Perigee about ${perigee.toFixed(0)} km, apogee about ${apogee.toFixed(0)} km. She's in orbit!`,
      fail: {
        injector: [{ t: 1, text: 'She\'s lifting... she\'s settling back!' }, { t: 2, text: 'She\'s down on the pad! Fire on the pad!' }],
        leak: [{ t: 20, text: 'First stage steady. Pitching over.' }, { t: 60, text: 'First stage chamber pressure falling! Early cutoff!' }],
        separation: [{ t: 20, text: 'First stage steady. Pitching over.' }, { t: 145, text: 'First stage burnout. No separation signal! No second stage!' }],
        holddown: [{ t: 2, text: 'She\'s off the stand! She\'s loose!' }, { t: 55, text: 'Range safety has cut her engine. She\'s coming down offshore.' }],
      },
    },
    // At the Cape the range reads a round from telemetry and radar: what falls, falls in the Atlantic.
    wreck: {
      injector: ['The pad is blackened and strewn with wreckage. The satellite lies in the scrub nearby, still beeping.', 'The telemetry shows the first-stage fuel tank pressure dropping just before ignition, and the injector temperature climbing.', 'The engine had barely lifted her a metre.'],
      leak: ['Telemetry shows the first-stage tank pressure bleeding off from liftoff onward.', 'Chamber pressure follows it down until the engine stops at 60 seconds.', 'The upper stages fell into the Atlantic unlit.'],
      separation: ['The first stage ran its full burn: telemetry is clean to 145 seconds.', 'There is no separation signal on the record, and no second-stage chamber pressure at all.', 'The radar track shows the whole stack falling into the Atlantic together.'],
      holddown: ['The round came down offshore, a few miles out.', 'At the stand, two hold-down fittings are sheared, their pins pulled through.', 'The engine shows a full-power burn to the cutoff.'],
      nominal: ['Minitrack stations down the range have her signal, orbit after orbit.', 'Telemetry is clean through all three stages.', 'The sphere is up there, beeping.'],
    },
  },

  // NASA's first lunar shots, flown from the Cape. Juno II: the Army's Jupiter with JPL's spinning tub of small solid
  // rockets on top, aimed past the Moon (Pioneers 3 and 4). Ranger: an Atlas with an Agena B that restarts in orbit, and a
  // JPL spacecraft with television cameras, aimed to hit the Moon.
  juno: {
    name: 'Juno II', range: 'JUNO II · PIONEER', crew: ['kowalski', 'delgado'], deep: true,
    track: { title: 'The tracking reports', intro: 'The reports come in from the tracking stations: Mayaguez, Goldstone, and JPL in Pasadena. Morgan pins them up.' },
    inspect: { title: 'Hangar: Juno II and Pioneer', objective: 'Go to the hangar and look over the Jupiter, the cluster of upper stages and the probe before the static firing.',
      intro: 'The Jupiter lies on its transporter, fat and white. Beside it sits JPL\'s tub of small solid rockets, eleven round a ring, three and one inside, and on top the little gold-washed Pioneer cone.' },
    brief: 'The Juno is in the hangar. Look her over, then the Jupiter goes on the stand.',
    stand: { thing: 'Jupiter', pc: [18, 24], long: 'the whole burn on the stand. Shows whether the engine runs to the end or runs out early.', rework: 'Recalibrate the propellant utilisation system', reworkJob: 'Recalibrating the propellant utilisation', reworkDay: 'The crew spent the day recalibrating the Jupiter\'s propellant utilisation and checking the tank levels.', reworkSay: 'A recalibration. That puts the launch back a day.' },
    spots: {
      'lox-feed': { name: 'Jupiter oxygen feed', fault: 'leak', sound: 'Tight and dry after the cold-flow.', cue: 'A rime of frost round one flange that ought to be clear.' },
      'fuel-valve': { name: 'Jupiter fuel prevalve', fault: 'leak', sound: 'Seated, the gaskets new.', cue: 'A faint smell of kerosene at the valve body.' },
      'cluster-leads': { name: 'Upper-stage firing leads', fault: 'separation', sound: 'Every lead tests good on the bench.', cue: 'One lead reads open, then good when you wiggle the plug.' },
      tub: { name: 'Spinning tub bearings', fault: null, sound: 'Spins up quiet and true.', cue: 'A faint rumble at the top of the spin-up.' },
      probe: { name: 'The Pioneer probe and its radio', fault: null, sound: 'The transmitter is on frequency, the batteries charged.', cue: 'The signal drifts a little as the transmitter warms.' },
      guidance: { name: 'Jupiter guidance platform', fault: null, sound: 'The platform holds level through the checkout.', cue: 'One gyro takes a moment longer to settle.' },
    },
    explanations: {
      nominal: 'She got away and passed the Moon. Nothing to fix.',
      depletion: 'The Jupiter ran out of propellant early, so she never reached escape speed. Recalibrate the propellant utilisation.',
      leak: 'A leak cost the Jupiter its pressure and it cut off early.',
      separation: 'The upper stages never fired.',
      holddown: 'She broke loose from the stand: the hold-down fittings failed.',
      unknown: 'Not enough evidence. I want a full-duration firing on the stand.',
    },
    calls: {
      lift: 'Liftoff! The tub is spinning, she\'s climbing clean.',
      steady: [{ t: 30, text: 'Jupiter steady. Pitching over.', tone: 'go' }, { t: 180, text: 'Jupiter cutoff. The cluster has fired, all three stages!', tone: 'go' }],
      burnout: () => 'Fourth stage burnout. The probe is away.',
      final: f => (f.failure ? f.deep.say : `Goldstone has her. ${f.deep.say}`),
      away: f => (f.failure ? 'She\'s away, but she\'s slow. JPL will have the tracking by morning.' : 'Mayaguez has her climbing clean. JPL takes her from here.'),
      fail: {
        leak: [{ t: 30, text: 'Jupiter steady.' }, { t: 60, text: 'Chamber pressure falling! Early cutoff!' }],
        depletion: [{ t: 30, text: 'Jupiter steady. Pitching over.' }, { t: 176, text: 'Jupiter cutoff, four seconds early!' }, { t: 600, text: 'She\'s climbing, but slower than she should be.' }],
        separation: [{ t: 30, text: 'Jupiter steady. Pitching over.' }, { t: 180, text: 'Jupiter cutoff. No ignition on the cluster! The upper stages haven\'t fired!' }],
        holddown: [{ t: 2, text: 'She\'s off the stand! She\'s loose!' }, { t: 55, text: 'Range safety has cut her engine. She\'s coming down offshore.' }],
      },
    },
    wreck: {
      leak: ['Telemetry shows the Jupiter\'s tank pressure bleeding off from liftoff.', 'The engine stopped at 60 seconds and the stack fell into the Atlantic.'],
      depletion: ['Telemetry shows the Jupiter running normally until its chamber pressure falls away just before the planned cutoff.', 'The upper stages all fired, but she never had the speed she needed.'],
      separation: ['The Jupiter ran its full burn: telemetry is clean to cutoff.', 'There is no firing signal from the cluster at all. The upper stages fell into the Atlantic still on the tub.'],
      holddown: ['The round came down offshore, a few miles out.', 'At the stand, two hold-down fittings are sheared, their pins pulled through.'],
      nominal: ['Telemetry is clean through all four stages.', 'Goldstone\'s big dish has the probe\'s signal and follows her out.'],
    },
  },

  ranger: {
    name: 'Ranger', range: 'ATLAS-AGENA B · RANGER', crew: ['kowalski', 'delgado'], deep: true,
    track: { title: 'The tracking reports', intro: 'The reports come in from the Deep Space Network: Johannesburg, Woomera, Goldstone, and JPL in Pasadena. Morgan pins them up.' },
    inspect: { title: 'Hangar AO: Ranger and its Agena', objective: 'Go to the hangar and look over the Atlas, the Agena and the Ranger spacecraft before the Agena\'s static firing.',
      intro: 'The Atlas is a steel balloon, held round by its own pressure. The Agena lies beside it, and in the clean room the Ranger stands on its legs of solar panel, its six television cameras under a cone.' },
    brief: 'The Atlas, the Agena and the Ranger are in the hangar. Look them over, then the Agena goes on the stand.',
    stand: { thing: 'Agena', pc: [17, 23], long: 'the whole Agena burn on the stand.', rework: 'Rework the Agena\'s restart system', reworkJob: 'Reworking the Agena restart', reworkDay: 'The crew spent the day reworking the Agena\'s restart system.', reworkSay: 'An Agena rework. That puts the launch back a day.' },
    spots: {
      'atlas-lox': { name: 'Atlas oxygen feed', fault: 'leak', sound: 'Tight and dry after the cold-flow.', cue: 'A patch of frost at a flange that ought to be clear.' },
      'atlas-press': { name: 'Atlas tank pressurisation', fault: 'leak', sound: 'The tank holds its pressure through the night.', cue: 'The pressure has crept down a fraction overnight.' },
      'camera-hv': { name: 'Camera high-voltage supply', fault: 'camera', sound: 'Runs clean for an hour in the vacuum chamber.', cue: 'A faint tick from the supply under vacuum. Arcing, or a relay.' },
      'camera-timer': { name: 'Camera warm-up timer', fault: null, sound: 'Fires on the second, every time.', cue: 'One run fired a fraction late.' },
      panels: { name: 'Solar panels', fault: null, sound: 'Both panels deploy and give full current.', cue: 'One panel gives a little less current under the lamps.' },
      midcourse: { name: 'Midcourse motor', fault: null, sound: 'Valves cycle clean.', cue: 'One valve is slow to close, once.' },
    },
    explanations: {
      nominal: 'She hit the Moon and the pictures came back. Nothing to fix.',
      agena: 'The Agena never restarted in orbit. Rework the restart system.',
      camera: 'The camera supply failed: no pictures. Every supply goes through the vacuum chamber.',
      miss: 'The midcourse burn left her too far off, and she missed the Moon. Wait for the best tracking fix before the burn.',
      leak: 'A leak cost the Atlas its pressure and it cut off early.',
      holddown: 'She broke loose from the stand: the hold-down fittings failed.',
      unknown: 'Not enough evidence. I want a full-duration firing on the stand.',
    },
    calls: {
      lift: 'Liftoff! The Atlas is climbing.',
      steady: [{ t: 130, text: 'Booster engines off and away. Sustainer steady.', tone: 'go' }, { t: 300, text: 'Atlas cutoff. Agena has separated and lit.', tone: 'go' }, { t: 600, text: 'Agena restart! She\'s burning for the Moon!', tone: 'go' }],
      burnout: () => 'Agena cutoff. Ranger has separated, panels out.',
      final: f => (f.failure ? f.deep.say : `Goldstone has her. ${f.deep.say}`),
      away: () => 'Ranger is on her way to the Moon. JPL takes her from here.',
      fail: {
        leak: [{ t: 30, text: 'Atlas steady.' }, { t: 80, text: 'Sustainer pressure falling! She\'s lost thrust!' }],
        agena: [{ t: 130, text: 'Booster engines off and away.' }, { t: 300, text: 'Agena has lit. Parking orbit.' }, { t: 600, text: 'No Agena restart! She\'s stuck in the parking orbit!' }],
        holddown: [{ t: 2, text: 'She\'s off the stand! She\'s loose!' }, { t: 55, text: 'Range safety has cut her engine. She\'s coming down offshore.' }],
      },
    },
    wreck: {
      leak: ['Telemetry shows the Atlas tank pressure bleeding off from liftoff.', 'The sustainer stopped at 80 seconds and the stack fell into the Atlantic.'],
      agena: ['The Atlas and the Agena\'s first burn were clean.', 'At the restart, the Agena\'s chamber pressure never rose. She stayed in the parking orbit and came down within days.'],
      camera: ['Every stage worked, and the Ranger flew true all the way.', 'The cameras\' high-voltage supply shows a flicker early in the flight, then nothing. When the cameras were commanded on, there was no video at all.'],
      holddown: ['The round came down offshore, a few miles out.', 'At the stand, two hold-down fittings are sheared, their pins pulled through.'],
      miss: ['Every stage worked, and the Ranger\'s systems ran clean all the way.', 'The tracking after the midcourse burn put her off the Moon\'s edge. The aiming error was never taken out.'],
      nominal: ['Every stage worked, and the Ranger flew true all the way.', 'The cameras came on as planned and sent pictures until the moment she hit.'],
    },
  },

  // Mercury-Redstone at Launch Complex 5: the Army's Redstone, stretched and given an escape tower and a Mercury capsule on
  // top. Built by Chrysler for the Marshall centre. Nobody in Mercury Control inspects her: Marshall's crew checks her out.
  // The spots are what that crew's checkout covers; what you see of her is the telemetry and the trajectory plot.
  redstone: {
    name: 'Mercury-Redstone', range: 'MERCURY-REDSTONE', crew: ['kowalski', 'delgado'], crewed: true,
    brief: 'The booster and the capsule are on the pad. Work the sims, then we fly.',
    spots: {
      'tail-plug': { name: 'Tail plug umbilicals', fault: 'plug', sound: 'Both plugs pull free together on the test lanyard.', cue: 'The control cable is cut a few inches shorter than the power cable.' },
      autopilot: { name: 'Control compartment and autopilot', fault: 'control', sound: 'The gyros spin up clean and hold their null.', cue: 'One gyro drifts a hair before it settles.' },
      'lox-valve': { name: 'Main oxygen valve', fault: 'lox', sound: 'Seated and dry after the cold-flow.', cue: 'A crust of frost at the flange that ought to be clear.' },
      peroxide: { name: 'Hydrogen peroxide turbine feed', fault: null, sound: 'The feed line is clean and tight.', cue: 'A pale stain under one union, old perhaps.' },
    },
    explanations: {
      nominal: 'She flew as planned. Nothing to fix.',
      plug: 'The tail plug came out in the wrong order and shut the engine down. Fix the disconnect sequence.',
      control: 'The control system failed and she went off her line.',
      lox: 'A propellant valve leaked and cut the burn short.',
      thrust: 'The thrust controller let her burn too hot and she ran dry early.',
      unknown: 'Not enough evidence to call it. Ask Marshall for a full teardown.',
    },
  },

  // Mercury-Atlas at Launch Complex 14: Convair's Atlas D with a Mercury capsule. Convair checks out the Atlas and McDonnell
  // the capsule, in Hangar S. The spots are what those crews' checkouts cover.
  atlas: {
    name: 'Mercury-Atlas', range: 'MERCURY-ATLAS', crew: ['kowalski', 'delgado'], crewed: true,
    brief: 'The Atlas and the capsule are on the pad. Work the sims, then we fly.',
    spots: {
      programmer: { name: 'Atlas autopilot and programmer', fault: 'guidance', sound: 'Every relay steps through the profile on time.', cue: 'One relay chatters once before it closes.' },
      'sustainer-feed': { name: 'Sustainer propellant feed', fault: 'shortburn', sound: 'The feed lines are tight and the bellows clean.', cue: 'A bright rub mark on one line where it crosses a bracket.' },
      'heat-shield': { name: 'Heat shield and landing-bag latches', fault: 'shield', sound: 'All latches seated, the shield snug against the bag.', cue: 'One latch takes a second push to seat.' },
      scanners: { name: 'Horizon scanners', fault: 'scanner', sound: 'Both scanners find the heated horizon and hold it.', cue: 'One scanner hunts a little before it settles.' },
    },
    explanations: {
      nominal: 'She flew as planned. Nothing to fix.',
      guidance: 'The Atlas guidance failed and she went off her line.',
      shortburn: 'The Atlas sustainer cut off early.',
      shield: 'The heat shield really was loose. Fix the latches and the landing bag.',
      scanner: 'A horizon scanner was bad: the automatic system held the wrong attitude and burned the fuel.',
      unknown: 'Not enough evidence to call it. Ask for a full teardown.',
    },
  },

  // Gemini on the Titan II, from 1965: Martin's missile, its propellants burning on contact, and McDonnell's two-man spacecraft.
  titan: {
    name: 'Gemini-Titan', range: 'GEMINI-TITAN II', crew: ['kowalski', 'delgado'], crewed: true, maker: 'The Titan is Martin\'s. Your job is the spacecraft.',
    brief: 'The Titan and the spacecraft are on the pad at Complex 19. Work the sims, then we fly.',
    spots: {
      'titan-autopilot': { name: 'Titan autopilot and gimbal actuators', fault: 'titanctl', sound: 'Every actuator follows its command on the bench run.', cue: 'One actuator lags its command by a hair.' },
      'stage2-engine': { name: 'Second-stage engine and feed', fault: 'stage2', sound: 'The feed lines are tight and the injector clean.', cue: 'A fleck of debris on the injector screen.' },
      'fuel-cells': { name: 'Fuel cells and their oxygen supply', fault: 'fuelcell', sound: 'Both sections come up on the ground power check.', cue: 'The oxygen supply heater cycles more often than it should.' },
      hatch: { name: 'Hatches and latches', fault: 'hatch', sound: 'Both hatches close and latch with one hand.', cue: 'The right hatch needs a shove to latch.' },
      'tail-plug': { name: 'Titan tail plugs and umbilicals', fault: 'shutdown', sound: 'Every plug seats with its full pull-out force.', cue: 'One tail plug comes away with less force than the rest.' },
      thrusters: { name: 'Orbit attitude thrusters and their wiring', fault: 'thruster', sound: 'Each thruster fires on command, and only on command.', cue: 'Thruster 8 ticks once on the bench with no command.' },
      computer: { name: 'Guidance computer', fault: 'computer', sound: 'The computer runs its self-test clean.', cue: 'A power transient makes the computer drop off the line once on the bench.' },
    },
    explanations: {
      nominal: 'She flew as planned. Nothing to fix.',
      titanctl: 'The Titan\'s guidance failed and she went off her line.',
      stage2: 'The Titan\'s second stage cut off early.',
      fuelcell: 'The fuel cells\' oxygen supply failed: its heater. Fix it before the next long flight.',
      hatch: 'The hatch latch was bad. Rework the latch mechanism.',
      computer: 'The guidance computer failed: a power transient. Fix its supply.',
      shutdown: 'A tail plug dropped out early and shut the engines down on the pad.',
      thruster: 'A thruster stuck open: a short in its wiring. Give each thruster its own breaker.',
      navdata: 'The ground sent a wrong number to the spacecraft\'s computer. Check every update independently.',
      unknown: 'Not enough evidence to call it. Ask for a full teardown.',
    },
  },

  // Apollo on the Saturn V, from 1967: Boeing's first stage, North American's second and the command and service module,
  // Douglas's third, IBM's instrument unit, and Grumman's lunar module.
  saturn5: {
    name: 'Apollo-Saturn V', range: 'APOLLO-SATURN V', crew: ['kowalski', 'delgado'], crewed: true, maker: 'The stages are Boeing\'s, North American\'s and Douglas\'s, the lander Grumman\'s. Your job is to know what they will do.',
    brief: 'The Saturn V is on Pad 39A. Work the sims, then we fly.',
    spots: {
      'f1-engines': { name: 'First-stage F-1 engines and propellant lines', fault: 'pogo', sound: 'The lines and the prevalves are as drawn.', cue: 'The stage\'s ground vibration test shows a resonance near five cycles a second.' },
      's2-engines': { name: 'Second-stage J-2 engines and igniter lines', fault: 'j2', sound: 'Every igniter line holds pressure on the leak check.', cue: 'One igniter line\'s braided cover is scuffed where it flexes.' },
      iu: { name: 'Instrument unit: the Saturn\'s guidance', fault: 'saturnctl', sound: 'The platform and computer run the profile clean.', cue: 'The platform gimbal draws a little more current than its twin.' },
      's4b': { name: 'Third-stage S-IVB restart system', fault: 'relight', sound: 'The restart bottles hold pressure and the chilldown valves cycle.', cue: 'The helium bottle pressure creeps down overnight.' },
      sps: { name: 'Service propulsion engine', fault: 'sps', sound: 'The engine\'s valves and the propellant gauging check out.', cue: 'A ball valve actuator is slow to close on the bench.' },
      'o2-tanks': { name: 'Service module oxygen tanks', fault: 'tank', sound: 'Both tanks fill and empty as they should.', cue: 'Tank two would not empty normally after the countdown test; it was boiled dry with its heaters.' },
      'cabin-wiring': { name: 'Command module wiring and cabin materials', fault: 'cabin', sound: 'The wiring is dressed and the cabin clear of loose material.', cue: 'Chafed insulation on a wire bundle under the couches, and a lot of Velcro.' },
      'lm-computer': { name: 'Lunar module guidance computer and rendezvous radar', fault: 'alarm', sound: 'The computer runs a full descent on the bench without a hiccup.', cue: 'With the rendezvous radar switched on during the descent run, the computer\'s load climbs near its limit.' },
      'lm-ascent': { name: 'Lunar module ascent engine', fault: 'ascent', sound: 'The ascent engine\'s injector and valves pass their checks.', cue: 'An injector orifice shows a burr under the lens.' },
      chutes: { name: 'Command module parachutes and their reaction control dump', fault: 'chute', sound: 'The risers and reefing cutters are as drawn.', cue: 'A riser runs close to a reaction control vent.' },
    },
    explanations: {
      nominal: 'She flew as planned. Nothing to fix.',
      saturnctl: 'The Saturn\'s guidance failed and she went off her line.',
      j2: 'J-2 engines shut down early: the igniter lines.',
      s2cutoff: 'The second stage cut off early, short of orbit.',
      pogo: 'Pogo: the first stage shook the stack. Damp the propellant lines.',
      relight: 'The S-IVB would not restart. Fix its restart system.',
      sps: 'The service propulsion engine was faulty.',
      tank: 'An oxygen tank failed in the service module.',
      cabin: 'The cabin wiring shorted in pure oxygen. Rewire, and change the cabin atmosphere.',
      alarm: 'The lander\'s computer was overloaded by the rendezvous radar.',
      ascent: 'The lander\'s ascent engine underperformed.',
      chute: 'A main parachute failed.',
      lightning: 'Lightning struck the vehicle and knocked the spacecraft\'s power off the line.',
      unknown: 'Not enough evidence to call it. Ask for a full teardown.',
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
  liner: 'the chamber liner came away and the wall burned through',
  cutoff: 'the turbine leaked steam and the engine cut off early', fin: 'a fin fitting cracked and a fin came off', holddown: 'the hold-down fittings let go on the stand',
  plug: 'the tail plug came out in the wrong order and shut the engine down', control: 'the control system failed and she went off her line', lox: 'the oxygen valve leaked and the burn stopped early', thrust: 'the thrust controller let her burn too hot',
  guidance: 'the Atlas autopilot drifted and took her off her line', shortburn: 'the Atlas sustainer cut off early', shield: 'the heat shield was loose', scanner: 'a horizon scanner was bad and the automatic system held the wrong attitude', titanctl: 'the Titan autopilot drifted and took her off her line', stage2: 'the Titan second stage cut off early', fuelcell: 'the fuel cells\' oxygen supply failed', hatch: 'the hatch latch was bad', computer: 'the guidance computer failed', navdata: 'the ground sent a wrong number to the spacecraft', shutdown: 'a tail plug dropped out and shut the Titan down on the pad', thruster: 'a thruster stuck open and set her tumbling', saturnctl: 'the Saturn\'s guidance failed', j2: 'J-2 engines shut down early', s2cutoff: 'the second stage cut off early', pogo: 'the first stage shook the stack in pogo', relight: 'the S-IVB would not restart', sps: 'the service propulsion engine failed', tank: 'an oxygen tank failed', cabin: 'the cabin wiring shorted in oxygen', alarm: 'the lander\'s computer overloaded', ascent: 'the ascent engine underperformed', chute: 'a main parachute failed', lightning: 'lightning struck her',
  injector: 'the first-stage injector burned through and she fell back on the pad',
  depletion: 'the Jupiter ran out of propellant early', agena: 'the Agena would not restart in orbit', camera: 'the camera high-voltage supply failed', miss: 'the midcourse burn left too much aiming error and she missed the Moon',
};
export const FAULT_AT_SPOT = { weld: 'A bad weld', leak: 'A leak', vanes: 'A cracked jet vane', separation: 'A faulty separation bolt lead', fin: 'A cracked fin fitting', holddown: 'A flawed hold-down fitting', camera: 'A camera supply that arcs in vacuum', plug: 'Tail plug cables cut to different lengths', control: 'A drifting autopilot gyro', lox: 'A leaking oxygen valve', guidance: 'A programmer relay that sticks', shortburn: 'A sustainer feed line that chafes', shield: 'A landing-bag latch that does not seat', scanner: 'A horizon scanner out of calibration', titanctl: 'A lagging gimbal actuator', stage2: 'Debris at the second-stage injector', fuelcell: 'A failing fuel-cell oxygen heater', hatch: 'A hatch latch that binds', computer: 'A guidance computer that drops off the line', shutdown: 'A tail plug that pulls out too easily', thruster: 'A thruster wired so it can stick open', saturnctl: 'A guidance platform gimbal running hot', j2: 'An igniter line that can crack in vacuum', pogo: 'Propellant lines tuned to the stage\'s own resonance', relight: 'A restart bottle that leaks down', sps: 'A sticky service engine valve', tank: 'An oxygen tank with heater switches burned shut', cabin: 'Chafed wiring in a pure-oxygen cabin', alarm: 'A rendezvous radar switch that loads the lander\'s computer', ascent: 'A burred ascent-engine injector', chute: 'A parachute riser exposed to the thruster dump' };
