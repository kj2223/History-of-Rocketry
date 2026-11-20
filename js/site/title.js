// THE TITLE SCREEN: choose a game mode. Each mode keeps its own saves (js/core/save.js FLIGHT, MANAGEMENT and DESK).
// Flight Director is the game as it has always played; Management is being built (GAME-DESIGN §17.0d).
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// modes: { flight: { saved, onContinue, onNew }, management: { saved, onContinue, onNew, replaces } }, where saved is a
// line saying where that game stands, or null when there is none, and replaces says what happens to that game.
export function showTitle(el, modes) {
  let confirming = null,
    whatIf = false;
  const card = (id, name, text, m, note = '') => {
    const ask = confirming === id;
    return `<section class="title-mode" data-mode="${id}">
      <h2>${name}</h2>
      <p>${text}</p>
      ${note ? `<p class="muted">${note}</p>` : ''}
      ${m.saved ? `<p class="saved">Your game: ${esc(m.saved)}</p>` : ''}
      ${
        ask
          ? `<p>Start a new ${name} game? ${m.replaces ?? 'The one you have now is kept as your backup.'}</p>
             <button class="danger" data-act="new-go" data-mode="${id}">Start a new game</button>
             <button data-act="cancel">Keep my game</button>`
          : `${m.saved ? `<button class="primary" data-act="continue" data-mode="${id}">Continue</button> ` : ''}
             <button ${m.saved ? '' : 'class="primary"'} data-act="new" data-mode="${id}">New game</button>
             ${m.whatIf ? `<label class="title-whatif"><input type="checkbox" data-whatif ${whatIf ? 'checked' : ''}> What if: add one fault that never happened (not historical)</label>` : ''}`
      }
    </section>`;
  };
  const render = () => {
    el.innerHTML = `<div class="title-sheet">
      <h1>Ad Astra</h1>
      <div class="title-modes">
        ${card('flight', 'Flight Director', 'Start as a junior engineer at White Sands in 1945 and work your way to the flight director’s console, from the first rockets to Artemis.', modes.flight)}
        ${card('management', 'Management', 'Run NASA’s launch centre from its founding in October 1958: build the base, fund the programmes and choose the people.', modes.management, 'Being built: the Cape and its first flights are here so far.')}
        ${modes.desk ? card('desk', 'Desk: Apollo 11', 'Sit the EECOM console in Mission Control for the real Apollo 11 count, 16 July 1969: the spacecraft’s power, oxygen and cabin, the voice loops in your headset, and the go/no-go for launch.', modes.desk, 'First part: the last two hours forty of the count, to liftoff.') : ''}
      </div>
    </div>`;
  };
  el.onchange = e => {
    if (e.target.matches('[data-whatif]')) whatIf = e.target.checked;
  };
  el.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    const m = modes[b.dataset.mode];
    if (b.dataset.act === 'continue') m.onContinue();
    else if (b.dataset.act === 'new') {
      if (m.saved) {
        confirming = b.dataset.mode;
        render();
      } else m.onNew({ whatIf });
    } else if (b.dataset.act === 'new-go') m.onNew({ whatIf });
    else if (b.dataset.act === 'cancel') {
      confirming = null;
      render();
    }
  };
  render();
  el.hidden = false;
}

export function hideTitle(el) {
  el.hidden = true;
  el.onclick = null;
  el.onchange = null;
  el.innerHTML = '';
}
