import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Cache, Container, Sprite, Texture } from '../js/vendor/pixi.min.mjs';
import { canvasPicture, ownedTextureSprite } from '../js/stage/kit.js';

test('closing a room releases its canvas textures and preserves shared textures', t => {
  class Canvas {
    getContext() {
      return {};
    }
  }
  globalThis.document = { createElement: () => new Canvas() };
  globalThis.HTMLCanvasElement = Canvas;
  t.after(() => {
    delete globalThis.document;
    delete globalThis.HTMLCanvasElement;
  });

  const room = new Container();
  const nested = new Container();
  const picture = canvasPicture(100, 50, () => {});
  const { texture } = picture;
  const { source } = texture;
  const canvas = source.resource;
  const sharedCanvas = new Canvas();
  sharedCanvas.width = sharedCanvas.height = 32;
  const shared = Texture.from(sharedCanvas);
  t.after(() => shared.destroy(true));
  const changingPicture = ownedTextureSprite();
  const replacementCanvas = new Canvas();
  replacementCanvas.width = replacementCanvas.height = 32;
  changingPicture.texture = Texture.from(replacementCanvas);
  room.addChild(nested, changingPicture, new Sprite(shared), ownedTextureSprite());
  nested.addChild(picture);

  assert.equal(Cache.get(canvas), texture);
  room.destroy({ children: true });

  assert.equal(texture.destroyed, true);
  assert.equal(source.destroyed, true);
  assert.equal(Cache.has(canvas), false);
  assert.equal(Cache.has(replacementCanvas), false);
  assert.equal(Cache.get(sharedCanvas), shared);
  assert.equal(shared.destroyed, false);
});
