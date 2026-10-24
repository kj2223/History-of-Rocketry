// THE CONSOLES: one tile per launch-crew station down the right of the control room. Every staffed station always shows
// what it is doing: its own readout and gauge, a line on its work, and the last thing it said on the loop.
// Each station reads only what it can see: a part channel shows only if it was picked for the flight (rules/telemetry.js).
// Empty consoles say what they need. Nothing here changes the game.
import { STATIONS } from '../data/launch-site.js';
import { PAYLOADS } from '../data/launch.js';
import { S } from '../core/state.js';
import { stationLock } from '../rules/launch-site.js';
import { airborne, formatAltitude, burnSeconds, isPowered } from '../rules/flight.js';
import { PART_CHANNELS, partReading, warningLevel, canRetune } from '../rules/telemetry.js';
import { predictedImpact, offPlanWords } from '../rules/callouts.js';
import { reading, groundCommandLock } from '../rules/mission.js';
import { launchView } from './launch-view.js';
import { $, setHTML, escapeHtml } from './dom.js';

const burnLeft = stage => Math.round(burnSeconds(stage));
// Whether the stage burning now has lit at all (an upper stage waits out a short coast after separation).
const lit = flight => flight.stages[flight.stageIndex].litAt != null && flight.stages[flight.stageIndex].litAt < flight.time;
// A station's state for its tile: text (the readout), gauge (0 to 1, or null for none), level ('ok' | 'wn' | 'bad' | ''), work.
const state = (text, work, gauge = null, level = '') => ({ text, work, gauge, level });

// IN FLIGHT: what each station is watching right now.
function flightState(id, flight) {
  const watching = channel => (flight.watch || []).includes(channel), stage = flight.stages[flight.stageIndex], powered = isPowered(flight);
  const part = channel => partReading(flight, channel), alarm = channel => warningLevel(flight, channel) > .3;
  switch (id) {
    case 'tc': return state(`T+${flight.time}s · ${powered ? 'powered flight' : flight.verticalSpeed > 0 ? 'coasting up' : 'descent'}`, 'Running the clock. Abort is your call.', null, 'ok');
    case 'prop': {
      // The engine: thrust against its sea-level rating (above 100% in thin air), building at ignition, tailing off at the end.
      if (!powered) return state(lit(flight) ? 'Cutoff' : `Stage ${flight.stageIndex + 1} lights in a moment`, lit(flight) ? 'Logging the burn for the engineering file.' : 'Igniter armed.', 0);
      const thrust = `Thrust ${Math.round(flight.thrustShare * 100)}%`, left = `${burnLeft(stage)} s left`;
      const phase = flight.chamberShare < .9 ? (burnLeft(stage) < 2 ? 'Tailing off.' : 'Thrust building.') : null;
      if (!watching('pc')) return state(`${thrust} · ${left}`, phase || 'No chamber channel: timing the burn by the clock.', flight.thrustShare / 1.3);
      return state(`PC ${part('pc').text} · ${thrust} · ${left}`, alarm('pc') ? 'Chamber pressure is wrong!' : phase || 'Watching chamber pressure.', part('pc').value / 120, alarm('pc') ? 'bad' : 'ok');
    }
    case 'rso': {
      const impact = !powered && flight.verticalSpeed > 0 ? ` · impact ~${Math.round(predictedImpact(flight) / 1000)} km` : '';
      return state(`${(flight.downrange / 1000).toFixed(1)} km downrange${impact}`, 'Plotting the track against the range limits.', null, 'ok');
    }
    case 'tlm': {
      // The busiest channel on the strip charts: the one in trouble, or the first picked.
      const picked = flight.watch || [], trouble = picked.find(alarm), shown = trouble || picked.find(channel => channel != 'rec') || picked[0];
      const text = shown ? `${PART_CHANNELS[shown].label} ${part(shown).text}${picked.length > 1 ? ` · +${picked.length - 1}` : ''}` : 'No part telemetry';
      return state(text, trouble ? 'A channel is out of family!' : picked.length ? 'Strip charts running.' : 'Radio beacon and radar only.', null, trouble ? 'bad' : 'ok');
    }
    case 'bstr': {
      const booster = flight.stages.length > 1 && flight.stageIndex == 0;
      if (!watching('q')) return booster
        ? state(`Booster ${burnLeft(stage)} s to burnout`, 'Staging armed. No strain channel on this flight.', null, 'ok')
        : state(flight.stageIndex ? 'Booster separated' : `Mach ${(flight.mach || 0).toFixed(1)}`, 'No strain channel: reading the loads off the track.');
      return state(`Q ${part('q').text} of limit${booster ? ` · booster ${burnLeft(stage)} s` : ''}`, alarm('q') ? 'Loads out of family!' : 'Watching the strain gauges.', part('q').value / 100, alarm('q') ? 'bad' : part('q').value > 60 ? 'wn' : 'ok');
    }
    case 'fido': {
      // Against the plan while the prediction runs: on plan, or which way the track is off. Mach off the tracking.
      const altitude = flight.lastReadings.alt, track = altitude ? formatAltitude(altitude.value, altitude.quality) : 'No track';
      const off = offPlanWords(flight), mach = flight.mach >= .3 ? ` · M${flight.mach.toFixed(1)}` : '';
      return state(off == null ? track + mach : `${track}${mach} · ${off ? off.toUpperCase() : 'ON PLAN'}`, flight.verticalSpeed > 0 ? 'Projecting apogee.' : 'Projecting impact.', null, off ? 'wn' : 'ok');
    }
    case 'rec': {
      // The recovery force follows the flight: holding at the range edge under power, then off toward the predicted impact.
      const payload = PAYLOADS[flight.payload], impact = `~${Math.round(predictedImpact(flight) / 1000)} km`;
      if (!payload.science || payload.satellite) return state('Nothing to recover', 'Standing down for this flight.');
      if (powered) return state('Helos at the range edge', 'Waiting for cutoff to predict the impact.', null, 'ok');
      const status = watching('rec') ? part('rec').text : null, trouble = status && /FAIL|LOST|NO /.test(status);
      if (flight.verticalSpeed > 0) return state(`Helos to ${impact}`, 'Flying out to the predicted impact area.', null, 'ok');
      return state(status || `Helos at ${impact}`, trouble ? 'Recovery in trouble.' : status ? 'Following the payload down.' : 'No recovery channel: waiting for the chute.', null, trouble ? 'bad' : 'ok');
    }
    case 'upl': return canRetune(flight) ? state(`Link carrying ${(flight.watch || []).length}`, 'Ready to switch the telemetry channels on your word.', null, 'ok') : state('No uplink', 'No command link to this vehicle.');
    case 'fd': {
      // The last milestone the room passed.
      const last = (flight.events || [])[flight.events.length - 1];
      return state(last ? `${last.label} · T+${last.time}` : 'Running the loop', 'Listening to every station.', null, 'ok');
    }
    default: return state('On the loop', 'Listening.');
  }
}
// A MERCURY MISSION: the capsule's telemetry, shared out by station.
function missionState(id, mission) {
  const now = reading(mission);
  switch (id) {
    case 'tc': return state(`T+${Math.floor(mission.time / 60)}:${String(Math.floor(mission.time % 60)).padStart(2, '0')}`, mission.pending ? 'A decision is waiting.' : 'Running the mission clock.', null, mission.pending ? 'wn' : 'ok');
    case 'fido': return state(`${now.alt.toFixed(1)} km · ${Math.round(now.v)} m/s`, 'Tracking the capsule.', null, 'ok');
    case 'surg': return state(`${now.g.toFixed(1)} g · cabin ${now.temp} °C`, 'Watching the pilot\'s heart rate and breathing.', now.g / 16, now.g > 9 ? 'wn' : 'ok');
    case 'capcom': return state(mission.pending ? 'Talking to the crew' : 'On the air-to-ground loop', 'Relaying advice to the capsule.', null, 'ok');
    case 'upl': {
      const lock = groundCommandLock(mission);
      return lock ? state('No command', `Cannot reach the capsule: ${lock}.`) : state('Command link up', mission.pending ? 'Standing by to send a command.' : 'Command carrier on the capsule.', null, 'ok');
    }
    default: return state('On the loop', 'Watching the capsule telemetry.', null, 'ok');
  }
}
// THE COUNT: the tanks, then the go/no-go poll as it is read out.
function countState(id, count) {
  if (id == 'tc') return state(count.hold ? `HOLD · T-${Math.ceil(count.clock)}` : `T-${Math.ceil(count.clock)} · counting`, count.hold || 'Running the count.', null, count.hold ? 'wn' : 'ok');
  if (id == 'bstr' && (count.filling || count.fuel > 0) && !count.shown) return state(`Tanks ${Math.round(count.fuel * 100)}% of ${Math.round(count.target * 100)}%`, count.filling ? 'Loading and pressurizing.' : 'Tanks loaded.', count.fuel / Math.max(.01, count.target), 'ok');
  const index = count.poll.lines.findIndex(line => line.id == id), line = count.poll.lines[index];
  if (line && index < count.shown) return state(line.go ? 'GO' : 'NO-GO', line.msg || 'Ready.', null, line.go ? 'ok' : 'bad');
  return state('Checking', `${STATIONS[id].description.split('.')[0]}.`);
}

