// MANAGEMENT MODE: its screen, the base view of the Cape (js/manage/view.js).
import { startBaseView } from './view.js';

let view = null;

export function showManagement(el, game, { back, save }) {
  hideManagement(el);
  view = startBaseView(el, game, { back, save });
  globalThis.__manage = view; // a test hook, harmless in play
}

export function hideManagement(el) {
  view?.stop();
  view = null;
  el.hidden = true;
  el.innerHTML = '';
}
