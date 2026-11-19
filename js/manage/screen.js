// MANAGEMENT MODE: its screen. For now only the opening day, while the base view is built; it says so plainly.
import { managementWhere } from './state.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function showManagement(el, game, { back }) {
  el.innerHTML = `<div class="manage-sheet">
    <p class="kicker">Management</p>
    <h1>${esc(managementWhere(game))}</h1>
    <p>The National Aeronautics and Space Administration opens today. You run its launch centre at the Cape.</p>
    <p class="muted">Management mode is being built. This game is saved in its own slot and will carry on as the base,
      budget and people go in.</p>
    <p><button data-act="manage-title">Back to the title screen</button></p>
  </div>`;
  el.hidden = false;
  el.querySelector('[data-act=manage-title]').addEventListener('click', back);
}

export function hideManagement(el) {
  el.hidden = true;
  el.innerHTML = '';
}
