// PART CHANNELS: telemetry from the parts of the rocket, beside the range's radar and tracking (CHANNELS in rules/flight.js).
// Each channel needs its instrument aboard the airframe. The telemetry link carries only so many at once: one with the FM
// telemetry transmitter, one more for each multiplexing package. Before launch you pick which parts to watch. No DOM.
import { gaussian } from '../core/util.js';

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
  pc: { label: 'CHAMBER PRESS', name: 'Chamber pressure (pressure transducers)', needs: ['xdc'], max: 120, value: flight => (flight.thrustShare || 0) * 100, unit: '%' },
  g: { label: 'PAYLOAD G', name: 'Payload g-load (accelerometer)', needs: ['acc'], max: 20, value: flight => flight.gLoad || 0, unit: ' g' },
  rec: { label: 'RECOVERY', name: 'Recovery sequence', needs: ['chute', 'ribbon', 'ms_rec', 'ms_disc'], max: 4 },
};
const MULTIPLEXING = ['mux', 'subc', 'pcm'];
// Telemetry readings are steadier than radar: about 3% of noise.
const TELEMETRY_NOISE = .03;

// How many part channels the airframe's telemetry carries at once: none without the FM transmitter.
export const channelCapacity = airframe => airframe && airframe.pk.includes('fm') ? 1 + MULTIPLEXING.filter(id => airframe.pk.includes(id)).length : 0;
// The part channels whose instruments this airframe carries.
export const availableChannels = airframe => airframe ? Object.keys(PART_CHANNELS).filter(id => PART_CHANNELS[id].needs.some(need => airframe.pk.includes(need))) : [];
// The channels a flight will carry: the ones picked that the airframe has, up to its capacity.
export const watchedChannels = (airframe, picked) => (picked || []).filter(id => availableChannels(airframe).includes(id)).slice(0, channelCapacity(airframe));

// A reading of a part channel this second: { value, text }. The recovery channel reports where the sequence has got to.
export function partReading(flight, id) {
  if (id == 'rec') {
    const text = recoveryStatus(flight);
    return { value: RECOVERY_STEPS.indexOf(text) + 1, text };
  }
  const channel = PART_CHANNELS[id], value = Math.max(0, channel.value(flight) * (1 + TELEMETRY_NOISE * gaussian()));
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
