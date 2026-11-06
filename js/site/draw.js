// DRAWING: the site side-on, and the range's tracking board during a flight. Reads the game, never changes it.
// World units: 1 unit is about a third of a foot (the launch tower is 102 ft, 300 units). The ground is at y = GROUND.
import { VIEW_H, GROUND, WORLD_W, PLACES } from '../data/white-sands.js';
export { VIEW_H, GROUND, WORLD_W, PLACES };
import { KITS } from '../data/kits.js';
import { blockhouseState, SITES } from '../data/campaign.js';

const SKY = { day: ['#5d8fc4', '#a9c8e4', '#ead9b8'], dusk: ['#2b3150', '#8a5a6a', '#e09a62'] };

function skyFor(minute) { // minute of the day
  const h = minute / 60;
  return h > 17.5 || h < 7 ? SKY.dusk : SKY.day;
}

export function drawSite(ctx, g, view) {
  const { w, h } = view, s = h / VIEW_H, camX = g.cam.x;
  ctx.save();
  ctx.scale(s, s);
  const vw = w / s;
  const sky = skyFor(g.clock % 1440);
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND);
  grad.addColorStop(0, sky[0]); grad.addColorStop(0.7, sky[1]); grad.addColorStop(1, sky[2]);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, vw, GROUND);
  const cape = g.site === 'cape';
  if (cape) {
    // The Atlantic on the horizon, flat as a table, and a line of palmettos and scrub behind the pads.
    ctx.fillStyle = '#3f6f8f'; ctx.fillRect(0, 440, vw, GROUND - 440);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; for (let x = (-camX * 0.2) % 70; x < vw; x += 70) ctx.fillRect(x, 452 + ((x * 3) % 20), 26, 2);
    ctx.fillStyle = '#5b7a3c'; ctx.fillRect(0, 488, vw, GROUND - 488);
    for (let x = (-camX * 0.4) % 140; x < vw + 140; x += 140) palm(ctx, x, 492);
    ctx.fillStyle = '#e4d8b4'; ctx.fillRect(0, GROUND, vw, VIEW_H - GROUND);
    ctx.fillStyle = '#d3c597'; ctx.fillRect(0, GROUND, vw, 5);
  } else {
    // The Organ Mountains, far off, moving slowly behind the site.
    mountains(ctx, camX * 0.15, vw, '#8d86a0', 380, [0, 60, 30, 120, 70, 150, 40, 90, 20]);
    mountains(ctx, camX * 0.3, vw, '#a99a8c', 440, [10, 40, 25, 60, 15, 50, 35, 20, 45]);
    ctx.fillStyle = '#d9c39a'; ctx.fillRect(0, GROUND, vw, VIEW_H - GROUND);
    ctx.fillStyle = '#cdb489'; ctx.fillRect(0, GROUND, vw, 5);
  }

  ctx.translate(-camX, 0);
  // Scrub along the desert floor, or sea grass on the Cape's sand.
  ctx.fillStyle = cape ? '#7f9a52' : '#9c9c62';
  for (let x = 40; x < WORLD_W + 400; x += 97) { const y = GROUND + 12 + ((x * 7) % 50); ctx.fillRect(x, y, 6, 3); ctx.fillRect(x + 2, y - 3, 2, 3); }
  // The road out to the range.
  ctx.fillStyle = '#c3a87c'; ctx.fillRect(0, GROUND + 30, WORLD_W + 400, 8);

  office(ctx, PLACES.office, g);
  hangar(ctx, PLACES.hangar, g);
  if (g.crewed) trainer(ctx, PLACES.stand, PLACES.dugout);
  else { stand(ctx, PLACES.stand, g); dugout(ctx, PLACES.dugout); }
  blockhouse(ctx, PLACES.blockhouse, g);
  tower(ctx, PLACES.tower);
  truck(ctx, g.truck.x, g);
  rocketOnSite(ctx, g);
  for (const job of g.jobs) jobBar(ctx, job);
  for (const p of Object.values(g.people)) if (!p.hidden) person(ctx, p, g.time);
  for (const p of Object.values(g.people)) if (!p.hidden && p.bubble) bubble(ctx, p.x, GROUND - 44, p.bubble.text, p.bubble.tone);
  if (g.marker != null) { ctx.fillStyle = 'rgba(255,240,180,.8)'; ctx.fillRect(g.marker - 3, GROUND + 2, 6, 3); }
  // Building names on hover.
  if (g.hover) label(ctx, g.hover.room === 'truck' && !g.crewed ? { ...g.hover, name: SITES[g.site || 'white-sands'].truck } : g.hover);
  ctx.restore();
  // Night falls as a fade.
  if (g.fade > 0) { ctx.fillStyle = `rgba(5,8,14,${g.fade})`; ctx.fillRect(0, 0, w, h); }
}

// A cabbage palmetto, far off: a thin trunk and a burst of fronds.
function palm(ctx, x, y) {
  ctx.strokeStyle = '#5a4a32'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4, y - 20, x + 2, y - 38); ctx.stroke();
  ctx.strokeStyle = '#3f6a35'; ctx.lineWidth = 3;
  for (const a of [-2.6, -2.1, -1.6, -1.1, -0.6]) { ctx.beginPath(); ctx.moveTo(x + 2, y - 38); ctx.lineTo(x + 2 + Math.cos(a) * 16, y - 38 + Math.sin(a) * 9 + 8); ctx.stroke(); }
}

