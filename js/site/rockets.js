// THE ROCKETS, in the flat style of the v0.8 rooms: flat paint, light from the left with a darker band down the side
// away from it and a thin highlight on the lit side, a fine dark outline, panel seams and roll bands, and the engine
// bells under the tail. Each is drawn from its tail at (x, y), pointing along angle (0 = straight up), with the same
// proportions the old shapes had, so everything that sits a rocket on a stand, a truck, a tower or a cradle still fits.
// They draw on a 2D canvas, so the site, the hangar, the stand, the television and the old drawing all share them.

const OUTLINE = 'rgba(28,24,20,.55)';
const SHADE = 'rgba(40,30,22,.17)';
const SHADE_DEEP = 'rgba(40,30,22,.14)';
const LIGHT = 'rgba(255,255,255,.38)';
const SEAM = 'rgba(40,34,28,.28)';

// Which side of the body (in the rocket's own frame) faces away from the light: the sun is up and to the left, so a
// standing rocket is darker on its right, and one lying nose-left is darker underneath.
const awaySide = angle => (Math.cos(angle) + Math.sin(angle) >= 0 ? 1 : -1);

// A cylinder from x = -half..half, y = top..bottom (top is the more negative).
function tube(ctx, half, top, bottom, color, s, seams = []) {
  const h = bottom - top;
  ctx.fillStyle = color;
  ctx.fillRect(-half, top, half * 2, h);
  const w = half * 2;
  ctx.fillStyle = SHADE;
  ctx.fillRect(s > 0 ? half - w * 0.3 : -half, top, w * 0.3, h);
  ctx.fillStyle = SHADE_DEEP;
  ctx.fillRect(s > 0 ? half - w * 0.1 : -half, top, w * 0.1, h);
  ctx.fillStyle = LIGHT;
  ctx.fillRect(s > 0 ? -half + w * 0.16 : half - w * 0.16 - Math.max(1, w * 0.09), top, Math.max(1, w * 0.09), h);
  ctx.fillStyle = SEAM;
  for (const y of seams) ctx.fillRect(-half, y, w, 0.7);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.7;
  ctx.strokeRect(-half, top, w, h);
}
// A band of paint across the body (a roll band, an interstage), shaded with it.
function band(ctx, half, y, h, color, s) {
  ctx.fillStyle = color;
  ctx.fillRect(-half, y, half * 2, h);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(s > 0 ? half - half * 0.6 : -half, y, half * 0.6, h);
}
// A checker or roll pattern block on one side of the body.
function block(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
// A closed outline shape (a nose, a fairing, an adapter, a fin), filled, shaded on the far half, and outlined.
function shape(ctx, pts, color, s, shadeIt = true) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  };
  ctx.fillStyle = color;
  path();
  ctx.fill();
  if (shadeIt) {
    ctx.save();
    path();
    ctx.clip();
    ctx.fillStyle = SHADE;
    ctx.fillRect(s > 0 ? 0 : -400, -1000, 400, 2000);
    ctx.restore();
  }
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.7;
  path();
  ctx.stroke();
}
// A curved nose (an ogive), from the body's top at y with half-width half, to the tip at y - len.
function ogive(ctx, half, y, len, color, s) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-half, y);
    ctx.quadraticCurveTo(-half * 0.85, y - len * 0.65, 0, y - len);
    ctx.quadraticCurveTo(half * 0.85, y - len * 0.65, half, y);
    ctx.closePath();
  };
  ctx.fillStyle = color;
  path();
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = SHADE;
  ctx.fillRect(s > 0 ? half * 0.1 : -half - 1, y - len - 1, half * 0.9 + 1, len + 2);
  ctx.restore();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.7;
  path();
  ctx.stroke();
}
// A pair of fins at the tail, either side: from the body's edge at half, out to span, height h.
function fins(ctx, half, span, h, color, rake = 0, base = 0) {
  for (const k of [-1, 1])
    shape(ctx, [k * half, base - h, k * span, base - rake, k * span, base, k * half, base], color, k, false);
}
// The engine bells, just inside the tail.
function bells(ctx, xs, w, y = 0) {
  for (const x of xs) {
    ctx.fillStyle = '#2a2b2e';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, y - 3);
    ctx.lineTo(x + w * 0.3, y - 3);
    ctx.lineTo(x + w * 0.5, y);
    ctx.lineTo(x - w * 0.5, y);
    ctx.closePath();
    ctx.fill();
  }
}

