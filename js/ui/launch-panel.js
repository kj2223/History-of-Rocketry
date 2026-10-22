// THE LAUNCH DESK: the control-room picture, and the launch form with its pre-flight estimate.
import { formatMoney } from '../core/util.js';
import { PROPELLANTS, PAYLOADS } from '../data/launch.js';
import { ROOMS } from '../data/launch-site.js';
import { BY_ID } from '../data/research.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, isResearched, isConfirmed, withProgramme, formatDate } from '../core/state.js';
import { designSpec, trackingTiers, rangeFee, propellantCost, hasBoosterStage, cannotOrbit, quoteLaunch } from '../rules/design.js';
import { rangeDataPayment, DIRECTOR_SALARY } from '../rules/economy.js';
import { SPECIALISTS } from '../rules/game.js';
import { roomLevel, consoleCount, crewOnConsole } from '../rules/launch-site.js';
import { airborne, previewFlight, formatAltitude } from '../rules/flight.js';
import { PART_CHANNELS, channelCapacity, availableChannels, watchedChannels } from '../rules/telemetry.js';
import { CAMPAIGN_TARGETS, targetText, outcomeText, directorUnlocked, directorRank, directorExperience, directorMargin, VETERAN_MARGIN } from '../rules/campaign.js';
import { roomSVG, updateTrace } from './control-room.js';
import { launchView, stationBubbles } from './launch-view.js';
import { $, option, setHTML, escapeHtml, percent } from './dom.js';

// What the launch form has chosen: airframe id, propellant, payload, st (1 to fly the booster stage), load (percent of a full tank),
// ch: the part channels to watch (null until first shown, then every fitted channel the telemetry can carry).
// stageChosen: the player picked the stage setting for this airframe, so it is not reset to the full stack.
// plan: the trajectory panel's flight plan (ui/trajectory.js), or null to fly the default.
export const launchForm = { af: null, fuel: 'Alcohol & LOX', pay: 'Inert Ballast', st: 0, load: 100, ch: null, plan: null };

const payloadLocked = (payload, airframe) => (PAYLOADS[payload].satellite && cannotOrbit(airframe)) || (PAYLOADS[payload].needs && !isResearched(PAYLOADS[payload].needs));

