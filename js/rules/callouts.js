// THE CREW'S CALLOUTS: each launch-crew station on console calls its part of the flight on the loop, in the style of the
// launch loops of the time: call sign first, short, numbers first. A station only calls what it can see: a call about a part
// is made only when that part channel is being watched (rules/telemetry.js). Called once per second of a flight you watch;
// the launch director's flights run quietly. No DOM.
import { PAYLOADS } from '../data/launch.js';
import { STATIONS } from '../data/launch-site.js';
import { S, log } from '../core/state.js';
import { rollDescent } from './recovery.js';

const GRAVITY = 9.81;
const secondsOfBurnLeft = stage => stage.fuel / (stage.thrust / (stage.isp * GRAVITY));
// Where a coasting flight will come down, by a simple ballistic sum from where it is now.
const predictedImpact = flight => flight.downrange + flight.horizontalSpeed * (flight.verticalSpeed + Math.sqrt(flight.verticalSpeed ** 2 + 2 * GRAVITY * Math.max(0, flight.altitude))) / GRAVITY;

export function crewCallouts(flight) {
  const said = flight.called || (flight.called = {}), watching = id => (flight.watch || []).includes(id);
  // Each call is made once (key), and only with its station on console.
  const call = (station, key, text, style = '') => {
    if (said[key] || !S.crew[station]) return;
    said[key] = 1;
    log(`T+${flight.time}s | [${STATIONS[station].callSign}] ${text}`, style);
  };
  const stage = flight.stages[flight.stageIndex], lastStage = flight.stageIndex == flight.stages.length - 1, powered = stage.fuel > 0;

  // TELEMETRY: the link is up.
  if (flight.time >= 2 && (flight.watch || []).length) call('tlm', 'link', `Telemetry good. ${flight.watch.length} channel${flight.watch.length > 1 ? 's' : ''} reading.`, 'ok');
  // PROPULSION: the burn clock, and the chamber when it is watched.
  if (powered && flight.time >= 3 && watching('pc')) call('prop', 'pc', `Chamber pressure steady, ${Math.round(flight.thrustShare * 100)} percent.`);
  if (powered && secondsOfBurnLeft(stage) <= 10 && flight.burnTime > 15) call('prop', 'ten' + flight.stageIndex, lastStage ? 'Ten seconds to cutoff.' : 'Ten seconds to booster burnout.');
  if (!powered && lastStage) call('prop', 'cutoff', 'Cutoff. Good burn.', 'ok');
  // RANGE SAFETY: on course, then the predicted impact once the engine is done.
  if (flight.time >= 10) call('rso', 'course', 'Vehicle on course, inside the range.');
  if (!powered && lastStage && flight.verticalSpeed > 0 && !flight.satellite) call('rso', 'impact', `Impact predicted ${Math.round(predictedImpact(flight) / 1000)} kilometres downrange.`);
  // STRUCTURES: max Q on the way up, when the aero load is watched.
  if (watching('q') && flight.verticalSpeed > 0) {
    flight.qPeak = Math.max(flight.qPeak || 0, flight.aeroLoad);
    if (flight.aeroLoad > .6) call('bstr', 'maxq', `Max Q. Loads ${Math.round(flight.aeroLoad * 100)} percent.`, flight.aeroLoad > .85 ? 'bad' : 'wn');
    if (flight.qPeak > .3 && flight.aeroLoad < flight.qPeak * .7) call('bstr', 'pastq', 'Through max Q.', 'ok');
  }
  // TELEMETRY: skin heating, when it is watched.
  if (watching('skin') && flight.heating > .8) call('tlm', 'skin', `Skin temperature ${Math.round(flight.heating * 100)} percent and climbing.`, 'wn');

  // APOGEE: flight dynamics calls it, and the payload starts home.
  if (flight.time > 5 && flight.verticalSpeed <= 0 && !said.top) {
    said.top = 1;
    call('fido', 'apogee', `Apogee, ${(flight.altitude / 1000).toFixed(1)} kilometres.`);
    if (PAYLOADS[flight.payload].science) rollDescent(flight);
  }
  // RECOVERY: each step as it happens, when the recovery channel is watched.
  const descent = flight.descent;
  if (descent && descent.failed != 'none' && watching('rec')) {
    call('rec', 'sep', descent.failed == 'sep' ? 'No separation. The payload is riding the rocket down.' : 'Nose cone separation confirmed.', descent.failed == 'sep' ? 'bad' : 'ok');
    if (descent.failed != 'sep' && flight.peakAltitude > 25000 && flight.altitude < 25000) call('rec', 'heat', descent.failed == 'heat' ? 'Lost the nose cone signal in re-entry.' : `Re-entry. Heating ${Math.round(descent.plan.heat * 100)} percent of rating.`, descent.failed == 'heat' ? 'bad' : '');
    if (!descent.failed || descent.failed == 'chute') {
      if (flight.altitude < 3000) call('rec', 'chute', descent.failed == 'chute' ? `Chute failed! Opened at ${Math.round(descent.plan.openSpeed)} metres per second.` : 'Chute out. Payload descending under canopy.', descent.failed == 'chute' ? 'bad' : 'ok');
    }
  }
}