// Lettering painted up a rocket's body, `along` units from the tail, in the shape's own frame (rotated by angle). It reads
// bottom to top when she stands; lying nose-left (on a truck, on hangar cradles) it is turned so it never reads upside down.
function bodyText(ctx, text, along, angle, size = 7, color = '#2c3440') {
  const flip = Math.cos(angle - Math.PI / 2) < -0.01;
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.rotate(flip ? Math.PI / 2 : -Math.PI / 2);
  ctx.textBaseline = 'middle';
  ctx.fillText(text, flip ? -along : along, 0);
  ctx.restore();
}
const frame = (ctx, x, y, angle) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  return awaySide(angle);
};

// ---- the spacecraft ----
// Mercury: the black shingled cone with its ribs, the recovery can on top, the heat shield under it, and the escape tower.
export function capsuleShape(ctx, x, y, tower, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  const s = awaySide(angle);
  shape(ctx, [-9, 0, 9, 0, 4, -14, -4, -14], '#24262a', s);
  ctx.strokeStyle = 'rgba(160,165,170,.35)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (const k of [-0.5, 0, 0.5]) {
    ctx.moveTo(k * 18, 0);
    ctx.lineTo(k * 8, -14);
  }
  ctx.stroke();
  shape(ctx, [-3, -14, 3, -14, 3, -20, -3, -20], '#2e3034', s);
  ctx.fillStyle = '#8c7a5e';
  ctx.fillRect(-9, 0, 18, 2);
  ctx.fillStyle = 'rgba(160,190,210,.8)';
  ctx.fillRect(-2.5, -9, 2, 3); // the window
  if (tower) {
    ctx.strokeStyle = '#c2352a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-3, -20);
    ctx.lineTo(-1.2, -40);
    ctx.moveTo(3, -20);
    ctx.lineTo(1.2, -40);
    for (let i = 1; i < 5; i++) {
      const yy = -20 - i * 4,
        w = 3 - i * 0.45;
      ctx.moveTo(-w, yy);
      ctx.lineTo(w, yy - 4);
    }
    ctx.stroke();
    shape(ctx, [-1.8, -38, 1.8, -38, 1.8, -46, 0, -49, -1.8, -46], '#c2352a', s, false);
  }
  ctx.restore();
}

