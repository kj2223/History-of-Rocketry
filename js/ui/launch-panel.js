// THE LAUNCH TAB: the control-room picture, and the launch form with its pre-flight estimate.
import { formatMoney } from '../core/util.js';
import { PROPELLANTS, PAYLOADS } from '../data/launch.js';
import { ROOMS } from '../data/launch-site.js';
import { BY_ID } from '../data/research.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, isResearched, isConfirmed, withProgramme } from '../core/state.js';
import { designSpec, trackingTiers, rangeFee, propellantCost, hasBoosterStage, cannotOrbit, quoteLaunch } from '../rules/design.js';
import { rangeDataPayment } from '../rules/economy.js';
import { roomLevel, consoleCount, crewOnConsole } from '../rules/launch-site.js';
import { airborne, previewFlight, formatAltitude } from '../rules/flight.js';
import { roomSVG, updateTrace } from './control-room.js';
import { launchView } from './launch-view.js';
import { $, option } from './dom.js';

// What the launch form has chosen: airframe id, propellant, payload, st (1 to fly the booster stage), load (percent of a full tank).
// stageChosen: the player picked the stage setting for this airframe, so it is not reset to the full stack.
export const launchForm = { af: null, fuel: 'Alcohol & LOX', pay: 'Inert Ballast', st: 0, load: 100 };

const payloadLocked = (payload, airframe) => (PAYLOADS[payload].satellite && cannotOrbit(airframe)) || (PAYLOADS[payload].needs && !isResearched(PAYLOADS[payload].needs));

export function renderControlRoom() {
  const level = roomLevel(), crew = crewOnConsole(), consoles = consoleCount();
  $('#crt').textContent = ROOMS[level].name.toUpperCase();
  $('#cr').innerHTML = roomSVG(level, crew, consoles, !!airborne.flight);
  $('#crm').textContent = `${ROOMS[level].description} ${crew.length} of ${consoles} console${consoles > 1 ? 's' : ''} staffed.`;
  updateTrace(airborne.flight ? airborne.flight.trace : launchView.lastTrace);
}

