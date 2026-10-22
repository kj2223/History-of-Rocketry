// SMALL SHARED HELPERS
// Formatting and random numbers. Nothing here knows about the game or the page.

// Money as the game shows it: "$12,345".
export const formatMoney = amount => '$' + Math.round(amount).toLocaleString();

// A random number from a normal (bell-curve) distribution: mean 0, standard deviation 1.
// Box-Muller method. 6.2832 is 2 x pi, kept at this rounding so results match earlier versions exactly.
export const gaussian = () => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v);
};

// Keep a value between a lower and an upper limit.
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