// ---- the vehicles ----
// Mercury-Redstone: the white Redstone with its stubby fins, the black instrument band, the capsule and its tower.
// padAbort: after the four-inch flight, with the tower gone and the parachutes hanging off the capsule.
export function mercuryRedstoneShape(ctx, x, y, angle, padAbort = false) {
  const s = frame(ctx, x, y, angle);
  fins(ctx, 6, 12, 12, '#d8d4c8');
  tube(ctx, 6, -84, 0, '#f1efe8', s, [-40]);
  band(ctx, 6, -60, 4, '#1d1f22', s);
  band(ctx, 6, -20, 3, '#1d1f22', s);
  block(ctx, -6, -84, 6, 8, '#1d1f22');
  bodyText(ctx, 'UNITED STATES', 38, angle, 5);
  bells(ctx, [0], 9);
  tube(ctx, 6, -90, -84, '#c7c2b6', s);
  capsuleShape(ctx, 0, -90, !padAbort, angle);
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

// Viking: the Navy's slim aluminium sounding rocket, blue bands, a long ogive, and swept fins.
export function vikingShape(ctx, x, y, angle) {
  const s = frame(ctx, x, y, angle);
  fins(ctx, 5, 13, 14, '#9aa0a8', 2);
  tube(ctx, 5, -100, 0, '#eeece5', s, [-45, -80]);
  band(ctx, 5, -60, 3, '#2b3f6b', s);
  band(ctx, 5, -30, 3, '#2b3f6b', s);
  bodyText(ctx, 'NAVY', 72, angle, 5, '#2b3f6b');
  ogive(ctx, 5, -100, 18, '#eeece5', s);
  bells(ctx, [0], 8);
  ctx.restore();
}

// Juno II: the Jupiter, fat and white with black roll stripes, then JPL's tub of upper stages under a shroud and the small
// gold Pioneer cone.
export function junoShape(ctx, x, y, angle) {
  const s = frame(ctx, x, y, angle);
  tube(ctx, 12, -150, 0, '#f2f0e9', s, [-75]);
  band(ctx, 12, -40, 6, '#26272b', s);
  band(ctx, 12, -110, 6, '#26272b', s);
  block(ctx, -12, -150, 12, 20, '#26272b');
  block(ctx, 0, -20, 12, 14, '#26272b');
  bodyText(ctx, 'U.S. ARMY', 75, angle, 6);
  shape(ctx, [-12, -150, -8, -200, 8, -200, 12, -150], '#d9d6cc', s);
  ctx.fillStyle = SEAM;
  ctx.fillRect(-10, -175, 20, 0.7);
  shape(ctx, [-5, -200, 0, -218, 5, -200], '#c9a24a', s);
  bells(ctx, [0], 16);
  ctx.restore();
}

// Atlas-Agena B with Ranger: the Atlas's steel balloon, its booster skirt, the slim Agena and the shroud over the Ranger.
export function atlasAgenaShape(ctx, x, y, angle) {
  const s = frame(ctx, x, y, angle);
  atlas(ctx, s, angle);
  tube(ctx, 7, -232, -170, '#e8e6df', s, [-200]);
  band(ctx, 7, -176, 4, '#3a3d42', s);
  shape(ctx, [-8, -232, -8, -250, 0, -270, 8, -250, 8, -232], '#f2f0e9', s);
  ctx.restore();
}
// The Atlas: a stainless balloon tank with its hoop seams, the wider booster skirt, and the two booster bells.
function atlas(ctx, s, angle) {
  tube(ctx, 14, -170, 0, '#c9ccd1', s, [-60, -85, -110, -135, -160]);
  tube(ctx, 17, -36, 0, '#b3b7bd', s, [-18]);
  ctx.fillStyle = 'rgba(40,40,44,.35)';
  ctx.fillRect(-17, -36, 34, 1.2);
  bodyText(ctx, 'UNITED STATES', 100, angle);
  bells(ctx, [-9, 9], 10);
  bells(ctx, [0], 6);
}

// Mercury-Atlas: the Atlas D, an adapter, the capsule and its escape tower.
export function mercuryAtlasShape(ctx, x, y, angle) {
  const s = frame(ctx, x, y, angle);
  atlas(ctx, s, angle);
  shape(ctx, [-14, -170, -9, -180, 9, -180, 14, -170], '#d8d4c8', s);
  capsuleShape(ctx, 0, -180, true, angle);
  ctx.restore();
}

// Gemini-Titan II: the Titan's two stages in white with black bands, the adapter, and the dark Gemini spacecraft on top.
// No escape tower: Gemini's crew had ejection seats.
export function geminiTitanShape(ctx, x, y, angle) {
  const s = frame(ctx, x, y, angle);
  tube(ctx, 15, -150, 0, '#e9e7e0', s, [-105]);
  band(ctx, 15, -150, 8, '#2b2d31', s);
  band(ctx, 15, -60, 5, '#2b2d31', s);
  tube(ctx, 15, -200, -150, '#e9e7e0', s, [-175]);
  ctx.strokeStyle = 'rgba(40,40,44,.4)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const k of [-0.3, 0.3]) {
    ctx.moveTo(k * 30, -150);
    ctx.lineTo(k * 30, -142);
  }
  ctx.stroke(); // the interstage truss
  shape(ctx, [-15, -200, -12, -222, 12, -222, 15, -200], '#d9d6cc', s);
  shape(ctx, [-12, -222, -6, -246, -4, -258, 4, -258, 6, -246, 12, -222], '#26282c', s);
  ctx.fillStyle = 'rgba(160,190,210,.7)';
  ctx.fillRect(-4, -240, 3, 3);
  bodyText(ctx, 'UNITED STATES', 90, angle);
  bells(ctx, [-6, 6], 10);
  ctx.restore();
}