function mountains(ctx, offset, vw, color, base, peaks) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, GROUND);
  const span = 260;
  for (let x = -span; x < vw + span; x += span / 2) {
    const i = Math.floor((x + offset) / (span / 2)), k = ((i % peaks.length) + peaks.length) % peaks.length;
    ctx.lineTo(x - ((x + offset) % (span / 2)), base - peaks[k]);
  }
  ctx.lineTo(vw + span, GROUND); ctx.fill();
}

function label(ctx, place) {
  ctx.font = '13px Georgia, serif'; ctx.textAlign = 'center';
  const x = place.x + place.w / 2, y = GROUND - place.h - 14, tw = ctx.measureText(place.name).width + 14;
  ctx.fillStyle = 'rgba(15,18,24,.85)'; ctx.fillRect(x - tw / 2, y - 14, tw, 20);
  ctx.fillStyle = '#f1e6c8'; ctx.fillText(place.name, x, y);
}

function office(ctx, p, g) {
  if (g.crewed) return mercuryControl(ctx, p);
  ctx.fillStyle = '#c9b79a'; ctx.fillRect(p.x, GROUND - p.h, p.w, p.h);
  ctx.fillStyle = '#7d6b55'; ctx.fillRect(p.x - 8, GROUND - p.h - 8, p.w + 16, 10);
  // Cutaway: the inside, with the drawing board and desks.
  ctx.fillStyle = '#efe4cc'; ctx.fillRect(p.x + 10, GROUND - p.h + 12, p.w - 20, p.h - 12);
  ctx.fillStyle = '#6b4f35'; ctx.fillRect(p.x + 30, GROUND - 30, 50, 4); ctx.fillRect(p.x + 34, GROUND - 26, 3, 26); ctx.fillRect(p.x + 74, GROUND - 26, 3, 26);
  ctx.save(); ctx.translate(p.x + 150, GROUND - 46); ctx.rotate(-0.35);
  ctx.fillStyle = '#f8f5ea'; ctx.fillRect(-30, -20, 60, 40); ctx.strokeStyle = '#4b6a8a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-20, 8); ctx.lineTo(20, 8); ctx.moveTo(-14, 8); ctx.lineTo(-14, -12); ctx.lineTo(-10, -16); ctx.lineTo(-6, -12); ctx.lineTo(-6, 8); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#5a4630'; ctx.fillRect(p.x + 148, GROUND - 34, 3, 34);
  ctx.fillStyle = '#6e8fa8'; ctx.fillRect(p.x + 196, GROUND - p.h + 24, 26, 20);
}

// Mercury Control, cut away: the world map on the far wall with the capsule's track, and a row of consoles.
function mercuryControl(ctx, p) {
  ctx.fillStyle = '#d6d1c4'; ctx.fillRect(p.x, GROUND - p.h, p.w, p.h);
  ctx.fillStyle = '#a7a194'; ctx.fillRect(p.x - 8, GROUND - p.h - 8, p.w + 16, 10);
  ctx.fillStyle = '#22272e'; ctx.fillRect(p.x + 10, GROUND - p.h + 12, p.w - 20, p.h - 12);
  ctx.fillStyle = '#2f4f6a'; ctx.fillRect(p.x + 30, GROUND - p.h + 20, p.w - 60, 44);
  ctx.fillStyle = '#5d7d52'; for (const [dx, dy, w, h] of [[16, 8, 30, 14], [60, 14, 22, 20], [104, 6, 40, 16], [150, 18, 18, 12]]) ctx.fillRect(p.x + 30 + dx, GROUND - p.h + 20 + dy, w, h);
  ctx.strokeStyle = '#f2e3a0'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i <= 40; i++) { const x = p.x + 34 + i * (p.w - 68) / 40, y = GROUND - p.h + 42 + 14 * Math.sin(i / 40 * Math.PI * 2); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke();
  ctx.fillStyle = '#4b5258'; ctx.fillRect(p.x + 20, GROUND - 26, p.w - 40, 16);
  ctx.fillStyle = '#9fdc9a'; for (let i = 0; i < 6; i++) ctx.fillRect(p.x + 28 + i * 34, GROUND - 23, 20, 6);
}

