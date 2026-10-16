// Player actions and the once-per-second tick. No DOM; each action logs through lg and returns nothing.
import { K } from './util.js';
import { FUEL, PAY, MODES, BY, isMS, fxOf, DAYS_PER_SEC, DAYS_PER_SEC2 } from './data.js';
import { S, lg, done, free } from './state.js';
import { afLabel, spec, mods, pad, mk, finishJob, grant, desig, batch, btime, retro, payroll, draftDiff, dodSupplement, carryover, learn } from './design.js';
import { rivalTick } from './race.js';
import { ensureP2, deliverVehicle } from './mercury.js';
import { trainTick } from './astro.js';
import { progress } from './design.js';
import { room, constructionTick } from './base.js';
import { officeTick } from './mercury.js';
import { mrPublish } from './manrate.js';
import { withProg } from './state.js';
import { PROGS, maturity, MATURE, progOf } from './programs.js';
import { kf, sysOf, SYSK, REVIEW_COST, reviewTime, redesign } from './knowledge.js';
import { ACT_DAY } from './race.js';
// CALENDAR CATCH-UP: progress maps to the date history reached it (orbit by early 1958, the first American in space in May 1961).
// When you are well ahead of that date the calendar runs faster, easing off as it catches up; behind it, nothing changes.
export const histTarget=()=>{const p=Math.min(1,progress());return S.nasa?4590+p*(5525-4590):4400*p};
// A margin of six months lets a strong programme beat history to its firsts before the calendar leans in.
export const catchUp=()=>{if(!S.nasa&&S.fs.f_orbit){const g=ACT_DAY-S.day;return g<=0?1:Math.min(10,1+g/20)}const gap=histTarget()-S.day-180;return gap<=0?1:Math.min(S.nasa?4:5,1+gap/(S.nasa?200:220))};
export const dps=()=>(S.nasa?DAYS_PER_SEC2:DAYS_PER_SEC)*catchUp();
// FACTORY: each build team works one queue item at a time; tooling upgrades speed every build, the clean room speeds capsules.
export const bteams=()=>S.bteams||1,BTEAM_MAX=4,bteamCost=()=>15000*bteams();
export const buildRate=q=>(S.fac.jigs?1.25:1)*(S.fac.nc?1.25:1)*(q&&q.k=='msn'&&S.fac.clean?1.3:1);
export const autoPublishDue=()=>{const d=draftDiff();return S.ap.on&&d.pk.length+d.fx.length>=S.ap.n};
export { commission, quoteLaunch } from './design.js';
export function tickSecond(){let dirty=false;if(S.dev){S.dev.ps++;if(S.dev.ps%30==0)snapshot()}const DPS=dps();S.day+=DPS;if(constructionTick())dirty=true;if(rivalTick())dirty=true;S.gt--;if(S.gt<=0){S.gt=30;const g=grant();S.b+=g;const sup=dodSupplement();lg(`[FISCAL] Appropriation deposited: +${K(g)}${sup?` (includes a ${K(sup)} Defense Department supplement: the Soviets are judged to be ahead)`:''}`,'ok');const pr=payroll();if(pr){S.b=Math.max(0,S.b-pr);lg(`[PAYROLL] Salaries paid: -${K(pr)}`,'wn')}if(S.staff.pr)S.rep=Math.min(100,S.rep+.5);dirty=true}
if(S.nasa){ensureP2();trainTick(DPS);if(officeTick(DPS))dirty=true}
for(const q of S.aq.slice(0,bteams())){q.t-=buildRate(q);if(q.t>0)continue;S.aq.splice(S.aq.indexOf(q),1);dirty=true;if(q.k=='msn')deliverVehicle(q);else if(q.k=='retro'){const a=S.air.find(x=>x.id==q.af);if(a){a.pk=[...q.cfg.pk];a.fix={...q.cfg.fix};a.rev=q.cfg.rev;a.st='r';a.label=afLabel(a.prog,a.pk,a.id);lg(`[FACTORY] ${a.label} upgraded to blueprint Rev ${a.rev}.`,'ok')}}else withProg(q.prog,()=>{const a=mk(q.cfg,q.cost,q.prog||S.cur);S.air.push(a);S.prod++;if(q.cfg.rev==S.bp.rev)S.line.xp++;lg(`[FACTORY] ${a.label} (Rev ${a.rev}) delivered to the hangar.`,'ok')})}
for(const j of S.jobs.slice())if(--j.t<=0){S.jobs.splice(S.jobs.indexOf(j),1);finishJob(j);dirty=true}
if(autoPublishDue()){publishBlueprint(true);dirty=true}if(matureTick())dirty=true;
return dirty}
// A programme that reaches maturity opens the next rung of the ladder, and some bring a contract with them.
function matureTick(){let ch=false;for(const k in S.progs){const b=S.progs[k];if(b.matured||!b.ready||maturity(k)<MATURE)continue;b.matured=1;ch=true;const pr=PROGS[k];
lg(`[PROGRAMME] ${pr.n} is mature: the team understands this rocket well. New programmes can be proposed in the Design Bureau.`,'hd');if(pr.contract){S.b+=pr.contract;lg(`[CONTRACT] ${k=='redstone'?`The Army buys the ${pr.n} as a production missile`:k=='viking'?`The Navy buys Viking flights for upper-atmosphere research`:`The Defense Department buys ${pr.n} flights to calibrate its radars and missiles`}. Contract payment +${K(pr.contract)}.`,'hd')}}return ch}
export function orderAirframes(n){if(!S.progs[S.cur]||!S.progs[S.cur].ready)return;const c=batch(n);if(S.b<c)return;S.b-=c;const cfg={pk:[...S.bp.pk],fix:{...S.bp.fix},rev:S.bp.rev},ts=[...Array(n)].map((_,i)=>btime(i));for(let i=0;i<n;i++)S.aq.push({k:'build',prog:S.cur,cfg,cost:Math.round(c/n),t:ts[i],tot:ts[i]});lg(`[FACTORY] Ordered x${n} ${PROGS[S.cur].n} ${desig(cfg.pk)} to blueprint Rev ${cfg.rev} (${K(c)}).`,'wn')}
export function publishBlueprint(auto){const d=draftDiff(),n=d.pk.length+d.fx.length;if(!n)return;const keep=carryover(),was=S.line.xp;S.line.xp=Math.round(was*keep*10)/10;S.bp={rev:S.bp.rev+1,pk:Object.keys(S.pk),fix:{...S.fix}};mrPublish(d.pk,S.bp.rev);for(const id of d.pk)if(BY[id]&&isMS(id)&&BY[id].ph!=2&&BY[id].a)redesign(BY[id].a);lg(`[DRAWING OFFICE] ${auto?'Auto-published':'Published'} blueprint Rev ${S.bp.rev} with ${n} change${n>1?'s':''}. The line keeps ${Math.round(keep*100)}% of its experience (${was.toFixed(1)} to ${S.line.xp.toFixed(1)} units).`,'ok')}
export function queueRetrofit(id){const af=S.air.find(x=>x.id==id&&x.st=='r'),i=af&&retro(af);if(!i||S.b<i.c)return;withProg(af.prog,()=>{S.b-=i.c;af.st='queued';S.aq.push({k:'retro',af:af.id,prog:af.prog,cfg:{pk:[...S.bp.pk],fix:{...S.bp.fix},rev:S.bp.rev},cost:i.c,t:i.t,tot:i.t});lg(`[FACTORY] ${af.label} queued for upgrade to Rev ${S.bp.rev} (${K(i.c)}).`,'wn')})}
// Cancelling refunds everything for work not yet started, half for the job on the floor.
export const refundOf=i=>{const q=S.aq[i];return q?Math.round(q.cost*(i<bteams()&&q.t<q.tot?.5:1)):0};
export function cancelQueue(i){const q=S.aq[i];if(!q)return;const r=refundOf(i);S.b+=r;S.aq.splice(i,1);if(q.k=='retro'){const af=S.air.find(x=>x.id==q.af);if(af)af.st='r'}lg(`[FACTORY] Cancelled ${q.k=='retro'?`the upgrade of airframe #${q.af}`:`a Rev ${(q.cfg&&q.cfg.rev)||1} airframe`}. Refund ${K(r)}.`,'wn')}
export function startRetrofit(id){const af=S.air.find(x=>x.id==id),i=af&&retro(af);if(i&&S.b>=i.c&&free()>0){S.b-=i.c;af.st='retro';S.jobs.push({k:'retro',id:af.id,prog:af.prog,t:i.t,tot:i.t});lg(`[HANGAR] Retrofitting ${af.label} (${K(i.c)}).`,'wn')}}
// Investigations go faster when the team knows the systems involved.
export const invTime=i=>Math.round(25*(1-.4*kf(sysOf(i.cand[0]))));
// Design review: a team studies one system for failure modes that have not happened yet.
export function startReview(a){if(!SYSK[a]||!SYSK[a].modes||S.b<REVIEW_COST||free()<1||S.jobs.some(j=>j.k=='rev'&&j.a==a))return;S.b-=REVIEW_COST;const t=reviewTime(a);S.jobs.push({k:'rev',a,id:a,prog:S.cur,t,tot:t});lg(`[DESIGN REVIEW] ${SYSK[a].n}: a team begins a design review ($3,000).`,'wn')}
export function startInvestigation(id){const i=S.inc.find(x=>x.id==id);if(i&&i.st=='open'&&S.b>=1500&&free()>0){S.b-=1500;i.st='inv';const it=invTime(i);S.jobs.push({k:'inv',id:i.id,prog:S.cur,t:it,tot:it});lg(`[INCIDENT #${i.id}] Records analysis under way.`,'wn')}}
export function chooseFix(id,fid){const i=S.inc.find(x=>x.id==id),f=i&&fxOf(i.dx,fid);if(f&&i.st=='diag'&&S.b>=f[3]&&free()>0){S.b-=f[3];i.st='fixing';S.jobs.push({k:'fix',id:i.id,prog:S.cur,m:i.dx,f:f[0],t:f[4],tot:f[4]});lg(`[DESIGN] Implementing ${f[1]}.`,'wn')}}

export const teamCost=()=>12000+6000*(S.teams-2),HIRE={pr:[15000,'Press office established. Failures now cost half the reputation, and reputation slowly recovers.'],director:[25000,'Launch director appointed. Standing orders can now fly the fleet unattended.']};
export function hire(what){if(what=='bteam'){if(bteams()<BTEAM_MAX&&S.b>=bteamCost()){S.b-=bteamCost();S.bteams=bteams()+1;lg(`[PERSONNEL] A new build team joins the factory (${S.bteams} teams): ${S.bteams} items in the queue are now worked at once.`,'ok')}return}if(what=='team'){if(S.teams<6&&S.b>=teamCost()){S.b-=teamCost();S.teams++;lg(`[PERSONNEL] A new engineering team joins (${S.teams} teams).`,'ok')}return}const h=HIRE[what];if(h&&!S.staff[what]&&S.b>=h[0]){S.b-=h[0];S.staff[what]=1;lg('[PERSONNEL] '+h[1],'ok')}}
export function toggleAuto(){if(S.staff.director)S.auto.on=S.auto.on?0:1}
export function setOrders(o){if(S.staff.director)Object.assign(S.auto,{fuel:o.fuel,pay:o.pay,st:o.st,load:o.load/100})}

// A progression snapshot every 30 seconds of play.
function snapshot(){const D=S.dev,cf=Object.values(S.pk).filter(p=>p.c).length;D.snap.push({t:D.ps,d:Math.round(S.day),b:Math.round(S.b),g:grant(),rep:Math.round(S.rep),dir:S.dir,hi:Math.round(S.hi||0),hs:Math.round(S.hs||0),hd:Math.round(S.hd||0),ok:S.ok,fl:D.fl,pk:Object.keys(S.pk).length,cf,ms:Object.keys(S.pk).filter(k=>k.startsWith('ms_')).length,bp:S.bp.rev,air:S.air.length,teams:S.teams,crew:Object.values(S.crew).filter(Boolean).length,room:room(),you:+progress().toFixed(3),sov:+Math.min(1,S.day/S.rv.r_sat).toFixed(3)});if(D.snap.length>2000)D.snap.shift()}