// THE LAUNCH FORM. Choices that no longer fit (another rocket's propellant, a payload it cannot carry) fall back to a default.
export function renderLaunchForm() {
  if (airborne.flight) return;
  const form = launchForm, ready = S.air.filter(airframe => airframe.st == 'r').reverse();
  if (!ready.find(airframe => airframe.id == form.af)) form.af = ready[0] && ready[0].id;
  const airframe = ready.find(candidate => candidate.id == form.af), propellants = airframe ? PROGRAMMES[airframe.prog].propellants : Object.keys(PROPELLANTS);
  if (!propellants.includes(form.fuel)) form.fuel = propellants[0];
  if (payloadLocked(form.pay, airframe)) form.pay = 'Inert Ballast';
  if (form.st && !hasBoosterStage(airframe)) form.st = 0;
  if (airframe && hasBoosterStage(airframe) && !form.stageChosen) form.st = 1;
  const quote = quoteLaunch(airframe, form.fuel, form.pay, form.st, form.load / 100), preview = airframe ? previewFlight(airframe, form.fuel, form.pay, form.st, form.load / 100) : null, payload = PAYLOADS[form.pay];
  const propellantKg = airframe ? Math.round(withProgramme(airframe.prog, () => designSpec(airframe.pk).f) * PROPELLANTS[form.fuel].density * form.load / 100) : 0;
  $('#lc').innerHTML = `<select data-s="af">${ready.length ? ready.map(candidate => option(candidate.id, `${candidate.label} (built ${candidate.built})`, 0, form.af)).join('') : '<option>No airframe in the hangar</option>'}</select>
<select data-s="st">${option(0, 'Upper stage alone', 0, form.st)}${option(1, hasBoosterStage(airframe) ? `Full stack: booster stage + upper stage (+${formatMoney(8000)})` : 'No booster stage on this rocket', !hasBoosterStage(airframe), form.st)}</select>
<select data-s="fuel">${Object.keys(PROPELLANTS).map(name => option(name, `${name} (${airframe ? formatMoney(propellantCost(airframe, name, form.load / 100)) : '$' + PROPELLANTS[name].pricePerKg + '/kg'}, Isp ${PROPELLANTS[name].isp}s)${!propellants.includes(name) ? ' [not this rocket]' : ''}`, !propellants.includes(name), form.fuel)).join('')}</select>
<select data-s="pay">${Object.keys(PAYLOADS).filter(name => !PAYLOADS[name].mercury).map(name => option(name, payloadLabel(name, airframe), payloadLocked(name, airframe), form.pay)).join('')}</select>
<div class="r" style="margin-top:8px"><span class="d">Propellant load (${propellantKg} kg)</span><b id="ldv">${form.load}%</b></div><input type="range" data-s="load" min="10" max="100" step="5" value="${form.load}" style="width:100%">
${preview ? estimateHTML(preview, payload, airframe) : ''}
<div class="m">Fuel record: ${S.fr[form.fuel] || 0} successful flights.${airframe && airframe.pk.some(id => !isConfirmed(id)) ? ` Unproven systems aboard: ${airframe.pk.filter(id => !isConfirmed(id)).length} (raises the chance of a hidden fault).` : ''} Range fee ${formatMoney(rangeFee())} included.${rangeDataPayment(1e4) ? ' Successful flights earn a Defense Department range data contract.' : ''}</div><button data-a="count"${quote.error ? ' disabled' : ''}>BEGIN COUNTDOWN${quote.cost ? ' (' + formatMoney(quote.cost) + ')' : ''}</button>${S.staff.director ? `<button data-a="autoSet">SET AS DIRECTOR'S STANDING ORDERS</button>` : ''}<div class="m bad">${quote.error || ''}</div>`;
}
function payloadLabel(name, airframe) {
  const payload = PAYLOADS[name];
  const lock = payload.needs && !isResearched(payload.needs) ? ` [needs ${BY_ID[payload.needs].name}]` : payload.satellite && cannotOrbit(airframe) ? ' [needs a satellite launcher]' : '';
  return `${name} (${formatMoney(payload.cost)}, ${payload.mass} kg${payload.science ? `, science ~${formatMoney(payload.science)}` : ''})${lock}`;
}
// Science: on orbit for a satellite; otherwise recovery odds, and what the payload is worth recovered or by telemetry alone.
function scienceHTML(preview, payload) {
  if (!payload.science) return '';
  const value = payload.science * (payload.satellite ? 1 : Math.max(.2, Math.min(2.5, preview.peakAltitude / 30000))) * preview.scienceMultiplier;
  if (payload.satellite) return `<div class="r"><span class="d">Science on orbit</span><b>~${formatMoney(value * .5)}</b></div>`;
  const recovery = preview.recovery;
  return `<div class="r"><span class="d">Recovery odds</span><b class="${recovery.noSystem || recovery.chance < .3 ? 'bad' : recovery.chance < .6 ? 'wn' : 'ok'}">${recovery.noSystem ? 'no recovery system' : '~' + Math.round(recovery.chance * 100) + '%' + (recovery.burnUp > 0 ? ' (re-entry too fast for its heat protection)' : '')}</b></div><div class="r"><span class="d">Science if recovered / telemetry only</span><b>~${formatMoney(value * .5)} / ~${formatMoney(value * .5 * (payload.telemetryShare || 0) * (.4 + .2 * trackingTiers().v))}</b></div>`;
}
const row = (label, value, style) => `<div class="r"><span class="d">${label}</span><b${style == null ? '' : ` class="${style}"`}>${value}</b></div>`;
function estimateHTML(preview, payload, airframe) {
  const orbitRows = launchForm.st && hasBoosterStage(airframe)
    ? row('Horizontal speed above 120 km', preview.orbit ? 'orbit' : `~${Math.round(preview.peakHorizontalSpeed / 10) * 10} m/s of 7,000`, preview.orbit ? 'ok' : preview.peakHorizontalSpeed > 6500 ? 'wn' : 'bad')
      + '<div class="m">Orbit needs about 7,000 m/s of horizontal speed above 120 km. Better guidance (instrumentation) flies a flatter path and wastes less climbing.</div>'
    : '';
  return `<div class="c"><div class="t">PRE-FLIGHT ESTIMATE (calculated, ±${Math.round(preview.uncertainty * 100)}%)</div>`
    + row('Liftoff thrust-to-weight', preview.thrustToWeight.toFixed(2), preview.thrustToWeight < 1.05 || preview.thrustToWeight > preview.gLimit * .85 ? 'bad' : preview.thrustToWeight < 1.5 ? 'wn' : 'ok')
    + row('Burnout load / structural limit', `${preview.burnoutG.toFixed(1)} g / ${preview.gLimit.toFixed(1)} g`, preview.burnoutG > preview.gLimit * .85 ? 'bad' : 'ok')
    + row('Peak altitude', formatAltitude(Math.round(preview.peakAltitude / 100) * 100, { noise: 1, rounding: 100 }))
    + row('Max speed', `~${Math.round(preview.peakSpeed / 10) * 10} m/s`)
    + orbitRows
    + row('Peak aerodynamic load (calm air)', `${Math.round(preview.maxQ * 100)}% of limit`, preview.maxQ > .85 ? 'bad' : preview.maxQ > .6 ? 'wn' : 'ok')
    + row('Peak skin heating', `${Math.round(preview.maxHeat * 100)}% of limit`, preview.maxHeat > 1 ? 'bad' : preview.maxHeat > .8 ? 'wn' : 'ok')
    + row('Downrange', `~${(preview.downrange / 1000).toFixed(preview.downrange < 1e5 ? 1 : 0)} km`)
    + scienceHTML(preview, payload)
    + `<div class="m">Burn about ${preview.burnTime}s. More propellant adds speed but weight and cost; a heavy payload cuts everything and can stop liftoff. Faster flights are harder to recover.</div></div>`;
}