function hangar(ctx, p, g) {
  // A quonset-style hangar, cut away to show the floor.
  ctx.fillStyle = '#8c8f93';
  ctx.beginPath(); ctx.moveTo(p.x, GROUND); ctx.lineTo(p.x, GROUND - p.h + 40);
  ctx.quadraticCurveTo(p.x + p.w / 2, GROUND - p.h - 40, p.x + p.w, GROUND - p.h + 40); ctx.lineTo(p.x + p.w, GROUND); ctx.fill();
  ctx.fillStyle = '#3d3f43';
  ctx.beginPath(); ctx.moveTo(p.x + 12, GROUND); ctx.lineTo(p.x + 12, GROUND - p.h + 46);
  ctx.quadraticCurveTo(p.x + p.w / 2, GROUND - p.h - 22, p.x + p.w - 12, GROUND - p.h + 46); ctx.lineTo(p.x + p.w - 12, GROUND); ctx.fill();
  ctx.strokeStyle = '#55585d'; ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) { const x = p.x + (p.w * i) / 6; ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x, GROUND - p.h + 20); ctx.stroke(); }
  // Hanging lamps.
  ctx.fillStyle = '#f3dd8a'; for (let i = 1; i < 4; i++) ctx.fillRect(p.x + (p.w * i) / 4 - 5, GROUND - p.h + 40, 10, 4);
  // Work benches and the booster on its rack.
  ctx.fillStyle = '#6a5a44'; ctx.fillRect(p.x + 30, GROUND - 22, 70, 4); ctx.fillRect(p.x + 34, GROUND - 18, 3, 18); ctx.fillRect(p.x + 94, GROUND - 18, 3, 18);
  // What waits on the rack to be mated: the WAC's Tiny Tim booster, or the WAC that rides on a Bumper's nose.
  // Hangar S: the next Mercury capsule on its stand, being checked out.
  if (g.crewed) { capsuleShape(ctx, p.x + 220, GROUND - 30, false); ctx.fillStyle = '#6a5a44'; ctx.fillRect(p.x + 200, GROUND - 22, 40, 22); }
  if (!g.rocket.mated && g.rocket.where !== 'gone') {
    if (g.vehicle === 'wac' || g.vehicle === 'aerobee') boosterShape(ctx, p.x + p.w - 90, GROUND - 14, 0);
    else if (g.vehicle === 'bumper') wacShape(ctx, p.x + p.w - 30, GROUND - 26, -Math.PI / 2, false);
  }
  ctx.fillStyle = '#d9c39a'; ctx.fillRect(p.x + 12, GROUND - 2, p.w - 24, 2);
}

function stand(ctx, p, g) {
  // An open steel frame over a flame trench.
  ctx.fillStyle = '#7a6a58'; ctx.fillRect(p.x - 10, GROUND - 4, p.w + 20, 8);
  ctx.fillStyle = '#2a2420'; ctx.fillRect(p.x + 40, GROUND - 2, 40, 6);
  ctx.strokeStyle = '#5b5f66'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(p.x + 20, GROUND); ctx.lineTo(p.x + 30, GROUND - p.h); ctx.lineTo(p.x + 90, GROUND - p.h); ctx.lineTo(p.x + 100, GROUND); ctx.stroke();
  ctx.lineWidth = 2;
  for (let y = 30; y < p.h; y += 30) { ctx.beginPath(); ctx.moveTo(p.x + 22, GROUND - y); ctx.lineTo(p.x + 98, GROUND - y); ctx.stroke(); }
  if (g.standFlame > 0) flame(ctx, p.x + 60, GROUND - 40, g.standFlame, Math.PI / 2, g.time, 1.4);
}

// The training building at the Cape: a low block with a cutaway of the simulator, a copy of a Mercury Control console.
function trainer(ctx, stand, dug) {
  const x = stand.x - 10, w = dug.x + dug.w - x + 10, h = 74;
  ctx.fillStyle = '#c8c2b2'; ctx.fillRect(x, GROUND - h, w, h);
  ctx.fillStyle = '#a9a291'; ctx.fillRect(x - 8, GROUND - h - 8, w + 16, 10);
  ctx.fillStyle = '#2c3138'; ctx.fillRect(x + 12, GROUND - h + 14, w - 24, h - 14);
  ctx.fillStyle = '#3f4a3c'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 30 + i * 52, GROUND - 30, 40, 18);
  ctx.fillStyle = '#9fdc9a'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 36 + i * 52, GROUND - 26, 28, 8);
  ctx.fillStyle = '#1b2026'; ctx.fillRect(x + 40, GROUND - h + 20, w - 80, 22);
  ctx.strokeStyle = '#f2e3a0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 46, GROUND - h + 38); ctx.quadraticCurveTo(x + w / 2, GROUND - h + 18, x + w - 46, GROUND - h + 36); ctx.stroke();
}

function dugout(ctx, p) {
  ctx.fillStyle = '#9b8a70'; ctx.beginPath(); ctx.moveTo(p.x - 20, GROUND); ctx.quadraticCurveTo(p.x + p.w / 2, GROUND - p.h * 2, p.x + p.w + 20, GROUND); ctx.fill();
  ctx.fillStyle = '#2b2a28'; ctx.fillRect(p.x + 14, GROUND - 20, 22, 6); ctx.fillRect(p.x + 52, GROUND - 20, 22, 6);
  ctx.fillStyle = '#4b3b2b'; ctx.fillRect(p.x + 36, GROUND - 26, 16, 26);
}

