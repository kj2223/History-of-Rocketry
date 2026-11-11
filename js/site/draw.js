// DRAWING: the site side-on, and the range's tracking board during a flight. Reads the game, never changes it.
// World units: 1 unit is about a third of a foot (the launch tower is 102 ft, 300 units). The ground is at y = GROUND.
// The static world (terrain, buildings, tower) is painted once into an offscreen layer and blitted each frame; only
// things that move or burn (people, trucks, the rocket, flames) repaint per frame. Layers redrawn when the site, the
// crewed era or the blockhouse construction changes.
import { VIEW_H, GROUND, WORLD_W, PLACES } from '../data/white-sands.js';
export { VIEW_H, GROUND, WORLD_W, PLACES };
import { KITS } from '../data/kits.js';
import { earlierTracks } from '../world/programme.js';
import { WORLD_LAND } from '../data/world-map.js';
import { dateOf } from '../core/calendar.js';
import { surname } from '../data/cast.js';
import { blockhouseState, SITES } from '../data/campaign.js';
import { UNITS, ORBIT_UNITS, PAD_OPTIONS, PACK_OPTIONS, RETRO_OPTIONS } from '../data/mercury.js';

const SKY = { day: ['#5d8fc4', '#a9c8e4', '#ead9b8'], dusk: ['#2b3150', '#8a5a6a', '#e09a62'] };

export function skyFor(minute) {
  // minute of the day
  const h = minute / 60;
  return h > 17.5 || h < 7 ? SKY.dusk : SKY.day;
}

// ---- The static world layer -------------------------------------------------
let staticLayer = null,
  staticKey = '';

// THE ERA the site is dressed for: what stands round the buildings changes with the years, as it did at the Cape.
// 'early' White Sands and the first Cape years; 'space' from 1960 (NASA's trucks, a fixed tracking radar);
// 'apollo' from 1965 (tracking cameras replace the old theodolite huts); 'shuttle' from 1980 (the overhead lines
// buried, a radome, modern trucks).
export const yearOf = g => dateOf(g.day ?? 0).year;
export const eraOf = g => {
  const y = yearOf(g);
  return y >= 1980 ? 'shuttle' : y >= 1965 ? 'apollo' : y >= 1960 ? 'space' : 'early';
};
const staticSignature = g => {
  const bs = blockhouseState(g.day);
  return `${g.site || 'white-sands'}|${g.crewed ? 'crewed' : 'uncrewed'}|${bs.built ? 'built' : bs.progress.toFixed(2)}|${eraOf(g)}`;
};

// The layer is baked at the display's own scale (capped, so a 4K screen does not ask for a canvas too large to hold),
// so the buildings stay sharp instead of being stretched up from one pixel per world unit.
const MAX_BAKE = 3;
const bakeScale = s => Math.min(MAX_BAKE, Math.max(1, Math.ceil(s * 2) / 2));

function rebuildStatic(g, k) {
  const width = WORLD_W + 400;
  if (!staticLayer || staticLayer.width !== Math.round(width * k) || staticLayer.height !== Math.round(VIEW_H * k)) {
    staticLayer = document.createElement('canvas');
    staticLayer.width = Math.round(width * k);
    staticLayer.height = Math.round(VIEW_H * k);
  }
  const c = staticLayer.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, staticLayer.width, staticLayer.height);
  c.setTransform(k, 0, 0, k, 0, 0);
  paintGround(c, g);
  siteDressing(c, g);
  office(c, PLACES.office, g);
  hangarStructure(c, PLACES.hangar);
  if (g.crewed) trainer(c, PLACES.stand, PLACES.dugout);
  else {
    standStructure(c, PLACES.stand);
    dugout(c, PLACES.dugout);
  }
  blockhouse(c, PLACES.blockhouse, g);
  tower(c, PLACES.tower);
  towerDetail(c, PLACES.tower);
  groundShadows(c, g);
  staticKey = staticSignature(g) + '|' + k;
}

// Sunlight from the left: a darker right-edge face on a wall block, so flat rects read as solids.
export function shadeRight(ctx, x, y, w, h, k = 0.1) {
  const d = Math.max(2, w * k);
  ctx.fillStyle = 'rgba(40,32,20,.18)';
  ctx.fillRect(x + w - d, y, d, h);
}

function paintGround(c, g) {
  const cape = g.site === 'cape';
  // Broken sediment lines and stones, baked with the rest of the site.
  for (let x = 12; x < WORLD_W + 400; x += 23) {
    const y = GROUND + 6 + ((x * 13) % (VIEW_H - GROUND - 8));
    const length = 8 + ((x * 7) % 27);
    c.fillStyle = cape ? 'rgba(112,102,74,.12)' : 'rgba(109,78,45,.14)';
    c.fillRect(x, y, length, 1);
    c.fillRect(x + length + 4, y + 2, 3, 2);
    c.fillStyle = 'rgba(255,247,221,.21)';
    c.fillRect(x + 2, y - 1, length - 3, 1);
  }
  // Scrub along the desert floor, or sea grass on the Cape's sand.
  c.fillStyle = cape ? '#7f9a52' : '#9c9c62';
  for (let x = 40; x < WORLD_W + 400; x += 97) {
    const y = GROUND + 12 + ((x * 7) % 50);
    c.fillRect(x, y, 6, 3);
    c.fillRect(x + 2, y - 3, 2, 3);
  }
  // Stones and pale patches on the sand, placed from x so they never change between frames.
  c.fillStyle = 'rgba(120,100,70,.3)';
  for (let x = 60; x < WORLD_W + 400; x += 173) {
    c.beginPath();
    c.arc(x + ((x * 13) % 44), GROUND + 16 + ((x * 7) % 40), 1.6 + (x % 3), 0, 7);
    c.fill();
  }
  c.fillStyle = 'rgba(255,244,214,.25)';
  for (let x = 110; x < WORLD_W + 400; x += 240) c.fillRect(x, GROUND + 8 + ((x * 3) % 44), 26 + (x % 20), 3);
  // The road out to the range, with wheel ruts.
  c.fillStyle = '#c3a87c';
  c.fillRect(0, GROUND + 30, WORLD_W + 400, 8);
  c.fillStyle = 'rgba(120,100,70,.25)';
  c.fillRect(0, GROUND + 32, WORLD_W + 400, 1);
  c.fillRect(0, GROUND + 35, WORLD_W + 400, 1);
  c.fillStyle = 'rgba(251,232,189,.32)';
  c.fillRect(0, GROUND + 30, WORLD_W + 400, 1);
  for (const p of [PLACES.office, PLACES.hangar, PLACES.blockhouse, PLACES.tower]) {
    const left = p.x - 12,
      width = p.w + 24;
    c.fillStyle = cape ? '#b5ad99' : '#b9a17c';
    c.beginPath();
    c.moveTo(left + 8, GROUND);
    c.lineTo(left + width - 8, GROUND);
    c.lineTo(left + width, GROUND + 22);
    c.lineTo(left, GROUND + 22);
    c.fill();
    c.fillStyle = 'rgba(73,61,48,.24)';
    c.fillRect(left, GROUND + 22, width, 2);
    if (cape) {
      c.fillStyle = 'rgba(73,61,48,.20)';
      for (let joint = left + 36; joint < left + width - 10; joint += 46) c.fillRect(joint, GROUND + 2, 1, 20);
      c.fillStyle = 'rgba(255,235,176,.55)';
      c.fillRect(p.door - 15, GROUND + 17, 30, 2);
    } else {
      c.fillStyle = 'rgba(73,61,48,.18)';
      c.fillRect(p.door - 17, GROUND + 3, 3, 27);
      c.fillRect(p.door + 12, GROUND + 7, 3, 23);
    }
  }
}

// ---- Site dressing: the things around the buildings that make it a place ----------------------------------------------
// Baked into the static layer (siteDressing behind the buildings, groundShadows in front of them) or, where it moves with
// the wind or the clock, drawn per frame (skyDressing, siteLife). None of it is clickable and none of it reads the game
// beyond the site and the clock.

// The telephone line that feeds the site, the water tank by the office, the range stations past the tower, desert or
// dune plants along the ground, and the boundary sign at the far end of the range road. Painted before the buildings so
// they stand in front of the line.
function siteDressing(c, g) {
  const cape = g.site === 'cape',
    era = eraOf(g);
  // White Sands keeps its wooden tank; the Cape's water stands in a steel tower.
  if (cape) steelWaterTower(c, 22);
  else waterTank(c, 22);
  if (era !== 'shuttle') telephoneLine(c, [-30, 95, 404, 990, 1440, 1736]);
  if (era === 'early' || era === 'space') theodoliteHut(c, 2290);
  else trackingCamera(c, 2290);
  if (era === 'early') radarTrailer(c, 2560);
  else if (era === 'shuttle') radome(c, 2560);
  else fixedRadar(c, 2560);
  boundarySign(c, SIGN_X);
  fence(c, 2860, WORLD_W + 400);
  // Plants placed from x so they never shift between rebuilds; kept clear of the doors and the pad.
  for (let x = 30; x < WORLD_W + 380; x += 131) {
    const px = x + ((x * 17) % 60),
      near = Object.values(PLACES).some(p => px > p.x - 30 && px < p.x + p.w + 30);
    if (near) continue;
    if (cape) seaOats(c, px, GROUND + 2);
    else if ((x / 131) % 3 < 1) yucca(c, px, GROUND + 1);
    else creosote(c, px, GROUND + 2, 7 + (x % 5));
  }
  // Nearer the camera, below the road: bigger bushes, partly cut off by the bottom of the view.
  for (let x = 140; x < WORLD_W + 380; x += 377)
    cape
      ? seaOats(c, x + ((x * 7) % 90), GROUND + 70, 1.6)
      : creosote(c, x + ((x * 7) % 90), GROUND + 74, 16 + (x % 7));
}

// Sun from the left: each building throws a short shadow to the right along the sand. Painted after the buildings.
function groundShadows(c, g) {
  const bs = blockhouseState(g.day);
  const blocks = [
    [PLACES.office.x, PLACES.office.w + 8],
    [PLACES.hangar.x, PLACES.hangar.w],
    [PLACES.blockhouse.x, PLACES.blockhouse.w + 10],
  ];
  if (bs.built) blocks.push([PLACES.blockhouse.x - 150, PLACES.blockhouse.w + 154]);
  for (const [x, w] of blocks) {
    const grad = c.createLinearGradient(x + w, 0, x + w + 46, 0);
    grad.addColorStop(0, 'rgba(70,52,30,.22)');
    grad.addColorStop(1, 'rgba(70,52,30,0)');
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(x + w, GROUND);
    c.lineTo(x + w + 46, GROUND + 7);
    c.lineTo(x + 18, GROUND + 7);
    c.lineTo(x, GROUND);
    c.fill();
  }
  // The tower's thin lattice shadow, laid along the ground to the right.
  const t = PLACES.tower;
  c.strokeStyle = 'rgba(70,52,30,.16)';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(t.x + t.w / 2, GROUND + 3);
  c.lineTo(t.x + t.w / 2 + 150, GROUND + 9);
  c.stroke();
}

function telephoneLine(c, xs) {
  const top = GROUND - 96;
  // The wires first, two per crossarm, sagging between the poles.
  c.strokeStyle = 'rgba(40,36,32,.55)';
  c.lineWidth = 0.8;
  for (let i = 0; i < xs.length - 1; i++)
    for (const dx of [-11, 11]) {
      const a = xs[i] + dx,
        b = xs[i + 1] + dx,
        sag = Math.min(18, (b - a) / 30);
      c.beginPath();
      c.moveTo(a, top + 2);
      c.quadraticCurveTo((a + b) / 2, top + 2 + sag * 2, b, top + 2);
      c.stroke();
    }
  for (const x of xs) {
    c.fillStyle = '#6b5236';
    c.fillRect(x - 2, top - 4, 4, GROUND - top + 4);
    c.fillStyle = 'rgba(30,22,14,.25)';
    c.fillRect(x + 1, top - 4, 1, GROUND - top + 4); // the shaded side
    c.fillStyle = '#5a4430';
    c.fillRect(x - 15, top, 30, 3);
    c.fillStyle = '#9fb6a8';
    for (const dx of [-11, -5, 5, 11]) c.fillRect(x + dx - 1, top - 3, 2, 3); // glass insulators
  }
}

// A wooden water tank on a trestle, the kind every camp in the desert had.
function waterTank(c, x) {
  const legs = GROUND - 70;
  c.strokeStyle = '#6e5a42';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x + 4, GROUND);
  c.lineTo(x + 10, legs);
  c.moveTo(x + 44, GROUND);
  c.lineTo(x + 38, legs);
  c.stroke();
  c.lineWidth = 1.2;
  c.beginPath();
  for (const y of [GROUND - 22, GROUND - 46]) {
    c.moveTo(x + 6, y);
    c.lineTo(x + 42, y);
  }
  c.moveTo(x + 6, GROUND - 22);
  c.lineTo(x + 40, GROUND - 46);
  c.moveTo(x + 42, GROUND - 22);
  c.lineTo(x + 8, GROUND - 46);
  c.stroke();
  c.fillStyle = '#8a6d4c';
  c.fillRect(x, legs - 40, 48, 40);
  c.fillStyle = 'rgba(40,28,16,.25)';
  c.fillRect(x + 40, legs - 40, 8, 40);
  c.strokeStyle = '#3e3a36';
  c.lineWidth = 1.5;
  for (const y of [legs - 32, legs - 18, legs - 6]) {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 48, y);
    c.stroke();
  } // hoops
  c.fillStyle = '#6e5a42';
  c.beginPath();
  c.moveTo(x - 3, legs - 40);
  c.lineTo(x + 24, legs - 54);
  c.lineTo(x + 51, legs - 40);
  c.fill();
  c.fillStyle = '#5a5f66';
  c.fillRect(x + 22, legs, 3, GROUND - legs); // the down pipe
}

// The Cape's water tower: a steel bowl on four legs, painted white with a red band.
function steelWaterTower(c, x) {
  const top = GROUND - 92;
  c.strokeStyle = '#8b9196';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x + 6, GROUND);
  c.lineTo(x + 14, top + 26);
  c.moveTo(x + 42, GROUND);
  c.lineTo(x + 34, top + 26);
  c.stroke();
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(x + 8, GROUND - 20);
  c.lineTo(x + 40, GROUND - 20);
  c.moveTo(x + 11, GROUND - 46);
  c.lineTo(x + 37, GROUND - 46);
  c.moveTo(x + 8, GROUND - 20);
  c.lineTo(x + 37, GROUND - 46);
  c.moveTo(x + 40, GROUND - 20);
  c.lineTo(x + 11, GROUND - 46);
  c.stroke();
  c.fillStyle = '#e9e7e1';
  c.beginPath();
  c.ellipse(x + 24, top + 14, 26, 18, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(0,0,0,.1)';
  c.beginPath();
  c.ellipse(x + 32, top + 16, 16, 15, 0, -1.2, 1.4);
  c.fill();
  c.fillStyle = '#b8473a';
  c.fillRect(x + 1, top + 10, 46, 5);
  c.fillStyle = '#8b9196';
  c.fillRect(x + 22, top - 8, 4, 6); // the vent
}

// From the mid-sixties the range films a launch from tracking-camera mounts: a long lens on a pedestal, on a pad.
function trackingCamera(c, x) {
  c.fillStyle = '#c9c4b6';
  c.fillRect(x - 6, GROUND - 6, 60, 6);
  c.fillStyle = '#6c7177';
  c.fillRect(x + 18, GROUND - 34, 10, 28);
  c.fillStyle = '#4b4f55';
  c.fillRect(x + 12, GROUND - 40, 22, 8);
  c.save();
  c.translate(x + 23, GROUND - 44);
  c.rotate(-0.5);
  c.fillStyle = '#2f3338';
  c.fillRect(-6, -8, 40, 12);
  c.fillStyle = '#1b1e22';
  c.fillRect(32, -9, 6, 14); // the lens hood
  c.restore();
  c.fillStyle = '#d9d4c6';
  c.fillRect(x + 36, GROUND - 26, 18, 20); // the operator's shelter
  shadeRight(c, x + 36, GROUND - 26, 18, 20, 0.15);
}

// A fixed tracking radar on its concrete pedestal: bigger than the old trailer's dish.
function fixedRadar(c, x) {
  c.fillStyle = '#b9b5ab';
  c.fillRect(x + 20, GROUND - 40, 36, 40);
  shadeRight(c, x + 20, GROUND - 40, 36, 40, 0.15);
  c.fillStyle = '#4a4f55';
  c.fillRect(x + 34, GROUND - 52, 8, 12);
  c.save();
  c.translate(x + 38, GROUND - 62);
  c.rotate(-0.45);
  c.fillStyle = '#d7dad6';
  c.beginPath();
  c.ellipse(0, 0, 30, 11, 0, Math.PI, 0);
  c.fill();
  c.fillStyle = '#aeb3af';
  c.beginPath();
  c.ellipse(0, 0, 30, 4, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#6d726f';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-18, -2);
  c.lineTo(0, -22);
  c.lineTo(18, -2);
  c.stroke();
  c.restore();
}

// From the Shuttle years the tracking radar sits inside a white radome.
function radome(c, x) {
  c.fillStyle = '#b9b5ab';
  c.fillRect(x + 12, GROUND - 30, 52, 30);
  shadeRight(c, x + 12, GROUND - 30, 52, 30, 0.15);
  c.fillStyle = '#f1f0eb';
  c.beginPath();
  c.arc(x + 38, GROUND - 52, 28, Math.PI * 0.85, Math.PI * 2.15);
  c.fill();
  c.strokeStyle = 'rgba(120,125,130,.35)';
  c.lineWidth = 1;
  for (const k of [-0.5, 0, 0.5]) {
    c.beginPath();
    c.ellipse(x + 38, GROUND - 52, Math.abs(k) * 28 + 4, 28, 0, Math.PI, 0);
    c.stroke();
  }
  c.fillStyle = 'rgba(0,0,0,.08)';
  c.beginPath();
  c.arc(x + 44, GROUND - 50, 22, -1.2, 1.2);
  c.fill();
}

// A camera station out on the range: a small hut with a slotted roof for the tracking telescope, behind sandbags.
function theodoliteHut(c, x) {
  c.fillStyle = '#b8ad98';
  c.fillRect(x, GROUND - 38, 44, 38);
  shadeRight(c, x, GROUND - 38, 44, 38, 0.15);
  c.fillStyle = '#9c917c';
  c.beginPath();
  c.arc(x + 22, GROUND - 38, 18, Math.PI, 0);
  c.fill();
  c.fillStyle = '#2c2a27';
  c.fillRect(x + 19, GROUND - 56, 6, 18); // the open slot
  c.fillStyle = '#4b4f55';
  c.save();
  c.translate(x + 22, GROUND - 48);
  c.rotate(-0.6);
  c.fillRect(-2, -12, 4, 14);
  c.restore();
  c.fillStyle = '#5a4630';
  c.fillRect(x + 6, GROUND - 22, 9, 22);
  c.fillStyle = '#b3a380';
  for (let i = 0; i < 6; i++) c.fillRect(x - 10 + i * 11 + (i > 2 ? 22 : 0), GROUND - 6, 10, 6);
  c.fillStyle = '#a69674';
  for (let i = 0; i < 5; i++) c.fillRect(x - 5 + i * 11 + (i > 1 ? 22 : 0), GROUND - 11, 10, 5);
}

// A tracking radar on its trailer, the dish tipped up toward the tower.
function radarTrailer(c, x) {
  c.fillStyle = '#5c6648';
  c.fillRect(x, GROUND - 30, 70, 20);
  c.fillStyle = 'rgba(0,0,0,.18)';
  c.fillRect(x, GROUND - 14, 70, 4);
  c.fillStyle = '#1e1e1e';
  for (const wx of [x + 14, x + 26]) {
    c.beginPath();
    c.arc(wx, GROUND - 6, 6, 0, 7);
    c.fill();
  }
  c.fillStyle = '#7a7a7a';
  for (const wx of [x + 14, x + 26]) {
    c.beginPath();
    c.arc(wx, GROUND - 6, 2.5, 0, 7);
    c.fill();
  }
  c.strokeStyle = '#4e5458';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x + 64, GROUND - 12);
  c.lineTo(x + 66, GROUND);
  c.stroke(); // the jack
  c.fillStyle = '#4a5240';
  c.fillRect(x + 40, GROUND - 44, 8, 14); // the pedestal
  c.save();
  c.translate(x + 44, GROUND - 50);
  c.rotate(-0.5);
  c.fillStyle = '#c9cdc8';
  c.beginPath();
  c.ellipse(0, 0, 22, 8, 0, Math.PI, 0);
  c.fill();
  c.fillStyle = '#a5aaa6';
  c.beginPath();
  c.ellipse(0, 0, 22, 3, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#6d726f';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-14, -2);
  c.lineTo(0, -16);
  c.lineTo(14, -2);
  c.stroke(); // feed struts
  c.restore();
  c.strokeStyle = '#3a3a3a';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x + 70, GROUND - 18);
  c.quadraticCurveTo(x + 90, GROUND + 2, x + 110, GROUND - 1);
  c.stroke(); // its cable
}

