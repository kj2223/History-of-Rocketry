// THE PIXEL PASS (v0.8 pixel art pass): turns a scene drawn with ordinary PixiJS shapes into pixel art, so every room
// keeps its drawing code while the picture matches the hand-painted blockhouse (pixel.js). The scene is drawn small,
// about 180 pixels tall, with no smoothing, into a texture, and that texture is shown scaled up with hard,
// nearest-neighbour pixels, a whole number of screen pixels to each art pixel (6 at 1080p, 4 at 720p).
// Type is never pixelated: every Text in the scene, and anything a scene marks `crisp` (its buttons), is left out of the
// small drawing and drawn afterwards at full resolution, in place, over the pixels. So readings, labels, speech and the
// way-out button stay as sharp as before.
import { RenderTexture, Sprite, Matrix, Filter, GlProgram, GraphicsContext } from '../vendor/pixi.min.mjs';

export const ART_H = 180; // art pixels from the top of the scene to the bottom
// Colour steps per channel. Smooth gradients (the sky, the haze, the glow of a lamp) are cut into this many steps and
// the steps are dithered together in the 4 x 4 ordered pattern of the hand-painted scenes, one art pixel at a time.
const LEVELS = 32;

const VERTEX = `in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;
const FRAGMENT = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform float uPix;
uniform float uLevels;
uniform vec2 uShift;
float bayer2(vec2 a) {
  a = floor(a);
  return fract(dot(a, vec2(0.5, a.y * 0.75)));
}
float bayer(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a) + 0.03125;
}
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  vec2 screen = vTextureCoord * uInputSize.xy + uOutputFrame.xy;
  // The pattern is pinned to the world, not the screen (uShift, the scene's camera in art pixels), so ground that
  // slides by a pixel keeps its own dither instead of crawling under a pattern that stays put.
  float d = bayer(floor(screen / uPix) + uShift) - 0.5;
  // The colour is stepped before its transparency is applied, so a see-through haze over the smooth backdrop dithers
  // like the rest instead of breaking into a checkerboard.
  vec3 rgb = c.a > 0.0 ? c.rgb / c.a : c.rgb;
  vec3 q = clamp(floor(rgb * uLevels + 0.5 + d) / uLevels, 0.0, 1.0);
  finalColor = vec4(q * c.a, c.a);
}`;
function ditherFilter() {
  return new Filter({
    glProgram: GlProgram.from({ vertex: VERTEX, fragment: FRAGMENT, name: 'pixel-dither' }),
    resources: {
      ditherUniforms: {
        uPix: { value: 6, type: 'f32' },
        uLevels: { value: LEVELS, type: 'f32' },
        uShift: { value: new Float32Array(2), type: 'vec2<f32>' },
      },
    },
  });
}
const TYPE = new Set(['text', 'bitmapText', 'htmlText']);

// Thin lines. A line thinner than an art pixel would break up into dots or vanish when the scene is drawn small (the
// bracing of a tower, a wire, the rim of a dial), so while a pixelated scene is being built or drawn, any stroke
// thinner than `hairline` scene units is drawn as a clean line exactly one art pixel wide (PixiJS's pixelLine).
let hairline = 0;
export const setHairline = units => {
  hairline = units || 0;
};
const plainStroke = GraphicsContext.prototype.stroke;
GraphicsContext.prototype.stroke = function (style) {
  if (hairline && style && typeof style === 'object' && !style.pixelLine && (style.width ?? 1) < hairline)
    style = { ...style, pixelLine: true };
  return plainStroke.call(this, style);
};

// THE WHOLE-PIXEL FRAME (Aaron, 20 November 2026, playing at 4K): an art pixel must be a whole number of the screen's
// own (device) pixels, or some art pixels come out a pixel wider than others and the picture shimmers and breaks up
// as it scrolls; and the scene must be exactly ART_H art pixels tall, or the hand-painted art is squeezed onto a grid
// a few rows shorter than it was painted for and rows are dropped. So the scene is drawn in a frame exactly
// ART_H x (a whole number) device pixels tall, centred in the window, and the few rows left over above and below
// show more of the scene (never black bars). This works at any size and any Windows display scaling.
// w, h: the window's drawing area in CSS pixels. Returns the frame (CSS pixels) and ps, device pixels per art pixel.
export function artFrame(w, h, dpr = globalThis.devicePixelRatio || 1) {
  const ps = Math.max(1, Math.floor((h * dpr) / ART_H + 1e-6));
  const height = (ART_H * ps) / dpr;
  const y = Math.round(((h - height) / 2) * dpr) / dpr;
  return { width: w, height, y, ps, full: h };
}
// How many CSS pixels to one art pixel for a frame this tall (a whole number of device pixels).
export const pixelSize = h => {
  const dpr = globalThis.devicePixelRatio || 1;
  return Math.max(1, Math.floor((h * dpr) / ART_H + 1e-6)) / dpr;
};

