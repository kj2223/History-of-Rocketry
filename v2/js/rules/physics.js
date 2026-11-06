// Physical reality (freeze §4.1). The only module that reads data/physical.js or state.physical.
// It never reads beliefs, evidence or UI state, and it draws only from the physical stream.

import { BASE, REVISION_EFFECTS, SCATTER, MECHANISMS, LATENT, LATENT_V2, ENTRY_VEHICLES, RETRO_ERRORS, SPACECRAFT_TRUTH, BURN_THROUGH } from '../data/physical.js';
import { VEHICLE_QUANTITIES, lineage } from '../data/vehicles.js';
import { ENTRY_DESIGN, ENTRY_CLAIMS, CONTINGENCY_AREAS, pickupHours, crewCondition } from '../data/flight.js';
import { draw, normal } from '../core/rng.js';
import { flyEntry } from './entry-model.js';

export const initPhysical = () => ({ trueDefectMechanism: 'pm-07', latentMechanisms: [...LATENT], traces: {}, entries: {} });

// Mercury and Gemini hardware carries its own mechanisms, whichever way V2 opens.
export const addV2Mechanisms = state => {
  state.physical.latentMechanisms = [...new Set([...(state.physical.latentMechanisms ?? LATENT), ...LATENT_V2])];
};

// A mechanism is present on every article whose stage revision has not removed it; its `effects` show
// only under its `when` conditions, but it can bring down any flight it is present on.
const present = (m, stages) => { const rev = stages[m.stage]; return !!rev && !lineage(rev).some(r => m.absentFrom.includes(r)); };
const showing = (m, conditions) => Object.entries(m.when).every(([k, v]) => conditions[k] === v);

// Generate the true trace of a test and keep it in the physical layer.
// The draw count is fixed (1 + 2 per quantity), never dependent on channels or beliefs.
export const runTest = (state, jobId, plan) => {
  const { kind, vehicle, stage, stages, conditions } = plan;
  const stream = state.rng.physical;
  // shortcut: saves made before latent mechanisms existed get the default set on load.
  const ids = [state.physical.trueDefectMechanism, ...(state.physical.latentMechanisms ?? LATENT)];
  const mechanisms = ids.map(id => MECHANISMS[id]).filter(m => present(m, stages));
  // One roll decides the flight: each active mechanism brings it down with its own chance, independently.
  const roll = draw(stream);
  let survive = 1, culprit = null;
  for (const m of mechanisms) {
    survive *= 1 - (m.flightFailureChance ?? 0);
    if (!culprit && roll < 1 - survive) culprit = m;
  }
  const failed = kind === 'flight' && !!culprit;
  const entryClaims = ENTRY_DESIGN[vehicle] ? ENTRY_CLAIMS(ENTRY_DESIGN[vehicle].spacecraft) : [];
  const samples = VEHICLE_QUANTITIES[vehicle].filter(q => !entryClaims.includes(q)).map(quantity => {
    let value = BASE[vehicle][quantity];
    for (const rev of Object.values(stages)) for (const r of lineage(rev)) value += REVISION_EFFECTS[r]?.[quantity] ?? 0;
    for (const m of mechanisms) if (showing(m, conditions)) value += m.effects[quantity] ?? 0;
    if (failed) value += culprit.onFailure?.[quantity] ?? 0;
    value *= 1 + SCATTER * normal(stream);
    if (failed && quantity === 'vehicle.apogee') value *= 0.3;
    if (failed && quantity === 'vehicle.deviation') value += 40;
    return { quantity, value };
  });
  // A crewed vehicle's flight ends in an entry. Its draws are always taken, so the stream does not depend
  // on the outcome; a vehicle lost on the way up has no entry to record.
  if (kind === 'flight' && ENTRY_VEHICLES[vehicle]) {
    const entry = flyAndLand(state, jobId, { vehicle, ...plan.entry });
    if (failed) delete state.physical.entries[jobId]; else samples.push(...entry);
  }
  // A stand firing produces readings only for the stage on the stand.
  state.physical.traces[jobId] = kind === 'ground' ? samples.filter(s => s.quantity.startsWith(`${stage}.`)) : samples;
  return state.physical.traces[jobId].length;
};

export const sampleAt = (state, jobId, index) => ({ ...state.physical.traces[jobId][index] });

