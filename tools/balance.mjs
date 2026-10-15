// Headless bot: plays the real rules in virtual time and prints pacing. Run: node tools/balance.mjs [runs] [maxMinutes]
import { S, resetState } from '../js/state.js';
import { PK, MS, DIR, MODES } from '../js/data.js';
import { ensureStarter, can, commission, unit, tiers } from '../js/design.js';
import { tickSecond, orderAirframes, startInvestigation, chooseFix, hire, teamCost } from '../js/game.js';
import { beginFlight, step, sample, endFlight } from '../js/flight.js';
import { done, free } from '../js/state.js';
const RUNS = +process.argv[2] || 6, MAXM = +process.argv[3] || 240, GOAL = 5;
const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const ORDER = ['bea','inj','gauge','fm','mix','weld','noz','ring','xdc','seal','vol','str','cool','alloy','acc','imp','prs','mux','ms_eng','ms_stg','ms_in'];
function run(seed) {
  Math.random = rng(seed); resetState(); ensureStarter();
  let t = 0, flights = 0, fails = 0; const dirT = [], ev = [];
  const adv = n => { for (let i = 0; i < n; i++) { tickSecond(); t++; while (dirT.length < S.dir) dirT.push(t); } };
  while (t < MAXM * 60 && S.dir < GOAL) {
    const res = unit() + 6000;
    if (S.teams < 4 && S.b > teamCost() + res + 15000) hire('team');
    if (!S.air.some(a => a.st == 'r') && !S.aq.length && S.b >= unit() + 4000) orderAirframes(1);
    for (const i of S.inc) {
      if (!free()) break;
      if (i.st == 'open' && S.b - 1500 >= res) startInvestigation(i.id);
      else if (i.st == 'diag') for (const f of MODES[i.dx].fx.slice().sort((a, b) => a[2] - b[2])) if (S.b - f[3] >= res && free()) { chooseFix(i.id, f[0]); break; }
    }
    for (const id of ORDER) if (free() && !can(id) && S.b - (PK.find(p => p.id == id) || Object.values(MS).find(m => m.id == id)).c >= res) commission(id);
    const rd = S.air.filter(a => a.st == 'r').sort((a, b) => b.pk.length - a.pk.length)[0];
    if (!rd) { adv(1); continue; }
    const stage = done('ms_stg') ? 1 : 0, kero = S.bt.p || done('ms_eng');
    const sat = done('ms_stg') && done('ms_in') && S.dir >= 4;
    let F = beginFlight(rd, kero ? 'Kerosene & LOX' : 'Alcohol & LOX', sat ? 'Explorer Satellite' : 'Inert Ballast', stage);
    if (!F) { adv(1); continue; }
    let r; do { r = step(F); if (r == 'tick') sample(F); } while (r == 'tick' || r == 'sep');
    endFlight(F, r != 'fail', r); flights++; if (r == 'fail') fails++;
    adv(12 + Math.ceil(F.t / 5));
  }
  return { t, flights, fails, dirT, b: S.b, pk: Object.keys(S.pk).length, orbit: S.dir >= GOAL };
}
const m = x => x === undefined ? '  -- ' : (x / 60).toFixed(1).padStart(5);
for (let i = 0; i < RUNS; i++) { const r = run(1000 + i * 7919); console.log(`seed ${i}: flights ${r.flights} fails ${r.fails} pkgs ${r.pk} end ${m(r.t)}m budget ${Math.round(r.b)} orbit ${r.orbit} | directives(min) ${DIR.map((_, k) => m(r.dirT[k])).join(' ')}`); }
