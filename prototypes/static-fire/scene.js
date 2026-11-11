// PROTOTYPE: the WAC static fire, seen from the dugout and the stand, drawn with PixiJS (WebGL).
// The point of it: every reading about the stage is in the scene (gauges, lamps, the pen recorder, vapour at a leak,
// the flame itself), and the overlaid window shrinks to one strip with the decision. Not part of the game build.
//
// The round, its hidden faults, the leak check and the firing trace all come from the real game rules (js/truth/round.js).
// Two things are drawn here that the rules don't model yet, and are marked DERIVED below: the slow fall in tank pressure
// before the firing when the stage leaks, and the vapour you can see at the leaking spot.
import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  BlurFilter,
} from './vendor/pixi.min.mjs';
import { newRound, staticFire, hasLeak, hasIgniterFault, leakCheck, reworkIgniter } from '../../js/truth/round.js';
import { KITS } from '../../js/data/kits.js';

const W = 1600,
  H = 800; // the drawn world; the window scales it to fit
const GROUND = 560;
const KIT = KITS.wac;
const TANK_BAND = [22, 24],
  PC_BAND = KIT.stand.pc; // [17, 23] bar
const COUNT_FROM = 10;

// ---------- the state of the test ----------
let round, seed, phase, clock, firing, trace, traceShown, decision, crew, siteMinutes, tankNow, pcNow, leakFound, holdAt;
const lamps = { press: false, igniter: false, fire: false, hold: false };

function pickSeed() {
  const v = document.getElementById('scenario').value;
  return v === 'random' ? 1 + Math.floor(Math.random() * 100000) : Number(v);
}

function startTest() {
  seed = pickSeed();
  round = newRound(seed);
  phase = 'ready';
  clock = COUNT_FROM;
  firing = null;
  trace = [];
  traceShown = 0;
  decision = { rework: false, leak: false };
  crew = null;
  leakFound = null;
  siteMinutes = 8 * 60 + 53;
  tankNow = 23;
  pcNow = 0;
  holdAt = null;
  Object.assign(lamps, { press: true, igniter: true, fire: false, hold: false });
  paper.clear();
  for (const p of smoke) p.s.destroy();
  smoke.length = 0;
  tags.removeChildren();
  tech.visible = false;
  ui();
}

// ---------- PixiJS ----------
const app = new Application();
await app.init({
  resizeTo: document.getElementById('stage'),
  background: '#0d0c0a',
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});
document.getElementById('stage').appendChild(app.canvas);

const world = new Container();
app.stage.addChild(world);
function fit() {
  const { width, height } = app.screen;
  const k = Math.min(width / W, height / H);
  world.scale.set(k);
  world.position.set((width - W * k) / 2, (height - H * k) / 2);
  base.x = world.x;
  base.y = world.y;
}
const base = { x: 0, y: 0 };

// A soft round puff, used for vapour, smoke, dust and glow.
const puffTex = (() => {
  const g = new Graphics();
  for (let r = 32; r > 0; r -= 2) g.circle(0, 0, r).fill({ color: 0xffffff, alpha: 0.06 });
  return app.renderer.generateTexture(g);
})();

const label = (text, size, color, opts = {}) => {
  const t = new Text({
    text,
    style: {
      fontFamily: opts.family || 'Courier New, Courier, monospace',
      fontSize: size,
      fill: color,
      fontWeight: opts.bold ? 'bold' : 'normal',
      letterSpacing: opts.spacing ?? 0,
      align: 'center',
    },
  });
  t.anchor.set(opts.ax ?? 0.5, opts.ay ?? 0.5);
  t.resolution = 2;
  return t;
};

// ---------- the backdrop: sky, mountains, desert, the dugout cut into the ground ----------
const back = new Graphics();
world.addChild(back);
{
  // Sky, banded like a gradient: pale at the horizon.
  const sky = [0x8fb3c9, 0x9dbdd0, 0xabc6d4, 0xbacfd6, 0xc8d6d6, 0xd6dbd2, 0xe0dccb];
  sky.forEach((c, i) => back.rect(0, i * 80, W, 81).fill(c));
  // The Organ Mountains, far off to the east, two ranges.
  back
    .poly([700, GROUND, 760, 470, 820, 430, 860, 455, 930, 380, 990, 420, 1040, 395, 1110, 450, 1180, 410, 1260, 460, 1340, 420, 1420, 470, 1500, 440, 1600, 480, 1600, GROUND])
    .fill(0x9b8fa3);
  back
    .poly([700, GROUND, 800, 505, 900, 490, 1000, 515, 1120, 485, 1250, 512, 1380, 495, 1500, 520, 1600, 505, 1600, GROUND])
    .fill(0xb5a28c);
  // The desert floor.
  back.rect(0, GROUND, W, H - GROUND).fill(0xcdb489);
  for (let i = 0; i < 70; i++) {
    const x = (i * 197) % W,
      y = GROUND + 12 + ((i * 53) % (H - GROUND - 20));
    back.ellipse(x, y, 10 + (i % 4) * 6, 2).fill({ color: 0xa88f66, alpha: 0.5 });
  }
  // Creosote bushes.
  for (const [x, s] of [[790, 1], [1420, 1.3], [1530, 0.8], [960, 0.7]]) {
    back.ellipse(x, GROUND + 4, 22 * s, 11 * s).fill(0x6f7a4a);
    back.ellipse(x + 8 * s, GROUND, 14 * s, 9 * s).fill(0x7f8a55);
  }
}

