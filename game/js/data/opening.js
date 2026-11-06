// The standard 1958 agency (V2 freeze §3): what a fresh V2 start inherits at NASA formation. Authored content,
// not a random roll. It has the same shape as a V1 import: heads with hidden traits, facilities, an
// obligation with an owner and a recorded disagreement, which arrive as live items.
import { dayOf } from '../core/calendar.js';

// Fictional heads. Their traits are hidden and only ever shown through what they do.
export const HEADS_1958 = [
  { id: 'head-td', role: 'technical-director', name: 'Walter Kessler', traits: { risk: 0.4, candour: 0.7, independence: 0.5 } },
  { id: 'head-fo', role: 'financial-officer', name: 'Margaret Hale', traits: { risk: 0.3, candour: 0.6, independence: 0.4 } },
  { id: 'head-dh', role: 'department-head', name: 'Ray Delgado', traits: { risk: 0.6, candour: 0.5, independence: 0.6 } },
];

// The Retrofire officer Flight Control brings with it (V2 freeze §6.3). Fictional. Skill is hidden like a trait.
export const RETROFIRE_OFFICER = { id: 'retro-1', role: 'retrofire-officer', name: 'Lou Varga', skill: 0.6, traits: { risk: 0.4, candour: 0.6, independence: 0.5 } };

// Inherited from the satellite programmes NASA absorbs: a settlement still owed to a contractor.
export const OBLIGATIONS_1958 = [
  { kind: 'contract-settlement', dept: 'financial-officer', programmeId: null, amount: 350000, due: dayOf(1959, 3, 31), text: 'Vanguard contract settlement owed to the Martin Company' },
];

// A disagreement already on the record: the financial officer will not support a second Atlas pad this year.
export const DISAGREEMENTS_1958 = [
  { type: 'funding-commitment', subject: 'second-atlas-pad', raisedBy: 'technical-director',
    text: 'The technical director wants a second Atlas pad committed now, before the first Atlas is delivered. The financial officer will not support it inside this year\'s award.',
    finance: { stance: 'veto', reason: 'not affordable inside this year\'s award' }, technical: { stance: 'approve', reason: 'pad time will be the bottleneck for orbital flights' } },
];