// THE TILE for one station, staffed or not.
function tile(id) {
  const station = STATIONS[id], staffed = id == 'tc' || S.crew[id];
  if (!staffed) {
    const lock = stationLock(id);
    return `<article class="con empty"><div class="con-hd"><i class="lamp"></i><b>${station.callSign}</b><span>${station.name}</span></div><div class="m">${lock ? 'Console empty. ' + lock : 'Console empty. Hire at the Crew desk.'}</div></article>`;
  }
  const count = launchView.count, flight = airborne.flight, mission = airborne.mission;
  const now = flight ? flightState(id, flight) : mission ? missionState(id, mission) : count && count.phase == 'count' ? countState(id, count)
    : state('Standing by', `${station.description.split('.')[0]}.`);
  const calls = (flight && flight.lastCalls) || (count && count.lastCalls) || {}, call = calls[id];
  return `<article class="con ${now.level}"><div class="con-hd"><i class="lamp ${now.level}"></i><b>${station.callSign}</b><span>${station.name}</span></div>`
    + `<div class="con-read">${escapeHtml(now.text)}</div>`
    + (now.gauge == null ? '' : `<div class="bar"><i style="width:${Math.round(Math.max(0, Math.min(1, now.gauge)) * 100)}%"></i></div>`)
    + `<div class="m">${escapeHtml(now.work)}</div>`
    + (call ? `<div class="con-call ${call.c}">“${escapeHtml(call.t)}”</div>` : '')
    + '</article>';
}
export function renderConsoles() {
  const ids = Object.keys(STATIONS).filter(id => !STATIONS[id].nasa || S.nasa);
  setHTML($('#cons'), ids.map(tile).join(''));
}
