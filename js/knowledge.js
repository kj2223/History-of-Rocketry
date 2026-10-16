// INSTITUTIONAL KNOWLEDGE: how well your engineers understand each system of the vehicle, 0 to 100. No DOM.
// It grows from research, tests, flights, investigations and fixes (failures teach most), and it makes every later judgement better.
import { S, lg } from './state.js';
import { MODES } from './data.js';
import { PROGS, traitsOf, TR, revealTraits, VEH } from './programs.js';
// Each research area is a system of the vehicle; the booster's failure modes belong to the system that would catch them.
export const SYSK={p:{n:'Propulsion',modes:'cpiv'},s:{n:'Structures & staging',modes:'sx'},a:{n:'Aerodynamics & heating',modes:'hf'},i:{n:'Instrumentation & guidance',modes:''},r:{n:'Recovery',modes:''},c:{n:'Mercury spacecraft',modes:''},e:{n:'Escape & man-rating',modes:''}};
export const sysOf=m=>Object.keys(SYSK).find(k=>SYSK[k].modes.includes(m))||'p';
export const kn=a=>(S.kn&&S.kn[a])||0,kf=a=>kn(a)/100;
export const LEVELS=[[15,'Unfamiliar'],[35,'Familiar'],[60,'Understood'],[85,'Well understood'],[101,'Mastered']];
export const level=v=>LEVELS.find(l=>v<l[0])[1];
// Gains shrink as a system becomes well known: the last few points come slowly.
// A small, simple rocket is learned faster than a big new one (the programme's learning rate).
export function learn(a,pts){if(!SYSK[a]||pts<=0)return;const veh=VEH.includes(a),pr=veh&&PROGS[S.cur];pts*=pr?pr.lr:1;const v=kn(a),before=level(v);S.kn[a]=Math.min(100,v+pts*(1-v/130));const after=level(S.kn[a]);
if(after!=before)lg(`[ENGINEERING] ${pr?pr.n+' ':''}${SYSK[a].n.toLowerCase()}: the team now rates its knowledge as ${after.toLowerCase()}.`,'cyan');if(veh)revealTraits(S.cur)}
// What a flight teaches depends on how much it sends home: instruments aboard and tracking on the ground.
export const teach=tr=>.6+.3*(tr?tr.v:0)+.2*(tr?tr.g:0)+(S.fac.trknet?.3:0);
export function learnFlight(F,ok){const t=teach(F.tr);for(const a of ['p','s','a'])learn(a,.8*t);if(!ok&&F.fail)learn(sysOf(F.fail),2.5*t)}
// A new booster milestone means re-learning part of what the team knew about the old design.
export function redesign(a){if(!S.kn||!S.kn[a])return;S.kn[a]*=.8;lg(`[ENGINEERING] ${SYSK[a].n}: the new design means re-learning part of what the team knew.`,'wn')}
// Failure modes in a system that have never been fixed and are not already under investigation: what a design review can turn up.
// The rocket's own flaws are what a review is most likely to turn up.
export const hidden=a=>{const tm=traitsOf(S.cur).map(t=>TR(t.k).m);return[...SYSK[a].modes].filter(m=>!S.fix[m]&&!S.inc.some(i=>i.mode==m&&i.st!='done')).flatMap(m=>tm.includes(m)?[m,m,m]:[m])};
export const reviewOdds=a=>Math.min(.9,.2+.65*kf(a)),REVIEW_COST=3000,reviewTime=a=>Math.round(40*(1-.35*kf(a)));
export function finishReview(a){const pool=hidden(a);if(pool.length&&Math.random()<reviewOdds(a)){const m=pool[Math.floor(Math.random()*pool.length)],id=S.inc.reduce((x,i)=>Math.max(x,i.id),0)+1;
S.inc.push({id,mode:m,sym:[],cand:[m],ev:0,st:'diag',dx:m,conf:'high',t:0,lab:'Design review',review:1});S.known[m]=1;learn(a,3);revealTraits(S.cur);
lg(`[DESIGN REVIEW] ${SYSK[a].n}: the engineers flag ${MODES[m].n.toLowerCase()} as a risk before it has ever failed in flight. Remedies are on the table.`,'hd')}
else{learn(a,4);lg(`[DESIGN REVIEW] ${SYSK[a].n}: no new concerns found. The team knows the system a little better.`,'ok')}}
