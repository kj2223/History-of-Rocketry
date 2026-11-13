// The site side-on (White Sands from 1945; the Cape keeps the same layout): where each building stands along the ground, in world units.
// Shared by the game state (where people walk) and the drawing. Content, not hidden truth.
import { blockhouseState } from './campaign.js';

export const VIEW_H = 600,
  GROUND = 520,
  WORLD_W = 3000;

// The buildings, by their left edge and width. door: where people stand to go in. room: the room the player can open.
export const PLACES = {
  office: { x: 110, w: 250, h: 110, door: 300, name: 'Technical office', room: 'office' },
  hangar: { x: 470, w: 430, h: 170, door: 690, name: 'Assembly hangar', room: 'hangar' },
  stand: { x: 1080, w: 120, h: 140, door: 1140, name: 'Static test stand' },
  dugout: { x: 1250, w: 90, h: 34, door: 1295, name: 'Test stand dugout', room: 'dugout' },
  blockhouse: { x: 1500, w: 190, h: 70, door: 1595, name: 'Blockhouse', room: 'blockhouse' },
  tower: { x: 2030, w: 50, h: 300, door: 2055, name: 'Launch tower' },
  truck: { x: 1800, w: 90, h: 40, door: 1845, name: 'Recovery truck', room: 'truck' },
};

// Buildings that change over the years. The new blockhouse (built 1950-51, and the one at the Cape) stands from
// 150 left of the old one's edge and is 140 wider and taller; in the crewed years the old stand and dugout are one
// training building with the simulator in it. The drawing and every hit test read these, so they stay in step.
export const NEW_BLOCKHOUSE = { dx: -150, dw: 140, h: 92, roof: 18 };
export const TRAINER = { h: 74, roof: 8 };

// Where a building stands on the site today, as drawn: its left edge, width and height (roof included), with its
// door and room as in PLACES. Use this, not PLACES, for anything that asks "is this point on the building".
export const newBlockhouseStands = g => g.site === 'cape' || blockhouseState(g.day).built;

export function footprint(id, g) {
  const p = PLACES[id];
  if (!p) return null;
  if (id === 'truck') return { ...p, x: g.truck?.x ?? p.x };
  if (id === 'blockhouse' && newBlockhouseStands(g))
    return { ...p, x: p.x + NEW_BLOCKHOUSE.dx, w: p.w + NEW_BLOCKHOUSE.dw, h: NEW_BLOCKHOUSE.h + NEW_BLOCKHOUSE.roof };
  if (g.crewed && (id === 'stand' || id === 'dugout')) {
    const x = PLACES.stand.x - 10;
    return { ...p, x, w: PLACES.dugout.x + PLACES.dugout.w + 10 - x, h: TRAINER.h + TRAINER.roof };
  }
  return p;
}

// Whether someone is at a place and staying there: near(x) for where they stand and for where they are walking to.
// Anyone only walking past (the pad crew on their way to the tower) is not in the building, so they are never drawn
// inside it (issue #248).
export const staysNear = (p, near) => near(p.x) && near(p.target ?? p.x);

// Whether x is in front of the building: within its footprint, with a little slack at each end.
export const atPlace = (id, g, x, slack = 10) => {
  const f = footprint(id, g);
  return !!f && x >= f.x - slack && x <= f.x + f.w + slack;
};
