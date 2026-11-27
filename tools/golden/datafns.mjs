// Golden traces for the functions inside the game's data (js/data/*.js): the ones tools/export-data.mjs can only mark as
// { "$function": path } (listed in _functions.json), which the C# port translates by hand (AdAstra.Rules/Data). Each is
// called over a spread of the inputs the game gives it (see the callers named below) and the edges around them.
// record(write) writes datafns.json: { cases: [{ path, args, result } | { path, args, throws } (+ after: the args after
// the call, for a function that changes them)] }.
// Encoding in args, where JSON has no word for it: { $nan: true } is NaN, { $undefined: true } an undefined argument
// (a trailing undefined is just left off, so a JS default applies), and { $near: { c, r } } the function
// x => Math.abs(x - c) < r (staysNear's near, as js/scenes/rooms.js builds it). A result of undefined is written null.
import { readFileSync } from 'node:fs';
import * as campaign from '../../js/data/campaign.js';
import * as cast from '../../js/data/cast.js';
import * as deepSpace from '../../js/data/deep-space.js';
import * as flow from '../../js/data/flow.js';
import * as kits from '../../js/data/kits.js';
import * as powerup from '../../js/data/powerup.js';
import * as simCards from '../../js/data/sim-cards.js';
import * as talkMod from '../../js/data/talk.js';
import * as vehicles from '../../js/data/vehicles.js';
import * as whiteSands from '../../js/data/white-sands.js';

const clone = v => (v === undefined ? undefined : structuredClone(v));

// Arguments as written to the golden file (see the encoding above).
function encode(v) {
  if (typeof v === 'number' && Number.isNaN(v)) return { $nan: true };
  if (v === undefined) return { $undefined: true };
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === 'object' && v.$near) return v;
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v)
        .filter(([, x]) => x !== undefined)
        .map(([k, x]) => [k, encode(x)]),
    );
  return v;
}
// What the JS function is called with: a $near becomes its function.
const decode = v => (v && typeof v === 'object' && v.$near ? x => Math.abs(x - v.$near.c) < v.$near.r : v);

