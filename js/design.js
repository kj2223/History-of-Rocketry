// Design rules: spec from completed packages, costs, work jobs, airframes and retrofits. No DOM.
import { K, gauss } from './util.js';
import { PK, MSL, BY, isMS, AREAS, MODES, FUEL, PAY, STN, fxOf, fe } from './data.js';
import { S, lg, dt, done, conf, free, job, note } from './state.js';
export const cnt=a=>{const p=PK.filter(x=>x.a==a);return{d:p.filter(x=>done(x.id)).length,c:p.filter(x=>conf(x.id)).length,n:p.length}};
export function spec(ids){const s={f:12,t:1,g:6,d:0,r:0,i:0,c:1,h:.5,q:1,rc:0,rv:700,sv:1};for(const id of ids){const p=S.pk[id];if(p)for(const k in p.a)s[k]+=p.a[k]}s.tier=Math.max(0,Math.min(3,Math.floor(s.i+1e-9)));return s}
export const mods=fx=>{const o={t:1,d:0,g:0,h:0,c:0,q:0};for(const m in fx){const f=fxOf(m,fx[m]);if(f){o.t*=f[5].t||1;for(const k of ['d','g','h','c','q'])o[k]+=f[5][k]||0}}return o};
export const cx=(ids=Object.keys(S.pk))=>{const m=ids.filter(isMS).length;return{p:ids.length-m,m}};
export const desig=ids=>{const c=cx(ids);return`Mk. ${['I','II','III','IV','V','VI','VII','VIII'][Math.min(7,c.m)]}${c.p>=3?'.'+Math.floor(c.p/3):''}`};
export const unit=(x=0)=>{const c=cx(S.bp.pk);return Math.round(4000*(1+.08*c.p+.35*Math.min(c.m,8))*(1-Math.min(.3,(S.prod+x)*.02)))},batch=n=>[...Array(n)].reduce((a,_,i)=>a+unit(i),0),btime=()=>{const c=cx(S.bp.pk);return Math.round(10+1.2*c.p+4*Math.min(c.m,8))};
export const mk=(cfg,cost)=>{const id=S.nid++;return{id,pk:[...cfg.pk],fix:{...cfg.fix},rev:cfg.rev||1,cost,st:'r',built:dt(),label:`${desig(cfg.pk)} #${id}`}};
export const tiers=()=>({g:(S.fac.radar?1:0)+(S.fac.ship?1:0),v:spec(Object.keys(S.pk)).tier});
export const era=()=>S.dir>=4?2:S.dir>=2?1:0,pad=()=>Math.round(1000+4000*Math.min(1,S.dir/4));
export const fuelCost=(af,name,load=1)=>{const fu=FUEL[name];return Math.round(fu.c+fu.kg*spec(af.pk).f*fu.den*load)};
// The Defense Department buys tracking data from every successful early flight. Worth less once rockets routinely reach space.
export const rangeData=peak=>S.dir>=4?0:Math.round(Math.min(6000,2500+60*peak/1000)*(S.dir>=2?.5:1));
export const grant=()=>Math.round((10000+Math.min(9000,Math.floor(S.hi/1000)*150)+S.pb+(S.fac.ship?5000:0))*Math.max(.2,S.rep/100)*(1+(S.rvd.r_icbm?.1:0)+(S.rvd.r_sat&&!S.fs.f_orbit?.3:0)));
export const stagingOK=()=>done('ms_stg')||done('ms_clu'),kerLock=()=>!(S.bt.p||done('ms_eng')||done('ms_rel')),satLock=()=>!stagingOK();
// Milestone rules: tier-1 approaches are exclusive per area; tier 2 follows a tier-1 milestone plus 9 confirmed packages; joint programmes need tier 1 in both areas.
export const t1done=a=>MSL.some(m=>m.a==a&&m.tier==1&&done(m.id));
export function msLock(m){if(done(m.id))return'Complete.';if(m.tier==1){if(MSL.some(o=>o.a==m.a&&o.tier==1&&o.id!=m.id&&(done(o.id)||job(j=>j.k=='pk'&&j.id==o.id))))return'Another approach was chosen.';if(!S.bt[m.a])return`Needs a breakthrough (${cnt(m.a).c}/5 confirmed).`}else if(m.tier==2){if(!t1done(m.a))return'Needs a first milestone in this area.';if(cnt(m.a).c<9)return`Needs 9 confirmed packages in this area (${cnt(m.a).c}/9).`}else{const miss=[...m.xa].filter(a=>!t1done(a));if(miss.length)return`Needs a first milestone in ${miss.map(a=>AREAS[a]).join(' and ')}.`}return null}
export const sig=(it)=>{const t=tiers();return Math.max(.1,(isMS(it.id)?.1:it.dud?.45:.25)*(1-.1*(t.g+t.v)))};
export function desc(it){const p=S.pk[it.id];if(p&&p.c)return Object.entries(p.m).map(([k,v])=>fe(k,v)).join(', ')+' (measured)';const s=sig(it);return Object.entries(it.e).map(([k,v])=>fe(k,v,Math.abs(v)*s)).join(', ')+(p?' (awaiting flight)':' (estimate)')}
export function can(id){const it=BY[id];if(done(id))return'Complete.';if(job(j=>j.k=='pk'&&j.id==id))return'In progress.';if(isMS(id)){const l=msLock(it);if(l)return l}else if(!proposed(it))return'Not yet proposed by the engineers.';if(it.need&&!t1done(it.a))return'Unlocks after a first milestone in this area.';if(S.b<it.c)return`Need ${K(it.c-S.b)} more.`;if(free()<1)return'All teams busy.';return null}
export const commission=id=>{const r=can(id);if(r)return lg(r,'bad');const it=BY[id];S.b-=it.c;S.jobs.push({k:'pk',id,t:it.t,tot:it.t});lg(`[DESIGN] Started: ${it.n} (${K(it.c)}).`,'wn')};
// Upgrading a built airframe to the published blueprint: one factory job however many changes it carries.
export function retro(af){const ms=S.bp.pk.filter(i=>!af.pk.includes(i)),mf=Object.keys(S.bp.fix).filter(m=>af.fix[m]!=S.bp.fix[m]),n=ms.length+mf.length;if(!n)return null;let c=600;ms.forEach(i=>c+=BY[i].c*.15);mf.forEach(m=>c+=fxOf(m,S.bp.fix[m])[3]*.15);return{n,c:Math.round(c),t:6+2*n}}
export const draftDiff=()=>({pk:Object.keys(S.pk).filter(i=>!S.bp.pk.includes(i)),fx:Object.keys(S.fix).filter(m=>S.bp.fix[m]!=S.fix[m])});
// Research is proposed gradually: two ideas per area at first, one more each time a package in that area is confirmed. Second-generation ideas follow the same rule after the first milestone.
export function proposed(it){if(isMS(it.id)||done(it.id)||job(j=>j.k=='pk'&&j.id==it.id))return true;const own=PK.filter(p=>p.a==it.a&&!!p.need==!!it.need);if(it.need){if(!t1done(it.a))return false;return own.indexOf(it)<1+own.filter(p=>conf(p.id)).length}return own.indexOf(it)<2+cnt(it.a).c}
export function finishJob(j){if(j.k=='pk'){const it=BY[j.id],a={},dud=!!it.dud&&Math.random()<it.dud,sg=isMS(j.id)?.1:it.dud?.4:.25;for(const k in it.e)a[k]=it.e[k]*(dud?-.3+.45*Math.random():Math.max(-.25,Math.min(1.8,1+sg*gauss())));S.pk[j.id]={a,c:0,m:null,dud};lg(`[DESIGN] Complete: ${it.n}. Publish a new blueprint revision to build it into airframes; its real effect is confirmed when one flies.`,'ok');if(isMS(j.id))note(`Milestone: ${it.n}`);if(it.pay){S.b+=it.pay;lg(`[CONTRACT] ${it.n} delivered. Contract payment +${K(it.pay)}.`,'hd')}checkBreak()}
else if(j.k=='inv'){const i=S.inc.find(x=>x.id==j.id);if(!i)return;const t=tiers(),q=Math.min(.7,.1*(t.g+t.v)+(S.crew.tlm?.1:0)),p=Math.min(.95,1/i.cand.length+.5*q+.12*(i.ev-1)),dec=i.cand.filter(c=>c!=i.mode);const ok=Math.random()<p||!dec.length;i.dx=ok?i.mode:dec[Math.floor(Math.random()*dec.length)];i.conf=p<.45?'low':p<.75?'moderate':'high';i.st='diag';if(ok)S.known[i.mode]=1;lg(`[INCIDENT #${i.id}] Engineers conclude ${MODES[i.dx].n.toLowerCase()} (${i.conf} confidence).`,'wn')}
else if(j.k=='fix'){S.fix[j.m]=j.f;const i=S.inc.find(x=>x.id==j.id);if(i&&i.st=='fixing')i.st='done';lg(`[DESIGN] ${fxOf(j.m,j.f)[1]} is now part of the design. Older airframes need a retrofit.`,'ok')}
else if(j.k=='gt'){confirmPk(j.id,'Test-stand');checkBreak()}
else if(j.k=='retro'){const a=S.air.find(x=>x.id==j.id);if(a){a.pk=Object.keys(S.pk);a.fix={...S.fix};a.st='r';a.label=`${desig(a.pk)} #${a.id}`;lg(`[HANGAR] ${a.label} retrofit complete.`,'ok')}}}

