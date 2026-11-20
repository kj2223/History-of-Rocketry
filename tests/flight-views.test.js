// The v0.8 flight views: JPL's tracking room (js/stage/deep.js) and the recovery (js/stage/recovery.js). The drawing
// needs a browser; here the data it draws from is checked: the planets and the routes, and which view a room gets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, ROUTES, planetAt, craftAt, routeReach } from '../js/data/deep-space.js';
import { SEASON } from '../js/data/campaign.js';
import { dayOf } from '../js/core/calendar.js';

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const angleGap = (a, b) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

test('the planets are where they really were (Earth opposite the Sun at the March equinox)', () => {
  // On 20 March the Sun is at 0 degrees seen from Earth, so Earth is at 180 degrees from the Sun.
  const [a] = planetAt('earth', dayOf(1969, 3, 20));
  assert.ok(angleGap(a, Math.PI) < 0.05, `Earth at ${(a * 180) / Math.PI}`);
  // Saturn's 1981 encounter: Saturn in Virgo, about 186 degrees.
  const [s] = planetAt('saturn', dayOf(1981, 8, 26));
  assert.ok(angleGap(s, (186 * Math.PI) / 180) < 0.1);
});

test('every robotic mission but the Moon landers has a route, starting from Earth on its launch', () => {
  for (const r of SEASON.filter(s => s.probe)) {
    if (r.id === 'surveyor-1') {
      assert.equal(ROUTES[r.id], undefined);
      continue;
    }
    assert.ok(ROUTES[r.id], `${r.id} has no route`);
    for (const craft of ROUTES[r.id]) {
      assert.equal(craft.legs[0].planet, 'earth');
      for (let i = 1; i < craft.legs.length; i++) assert.ok(craft.legs[i].day > craft.legs[i - 1].day);
    }
  }
});

test('a craft leaves Earth and arrives at each planet on the day', () => {
  for (const crafts of Object.values(ROUTES))
    for (const craft of crafts)
      for (const leg of craft.legs) {
        const [a, r] = craftAt(craft, leg.day),
          [pa, pr] = planetAt(leg.planet, leg.day);
        assert.ok(near(r, pr, 0.02 * pr + 0.01) && angleGap(a, pa) < 0.02, `${craft.name} at ${leg.planet}`);
      }
});

test('the board reaches out to the furthest planet on the route', () => {
  assert.equal(routeReach('voyager'), PLANETS.neptune.au);
  assert.equal(routeReach('mariner-2'), 1.6);
});

test('the range plot and its camera are told what went wrong, and a pad blast is left to the pad', async () => {
  const { flightTrouble } = await import('../js/game.js');
  const g = failure => ({ vehicle: 'wac', flight: { result: { failure, failAt: 14 } } });
  assert.equal(flightTrouble({ vehicle: 'wac', flight: { result: {} } }), null);
  assert.equal(flightTrouble(g('weld')).kind, 'break');
  assert.equal(flightTrouble(g('weld')).at, 14);
  assert.equal(flightTrouble(g('fin')).kind, 'tumble');
  assert.equal(flightTrouble(g('leak')).kind, 'cut');
  assert.equal(
    flightTrouble({ vehicle: 'bumper', flight: { result: { failure: 'ignition', failAt: 30 } } }).upper,
    true,
  );
  assert.equal(flightTrouble({ vehicle: 'vanguard', flight: { result: { failure: 'injector', failAt: 0 } } }), null);
});

test('the sound follows the game: the roar while she burns, a boom when she breaks, ticks for the last ten seconds', async () => {
  const { soundPlan } = await import('../js/stage/fx/sound.js');
  const path = Array.from({ length: 200 }, (_, t) => ({ t, x: t / 10, h: t / 4 }));
  const flight = (t, view, result = {}) => ({
    vehicle: 'v2',
    day: 0,
    loop: [],
    rocket: { rise: 50 },
    flight: { t, view, result: { path, burn: 60, ...result } },
  });
  // On the pad she is loud and close; on the plot a far rumble; after burnout, nothing.
  const close = soundPlan(flight(1, 'site'), 'site');
  const far = soundPlan(flight(20, 'board'), 'tracking');
  assert.ok(close.engine > 0.5 && close.muffle === 0);
  assert.ok(far.engine > 0 && far.engine < close.engine && far.muffle > 0.5);
  assert.equal(soundPlan(flight(70, 'board'), 'tracking').engine, 0);
  // A break-up: the roar stops and one boom is due.
  const broke = soundPlan({ ...flight(20, 'board', { failure: 'weld', failAt: 14 }), vehicle: 'wac' }, 'tracking');
  assert.equal(broke.engine, 0);
  assert.equal(broke.booms.length, 1);
  // The count ticks only in the last ten seconds, and not while it is held.
  const count = (clock, held = false) => soundPlan({ day: 0, loop: [], count: { clock, held } }, 'interior:blockhouse');
  assert.equal(count(30).tick, null);
  assert.equal(count(7.4).tick, 8);
  assert.equal(count(7.4, true).tick, null);
  // The rooms hum; outdoors it is the wind.
  assert.ok(soundPlan(null, 'control-room').hum > 0);
  assert.ok(soundPlan({ day: 0 }, 'site, panel board').wind > 0);
});

