// Small helpers shared by the UI files.
export const $ = selector => document.querySelector(selector);
export const escapeHtml = text => String(text).replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
// An <option> for a select: value, label, disabled, and the current value (selected when it matches).
export const option = (value, label, disabled, current) => `<option value="${value}"${disabled ? ' disabled' : ''}${current == value ? ' selected' : ''}>${label}</option>`;
// A share as a percentage; anything from 99.5% up shows as 99.5%.
export const percent = share => share >= .995 ? '99.5%' : Math.round(share * 100) + '%';

// REDRAWING A PANEL without rebuilding it. Each panel's HTML is built from scratch on every redraw, but setHTML only
// touches what changed: unchanged HTML is skipped entirely, and otherwise the new HTML is matched node by node against
// what is on screen, changing text and attributes in place. Open dropdowns, focus, scroll positions, hover and
// animations survive, and a panel whose content did not change is never touched.
const shownHTML = new WeakMap();
export function setHTML(element, html) {
  if (!element || shownHTML.get(element) === html) return;
  shownHTML.set(element, html);
  const template = document.createElement('template');
  template.innerHTML = html;
  morphChildren(element, template.content);
}
function morphChildren(target, source) {
  const wanted = [...source.childNodes];
  wanted.forEach((node, index) => {
    const current = target.childNodes[index];
    if (current) morphNode(current, node);
    else target.appendChild(node);
  });
  while (target.childNodes.length > wanted.length) target.lastChild.remove();
}
function morphNode(current, wanted) {
  if (current.nodeType != wanted.nodeType || current.nodeName != wanted.nodeName) {
    current.replaceWith(wanted);
    return;
  }
  if (current.nodeType != Node.ELEMENT_NODE) {
    if (current.nodeValue != wanted.nodeValue) current.nodeValue = wanted.nodeValue;
    return;
  }
  for (const { name } of [...current.attributes]) if (!wanted.hasAttribute(name)) current.removeAttribute(name);
  for (const { name, value } of [...wanted.attributes]) if (current.getAttribute(name) !== value) current.setAttribute(name, value);
  morphChildren(current, wanted.content || wanted);
  // Form controls: show what the new HTML says, as a fresh element would, unless the player is using this one right now.
  if (current == document.activeElement) return;
  if (current.nodeName == 'SELECT') {
    const options = [...current.options], marked = options.map(option => option.hasAttribute('selected')).lastIndexOf(true);
    const index = marked >= 0 ? marked : options.findIndex(option => !option.disabled);
    if (current.selectedIndex != index) current.selectedIndex = index;
  } else if (current.nodeName == 'INPUT') {
    if (current.type == 'checkbox' || current.type == 'radio') current.checked = wanted.hasAttribute('checked');
    else if (current.value != (wanted.getAttribute('value') ?? '')) current.value = wanted.getAttribute('value') ?? '';
  }
}
