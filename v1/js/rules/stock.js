// Agency stock (freeze §7.6). Materials belong to the agency; programmes reserve them, they do not own them.
// Purchase provenance is recorded but is not a restriction.

import { Rejection, openDecision } from './authority.js';

export const initStock = () => ({ items: {} });

export const receive = (state, { material, qty, compatible }, provenance) => {
  const id = `stock-${Object.keys(state.stock.items).length + 1}`;
  state.stock.items[id] = { id, material, qty, compatible, provenance, reserved: {} };
  return state.stock.items[id];
};

const item = (state, id) => state.stock.items[id] ?? (() => { throw new Rejection(`No stock item ${id}`); })();
const reservedQty = it => Object.values(it.reserved).reduce((a, b) => a + b, 0);
export const freeQty = (state, id) => { const it = item(state, id); return it.qty - reservedQty(it); };

// Reserving more than is free escalates to the administrator instead of taking another programme's share.
export const reserveStock = (state, { itemId, programmeId, qty }) => {
  const it = item(state, itemId);
  if (freeQty(state, itemId) >= qty) {
    it.reserved[programmeId] = (it.reserved[programmeId] ?? 0) + qty;
    return { reserved: true };
  }
  const decision = openDecision(state, {
    type: 'stock-conflict', subject: itemId, raisedBy: 'financial-officer',
    text: `${programmeId} needs ${qty} ${it.material}, but only ${freeQty(state, itemId)} is unreserved.`,
    options: ['reallocate', 'buy-more', 'decline'], effect: { kind: 'none' },
  });
  return { reserved: false, decision: decision.id };
};

// Use stock: first from the programme's own reservation, then from compatible unreserved stock.
export const consumeStock = (state, { itemId, programmeId, qty, vehicle }) => {
  const it = item(state, itemId);
  if (vehicle && !it.compatible.includes(vehicle)) throw new Rejection(`${it.material} is not compatible with ${vehicle}`);
  const own = Math.min(it.reserved[programmeId] ?? 0, qty);
  if (qty - own > freeQty(state, itemId)) throw new Rejection(`Not enough unreserved ${it.material}`);
  if (own) it.reserved[programmeId] -= own;
  if (it.reserved[programmeId] === 0) delete it.reserved[programmeId];
  it.qty -= qty;
};
