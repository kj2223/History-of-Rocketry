// RECOVERY: what a payload goes through on the way home after a sounding-rocket flight, step by step. Each step has a reading
// and a limit, so the pre-flight estimate can show where the risk is and the log can say which step failed and why. No DOM.
//
//   1. Separation at apogee: the nose cone has to come off the spent rocket.
//   2. Re-entry: it falls back into the air and heats up, against the heat protection's rating.
//   3. The parachute opens low down; the opening load (speed squared) is compared with the chute's strength.
//   4. The search: finding it is the one step left to luck, and the team gets better at it with every recovery.
//
// S.recn counts payloads recovered, for the search experience.
import { S } from '../core/state.js';

const GRAVITY = 9.81, SCALE_HEIGHT = 8500;
const airDensityRatio = altitude => Math.exp(-altitude / SCALE_HEIGHT);
const has = (airframe, ...ids) => ids.some(id => airframe.pk.includes(id));

// 1. SEPARATION: 80% of nose cones come away cleanly; the separation mechanism makes it 97%.
const SEPARATION = { plain: .8, mechanism: .97 };

// 2. RE-ENTRY. The nose cone meets the thick air at about 25 km, at the speed it fell from apogee plus the horizontal speed it kept.
// Heating grows with the cube of speed: as a share of the rating (spec.rv, the re-entry speed the heat protection takes),
// nothing burns up below 90%, and burn-up is certain from 150%.
const THICK_AIR_ALTITUDE = 25000;
const HEAT_SAFE = .9, HEAT_CERTAIN_LOSS = 1.5;

// 3. THE PARACHUTE opens at 3 km. The nose cone falls at its terminal speed there (about 140 m/s), or slower if it never fell far
// enough to reach it. A ballute slows it by 30% before the chute opens. Chute strength (the opening speed it is built for):
// 150 m/s for the nose-cone parachute, 220 m/s for a ribbon parachute or a re-entry capsule's chutes.
// Opening load = (speed / strength) squared: under 75% it holds (bar 5% rigging failures); above, the risk climbs to certain at 135%.
const CHUTE_OPENING_ALTITUDE = 3000;
const NOSE_CONE_TERMINAL_SPEED = 120; // at sea level
const BALLUTE_SLOWING = .7;
const CHUTE_STRENGTH = { plain: 150, ribbon: 220 };
const CHUTE_SAFE_LOAD = .75, CHUTE_CERTAIN_LOSS_LOAD = 1.35, RIGGING_FAILURE = .05;

// 4. THE SEARCH. Base odds 20%, plus the search odds the payload & recovery research adds (spec.rc: the parachute itself 35%,
// radio beacon 12%, sea-dye marker 8% and so on), recovery force 20%, Recovery Controller 15%, tracking ship 5%.
// A payload over 80 km downrange is 20% harder to find without the recovery force or the ship.
// Each payload recovered teaches the search teams 2%, up to 20%. Never better than 97%.
const SEARCH_BASE = .2, SEARCH_EXPERIENCE_EACH = .02, SEARCH_EXPERIENCE_MAX = .2, SEARCH_BEST = .97;

const clamp = value => Math.max(0, Math.min(1, value));

