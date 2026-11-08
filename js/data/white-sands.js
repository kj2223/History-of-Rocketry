// The site side-on (White Sands from 1945; the Cape keeps the same layout): where each building stands along the ground, in world units.
// Shared by the game state (where people walk) and the drawing. Content, not hidden truth.
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
