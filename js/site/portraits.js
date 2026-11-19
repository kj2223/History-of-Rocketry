// SPEAKER PORTRAITS (next-level visual pass, November 2026): a small pixel portrait of whoever spoke last on the
// loop, beside the loop's lines. Each face is made from the person's name, so it is the same face every time, with
// the hair and dress of the year: a field jacket before 1958, a white shirt, tie and headset with its boom mic in the
// console years, a polo shirt in the Shuttle years, and so on. The people are fictional; so are their faces.
// Drawn once per person and year into a small canvas, then shown scaled up with hard pixels (style.css).
import { lookOf, hashOf } from '../stage/people.js';

export const PORTRAIT = 20; // art pixels a side

const hex = c => `#${c.toString(16).padStart(6, '0')}`;
const darker = (c, k) =>
  (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);

const mix = (a, b, k) => {
  const ch = (c, sh) => (c >> sh) & 255;
  const m = sh => Math.round(ch(a, sh) + (ch(b, sh) - ch(a, sh)) * k);
  return (m(16) << 16) | (m(8) << 8) | m(0);
};

// Paints a portrait through px(x, y, colour). Pure apart from px, for the tests.
export function paintPortrait(px, name, year) {
  const N = PORTRAIT;
  const L = lookOf(name, year);
  const skin = L.skin,
    skinS = darker(skin, 0.78),
    hair = L.hair;
  const bg =
    year < 1958 ? 0x3a3428 : year < 1976 ? 0x12221a : year < 1996 ? 0x221a10 : year < 2016 ? 0x2a3240 : 0x101828;
  const polo = [0x5a6e8a, 0x8a4a3a, 0x4a6a4a, 0x6a5a8a][Math.floor(hashOf(name, 5) * 4)];
  const shirt =
    year < 1958 ? 0x9a8a62 : year < 1976 ? 0xe4e2da : year < 1996 ? polo : year < 2016 ? 0x8aa0c0 : 0x2e3c52;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) px(x, y, bg);
  // Shoulders and shirt, a tie in the console years, a collar.
  for (let y = 16; y < N; y++) for (let x = 2 + (19 - y); x < N - 2 - (19 - y); x++) px(x, y, shirt);
  for (let x = 4; x < 16; x++) px(x, 19, darker(shirt, 0.85));
  if (year >= 1958 && year < 1976) {
    px(9, 16, 0x2a2f3a);
    px(10, 16, 0x2a2f3a);
    for (let y = 17; y < N; y++) (px(9, y, 0x2a2f3a), px(10, y, 0x2a2f3a));
  }
  // Neck.
  for (let y = 14; y < 16; y++) for (let x = 8; x < 12; x++) px(x, y, skinS);
  // The face: an oval, a shade down its right side.
  const rows = {
    4: [7, 12],
    5: [6, 13],
    6: [5, 14],
    7: [5, 14],
    8: [5, 14],
    9: [5, 14],
    10: [5, 14],
    11: [6, 13],
    12: [6, 13],
    13: [7, 12],
    14: [8, 11],
  };
  for (const [y, [a, b]] of Object.entries(rows)) for (let x = a; x <= b; x++) px(x, +y, x >= b - 1 ? skinS : skin);
  // Ears.
  px(4, 9, skinS);
  px(15, 9, skinS);
  // Hair by style.
  const H = (x, y) => px(x, y, hair);
  if (L.style === 'bald') {
    for (const y of [7, 8, 9]) (H(5, y), H(14, y));
  } else {
    for (let x = 6; x <= 13; x++) H(x, 3);
    for (let x = 5; x <= 14; x++) H(x, 4);
    for (const x of [5, 6, 13, 14]) H(x, 5);
    if (L.style === 'crew') for (let x = 7; x <= 12; x++) H(x, 2);
    if (L.style === 'part') {
      for (let x = 6; x <= 11; x++) H(x, 5);
      (H(7, 2), H(8, 2), H(9, 2), H(10, 2), H(11, 2), H(12, 2));
    }
    if (L.style === 'long') for (let y = 5; y <= 15; y++) (H(4, y), H(15, y), y > 12 && (H(5, y), H(14, y)));
    if (L.style === 'curly')
      for (const [x, y] of [
        [5, 3],
        [14, 3],
        [4, 5],
        [15, 5],
        [4, 7],
        [15, 7],
        [8, 2],
        [11, 2],
      ])
        H(x, y);
  }
  // Eyes, brows, nose, mouth.
  px(7, 8, 0x1c1c22);
  px(12, 8, 0x1c1c22);
  for (const x of [6, 7, 12, 13]) px(x, 7, darker(hair, 0.9));
  px(10, 10, skinS);
  px(10, 11, skinS);
  for (let x = 8; x <= 11; x++) px(x, 12, darker(skin, 0.62));
  if (L.glasses) {
    for (const x of [6, 7, 8, 11, 12, 13]) px(x, 9, 0x2a2a30);
    (px(6, 8, 0x2a2a30), px(8, 8, 0x2a2a30), px(11, 8, 0x2a2a30), px(13, 8, 0x2a2a30));
    for (const x of [9, 10]) px(x, 8, 0x2a2a30);
  }
  // From 1958 the headset: the band over the hair, a cup on each ear and the boom mic round to the mouth.
  if (year >= 1958) {
    for (let x = 6; x <= 13; x++) px(x, 1, 0x26282c);
    (px(5, 2, 0x26282c), px(14, 2, 0x26282c), px(4, 3, 0x26282c), px(15, 3, 0x26282c));
    for (let y = 4; y < 8; y++) (px(3, y, 0x26282c), px(16, y, 0x26282c));
    for (let y = 8; y < 11; y++) for (const x of [2, 3, 4]) px(x, y, 0x34373c);
    for (const x of [15, 16, 17]) for (let y = 8; y < 11; y++) px(x, y, 0x34373c);
    (px(4, 11, 0x44474c), px(5, 12, 0x44474c), px(6, 13, 0x44474c), px(7, 13, 0x1a1a1e));
  }
  // The screens' light from below on the face, in the console years' green and the Shuttle's amber.
  const glow = year >= 1958 && year < 1976 ? 0x6ac08a : year >= 1976 && year < 1996 ? 0xffb347 : 0;
  if (glow)
    for (const [x, y] of [
      [6, 13],
      [7, 14],
      [6, 12],
      [5, 11],
      [5, 10],
    ])
      px(x, y, mix(skin, glow, 0.35));
}

const cache = new Map();
// A data URL of the portrait, drawn once per name and year.
export function portraitURL(name, year) {
  const key = `${name}|${year < 1958 ? 0 : year < 1976 ? 1 : year < 1996 ? 2 : year < 2016 ? 3 : 4}|${year < 1968 ? 0 : year < 1990 ? 1 : 2}`;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = PORTRAIT;
  const ctx = cv.getContext('2d');
  paintPortrait(
    (x, y, c) => {
      ctx.fillStyle = hex(c);
      ctx.fillRect(x, y, 1, 1);
    },
    name,
    year,
  );
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}
