// Persisted random streams (freeze §9.3). A stream is plain JSON: { algorithm, state }.
// Drawing advances only the stream passed in, so streams stay independent.

export const ALGORITHM = 'mulberry32-v1';

const SALTS = { physical: 0x9e3779b9, observation: 0x85ebca6b, forecast: 0xc2b2ae35 };

export const newStreams = seed => Object.fromEntries(
  Object.entries(SALTS).map(([name, salt]) => [name, { algorithm: ALGORITHM, state: (seed ^ salt) >>> 0 }]));

// A float in [0, 1). Mutates stream.state.
export const draw = stream => {
  if (stream.algorithm !== ALGORITHM) throw new Error(`Unknown random algorithm ${stream.algorithm}`);
  stream.state = (stream.state + 0x6d2b79f5) >>> 0;
  let t = stream.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Standard normal draw (Box–Muller); always takes exactly two draws.
export const normal = stream => {
  const u = draw(stream) || 1e-12, v = draw(stream);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
