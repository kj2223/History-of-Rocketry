// A local display preference, separate from campaign state and simulation actions.
const KEY = 'vg-presentation';
export function initPresentation() {
  const button = document.querySelector('#presentation');
  const apply = mode => {
    document.documentElement.dataset.presentation = mode;
    button.textContent = mode == 'paper' ? 'VIEW: PAPERWORK' : 'VIEW: DEVELOPMENT';
    button.setAttribute('aria-pressed', String(mode == 'paper'));
  };
  let mode = 'paper';
  try { if (localStorage.getItem(KEY) == 'modern') mode = 'modern'; } catch {}
  apply(mode);
  button.addEventListener('click', () => {
    mode = mode == 'paper' ? 'modern' : 'paper';
    apply(mode);
    try { localStorage.setItem(KEY, mode); } catch {}
  });
}