// The dugout, cut away: earth mound over a concrete room, stairs up to the desert on the right.
const dug = new Graphics();
world.addChild(dug);
const DUG = { x: 40, y: 300, w: 640, h: 470 }; // interior
{
  dug.poly([0, 220, 160, 200, 420, 215, 640, 250, 760, GROUND, 760, H, 0, H]).fill(0x9a7b52); // earth over and around
  for (let i = 0; i < 9; i++) dug.rect(0, 260 + i * 60, 760, 2).fill({ color: 0x7d6342, alpha: 0.5 }); // strata
  for (let i = 0; i < 9; i++) dug.roundRect(60 + i * 72, 226 - (i % 2) * 6, 70, 22, 8).fill(0xb79d6e).stroke({ width: 2, color: 0x8a7350 }); // sandbags on top
  dug.rect(DUG.x - 18, DUG.y - 18, DUG.w + 36, DUG.h + 18).fill(0x6f6a5d); // concrete shell
  dug.rect(DUG.x, DUG.y, DUG.w, DUG.h).fill(0x4d4a41); // the room
  dug.rect(DUG.x, DUG.y, DUG.w, 60).fill(0x45423a); // shade under the roof
  for (let i = 1; i < 6; i++) dug.rect(DUG.x + i * 107, DUG.y, 2, DUG.h).fill({ color: 0x3e3b33, alpha: 0.6 }); // form-board joints
  // The doorway and the stairs up to the desert.
  dug.rect(DUG.x + DUG.w, 560, 18, 210).fill(0x2c2a25);
  for (let i = 0; i < 7; i++) dug.rect(DUG.x + DUG.w + 18 + i * 9, 740 - i * 28, 60 - i * 6, 30).fill(i % 2 ? 0x77705f : 0x6d675a);
  dug.rect(0, 770, 760, 30).fill(0x37352f); // floor slab
  // The periscope up through the roof.
  dug.rect(560, 205, 14, 215).fill(0x3f4a3a);
  dug.rect(546, 192, 42, 22).fill(0x323b2e);
  dug.rect(586, 196, 10, 14).fill(0x1d2420);
  dug.rect(540, 420, 54, 18).fill(0x323b2e);
  // A cable comes in through the wall from the stand.
  dug.rect(DUG.x + DUG.w - 4, 470, 40, 6).fill(0x252525);
}

// ---------- the stand, out on the desert ----------
const STAND = { x: 1130, top: 230 };
const WAC = { x: STAND.x, nose: 285, nozzle: 525, r: 16 };
const stand = new Graphics();
world.addChild(stand);
{
  // Telemetry and firing cable from the stand back to the dugout.
  stand.moveTo(DUG.x + DUG.w + 36, 473).lineTo(780, 545).lineTo(1060, GROUND + 3).stroke({ width: 4, color: 0x2a2a28 });
  // Concrete pad and the flame pit.
  stand.rect(990, GROUND - 6, 330, 16).fill(0xa49e90);
  stand.rect(1085, GROUND - 6, 90, 50).fill(0x3a3631);
  stand.poly([1085, GROUND + 44, 1175, GROUND + 44, 1300, GROUND + 70, 1300, GROUND + 90, 1085, GROUND + 70]).fill(0x5b544a); // deflector run-out
  // Two I-beam legs, bracing, a top platform, a ladder.
  for (const x of [1060, 1190]) {
    stand.rect(x, STAND.top, 14, GROUND - STAND.top - 6).fill(0x6c6f6a);
    stand.rect(x + 5, STAND.top, 4, GROUND - STAND.top - 6).fill(0x55584f);
  }
  for (let y = STAND.top + 30; y < GROUND - 40; y += 70) {
    stand.moveTo(1074, y).lineTo(1190, y + 60).stroke({ width: 3, color: 0x5d605a });
    stand.moveTo(1190, y).lineTo(1074, y + 60).stroke({ width: 3, color: 0x5d605a });
  }
  stand.rect(1040, STAND.top - 10, 180, 12).fill(0x595c56);
  for (let y = STAND.top; y < GROUND - 6; y += 18) stand.rect(1206, y, 22, 3).fill(0x777a73);
  stand.rect(1204, STAND.top, 3, GROUND - STAND.top).fill(0x777a73);
  stand.rect(1228, STAND.top, 3, GROUND - STAND.top).fill(0x777a73);
  // Helium bottles beside the stand, piped to the stage.
  for (let i = 0; i < 3; i++) {
    stand.roundRect(1250 + i * 20, GROUND - 86, 16, 80, 7).fill(0x5d7a63);
    stand.rect(1254 + i * 20, GROUND - 94, 8, 10).fill(0x444);
  }
  stand.moveTo(1258, GROUND - 92).lineTo(1258, 330).lineTo(WAC.x + WAC.r, 330).stroke({ width: 3, color: 0x3c3c3c });
  // A windsock on its pole.
  stand.rect(1460, 360, 4, GROUND - 360).fill(0x7c7c7c);
}
const windsock = new Graphics();
world.addChild(windsock);