function blockhouse(ctx, p, g) {
  const state = blockhouseState(g.day);
  if (state.built) return newBlockhouse(ctx, p);
  if (state.progress > 0) building(ctx, p.x - 160, state.progress);
  ctx.fillStyle = '#a7a196'; ctx.fillRect(p.x, GROUND - p.h, p.w, p.h);
  ctx.fillStyle = '#918b80'; ctx.fillRect(p.x - 10, GROUND - p.h - 12, p.w + 20, 14);
  // Cutaway with the firing panel and periscope.
  ctx.fillStyle = '#4c4f46'; ctx.fillRect(p.x + 14, GROUND - p.h + 16, p.w - 28, p.h - 16);
  ctx.fillStyle = '#2f3a2c'; ctx.fillRect(p.x + 30, GROUND - 34, 80, 22);
  ctx.fillStyle = '#c94'; for (let i = 0; i < 6; i++) ctx.fillRect(p.x + 36 + i * 12, GROUND - 30, 5, 5);
  ctx.fillStyle = '#6c6'; ctx.fillRect(p.x + 36, GROUND - 22, 5, 5);
  ctx.fillStyle = '#555'; ctx.fillRect(p.x + 140, GROUND - p.h - 26, 6, 26); ctx.fillRect(p.x + 140, GROUND - p.h - 26, 14, 5);
}

// The new blockhouse going up beside the old one: footings, then walls rising inside scaffolding, then the roof slab.
function building(ctx, x, k) {
  const w = 150, h = 90, wall = Math.min(1, k / 0.8) * h;
  ctx.fillStyle = '#8f8a80'; ctx.fillRect(x - 6, GROUND - 6, w + 12, 6);
  ctx.fillStyle = '#b9b3a6'; ctx.fillRect(x, GROUND - wall, w, wall);
  if (k > 0.8) { ctx.fillStyle = '#a49e92'; ctx.fillRect(x - 8, GROUND - h - 14, (w + 16) * Math.min(1, (k - 0.8) / 0.2), 14); }
  ctx.strokeStyle = '#7b6a52'; ctx.lineWidth = 2;
  for (let sx = x - 10; sx <= x + w + 10; sx += 32) { ctx.beginPath(); ctx.moveTo(sx, GROUND); ctx.lineTo(sx, GROUND - h - 20); ctx.stroke(); }
  for (let sy = 24; sy < h + 20; sy += 24) { ctx.beginPath(); ctx.moveTo(x - 10, GROUND - sy); ctx.lineTo(x + w + 10, GROUND - sy); ctx.stroke(); }
}

// The new blockhouse: bigger and squatter, with a heavy roof, two periscopes and a cutaway firing room with more panels.
function newBlockhouse(ctx, p) {
  const w = p.w + 140, h = 92, x = p.x - 150;
  ctx.fillStyle = '#b3ad9f'; ctx.fillRect(x, GROUND - h, w, h);
  ctx.fillStyle = '#9b9588'; ctx.fillRect(x - 14, GROUND - h - 18, w + 28, 20);
  ctx.fillStyle = '#4c4f46'; ctx.fillRect(x + 16, GROUND - h + 18, w - 32, h - 18);
  ctx.fillStyle = '#2f3a2c'; ctx.fillRect(x + 28, GROUND - 38, 90, 26); ctx.fillRect(x + 130, GROUND - 38, 70, 26);
  ctx.fillStyle = '#c94'; for (let i = 0; i < 7; i++) ctx.fillRect(x + 34 + i * 12, GROUND - 33, 5, 5);
  ctx.fillStyle = '#6c6'; for (let i = 0; i < 5; i++) ctx.fillRect(x + 136 + i * 12, GROUND - 25, 5, 5);
  ctx.fillStyle = '#3a3d40'; ctx.fillRect(x + w - 40, GROUND - h + 22, 18, 50); // the telemetry rack
  ctx.fillStyle = '#555'; for (const px of [x + 40, x + w - 60]) { ctx.fillRect(px, GROUND - h - 44, 6, 26); ctx.fillRect(px, GROUND - h - 44, 14, 5); }
}

function tower(ctx, p) {
  // The 102-foot launch tower: a slender lattice with the rails inside it.
  const top = GROUND - p.h;
  ctx.strokeStyle = '#4e5560'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(p.x, GROUND); ctx.lineTo(p.x + 14, top); ctx.moveTo(p.x + p.w, GROUND); ctx.lineTo(p.x + p.w - 14, top); ctx.stroke();
  ctx.lineWidth = 1.2;
  for (let y = 0; y < p.h; y += 20) {
    const k1 = y / p.h, k2 = (y + 20) / p.h, l1 = p.x + 14 * k1, r1 = p.x + p.w - 14 * k1, l2 = p.x + 14 * k2, r2 = p.x + p.w - 14 * k2;
    ctx.beginPath(); ctx.moveTo(l1, GROUND - y); ctx.lineTo(r1, GROUND - y); ctx.moveTo(l1, GROUND - y); ctx.lineTo(r2, GROUND - y - 20); ctx.moveTo(r1, GROUND - y); ctx.lineTo(l2, GROUND - y - 20); ctx.stroke();
  }
  ctx.fillStyle = '#7a6a58'; ctx.fillRect(p.x - 14, GROUND - 4, p.w + 28, 8);
}

