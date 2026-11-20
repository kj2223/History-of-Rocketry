// THE SIMULATOR ROOM IN THREE-QUARTERS (2D-HD rework, Aaron 20 November 2026): the training room seen from above and
// behind the consoles, as a lit diorama in pixels. The SIMULATION sign over the door on the back wall (lit red while a
// run is on), the telemetry screen and the sim clock beside it, the supervisor in his glass booth at the side with his
// failures board, and the consoles on the floor: yours in front with you at it, a spare row behind. The screens light
// the room blue-green; the fluorescent tubes throw a pool of light on the floor and a soft shadow under each desk and
// chair. The near edge is out of focus. The sim itself is run at your console, which the scene zooms into (sim.js,
// fx/zoom-view.js). 320 x 180 art pixels. Presentation only.
import { BlurFilter, Container, Rectangle } from '../vendor/pixi.min.mjs';
import { PX, pixelLayer, shade, pixelBack } from './pixel.js';
import { hdLayer } from './fx/hd.js';
import { label, setText } from './kit.js';

const WALL = 56;
const SHADOW = 0x090b12;
// Your console, and the spare row behind it (art pixels).
const YOURS = { x: 116, y: 112, w: 88, h: 16 };
const SPARE = [
  { x: 52, y: 80, w: 64 },
  { x: 128, y: 80, w: 64 },
  { x: 204, y: 80, w: 64 },
];