function fence(c, x0, x1) {
  c.strokeStyle = '#6e604c';
  c.lineWidth = 2;
  for (let x = x0; x < x1; x += 34) {
    c.beginPath();
    c.moveTo(x, GROUND);
    c.lineTo(x, GROUND - 22);
    c.stroke();
  }
  c.strokeStyle = 'rgba(70,64,56,.6)';
  c.lineWidth = 0.7;
  for (const y of [GROUND - 20, GROUND - 13, GROUND - 6]) {
    c.beginPath();
    c.moveTo(x0, y);
    c.lineTo(x1, y);
    c.stroke();
  }
}

const SIGN_X = 2930;
function boundarySign(c, x) {
  c.fillStyle = '#5a4630';
  c.fillRect(x + 6, GROUND - 46, 4, 46);
  c.fillRect(x + 104, GROUND - 46, 4, 46);
  c.fillStyle = '#e9e0c8';
  c.fillRect(x, GROUND - 62, 114, 30);
  c.strokeStyle = '#8a3a2a';
  c.lineWidth = 2;
  c.strokeRect(x + 2, GROUND - 60, 110, 26);
}

// The sign's lettering is drawn per frame, at the screen's resolution, so it reads sharp at any size.
function signLettering(ctx, g) {
  const x = SIGN_X,
    name = SITES[g.site || 'white-sands'].name.toUpperCase();
  ctx.fillStyle = '#2e2a24';
  ctx.textAlign = 'center';
  ctx.font = 'bold 7px sans-serif';
  ctx.fillText(name, x + 57, GROUND - 49, 104);
  ctx.fillStyle = '#8a3a2a';
  ctx.font = 'bold 6px sans-serif';
  ctx.fillText('RESTRICTED AREA · KEEP OUT', x + 57, GROUND - 39, 104);
}

function yucca(c, x, y) {
  c.strokeStyle = '#6f7d48';
  c.lineWidth = 1.4;
  for (let a = -2.6; a <= -0.5; a += 0.3) {
    c.beginPath();
    c.moveTo(x, y - 2);
    c.lineTo(x + Math.cos(a) * 10, y - 2 + Math.sin(a) * 10);
    c.stroke();
  }
  c.strokeStyle = '#8c7a54';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x, y - 4);
  c.lineTo(x + 1, y - 24);
  c.stroke(); // the flower stalk
  c.fillStyle = '#efe6c4';
  c.fillRect(x - 1, y - 26, 4, 6);
}

function creosote(c, x, y, r) {
  c.fillStyle = 'rgba(70,52,30,.18)';
  c.beginPath();
  c.ellipse(x + r * 0.4, y, r * 1.1, r * 0.22, 0, 0, 7);
  c.fill();
  c.fillStyle = '#7d8a4e';
  c.beginPath();
  c.arc(x - r * 0.35, y - r * 0.4, r * 0.55, 0, 7);
  c.arc(x + r * 0.3, y - r * 0.55, r * 0.6, 0, 7);
  c.arc(x, y - r * 0.8, r * 0.5, 0, 7);
  c.fill();
  c.fillStyle = 'rgba(255,250,220,.18)';
  c.beginPath();
  c.arc(x - r * 0.45, y - r * 0.7, r * 0.3, 0, 7);
  c.fill(); // lit from the left
}

function seaOats(c, x, y, k = 1) {
  c.strokeStyle = '#a49a62';
  c.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    c.beginPath();
    c.moveTo(x + i, y);
    c.quadraticCurveTo(x + i * 2, y - 8 * k, x + i * 3 + 2, y - 14 * k);
    c.stroke();
  }
  c.fillStyle = '#c4b47a';
  for (let i = -1; i <= 1; i++) c.fillRect(x + i * 3 + 2, y - 16 * k, 2, 3 * k);
}

// The light: the sun high on the left by day or low and orange at dusk (fixed to the screen, as far things are), and a
// few clouds drifting slowly on the far parallax.
function skyDressing(ctx, g, vw, camX) {
  const dusk = skyFor(g.clock % 1440) === SKY.dusk;
  const sx = vw * 0.12,
    sy = dusk ? 400 : 90,
    glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, dusk ? 160 : 120);
  glow.addColorStop(0, dusk ? 'rgba(255,190,120,.55)' : 'rgba(255,252,235,.55)');
  glow.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 170, sy - 170, 340, 340);
  ctx.fillStyle = dusk ? '#ffd29a' : '#fffbea';
  ctx.beginPath();
  ctx.arc(sx, sy, dusk ? 18 : 14, 0, 7);
  ctx.fill();
  const span = vw + 600,
    drift = (g.time * 2 + camX * 0.08) % span;
  ctx.fillStyle = dusk ? 'rgba(240,170,150,.35)' : 'rgba(255,255,255,.55)';
  for (const [x0, y, w] of [
    [80, 120, 90],
    [520, 70, 130],
    [930, 160, 70],
    [1300, 100, 110],
    [1700, 140, 80],
  ]) {
    const x = ((((x0 - drift) % span) + span) % span) - 300;
    cloud(ctx, x, y, w);
  }
}

function cloud(ctx, x, y, w) {
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.5, w * 0.12, 0, 0, 7);
  ctx.ellipse(x - w * 0.18, y - w * 0.08, w * 0.22, w * 0.12, 0, 0, 7);
  ctx.ellipse(x + w * 0.12, y - w * 0.11, w * 0.26, w * 0.15, 0, 0, 7);
  ctx.fill();
  ctx.save();
  ctx.fillStyle = 'rgba(82,78,110,.13)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.06, y + w * 0.043, w * 0.34, w * 0.05, 0, 0, 7);
  ctx.fill();
  ctx.restore();
}

// Haze where the far ground meets the sky, so the mountains sit back.
function horizonHaze(ctx, g, vw) {
  const sky = skyFor(g.clock % 1440),
    grad = ctx.createLinearGradient(0, 340, 0, GROUND);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, sky[2]);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 340, vw, GROUND - 340);
  ctx.globalAlpha = 1;
}

// What moves in the wind on the site: the windsock by the tower, the flag by the office, the beacon on the tower top.
function siteLife(ctx, g) {
  const t = g.time;
  // The windsock: a striped cone on a pole, filling and sagging with the gusts.
  const wx = 1965,
    wy = GROUND - 70,
    fill = 0.75 + 0.25 * Math.sin(t * 0.7) * Math.sin(t * 1.9);
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(wx - 1, wy, 2, 70);
  for (let i = 0; i < 4; i++) {
    const a = i * 6 * fill,
      b = (i + 1) * 6 * fill,
      droop = (1 - fill) * 6,
      r1 = 4 - i * 0.6,
      r2 = 4 - (i + 1) * 0.6;
    ctx.fillStyle = i % 2 ? '#f2efe6' : '#d9552b';
    ctx.beginPath();
    ctx.moveTo(wx + a, wy + 4 - r1 + (droop * i) / 4);
    ctx.lineTo(wx + b, wy + 4 - r2 + (droop * (i + 1)) / 4);
    ctx.lineTo(wx + b, wy + 4 + r2 + (droop * (i + 1)) / 4);
    ctx.lineTo(wx + a, wy + 4 + r1 + (droop * i) / 4);
    ctx.fill();
  }
  // The flag on its pole between the office and the hangar.
  const fx = 432,
    fy = GROUND - 104;
  ctx.fillStyle = '#d8d4c8';
  ctx.fillRect(fx - 1, fy - 2, 2, 106);
  ctx.fillStyle = '#c9a74a';
  ctx.beginPath();
  ctx.arc(fx, fy - 3, 2, 0, 7);
  ctx.fill();
  for (let i = 0; i < 12; i++) {
    const wave = Math.sin(t * 3 - i * 0.6) * i * 0.18;
    for (let s = 0; s < 7; s++) {
      ctx.fillStyle = s % 2 ? '#f2efe6' : '#b0302c';
      ctx.fillRect(fx + 1 + i * 2, fy + s * 2 + wave, 2, 2);
    }
    if (i < 5) {
      ctx.fillStyle = '#2c3a6a';
      ctx.fillRect(fx + 1 + i * 2, fy + wave, 2, 8);
    }
  }
  // The tower-top beacon, which blinks after dark.
  const dusk = skyFor(g.clock % 1440) === SKY.dusk,
    tw = PLACES.tower;
  if (dusk && Math.sin(t * 3) > 0) {
    ctx.fillStyle = 'rgba(255,60,40,.35)';
    ctx.beginPath();
    ctx.arc(tw.x + tw.w / 2, GROUND - tw.h - 4, 7, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#ff5a3c';
  } else ctx.fillStyle = '#7a2a22';
  ctx.beginPath();
  ctx.arc(tw.x + tw.w / 2, GROUND - tw.h - 4, 2.5, 0, 7);
  ctx.fill();
}

// Small things the tower carries that the lattice alone leaves out: a top platform with its rail, and the ladder.
function towerDetail(c, p) {
  const top = GROUND - p.h;
  c.fillStyle = '#4e5560';
  c.fillRect(p.x + 8, top - 2, p.w - 16, 4);
  c.strokeStyle = '#4e5560';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(p.x + 8, top - 12);
  c.lineTo(p.x + p.w - 8, top - 12);
  for (const x of [p.x + 8, p.x + p.w / 2, p.x + p.w - 8]) {
    c.moveTo(x, top - 2);
    c.lineTo(x, top - 12);
  }
  c.stroke();
  c.fillStyle = '#4e5560';
  c.fillRect(p.x + p.w / 2 - 1, top - 6, 2, 4); // the beacon's stub
  c.strokeStyle = 'rgba(78,85,96,.7)';
  c.lineWidth = 0.8;
  c.beginPath();
  const lx = p.x + p.w - 20;
  c.moveTo(lx, GROUND);
  c.lineTo(lx + 6, top);
  c.moveTo(lx + 5, GROUND);
  c.lineTo(lx + 9, top);
  for (let y = 6; y < p.h; y += 6) {
    const k = y / p.h;
    c.moveTo(lx + 6 * k, GROUND - y);
    c.lineTo(lx + 5 + 4 * k, GROUND - y);
  }
  c.stroke();
}

export function drawSite(ctx, g, view) {
  const { w, h } = view,
    s = h / VIEW_H,
    camX = g.cam.x;
  ctx.save();
  ctx.scale(s, s);
  const vw = w / s;
  // Sky and the far parallax layers (ocean, palms, mountains) repaint each frame; they are cheap and move with the camera.
  const sky = skyFor(g.clock % 1440);
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND);
  grad.addColorStop(0, sky[0]);
  grad.addColorStop(0.7, sky[1]);
  grad.addColorStop(1, sky[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, GROUND);
  skyDressing(ctx, g, vw, camX);
  const cape = g.site === 'cape';
  if (cape) {
    // The Atlantic on the horizon, flat as a table, and a line of palmettos and scrub behind the pads.
    const sea = ctx.createLinearGradient(0, 440, 0, 488);
    sea.addColorStop(0, '#61869a');
    sea.addColorStop(0.55, '#436e88');
    sea.addColorStop(1, '#385d72');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 440, vw, GROUND - 440);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    for (let x = (-camX * 0.2) % 70; x < vw; x += 70) ctx.fillRect(x, 452 + ((x * 3) % 20), 26, 2);
    ctx.fillStyle = '#5b7a3c';
    ctx.fillRect(0, 488, vw, GROUND - 488);
    for (let x = (-camX * 0.4) % 140; x < vw + 140; x += 140) palm(ctx, x, 492);
  } else {
    // The Organ Mountains, far off, moving slowly behind the site.
    mountains(ctx, camX * 0.15, vw, '#8d86a0', 380, [0, 60, 30, 120, 70, 150, 40, 90, 20]);
    mountains(ctx, camX * 0.3, vw, '#a99a8c', 440, [10, 40, 25, 60, 15, 50, 35, 20, 45]);
    mountains(ctx, camX * 0.42, vw, '#c6aa87', 490, [8, 28, 12, 35, 15, 32, 11, 23, 5]);
  }
  horizonHaze(ctx, g, vw);
  // The ground itself reaches past the world edge, so the pan never shows sky underfoot.
  const sand = ctx.createLinearGradient(0, GROUND, 0, VIEW_H);
  sand.addColorStop(0, cape ? '#e4d8b4' : '#d9c39a');
  sand.addColorStop(0.55, cape ? '#d9caa0' : '#d3b88c');
  sand.addColorStop(1, cape ? '#c8b88d' : '#bc9d73');
  ctx.fillStyle = sand;
  ctx.fillRect(0, GROUND, vw, VIEW_H - GROUND);
  ctx.fillStyle = cape ? '#d3c597' : '#cdb489';
  ctx.fillRect(0, GROUND, vw, 5);
  // The baked static layer, blitted in world space.
  const key = staticSignature(g);
  const bake = bakeScale(s);
  if (!staticLayer || `${key}|${bake}` !== staticKey) rebuildStatic(g, bake);
  ctx.translate(-camX, 0);
  ctx.drawImage(staticLayer, 0, 0, WORLD_W + 400, VIEW_H);
  const foreground = ctx.createLinearGradient(0, GROUND + 45, 0, VIEW_H);
  foreground.addColorStop(0, 'rgba(53,46,48,0)');
  foreground.addColorStop(1, sky === SKY.dusk ? 'rgba(53,46,68,.38)' : 'rgba(75,57,40,.22)');
  ctx.fillStyle = foreground;
  ctx.fillRect(camX, GROUND + 45, vw, VIEW_H - GROUND - 45);
  // Everything that moves or burns, back to front: rack and flame behind, then the grounded rocket, people, the truck
  // (nearer the camera than the people, so it paints over them), and finally smoke and dust over everything they cover.
  siteLife(ctx, g);
  signLettering(ctx, g);
  hangarRack(ctx, g);
  if (!g.crewed && g.standFlame > 0)
    flame(ctx, PLACES.stand.x + 60, GROUND - 40, g.standFlame, Math.PI / 2, g.time, 1.4);
  if (g.crewed) controlScreens(ctx, g);
  rocketOnSite(ctx, g);
  for (const p of Object.values(g.people)) if (!p.hidden) person(ctx, p, g.time);
  truck(ctx, g.truck.x, g);
  if (g.rocket.where === 'truck') rocketOnTruck(ctx, g);
  for (const job of g.jobs) jobBar(ctx, job);
  launchSmoke(ctx, g);
  truckDust(ctx, g);
  for (const p of Object.values(g.people))
    if (!p.hidden && p.bubble) bubble(ctx, p.x, GROUND - 44, p.bubble.text, p.bubble.tone);
  if (g.marker != null) {
    ctx.fillStyle = 'rgba(255,240,180,.8)';
    ctx.fillRect(g.marker - 3, GROUND + 2, 6, 3);
  }
  // Building names on hover.
  if (g.hover)
    label(
      ctx,
      g.hover.room === 'truck' && !g.crewed ? { ...g.hover, name: SITES[g.site || 'white-sands'].truck } : g.hover,
    );
  ctx.restore();
  // Night falls as a fade.
  if (g.fade > 0) {
    ctx.fillStyle = `rgba(5,8,14,${g.fade})`;
    ctx.fillRect(0, 0, w, h);
  }
}

// A cabbage palmetto, far off: a thin trunk and a burst of fronds.
function palm(ctx, x, y) {
  ctx.strokeStyle = '#5a4a32';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 4, y - 20, x + 2, y - 38);
  ctx.stroke();
  ctx.strokeStyle = '#3f6a35';
  ctx.lineWidth = 3;
  for (const a of [-2.6, -2.1, -1.6, -1.1, -0.6]) {
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 38);
    ctx.lineTo(x + 2 + Math.cos(a) * 16, y - 38 + Math.sin(a) * 9 + 8);
    ctx.stroke();
  }
}

function mountains(ctx, offset, vw, color, base, peaks) {
  const pts = ridgePoints(offset, vw, base, peaks);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(vw + 260, GROUND);
  ctx.fill();
  ridgeShade(ctx, pts);
}

function ridgePoints(offset, vw, base, peaks) {
  const span = 260,
    pts = [];
  for (let x = -span; x < vw + span; x += span / 2) {
    const i = Math.floor((x + offset) / (span / 2)),
      k = ((i % peaks.length) + peaks.length) % peaks.length;
    pts.push([x - ((x + offset) % (span / 2)), base - peaks[k]]);
  }
  return pts;
}

// Sun from the left: every slope that falls away to the right is in shade, and the ridge line catches a thin light.
function ridgeShade(ctx, pts) {
  ctx.fillStyle = 'rgba(40,30,50,.13)';
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i],
      [bx, by] = pts[i + 1];
    if (by <= ay) continue;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx, GROUND);
    ctx.lineTo(ax + (bx - ax) * 0.45, GROUND);
    ctx.fill(); // a facet, not a column
  }
  ctx.strokeStyle = 'rgba(255,245,225,.18)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i],
      [bx, by] = pts[i + 1];
    if (by >= ay) continue;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
}

function label(ctx, place) {
  ctx.font = '13px Georgia, serif';
  ctx.textAlign = 'center';
  const x = place.x + place.w / 2,
    y = GROUND - place.h - 14,
    tw = ctx.measureText(place.name).width + 14;
  ctx.fillStyle = 'rgba(15,18,24,.85)';
  ctx.fillRect(x - tw / 2, y - 14, tw, 20);
  ctx.fillStyle = '#f1e6c8';
  ctx.fillText(place.name, x, y);
}

