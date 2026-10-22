// PROPELLANTS AND PAYLOADS: what a rocket can burn and carry. Tune launch costs and science here.
// The names are also stored in saves (a launch campaign's propellant and payload), so rename one only with care.

// Propellant cost = handlingCost + pricePerKg x (kilograms loaded) ^ 0.8, so it grows more slowly than the rocket (rules/design.js).
//   isp: specific impulse (s), how hard the propellant pushes
//   reliability: the engine's base chance of a clean flight with this propellant
//   density: kilograms loaded per kilogram of tank capacity (tank capacity is rated in alcohol-equivalent kg)
export const PROPELLANTS = {
  'Alcohol & LOX': { handlingCost: 1200, pricePerKg: 40, isp: 225, reliability: .9, density: 1 },
  'Kerosene & LOX': { handlingCost: 2000, pricePerKg: 50, isp: 290, reliability: .85, density: 1.25 },
};

// Payloads.
//   cost ($), mass (kg)
//   science: science value at 30 km (scales with altitude; a satellite earns it in full in orbit)
//   telemetryShare: share of the science that telemetry returns if the payload is NOT recovered
//   needs: research package needed before it can fly
//   animal: an animal passenger (headlines either way)     satellite: needs a satellite launcher
//   mercury: carried only on Mercury flights; the capsule itself is built and paid for separately
export const PAYLOADS = {
  'Inert Ballast': { cost: 500, mass: 10, science: 0 },
  'Sensor Suite': { cost: 2000, mass: 25, science: 4000, telemetryShare: .5 },
  'Cosmic-Ray Package': { cost: 3000, mass: 20, science: 6000, telemetryShare: .6, needs: 'cosm' },
  'Film Camera': { cost: 3500, mass: 30, science: 9000, telemetryShare: 0, needs: 'film' },
  'Primate Capsule': { cost: 6000, mass: 45, science: 12000, telemetryShare: .3, animal: 1, needs: 'bio' },
  'Explorer Satellite': { cost: 15000, mass: 20, science: 25000, satellite: 1 },
  'Mercury Capsule': { cost: 0, mass: 100, science: 0, mercury: 1 },
};
