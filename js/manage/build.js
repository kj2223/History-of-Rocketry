// MANAGEMENT MODE: BUILDING. The Building line of the budget pays for new pads and buildings on the Cape's open plots,
// and for fitting upgrades into the slots the pads already have (Aaron's answer 2A: prefabs on a grid with upgrade
// slots). Work goes on day by day; when the Building line cannot pay for everything under way, everything goes slower,
// in proportion. Nothing is ever lost: work waits for money.
// - New buildings stand on game.works ({ id, kind, tx, ty, padKind?, name, cost, days, progress }) while they go up;
//   construction.js draws them from that list. Finished, they move to game.built and join the base.
// - Upgrades being fitted are in game.fitting ({ pad, slot, cost, days, progress }); fitted ones in game.fitted
//   ({ padId: [slot] }). A pad's upgrades shorten its turnaround (schedule.js reads pad.before and pad.after).
// Pure functions over the saved game, apart from the changes they are named for.
import { CAPE_1958_BASE } from './base.js';
import { CAPE_1958, PAD_KINDS, VEHICLE_NAMES } from './manifest.js';
import { lines } from './budget.js';

// The open plots, roughly where the Cape's next pads and buildings went. kinds: what can be built there.
// cost: millions of dollars; days: how long it takes with the money there. Assumed round figures, to be tuned in play.
export const PLOTS = [
  { id: 'lc-34', name: 'Launch Complex 34', tx: 20, ty: 38, kinds: ['atlas', 'thor', 'redstone'] },
  { id: 'lc-12', name: 'Launch Complex 12', tx: 11, ty: 1, kinds: ['atlas', 'thor', 'redstone'] },
  { id: 'lc-19', name: 'Launch Complex 19', tx: 12, ty: 23, kinds: ['atlas', 'thor', 'redstone'] },
  { id: 'hangar-ae', name: 'Hangar AE', tx: 1, ty: 29, kinds: ['hangar'] },
];
export const BUILDS = {
  atlas: { kind: 'pad', padKind: 'atlas', name: 'an Atlas pad', cost: 6, days: 360 },
  thor: { kind: 'pad', padKind: 'thor', name: 'a Thor pad', cost: 3, days: 240 },
  redstone: { kind: 'pad', padKind: 'redstone', name: 'a Redstone pad', cost: 2.5, days: 210 },
  hangar: {
    kind: 'hangar',
    name: 'a hangar',
    cost: 2,
    days: 180,
    text: 'Room to check out two more vehicles: every pad needs a tenth less time before a launch.',
  },
};
// Upgrades a pad can be fitted with: before and after scale its turnaround (manifest.js PAD_KINDS).
export const UPGRADES = {
  tower: { name: 'a taller service tower', cost: 1, days: 90, before: 0.8, text: 'a fifth less time stacking' },
  deflector: { name: 'a flame deflector', cost: 0.8, days: 60, after: 0.6, text: 'two fifths less clearing up' },
  umbilical: { name: 'an umbilical mast', cost: 0.6, days: 60, before: 0.9, text: 'a tenth less time stacking' },
};
const HANGAR_BEFORE = 0.9; // each hangar built beyond the base's own
const YEAR = 365.25;

// The base as it stands: the 1958 Cape and what has been finished since.
export function baseOf(game) {
  const fitted = game.fitted ?? {},
    hangars = (game.built ?? []).filter(b => b.kind === 'hangar').length,
    all = [...CAPE_1958_BASE, ...(game.built ?? [])];
  return all.map(b => {
    if (b.kind !== 'pad') return b;
    const kind = PAD_KINDS[b.padKind],
      slots = fitted[b.id] ?? [],
      by = k => slots.reduce((m, s) => m * (UPGRADES[s]?.[k] ?? 1), 1);
    return {
      ...b,
      before: Math.round(kind.before * by('before') * HANGAR_BEFORE ** hangars),
      after: Math.round(kind.after * by('after')),
    };
  });
}

// The pads for the scheduler: the manifest's pads with their turnarounds, and every pad finished since.
export const padsOf = game =>
  baseOf(game)
    .filter(b => b.kind === 'pad')
    .map(b => ({ id: b.id, name: b.name, kind: b.padKind, before: b.before, after: b.after }));

// The plots still open (nothing built and nothing going up).
export function openPlots(game) {
  const taken = new Set([...(game.built ?? []), ...(game.works ?? [])].map(b => b.id));
  return PLOTS.filter(p => !taken.has(p.id));
}

// What everything under way needs from the Building line in the budget's year, prorated as the budget is (millions).
export function buildNeed(game, budget, startDay) {
  const from = Math.max(budget.start, startDay),
    part = (budget.end - from + 1) / YEAR,
    jobs = [...(game.works ?? []), ...(game.fitting ?? [])];
  return jobs.reduce((s, j) => s + (j.cost / j.days) * YEAR, 0) * part;
}

