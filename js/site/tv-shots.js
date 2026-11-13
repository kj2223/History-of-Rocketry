// THE TELEVISION IN MISSION CONTROL during the climb (v0.8 visual pass): the picture changes shot as the real coverage
// did, instead of staying on the pad.
//
// What the room could have had live, by era (checked against NASA's launch imagery and camera fact sheets):
// - The pad camera at liftoff, from Mercury on (the closed-circuit pad picture the room already shows).
// - Then a long-range tracking camera following her up: the live network pool and NASA tracking video that followed
//   every crewed launch from the Cape. Black and white through Mercury; colour from Gemini. Long-range tracking ran
//   to about T+165 s on the Shuttle (KSC launch imagery fact sheet, 2006), so the tracker loses her about then.
// - From STS-112 (October 2002) a live video camera on the Shuttle's external tank, looking down at the orbiter and
//   the boosters, relayed through ascent (NASA fact sheet FS-2005-04-036-MSFC). The booster cameras then were recorded
//   only, so they are not shown here.
// - From the 2020s the launchers carry their own live cameras (Falcon 9 and Crew Dragon, SLS on Artemis).
// The Saturn V's camera pods filmed staging, but on film recovered from the sea: never live, so never on this screen.
//
// Every shot keeps a caption strip with the latest ascent sample, so no reading is lost from the wall.
import { roundShape, yearOf } from './draw.js';
import { flame } from './rockets.js';

// The size of each vehicle as the tracker sees her: tail half-width in site units (as the site's flames use).
const TAIL = { redstone: 6, atlas: 15, titan: 14, saturnib: 18, saturn5: 22, shuttle: 26, sls: 28, dragon: 9 };
export const TRACK_LOST = 165;

// What the room had live in a given year, for a given vehicle.
export function tvSources(year, vehicle) {
  return {
    colour: year == null || year >= 1965,
    onboard:
      vehicle === 'shuttle' && year >= 2002
        ? 'tank'
        : (vehicle === 'sls' || vehicle === 'dragon') && year >= 2020
          ? 'booster'
          : null,
  };
}

// Which shot is on the screen at T+t: the pad camera to T+13, then the tracker; with an onboard camera the director
// cuts between the two, and stays onboard once the tracker has lost her. Without one, the flight's board takes over.
export function tvShot(t, src) {
  if (t < 13) return 'pad';
  if (!src.onboard) return t < TRACK_LOST ? 'track' : 'board';
  if (t < 40) return 'track';
  if (t >= TRACK_LOST) return 'onboard';
  return Math.floor((t - 40) / 14) % 2 === 0 ? 'onboard' : 'track';
}