function office(ctx, p, g) {
  if (g.crewed) return mercuryControl(ctx, p);
  ctx.fillStyle = '#c9b79a';
  ctx.fillRect(p.x, GROUND - p.h, p.w, p.h);
  shadeRight(ctx, p.x, GROUND - p.h, p.w, p.h, 0.07);
  ctx.fillStyle = '#7d6b55';
  ctx.fillRect(p.x - 8, GROUND - p.h - 8, p.w + 16, 10);
  ctx.fillStyle = 'rgba(40,32,20,.15)';
  ctx.fillRect(p.x, GROUND - p.h + 2, p.w, 9); // shadow under the eave
  // Cutaway: the inside, with the drawing board and desks.
  const plaster = ctx.createLinearGradient(0, GROUND - p.h + 12, 0, GROUND);
  plaster.addColorStop(0, '#bca98e');
  plaster.addColorStop(0.38, '#e5d5b6');
  plaster.addColorStop(1, '#c4ae8f');
  ctx.fillStyle = plaster;
  ctx.fillRect(p.x + 10, GROUND - p.h + 12, p.w - 20, p.h - 12);
  ctx.fillStyle = 'rgba(40,32,20,.08)';
  ctx.fillRect(p.x + 10, GROUND - p.h + 12, p.w - 20, 5);
  ctx.fillStyle = '#6b4f35';
  ctx.fillRect(p.x + 30, GROUND - 30, 50, 4);
  ctx.fillRect(p.x + 34, GROUND - 26, 3, 26);
  ctx.fillRect(p.x + 74, GROUND - 26, 3, 26);
  ctx.save();
  ctx.translate(p.x + 150, GROUND - 46);
  ctx.rotate(-0.35);
  ctx.fillStyle = '#f8f5ea';
  ctx.fillRect(-30, -20, 60, 40);
  ctx.strokeStyle = '#4b6a8a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-20, 8);
  ctx.lineTo(20, 8);
  ctx.moveTo(-14, 8);
  ctx.lineTo(-14, -12);
  ctx.lineTo(-10, -16);
  ctx.lineTo(-6, -12);
  ctx.lineTo(-6, 8);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#5a4630';
  ctx.fillRect(p.x + 148, GROUND - 34, 3, 34);
  // The door in from the site, and the one window, framed and crossed.
  ctx.fillStyle = '#6e5a40';
  ctx.fillRect(p.x + 100, GROUND - 40, 22, 40);
  ctx.strokeStyle = '#54432f';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(p.x + 100, GROUND - 40, 22, 40);
  ctx.fillStyle = '#d8cfa8';
  ctx.fillRect(p.x + 109, GROUND - 22, 3, 3); // knob
  ctx.fillStyle = '#6e8fa8';
  ctx.fillRect(p.x + 196, GROUND - p.h + 24, 26, 20);
  ctx.strokeStyle = '#f4efe0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(p.x + 195, GROUND - p.h + 23, 28, 22);
  ctx.beginPath();
  ctx.moveTo(p.x + 209, GROUND - p.h + 23);
  ctx.lineTo(p.x + 209, GROUND - p.h + 45);
  ctx.moveTo(p.x + 195, GROUND - p.h + 34);
  ctx.lineTo(p.x + 223, GROUND - p.h + 34);
  ctx.stroke();
  // A paper and an inkwell on the nearest desk edge, and a base plank.
  ctx.fillStyle = '#fbf7ec';
  ctx.fillRect(p.x + 44, GROUND - 34, 10, 7);
  ctx.fillStyle = '#232a33';
  ctx.fillRect(p.x + 57, GROUND - 35, 3, 4);
  ctx.fillStyle = '#967c5e';
  ctx.fillRect(p.x + 27, GROUND - 76, 49, 27);
  ctx.fillStyle = '#e5d7b8';
  ctx.fillRect(p.x + 32, GROUND - 71, 14, 16);
  ctx.fillRect(p.x + 51, GROUND - 69, 19, 13);
  ctx.fillStyle = '#b9a481';
  ctx.fillRect(p.x + 35, GROUND - 66, 8, 1);
  ctx.fillRect(p.x + 54, GROUND - 64, 13, 1);
  ctx.fillRect(p.x + 54, GROUND - 61, 10, 1);
  ctx.fillStyle = '#b7a487';
  ctx.fillRect(p.x, GROUND - 4, p.w, 4);
}

// Mercury Control, cut away: the world map on the far wall with the capsule's track, a television beside it showing the
// pad, and a row of consoles. The map and the TV's picture are drawn live over this frame when a flight is flying.
function mercuryControl(ctx, p) {
  ctx.fillStyle = '#d6d1c4';
  ctx.fillRect(p.x, GROUND - p.h, p.w, p.h);
  ctx.fillStyle = '#a7a194';
  ctx.fillRect(p.x - 8, GROUND - p.h - 8, p.w + 16, 10);
  ctx.fillStyle = '#22272e';
  ctx.fillRect(p.x + 10, GROUND - p.h + 12, p.w - 20, p.h - 12);
  ctx.fillStyle = '#2f4f6a';
  ctx.fillRect(p.x + 30, GROUND - p.h + 20, p.w - 134, 44);
  ctx.fillStyle = '#5d7d52';
  for (const [dx, dy, w, h] of [
    [10, 8, 22, 12],
    [38, 14, 16, 18],
    [66, 6, 28, 14],
    [92, 16, 14, 10],
  ])
    ctx.fillRect(p.x + 30 + dx, GROUND - p.h + 20 + dy, w, h);
  ctx.strokeStyle = '#f2e3a0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const x = p.x + 34 + (i * (p.w - 142)) / 40,
      y = GROUND - p.h + 42 + 12 * Math.sin((i / 40) * Math.PI * 2);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  // The television, wall-mounted beside the map. The picture is drawn live over the dark tube.
  ctx.fillStyle = '#181b1f';
  ctx.fillRect(p.x + p.w - 92, GROUND - p.h + 14, 62, 54);
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(p.x + p.w - 88, GROUND - p.h + 18, 54, 46);
  ctx.fillStyle = '#4b5258';
  ctx.fillRect(p.x + 20, GROUND - 26, p.w - 40, 16);
  ctx.fillStyle = '#9fdc9a';
  for (let i = 0; i < 6; i++) ctx.fillRect(p.x + 28 + i * 34, GROUND - 23, 20, 6);
}

// The hangar's structure is static (baked); what sits on its rack changes with the round and is drawn per frame.
function hangarStructure(ctx, p) {
  // A quonset-style hangar, cut away to show the floor.
  ctx.fillStyle = '#8c8f93';
  ctx.beginPath();
  ctx.moveTo(p.x, GROUND);
  ctx.lineTo(p.x, GROUND - p.h + 40);
  ctx.quadraticCurveTo(p.x + p.w / 2, GROUND - p.h - 40, p.x + p.w, GROUND - p.h + 40);
  ctx.lineTo(p.x + p.w, GROUND);
  ctx.fill();
  shadeRight(ctx, p.x, GROUND - p.h + 40, p.w, p.h - 40, 0.06);
  const hangarWall = ctx.createLinearGradient(0, GROUND - p.h, 0, GROUND);
  hangarWall.addColorStop(0, '#272e2c');
  hangarWall.addColorStop(0.74, '#4c5751');
  hangarWall.addColorStop(1, '#343b36');
  ctx.fillStyle = hangarWall;
  ctx.beginPath();
  ctx.moveTo(p.x + 12, GROUND);
  ctx.lineTo(p.x + 12, GROUND - p.h + 46);
  ctx.quadraticCurveTo(p.x + p.w / 2, GROUND - p.h - 22, p.x + p.w - 12, GROUND - p.h + 46);
  ctx.lineTo(p.x + p.w - 12, GROUND);
  ctx.fill();
  ctx.strokeStyle = '#55585d';
  ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    const x = p.x + (p.w * i) / 6;
    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x, GROUND - p.h + 20);
    ctx.stroke();
  }
  // A thin highlight along the left of each rib, so the corrugation reads.
  ctx.strokeStyle = '#83868b';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const x = p.x + (p.w * i) / 6 - 2;
    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x, GROUND - p.h + 22);
    ctx.stroke();
  }
  ctx.fillStyle = '#292c31';
  ctx.fillRect(p.x + 12, GROUND - 12, p.w - 24, 12);
  ctx.fillStyle = '#717478';
  ctx.fillRect(p.x + 12, GROUND - 13, p.w - 24, 1);
  ctx.fillStyle = '#a3a2a0';
  for (let i = 1; i < 6; i++) {
    const x = p.x + (p.w * i) / 6;
    for (let y = GROUND - p.h + 48; y < GROUND - 15; y += 18) ctx.fillRect(x - 2, y, 2, 2);
  }
  // Hanging lamps, with a soft cone of light on the floor below each.
  ctx.fillStyle = '#f3dd8a';
  for (let i = 1; i < 4; i++) ctx.fillRect(p.x + (p.w * i) / 4 - 5, GROUND - p.h + 40, 10, 4);
  ctx.fillStyle = 'rgba(243,221,138,.10)';
  for (let i = 1; i < 4; i++) {
    const lx = p.x + (p.w * i) / 4;
    ctx.beginPath();
    ctx.moveTo(lx - 5, GROUND - p.h + 44);
    ctx.lineTo(lx - 26, GROUND - 6);
    ctx.lineTo(lx + 26, GROUND - 6);
    ctx.lineTo(lx + 5, GROUND - p.h + 44);
    ctx.fill();
  }
  // Work benches and the booster on its rack.
  ctx.fillStyle = '#6a5a44';
  ctx.fillRect(p.x + 30, GROUND - 22, 70, 4);
  ctx.fillRect(p.x + 34, GROUND - 18, 3, 18);
  ctx.fillRect(p.x + 94, GROUND - 18, 3, 18);
  ctx.fillStyle = '#c3ae81';
  ctx.fillRect(p.x + 38, GROUND - 25, 19, 3);
  ctx.fillStyle = '#515c4f';
  ctx.fillRect(p.x + 75, GROUND - 29, 17, 7);
  ctx.fillStyle = '#9d9f88';
  ctx.fillRect(p.x + 77, GROUND - 26, 13, 1);
  ctx.fillStyle = 'rgba(40,32,20,.2)';
  ctx.fillRect(p.x + 12, GROUND - 3, p.w - 24, 3); // shadow along the floor
}

// What waits on the rack to be mated: the WAC's Tiny Tim booster, or the WAC that rides on a Bumper's nose.
// Hangar S: the next Mercury capsule on its stand, being checked out. Changes with the round, so it is per-frame.
function hangarRack(ctx, g) {
  const p = PLACES.hangar;
  if (g.crewed) {
    capsuleShape(ctx, p.x + 220, GROUND - 30, false);
    ctx.fillStyle = '#6a5a44';
    ctx.fillRect(p.x + 200, GROUND - 22, 40, 22);
  }
  if (!g.rocket.mated && g.rocket.where !== 'gone') {
    if (g.vehicle === 'wac' || g.vehicle === 'aerobee') {
      // The Tiny Tim on its own low rack, fins clear of the floor.
      boosterShape(ctx, p.x + p.w - 90, GROUND - 20, 0);
      ctx.fillStyle = '#6a5a44';
      for (const at of [p.x + p.w - 112, p.x + p.w - 94]) ctx.fillRect(at, GROUND - 15, 3, 15);
    } else if (g.vehicle === 'bumper') wacShape(ctx, p.x + p.w - 30, GROUND - 26, -Math.PI / 2, false);
  }
  ctx.fillStyle = '#d9c39a';
  ctx.fillRect(p.x + 12, GROUND - 2, p.w - 24, 2);
}

export function standStructure(ctx, p) {
  // An open steel frame over a flame trench.
  ctx.fillStyle = '#7a6a58';
  ctx.fillRect(p.x - 10, GROUND - 4, p.w + 20, 8);
  ctx.fillStyle = '#2a2420';
  ctx.fillRect(p.x + 40, GROUND - 2, 40, 6);
  ctx.strokeStyle = '#5b5f66';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(p.x + 20, GROUND);
  ctx.lineTo(p.x + 30, GROUND - p.h);
  ctx.lineTo(p.x + 90, GROUND - p.h);
  ctx.lineTo(p.x + 100, GROUND);
  ctx.stroke();
  // The legs lean in from 20/100 at the ground to 30/90 at the top beam; every member ends on a leg, inside the frame.
  const left = y => p.x + 20 + (10 * y) / p.h,
    right = y => p.x + 100 - (10 * y) / p.h;
  ctx.lineWidth = 2;
  for (let y = 30; y < p.h; y += 30) {
    ctx.beginPath();
    ctx.moveTo(left(y), GROUND - y);
    ctx.lineTo(right(y), GROUND - y);
    ctx.stroke();
  }
  // Cross-bracing in each bay, up to and no higher than the top beam, and concrete footings under the legs.
  ctx.strokeStyle = '#6b6f76';
  ctx.lineWidth = 1.2;
  for (let y = 30; y < p.h; y += 30) {
    const y2 = Math.min(y + 30, p.h);
    ctx.beginPath();
    ctx.moveTo(left(y), GROUND - y);
    ctx.lineTo(right(y2), GROUND - y2);
    ctx.moveTo(right(y), GROUND - y);
    ctx.lineTo(left(y2), GROUND - y2);
    ctx.stroke();
  }
  ctx.fillStyle = '#8a8f96';
  ctx.fillRect(p.x + 14, GROUND - 6, 14, 6);
  ctx.fillRect(p.x + 92, GROUND - 6, 14, 6);
  // The structure's shadow falls to the right of the trench.
  ctx.fillStyle = 'rgba(40,32,20,.12)';
  ctx.fillRect(p.x + 104, GROUND - 2, 30, 4);
}

// The training building at the Cape: a low block with a cutaway of the simulator, a copy of a Mercury Control console.
function trainer(ctx, stand, dug) {
  const x = stand.x - 10,
    w = dug.x + dug.w - x + 10,
    h = 74;
  ctx.fillStyle = '#c8c2b2';
  ctx.fillRect(x, GROUND - h, w, h);
  ctx.fillStyle = '#a9a291';
  ctx.fillRect(x - 8, GROUND - h - 8, w + 16, 10);
  ctx.fillStyle = '#2c3138';
  ctx.fillRect(x + 12, GROUND - h + 14, w - 24, h - 14);
  ctx.fillStyle = '#3f4a3c';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 30 + i * 52, GROUND - 30, 40, 18);
  ctx.fillStyle = '#9fdc9a';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 36 + i * 52, GROUND - 26, 28, 8);
  ctx.fillStyle = '#1b2026';
  ctx.fillRect(x + 40, GROUND - h + 20, w - 80, 22);
  ctx.strokeStyle = '#f2e3a0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 46, GROUND - h + 38);
  ctx.quadraticCurveTo(x + w / 2, GROUND - h + 18, x + w - 46, GROUND - h + 36);
  ctx.stroke();
}

function dugout(ctx, p) {
  ctx.fillStyle = '#9b8a70';
  ctx.beginPath();
  ctx.moveTo(p.x - 20, GROUND);
  ctx.quadraticCurveTo(p.x + p.w / 2, GROUND - p.h * 2, p.x + p.w + 20, GROUND);
  ctx.fill();
  // Sandbags along the mound, placed from x so they never shift.
  ctx.fillStyle = '#b3a380';
  // The mound is a quadratic from p.x - 20 to p.x + p.w + 20 with its control point 2h up, so its surface at t is
  // 4h·t(1 - t) above the ground; each bag sits on that line.
  for (let i = 0; i < 13; i++) {
    const sx = p.x - 14 + i * 9,
      t = (sx + 3.5 - (p.x - 20)) / (p.w + 40),
      sy = GROUND - Math.round(4 * p.h * t * (1 - t)) - 3;
    ctx.fillRect(sx, sy, 7, 4);
  }
  ctx.fillStyle = '#2b2a28';
  ctx.fillRect(p.x + 14, GROUND - 20, 22, 6);
  ctx.fillRect(p.x + 52, GROUND - 20, 22, 6);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(p.x + 36, GROUND - 24, 18, 4); // shadow over the entrance
  ctx.fillStyle = '#4b3b2b';
  ctx.fillRect(p.x + 36, GROUND - 26, 16, 26);
}

function blockhouse(ctx, p, g) {
  const state = blockhouseState(g.day);
  if (state.built) return newBlockhouse(ctx, p);
  if (state.progress > 0) building(ctx, p.x - 160, state.progress);
  ctx.fillStyle = '#a7a196';
  ctx.fillRect(p.x, GROUND - p.h, p.w, p.h);
  shadeRight(ctx, p.x, GROUND - p.h, p.w, p.h, 0.08);
  ctx.fillStyle = '#918b80';
  ctx.fillRect(p.x - 10, GROUND - p.h - 12, p.w + 20, 14);
  ctx.fillStyle = '#b8b2a6';
  ctx.fillRect(p.x - 10, GROUND - p.h - 12, p.w + 20, 3); // a lit top edge on the roof
  // A slit window and a ventilation pipe on the outer wall.
  ctx.fillStyle = '#5c5f57';
  ctx.fillRect(p.x + 6, GROUND - p.h + 24, 5, 14);
  ctx.fillStyle = '#777';
  ctx.fillRect(p.x + p.w - 24, GROUND - p.h - 18, 4, 8);
  // Cutaway with the firing panel and periscope.
  ctx.fillStyle = '#4c4f46';
  ctx.fillRect(p.x + 14, GROUND - p.h + 16, p.w - 28, p.h - 16);
  ctx.fillStyle = '#2f3a2c';
  ctx.fillRect(p.x + 30, GROUND - 34, 80, 22);
  ctx.fillStyle = '#c94';
  for (let i = 0; i < 6; i++) ctx.fillRect(p.x + 36 + i * 12, GROUND - 30, 5, 5);
  ctx.fillStyle = '#6c6';
  ctx.fillRect(p.x + 36, GROUND - 22, 5, 5);
  ctx.fillStyle = '#555';
  ctx.fillRect(p.x + 140, GROUND - p.h - 26, 6, 26);
  ctx.fillRect(p.x + 140, GROUND - p.h - 26, 14, 5);
}

// The new blockhouse going up beside the old one: footings, then walls rising inside scaffolding, then the roof slab.
function building(ctx, x, k) {
  const w = 150,
    h = 90,
    wall = Math.min(1, k / 0.8) * h;
  ctx.fillStyle = '#8f8a80';
  ctx.fillRect(x - 6, GROUND - 6, w + 12, 6);
  ctx.fillStyle = '#b9b3a6';
  ctx.fillRect(x, GROUND - wall, w, wall);
  if (k > 0.8) {
    ctx.fillStyle = '#a49e92';
    ctx.fillRect(x - 8, GROUND - h - 14, (w + 16) * Math.min(1, (k - 0.8) / 0.2), 14);
  }
  ctx.strokeStyle = '#7b6a52';
  ctx.lineWidth = 2;
  for (let sx = x - 10; sx <= x + w + 10; sx += 32) {
    ctx.beginPath();
    ctx.moveTo(sx, GROUND);
    ctx.lineTo(sx, GROUND - h - 20);
    ctx.stroke();
  }
  for (let sy = 24; sy < h + 20; sy += 24) {
    ctx.beginPath();
    ctx.moveTo(x - 10, GROUND - sy);
    ctx.lineTo(x + w + 10, GROUND - sy);
    ctx.stroke();
  }
}

// The new blockhouse: bigger and squatter, with a heavy roof, two periscopes and a cutaway firing room with more panels.
function newBlockhouse(ctx, p) {
  const w = p.w + 140,
    h = 92,
    x = p.x - 150;
  ctx.fillStyle = '#b3ad9f';
  ctx.fillRect(x, GROUND - h, w, h);
  shadeRight(ctx, x, GROUND - h, w, h, 0.07);
  ctx.fillStyle = '#9b9588';
  ctx.fillRect(x - 14, GROUND - h - 18, w + 28, 20);
  ctx.fillStyle = '#c4bfb1';
  ctx.fillRect(x - 14, GROUND - h - 18, w + 28, 3); // lit roof edge
  ctx.fillStyle = '#5a5348';
  ctx.fillRect(x + w - 66, GROUND - 34, 20, 34);
  ctx.fillStyle = '#6e6458';
  ctx.fillRect(x + w - 63, GROUND - 31, 14, 31); // the door
  ctx.fillStyle = '#4c4f46';
  ctx.fillRect(x + 16, GROUND - h + 18, w - 32, h - 18);
  ctx.fillStyle = '#2f3a2c';
  ctx.fillRect(x + 28, GROUND - 38, 90, 26);
  ctx.fillRect(x + 130, GROUND - 38, 70, 26);
  ctx.fillStyle = '#c94';
  for (let i = 0; i < 7; i++) ctx.fillRect(x + 34 + i * 12, GROUND - 33, 5, 5);
  ctx.fillStyle = '#6c6';
  for (let i = 0; i < 5; i++) ctx.fillRect(x + 136 + i * 12, GROUND - 25, 5, 5);
  ctx.fillStyle = '#3a3d40';
  ctx.fillRect(x + w - 40, GROUND - h + 22, 18, 50); // the telemetry rack
  ctx.fillStyle = '#555';
  for (const px of [x + 40, x + w - 60]) {
    ctx.fillRect(px, GROUND - h - 44, 6, 26);
    ctx.fillRect(px, GROUND - h - 44, 14, 5);
  }
}

