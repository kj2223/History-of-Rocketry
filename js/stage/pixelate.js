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
  float d = bayer(floor(screen / uPix)) - 0.5;
  vec3 q = clamp(floor(c.rgb * uLevels + 0.5 + d) / uLevels, 0.0, 1.0);
  finalColor = vec4(q, c.a);
}`;
function ditherFilter() {
  return new Filter({
    glProgram: GlProgram.from({ vertex: VERTEX, fragment: FRAGMENT, name: 'pixel-dither' }),
    resources: { ditherUniforms: { uPix: { value: 6, type: 'f32' }, uLevels: { value: LEVELS, type: 'f32' } } },
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

// How many screen pixels to one art pixel for a scene this tall.
export const pixelSize = h => Math.max(2, Math.round(h / ART_H));

// Sorts the drawn things under root into the picture (pixelated) and the type (crisp). A container marked crisp counts
// as type with everything in it. A container marked smooth (2D-HD, fx/hd.js: the far backdrop, soft and out of focus)
// is left out of the pixels altogether and drawn at full resolution underneath them.
function sort(node, crisp, pic, type, under) {
  if (node.passPicture) return; // the pass's own picture, when it sits in the scene
  if (node.smooth) {
    under.push(node);
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
    const w = Math.max(1, Math.ceil(screen.width / s)),
      h = Math.max(1, Math.ceil(screen.height / s));
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
    m.identity().scale(1 / s, 1 / s);
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
    if (slot) sprite.position.set(-root.x, -root.y);
    else sprite.position.set(0, 0);
    if (dither) dither.resources.ditherUniforms.uniforms.uPix = s * (globalThis.devicePixelRatio || 1);
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
