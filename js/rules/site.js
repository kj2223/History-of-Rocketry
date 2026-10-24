// THE SITE from NASA's founding: construction by contractor crews, upkeep, mothballing, and the launch pads. No DOM.
// In Phase One a building is in service the moment it is paid for (rules/launch-site.js); from NASA on, an order waits for one of
// the contractor crews, takes its construction days, and then costs upkeep every funding cycle until it is mothballed.
// A rocket programme with launch complexes of its own (FACILITIES pad) launches only from one of them that is free: after a
// launch the pad is refurbished, and a vehicle that fails close to the pad puts it out of action for longer.
//
// Saved in S:
//   fb   buildings under construction, { id: day in service }       cq   orders waiting for a contractor crew, [id]
//   mb   mothballed buildings, { id: 1 } (not in S.fac while mothballed)
//   pt   pads being refurbished or repaired, { id: day free again }
import { FACILITIES, SITE, CONTROL_ROOM_FACILITIES, STATIONS } from '../data/launch-site.js';
import { MERCURY_DIRECTIVES } from '../data/mercury.js';
import { S, log, formatDate, addHistory } from '../core/state.js';
import { CYCLES_PER_YEAR } from './budget.js';
import { programmeOf } from './programs.js';

// CONSTRUCTION
export const buildDaysOf = id => FACILITIES[id].buildDays || Math.max(SITE.minimumDays, Math.round(FACILITIES[id].cost / 1000 * SITE.daysPerThousand));
const underConstruction = () => Object.keys(S.fb || {});
export const waitingOrders = () => S.cq || [];
export const crewsBusy = () => underConstruction().length;
// A building's place in the construction line: 'built', 'building', 'waiting', 'mothballed' or 'none'.
export const siteStatus = id => S.fac[id] ? 'built' : S.fb && S.fb[id] ? 'building' : waitingOrders().includes(id) ? 'waiting' : S.mb && S.mb[id] ? 'mothballed' : 'none';
// The success a building waits on, or null: an upgrade opens once its Mercury directive is met.
export function directiveLock(id) {
  const key = FACILITIES[id].afterDirective;
  if (!key) return null;
  const index = MERCURY_DIRECTIVES.findIndex(directive => directive.key == key);
  return S.p2 && S.p2.dir > index ? null : `Opens after: ${MERCURY_DIRECTIVES[index].name}.`;
}
// Order a building (already paid for): it starts at once if a contractor crew is free, otherwise it waits its turn.
export function orderConstruction(id) {
  S.cq = [...waitingOrders(), id];
  log(`[BASE] Ordered: ${FACILITIES[id].name}, ${buildDaysOf(id)} days of construction.${crewsBusy() >= SITE.contractorCrews ? ' It waits for a free contractor crew.' : ''}`, 'wn');
  startWaitingOrders();
}
// Bring a mothballed building back: it goes through the construction line, with a short job.
export function reopen(id) {
  if (siteStatus(id) != 'mothballed') return;
  S.cq = [...waitingOrders(), id];
  log(`[BASE] ${FACILITIES[id].name} will be brought back into service (${SITE.reopenDays} days).`, 'wn');
  startWaitingOrders();
}
function startWaitingOrders() {
  while (S.cq && S.cq.length && crewsBusy() < SITE.contractorCrews) {
    const id = S.cq.shift();
    S.fb = S.fb || {};
    S.fb[id] = Math.round(S.day + (S.mb && S.mb[id] ? SITE.reopenDays : buildDaysOf(id)));
    log(`[BASE] Construction begins: ${FACILITIES[id].name}. In service around ${formatDate(S.fb[id])}.`, 'wn');
  }
}
// Every second: buildings whose day has come go into service and free their crew. Returns true if any did.
export function constructionTick() {
  if (!S.fb) return false;
  let changed = false;
  for (const id in S.fb) if (S.day >= S.fb[id]) {
    delete S.fb[id];
    if (S.mb) delete S.mb[id];
    S.fac[id] = 1;
    if (FACILITIES[id].controlRoom) addHistory(`Control room: ${FACILITIES[id].name}`);
    log(`[BASE] ${FACILITIES[id].name} is in service.`, 'hd');
    changed = true;
  }
  if (changed) startWaitingOrders();
  return changed;
}

