// WALK-IN INTERIORS: going into the blockhouse, the assembly hangar or the test stand dugout leaves the site for a scene of
// the room itself, the way Mercury Control does. The room's panel (rooms.js) stays docked on the right with the same
// buttons; the scene shows what the room shows: the pad through the periscope, the gauges on the wall, the round on its
// cradles with the spots to look at. Only what the player could see: the gauges read what the room's gauges read.
//
// Each scene is drawn in a 1200 × 760 design box, scaled to fit the canvas left of the panel; the walls and floor run on
// full-bleed behind the panel. Clickable parts of a scene are collected in `hits`, in canvas pixels, for interiorButtonAt.
import {
  skyFor,
  shadeRight,
  standStructure,
  tower,
  roundShape,
  padPicture,
  bubble,
  monitorScreen,
  consoleDesk,
  capsuleShape,
  flame,
  wrap,
  PLACES,
  GROUND,
} from './draw.js';
import { g as game, kit, conducting, countTank, standTank, NORMAL_TANK, placeName, dateText } from '../game.js';
import { capsuleSpots, programOf } from '../mercury.js';
import { inspectFlags } from '../scenes/rooms.js';
import { blockhouseState, SITES } from '../data/campaign.js';
import { KITS } from '../data/kits.js';

const DW = 1200,
  DH = 760,
  FLOOR = 610;
let hits = [];
const whiteSandsBackdrop = typeof Image === 'undefined' ? null : new Image();
if (whiteSandsBackdrop) whiteSandsBackdrop.src = new URL('./white-sands-hangar.svg', import.meta.url).href;

// Which interior a room is drawn in, if any. The uncrewed blockhouse and dugout; the hangar in every era (Hangar S and
// the Saturn's checkout in the crewed years); the simulator in the old training building at the Cape.
export function interiorOf(g) {
  if (!g.room || (g.flight && g.flight.view === 'board')) return null;
  const [kind, building] = g.room.split(':');
  if (!g.crewed) {
    if (kind === 'count' || (kind === 'watch' && building === 'blockhouse')) return 'blockhouse';
    if (kind === 'static' || (kind === 'watch' && building === 'dugout')) return 'dugout';
    if (kind === 'inspect' || (kind === 'watch' && building === 'hangar')) return 'hangar';
    return null;
  }
  if (kind === 'checkout' || (kind === 'watch' && building === 'hangar')) return 'hangar';
  if (kind === 'sim') return 'sim';
  return null;
}

export function interiorButtonAt(g, x, y) {
  if (!interiorOf(g)) return null;
  for (const b of hits) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  return null;
}

// reserve: the canvas pixels on the right that the room's panel covers.
export function drawInterior(ctx, g, view, reserve = 0) {
  const which = interiorOf(g);
  const { w, h } = view;
  hits = [];
  const room = Math.max(w * 0.55, w - reserve);
  const k = Math.min(room / DW, h / DH),
    ox = (room - DW * k) / 2,
    oy = (h - DH * k) / 2;
  const toCanvas = (x, y, bw, bh) => ({ x: ox + x * k, y: oy + y * k, w: bw * k, h: bh * k });
  const scene = { w, h, k, ox, oy, hit: (act, id, x, y, bw, bh) => hits.push({ act, id, ...toCanvas(x, y, bw, bh) }) };
  ctx.save();
  ({ blockhouse: drawBlockhouse, dugout: drawDugout, hangar: drawHangar, sim: drawSim })[which](ctx, g, scene);
  ctx.restore();
  // The way out, drawn on the left wall in canvas pixels so it is always in the same place.
  doorSign(ctx, scene);
  if (g.fade > 0) {
    ctx.fillStyle = `rgba(5,8,14,${g.fade})`;
    ctx.fillRect(0, 0, w, h);
  }
}

// ---- Shared pieces ----------------------------------------------------------------------------------------------

// Fills the canvas edge to edge, wall over floor, then moves into the design box.
function room(ctx, s, wall, floor) {
  const floorY = s.oy + FLOOR * s.k;
  const wallLight = ctx.createLinearGradient(0, 0, 0, floorY);
  wallLight.addColorStop(0, '#292a29');
  wallLight.addColorStop(0.28, wall);
  wallLight.addColorStop(0.84, wall);
  wallLight.addColorStop(1, '#38352e');
  ctx.fillStyle = wallLight;
  ctx.fillRect(0, 0, s.w, floorY);
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, s.w, s.h - floorY);
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(0, floorY - 8 * s.k, s.w, 8 * s.k);
  ctx.fillStyle = 'rgba(247,225,181,.16)';
  ctx.fillRect(0, floorY - 8 * s.k, s.w, s.k);
  ctx.strokeStyle = 'rgba(14,12,10,.18)';
  ctx.lineWidth = Math.max(1, s.k);
  ctx.beginPath();
  for (let i = -4; i <= 12; i++) {
    const x = (i * s.w) / 8;
    ctx.moveTo((x + s.w / 2) / 2, floorY);
    ctx.lineTo(x, s.h);
  }
  ctx.stroke();
  ctx.translate(s.ox, s.oy);
  ctx.scale(s.k, s.k);
}

function doorSign(ctx, s) {
  const bw = 150 * s.k,
    bh = 34 * s.k,
    x = 10,
    y = s.h - bh - 46;
  ctx.fillStyle = 'rgba(15,18,24,.85)';
  ctx.strokeStyle = '#e8c66a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f1e6c8';
  ctx.font = `${Math.max(11, Math.round(14 * s.k))}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText('◂ Out to the site', x + bw / 2, y + bh * 0.65);
  ctx.textAlign = 'left';
  hits.push({ act: 'leave', x, y, w: bw, h: bh });
}

// A round dial with its normal band in green and a needle, as on the panels.
function dial(ctx, cx, cy, r, value, min, max, band, label, unit) {
  const a = v => Math.PI * (0.75 + (1.5 * (Math.max(min, Math.min(max, v)) - min)) / (max - min));
  ctx.fillStyle = '#2a2d31';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 7, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#f1ead6';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 7);
  ctx.fill();
  if (band) {
    ctx.strokeStyle = 'rgba(80,170,95,.7)';
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.8, a(band[0]), a(band[1]));
    ctx.stroke();
  }
  ctx.strokeStyle = '#3a3f46';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 10; i++) {
    const t = a(min + ((max - min) * i) / 10);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(t) * r * 0.88, cy + Math.sin(t) * r * 0.88);
    ctx.lineTo(cx + Math.cos(t) * r * (i % 5 ? 0.97 : 1), cy + Math.sin(t) * r * (i % 5 ? 0.97 : 1));
    ctx.stroke();
  }
  const t = a(value);
  ctx.strokeStyle = '#a3321f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(t) * r * 0.82, cy + Math.sin(t) * r * 0.82);
  ctx.stroke();
  ctx.fillStyle = '#2b2620';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#2b2620';
  ctx.font = `bold ${Math.round(r * 0.26)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(value.toFixed(1), cx, cy + r * 0.52);
  ctx.fillStyle = '#d8d2c0';
  ctx.font = `${Math.round(Math.max(11, r * 0.2))}px Georgia, serif`;
  ctx.fillText(`${label} (${unit})`, cx, cy + r + 24);
  ctx.textAlign = 'left';
}

// A lit or dark lamp with its legend under it.
function lamp(ctx, x, y, r, on, color, text) {
  if (on) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
  } else ctx.fillStyle = '#3a3a36';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#1b1c1e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#d8d2c0';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y + r + 15);
  ctx.textAlign = 'left';
}

