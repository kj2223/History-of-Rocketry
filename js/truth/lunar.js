// THE HIDDEN TRUTH OF A LUNAR SHOT AFTER IT LEAVES THE CAPE: where she is really aimed, whether a Jupiter that ran short
// falls back, what the midcourse burn leaves of the aiming error, and whether the cameras work at the end. No DOM.
// The game shows the player only what the tracking stations report (js/lunar.js copies it into g.lunar).
import { draw, normal } from '../core/rng.js';
import { CAMERA_FAILURE } from './round.js';

export const MOON_KM = 384000,
  MOON_RADIUS = 1737;
// Hours from injection to the Moon, as the tracking shows it (Pioneer 4 passed the Moon after about 41 hours; Ranger 7
// hit after about 68).
export const CRUISE_HOURS = { juno: 40, ranger: 66 };
// Ranger's midcourse motor can take out this much aiming error at the Moon, in km, if it waits for the second tracking fix.
export const LATE_REACH = 3000;
// Hours into the cruise of the first tracking fix (when an early midcourse can be made) and of the second.
export const FIRST_FIX = 4,
  SECOND_FIX = 16;
// How far out the first fix can be, in km at the Moon (one standard deviation).
export const FIX_ERROR = 1000;
// Cameras on this many minutes before impact: more minutes, more pictures, and longer for a weak supply to arc over.
export const CAMERA_LEADS = [30, 20, 10];
const CAMERA_STRESS = { 30: 1.3, 20: 1, 10: 0.7 },
  PICTURES_A_MINUTE = 250;

// At injection, decided at liftoff with the rest of the flight. failure: null, 'depletion' (she is short of escape speed
// and will fall back) or 'camera' (a camera fault nobody could have found). Three physical draws.
export function injection(round, failure) {
  const ph = round.rng.physical,
    a = draw(ph),
    b = draw(ph),
    c = normal(ph);
  return {
    phase: 'cruise',
    vehicle: round.vehicle,
    aim: round.vehicle === 'ranger' ? 3000 * c : 40000 + 40000 * a, // km off the aim point at the Moon; Pioneer's planned pass
    fallsBack: failure === 'depletion',
    peak: 95000 + 15000 * b, // a Jupiter that ran short climbs to here and falls back
    hiddenCamera: failure === 'camera',
    fix: null,
    midcourse: null,
    residual: null,
    done: false,
  };
}

// The first tracking fix: where the stations think she is heading, with their own error. One observation draw.
export function firstFix(round) {
  const d = round.flight.deep;
  if (d.fix == null) d.fix = d.aim + FIX_ERROR * normal(round.rng.observation);
  return d.fix;
}

// The midcourse burn. 'now': on the first fix, early, while a small burn moves the aim a long way, but the fix is rough.
// 'wait': on the second fix, which is good, but late, so the motor can only take out LATE_REACH km. One physical draw.
export function midcourse(round, when) {
  const d = round.flight.deep,
    n = normal(round.rng.physical);
  d.midcourse = when;
  if (when === 'now') d.residual = d.aim - d.fix + 300 * n;
  else d.residual = Math.sign(d.aim) * Math.max(0, Math.abs(d.aim) - LATE_REACH) + 120 * n;
  return d.residual;
}

// The tracking's fix after the midcourse burn (or, for a Pioneer, after a day of tracking): where she will reach the Moon,
// in km from the aim point, as the stations see it. One observation draw.
export function finalFix(round) {
  const d = round.flight.deep;
  if (d.predicted == null)
    d.predicted = Math.abs(
      (d.residual ?? d.aim) + (d.vehicle === 'ranger' ? 150 : 3000) * normal(round.rng.observation),
    );
  return d.predicted;
}

// How far from Earth she is (km) at hour h of the cruise, as the tracking shows it. A Jupiter that ran short climbs to its
// peak and falls back over twice the climb.
export const FALL_PEAK_HOUR = 18;
export function distanceAt(d, h) {
  if (d.fallsBack) {
    const u = Math.min(2, h / FALL_PEAK_HOUR);
    return d.peak * (1 - (1 - u) ** 2);
  }
  return MOON_KM * Math.min(1, h / CRUISE_HOURS[d.vehicle]) ** 0.7;
}

// The encounter. Ranger: a hit if the residual error is inside the Moon's radius; the cameras then work or not, the
// chance of an arc-over growing with the minutes they run. Pioneer: the pass at the distance she was aimed. Sets the
// flight's failure and what the tracking stations say.
export function encounter(round, lead = 20) {
  const f = round.flight,
    d = f.deep,
    ph = round.rng.physical;
  const km = n => Math.round(n / 100) * 100;
  let failure = null,
    say;
  if (d.vehicle === 'juno') {
    say = `Passed the Moon at about ${(Math.round(d.aim / 1000) * 1000).toLocaleString('en-US')} km and went on into orbit round the Sun.`;
  } else {
    const off = Math.abs(d.residual ?? d.aim);
    const fault = Object.values(round.faults).includes('camera');
    const arc = d.hiddenCamera || (fault && draw(ph) < Math.min(0.95, CAMERA_FAILURE * CAMERA_STRESS[lead]));
    d.pictures = arc ? 0 : Math.round(lead * PICTURES_A_MINUTE * (0.95 + 0.1 * draw(ph)));
    d.lead = lead;
    if (off > MOON_RADIUS) {
      failure = 'miss';
      d.pictures = 0;
      say = `She missed the Moon by about ${km(off - MOON_RADIUS).toLocaleString('en-US')} km and went on past it into orbit round the Sun.`;
    } else if (arc) {
      failure = 'camera';
      say = 'She hit the Moon, but the cameras never sent a picture: the high-voltage supply had failed.';
    } else
      say = `Hit the Moon ${off < 100 ? 'within 100 km of' : `about ${km(off).toLocaleString('en-US')} km from`} the aim point, sending ${d.pictures.toLocaleString('en-US')} pictures in the last ${lead} minutes.`;
  }
  f.failure = failure;
  f.failAt = failure ? Math.round(CRUISE_HOURS[d.vehicle] * 3600) : null;
  d.say = say;
  d.text = failure ? `Lost: ${say[0].toLowerCase()}${say.slice(1)}` : say;
  d.done = true;
  return f;
}

// A Jupiter that ran short: what the stations say when she turns back.
export function fallBack(round) {
  const d = round.flight.deep;
  d.say = `The Jupiter ran out early. She climbed to about ${(Math.round(d.peak / 1000) * 1000).toLocaleString('en-US')} km and fell back to Earth.`;
  d.text = `Lost: ${d.say[0].toLowerCase()}${d.say.slice(1)}`;
  d.done = true;
  return d;
}