// The Shuttle stack.
export function shuttleShape(ctx, x, y, angle) {
  // Seen from the side, as the crawler-way photographs show her: the external tank in the middle, the near booster
  // in front of it (the far one hidden behind), and the orbiter in profile on the tank's right, belly against it,
  // nose up, the tail fin standing out to the right and the three main engines at her tail.
  const s = frame(ctx, x, y, angle);
  ctx.save();
  ctx.translate(-6, 0);
  tube(ctx, 11, -160, -4, '#c0703e', s, [-120, -60]);
  ogive(ctx, 11, -160, 22, '#c0703e', s);
  ctx.fillStyle = '#9c5a30';
  ctx.fillRect(-11, -112, 22, 3); // the intertank
  ctx.restore();
  // The near booster, in front of the tank.
  ctx.save();
  ctx.translate(-8, 0);
  tube(ctx, 6.5, -150, 0, '#ece8de', s, [-100, -50]);
  ogive(ctx, 6.5, -150, 12, '#ece8de', s);
  band(ctx, 6.5, -12, 12, '#2e3034', s);
  ctx.restore();
  // The orbiter in profile: belly line on the tank at x = 5, the payload-bay doors along x = 17, the cockpit hump and
  // nose at the top, the OMS pod and the tail fin at the aft end.
  const B = 5,
    T = 17,
    aft = -14,
    nose = -150;
  ctx.fillStyle = '#26282c';
  ctx.fillRect(B + 2, -40, 10, 10); // the wing root, seen side-on behind the fuselage
  shape(
    ctx,
    [
      B,
      aft,
      B,
      nose + 14,
      B + 2,
      nose + 3,
      B + 6,
      nose,
      B + 11,
      nose + 4,
      T + 2,
      nose + 16,
      T + 1,
      nose + 24,
      T,
      nose + 30,
      T,
      aft - 18,
      T - 2,
      aft,
    ],
    '#f2f0ea',
    s,
    false,
  );
  ctx.fillStyle = SHADE;
  ctx.fillRect(T - 4, nose + 30, 4, aft - nose - 30); // the far side of her fuselage, away from the light
  // Black tiles along the belly and the nose cap, the payload-bay door line and the windows.
  ctx.fillStyle = '#2a2c30';
  ctx.beginPath();
  ctx.moveTo(B, aft);
  ctx.lineTo(B, nose + 14);
  ctx.lineTo(B + 2, nose + 3);
  ctx.lineTo(B + 6, nose);
  ctx.lineTo(B + 6.5, nose + 3);
  ctx.lineTo(B + 3.5, nose + 6);
  ctx.lineTo(B + 2.4, nose + 16);
  ctx.lineTo(B + 2.4, aft);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = SEAM;
  ctx.fillRect(T - 2.5, nose + 30, 0.8, aft - 14 - (nose + 30)); // the payload-bay door line
  ctx.fillStyle = '#2e3440';
  for (const yy of [nose + 10, nose + 13]) ctx.fillRect(B + 9, yy, 4, 1.6);
  // The OMS pod and the tail fin, standing out to the right at her tail.
  shape(ctx, [T, aft - 4, T + 5, aft - 6, T + 5, aft - 22, T, aft - 26], '#e8e4da', s, false);
  shape(ctx, [T, aft - 36, T + 16, aft - 14, T + 16, aft - 6, T, aft - 4], '#f2f0ea', s, false);
  ctx.fillStyle = '#2a2c30';
  ctx.fillRect(T + 14, aft - 15, 2, 9); // the fin's tip
  // The three main engines, angled down under her tail, and the lettering on her side.
  bells(ctx, [B + 4, B + 8, B + 12], 5, aft);
  ctx.save();
  ctx.translate(B + 7, 0);
  bodyText(ctx, 'UNITED STATES', 95, angle, 5, '#2c3440');
  ctx.restore();
  bells(ctx, [-8], 9);
  ctx.restore();
}