export function tower(ctx, p) {
  // The 102-foot launch tower: a slender lattice with the rails inside it.
  const top = GROUND - p.h;
  ctx.strokeStyle = '#4e5560';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x, GROUND);
  ctx.lineTo(p.x + 14, top);
  ctx.moveTo(p.x + p.w, GROUND);
  ctx.lineTo(p.x + p.w - 14, top);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  for (let y = 0; y < p.h; y += 20) {
    const k1 = y / p.h,
      k2 = (y + 20) / p.h,
      l1 = p.x + 14 * k1,
      r1 = p.x + p.w - 14 * k1,
      l2 = p.x + 14 * k2,
      r2 = p.x + p.w - 14 * k2;
    ctx.beginPath();
    ctx.moveTo(l1, GROUND - y);
    ctx.lineTo(r1, GROUND - y);
    ctx.moveTo(l1, GROUND - y);
    ctx.lineTo(r2, GROUND - y - 20);
    ctx.moveTo(r1, GROUND - y);
    ctx.lineTo(l2, GROUND - y - 20);
    ctx.stroke();
  }
  ctx.fillStyle = '#7a6a58';
  ctx.fillRect(p.x - 14, GROUND - 4, p.w + 28, 8);
}

// The truck's paint by era: the services' olive drab at first, NASA white with a blue stripe from 1960, and the
// Shuttle years' white with the red stripe.
const TRUCK_PAINT = {
  early: { body: '#4d5b3a', frame: '#37503f', ink: '#e8e0c8', stripe: null },
  space: { body: '#e3e1d9', frame: '#8a8f93', ink: '#1f3a6e', stripe: '#2b4a8a' },
  apollo: { body: '#e3e1d9', frame: '#8a8f93', ink: '#1f3a6e', stripe: '#2b4a8a' },
  shuttle: { body: '#f0efea', frame: '#8a8f93', ink: '#b8352a', stripe: '#b8352a' },
};
function truck(ctx, x, g) {
  const y = GROUND + 28,
    era = eraOf(g),
    paint = TRUCK_PAINT[era];
  ctx.fillStyle = paint.body;
  ctx.fillRect(x, y - 30, 64, 22);
  ctx.fillRect(x + 64, y - 40, 26, 32);
  if (paint.stripe) {
    ctx.fillStyle = paint.stripe;
    ctx.fillRect(x, y - 13, 90, 3);
  }
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.fillRect(x, y - 12, 64, 4); // bed shadow line
  ctx.fillStyle = '#9fc0d0';
  ctx.fillRect(x + 72, y - 36, 12, 10);
  ctx.strokeStyle = paint.frame;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 71, y - 37, 14, 12); // window frame
  ctx.fillStyle = '#1e1e1e';
  for (const wx of [x + 14, x + 44, x + 76]) {
    ctx.beginPath();
    ctx.arc(wx, y - 6, 7, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#8a8a8a';
  for (const wx of [x + 14, x + 44, x + 76]) {
    ctx.beginPath();
    ctx.arc(wx, y - 6, 3, 0, 7);
    ctx.fill();
  } // hubs
  ctx.fillStyle = paint.ink;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(era !== 'early' ? 'NASA' : g.site === 'cape' ? 'U.S. NAVY' : 'U.S. ARMY', x + 8, y - 16);
  // The recovery party rides out with the truck: the driver and his mate seen through the cab window, and one man
  // sitting up at the front of the bed, behind the cab, clear of anything the truck carries.
  if (g.truck.follow) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 72, y - 36, 12, 10);
    ctx.clip();
    ctx.fillStyle = '#2e3236';
    for (const px of [x + 75, x + 81]) {
      ctx.beginPath();
      ctx.arc(px, y - 31, 2.6, 0, 7);
      ctx.fill();
      ctx.fillRect(px - 3, y - 28.5, 6, 4);
    }
    ctx.restore();
    ctx.fillStyle = '#2e3236';
    ctx.beginPath();
    ctx.arc(x + 56, y - 41, 3.5, 0, 7);
    ctx.fill();
    ctx.fillRect(x + 52.5, y - 38, 7, 8);
  }
}

// The rocket wherever it is on the site: in pieces in the hangar, carried, on the stand, on the truck, in the tower.
// The truck-borne round is drawn with the truck (it rides the bed); the rest draw behind the people.
function rocketOnSite(ctx, g) {
  if (g.rocket.where === 'truck') return;
  const r = g.rocket,
    wac = g.vehicle === 'wac' || g.vehicle === 'aerobee';
  // The whole round as it stands (mated), or the stage the crew handles on its own (the WAC upper stage, or the V-2).
  if (r.where === 'hangar') {
    roundShape(ctx, g, PLACES.hangar.x + (wac ? 200 : 230), GROUND - (wac ? 26 : 30), -Math.PI / 2, r.mated);
    if (wac) cradle(ctx, PLACES.hangar.x + 200, r.mated);
    else trailer(ctx, PLACES.hangar.x + 130);
  } else if (r.where === 'carried') {
    // Shoulder height, centred between the two carriers so each has an end: the WAC is 60 long, tail to nose.
    roundShape(ctx, g, r.x + (wac ? 30 : 50), GROUND - (wac ? 27 : 22), -Math.PI / 2, false);
  } else if (r.where === 'stand') roundShape(ctx, g, PLACES.stand.x + 60, GROUND - 40, 0, false);
  else if (r.where === 'tower') roundShape(ctx, g, PLACES.tower.x + 25, GROUND - 8, 0, true);
  else if (r.where === 'flying') {
    const rise = flyingRise(g);
    roundShape(ctx, g, PLACES.tower.x + 25, GROUND - 8 - rise, 0, wac ? rise < 40 : true);
    flame(ctx, PLACES.tower.x + 25, GROUND - 8 - rise, 1, Math.PI / 2, g.time, wac ? 1.6 : 2.4);
  }
}

