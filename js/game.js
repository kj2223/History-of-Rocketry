// Player actions and the once-per-second tick. No DOM; each action logs through lg and returns nothing.
import { K } from './util.js';
import { FUEL, PAY, MODES, fxOf, DAYS_PER_SEC } from './data.js';
import { S, lg, done, free } from './state.js';
import { spec, mods, pad, mk, finishJob, grant, desig, batch, btime, retro, payroll, draftDiff, dodSupplement, carryover, learn } from './design.js';
import { rivalTick } from './race.js';
import { progress } from './design.js';
import { room } from './base.js';
export const autoPublishDue=()=>{const d=draftDiff();return S.ap.on&&d.pk.length+d.fx.length>=S.ap.n};
export { commission, quoteLaunch } from './design.js';
export function tickSecond(){let dirty=false;if(S.dev){S.dev.ps++;if(S.dev.ps%30==0)snapshot()}S.day+=DAYS_PER_SEC;if(rivalTick())dirty=true;S.gt--;if(S.gt<=0){S.gt=30;const g=grant();S.b+=g;const sup=dodSupplement();lg(`[FISCAL] Appropriation deposited: +${K(g)}${sup?` (includes a ${K(sup)} Defense Department supplement: the Soviets are judged to be ahead)`:''}`,'ok');const pr=payroll();if(pr){S.b=Math.max(0,S.b-pr);lg(`[PAYROLL] Salaries paid: -${K(pr)}`,'wn')}if(S.staff.pr)S.rep=Math.min(100,S.rep+.5);dirty=true}
const q=S.aq[0];if(q&&--q.t<=0){S.aq.shift();if(q.k=='retro'){const a=S.air.find(x=>x.id==q.af);if(a){a.pk=[...q.cfg.pk];a.fix={...q.cfg.fix};a.rev=q.cfg.rev;a.st='r';a.label=`${desig(a.pk)} #${a.id}`;lg(`[FACTORY] ${a.label} upgraded to blueprint Rev ${a.rev}.`,'ok')}}else{const a=mk(q.cfg,q.cost);S.air.push(a);S.prod++;if(q.cfg.rev==S.bp.rev)S.line.xp++;lg(`[FACTORY] ${a.label} (Rev ${a.rev}) delivered to the hangar.`,'ok')}dirty=true}
for(const j of S.jobs.slice())if(--j.t<=0){S.jobs.splice(S.jobs.indexOf(j),1);finishJob(j);dirty=true}
if(autoPublishDue()){publishBlueprint(true);dirty=true}
return dirty}
export function orderAirframes(n){const c=batch(n);if(S.b<c)return;S.b-=c;const cfg={pk:[...S.bp.pk],fix:{...S.bp.fix},rev:S.bp.rev},ts=[...Array(n)].map((_,i)=>btime(i));for(let i=0;i<n;i++)S.aq.push({k:'build',cfg,cost:Math.round(c/n),t:ts[i],tot:ts[i]});lg(`[FACTORY] Ordered x${n} Vanguard ${desig(cfg.pk)} to blueprint Rev ${cfg.rev} (${K(c)}).`,'wn')}
export function publishBlueprint(auto){const d=draftDiff(),n=d.pk.length+d.fx.length;if(!n)return;const keep=carryover(),was=S.line.xp;S.line.xp=Math.round(was*keep*10)/10;S.bp={rev:S.bp.rev+1,pk:Object.keys(S.pk),fix:{...S.fix}};lg(`[DRAWING OFFICE] ${auto?'Auto-published':'Published'} blueprint Rev ${S.bp.rev} with ${n} change${n>1?'s':''}. The line keeps ${Math.round(keep*100)}% of its experience (${was.toFixed(1)} to ${S.line.xp.toFixed(1)} units).`,'ok')}
export function queueRetrofit(id){const af=S.air.find(x=>x.id==id&&x.st=='r'),i=af&&retro(af);if(!i||S.b<i.c)return;S.b-=i.c;af.st='queued';S.aq.push({k:'retro',af:af.id,cfg:{pk:[...S.bp.pk],fix:{...S.bp.fix},rev:S.bp.rev},cost:i.c,t:i.t,tot:i.t});lg(`[FACTORY] ${af.label} queued for upgrade to Rev ${S.bp.rev} (${K(i.c)}).`,'wn')}
// Cancelling refunds everything for work not yet started, half for the job on the floor.
export const refundOf=i=>{const q=S.aq[i];return q?Math.round(q.cost*(i==0&&q.t<q.tot?.5:1)):0};
export function cancelQueue(i){const q=S.aq[i];if(!q)return;const r=refundOf(i);S.b+=r;S.aq.splice(i,1);if(q.k=='retro'){const af=S.air.find(x=>x.id==q.af);if(af)af.st='r'}lg(`[FACTORY] Cancelled ${q.k=='retro'?`the upgrade of airframe #${q.af}`:`a Rev ${(q.cfg&&q.cfg.rev)||1} airframe`}. Refund ${K(r)}.`,'wn')}
export function startRetrofit(id){const af=S.air.find(x=>x.id==id),i=af&&retro(af);if(i&&S.b>=i.c&&free()>0){S.b-=i.c;af.st='retro';S.jobs.push({k:'retro',id:af.id,t:i.t,tot:i.t});lg(`[HANGAR] Retrofitting ${af.label} (${K(i.c)}).`,'wn')}}
export function startInvestigation(id){const i=S.inc.find(x=>x.id==id);if(i&&i.st=='open'&&S.b>=1500&&free()>0){S.b-=1500;i.st='inv';S.jobs.push({k:'inv',id:i.id,t:25,tot:25});lg(`[INCIDENT #${i.id}] Records analysis under way.`,'wn')}}
export function chooseFix(id,fid){const i=S.inc.find(x=>x.id==id),f=i&&fxOf(i.dx,fid);if(f&&i.st=='diag'&&S.b>=f[3]&&free()>0){S.b-=f[3];i.st='fixing';S.jobs.push({k:'fix',id:i.id,m:i.dx,f:f[0],t:f[4],tot:f[4]});lg(`[DESIGN] Implementing ${f[1]}.`,'wn')}}

export const teamCost=()=>12000+6000*(S.teams-2),HIRE={pr:[15000,'Press office established. Failures now cost half the reputation, and reputation slowly recovers.'],director:[25000,'Launch director appointed. Standing orders can now fly the fleet unattended.']};
export function hire(what){if(what=='team'){if(S.teams<6&&S.b>=teamCost()){S.b-=teamCost();S.teams++;lg(`[PERSONNEL] A new engineering team joins (${S.teams} teams).`,'ok')}return}const h=HIRE[what];if(h&&!S.staff[what]&&S.b>=h[0]){S.b-=h[0];S.staff[what]=1;lg('[PERSONNEL] '+h[1],'ok')}}
export function toggleAuto(){if(S.staff.director)S.auto.on=S.auto.on?0:1}
export function setOrders(o){if(S.staff.director)Object.assign(S.auto,{fuel:o.fuel,pay:o.pay,st:o.st,load:o.load/100})}

// A progression snapshot every 30 seconds of play.
function snapshot(){const D=S.dev,cf=Object.values(S.pk).filter(p=>p.c).length;D.snap.push({t:D.ps,d:Math.round(S.day),b:Math.round(S.b),g:grant(),rep:Math.round(S.rep),dir:S.dir,hi:Math.round(S.hi||0),hs:Math.round(S.hs||0),hd:Math.round(S.hd||0),ok:S.ok,fl:D.fl,pk:Object.keys(S.pk).length,cf,ms:Object.keys(S.pk).filter(k=>k.startsWith('ms_')).length,bp:S.bp.rev,air:S.air.length,teams:S.teams,crew:Object.values(S.crew).filter(Boolean).length,room:room(),you:+progress().toFixed(3),sov:+Math.min(1,S.day/S.rv.r_sat).toFixed(3)});if(D.snap.length>2000)D.snap.shift()}
