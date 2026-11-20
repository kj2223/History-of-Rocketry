// THE HANGAR IN THREE-QUARTERS (2D-HD rework, Aaron 20 November 2026): the assembly hangar seen from above, as a lit
// diorama in pixels. In the early years the quonset: its ribbed end wall and the big doors with a line of daylight
// down them, a concrete floor stained with oil, the round on its wooden cradles under the hanging lamps, a workbench,
// the tool chest, crates. In the crewed years Hangar S: white walls and the maker's banner, a clean floor with its
// painted lines, the spacecraft on its checkout stand (or the stages on their steel cradles). The lamps throw a pool on
// the floor and a shadow away from them under everything; the near edge is out of focus. The inspection itself is in
// the close-up, which the scene zooms into (hangar.js, fx/zoom-view.js). 320 x 180 art pixels. Presentation only.
import { BlurFilter, Container, Rectangle } from '../vendor/pixi.min.mjs';
import { PX, pixelLayer, shade, pixelStanding } from './pixel.js';
import { hdLayer } from './fx/hd.js';
import { label, speech } from './kit.js';
import { roundShape } from '../site/draw.js';

const hash = (x, y) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const WALL = 52; // where the end wall meets the floor
const MIDY = 100; // the round's centre line, on the floor plane
const SHADOW = 0x090b12;