// The round riding out, drawn after the truck so it sits on it. Every round is longer than the truck's bed, so its
// tail sits on the bed and the rest rides a pole trailer hitched behind: nothing hangs off the back in mid-air.
// length: tail to nose; fin: how far the fins stand out from the axis; body: the half-width of the body.
const TRUCK_LOADS = {
  wac: { length: 86, fin: 9, body: 5 },
  aerobee: { length: 86, fin: 9, body: 5 },
  v2: { length: 104, fin: 16, body: 7 },
  bumper: { length: 190, fin: 16, body: 7 },
  viking: { length: 118, fin: 13, body: 5 },
  vanguard: { length: 210, fin: 8, body: 6 },
  juno: { length: 218, fin: 12, body: 8 },
  ranger: { length: 270, fin: 17, body: 8 },
};
function rocketOnTruck(ctx, g) {
  const load = TRUCK_LOADS[g.vehicle] || TRUCK_LOADS.v2,
    bed = GROUND - 2, // the top of the truck's bed
    tail = g.truck.x + 14,
    axis = bed - load.fin,
    nose = tail - load.length;
  // The pole trailer: a beam from the truck's tail board back to under the nose, on a pair of wheels at the back.
  const back = nose + 8;
  if (back < g.truck.x) {
    ctx.fillStyle = '#3f4b30';
    ctx.fillRect(back - 6, bed, g.truck.x - back + 6, 5);
    ctx.fillStyle = '#4d5b3a';
    ctx.fillRect(back - 4, bed + 5, 34, GROUND + 18 - bed - 5); // the trailer's axle frame, down to the wheels
    ctx.fillStyle = '#1e1e1e';
    for (const wx of [back + 6, back + 22]) {
      ctx.beginPath();
      ctx.arc(wx, GROUND + 22, 6, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = '#8a8a8a';
    for (const wx of [back + 6, back + 22]) {
      ctx.beginPath();
      ctx.arc(wx, GROUND + 22, 2.5, 0, 7);
      ctx.fill();
    }
    // Cradles under the body, up from the beam.
    ctx.fillStyle = '#6a5a44';
    for (const f of [0.45, 0.8]) {
      const cx = tail - load.length * f;
      if (cx > back) ctx.fillRect(cx - 3, axis + load.body, 6, bed - axis - load.body);
    }
  }
  roundShape(ctx, g, tail, axis, -Math.PI / 2, true);
}

// The shape of the current vehicle, drawn from its tail at (x, y) along angle (0 = straight up). One dispatch, shared by
// the site, the truck and the television in Mercury Control.
export function roundShape(ctx, g, x, y, angle, mated) {
  const wac = g.vehicle === 'wac' || g.vehicle === 'aerobee';
  if (g.vehicle === 'sls' || g.vehicle === 'dragon') return modernLauncher(ctx, x, y, angle, g.vehicle);
  return g.vehicle === 'redstone'
    ? mercuryRedstoneShape(ctx, x, y, angle, g.rocket.padAbort)
    : g.vehicle === 'atlas'
      ? mercuryAtlasShape(ctx, x, y, angle)
      : g.vehicle === 'titan'
        ? geminiTitanShape(ctx, x, y, angle)
        : g.vehicle === 'shuttle'
          ? shuttleShape(ctx, x, y, angle)
          : g.vehicle === 'saturn5' || g.vehicle === 'saturnib'
            ? saturnVShape(ctx, x, y, angle)
            : wac
              ? wacShape(ctx, x, y, angle, mated)
              : g.vehicle === 'vanguard'
                ? vanguardShape(ctx, x, y, angle)
                : g.vehicle === 'juno'
                  ? junoShape(ctx, x, y, angle)
                  : g.vehicle === 'ranger'
                    ? atlasAgenaShape(ctx, x, y, angle)
                    : g.vehicle === 'viking'
                      ? vikingShape(ctx, x, y, angle)
                      : v2Shape(ctx, x, y, angle, mated && g.vehicle === 'bumper');
}

// The launch smoke, drawn over the site while she is still low enough to be in it.
function launchSmoke(ctx, g) {
  if (g.rocket.where !== 'flying' || flyingRise(g) > 120) return;
  ctx.fillStyle = 'rgba(235,230,220,.6)';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(PLACES.tower.x + 25 + (i - 4) * 12, GROUND - 6 - (i % 3) * 6, 10 + i, 0, 7);
    ctx.fill();
  }
}

// How high the flying rocket has visibly climbed. Uncrewed flights rise through tickFlight; a crewed ascent climbs with
// the console's clock, which is the only clock the site has for her.
function flyingRise(g) {
  if (g.rocket.where !== 'flying') return 0;
  return g.console && g.console.phase === 'ascent' ? Math.min(g.console.t * 30, 700) : g.rocket.rise || 0;
}

// ---- The screens in Mercury Control: the television's live picture of the pad, and, once she flies, the map that
// takes the whole wall with the capsule riding the track. Drawn over the baked cutaway in world coordinates.
function controlScreens(ctx, g) {
  const p = PLACES.office,
    wall = GROUND - p.h;
  if (g.rocket.where === 'flying') {
    // The map fills the wall: the track runs across it, and the capsule rides it as the consoles call her progress.
    drawWallMap(ctx, g, p.x + 30, wall + 18, p.w - 56, 48);
    return;
  }
  // Before she flies: the television shows the pad, live — the gantry, the round on it, and the launch when it comes.
  const tvX = p.x + p.w - 88,
    tvY = wall + 18,
    tvW = 54,
    tvH = 46;
  padPicture(ctx, g, tvX, tvY, tvW, tvH);
  // It is a picture of a picture: faint scanlines over the tube.
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  for (let y = tvY + 3; y < tvY + tvH; y += 4) ctx.fillRect(tvX, y, tvW, 1);
}

// THE WALL MAP: the whole world, as Mercury Control's big plotting board showed it. A flat chart of the land under a
// 15-degree grid, the tracking network marked on it, the Atlantic range picked out from the Cape, and the ground track
// the capsule will fly drawn over it: three orbits for an orbital shot, the short arc down the range for a Redstone.
// When she flies, the capsule rides the track with a bright trail, paced by the console's clocks. Sized to the wall.
const MAP_TOP = 72,
  MAP_BOTTOM = -62; // latitudes shown; the far south and north are of no use to the network
const CAPE = [-80.6, 28.5];
// The Mercury tracking network, as the stations stood in 1961-63 (STATIONS in data/mercury.js names them in pass order).
const MAP_STATIONS = [
  ['CNV', -80.6, 28.5, 'Cape'],
  ['BDA', -64.7, 32.3, 'Bermuda'],
  ['CYI', -15.6, 27.7, 'Canary Islands'],
  ['KNO', 8.5, 12.0, 'Kano, Nigeria'],
  ['ZZB', 39.2, -6.2, 'Zanzibar'],
  ['IOS', 68.0, -21.0, 'The Indian Ocean ship'],
  ['MUC', 115.9, -31.6, 'Muchea, Australia'],
  ['WOM', 136.8, -31.2, 'Woomera'],
  ['CTN', -171.7, -2.8, 'Canton Island'],
  ['HAW', -159.7, 22.1, 'Hawaii'],
  ['CAL', -120.6, 34.6, 'California'],
  ['GYM', -110.9, 27.9, 'Guaymas, Mexico'],
  ['TEX', -97.3, 27.7, 'Texas'],
];
// The network moved on after Mercury: the Manned Space Flight Network of Gemini and Apollo, with the big dishes at
// Goldstone, Madrid and Canberra for the Moon; and from the Shuttle years the TDRS relay satellites, worked from the
// ground terminal at White Sands, with the deep-space dishes kept for the far shots. The map shows the one of the day.
const MSFN_STATIONS = [
  ['CNV', -80.6, 28.5, 'Cape'],
  ['BDA', -64.7, 32.3, 'Bermuda'],
  ['CYI', -15.6, 27.7, 'Canary Islands'],
  ['ACN', -14.4, -7.9, 'Ascension'],
  ['MAD', -4.2, 40.4, 'Madrid'],
  ['CRO', 113.7, -24.9, 'Carnarvon'],
  ['HSK', 149.0, -35.6, 'Honeysuckle Creek'],
  ['GWM', 144.7, 13.3, 'Guam'],
  ['HAW', -159.7, 22.1, 'Hawaii'],
  ['GDS', -116.9, 35.4, 'Goldstone'],
  ['TEX', -97.3, 27.7, 'Texas'],
];
const TDRS_STATIONS = [
  ['KSC', -80.6, 28.5, 'Cape'],
  ['WSGT', -106.6, 32.5, 'White Sands ground terminal'],
  ['GDS', -116.9, 35.4, 'Goldstone'],
  ['MAD', -4.2, 40.4, 'Madrid'],
  ['CAN', 149.0, -35.4, 'Canberra'],
  ['TDRS-E', -41, 0, 'TDRS East', true],
  ['TDRS-W', -171, 0, 'TDRS West', true],
];
const stationsFor = g => {
  const y = yearOf(g);
  return y >= 1983 ? TDRS_STATIONS : y >= 1965 ? MSFN_STATIONS : MAP_STATIONS;
};
// The Atlantic range: the corridor from the Cape down past the islands to Ascension, where the missiles flew.
const ATLANTIC_RANGE = [
  [-81.5, 29.5],
  [-77, 31.5],
  [-55, 21],
  [-13, -5],
  [-13, -10],
  [-17, -10],
  [-60, 15],
  [-80, 26],
];
const ORBIT = { incl: 32.5, period: 88, earthDay: 1436 }; // degrees, minutes, minutes (a sidereal day)
const D2R = Math.PI / 180;
// Each ring drawn where it lies, and again a world over if it runs past the date line.
const LAND_SHIFTS = new Map(
  WORLD_LAND.map(r => {
    let lo = 180,
      hi = -180;
    for (let k = 0; k < r.length; k += 2) {
      lo = Math.min(lo, r[k]);
      hi = Math.max(hi, r[k]);
    }
    return [r, [0, ...(lo < -180 ? [360] : []), ...(hi > 180 ? [-360] : [])]];
  }),
);
const U0 = Math.asin(Math.sin(CAPE[1] * D2R) / Math.sin(ORBIT.incl * D2R)) / D2R; // the argument of latitude at the Cape
const NODE = CAPE[0] - Math.atan2(Math.cos(ORBIT.incl * D2R) * Math.sin(U0 * D2R), Math.cos(U0 * D2R)) / D2R;
// Where she is over the ground, t minutes after leaving the Cape on the planned orbit.
function groundPoint(t) {
  const u = (U0 + (360 * t) / ORBIT.period) * D2R,
    i = ORBIT.incl * D2R;
  const lat = Math.asin(Math.sin(i) * Math.sin(u)) / D2R;
  let lon = NODE + Math.atan2(Math.cos(i) * Math.sin(u), Math.cos(u)) / D2R - (360 * t) / ORBIT.earthDay;
  lon = ((lon + 540) % 360) - 180;
  return [lon, lat];
}
// The capsule's minutes along the track, from the console: the climb, the orbit clock, or the flight's elapsed time.
function trackMinutes(c) {
  if (!c) return null;
  if (c.orbitT != null) return c.orbitT;
  if (c.flight && c.flight.at != null) return Math.min(c.flight.at * 60, 3 * ORBIT.period);
  if ((c.phase === 'ascent' || c.phase === 'insertion') && c.burn)
    return Math.max(0, Math.min(1, c.t / c.burn)) * (c.orbital ? 5 : 2.5);
  if (!c.orbital && ['coast', 'ip', 'entry'].includes(c.phase)) return c.phase === 'coast' ? 6 : 8;
  return null;
}

function drawWallMap(ctx, g, x, y, w, h) {
  const c = g.console,
    orbital =
      !!(c && (c.orbital || c.flight)) ||
      ['atlas', 'titan', 'saturn5', 'saturnib', 'shuttle', 'dragon', 'sls'].includes(g.vehicle);
  const X = lon => x + ((lon + 180) / 360) * w,
    Y = lat => y + ((MAP_TOP - lat) / (MAP_TOP - MAP_BOTTOM)) * h;
  ctx.fillStyle = '#22272e';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#10262f';
  ctx.fillRect(x, y, w, h);
  // The land, from Natural Earth's outlines.
  ctx.fillStyle = '#2f5a4c';
  ctx.strokeStyle = '#5f9a80';
  ctx.lineWidth = Math.max(0.5, w / 1400);
  ctx.beginPath();
  for (const ring of WORLD_LAND)
    for (const shift of LAND_SHIFTS.get(ring)) {
      for (let k = 0; k < ring.length; k += 2) {
        const px = X(ring[k] + shift),
          py = Y(ring[k + 1]);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
    }
  ctx.fill();
  if (w > 300) ctx.stroke();
  // The grid: every fifteen degrees, the equator a touch brighter.
  ctx.lineWidth = 1;
  for (let lon = -165; lon < 180; lon += 15) {
    ctx.strokeStyle = lon === 0 ? 'rgba(160,210,220,.28)' : 'rgba(160,210,220,.13)';
    ctx.beginPath();
    ctx.moveTo(X(lon), y);
    ctx.lineTo(X(lon), y + h);
    ctx.stroke();
  }
  for (let lat = -60; lat <= 70; lat += 15) {
    ctx.strokeStyle = lat === 0 ? 'rgba(160,210,220,.32)' : 'rgba(160,210,220,.13)';
    ctx.beginPath();
    ctx.moveTo(x, Y(lat));
    ctx.lineTo(x + w, Y(lat));
    ctx.stroke();
  }
  const small = Math.max(7, Math.round(w / 120));
  if (w > 300) {
    ctx.fillStyle = 'rgba(160,210,220,.45)';
    ctx.font = `${small}px monospace`;
    ctx.textAlign = 'left';
    for (let lat = -45; lat <= 60; lat += 15)
      ctx.fillText(`${Math.abs(lat)}${lat > 0 ? 'N' : lat < 0 ? 'S' : ''}`, x + 3, Y(lat) - 2);
    ctx.textAlign = 'center';
    for (let lon = -150; lon <= 150; lon += 30)
      ctx.fillText(`${Math.abs(lon)}${lon > 0 ? 'E' : lon < 0 ? 'W' : ''}`, X(lon), y + h - 3);
  }
  // The Atlantic range, picked out while she is on the pad or climbing through it.
  const onRange = !c || ['count', 'hold', 'poll', 'ascent', 'insertion', 'coast', 'ip'].includes(c.phase) || !!c.poll;
  ctx.beginPath();
  ATLANTIC_RANGE.forEach(([lon, lat], i) => (i ? ctx.lineTo(X(lon), Y(lat)) : ctx.moveTo(X(lon), Y(lat))));
  ctx.closePath();
  ctx.fillStyle = onRange ? 'rgba(232,198,106,.12)' : 'rgba(232,198,106,.05)';
  ctx.fill();
  ctx.strokeStyle = onRange ? 'rgba(232,198,106,.55)' : 'rgba(232,198,106,.2)';
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (w > 300 && onRange) {
    ctx.fillStyle = 'rgba(232,198,106,.8)';
    ctx.font = `${small}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('ATLANTIC RANGE', X(-52), Y(12));
  }
  // The planned ground track: three orbits, or the short arc down the range.
  const end = orbital ? 3 * ORBIT.period : 8,
    step = orbital ? 0.5 : 0.1;
  // A Redstone flies no orbit: 480 km down the range on a bearing of about 105 degrees, splashing near the Bahamas.
  const point = orbital ? groundPoint : t => [CAPE[0] + (4.3 * t) / 8, CAPE[1] - (1.1 * t) / 8];
  const path = (from, to) => {
    ctx.beginPath();
    let last = null;
    for (let t = from; t <= to + 1e-6; t += step) {
      const [lon, lat] = point(Math.min(t, to));
      const px = X(lon),
        py = Y(lat);
      if (last === null || Math.abs(lon - last) > 180) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      last = lon;
    }
    ctx.stroke();
  };
  ctx.strokeStyle = 'rgba(242,227,160,.75)';
  ctx.lineWidth = Math.max(1, w / 500);
  ctx.setLineDash([6, 4]);
  path(0, end);
  ctx.setLineDash([]);
  // The tracking stations: the one she is over lit up.
  const over = c && c.status && c.status.station;
  for (const [code, lon, lat, name, satellite] of stationsFor(g)) {
    const lit = over === name,
      px = X(lon),
      py = Y(lat),
      r = Math.max(2.5, w / 260) * (lit ? 1.5 : 1);
    ctx.fillStyle = lit ? '#9fdc9a' : '#e8c66a';
    if (satellite) {
      // a relay satellite, parked over the equator: a body with its two panels
      ctx.fillRect(px - r, py - r, 2 * r, 2 * r);
      ctx.fillRect(px - 3.5 * r, py - r * 0.4, 2 * r, r * 0.8);
      ctx.fillRect(px + 1.5 * r, py - r * 0.4, 2 * r, r * 0.8);
    } else {
      ctx.beginPath();
      ctx.moveTo(px, py - r);
      ctx.lineTo(px + r, py);
      ctx.lineTo(px, py + r);
      ctx.lineTo(px - r, py);
      ctx.closePath();
      ctx.fill();
    }
    if (lit) {
      ctx.strokeStyle = 'rgba(159,220,154,.5)';
      ctx.beginPath();
      ctx.arc(px, py, r * 3, 0, 7);
      ctx.stroke();
    }
    if (w > 300) {
      ctx.fillStyle = lit ? '#c8f0c4' : 'rgba(232,226,208,.75)';
      ctx.font = `${small}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(code, px + r + 2, py - r);
    }
  }
  // The capsule on the track, with a bright trail behind her.
  const t = trackMinutes(c);
  if (t != null && (orbital || t <= end)) {
    ctx.strokeStyle = '#fff8d8';
    ctx.lineWidth = Math.max(2, w / 260);
    path(Math.max(0, t - (orbital ? 12 : 3)), t);
    const [lon, lat] = point(t);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(X(lon), Y(lat), Math.max(3, w / 150), 0, 7);
    ctx.fill();
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

// The live pad picture: sky and sea in the day's light, the gantry, the round on it, flame and smoke when she flies.
// Drawn clipped into the rectangle given, wherever it is wanted — the wall television, or the console scene's inset.
export function padPicture(ctx, g, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const sky = skyFor(g.clock % 1440);
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, sky[0]);
  grad.addColorStop(1, sky[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  const k = h / 400,
    cx = PLACES.tower.x + 25;
  ctx.translate(x + w / 2 - cx * k, y - (GROUND - 370) * k);
  ctx.scale(k, k);
  if (g.site === 'cape') {
    ctx.fillStyle = '#3f6f8f';
    ctx.fillRect(cx - 3000, 440, 6000, 48);
    ctx.fillStyle = '#5b7a3c';
    ctx.fillRect(cx - 3000, 488, 6000, GROUND - 488);
  }
  ctx.fillStyle = '#e4d8b4';
  ctx.fillRect(cx - 3000, GROUND, 6000, 80);
  tower(ctx, PLACES.tower);
  if (g.rocket.where === 'tower') roundShape(ctx, g, cx, GROUND - 8, 0, true);
  else if (g.rocket.where === 'flying') {
    const wac = g.vehicle === 'wac' || g.vehicle === 'aerobee',
      rise = flyingRise(g);
    roundShape(ctx, g, cx, GROUND - 8 - rise, 0, wac ? rise < 40 : true);
    flame(ctx, cx, GROUND - 8 - rise, 1, Math.PI / 2, g.time, wac ? 1.6 : 2.4);
    launchSmoke(ctx, g);
  }
  ctx.restore();
}

// The fixed camera frames 370 site units above the pad. At 30 units per console second the rocket clears it at T+13.
export function controlTelevision(ctx, g, x, y, w, h) {
  const c = g.console;
  const last = c?.trace?.at(-1);
  const live = c?.phase === 'ascent';
  // Once she is in the flight proper the climb is history: the screen carries the flight's own status board instead
  // of the last ascent sample, hours or days stale.
  if (c?.flight && !['ascent', 'insertion'].includes(c.phase)) return flightStatusBoard(ctx, c.flight, x, y, w, h);
  if (!last || (live && last.t < 13)) return padPicture(ctx, g, x, y, w, h);

  const size = Math.min(w / 28, h / 5);
  const readouts = [
    ['Velocity', `${last.v.toFixed(2)} km/s`],
    ['Acceleration', `${last.acc.toFixed(1)} g`],
    ['Flight-path angle', `${last.gamma.toFixed(1)}°`],
    ['Off planned path', `${last.off >= 0 ? '+' : ''}${last.off.toFixed(1)}°`],
  ];
  ctx.save();
  ctx.fillStyle = '#0c1a19';
  ctx.fillRect(x, y, w, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#81af9e';
  ctx.font = `${size * 0.82}px monospace`;
  ctx.fillText(`${live ? 'Ascent telemetry' : 'Last ascent sample'}  ·  T+${last.t} s`, x + w * 0.04, y + h * 0.16);
  if (last.stage) {
    ctx.textAlign = 'right';
    ctx.fillText(last.stage, x + w * 0.96, y + h * 0.16);
    ctx.textAlign = 'left';
  }
  ctx.fillRect(x + w * 0.04, y + h * 0.27, w * 0.92, 1);
  for (const [i, [label, value]] of readouts.entries()) {
    const left = x + w * (i % 2 ? 0.53 : 0.04);
    const top = y + h * (i < 2 ? 0.41 : 0.73);
    ctx.font = `${size * 0.75}px monospace`;
    ctx.fillStyle = '#81af9e';
    ctx.fillText(label, left, top);
    ctx.font = `bold ${size * 1.15}px monospace`;
    ctx.fillStyle = '#b7efb0';
    ctx.fillText(value, left, top + h * 0.14);
  }
  ctx.restore();
}

// The flight's status board on the front wall: the spacecraft, the phase of the flight plan, and the status lines the
// controllers keep (reserve, objective and the rest), amber when one is out of limits.
function flightStatusBoard(ctx, f, x, y, w, h) {
  const size = Math.min(w / 28, h / 5);
  ctx.save();
  ctx.fillStyle = '#0c1a19';
  ctx.fillRect(x, y, w, h);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#81af9e';
  ctx.font = `${size * 0.82}px monospace`;
  const phases = f.phases ? ` · phase ${Math.min(f.phaseNo, f.phases)} of ${f.phases}` : '';
  ctx.fillText(`${f.craft || 'Flight'}${phases}`, x + w * 0.04, y + h * 0.16, w * 0.92);
  ctx.fillRect(x + w * 0.04, y + h * 0.27, w * 0.92, 1);
  ctx.font = `bold ${size * 1.15}px monospace`;
  ctx.fillStyle = '#b7efb0';
  ctx.fillText(f.phase || '', x + w * 0.04, y + h * 0.42, w * 0.92);
  const status = Object.entries(f.status || {}).slice(0, 4);
  status.forEach(([key, [value, warn]], i) => {
    const left = x + w * (i % 2 ? 0.53 : 0.04),
      top = y + h * (i < 2 ? 0.6 : 0.82);
    ctx.font = `${size * 0.7}px monospace`;
    ctx.fillStyle = '#81af9e';
    ctx.fillText(key, left, top, w * 0.42);
    ctx.font = `bold ${size * 0.85}px monospace`;
    ctx.fillStyle = warn ? '#e8c66a' : '#b7efb0';
    ctx.fillText(String(value), left, top + h * 0.09, w * 0.42);
  });
  ctx.restore();
}

// The dust the truck kicks up, drawn over anyone in it.
function truckDust(ctx, g) {
  if (!g.truck.dust) return;
  const y = GROUND + 28;
  ctx.fillStyle = 'rgba(210,190,150,.5)';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(g.truck.x - 8 - i * 12, y - 8 - i * 3, 6 + i * 3, 0, 7);
    ctx.fill();
  }
}

// ---- Inside Mercury Control: the launch-control scene. You are in the room; the wall and the rows fill the screen. ----
const ROOM_SEATS = {
  hollis: 'FLIGHT DIR.',
  albrecht: 'BOOSTER',
  morgan: 'NETWORK',
  reyes: 'RECOVERY',
  vega: 'PAD',
  kessler: 'EECOM',
  tate: 'RETRO',
  dorsey: 'FLIGHT DIR.',
};
const PHASE_SHORT = {
  count: 'COUNT',
  hold: 'HOLD',
  poll: 'POLL',
  ascent: 'CLIMB',
  insertion: 'CUTOFF',
  ip: 'SPLASH',
  coast: 'COAST',
  orbit: 'ORBIT',
  pack: 'PACK',
  retro: 'RETRO',
  entry: 'BLACKOUT',
  pad: 'PAD',
  shutdown: 'SAFE',
};
const PHASE_WORD = {
  count: 'COUNTING',
  hold: 'HOLDING',
  poll: 'STATUS POLL',
  ascent: 'POWERED FLIGHT',
  insertion: 'GO / NO-GO FOR ORBIT',
  ip: 'SPLASHDOWN POINT',
  coast: 'COASTING',
  orbit: 'IN ORBIT',
  pack: 'COMING UP ON RETROFIRE',
  retro: 'RETROFIRE',
  entry: 'BLACKOUT',
  pad: 'SHUTDOWN ON THE PAD',
  shutdown: 'SHUTDOWN',
};

// The room's clock and the word for what is happening, as the player-visible console reports them.
function controlReadout(c) {
  if (!c) return ['—', ''];
  if (c.phase === 'count' || c.poll || c.phase === 'hold')
    return [
      `T-${Math.floor(Math.ceil(c.clock) / 60)}:${String(Math.ceil(c.clock) % 60).padStart(2, '0')}`,
      c.phase === 'hold' ? 'HOLDING' : c.poll ? 'STATUS POLL' : 'COUNTING',
    ];
  if (c.phase === 'ascent' || c.phase === 'insertion') {
    const last = c.trace[c.trace.length - 1];
    return last ? [`${last.v.toFixed(2)} km/s`, PHASE_WORD[c.phase]] : ['—', PHASE_WORD[c.phase]];
  }
  if (c.orbitT != null)
    return [
      `T+${Math.floor(c.orbitT / 60)}:${String(Math.floor(c.orbitT % 60)).padStart(2, '0')}`,
      PHASE_WORD[c.phase] || c.phase.toUpperCase(),
    ];
  if (c.flight)
    return [
      `GET ${Math.floor(c.flight.at)}:${String(Math.floor((c.flight.at % 1) * 60)).padStart(2, '0')}`,
      (c.flight.phase || '').toUpperCase() || PHASE_WORD[c.phase] || '',
    ];
  return ['—', PHASE_WORD[c.phase] || ''];
}

// Each station watches its own duties: Booster the booster's numbers, Retro the trajectory, Recovery the area, and so
// on. All of it is what the room could see: the console's own telemetry, the recovery board, and the planned clock.
const STATION_DUTY = {
  hollis: 'flight',
  albrecht: 'booster',
  morgan: 'network',
  reyes: 'recovery',
  vega: 'pad',
  kessler: 'eecom',
  tate: 'retro',
  dorsey: 'flight',
};
// From Gemini on, Hollis runs flight operations from the back of the room rather than flying the shift.
const opsDirector = (g, id) => id === 'hollis' && /operations/i.test(g.people.hollis?.role || '');
const deskLabel = (g, id) => (opsDirector(g, id) ? 'FLIGHT OPS' : ROOM_SEATS[id]);
const deskDuty = (g, id) => (opsDirector(g, id) ? 'ops' : STATION_DUTY[id]);
const SEAT_DUTY = {
  retro: 'retro',
  flight: 'flight',
  engineer: 'eecom',
  'test-conductor': 'booster',
  programme: 'flight',
  director: 'flight',
  junior: 'retro',
};

function stationReadout(duty, c) {
  const lamp = c && c.lamps && c.lamps[duty.toUpperCase()];
  if (lamp) return [lamp.a, lamp.b, lamp.tone]; // a lamp lit on this station overrides the routine readout
  const last = c && c.trace ? c.trace[c.trace.length - 1] : null;
  const climbing = last && (c.phase === 'ascent' || c.phase === 'insertion');
  const clock = controlReadout(c)[0],
    word = (c ? (c.poll ? 'POLL' : PHASE_SHORT[c.phase]) : '') || '';
  switch (duty) {
    case 'booster':
      return climbing ? [`${last.v.toFixed(2)} km/s`, `${last.acc.toFixed(1)} g`] : [clock, word];
    case 'retro':
    case 'fido':
      return climbing
        ? [`${last.gamma.toFixed(1)}°`, `${last.off >= 0 ? '+' : ''}${last.off.toFixed(1)}°`]
        : [clock, word];
    case 'eecom':
      return climbing ? [`${last.acc.toFixed(1)} g`, 'TELEM'] : [clock, word];
    case 'network':
      return climbing ? [`${last.off >= 0 ? '+' : ''}${last.off.toFixed(1)}°`, 'TRK'] : [clock, 'TRK'];
    case 'recovery': {
      if (c && c.phase === 'ip' && c.ip) return [`${Math.round(c.ip.radar)} km`, 'RADAR'];
      if (c && c.cond) {
        const units = c.orbital ? ORBIT_UNITS : UNITS,
          all = Object.keys(units);
        const on = all.filter(id => c.cond.late !== id).length;
        return [`SEA ${c.cond.seaState}`, `${on}/${all.length}`];
      }
      return [clock, word];
    }
    case 'capcom':
      return [clock, 'UPLINK'];
    case 'surgeon':
      return ['CREW', 'GO'];
    case 'guidance':
      return c && c.goddard ? [c.goddard.go ? 'GO' : 'NO-GO', 'COMPUTER'] : [clock, 'ALIGN'];
    default:
      return [clock, word]; // the flight director's: the clock and the state of the flight
  }
}

export function drawControlRoom(ctx, g, view) {
  const { w, h } = view,
    c = g.console;
  const wallH = Math.round(h * 0.56);
  // Paint the whole canvas first: no frame of the site may survive behind the room.
  ctx.fillStyle = '#14171c';
  ctx.fillRect(0, 0, w, h);
  // The room between two side walls: the server bank on the left, the viewing gallery on the right.
  const leftW = w * 0.055,
    galleryX = w * 0.87;
  // The back wall, and the floor.
  const wall = ctx.createLinearGradient(0, 0, 0, wallH);
  wall.addColorStop(0, '#202831');
  wall.addColorStop(0.53, '#343f47');
  wall.addColorStop(1, '#20272c');
  ctx.fillStyle = wall;
  ctx.fillRect(leftW, 0, galleryX - leftW, wallH);
  ctx.fillStyle = 'rgba(5,13,18,.3)';
  for (let x = leftW; x < galleryX; x += (galleryX - leftW) / 12) ctx.fillRect(x, 0, 2, wallH);
  const carpet = ctx.createLinearGradient(0, wallH, 0, h);
  carpet.addColorStop(0, '#2a3031');
  carpet.addColorStop(0.4, '#423d33');
  carpet.addColorStop(1, '#292824');
  ctx.fillStyle = carpet;
  ctx.fillRect(leftW, wallH, galleryX - leftW, h - wallH);
  ctx.fillStyle = 'rgba(232,221,189,.08)';
  for (const depth of [0.12, 0.29, 0.52, 0.82]) {
    ctx.fillRect(leftW, wallH + depth * (h - wallH), galleryX - leftW, 1);
  }
  const floorLight = ctx.createRadialGradient(w * 0.46, h * 0.8, 0, w * 0.46, h * 0.8, w * 0.35);
  floorLight.addColorStop(0, 'rgba(239,198,131,.17)');
  floorLight.addColorStop(1, 'rgba(239,198,131,0)');
  ctx.fillStyle = floorLight;
  ctx.fillRect(leftW, wallH + 6, galleryX - leftW, h - wallH - 6);
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(leftW, wallH, galleryX - leftW, 6);
  // The front wall is filled edge to edge: the big map on the left, the pad on television and the monitoring screen
  // stacked beside it out to the gallery, the clocks across the full width under them, and the loop's board below that
  // (the DOM loop log sits over it: #loop.in-room in style.css uses the same fractions).
  const wallL = w * 0.085,
    wallR = galleryX - w * 0.015;
  ctx.fillStyle = 'rgba(7,12,17,.45)';
  ctx.fillRect(wallL - 12, wallH * 0.05 - 6, wallR - wallL + 24, wallH * 0.63);
  drawWallMap(ctx, g, wallL, wallH * 0.05, w * 0.45, wallH * 0.6);
  const tvX = wallL + w * 0.47,
    tvW = wallR - tvX,
    tvY = wallH * 0.05,
    tvH = wallH * 0.3;
  ctx.fillStyle = '#181b1f';
  ctx.fillRect(tvX - 6, tvY - 6, tvW + 12, tvH + 12);
  controlTelevision(ctx, g, tvX, tvY, tvW, tvH);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  for (let y = tvY + 5; y < tvY + tvH; y += 6) ctx.fillRect(tvX, y, tvW, 2);
  monitorScreen(ctx, g, tvX, wallH * 0.39, tvW, wallH * 0.26);
  clocksStrip(ctx, g, wallL, wallH * 0.69, wallR - wallL, wallH * 0.09);
  ctx.fillStyle = '#1b1f25';
  ctx.fillRect(wallL - 4, wallH * 0.81 - 4, wallR - wallL + 8, wallH * 0.17 + 8);
  // The side walls: racks of equipment, and the gallery beyond the glass.
  serverBank(ctx, 0, 0, leftW, h, g);
  viewingGallery(ctx, galleryX, 0, w - galleryX, h);
  // Your console, drawn into the room below the gallery: clocks, readouts, and the calls that are yours.
  const panelY = h * 0.05 + h * 0.12 + Math.max(10, h * 0.025);
  drawConsolePanel(ctx, g, galleryX + 6, panelY, w - galleryX - 12, h - panelY - 12);
  // Two rows fill the floor, sized to the room and clear of your panel: the named controllers at the back, and the
  // working stations at the front with your wide console in the middle of them.
  const floor = h - wallH,
    rowRight = galleryX - w * 0.01,
    rowMid = (leftW + rowRight) / 2,
    availW = rowRight - leftW - 40;
  // One desk per job: the job that is yours is your desk at the front, so nobody else sits at it on the back row, and
  // once Hollis has moved up to director of flight operations his desk says so.
  const yourDuty = SEAT_DUTY[g.record.seat] || 'flight';
  const back = ['hollis', 'dorsey', 'albrecht', 'tate', 'morgan', 'reyes', 'vega', 'kessler'].filter(
    id => g.people[id] && !g.people[id].hidden && deskDuty(g, id) !== yourDuty,
  );
  // The back row is further away, so its desks are never drawn bigger than the front row's.
  const roomK = Math.max(1, h / 900); // a bigger canvas (4K) gets bigger desks, not a wider empty floor
  const frontK = Math.max(0.55, Math.min(1.4 * roomK, (availW - 4 * 24) / (4 * 190 + 460)));
  const backGap = 16,
    backK = Math.max(
      0.55,
      Math.min(1.25 * roomK, frontK * 0.9, (availW - (back.length - 1) * backGap) / (back.length * 190)),
    );
  const bSpan = back.length * 190 * backK + (back.length - 1) * backGap;
  back.forEach((id, i) =>
    consoleDesk(
      ctx,
      rowMid - bSpan / 2 + i * (190 * backK + backGap),
      wallH + floor * 0.16,
      backK,
      g.people[id],
      deskLabel(g, id),
      c,
      false,
      deskDuty(g, id),
    ),
  );
  const front = [['capcom'], ['fido'], null, ['surgeon'], ['guidance']],
    frontGap = 24;
  let fx = rowMid - ((4 * 190 + 460) * frontK + 4 * frontGap) / 2;
  const frontY = wallH + floor * 0.6;
  for (const seat of front) {
    if (seat) {
      consoleDesk(ctx, fx, frontY, frontK, { color: '#4a5568' }, seat[0].toUpperCase(), c, false, seat[0]);
      fx += 190 * frontK + frontGap;
    } else {
      consoleDesk(
        ctx,
        fx,
        frontY,
        frontK,
        g.people.you,
        'YOU · ' + (g.people.you.role || '').toUpperCase(),
        c,
        true,
        SEAT_DUTY[g.record.seat] || 'flight',
      );
      fx += 460 * frontK + frontGap;
    }
  }
  ctx.textAlign = 'left';
}

// ---- Your console, drawn into the room: the clocks, readouts and calls that are yours, on the panel under the
// viewing gallery. The buttons are part of the scene: the click handler finds them through controlButtonAt. ----
let controlHits = [];

export function controlButtonAt(g, x, y) {
  if (!g || g.room !== 'console') return null;
  for (const b of controlHits) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  return null;
}

// What your console shows for the flight's phase, mirroring the room's own panels: the clock and state always, the
// board or readouts when they carry information, and the calls that are yours as buttons.
function consolePanelModel(c) {
  const [clock, word] = controlReadout(c);
  // ask: the call in plain words, drawn above the readouts whenever the call is yours.
  const P = { clock, state: word, ask: null, lines: [], buttons: [] };
  const auto = !!c.auto;
  const btn = (act, id, label, tone) => P.buttons.push({ act, id, label, tone });
  const last = c.trace ? c.trace[c.trace.length - 1] : null;
  const km = x => `${Math.round(Math.abs(x))} km ${x >= 0 ? 'long' : 'short'}`;
  if (c.shift && ['ascent', 'insertion'].includes(c.phase)) {
    const shift = c.shift;
    P.lines.push(`Plan: ${shift.plan === 'checkout' ? 'Orbital checkout' : 'Rendezvous'}`);
    if (shift.remaining != null) P.lines.push(`Return window: ${Math.ceil(shift.remaining)} min`);
    if (shift.pending) P.lines.push(`${shift.pending.desk === 'booster' ? 'Booster' : 'Network'} report pending`);
    else if (shift.reports.network || shift.reports.booster)
      P.lines.push(shift.reports.network || shift.reports.booster);
  }
  if (c.poll || c.phase === 'poll') {
    // a pending poll outranks the count: it is the call the room is waiting on
    if (c.poll === 'joint') {
      P.state = 'THE BOOSTER JOINT';
      P.lines.push("The contractor's engineers recommend the afternoon warm.");
      if (!auto) {
        btn('m-go', null, 'PRESS', 'danger');
        btn('m-nogo', null, 'HOLD', 'go');
      }
      return P;
    }
    P.state = c.poll === 'final' ? 'FINAL STATUS CHECK' : 'RECOVERY POLL';
    if (!auto) P.ask = c.poll === 'final' ? 'Final status check. Are we go?' : 'Is Recovery ready? Give your status.';
    if (c.cond) {
      P.lines.push(`Sea state: ${c.cond.seaState}`);
      const units = c.orbital ? ORBIT_UNITS : UNITS;
      for (const [id, text] of Object.entries(units))
        P.lines.push(`${id.toUpperCase()}: ${c.cond.late === id ? 'NOT ON STATION' : 'on station'}`);
    }
    if (!auto) {
      btn('m-go', null, 'GO', 'go');
      btn('m-nogo', null, 'NO-GO', 'danger');
    }
    return P;
  }
  if (c.phase === 'count' || c.phase === 'hold') return P;
  if (c.phase === 'ascent') {
    P.state = c.abortAt != null ? 'ABORT' : 'POWERED FLIGHT';
    if (last && !c.shift)
      P.lines.push(
        `${last.v.toFixed(2)} km/s`,
        `${last.gamma.toFixed(1)} degrees`,
        `${last.off >= 0 ? '+' : ''}${last.off.toFixed(1)} off plan`,
        `${last.acc.toFixed(1)} g`,
      );
    if (c.shift && c.abortAt == null) {
      if (!c.shift.pending) {
        btn('m-shift', 'booster', 'ASK BOOSTER');
        btn('m-shift', 'network', 'ASK NETWORK');
      }
      if (c.shift.plan === 'checkout') btn('m-shift', 'rendezvous', 'PLAN RENDEZVOUS');
      else btn('m-shift', 'checkout', 'PLAN ORBITAL CHECKOUT');
    }
    if (!auto && c.abortAt == null) btn('m-abort', null, 'ABORT', 'danger');
    return P;
  }
  if (c.phase === 'insertion') {
    P.state = 'GO / NO-GO FOR ORBIT';
    if (!auto) P.ask = 'The engines are off. Go for orbit, or bring her home?';
    if (c.goddard)
      P.lines.push(
        `Cutoff: ${c.goddard.v.toFixed(3)} km/s`,
        `${c.goddard.gammaOff.toFixed(1)} degrees off level`,
        ...(c.goddard.need ? [`Orbit needs about ${c.goddard.need} km/s, level`] : []),
        `Goddard: ${c.goddard.go ? 'GO' : 'NO-GO'}`,
      );
    if (!auto) {
      btn('m-insert', 'go', c.shift ? 'COMMIT WORKING PLAN' : 'GO FOR ORBIT', 'go');
      if (c.kind === 'flight' && c.flightId === 'gem-6') {
        P.lines.push('Correction leaves 55% reserve. Network fix takes 4 min.');
        btn('m-insert', 'correct', 'CORRECT ORBIT');
        if (c.shift?.plan === 'checkout') btn('m-shift', 'rendezvous', 'PLAN RENDEZVOUS');
        else btn(c.shift ? 'm-shift' : 'm-insert', c.shift ? 'checkout' : 'reduced', 'ORBITAL CHECKOUT ONLY');
        if (!c.insertionFix && !c.shift?.pending) btn('m-insert', 'fix', 'REQUEST SECOND FIX');
      }
      btn('m-insert', 'nogo', 'COME HOME', 'danger');
    }
    return P;
  }
  if (c.phase === 'ip') {
    P.state = 'SPLASHDOWN POINT';
    P.ask = 'Where does Recovery send the helicopters?';
    if (c.orbital) {
      P.lines.push(
        `The spacecraft's computer: ${km(c.ip.retro)} of the planned point`,
        'Radar: a fix after the blackout, good to about 15 km; the helicopters wait about 20 min for it',
      );
      if (!(auto && g.record.seat !== 'flight')) {
        btn('m-aim', 'retro', "The computer's point", 'go');
        btn('m-aim', 'radar', 'Wait for the radar');
        btn('m-aim', 'planned', 'The planned point');
      }
    } else {
      P.lines.push(`Radar: ${Math.round(c.ip.radar)} km`, `The computers: ${Math.round(c.ip.telemetry)} km`);
      if (!auto) {
        btn('m-aim', 'radar', 'THE RADAR', 'go');
        btn('m-aim', 'telemetry', 'THE COMPUTER');
        btn('m-aim', 'planned', 'THE PLAN');
      }
    }
    return P;
  }
  if (c.phase === 'orbit') {
    P.state = 'IN ORBIT';
    const s = c.status || {};
    P.lines.push(
      `Orbit ${s.orbit ?? '-'} of 3`,
      `Over ${s.station ?? '-'}`,
      `Fuel ${Math.round((s.fuel ?? 1) * 100)}%`,
      `Seg 51: ${s.seg51 && s.seg51 !== 'off' ? s.seg51 : 'off'}`,
    );
    return P;
  }
  if (c.phase === 'pack') {
    P.state = 'THE RETRO PACK';
    P.ask = 'What does he do with the retro pack after retrofire?';
    P.lines.push('Segment 51 says the landing bag is down: the heat shield may be loose.');
    for (const [id, text] of Object.entries(PACK_OPTIONS))
      btn('m-pack', id, id === 'keep' ? 'KEEP THE PACK' : 'JETTISON IT', id === 'keep' ? 'go' : undefined);
    return P;
  }
  if (c.phase === 'retro') {
    P.state = 'RETROFIRE';
    P.ask = 'The retros fire on the automatic system unless you call it. Automatic, or by hand?';
    P.lines.push('Where she lands depends on her attitude when the retros fire.');
    if (c.status?.window) P.lines.push(`The pilot over Muchea: "${c.status.window}"`);
    P.lines.push(`Fuel left: ${Math.round((c.status?.fuel ?? 1) * 100)}%`);
    for (const [id] of Object.entries(RETRO_OPTIONS))
      btn('m-retro', id, id === 'auto' ? 'FIRE AUTOMATIC' : 'FIRE BY HAND');
    return P;
  }
  if (c.phase === 'mission') {
    const d = c.flight && c.flight.decision;
    if (c.shift && c.flight.status.RESERVE)
      P.lines.push(`Plan: ${c.flight.status.OBJECTIVE[0]} · Reserve: ${c.flight.status.RESERVE[0]}`);
    if (!d) {
      P.state = 'THE FLIGHT RUNS';
      return P;
    }
    if (!d.mine) {
      P.state = 'WAITING';
      P.lines.push(d.who === 'hollis' ? "The programme's call." : `${surname(g.people.dorsey.name)}'s call.`);
      return P;
    }
    P.state = 'YOUR CALL';
    P.ask = d.q;
    if (d.remaining != null)
      P.lines.push(
        `Intercept window: ${Math.ceil(d.remaining)} min.${d.fixIn != null ? ' New ground fix pending.' : ''}`,
      );
    if (d.rule) P.lines.push('Rule: ' + d.rule);
    for (const [id, text] of Object.entries(d.options)) btn('m-decide', id, text);
    return P;
  }
  if (c.phase === 'shutdown') {
    P.state = 'SHUTDOWN ON THE PAD';
    P.ask = 'How hard do we look before we try again?';
    btn('m-shutdown', 'plug', 'RE-SEAT AND RECYCLE: A DAY', 'go');
    btn('m-shutdown', 'teardown', 'TEARDOWN: FIND EVERY CAUSE', 'danger');
    return P;
  }
  if (c.phase === 'pad') {
    P.state = 'CAPSULE ON THE PAD';
    P.ask = 'The booster is fuelled and the pyrotechnics are armed. What do we do with her?';
    for (const [id, text] of Object.entries(PAD_OPTIONS))
      btn('pad', id, id === 'wait' ? 'LEAVE HER OVERNIGHT' : id === 'now' ? 'SAFE HER NOW' : 'SHOOT THE TANKS');
    return P;
  }
  if (c.phase === 'entry') {
    P.state = 'BLACKOUT';
    return P;
  }
  if (c.phase === 'coast') {
    P.state = 'COASTING';
    return P;
  }
  P.state = word || 'DONE';
  return P;
}

function drawPanelButton(ctx, x, y, w, h, btn) {
  ctx.fillStyle = btn.tone === 'danger' ? '#7a2e24' : btn.tone === 'go' ? '#2e5c3a' : '#33404d';
  ctx.strokeStyle = btn.tone === 'danger' ? '#d0634f' : btn.tone === 'go' ? '#6fc88a' : '#8a93a0';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f1e6c8';
  ctx.font = `${Math.max(11, Math.round(h * 0.3))}px sans-serif`;
  ctx.textAlign = 'center';
  const lines = wrap(ctx, btn.label, w - 14).slice(0, 2),
    lh = h * 0.34;
  lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * lh + 4));
  ctx.textAlign = 'left';
}

function drawConsolePanel(ctx, g, x, y, w, h) {
  controlHits = [];
  const c = g.console;
  // The console face, in the room's colours.
  ctx.fillStyle = '#262a31';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#4b5258';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (!c) return;
  const P = consolePanelModel(c);
  let cy = y + 14;
  // The clock, as the wall clocks carry it.
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(x + 10, cy, w - 20, 46);
  ctx.strokeStyle = '#3a4452';
  ctx.strokeRect(x + 10.5, cy + 0.5, w - 21, 45);
  ctx.fillStyle = '#e8c66a';
  ctx.font = `bold ${Math.max(15, Math.round(w * 0.085))}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(P.clock, x + w / 2, cy + 31);
  cy += 58;
  if (P.state) {
    ctx.fillStyle = P.ask ? '#e8c66a' : '#c9d2da';
    ctx.font = `${P.ask ? 'bold ' : ''}${Math.max(12, Math.round(w * 0.05))}px sans-serif`;
    ctx.fillText(P.state, x + w / 2, cy + 10);
    cy += 30;
  }
  ctx.textAlign = 'left';
  const bh = Math.max(32, Math.round(h * 0.05)),
    gap = 8;
  const buttonsTop = P.buttons.length ? y + h - P.buttons.length * (bh + gap) - 10 : y + h;
  // The call in plain words, when it is yours: what is being asked, above what the room knows about it.
  if (P.ask) {
    ctx.font = `${Math.max(13, Math.round(w * 0.056))}px sans-serif`;
    ctx.fillStyle = '#f1e6c8';
    const askH = Math.max(17, Math.round(w * 0.072));
    for (const l of wrap(ctx, P.ask, w - 20)) {
      if (cy + askH > buttonsTop) break;
      ctx.fillText(l, x + 10, cy + 12);
      cy += askH;
    }
    cy += 10;
  }
  // The room's lines: the board, the readouts - as many as fit above the calls. The font is set before the wrap
  // measures, so the lines are broken for the type they are drawn in and never run past the panel's edge; a line that
  // would reach the calls is not drawn.
  ctx.font = `${Math.max(12, Math.round(w * 0.05))}px monospace`;
  ctx.fillStyle = '#9fdc9a';
  const lineH = Math.max(16, Math.round(w * 0.064));
  lines: for (const line of P.lines.slice(0, 9)) {
    for (const l of wrap(ctx, line, w - 20)) {
      if (cy + lineH > buttonsTop) break lines;
      ctx.fillText(l, x + 10, cy + 11);
      cy += lineH;
    }
    cy += 4;
  }
  for (const btn of P.buttons) {
    drawPanelButton(ctx, x + 10, cy, w - 20, bh, btn);
    controlHits.push({ act: btn.act, id: btn.id, x: x + 10, y: cy, w: w - 20, h: bh });
    cy += bh + gap;
  }
  ctx.textAlign = 'left';
}

// A bank of computer racks along the left wall: units, dials and lights that blink with the room.
function serverBank(ctx, x, y, w, h, g) {
  ctx.fillStyle = '#1d2126';
  ctx.fillRect(x, y, w, h);
  const units = Math.max(4, Math.floor(h / 90));
  for (let i = 0; i < units; i++) {
    const uy = y + 10 + (i * (h - 20)) / units,
      uh = (h - 20) / units - 8;
    ctx.fillStyle = '#2c3138';
    ctx.fillRect(x + 5, uy, w - 10, uh);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(x + 10, uy + 5, w - 20, uh - 10);
    for (let l = 0; l < 6; l++) {
      const on = (i * 13 + l * 7 + Math.floor(g.time * 2)) % 5 < 3;
      ctx.fillStyle = on ? '#9fdc9a' : '#31413a';
      ctx.fillRect(x + 14 + l * ((w - 34) / 6), uy + 9, Math.max(3, w / 26), 4);
    }
    ctx.fillStyle = '#454c55';
    ctx.fillRect(x + w / 2 - 8, uy + uh - 16, 16, 8); // a dial on each rack
    ctx.fillStyle = 'rgba(173,189,191,.14)';
    for (let vent = 0; vent < 3; vent++) ctx.fillRect(x + 14, uy + 21 + vent * 3, Math.max(0, w - 28), 1);
  }
}

// The viewing gallery along the right wall: two windows up on the wall, a rail under them, and the gallery floor below.
function viewingGallery(ctx, x, y, w, h) {
  // The gallery's own wall, two windows on it, and the gallery floor below.
  const wall = ctx.createLinearGradient(x, y, x + w, y);
  wall.addColorStop(0, '#292b2a');
  wall.addColorStop(0.4, '#47433a');
  wall.addColorStop(1, '#332f2b');
  ctx.fillStyle = wall;
  ctx.fillRect(x, y, w, h);
  const winW = Math.min(w * 0.36, 130),
    winH = h * 0.12,
    gap = w * 0.08;
  const gx = x + (w - 2 * winW - gap) / 2,
    gy = y + h * 0.05;
  for (const wx of [gx, gx + winW + gap]) {
    ctx.fillStyle = '#181f22';
    ctx.fillRect(wx - 3, gy - 3, winW + 6, winH + 6);
    const glass = ctx.createLinearGradient(0, gy, 0, gy + winH);
    glass.addColorStop(0, '#547889');
    glass.addColorStop(1, '#304650');
    ctx.fillStyle = glass;
    ctx.fillRect(wx, gy, winW, winH);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(wx + winW * 0.12, gy + winH * 0.1, winW * 0.07, winH * 0.8);
    // The watchers, in the lower half of the glass.
    for (let i = 0; i < 3; i++) {
      const hx = wx + winW * (0.22 + i * 0.28),
        hy = gy + winH * (0.6 + ((i * 13) % 3) * 0.08);
      const head = Math.min(winH * 0.15, Math.max(3, w * 0.036));
      ctx.fillStyle = i % 2 ? '#35414b' : '#2a3438';
      ctx.fillRect(hx - head * 1.2, hy + head * 0.4, head * 2.4, gy + winH - hy - head * 0.4);
      ctx.fillStyle = i % 2 ? '#bc9c7d' : '#9b7f68';
      ctx.beginPath();
      ctx.arc(hx, hy, head, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = '#33302b';
    ctx.fillRect(wx - 2, gy + winH, winW + 4, Math.max(3, h * 0.008)); // the rail under the glass
  }
  // From the rail down, the gallery's own floor to the bottom of the screen.
  const floorY = gy + winH + Math.max(6, h * 0.015);
  ctx.fillStyle = '#2a2723';
  ctx.fillRect(x + 2, floorY, w - 4, h - floorY - 2);
}

// The monitoring screen: the flight-path angle as she climbs, second by second, with her position on it.
export function monitorScreen(ctx, g, x, y, w, h) {
  ctx.fillStyle = '#181b1f';
  ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(x, y, w, h);
  const c = g.console,
    trace = c && c.trace;
  const maxT = c && c.burn ? c.burn : 1,
    limit = 6; // Mercury's abort rule: six degrees off the planned line
  // The title has its own band across the top, so the limit lines never run through it.
  const titleSize = Math.max(7, Math.round(w / 26)),
    top = y + titleSize + 8,
    mid = (top + y + h) / 2;
  const px = t => x + 6 + (t / maxT) * (w - 12),
    py = d => mid - (d / limit) * (mid - top - 4);
  ctx.strokeStyle = '#31413a';
  ctx.lineWidth = 1;
  for (const d of [limit, -limit]) {
    ctx.beginPath();
    ctx.moveTo(x + 4, py(d));
    ctx.lineTo(x + w - 4, py(d));
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x + 4, py(0));
  ctx.lineTo(x + w - 4, py(0));
  ctx.stroke();
  if (trace && trace.length) {
    ctx.strokeStyle = '#9fdc9a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    trace.forEach((p, i) => {
      const X = px(p.t),
        Y = py(Math.max(-limit, Math.min(limit, p.off)));
      if (i) ctx.lineTo(X, Y);
      else ctx.moveTo(X, Y);
    });
    ctx.stroke();
    const last = trace[trace.length - 1];
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px(last.t), py(Math.max(-limit, Math.min(limit, last.off))), 2.5, 0, 7);
    ctx.fill();
  } else {
    ctx.fillStyle = '#5a6a60';
    ctx.font = `${Math.max(8, Math.round(w / 22))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STANDBY', x + w / 2, (py(limit) + py(0)) / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }
  ctx.fillStyle = '#5a6a60';
  ctx.font = `${titleSize}px monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('FLIGHT-PATH ANGLE', x + 6, y + 4);
  ctx.textBaseline = 'alphabetic';
}

// The clocks strip: three panels under the map — the count, the mission, the site clock.
function clocksStrip(ctx, g, x, y, w, h) {
  const c = g.console;
  ctx.fillStyle = '#22272e';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  const dash = '—';
  const panels = [
    ['COUNT', countClock(c) || dash],
    ['MISSION', missionClock(c)],
    ['SITE', siteClock(g)],
  ];
  const pw = (w - 16) / 3;
  panels.forEach(([label, text], i) => {
    const px = x + 8 + i * pw;
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(px, y, pw - 8, h);
    ctx.fillStyle = '#e8c66a';
    ctx.font = `bold ${Math.max(10, Math.round(h * 0.4))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(text, px + (pw - 8) / 2, y + h * 0.58);
    ctx.fillStyle = '#8a93a0';
    ctx.font = `${Math.max(7, Math.round(h * 0.2))}px sans-serif`;
    ctx.fillText(label, px + (pw - 8) / 2, y + h * 0.92);
  });
  ctx.textAlign = 'left';
}

// The count clock carries only the count: the time to go while it runs, LIFTOFF once she is away. The speed and the
// mission clock have their own places on the wall.
function countClock(c) {
  if (!c) return '';
  if (c.phase === 'count' || c.poll || c.phase === 'hold') return controlReadout(c)[0];
  return (c.trace && c.trace.length) || c.flight || c.orbitT != null ? 'LIFTOFF' : '';
}

// The mission clock as the consoles carry it: GET in flight, the orbit clock in orbit, otherwise the count in progress.
function missionClock(c) {
  if (!c) return '—';
  if (c.flight) return `GET ${Math.floor(c.flight.at)}:${String(Math.floor((c.flight.at % 1) * 60)).padStart(2, '0')}`;
  if (c.orbitT != null) return `T+${Math.floor(c.orbitT / 60)}:${String(Math.floor(c.orbitT % 60)).padStart(2, '0')}`;
  if (c.phase === 'ascent' || c.phase === 'insertion') return `T+${Math.floor(c.t)} s`;
  if (c.phase === 'count' || c.poll || c.phase === 'hold') return '—';
  return '—';
}

// The site clock, as the wall clocks kept local time.
function siteClock(g) {
  const m = Math.floor(g.clock % 1440);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// A console desk with its seated controller, its role on the front, and two live screens. Yours carries the mark.
export function consoleDesk(ctx, x, y, k, who, label, c, yours, duty) {
  const dw = (yours ? 460 : 190) * k,
    dh = 60 * k;
  ctx.fillStyle = 'rgba(12,13,15,.38)';
  ctx.fillRect(x + 5 * k, y + dh, dw, 6 * k);
  if (who) {
    // seated behind the desk: shoulders and head above the desktop
    const px = x + dw / 2,
      py = y + 2;
    ctx.fillStyle = '#272d32';
    ctx.fillRect(px - 18 * k, py - 21 * k, 36 * k, 21 * k);
    ctx.fillStyle = who.color;
    ctx.fillRect(px - 14 * k, py - 27 * k, 28 * k, 27 * k);
    ctx.fillStyle = '#e2b993';
    ctx.beginPath();
    ctx.arc(px, py - 33 * k, 8 * k, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#373b3e';
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.arc(px, py - 33 * k, 7 * k, Math.PI, 2 * Math.PI);
    ctx.stroke();
    if (who.hat) {
      ctx.fillStyle = who.hat;
      ctx.fillRect(px - 10 * k, py - 40 * k, 20 * k, 4 * k);
    }
  }
  const enamel = ctx.createLinearGradient(0, y, 0, y + dh);
  enamel.addColorStop(0, '#5c646a');
  enamel.addColorStop(0.75, '#414950');
  enamel.addColorStop(1, '#343a40');
  ctx.fillStyle = enamel;
  ctx.fillRect(x, y, dw, dh);
  ctx.fillStyle = '#626a71';
  ctx.fillRect(x, y, dw, 10 * k);
  shadeRight(ctx, x, y, dw, dh, 0.08);
  ctx.fillStyle = 'rgba(220,228,215,.24)';
  ctx.fillRect(x + 1, y + 1, dw - 2, 1);
  ctx.fillStyle = '#262b30';
  ctx.fillRect(x, y + dh - 3 * k, dw, 3 * k);
  // Two screens, one line each, clipped to the glass so nothing spills off the console. Yours is a wide four-screen desk.
  const [a, b, tone] = duty ? stationReadout(duty, c) : controlReadout(c);
  const ink = tone === 'bad' ? '#d0634f' : tone === 'warn' ? '#e8c66a' : '#9fdc9a';
  const lastTrace = c && c.trace && c.trace.length ? c.trace[c.trace.length - 1] : null;
  const lines = yours
    ? [
        a,
        b,
        ...(c && c.flight && !['ascent', 'insertion'].includes(c.phase)
          ? [`PHASE ${Math.min(c.flight.phaseNo || 1, c.flight.phases || 99)}`, (c.flight.craft || '').toUpperCase()] // the climb's numbers are history
          : [
              lastTrace ? lastTrace.v.toFixed(2) + ' km/s' : '0.00 km/s',
              lastTrace ? (lastTrace.off >= 0 ? '+' : '') + lastTrace.off.toFixed(1) + '° OFF' : '0.0° OFF',
            ]),
      ]
    : [a, b];
  const screens = yours
    ? [
        [10 * k, lines[0]],
        [125 * k, lines[1]],
        [240 * k, lines[2]],
        [355 * k, lines[3]],
      ]
    : [
        [12 * k, lines[0]],
        [100 * k, lines[1]],
      ];
  for (const [off, text] of screens) {
    const sx = x + off,
      sy = y + 16 * k,
      sw = (yours ? 105 : 74) * k,
      sh = 30 * k;
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(sx - 2 * k, sy - 2 * k, sw + 4 * k, sh + 4 * k);
    const glass = ctx.createLinearGradient(0, sy, 0, sy + sh);
    glass.addColorStop(0, '#243139');
    glass.addColorStop(0.35, '#161e24');
    glass.addColorStop(1, '#10161a');
    ctx.fillStyle = glass;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = 'rgba(178,200,197,.14)';
    ctx.fillRect(sx + 2 * k, sy + 2 * k, sw - 4 * k, k);
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy, sw, sh);
    ctx.clip();
    ctx.fillStyle = ink;
    ctx.font = `${Math.max(8, Math.round(9 * k))}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(text, sx + 5 * k, sy + 19 * k);
    ctx.restore();
  }
  ctx.fillStyle = '#c9d2da';
  ctx.font = `${Math.max(7, Math.round(8 * k))}px sans-serif`;
  ctx.fillText(label, x + 10 * k, y + dh - 6 * k);
  if (yours) {
    // your mark: the gold chevron, like the one you wear on the site
    const px = x + dw / 2,
      py = y - 44 * k;
    ctx.fillStyle = '#e8c66a';
    ctx.beginPath();
    ctx.moveTo(px - 7 * k, py);
    ctx.lineTo(px + 7 * k, py);
    ctx.lineTo(px, py - 7 * k);
    ctx.fill();
    ctx.strokeStyle = '#e8c66a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 1, dw - 6, dh - 4);
  }
}

export function capsuleShape(ctx, x, y, tower) {
  ctx.fillStyle = '#1d1f22';
  ctx.beginPath();
  ctx.moveTo(x - 9, y);
  ctx.lineTo(x + 9, y);
  ctx.lineTo(x + 4, y - 14);
  ctx.lineTo(x - 4, y - 14);
  ctx.fill();
  ctx.fillRect(x - 3, y - 20, 6, 6);
  ctx.fillStyle = '#7a6a58';
  ctx.fillRect(x - 9, y, 18, 2);
  if (tower) {
    ctx.strokeStyle = '#c2352a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 20);
    ctx.lineTo(x, y - 40);
    ctx.lineTo(x + 3, y - 20);
    ctx.stroke();
    ctx.fillStyle = '#c2352a';
    ctx.fillRect(x - 1.5, y - 46, 3, 8);
  }
}
// Mercury-Redstone: the white Redstone with its stubby fins, the capsule and the escape tower. padAbort: after the four-inch
// flight, with the tower gone and the parachutes hanging off the capsule.
export function mercuryRedstoneShape(ctx, x, y, angle, padAbort = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#f1efe8';
  ctx.fillRect(-6, -84, 12, 84);
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.fillRect(-6, -84, 2.5, 84);
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillRect(3.5, -84, 2.5, 84); // cylinder shading
  ctx.fillStyle = '#1d1f22';
  ctx.fillRect(-6, -60, 12, 4);
  ctx.fillRect(-6, -20, 12, 3);
  ctx.fillStyle = '#d8d4c8';
  ctx.beginPath();
  ctx.moveTo(-6, -12);
  ctx.lineTo(-12, 0);
  ctx.lineTo(-6, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, -12);
  ctx.lineTo(12, 0);
  ctx.lineTo(6, 0);
  ctx.fill();
  ctx.fillStyle = '#c7c2b6';
  ctx.fillRect(-6, -90, 12, 6);
  capsuleShape(ctx, 0, -90, !padAbort);
  if (padAbort) {
    ctx.fillStyle = 'rgba(240,236,226,.9)';
    ctx.beginPath();
    ctx.ellipse(7, -96, 9, 12, 0.4, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(214,92,52,.9)';
    ctx.beginPath();
    ctx.ellipse(10, -84, 6, 14, 0.2, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

function trailer(ctx, x) {
  ctx.fillStyle = '#4d5b3a';
  ctx.fillRect(x - 10, GROUND - 22, 120, 6);
  ctx.fillStyle = '#1e1e1e';
  for (const wx of [x, x + 96]) {
    ctx.beginPath();
    ctx.arc(wx, GROUND - 6, 6, 0, 7);
    ctx.fill();
  }
}

// The Navy's Viking: long, slim and white, with small swept fins and a gimballed engine under the tail.
export function vikingShape(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#f1efe8';
  ctx.fillRect(-5, -100, 10, 100);
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.fillRect(-5, -100, 2, 100);
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillRect(3, -100, 2, 100); // cylinder shading
  ctx.fillStyle = '#f1efe8';
  ctx.beginPath();
  ctx.moveTo(-5, -100);
  ctx.quadraticCurveTo(-4, -112, 0, -118);
  ctx.quadraticCurveTo(4, -112, 5, -100);
  ctx.fill();
  ctx.fillStyle = '#2b3f6b';
  ctx.fillRect(-5, -60, 10, 3);
  ctx.fillRect(-5, -30, 10, 3);
  ctx.fillStyle = '#9aa0a8';
  ctx.beginPath();
  ctx.moveTo(-5, -14);
  ctx.lineTo(-13, 0);
  ctx.lineTo(-5, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5, -14);
  ctx.lineTo(13, 0);
  ctx.lineTo(5, 0);
  ctx.fill();
  ctx.restore();
}

// Juno II: the Jupiter, fat and white with black roll stripes, then JPL's tub of upper stages under a shroud and the small
// gold Pioneer cone.
export function junoShape(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#f2f0e9';
  ctx.fillRect(-12, -150, 24, 150);
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.fillRect(-12, -150, 4, 150);
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillRect(8, -150, 4, 150); // cylinder shading
  ctx.fillStyle = '#26272b';
  ctx.fillRect(-12, -40, 24, 6);
  ctx.fillRect(-12, -110, 24, 6);
  ctx.fillRect(-12, -150, 12, 20);
  ctx.fillStyle = '#d9d6cc';
  ctx.beginPath();
  ctx.moveTo(-12, -150);
  ctx.lineTo(-8, -200);
  ctx.lineTo(8, -200);
  ctx.lineTo(12, -150);
  ctx.fill();
  ctx.fillStyle = '#c9a24a';
  ctx.beginPath();
  ctx.moveTo(-5, -200);
  ctx.lineTo(0, -218);
  ctx.lineTo(5, -200);
  ctx.fill();
  ctx.restore();
}

// Atlas-Agena B with Ranger: the Atlas's steel balloon, its booster skirt, the slim Agena and the shroud over the Ranger.
// Lettering painted up a rocket's body, `along` units from the tail, in the shape's own frame (rotated by angle). It reads
// bottom to top when she stands; lying nose-left (on a truck, on hangar cradles) it is turned so it never reads upside down.
function bodyText(ctx, text, along, angle) {
  const flip = Math.cos(angle - Math.PI / 2) < -0.01;
  ctx.save();
  ctx.rotate(flip ? Math.PI / 2 : -Math.PI / 2);
  ctx.textBaseline = 'middle';
  ctx.fillText(text, flip ? -along : along, 0);
  ctx.restore();
}

export function atlasAgenaShape(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#c9ccd1';
  ctx.fillRect(-14, -170, 28, 170);
  ctx.fillStyle = '#b3b7bd';
  ctx.fillRect(-17, -36, 34, 36); // the booster section
  ctx.fillStyle = '#3e4652';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  bodyText(ctx, 'UNITED STATES', 100, angle);
  ctx.fillStyle = '#e8e6df';
  ctx.fillRect(-7, -232, 14, 62); // the Agena
  ctx.fillStyle = '#f2f0e9';
  ctx.beginPath();
  ctx.moveTo(-8, -232);
  ctx.lineTo(-8, -250);
  ctx.lineTo(0, -270);
  ctx.lineTo(8, -250);
  ctx.lineTo(8, -232);
  ctx.fill();
  ctx.restore();
}

// Mercury-Atlas: the Atlas D's silver balloon and booster skirt, an adapter, the capsule and its escape tower.
export function mercuryAtlasShape(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#c9ccd1';
  ctx.fillRect(-14, -170, 28, 170);
  ctx.fillStyle = '#b3b7bd';
  ctx.fillRect(-17, -36, 34, 36);
  ctx.fillStyle = '#3e4652';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  bodyText(ctx, 'UNITED STATES', 100, angle);
  ctx.fillStyle = '#d8d4c8';
  ctx.beginPath();
  ctx.moveTo(-14, -170);
  ctx.lineTo(-9, -180);
  ctx.lineTo(9, -180);
  ctx.lineTo(14, -170);
  ctx.fill();
  capsuleShape(ctx, 0, -180, true);
  ctx.restore();
}

// Gemini-Titan II: the Titan's two stages in white and black, the adapter, and the dark Gemini spacecraft on top. No
// escape tower: Gemini's crew had ejection seats.
export function geminiTitanShape(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#e9e7e0';
  ctx.fillRect(-15, -150, 30, 150); // first stage
  ctx.fillStyle = '#2b2d31';
  ctx.fillRect(-15, -150, 30, 8);
  ctx.fillRect(-15, -60, 30, 5);
  ctx.fillStyle = '#e9e7e0';
  ctx.fillRect(-15, -200, 30, 50); // second stage
  ctx.fillStyle = '#d9d6cc';
  ctx.beginPath();
  ctx.moveTo(-15, -200);
  ctx.lineTo(-12, -222);
  ctx.lineTo(12, -222);
  ctx.lineTo(15, -200);
  ctx.fill(); // adapter
  ctx.fillStyle = '#26282c';
  ctx.beginPath();
  ctx.moveTo(-12, -222);
  ctx.lineTo(-6, -246);
  ctx.lineTo(-4, -258);
  ctx.lineTo(4, -258);
  ctx.lineTo(6, -246);
  ctx.lineTo(12, -222);
  ctx.fill(); // spacecraft
  ctx.fillStyle = '#3e4652';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  bodyText(ctx, 'UNITED STATES', 90, angle);
  ctx.restore();
}

// The Shuttle stack: the external tank with two boosters strapped on, and the orbiter on her side at the top.
export function shuttleShape(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#b56b3c';
  ctx.fillRect(-11, -160, 22, 160); // the external tank
  ctx.fillStyle = 'rgba(0,0,0,.1)';
  ctx.fillRect(-11, -160, 6, 160);
  ctx.fillStyle = '#e8e4da';
  ctx.fillRect(-26, -150, 13, 150); // left booster
  ctx.fillRect(13, -150, 13, 150); // right booster
  ctx.fillStyle = '#26282c';
  ctx.fillRect(-26, -12, 13, 12);
  ctx.fillRect(13, -12, 13, 12);
  // The orbiter, nose up along the tank's side: wings and tail at the bottom, tiles where the belly shows.
  ctx.fillStyle = '#f2f0ea';
  ctx.beginPath();
  ctx.moveTo(-2, -190);
  ctx.lineTo(9, -160);
  ctx.lineTo(9, -108);
  ctx.lineTo(-14, -100);
  ctx.lineTo(-2, -190);
  ctx.fill();
  ctx.fillStyle = '#3e4652';
  ctx.fillRect(-14, -118, 10, 16); // the wing seen edge-on
  ctx.fillRect(-2, -196, 8, 10);
  ctx.fillStyle = '#26282c';
  ctx.fillRect(-2, -108, 6, 10); // engines
  ctx.fillStyle = '#3e4652';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  bodyText(ctx, 'UNITED STATES', 100, angle);
  ctx.restore();
}

// The Saturn V: three white stages with black roll bands, the lander's adapter, the command module and its escape tower.
// The late campaign's stacks share a paint treatment, with their own proportions and hardware.
function modernLauncher(ctx, x, y, angle, vehicle) {
  const sls = vehicle === 'sls';
  const half = sls ? 16 : 9;
  const core = sls ? 244 : 150;
  const upper = sls ? 310 : 205;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const tank = ctx.createLinearGradient(-half, 0, half, 0);
  tank.addColorStop(0, sls ? '#925438' : '#a7adb0');
  tank.addColorStop(0.35, sls ? '#d69960' : '#f1efe8');
  tank.addColorStop(1, sls ? '#a25a3c' : '#bcc0c0');
  ctx.fillStyle = tank;
  ctx.fillRect(-half, -core, half * 2, core - 8);
  ctx.fillStyle = '#272c30';
  ctx.fillRect(-half, -14, half * 2, 7);
  ctx.fillStyle = '#e7e5dd';
  ctx.fillRect(-half, -upper, half * 2, upper - core);
  ctx.fillStyle = '#4c5155';
  ctx.fillRect(-half, -core - 7, half * 2, 4);

  ctx.fillStyle = '#f0eee6';
  ctx.beginPath();
  ctx.moveTo(-half, -upper);
  ctx.lineTo(-half * 0.65, -upper - 12);
  ctx.quadraticCurveTo(0, -upper - 31, half * 0.65, -upper - 12);
  ctx.lineTo(half, -upper);
  ctx.fill();
  if (sls) {
    ctx.fillStyle = '#d1d3cf';
    ctx.fillRect(-2, -upper - 49, 4, 34);
    for (const bx of [-30, 17]) {
      ctx.fillStyle = '#e9e6dd';
      ctx.beginPath();
      ctx.moveTo(bx, -9);
      ctx.lineTo(bx, -157);
      ctx.lineTo(bx + 6.5, -174);
      ctx.lineTo(bx + 13, -157);
      ctx.lineTo(bx + 13, -9);
      ctx.fill();
      ctx.fillStyle = '#515554';
      for (let y = -22; y >= -142; y -= 30) ctx.fillRect(bx, y, 13, 2);
      ctx.fillRect(bx + 1, -10, 11, 6);
    }
  } else {
    ctx.fillStyle = '#303943';
    ctx.fillRect(-half, -upper - 2, half * 2, 2);
    ctx.fillRect(-4, -upper - 12, 8, 3);
    ctx.fillRect(-half - 2, -44, 2, 29);
    ctx.fillRect(half, -44, 2, 29);
  }
  ctx.restore();
}

export function saturnVShape(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#f1efe8';
  ctx.fillRect(-22, -150, 44, 150); // S-IC
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.fillRect(-22, -150, 6, 150);
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillRect(16, -150, 6, 150); // cylinder shading
  ctx.fillStyle = '#26282c';
  for (const yy of [-150, -100, -50]) ctx.fillRect(-22, yy, 22, 18);
  ctx.fillRect(0, -132, 22, 18);
  ctx.fillRect(0, -82, 22, 18);
  ctx.fillStyle = '#f1efe8';
  ctx.fillRect(-22, -250, 44, 100); // S-II
  ctx.fillStyle = '#26282c';
  ctx.fillRect(-22, -160, 44, 8);
  ctx.fillStyle = '#f1efe8';
  ctx.beginPath();
  ctx.moveTo(-22, -250);
  ctx.lineTo(-15, -262);
  ctx.lineTo(15, -262);
  ctx.lineTo(22, -250);
  ctx.fill();
  ctx.fillRect(-15, -312, 30, 50); // S-IVB
  ctx.fillStyle = '#26282c';
  ctx.fillRect(-15, -312, 30, 6);
  ctx.fillStyle = '#e6e3da';
  ctx.beginPath();
  ctx.moveTo(-15, -312);
  ctx.lineTo(-11, -340);
  ctx.lineTo(11, -340);
  ctx.lineTo(15, -312);
  ctx.fill(); // lander adapter
  ctx.fillStyle = '#c9ccd1';
  ctx.fillRect(-11, -356, 22, 16); // service module
  ctx.fillStyle = '#d8d6cf';
  ctx.beginPath();
  ctx.moveTo(-11, -356);
  ctx.lineTo(-3, -372);
  ctx.lineTo(3, -372);
  ctx.lineTo(11, -356);
  ctx.fill(); // command module
  ctx.strokeStyle = '#b33';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -372);
  ctx.lineTo(0, -398);
  ctx.stroke(); // escape tower
  ctx.fillStyle = '#3e4652';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  bodyText(ctx, 'USA', 200, angle);
  ctx.restore();
}

// Vanguard: slim and tall, white with a black band, three stages stacked, the small third stage under a pointed fairing.
export function vanguardShape(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#f3f1ea';
  ctx.fillRect(-6, -128, 12, 128); // first stage
  ctx.fillStyle = '#e7e4da';
  ctx.fillRect(-5, -178, 10, 50); // second stage
  ctx.fillStyle = '#26272b';
  ctx.fillRect(-6, -132, 12, 5);
  ctx.fillRect(-6, -60, 12, 4);
  ctx.fillStyle = '#c8c4b8';
  ctx.beginPath();
  ctx.moveTo(-5, -178);
  ctx.lineTo(-4, -196);
  ctx.lineTo(0, -210);
  ctx.lineTo(4, -196);
  ctx.lineTo(5, -178);
  ctx.fill();
  ctx.fillStyle = '#2b3f6b';
  ctx.font = 'bold 6px sans-serif';
  ctx.textAlign = 'center';
  bodyText(ctx, 'NAVY', 90, angle);
  ctx.restore();
}

// A captured V-2, black-and-white checked as at White Sands, drawn from its tail at (x, y) along angle (0 = straight up),
// with a WAC Corporal on its nose when it is a Bumper.
export function v2Shape(ctx, x, y, angle, withWac) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#ece8dc';
  ctx.fillRect(-7, -84, 14, 84);
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.fillRect(-7, -84, 3, 84);
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillRect(4, -84, 3, 84); // a lit nose-side edge
  ctx.fillStyle = '#1d1f24';
  ctx.fillRect(0, -84, 7, 21);
  ctx.fillRect(-7, -63, 7, 21);
  ctx.fillRect(0, -42, 7, 21);
  ctx.fillRect(-7, -21, 7, 21);
  ctx.fillStyle = '#ece8dc';
  ctx.beginPath();
  ctx.moveTo(-7, -84);
  ctx.quadraticCurveTo(-6, -98, 0, -104);
  ctx.quadraticCurveTo(6, -98, 7, -84);
  ctx.fill();
  ctx.fillStyle = '#1d1f24';
  ctx.beginPath();
  ctx.moveTo(-7, -20);
  ctx.lineTo(-16, 2);
  ctx.lineTo(-7, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(7, -20);
  ctx.lineTo(16, 2);
  ctx.lineTo(7, 2);
  ctx.fill();
  ctx.restore();
  if (withWac) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    wacShape(ctx, 0, -100, 0, false);
    ctx.restore();
  }
}

// The hangar stands under a round lying nose-left with its tail at x: a post with a saddle under the body, and one
// more under the booster once it is mated. Every post stands under the round, none out past its tail.
function cradle(ctx, x, mated) {
  ctx.fillStyle = '#6a5a44';
  for (const at of mated ? [x - 14, x - 46, x - 76] : [x - 18, x - 48]) {
    ctx.fillRect(at - 2, GROUND - 21, 4, 21);
    ctx.fillRect(at - 6, GROUND - 23, 12, 3);
  }
}

// WAC Corporal upper stage (and the Tiny Tim booster under it when mated), drawn from its tail at (x, y), pointing along angle
// (0 = straight up). Widths are exaggerated so the round reads at this scale.
export function wacShape(ctx, x, y, angle, withBooster) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  let base = 0;
  if (withBooster) {
    boosterShape(ctx, 0, 0, 0, true);
    base = -26;
  }
  ctx.fillStyle = '#e9e4d6';
  ctx.fillRect(-3.5, base - 48, 7, 48);
  ctx.fillStyle = '#c03a2b';
  ctx.beginPath();
  ctx.moveTo(-3.5, base - 48);
  ctx.lineTo(0, base - 60);
  ctx.lineTo(3.5, base - 48);
  ctx.fill();
  ctx.fillStyle = '#20232a';
  ctx.fillRect(-3.5, base - 30, 7, 2);
  ctx.fillStyle = '#9aa0a8';
  ctx.beginPath();
  ctx.moveTo(-3.5, base - 8);
  ctx.lineTo(-9, base);
  ctx.lineTo(-3.5, base);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(3.5, base - 8);
  ctx.lineTo(9, base);
  ctx.lineTo(3.5, base);
  ctx.fill();
  ctx.restore();
}

function boosterShape(ctx, x, y, angle, attached) {
  ctx.save();
  ctx.translate(x, y);
  if (!attached) ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#5d6168';
  ctx.fillRect(-5, -26, 10, 26);
  ctx.fillStyle = '#3c3f44';
  ctx.beginPath();
  ctx.moveTo(-5, -10);
  ctx.lineTo(-12, 0);
  ctx.lineTo(-5, 0);
  ctx.moveTo(5, -10);
  ctx.lineTo(12, 0);
  ctx.lineTo(5, 0);
  ctx.fill();
  ctx.restore();
}

export function flame(ctx, x, y, power, angle, time, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle - Math.PI / 2);
  const len = (26 + 8 * Math.sin(time * 40)) * power * scale;
  const grad = ctx.createLinearGradient(0, 0, 0, len);
  grad.addColorStop(0, 'rgba(255,250,220,.95)');
  grad.addColorStop(0.4, 'rgba(255,170,60,.85)');
  grad.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-4 * scale, 0);
  ctx.lineTo(0, len);
  ctx.lineTo(4 * scale, 0);
  ctx.fill();
  ctx.restore();
}

function jobBar(ctx, job) {
  if (!job.minutes) return;
  ctx.font = '9px Georgia, serif';
  const width = Math.max(60, Math.ceil(ctx.measureText(job.label).width)),
    x = job.at - width / 2,
    y = GROUND - 120,
    done = 1 - job.left / job.minutes;
  ctx.fillStyle = 'rgba(15,18,24,.8)';
  ctx.fillRect(x - 4, y - 16, width + 8, 26);
  ctx.fillStyle = '#f1e6c8';
  ctx.textAlign = 'left';
  ctx.fillText(job.label, x, y - 5);
  ctx.fillStyle = '#444';
  ctx.fillRect(x, y, width, 4);
  ctx.fillStyle = '#e8c66a';
  ctx.fillRect(x, y, width * done, 4);
}

// A person: a small figure with legs that move while walking. The player wears a light shirt and is marked.
function person(ctx, p, time) {
  const x = p.x,
    y = GROUND,
    walking = Math.abs(p.target - p.x) > 1,
    step = walking ? Math.sin(time * 12 + p.x * 0.05) * 4 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 6, 2, 0, 0, 7);
  ctx.fill(); // a shadow grounds the figure
  ctx.strokeStyle = '#2b2620';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x - step, y);
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x + step, y);
  ctx.stroke();
  ctx.fillStyle = p.color;
  ctx.fillRect(x - 4, y - 26, 8, 15);
  ctx.fillStyle = '#e2b993';
  ctx.beginPath();
  ctx.arc(x, y - 30, 4, 0, 7);
  ctx.fill();
  if (p.hat) {
    ctx.fillStyle = p.hat;
    ctx.fillRect(x - 5, y - 35, 10, 3);
  }
  if (p.working && !walking) {
    ctx.fillStyle = Math.sin(time * 20) > 0 ? '#ffe28a' : '#fff';
    ctx.fillRect(x + 6 * p.face, y - 20 + Math.sin(time * 9) * 3, 2, 2);
  }
  if (p.id === 'you') {
    ctx.fillStyle = '#e8c66a';
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 44);
    ctx.lineTo(x + 4, y - 44);
    ctx.lineTo(x, y - 39);
    ctx.fill();
  }
}

// A speech bubble above (x, y). tone: '' | 'go' | 'warn' | 'bad'.
export function bubble(ctx, x, y, text, tone = '') {
  ctx.font = '12px Georgia, serif';
  const lines = wrap(ctx, text, 190),
    lh = 15,
    bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16,
    bh = lines.length * lh + 10;
  const bx = x - bw / 2,
    by = y - bh - 8;
  ctx.fillStyle = tone === 'bad' ? '#f6d2cc' : tone === 'warn' ? '#f8e7b8' : tone === 'go' ? '#dcefd8' : '#fbf7ec';
  ctx.strokeStyle = '#2b2620';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 6);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 5, by + bh);
  ctx.lineTo(x, by + bh + 8);
  ctx.lineTo(x + 5, by + bh);
  ctx.fill();
  ctx.fillStyle = '#1d1a16';
  ctx.textAlign = 'left';
  lines.forEach((l, i) => ctx.fillText(l, bx + 8, by + 16 + i * lh));
}

export function wrap(ctx, text, width) {
  const words = text.split(' '),
    lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > width && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  lines.push(line);
  return lines;
}

// A round grid step, 1, 2 or 5 times a power of ten, for about eight lines across `span`.
function niceStep(span) {
  const raw = span / 8,
    p = 10 ** Math.floor(Math.log10(raw)),
    m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

// THE TRACKING BOARD: the range's plot of height against distance downrange, drawn as the flight goes.
export function drawTracking(ctx, g, view) {
  const { w, h } = view,
    f = g.flight,
    path = f.result.path,
    upto = Math.min(path.length - 1, Math.floor(f.t));
  const phosphor = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  phosphor.addColorStop(0, '#152a20');
  phosphor.addColorStop(1, '#09130f');
  ctx.fillStyle = phosphor;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#111914';
  ctx.fillRect(0, 0, w, 12);
  ctx.fillRect(0, h - 12, w, 12);
  ctx.fillRect(0, 12, 12, h - 24);
  ctx.fillRect(w - 12, 12, 12, h - 24);
  ctx.strokeStyle = '#394439';
  ctx.lineWidth = 1;
  ctx.strokeRect(12.5, 12.5, w - 25, h - 25);
  ctx.fillStyle = '#525a4b';
  for (const x of [6, w - 7]) {
    ctx.fillRect(x, 5, 1, 3);
    ctx.fillRect(x, h - 8, 1, 3);
  }
  // The plot's scale grows with the round: a WAC peaks near 70 km, a V-2 over 150, a Bumper several hundred.
  const deep = !!f.result.deep,
    // The earlier rounds of this vehicle, faint behind this one: what the range has seen her kind do before.
    before = deep || f.result.orbit ? [] : earlierTracks(g.programme, g.vehicle),
    beforeTop = Math.max(0, ...before.flatMap(b => b.trace.map(q => q[1]))),
    beforeRange = Math.max(0, ...before.flatMap(b => b.trace.map(q => q[0]))),
    top = Math.max(80, deep ? 0 : g.round.estimate.high * 1.15, f.result.apogee * 1.1, beforeTop * 1.1),
    hStep = niceStep(top);
  const range = Math.max(f.result.range, beforeRange),
    maxH = Math.ceil(top / hStep) * hStep,
    xStep = range <= 40 ? 5 : range <= 120 ? 10 : niceStep(range * 1.1);
  const pad = 70,
    maxX = Math.max(30, Math.ceil(range / xStep) * xStep + xStep);
  const px = x => pad + (x / maxX) * (w - pad * 2),
    py = km => h - pad - (km / maxH) * (h - pad * 2);
  ctx.strokeStyle = '#1f3b2d';
  ctx.lineWidth = 1;
  ctx.font = '12px monospace';
  ctx.fillStyle = '#5fae7f';
  ctx.textAlign = 'right';
  for (let k = 0; k <= maxH; k += hStep) {
    ctx.beginPath();
    ctx.moveTo(pad, py(k));
    ctx.lineTo(w - pad, py(k));
    ctx.stroke();
    ctx.fillText(k >= 10000 ? `${k / 1000}k km` : `${k} km`, pad - 8, py(k) + 4);
  }
  ctx.textAlign = 'center';
  for (let k = 0; k <= maxX; k += xStep) {
    ctx.beginPath();
    ctx.moveTo(px(k), py(0));
    ctx.lineTo(px(k), py(maxH));
    ctx.stroke();
    ctx.fillText(`${k}`, px(k), h - pad + 18);
  }
  ctx.fillText('km downrange', w / 2, h - pad + 36);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8fd6a8';
  ctx.font = '14px monospace';
  ctx.fillText(`${SITES[g.site || 'white-sands'].plot} · RANGE PLOT · ${KITS[g.vehicle].range}`, pad, 32);
  // The drawing office's estimate, faint (a lunar shot has none: she goes off the top of the board).
  if (!deep) {
    ctx.strokeStyle = 'rgba(232,198,106,.35)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(px(0), py(g.round.estimate.low));
    ctx.lineTo(w - pad, py(g.round.estimate.low));
    ctx.moveTo(px(0), py(g.round.estimate.high));
    ctx.lineTo(w - pad, py(g.round.estimate.high));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(232,198,106,.6)';
    ctx.fillText('drawing-office estimate', w - pad - 190, py(g.round.estimate.high) - 6);
  }
  // Earlier rounds: a dim track each, labelled where it came down with what the range wrote of it.
  ctx.font = '11px monospace';
  before.forEach((b, n) => {
    ctx.strokeStyle = 'rgba(143,214,168,.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    b.trace.forEach(([x, hh], i) => (i ? ctx.lineTo(px(x), py(hh)) : ctx.moveTo(px(x), py(hh))));
    ctx.stroke();
    const peak = b.trace.reduce((a, q) => (q[1] > a[1] ? q : a), b.trace[0]);
    ctx.fillStyle = 'rgba(143,214,168,.5)';
    ctx.fillText(
      `${before.length - n === 1 ? 'last round' : `${before.length - n} rounds back`}: ${b.failure ? `lost at ${b.failAt} s` : `${Math.round(b.apogee ?? peak[1])} km`}`,
      px(peak[0]) + 6,
      py(peak[1]) - 4 - 12 * n,
    );
  });
  ctx.beginPath();
  for (let i = 0; i <= upto; i++) {
    const p = path[i];
    i ? ctx.lineTo(px(p.x), py(p.h)) : ctx.moveTo(px(p.x), py(p.h));
  }
  ctx.strokeStyle = 'rgba(108,220,153,.15)';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = '#9ff0b8';
  ctx.lineWidth = 2;
  ctx.stroke();
  const p = path[upto];
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px(p.x), py(p.h), 4, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#8fd6a8';
  ctx.font = '16px monospace';
  ctx.fillText(
    `T+${String(Math.floor(f.t)).padStart(3, '0')} s   ALT ${p.h.toFixed(1)} km   RANGE ${p.x.toFixed(1)} km`,
    pad,
    58,
  );
  // The loop: the latest calls, as bubbles along the bottom.
  const calls = f.calls.slice(-3);
  calls.forEach((c, i) => bubble(ctx, pad + 130 + i * 260, h - 96, `${c.who}: ${c.text}`, c.tone));
}