export function record(write) {
  const cases = [];
  // Call fn with args (each deep-copied first, so a call cannot change what is written), record the result.
  // mutates: also record the args after the call.
  const call = (path, fn, args, mutates = false) => {
    const live = args.map(a => decode(clone(a)));
    const c = { path, args: encode(args) };
    try {
      const r = fn(...live);
      c.result = r === undefined ? null : r;
    } catch (e) {
      c.throws = e.constructor.name;
    }
    if (mutates) c.after = encode(live);
    cases.push(c);
  };

  // ---- campaign.js
  const { start, done } = campaign.SITE_CHANGES.newBlockhouse;
  const blockDays = [
    0,
    -100,
    1,
    start - 100,
    start - 1,
    start - 0.5,
    start,
    start + 0.25,
    start + 1,
    (start + done) / 2,
    done - 1,
    done - 0.001,
    done,
    done + 0.5,
    done + 1,
    9000,
    30000,
    NaN,
  ];
  for (const d of blockDays) call('campaign.blockhouseState', campaign.blockhouseState, [d]);

  // lastWord: the season-end page (js/scenes/rooms.js) gives the last round, g.mission and the record's losses.
  for (const r of campaign.SEASON) call('campaign.lastWord', campaign.lastWord, [r, null, null]);
  call('campaign.lastWord', campaign.lastWord, [{}, null, null]);
  const artemis = campaign.SEASON.find(r => r.id === 'artemis-4');
  const missions = [null, {}, { fate: 'killed' }, { fate: 'hurt' }, { fate: 'safe' }, { fate: 'odd' }, { fate: null }];
  const decisionSets = [
    undefined,
    [],
    [{ id: 'traverse' }],
    [null, { id: 'descent' }, { id: 'traverse', choice: 'go' }],
    [{ id: 'descent' }],
    { id: 'traverse' },
    [{ id: 'Traverse' }],
  ];
  const lossSets = [
    null,
    [],
    [{ round: 'artemis-4' }],
    [{ round: 'apollo-13' }],
    [{ round: 'apollo-1' }, { round: 'artemis-4' }],
  ];
  for (const m of missions)
    for (const ds of m ? decisionSets : [undefined])
      for (const l of lossSets) {
        const mission = m && ds !== undefined ? { ...m, decisions: ds } : m;
        call('campaign.lastWord', campaign.lastWord, [artemis, mission, l]);
      }

  // offerBySeat: the record's offers (rooms.js, o.seat); offerFor: a round's turningPoint (game.js).
  for (const s of ['retro', 'engineer', 'flight', 'programme', 'test-conductor', 'astronaut', '', null, undefined])
    call('campaign.offerBySeat', campaign.offerBySeat, s === undefined ? [] : [s]);
  for (const tp of [
    true,
    false,
    null,
    'nasa',
    'engineer',
    'flight',
    'programme',
    'gemini',
    'test-conductor',
    'NASA',
    1,
    '',
  ])
    call('campaign.offerFor', campaign.offerFor, [tp]);
  call('campaign.offerFor', campaign.offerFor, []);
  for (const r of campaign.SEASON) if (r.turningPoint) call('campaign.offerFor', campaign.offerFor, [r.turningPoint]);

  // onPath: every round on each path (game.js), and the shapes a path can take.
  const pathRounds = [
    ...campaign.SEASON.filter((r, i) => i % 3 === 0 || r.path === 'jpl'),
    { id: 'both', path: ['jpl', 'nasa'] },
    { id: 'none', path: [] },
    { id: 'nullish', path: [null] },
    { id: 'empty', path: '' },
    { id: 'null', path: null },
    { id: 'bare' },
  ];
  for (const r of pathRounds) {
    call('campaign.onPath', campaign.onPath, [r]);
    // undefined (not null): the C# reads a null path as the JS default, since game.js passes g.record.path, absent
    // until an offer sets it.
    for (const p of ['jpl', 'nasa', 'army', undefined]) call('campaign.onPath', campaign.onPath, [r, p]);
  }

  for (const r of [...campaign.SEASON, { id: 'x', site: 'mars' }, { id: 'y', site: '' }, { id: 'z', site: null }, {}])
    call('campaign.siteOf', campaign.siteOf, [r]);

  // ---- cast.js: game.js asks for every seat's holder and the roles in the round's year.
  const years = [
    1945, 1957, 1964, 1965, 1966, 1967, 1972, 1973, 1974.5, 1975, 1981, 1985, 1986, 1988, 1990, 1993, 1996,
  ];
  years.push(1997, 1998, 1999.99, 2000, 2010, 2018, 2019, 2020, 2021, 2022, 2030, NaN);
  for (const id of [...Object.keys(cast.SUCCESSIONS), 'you', 'hoyt'])
    for (const y of years) call('cast.holderIn', cast.holderIn, [id, y]);
  for (const y of years) call('cast.rolesIn', cast.rolesIn, [y]);
  const names = Object.values(cast.SUCCESSIONS).flatMap(l => l.map(s => s.name));
  for (const n of [...names, 'Cher', '', 'two  spaces', ' trailing ', 'Lt. Cmdr. Rosa Alvarez'])
    call('cast.surname', cast.surname, [n]);

  // ---- deep-space.js: the plotting board (js/stage/deep.js) asks for planets and craft on every board day.
  const J2000 = 18993; // a spread around the year 2000 in game days; the exact epoch is in the module
  const planetDays = [0, -1000, 0.5, 6000, 6000.25, J2000, 12345.678, 20000, 27000, 31000, 1e6];
  for (const id of Object.keys(deepSpace.PLANETS))
    for (const d of planetDays) call('deep-space.planetAt', deepSpace.planetAt, [id, d]);
  call('deep-space.planetAt', deepSpace.planetAt, ['pluto', 0]);
  for (const crafts of Object.values(deepSpace.ROUTES))
    for (const craft of crafts) {
      const L = craft.legs;
      const days = [L[0].day - 30, L[0].day];
      for (let i = 0; i < L.length - 1; i++)
        for (const k of [0.001, 0.25, 0.5, 0.75, 1]) days.push(L[i].day + (L[i + 1].day - L[i].day) * k);
      const end = L[L.length - 1].day;
      days.push(end + 0.5, end + 3, end + 365, end + 3650, end + 20000);
      for (const d of days) call('deep-space.craftAt', deepSpace.craftAt, [craft, d]);
    }
  for (const id of [...Object.keys(deepSpace.ROUTES), 'surveyor-1', 'ranger-7', 'x'])
    call('deep-space.routeReach', deepSpace.routeReach, [id]);

  // ---- flow.js: world/flow.js asks with the vehicle, whether a probe, and the round's season id.
  for (const v of [...Object.keys(flow.FLOWS), 'ranger', 'x']) {
    call('flow.flowFor', flow.flowFor, [v]);
    for (const probe of [false, true])
      for (const season of [null, 'sts-1', 'apollo-11']) call('flow.flowFor', flow.flowFor, [v, probe, season]);
  }

  // ---- kits.js: the range calls (game.js flightCalls passes r.burn to burnout, the result to away and final, and
  // perigee and apogee to orbit); shortFor and fixerOf at a review (js/mercury.js).
  const burns = [47, 47.5, 65.25, 0, 0.1 + 0.2, 145.33333333333334, -3, 1e21, 1e-7, 123456789.125];
  const results = [
    { failure: null, deep: { say: 'She passed the Moon at 60,000 kilometres.', phase: 'flyby' } },
    { failure: 'leak', deep: { say: 'No signal from her. She fell short.', phase: 'cruise' } },
    { failure: '', deep: { say: 'Clean.' } },
    { failure: 'guidance', deep: {} },
    { failure: null, deep: {} },
  ];
  const calls = Object.entries(kits.KITS).flatMap(([kit, k]) =>
    Object.entries(k.calls || {})
      .filter(([, f]) => typeof f === 'function')
      .map(([name, f]) => [`kits.KITS.${kit}.calls.${name}`, f, name]),
  );
  for (const [path, f, name] of calls) {
    if (name === 'burnout') for (const b of burns) call(path, f, [b]);
    else if (name === 'orbit')
      for (const [p, a] of [
        [0.5, 1.5],
        [2.5, -0.4],
        [213.7, 3965.99],
        [179.49999, 4000.5],
        [-0.5, 1e21],
        [0, 0],
      ])
        call(path, f, [p, a]);
    else for (const r of results) call(path, f, [r]);
  }
  const causes = [...Object.keys(kits.SHORT), 'zzz', '', null];
  for (const v of ['dragon', 'sls', 'wac', 'redstone', 'shuttle', 'x'])
    for (const c of causes) call('kits.shortFor', kits.shortFor, [v, c]);
  const fixerCauses = [
    ...new Set([...Object.values(kits.FIXERS).flatMap(f => Object.keys(f.by)), 'nominal', 'unknown', 'zzz', 'leak']),
  ];
  for (const v of [...Object.keys(kits.FIXERS), 'wac', 'x'])
    for (const c of [...fixerCauses, '', null]) call('kits.fixerOf', kits.fixerOf, [v, c]);

  // ---- powerup.js: every board the control scene can build (each switch on or off, the top-up too).
  const switches = [...Object.keys(powerup.POWER_SYSTEMS), 'topup'];
  for (let mask = 0; mask < 1 << switches.length; mask++) {
    const on = Object.fromEntries(switches.map((k, i) => [k, !!(mask & (1 << i))]));
    call('powerup.powerTotal', powerup.powerTotal, [on]);
    call('powerup.powerPlan', powerup.powerPlan, [on]);
  }
  for (const on of [
    {},
    { guidance: 1, quads: 'yes', voice: true, displays: true },
    { guidance: true, topup: 0, cabin: null },
  ]) {
    call('powerup.powerTotal', powerup.powerTotal, [on]);
    call('powerup.powerPlan', powerup.powerPlan, [on]);
  }

  // ---- sim-cards.js: cardsFor with the record and the console in front of you (site/console-hud.js); earnCard after
  // a clean sim (mercury.js) or a clean rehearsal (game.js, which can pass an undefined scenario).
  const keys = Object.keys(simCards.SIM_CARDS);
  const records = [
    null,
    {},
    { cards: null },
    { cards: {} },
    { cards: Object.fromEntries(keys.map((k, i) => [k, { day: 100 + i }])) },
    {
      cards: { seastate: { day: 1 }, control: { day: 2 }, guidance: { day: 3 }, lox: { day: 4 }, nothing: { day: 5 } },
    },
    { cards: { radar: { day: 9 }, thrust: { day: 8 }, lox: { day: 7 } } },
    { cards: { offstation: { day: 1 }, seastate: { day: 2 }, plug: { day: 3 } } },
    { cards: true },
  ];
  const phases = [...new Set(Object.values(simCards.SIM_CARDS).map(c => c.phase))];
  const consoles = [
    null,
    { kind: 'sim', phase: 'ascent' },
    ...phases.map(phase => ({ kind: 'flight', phase })),
    { phase: 'ascent', poll: true },
    { phase: 'ip', poll: 0 },
    { phase: 'poll' },
    { kind: 'flight' },
  ];
  for (const r of records) for (const c of consoles) call('sim-cards.cardsFor', simCards.cardsFor, [r, c]);
  const earnRecords = [
    {},
    { cards: null },
    { cards: {} },
    { cards: { plug: { day: 3 } }, other: 1 },
    { cards: { plug: null } },
  ];
  for (const r of earnRecords)
    for (const s of [...keys, 'x', null]) call('sim-cards.earnCard', simCards.earnCard, [r, s, 4321.5], true);
  {
    // Earned twice in a row: the second time is no card.
    const r = {};
    for (const [s, d] of [
      ['plug', 10],
      ['plug', 11],
      ['seastate', 12],
      ['seg51loose', 13],
      ['seg51false', 14],
    ]) {
      call('sim-cards.earnCard', simCards.earnCard, [r, s, d], true);
      simCards.earnCard(r, s, d);
    }
  }

  // ---- talk.js: every person on the site at every beat (site/main.js). The people and beats are read from talk.js's
  // own tables (inside the function, so not exports), so a new line there is asked for here.
  const talkSrc = readFileSync(new URL('../../js/data/talk.js', import.meta.url), 'utf8');
  const talkTables = new Function(
    `${talkSrc.slice(talkSrc.indexOf('const lines = '), talkSrc.indexOf('  return lines[id]'))}; return { lines, idle };`,
  )();
  const people = [...new Set([...Object.keys(talkTables.lines), ...Object.keys(talkTables.idle)]), 'you', 'x'];
  const beats = [...new Set(Object.values(talkTables.lines).flatMap(Object.keys)), 'flight', 'x'];
  for (const id of people) for (const b of [...beats, null]) call('talk.talk', talkMod.talk, [id, b]);
  call('talk.talk', talkMod.talk, [null, 'flow']);

  // ---- vehicles.js: every revision (truth/physics.js), and one that is not there.
  for (const r of [...Object.keys(vehicles.REVISIONS), '', null, 'nope/r1'])
    call('vehicles.lineage', vehicles.lineage, [r]);

  // ---- white-sands.js: the site's buildings for a spread of game states (where people walk, what is drawn).
  const states = [
    { site: 'white-sands', day: start - 1 },
    { day: (start + done) / 2 },
    { day: done },
    { site: 'white-sands', day: done + 100, crewed: false },
    { site: 'cape', day: 0 },
    { site: 'cape', day: 9000, crewed: true },
    { day: 100, crewed: true },
    { day: 100, truck: { x: 1234.5 } },
    { day: 100, truck: { x: null } },
    { day: 100, truck: {} },
    { day: 100, truck: { x: 0 } },
    {},
  ];
  const ids = [...Object.keys(whiteSands.PLACES), 'x'];
  for (const g of states) {
    call('white-sands.newBlockhouseStands', whiteSands.newBlockhouseStands, [g]);
    for (const id of ids) {
      call('white-sands.footprint', whiteSands.footprint, [id, g]);
      const f = whiteSands.footprint(id, g);
      const xs = f ? [f.x - 10.5, f.x - 10, f.x, f.x + f.w / 2, f.x + f.w + 10, f.x + f.w + 10.5, f.x - 25] : [0, 500];
      for (const x of xs) {
        call('white-sands.atPlace', whiteSands.atPlace, [id, g, x]);
        call('white-sands.atPlace', whiteSands.atPlace, [id, g, x, 0]);
        call('white-sands.atPlace', whiteSands.atPlace, [id, g, x, 25]);
      }
    }
  }
  const walkers = [
    { x: 100 },
    { x: 100, target: 100 },
    { x: 100, target: 500 },
    { x: 500, target: 100 },
    { x: 100, target: null },
  ];
  walkers.push({ x: 139.5, target: 60.5 }, { x: 140, target: 120 }, { id: 'you', x: 120, target: 90, hidden: false });
  for (const p of walkers)
    for (const near of [
      { c: 100, r: 40 },
      { c: 500, r: 40 },
      { c: 120, r: 20 },
    ])
      call('white-sands.staysNear', whiteSands.staysNear, [p, { $near: near }]);

  // ---- The kits' range calls as game.js flightCalls makes them for whichever kit flies: k.burnout(r.burn), k.away(r),
  // k.final(r), k.orbit(perigee, apogee). The C# has a dispatcher for each (KitsFunctions.Burnout etc.); a kit without
  // the call gives null (here, an optional call's undefined).
  const dispatch = [];
  const kitCall = (kit, name, args) => {
    const r = kits.KITS[kit]?.calls?.[name]?.(...args.map(clone));
    dispatch.push({ kit, call: name, args: encode(args), result: r === undefined ? null : r });
  };
  for (const kit of [...Object.keys(kits.KITS), 'x']) {
    for (const b of [47, 65.25, 0.1 + 0.2]) kitCall(kit, 'burnout', [b]);
    for (const r of results) {
      kitCall(kit, 'away', [r]);
      kitCall(kit, 'final', [r]);
    }
    kitCall(kit, 'orbit', [213.7, 3965.5]);
  }

  write('datafns.json', { cases, dispatch });
}