function truck(ctx, x, g) {
  const y = GROUND + 28;
  ctx.fillStyle = '#4d5b3a'; ctx.fillRect(x, y - 30, 64, 22); ctx.fillRect(x + 64, y - 40, 26, 32);
  ctx.fillStyle = '#9fc0d0'; ctx.fillRect(x + 72, y - 36, 12, 10);
  ctx.fillStyle = '#1e1e1e'; for (const wx of [x + 14, x + 44, x + 76]) { ctx.beginPath(); ctx.arc(wx, y - 6, 7, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#e8e0c8'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(g.site === 'cape' ? 'U.S. NAVY' : 'U.S. ARMY', x + 8, y - 16);
  if (g.truck.dust) { ctx.fillStyle = 'rgba(210,190,150,.5)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x - 8 - i * 12, y - 8 - i * 3, 6 + i * 3, 0, 7); ctx.fill(); } }
}

// The rocket wherever it is on the site: in pieces in the hangar, carried, on the stand, on the truck, in the tower.
function rocketOnSite(ctx, g) {
  const r = g.rocket, wac = g.vehicle === 'wac' || g.vehicle === 'aerobee', len = wac ? 24 : 50;
  // The whole round as it stands (mated), or the stage the crew handles on its own (the WAC upper stage, or the V-2).
  const shape = (x, y, angle, mated) => (g.vehicle === 'redstone' ? mercuryRedstoneShape(ctx, x, y, angle, r.padAbort) : g.vehicle === 'atlas' ? mercuryAtlasShape(ctx, x, y, angle) : wac ? wacShape(ctx, x, y, angle, mated) : g.vehicle === 'vanguard' ? vanguardShape(ctx, x, y, angle) : g.vehicle === 'juno' ? junoShape(ctx, x, y, angle) : g.vehicle === 'ranger' ? atlasAgenaShape(ctx, x, y, angle) : g.vehicle === 'viking' ? vikingShape(ctx, x, y, angle) : v2Shape(ctx, x, y, angle, mated && g.vehicle === 'bumper'));
  if (r.where === 'hangar') { shape(PLACES.hangar.x + (wac ? 160 : 230), GROUND - (wac ? 26 : 30), -Math.PI / 2, r.mated); if (wac) cradle(ctx, PLACES.hangar.x + 160, r.mated); else trailer(ctx, PLACES.hangar.x + 130); }
  else if (r.where === 'carried') shape(r.x + (wac ? -len : len), GROUND - 22, -Math.PI / 2, false);
  else if (r.where === 'stand') shape(PLACES.stand.x + 60, GROUND - 40, 0, false);
  else if (r.where === 'truck') shape(g.truck.x + (wac ? 2 : 90), GROUND - 10, -Math.PI / 2, true);
  else if (r.where === 'tower') shape(PLACES.tower.x + 25, GROUND - 8, 0, true);
  else if (r.where === 'flying') {
    shape(PLACES.tower.x + 25, GROUND - 8 - r.rise, 0, wac ? r.rise < 40 : true);
    flame(ctx, PLACES.tower.x + 25, GROUND - 8 - r.rise, 1, Math.PI / 2, g.time, wac ? 1.6 : 2.4);
    ctx.fillStyle = 'rgba(235,230,220,.6)';
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(PLACES.tower.x + 25 + (i - 4) * 12, GROUND - 6 - (i % 3) * 6, 10 + i, 0, 7); ctx.fill(); }
  }
}

// The Mercury capsule: a black cone with its heat shield at the base. tower: the red escape tower on its nose.
function capsuleShape(ctx, x, y, tower) {
  ctx.fillStyle = '#1d1f22'; ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.lineTo(x + 4, y - 14); ctx.lineTo(x - 4, y - 14); ctx.fill();
  ctx.fillRect(x - 3, y - 20, 6, 6);
  ctx.fillStyle = '#7a6a58'; ctx.fillRect(x - 9, y, 18, 2);
  if (tower) { ctx.strokeStyle = '#c2352a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 3, y - 20); ctx.lineTo(x, y - 40); ctx.lineTo(x + 3, y - 20); ctx.stroke(); ctx.fillStyle = '#c2352a'; ctx.fillRect(x - 1.5, y - 46, 3, 8); }
}
// Mercury-Redstone: the white Redstone with its stubby fins, the capsule and the escape tower. padAbort: after the four-inch
// flight, with the tower gone and the parachutes hanging off the capsule.
export function mercuryRedstoneShape(ctx, x, y, angle, padAbort = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = '#f1efe8'; ctx.fillRect(-6, -84, 12, 84);
  ctx.fillStyle = '#1d1f22'; ctx.fillRect(-6, -60, 12, 4); ctx.fillRect(-6, -20, 12, 3);
  ctx.fillStyle = '#d8d4c8'; ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(-12, 0); ctx.lineTo(-6, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(6, -12); ctx.lineTo(12, 0); ctx.lineTo(6, 0); ctx.fill();
  ctx.fillStyle = '#c7c2b6'; ctx.fillRect(-6, -90, 12, 6);
  capsuleShape(ctx, 0, -90, !padAbort);
  if (padAbort) { ctx.fillStyle = 'rgba(240,236,226,.9)'; ctx.beginPath(); ctx.ellipse(7, -96, 9, 12, 0.4, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(214,92,52,.9)'; ctx.beginPath(); ctx.ellipse(10, -84, 6, 14, 0.2, 0, 7); ctx.fill(); }
  ctx.restore();
}

function trailer(ctx, x) {
  ctx.fillStyle = '#4d5b3a'; ctx.fillRect(x - 10, GROUND - 22, 120, 6);
  ctx.fillStyle = '#1e1e1e'; for (const wx of [x, x + 96]) { ctx.beginPath(); ctx.arc(wx, GROUND - 6, 6, 0, 7); ctx.fill(); }
}

// The Navy's Viking: long, slim and white, with small swept fins and a gimballed engine under the tail.
export function vikingShape(ctx, x, y, angle) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = '#f1efe8'; ctx.fillRect(-5, -100, 10, 100);
  ctx.fillStyle = '#f1efe8'; ctx.beginPath(); ctx.moveTo(-5, -100); ctx.quadraticCurveTo(-4, -112, 0, -118); ctx.quadraticCurveTo(4, -112, 5, -100); ctx.fill();
  ctx.fillStyle = '#2b3f6b'; ctx.fillRect(-5, -60, 10, 3); ctx.fillRect(-5, -30, 10, 3);
  ctx.fillStyle = '#9aa0a8'; ctx.beginPath(); ctx.moveTo(-5, -14); ctx.lineTo(-13, 0); ctx.lineTo(-5, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(5, -14); ctx.lineTo(13, 0); ctx.lineTo(5, 0); ctx.fill();
  ctx.restore();
}

// Juno II: the Jupiter, fat and white with black roll stripes, then JPL's tub of upper stages under a shroud and the small
// gold Pioneer cone.
export function junoShape(ctx, x, y, angle) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = '#f2f0e9'; ctx.fillRect(-12, -150, 24, 150);
  ctx.fillStyle = '#26272b'; ctx.fillRect(-12, -40, 24, 6); ctx.fillRect(-12, -110, 24, 6); ctx.fillRect(-12, -150, 12, 20);
  ctx.fillStyle = '#d9d6cc'; ctx.beginPath(); ctx.moveTo(-12, -150); ctx.lineTo(-8, -200); ctx.lineTo(8, -200); ctx.lineTo(12, -150); ctx.fill();
  ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.moveTo(-5, -200); ctx.lineTo(0, -218); ctx.lineTo(5, -200); ctx.fill();
  ctx.restore();
}

// Atlas-Agena B with Ranger: the Atlas's steel balloon, its booster skirt, the slim Agena and the shroud over the Ranger.
export function atlasAgenaShape(ctx, x, y, angle) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = '#c9ccd1'; ctx.fillRect(-14, -170, 28, 170);
  ctx.fillStyle = '#b3b7bd'; ctx.fillRect(-17, -36, 34, 36); // the booster section
  ctx.fillStyle = '#3e4652'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.rotate(-Math.PI / 2); ctx.fillText('UNITED STATES', 100, 3); ctx.restore();
  ctx.fillStyle = '#e8e6df'; ctx.fillRect(-7, -232, 14, 62); // the Agena
  ctx.fillStyle = '#f2f0e9'; ctx.beginPath(); ctx.moveTo(-8, -232); ctx.lineTo(-8, -250); ctx.lineTo(0, -270); ctx.lineTo(8, -250); ctx.lineTo(8, -232); ctx.fill();
  ctx.restore();
}

// Mercury-Atlas: the Atlas D's silver balloon and booster skirt, an adapter, the capsule and its escape tower.
export function mercuryAtlasShape(ctx, x, y, angle) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = '#c9ccd1'; ctx.fillRect(-14, -170, 28, 170);
  ctx.fillStyle = '#b3b7bd'; ctx.fillRect(-17, -36, 34, 36);
  ctx.fillStyle = '#3e4652'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.rotate(-Math.PI / 2); ctx.fillText('UNITED STATES', 100, 3); ctx.restore();
  ctx.fillStyle = '#d8d4c8'; ctx.beginPath(); ctx.moveTo(-14, -170); ctx.lineTo(-9, -180); ctx.lineTo(9, -180); ctx.lineTo(14, -170); ctx.fill();
  capsuleShape(ctx, 0, -180, true);
  ctx.restore();
}

// Vanguard: slim and tall, white with a black band, three stages stacked, the small third stage under a pointed fairing.
export function vanguardShape(ctx, x, y, angle) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = '#f3f1ea'; ctx.fillRect(-6, -128, 12, 128); // first stage
  ctx.fillStyle = '#e7e4da'; ctx.fillRect(-5, -178, 10, 50); // second stage
  ctx.fillStyle = '#26272b'; ctx.fillRect(-6, -132, 12, 5); ctx.fillRect(-6, -60, 12, 4);
  ctx.fillStyle = '#c8c4b8'; ctx.beginPath(); ctx.moveTo(-5, -178); ctx.lineTo(-4, -196); ctx.lineTo(0, -210); ctx.lineTo(4, -196); ctx.lineTo(5, -178); ctx.fill();
  ctx.fillStyle = '#2b3f6b'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.rotate(-Math.PI / 2); ctx.fillText('NAVY', 90, 2); ctx.restore();
  ctx.restore();
}

// A captured V-2, black-and-white checked as at White Sands, drawn from its tail at (x, y) along angle (0 = straight up),
// with a WAC Corporal on its nose when it is a Bumper.
export function v2Shape(ctx, x, y, angle, withWac) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = '#ece8dc'; ctx.fillRect(-7, -84, 14, 84);
  ctx.fillStyle = '#1d1f24'; ctx.fillRect(0, -84, 7, 21); ctx.fillRect(-7, -63, 7, 21); ctx.fillRect(0, -42, 7, 21); ctx.fillRect(-7, -21, 7, 21);
  ctx.fillStyle = '#ece8dc'; ctx.beginPath(); ctx.moveTo(-7, -84); ctx.quadraticCurveTo(-6, -98, 0, -104); ctx.quadraticCurveTo(6, -98, 7, -84); ctx.fill();
  ctx.fillStyle = '#1d1f24'; ctx.beginPath(); ctx.moveTo(-7, -20); ctx.lineTo(-16, 2); ctx.lineTo(-7, 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(7, -20); ctx.lineTo(16, 2); ctx.lineTo(7, 2); ctx.fill();
  ctx.restore();
  if (withWac) { ctx.save(); ctx.translate(x, y); ctx.rotate(angle); wacShape(ctx, 0, -100, 0, false); ctx.restore(); }
}

function cradle(ctx, x, mated) {
  ctx.fillStyle = '#6a5a44';
  ctx.fillRect(x - 6, GROUND - 22, 4, 22); ctx.fillRect(x + 30, GROUND - 22, 4, 22); if (mated) ctx.fillRect(x + 70, GROUND - 22, 4, 22);
}

// WAC Corporal upper stage (and the Tiny Tim booster under it when mated), drawn from its tail at (x, y), pointing along angle
// (0 = straight up). Widths are exaggerated so the round reads at this scale.
export function wacShape(ctx, x, y, angle, withBooster) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  let base = 0;
  if (withBooster) { boosterShape(ctx, 0, 0, 0, true); base = -26; }
  ctx.fillStyle = '#e9e4d6'; ctx.fillRect(-3.5, base - 48, 7, 48);
  ctx.fillStyle = '#c03a2b'; ctx.beginPath(); ctx.moveTo(-3.5, base - 48); ctx.lineTo(0, base - 60); ctx.lineTo(3.5, base - 48); ctx.fill();
  ctx.fillStyle = '#20232a'; ctx.fillRect(-3.5, base - 30, 7, 2);
  ctx.fillStyle = '#9aa0a8'; ctx.beginPath(); ctx.moveTo(-3.5, base - 8); ctx.lineTo(-9, base); ctx.lineTo(-3.5, base); ctx.fill();
  ctx.beginPath(); ctx.moveTo(3.5, base - 8); ctx.lineTo(9, base); ctx.lineTo(3.5, base); ctx.fill();
  ctx.restore();
}

function boosterShape(ctx, x, y, angle, attached) {
  ctx.save(); ctx.translate(x, y); if (!attached) ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#5d6168'; ctx.fillRect(-5, -26, 10, 26);
  ctx.fillStyle = '#3c3f44'; ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(-12, 0); ctx.lineTo(-5, 0); ctx.moveTo(5, -10); ctx.lineTo(12, 0); ctx.lineTo(5, 0); ctx.fill();
  ctx.restore();
}

function flame(ctx, x, y, power, angle, time, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle - Math.PI / 2);
  const len = (26 + 8 * Math.sin(time * 40)) * power * scale;
  const grad = ctx.createLinearGradient(0, 0, 0, len);
  grad.addColorStop(0, 'rgba(255,250,220,.95)'); grad.addColorStop(0.4, 'rgba(255,170,60,.85)'); grad.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(-4 * scale, 0); ctx.lineTo(0, len); ctx.lineTo(4 * scale, 0); ctx.fill();
  ctx.restore();
}

