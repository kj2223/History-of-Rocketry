// Flight operations for entry and recovery (V2 freeze §6.3, §6.4). The Retrofire officer computes the
// retrofire data and Flight Control sends it; the crew executes. The player never enters burn times,
// attitudes or bank angles: the administrator sets how the agency checks the data and approves where the
// recovery force waits and what it costs. Wrong numbers draw only from the operations stream, and nothing
// here reads hidden truth. What anyone learns about an entry comes from instruments and recovery.

import { ENTRY_DESIGN, ENTRY_CLAIMS, RECOVERY_FORCES, RETROFIRE } from '../data/flight.js';
import { RETROFIRE_OFFICER } from '../data/opening.js';
import { VEHICLES } from '../data/vehicles.js';
import { draw } from '../core/rng.js';
import { Rejection, memo } from './authority.js';
import { addPerson } from './people.js';
import { money as dollars } from './reports.js';

export const CHECKING = ['single', 'independent'];

export const initOperations = state => {
  state.operations = { retrofireChecking: 'single' };
  // The Retrofire officer's skill is hidden like a trait: the player learns it from the record of the data sent.
  if (!state.people[RETROFIRE_OFFICER.id]) addPerson(state, { ...RETROFIRE_OFFICER, kind: 'staff' }).hidden = { skill: RETROFIRE_OFFICER.skill };
};

export const setChecking = (state, { policy }) => {
  if (!CHECKING.includes(policy)) throw new Rejection(`Retrofire checking is one of ${CHECKING.join(', ')}`);
  state.operations.retrofireChecking = policy;
  memo(state, { from: 'flight-control', text: policy === 'independent'
    ? `From now on a second analyst checks every set of retrofire data before Flight Control sends it. It costs ${dollars(RETROFIRE.independentCheckCost)} a flight.`
    : 'From now on the Retrofire officer\'s retrofire data goes out without a second check.' });
};

export const flies = vehicle => !!ENTRY_DESIGN[vehicle];

// The recovery force for a launch (V2 freeze §6.4), and its cost with the retrofire check.
export const operationsCost = (state, vehicle, recovery) => !flies(vehicle) ? 0
  : RECOVERY_FORCES[recovery].cost + (ENTRY_DESIGN[vehicle].retro && state.operations.retrofireChecking === 'independent' ? RETROFIRE.independentCheckCost : 0);

export const checkRecovery = recovery => { if (!RECOVERY_FORCES[recovery]) throw new Rejection(`No recovery force ${recovery}: choose ${Object.keys(RECOVERY_FORCES).join(', ')}`); };

export const positionRecovery = (state, { launchId, force }) => {
  const l = state.launches.find(x => x.id === launchId);
  if (!l) throw new Rejection(`No launch ${launchId}`);
  if (!flies(l.vehicle)) throw new Rejection(`${VEHICLES[l.vehicle].name} needs no recovery force`);
  if (l.status !== 'awaiting-decision') throw new Rejection('The recovery force can only be moved before launch');
  checkRecovery(force);
  l.recovery = force;
  l.operationsCost = operationsCost(state, l.vehicle, force);
};

// The data the Retrofire officer sends for one flight. Four draws whatever happens. Workload is the other
// flights Flight Control is running at the same time; an independent check catches most errors.
export const retrofireData = (state, l) => {
  const design = ENTRY_DESIGN[l.vehicle], officer = state.people[RETROFIRE_OFFICER.id], s = state.rng.operations;
  const err = draw(s), check = draw(s), size = draw(s), sign = draw(s) < 0.5 ? -1 : 1;
  if (!design.retro) return { sent: null, ground: {} };
  const workload = state.launches.filter(x => x.status === 'in-flight' && x.id !== l.id).length;
  const chance = RETROFIRE.baseErrorChance * (1.5 - officer.hidden.skill) * (1 + RETROFIRE.workloadPerFlight * workload);
  const checked = state.operations.retrofireChecking === 'independent';
  const wrong = err < chance, caught = wrong && checked && check < RETROFIRE.independentCheckCatches;
  const sent = { by: officer.id, checked, caught, workload };
  if (caught) memo(state, { from: 'flight-control', refs: { launch: l.id }, text: `The independent check caught an error in ${officer.name}'s retrofire data for ${VEHICLES[l.vehicle].name} ${l.articleId}. Corrected data went to the crew.` });
  if (!wrong || caught) return { sent, ground: {} };
  // A ballistic capsule gets a wrong firing time; Gemini's computer gets a wrong idea of where the target is.
  const [lo, hi] = design.spacecraft === 'gemini' ? RETROFIRE.wrongTarget : RETROFIRE.wrongTime;
  const value = sign * (lo + (hi - lo) * size);
  return { sent, ground: design.spacecraft === 'gemini' ? { navError: value } : { late: value } };
};

// The entry as Flight Control and recovery saw it, from the observations and what the world showed.
export const entryRecord = (state, l, obs, events) => {
  const design = ENTRY_DESIGN[l.vehicle], [heat, g, wet] = ENTRY_CLAIMS(design.spacecraft);
  const of = q => obs.find(o => o.quantity === q);
  const val = q => (of(q)?.state === 'measured' ? of(q).value : null);
  return {
    predicted: { footprint: design.footprint, force: l.recovery },
    contact: events.contact,
    blackout: val('vehicle.blackout'),
    sighting: val('vehicle.landing-miss'),
    peakG: val(g), heatLoad: val(heat), water: val(wet),
    pickupHours: events.pickupHours, capsuleRecovered: events.capsuleRecovered, crewCondition: l.crew?.length ? events.crewCondition : null,
    reportedBy: l.crew?.length ? 'crew' : 'accelerometer',
  };
};

const km = v => (Math.abs(v) < 1 ? 'at' : `${Math.round(Math.abs(v))} km ${v >= 0 ? 'long' : 'short'}`);

// Recovery's report: what the instruments and the ships showed, never the truth behind them.
export const describeEntry = (state, l) => {
  const e = l.entry;
  if (!e) return '';
  if (!e.contact) return ' Tracking never regained contact after the blackout. Recovery searched the footprint and found nothing.';
  const parts = [];
  parts.push(e.blackout === null ? 'Tracking lost the spacecraft in the blackout and the timing was not recorded.' : e.blackout < 1 ? 'There was no blackout.' : `Blackout lasted ${Math.round(e.blackout)} s.`);
  if (e.peakG !== null) parts.push(`${e.reportedBy === 'crew' ? 'The crew reported' : 'The accelerometer recorded'} a peak of ${e.peakG.toFixed(1)} g.`);
  parts.push(e.sighting === null ? 'Recovery did not fix the landing point precisely.' : `Recovery sighted the spacecraft ${km(e.sighting)}${Math.abs(e.sighting) < 1 ? '' : ' of'} the predicted point (the prediction was good to about ${e.predicted.footprint} km).`);
  parts.push(`Pickup took ${e.pickupHours} hours with ${RECOVERY_FORCES[e.predicted.force].name}.`);
  if (!e.capsuleRecovered) parts.push('The spacecraft took on water and sank before it could be lifted.');
  if (e.crewCondition) parts.push(`The crew came out ${e.crewCondition}.`);
  return ` ${parts.join(' ')}`;
};
