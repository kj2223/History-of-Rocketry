// DRAWING: the site side-on, and the range's tracking board during a flight. Reads the game, never changes it.
// World units: 1 unit is about a third of a foot (the launch tower is 102 ft, 300 units). The ground is at y = GROUND.
import { VIEW_H, GROUND, WORLD_W, PLACES } from '../data/white-sands.js';
export { VIEW_H, GROUND, WORLD_W, PLACES };

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
  // The Organ Mountains, far off, moving slowly behind the site.
  mountains(ctx, camX * 0.15, vw, '#8d86a0', 380, [0, 60, 30, 120, 70, 150, 40, 90, 20]);
  mountains(ctx, camX * 0.3, vw, '#a99a8c', 440, [10, 40, 25, 60, 15, 50, 35, 20, 45]);
  ctx.fillStyle = '#d9c39a'; ctx.fillRect(0, GROUND, vw, VIEW_H - GROUND);
  ctx.fillStyle = '#cdb489'; ctx.fillRect(0, GROUND, vw, 5);

  ctx.translate(-camX, 0);
  // Scrub along the desert floor.
  ctx.fillStyle = '#9c9c62';
  for (let x = 40; x < WORLD_W + 400; x += 97) { const y = GROUND + 12 + ((x * 7) % 50); ctx.fillRect(x, y, 6, 3); ctx.fillRect(x + 2, y - 3, 2, 3); }
  // The road out to the range.
  ctx.fillStyle = '#c3a87c'; ctx.fillRect(0, GROUND + 30, WORLD_W + 400, 8);

  office(ctx, PLACES.office, g);
  hangar(ctx, PLACES.hangar, g);
  stand(ctx, PLACES.stand, g);
  dugout(ctx, PLACES.dugout);
  blockhouse(ctx, PLACES.blockhouse);
  tower(ctx, PLACES.tower);
  truck(ctx, g.truck.x, g);
  rocketOnSite(ctx, g);
  for (const job of g.jobs) jobBar(ctx, job);
  for (const p of Object.values(g.people)) if (!p.hidden) person(ctx, p, g.time);
  for (const p of Object.values(g.people)) if (!p.hidden && p.bubble) bubble(ctx, p.x, GROUND - 44, p.bubble.text, p.bubble.tone);
  if (g.marker != null) { ctx.fillStyle = 'rgba(255,240,180,.8)'; ctx.fillRect(g.marker - 3, GROUND + 2, 6, 3); }
  // Building names on hover.
  if (g.hover) label(ctx, g.hover);
  ctx.restore();
  // Night falls as a fade.
  if (g.fade > 0) { ctx.fillStyle = `rgba(5,8,14,${g.fade})`; ctx.fillRect(0, 0, w, h); }
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