const met = sec => {
  const s = Math.max(0, Math.round(sec));
  return `T+${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// When the stage on the latest sample began (seconds), for the flash of staging.
function stagedAt(trace) {
  const last = trace.at(-1);
  for (let i = trace.length - 2; i >= 0; i--) if (trace[i].stage !== last.stage) return trace[i + 1].t;
  return null;
}

// The caption strip: which camera, the clock and the readings. Its text is what the old telemetry screen showed.
function caption(ctx, x, y, w, h, cam, last, live) {
  const size = Math.min(w / 30, h / 9);
  ctx.save();
  ctx.fillStyle = 'rgba(6,10,12,.62)';
  ctx.fillRect(x, y + h - size * 2.6, w, size * 2.6);
  ctx.fillRect(x, y, w, size * 1.6);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `bold ${size}px monospace`;
  ctx.fillStyle = '#f1e6c8';
  ctx.fillText(cam, x + w * 0.03, y + size * 0.8, w * 0.5);
  ctx.textAlign = 'right';
  ctx.fillStyle = live ? '#ff6a4a' : '#9fb3ad';
  ctx.fillText(live ? '● LIVE' : 'PLAYBACK', x + w * 0.97, y + size * 0.8);
  ctx.textAlign = 'left';
  ctx.font = `${size * 0.95}px monospace`;
  ctx.fillStyle = '#b7efb0';
  const cells = [
    met(last.t),
    `${last.v.toFixed(2)} km/s`,
    `${last.acc.toFixed(1)} g`,
    `${last.gamma.toFixed(1)}°`,
    `${last.off >= 0 ? '+' : ''}${last.off.toFixed(1)}°`,
  ];
  const widths = [0.26, 0.22, 0.16, 0.18, 0.16];
  let cx = x + w * 0.03;
  cells.forEach((text, i) => {
    ctx.fillText(text, cx, y + h - size * 1.3, w * widths[i] - 6);
    cx += w * widths[i];
  });
  if (last.stage) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#81af9e';
    ctx.font = `${size * 0.8}px monospace`;
    ctx.fillText(last.stage, x + w * 0.97, y + size * 2.4, w * 0.6);
  }
  ctx.restore();
}

// The tube's own grain: scanlines and a dark edge.
function screenLook(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,.13)';
  for (let yy = y; yy < y + h; yy += 3) ctx.fillRect(x, yy, w, 1);
  const r = ctx.createRadialGradient?.(x + w / 2, y + h / 2, h * 0.3, x + w / 2, y + h / 2, w * 0.7);
  if (r) {
    r.addColorStop(0, 'rgba(0,0,0,0)');
    r.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = r;
    ctx.fillRect(x, y, w, h);
  }
}

// How far up she is, 0 on the pad to 1 in near-vacuum, from the time alone (the climb's shape is much the same).
const altitude = t => Math.min(1, Math.max(0, (t - 10) / 150));
const mixc = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const css = ([r, gg, b], a = 1) => `rgba(${r},${gg},${b},${a})`;

// The long-range tracker: she is small and getting smaller, pitched over, her plume and trail behind her, the sky
// darkening as she climbs; the mount's reticle over the picture, and a little hand-shake in the tracking.
export function trackingShot(ctx, g, x, y, w, h, c) {
  const last = c.trace.at(-1),
    t = last.t,
    alt = altitude(t),
    tail = TAIL[g.vehicle] || 12,
    time = g.time || 0;
  const top = mixc([92, 140, 196], [6, 10, 28], alt ** 0.8),
    bottom = mixc([190, 214, 232], [36, 58, 104], alt);
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, css(top));
  sky.addColorStop(1, css(bottom));
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  // Cloud wisps streaming down past the lens while she is low.
  if (alt < 0.45) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - alt / 0.45)})`;
    for (let i = 0; i < 5; i++) {
      const cx = x + ((i * 0.27 + 0.1) % 1) * w,
        cy = y + (((t * 0.9 + i * 0.37) % 1.4) - 0.2) * h;
      ctx.beginPath();
      ctx.ellipse?.(cx, cy, w * 0.14, h * 0.035, 0, 0, 7);
      ctx.fill();
    }
  }
  // Her: centred (the tracker keeps her there, near enough), pitched downrange by her flight-path angle.
  // Close in she fills the frame, so the mount holds her tail low; as she shrinks it centres on her.
  const near = 13 / (13 + Math.max(0, t - 13) * 0.6),
    shake = Math.sin(time * 7.3) * 0.006 + Math.sin(time * 3.1) * 0.004,
    cx = x + w * (0.5 + shake),
    cy = y + h * (0.5 + 0.28 * near + Math.sin(time * 5.7) * 0.006),
    pitch = ((90 - Math.min(90, last.gamma)) * Math.PI) / 180,
    k = ((0.62 * h) / (18 * tail)) * near;
  // The trail: a widening pale band back down to where she came from.
  const back = [-Math.sin(pitch), Math.cos(pitch)];
  const trail = ctx.createLinearGradient(cx, cy, cx + back[0] * h, cy + back[1] * h);
  trail.addColorStop(0, `rgba(250,246,236,${0.75 - alt * 0.4})`);
  trail.addColorStop(1, 'rgba(250,246,236,0)');
  ctx.fillStyle = trail;
  ctx.beginPath();
  const side = [back[1], -back[0]],
    wn = tail * k * 0.9,
    wf = tail * k * 3 + h * 0.08;
  ctx.moveTo(cx + side[0] * wn, cy + side[1] * wn);
  ctx.lineTo(cx + back[0] * h * 1.2 + side[0] * wf, cy + back[1] * h * 1.2 + side[1] * wf);
  ctx.lineTo(cx + back[0] * h * 1.2 - side[0] * wf, cy + back[1] * h * 1.2 - side[1] * wf);
  ctx.lineTo(cx - side[0] * wn, cy - side[1] * wn);
  ctx.fill();
  // High up the plume balloons out in the thin air.
  if (alt > 0.3) {
    const r = h * (0.08 + alt * 0.35);
    const pg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    pg.addColorStop(0, `rgba(255,214,150,${0.5 * alt})`);
    pg.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(cx + back[0] * r * 0.5, cy + back[1] * r * 0.5, r, 0, 7);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  roundShape(ctx, g, 0, 0, pitch, true);
  flame(ctx, 0, 0, 1.4, Math.PI / 2 + pitch, time, tail / 5);
  ctx.restore();
  // Staging: a flash and the spent stage falling away behind her.
  const sAt = stagedAt(c.trace);
  if (sAt != null && t - sAt < 4) {
    const age = t - sAt + (time % 1) * 0.2,
      fr = h * (0.05 + age * 0.06);
    // A soft glow, not a pop (photosensitivity: js/stage/fx/calm.js).
    ctx.fillStyle = `rgba(255,240,210,${0.4 * Math.max(0, 1 - age / 4) ** 2})`;
    ctx.beginPath();
    ctx.arc(cx, cy, fr, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(230,230,224,.9)';
    const dx = cx + back[0] * h * 0.08 * age,
      dy = cy + back[1] * h * 0.08 * age;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(pitch + age * 0.6);
    ctx.fillRect(-tail * k * 0.8, -tail * k * 3, tail * k * 1.6, tail * k * 6);
    ctx.restore();
  }
  // The mount's reticle.
  ctx.strokeStyle = 'rgba(20,24,28,.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h * 0.4);
  ctx.moveTo(x + w / 2, y + h * 0.56);
  ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h * 0.48);
  ctx.lineTo(x + w * 0.44, y + h * 0.48);
  ctx.moveTo(x + w * 0.56, y + h * 0.48);
  ctx.lineTo(x + w, y + h * 0.48);
  ctx.stroke();
}