// The WAC upper stage, nose up in the stand. Drawn once; the clamps stay put.
const wac = new Graphics();
world.addChild(wac);
{
  const { x, nose, nozzle, r } = WAC;
  wac.poly([x, nose - 40, x + r, nose, x - r, nose]).fill(0xe8e2d0); // nose cone
  wac.rect(x - r, nose, 2 * r, nozzle - nose - 30).fill(0xdcd6c3); // body
  wac.rect(x - r, nose, 6, nozzle - nose - 30).fill({ color: 0xffffff, alpha: 0.35 });
  wac.rect(x + r - 7, nose, 7, nozzle - nose - 30).fill({ color: 0x000000, alpha: 0.12 });
  for (const y of [nose + 70, nose + 150]) wac.rect(x - r, y, 2 * r, 2).fill(0x9d9784); // tank welds
  wac.rect(x - r, nose + 30, 2 * r, 10).fill(0xb33a2a); // red band
  wac.poly([x - 9, nozzle - 30, x + 9, nozzle - 30, x + 14, nozzle, x - 14, nozzle]).fill(0x4b4a46); // nozzle
  for (const s of [-1, 1]) wac.poly([x + s * r, nozzle - 80, x + s * (r + 26), nozzle - 20, x + s * (r + 26), nozzle - 6, x + s * r, nozzle - 30]).fill(0xc9c2ac); // fins
  for (const y of [nose + 40, nozzle - 70]) wac.rect(x - r - 46, y, 2 * r + 92, 8).fill(0x50534d); // clamps
}
// Where each inspection spot is on the stage, for the vapour and the crew's visit.
const SPOT_AT = {
  fitting: { x: WAC.x + WAC.r + 2, y: WAC.nozzle - 46 },
  pressure: { x: WAC.x + WAC.r + 2, y: 330 },
};

// ---------- the people: cut-out figures built from parts ----------
function figure({ coat, hair, back = true, skin = 0xd9ab84 }) {
  const c = new Container();
  const parts = {};
  const legL = new Graphics().rect(-6, 0, 10, 46).fill(0x3d3a33);
  const legR = new Graphics().rect(-4, 0, 10, 46).fill(0x37342e);
  legL.pivot.set(0, 0);
  legL.position.set(-5, -46);
  legR.position.set(5, -46);
  const body = new Graphics().roundRect(-15, -88, 30, 46, 6).fill(coat);
  const armL = new Graphics().roundRect(-4, 0, 9, 40, 4).fill(coat);
  armL.position.set(-15, -84);
  const armR = new Graphics().roundRect(-5, 0, 9, 40, 4).fill(coat);
  armR.position.set(15, -84);
  const head = new Graphics();
  head.circle(0, 0, 11).fill(skin);
  if (back) head.circle(0, -1, 11).fill(hair);
  else head.arc(0, -2, 11, Math.PI, 2 * Math.PI).fill(hair);
  head.position.set(0, -100);
  c.addChild(legL, legR, armL, body, armR, head);
  Object.assign(parts, { legL, legR, armL, armR, head, body });
  c.parts = parts;
  return c;
}
function seated(coat, hair) {
  const c = new Container();
  const g = new Graphics();
  g.roundRect(-26, -10, 52, 70, 6).fill(0x3a3329); // chair back
  g.roundRect(-20, -48, 40, 56, 8).fill(coat); // shoulders and back
  g.circle(0, -60, 14).fill(0xd2a47e);
  g.circle(0, -62, 14).fill(hair);
  c.addChild(g);
  return c;
}
const you = seated(0xece4cf, 0x4b3524);
you.position.set(245, 720);
const ellis = seated(0x4f6f5a, 0x7a7a74);
ellis.position.set(520, 720);
const tech = figure({ coat: 0x8a6d3f, hair: 0x2f241a, back: false });
tech.visible = false;
const youTag = label('YOU · PRESS', 13, 0xe8c66a, { bold: true });
youTag.position.set(245, 785);

// ---------- the console: lamps, count drum, two gauges, the pen recorder ----------
const consoleG = new Graphics();
world.addChild(consoleG);
const CON = { x: 70, y: 410, w: 580, h: 230 };
{
  consoleG.rect(CON.x - 6, CON.y + CON.h, CON.w + 12, 22).fill(0x5a4b36); // desk top
  consoleG.rect(CON.x + 10, CON.y + CON.h + 22, CON.w - 20, 108).fill(0x4a3d2c);
  consoleG.roundRect(CON.x, CON.y, CON.w, CON.h, 6).fill(0x5d6648).stroke({ width: 3, color: 0x3f4632 });
  consoleG.rect(CON.x + 8, CON.y + 8, CON.w - 16, 22).fill(0x4c543b);
}
const plate = label('W.S.P.G.  ·  STATIC TEST  ·  WAC UPPER STAGE  ·  GAUGES IN BAR', 13, 0xd9d2b4, { bold: true, spacing: 1 });
plate.position.set(CON.x + CON.w / 2, CON.y + 19);

