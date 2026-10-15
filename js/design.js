// Design rules: spec from completed packages, costs, work jobs, airframes and retrofits. No DOM.
import { K, gauss } from './util.js';
import { PK, MS, BY, isMS, AREAS, MODES, FUEL, PAY, fxOf, fe } from './data.js';
import { S, lg, dt, done, conf, free, job } from './state.js';
export const cnt=a=>{const p=PK.filter(x=>x.a==a);return{d:p.filter(x=>done(x.id)).length,c:p.filter(x=>conf(x.id)).length,n:p.length}};
export function spec(ids){const s={f:12,t:1,g:6,d:0,r:0,i:0};for(const id of ids){const p=S.pk[id];if(p)for(const k in p.a)s[k]+=p.a[k]}s.tier=Math.max(0,Math.min(3,Math.floor(s.i+1e-9)));return s}
export const mods=fx=>{const o={t:1,d:0,g:0};for(const m in fx){const f=fxOf(m,fx[m]);if(f){o.t*=f[5].t||1;o.d+=f[5].d||0;o.g+=f[5].g||0}}return o};
export const cx=(ids=Object.keys(S.pk))=>{const m=ids.filter(isMS).length;return{p:ids.length-m,m}};
export const desig=ids=>{const c=cx(ids);return`Mk. ${['I','II','III','IV'][Math.min(3,c.m)]}${c.p>=3?'.'+Math.floor(c.p/3):''}`};
export const unit=(x=0)=>{const c=cx();return Math.round(4000*(1+.1*c.p+.5*c.m)*(1-Math.min(.3,(S.prod+x)*.02)))},batch=n=>[...Array(n)].reduce((a,_,i)=>a+unit(i),0),btime=()=>{const c=cx();return Math.round(10+1.5*c.p+5*c.m)};
export const mk=(cfg,cost)=>{const id=S.nid++;return{id,pk:[...cfg.pk],fix:{...cfg.fix},cost,st:'r',built:dt(),label:`${desig(cfg.pk)} #${id}`}};
export const tiers=()=>({g:(S.fac.radar?1:0)+(S.fac.ship?1:0),v:spec(Object.keys(S.pk)).tier});
export const era=()=>S.dir>=4?2:S.dir>=2?1:0,pad=()=>Math.round(2000+3000*Math.min(1,S.dir/4));
export const grant=()=>Math.round((10000+Math.min(9000,Math.floor(S.hi/1000)*150)+S.pb+(S.fac.ship?5000:0))*Math.max(.2,S.rep/100));
export const kerLock=()=>!(S.bt.p||done('ms_eng')),satLock=()=>!done('ms_stg');
export const sig=(it)=>{const t=tiers();return Math.max(.1,(isMS(it.id)?.1:it.dud?.45:.25)*(1-.1*(t.g+t.v)))};
export function desc(it){const p=S.pk[it.id];if(p&&p.c)return Object.entries(p.m).map(([k,v])=>fe(k,v)).join(', ')+' (measured)';const s=sig(it);return Object.entries(it.e).map(([k,v])=>fe(k,v,Math.abs(v)*s)).join(', ')+(p?' (awaiting flight)':' (estimate)')}
export function can(id){const it=BY[id];if(done(id))return'Complete.';if(job(j=>j.k=='pk'&&j.id==id))return'In progress.';if(isMS(id)&&!S.bt[it.a])return`Needs a breakthrough (${cnt(it.a).c}/5 confirmed in flight).`;if(S.b<it.c)return`Need ${K(it.c-S.b)} more.`;if(free()<1)return'All teams busy.';return null}
export const commission=id=>{const r=can(id);if(r)return lg(r,'bad');const it=BY[id];S.b-=it.c;S.jobs.push({k:'pk',id,t:it.t,tot:it.t});lg(`[DESIGN] Started: ${it.n} (${K(it.c)}).`,'wn')};
export function retro(af){const ms=Object.keys(S.pk).filter(i=>!af.pk.includes(i)),mf=Object.keys(S.fix).filter(m=>af.fix[m]!=S.fix[m]),n=ms.length+mf.length;if(!n)return null;let c=0;ms.forEach(i=>c+=BY[i].c*.4);mf.forEach(m=>c+=fxOf(m,S.fix[m])[3]*.4);return{n,c:Math.round(c),t:8+3*n}}
export function finishJob(j){if(j.k=='pk'){const it=BY[j.id],a={},dud=!!it.dud&&Math.random()<it.dud,sg=isMS(j.id)?.1:it.dud?.4:.25;for(const k in it.e)a[k]=it.e[k]*(dud?-.3+.45*Math.random():Math.max(-.25,Math.min(1.8,1+sg*gauss())));S.pk[j.id]={a,c:0,m:null,dud};lg(`[DESIGN] Complete: ${it.n}. Real effect unconfirmed until it flies.`,'ok')}
else if(j.k=='inv'){const i=S.inc.find(x=>x.id==j.id);if(!i)return;const t=tiers(),q=Math.min(.6,.1*(t.g+t.v)),p=Math.min(.95,1/i.cand.length+.5*q+.12*(i.ev-1)),dec=i.cand.filter(c=>c!=i.mode);const ok=Math.random()<p||!dec.length;i.dx=ok?i.mode:dec[Math.floor(Math.random()*dec.length)];i.conf=p<.45?'low':p<.75?'moderate':'high';i.st='diag';if(ok)S.known[i.mode]=1;lg(`[INCIDENT #${i.id}] Engineers conclude ${MODES[i.dx].n.toLowerCase()} (${i.conf} confidence).`,'wn')}
else if(j.k=='fix'){S.fix[j.m]=j.f;const i=S.inc.find(x=>x.id==j.id);if(i&&i.st=='fixing')i.st='done';lg(`[DESIGN] ${fxOf(j.m,j.f)[1]} is now part of the design. Older airframes need a retrofit.`,'ok')}
else if(j.k=='retro'){const a=S.air.find(x=>x.id==j.id);if(a){a.pk=Object.keys(S.pk);a.fix={...S.fix};a.st='r';a.label=`${desig(a.pk)} #${a.id}`;lg(`[HANGAR] ${a.label} retrofit complete.`,'ok')}}}

export function ensureStarter(){if(!S.air.length&&!S.prod&&!S.aq.length&&!S.sg){S.sg=1;S.air.push(mk({pk:[],fix:{}},3500))}}

// Reputation lost to a failure. kind: novel | known | residual | obsolete. The PR specialist halves it.
export function repLoss(kind){const base={novel:3,known:5,residual:2,obsolete:3}[kind]||3,f=.34+.66*Math.min(1,S.dir/4);S.rep=Math.max(0,S.rep-Math.max(1,base*f)*(S.staff.pr?.5:1))}
export const payroll=()=>Math.max(0,S.teams-2)*1200+(S.staff.pr?1000:0)+(S.staff.director?2500:0);
export function quoteLaunch(af,fuelName,payName,stage,load=1){if(!af)return{err:'No airframe is ready.'};const fu=FUEL[fuelName],py=PAY[payName],sp=spec(af.pk),m=mods(af.fix),stg=stage&&done('ms_stg');const t=Math.round(fu.c*load)+py.c+(stg?8000:0)+pad();if(S.b<t)return{t,err:`Need ${K(t-S.b)} more.`};if(!stg&&2500*sp.t*m.t<(40+sp.d+m.d+sp.f*fu.den*load+py.m)*9.81*1.05)return{t,err:'Too heavy to lift off. Lighter payload or a stronger engine needed.'};return{t}}