function office(ctx, p) {
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
  if (!g.rocket.mated && g.rocket.where !== 'gone') boosterShape(ctx, p.x + p.w - 90, GROUND - 14, 0);
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

function dugout(ctx, p) {
  ctx.fillStyle = '#9b8a70'; ctx.beginPath(); ctx.moveTo(p.x - 20, GROUND); ctx.quadraticCurveTo(p.x + p.w / 2, GROUND - p.h * 2, p.x + p.w + 20, GROUND); ctx.fill();
  ctx.fillStyle = '#2b2a28'; ctx.fillRect(p.x + 14, GROUND - 20, 22, 6); ctx.fillRect(p.x + 52, GROUND - 20, 22, 6);
  ctx.fillStyle = '#4b3b2b'; ctx.fillRect(p.x + 36, GROUND - 26, 16, 26);
}

function blockhouse(ctx, p) {
  ctx.fillStyle = '#a7a196'; ctx.fillRect(p.x, GROUND - p.h, p.w, p.h);
  ctx.fillStyle = '#918b80'; ctx.fillRect(p.x - 10, GROUND - p.h - 12, p.w + 20, 14);
  // Cutaway with the firing panel and periscope.
  ctx.fillStyle = '#4c4f46'; ctx.fillRect(p.x + 14, GROUND - p.h + 16, p.w - 28, p.h - 16);
  ctx.fillStyle = '#2f3a2c'; ctx.fillRect(p.x + 30, GROUND - 34, 80, 22);
  ctx.fillStyle = '#c94'; for (let i = 0; i < 6; i++) ctx.fillRect(p.x + 36 + i * 12, GROUND - 30, 5, 5);
  ctx.fillStyle = '#6c6'; ctx.fillRect(p.x + 36, GROUND - 22, 5, 5);
  ctx.fillStyle = '#555'; ctx.fillRect(p.x + 140, GROUND - p.h - 26, 6, 26); ctx.fillRect(p.x + 140, GROUND - p.h - 26, 14, 5);
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
  ctx.fillStyle = '#e8e0c8'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('U.S. ARMY', x + 8, y - 16);
  if (g.truck.dust) { ctx.fillStyle = 'rgba(210,190,150,.5)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x - 8 - i * 12, y - 8 - i * 3, 6 + i * 3, 0, 7); ctx.fill(); } }
}

// The rocket wherever it is on the site: in pieces in the hangar, carried, on the stand, on the truck, in the tower.
function rocketOnSite(ctx, g) {
  const r = g.rocket;
  if (r.where === 'hangar') { wacShape(ctx, PLACES.hangar.x + 160, GROUND - 26, -Math.PI / 2, r.mated); cradle(ctx, PLACES.hangar.x + 160, r.mated); }
  else if (r.where === 'carried') wacShape(ctx, r.x - 24, GROUND - 22, -Math.PI / 2, false);
  else if (r.where === 'stand') wacShape(ctx, PLACES.stand.x + 60, GROUND - 40, 0, false);
  else if (r.where === 'truck') { wacShape(ctx, g.truck.x + 2, GROUND - 10, -Math.PI / 2, true); }
  else if (r.where === 'tower') wacShape(ctx, PLACES.tower.x + 25, GROUND - 8, 0, true);
  else if (r.where === 'flying') {
    wacShape(ctx, PLACES.tower.x + 25, GROUND - 8 - r.rise, 0, r.rise < 40);
    flame(ctx, PLACES.tower.x + 25, GROUND - 8 - r.rise, 1, Math.PI / 2, g.time, 1.6);
    ctx.fillStyle = 'rgba(235,230,220,.6)';
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(PLACES.tower.x + 25 + (i - 4) * 12, GROUND - 6 - (i % 3) * 6, 10 + i, 0, 7); ctx.fill(); }
  }
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

// THE TRACKING BOARD: the range's plot of height against distance downrange, drawn as the flight goes.
export function drawTracking(ctx, g, view) {
  const { w, h } = view, f = g.flight, path = f.result.path, upto = Math.min(path.length - 1, Math.floor(f.t));
  ctx.fillStyle = '#0d1a14'; ctx.fillRect(0, 0, w, h);
  const pad = 70, maxH = 80, maxX = Math.max(30, Math.ceil(f.result.range / 5) * 5 + 5);
  const px = x => pad + (x / maxX) * (w - pad * 2), py = km => h - pad - (km / maxH) * (h - pad * 2);
  ctx.strokeStyle = '#1f3b2d'; ctx.lineWidth = 1; ctx.font = '12px monospace'; ctx.fillStyle = '#5fae7f'; ctx.textAlign = 'right';
  for (let k = 0; k <= maxH; k += 10) { ctx.beginPath(); ctx.moveTo(pad, py(k)); ctx.lineTo(w - pad, py(k)); ctx.stroke(); ctx.fillText(`${k} km`, pad - 8, py(k) + 4); }
  ctx.textAlign = 'center';
  for (let k = 0; k <= maxX; k += 5) { ctx.beginPath(); ctx.moveTo(px(k), py(0)); ctx.lineTo(px(k), py(maxH)); ctx.stroke(); ctx.fillText(`${k}`, px(k), h - pad + 18); }
  ctx.fillText('km downrange', w / 2, h - pad + 36);
  ctx.textAlign = 'left'; ctx.fillStyle = '#8fd6a8'; ctx.font = '14px monospace';
  ctx.fillText('WHITE SANDS PROVING GROUND · RANGE PLOT · WAC CORPORAL', pad, 32);
  // The drawing office's estimate, faint.
  ctx.strokeStyle = 'rgba(232,198,106,.35)'; ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(px(0), py(g.round.estimate.low)); ctx.lineTo(w - pad, py(g.round.estimate.low)); ctx.moveTo(px(0), py(g.round.estimate.high)); ctx.lineTo(w - pad, py(g.round.estimate.high)); ctx.stroke();
  ctx.setLineDash([]); ctx.fillStyle = 'rgba(232,198,106,.6)'; ctx.fillText('drawing-office estimate', w - pad - 190, py(g.round.estimate.high) - 6);
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