// A big clock board: the count in red, with a word under it.
function clockBoard(ctx, x, y, w, h, text, word, title) {
  ctx.fillStyle = '#1b1c1e';
  ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
  ctx.fillStyle = '#120c0a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ff8a5a';
  ctx.shadowColor = '#ff6a3a';
  ctx.shadowBlur = 10;
  ctx.font = `bold ${Math.round(h * 0.48)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, y + h * 0.58);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8c66a';
  ctx.font = `${Math.round(h * 0.13)}px monospace`;
  ctx.fillText(word, x + w / 2, y + h * 0.86);
  if (title) {
    ctx.fillStyle = '#d8d2c0';
    ctx.font = '12px Georgia, serif';
    ctx.fillText(title, x + w / 2, y - 14);
  }
  ctx.textAlign = 'left';
}

// A person seen from behind, sitting at a desk facing the wall: chair back, shoulders, the back of the head. Yours wears
// the gold chevron, as on the site.
function seatedBack(ctx, x, y, p, t) {
  ctx.fillStyle = '#3b352d';
  ctx.fillRect(x - 30, y + 30, 60, 70); // the chair back
  ctx.fillStyle = '#2a251f';
  ctx.fillRect(x - 4, y + 100, 8, FLOOR - y - 100);
  ctx.fillRect(x - 26, FLOOR - 6, 52, 6);
  if (!p) return;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.roundRect(x - 34, y, 68, 62, 12);
  ctx.fill();
  ctx.fillStyle = '#e2b993';
  ctx.fillRect(x - 7, y - 10, 14, 12);
  ctx.fillStyle = p.id === 'ellis' ? '#6b4a32' : '#3a2c22';
  ctx.beginPath();
  ctx.arc(x, y - 26, 22, 0, 7);
  ctx.fill();
  if (p.hat) {
    ctx.fillStyle = p.hat;
    ctx.beginPath();
    ctx.ellipse(x, y - 40, 24, 9, 0, 0, 7);
    ctx.fill();
  }
  if (p.id === 'you') youMark(ctx, x, y - 64);
  if (p.working) {
    ctx.fillStyle = Math.sin(t * 20) > 0 ? '#ffe28a' : '#fff';
    ctx.fillRect(x + 30, y - 10 + Math.sin(t * 9) * 4, 4, 4);
  }
}

// A person standing, front on, at the room's scale.
function standing(ctx, x, p, t, s = 3) {
  const y = FLOOR + 40,
    walking = Math.abs(p.target - p.x) > 1,
    step = walking ? Math.sin(t * 12 + p.x) * 4 * s : 0;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 7 * s, 2 * s, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#2b2620';
  ctx.lineWidth = 2.6 * s;
  ctx.beginPath();
  ctx.moveTo(x, y - 12 * s);
  ctx.lineTo(x - 2 * s - step, y);
  ctx.moveTo(x, y - 12 * s);
  ctx.lineTo(x + 2 * s + step, y);
  ctx.stroke();
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.roundRect(x - 5 * s, y - 27 * s, 10 * s, 16 * s, 2 * s);
  ctx.fill();
  ctx.fillStyle = '#e2b993';
  ctx.beginPath();
  ctx.arc(x, y - 31 * s, 4.4 * s, 0, 7);
  ctx.fill();
  if (p.hat) {
    ctx.fillStyle = p.hat;
    ctx.fillRect(x - 5.5 * s, y - 36.5 * s, 11 * s, 3 * s);
  }
  if (p.working && !walking) {
    ctx.fillStyle = Math.sin(t * 20) > 0 ? '#ffe28a' : '#fff';
    ctx.fillRect(x + 7 * s * (p.face || 1), y - 20 * s + Math.sin(t * 9) * 3 * s, 2 * s, 2 * s);
  }
  if (p.id === 'you') youMark(ctx, x, y - 44 * s);
  return y - 40 * s;
}

function youMark(ctx, x, y) {
  ctx.fillStyle = '#e8c66a';
  ctx.beginPath();
  ctx.moveTo(x - 9, y);
  ctx.lineTo(x + 9, y);
  ctx.lineTo(x, y + 9);
  ctx.fill();
}

// Who is in a building: the people standing within reach of its door, as the watch panel counts them.
function inside(g, id, reach) {
  const place = PLACES[id];
  return Object.values(g.people).filter(p => !p.hidden && Math.abs(p.x - place.door) < (reach ?? place.w / 2 + 60));
}

// Speech bubbles for everyone in the room who is talking, at the head positions given.
function bubbles(ctx, heads) {
  for (const [p, x, y] of heads)
    if (p && p.bubble) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1.35, 1.35);
      bubble(ctx, 0, 0, p.bubble.text, p.bubble.tone);
      ctx.restore();
    }
}

// A picture of a place on the site, as seen from a window, slit or periscope: sky in the day's light, the far ground,
// and whatever `paint` draws there in world units, centred on world x `cx` with `span` world units of height in view.
function sitePicture(ctx, g, x, y, w, h, cx, groundAt, span, paint) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const sky = skyFor(g.clock % 1440),
    grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, sky[0]);
  grad.addColorStop(1, sky[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  const k = h / span;
  ctx.translate(x + w / 2 - cx * k, y + h * groundAt - GROUND * k);
  ctx.scale(k, k);
  if (g.site === 'cape') {
    ctx.fillStyle = '#3f6f8f';
    ctx.fillRect(cx - 3000, GROUND - 60, 6000, 30);
    ctx.fillStyle = '#5b7a3c';
    ctx.fillRect(cx - 3000, GROUND - 30, 6000, 30);
  } else {
    ctx.fillStyle = '#a99a8c';
    ctx.beginPath();
    ctx.moveTo(cx - 3000, GROUND);
    for (let i = -30; i <= 30; i++) ctx.lineTo(cx + i * 100, GROUND - 30 - (((i * 37) % 5) + 5) * 6);
    ctx.lineTo(cx + 3000, GROUND);
    ctx.fill();
  }
  ctx.fillStyle = g.site === 'cape' ? '#e4d8b4' : '#d9c39a';
  ctx.fillRect(cx - 3000, GROUND, 6000, 400);
  paint(ctx);
  ctx.restore();
}

// ---- The blockhouse: the count -----------------------------------------------------------------------------------
// The old blockhouse at White Sands (1945-51) is a low concrete box with one periscope and a bare bulb. The new one from
// the spring of 1951, and the Cape's, have two periscopes, strip lights and the telemetry recorders along the wall.
const COUNT_STATIONS = [
  { id: 'range', label: 'RANGE' },
  { id: 'press', label: 'PRESS' },
  { id: 'tc', label: 'TEST CONDUCTOR' },
  { id: 'pad', label: 'PAD · FIRING' },
];

function drawBlockhouse(ctx, g, s) {
  const cape = g.site === 'cape',
    built = cape || blockhouseState(g.day).built,
    c = g.count,
    t = g.time;
  room(ctx, s, built ? '#7d7a71' : '#6f6c64', '#4a4740');
  // Board marks from the concrete formwork, and the heavy roof beam.
  ctx.fillStyle = 'rgba(0,0,0,.07)';
  for (let y = 40; y < FLOOR; y += 46) ctx.fillRect(-2000, y, 5000, 2);
  ctx.fillStyle = '#4e4b45';
  ctx.fillRect(-2000, 0, 5000, 34);
  // The lights: one bulb on a flex in the old blockhouse; strip lights in the new.
  if (built)
    for (const lx of [260, 640, 1020]) {
      ctx.fillStyle = '#f4f0dc';
      ctx.fillRect(lx - 70, 34, 140, 8);
      ctx.fillStyle = 'rgba(244,240,220,.06)';
      ctx.beginPath();
      ctx.moveTo(lx - 70, 42);
      ctx.lineTo(lx - 200, FLOOR);
      ctx.lineTo(lx + 200, FLOOR);
      ctx.lineTo(lx + 70, 42);
      ctx.fill();
    }
  else {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(360, 34);
    ctx.lineTo(360, 70);
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.shadowColor = '#ffe9a8';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(360, 78, 9, 0, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // The periscope view of the pad: round, in a brass ring, with the tube going up through the roof beside it.
  const scopes = built
    ? [
        [150, 160, 'PERISCOPE 1'],
        [400, 160, 'PERISCOPE 2'],
      ]
    : [[190, 160, 'PERISCOPE']];
  scopes.forEach(([cx, cy, name], i) => {
    const r = built ? 100 : 108;
    ctx.fillStyle = '#5b5f66';
    ctx.fillRect(cx + r + 6, 34, 18, cy - 34 + 20);
    ctx.fillRect(cx + r - 8, cy + 6, 46, 26); // tube and eyepiece
    ctx.fillStyle = '#b08a4a';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 9, 0, 7);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 7);
    ctx.clip();
    padPicture(ctx, g, cx - r, cy - r, 2 * r, 2 * r);
    if (i === 1) {
      ctx.fillStyle = 'rgba(30,60,40,.18)';
      ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    } // the second scope's green filter
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#d8d2c0';
    ctx.font = '12px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, cx, cy + r + 24);
    ctx.textAlign = 'left';
  });

  // The count clock and the status lamps, over the conductor's desk.
  const clock = c
    ? `T-${Math.floor(Math.ceil(c.clock) / 60)}:${String(Math.ceil(c.clock) % 60).padStart(2, '0')}`
    : 'T- --:--';
  const word = !c ? 'NO COUNT' : c.checking ? 'HOLD · PAD CREW OUT' : c.poll ? 'POLL' : c.held ? 'HOLDING' : 'COUNTING';
  const clockX = built ? 590 : 450;
  clockBoard(
    ctx,
    clockX,
    80,
    300,
    120,
    clock,
    word,
    cape ? 'BLOCKHOUSE · CAPE CANAVERAL' : built ? 'LAUNCH CONTROL · NEW BLOCKHOUSE' : 'W.S.P.G. BLOCKHOUSE',
  );
  const lx = clockX + 350;
  ctx.fillStyle = '#2c2e30';
  ctx.fillRect(lx - 30, 70, (built ? 1180 : 1150) - lx + 30, 150);
  lamp(ctx, lx + 10, 115, 16, !!c && (c.held || c.checking), '#e0543c', 'HOLD');
  lamp(ctx, lx + 80, 115, 16, !!c && !!c.poll, '#f0b440', 'POLL');
  lamp(ctx, lx + 150, 115, 16, !!c, '#7fdc8a', 'IGNITER');
  if (!built || lx + 220 < 1170)
    lamp(ctx, lx + 220, 115, 16, !!c && c.clock <= 10 && !c.held && !c.poll, '#ff8a5a', 'FIRE');
  ctx.fillStyle = '#d8d2c0';
  ctx.font = '12px monospace';
  if (!built) {
    ctx.fillText('NOBODY ON THE PAD', lx - 10, 178);
    ctx.fillText('AFTER ARMING', lx - 10, 196);
  } else {
    ctx.fillStyle = '#1b1c1e';
    for (let i = 0; i < 5; i++) ctx.fillRect(lx + 40, 160 + i * 9, 140, 4);
  } // the squawk box
  // The telemetry recorders: paper running under the pens. In the new blockhouse, over the range desk.
  if (built) recorders(ctx, 660, 236, 520, 40, t, !!c);

  // The firing panel: one long desk along the wall, a station each.
  const tc = conducting(),
    seat = { range: 'morgan', press: tc ? 'delgado' : 'you', tc: tc ? 'you' : 'ellis', pad: 'vega' };
  const here = new Set(inside(g, 'blockhouse', 180).map(p => p.id));
  if (c) here.add('you');
  const deskY = 300,
    stW = 250,
    gap = 22,
    x0 = (DW - (4 * stW + 3 * gap)) / 2;
  ctx.fillStyle = '#3c4a3a';
  ctx.fillRect(x0 - 20, deskY, 4 * stW + 3 * gap + 40, 130);
  ctx.fillStyle = '#566553';
  ctx.fillRect(x0 - 20, deskY, 4 * stW + 3 * gap + 40, 8);
  ctx.fillStyle = '#6e6458';
  ctx.fillRect(x0 - 30, deskY + 130, 4 * stW + 3 * gap + 60, 18); // the desktop
  ctx.fillStyle = '#4a433a';
  ctx.fillRect(x0 - 24, deskY + 148, 4 * stW + 3 * gap + 48, FLOOR - deskY - 148);
  shadeRight(ctx, x0 - 24, deskY + 148, 4 * stW + 3 * gap + 48, FLOOR - deskY - 148, 0.02);
  const heads = [];
  COUNT_STATIONS.forEach((st, i) => {
    const x = x0 + i * (stW + gap),
      who = g.people[seat[st.id]];
    const mine = seat[st.id] === 'you';
    ctx.fillStyle = '#2f3a2c';
    ctx.fillRect(x, deskY + 16, stW, 104);
    if (mine) {
      ctx.strokeStyle = '#e8c66a';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 3, deskY + 13, stW + 6, 110);
    }
    ctx.fillStyle = '#d8d2c0';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(st.label + (mine ? ' · YOU' : ''), x + stW / 2, deskY + 33);
    ctx.textAlign = 'left';
    stationFace(ctx, st.id, x, deskY + 40, stW, 76, c, t);
    const away = id => g.jobs.some(j => (j.who || []).includes(id));
    const present = who && !who.hidden && (c ? !away(who.id) : here.has(who.id));
    seatedBack(ctx, x + stW / 2, deskY + 200, present ? who : null, t);
    if (present) heads.push([who, x + stW / 2, deskY + 150]);
  });
  // Anyone else in the blockhouse stands at the back: Hoyt on the V-2 rounds, Brandt for the Navy, the pad crew back in.
  const standers = [...here].map(id => g.people[id]).filter(p => p && !Object.values(seat).includes(p.id));
  standers.forEach((p, i) => {
    const x = i % 2 ? 1150 - (i >> 1) * 70 : 60 + (i >> 1) * 70;
    heads.push([p, x, standing(ctx, x, p, t, 3.4)]);
  });
  bubbles(ctx, heads);
}

// What is on each station's face of the firing panel.
function stationFace(ctx, id, x, y, w, h, c, t) {
  if (id === 'press') {
    const v = c ? countTank() : 0;
    dial(ctx, x + w / 2, y + h / 2 + 2, h * 0.48, v, 0, 30, NORMAL_TANK, '', '');
    ctx.fillStyle = '#d8d2c0';
    ctx.font = '11px monospace';
    ctx.fillText('TANK bar', x + 8, y + h - 4);
    ctx.fillText(`${NORMAL_TANK[0]}-${NORMAL_TANK[1]}`, x + w - 46, y + h - 4);
  } else if (id === 'range') {
    // A plot scope with a sweep, and the range-clear lamp.
    const cx = x + 60,
      cy = y + h / 2,
      r = h * 0.44;
    ctx.fillStyle = '#0d1a14';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#1f3b2d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0, 7);
    ctx.stroke();
    const a = t * 2;
    ctx.strokeStyle = '#9ff0b8';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
    lamp(ctx, x + 170, y + 26, 13, !!c, '#7fdc8a', 'RANGE CLEAR');
  } else if (id === 'tc') {
    ctx.fillStyle = '#120c0a';
    ctx.fillRect(x + 14, y + 6, 120, 36);
    ctx.fillStyle = '#ff8a5a';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(c ? `${Math.ceil(c.clock)} s` : '---', x + 22, y + 32);
    ctx.fillStyle = '#7a1f16';
    ctx.beginPath();
    ctx.arc(x + 190, y + 30, 22, 0, 7);
    ctx.fill(); // the hold button
    ctx.fillStyle = '#d0634f';
    ctx.beginPath();
    ctx.arc(x + 190, y + 28, 18, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HOLD', x + 190, y + 32);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#26292c';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 18 + i * 28, y + 52, 20, 14); // intercom keys
  } else if (id === 'pad') {
    lamp(ctx, x + 40, y + 24, 13, !!c, '#7fdc8a', 'CONTINUITY');
    lamp(ctx, x + 120, y + 24, 13, !!c && c.clock <= 60, '#f0b440', 'ARMED');
    // The firing key in its guarded switch.
    ctx.fillStyle = '#1b1c1e';
    ctx.fillRect(x + 168, y + 6, 64, 62);
    ctx.fillStyle = '#c94';
    ctx.fillRect(x + 176, y + 14, 48, 46);
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(x + 200, y + 37, 12, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#ddd';
    ctx.save();
    ctx.translate(x + 200, y + 37);
    ctx.rotate(c && c.clock <= 1 ? 0.8 : 0);
    ctx.fillRect(-3, -14, 6, 14);
    ctx.restore();
  }
}

// Pen recorders: paper strips with the pens tracing slow lines, still when there is no count.
function recorders(ctx, x, y, w, h, t, running) {
  ctx.fillStyle = '#2a2c2e';
  ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
  const n = 4,
    sw = (w - (n - 1) * 8) / n;
  for (let i = 0; i < n; i++) {
    const sx = x + i * (sw + 8);
    ctx.fillStyle = '#f6f1e2';
    ctx.fillRect(sx, y, sw, h);
    ctx.strokeStyle = i % 2 ? '#4b6a8a' : '#a3321f';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let j = 0; j <= 30; j++) {
      const px = sx + (j / 30) * sw,
        v = running ? Math.sin(j * 0.5 + t * 3 + i) * 0.3 + Math.sin(j * 1.7 + i * 2) * 0.15 : 0;
      const py = y + h / 2 + v * h;
      j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
}

// ---- The test stand dugout: the static fire ------------------------------------------------------------------------
function drawDugout(ctx, g, s) {
  const st = g.stand,
    t = g.time;
  room(ctx, s, '#6d5b45', '#4a3d2e');
  // Sandbag walls, laid in courses, and the timber shoring.
  for (let row = 0, y = 40; y < FLOOR; row++, y += 30)
    for (let x = -400 + (row % 2) * 40; x < 1700; x += 80) {
      ctx.fillStyle = (row + x / 80) % 3 < 1 ? '#8c7a5c' : '#7f6e52';
      ctx.beginPath();
      ctx.roundRect(x, y, 76, 27, 9);
      ctx.fill();
    }
  ctx.fillStyle = '#5a4630';
  ctx.fillRect(-2000, 0, 5000, 40);
  for (const px of [60, 1140]) ctx.fillRect(px - 16, 0, 32, FLOOR);
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  for (const px of [60, 1140]) ctx.fillRect(px + 10, 0, 6, FLOOR);
  // The viewing slit: thick glass in a steel frame, the stand beyond it, flame and all.
  const sx = 170,
    sy = 70,
    sw = 860,
    sh = 160;
  ctx.fillStyle = '#2e2f31';
  ctx.fillRect(sx - 18, sy - 18, sw + 36, sh + 36);
  sitePicture(ctx, g, sx, sy, sw, sh, PLACES.stand.x + 60, 0.86, 200, c2 => {
    standStructure(c2, PLACES.stand);
    if (g.rocket.where === 'stand') roundShape(c2, g, PLACES.stand.x + 60, GROUND - 40, 0, false);
    if (g.standFlame > 0) {
      flame(c2, PLACES.stand.x + 60, GROUND - 40, g.standFlame, Math.PI / 2, t, 1.6);
      c2.fillStyle = 'rgba(235,230,220,.55)';
      for (let i = 0; i < 7; i++) {
        c2.beginPath();
        c2.arc(
          PLACES.stand.x + 60 + (i - 3) * 16 + Math.sin(t * 3 + i) * 4,
          GROUND - 4 - (i % 3) * 8,
          12 + i * 2,
          0,
          7,
        );
        c2.fill();
      }
    }
    for (const p of Object.values(g.people))
      if (!p.hidden && Math.abs(p.x - (PLACES.stand.x + 60)) < 120) {
        c2.fillStyle = p.color;
        c2.fillRect(p.x - 4, GROUND - 26, 8, 15);
        c2.fillStyle = '#e2b993';
        c2.beginPath();
        c2.arc(p.x, GROUND - 30, 4, 0, 7);
        c2.fill();
      }
  });
  ctx.fillStyle = 'rgba(160,200,220,.10)';
  ctx.fillRect(sx, sy, sw, sh); // the glass
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.fillRect(sx + 40, sy + 8, 10, sh - 16);

  // The instrument shelf under the slit: the count clock, the gauges and the recorder.
  ctx.fillStyle = '#4a3f33';
  ctx.fillRect(100, 262, 1000, 230);
  ctx.fillStyle = '#3a3128';
  ctx.fillRect(90, 488, 1020, 16);
  const phase = st ? st.phase : null;
  const clock = !st
    ? '—'
    : phase === 'count'
      ? `T-${Math.ceil(st.clock)}`
      : phase === 'firing'
        ? 'FIRING'
        : phase === 'held'
          ? 'HOLD'
          : phase === 'leakcheck'
            ? 'CREW OUT'
            : phase === 'ready'
              ? 'READY'
              : 'SAFE';
  clockBoard(
    ctx,
    128,
    290,
    210,
    92,
    clock,
    st && st.burn === 'long' ? 'FULL DURATION · 30 s' : st ? 'START-UP FIRING · 8 s' : 'NO FIRING',
    '',
  );
  const frame = st && st.trace && st.shown > 0 ? st.trace[Math.max(0, Math.floor(st.shown) - 1)] : null;
  const firing = phase === 'firing' || phase === 'read';
  const tank = !st ? 0 : firing && frame ? frame.tank : standTank();
  const k = kit(),
    walled = st && st.burn === 'long' && !!k.stand?.wall;
  dial(ctx, 420, 345, 52, tank, 0, 30, NORMAL_TANK, 'Tank', 'bar');
  dial(ctx, 560, 345, 52, frame ? frame.pc : 0, 0, 30, k.stand?.pc, 'Chamber', 'bar');
  if (walled)
    dial(ctx, 700, 345, 52, frame && frame.wall != null ? frame.wall : 300, 0, 1000, k.stand.wall, 'Wall', 'K');
  // The strip-chart recorder: the firing traced as it happens, paper running out of the bottom.
  const rx = walled ? 780 : 680,
    rw = 1080 - rx,
    ry = 286,
    rh = 150;
  ctx.fillStyle = '#26282b';
  ctx.fillRect(rx - 8, ry - 8, rw + 16, rh + 16);
  ctx.fillStyle = '#f6f1e2';
  ctx.fillRect(rx, ry, rw, rh);
  if (st && st.trace) {
    const span = st.trace[st.trace.length - 1].t,
      upto = Math.floor(st.shown),
      px = tt => rx + 6 + (tt / span) * (rw - 12),
      py = v => ry + rh - 6 - (v / 30) * (rh - 12);
    if (k.stand?.pc) {
      ctx.fillStyle = 'rgba(110,200,120,.18)';
      ctx.fillRect(rx, py(k.stand.pc[1]), rw, py(k.stand.pc[0]) - py(k.stand.pc[1]));
    }
    for (const [key, col] of [
      ['tank', '#4b6a8a'],
      ['pc', '#a3321f'],
    ]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      st.trace
        .slice(0, upto)
        .forEach((p, i) => (i ? ctx.lineTo(px(p.t), py(p[key])) : ctx.moveTo(px(p.t), py(p[key]))));
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = '#d6cdb5';
    for (let v = 0; v <= 30; v += 5) {
      ctx.beginPath();
      ctx.moveTo(rx, ry + rh - 6 - (v / 30) * (rh - 12));
      ctx.lineTo(rx + rw, ry + rh - 6 - (v / 30) * (rh - 12));
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#d8d2c0';
  ctx.font = '12px Georgia, serif';
  ctx.fillText('Recorder: red chamber, blue tank', rx, ry + rh + 26);
  // The firing box: the key, and the lamp that says the stage is pressurised.
  lamp(ctx, 160, 440, 12, !!st && ['ready', 'held', 'count'].includes(phase), '#f0b440', 'PRESSURISED');
  lamp(ctx, 270, 440, 12, phase === 'firing', '#ff8a5a', 'FIRE');
  // The people in the dugout, standing at the shelf.
  const heads = inside(g, 'dugout', 140)
    .sort((a, b) => (a.id === 'you') - (b.id === 'you'))
    .map((p, i, all) => {
      const x = all.length === 1 ? 600 : 300 + i * (600 / Math.max(1, all.length - 1));
      return [p, x, standing(ctx, x, p, t, 3.6)];
    });
  bubbles(ctx, heads);
}

// ---- The assembly hangar: the round on its cradles, and the spots to look at ---------------------------------------
// The round's length and half-width in the units its shape is drawn in (tail at 0, nose at -len).
const SHAPE = {
  wac: [60, 9],
  aerobee: [60, 9],
  v2: [104, 16],
  bumper: [104, 16],
  viking: [118, 13],
  vanguard: [210, 6],
  juno: [218, 12],
  ranger: [270, 17],
  redstone: [136, 12],
  atlas: [226, 17],
  titan: [258, 15],
  saturn5: [398, 22],
};
// Roughly where on the round each spot is, from the tail (0) to the nose (1), by what it is called. Content, not truth.
const SPOT_AT = [
  [
    /heat.?shield|bag|f1|first.?stage f|fin|holddown|hold-down|booster|chamber|gimbal|vane|liner|thrust|tail|engine(?!s? and)|nozzle/,
    0.08,
  ],
  [/s2|j-2|second|interstage|separation|cluster|upper|agena|weld-fwd|forward|wac/, 0.62],
  [/s4b|s-ivb|third|iu|instrument unit/, 0.72],
  [/lm|lunar module|sphere|satellite|spin|payload|ranger|camera|nose|scanner|sps|service|o2|oxygen tank/, 0.86],
  [/cabin|hatch|chute|parachute|computer|fuel.?cell|thruster/, 0.94],
  [/tank|weld|pressur|fitting/, 0.5],
  [/wiring|lead|cable|igniter|guidance/, 0.42],
  [/valve|line|feed|lox|alc|fuel|turbine|pump/, 0.28],
];
function spotAt(id, name) {
  const s = `${id} ${name}`.toLowerCase();
  for (const [re, f] of SPOT_AT) if (re.test(s)) return f;
  return 0.5;
}
// Spread the spots along the round so no two tags sit on top of each other.
function spread(list, gap) {
  list.sort((a, b) => a.f - b.f);
  for (let i = 1; i < list.length; i++) list[i].f = Math.max(list[i].f, list[i - 1].f + gap);
  const over = list.length ? list[list.length - 1].f - 0.98 : 0;
  if (over > 0) for (const s of list) s.f -= over;
  for (let i = list.length - 2; i >= 0; i--) list[i].f = Math.min(list[i].f, list[i + 1].f - gap);
  return list;
}

function drawHangar(ctx, g, s) {
  const crewed = g.crewed,
    t = g.time,
    apollo = crewed && programOf() === 'apollo';
  const whiteSands = g.vehicle === 'wac';
  room(
    ctx,
    s,
    crewed ? '#d9d7d0' : whiteSands ? '#222827' : '#3d3f43',
    crewed ? '#c9c6bc' : whiteSands ? '#39352f' : '#6b6a66',
  );
  if (whiteSands) {
    if (whiteSandsBackdrop?.naturalWidth) ctx.drawImage(whiteSandsBackdrop, 0, 0, DW, DH);
  } else if (crewed) {
    // Hangar S: white walls, a clean floor, the maker's banner
    ctx.fillStyle = '#e8e6df';
    ctx.fillRect(-2000, 0, 5000, 60);
    for (const lx of [200, 600, 1000]) {
      ctx.fillStyle = '#fbfaf4';
      ctx.fillRect(lx - 90, 60, 180, 10);
    }
    ctx.fillStyle = '#2b3f6b';
    ctx.fillRect(380, 96, 440, 44);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(placeName('hangar').toUpperCase(), 600, 126);
    ctx.textAlign = 'left';
  } else {
    // the quonset's arched roof and its ribs, the hanging lamps with their light
    ctx.fillStyle = '#2f3134';
    ctx.beginPath();
    ctx.moveTo(-2000, 0);
    ctx.lineTo(3000, 0);
    ctx.lineTo(3000, 120);
    ctx.quadraticCurveTo(600, -60, -1800, 120);
    ctx.fill();
    ctx.strokeStyle = '#55585d';
    ctx.lineWidth = 6;
    for (let x = -200; x <= 1400; x += 160) {
      ctx.beginPath();
      ctx.moveTo(x, FLOOR);
      ctx.lineTo(x, 110 - 40 * Math.cos((x - 600) / 1600));
      ctx.stroke();
    }
    ctx.strokeStyle = '#83868b';
    ctx.lineWidth = 1.5;
    for (let x = -204; x <= 1400; x += 160) {
      ctx.beginPath();
      ctx.moveTo(x, FLOOR);
      ctx.lineTo(x, 110);
      ctx.stroke();
    }
    for (const lx of [300, 600, 900]) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, 40);
      ctx.lineTo(lx, 110);
      ctx.stroke();
      ctx.fillStyle = '#f3dd8a';
      ctx.beginPath();
      ctx.moveTo(lx - 26, 124);
      ctx.lineTo(lx - 12, 108);
      ctx.lineTo(lx + 12, 108);
      ctx.lineTo(lx + 26, 124);
      ctx.fill();
      ctx.fillStyle = 'rgba(243,221,138,.08)';
      ctx.beginPath();
      ctx.moveTo(lx - 26, 124);
      ctx.lineTo(lx - 220, FLOOR + 60);
      ctx.lineTo(lx + 220, FLOOR + 60);
      ctx.lineTo(lx + 26, 124);
      ctx.fill();
    }
    // The bench along the back wall, tools on the board above it, and the chalkboard with the round on it.
    ctx.fillStyle = '#6a5a44';
    ctx.fillRect(60, 470, 300, 12);
    ctx.fillRect(70, 482, 8, 128);
    ctx.fillRect(342, 482, 8, 128);
    ctx.fillStyle = '#4a4034';
    ctx.fillRect(70, 360, 280, 96);
    ctx.strokeStyle = '#b8b2a6';
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(90 + i * 38, 376);
      ctx.lineTo(90 + i * 38 + (i % 2 ? 8 : -6), 436);
      ctx.stroke();
    }
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(680, 40);
    ctx.lineTo(680, 70);
    ctx.moveTo(840, 40);
    ctx.lineTo(840, 70);
    ctx.stroke();
    ctx.fillStyle = '#2d3b33';
    ctx.fillRect(660, 70, 200, 54);
    ctx.strokeStyle = '#6a5a44';
    ctx.lineWidth = 4;
    ctx.strokeRect(660, 70, 200, 54);
    ctx.fillStyle = '#e8e4d6';
    ctx.textAlign = 'center';
    ctx.font = '17px Georgia, serif';
    ctx.fillText(kit().name, 760, 94);
    ctx.font = '12px Georgia, serif';
    ctx.fillText(dateText(), 760, 114);
    ctx.textAlign = 'left';
  }
  // Where the spots are and whether you have looked at them: on the inspection list, or in the spacecraft checkout.
  const actionable = g.room === 'inspect' || g.room === 'checkout';
  const ids = crewed ? capsuleSpots() : Object.keys(kit().spots);
  const spots = KITS[g.vehicle]?.spots || {};
  const fittingFixed = g.vehicle === 'wac' && g.decided.leakFixed === spots.fitting.name;
  const seenOf = id => {
    if (crewed) return g.mission?.checkout?.[id]?.text ?? null;
    if (id === 'fitting' && fittingFixed) return 'Leak check found and fixed the leak at this fitting.';
    if (g.looked[id] == null) return null;
    return g.looked[id] ? spots[id].cue : spots[id].sound;
  };
  const flaggedOf = id => (crewed ? !!g.mission?.flags?.[id] : !!inspectFlags()[id]);
  const act = crewed ? 'eng-look' : 'look';
  const list = ids
    .filter(id => spots[id] && (actionable || seenOf(id) != null))
    .map(id => ({ id, name: spots[id].name, f: spotAt(id, spots[id].name) }));
  const heads = [];
  tagQueue = [];
  if (crewed && !apollo) drawCapsuleOnStand(ctx, g, s, spread(list, 0.2), seenOf, flaggedOf, actionable, act);
  else if (g.rocket.where === 'hangar' || crewed)
    drawRoundOnCradles(
      ctx,
      g,
      s,
      spread(list, Math.min(0.16, 0.9 / Math.max(1, list.length))),
      seenOf,
      flaggedOf,
      actionable,
      act,
    );
  else {
    ctx.fillStyle = '#b8b2a6';
    ctx.font = 'italic 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `The ${kit().name} is out of the hangar${g.rocket.where === 'stand' ? ', on the test stand' : g.rocket.where === 'tower' ? ', in the tower' : ''}.`,
      600,
      420,
    );
    ctx.textAlign = 'left';
    for (const cx of [420, 760]) {
      ctx.fillStyle = '#6a5a44';
      ctx.fillRect(cx - 40, FLOOR - 50, 80, 50);
    }
  }
  // The crew in the hangar, standing on the floor in front of the round.
  const people = inside(g, 'hangar').filter(p => p.id !== 'you' || !actionable);
  people.forEach((p, i) => {
    const x = 140 + ((i + 0.5) / Math.max(1, people.length)) * 920;
    heads.push([p, x, whiteSands ? hangarTechnician(ctx, x, 590 + (i % 2) * 31, p) : standing(ctx, x, p, t, 3)]);
  });
  layoutTags(tagQueue);
  for (const args of tagQueue) drawTag(...args);
  bubbles(ctx, heads);
}

function hangarTechnician(ctx, x, y, person) {
  ctx.fillStyle = 'rgba(20,24,18,.48)';
  ctx.beginPath();
  ctx.ellipse(x + 5, y + 11, 27, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = person.color;
  ctx.strokeStyle = '#30372c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x - 20, y - 13, 40, 29, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#bd9875';
  ctx.beginPath();
  ctx.arc(x, y - 13, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = person.hat || '#57493b';
  ctx.fillRect(x - 10, y - 19, 20, 8);
  if (person.id === 'you') youMark(ctx, x, y - 37);
  return y - 39;
}

// The round lies on cradles with its nose to the left, as in the site hangar.
function drawRoundOnCradles(ctx, g, s, list, seenOf, flaggedOf, actionable, act) {
  const [len0, half] = SHAPE[g.vehicle] || [100, 10];
  const mated = !!g.rocket.mated,
    len = (g.vehicle === 'wac' || g.vehicle === 'aerobee') && mated ? 86 : g.vehicle === 'bumper' && mated ? 160 : len0;
  const k = Math.min(940 / len, 120 / half),
    tailX = 600 + (len * k) / 2,
    cy = 410;
  // Cradles under her, then the round itself.
  const steel = g.crewed ? '#8a8f96' : '#6a5a44';
  for (const f of [0.15, 0.5, 0.85]) {
    const cx = tailX - f * len * k;
    ctx.fillStyle = steel;
    if (g.vehicle === 'wac') {
      ctx.fillRect(cx - 18, cy - 54, 36, 108);
      ctx.fillStyle = '#9a7950';
      ctx.fillRect(cx - 24, cy - 55, 48, 7);
      ctx.fillRect(cx - 24, cy + 48, 48, 7);
    } else {
      ctx.fillRect(cx - 24, cy + Math.min(half * k, 60) * 0.6, 48, FLOOR - cy);
      ctx.fillRect(cx - 40, FLOOR - 10, 80, 10);
    }
  }
  ctx.save();
  ctx.translate(tailX, cy);
  ctx.scale(k, k);
  roundShape(ctx, g, 0, 0, -Math.PI / 2, mated);
  ctx.restore();
  const fittingX = tailX - ((mated ? 26 : 0) + 21) * k;
  if (g.vehicle === 'wac') {
    const light = ctx.createRadialGradient(fittingX, cy - 18, 8, fittingX, cy - 18, 158);
    light.addColorStop(0, 'rgba(255,213,143,.28)');
    light.addColorStop(1, 'rgba(255,213,143,0)');
    ctx.fillStyle = light;
    ctx.fillRect(fittingX - 158, cy - 176, 316, 316);
    ctx.strokeStyle = '#35382e';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(fittingX + 94, cy - 62);
    ctx.lineTo(fittingX + 66, cy - 94);
    ctx.lineTo(fittingX + 29, cy - 69);
    ctx.stroke();
    ctx.fillStyle = '#d2aa64';
    ctx.fillRect(fittingX + 16, cy - 71, 22, 10);
    ctx.fillStyle = '#b4aa94';
    ctx.fillRect(fittingX - 21, cy - 19, 42, 35);
    const fixed = g.decided.leakFixed === kit().spots.fitting.name;
    if (g.looked.fitting != null && !fixed) {
      ctx.fillStyle = '#323737';
      ctx.fillRect(fittingX - 18, cy - 16, 36, 29);
      ctx.strokeStyle = '#c79b63';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(fittingX - 16, cy + 3);
      ctx.lineTo(fittingX - 7, cy + 3);
      ctx.lineTo(fittingX - 7, cy - 5);
      ctx.lineTo(fittingX + 17, cy - 5);
      ctx.stroke();
      ctx.fillStyle = '#ead4a6';
      ctx.fillRect(fittingX - 2, cy - 9, 8, 8);
      if (g.looked.fitting) {
        ctx.fillStyle = '#698744';
        ctx.beginPath();
        ctx.ellipse(fittingX + 3, cy + 13, 4, 12, -0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (fixed) {
      ctx.fillStyle = '#eee2b8';
      ctx.fillRect(fittingX + 15, cy - 19, 3, 8);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath();
  if (g.vehicle !== 'wac') ctx.ellipse(600, FLOOR + 6, (len * k) / 2, 10, 0, 0, 7);
  ctx.fill();
  list.forEach((sp, i) => {
    const bx = g.vehicle === 'wac' && sp.id === 'fitting' ? fittingX : tailX - sp.f * len * k,
      up = i % 2 === 0;
    tag(ctx, s, sp, bx, cy, up ? 230 : 520, seenOf(sp.id), flaggedOf(sp.id), actionable, act);
  });
}

// Mercury's and Gemini's spacecraft standing on its checkout stand, big, with the spots tagged left and right.
function drawCapsuleOnStand(ctx, g, s, list, seenOf, flaggedOf, actionable, act) {
  const k = 13,
    cx = 600,
    base = 520;
  ctx.fillStyle = '#8a8f96';
  ctx.fillRect(cx - 170, base, 340, 20);
  ctx.fillRect(cx - 150, base + 20, 16, FLOOR - base - 20);
  ctx.fillRect(cx + 134, base + 20, 16, FLOOR - base - 20);
  ctx.save();
  ctx.translate(cx, base);
  ctx.scale(k, k);
  capsuleShape(ctx, 0, 0, false);
  // The shingles and the window, so she reads as a spacecraft at this size.
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.lineWidth = 0.15;
  for (let y = -13; y < 0; y += 1.6) {
    ctx.beginPath();
    ctx.moveTo(-9 + (y + 14) * 0.3 - 4, y);
    ctx.lineTo(9 - (y + 14) * 0.3 + 4, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#4a6a86';
  ctx.beginPath();
  ctx.moveTo(-1.6, -11);
  ctx.lineTo(1.6, -11);
  ctx.lineTo(1.2, -8);
  ctx.lineTo(-1.2, -8);
  ctx.fill();
  ctx.restore();
  // Work platforms either side.
  ctx.strokeStyle = '#b8bcc2';
  ctx.lineWidth = 4;
  for (const px of [cx - 260, cx + 260]) {
    ctx.beginPath();
    ctx.moveTo(px - 50, 330);
    ctx.lineTo(px + 50, 330);
    ctx.moveTo(px - 46, 330);
    ctx.lineTo(px - 46, FLOOR);
    ctx.moveTo(px + 46, 330);
    ctx.lineTo(px + 46, FLOOR);
    ctx.stroke();
  }
  list.forEach((sp, i) => {
    const y = base - sp.f * 20 * k,
      x = cx + (i % 2 ? 1 : -1) * 70;
    tag(ctx, s, sp, x, y, null, seenOf(sp.id), flaggedOf(sp.id), actionable, act, i % 2 ? 'right' : 'left');
  });
}

// A spot's tag: a card with the spot's name and what you saw there, joined by a line to the point on the hardware. A spot
// not yet looked at is a button while the inspection is yours.
// Tags are queued and drawn after the crew, so nobody standing on the floor hides one.
let tagQueue = [];
function tag(...args) {
  tagQueue.push(args);
}
// Tags in the same row (above the round, or below it) are pushed apart so no card covers another, wherever the spots
// sit on the hardware: the WAC's acid fitting is drawn where it is, not where the spread put it.
const TAG_W = 230,
  TAG_GAP = 10;
function layoutTags(queue) {
  const rows = {};
  for (const args of queue) {
    const [, , , px, , ty, , , , , side] = args;
    if (side || ty == null) continue;
    (rows[ty < 400 ? 'up' : 'down'] ||= []).push({ args, x: Math.max(10, Math.min(DW - TAG_W - 10, px - TAG_W / 2)) });
  }
  for (const row of Object.values(rows)) {
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) row[i].x = Math.max(row[i].x, row[i - 1].x + TAG_W + TAG_GAP);
    const over = row.at(-1).x - (DW - TAG_W - 10);
    if (over > 0) for (const t of row) t.x -= over;
    for (let i = row.length - 2; i >= 0; i--) row[i].x = Math.min(row[i].x, row[i + 1].x - TAG_W - TAG_GAP);
    for (const t of row) t.args[11] = t.x;
  }
}
function drawTag(ctx, s, sp, px, py, ty, seen, flagged, actionable, act, side, at = null) {
  const tw = TAG_W,
    lines = [];
  ctx.font = 'bold 13px Georgia, serif';
  const name = wrap(ctx, sp.name, tw - 20);
  ctx.font = '12px Georgia, serif';
  const note = seen
    ? wrap(ctx, seen.length > 90 ? `${seen.slice(0, 88)}…` : seen, tw - 20)
    : [actionable ? 'Click to look closely' : 'Not looked at'];
  lines.push(...name.map(l => ['b', l]), ...note.map(l => ['n', l]));
  const th = 14 + lines.length * 16 + (flagged ? 16 : 0);
  let tx, tyy;
  if (side) {
    tx = side === 'right' ? px + 180 : px - 180 - tw;
    tyy = py - th / 2;
  } else {
    tx = at ?? Math.max(10, Math.min(DW - tw - 10, px - tw / 2));
    tyy = ty - (ty < 400 ? th : 0);
  }
  tyy = Math.max(10, Math.min(FLOOR + 130 - th, tyy));
  const open = seen == null && actionable;
  ctx.strokeStyle = open ? '#e8c66a' : 'rgba(241,230,200,.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash(open ? [] : [5, 4]);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(side ? (side === 'right' ? tx : tx + tw) : tx + tw / 2, side ? tyy + th / 2 : ty < 400 ? tyy + th : tyy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = open ? '#e8c66a' : '#f1e6c8';
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,24,30,.92)';
  ctx.beginPath();
  ctx.roundRect(tx, tyy, tw, th, 5);
  ctx.fill();
  ctx.strokeStyle = flagged ? '#d0634f' : open ? '#e8c66a' : '#4a5464';
  ctx.lineWidth = flagged || open ? 2 : 1;
  ctx.stroke();
  let y = tyy + 18;
  for (const [kind, l] of lines) {
    ctx.fillStyle = kind === 'b' ? '#f1e6c8' : open ? '#e8c66a' : '#b8bfca';
    ctx.font = kind === 'b' ? 'bold 13px Georgia, serif' : `${open ? 'italic ' : ''}12px Georgia, serif`;
    ctx.fillText(l, tx + 10, y);
    y += 16;
  }
  if (flagged) {
    ctx.fillStyle = '#e07a66';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('FLAGGED FOR THE CREW', tx + 10, y);
  }
  if (open) s.hit(act, sp.id, tx, tyy, tw, th);
}

// ---- The simulator: a copy of your Mercury Control console, and the sim supervisor behind the glass -----------------
function drawSim(ctx, g, s) {
  const c = g.console && g.console.kind === 'sim' ? g.console : null,
    t = g.time;
  room(ctx, s, '#2a2f36', '#34312c');
  ctx.fillStyle = 'rgba(255,255,255,.04)';
  for (let x = -400; x < 1700; x += 90) ctx.fillRect(x, 0, 2, FLOOR);
  // The lit sign over the door: nobody forgets this is a sim.
  ctx.fillStyle = c ? '#a3321f' : '#4a2420';
  if (c) {
    ctx.shadowColor = '#e0543c';
    ctx.shadowBlur = 20;
  }
  ctx.fillRect(480, 30, 240, 44);
  ctx.shadowBlur = 0;
  ctx.fillStyle = c ? '#fff2e8' : '#8a6a60';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SIMULATION', 600, 60);
  ctx.textAlign = 'left';
  // The wall: the flight-path screen, and the count clock repeater.
  monitorScreen(ctx, g, 90, 110, 520, 250);
  const clock = c
    ? c.phase === 'count' || c.poll || c.phase === 'hold'
      ? `T-${Math.floor(Math.ceil(c.clock) / 60)}:${String(Math.ceil(c.clock) % 60).padStart(2, '0')}`
      : c.phase === 'debrief'
        ? 'END'
        : `T+${Math.floor(c.t || 0)}`
    : '--:--';
  clockBoard(
    ctx,
    660,
    120,
    220,
    90,
    clock,
    c ? (c.poll ? 'POLL' : (c.phase || '').toUpperCase()) : 'STANDBY',
    'SIM CLOCK',
  );
  // The sim supervisor's window, top right: him at his desk with the failures he can throw at you.
  ctx.fillStyle = '#181b1f';
  ctx.fillRect(920, 100, 240, 200);
  ctx.fillStyle = '#3a4a5a';
  ctx.fillRect(932, 112, 216, 176);
  ctx.fillStyle = '#5d6a78';
  ctx.fillRect(1000, 196, 70, 50);
  ctx.fillStyle = '#e2b993';
  ctx.beginPath();
  ctx.arc(1035, 180, 16, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#4b5258';
  ctx.fillRect(940, 246, 200, 42);
  ctx.fillStyle = '#9fdc9a';
  for (let i = 0; i < 5; i++) ctx.fillRect(950 + i * 38, 256, 24, 8);
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.fillRect(950, 116, 16, 168);
  ctx.fillStyle = '#d8d2c0';
  ctx.font = '12px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('SIM SUPERVISOR', 1040, 320);
  ctx.textAlign = 'left';
  // Your console: the same desk as in Mercury Control, with you at it.
  consoleDesk(ctx, 600 - 230 * 1.5, 450, 1.5, g.people.you, 'YOU · SIM CONSOLE', c, true, 'retro');
  // The chatter of the sim loop, as bubbles over the room.
  if (c && c.chatter.length) {
    const last = c.chatter[c.chatter.length - 1];
    ctx.save();
    ctx.translate(600, 370);
    ctx.scale(1.3, 1.3);
    bubble(ctx, 0, 0, `${last.who}: ${last.text}`, last.tone);
    ctx.restore();
  }
}