test('each vehicle has its own voice, which changes as she stages, and the cryogenic ones vent on the pad', async () => {
  const { soundPlan, voiceOf, VOICES } = await import('../js/stage/fx/sound.js');
  const vehicles = [
    'wac',
    'v2',
    'aerobee',
    'viking',
    'vanguard',
    'juno',
    'atlas',
    'titan',
    'saturnib',
    'saturn5',
    'shuttle',
    'sls',
    'dragon',
  ];
  for (const v of vehicles) assert.ok(VOICES[voiceOf(v).name], v);
  // The families sound apart off the pad: acid, alcohol, kerosene, storables, the F-1s and the solids.
  const first = new Set(['wac', 'v2', 'vanguard', 'titan', 'saturn5', 'shuttle'].map(v => voiceOf(v, 5).name));
  assert.equal(first.size, 6);
  // The Saturn V is the deepest and crackles hardest; the Titan II barely crackles.
  assert.ok(voiceOf('saturn5', 5).roar < voiceOf('atlas', 5).roar && voiceOf('saturn5', 5).crackle > 0.9);
  assert.ok(voiceOf('titan', 5).crackle < 0.1);
  // Staging changes the voice: the Atlas's boosters drop at 130 s, the Shuttle's solids at 124 s.
  assert.equal(voiceOf('atlas', 120).name, 'kerosene');
  assert.equal(voiceOf('atlas', 140).name, 'sustainer');
  assert.equal(voiceOf('shuttle', 130).name, 'hydrogen');
  assert.equal(voiceOf('wac', 0.2).name, 'kick');
  assert.equal(voiceOf('wac', 5).name, 'acid');
  // Through the count: liquid oxygen vents from a V-2 but not from the WAC or the Titan II; the Juno's tub spins up last.
  const pad = (vehicle, clock) => soundPlan({ vehicle, day: 0, loop: [], count: { clock, held: false } }, 'site');
  assert.ok(pad('v2', 300).vent > 0);
  assert.equal(pad('wac', 300).vent, 0);
  assert.equal(pad('titan', 300).vent, 0);
  assert.equal(pad('juno', 300).spin, 0);
  assert.ok(pad('juno', 40).spin > 0);
});

test('the management map, Desk mode and the title have their own sound', async () => {
  const { managePlan, deskPlan, soundPlan } = await import('../js/stage/fx/sound.js');
  // The Cape: sea and wind, a pile driver by day while something is going up, none at night or while paused.
  const day = managePlan({ part: 0.5, works: 1 });
  assert.ok(day.surf > 0 && day.wind > 0 && day.thuds > 0 && day.engine === 0);
  assert.equal(managePlan({ part: 0.5, works: 0 }).thuds, 0);
  assert.equal(managePlan({ part: 0.95, works: 1, night: 1 }).thuds, 0);
  assert.equal(managePlan({ part: 0.5, works: 1, speed: 0 }).thuds, 0);
  assert.ok(managePlan({ night: 1 }).wind < day.wind);
  // A launch from a pad, in her own voice, from across the Cape.
  const launch = managePlan({ stands: [{ vehicle: 'atlas', rise: 30 }] });
  assert.ok(launch.engine > 0 && launch.muffle > 0.4);
  assert.equal(launch.voice.name, 'kerosene');
  assert.equal(managePlan({ stands: [{ vehicle: 'thor-able', rise: 30 }] }).voice.name, 'kerosene');
  // The desk: the MOCR hums, the teletype is followed, the last ten seconds tick, the liftoff rumbles once.
  const desk = deskPlan({ t: -600, done: false, tty: [1, 2], log: [] });
  assert.ok(desk.hum > 0 && desk.netted && desk.clatter === 2 && desk.tick === null && desk.rumble === null);
  assert.equal(deskPlan({ t: -3.5, done: false, tty: [], log: [] }).tick, 4);
  const flown = { t: 0, done: true, tty: [], log: [] };
  assert.equal(deskPlan(flown).rumble, flown);
  // The title: the wind over the site, nothing else.
  const title = soundPlan(null, 'site');
  assert.ok(title.wind > 0 && title.engine === 0 && title.hum === 0);
});

test('each period runs its flights from its own room: Mercury Control, the MOCR, the new flight control room', async () => {
  const { roomOf, stationsFor } = await import('../js/stage/control.js');
  assert.equal(roomOf({ day: dayOf(1962, 2, 20) }), 'cape');
  assert.equal(roomOf({ day: dayOf(1965, 6, 3) }), 'mocr');
  assert.equal(roomOf({ day: dayOf(1981, 4, 12) }), 'mocr');
  assert.equal(roomOf({ day: dayOf(1998, 12, 3) }), 'fcr');
  assert.equal(roomOf({ day: dayOf(2028, 1, 1) }), 'fcr');
  // The status board's stations: Gemini's network, then Apollo's big dishes, then the relay satellites.
  assert.ok(stationsFor(1965).includes('CSQ'));
  assert.ok(stationsFor(1969).includes('HSK'));
  assert.ok(stationsFor(1990).includes('TDRS'));
});