// The late campaign's stacks: SLS's orange core and its two boosters, or the Falcon 9 with a Dragon on top.
export function modernLauncher(ctx, x, y, angle, vehicle) {
  const sls = vehicle === 'sls';
  const half = sls ? 16 : 9;
  const core = sls ? 244 : 150;
  const upper = sls ? 310 : 205;
  const s = frame(ctx, x, y, angle);
  if (sls)
    for (const bx of [-23.5, 23.5]) {
      ctx.save();
      ctx.translate(bx, 0);
      tube(ctx, 6.5, -157, -9, '#e9e6dd', s, [-22, -52, -82, -112, -142]);
      shape(ctx, [-6.5, -157, 0, -174, 6.5, -157], '#e9e6dd', s);
      band(ctx, 6.5, -10, 6, '#515554', s);
      ctx.restore();
    }
  tube(ctx, half, -core, -8, sls ? '#c97f4a' : '#eeece6', s, sls ? [-60, -120, -180] : [-60, -120]);
  band(ctx, half, -14, 7, '#272c30', s);
  tube(ctx, half, -upper, -core, '#e7e5dd', s);
  band(ctx, half, -core - 7, 4, '#4c5155', s);
  if (sls) {
    bodyText(ctx, 'NASA', 120, angle, 9, '#2b3f6b');
    ogive(ctx, half, -upper, 31, '#f0eee6', s);
    ctx.fillStyle = '#d1d3cf';
    ctx.fillRect(-1.5, -upper - 49, 3, 20); // Orion's abort tower
  } else {
    bodyText(ctx, 'FALCON', 90, angle, 6, '#2c3440');
    // The Dragon: a blunt capsule on its trunk, the black nose cap.
    shape(
      ctx,
      [
        -half,
        -upper,
        -half * 0.65,
        -upper - 12,
        -half * 0.3,
        -upper - 26,
        half * 0.3,
        -upper - 26,
        half * 0.65,
        -upper - 12,
        half,
        -upper,
      ],
      '#f0eee6',
      s,
    );
    band(ctx, half, -upper - 2, 2, '#303943', s);
    block(ctx, -half * 0.3, -upper - 26, half * 0.6, 3, '#303943');
    ctx.fillStyle = '#303943';
    ctx.fillRect(-half - 2, -44, 2, 29);
    ctx.fillRect(half, -44, 2, 29); // the landing legs, folded
  }
  bells(ctx, sls ? [-8, 0, 8] : [-4, 4], 8);
  ctx.restore();
}

// The Saturn V: three white stages with black roll bands, the lander's adapter, the command module and its escape tower.
export function saturnVShape(ctx, x, y, angle) {
  const s = frame(ctx, x, y, angle);
  fins(ctx, 22, 28, 22, '#e6e3da', 4);
  tube(ctx, 22, -150, 0, '#f1efe8', s, [-120, -75]);
  for (const yy of [-150, -100, -50]) block(ctx, -22, yy, 22, 18, '#26282c');
  block(ctx, 0, -132, 22, 18, '#26282c');
  block(ctx, 0, -82, 22, 18, '#26282c');
  bodyText(ctx, 'USA', 18, angle, 8);
  tube(ctx, 22, -250, -150, '#f1efe8', s, [-200]);
  band(ctx, 22, -160, 8, '#26282c', s);
  bodyText(ctx, 'UNITED STATES', 200, angle, 7);
  shape(ctx, [-22, -250, -15, -262, 15, -262, 22, -250], '#f1efe8', s);
  tube(ctx, 15, -312, -262, '#f1efe8', s);
  band(ctx, 15, -312, 6, '#26282c', s);
  shape(ctx, [-15, -312, -11, -340, 11, -340, 15, -312], '#e6e3da', s); // the lander adapter
  tube(ctx, 11, -356, -340, '#c9ccd1', s); // the service module
  shape(ctx, [-11, -356, -3, -372, 3, -372, 11, -356], '#d8d6cf', s); // the command module
  ctx.strokeStyle = '#b33';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-2, -372);
  ctx.lineTo(-0.8, -392);
  ctx.moveTo(2, -372);
  ctx.lineTo(0.8, -392);
  ctx.stroke(); // the escape tower
  shape(ctx, [-1.5, -390, 1.5, -390, 0, -400], '#b33', s, false);
  bells(ctx, [-14, -5, 5, 14], 10);
  ctx.restore();
}