// How much of that the Building line covers, 0 to 1.
export function buildCover(game, budget, startDay) {
  const need = buildNeed(game, budget, startDay);
  if (!need) return 1;
  const line = lines(budget, game.split, game.day, startDay).find(l => l.id === 'building').amount;
  return Math.min(1, line / need);
}

// Start building on a plot. what: a BUILDS key the plot allows. Returns a line for the log, or null.
export function startBuilding(game, plotId, what) {
  const plot = openPlots(game).find(p => p.id === plotId),
    b = BUILDS[what];
  if (!plot || !b || !plot.kinds.includes(what)) return null;
  game.works = [
    ...(game.works ?? []),
    {
      id: plot.id,
      name: plot.name,
      kind: b.kind,
      ...(b.padKind ? { padKind: b.padKind } : {}),
      tx: plot.tx,
      ty: plot.ty,
      cost: b.cost,
      days: b.days,
      progress: 0,
    },
  ];
  return `Work starts on ${plot.name}: ${b.name}, about ${Math.round(b.days / 30)} months with the money there.`;
}

// Start fitting an upgrade to a pad. Returns a line for the log, or null.
export function startFitting(game, padId, slot) {
  const pad = baseOf(game).find(b => b.id === padId && b.kind === 'pad'),
    u = UPGRADES[slot];
  if (!pad || !u || (game.fitted?.[padId] ?? []).includes(slot)) return null;
  if ((game.fitting ?? []).some(f => f.pad === padId && f.slot === slot)) return null;
  game.fitting = [...(game.fitting ?? []), { pad: padId, slot, cost: u.cost, days: u.days, progress: 0 }];
  return `${pad.name} is being fitted with ${u.name}.`;
}

// One day's work. Returns lines for the log as things are finished.
export function advanceBuilding(game, budget, startDay) {
  const cover = budget ? buildCover(game, budget, startDay) : 1,
    out = [];
  for (const w of game.works ?? []) w.progress = Math.min(1, w.progress + cover / w.days);
  for (const f of game.fitting ?? []) f.progress = Math.min(1, f.progress + cover / f.days);
  for (const w of (game.works ?? []).filter(w => w.progress >= 1)) {
    const { cost, days, progress, ...b } = w;
    game.built = [...(game.built ?? []), b];
    out.push(
      b.kind === 'pad'
        ? `${b.name} is finished. ${list(PAD_KINDS[b.padKind].vehicles.map(v => VEHICLE_NAMES[v] ?? v))} flights can use it now.`
        : `${b.name} is finished. Every pad needs a little less time before a launch.`,
    );
  }
  for (const f of (game.fitting ?? []).filter(f => f.progress >= 1)) {
    game.fitted = { ...(game.fitted ?? {}), [f.pad]: [...(game.fitted?.[f.pad] ?? []), f.slot] };
    const pad = baseOf(game).find(b => b.id === f.pad);
    out.push(`${pad?.name ?? f.pad} now has ${UPGRADES[f.slot].name}: ${UPGRADES[f.slot].text}.`);
  }
  game.works = (game.works ?? []).filter(w => w.progress < 1);
  game.fitting = (game.fitting ?? []).filter(f => f.progress < 1);
  return out;
}
const list = xs => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`);

// Throws on saved building records this version cannot carry on. All optional: older games load without them.
export function checkBuilding(c) {
  const plots = new Set(PLOTS.map(p => p.id)),
    pads = new Set([...CAPE_1958.pads.map(p => p.id), ...PLOTS.map(p => p.id)]);
  const job = j => typeof j?.progress === 'number' && j.progress >= 0 && j.progress < 1 && j.cost > 0 && j.days > 0;
  if (c.works !== undefined && !(Array.isArray(c.works) && c.works.every(w => plots.has(w.id) && job(w))))
    throw new Error('bad works');
  if (c.built !== undefined && !(Array.isArray(c.built) && c.built.every(b => plots.has(b.id))))
    throw new Error('bad buildings');
  if (
    c.fitting !== undefined &&
    !(Array.isArray(c.fitting) && c.fitting.every(f => pads.has(f.pad) && UPGRADES[f.slot] && job(f)))
  )
    throw new Error('bad fitting');
  if (
    c.fitted !== undefined &&
    !(
      c.fitted &&
      typeof c.fitted === 'object' &&
      Object.entries(c.fitted).every(([p, s]) => pads.has(p) && Array.isArray(s) && s.every(x => UPGRADES[x]))
    )
  )
    throw new Error('bad upgrades');
}
