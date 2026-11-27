// Golden traces for the programme's world and your career record: js/world/{budget,crew,flow,ledger,memory,people,slot}.js,
// js/career/{record,chronicle}.js, js/truth/{lunar,channels}.js and js/core/{telemetry,frame-steps}.js. Stateful modules
// are recorded as scripts: each step's arguments, what it returned and the whole state after it; random streams are
// recorded after every step that draws. record(write) writes world-*.json; the C# replays them in ad-astra's
// AdAstra.Rules.Tests/World*GoldenTests.cs.
import * as budget from '../../js/world/budget.js';
import * as crew from '../../js/world/crew.js';
import * as flow from '../../js/world/flow.js';
import * as ledger from '../../js/world/ledger.js';
import * as memory from '../../js/world/memory.js';
import * as people from '../../js/world/people.js';
import * as slot from '../../js/world/slot.js';
import * as rec from '../../js/career/record.js';
import * as chron from '../../js/career/chronicle.js';
import * as lunar from '../../js/truth/lunar.js';
import * as channels from '../../js/truth/channels.js';
import * as tel from '../../js/core/telemetry.js';
import { frameSteps, MAX_STEP, MAX_CATCH_UP } from '../../js/core/frame-steps.js';
import { newStreams } from '../../js/core/rng.js';
import { dayOf } from '../../js/core/calendar.js';
import { offerFor } from '../../js/data/campaign.js';

const copy = v => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const SEEDS = [0, 1, 7, 42, 1945, 123456789, 0x7fffffff, 0x80000000, 0xffffffff];
// Numbers JSON cannot carry are written as strings and read back by the C#.
const num = x => (Number.isFinite(x) ? x : String(x));
const unnum = x => (typeof x === 'string' ? Number(x) : x);
const states = rng => Object.fromEntries(Object.entries(rng).map(([k, s]) => [k, s.state]));

// ---- budget and slot ----
function recordBudget(write) {
  const out = { LINE: budget.LINE, COSTS: budget.COSTS, scripts: [], planCost: [], dollars: [] };
  for (const plan of [
    {},
    { inspector: 'kowalski' },
    { inspector: 'delgado', burn: 'long', leak: true },
    { burn: 'short', leak: false },
    { inspector: '', burn: 'long' },
    { inspector: 'nobody' },
    { leak: 1 },
  ])
    out.planCost.push({ plan, ret: num(budget.planCost(plan)) });
  for (const n of [
    0,
    -0,
    -0.4,
    0.5,
    999.5,
    1000,
    1234.5,
    -1234.5,
    30000,
    1234567.89,
    1e21,
    1.2345678901234567e25,
    2 ** 53 + 2,
    NaN,
    Infinity,
    -Infinity,
  ])
    out.dollars.push({ n: num(n), negZero: Object.is(n, -0), ret: budget.dollars(n) });

  const d1953 = dayOf(1953, 3, 1),
    d1954 = dayOf(1953, 7, 1),
    d1952 = dayOf(1951, 12, 31),
    d1960 = dayOf(1960, 6, 30);
  const scripts = [
    [
      {},
      [
        ['lineFor', d1953],
        ['spend', d1953, 12000, 'long firing'],
        ['spend', d1953, 15000, 'rework'],
        ['spend', d1953, 3000, 'leak'],
        ['spend', d1953, 1, 'slip'],
        ['spend', d1953, 9000, 'rework'],
        ['lineFor', d1954],
        ['spend', d1954, 31000, 'big'],
        ['spend', d1952, 500, 'earlier year'],
        ['spend', d1960, -100, 'refund'],
        ['lineFor', d1960],
        ['spend', d1952, 40000, 'over again'],
      ],
    ],
    [
      { rounds: [], overspent: 2, budget: { 1953: { line: 30000, spent: 29999.5, items: [] } } },
      [
        ['spend', d1953, 0.5, 'exact'],
        ['spend', d1953, 0.25, 'over'],
        ['spend', d1953, -10, 'back under'],
        ['spend', d1953, 20, 'over twice'],
      ],
    ],
  ];
  for (const [start, steps] of scripts) {
    const r = copy(start);
    const s = { start: copy(start), steps: [] };
    for (const [op, day, amount, what] of steps) {
      const ret = op === 'lineFor' ? budget.lineFor(r, day) : budget.spend(r, day, amount, what);
      s.steps.push({ op, day, amount, what, ret: copy(ret), after: copy(r) });
    }
    out.scripts.push(s);
  }

  // The range slot.
  const sl = {
    SLOT_HOURS: slot.SLOT_HOURS,
    REBUILD_HOURS: slot.REBUILD_HOURS,
    MIN_HOURS: slot.MIN_HOURS,
    DAY_HOURS: slot.DAY_HOURS,
    LATE_ROUNDS: slot.LATE_ROUNDS,
    newSlot: [],
    scripts: [],
    hoursText: [],
    lateMark: [],
  };
  for (const v of [...Object.keys(slot.SLOT_HOURS), 'redstone', ''])
    for (const short of [0, 1, 2, 3, 4, 5, 6, 7, 9, -2, 0.5])
      sl.newSlot.push({ vehicle: v, short, ret: copy(slot.newSlot(v, short)) });
  sl.newSlot.push({ vehicle: 'viking', short: null, omitShort: true, ret: copy(slot.newSlot('viking')) });
  const view = x => ({
    hoursLeft: num(slot.hoursLeft(x)),
    overrun: num(slot.overrun(x)),
    daysOver: num(slot.daysOver(x)),
  });
  for (const [v, short, spends] of [
    [
      'wac',
      0,
      [
        [0.5, 'look'],
        [0.25, 'meter'],
        [0.1, 'tenth'],
        [0.2, 'fifth'],
        [0, 'nothing'],
        [-1, 'negative'],
        [1.7, 'flag'],
        [3, 'leak check'],
        [0.3333, 'third'],
        [8, 'over a day'],
        [8.0000000001, 'just over'],
      ],
    ],
    [
      'viking',
      2,
      [
        [6, 'all'],
        [0.01, 'just'],
        [7.99, 'day'],
        [0.01, 'two days'],
        [8, 'three'],
      ],
    ],
    [
      'juno',
      0,
      [
        [0.1, 'a'],
        [0.2, 'b'],
        [0.7, 'c'],
        [0.105, 'd'],
        [0.115, 'e'],
      ],
    ],
  ]) {
    const x = slot.newSlot(v, short);
    const s = { vehicle: v, short, start: copy(x), steps: [] };
    for (const [h, what] of spends) {
      slot.spendHours(x, h, what);
      s.steps.push({ hours: h, what, after: copy(x), ...view(x) });
    }
    sl.scripts.push(s);
  }
  slot.spendHours(null, 1, 'nothing');
  sl.none = view(null);
  for (const h of [
    0,
    0.001,
    0.0083,
    0.25,
    0.5,
    0.75,
    0.99,
    0.991,
    1,
    1.25,
    1.5,
    2,
    2.008,
    2.5,
    7.75,
    10,
    100.1,
    -0.25,
    -1.5,
    0.008333,
    1 / 120,
  ])
    sl.hoursText.push({ h, ret: slot.hoursText(h) });
  for (const rounds of [
    [],
    [{ late: true }],
    [{ late: true }, { late: 1 }],
    [{ late: true }, {}, { late: true }],
    [{ late: true }, { late: true }, {}, {}],
    [{}, { late: true }, { late: 'yes' }, { late: 0 }],
    [{ late: true }, { late: true }, { late: true }, {}, { late: true }],
  ])
    sl.lateMark.push({ rounds, ret: slot.lateMark(rounds) });
  out.slot = sl;
  write('world-budget.json', out);
}