function jobBar(ctx, job) {
  if (!job.minutes) return;
  const x = job.at - 30, y = GROUND - 120, done = 1 - job.left / job.minutes;
  ctx.fillStyle = 'rgba(15,18,24,.8)'; ctx.fillRect(x - 4, y - 16, 68, 26);
  ctx.fillStyle = '#f1e6c8'; ctx.font = '9px Georgia, serif'; ctx.textAlign = 'left'; ctx.fillText(job.label, x, y - 5);
  ctx.fillStyle = '#444'; ctx.fillRect(x, y, 60, 4); ctx.fillStyle = '#e8c66a'; ctx.fillRect(x, y, 60 * done, 4);
}

// A person: a small figure with legs that move while walking. The player wears a light shirt and is marked.
function person(ctx, p, time) {
  const x = p.x, y = GROUND, walking = Math.abs(p.target - p.x) > 1, step = walking ? Math.sin(time * 12 + p.x * 0.05) * 4 : 0;
  ctx.strokeStyle = '#2b2620'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x - step, y); ctx.moveTo(x, y - 12); ctx.lineTo(x + step, y); ctx.stroke();
  ctx.fillStyle = p.color; ctx.fillRect(x - 4, y - 26, 8, 15);
  ctx.fillStyle = '#e2b993'; ctx.beginPath(); ctx.arc(x, y - 30, 4, 0, 7); ctx.fill();
  if (p.hat) { ctx.fillStyle = p.hat; ctx.fillRect(x - 5, y - 35, 10, 3); }
  if (p.working && !walking) { ctx.fillStyle = Math.sin(time * 20) > 0 ? '#ffe28a' : '#fff'; ctx.fillRect(x + 6 * p.face, y - 20 + Math.sin(time * 9) * 3, 2, 2); }
  if (p.id === 'you') { ctx.fillStyle = '#e8c66a'; ctx.beginPath(); ctx.moveTo(x - 4, y - 44); ctx.lineTo(x + 4, y - 44); ctx.lineTo(x, y - 39); ctx.fill(); }
}

