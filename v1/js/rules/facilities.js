// Facilities (freeze §6). Existence is not readiness; a reservation is not consumption; exclusive
// reservations never overlap; displacing another programme escalates to the administrator.

import { FACILITY_KINDS, STARTING_UNITS } from '../data/facilities.js';
import { Rejection, openDecision } from './authority.js';

export const initFacilities = () => ({
  units: Object.fromEntries(STARTING_UNITS.map(u => [u.id, { ...u, status: 'operational' }])),
  reservations: [],
});

const unit = (state, id) => state.facilities.units[id] ?? (() => { throw new Rejection(`No facility ${id}`); })();
const overlaps = (r, from, to) => r.status === 'held' && r.from <= to && from <= r.to;

export const holders = (state, unitId, from, to) => state.facilities.reservations.filter(r => r.unitId === unitId && overlaps(r, from, to));

// Reserve a unit for [from, to]. Returns { reservation } or { decision } when it would displace another programme.
export const reserve = (state, { id, unitId, programmeId, from, to, purpose }) => {
  const u = unit(state, unitId);
  if (u.status !== 'operational') throw new Rejection(`${unitId} is ${u.status}, not available`);
  const limit = FACILITY_KINDS[u.kind].exclusive ? 1 : u.capacity;
  const taken = holders(state, unitId, from, to);
  const reservation = { id, unitId, programmeId, from, to, purpose, status: 'held' };
  if (taken.length < limit) { state.facilities.reservations.push(reservation); return { reservation: id }; }
  const others = taken.filter(r => r.programmeId !== programmeId);
  if (!others.length) throw new Rejection(`${programmeId} already holds ${unitId} for that time`);
  const d = openDecision(state, { type: 'displacement', subject: unitId, raisedBy: 'technical-director',
    text: `${programmeId} wants ${unitId} from day ${from} to ${to}, which would displace ${others.map(r => r.programmeId).join(', ')}.`,
    evidence: others.map(r => r.id), options: ['displace', 'decline'], effect: { kind: 'displace', payload: { reservation, displaced: others[0].id } } });
  return { decision: d.id };
};

export const displace = (state, { reservation, displaced }) => {
  state.facilities.reservations.find(r => r.id === displaced).status = 'displaced';
  state.facilities.reservations.push(reservation);
};

// Work starting on a reservation consumes it; finishing releases it.
export const setReservation = (state, id, status) => { state.facilities.reservations.find(r => r.id === id).status = status; };

// An upgrade takes the unit out of service until done; its benefit only arrives at completion.
export const beginUpgrade = (state, unitId, capacityAfter) => {
  const u = unit(state, unitId);
  if (u.status !== 'operational') throw new Rejection(`${unitId} is ${u.status}`);
  if (state.facilities.reservations.some(r => r.unitId === unitId && r.status === 'held' && r.to >= state.day)) {
    throw new Rejection(`${unitId} has reservations still held; release or move them first`);
  }
  Object.assign(u, { status: 'upgrading', capacityAfter });
};

export const finishUpgrade = (state, unitId) => {
  const u = unit(state, unitId);
  Object.assign(u, { status: 'operational', capacity: u.capacityAfter ?? u.capacity });
  delete u.capacityAfter;
};

// A new facility must be commissioned before it can be reserved.
export const addUnit = (state, { id, kind, capacity = 1 }) => {
  if (!FACILITY_KINDS[kind]) throw new Rejection(`Unknown facility kind ${kind}`);
  state.facilities.units[id] = { id, kind, capacity, status: 'commissioning' };
};

export const commissioned = (state, unitId) => { unit(state, unitId).status = 'operational'; };