// Sorts the drawn things under root into the picture (pixelated) and the type (crisp). A container marked crisp counts
// as type with everything in it. A container marked smooth (2D-HD, fx/hd.js: the far backdrop, soft and out of focus)
// is left out of the pixels altogether and drawn at full resolution underneath them.
function sort(node, crisp, pic, type, under) {
  if (node.passPicture) return; // the pass's own picture, when it sits in the scene
  if (node.smooth) {
    if (node.visible) under.push(node); // one the scene has hidden stays hidden
    return;
  }
  const isCrisp = crisp || !!node.crisp;
  if (node.renderPipeId) (isCrisp || TYPE.has(node.renderPipeId) ? type : pic).push(node);
  for (const ch of node.children) sort(ch, isCrisp, pic, type, under);
}

export function pixelPass(renderer) {
  const sprite = new Sprite();
  sprite.label = 'pixel-pass';
  sprite.passPicture = true;
  let dither = null;
  try {
    dither = ditherFilter();
    sprite.filters = [dither];
  } catch (e) {
    console.error('The pixel dither could not start; the scenes are pixelated without it.', e);
  }
  let rt = null;
  const m = new Matrix();
  const pic = [],
    type = [],
    under = [];
  let home = null; // where the pass's picture normally sits (the stage, under the scene)
  // Draws root small into the texture and leaves only its type showing for the ordinary full-size pass that follows.
  function draw(root, screen, background = 0x0d0c0a) {
    const s = pixelSize(screen.height);
    // The rows of the window above and below the frame (artFrame) are drawn too, on the same grid.
    const pad = Math.max(0, Math.ceil((screen.y || 0) / s - 1e-6));
    const w = Math.max(1, Math.ceil(screen.width / s)),
      h = Math.max(1, Math.round(screen.height / s) + 2 * pad);
    if (!rt || rt.width !== w || rt.height !== h) {
      rt?.destroy(true);
      rt = RenderTexture.create({ width: w, height: h, resolution: 1, antialias: false, scaleMode: 'nearest' });
      sprite.texture = rt;
    }
    pic.length = type.length = under.length = 0;
    sort(root, false, pic, type, under);
    // With a smooth backdrop, the picture goes into the scene just over it (root.pixelSlot), on a clear background.
    home ??= sprite.parent;
    const slot = under.length ? root.pixelSlot : null;
    if (slot && sprite.parent !== slot) slot.addChild(sprite);
    else if (!slot && home && sprite.parent !== home) home.addChildAt(sprite, 0);
    sprite.visible = false;
    for (const n of under) n.visible = false;
    for (const n of type) n.renderable = false;
    for (const n of pic) n.renderable = true;
    m.identity()
      .scale(1 / s, 1 / s)
      .translate(0, pad);
    renderer.render({
      container: root,
      target: rt,
      transform: m,
      clear: true,
      clearColor: slot ? [0, 0, 0, 0] : background,
    });
    for (const n of pic) n.renderable = false;
    for (const n of type) n.renderable = true;
    for (const n of under) n.visible = true;
    sprite.scale.set(s);
    // In the slot the picture moves with the scene (its shake), which the drawing already has in it.
    if (slot) sprite.position.set(-root.x, -root.y - pad * s);
    else sprite.position.set(0, -pad * s);
    if (dither) {
      const u = dither.resources.ditherUniforms.uniforms;
      u.uPix = s * (globalThis.devicePixelRatio || 1);
      // A scene that pans (the site) says where its camera is, in whole art pixels (root.ditherShift).
      const sh = root.ditherShift;
      u.uShift[0] = sh ? ((Math.round(sh.x) % 4) + 4) % 4 : 0;
      u.uShift[1] = sh ? ((Math.round(sh.y) % 4) + 4) % 4 : 0;
    }
    sprite.visible = true;
  }
  // Puts everything back as it was, for a scene that is not pixelated.
  function release() {
    for (const n of pic) n.renderable = true;
    pic.length = type.length = under.length = 0;
    sprite.visible = false;
    if (home && sprite.parent !== home) home.addChildAt(sprite, 0);
  }
  function destroy() {
    release();
    rt?.destroy(true);
    rt = null;
  }
  return { sprite, draw, release, destroy };
}
