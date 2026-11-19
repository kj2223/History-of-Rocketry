// MANAGEMENT MODE: the base, as data. Buildings are ready-made (prefabs) placed on the tile grid, each with named slots
// for upgrades later (Aaron's answer 2A, 19 Nov 2026). The Cape as the player inherits it on 1 October 1958 is laid
// out roughly as it stood: the pads in a line behind the beach, each with its blockhouse, and the industrial area
// inland with Hangar S and the range's Central Control. Positions are tiles; the map is SIZE x SIZE.
export const SIZE = 44;

// Where the land ends: the beach runs down the map with a gentle bend, the Atlantic beyond it.
export const coast = ty => 33 + Math.round(1.6 * Math.sin(ty / 7));

// What each kind of building is. w, d: footprint in tiles. slots: where upgrades will fit.
export const PREFABS = {
  pad: { name: 'Launch pad', w: 5, d: 5, slots: ['tower', 'deflector', 'umbilical'] },
  blockhouse: { name: 'Blockhouse', w: 2, d: 2, slots: ['periscope', 'consoles'] },
  hangar: { name: 'Hangar', w: 4, d: 3, slots: ['bay', 'crane', 'clean-room'] },
  control: { name: 'Control centre', w: 3, d: 3, slots: ['plotboard', 'consoles'] },
  office: { name: 'Offices', w: 3, d: 2, slots: ['wing'] },
  tracking: { name: 'Tracking station', w: 2, d: 2, slots: ['dish'] },
};

// The pads' ids match the manifest (js/manage/manifest.js), so a scheduled flight stands on its own pad.
export const CAPE_1958_BASE = [
  { id: 'lc-14', kind: 'pad', padKind: 'atlas', tx: 25, ty: 4, name: 'Launch Complex 14' },
  { id: 'bh-14', kind: 'blockhouse', tx: 21, ty: 5, name: 'Blockhouse 14' },
  { id: 'lc-18a', kind: 'pad', padKind: 'vanguard', tx: 25, ty: 12, name: 'Launch Complex 18A' },
  { id: 'bh-18', kind: 'blockhouse', tx: 21, ty: 13, name: 'Blockhouse 18' },
  { id: 'lc-17a', kind: 'pad', padKind: 'thor', tx: 26, ty: 20, name: 'Launch Complex 17A' },
  { id: 'bh-17', kind: 'blockhouse', tx: 22, ty: 21, name: 'Blockhouse 17' },
  { id: 'lc-5', kind: 'pad', padKind: 'redstone', tx: 27, ty: 28, name: 'Launch Complex 5' },
  { id: 'lc-6', kind: 'pad', padKind: 'redstone', tx: 27, ty: 34, name: 'Launch Complex 6' },
  { id: 'bh-56', kind: 'blockhouse', tx: 23, ty: 32, name: 'Blockhouse 5/6' },
  { id: 'hangar-s', kind: 'hangar', tx: 7, ty: 17, name: 'Hangar S' },
  { id: 'hangar-d', kind: 'hangar', tx: 7, ty: 23, name: 'Hangar D' },
  { id: 'central-control', kind: 'control', tx: 11, ty: 9, name: 'Central Control' },
  { id: 'offices', kind: 'office', tx: 6, ty: 10, name: 'Range offices' },
  { id: 'tracking', kind: 'tracking', tx: 15, ty: 30, name: 'Range tracking station' },
];

// Roads: runs of tiles, [tx, ty, length, 'x' | 'y']. The range road down the middle, and a spur to each pad.
export const CAPE_1958_ROADS = [
  [18, 2, 38, 'y'],
  [5, 15, 13, 'x'],
  [10, 21, 8, 'x'],
  [19, 6, 6, 'x'],
  [19, 14, 6, 'x'],
  [19, 22, 7, 'x'],
  [19, 30, 8, 'x'],
  [19, 36, 8, 'x'],
  [14, 12, 4, 'x'],
];

export const buildingAt = (base, tx, ty) =>
  base.find(b => {
    const p = PREFABS[b.kind];
    return tx >= b.tx && tx < b.tx + p.w && ty >= b.ty && ty < b.ty + p.d;
  }) ?? null;
