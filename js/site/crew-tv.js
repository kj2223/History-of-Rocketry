// THE CREW ON THE TELEVISION (v0.8 visual pass): the people the flight is for, on Mission Control's screen.
//  - In the count, before the pad camera goes live, the network's replays of the morning: the crew walking out to the
//    van in their suits, then the white room at the hatch as the last of them climbs in. They are marked PLAYBACK: the
//    real walkout was hours before the last fifteen minutes the room plays, and the networks showed it again in the count.
//  - In the flight, the spacecraft's own television where it had one live (Apollo 7, October 1968, and every flight
//    after it with a crew, but never Mercury or Gemini, which flew film only): the cabin and the window, with Earth, the
//    Moon or the ground below in it. Black and white until Apollo 10 (May 1969). On the Moon, the surface camera.
//    It shares the screen with the flight's status board, and gives it back whenever a lamp is lit or a call waits.
// Suits, vans and doors follow the years. Nothing flashes: the press photographers' flashbulbs are left out on purpose.
import { yearOf } from './draw.js';
import { SEASON } from '../data/campaign.js';
import { moonWallMode, behindMoon } from '../stage/moon-wall.js';

// The count seconds each replay runs before the pad camera takes over (the count starts at T-15 minutes).
export const WALKOUT_FROM = 660,
  WHITE_ROOM_FROM = 420;

// What the crew wore, by vehicle and year.
export function suitOf(vehicle, year) {
  if (vehicle === 'redstone' || vehicle === 'atlas') return { body: '#c7cbd0', trim: '#8e959c', helmet: '#d9dde1' };
  if (vehicle === 'titan') return { body: '#e3e1d8', trim: '#a8a69c', helmet: '#efeee8' };
  if (vehicle === 'shuttle') {
    if (year < 1982) return { body: '#a3a48f', trim: '#6c6d5c', helmet: '#e8e6dc' }; // STS-1 to 4: ejection suits
    if (year < 1987) return { body: '#3e5c8c', trim: '#253a5c', helmet: '#e8e6dc' }; // blue flight coveralls
    return { body: '#e3752d', trim: '#a8501c', helmet: '#f0eee6' }; // the orange launch and entry suits
  }
  if (vehicle === 'dragon') return { body: '#f1f1ef', trim: '#2a2a2c', helmet: '#f6f6f4' };
  if (vehicle === 'sls') return { body: '#e3752d', trim: '#a8501c', helmet: '#f0eee6' };
  return { body: '#f0eee6', trim: '#b8b4a8', helmet: '#f4f2ec' }; // Apollo, Skylab, Apollo–Soyuz
}
// How many fly: the season's crew, or the vehicle's seats.
export function crewCount(g) {
  const crew = SEASON[g.roundIndex]?.crew;
  if (crew?.length) return crew.length;
  return { redstone: 1, atlas: 1, titan: 2, saturnib: 3, saturn5: 3, shuttle: 5, dragon: 2, sls: 4 }[g.vehicle] || 1;
}
// Which replay the count shows at count clock `clock` (seconds to go), or null for the pad camera.
export const countReplay = clock => (clock > WALKOUT_FROM ? 'walkout' : clock > WHITE_ROOM_FROM ? 'whiteRoom' : null);
// Whether the flight had live television from the spacecraft.
export const hasCabinTv = (vehicle, year) => year >= 1968 && !['redstone', 'atlas', 'titan'].includes(vehicle);
// The cabin camera's share of the screen: on for about a minute in every two and a half, when the board is quiet.
export const cabinOn = (f, time) =>
  !f.decision && !Object.values(f.status || {}).some(v => v && v[1]) && time % 150 < 60;

