// A V1 campaign played to NASA formation, as a save text, for the import tests. Uses the V1 façade itself
// (test-only: V2's rules never import V1 code). It plays like an administrator who says yes: every proposal
// until 1949 gets the go-ahead and every decision its first option, else its last if a veto refuses the first.
import { newGame, dispatch, advance, exportGame } from '../../v1/js/rules/index.js';
import { dayOf } from '../../v1/js/core/calendar.js';

const cache = new Map();

export const v1Concluded = (seed = 7) => {
  if (cache.has(seed)) return cache.get(seed);
  let state = newGame(seed), n = 0;
  const act = (type, payload) => { const r = dispatch(state, { id: `fx${++n}`, type, actor: 'administrator', payload }); if (!r.rejection) state = r.state; return !r.rejection; };
  while (!state.concluded && state.day < dayOf(1949, 1, 1)) {
    for (const p of state.staff.proposals.filter(x => x.status === 'open')) act('approve-proposal', { proposalId: p.id });
    for (const d of state.decisions.filter(x => x.status === 'open')) if (!act('decide', { decisionId: d.id, choice: d.options[0] })) act('decide', { decisionId: d.id, choice: d.options.at(-1) });
    state = advance(state, 7).state;
  }
  // From 1949 nobody answers, so the campaign runs quickly to NASA formation with its questions still open.
  state = advance(state, 4000).state;
  const out = { state, text: exportGame(state) };
  cache.set(seed, out);
  return out;
};