// ---- crew and people ----
function recordCrew(write) {
  const out = { CREW_TRAITS: crew.CREW_TRAITS, TRAITS: people.TRAITS, cases: [] };
  const boards = [
    {},
    { sea: 4 },
    { sea: 4.5 },
    { sea: 5, late: false },
    { late: true },
    { sea: 6, late: true },
    { sea: 3, late: 1 },
    { sea: 7, late: '' },
  ];
  for (const [id, t] of Object.entries(crew.CREW_TRAITS))
    out.cases.push({
      id,
      consents: boards.map(b => crew.consents(t, b)),
      ownAbortAt: crew.ownAbortAt(t),
      impatient: [0, 1, 2, 3].map(h => crew.impatient(t, h)),
    });
  out.boards = boards;
  write('world-crew.json', out);
}

// ---- the launch flow ----
function recordFlow(write) {
  const out = { YOU_EXTRA: flow.YOU_EXTRA, MAX_SLIP: flow.MAX_SLIP, newFlow: [], flowRisk: [], scripts: [] };
  const START = 4000;
  for (const v of [
    'wac',
    'v2',
    'bumper',
    'aerobee',
    'viking',
    'vanguard',
    'juno',
    'ranger',
    'redstone',
    'atlas',
    'titan',
    'saturnib',
    'saturn5',
    'shuttle',
    'dragon',
    'sls',
    'nothing',
  ])
    for (const [today, probe, season] of [
      [0, false, null],
      [START - 3, false, null],
      [START - 6, false, null],
      [START, false, null],
      [START - 20, true, null],
      [START - 100, false, 'sts-1'],
      [START - 7, false, 'apollo-13'],
      [START - 30, false, 'artemis-1'],
    ])
      out.newFlow.push({
        vehicle: v,
        start: START,
        today,
        probe,
        season,
        ret: copy(flow.newFlow(v, START, today, probe, season)),
      });
  out.newFlow.push({
    vehicle: 'titan',
    start: START,
    today: 0,
    omit: true,
    ret: copy(flow.newFlow('titan', START, 0)),
  });
  const risks = {
    leakRisk: 0.1,
    separationRisk: 0.2,
    holddownRisk: 0.05,
    tankRisk: 0.3,
    ssmeRisk: 0.85,
    relightRisk: null,
    computerRisk: 0.12,
    vanesRisk: 0.5,
    other: 1,
  };
  for (const v of [
    'wac',
    'v2',
    'viking',
    'vanguard',
    'juno',
    'titan',
    'saturn5',
    'shuttle',
    'sls',
    'dragon',
    'ranger',
    'nothing',
  ])
    for (const [probe, season] of [
      [false, null],
      [true, null],
      [false, 'apollo-13'],
      [false, 'sts-1'],
      [false, 'artemis-1'],
    ]) {
      const ret = flow.flowRisk(risks, v, probe, season);
      out.flowRisk.push({ vehicle: v, probe, season, same: ret === risks, ret: copy(ret) });
    }
  out.risks = risks;

  // Scripts: a flow and a round with faults, then tests run, cut and rehearsed in order.
  const scripts = [
    [
      'vanguard',
      null,
      { 'fuel-press': 'leak', 'lox-line': 'leak', interstage: 'separation', sphere: 'weld' },
      ['you', 'rehearse:hold-glitch', 'practiced'],
    ],
    ['vanguard', null, { 'fuel-press': 'leak', interstage: 'separation' }, ['team', 'cut', 'team', 'practiced']],
    [
      'juno',
      null,
      { 'lox-feed': 'leak', 'fuel-valve': 'leak', 'cluster-leads': 'separation' },
      ['you', 'cut', 'you', 'rehearse:all-go', 'practiced'],
    ],
    ['viking', null, { holddown: 'holddown', fins: 'fin' }, ['team', 'you', 'rehearse:needless', 'practiced']],
    ['v2', null, { vanes: 'vanes', 'alc-valve': 'leak' }, ['you', 'you', 'rehearse:hold-glitch', 'practiced']],
    [
      'saturn5',
      'apollo-13',
      {
        'o2-tanks': 'tank',
        's2-engines': 'j2',
        sps: 'sps',
        iu: 'saturnctl',
        'cabin-wiring': 'cabin',
        'lm-computer': 'alarm',
      },
      ['you', 'you', 'rehearse:hold-glitch', 'team', 'team', 'practiced'],
    ],
    ['saturn5', 'apollo-13', { 'o2-tanks': 'tank' }, ['team', 'team', 'cut', 'team', 'practiced']],
    [
      'sls',
      'artemis-1',
      { 'rs25-engines': 'ssme', icps: 'relight' },
      ['you', 'rehearse:hold-glitch', 'cut', 'cut', 'you', 'practiced'],
    ],
    [
      'shuttle',
      'sts-1',
      { 'ssme-engines': 'ssme', 'gpc-strings': 'computer', 'fc-1': 'fuelcell', 'cabin-wiring': 'cabin' },
      ['you', 'you', 'rehearse:hold-glitch', 'team', 'team', 'practiced'],
    ],
    [
      'dragon',
      null,
      { 'merlin-engines': 'merlin', 'abort-thrusters': 'abort', 'docking-system': 'computer' },
      ['team', 'rehearse:needless', 'you', 'rehearse:hold-glitch', 'practiced'],
    ],
    [
      'titan',
      null,
      {
        'titan-autopilot': 'titanctl',
        'stage2-engine': 'stage2',
        'tail-plug': 'shutdown',
        hatch: 'hatch',
        'fuel-cells': 'fuelcell',
        computer: 'computer',
      },
      ['you', 'you', 'rehearse:hold-glitch', 'you', 'cut', 'team', 'practiced'],
    ],
    [
      'redstone',
      null,
      { 'tail-plug': 'plug', autopilot: 'control', 'lox-valve': 'lox' },
      ['team', 'you', 'you', 'rehearse:hold-glitch', 'team', 'team', 'practiced'],
    ],
    [
      'atlas',
      null,
      { scanners: 'scanner', 'sustainer-feed': 'shortburn', programmer: 'guidance' },
      ['you', 'team', 'you', 'rehearse:all-hold', 'cut', 'team', 'practiced'],
    ],
    ['wac', null, {}, ['team', 'you', 'rehearse:hold-glitch', 'practiced']],
  ];
  for (const [vehicle, season, faults, plan] of scripts)
    for (const seed of [0, 3, 0xffffffff, 2024]) {
      const f = flow.newFlow(vehicle, START, START - 40, false, season);
      const round = { seed, vehicle, faults: { ...faults }, events: [] };
      const s = { vehicle, season, seed, faults, start: copy(f), steps: [] };
      let reh = null;
      for (const p of plan) {
        const step = { op: p };
        const due = flow.dueTest(f);
        step.due = due ? f.tests.indexOf(due) : -1;
        step.canCut = flow.canCut(f);
        if (due) {
          step.dayOf = flow.dayOf(f, due);
          step.def = copy(flow.defOf(f, due));
        }
        if ((p === 'team' || p === 'you' || p === 'cut') && !due) {
          step.skipped = true;
        } else if (p === 'team' || p === 'you') {
          step.ret = copy(flow.runTest(f, round, due, p));
        } else if (p === 'cut') {
          step.ret = flow.cutTest(f, due);
          if (step.ret === 0) {
            // A cut refused (no slip, or a test not due) leaves the test to the team.
            step.refused = true;
            step.ret2 = copy(flow.runTest(f, round, due, 'team'));
          }
        } else if (p.startsWith('rehearse')) {
          // Rehearse the last test run by you, as the game does after you sit in.
          const t = [...f.tests].reverse().find(x => x.status === 'you');
          step.test = t ? f.tests.indexOf(t) : -1;
          reh = t ? flow.newRehearsal(f, round, t) : null;
          step.reh = copy(reh);
          if (reh) {
            step.steps = copy(flow.rehearsalSteps(reh));
            step.marks = [];
            const how = p.split(':')[1];
            let over = false,
              guard = 0;
            while (!over && guard++ < 20) {
              const m = flow.rehearsalMark(reh);
              const hold =
                how === 'all-hold' ||
                (how === 'hold-glitch' && m.glitch != null) ||
                (how === 'needless' && (reh.at === 0 || m.glitch != null));
              step.marks.push({ mark: copy(m), hold });
              over = flow.rehearsalCall(reh, hold);
            }
            step.afterOver = flow.rehearsalCall(reh, true); // past the end: no call kept
            step.markPast = copy(flow.rehearsalMark(reh));
            step.grade = flow.rehearsalGrade(reh);
            t.grade = step.grade.grade;
            step.rehAfter = copy(reh);
          }
        } else if (p === 'practiced') {
          step.ret = flow.practiced(f);
        }
        step.flow = copy(f);
        step.round = copy(round);
        s.steps.push(step);
      }
      out.scripts.push(s);
    }
  // A test object not in the flow (indexOf -1), and practiced/dueTest on nothing.
  {
    const f = flow.newFlow('vanguard', START, 0);
    const stray = { ...f.tests[0] };
    const round = {
      seed: 99,
      vehicle: 'vanguard',
      faults: { 'fuel-press': 'leak', interstage: 'separation' },
      events: [],
    };
    out.stray = {
      start: copy(f),
      test: copy(stray),
      ret: copy(flow.runTest(f, round, stray)),
      flow: copy(f),
      round: copy(round),
      stray: copy(stray),
    };
    out.stray.reh = copy(flow.newRehearsal(f, round, { ...f.tests[1] }));
    out.stray.noReh = flow.newRehearsal(f, round, f.tests[0]);
    out.practicedNull = flow.practiced(null);
    out.dueNull = flow.dueTest(null);
  }
  write('world-flow.json', out);
}