export function ensureStarter(){if(!S.air.length&&!S.prod&&!S.aq.length&&!S.sg){S.sg=1;S.air.push(mk({pk:[],fix:{}},3500))}}

// Reputation lost to a failure. kind: novel | known | residual | obsolete. The PR specialist halves it.
export function repLoss(kind){const base={novel:3,known:5,residual:2,obsolete:3,bio:6}[kind]||3,f=kind=='bio'?1:.34+.66*Math.min(1,S.dir/4);S.rep=Math.max(0,S.rep-Math.max(1,base*f)*(S.staff.pr?.5:1)*(S.crew.rso&&kind!='bio'?.7:1))}
export const payroll=()=>Math.max(0,S.teams-2)*1200+(S.staff.pr?1000:0)+(S.staff.director?2500:0)+Object.keys(S.crew).reduce((a,k)=>a+(S.crew[k]&&STN[k]?STN[k].sal:0),0);
export function quoteLaunch(af,fuelName,payName,stage,load=1){if(!af)return{err:'No airframe is ready.'};const fu=FUEL[fuelName],py=PAY[payName];if(py.req&&!done(py.req))return{err:`The ${payName} needs ${BY[py.req].n}.`};const sp=spec(af.pk),m=mods(af.fix),stg=stage&&stagingOK();const t=fuelCost(af,fuelName,load)+py.c+(stg?8000:0)+pad();if(S.b<t)return{t,err:`Need ${K(t-S.b)} more.`};if(!stg&&2500*sp.t*m.t<(40+sp.d+m.d+sp.f*fu.den*load+py.m)*9.81*1.05)return{t,err:'Too heavy to lift off. Lighter payload or a stronger engine needed.'};return{t}}

