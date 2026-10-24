// PART CHANNELS: telemetry from the parts of the rocket, beside the range's radar and tracking (CHANNELS in rules/flight.js).
// Each channel needs its instrument aboard the airframe. The telemetry link carries only so many at once: one with the FM
// telemetry transmitter, one more for each multiplexing package. Before launch you pick which parts to watch; with the ground
// command link and an Uplink Engineer you can switch them in flight. No DOM.
import { gaussian } from '../core/util.js';
import { PAYLOADS } from '../data/launch.js';
import { S, log } from '../core/state.js';

// The part channels. needs: the package that fits the instrument (any of a list); value: what it reads this second.
//   q     aero load on the structure, % of the limit         (strain gauges)
//   skin  skin heating, % of the limit                        (FM telemetry: thermocouples on the skin)
//   pc    chamber pressure, % of the engine's rated pressure  (pressure transducers)
//   g     the g-load the payload feels                        (accelerometer)
//   rec   the recovery sequence: separation, re-entry, chute  (a parachute aboard)
//         (its needle steps along the sequence and drops back on a failure; a flight that peaks below 25 km
//          never meets re-entry heating, so it shows SEPARATED until the chute)
export const PART_CHANNELS = {
  q: { label: 'AERO LOAD', name: 'Aero load (strain gauges)', needs: ['str'], max: 100, value: flight => (flight.aeroLoad || 0) * 100, unit: '%' },
  skin: { label: 'SKIN TEMP', name: 'Skin temperature (thermocouples)', needs: ['fm'], max: 100, value: flight => (flight.heating || 0) * 100, unit: '%' },
  pc: { label: 'CHAMBER PRESS', name: 'Chamber pressure (pressure transducers)', needs: ['xdc'], max: 120, value: flight => (flight.chamberShare || 0) * 100, unit: '%' },
  g: { label: 'PAYLOAD G', name: 'Payload g-load (accelerometer)', needs: ['acc'], max: 20, value: flight => flight.gLoad || 0, unit: ' g' },
  rec: { label: 'RECOVERY', name: 'Recovery sequence', needs: ['chute', 'ribbon', 'ms_rec', 'ms_disc'], max: 4 },
};
const MULTIPLEXING = ['mux', 'subc', 'pcm'];

// WARNINGS: most failures show on a part channel for a few seconds before they strike (rules/flight.js holds the failure back
// as flight.pending). Hard starts (i) and staging failures (x) are sudden and give no warning.
//   rough  the reading shakes harder and harder      climb  the reading runs up past the limit      fade  the reading falls away
export const FAILURE_WARNINGS = {
  c: { channel: 'pc', sign: 'rough' }, // combustion instability: chamber pressure oscillation
  p: { channel: 'pc', sign: 'fade' },  // pump cavitation: pressure tailing off
  v: { channel: 'pc', sign: 'fade' },  // valve or line leak: pressure dropping
  h: { channel: 'skin', sign: 'climb' }, // heat failure: skin temperature past the limit
  f: { channel: 'q', sign: 'rough' },  // fin flutter: the strain gauges shake
  s: { channel: 'q', sign: 'climb' },  // structural failure: loads in the red
};
export const WARNING_SECONDS = { least: 3, most: 6 };
// How far a warning has built, 0 to 1, on this channel (0 if nothing is building there).
export function warningLevel(flight, id) {
  const pending = flight.pending;
  if (!pending || FAILURE_WARNINGS[pending.mode].channel != id) return 0;
  return Math.min(1, (flight.time - pending.from + 1) / (pending.at - pending.from + 1));
}
// Telemetry readings are steadier than radar: about 3% of noise.
const TELEMETRY_NOISE = .03;