// ---- the anomaly ledger ----
function recordLedger(write) {
  const out = {
    FAMILY: ledger.FAMILY,
    ANOMALIES: ledger.ANOMALIES,
    NEW_CHANCE: ledger.NEW_CHANCE,
    MAX_GRADE: ledger.MAX_GRADE,
    GROWTH: ledger.GROWTH,
    WORKED: ledger.WORKED,
    SLIP_DAYS: ledger.SLIP_DAYS,
    desk: {},
    scripts: [],
  };
  for (const f of ['control', 'pogo', 'oring', 'foam', 'merlin', 'shield', 'tank', 'chute', 'x'])
    out.desk[f] = ledger.deskOf(f);
  const risks = {
    controlRisk: 0.1,
    shieldRisk: 0.2,
    fuelcellRisk: 0.3,
    thrusterRisk: null,
    pogoRisk: 0.5,
    tankRisk: 0.9,
    chuteRisk: 0.05,
    oringRisk: 0.15,
    foamRisk: 0.2,
    merlinRisk: 0.01,
  };
  out.risks = risks;
  const vehicles = ['redstone', 'atlas', 'titan', 'saturnib', 'saturn5', 'shuttle', 'sls', 'dragon'];
  for (const seed of [0, 1, 42, 1945, 0x80000000, 0xffffffff, 7]) {
    const p = seed === 7 ? { ledger: [] } : seed === 42 ? { flights: [1], ledger: null } : {};
    const s = { seed, start: copy(p), steps: [] };
    const MUTATES = ['afterFlight', 'work', 'accept', 'signOffUnclaimed'];
    const push = (op, args, ret, extra = {}) =>
      s.steps.push({ op, ...args, ret: copy(ret), ...extra, ...(MUTATES.includes(op) ? { after: copy(p) } : {}) });
    push('openItems', {}, ledger.openItems(p));
    push('withLedger', { vehicle: 'shuttle' }, ledger.withLedger(risks, p, 'shuttle'));
    for (let i = 0; i < 45; i++) {
      const vehicle = i % 11 === 10 ? 'wac' : vehicles[(i * 3 + (seed % 5)) % vehicles.length];
      const name = `Flight ${i + 1}`;
      push('afterFlight', { vehicle, index: i, name }, ledger.afterFlight(p, { vehicle, seed, index: i, name }));
      const open = ledger.openItems(p);
      push(
        'openItems',
        {},
        open.map(e => e.id),
      );
      push(
        'texts',
        {},
        open.map(e => ledger.textOf(e)),
      );
      // Work the odd item, sign the rest off (some explicitly, the others as nobody called them).
      open.forEach((e, k) => {
        if ((i + k) % 5 === 0) push('work', { id: e.id }, ledger.work(p, e.id));
        else if ((i + k) % 3 === 0) push('accept', { id: e.id }, ledger.accept(p, e.id));
      });
      push('signOffUnclaimed', {}, ledger.signOffUnclaimed(p));
      if (i % 7 === 0) {
        push('accept', { id: 'nope' }, ledger.accept(p, 'nope'));
        push('work', { id: 'nope' }, ledger.work(p, 'nope'));
        const closed = (p.ledger || []).find(e => e.status === 'closed');
        if (closed) {
          push('accept', { id: closed.id }, ledger.accept(p, closed.id));
          push('work', { id: closed.id }, ledger.work(p, closed.id));
        }
      }
      if (i % 4 === 0) {
        const wl = ledger.withLedger(risks, p, vehicle);
        push('withLedger', { vehicle }, wl, { same: wl === risks });
        push(
          'signedOff',
          {},
          ledger.signedOff(p).map(e => e.id),
        );
        for (const fault of ['oring', 'pogo', 'control', 'merlin', 'chute'])
          push(
            'onLedgerFor',
            { vehicle, fault },
            ledger.onLedgerFor(p, vehicle, fault).map(e => e.id),
          );
      }
    }
    out.scripts.push(s);
  }
  out.emptyWithLedger = { same: ledger.withLedger(risks, { ledger: [] }, 'shuttle') === risks };
  out.initLedger = ledger.initLedger();
  write('world-ledger.json', out);
}