// Confirm a package's real effect (from a flight or the test stand), then check each area for a breakthrough.
export function confirmPk(id,how='Flight'){const p=S.pk[id];if(!p||p.c)return;p.c=1;p.m={};for(const k in p.a)p.m[k]=p.a[k]*(1+.08*gauss());if(p.dud)lg(`[DEAD END] ${BY[id].n} did not pan out. The engineers learned what NOT to build.`,'bad');lg(`[DESIGN] ${how} data on ${BY[id].n}: ${Object.entries(p.m).map(([k,v])=>fe(k,v)).join(', ')}.`,'cyan')}
export function checkBreak(){for(const a in AREAS){if(!S.bt[a]&&cnt(a).c>=5){S.bt[a]=1;lg(`[BREAKTHROUGH] ${AREAS[a]}: the engineers see the pattern. Choose an approach: ${MSL.filter(m=>m.a==a&&m.tier==1).map(m=>m.n).join(' or ')}.`,'hd')}
const t2=MSL.find(m=>m.a==a&&m.tier==2);if(t2&&!S.bt[a+'2']&&!msLock(t2)){S.bt[a+'2']=1;lg(`[DESIGN] ${AREAS[a]}: ${t2.n} is now feasible.`,'hd')}}
for(const m of MSL)if(m.tier=='x'&&!S.bt[m.id]&&!msLock(m)){S.bt[m.id]=1;lg(`[JOINT PROGRAMME] ${m.n} is now possible.`,'hd')}}
// Chance a payload is found intact. Too fast on the way down and it burns up unless the heat protection is good enough.
export function recoveryOdds(sp,ps,dr){if(sp.rc<=0)return{p:0,burn:0,none:1};let p=sp.rc+(S.fac.recov?.2:0)+(S.crew.rec?.15:0)+(S.fac.ship?.05:0);if(dr>80000&&!S.fac.recov&&!S.fac.ship)p-=.2;const burn=ps>sp.rv?Math.min(1,(ps-sp.rv)/sp.rv*2):0;p*=1-burn;return{p:Math.max(0,Math.min(.95,p)),burn}}
