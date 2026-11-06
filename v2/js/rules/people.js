// People (V2 freeze §7, §9; GAME-DESIGN §8.9). Heads and, from slice 2, crew are person records with three
// hidden traits: risk tolerance, candour and independence, each in [0, 1]. Traits never leave the rules:
// project() shows the record and never the values. The record has room for fuller people later
// (personalities, families, press profiles) without changing these rules: `profile` is reserved for that.

import { TUNING } from '../data/tuning.js';

export const TRAITS = ['risk', 'candour', 'independence'];

export const initPeople = () => ({});

export const addPerson = (state, { id, name, role, kind = 'head', traits }) => {
  const p = { id, name, role, kind, traits: { ...traits }, profile: {},
    record: { since: state.day, history: [], flights: [], training: [], medical: { status: 'eligible', since: state.day }, availability: 'available', consents: [] } };
  state.people[id] = p;
  return p;
};

export const headFor = (state, role) => Object.values(state.people).find(p => p.kind === 'head' && p.role === role && p.record.availability !== 'departed') ?? null;

const clamp = v => Math.min(TUNING.traitBounds[1], Math.max(TUNING.traitBounds[0], v));

// Culture transmission (GAME-DESIGN §8.9): a trait moves a small step in the direction of what the
// administrator actually rewards. `signal` is +1 or -1 (fractions allowed). Returns the new value.
export const transmit = (person, trait, signal) => {
  person.traits[trait] = clamp(person.traits[trait] + TUNING.traitDrift * signal);
  return person.traits[trait];
};

// What a person's record shows: everything except the traits.
export const publicPerson = p => ({ id: p.id, name: p.name, role: p.role, kind: p.kind, record: structuredClone(p.record) });