// ---- memory ----
function recordMemory(write) {
  const out = { scripts: [] };
  const peopleA = {
    ellis: { name: 'Ellis' },
    morgan: { name: 'Morgan' },
    vega: { name: 'Vega', role: 'pad' },
    ghost: {},
  };
  const peopleB = { ellis: { name: 'Hartley' }, morgan: { name: 'Morgan' }, ghost: {} };
  const steps = [
    ['remember', 'A', 'ellis', 'You held for the weather.', { tone: 'warm', trust: 1 }, 10],
    ['remember', 'A', 'morgan', 'The radar was ready.', undefined, undefined],
    ['remember', 'A', 'nobody', 'Not said.', {}, 3],
    ['remember', 'A', 'vega', 'The pad shed door.', { tone: 'cold' }, 12],
    ['remember', 'A', 'ellis', 'You signed off the seal.', { trust: -1 }, 14],
    ['remember', 'A', 'ghost', 'Nameless.', { tone: null, trust: 0.5 }, 15],
    ['memoriesOf', 'A', 'ellis'],
    ['memoriesOf', 'A', 'ghost'],
    ['recall', 'A'],
    ['recall', 'A'],
    ['memoriesOf', 'B', 'ellis'],
    ['recall', 'B'],
    ['remember', 'B', 'ellis', 'Hartley remembers the slip.', { tone: 'dry', trust: -2 }, 30],
    ['recall', 'B'],
    ['recall', 'B'],
    ['memoriesOf', 'B', 'ellis'],
    ['memoriesOf', 'A', 'vega'],
    ['memoriesOf', 'B', 'nobody'],
  ];
  for (const start of [
    {},
    { rounds: [], memory: [{ seat: 'morgan', name: 'Morgan', day: 1, text: 'Old.', tone: '', trust: 0, said: true }] },
  ]) {
    const r = copy(start);
    const s = { start: copy(start), steps: [] };
    for (const [op, who, seat, text, opts, day] of steps) {
      const ppl = who === 'A' ? peopleA : peopleB;
      let ret;
      if (op === 'remember') ret = memory.remember(r, ppl, seat, text, opts, day);
      else if (op === 'recall') ret = memory.recall(r, ppl);
      else ret = memory.memoriesOf(r, ppl, seat);
      s.steps.push({
        op,
        people: who,
        seat,
        text,
        opts: opts === undefined ? null : opts,
        omitOpts: opts === undefined,
        day: day ?? null,
        omitDay: day === undefined,
        ret: copy(ret),
        after: copy(r),
      });
    }
    out.scripts.push(s);
  }
  out.people = { A: peopleA, B: peopleB };
  out.recallEmpty = memory.recall({}, peopleA);
  out.memoriesEmpty = memory.memoriesOf({}, peopleA, 'ellis');
  write('world-memory.json', out);
}

// ---- career record and chronicle ----
function recordCareer(write) {
  const out = {
    initRecord: rec.initRecord(),
    TRUST: rec.TRUST,
    SEATS: rec.SEATS,
    SEAT_PHRASE: rec.SEAT_PHRASE,
    OFFER_STANDING: rec.OFFER_STANDING,
    scripts: [],
  };
  const offers = [
    offerFor('nasa'),
    offerFor('engineer'),
    offerFor('flight'),
    offerFor('programme'),
    offerFor('gemini'),
    offerFor('first'),
    { seat: 'director', title: 'Director', always: true, text: 'Always.', from: 'ellis', path: 'msc' },
    { seat: 'flight', title: 'No notes' },
  ];
  out.offers = offers;
  const steps = [
    ['standing'],
    ['pendingOffer'],
    ['answerOffer', true],
    ['turningPoint', 0, 100],
    ['pendingOffer'],
    ['addRound', { id: 'wac-1', flight: 'Lost at 12 s', day: 100 }],
    ['addRound', { id: 'wac-2', flight: 'Flew to 60 km', day: 110, late: true }],
    ['shiftTrust', 2],
    ['standing'],
    ['turningPoint', 1, 120],
    ['pendingOffer'],
    ['answerOffer', false],
    ['pendingOffer'],
    ['answerOffer', true],
    ['addRound', { id: 'wac-3', flight: 'Lost: the fins', day: 120, late: true }],
    ['shiftTrust', -10],
    ['standing'],
    ['turningPoint', 2, 130],
    ['pendingOffer'],
    ['answerOffer', true],
    ['turningPoint', 6, 140],
    ['pendingOffer'],
    ['answerOffer', true],
    ['pendingOffer'],
    ['addSim', { right: 2, of: 3 }],
    ['simStanding'],
    ['addSim', { right: 1, of: 3 }],
    ['addSim', { right: 3, of: 3 }],
    ['simStanding'],
    ['standing'],
    ['addSim', { right: 0, of: 3 }],
    ['simStanding'],
    ['shiftTrust', 10],
    ['shiftTrust', 0.5],
    ['standing'],
    ['addRound', { id: 'v2-1', flight: null, day: 200 }],
    ['addRound', { id: 'v2-2', day: 210 }],
    ['standing'],
    ['turningPoint', 0, 220],
    ['answerOffer', true],
    ['turningPoint', 7, 230],
    ['answerOffer', true],
    ['pendingOffer'],
    ['turningPoint', 3, 240],
    ['answerOffer', false],
    ['turningPoint', 5, 250],
    ['answerOffer', true],
  ];
  for (const start of [
    rec.initRecord(),
    {
      rounds: [
        { id: 'old', flight: 'Lost', late: true },
        { id: 'old2', flight: 'Fine', late: true },
      ],
      trust: 1,
      seat: 'retro',
      offers: [],
      overspent: 1,
      sims: [
        { right: 2, of: 2 },
        { right: 2, of: 2 },
        { right: 1, of: 3 },
      ],
    },
  ]) {
    const r = copy(start);
    const s = { start: copy(start), steps: [] };
    for (const [op, a, b] of steps) {
      let ret;
      switch (op) {
        case 'standing':
          ret = rec.standing(r);
          break;
        case 'simStanding':
          ret = rec.simStanding(r);
          break;
        case 'pendingOffer':
          ret = rec.pendingOffer(r);
          break;
        case 'answerOffer':
          ret = rec.answerOffer(r, a);
          break;
        case 'turningPoint':
          ret = rec.turningPoint(r, offers[a], b);
          break;
        case 'addRound':
          ret = rec.addRound(r, copy(a));
          break;
        case 'shiftTrust':
          ret = rec.shiftTrust(r, a);
          break;
        case 'addSim':
          ret = rec.addSim(r, copy(a));
          break;
      }
      s.steps.push({ op, a: a ?? null, b: b ?? null, ret: copy(ret), after: copy(r) });
    }
    out.scripts.push(s);
  }

  // The chronicle.
  const dateText = d => `D${d}`;
  const ch = { MILESTONES: chron.MILESTONES, REAL_LOSSES: chron.REAL_LOSSES, cases: [] };
  const M = Object.fromEntries(chron.MILESTONES.map(m => [m.id, m.real]));
  const records = [
    { rounds: [] },
    {
      rounds: [
        { id: 'bumper-5', flight: 'Flew to 393 km', day: M['bumper-5'] + 3 },
        { id: 'vanguard-tv3', flight: 'Reached orbit', day: M['vanguard-tv3'] - 4 },
        { id: 'pioneer-4', flight: 'Lost at 3 min', day: M['pioneer-4'] + 100 },
      ],
    },
    {
      rounds: [
        { id: 'bumper-5', day: M['bumper-5'] - 3 },
        { id: 'vanguard-tv3', flight: 'Lost on the pad', day: M['vanguard-tv3'] },
        { id: 'mr-3', flight: 'Up and down', day: M['mr-3'] + 4 },
        { id: 'apollo-13', flight: 'Home', day: M['apollo-13'] - 30 },
        { id: 'sts-51l', flight: 'Lost at 73 s', day: M['sts-51l'] + 1 },
        { id: 'demo-2', flight: 'Docked', day: M['demo-2'] - 5000 },
        { id: 'extra', flight: 'x' },
      ],
      losses: [
        { round: 'sts-51l', day: M['sts-51l'] + 1 },
        { round: 'apollo-13', day: M['apollo-13'] - 30 },
        { round: 'mr-3', day: M['demo-2'] + 10 },
      ],
    },
    {
      rounds: [
        { id: 'apollo-8', flight: 'Around the Moon', day: M['apollo-8'] },
        { id: 'apollo-11', flight: 'Lost: the lander', day: M['apollo-11'] + 3 },
        { id: 'gem-4', flight: 'Lost', day: M['gem-4'] - 3 },
        { id: 'ma-6', day: null, flight: 'Orbit' },
      ],
      losses: [{ round: 'gem-8', day: M['gem-8'] }],
    },
  ];
  for (const r of records) {
    const c = { record: r, outcome: {}, rows: [], chronicle: [] };
    for (const m of chron.MILESTONES) {
      c.outcome[m.id] = chron.yourOutcome(r, m.id);
      if (r.rounds.find(x => x.id === m.id)?.day != null) c.rows.push(copy(chron.milestoneRow(r, m, dateText)));
    }
    for (const upTo of [undefined, 0, M['apollo-1'] ?? dayOf(1967, 1, 27), dayOf(1990, 1, 1), M['sts-51l']])
      c.chronicle.push({
        upTo: upTo ?? null,
        omit: upTo === undefined,
        ret: copy(chron.chronicle({ ...r, rounds: r.rounds.filter(x => x.id !== 'ma-6') }, dateText, upTo)),
      });
    ch.cases.push(c);
  }
  out.chronicle = ch;
  write('world-career.json', out);
}