// Vanguard: slim and tall, white with a black band, three stages stacked, the small third stage under a pointed fairing.
export function vanguardShape(ctx, x, y, angle) {
  const s = frame(ctx, x, y, angle);
  tube(ctx, 6, -128, 0, '#f3f1ea', s, [-95]);
  tube(ctx, 5, -178, -128, '#e7e4da', s, [-150]);
  band(ctx, 6, -132, 5, '#26272b', s);
  band(ctx, 6, -60, 4, '#26272b', s);
  shape(ctx, [-5, -178, -4, -196, 0, -210, 4, -196, 5, -178], '#c8c4b8', s);
  bodyText(ctx, 'NAVY', 90, angle, 6, '#2b3f6b');
  bells(ctx, [0], 9);
  ctx.restore();
}

// A captured V-2, black-and-white checked as at White Sands, with a WAC Corporal on its nose when it is a Bumper.
export function v2Shape(ctx, x, y, angle, withWac) {
  const s = frame(ctx, x, y, angle);
  fins(ctx, 7, 16, 20, '#1d1f24', 0, 2);
  tube(ctx, 7, -84, 0, '#ece8dc', s);
  block(ctx, 0, -84, 7, 21, '#1d1f24');
  block(ctx, -7, -63, 7, 21, '#1d1f24');
  block(ctx, 0, -42, 7, 21, '#1d1f24');
  block(ctx, -7, -21, 7, 21, '#1d1f24');
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.7;
  ctx.strokeRect(-7, -84, 14, 84);
  ogive(ctx, 7, -84, 20, '#ece8dc', s);
  bells(ctx, [0], 10);
  if (withWac) wacShape(ctx, 0, -100, 0, false);
  ctx.restore();
}

// WAC Corporal upper stage (and the Tiny Tim booster under it when mated). Widths are exaggerated so it reads.
export function wacShape(ctx, x, y, angle, withBooster) {
  const s = frame(ctx, x, y, angle);
  let base = 0;
  if (withBooster) {
    boosterShape(ctx, 0, 0, 0, true, s);
    base = -26;
  }
  fins(ctx, 3.5, 9, 8, '#9aa0a8', 0, base);
  tube(ctx, 3.5, base - 48, base, '#e9e4d6', s, [base - 20]);
  band(ctx, 3.5, base - 30, 2, '#20232a', s);
  shape(ctx, [-3.5, base - 48, 0, base - 60, 3.5, base - 48], '#c03a2b', s);
  bells(ctx, [0], 5, base);
  ctx.restore();
}

// The Tiny Tim booster: a short dark motor with its own fins. attached: drawn in the WAC's frame; else lying nose-left.
export function boosterShape(ctx, x, y, angle, attached, side) {
  ctx.save();
  ctx.translate(x, y);
  if (!attached) ctx.rotate(-Math.PI / 2);
  const s = side ?? awaySide(attached ? angle : -Math.PI / 2);
  fins(ctx, 5, 12, 10, '#3c3f44');
  tube(ctx, 5, -26, 0, '#5d6168', s, [-13]);
  bells(ctx, [0], 7);
  ctx.restore();
}

// ---- the flame on the canvas (the stand, the television): flat layers, an orange body, a yellow core and a white
// heart, with the shock diamonds and a flicker. Drawn from the nozzle at (x, y) along angle.
export function flame(ctx, x, y, power, angle, time, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle - Math.PI / 2);
  const flick = Math.sin(time * 40) * 0.5 + Math.sin(time * 67) * 0.5,
    len = (30 + 8 * flick) * power * scale,
    w = 5 * scale;
  const tongue = (k, wk, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w * wk, 0);
    ctx.quadraticCurveTo(-w * wk * 1.2, len * k * 0.45, flick * scale, len * k);
    ctx.quadraticCurveTo(w * wk * 1.2, len * k * 0.45, w * wk, 0);
    ctx.closePath();
    ctx.fill();
  };
  tongue(1, 1, 'rgba(240,120,40,.85)');
  tongue(0.75, 0.75, 'rgba(255,196,80,.92)');
  tongue(0.45, 0.45, 'rgba(255,248,220,.97)');
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 1; i <= 3; i++) {
    const yy = len * 0.12 * i,
      r = (1.6 - i * 0.3) * scale;
    ctx.beginPath();
    ctx.moveTo(0, yy - r * 1.6);
    ctx.lineTo(r, yy);
    ctx.lineTo(0, yy + r * 1.6);
    ctx.lineTo(-r, yy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