function strip(ctx, x, y, w, h, cam, live, colour) {
  const size = Math.min(w / 30, h / 9);
  ctx.save();
  ctx.fillStyle = 'rgba(6,10,12,.62)';
  ctx.fillRect(x, y, w, size * 1.6);
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f1e6c8';
  ctx.fillText(cam, x + w * 0.03, y + size * 0.8, w * 0.62);
  ctx.textAlign = 'right';
  ctx.fillStyle = live ? '#ff6a4a' : '#9fb3ad';
  ctx.fillText(live ? '● LIVE' : 'PLAYBACK', x + w * 0.97, y + size * 0.8);
  ctx.restore();
  if (!colour) grey(ctx, x, y, w, h);
}
// The black-and-white years: the picture washed to grey with the tube's tint.
function grey(ctx, x, y, w, h) {
  ctx.save();
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = '#888';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
function tube(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  for (let yy = y; yy < y + h; yy += 3) ctx.fillRect(x, yy, w, 1);
}

// One suited figure, feet at (fx, fy), s pixels tall; step: the walk's phase (radians), or null standing.
function suited(ctx, fx, fy, s, suit, step = null, carry = true) {
  const sw = step == null ? 0 : Math.sin(step) * s * 0.07;
  ctx.fillStyle = suit.trim;
  ctx.fillRect(fx - s * 0.1 + sw, fy - s * 0.42, s * 0.08, s * 0.42); // legs
  ctx.fillRect(fx + s * 0.02 - sw, fy - s * 0.42, s * 0.08, s * 0.42);
  ctx.fillStyle = suit.body;
  ctx.fillRect(fx - s * 0.13, fy - s * 0.8, s * 0.26, s * 0.42); // body
  ctx.fillRect(fx - s * 0.1 + sw * 0.7, fy - s * 0.46, s * 0.08, s * 0.36);
  ctx.fillRect(fx + s * 0.02 - sw * 0.7, fy - s * 0.46, s * 0.08, s * 0.36);
  ctx.fillStyle = suit.trim;
  ctx.fillRect(fx - s * 0.13, fy - s * 0.62, s * 0.26, s * 0.03);
  if (carry) {
    // the portable air conditioner each carried out to the van, on its hose
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(fx + s * 0.13, fy - s * 0.5, s * 0.1, s * 0.13);
  }
  ctx.fillStyle = suit.helmet;
  ctx.beginPath();
  ctx.arc(fx, fy - s * 0.88, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,50,60,.65)';
  ctx.fillRect(fx + s * 0.01, fy - s * 0.93, s * 0.1, s * 0.09);
}
// A technician or a guard in shirtsleeves or white coveralls.
function person(ctx, fx, fy, s, body, head = '#d9b08c', cap = null) {
  ctx.fillStyle = '#2b2e33';
  ctx.fillRect(fx - s * 0.08, fy - s * 0.42, s * 0.07, s * 0.42);
  ctx.fillRect(fx + s * 0.01, fy - s * 0.42, s * 0.07, s * 0.42);
  ctx.fillStyle = body;
  ctx.fillRect(fx - s * 0.11, fy - s * 0.8, s * 0.22, s * 0.4);
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(fx, fy - s * 0.88, s * 0.09, 0, Math.PI * 2);
  ctx.fill();
  if (cap) {
    ctx.fillStyle = cap;
    ctx.fillRect(fx - s * 0.1, fy - s * 0.99, s * 0.2, s * 0.06);
  }
}

// The walkout: the crew out of the crew quarters' door, along the line of guards and staff, to the van.
function walkout(ctx, g, x, y, w, h, k) {
  const year = yearOf(g),
    suit = suitOf(g.vehicle, year),
    n = crewCount(g);
  const sky = ctx.createLinearGradient(0, y, 0, y + h * 0.6);
  sky.addColorStop(0, '#3a4a66');
  sky.addColorStop(1, '#8a8f9a'); // before dawn on most launch mornings
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  const ground = y + h * 0.78;
  // The building and its door, at the left: Hangar S in the Mercury years, the operations and checkout building after.
  ctx.fillStyle = year < 1964 ? '#b9b4a6' : '#c8c6bf';
  ctx.fillRect(x, y + h * 0.18, w * 0.3, ground - y - h * 0.18);
  ctx.fillStyle = '#1b1d20';
  ctx.fillRect(x + w * 0.12, ground - h * 0.32, w * 0.1, h * 0.32);
  ctx.fillStyle = 'rgba(255,236,190,.55)';
  ctx.fillRect(x + w * 0.125, ground - h * 0.31, w * 0.09, h * 0.31);
  ctx.fillStyle = '#4b4d50';
  ctx.font = `bold ${Math.max(7, h * 0.05)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(year < 1964 ? 'HANGAR S' : 'CREW QUARTERS', x + w * 0.17, y + h * 0.26);
  // The tarmac and the van (from 2020, Crew Dragon's crews rode out in cars).
  ctx.fillStyle = '#55575a';
  ctx.fillRect(x, ground, w, y + h - ground);
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fillRect(x, ground + h * 0.08, w, h * 0.01);
  if (g.vehicle === 'dragon') {
    for (const cx of [0.72, 0.88]) {
      ctx.fillStyle = '#1f2124';
      ctx.fillRect(x + w * cx - w * 0.07, ground - h * 0.1, w * 0.14, h * 0.08);
      ctx.fillRect(x + w * cx - w * 0.045, ground - h * 0.15, w * 0.08, h * 0.06);
    }
  } else {
    ctx.fillStyle = year < 1964 ? '#e8e4d8' : '#d6d9dc';
    ctx.fillRect(x + w * 0.66, ground - h * 0.26, w * 0.3, h * 0.22);
    ctx.fillStyle = year < 1964 ? '#9a3b32' : '#3a5f9a';
    ctx.fillRect(x + w * 0.66, ground - h * 0.15, w * 0.3, h * 0.02);
    ctx.fillStyle = '#22262b';
    ctx.fillRect(x + w * 0.69, ground - h * 0.23, w * 0.06, h * 0.07);
    ctx.fillRect(x + w * 0.8, ground - h * 0.23, w * 0.06, h * 0.07);
    ctx.fillStyle = '#121416';
    ctx.fillRect(x + w * 0.67, ground - h * 0.21, w * 0.015, h * 0.17); // the open door
    for (const wx of [0.71, 0.91]) {
      ctx.beginPath();
      ctx.arc(x + w * wx, ground - h * 0.03, h * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The guards and the staff lining the way, standing still.
  const s = h * 0.36;
  for (let i = 0; i < 5; i++)
    person(ctx, x + w * (0.36 + i * 0.06), ground - h * 0.13, s * 0.72, i % 2 ? '#e7e4dc' : '#5a6a7a');
  // The crew, in a line, from the door to the van as the replay runs.
  for (let i = 0; i < n; i++) {
    const p = Math.max(0, Math.min(1, k * 1.25 - i * 0.12));
    if (p <= 0) continue;
    const fx = x + w * (0.17 + p * 0.5);
    suited(
      ctx,
      fx,
      ground + h * 0.02,
      s,
      suit,
      p < 1 ? p * 40 : null,
      g.vehicle !== 'dragon' && g.vehicle !== 'shuttle',
    );
  }
}

// The white room at the top of the tower: the hatch, the closeout crew in white, the last crewman going in.
function whiteRoom(ctx, g, x, y, w, h, k) {
  const year = yearOf(g),
    suit = suitOf(g.vehicle, year);
  ctx.fillStyle = '#e8e7e2';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#d4d3cc';
  ctx.fillRect(x, y + h * 0.82, w, h * 0.18);
  // The spacecraft's side, at the right, and its hatch open: the Shuttle's and Orion's and Dragon's round or square
  // side hatches, the capsules' square ones.
  ctx.fillStyle = g.vehicle === 'shuttle' ? '#f2f1ec' : g.vehicle === 'dragon' ? '#f4f4f2' : '#bfc3c6';
  ctx.fillRect(x + w * 0.6, y, w * 0.4, h);
  ctx.fillStyle = '#16181b';
  const hx = x + w * 0.66,
    hy = y + h * 0.3,
    hs = h * 0.42;
  if (g.vehicle === 'shuttle' || g.vehicle === 'sls') {
    ctx.beginPath();
    ctx.arc(hx + hs / 2, hy + hs / 2, hs / 2, 0, Math.PI * 2);
    ctx.fill();
  } else ctx.fillRect(hx, hy, hs * 0.9, hs);
  ctx.fillStyle = 'rgba(255,214,150,.18)';
  ctx.fillRect(hx + hs * 0.1, hy + hs * 0.15, hs * 0.6, hs * 0.5);
  const s = h * 0.6,
    floor = y + h * 0.88;
  // The closeout crew: white coveralls and caps.
  person(ctx, x + w * 0.18, floor, s, '#f7f6f2', '#d9b08c', '#f7f6f2');
  person(ctx, x + w * 0.34, floor, s, '#f7f6f2', '#c79a74', '#f7f6f2');
  // The last of the crew, crossing to the hatch and in.
  const fx = x + w * (0.42 + Math.min(1, k * 1.4) * 0.22);
  if (k < 0.75) suited(ctx, fx, floor, s, suit, k * 50, false);
  // The pad leader's checklist on the wall.
  ctx.fillStyle = '#9da3a8';
  ctx.fillRect(x + w * 0.04, y + h * 0.12, w * 0.08, h * 0.18);
}

// The window and the cabin, or the Moon's surface from the camera outside.
function cabin(ctx, g, x, y, w, h, f) {
  const surface = f.phase === 'On the surface';
  if (surface) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, w, h);
    const ground = y + h * 0.62;
    ctx.fillStyle = '#8f8b82';
    ctx.fillRect(x, ground, w, y + h - ground);
    ctx.fillStyle = 'rgba(40,38,34,.35)';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.ellipse(x + ((i * 97) % 100) * w * 0.01, ground + ((i * 37) % 30) * h * 0.012, w * 0.03, h * 0.01, 0, 0, 7);
      ctx.fill();
    }
    // The lander, its legs and gold foil.
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(x + w * 0.6, ground - h * 0.22, w * 0.18, h * 0.12);
    ctx.fillStyle = '#b8b8b2';
    ctx.fillRect(x + w * 0.62, ground - h * 0.38, w * 0.14, h * 0.16);
    ctx.strokeStyle = '#b8b8b2';
    ctx.lineWidth = Math.max(1, w / 200);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.6, ground - h * 0.12);
    ctx.lineTo(x + w * 0.56, ground);
    ctx.moveTo(x + w * 0.78, ground - h * 0.12);
    ctx.lineTo(x + w * 0.82, ground);
    ctx.stroke();
    // A walker, slowly crossing in front of it.
    const p = (g.time % 40) / 40;
    suited(ctx, x + w * (0.15 + p * 0.3), ground + h * 0.12, h * 0.4, suitOf('saturn5', 1969), p * 30, false);
    return;
  }
  ctx.fillStyle = '#2b2f33';
  ctx.fillRect(x, y, w, h);
  // The window: what is out there depends on where she is.
  const wx = x + w * 0.52,
    wy = y + h * 0.16,
    ww = w * 0.4,
    wh = h * 0.5;
  ctx.fillStyle = '#05070a';
  ctx.fillRect(wx, wy, ww, wh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(wx, wy, ww, wh);
  ctx.clip();
  const mode = moonWallMode({ flight: f }),
    x01 = f.where?.x ?? 0;
  if (!mode) {
    // Earth orbit: the limb, the blue edge and the cloud below.
    ctx.fillStyle = '#2b5f93';
    ctx.beginPath();
    ctx.arc(wx + ww * 0.5, wy + wh * 2.4, wh * 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(240,240,240,.5)';
    for (let i = 0; i < 6; i++)
      ctx.fillRect(
        wx + ((i * 31 + g.time * 2) % 110) * ww * 0.01,
        wy + wh * (0.68 + (i % 3) * 0.08),
        ww * 0.16,
        wh * 0.03,
      );
  } else if (mode === 'orbit' || mode === 'descent') {
    ctx.fillStyle = '#7d7a72';
    ctx.beginPath();
    ctx.arc(wx + ww * 0.5, wy + wh * 2.2, wh * 1.7, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Out between the two: Earth smaller the farther she is.
    const r = Math.max(2, wh * 0.38 * (1 - Math.min(0.9, x01)));
    ctx.fillStyle = '#2f69a3';
    ctx.beginPath();
    ctx.arc(wx + ww * 0.5, wy + wh * 0.5, r, 0, Math.PI * 2);
    ctx.fill();
    const ex = wx + ww * 0.5,
      ey = wy + wh * 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(80,140,90,.75)';
    ctx.beginPath();
    ctx.ellipse(ex - r * 0.25, ey - r * 0.1, r * 0.35, r * 0.5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245,245,245,.75)';
    ctx.lineWidth = Math.max(1, r * 0.12);
    for (const [a, b, rr] of [
      [-0.3, 0.2, 0.6],
      [0.2, -0.4, 0.45],
      [0.35, 0.45, 0.4],
    ]) {
      ctx.beginPath();
      ctx.arc(ex + a * r, ey + b * r, rr * r, 0.3, 2.2);
      ctx.stroke();
    }
    // The night side, away from the Sun.
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(ex + r * 0.25, ey - r, r, 2 * r);
    ctx.restore();
  }
  ctx.restore();
  ctx.strokeStyle = '#4a4f55';
  ctx.lineWidth = Math.max(2, w / 80);
  ctx.strokeRect(wx, wy, ww, wh);
  // The crew in the cabin: heads and shoulders, floating a little.
  const suit = suitOf(g.vehicle, yearOf(g)),
    n = Math.min(3, crewCount(g));
  for (let i = 0; i < n; i++) {
    const bob = Math.sin(g.time * 0.4 + i * 2) * h * 0.015;
    const cx = x + w * (0.12 + i * 0.15),
      cy = y + h * 0.55 + bob;
    ctx.fillStyle = suit.body;
    ctx.fillRect(cx - w * 0.06, cy, w * 0.12, h * 0.4);
    ctx.fillStyle = '#d6ac86';
    ctx.beginPath();
    ctx.arc(cx, cy - h * 0.06, h * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ['#3a2a1e', '#6b4a2a', '#2a2420'][i % 3];
    ctx.beginPath();
    ctx.arc(cx, cy - h * 0.08, h * 0.08, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = suit.trim;
    ctx.fillRect(cx - w * 0.06, cy + h * 0.08, w * 0.12, h * 0.02);
  }
  ctx.fillStyle = '#4a5056';
  ctx.fillRect(x, y + h * 0.86, w, h * 0.14); // the panel's edge
}

// The count's replays. Returns false when the pad camera should show instead.
export function crewCountShot(ctx, g, x, y, w, h, c) {
  if (!g.crewed || !c || c.kind !== 'flight' || !['count', 'hold'].includes(c.phase) || c.trace?.length) return false;
  const shot = countReplay(c.clock);
  if (!shot) return false;
  const year = yearOf(g);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (shot === 'walkout') walkout(ctx, g, x, y, w, h, (900 - c.clock) / (900 - WALKOUT_FROM));
  else whiteRoom(ctx, g, x, y, w, h, (WALKOUT_FROM - c.clock) / (WALKOUT_FROM - WHITE_ROOM_FROM));
  tube(ctx, x, y, w, h);
  ctx.restore();
  strip(
    ctx,
    x,
    y,
    w,
    h,
    shot === 'walkout' ? 'CREW WALKOUT · THIS MORNING' : 'WHITE ROOM · HATCH CLOSEOUT',
    false,
    year >= 1965,
  );
  return true;
}

// The spacecraft's own television in the flight, when it had one and the board is quiet.
export function cabinShot(ctx, g, x, y, w, h, f) {
  const year = yearOf(g);
  if (!f || !hasCabinTv(g.vehicle, year) || !cabinOn(f, g.time ?? 0)) return false;
  if (moonWallMode({ flight: f }) === 'orbit' && behindMoon(f)) return false;
  if (f.phase === 'Powered descent' || f.phase === 'Entry') return false;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  cabin(ctx, g, x, y, w, h, f);
  tube(ctx, x, y, w, h);
  ctx.restore();
  const cam =
    f.phase === 'On the surface' ? `${f.craft || ''} · SURFACE CAMERA` : `${f.craft || ''} · FROM THE SPACECRAFT`;
  strip(
    ctx,
    x,
    y,
    w,
    h,
    cam.toUpperCase(),
    true,
    year >= 1969 && !(year === 1969 && f.phase === 'On the surface' && /11/.test(f.craft || '')),
  );
  return true;
}