export const discardTrace = (state, jobId) => { delete state.physical.traces[jobId]; };

// ---- entry and recovery (V2 freeze §6.1, §6.2) ----

// Seconds of firing time that move the landing point `km` along the track.
const RE = 6371e3, MU = 3.986004e14;
const contingency = (v, km) => { const r = RE + v.orbitAltitude; return (km * 1000) / (Math.sqrt(MU / r) * RE / r); };

// Retrofire as it actually happened, from the physical stream: the errors of the burn itself plus any wrong
// ground-supplied number (`ground`: { late, navError }). Thirteen draws, whatever happens.
const actualRetro = (stream, v, ground, early) => {
  const e = RETRO_ERRORS;
  const dv = normal(stream), pitch = normal(stream), yaw = normal(stream), late = normal(stream);
  const fault = draw(stream), faultSize = normal(stream), short = draw(stream), when = draw(stream);
  return {
    dvScale: e.dvScale * dv - (short < e.shortBurnChance ? e.shortBurn : 0),
    pitchError: e.pitch * pitch,
    yawError: e.yaw * yaw + (fault < e.attitudeFaultChance ? e.attitudeFault * (1 + 0.3 * faultSize) : 0),
    // An early retrofire is timed for whichever contingency area the spacecraft can reach next.
    late: e.late * late + (ground.late ?? 0) + (early ? contingency(v, CONTINGENCY_AREAS[Math.floor(when * CONTINGENCY_AREAS.length)]) : 0),
  };
};

// The true chance a heat shield burns through under a given load. It knows nothing of the evidence: an entry
// outside what the evidence covers is riskier only because the truth says so (V2 freeze §6.2, V2-06).
export const burnThroughChance = (craft, heatLoad) => {
  const share = heatLoad / SPACECRAFT_TRUTH[craft].heatCapacity, { safeBelow, certainAt } = BURN_THROUGH;
  return share <= safeBelow ? 0 : Math.min(1, ((share - safeBelow) / (certainAt - safeBelow)) ** 2);
};

// Fly the entry, then the time in the water. Keeps the whole truth in the physical layer and returns the
// samples instruments and recovery can take. A sample marked `unrecoverable` is one nobody could take.
export const flyAndLand = (state, key, { vehicle, ground = {}, recovery = 'primary', early = false }) => {
  const stream = state.rng.physical;
  const retro = actualRetro(stream, ENTRY_VEHICLES[vehicle], ground, early);
  const burn = draw(stream);
  const out = flyEntry(ENTRY_VEHICLES[vehicle], retro, ground.navError ?? 0);
  const craft = ENTRY_DESIGN[vehicle].spacecraft, truth = SPACECRAFT_TRUTH[craft];
  const burnThrough = burn < burnThroughChance(craft, out.heatLoad);
  const missKm = out.miss / 1000, hours = burnThrough ? null : pickupHours(missKm, recovery);
  const water = burnThrough ? null : truth.leakPerHour * hours, sank = !burnThrough && water >= truth.sinksAt;
  (state.physical.entries ??= {})[key] = { ...out, retro, ground, early, recovery, burnThrough, hours, water, sank };
  const s = (quantity, value, unrecoverable = false) => ({ quantity, value, ...(unrecoverable ? { unrecoverable } : {}) });
  const [heat, g, wet] = ENTRY_CLAIMS(craft);
  // A burn-through ends the telemetry at the shield's last reading; nothing comes back after it.
  if (burnThrough) return [s(heat, out.heatLoad * 1.3), s(g, 0, true), s(wet, 0, true), s('vehicle.landing-miss', 0, true), s('vehicle.blackout', 0, true)];
  return [s(heat, out.heatLoad), s(g, out.peakG), s(wet, water, sank), s('vehicle.landing-miss', missKm), s('vehicle.blackout', out.blackout)];
};

// What the world itself shows after an entry, whatever the instruments recorded: whether the spacecraft came
// back through the blackout, whether it was still afloat, how long pickup took and how the crew came out.
export const entryEvents = (state, key) => {
  const e = state.physical.entries?.[key];
  if (!e) return null;
  return { contact: !e.burnThrough, capsuleRecovered: !e.burnThrough && !e.sank,
    pickupHours: e.hours === null ? null : Math.round(e.hours * 10) / 10, crewCondition: e.burnThrough ? null : crewCondition(e.hours) };
};