// The plan for one flight (a real flight or the pre-flight estimate's), from its apogee, horizontal speed and downrange distance.
// Returns { system: false } without a parachute aboard, otherwise each step's reading and its chance of success, and the overall chance.
export function recoveryPlan(flight) {
  const airframe = flight.airframe, spec = flight.spec;
  if (!has(airframe, 'chute', 'ribbon', 'ms_rec', 'ms_disc')) return { system: false, chance: 0 };
  const separation = has(airframe, 'psep') ? SEPARATION.mechanism : SEPARATION.plain;

  const fallSpeed = Math.sqrt(2 * GRAVITY * Math.max(0, flight.peakAltitude - THICK_AIR_ALTITUDE));
  const reentrySpeed = Math.hypot(fallSpeed, flight.peakHorizontalSpeed || 0);
  const heat = Math.pow(reentrySpeed / spec.rv, 3);
  const heatSurvival = 1 - clamp((heat - HEAT_SAFE) / (HEAT_CERTAIN_LOSS - HEAT_SAFE));

  const terminalSpeed = NOSE_CONE_TERMINAL_SPEED / Math.sqrt(airDensityRatio(CHUTE_OPENING_ALTITUDE));
  const openSpeed = Math.min(terminalSpeed, Math.sqrt(2 * GRAVITY * Math.max(0, flight.peakAltitude - CHUTE_OPENING_ALTITUDE))) * (has(airframe, 'ball') ? BALLUTE_SLOWING : 1);
  const chuteStrength = has(airframe, 'ribbon', 'ms_rec', 'ms_disc') ? CHUTE_STRENGTH.ribbon : CHUTE_STRENGTH.plain;
  const chuteLoad = Math.pow(openSpeed / chuteStrength, 2);
  const chuteSurvival = (1 - RIGGING_FAILURE) * (1 - clamp((chuteLoad - CHUTE_SAFE_LOAD) / (CHUTE_CERTAIN_LOSS_LOAD - CHUTE_SAFE_LOAD)));

  const longRange = flight.downrange > 80000 && !S.fac.recov && !S.fac.ship;
  const search = Math.max(0, Math.min(SEARCH_BEST, SEARCH_BASE + spec.rc
    + (S.fac.recov ? .2 : 0) + (S.crew.rec ? .15 : 0) + (S.fac.ship ? .05 : 0) - (longRange ? .2 : 0)
    + Math.min(SEARCH_EXPERIENCE_MAX, (S.recn || 0) * SEARCH_EXPERIENCE_EACH)));

  return {
    system: true, separation, reentrySpeed, heat, heatSurvival, openSpeed, chuteStrength, chuteLoad, chuteSurvival, search,
    chance: separation * heatSurvival * chuteSurvival * search,
  };
}

// THE DESCENT (separation, re-entry, the parachute) is decided once, when the payload starts down from apogee, so the recovery
// crew can call each step as it happens (rules/callouts.js). Returns { plan, failed: the step that failed (sep, heat, chute) or null }.
export function rollDescent(flight) {
  if (flight.descent) return flight.descent;
  const plan = recoveryPlan(flight);
  let failed = null;
  if (!plan.system) failed = 'none';
  else if (Math.random() > plan.separation) failed = 'sep';
  else if (Math.random() > plan.heatSurvival) failed = 'heat';
  else if (Math.random() > plan.chuteSurvival) failed = 'chute';
  return flight.descent = { plan, failed };
}

// After landing: the descent as rolled, then the search (with the final downrange distance).
// Returns { recovered, step: the step that failed (none, sep, heat, chute, search) or null, text: what happened }.
export function recoverPayload(flight) {
  const { plan, failed } = rollDescent(flight), search = recoveryPlan(flight).search;
  if (failed == 'none') return { recovered: false, step: 'none', text: 'No recovery system aboard. The payload was destroyed on impact.' };
  if (failed == 'sep') return { recovered: false, step: 'sep', text: 'The nose cone failed to separate and came down with the rocket.' };
  if (failed == 'heat') return { recovered: false, step: 'heat', text: `The nose cone burned up on re-entry: it came in at about ${Math.round(plan.reentrySpeed)} m/s, heating ${Math.round(plan.heat * 100)}% of what its heat protection takes.` };
  if (failed == 'chute') return { recovered: false, step: 'chute', text: plan.chuteLoad > CHUTE_SAFE_LOAD ? `The parachute opened at about ${Math.round(plan.openSpeed)} m/s, a ${Math.round(plan.chuteLoad * 100)}% opening load for a chute built for ${plan.chuteStrength} m/s, and shredded.` : 'The parachute tangled in its rigging and streamed.' };
  if (Math.random() > search) return { recovered: false, step: 'search', text: `The parachute opened, but the search teams could not find the payload (${Math.round(search * 100)}% search odds).` };
  S.recn = (S.recn || 0) + 1;
  return { recovered: true, step: null, text: `Payload recovered intact${S.fac.recov ? ' by the recovery force' : ''}${S.crew.rec ? ', coordinated by REC' : ''}. Chute opened at about ${Math.round(plan.openSpeed)} m/s.` };
}
