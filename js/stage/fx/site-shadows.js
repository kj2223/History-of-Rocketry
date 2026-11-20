// CAST SHADOWS ON THE SITE (2D-HD rework, Aaron 20 November 2026): with the camera looking down on the site at
// three-quarters, everything standing on the ground throws a real shadow across it, the shape of the thing itself:
// the buildings, the tower, the rocket on the pad, the people. Each silhouette is laid flat on the ground from its
// foot, away from the sun and a little toward the camera, so the shadows lengthen and swing as the day goes on
// (the sun's angle comes from fx/daylight.js, lightAt). Under everything that stands there is also a soft dark patch
// where the light cannot reach (the contact shadow), day and night.
// The shadows are soft (only the light is soft; the pixels stay crisp): they are drawn over the pixel picture and
// under the type, blurred, in one dark colour, so where two overlap they do not darken twice.
// Nothing here changes a flight or a save (presentation only).
import { BlurFilter, Container, Graphics, Matrix, Sprite } from '../../vendor/pixi.min.mjs';
import { GROUND } from '../../site/draw.js';
import { footprint } from '../../data/white-sands.js';

const SHADOW = 0x141a28; // a cool dark: shadows on a sunny day are lit by the blue sky

export function siteShadows() {
  const root = new Container();
  root.label = 'site-shadows';
  root.crisp = true; // over the pixel picture, under the type (pixelate.js)
  const blur = new BlurFilter({ strength: 3, quality: 3 });
  root.filters = [blur];
  const world = new Container();
  const contact = new Graphics();
  const cast = new Container();
  const castRocket = new Sprite();
  root.addChild(world, castRocket);
  world.addChild(contact, cast);
  let copy = null,
    copyKey = '',
    people = null;
  const m = new Matrix(),
    mo = new Matrix();

  // build: makes a fresh copy of the site's buildings (site-art.js buildSite). key: when to make a new one.
  function update(g, { s, camX, tiltPx, L, key, build, overlay, dpr, peopleContext, flying }) {
    if (key !== copyKey) {
      copyKey = key;
      copy?.destroy({ children: true });
      copy = build();
      // Only what stands up: not the ground, the shadows the old drawing painted, or the words.
      const [back, , , front, texts] = copy.children;
      for (const c of [back, front, texts]) if (c) c.visible = false;
      cast.addChildAt(copy, 0);
    }
    if (!people && peopleContext) {
      people = new Graphics(peopleContext);
      cast.addChild(people);
    }
    root.tint = SHADOW;
    world.scale.set(s);
    world.position.set(-camX * s, tiltPx);
    blur.strength = 1.2 * s;

    // The sun: which way the shadows run (dir), how long (length) and how dark (alpha), as the old bands had them.
    const sh = L.shadow;
    const kx = Math.max(-2.4, Math.min(2.4, 0.55 * sh.length * sh.dir)),
      ky = 0.2;
    const a = Math.min(0.5, sh.alpha * 2.6);
    cast.visible = castRocket.visible = a > 0.01;
    cast.alpha = a;
    // A point h above the ground lands kx h along and ky h toward the camera from its foot.
    m.set(1, 0, -kx, -ky, kx * GROUND, GROUND * (1 + ky));
    cast.setFromMatrix(m);

    // The rocket on the pad and whatever else the old drawing puts on the overlay, in screen pixels.
    castRocket.texture = overlay.texture;
    castRocket.visible = cast.visible && !flying;
    castRocket.alpha = a;
    const gs = GROUND * s + tiltPx;
    mo.set(1 / dpr, 0, -kx / dpr, -ky / dpr, kx * gs, gs * (1 + ky));
    castRocket.setFromMatrix(mo);

    // The contact shadow: dark under each building's foot, a little wider than it.
    contact.clear();
    const ids = ['office', 'hangar', 'stand', 'blockhouse', 'tower'];
    if (!g.crewed) ids.push('dugout');
    for (const id of ids) {
      const p = footprint(id, g);
      if (!p) continue;
      contact.ellipse(p.x + p.w / 2, GROUND + 2, p.w / 2 + 14, 9).fill({ color: 0xffffff, alpha: 0.32 });
      contact.rect(p.x - 4, GROUND - 3, p.w + 8, 6).fill({ color: 0xffffff, alpha: 0.22 });
    }
  }
  return { root, update };
}