// ---- lunar truth ----
function recordLunar(write) {
  const out = {
    MOON_KM: lunar.MOON_KM,
    MOON_RADIUS: lunar.MOON_RADIUS,
    CRUISE_HOURS: lunar.CRUISE_HOURS,
    LATE_REACH: lunar.LATE_REACH,
    FIRST_FIX: lunar.FIRST_FIX,
    SECOND_FIX: lunar.SECOND_FIX,
    FIX_ERROR: lunar.FIX_ERROR,
    CAMERA_LEADS: lunar.CAMERA_LEADS,
    FALL_PEAK_HOUR: lunar.FALL_PEAK_HOUR,
    scripts: [],
  };
  const plans = [
    ['juno', null, {}, ['first', 'final', 'encounter:20']],
    ['juno', 'depletion', {}, ['dist', 'fallBack']],
    ['juno', null, {}, ['final', 'final', 'dist', 'encounter:30']],
    ['ranger', null, {}, ['first', 'mid:wait', 'final', 'encounter:20']],
    ['ranger', null, {}, ['first', 'first', 'mid:now', 'final', 'encounter:30']],
    ['ranger', null, {}, ['final', 'encounter:10']],
    ['ranger', null, { 'camera-hv': 'camera' }, ['first', 'mid:wait', 'final', 'encounter:30']],
    ['ranger', null, { 'camera-hv': 'camera', panels: 'leak' }, ['first', 'mid:now', 'encounter:10']],
    ['ranger', 'camera', {}, ['first', 'mid:wait', 'final', 'encounter:20']],
    ['ranger', null, { 'camera-hv': 'camera' }, ['mid:now', 'encounter:15']],
    ['ranger', null, {}, ['mid:wait', 'dist', 'encounter']],
    ['ranger', 'depletion', {}, ['dist', 'fallBack']],
  ];
  for (const [vehicle, failure, faults, steps] of plans)
    for (const seed of [...SEEDS, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12]) {
      const round = { seed, vehicle, rng: newStreams(seed), faults: { ...faults }, flight: { at: 1 } };
      const s = { vehicle, failure, faults, seed, steps: [] };
      round.flight.deep = lunar.injection(round, failure);
      s.steps.push({ op: 'injection', ret: copy(round.flight.deep), rng: states(round.rng) });
      for (const p of steps) {
        const [op, arg] = p.split(':');
        let ret;
        if (op === 'first') ret = lunar.firstFix(round);
        else if (op === 'mid') ret = lunar.midcourse(round, arg);
        else if (op === 'final') ret = lunar.finalFix(round);
        else if (op === 'dist')
          ret = [0, 1, 9, 18, 27, 36, 40, 50, 66, 100].map(h => lunar.distanceAt(round.flight.deep, h));
        else if (op === 'encounter')
          ret = copy(arg === undefined ? lunar.encounter(round) : lunar.encounter(round, Number(arg)));
        else if (op === 'fallBack') ret = copy(lunar.fallBack(round));
        s.steps.push({ op, arg: arg ?? null, ret: ret ?? null, flight: copy(round.flight), rng: states(round.rng) });
      }
      out.scripts.push(s);
    }
  // distanceAt on hand-made states, including a vehicle with no cruise time.
  out.distance = [];
  for (const d of [
    { vehicle: 'juno' },
    { vehicle: 'ranger' },
    { vehicle: 'ranger', fallsBack: true, peak: 100000 },
    { vehicle: 'juno', fallsBack: 1, peak: 95000.5 },
    { vehicle: 'x' },
  ])
    for (const h of [0, 0.5, 9, 17.9, 18, 18.1, 36, 40, 66, 70, 1000, -5])
      out.distance.push({ d, h, ret: num(lunar.distanceAt(d, h)) });
  write('world-lunar.json', out);
}