// g: the game; crewed, capsule: Hangar S and a spacecraft rather than a rocket; here: whether the round is in;
// len, half: the round's length and radius in site units (interiors.js SHAPE); mated; banner: the maker's name.
export function hangarRoom({ g, crewed, capsule, here, len, half, mated, banner, pass = true }) {
  const root = new Container();
  root.label = 'hangar-room';
  const M = { mx: 80, my: 40 };
  const far = pixelLayer(320, 180, M),
    floor = pixelLayer(320, 180, M),
    shadows = pixelLayer(320, 180, M),
    live = pixelLayer(320, 180, M),
    near = pixelLayer(320, 180, M);
  root.addChild(far.sprite, floor.sprite, shadows.sprite, live.sprite, near.sprite);
  const hd = hdLayer(320, 180, M);
  root.addChild(hd.root);
  // On the pixel pass (pixelate.js) the light and the blurred near edge are drawn over the pixels at full resolution,
  // so they stay smooth; the pass itself softens the far wall and the shadows enough.
  if (pass) hd.root.crisp = near.sprite.crisp = true;
  const type = new Container();
  root.addChild(type);
  const farBlur = new BlurFilter({ strength: 2, quality: 2 }),
    nearBlur = new BlurFilter({ strength: 8, quality: 3 }),
    shadowBlur = new BlurFilter({ strength: 3, quality: 2 });
  const L0 = -M.mx,
    LW = 320 + 2 * M.mx;

  // ---- the end wall ----
  const F = far;
  if (crewed) {
    F.vgrad(L0, -M.my, LW, WALL + M.my, [0xc8c6be, 0xdedcd4, 0xe8e6df]);
    F.rect(L0, WALL - 14, LW, 1, 0xb8c0c0);
    F.rect(L0, WALL - 11, LW, 3, 0xc5cccb);
    F.rect(L0, WALL - 2, LW, 2, 0x9a9890);
    const bw = Math.min(170, Math.max(100, banner.length * 6 + 20));
    F.rect(160 - bw / 2, 8, bw, 12, 0x2b3f6b);
    F.rect(160 - bw / 2, 8, bw, 1, 0x3d5488);
    const t = label(banner.toUpperCase(), 18, 0xffffff, { family: 'Arial, sans-serif', bold: true });
    t.position.set(160 * PX, 14 * PX);
    type.addChild(t);
    // The test cabinets along the wall.
    for (const x of [20, 262]) {
      F.rect(x, WALL - 24, 34, 24, 0x9da3a0);
      F.rect(x, WALL - 26, 34, 2, 0x5d6c70);
      for (let y = WALL - 20; y < WALL - 2; y += 5) F.rect(x + 2, y, 30, 1, 0xbec5c1);
      F.rect(x + 4, WALL - 22, 6, 3, 0x7fdc8a);
    }
  } else {
    F.vgrad(L0, -M.my, LW, WALL + M.my, [0x3a3d42, 0x474a50, 0x52555a]);
    // The corrugations and the ribs of the quonset's end.
    for (let x = L0; x < L0 + LW; x += 3) F.rect(x, -M.my, 1, WALL + M.my, 0x3e4146);
    for (let x = L0 + 20; x < L0 + LW; x += 40) F.rect(x, -M.my, 2, WALL + M.my, 0x24262a);
    // The big doors, shut, with daylight down the crack between them.
    F.rect(110, 4, 100, WALL - 4, 0x45484c);
    for (let x = 112; x < 210; x += 6) F.rect(x, 4, 1, WALL - 4, 0x3a3d41);
    F.rect(159, 4, 2, WALL - 4, 0xfff2cc);
    F.rect(110, 4, 100, 2, 0x55585c);
    F.rect(L0, WALL - 2, LW, 2, 0x1e2023);
    // A parts rack against the wall.
    F.rect(26, WALL - 30, 44, 30, 0x4a3c2c);
    for (let y = WALL - 28; y < WALL; y += 9) F.rect(26, y, 44, 1, 0x6a5a44);
    for (let i = 0; i < 9; i++)
      F.rect(28 + i * 5, WALL - 26 + (i % 3) * 9, 3, 6, [0x8a6d48, 0x6b7a5a, 0x9a8a70][i % 3]);
  }
  // The lamps on their cords.
  const lamps = [70, 160, 250];
  for (const x of lamps) {
    F.rect(x, -M.my, 1, 30 + M.my, 0x151515);
    if (crewed) {
      F.rect(x - 12, 30, 24, 3, 0x787e7b);
      F.rect(x - 11, 33, 22, 1, 0xfbfaf4);
    } else {
      F.poly(
        [
          [x - 6, 35],
          [x + 7, 35],
          [x + 3, 30],
          [x - 2, 30],
        ],
        0x2f3a3c,
      );
      F.rect(x - 3, 36, 7, 1, 0xfff4d0);
    }
  }
  F.commit();

  // ---- the floor ----
  const Fl = floor;
  const conc = crewed ? 0xc9c6bc : 0x6b6a66;
  Fl.vgrad(L0, WALL, LW, 180 + M.my - WALL, [shade(conc, 0.82), shade(conc, 0.95), conc, shade(conc, 1.02)]);
  for (let y = WALL + 6, step = 8; y < 180 + M.my; y += step, step += 2)
    Fl.rect(L0, Math.round(y), LW, 1, shade(conc, 0.9));
  for (let x = -280; x <= 600; x += 48)
    Fl.line(160 + (x - 160) * 0.55, WALL, 160 + (x - 160) * 1.6, 220, shade(conc, 0.9));
  if (crewed) {
    // The painted lines round the work area.
    Fl.rect(40, MIDY - 34, 240, 1, 0xd8b440);
    Fl.rect(34, MIDY + 34, 252, 1, 0xd8b440);
  } else
    for (let i = 0; i < 26; i++) {
      // Oil stains and tyre marks.
      const x = Math.floor(L0 + hash(i, 3) * LW),
        y = Math.floor(WALL + 8 + hash(i, 5) * 150);
      const rx = 3 + Math.floor(hash(i, 7) * 5);
      Fl.rect(x - rx, y, 2 * rx, 2, shade(conc, 0.88));
      Fl.rect(x - rx + 2, y - 1, 2 * rx - 4, 1, shade(conc, 0.9));
    }

  // ---- the round, lying on its cradles; or the spacecraft on its stand ----
  let focus = { x: 60, y: MIDY - 24, w: 200, h: 48 };
  const RW = 210; // the longest a round lies, art pixels
  const art = { k: 0, x0: 0 };
  if (here && !capsule) {
    const kk = Math.min(RW / len, 16 / half);
    art.k = kk;
    art.w = Math.round(len * kk);
    art.x0 = Math.round(160 - art.w / 2);
    const cradle = crewed ? 0x8a8f96 : 0x6a5a44,
      cradleTop = crewed ? 0xa9aeb4 : 0x9a7950;
    for (const f of [0.15, 0.5, 0.85]) {
      const cx = Math.round(art.x0 + art.w * (1 - f));
      const r = Math.max(3, Math.round(half * kk));
      Fl.rect(cx - 6, MIDY, 12, r + 8, cradle);
      Fl.rect(cx - 7, MIDY - 1, 14, 2, cradleTop);
      Fl.rect(cx - 9, MIDY + r + 8, 18, 2, shade(cradle, 0.75));
    }
    // The round herself, drawn by the site's own shapes, small and crisp.
    const S = 4;
    const cw = (art.w + 40) * S,
      ch = Math.max(40, Math.round(half * kk * 3)) * S;
    const cv = document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    const ctx = cv.getContext('2d');
    ctx.translate(20 * S + art.w * S, ch / 2);
    ctx.scale(kk * S, kk * S);
    roundShape(ctx, g, 0, 0, -Math.PI / 2, mated);
    art.cv = cv;
    art.ch = ch / S;
    focus = { x: art.x0 - 10, y: MIDY - 22, w: art.w + 20, h: 44 };
  } else if (here && capsule) {
    // The spacecraft on its checkout stand: a blunt cone, its heat shield down, the stand's steel round it.
    const cx = 160,
      base = MIDY + 18;
    Fl.rect(cx - 30, base, 60, 6, 0x6d7278);
    Fl.rect(cx - 30, base, 60, 1, 0xa9aeb4);
    for (const x of [cx - 28, cx + 26]) Fl.rect(x, base - 40, 2, 40, 0x8a8f96);
    Fl.rect(cx - 30, base - 42, 60, 2, 0xa9aeb4);
    focus = { x: cx - 50, y: base - 56, w: 100, h: 60 };
    art.capsule = { cx, base };
  }
  Fl.commit();

  // ---- the props: a workbench, the tool chest, crates (the near edge out of focus) ----
  const props = [];
  const bench = (x, y, w) => {
    Fl.rect(x, y, w, 8, crewed ? 0x8a9090 : 0x7a6248);
    Fl.rect(x, y, w, 1, crewed ? 0xb0b6b6 : 0x9a8060);
    Fl.rect(x, y + 8, w, 4, crewed ? 0x5d6c70 : 0x4a3a2a);
    Fl.rect(x + 3, y + 2, 6, 2, 0x9a9a9a); // a wrench
    Fl.rect(x + w - 12, y + 2, 7, 4, 0xe8e0c8); // the drawings
    props.push({ x, y, w, h: 12 });
  };
  bench(8, 128, 44);
  Fl.rect(276, 118, 22, 18, 0xa8322a); // the tool chest
  Fl.rect(276, 118, 22, 2, 0xc8524a);
  for (let y = 123; y < 136; y += 4) Fl.rect(278, y, 18, 1, 0x7a2018);
  props.push({ x: 276, y: 118, w: 22, h: 18 });
  if (!crewed)
    for (const [x, y] of [
      [60, 142],
      [70, 148],
    ]) {
      Fl.rect(x, y, 16, 10, 0x8a6d48);
      Fl.rect(x, y, 16, 2, 0xa8875c);
      Fl.rect(x + 7, y, 1, 10, 0x6a5236);
      props.push({ x, y, w: 16, h: 10 });
    }
  Fl.commit();
  const N = near;
  N.rect(L0, 170, LW, 70, crewed ? 0x8a9090 : 0x5a4a38);
  N.rect(L0, 170, LW, 2, crewed ? 0xb0b6b6 : 0x7a6248);
  N.rect(100, 164, 30, 8, 0x3a3d41);
  N.rect(200, 160, 12, 12, 0xa8322a);
  N.commit();

  const talk = [0, 1, 2, 3].map(() => {
    const b = speech();
    root.addChild(b);
    return b;
  });
  const deskHit = new Container();
  deskHit.eventMode = 'static';
  deskHit.cursor = 'pointer';
  deskHit.hitArea = new Rectangle(focus.x * PX, focus.y * PX, focus.w * PX, focus.h * PX);
  root.addChild(deskHit);

  function update({ people, hdOn, t, k }) {
    far.sprite.filters = hdOn && !pass ? [farBlur] : null;
    near.sprite.filters = hdOn ? [nearBlur] : null;
    shadows.sprite.filters = hdOn ? [shadowBlur] : null;
    farBlur.strength = 0.3 * PX * k;
    nearBlur.strength = 1.6 * PX * k;
    shadowBlur.strength = pass ? 1.5 : 0.6 * PX * k; // on the pass, in art pixels
    shadows.sprite.alpha = crewed ? 0.32 : 0.5;
    const P = live,
      S = shadows;
    P.clear();
    S.clear();
    // Shadows: thrown down and away from the nearest lamp, a soft patch under everything.
    const lean = x => (x - lamps.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a))) * 0.25;
    if (art.cv) {
      S.poly(
        [
          [art.x0, MIDY + 4],
          [art.x0 + art.w, MIDY + 4],
          [art.x0 + art.w + 6, MIDY + 22],
          [art.x0 + 6, MIDY + 22],
        ],
        SHADOW,
      );
      P.picture(art.cv, art.x0 - 20, MIDY - art.ch / 2, art.w + 40, art.ch);
    }
    if (art.capsule) {
      const { cx, base } = art.capsule;
      S.poly(
        [
          [cx - 24, base + 6],
          [cx + 24, base + 6],
          [cx + 30, base + 22],
          [cx - 18, base + 22],
        ],
        SHADOW,
      );
      // The capsule: dark shingled sides narrowing to the neck, the heat shield at the foot.
      for (let j = 0; j < 30; j++) {
        const w = Math.round(9 + (j / 30) * 13);
        P.rect(cx - w, base - 34 + j, 2 * w, 1, j % 4 === 0 ? 0x26282d : 0x3a3d44);
        P.rect(cx + w - 5, base - 34 + j, 5, 1, 0x2a2c31);
        P.px(cx - w + 2, base - 34 + j, 0x44474d);
      }
      P.rect(cx - 6, base - 42, 12, 8, 0x2a2c30);
      P.rect(cx - 23, base - 4, 46, 4, 0x8a6a4a);
      P.rect(cx - 23, base - 4, 46, 1, 0xa88a6a);
    }
    for (const p of props) S.rect(p.x + 2 + lean(p.x), p.y + p.h, p.w, 4, SHADOW);

    // The people on the floor in front of her.
    const n = Math.min(4, people.length);
    for (let i = 0; i < 4; i++) {
      const p = people[i];
      if (!p) {
        talk[i].update(null);
        continue;
      }
      const x = Math.round(70 + ((i + 0.5) / Math.max(1, n)) * 180),
        feet = 150;
      const l = lean(x);
      S.poly(
        [
          [x - 6, feet],
          [x + 6, feet],
          [x + 8 + l, feet + 12],
          [x - 4 + l, feet + 12],
        ],
        SHADOW,
      );
      pixelStanding(P, x, feet, p);
      talk[i].position.set(x * PX, (feet - 47) * PX);
      talk[i].update(p.bubble);
    }
    P.commit();
    S.commit();

    hd.root.visible = hdOn;
    if (!hdOn) return;
    hd.begin(crewed ? 0xc4c4c8 : 0x8a8a94);
    const warm = crewed ? 0xf4f6ff : 0xf2e2c0;
    for (const x of lamps) {
      hd.light(x, MIDY - 4, crewed ? 80 : 58, crewed ? 44 : 34, warm, crewed ? 0.45 : 0.7);
      hd.lightBeam(x, 34, 12, 80, 66, 0, warm, crewed ? 0.06 : 0.12);
      if (!crewed) {
        hd.beam(x, 35, 10, 70, 64, 0, 0xfff4e0, 0.07);
        hd.motes(x, 36, 10, 60, 60, 0, 0xfff8e4, 18, t, 0.4);
      }
      hd.glow(x, 34, 9, 0xfff4d0, 0.5, 3);
    }
    if (!crewed) {
      // Daylight down the crack between the doors.
      hd.glow(160, 30, 6, 0xfff2cc, 0.5, 26);
      hd.light(160, WALL + 10, 16, 20, 0xfff2cc, 0.4);
    }
    hd.vignette(crewed ? 0.3 : 0.5, 160, 90);
    hd.commit();
  }

  return { root, update, deskHit, focus };
}
