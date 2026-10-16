// Headless bot: plays the real rules in virtual time and prints pacing. Run: node tools/balance.mjs [runs] [maxMinutes]
import { S, resetState, dateOf } from '../js/state.js';
import { PK, BY, DIR, MODES } from '../js/data.js';
import { ensureStarter, can, commission, unit, tiers } from '../js/design.js';
import { tickSecond, orderAirframes, startInvestigation, chooseFix, hire, teamCost, publishBlueprint } from '../js/game.js';
import { draftDiff, quoteLaunch } from '../js/design.js';
import { beginFlight, previewFlight, step, sample, endFlight } from '../js/flight.js';
import { FACS, STN } from '../js/data.js';
import { poll, scrub, baseLock, buildFacility, stnLock, hireStation, troubleshoot, fixCost } from '../js/base.js';
const BUY = [['crew','prop'],['crew','rso'],['fac','wx'],['fac','tty'],['crew','tlm'],['fac','radar'],['fac','plot'],['crew','bstr'],['fac','comp'],['crew','fido']];
import { done, free } from '../js/state.js';
const RUNS = +process.argv[2] || 6, MAXM = +process.argv[3] || 240, GOAL = 5;
const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const ORDER = ['bea','inj','ogive','gauge','fm','mix','ablnose','fins','weld','noz','ring','xdc','seal','vol','str','cool','alloy','acc','imp','prs','mux','insul','flush','flut','ms_eng','ms_xasc','ms_xirbm','ms_xslv','ms_aero','ms_stg','ms_in'];
function run(seed) {
  Math.random = rng(seed); resetState(); ensureStarter();
  let t = 0, flights = 0, fails = 0, scrubs = 0; const dirT = [], ev = [];
  const adv = n => { for (let i = 0; i < n; i++) { tickSecond(); t++; while (dirT.length < S.dir) dirT.push(t); } };
  while (t < MAXM * 60 && S.dir < GOAL) {
    const res = unit() + 6000;
    { const d = draftDiff(); if (d.pk.length + d.fx.length) publishBlueprint(); }
    if (S.teams < 4 && S.b > teamCost() + res + 15000) hire('team');
    for (const [k, id] of BUY) { if (k == 'fac' && !baseLock(id) && S.b - FACS[id][1] > res + 20000) buildFacility(id); if (k == 'crew' && !stnLock(id) && S.b - STN[id].c > res + 20000) hireStation(id); }
    if (!S.air.some(a => a.st == 'r') && !S.aq.length && S.b >= unit() + 4000) orderAirframes(1);
    for (const i of S.inc) {
      if (!free()) break;
      if (i.st == 'open' && S.b - 1500 >= res) startInvestigation(i.id);
      else if (i.st == 'diag') for (const f of MODES[i.dx].fx.slice().sort((a, b) => a[2] - b[2])) if (S.b - f[3] >= res && free()) { chooseFix(i.id, f[0]); break; }
    }
    for (const id of ORDER) if (free() && !can(id) && S.b - BY[id].c >= res) commission(id);
    const rd = S.air.filter(a => a.st == 'r').sort((a, b) => b.pk.length - a.pk.length)[0];
    if (!rd) { adv(1); continue; }
    const stage = done('ms_stg') ? 1 : 0, kero = S.bt.p || done('ms_eng');
    const sat = done('ms_stg') && done('ms_in') && S.dir >= 4;
    const pay = sat ? 'Explorer Satellite' : 'Inert Ballast';
    // a sensible player picks the fuel and load whose estimate is highest while staying inside the airframe's aero and heating limits
    let best = null;
    for (const fu of kero ? ['Kerosene & LOX', 'Alcohol & LOX'] : ['Alcohol & LOX'])
      for (let l = 1; l >= .3; l = Math.round((l - .1) * 10) / 10) { const p = previewFlight(rd, fu, pay, stage, l); if (p.maxQ < .9 && p.maxH < .9) { const m = sat ? p.spd : p.alt; if (!best || m > best.alt) best = { fu, l, alt: m }; break; } }
    const fuel = best ? best.fu : 'Alcohol & LOX', load = best ? best.l : .3;
    if (quoteLaunch(rd, fuel, pay, stage, load).err) { adv(1); continue; }
    const P = poll(rd, fuel, stage); if (P.nogo && S.b > fixCost()) troubleshoot(P); if (P.nogo) { scrub(P); scrubs++; adv(3); continue; }
    let F = beginFlight(rd, fuel, pay, stage, load, { latent: P.fault, wind: P.wind });
    if (!F) { adv(1); continue; }
    let r; do { r = step(F); if (r == 'tick') sample(F); } while (r == 'tick' || r == 'sep');
    if (process.env.TRACE) console.log(`t=${(t/60).toFixed(1)}m dir ${S.dir} ${rd.label} pk ${rd.pk.length} load ${load} ${fuel[0]} -> ${r} peak ${(F.pk/1000).toFixed(0)}km spd ${Math.round(F.ps)} hv ${Math.round(F.hv)} t ${F.t} pay ${pay[0]} st ${stage} maxQ ${Math.round(F.maxQ*100)} heat ${Math.round(F.maxH*100)} fail ${F.fail||''} $${Math.round(S.b)}`);
    endFlight(F, r != 'fail', r); flights++; if (r == 'fail') fails++;
    adv(12 + Math.ceil(F.t / 5));
  }
  return { t, flights, fails, scrubs, crew: Object.keys(S.crew).filter(k => S.crew[k]).length, fac: Object.keys(S.fac).length, dirT, b: S.b, pk: Object.keys(S.pk).length, orbit: S.dir >= GOAL, date: dateOf(S.day), sput: dateOf(S.rv.r_sat), race: S.fs.f_orbit || '-', sovietFirsts: Object.values(S.fs).filter(v => v == 'them' || v == 'second').length };
}
const m = x => x === undefined ? '  -- ' : (x / 60).toFixed(1).padStart(5);
for (let i = 0; i < RUNS; i++) { const r = run(1000 + i * 7919); console.log(`seed ${i}: flights ${r.flights} fails ${r.fails} scrubs ${r.scrubs} crew ${r.crew} base ${r.fac} pkgs ${r.pk} end ${m(r.t)}m budget ${Math.round(r.b)} orbit ${r.orbit} ${r.date} (${r.race}, Sputnik ${r.sput}) lostFirsts ${r.sovietFirsts} | directives(min) ${DIR.map((_, k) => m(r.dirT[k])).join(' ')}`); }