// ---- telemetry channels ----
function recordChannels(write) {
  const out = { TANK_BAND: channels.TANK_BAND, FAMILIES: channels.FAMILIES, stage: {}, rounds: [], fires: [] };
  for (const v of [
    'wac',
    'v2',
    'bumper',
    'aerobee',
    'viking',
    'vanguard',
    'juno',
    'ranger',
    'redstone',
    '',
    null,
    undefined,
  ])
    out.stage[String(v)] = channels.standStageOf(v);
  const rounds = [
    [undefined, {}],
    ['wac', { fitting: 'leak' }],
    ['wac', { pressure: 'leak', 'weld-fwd': 'weld' }],
    ['wac', { 'weld-fwd': 'leak' }],
    ['v2', { 'alc-valve': 'leak' }],
    ['v2', { vanes: 'vanes' }],
    ['bumper', { pressure: 'leak' }],
    ['aerobee', { fitting: 'leak', chamber: 'liner' }],
    ['aerobee', { pressure: 'leak' }],
    ['aerobee', {}],
    ['viking', { 'lox-valve': 'leak' }],
    ['vanguard', { 'fuel-press': 'leak' }],
    ['vanguard', { 'lox-line': 'leak', 'fuel-press': 'leak' }],
    ['juno', { 'lox-feed': 'leak' }],
    ['juno', { 'fuel-valve': 'leak' }],
    ['ranger', { 'atlas-press': 'leak' }],
    ['ranger', { 'atlas-lox': 'weld', 'camera-hv': 'leak' }],
    ['redstone', {}],
  ];
  const S = [0, 1, 3.9, 4, 10, 39.99, 40, 100.5, 250, 999, 2000];
  for (const [vehicle, faults] of rounds)
    for (const seed of [0, 1, 1234, 0x7fffffff, 0xffffffff]) {
      const round = { seed, vehicle, faults };
      const chs = channels.channelsFor(round);
      const count = S.map(s => channels.countReadings(round, s));
      const bands = chs.map(c =>
        [
          c.band ? c.band[0] - 0.01 : 1,
          c.band ? c.band[0] : 0,
          c.band ? c.band[1] : 0,
          c.band ? c.band[1] + 1e-9 : 2,
          null,
          true,
          'x',
        ].map(v => channels.bandOf(c, v)),
      );
      const countBands = count.map(r => chs.map(c => channels.bandOf(c, r[c.id])));
      out.rounds.push({
        vehicle: vehicle ?? null,
        omitVehicle: vehicle === undefined,
        seed,
        faults,
        side: channels.leakSide(round),
        channels: chs,
        count,
        bands,
        countBands,
      });
    }
  // Firings: hand-made traces (a stand's trace points t, pc, tank and, for an Aerobee, wall from the second point on).
  const trace = (n, wall, sag) =>
    Array.from({ length: n }, (_, i) => {
      const t = i * 0.5;
      const p = { t, pc: Math.min(21, i * 7.3) - (sag && t > 2 ? (t - 2) * 3.1 : 0), tank: 23 - t * 0.037 };
      if (wall && i > 0) p.wall = 300 + i * 61.7;
      return p;
    });
  const T = [-1, 0, 0.1, 0.25, 0.5, 0.75, 0.99, 1, 1.3, 2.6, 3.75, 4.5, 5, 6, 60];
  for (const [vehicle, faults, wall, sag] of [
    ['wac', {}, false, false],
    ['wac', { pressure: 'leak' }, false, true],
    ['v2', { 'alc-valve': 'leak' }, false, false],
    ['aerobee', {}, true, false],
    ['aerobee', { fitting: 'leak' }, true, true],
    ['aerobee', {}, false, false],
    ['viking', { 'lox-valve': 'leak' }, false, true],
    ['vanguard', {}, false, false],
    ['juno', { 'fuel-valve': 'leak' }, false, true],
    ['ranger', { 'atlas-press': 'leak' }, false, false],
    ['redstone', {}, false, false],
  ])
    for (const seed of [0, 77, 0xffffffff]) {
      const round = { seed, vehicle, faults };
      const fire = { trace: trace(11, wall, sag) };
      out.fires.push({
        vehicle,
        seed,
        faults,
        fire,
        readings: T.map(t => ({ t, r: copy(channels.fireReadings(round, fire, t)) })),
      });
    }
  write('world-channels.json', out);
}