const LAMPS = [
  ['press', 'PRESS', 0x9fdc7a],
  ['igniter', 'IGNITER', 0x9fdc7a],
  ['fire', 'FIRE', 0xff8a3c],
  ['hold', 'HOLD', 0xff4a3a],
];
const lampG = new Graphics();
const lampGlow = new Graphics();
lampGlow.filters = [new BlurFilter({ strength: 8 })];
lampGlow.blendMode = 'add';
const lampLabels = LAMPS.map(([, name], i) => {
  const t = label(name, 11, 0xd9d2b4, { bold: true });
  t.position.set(CON.x + 40 + i * 62, CON.y + 74);
  return t;
});

const drum = new Graphics();
drum.roundRect(CON.x + 300, CON.y + 40, 150, 52, 4).fill(0x15130f).stroke({ width: 3, color: 0x2b2a24 });
const drumText = label('T-10', 34, 0xf0e6c8, { bold: true });
drumText.position.set(CON.x + 375, CON.y + 67);
const drumLabel = label('COUNT', 10, 0xd9d2b4, { bold: true });
drumLabel.position.set(CON.x + 375, CON.y + 101);

const GAUGES = {
  tank: { x: CON.x + 85, y: CON.y + 165, r: 56, max: 30, band: TANK_BAND, name: 'TANK' },
  pc: { x: CON.x + 225, y: CON.y + 165, r: 56, max: 30, band: PC_BAND, name: 'CHAMBER' },
};
const gaugeFace = new Graphics();
const needles = new Graphics();
const gaugeText = [];
for (const g of Object.values(GAUGES)) {
  gaugeFace.circle(g.x, g.y, g.r + 6).fill(0x2a2a24);
  gaugeFace.circle(g.x, g.y, g.r).fill(0xf1ead3);
  const a = v => Math.PI * 0.75 + (v / g.max) * Math.PI * 1.5;
  gaugeFace
    .moveTo(g.x + Math.cos(a(g.band[0])) * (g.r - 8), g.y + Math.sin(a(g.band[0])) * (g.r - 8))
    .arc(g.x, g.y, g.r - 8, a(g.band[0]), a(g.band[1]))
    .stroke({ width: 8, color: 0x7fbf6a });
  for (let v = 0; v <= g.max; v += 1) {
    const big = v % 5 === 0,
      ang = a(v);
    gaugeFace
      .moveTo(g.x + Math.cos(ang) * (g.r - (big ? 14 : 8)), g.y + Math.sin(ang) * (g.r - (big ? 14 : 8)))
      .lineTo(g.x + Math.cos(ang) * (g.r - 2), g.y + Math.sin(ang) * (g.r - 2))
      .stroke({ width: big ? 2 : 1, color: 0x2b261c });
    if (big) {
      const t = label(String(v), 11, 0x2b261c, { bold: true });
      t.position.set(g.x + Math.cos(ang) * (g.r - 24), g.y + Math.sin(ang) * (g.r - 24));
      gaugeText.push(t);
    }
  }
  const n = label(g.name, 10, 0x2b261c, { bold: true });
  n.position.set(g.x, g.y + 44);
  gaugeText.push(n);
  g.value = 0;
  g.angle = a;
}

// The pen recorder: a strip of chart paper with two pens (chamber in black ink, tank in red).
const REC = { x: CON.x + 350, y: CON.y + 115, w: 215, h: 105, secs: 10, max: 30 };
const recBox = new Graphics();
recBox.rect(REC.x - 8, REC.y - 8, REC.w + 16, REC.h + 22).fill(0x2f2f29);
recBox.rect(REC.x, REC.y, REC.w, REC.h).fill(0xf3eedc);
for (let v = 0; v <= REC.max; v += 5) recBox.rect(REC.x, REC.y + REC.h - (v / REC.max) * REC.h, REC.w, 1).fill({ color: 0x9fb8a8, alpha: v % 10 ? 0.5 : 0.9 });
for (let s = 0; s <= REC.secs; s++) recBox.rect(REC.x + (s / REC.secs) * REC.w, REC.y, 1, REC.h).fill({ color: 0x9fb8a8, alpha: 0.6 });
recBox.rect(REC.x, REC.y + REC.h - (PC_BAND[1] / REC.max) * REC.h, REC.w, ((PC_BAND[1] - PC_BAND[0]) / REC.max) * REC.h).fill({ color: 0x7fbf6a, alpha: 0.15 });
const recLabel = label('RECORDER  ·  CHAMBER (black)  TANK (red)', 9, 0xd9d2b4, { bold: true });
recLabel.position.set(REC.x + REC.w / 2, REC.y + REC.h + 7);
const paper = new Graphics();
const pens = new Graphics();

