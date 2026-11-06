// Persisted random streams (freeze §9.3). A stream is plain JSON: { algorithm, state }.
// Drawing advances only the stream passed in, so streams stay independent.

export const ALGORITHM = 'mulberry32-v1';

// V2 adds its own streams (V2 freeze §12): intelligence noise, crew behaviour and flight operations (the
// Retrofire officer's errors). Entry errors draw from physical.
const SALTS = { physical: 0x9e3779b9, observation: 0x85ebca6b, forecast: 0xc2b2ae35, intelligence: 0x27d4eb2f, crew: 0x165667b1, operations: 0xd3a2646c };
export const STREAMS = Object.keys(SALTS);

const stream = (seed, name) => ({ algorithm: ALGORITHM, state: (seed ^ SALTS[name]) >>> 0 });

export const newStreams = seed => Object.fromEntries(STREAMS.map(name => [name, stream(seed, name)]));

// Keep the streams a V1 save already has and add any V2 stream it lacks, so imported play continues V1's draws.
export const withStreams = (rng, seed) => Object.fromEntries(STREAMS.map(name => [name, rng?.[name] ? { ...rng[name] } : stream(seed, name)]));

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