// The onboard camera: looking down the vehicle's side at the Earth falling away, the plume below, and for the Shuttle
// the orbiter and boosters beside the tank until the boosters go.
export function onboardShot(ctx, g, x, y, w, h, c, kind) {
  const last = c.trace.at(-1),
    t = last.t,
    alt = altitude(t),
    time = g.time || 0;
  // Space above, the Earth below curving away more as she climbs.
  ctx.fillStyle = css(mixc([110, 150, 200], [4, 6, 14], alt ** 0.7));
  ctx.fillRect(x, y, w, h);
  const R = w * (0.9 + (1 - alt) * 3),
    ex = x + w * 0.55,
    ey = y + h * (1.05 - alt * 0.35) + R;
  const earth = ctx.createRadialGradient(ex, ey, R * 0.9, ex, ey, R * 1.02);
  earth.addColorStop(0, '#1f4f86');
  earth.addColorStop(0.97, '#5d9bd0');
  earth.addColorStop(1, 'rgba(140,200,255,0)');
  ctx.fillStyle = earth;
  ctx.beginPath();
  ctx.arc(ex, ey, R * 1.02, 0, 7);
  ctx.fill();
  // Cloud on the ocean, drifting past.
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (((i * 0.13 + t * 0.004) % 0.6) - 0.3);
    ctx.beginPath();
    ctx.ellipse?.(ex + Math.cos(a) * R * 0.97, ey + Math.sin(a) * R * 0.97, w * 0.05, h * 0.012, a + Math.PI / 2, 0, 7);
    ctx.fill();
  }
  // The plume, glowing up from below.
  const pg = ctx.createRadialGradient(x + w * 0.4, y + h, 0, x + w * 0.4, y + h, h * (0.4 + alt * 0.5));
  pg.addColorStop(0, `rgba(255,236,190,${0.85 - alt * 0.3})`);
  pg.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = pg;
  ctx.fillRect(x, y, w, h);
  const shake = Math.sin(time * 31) * w * 0.002 * (1 - alt);
  if (kind === 'tank') {
    // The orbiter's belly and wing below the lens, and both boosters until they go at about T+2 min.
    ctx.fillStyle = '#1d1f22';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2 + shake, y + h);
    ctx.lineTo(x + w * 0.38 + shake, y + h * 0.42);
    ctx.lineTo(x + w * 0.5 + shake, y + h * 0.42);
    ctx.lineTo(x + w * 0.75 + shake, y + h);
    ctx.fill();
    const sepAt = last.stage === 'Main engines' ? (stagedAt(c.trace) ?? 0) : null;
    for (const s of [-1, 1]) {
      const away = sepAt == null ? 0 : (t - sepAt) * 0.08;
      if (away > 1.5) continue;
      ctx.save();
      ctx.translate(x + w * (0.45 + s * (0.32 + away * 0.6)) + shake, y + h * (0.55 + away * 0.5));
      ctx.rotate(s * away * 1.2);
      ctx.fillStyle = '#e9e6dd';
      ctx.fillRect(-w * 0.04, -h * 0.5, w * 0.08, h * 1.1);
      ctx.restore();
    }
    // The tank's own wall at the edge of the frame.
    ctx.fillStyle = '#b8642f';
    ctx.fillRect(x, y, w * 0.08, h);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (let i = 0; i < 6; i++) ctx.fillRect(x + w * 0.012 * i, y, 1, h);
  } else {
    // The launcher's side down the left of the frame, the core's colour.
    ctx.fillStyle = g.vehicle === 'sls' ? '#c2733a' : '#ecebe6';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.12 + shake, y);
    ctx.lineTo(x + w * 0.2 + shake, y + h);
    ctx.lineTo(x, y + h);
    ctx.fill();
  }
}

// The whole screen: the shot for the moment, under its caption. Returns false when the board should show instead.
export function televisionShot(ctx, g, x, y, w, h) {
  const c = g.console,
    last = c?.trace?.at(-1);
  if (!last) return false;
  const src = tvSources(g.day == null ? null : yearOf(g), g.vehicle),
    shot = tvShot(last.t, src);
  if (shot === 'pad' || shot === 'board') return false;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (!src.colour) ctx.filter = 'grayscale(1) contrast(1.15)';
  if (shot === 'onboard') onboardShot(ctx, g, x, y, w, h, c, src.onboard);
  else trackingShot(ctx, g, x, y, w, h, c);
  ctx.filter = 'none';
  screenLook(ctx, x, y, w, h);
  const cam =
    shot === 'onboard'
      ? src.onboard === 'tank'
        ? 'TANK CAMERA'
        : 'VEHICLE CAMERA'
      : last.t < 40
        ? 'TRACKING · SHORT RANGE'
        : 'TRACKING · LONG RANGE';
  caption(ctx, x, y, w, h, cam, last, true);
  ctx.restore();
  return true;
}