// UPKEEP: every building in service costs a share of its price a year, paid each funding cycle (NASA only).
export const upkeepOf = id => Math.round(FACILITIES[id].cost * SITE.upkeepPerYear / CYCLES_PER_YEAR);
export const upkeep = () => S.nasa ? Object.keys(S.fac).reduce((sum, id) => sum + (S.fac[id] && FACILITIES[id] ? upkeepOf(id) : 0), 0) : 0;
// MOTHBALLING stops a building's upkeep and its effect. Not for the control room (its consoles are staffed), a pad that is in
// use, a building another one stands on, or one a hired station needs.
export function mothballLock(id) {
  if (!FACILITIES[id]) return 'Unknown.';
  if (!S.nasa) return 'Only NASA can mothball a building.';
  if (!S.fac[id]) return 'Not in service.';
  if (CONTROL_ROOM_FACILITIES.includes(id)) return 'The control room stays staffed.';
  if (S.pt && S.pt[id] > S.day) return 'The pad is being refurbished.';
  const above = Object.keys(FACILITIES).find(other => FACILITIES[other].requires == id && siteStatus(other) != 'none');
  if (above) return `${FACILITIES[above].name} depends on it.`;
  const station = Object.keys(STATIONS).find(other => STATIONS[other].requires == id && S.crew[other]);
  if (station) return `The ${STATIONS[station].callSign} console depends on it.`;
  return null;
}
export function mothball(id) {
  if (mothballLock(id)) return;
  delete S.fac[id];
  S.mb = { ...S.mb, [id]: 1 };
  log(`[BASE] ${FACILITIES[id].name} mothballed: no more upkeep, and out of service until it is reopened.`, 'wn');
}

// LAUNCH PADS
const padsFor = airframe => Object.keys(FACILITIES).filter(id => FACILITIES[id].pad == programmeOf(airframe));
const padFree = id => S.fac[id] && !(S.pt && S.pt[id] > S.day);
// Why this airframe cannot launch for want of a pad, or null (also null for rockets that need no pad of their own).
export function padLock(airframe) {
  const pads = padsFor(airframe);
  if (!pads.length || pads.some(padFree)) return null;
  const built = pads.filter(id => S.fac[id]);
  if (!built.length) return `Needs a launch complex of its own: ${FACILITIES[pads[0]].name} (Base desk).`;
  const first = built.sort((one, other) => S.pt[one] - S.pt[other])[0];
  return `${FACILITIES[first].name} is being readied after the last launch, until ${formatDate(S.pt[first])}.`;
}
// A launch takes a free pad and leaves it to be refurbished. Returns the pad's id, or null for a rocket that needs none.
export function usePad(airframe) {
  const id = padsFor(airframe).find(padFree);
  if (!id) return null;
  S.pt = { ...S.pt, [id]: Math.round(S.day + SITE.padTurnaround) };
  return id;
}
// A vehicle that failed within seconds of liftoff wrecks the pad's equipment.
export function damagePad(id, secondsAfterLiftoff) {
  if (!id || secondsAfterLiftoff > SITE.padDamageSeconds) return;
  S.pt = { ...S.pt, [id]: Math.round(S.day + SITE.padRepair) };
  log(`[PAD] The failure came within seconds of liftoff: ${FACILITIES[id].name} is damaged, out of action until ${formatDate(S.pt[id])}.`, 'bad');
}
// When the pad is free again, or null if it is free now.
export const padBusyUntil = id => S.pt && S.pt[id] > S.day ? S.pt[id] : null;