world.addChild(lampG, lampGlow, ...lampLabels, drum, drumText, drumLabel, gaugeFace, needles, ...gaugeText, recBox, paper, pens, recLabel, plate);
world.addChild(you, ellis, youTag);

// A lamp hanging from the dugout ceiling, and its light.
const lampHang = new Graphics();
lampHang.rect(360, DUG.y, 2, 40).fill(0x222);
lampHang.circle(361, DUG.y + 46, 9).fill(0xfff2c0);
world.addChild(lampHang);
const roomLight = new Sprite(puffTex);
roomLight.anchor.set(0.5);
roomLight.position.set(361, DUG.y + 60);
roomLight.scale.set(8);
roomLight.tint = 0xffd88a;
roomLight.alpha = 0.18;
roomLight.blendMode = 'add';
world.addChild(roomLight);

world.addChild(tech);

// ---------- effects: vapour, flame, smoke, dust, glow ----------
const fx = new Container();
world.addChild(fx);
const smoke = [];
function puff(x, y, o) {
  const s = new Sprite(puffTex);
  s.anchor.set(0.5);
  s.position.set(x, y);
  s.tint = o.tint ?? 0xffffff;
  s.alpha = o.alpha ?? 0.6;
  s.scale.set(o.size ?? 0.3);
  if (o.add) s.blendMode = 'add';
  fx.addChild(s);
  smoke.push({ s, vx: o.vx ?? 0, vy: o.vy ?? 0, grow: o.grow ?? 0.4, fade: o.fade ?? 0.5, life: 0, max: o.life ?? 2 });
}
const plume = new Graphics();
plume.blendMode = 'add';
const plumeGlow = new Sprite(puffTex);
plumeGlow.anchor.set(0.5);
plumeGlow.tint = 0xffa040;
plumeGlow.blendMode = 'add';
plumeGlow.alpha = 0;
plumeGlow.position.set(WAC.x, WAC.nozzle + 40);
world.addChild(plumeGlow, plume);

// Tags the player sees once a finding is known: hung on the stage at the spot.
const tags = new Container();
world.addChild(tags);
function hangTag(spot, text) {
  const p = SPOT_AT[spot];
  if (!p) return;
  const g = new Graphics();
  g.moveTo(p.x, p.y).lineTo(p.x + 40, p.y + 14).stroke({ width: 1, color: 0x333 });
  g.roundRect(p.x + 40, p.y + 4, 150, 22, 3).fill(0xf2e3b0).stroke({ width: 1, color: 0x7d6a3a });
  const t = label(text, 11, 0x2b261c, { bold: true, ax: 0 });
  t.position.set(p.x + 46, p.y + 15);
  tags.addChild(g, t);
}

// ---------- each frame ----------
let time = 0;
app.ticker.add(tk => {
  const dt = Math.min(0.1, tk.deltaMS / 1000);
  time += dt;
  step(dt);
  draw(dt);
});

function leakSpot() {
  return Object.keys(round.faults).find(k => round.faults[k] === 'leak');
}

function step(dt) {
  siteMinutes += dt * (phase === 'firing' ? 0.2 : 1); // a minute of site time a second, slower while she fires
  // DERIVED: before the firing, a leaking stage loses tank pressure slowly. The rules only model the fall during the firing.
  if (phase === 'ready' || phase === 'count' || phase === 'held') {
    const leaking = hasLeak(round);
    tankNow = leaking ? Math.max(20.5, tankNow - 0.05 * dt) : tankNow + (23 - tankNow) * Math.min(1, dt * 0.6);
  }
  if (phase === 'count') {
    clock -= dt;
    if (clock <= 0) ignite();
  }
  if (phase === 'firing') {
    firing.t += dt;
    while (traceShown < trace.length && trace[traceShown].t <= firing.t) traceShown++;
    const p = trace[Math.max(0, traceShown - 1)];
    pcNow = p.pc;
    tankNow = p.tank;
    if (firing.t > trace.at(-1).t + 0.2) shutdown();
  } else pcNow += (0 - pcNow) * Math.min(1, dt * 4);
  if (crew) crewStep(dt);
}

function ignite() {
  phase = 'firing';
  const result = staticFire(round, 'short');
  trace = result.trace;
  traceShown = 0;
  firing = { t: 0, result };
  lamps.fire = true;
  // Dust shakes down from the dugout ceiling.
  for (let i = 0; i < 26; i++) puff(DUG.x + 20 + Math.random() * (DUG.w - 40), DUG.y + 6, { tint: 0xb9a582, alpha: 0.5, size: 0.06, vy: 40 + Math.random() * 60, vx: 0, grow: 0.02, fade: 0.25, life: 2.5 });
  ui();
}

function shutdown() {
  phase = 'read';
  lamps.fire = false;
  lamps.press = false;
  ui();
}

