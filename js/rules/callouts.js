// THE CREW'S CALLOUTS: each launch-crew station on console calls its part of the flight on the loop, in the style of the
// launch loops of the time: call sign first, short, numbers first. A station only calls what it can see: a call about a part
// is made only when that part channel is being watched (rules/telemetry.js). Called once per second of a flight you watch;
// the launch director's flights run quietly. No DOM.
//
// The latest call also shows as a short bubble over its station in the pad room, one voice on the loop at a time:
// flight.bubbles = { station: { t: text, c: 'go' | 'no' | 'wn' } }. flight.lastCalls keeps every station's latest, for after the flight.
//
// THE PLAN: a watched flight carries its pre-flight prediction (flight.prediction, from rules/flight.js previewFlight). FIDO
// calls the track against it at cutoff and the apogee against the planned one; RSO calls the impact against the planned one.
// When the player set a plan (flight.plan), REC puts the helicopters on station at the planned impact before liftoff.
//
// THE FLIGHT'S EVENTS (flight.events, rules/flight.js): PROP calls ignition, the thrust climbing in thin air, staging ignition and
// the cutoff against the planned time; the Test Conductor calls the rocket clear of the launcher; FIDO (or the RSO before there
// is a FIDO) calls Mach one and max Q; BSTR calls booster cutoff and separation; TLM calls the payload's g when it is watched.
import { PAYLOADS } from '../data/launch.js';
import { STATIONS } from '../data/launch-site.js';
import { S, log } from '../core/state.js';
import { rollDescent, onPlannedStation } from './recovery.js';
import { FAILURE_WARNINGS, warningLevel } from './telemetry.js';
import { burnSeconds, isPowered, hasEvent } from './flight.js';

const GRAVITY = 9.81;
const km = metres => `${(metres / 1000).toFixed(1)} kilometres`;
// Where the flight is against the plan at this second: { altitude, range } as shares off the planned figures (0.1 = 10% over),
// range null while the plan has barely left the pad. Null without a prediction, below 1 km on the plan (where small
// differences are large shares) or past the plan's end.
export function offPlan(flight) {
  const path = flight.prediction && flight.prediction.path, index = flight.time - 1;
  if (!path || index >= path.altitude.length || path.altitude[index] < 1000) return null;
  const plannedRange = path.downrange[index];
  return { altitude: flight.altitude / path.altitude[index] - 1, range: plannedRange > 500 ? flight.downrange / plannedRange - 1 : null };
}
// FIDO's words for being off the plan: 'high', 'low and long' and so on, '' when inside the prediction's spread, null when
// there is nothing to compare (see offPlan).
export function offPlanWords(flight) {
  const off = offPlan(flight), spread = flight.prediction ? flight.prediction.uncertainty : 0;
  if (!off) return null;
  const words = [];
  if (Math.abs(off.altitude) > spread) words.push(off.altitude > 0 ? 'high' : 'low');
  if (off.range != null && Math.abs(off.range) > spread) words.push(off.range > 0 ? 'long' : 'short');
  return words.join(' and ');
}
// Where a coasting flight will come down, by a simple ballistic sum from where it is now.
export const predictedImpact = flight => flight.downrange + flight.horizontalSpeed * (flight.verticalSpeed + Math.sqrt(flight.verticalSpeed ** 2 + 2 * GRAVITY * Math.max(0, flight.altitude))) / GRAVITY;

// The warning calls, by channel and sign (rules/telemetry.js FAILURE_WARNINGS): [station, the call, the bubble].
const WARNING_CALLS = {
  pc: { rough: ['prop', 'Chamber pressure oscillating!', 'PC ROUGH'], fade: ['prop', 'Chamber pressure falling off!', 'PC DROPPING'] },
  skin: { climb: ['tlm', 'Skin temperature past the limit and climbing!', 'SKIN HOT'] },
  q: { rough: ['bstr', 'Flutter on the strain gauges!', 'FLUTTER'], climb: ['bstr', 'Loads in the red!', 'LOADS RED'] },
};

