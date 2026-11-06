// A campaign played from 1 January 1945 to NASA formation, for the milestone tests. It plays like an
// administrator who says yes: every proposal until 1949 gets the go-ahead and every decision its first option,
// else its last if a veto refuses the first. From 1949 nobody answers, so it runs on with its questions open.
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { newGame, dispatch, advance } from '../js/rules/index.js';
import { dayOf, NASA_DAY } from '../js/core/calendar.js';

const cache = new Map();

// Returns the state on the day before NASA formation and the state on the day itself.
export const played = (seed = 7) => {
  if (cache.has(seed)) return cache.get(seed);
  let state = newGame(seed), n = 0;
  const act = (type, payload) => { const r = dispatch(state, { id: `fx${++n}`, type, actor: 'administrator', payload }); if (!r.rejection) state = r.state; return !r.rejection; };
  while (state.day < dayOf(1949, 1, 1)) {
    for (const p of state.staff.proposals.filter(x => x.status === 'open')) act('approve-proposal', { proposalId: p.id });
    for (const d of state.decisions.filter(x => x.status === 'open')) if (!act('decide', { decisionId: d.id, choice: d.options[0] })) act('decide', { decisionId: d.id, choice: d.options.at(-1) });
    state = advance(state, 7).state;
  }
  const before = advance(state, NASA_DAY - 1 - state.day).state;
  const out = { before, after: advance(before, 1).state };
  cache.set(seed, out);
  return out;
};

// Real saves written by the earlier 1945–1958 build (content version 4): one at NASA formation, one in 1947.
export const legacyV1 = name => gunzipSync(readFileSync(new URL(`./fixtures/${name}.json.gz`, import.meta.url))).toString();