// ---- telemetry and the frame clock ----
function recordTelemetry(write) {
  const RealDate = Date;
  const realNow = RealDate.now;
  let clock = 0;
  RealDate.now = () => (clock += 1250) + 1700000000000;
  globalThis.Date = class extends RealDate {
    constructor(...a) {
      if (a.length === 0) super(RealDate.now());
      else super(...a);
    }
  };
  try {
    const out = {
      LOG_FORMAT: tel.LOG_FORMAT,
      LOG_VERSION: tel.LOG_VERSION,
      LOG_KEY: tel.LOG_KEY,
      LIMITS: tel.LIMITS,
      ISSUE_URL: tel.ISSUE_URL,
      clockStep: 1250,
      clockBase: 1700000000000,
      parse: [],
      clamp: [],
      where: [],
      clocks: [],
      scripts: [],
      frames: { MAX_STEP, MAX_CATCH_UP, cases: [] },
    };
    // parseLog
    const good = tel.createLog();
    good.events.push({ t: 1, k: 'x' }, null, [1], 5, 'str', { t: 2 });
    good.errors.push(
      { key: 'a', count: 1, last: { t: 5 }, stack: '' },
      { key: 'b', count: 0, last: { t: 5 }, stack: '' },
      { key: 'c', count: 1.5, last: { t: 5 }, stack: '' },
      { key: 'd', count: 2 ** 53, last: { t: 5 }, stack: '' },
      { key: 'e', count: 3, last: {}, stack: '' },
      { key: 'f', count: 3, last: { t: 5 }, stack: 1 },
      { key: 7, count: 3, last: { t: 5 }, stack: '' },
      { key: 'g', count: 9007199254740991, last: { t: -1.5 }, stack: 'at x' },
      { key: 'h', count: 2, last: 5, stack: '' },
      { key: 'i', count: '2', last: { t: 5 }, stack: '' },
      [1],
    );
    const texts = [
      JSON.stringify(tel.createLog()),
      JSON.stringify(good),
      JSON.stringify({ ...tel.createLog(), version: 2 }),
      JSON.stringify({ ...tel.createLog(), format: 'other' }),
      '{"version":1,"format":"ad-astra-playtest-log","events":{"a":1},"calls":"x","session":4,"9":"nine","1":"one"}',
      '{"format":"ad-astra-playtest-log","version":1.0,"sessions":[{"n":1,"at":"2023-11-14T22:13:21.250Z","x":1e2,"y":-0,"z":"\\u00e9\\n\\u0001"}],"marks":[{"a":{"10":1,"2":2,"b":3,"2":4}}]}',
      ' {"format" : "ad-astra-playtest-log" ,\n"version":1 }\t',
      'null',
      '5',
      '[]',
      '"str"',
      'not json',
      '',
      '{',
      "{'format':'ad-astra-playtest-log','version':1}",
      '{"format":"ad-astra-playtest-log","version":1,}',
      '{"format":"ad-astra-playtest-log","version":1} x',
      '{"format":"ad-astra-playtest-log","version":01}',
      '{"format":"ad-astra-playtest-log","version":1,"events":[NaN]}',
      '{"format":"ad-astra-playtest-log","version":1,"a":"\t"}',
      '{"format":"ad-astra-playtest-log","version":1,"a":1.}',
    ];
    for (const text of texts) {
      const log = tel.parseLog(text);
      out.parse.push({ text, ret: tel.serializeLog(log) });
    }
    // clamp
    const long = 'é'.repeat(300);
    for (const [value, room] of [
      [null, undefined],
      [5, undefined],
      [true, undefined],
      [false, undefined],
      ['short', undefined],
      [long, undefined],
      ['x'.repeat(240), undefined],
      ['x'.repeat(241), undefined],
      [{ a: long, b: [long, 1, { c: 'ok' }], d: null }, undefined],
      [{ a: 'x'.repeat(2000) }, undefined],
      [[1, 2, 3], 5],
      [[1, 2, 3], 7],
      [{ s: 'é'.repeat(10) }, 12],
      [{ 9: 1, a: 2, 1: 3 }, undefined],
      [{ n: 1e21, m: 0.1 + 0.2, k: -0 }, undefined],
      [{ q: '"\\\n\u0001' }, undefined],
      [[], undefined],
      [{}, 1],
      [{ a: 1 }, 1],
    ])
      out.clamp.push({
        value,
        room: room ?? null,
        omitRoom: room === undefined,
        ret: copy(room === undefined ? tel.clamp(value) : tel.clamp(value, room)),
      });
    // where and clocks
    const games = [
      null,
      {},
      { day: 5, clock: 612.34, roundIndex: 0, beat: 'brief' },
      { day: 6, clock: 612.35, roundIndex: 62, beat: null },
      { day: 7, clock: -3.25, roundIndex: 63 },
      { day: 8, clock: 'x', roundIndex: '2' },
      { day: null, clock: null, roundIndex: 1.5, paused: true, speed: 4 },
      { day: 9, clock: 100, speed: 2, console: { phase: 'count', t: -10.5, orbitT: 'n', flight: { at: 12.345 } } },
      { day: 9, clock: 100, speed: 2, paused: 0, console: {}, lunar: { phase: 'cruise', h: 3.14159, start: 40 } },
      { day: 9, speed: 2, console: { flight: {} }, lunar: { h: 'x', start: 'y' } },
      { day: 9, clock: 1000, lunar: { phase: null, h: 1, start: 0.5 }, console: 0 },
    ];
    for (const g of games) {
      clock = 0;
      out.where.push({ g, ret: copy(tel.where(g)) });
      out.clocks.push({ g, ret: copy(tel.clocks(g)) });
    }

    // Scripts on a log.
    const run = (name, steps) => {
      clock = 0;
      const log = tel.createLog();
      const s = { name, steps: [] };
      let g = null,
        look;
      const setPath = (obj, path, value) => {
        let o = obj;
        for (const k of path.slice(0, -1)) o = o[k];
        if (value === undefined) delete o[path.at(-1)];
        else o[path.at(-1)] = copy(value);
      };
      for (const st of steps) {
        const rs = { ...st };
        switch (st.op) {
          case 'game':
            g = copy(st.g);
            break;
          case 'noGame':
            g = null;
            break;
          case 'set':
            setPath(g, st.path, st.value);
            break;
          case 'del':
            setPath(g, st.path, undefined);
            break;
          case 'push': {
            let o = g;
            for (const k of st.path) o = o[k];
            o.push(copy(st.value));
            break;
          }
          case 'startSession':
            rs.ret = st.info === undefined ? tel.startSession(log) : tel.startSession(log, st.info);
            break;
          case 'record':
            rs.ret = copy(st.data === undefined ? tel.record(log, g, st.kind) : tel.record(log, g, st.kind, st.data));
            break;
          case 'recordError':
            rs.ret = copy(
              st.stack === undefined
                ? tel.recordError(log, g, st.kind, st.message)
                : tel.recordError(log, g, st.kind, st.message, st.stack),
            );
            break;
          case 'recordCall':
            tel.recordCall(log, g, st.line);
            break;
          case 'recordMark':
            rs.ret = copy(st.extra === undefined ? tel.recordMark(log, g) : tel.recordMark(log, g, st.extra));
            break;
          case 'observe': {
            look = st.scene === undefined ? tel.observe(log, g, look) : tel.observe(log, g, look, st.scene);
            break;
          }
          case 'forget':
            look = undefined;
            break;
          case 'issueReport': {
            const mark = st.mark === undefined ? log.marks.at(-1) : st.mark;
            rs.ret = st.lines === undefined ? tel.issueReport(log, mark) : tel.issueReport(log, mark, st.lines);
            break;
          }
          case 'many': {
            for (let i = 0; i < st.n; i++) {
              if (st.what === 'events') tel.record(log, g, 'click', { i });
              else if (st.what === 'calls') tel.recordCall(log, g, { who: 'A', text: `line ${i}` });
              else if (st.what === 'errors') tel.recordError(log, g, 'error', `e${i}`, `Error\n    at f${i}`);
              else if (st.what === 'marks') tel.recordMark(log, g, { i });
              else if (st.what === 'sessions') tel.startSession(log, { i });
            }
            rs.ret = { length: log[st.what].length, first: copy(log[st.what][0]), last: copy(log[st.what].at(-1)) };
            break;
          }
        }
        rs.clock = clock;
        if (st.op !== 'many') rs.log = copy(log);
        s.steps.push(rs);
      }
      out.scripts.push(s);
    };
    const G = {
      seed: 42,
      day: 3,
      clock: 480,
      roundIndex: 0,
      beat: 'brief',
      speed: 1,
      savedVersion: 1,
      objective: 'Read the brief.',
      decided: { burn: 'short' },
      flagged: {},
      looked: { fins: true },
      programme: { adopted: [] },
      record: { rounds: [], offers: [] },
      notes: [{ text: 'First note.' }],
      loop: [],
      round: { faults: { fitting: 'leak' } },
      crewed: false,
      vehicle: 'wac',
    };
    run('session and records', [
      { op: 'record', kind: 'start', data: { a: 1 } },
      { op: 'startSession' },
      {
        op: 'startSession',
        info: { build: { version: '0.9', commit: 'abc', os: 'win' }, screen: [1920, 1080], n: 99, at: 'x' },
      },
      { op: 'game', g: G },
      { op: 'record', kind: 'click', data: { target: 'GO', t: 5, nested: { s: 'é'.repeat(250) }, nothing: null } },
      { op: 'record', kind: 'key' },
      {
        op: 'recordError',
        kind: 'error',
        message: 'Boom',
        stack: 'Error: Boom\n    at f (game.js:1)\n    at g (game.js:2)',
      },
      {
        op: 'recordError',
        kind: 'error',
        message: 'Boom',
        stack: 'Error: Boom\n    at f (game.js:1)\n    at h (game.js:3)',
      },
      { op: 'recordError', kind: 'error', message: 'Boom', stack: 'Error: Boom\n    at f (game.js:1)' },
      { op: 'recordError', kind: 'rejection', message: 'x'.repeat(700) },
      { op: 'recordError', kind: 'error', message: null, stack: null },
      { op: 'recordError', kind: 'error', message: 'Firefox', stack: 'f@game.js:1\ng@game.js:2' },
      { op: 'recordError', kind: 'error', message: 'Firefox', stack: '  plain\n f@game.js:1  ' },
      {
        op: 'recordCall',
        line: {
          who: 'Range safety officer with a very long title that goes on and on and on past sixty',
          text: 'Tracking.',
        },
      },
      { op: 'recordCall', line: { text: 'No one.' } },
      { op: 'set', path: ['beat'], value: 'count' },
      {
        op: 'recordMark',
        extra: {
          scene: 'blockhouse',
          objective: 'Run the count.',
          clocks: { day: 3 },
          files: ['mark-001.png'],
          window: { w: 800 },
        },
      },
      { op: 'noGame' },
      { op: 'record', kind: 'menu', data: { x: 1 } },
      { op: 'recordMark' },
      { op: 'game', g: G },
      { op: 'issueReport' },
      { op: 'issueReport', lines: 2 },
      { op: 'issueReport', mark: { t: 1700000040000, s: 2, n: 7, d: 3, c: 1500.5, scene: 'pad' } },
      { op: 'issueReport', mark: { t: 1700000040000, s: 9, n: 12 } },
      { op: 'startSession', info: 'text' },
      { op: 'issueReport', mark: { t: 1, s: 3, n: 1, r: 'wac-2', b: '', d: 0, scene: null, files: ['a.txt'] } },
    ]);
    run('observe', [
      { op: 'observe', scene: 'x' },
      { op: 'game', g: G },
      { op: 'startSession' },
      { op: 'observe', scene: 'brief' },
      { op: 'observe', scene: 'brief' },
      { op: 'set', path: ['beat'], value: 'stand' },
      { op: 'set', path: ['objective'], value: 'Fire it.' },
      { op: 'observe', scene: 'stand' },
      { op: 'set', path: ['paused'], value: true },
      { op: 'set', path: ['savedVersion'], value: 2 },
      { op: 'set', path: ['saved'], value: { beat: 'stand' } },
      { op: 'set', path: ['decided', 'burn'], value: 'long' },
      { op: 'set', path: ['decided', 'leak'], value: { checked: true } },
      { op: 'set', path: ['flagged', 'fins'], value: 1 },
      { op: 'del', path: ['looked', 'fins'] },
      { op: 'set', path: ['looked', 'weld'], value: false },
      { op: 'observe' },
      // In place: the shallow copy shares the object, so no change is seen.
      { op: 'set', path: ['decided', 'leak', 'checked'], value: false },
      { op: 'observe', scene: '' },
      { op: 'push', path: ['programme', 'adopted'], value: 'leak' },
      { op: 'push', path: ['programme', 'adopted'], value: 'weld' },
      {
        op: 'push',
        path: ['record', 'rounds'],
        value: { id: 'wac-1', flight: 'Lost', day: 3, long: 'é'.repeat(2000) },
      },
      { op: 'push', path: ['record', 'offers'], value: { seat: 'retro', made: true } },
      { op: 'push', path: ['notes'], value: { text: 'Second.' } },
      { op: 'push', path: ['notes'], value: { other: 1 } },
      { op: 'push', path: ['loop'], value: { who: 'CAPCOM', text: 'Go.' } },
      { op: 'observe', scene: 'review' },
      { op: 'set', path: ['notes'], value: [{ text: 'Replaced.' }, { text: 'All new.' }] },
      { op: 'push', path: ['loop'], value: { who: 'FD', text: 'Hold.' } },
      { op: 'push', path: ['loop'], value: { who: 'FD', text: 'Resume.' } },
      { op: 'set', path: ['roundIndex'], value: 1 },
      { op: 'set', path: ['paused'], value: false },
      { op: 'set', path: ['speed'], value: 4 },
      { op: 'observe', scene: 'review' },
      { op: 'del', path: ['speed'] },
      { op: 'del', path: ['notes'] },
      { op: 'set', path: ['loop'], value: [] },
      { op: 'set', path: ['beat'], value: null },
      { op: 'observe', scene: 'review' },
      { op: 'set', path: ['notes'], value: [] },
      { op: 'set', path: ['savedVersion'], value: '2' },
      { op: 'observe', scene: 'review' },
      { op: 'game', g: { ...G, seed: 7, roundIndex: 5 } },
      { op: 'observe', scene: 'menu' },
      { op: 'set', path: ['console'], value: { phase: 'count', t: 12.6 } },
      { op: 'set', path: ['clock'], value: 481.06 },
      { op: 'observe', scene: 'count' },
      { op: 'del', path: ['round'] },
      { op: 'set', path: ['roundIndex'], value: 6 },
      { op: 'set', path: ['crewed'], value: 'yes' },
      { op: 'observe', scene: 'count' },
      { op: 'forget' },
      { op: 'observe', scene: 'count' },
      { op: 'set', path: ['decided'], value: null },
      { op: 'set', path: ['flagged'], value: { 10: 1, 2: 2, a: 3 } },
      { op: 'observe', scene: 'count' },
      { op: 'set', path: ['decided'], value: { x: 1 } },
      { op: 'set', path: ['flagged', '3'], value: 4 },
      { op: 'observe', scene: 'count' },
      { op: 'set', path: ['notes'], value: ['plain', 'plain'] },
      { op: 'observe', scene: 'count' },
      { op: 'set', path: ['notes', 1], value: 'plain' },
      { op: 'observe', scene: 'count' },
      { op: 'push', path: ['notes'], value: 'other' },
      { op: 'observe', scene: 'count' },
      { op: 'recordMark', extra: { scene: 'count', clocks: { a: 1 } } },
      { op: 'issueReport' },
      { op: 'noGame' },
      { op: 'observe', scene: 'count' },
    ]);
    // A long report: steps are dropped four at a time until the link fits, then the body is cut.
    const dash = '—'.repeat(200);
    const longSteps = [
      { op: 'startSession', info: { build: { version: '1', commit: 'c', os: 'o' } } },
      { op: 'game', g: G },
    ];
    for (let i = 0; i < 26; i++) longSteps.push({ op: 'record', kind: 'note', data: { text: `${i} ${dash}` } });
    for (let i = 0; i < 3; i++) longSteps.push({ op: 'recordCall', line: { who: 'X', text: `${i}${dash}` } });
    longSteps.push({ op: 'recordError', kind: 'error', message: dash, stack: `E\n ${dash}` });
    longSteps.push({ op: 'recordMark', extra: { scene: 'short', objective: dash } });
    longSteps.push({ op: 'issueReport' });
    longSteps.push({ op: 'issueReport', lines: 3 });
    longSteps.push({ op: 'recordMark', extra: { scene: '—'.repeat(800) } });
    longSteps.push({ op: 'issueReport' });
    run('long report', longSteps);
    run('limits', [
      { op: 'game', g: G },
      { op: 'many', what: 'events', n: 2505 },
      { op: 'many', what: 'calls', n: 405 },
      { op: 'many', what: 'errors', n: 105 },
      { op: 'many', what: 'marks', n: 45 },
      { op: 'many', what: 'sessions', n: 35 },
    ]);

    for (const s of [
      -1,
      0,
      1e-10,
      1e-9,
      2e-9,
      0.01,
      0.05,
      0.051,
      0.1,
      0.15,
      0.3,
      0.33,
      0.49999,
      0.5,
      0.7,
      10,
      NaN,
      Infinity,
      -Infinity,
    ])
      out.frames.cases.push({ s: num(s), ret: frameSteps(s) });
    write('world-telemetry.json', out);
  } finally {
    RealDate.now = realNow;
    globalThis.Date = RealDate;
  }
}

export function record(write) {
  recordBudget(write);
  recordCrew(write);
  recordFlow(write);
  recordLedger(write);
  recordMemory(write);
  recordCareer(write);
  recordLunar(write);
  recordChannels(write);
  recordTelemetry(write);
}
