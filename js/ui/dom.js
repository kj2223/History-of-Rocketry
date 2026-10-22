// Small helpers shared by the UI files.
export const $ = selector => document.querySelector(selector);
export const escapeHtml = text => String(text).replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
// An <option> for a select: value, label, disabled, and the current value (selected when it matches).
export const option = (value, label, disabled, current) => `<option value="${value}"${disabled ? ' disabled' : ''}${current == value ? ' selected' : ''}>${label}</option>`;
// A share as a percentage; anything from 99.5% up shows as 99.5%.
export const percent = share => share >= .995 ? '99.5%' : Math.round(share * 100) + '%';