export function renderControlRoom() {
  const level = roomLevel(), crew = crewOnConsole(), consoles = consoleCount();
  $('#crt').textContent = ROOMS[level].name.toUpperCase();
  setHTML($('#cr'), roomSVG(level, crew, consoles, !!(airborne.flight || airborne.mission), stationBubbles()));
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
  const quote = quoteLaunch(airframe, form.fuel, form.pay, form.st, form.load / 100), preview = airframe ? previewFlight(airframe, form.fuel, form.pay, form.st, form.load / 100, 0, form.plan) : null, payload = PAYLOADS[form.pay];
  const propellantKg = airframe ? Math.round(withProgramme(airframe.prog, () => designSpec(airframe.pk).f) * PROPELLANTS[form.fuel].density * form.load / 100) : 0;
  setHTML($('#lc'), `<select data-s="af">${ready.length ? ready.map(candidate => option(candidate.id, `${candidate.label} (built ${candidate.built})`, 0, form.af)).join('') : '<option>No airframe in the hangar</option>'}</select>
<select data-s="st">${option(0, 'Upper stage alone', 0, form.st)}${option(1, hasBoosterStage(airframe) ? `Full stack: booster stage + upper stage (+${formatMoney(8000)})` : 'No booster stage on this rocket', !hasBoosterStage(airframe), form.st)}</select>
<select data-s="fuel">${Object.keys(PROPELLANTS).map(name => option(name, `${name} (${airframe ? formatMoney(propellantCost(airframe, name, form.load / 100)) : '$' + PROPELLANTS[name].pricePerKg + '/kg'}, Isp ${PROPELLANTS[name].isp}s)${!propellants.includes(name) ? ' [not this rocket]' : ''}`, !propellants.includes(name), form.fuel)).join('')}</select>
<select data-s="pay">${Object.keys(PAYLOADS).filter(name => !PAYLOADS[name].mercury).map(name => option(name, payloadLabel(name, airframe), payloadLocked(name, airframe), form.pay)).join('')}</select>
<div class="r" style="margin-top:8px"><span class="d">Propellant load (${propellantKg} kg)</span><b id="ldv">${form.load}%</b></div><input type="range" data-s="load" min="10" max="100" step="5" value="${form.load}" style="width:100%">
${preview ? estimateHTML(preview, payload, airframe) : ''}
${partChannelsHTML(airframe)}
<div class="m">Fuel record: ${S.fr[form.fuel] || 0} successful flights.${airframe && airframe.pk.some(id => !isConfirmed(id)) ? ` Unproven systems aboard: ${airframe.pk.filter(id => !isConfirmed(id)).length} (raises the chance of a hidden fault).` : ''} Range fee ${formatMoney(rangeFee())} included.${rangeDataPayment(1e4) ? ' Successful flights earn a Defense Department range data contract.' : ''}</div><button data-a="count"${quote.error ? ' disabled' : ''}>BEGIN COUNTDOWN${quote.cost ? ' (' + formatMoney(quote.cost) + ')' : ''}</button><div class="m bad">${quote.error || ''}</div>`);
}
// PART TELEMETRY: pick which parts to watch, up to what the airframe's telemetry carries (rules/telemetry.js).
function partChannelsHTML(airframe) {
  if (!airframe) return '';
  const capacity = channelCapacity(airframe), available = availableChannels(airframe);
  if (!capacity) return '<div class="m">Part telemetry: none. The FM telemetry transmitter (instrumentation research) carries one channel from a part of the rocket; multiplexing carries more.</div>';
  if (launchForm.ch == null) launchForm.ch = available.slice(0, capacity);
  const picked = watchedChannels(airframe, launchForm.ch);
  return `<div class="c"><div class="t">PART TELEMETRY (${picked.length} of ${capacity} channel${capacity > 1 ? 's' : ''})</div>`
    + Object.keys(PART_CHANNELS).map(id => {
      const fitted = available.includes(id), on = picked.includes(id);
      return `<label class="m" style="display:block"><input type="checkbox" data-ch="${id}"${on ? ' checked' : ''}${!fitted || (!on && picked.length >= capacity) ? ' disabled' : ''}> ${PART_CHANNELS[id].name}${fitted ? '' : ' [instrument not fitted]'}</label>`;
    }).join('') + '</div>';
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
  const science = row('Science if recovered / telemetry only', `~${formatMoney(value * .5)} / ~${formatMoney(value * .5 * (payload.telemetryShare || 0) * (.4 + .2 * trackingTiers().v))}`);
  if (!recovery.system) return row('Recovery', 'no parachute aboard', 'bad') + science;
  return row('Recovery odds', '~' + Math.round(recovery.chance * 100) + '%', recovery.chance < .3 ? 'bad' : recovery.chance < .6 ? 'wn' : 'ok')
    + row('&nbsp;1. Nose-cone separation', percent(recovery.separation), recovery.separation < .9 ? 'wn' : 'ok')
    + row('&nbsp;2. Re-entry heating', `~${Math.round(recovery.heat * 100)}% of rating (${Math.round(recovery.reentrySpeed / 10) * 10} m/s)`, recovery.heat > 1 ? 'bad' : recovery.heat > .9 ? 'wn' : 'ok')
    + row('&nbsp;3. Chute opens at', `~${Math.round(recovery.openSpeed / 5) * 5} m/s, built for ${recovery.chuteStrength}`, recovery.chuteLoad > 1 ? 'bad' : recovery.chuteLoad > .75 ? 'wn' : 'ok')
    + row('&nbsp;4. Search odds', percent(recovery.search), recovery.search < .6 ? 'wn' : 'ok')
    + science;
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

// THE CAMPAIGN CARD (once the launch director can be hired): the running campaign and the director's requests, or a form
// to start one. The rocket, propellant, payload and stage come from the launch form; the target, deadline and budget from here.
export const campaignForm = { kind: 'ok', goal: 3, months: 12, budget: 100000 };
const CAMPAIGN_MONTHS = [6, 12, 24], CAMPAIGN_BUDGETS = [50000, 100000, 200000, 400000];
// The rocket a new campaign would fly: the launch form's airframe, or the programme in focus.
export function campaignRocket() {
  const airframe = S.air.find(candidate => candidate.id == launchForm.af && candidate.st == 'r');
  return airframe ? airframe.prog : S.cur;
}
const campaignSummary = camp => `${PROGRAMMES[camp.prog].name}, ${targetText(camp.kind, camp.goal)}`;
export function renderCampaign() {
  const panel = $('#pc');
  panel.hidden = !directorUnlocked();
  if (panel.hidden) return;
  const camp = S.auto.camp, last = S.auto.last;
  let html = row('Launch director', S.staff.director ? `${directorRank()}, ${directorExperience()} flight${directorExperience() == 1 ? '' : 's'} run` : 'not hired');
  if (!S.staff.director) html += `<div class="m">The Aerobee flies routinely now. A launch director runs launches as campaigns: you set a target, a deadline and a budget, and the director orders airframes and flies until it is done, while you develop the next rocket. A new director is cautious and asks for guidance; it grows bolder and steadier with every flight. ${formatMoney(DIRECTOR_SALARY)} per funding cycle.</div><button data-a="hire" data-id="director"${S.b < SPECIALISTS.director.cost ? ' disabled' : ''}>HIRE LAUNCH DIRECTOR (${formatMoney(SPECIALISTS.director.cost)})</button>`;
  else if (camp) html += campaignHTML(camp);
  else html += campaignFormHTML();
  if (last && !camp) html += `<div class="m">Last campaign (${outcomeText(last.outcome)}): ${campaignSummary(last)}. ${last.n} flights, ${last.okn} successful, best ${(last.best / 1000).toFixed(1)} km, ${formatMoney(last.spent)} spent.</div>`;
  setHTML($('#cpg'), html);
}
function campaignHTML(camp) {
  const progress = camp.kind == 'alt' ? `best ${(camp.best / 1000).toFixed(1)} km of ${camp.goal}` : `${camp.okn} of ${camp.goal}`;
  return `<div class="t">${campaignSummary(camp)}</div>`
    + row('Progress', progress, camp.kind == 'alt' ? (camp.best >= camp.goal * 1000 ? 'ok' : null) : null)
    + row('Flights flown', camp.n)
    + row('Spent', `${formatMoney(camp.spent)} of ${formatMoney(camp.budget)}`, camp.spent > camp.budget * .8 ? 'wn' : null)
    + row('Deadline', formatDate(camp.end), S.day > camp.end - 60 ? 'wn' : null)
    + row('Flies to', `${Math.round(directorMargin() * 100)}% of the rocket's limits`)
    + (camp.hold
      ? `<div class="c"><div class="wn">The director asks for guidance. ${escapeHtml(camp.hold)}</div><div class="m">Fly the next one yourself from the launch form below, or tell the director to go ahead, flying to ${Math.round(VETERAN_MARGIN * 100)}% of the limits.</div><button data-a="cgo">GO AHEAD</button></div>`
      : `<div class="m">${camp.fuel}, ${camp.pay}, ${camp.st ? 'full stack' : 'upper stage alone'}. The director orders airframes within the budget and picks the propellant load. Flights you fly yourself with this rocket count too.</div>`)
    + '<button data-a="cend">END CAMPAIGN</button>';
}
function campaignFormHTML() {
  const prog = campaignRocket(), ready = !!(S.progs[prog] && S.progs[prog].ready), target = CAMPAIGN_TARGETS[campaignForm.kind];
  if (!target.goals.includes(campaignForm.goal)) campaignForm.goal = target.goals[1];
  return `<div class="m">New campaign for the ${PROGRAMMES[prog].name}, as set in the launch form below: ${launchForm.fuel}, ${launchForm.pay}, ${launchForm.st ? 'full stack' : 'upper stage alone'}.</div>`
    + `<select data-cf="kind">${Object.keys(CAMPAIGN_TARGETS).map(kind => option(kind, CAMPAIGN_TARGETS[kind].name, 0, campaignForm.kind)).join('')}</select>`
    + `<select data-cf="goal">${target.goals.map(goal => option(goal, `Target: ${targetText(campaignForm.kind, goal)}`, 0, campaignForm.goal)).join('')}</select>`
    + `<select data-cf="months">${CAMPAIGN_MONTHS.map(months => option(months, `Deadline: ${formatDate(S.day + months * 30)} (${months} months)`, 0, campaignForm.months)).join('')}</select>`
    + `<select data-cf="budget">${CAMPAIGN_BUDGETS.map(budget => option(budget, `Budget: ${formatMoney(budget)}`, 0, campaignForm.budget)).join('')}</select>`
    + `<button data-a="cstart"${ready ? '' : ' disabled'}>START CAMPAIGN</button>`;
}