export function simRoom({ you, pass = true }) {
  const root = new Container();
  root.label = 'sim-room';
  const M = { mx: 80, my: 40 };
  const far = pixelLayer(320, 180, M),
    floor = pixelLayer(320, 180, M),
    shadows = pixelLayer(320, 180, M),
    live = pixelLayer(320, 180, M),
    near = pixelLayer(320, 180, M);
  root.addChild(far.sprite, floor.sprite, shadows.sprite, live.sprite, near.sprite);
  const hd = hdLayer(320, 180, M);
  root.addChild(hd.root);
  if (pass) hd.root.crisp = near.sprite.crisp = true;
  const type = new Container();
  root.addChild(type);
  const say = (text, size, color, x, y, opts = {}) => {
    const t = label(text, size, color, { bold: true, ...opts });
    t.position.set(x * PX, y * PX);
    type.addChild(t);
    return t;
  };
  const farBlur = new BlurFilter({ strength: 2, quality: 2 }),
    nearBlur = new BlurFilter({ strength: 8, quality: 3 }),
    shadowBlur = new BlurFilter({ strength: 3, quality: 2 });
  const L0 = -M.mx,
    LW = 320 + 2 * M.mx;

  // ---- the back wall: seams, the rail, the sign, the screen, the clock ----
  const F = far;
  F.vgrad(L0, -M.my, LW, WALL + M.my, [0x1f242b, 0x2a2f36, 0x30353c]);
  for (let x = L0; x < L0 + LW; x += 24) F.rect(x, -M.my, 1, WALL + M.my, 0x343a42);
  F.rect(L0, WALL - 10, LW, 3, 0x242931);
  F.rect(L0, WALL - 10, LW, 1, 0x4b5156);
  F.rect(L0, WALL - 2, LW, 2, 0x15181c);
  const SIGN = { x: 128, y: 2, w: 64, h: 10 };
  F.rect(SIGN.x - 1, SIGN.y - 1, SIGN.w + 2, SIGN.h + 2, 0x15181c);
  const signWord = say('SIMULATION', 14, 0x8a6a60, SIGN.x + SIGN.w / 2, SIGN.y + SIGN.h / 2, { spacing: 3 });
  const TV = { x: 22, y: 16, w: 132, h: 32 };
  F.rect(TV.x - 2, TV.y - 2, TV.w + 4, TV.h + 4, 0x181b1f);
  const CK = { x: 166, y: 18, w: 54, h: 24 };
  F.rect(CK.x - 2, CK.y - 2, CK.w + 4, CK.h + 4, 0x181b1f);
  F.rect(CK.x, CK.y, CK.w, CK.h, 0x120d08);
  const clockDigits = say('--:--', 30, 0xff9a3c, CK.x + CK.w / 2, CK.y + 9, { family: 'Courier New, monospace' });
  const clockWord = say('STANDBY', 12, 0xe8c66a, CK.x + CK.w / 2, CK.y + 19);
  F.commit();

  // ---- the floor, the supervisor's booth, the consoles ----
  const Fl = floor;
  const carpet = 0x34312c;
  Fl.vgrad(L0, WALL, LW, 180 + M.my - WALL, [shade(carpet, 0.75), shade(carpet, 0.92), carpet, shade(carpet, 1.04)]);
  for (let y = WALL; y < 180 + M.my; y++)
    for (let x = L0 + ((y * 3) % 4); x < L0 + LW; x += 4)
      if ((x * 7 + y * 13) % 11 === 0) Fl.px(x, y, shade(carpet, 1.08));
  // The booth: its glass front toward us, the supervisor's desk and board inside, its roof edge.
  const BO = { x: 240, y: 30, w: 72, h: 50 };
  Fl.rect(BO.x, BO.y, BO.w, BO.h, 0x2c3a48);
  Fl.rect(BO.x + 4, BO.y + 4, BO.w - 8, BO.h - 8, 0x3a4a5a);
  Fl.rect(BO.x, BO.y, BO.w, 3, 0x6b7278);
  Fl.rect(BO.x + 6, BO.y + BO.h - 16, BO.w - 12, 8, 0x4b5258); // his desk
  Fl.rect(BO.x + 6, BO.y + BO.h - 16, BO.w - 12, 1, 0x6b7278);
  Fl.rect(BO.x, BO.y + BO.h, BO.w, 3, 0x1e2226);
  const sup = { x: BO.x + BO.w / 2, top: BO.y + 22 };
  // The consoles: a cabinet top, the sloping face with its screens, a ledge.
  const console_ = (x, y, w, mine) => {
    Fl.rect(x - 2, y - 3, w + 4, 3, 0x343a40);
    Fl.rect(x - 2, y, w + 4, 12, 0x414950);
    Fl.rect(x - 2, y, w + 4, 1, 0x626a71);
    for (let sx = x + 3; sx < x + w - 12; sx += 16) {
      Fl.rect(sx, y + 2, 12, 7, 0x161e24);
      Fl.rect(sx, y + 2, 12, 1, 0x243139);
    }
    Fl.rect(x - 4, y + 12, w + 8, 4, 0x5c646a);
    Fl.rect(x - 4, y + 12, w + 8, 1, 0x7a838a);
    if (mine) Fl.box(x - 2, y, w + 4, 12, 0xe8c66a);
  };
  for (const s of SPARE) console_(s.x, s.y, s.w, false);
  console_(YOURS.x, YOURS.y, YOURS.w, true);
  // The chairs at the spare row, pushed in and empty.
  for (const s of SPARE)
    for (let cx = s.x + 14; cx < s.x + s.w; cx += 36) {
      Fl.rect(cx - 6, s.y + 18, 12, 7, 0x2b2520);
      Fl.rect(cx - 5, s.y + 18, 10, 1, 0x4a3f34);
    }
  // Cables taped across the floor to the booth.
  for (let x = YOURS.x + YOURS.w + 4; x < BO.x + 10; x++)
    Fl.px(x, Math.round(124 - (x - YOURS.x - YOURS.w) * 0.55), 0x1e1e1e);
  Fl.commit();
  say('YOU · SIM CONSOLE', 14, 0xe8c66a, YOURS.x + YOURS.w / 2, YOURS.y - 7);
  say('SIM SUPERVISOR', 13, 0xd8d2c0, BO.x + BO.w / 2, BO.y + BO.h + 7, { family: 'Georgia, serif', bold: false });

  // ---- the near edge: the back of the observers' rail, out of focus ----
  const N = near;
  N.rect(L0, 168, LW, 72, 0x22262b);
  N.rect(L0, 168, LW, 2, 0x4b5156);
  N.rect(60, 162, 22, 8, 0xe8e0c8);
  N.commit();

  const deskHit = new Container();
  deskHit.eventMode = 'static';
  deskHit.cursor = 'pointer';
  deskHit.hitArea = new Rectangle((YOURS.x - 6) * PX, (YOURS.y - 10) * PX, (YOURS.w + 12) * PX, 50 * PX);
  root.addChild(deskHit);

  function update({ c, lit, hdOn, t, k }) {
    far.sprite.filters = hdOn && !pass ? [farBlur] : null;
    near.sprite.filters = hdOn ? [nearBlur] : null;
    shadows.sprite.filters = hdOn ? [shadowBlur] : null;
    farBlur.strength = 0.3 * PX * k;
    nearBlur.strength = 1.6 * PX * k;
    shadowBlur.strength = pass ? 1.5 : 0.6 * PX * k;
    shadows.sprite.alpha = 0.5;
    setText(
      clockDigits,
      c
        ? c.phase === 'count' || c.poll || c.phase === 'hold'
          ? `T-${Math.floor(Math.ceil(c.clock) / 60)}:${String(Math.ceil(c.clock) % 60).padStart(2, '0')}`
          : c.phase === 'debrief'
            ? 'END'
            : `T+${Math.floor(c.t || 0)}`
        : '--:--',
    );
    setText(clockWord, c ? (c.poll ? 'POLL' : (c.phase || '').toUpperCase()) : 'STANDBY');
    signWord.style.fill = c ? 0xfff2e8 : 0x8a6a60;

    const P = live,
      S = shadows;
    P.clear();
    S.clear();
    // The sign, lit while a run is on.
    P.rect(SIGN.x, SIGN.y, SIGN.w, SIGN.h, c ? 0xa3321f : 0x4a2420);
    // The telemetry screen: the climb traced while a run is on, a dim standby otherwise.
    P.rect(TV.x, TV.y, TV.w, TV.h, c ? 0x0f2a24 : 0x141c1e);
    if (c) {
      const n = Math.min(TV.w - 8, Math.floor((c.t || 0) * 0.8) + 8);
      for (let i = 0; i < n; i++) {
        P.px(TV.x + 4 + i, TV.y + TV.h - 6 - Math.round(Math.pow(i / (TV.w - 8), 1.4) * (TV.h - 12)), 0x9fdc9a);
        P.px(TV.x + 4 + i, TV.y + 10 + Math.round(2 * Math.sin(i * 0.2)), 0x6fbfa0);
      }
    }
    // Each console's screens, lit while a run is on.
    for (const s of [...SPARE, YOURS])
      for (let sx = s.x + 3; sx < s.x + s.w - 12; sx += 16)
        if (c) P.rect(sx + 1, s.y + 3, 10, 5, s === YOURS ? 0x2f6a4a : 0x1f3a30);
    // His failures board: one lamp a station he can fail.
    ['EECOM', 'RETRO', 'FIDO', 'BOOSTER', 'NETWORK'].forEach((n, i) => {
      const on = !!lit[n];
      P.rect(BO.x + 9 + i * 11, BO.y + BO.h - 14, 7, 3, on ? 0xe0543c : c ? 0x2f5a3a : 0x31413a);
    });
    // The supervisor, from the front through his glass.
    P.rect(sup.x - 8, sup.top, 16, 10, 0x5d6a78);
    P.circ(sup.x, sup.top - 4, 4, 0xe2b993);
    P.rect(sup.x - 4, sup.top - 9, 9, 3, 0x373b3e);
    for (let j = 0; j < BO.h - 8; j += 1) P.px(BO.x + 14 + Math.round(j * 0.4), BO.y + 4 + j, 0x5a6e80); // a glint
    // You at your console, from above and behind, and your chair's shadow.
    const x = YOURS.x + YOURS.w / 2,
      top = YOURS.y + 20;
    S.rect(YOURS.x - 4, YOURS.y + 16, YOURS.w + 8, 6, SHADOW);
    S.poly(
      [
        [x - 10, top + 22],
        [x + 10, top + 22],
        [x + 14, top + 36],
        [x - 6, top + 36],
      ],
      SHADOW,
    );
    for (const s of SPARE) S.rect(s.x - 4, s.y + 16, s.w + 8, 10, SHADOW);
    if (you) pixelBack(P, x, top, you);
    P.rect(x - 7, top + 14, 14, 8, 0x2b2520);
    P.rect(x - 6, top + 14, 12, 1, 0x4a3f34);
    P.rect(x - 1, top + 22, 2, 5, 0x1d1915);
    P.commit();
    S.commit();

    hd.root.visible = hdOn;
    if (!hdOn) return;
    hd.begin(0x8e909a);
    for (const lx of [70, 160, 250]) hd.light(lx, 120, 60, 40, 0xf4f6ff, 0.35);
    hd.light(TV.x + TV.w / 2, TV.y + TV.h / 2 + 30, TV.w * 0.7, 46, 0xb8e0e8, c ? 0.45 : 0.2);
    hd.glow(TV.x + TV.w / 2, TV.y + TV.h / 2, TV.w * 0.55, 0x649da7, c ? 0.14 : 0.05, TV.h);
    hd.glow(CK.x + CK.w / 2, CK.y + 9, 34, 0xff7a2a, c ? 0.16 : 0.05, 12);
    hd.light(BO.x + BO.w / 2, BO.y + BO.h / 2, 50, 40, 0xd0dae6, 0.3);
    if (c) {
      hd.glow(SIGN.x + SIGN.w / 2, SIGN.y + 5, 60, 0xe0543c, 0.3, 16);
      hd.light(YOURS.x + YOURS.w / 2, YOURS.y + 6, YOURS.w * 0.7, 18, 0x9fdcc0, 0.35);
    }
    hd.vignette(0.45, 160, 90);
    hd.commit();
  }

  return { root, update, deskHit, focus: { x: YOURS.x - 30, y: YOURS.y - 30, w: YOURS.w + 60, h: 76 } };
}