// A speech bubble above (x, y). tone: '' | 'go' | 'warn' | 'bad'.
export function bubble(ctx, x, y, text, tone = '') {
  ctx.font = '12px Georgia, serif';
  const lines = wrap(ctx, text, 190), lh = 15, bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16, bh = lines.length * lh + 10;
  const bx = x - bw / 2, by = y - bh - 8;
  ctx.fillStyle = tone === 'bad' ? '#f6d2cc' : tone === 'warn' ? '#f8e7b8' : tone === 'go' ? '#dcefd8' : '#fbf7ec';
  ctx.strokeStyle = '#2b2620'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 5, by + bh); ctx.lineTo(x, by + bh + 8); ctx.lineTo(x + 5, by + bh); ctx.fill();
  ctx.fillStyle = '#1d1a16'; ctx.textAlign = 'left';
  lines.forEach((l, i) => ctx.fillText(l, bx + 8, by + 16 + i * lh));
}

function wrap(ctx, text, width) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > width && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line);
  return lines;
}

// A round grid step, 1, 2 or 5 times a power of ten, for about eight lines across `span`.
function niceStep(span) {
  const raw = span / 8, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

// THE TRACKING BOARD: the range's plot of height against distance downrange, drawn as the flight goes.
export function drawTracking(ctx, g, view) {
  const { w, h } = view, f = g.flight, path = f.result.path, upto = Math.min(path.length - 1, Math.floor(f.t));
  ctx.fillStyle = '#0d1a14'; ctx.fillRect(0, 0, w, h);
  // The plot's scale grows with the round: a WAC peaks near 70 km, a V-2 over 150, a Bumper several hundred.
  const deep = !!f.result.deep, top = Math.max(80, deep ? 0 : g.round.estimate.high * 1.15, f.result.apogee * 1.1), hStep = niceStep(top);
  const range = f.result.range, maxH = Math.ceil(top / hStep) * hStep, xStep = range <= 40 ? 5 : range <= 120 ? 10 : niceStep(range * 1.1);
  const pad = 70, maxX = Math.max(30, Math.ceil(f.result.range / xStep) * xStep + xStep);
  const px = x => pad + (x / maxX) * (w - pad * 2), py = km => h - pad - (km / maxH) * (h - pad * 2);
  ctx.strokeStyle = '#1f3b2d'; ctx.lineWidth = 1; ctx.font = '12px monospace'; ctx.fillStyle = '#5fae7f'; ctx.textAlign = 'right';
  for (let k = 0; k <= maxH; k += hStep) { ctx.beginPath(); ctx.moveTo(pad, py(k)); ctx.lineTo(w - pad, py(k)); ctx.stroke(); ctx.fillText(k >= 10000 ? `${k / 1000}k km` : `${k} km`, pad - 8, py(k) + 4); }
  ctx.textAlign = 'center';
  for (let k = 0; k <= maxX; k += xStep) { ctx.beginPath(); ctx.moveTo(px(k), py(0)); ctx.lineTo(px(k), py(maxH)); ctx.stroke(); ctx.fillText(`${k}`, px(k), h - pad + 18); }
  ctx.fillText('km downrange', w / 2, h - pad + 36);
  ctx.textAlign = 'left'; ctx.fillStyle = '#8fd6a8'; ctx.font = '14px monospace';
  ctx.fillText(`${SITES[g.site || 'white-sands'].plot} · RANGE PLOT · ${KITS[g.vehicle].range}`, pad, 32);
  // The drawing office's estimate, faint (a lunar shot has none: she goes off the top of the board).
  if (!deep) {
  ctx.strokeStyle = 'rgba(232,198,106,.35)'; ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(px(0), py(g.round.estimate.low)); ctx.lineTo(w - pad, py(g.round.estimate.low)); ctx.moveTo(px(0), py(g.round.estimate.high)); ctx.lineTo(w - pad, py(g.round.estimate.high)); ctx.stroke();
  ctx.setLineDash([]); ctx.fillStyle = 'rgba(232,198,106,.6)'; ctx.fillText('drawing-office estimate', w - pad - 190, py(g.round.estimate.high) - 6);
  }
  ctx.strokeStyle = '#9ff0b8'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= upto; i++) { const p = path[i]; i ? ctx.lineTo(px(p.x), py(p.h)) : ctx.moveTo(px(p.x), py(p.h)); }
  ctx.stroke();
  const p = path[upto];
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px(p.x), py(p.h), 4, 0, 7); ctx.fill();
  ctx.fillStyle = '#8fd6a8'; ctx.font = '16px monospace';
  ctx.fillText(`T+${String(Math.floor(f.t)).padStart(3, '0')} s   ALT ${p.h.toFixed(1)} km   RANGE ${p.x.toFixed(1)} km`, pad, 58);
  // The loop: the latest calls, as bubbles along the bottom.
  const calls = f.calls.slice(-3);
  calls.forEach((c, i) => bubble(ctx, pad + 130 + i * 260, h - 96, `${c.who}: ${c.text}`, c.tone));
}