// The crew's leak check: out of the dugout, up the stairs, across to the stand, look at both lines, and back.
function sendCrew() {
  const route = [
    [660, 770],
    [700, 770],
    [770, GROUND + 6],
    [1105, GROUND + 6],
    ['look', 2.2],
    [770, GROUND + 6],
    [700, 770],
    [660, 770],
  ];
  crew = { route, i: 0, wait: 0, done: false };
  tech.visible = true;
  tech.position.set(...route[0]);
  phase = phase === 'held' ? 'held-crew' : 'crew';
  ui();
}
function crewStep(dt) {
  const leg = crew.route[crew.i];
  if (!leg) {
    tech.visible = false;
    crew = null;
    phase = holdAt != null ? 'held' : 'ready';
    siteMinutes += leakFound ? 150 : 90; // the check, and the fix if there was something to fix
    ui();
    return;
  }
  if (leg[0] === 'look') {
    crew.wait += dt;
    tech.parts.armR.rotation = -2.4 + Math.sin(time * 3) * 0.15; // pointing up the stage
    if (!crew.checked) {
      crew.checked = true;
      const spot = leakSpot();
      const r = leakCheck(round);
      leakFound = r.found;
      if (r.found) hangTag(spot, 'LEAK FOUND · FIXED');
    }
    if (crew.wait > leg[1]) {
      crew.i++;
      tech.parts.armR.rotation = 0;
    }
    return;
  }
  const [tx, ty] = leg,
    speed = 150;
  const dx = tx - tech.x,
    dy = ty - tech.y,
    d = Math.hypot(dx, dy);
  if (d < 3) {
    crew.i++;
    return;
  }
  tech.x += (dx / d) * Math.min(d, speed * dt);
  tech.y += (dy / d) * Math.min(d, speed * dt);
  tech.scale.x = dx < 0 ? -1 : 1;
  const swing = Math.sin(time * 10) * 0.5;
  tech.parts.legL.rotation = swing;
  tech.parts.legR.rotation = -swing;
  tech.parts.armL.rotation = -swing * 0.7;
  tech.parts.armR.rotation = swing * 0.7;
}