export function crewCallouts(flight) {
  const said = flight.called || (flight.called = {}), watching = id => (flight.watch || []).includes(id);
  // Each call is made once (key), and only with its station on console. bubble: the short form shown over the station.
  const call = (station, key, text, style, bubble) => {
    if (said[key] || (station != 'tc' && !S.crew[station])) return;
    said[key] = 1;
    log(`T+${flight.time}s | [${STATIONS[station].callSign}] ${text}`, style);
    flight.bubbles = { [station]: { t: bubble, c: style == 'bad' ? 'no' : style == 'wn' ? 'wn' : 'go' } };
    flight.lastCalls = { ...flight.lastCalls, ...flight.bubbles };
  };
  const stage = flight.stages[flight.stageIndex], lastStage = flight.stageIndex == flight.stages.length - 1, powered = isPowered(flight);

  const event = key => hasEvent(flight, key), dynamics = S.crew.fido ? 'fido' : 'rso'; // FIDO calls the trajectory; before FIDO, the RSO's radar
  // THE ENGINE AND THE CLIMB: ignition, clearing the launcher, the thrust building as the air thins, the sound barrier.
  if (flight.time <= 2 && flight.chamberShare > 0) call('prop', 'ignition', 'Ignition. Thrust building.', '', 'IGNITION');
  if (event('liftoff') && flight.altitude > 100) call('tc', 'clear', 'Clear of the launcher.', 'ok', 'CLEAR');
  if (powered && flight.thrustShare >= 1.08) call('prop', 'thrust', `Thrust ${Math.round(flight.thrustShare * 100)} percent of rated and climbing.`, '', `THRUST ${Math.round(flight.thrustShare * 100)}%`);
  if (event('mach1')) call(dynamics, 'mach', 'Mach one.', '', 'MACH 1');
  if (event('maxq') && !watching('q')) {
    const top = flight.events.find(each => each.key == 'maxq');
    call(dynamics, 'maxq', `Through max Q at ${km(top.altitude)}.`, 'ok', 'PAST MAX Q');
  }
  if (watching('g') && flight.gLoad >= 5) call('tlm', 'g', `Payload seeing ${flight.gLoad.toFixed(1)} g and building.`, flight.gLoad > 10 ? 'wn' : '', `${flight.gLoad.toFixed(1)} G`);
  // STAGING: booster cutoff, separation, and the upper stage lighting.
  if (event('boco')) call('bstr', 'boco', 'Booster cutoff.', '', 'BOOSTER CUTOFF');
  if (event('sep')) call('bstr', 'sep', 'Separation confirmed.', 'ok', 'SEPARATION');
  if (event('ign2')) call('prop', 'ign2', 'Stage two ignition. Good start.', 'ok', 'STAGE 2 LIT');

  // TELEMETRY: the link is up.
  if (flight.time >= 2 && (flight.watch || []).length) call('tlm', 'link', `Telemetry good. ${flight.watch.length} channel${flight.watch.length > 1 ? 's' : ''} reading.`, 'ok', 'TLM GOOD');
  // PROPULSION: the burn clock, and the chamber when it is watched.
  if (powered && flight.time >= 3 && watching('pc')) call('prop', 'pc', `Chamber pressure steady, ${Math.round(flight.chamberShare * 100)} percent.`, '', `PC ${Math.round(flight.chamberShare * 100)}%`);
  if (powered && burnSeconds(stage) <= 10 && flight.burnTime > 15) call('prop', 'ten' + flight.stageIndex, lastStage ? 'Ten seconds to cutoff.' : 'Ten seconds to booster burnout.', '', lastStage ? 'T-10 CUTOFF' : 'T-10 BURNOUT');
  // Cutoff, timed against the plan: a hotter or cooler engine burns its propellant faster or slower than the drawings say.
  if (!powered && lastStage && event('cutoff')) {
    const index = flight.stages.length - 1, planned = flight.prediction && flight.prediction.cutoffs[index], late = planned ? flight.cutoffs[index] - planned : 0;
    const timing = Math.abs(late) <= 1 ? (planned ? ' Right on time.' : '') : ` ${Math.abs(late)} seconds ${late > 0 ? 'long' : 'short'}.`;
    call('prop', 'cutoff', `Cutoff at T+${flight.cutoffs[index]}.${timing || ' Good burn.'}`, Math.abs(late) > 1 ? 'wn' : 'ok', Math.abs(late) > 1 ? `CUTOFF ${Math.abs(late)}S ${late > 0 ? 'LONG' : 'SHORT'}` : 'CUTOFF');
  }
  // RANGE SAFETY: on course, then the predicted impact once the engine is done.
  if (flight.time >= 10) call('rso', 'course', 'Vehicle on course, inside the range.', '', 'ON COURSE');
  const planned = flight.prediction;
  if (!powered && lastStage && flight.verticalSpeed > 0 && !flight.satellite) call('rso', 'impact', `Impact predicted ${Math.round(predictedImpact(flight) / 1000)} kilometres downrange.${planned && !planned.orbit ? ` Plan was ${Math.round(planned.downrange / 1000)}.` : ''}`, '', `IMPACT ${Math.round(predictedImpact(flight) / 1000)} KM`);
  // FLIGHT DYNAMICS: at cutoff, the track against the plan.
  if (!powered && lastStage && planned && offPlan(flight)) {
    const words = offPlanWords(flight);
    call('fido', 'plan', words ? `Trajectory ${words}. Off the plan at cutoff.` : 'Trajectory nominal. Right on the plan.', words ? 'wn' : 'ok', words ? words.toUpperCase() : 'ON PLAN');
  }
  // STRUCTURES: max Q on the way up, when the aero load is watched.
  if (watching('q') && flight.verticalSpeed > 0) {
    flight.qPeak = Math.max(flight.qPeak || 0, flight.aeroLoad);
    if (flight.aeroLoad > .6) call('bstr', 'maxq', `Max Q. Loads ${Math.round(flight.aeroLoad * 100)} percent.`, flight.aeroLoad > .85 ? 'bad' : 'wn', `MAX Q ${Math.round(flight.aeroLoad * 100)}%`);
    if (flight.qPeak > .3 && flight.aeroLoad < flight.qPeak * .7) call('bstr', 'pastq', 'Through max Q.', 'ok', 'PAST MAX Q');
  }
  // TELEMETRY: skin heating, when it is watched.
  if (watching('skin') && flight.heating > .8) call('tlm', 'skin', `Skin temperature ${Math.round(flight.heating * 100)} percent and climbing.`, 'wn', `SKIN ${Math.round(flight.heating * 100)}%`);

  // WARNINGS: a failure building on a watched channel, called by the station that reads it, once the sign is clear.
  const warning = flight.pending && FAILURE_WARNINGS[flight.pending.mode];
  if (warning && watching(warning.channel) && warningLevel(flight, warning.channel) > .3) {
    const [station, text, bubble] = WARNING_CALLS[warning.channel][warning.sign];
    call(station, 'warn', text, 'bad', bubble);
  }

  // APOGEE: flight dynamics calls it, and the payload starts home.
  if (flight.time > 5 && flight.verticalSpeed <= 0 && !said.top) {
    said.top = 1;
    call('fido', 'apogee', `Apogee, ${km(flight.altitude)}.${planned ? ` Plan was ${km(planned.peakAltitude)}.` : ''}`, '', `APOGEE ${(flight.altitude / 1000).toFixed(1)} KM`);
    if (PAYLOADS[flight.payload].science) rollDescent(flight);
  }
  // RECOVERY FORCE: with a payload to bring home, the Recovery Controller stands the helicopters by at liftoff and sends them
  // toward the predicted impact as soon as the engine is done. (These need no channel: the controller hears the range.)
  // With a plan the helicopters are already on station at the planned impact, and hold there if the impact falls inside it.
  if (PAYLOADS[flight.payload].science && !PAYLOADS[flight.payload].satellite) {
    const onStation = flight.plan && planned;
    if (flight.time >= 6) call('rec', 'standby', onStation ? `Recovery force on station at ${Math.round(planned.downrange / 1000)} kilometres, the planned impact.` : 'Recovery force standing by at the range edge.', '', onStation ? `ON STATION ${Math.round(planned.downrange / 1000)} KM` : 'HELOS STANDING BY');
    if (!powered && lastStage && flight.verticalSpeed > 0) {
      if (onStation && onPlannedStation(flight, predictedImpact(flight))) call('rec', 'move', 'Impact inside the planned area. Helicopters holding on station.', 'ok', 'HOLDING');
      else call('rec', 'move', `Helicopters moving out to ${Math.round(predictedImpact(flight) / 1000)} kilometres.`, onStation ? 'wn' : '', `HELOS TO ${Math.round(predictedImpact(flight) / 1000)} KM`);
    }
  }
  // RECOVERY: each step as it happens, when the recovery channel is watched.
  const descent = flight.descent;
  if (descent && descent.failed != 'none' && watching('rec')) {
    call('rec', 'sep', descent.failed == 'sep' ? 'No separation. The payload is riding the rocket down.' : 'Nose cone separation confirmed.', descent.failed == 'sep' ? 'bad' : 'ok', descent.failed == 'sep' ? 'NO SEP' : 'SEP OK');
    if (descent.failed != 'sep' && flight.peakAltitude > 25000 && flight.altitude < 25000) call('rec', 'heat', descent.failed == 'heat' ? 'Lost the nose cone signal in re-entry.' : `Re-entry. Heating ${Math.round(descent.plan.heat * 100)} percent of rating.`, descent.failed == 'heat' ? 'bad' : '', descent.failed == 'heat' ? 'SIGNAL LOST' : 'RE-ENTRY');
    if (!descent.failed || descent.failed == 'chute') {
      if (flight.altitude < 3000) call('rec', 'chute', descent.failed == 'chute' ? `Chute failed! Opened at ${Math.round(descent.plan.openSpeed)} metres per second.` : 'Chute out. Payload descending under canopy.', descent.failed == 'chute' ? 'bad' : 'ok', descent.failed == 'chute' ? 'CHUTE FAILED' : 'CHUTE OUT');
    }
  }
}
