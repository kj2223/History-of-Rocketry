// Golden traces for the C# JsMath helpers (ad-astra AdAstra.Rules/Core/JsMath.cs): Math.round, toFixed, String(x) and
// how JSON.stringify writes a number, for values chosen to sit on the awkward edges (halves, near-halves, negatives,
// tiny and huge magnitudes). record(write) writes jsmath.json.
const VALUES = [
  0, -0, 0.5, -0.5, 1.5, -1.5, 2.5, -4.5, 0.49999999999999994, 0.15, 0.25, 0.35, 1.005, 1.045, 2.675, -2.45, 33.75,
  -33.75, 0.1 + 0.2, 1 / 3, 2 / 3, 123.456, -0.04, 0.05, 1e-7, 1.5e-7, 123e-20, 1e21, 1.23e21, 9.999e20, 1e20, 123456789.125,
  4294967295, 9007199254740993, 0.000001, 0.0000015, 12.0, 99.95, 99.949999, 70.25, 23.999, -0.0001, 5e-324, 1.7976931348623157e308,
];
export function record(write) {
  write(
    'jsmath.json',
    VALUES.map(v => ({
      bits: Array.from(new Uint8Array(new Float64Array([v]).buffer)),
      round: Math.round(v),
      fixed: [0, 1, 2, 3].map(d => (Math.abs(v) < 1e21 ? v.toFixed(d) : null)),
      str: String(v),
      json: JSON.stringify(v),
    })),
  );
}