function draw(dt) {
  // Shake the world a little while she fires, by how hard she is burning.
  const shake = phase === 'firing' ? (pcNow / 20) * 2.2 : 0;
  world.position.set(base.x + (Math.random() - 0.5) * shake, base.y + (Math.random() - 0.5) * shake);

  // Windsock.
  windsock.clear();
  const flap = Math.sin(time * 3) * 4;
  windsock.poly([1464, 362, 1520, 368 + flap, 1520, 382 + flap, 1464, 384]).fill(0xe2702c);
  windsock.rect(1484, 364 + flap / 2, 6, 19).fill(0xf3efe6);

  // Lamps on the console, and their glow.
  lampG.clear();
  lampGlow.clear();
  const ignFlicker = phase === 'firing' && hasIgniterFault(round) && firing.t < 2.5 ? Math.sin(time * 40) > 0 : true;
  LAMPS.forEach(([key, , color], i) => {
    const x = CON.x + 40 + i * 62,
      y = CON.y + 50;
    const on = lamps[key] && (key !== 'igniter' || ignFlicker) && (key !== 'hold' || Math.sin(time * 6) > -0.3);
    lampG.circle(x, y, 15).fill(0x2a2a24);
    lampG.circle(x, y, 11).fill(on ? color : 0x3d3d35);
    if (on) lampGlow.circle(x, y, 16).fill({ color, alpha: 0.7 });
  });

  // The count drum.
  drumText.text =
    phase === 'firing' ? 'FIRE' : phase === 'read' || phase === 'result' ? 'CUTOFF' : `T-${Math.max(0, Math.ceil(clock))}`;
  drumText.style.fill = phase === 'firing' ? 0xffb35c : holdAt != null ? 0xff6a5a : 0xf0e6c8;

  // Gauge needles, eased so they swing like real ones.
  needles.clear();
  GAUGES.tank.value += (tankNow - GAUGES.tank.value) * Math.min(1, dt * 6);
  GAUGES.pc.value += (pcNow - GAUGES.pc.value) * Math.min(1, dt * 9);
  for (const g of Object.values(GAUGES)) {
    const a = g.angle(Math.max(0, Math.min(g.max, g.value)));
    needles.moveTo(g.x, g.y).lineTo(g.x + Math.cos(a) * (g.r - 10), g.y + Math.sin(a) * (g.r - 10)).stroke({ width: 3, color: 0xa3261a });
    needles.circle(g.x, g.y, 5).fill(0x2b261c);
  }

  // The recorder: ink as far as the firing has gone; the pens sit at the latest point.
  const X = t => REC.x + (t / REC.secs) * REC.w,
    Y = v => REC.y + REC.h - (Math.max(0, Math.min(REC.max, v)) / REC.max) * REC.h;
  if (trace.length && traceShown > 1) {
    paper.clear();
    const shown = trace.slice(0, traceShown);
    paper.moveTo(X(shown[0].t), Y(shown[0].tank));
    for (const p of shown) paper.lineTo(X(p.t), Y(p.tank));
    paper.stroke({ width: 1.6, color: 0xb0281c });
    paper.moveTo(X(shown[0].t), Y(shown[0].pc));
    for (const p of shown) paper.lineTo(X(p.t), Y(p.pc));
    paper.stroke({ width: 1.8, color: 0x1d1b17 });
  }
  pens.clear();
  const penT = phase === 'firing' ? firing.t : trace.length ? trace.at(-1).t : 0;
  pens.rect(X(penT) - 1, REC.y - 4, 2, REC.h + 8).fill(0x55534a);
  pens.circle(X(penT), Y(GAUGES.pc.value), 3).fill(0x1d1b17);
  pens.circle(X(penT), Y(GAUGES.tank.value), 3).fill(0xb0281c);

  // The flame: its length and brightness follow the chamber pressure, so a rough start shows as a stuttering flame.
  plume.clear();
  const power = phase === 'firing' ? Math.max(0, pcNow / 20) : 0;
  if (power > 0.02) {
    const len = 30 + 70 * power,
      wob = Math.sin(time * 50) * 3;
    const { x, nozzle } = WAC;
    plume.poly([x - 13, nozzle, x + 13, nozzle, x + 6 + wob, nozzle + len, x - 6 + wob, nozzle + len]).fill({ color: 0xffd27a, alpha: 0.9 });
    plume.poly([x - 7, nozzle, x + 7, nozzle, x + wob / 2, nozzle + len * 0.7]).fill({ color: 0xfff6d8, alpha: 0.95 });
    for (let i = 0; i < 3; i++) plume.circle(x, nozzle + 10 + i * 12, 4 - i).fill({ color: 0xffffff, alpha: 0.6 }); // shock diamonds
    // Exhaust out of the pit along the deflector: smoke billowing east.
    if (Math.random() < 0.9 * power) puff(1180 + Math.random() * 20, GROUND + 50, { tint: 0xa79d8c, alpha: 0.9, size: 0.5, vx: 120 + Math.random() * 80, vy: -40 - Math.random() * 40, grow: 1.1, fade: 0.22, life: 4 });
    if (Math.random() < 0.6 * power) puff(1130 + (Math.random() - 0.5) * 30, GROUND + 20, { tint: 0xff9a40, alpha: 0.5, size: 0.25, vx: 60, vy: -60, grow: 0.6, fade: 0.8, life: 0.8, add: true });
  }
  plumeGlow.alpha = power * 0.9;
  plumeGlow.scale.set(5 + power * 3);
  roomLight.alpha = 0.18 + power * 0.05 + Math.sin(time * 2.1) * 0.01;

  // DERIVED: vapour weeping from a leaking spot while the tanks are pressurised. Red fuming nitric acid fumes are orange-brown.
  const spot = round && leakSpot();
  if (spot && SPOT_AT[spot] && (phase === 'ready' || phase === 'count' || phase === 'held' || phase === 'crew' || phase === 'held-crew' || phase === 'firing')) {
    const p = SPOT_AT[spot];
    if (Math.random() < dt * (phase === 'firing' ? 30 : 14)) {
      puff(p.x + 2, p.y, {
        tint: spot === 'fitting' ? 0xd9905a : 0xf4f4f4,
        alpha: 0.8,
        size: 0.2,
        vx: 22 + Math.random() * 16,
        vy: -12 - Math.random() * 12,
        grow: 0.6,
        fade: 0.4,
        life: 2.2,
      });
    }
  }

  // Particles.
  for (let i = smoke.length - 1; i >= 0; i--) {
    const p = smoke[i];
    p.life += dt;
    p.s.x += p.vx * dt;
    p.s.y += p.vy * dt;
    p.s.scale.set(p.s.scale.x + p.grow * dt);
    p.s.alpha = Math.max(0, p.s.alpha - p.fade * dt);
    if (p.life > p.max || p.s.alpha <= 0) {
      p.s.destroy();
      smoke.splice(i, 1);
    }
  }

  readout();
  document.getElementById('date').textContent = `Wednesday 10 October 1945 · ${hhmm(siteMinutes)}`;
}

const hhmm = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