// How many part channels the airframe's telemetry carries at once: none without the FM transmitter.
export const channelCapacity = airframe => airframe && airframe.pk.includes('fm') ? 1 + MULTIPLEXING.filter(id => airframe.pk.includes(id)).length : 0;
// The part channels whose instruments this airframe carries.
export const availableChannels = airframe => airframe ? Object.keys(PART_CHANNELS).filter(id => PART_CHANNELS[id].needs.some(need => airframe.pk.includes(need))) : [];
// The channels a flight will carry: the ones picked that the airframe has, up to its capacity.
export const watchedChannels = (airframe, picked) => (picked || []).filter(id => availableChannels(airframe).includes(id)).slice(0, channelCapacity(airframe));

// SWITCHING IN FLIGHT (data uplink): with a command receiver aboard (an airframe built or retrofitted with the ground command
// link, data/research.js 'cmd', or the Command Receiver Test Package as its payload) and an Uplink Engineer on console, the link
// can be commanded to carry other channels mid-flight. Clicking a carried channel drops it; taking one on when the link is full
// drops the one carried longest.
export const carriesReceiver = flight => flight.airframe.pk.includes('cmd') || !!(PAYLOADS[flight.payload] || {}).uplink;
export const canRetune = flight => !!S.crew.upl && carriesReceiver(flight) && channelCapacity(flight.airframe) > 0;
export function retuneChannel(flight, id) {
  if (!canRetune(flight) || !availableChannels(flight.airframe).includes(id)) return;
  const carried = flight.watch || [], name = channel => PART_CHANNELS[channel].label.toLowerCase();
  if (carried.includes(id)) {
    flight.watch = carried.filter(other => other != id);
    return log(`T+${flight.time}s | [UPLINK] Dropping ${name(id)} from the link.`, 'cyan');
  }
  flight.watch = [...carried, id].slice(-channelCapacity(flight.airframe));
  const dropped = carried.filter(other => !flight.watch.includes(other));
  log(`T+${flight.time}s | [UPLINK] Commanding the link to ${name(id)}${dropped.length ? `, dropping ${dropped.map(name).join(' and ')}` : ''}.`, 'cyan');
}
// A failure building on a part channel the link is not carrying, clear enough that the Telemetry Engineer can tell something
// is wrong (but not where).
export function offLinkWarning(flight) {
  const warning = flight.pending && FAILURE_WARNINGS[flight.pending.mode];
  return !!warning && !(flight.watch || []).includes(warning.channel) && availableChannels(flight.airframe).includes(warning.channel) && warningLevel(flight, warning.channel) > .3;
}

// A reading of a part channel this second: { value, text }. The recovery channel reports where the sequence has got to.
export function partReading(flight, id) {
  if (id == 'rec') {
    const text = recoveryStatus(flight);
    return { value: RECOVERY_STEPS.indexOf(text) + 1, text };
  }
  const channel = PART_CHANNELS[id], level = warningLevel(flight, id), sign = level && FAILURE_WARNINGS[flight.pending.mode].sign;
  let value = channel.value(flight);
  if (sign == 'rough') value *= 1 + .35 * level * Math.sin(flight.time * 2.7) + .15 * level * gaussian();
  if (sign == 'climb') value += (130 - value) * level;
  if (sign == 'fade') value *= 1 - .45 * level;
  value = Math.max(0, value * (1 + TELEMETRY_NOISE * gaussian()));
  return { value, text: (id == 'g' ? value.toFixed(1) : Math.round(value)) + channel.unit };
}
const RECOVERY_STEPS = ['SEPARATED', 'RE-ENTRY', 'CHUTE OUT'];
function recoveryStatus(flight) {
  const descent = flight.descent;
  if (!descent) return 'ARMED';
  if (descent.failed == 'sep') return 'NO SEPARATION';
  if (flight.altitude > 25000 || flight.peakAltitude <= 25000 && flight.altitude > 3000) return 'SEPARATED';
  if (descent.failed == 'heat') return 'SIGNAL LOST';
  if (flight.altitude > 3000) return 'RE-ENTRY';
  return descent.failed == 'chute' ? 'CHUTE FAILED' : 'CHUTE OUT';
}
