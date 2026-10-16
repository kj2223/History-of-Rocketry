// Headless bot: plays the real rules in virtual time and prints pacing. Run: node tools/balance.mjs [runs] [maxMinutes]
import { S, resetState, dateOf } from '../js/state.js';
import { PK, BY, DIR, MODES } from '../js/data.js';
import { ensureStarter, can, commission, unit, tiers, itemsOf, t1opts, stagingOK } from '../js/design.js';
import { PROGS, candidates, nextLock, startProgramme, maturity } from '../js/programs.js';
import { startReview } from '../js/game.js';
import { SYSK } from '../js/knowledge.js';
import { tickSecond, orderAirframes, startInvestigation, chooseFix, hire, teamCost, publishBlueprint } from '../js/game.js';
import { draftDiff, quoteLaunch } from '../js/design.js';
import { beginFlight, previewFlight, step, sample, endFlight } from '../js/flight.js';
import { FACS, STN } from '../js/data.js';
import { poll, scrub, baseLock, buildFacility, stnLock, hireStation, troubleshoot, fixCost } from '../js/base.js';
const BUY = [['crew','prop'],['crew','rso'],['fac','wx'],['fac','tty'],['crew','tlm'],['fac','radar'],['fac','plot'],['crew','bstr'],['fac','comp'],['crew','fido']];
import { done, free } from '../js/state.js';
const RUNS = +process.argv[2] || 6, MAXM = +process.argv[3] || 240, GOAL = 5;
const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
// research everything the programme offers, cheapest first, plus the first approach of each milestone choice
const researchList = () => [...['p','s','i','a'].flatMap(itemsOf), ...['ms_rel','ms_eng','ms_in','ms_rg','ms_aero','ms_blunt'].map(id=>BY[id]), ...PK.filter(x=>x.a=='r'&&!x.dud).slice(0,4)].sort((a,b)=>a.c-b.c).map(x=>x.id);
function run(seed) {
  Math.random = rng(seed); resetState(); ensureStarter(); const army = seed % 2 == 0; const progT = {};
  let t = 0, flights = 0, fails = 0, scrubs = 0, lastSig = '', lastFly = -999; const dirT = [], ev = [];
  const adv = n => { for (let i = 0; i < n; i++) { tickSecond(); t++; while (dirT.length < S.dir) dirT.push(t); } };
  while (t < MAXM * 60 && S.dir < GOAL) {
    const res = unit() + 6000;
    { const d = draftDiff(); if (d.pk.length + d.fx.length) publishBlueprint(); }
    if (S.teams < 4 && S.b > teamCost() + res + 15000) hire('team');
    for (const [k, id] of BUY) { if (k == 'fac' && !baseLock(id) && S.b - FACS[id][1] > res + 20000) buildFacility(id); if (k == 'crew' && !stnLock(id) && S.b - STN[id].c > res + 20000) hireStation(id); }
    { const lp = Object.keys(S.progs).filter(k => S.progs[k].ready).sort((a, b) => PROGS[b].gen - PROGS[a].gen)[0]; S.cur = lp; if (!S.air.some(a => a.st == 'r' && a.prog == lp) && !S.aq.some(q => q.prog == lp) && S.b >= unit() + 4000) orderAirframes(1); }
    for (const i of S.inc) {
      if (!free()) break;
      if (i.st == 'open' && S.b - 1500 >= res) startInvestigation(i.id);
      else if (i.st == 'diag') for (const f of MODES[i.dx].fx.slice().sort((a, b) => a[2] - b[2])) if (S.b - f[3] >= res && free()) { chooseFix(i.id, f[0]); break; }
    }
    // programmes: start the next rung once the current rocket is mature (army path: Redstone then Jupiter-C; navy path: Vanguard)
    for (const c of candidates()) { if ((c == 'redstone' || c == 'jupc') && !army) continue; if (c == 'vanguard' && army) continue; if (!nextLock(c) && S.b - PROGS[c].cost > res) { startProgramme(c); progT[c] = t; } }
    const latest = Object.keys(S.progs).filter(k => S.progs[k].ready).sort((a, b) => PROGS[b].gen - PROGS[a].gen)[0]; S.cur = latest;
    const saving = candidates().find(c => !(PROGS[c].nasa && !S.nasa) && !(((c == 'redstone' || c == 'jupc') && !army) || (c == 'vanguard' && army)) && maturity(PROGS[c].req.find(r => S.progs[r]) || 'wac') >= 50);
    const reserve = res + (saving ? PROGS[saving].cost : 0);
    for (const id of researchList()) if (free() && !can(id) && S.b - BY[id].c * PROGS[S.cur].cm >= reserve) commission(id);
    if (free() && S.b > res + 20000) { const a = ['p','s','a'].sort((x, y) => (S.kn[x] || 0) - (S.kn[y] || 0))[0]; if ((S.kn[a] || 0) > 25) startReview(a); }
    const rd = S.air.filter(a => a.st == 'r').sort((a, b) => PROGS[b.prog].gen - PROGS[a.prog].gen || b.pk.length - a.pk.length)[0];
    if (!rd) { adv(1); continue; }
    const stage = stagingOK(rd) ? 1 : 0, fuels = PROGS[rd.prog].fuels;
    const sat = PROGS[rd.prog].sat && S.dir >= 4;
    const pay = sat ? 'Explorer Satellite' : 'Inert Ballast';
    // a sensible player picks the fuel and load whose estimate is highest while staying inside the airframe's aero and heating limits
    let best = null;
    for (const fu of fuels)
      for (let l = 1; l >= .3; l = Math.round((l - .1) * 10) / 10) { const p = previewFlight(rd, fu, pay, stage, l); if (p.maxQ < .9 && p.maxH < .9 && !/heavy/.test(quoteLaunch(rd, fu, pay, stage, l).err || '')) { const m = sat ? p.spd : p.alt; if (!best || m > best.alt) best = { fu, l, alt: m }; break; } }
    const fuel = best ? best.fu : 'Alcohol & LOX', load = best ? best.l : .3;
    // a satellite attempt is worth flying when the estimate says orbit, or when the rocket has changed since the last try (new data to gather)
    if (sat) { const pv = previewFlight(rd, fuel, pay, stage, load), sig = rd.pk.length + ':' + Object.keys(rd.fix).length + ':' + rd.id; if (lastSig == sig && !(pv.spd >= 7000) && t - lastFly < 150) { adv(5); continue; } lastSig = sig; lastFly = t; }
    if (quoteLaunch(rd, fuel, pay, stage, load).err) { adv(1); continue; }
    const P = poll(rd, fuel, stage); if (P.nogo && S.b > fixCost()) troubleshoot(P); if (P.nogo) { scrub(P); scrubs++; adv(3); continue; }
    let F = beginFlight(rd, fuel, pay, stage, load, { latent: P.fault, wind: P.wind });
    if (!F) { adv(1); continue; }
    let r; do { r = step(F); if (r == 'tick') sample(F); } while (r == 'tick' || r == 'sep');
    if (process.env.TRACE) console.log(`t=${(t/60).toFixed(1)}m dir ${S.dir} ${rd.label} pk ${rd.pk.length} load ${load} ${fuel[0]} -> ${r} peak ${(F.pk/1000).toFixed(0)}km spd ${Math.round(F.ps)} hv ${Math.round(F.hv)} t ${F.t} pay ${pay[0]} st ${stage} maxQ ${Math.round(F.maxQ*100)} heat ${Math.round(F.maxH*100)} fail ${F.fail||''} $${Math.round(S.b)}`);
    endFlight(F, r != 'fail', r); flights++; if (r == 'fail') fails++;
    // real time on screen: a 30 s count, powered flight at 8 steps a second, coasting at 100, and a few seconds to read the result
    { const pw = Math.min(F.t, F.burn * (F.st.length > 1 ? 3 : 1)); adv(30 + 8 + Math.ceil(pw / 8 + (F.t - pw) / 100)); }
  }
  return { progT, mat: Object.fromEntries(Object.keys(S.progs).map(k => [k, Math.round(maturity(k))])), t, flights, fails, scrubs, crew: Object.keys(S.crew).filter(k => S.crew[k]).length, fac: Object.keys(S.fac).length, dirT, b: S.b, pk: Object.keys(S.pk).length, orbit: S.dir >= GOAL, date: dateOf(S.day), sput: dateOf(S.rv.r_sat), race: S.fs.f_orbit || '-', sovietFirsts: Object.values(S.fs).filter(v => v == 'them' || v == 'second').length };
}
const m = x => x === undefined ? '  -- ' : (x / 60).toFixed(1).padStart(5);
for (let i = 0; i < RUNS; i++) { const r = run(1000 + i * 7919); console.log(`programmes ${Object.entries(r.progT).map(([k,v])=>k+'@'+m(v).trim()).join(' ')} | maturity ${JSON.stringify(r.mat)}`);console.log(`seed ${i}: flights ${r.flights} fails ${r.fails} scrubs ${r.scrubs} crew ${r.crew} base ${r.fac} pkgs ${r.pk} end ${m(r.t)}m budget ${Math.round(r.b)} orbit ${r.orbit} ${r.date} (${r.race}, Sputnik ${r.sput}) lostFirsts ${r.sovietFirsts} | directives(min) ${DIR.map((_, k) => m(r.dirT[k])).join(' ')}`); }
