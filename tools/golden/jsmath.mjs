// Golden traces for the C# JsMath helpers (ad-astra AdAstra.Rules/Core/JsMath.cs): Math.round, toFixed, String(x),
// toPrecision(10) and how JSON.stringify writes a number, for values chosen to sit on the awkward edges (halves,
// near-halves, negatives, tiny and huge magnitudes); JSON.stringify of awkward strings; and the canonical checkpoint
// text (campaign.mjs canonical). record(write) writes jsmath.json and jsmath-canonical.json.
import { canonical } from './campaign.mjs';

const VALUES = [
  0,
  -0,
  0.5,
  -0.5,
  1.5,
  -1.5,
  2.5,
  -4.5,
  0.49999999999999994,
  0.15,
  0.25,
  0.35,
  1.005,
  1.045,
  2.675,
  -2.45,
  33.75,
  -33.75,
  0.1 + 0.2,
  1 / 3,
  2 / 3,
  123.456,
  -0.04,
  0.05,
  1e-7,
  1.5e-7,
  123e-20,
  1e21,
  1.23e21,
  9.999e20,
  1e20,
  123456789.125,
  4294967295,
  9007199254740993,
  0.000001,
  0.0000015,
  12.0,
  99.95,
  99.949999,
  70.25,
  23.999,
  -0.0001,
  5e-324,
  1.7976931348623157e308,
  -0.4,
  -0.6,
  1.23456789e-12,
  9.9999999995,
  0.12345678905,
  123456.78905,
];

// Strings JSON.stringify writes in its own way: quotes, backslashes, control characters, the line and paragraph
// separators (left raw), and lone surrogates (escaped).
const STRINGS = [
  'plain',
  'quote " and backslash \\',
  'tab\tnewline\ncarriage\rbell\u0007',
  'separators   and  ',
  'lone \ud800 high and \udc00 low',
  'pair 🚀 rocket',
  'non-ascii é ü ñ – — ’',
];

// Objects for the canonical checkpoint text: sorted keys, numbers to 10 significant figures, undefined dropped.
const OBJECTS = [
  { b: 1, a: 2, c: { z: 0.1 + 0.2, y: [3, 1 / 3, { q: -2.675, p: 1e-7 }] } },
  { 10: 'ten', 2: 'two', b: null, a: undefined, x: [undefined, 1.0000000000000002, -0] },
  { s: 'separators   and   in a value', n: 123456789.123456789, big: 1.23e21, small: 5e-324 },
  [{ k: 70.25 }, 'x', true, null, 9007199254740993],
];

export function record(write) {
  write(
    'jsmath.json',
    VALUES.map(v => ({
      bits: Array.from(new Uint8Array(new Float64Array([v]).buffer)),
      round: Math.round(v),
      negZeroRound: Object.is(Math.round(v), -0),
      fixed: [0, 1, 2, 3].map(d => (Math.abs(v) < 1e21 ? v.toFixed(d) : null)),
      str: String(v),
      json: JSON.stringify(v),
      prec10: Number.isFinite(v) ? String(Number(v.toPrecision(10))) : null,
    })),
  );
  write('jsmath-canonical.json', {
    // Each string travels as its UTF-16 code units, so lone surrogates survive the trip.
    strings: STRINGS.map(s => ({
      units: Array.from({ length: s.length }, (_, i) => s.charCodeAt(i)),
      json: JSON.stringify(s),
    })),
    objects: OBJECTS.map(o => ({ json: JSON.stringify(o), canonical: canonical(o) })),
  });
}