// ---------- the slim decision strip (HTML) ----------
function ui() {
  const say = document.getElementById('say'),
    acts = document.getElementById('actions'),
    obj = document.getElementById('objective');
  acts.innerHTML = '';
  const button = (text, run, cls = '', key = '') => {
    const b = document.createElement('button');
    b.innerHTML = (key ? `<kbd>${key}</kbd>` : '') + text;
    if (cls) b.className = cls;
    b.onclick = run;
    if (key) b.dataset.key = key;
    acts.appendChild(b);
  };
  if (phase === 'ready') {
    obj.textContent = 'The upper stage is on the stand and pressurised. Run the static fire from the dugout.';
    say.innerHTML = '<b>Ellis:</b> She\'s yours. Watch your tank gauge before you start the count.';
    button('Start the firing count', () => {
      phase = 'count';
      ui();
    }, '', '1');
    button('Send the crew to leak-check', sendCrew, '', '2');
  } else if (phase === 'count') {
    obj.textContent = 'The firing count is running. Call a hold if anything looks wrong.';
    say.innerHTML = '<b>Ellis:</b> Count is running. Ten seconds.';
    button('HOLD', () => {
      phase = 'held';
      holdAt = clock;
      lamps.hold = true;
      ui();
    }, 'stop', 'Space');
  } else if (phase === 'held') {
    obj.textContent = 'The count is held.';
    say.innerHTML = '<b>Ellis:</b> Holding. What did you see?';
    button('Resume the count', () => {
      phase = 'count';
      holdAt = null;
      lamps.hold = false;
      ui();
    }, '', '1');
    button('Send the crew to leak-check', sendCrew, '', '2');
  } else if (phase === 'crew' || phase === 'held-crew') {
    obj.textContent = 'The pad crew is out at the stand checking the feed and pressurisation lines.';
    say.innerHTML = '<b>Ellis:</b> Nobody fires anything while the crew is out there.';
  } else if (phase === 'firing') {
    obj.textContent = 'Firing.';
    say.innerHTML = '<b>Delgado:</b> Fire!';
  } else if (phase === 'read') {
    obj.textContent = 'Read the recorder trace. What should be done before she flies?';
    say.innerHTML = '<b>Ellis:</b> Tear off the trace and tell me what she needs.';
    const toggle = (text, key, k) =>
      button((decision[key] ? '● ' : '○ ') + text, () => {
        decision[key] = !decision[key];
        ui();
      }, decision[key] ? 'on' : '', k);
    toggle(`${KIT.stand.rework} (8 hours)`, 'rework', '1');
    toggle('Leak-check the feed system', 'leak', '2');
    button('Give your decision to Ellis', decide, '', '3');
  } else if (phase === 'result') {
    obj.textContent = 'What was really wrong with her. In the game this comes out in flight, or never.';
    say.innerHTML = firing.verdict;
    button('Next stage on the stand', startTest, '', '1');
  }
}

function decide() {
  const igniter = hasIgniterFault(round),
    leak = hasLeak(round),
    lines = [];
  if (decision.rework) reworkIgniter(round);
  if (decision.leak) {
    const spot = leakSpot();
    const r = leakCheck(round);
    if (r.found) hangTag(spot, 'LEAK FOUND · FIXED');
  }
  if (igniter) lines.push(decision.rework ? 'The igniter had a real hang-fire fault, and you caught it.' : '<b>Missed:</b> the igniter had a hang-fire fault. That rough start on the trace was it.');
  else if (decision.rework) lines.push('The igniter was sound; the rework cost a day for nothing.');
  if (leak) lines.push(decision.leak ? 'The leak check found the leak and fixed it.' : '<b>Missed:</b> she was leaking. The tank pressure fell during the firing.');
  else if (decision.leak && !leakFound) lines.push('The leak check found nothing.');
  if (leakFound) lines.push(`The crew found and fixed the ${leakFound.toLowerCase()} leak before the firing.`);
  const welds = Object.entries(round.faults).filter(([, f]) => f === 'weld');
  if (welds.length) lines.push(`Not visible on a firing: a bad ${KIT.spots[welds[0][0]].name.toLowerCase()}. That's the hangar inspection's job.`);
  if (!lines.length) lines.push('A clean stage, and a clean call.');
  firing.verdict = lines.join(' ') + ` <span style="opacity:.6">(stage ${seed})</span>`;
  phase = 'result';
  ui();
}

// Keys: the numbers press the strip's buttons, Space holds, R shows the readings.
window.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') return toggleReadout();
  const k = e.key === ' ' ? 'Space' : e.key;
  const b = document.querySelector(`#actions button[data-key="${k}"]`);
  if (b) {
    e.preventDefault();
    b.click();
  }
});

// ---------- the text readout: every reading in the scene, as words, for when the scene is hard to read ----------
const readoutEl = document.getElementById('readout');
function toggleReadout() {
  readoutEl.hidden = !readoutEl.hidden;
}
document.getElementById('readout-toggle').onclick = toggleReadout;
function readout() {
  if (readoutEl.hidden) return;
  const lamp = Object.entries(lamps)
    .filter(([, on]) => on)
    .map(([k]) => k.toUpperCase())
    .join(', ');
  readoutEl.innerHTML = `<h2>Readings</h2><dl>
    <dt>Count</dt><dd>${drumText.text}</dd>
    <dt>Tank</dt><dd>${GAUGES.tank.value.toFixed(1)} bar (normal 22–24)</dd>
    <dt>Chamber</dt><dd>${GAUGES.pc.value.toFixed(1)} bar (normal ${PC_BAND.join('–')})</dd>
    <dt>Lamps</dt><dd>${lamp || 'none lit'}</dd>
    <dt>Crew</dt><dd>${crew ? 'at the stand' : 'in the dugout'}</dd>
  </dl>`;
}

document.getElementById('scenario').onchange = startTest;
window.addEventListener('resize', fit);
app.renderer.on('resize', fit);
fit();
startTest();
