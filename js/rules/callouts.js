// THE CREW'S CALLOUTS: each launch-crew station on console calls its part of the flight on the loop, in the style of the
// launch loops of the time: call sign first, short, numbers first. A station only calls what it can see: a call about a part
// is made only when that part channel is being watched (rules/telemetry.js). Called once per second of a flight you watch;
// the launch director's flights run quietly. No DOM.
//
// The latest call also shows as a short bubble over its station in the pad room, one voice on the loop at a time:
// flight.bubbles = { station: { t: text, c: 'go' | 'no' | 'wn' } }. flight.lastCalls keeps every station's latest, for after the flight.
import { PAYLOADS } from '../data/launch.js';
import { STATIONS } from '../data/launch-site.js';
import { S, log } from '../core/state.js';
import { rollDescent } from './recovery.js';
import { FAILURE_WARNINGS, warningLevel } from './telemetry.js';

const GRAVITY = 9.81;
const secondsOfBurnLeft = stage => stage.fuel / (stage.thrust / (stage.isp * GRAVITY));
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
    if (said[key] || !S.crew[station]) return;
    said[key] = 1;
    log(`T+${flight.time}s | [${STATIONS[station].callSign}] ${text}`, style);
    flight.bubbles = { [station]: { t: bubble, c: style == 'bad' ? 'no' : style == 'wn' ? 'wn' : 'go' } };
    flight.lastCalls = { ...flight.lastCalls, ...flight.bubbles };
  };
  const stage = flight.stages[flight.stageIndex], lastStage = flight.stageIndex == flight.stages.length - 1, powered = stage.fuel > 0;

  // TELEMETRY: the link is up.
  if (flight.time >= 2 && (flight.watch || []).length) call('tlm', 'link', `Telemetry good. ${flight.watch.length} channel${flight.watch.length > 1 ? 's' : ''} reading.`, 'ok', 'TLM GOOD');
  // PROPULSION: the burn clock, and the chamber when it is watched.
  if (powered && flight.time >= 3 && watching('pc')) call('prop', 'pc', `Chamber pressure steady, ${Math.round(flight.thrustShare * 100)} percent.`, '', `PC ${Math.round(flight.thrustShare * 100)}%`);
  if (powered && secondsOfBurnLeft(stage) <= 10 && flight.burnTime > 15) call('prop', 'ten' + flight.stageIndex, lastStage ? 'Ten seconds to cutoff.' : 'Ten seconds to booster burnout.', '', lastStage ? 'T-10 CUTOFF' : 'T-10 BURNOUT');
  if (!powered && lastStage) call('prop', 'cutoff', 'Cutoff. Good burn.', 'ok', 'CUTOFF');
  // RANGE SAFETY: on course, then the predicted impact once the engine is done.
  if (flight.time >= 10) call('rso', 'course', 'Vehicle on course, inside the range.', '', 'ON COURSE');
  if (!powered && lastStage && flight.verticalSpeed > 0 && !flight.satellite) call('rso', 'impact', `Impact predicted ${Math.round(predictedImpact(flight) / 1000)} kilometres downrange.`, '', `IMPACT ${Math.round(predictedImpact(flight) / 1000)} KM`);
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
    call('fido', 'apogee', `Apogee, ${(flight.altitude / 1000).toFixed(1)} kilometres.`, '', `APOGEE ${(flight.altitude / 1000).toFixed(1)} KM`);
    if (PAYLOADS[flight.payload].science) rollDescent(flight);
  }
  // RECOVERY FORCE: with a payload to bring home, the Recovery Controller stands the helicopters by at liftoff and sends them
  // toward the predicted impact as soon as the engine is done. (These need no channel: the controller hears the range.)
  if (PAYLOADS[flight.payload].science && !PAYLOADS[flight.payload].satellite) {
    if (flight.time >= 6) call('rec', 'standby', 'Recovery force standing by at the range edge.', '', 'HELOS STANDING BY');
    if (!powered && lastStage && flight.verticalSpeed > 0) call('rec', 'move', `Helicopters moving out to ${Math.round(predictedImpact(flight) / 1000)} kilometres.`, '', `HELOS TO ${Math.round(predictedImpact(flight) / 1000)} KM`);
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
