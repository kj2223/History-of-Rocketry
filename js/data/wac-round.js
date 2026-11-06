// What the player can see and say about a WAC Corporal round: the spots on the stage and how each looks, and the
// explanations they can put forward at the review. Content only. Which spots are really bad is decided in truth/round.js.

// The spots the player can look at in the hangar. fault: the real defect when present; cue: what a careful look shows.
// A real fault shows its cue most of the time; a sound part sometimes shows something that looks like one.
export const SPOTS = {
  'weld-fwd': { name: 'Forward tank weld', fault: 'weld', sound: 'The bead is even all the way round.', cue: 'A hairline of discolouration runs along part of the seam.' },
  'weld-mid': { name: 'Tank girth weld', fault: 'weld', sound: 'Clean, regular ripples in the bead.', cue: 'The bead thins out and there is a pinhole you could miss.' },
  'weld-aft': { name: 'Aft tank weld', fault: 'weld', sound: 'Smooth and bright, ground flush.', cue: 'Spatter and a slight undercut at the edge of the bead.' },
  'fitting': { name: 'Acid feed fitting', fault: 'leak', sound: 'Dry to the touch, safety wire in place.', cue: 'A faint green stain under the union nut.' },
  'pressure': { name: 'Helium pressurisation line', fault: 'leak', sound: 'Tight, no hiss with the line charged.', cue: 'You think you hear a faint hiss, but the hangar is noisy.' },
  'fins': { name: 'Fin attachment', fault: null, sound: 'Rivets tight, fins true.', cue: 'One fin looks a degree off true by eye.' },
};

// The explanations the player can put forward at the review.
export const EXPLANATIONS = {
  nominal: 'The round flew as planned. Nothing to fix.',
  ignition: 'A rough ignition. The igniter needs reworking.',
  weld: 'A tank weld let go under load.',
  leak: 'A propellant leak starved the motor.',
  unknown: 'Not enough evidence. I want another static firing.',
};
