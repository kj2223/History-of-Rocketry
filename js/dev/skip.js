// THE DEV MENU'S JUMP: a new game on a chosen seed, with the bot playing every round before the chosen one, so a
// playtest can start at any stage with a believable record behind it (the fixes, the losses, the people, the offers).
// For testing only. The bot takes every offer on the NASA route and turns every one down on the JPL route.
import { g, newGame, nextRound, closeAway } from '../game.js';
import { routeArgue, routeDone, apollo8Decide, apollo8Done } from '../mercury.js';
import { SEASON } from '../data/campaign.js';
import { playRound, playMission, advance, nextDay } from './bot.js';

// Which route a round is on: the shared years before Pioneer 4 are on both.
export const routeOf = round => round.path ?? 'both';

// The rounds the menu offers, in the order they are flown on each route.
export function stagesFor(route) {
  return SEASON.map((round, index) => ({ ...round, index }))
    .filter(r => routeOf(r) === 'both' || routeOf(r) === route)
    .sort((a, b) => a.start - b.start || a.index - b.index);
}

// Where in the round to stop: its first morning, or launch morning with the preparation already done.
export const STOPS = {
  morning: 'The first morning of the round',
  launch: 'Launch morning, the preparation done',
};

const BOT_PLAN = { inspector: 'you', burn: 'short', leak: false };

// Plays from 1945 to the round with this id. Throws if the bot cannot get there on this seed.
export function skipTo(id, { seed, route = 'nasa', stop = 'morning' } = {}) {
  if (!SEASON.some(r => r.id === id)) throw new Error(`no round called ${id}`);
  const take = route === 'nasa';
  newGame(seed);
  for (let guard = 140; guard && SEASON[g.roundIndex].id !== id; guard--) {
    // The two scenes that are not flights: the 1962 route meeting and the Apollo 8 decision.
    if (g.beat === 'sRoute') {
      routeArgue('lor');
      routeDone();
      nextRound();
      g.room = null;
      continue;
    }
    if (g.beat === 'sApollo8') {
      apollo8Decide('moon');
      apollo8Done();
      nextRound();
      g.room = null;
      continue;
    }
    if (g.beat === 'seasonEnd') throw new Error(`the game ended at ${SEASON[g.roundIndex].id} before reaching ${id}`);
    if (g.crewed) playMission();
    else playRound(() => 'nominal', BOT_PLAN);
    // An offer the round made but the record has not marked as put yet (as the tests' campaign does).
    const o = g.record.offers[g.record.offers.length - 1];
    if (o && !o.made && o.day >= g.record.rounds[g.record.rounds.length - 1].day) {
      o.made = true;
      o.answer = null;
    }
    advance(take);
    g.room = null;
  }
  if (SEASON[g.roundIndex].id !== id)
    throw new Error(`the bot did not reach ${id} (stopped at ${SEASON[g.roundIndex].id}, route ${g.record.path})`);
  closeAway();
  if (stop === 'launch') toLaunchMorning();
  g.room = null;
  g.speed = 1;
  g.paused = false;
  return g;
}

// From a round's first morning to launch morning: the inspection, the board and the static fire done the bot's way.
// A crewed round goes straight to the launch day. A probe round is worked from the office, so it stays on its morning.
function toLaunchMorning() {
  if (g.beat.startsWith('probe') || ['sRoute', 'sApollo8', 'seasonEnd'].includes(g.beat)) return;
  if (g.crewed) {
    nextDay();
    return;
  }
  playRound(() => 'nominal', BOT_PLAN, 'countReady');
  closeAway();
}

// Tries a few seeds in turn, since on a rare seed the bot's own crews may be lost before the chosen round.
export function skipWithRetries(id, opts = {}, tries = 4) {
  let seed = opts.seed ?? randomSeed(),
    last = null;
  for (let n = 0; n < tries; n++, seed = randomSeed()) {
    try {
      skipTo(id, { ...opts, seed });
      return { seed, tries: n + 1 };
    } catch (e) {
      last = e;
      if (opts.seed != null) break; // a chosen seed is not swapped behind the tester's back
    }
  }
  throw last;
}

export const randomSeed = () => 1 + Math.floor(Math.random() * 1e6);
