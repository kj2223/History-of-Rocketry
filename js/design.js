// Design rules: spec from completed packages, costs, work jobs, airframes and retrofits. No DOM.
import { K, gauss } from './util.js';
import { PK, MSL, BY, isMS, AREAS, MODES, FUEL, PAY, STN, fxOf, fe, bth, P2A } from './data.js';
import { S, lg, dt, done, conf, free, job, note } from './state.js';
import { learn as know, kf, sysOf, finishReview } from './knowledge.js';
import { PROGS, PR, progPkgs, inProg, scaled, VEH, progOf, createProgramme, finishDev, window as pwin, maturity, revealTraits as revealT } from './programs.js';
import { withProg } from './state.js';
export const vehA=a=>VEH.includes(a),itemsOf=a=>vehA(a)?(S.cur?progPkgs(S.cur,a):[]):PK.filter(x=>x.a==a);
export const IT=id=>vehA(BY[id].a)&&S.cur?scaled(BY[id],S.cur):BY[id];
export const bthP=a=>vehA(a)&&S.cur?[Math.max(2,Math.ceil(PR().pkN*.45)),99]:bth(a);
export const cnt=a=>{const p=itemsOf(a).filter(x=>!x.hid||done(x.id));return{d:p.filter(x=>done(x.id)).length,c:p.filter(x=>conf(x.id)).length,n:p.length}};
// The programme's design sets the base; est uses the window the team believes instead of the truth.
export function base(est){const b=S.progs[S.cur];if(!b||!b.T)return{f:12,g:6,r:0,i:0,c:1,h:.5,q:1,dry:40,thr:2500};if(!est)return b.T;const o={...b.T};for(const k of ['thr','dry','f','g','h','q','r']){const w=pwin(S.cur,k);if(w)o[k]=w.mid}return o}
export function spec(ids,est){const B=base(est),s={f:B.f,t:1,g:B.g,d:0,r:B.r,i:B.i,c:B.c,h:B.h,q:B.q,dry:B.dry,thr:B.thr,rc:0,rv:700,sv:1,hs:0,ec:0,ac:0,rr:0,pc:0,lb:0,man:0,et:0,as:0,tj:0,mr:0,rq:0,eg:0,hb:0,orb:0,um:0,mab:0};for(const id of ids){const p=S.pk[id];if(p)for(const k in p.a)s[k]+=p.a[k]}s.tier=Math.max(0,Math.min(3,Math.floor(s.i+1e-9)));return s}
export const mods=fx=>{const o={t:1,d:0,g:0,h:0,c:0,q:0};for(const m in fx){const f=fxOf(m,fx[m]);if(f){o.t*=f[5].t||1;for(const k of ['d','g','h','c','q'])o[k]+=f[5][k]||0}}return o};
export const cx=(ids=Object.keys(S.pk))=>{const m=ids.filter(isMS).length;return{p:ids.length-m,m}};
export const desig=ids=>{const c=cx(ids);return`Mk. ${['I','II','III','IV','V','VI','VII','VIII'][Math.min(7,c.m)]}${c.p>=3?'.'+Math.floor(c.p/3):''}`};
// PRODUCTION LINE LEARNING (Wright's law): each doubling of airframes built to the current blueprint cuts time and cost by about 20%, down to 45%.
// Experience counts builds already queued to the current revision, so a batch order gets cheaper unit by unit.
export const learn=xp=>Math.max(.45,Math.pow(Math.max(0,xp)+1,-.322));
const queuedNow=()=>S.aq.filter(q=>q.k=='build'&&q.prog==S.cur&&q.cfg&&q.cfg.rev==S.bp.rev).length;
export const lineXp=(x=0)=>(S.line?S.line.xp:0)+queuedNow()+x;
const baseUnit=()=>{const c=cx(S.bp.pk),pr=PR()||{uc:4000};return pr.uc*(1+.04*c.p+.2*Math.min(c.m,8))},baseTime=()=>{const c=cx(S.bp.pk),pr=PR()||{ut:10};return pr.ut*(1+.03*c.p+.15*Math.min(c.m,8))};
export const unit=(x=0)=>Math.round(baseUnit()*learn(lineXp(x))),batch=n=>[...Array(n)].reduce((a,_,i)=>a+unit(i),0),btime=(x=0)=>Math.round(baseTime()*learn(lineXp(x)));
// How much line experience a blueprint change keeps: small packages 85% each, a milestone (retooling) 40%, a corrective fix 97%.
export function carryover(){const d=draftDiff(),ms=d.pk.filter(isMS).length;return Math.pow(.85,d.pk.length-ms)*Math.pow(.4,ms)*Math.pow(.97,d.fx.length)}
export const afLabel=(prog,pk,id)=>`${PROGS[prog]?PROGS[prog].n+' ':''}${desig(pk)} #${id}`;
export const mk=(cfg,cost,prog=S.cur)=>{const id=S.nid++;return{id,prog,pk:[...cfg.pk],fix:{...cfg.fix},rev:cfg.rev||1,cost,st:'r',built:dt(),label:afLabel(prog,cfg.pk,id)}};
export const tiers=()=>({g:(S.fac.radar?1:0)+(S.fac.ship?1:0),v:spec(Object.keys(S.pk)).tier});
export const era=()=>S.dir>=4?2:S.dir>=2?1:0,pad=()=>Math.round(1000+4000*Math.min(1,S.dir/4));
// Propellant is bought in bulk: the price per kilogram falls as rockets grow.
export const fuelCost=(af,name,load=1)=>withProg(progOf(af),()=>{const fu=FUEL[name];return Math.round(fu.c+fu.kg*Math.pow(spec(af.pk).f*fu.den*load,.8))});
// The Defense Department buys tracking data from every successful early flight. Worth less once rockets routinely reach space.
export const rangeData=peak=>S.fs.f_orbit?0:Math.round(Math.min(6000,2500+60*peak/1000)*(S.dir>=2?.5:1));
export const grant=()=>baseGrant()+dodSupplement();
const baseGrant=()=>Math.round((10000+Math.min(9000,Math.floor(S.hi/1000)*150)+S.pb+(S.fac.ship?5000:0))*Math.max(.2,S.rep/100)*(1+.1*S.dir)*(S.nasa?(S.p2&&S.p2.gmul)||1:1)*(1+(S.rvd.r_icbm?.1:0)+(S.rvd.r_sat&&!S.fs.f_orbit?.3:0)));
// Staging, kerosene and satellites come with the rocket: a programme either has them or it does not.
export const stagingOK=af=>!!(PROGS[progOf(af)]||{}).stage,kerLock=af=>!((PROGS[progOf(af)]||{fuels:[]}).fuels.includes('Kerosene & LOX')),satLock=af=>!(PROGS[progOf(af)]||{}).sat;
// Milestone rules: tier-1 approaches are exclusive per area; tier 2 follows a tier-1 milestone plus 9 confirmed packages; joint programmes need tier 1 in both areas.
export const t1done=a=>MSL.some(m=>m.a==a&&m.tier==1&&done(m.id));
// Staging, the Atlas balloon tanks and the Thor-class engine are rockets of their own now, not milestones.
export const RETIRED=['ms_stg','ms_clu','ms_balloon','ms_tp'],t1opts=a=>MSL.filter(m=>m.a==a&&m.tier==1&&!RETIRED.includes(m.id));
export function msLock(m){if(done(m.id))return'Complete.';if(RETIRED.includes(m.id))return'Superseded: new rocket programmes take its place.';if((vehA(m.a)&&m.tier!=1)||m.tier=='x')return'Superseded: new rocket programmes take its place.';if(vehA(m.a)&&!(PR()||{}).ms)return'This rocket is too simple for a major programme.';if(m.tier==1){if(MSL.some(o=>o.a==m.a&&o.tier==1&&o.id!=m.id&&(done(o.id)||job(j=>j.k=='pk'&&j.id==o.id&&j.prog==(vehA(m.a)?S.cur:null)))))return'Another approach was chosen.';if(!S.bt[m.a])return`Needs a breakthrough (${cnt(m.a).c}/${bthP(m.a)[0]} confirmed).`}else if(m.tier==2){if(!t1done(m.a))return'Needs a first milestone in this area.';if(cnt(m.a).c<bth(m.a)[1])return`Needs ${bth(m.a)[1]} confirmed packages in this area (${cnt(m.a).c}/${bth(m.a)[1]}).`}else{const miss=[...m.xa].filter(a=>!t1done(a));if(miss.length)return`Needs a first milestone in ${miss.map(a=>AREAS[a]).join(' and ')}.`}return null}
export const sig=(it)=>{const t=tiers();return Math.max(.05,(isMS(it.id)?.1:it.dud?.45:.25)*(1-.1*(t.g+t.v))*(1-.5*kf(it.a)))};
export function desc(it){it=IT(it.id);const p=S.pk[it.id];if(p&&p.c)return Object.entries(p.m).map(([k,v])=>fe(k,v)).join(', ')+' (measured)';const s=sig(it);return Object.entries(it.e).map(([k,v])=>fe(k,v,Math.abs(v)*s)).join(', ')+(p?' (awaiting flight)':' (estimate)')}
export function can(id){const it=IT(id);if(it.ph==2&&!S.nasa)return'Opens when NASA is established.';if(vehA(it.a)&&!S.cur)return'No rocket programme.';if(vehA(it.a)&&S.progs[S.cur]&&!S.progs[S.cur].ready)return'The programme is still in detailed design.';if(vehA(it.a)&&!isMS(id)&&!inProg(S.cur,id))return'Not part of this rocket programme.';if(done(id))return'Complete.';if(job(j=>j.k=='pk'&&j.id==id&&j.prog==(vehA(it.a)?S.cur:null)))return'In progress.';if(isMS(id)){const l=msLock(it);if(l)return l}else if(!proposed(it))return'Not yet proposed by the engineers.';if(it.need&&!vehA(it.a)&&!t1done(it.a))return'Unlocks after a first milestone in this area.';if(S.b<netCost(it))return`Need ${K(netCost(it)-S.b)} more.`;if(free()<1)return'All teams busy.';return null}
export const commission=id=>{const r=can(id);if(r)return lg(r,'bad');const it=IT(id),nc=netCost(it);if(nc<it.c){lg(`[CONGRESS] Earmarked funds cover ${K(it.c-nc)} of ${it.n}.`,'ok');S.ear[it.a]=0}S.b-=nc;S.jobs.push({k:'pk',id,prog:vehA(it.a)?S.cur:null,t:it.t,tot:it.t});lg(`[DESIGN] Started: ${it.n} (${K(it.c)}).`,'wn')};
// Upgrading a built airframe to the published blueprint: one factory job however many changes it carries.
export function retro(af){return withProg(progOf(af),()=>retro0(af))}
function retro0(af){const ms=S.bp.pk.filter(i=>!af.pk.includes(i)),mf=Object.keys(S.bp.fix).filter(m=>af.fix[m]!=S.bp.fix[m]),n=ms.length+mf.length;if(!n)return null;let c=600;ms.forEach(i=>c+=IT(i).c*.15);mf.forEach(m=>c+=fxOf(m,S.bp.fix[m])[3]*.15);return{n,c:Math.round(c*learn(lineXp())),t:Math.round((6+2*n)*learn(lineXp()))}}
export const draftDiff=()=>({pk:Object.keys(S.pk).filter(i=>!S.bp.pk.includes(i)),fx:Object.keys(S.fix).filter(m=>S.bp.fix[m]!=S.fix[m])});
// Research is proposed gradually: two ideas per area at first, one more each time a package in that area is confirmed. Second-generation ideas follow the same rule after the first milestone.
export function proposed(it){if(isMS(it.id)||done(it.id)||job(j=>j.k=='pk'&&j.id==it.id&&j.prog==(vehA(it.a)?S.cur:null)))return true;if(it.hid)return!!(S.p2&&S.p2.fl&&S.p2.fl[it.hid]);if(vehA(it.a)){const own=itemsOf(it.a);return own.indexOf(own.find(x=>x.id==it.id))<2+cnt(it.a).c}const own=PK.filter(p=>p.a==it.a&&!!p.need==!!it.need&&!p.hid);if(it.need){if(!t1done(it.a))return false;return own.indexOf(it)<1+own.filter(p=>conf(p.id)).length}return own.indexOf(it)<2+cnt(it.a).c}
export function finishJob(j){if(j.k=='dev')return finishDev(j.prog);return withProg(j.prog,()=>finishJob0(j))}
function finishJob0(j){if(j.k=='pk'){const it=IT(j.id),a={},dud=!!it.dud&&Math.random()<it.dud,sg=isMS(j.id)?.1:it.dud?.4:.25;for(const k in it.e)a[k]=it.e[k]*(dud?-.3+.45*Math.random():Math.max(-.25,Math.min(1.8,1+sg*gauss())));S.pk[j.id]={a,c:0,m:null,dud};know(it.a,isMS(j.id)?6:3);lg(`[DESIGN] Complete: ${it.n}. Publish a new blueprint revision to build it into airframes; its real effect is confirmed when one flies.`,'ok');if(isMS(j.id))note(`Milestone: ${it.n}`);if(it.pay){S.b+=it.pay;lg(`[CONTRACT] ${it.n} delivered. Contract payment +${K(it.pay)}.`,'hd')}checkBreak()}
else if(j.k=='inv'){const i=S.inc.find(x=>x.id==j.id);if(!i)return;const t=tiers(),q=Math.min(.7,.1*(t.g+t.v)+(S.crew.tlm?.1:0)),p=Math.min(.97,1/i.cand.length+.5*q+.12*(i.ev-1)+.35*kf(sysOf(i.cand[0]))),dec=i.cand.filter(c=>c!=i.mode);const ok=Math.random()<p||!dec.length;i.dx=ok?i.mode:dec[Math.floor(Math.random()*dec.length)];i.conf=p<.45?'low':p<.75?'moderate':'high';i.st='diag';if(ok)S.known[i.mode]=1;know(sysOf(i.mode),ok?8:3);revealT(S.cur);lg(`[INCIDENT #${i.id}] Engineers conclude ${MODES[i.dx].n.toLowerCase()} (${i.conf} confidence).`,'wn')}
else if(j.k=='rev')finishReview(j.a);
else if(j.k=='fix'){S.fix[j.m]=j.f;know(sysOf(j.m),5);const i=S.inc.find(x=>x.id==j.id);if(i&&i.st=='fixing')i.st='done';lg(`[DESIGN] ${fxOf(j.m,j.f)[1]} is now part of the design. Older airframes need a retrofit.`,'ok')}
else if(j.k=='gt'){confirmPk(j.id,'Test-stand');checkBreak()}
else if(j.k=='retro'){const a=S.air.find(x=>x.id==j.id);if(a){a.pk=Object.keys(S.pk);a.fix={...S.fix};a.st='r';a.label=afLabel(a.prog,a.pk,a.id);lg(`[HANGAR] ${a.label} retrofit complete.`,'ok')}}}

export function ensureStarter(){if(!S.cur){createProgramme('wac');S.cur='wac'}for(const a in AREAS)if(S.bt[a]&&!t1done(a)&&!(a in S.ear))giveEarmark(a);if(!S.air.length&&!S.prod&&!S.aq.length&&!S.sg){S.sg=1;S.air.push(mk({pk:[],fix:{}},3000,'wac'))}}

// Reputation lost to a failure. kind: novel | known | residual | obsolete. The PR specialist halves it.
export function repLoss(kind){const base={novel:3,known:5,residual:2,obsolete:3,bio:6}[kind]||3,f=kind=='bio'?1:.34+.66*Math.min(1,S.dir/4);S.rep=Math.max(0,S.rep-Math.max(1,base*f)*(S.staff.pr?.5:1)*(S.crew.rso&&kind!='bio'?.7:1))}
export const payroll=()=>Math.max(0,(S.bteams||1)-1)*800+(S.p2?(S.p2.astros||[]).filter(a=>a.st=='active'||a.st=='grounded').length*600:0)+Math.max(0,S.teams-2)*1200+(S.staff.pr?1000:0)+(S.staff.director?2500:0)+Object.keys(S.crew).reduce((a,k)=>a+(S.crew[k]&&STN[k]?STN[k].sal:0),0);
export function quoteLaunch(af,fuelName,payName,stage,load=1){if(!af)return{err:'No airframe is ready.'};return withProg(progOf(af),()=>quote0(af,fuelName,payName,stage,load))}
function quote0(af,fuelName,payName,stage,load){if(!PROGS[progOf(af)].fuels.includes(fuelName))return{err:`${PROGS[progOf(af)].n} does not burn ${fuelName}.`};const fu=FUEL[fuelName],py=PAY[payName];if(py.req&&!done(py.req))return{err:`The ${payName} needs ${BY[py.req].n}.`};const sp=spec(af.pk),m=mods(af.fix),stg=stage&&stagingOK(af);const t=fuelCost(af,fuelName,load)+py.c+(stg?8000:0)+pad();if(S.b<t)return{t,err:`Need ${K(t-S.b)} more.`};const pr=PROGS[progOf(af)],half=x=>1+(x-1)*.5,lift=stg?pr.stage.thr*half(sp.thr/pr.thr*sp.t*m.t):sp.thr*sp.t*m.t,mass=sp.dry+sp.d+m.d+sp.f*fu.den*load+py.m+(stg?pr.stage.dry*half(sp.dry/pr.dry)+pr.stage.fuel*half(sp.f/pr.f)*load:0);if(lift<mass*9.81*1.05)return{t,err:'Too heavy to lift off. Lighter payload or a stronger engine needed.'};return{t}}

// Confirm a package's real effect (from a flight or the test stand), then check each area for a breakthrough.
export function confirmPk(id,how='Flight'){const p=S.pk[id];if(!p||p.c)return;p.c=1;if(BY[id])know(BY[id].a,2);p.m={};for(const k in p.a)p.m[k]=p.a[k]*(1+.08*gauss());if(p.dud)lg(`[DEAD END] ${BY[id].n} did not pan out. The engineers learned what NOT to build.`,'bad');lg(`[DESIGN] ${how} data on ${BY[id].n}: ${Object.entries(p.m).map(([k,v])=>fe(k,v)).join(', ')}.`,'cyan')}
export function checkBreak(){for(const a in AREAS){if(vehA(a)&&(!(PR()||{}).ms||!t1opts(a).length))continue;if(!S.bt[a]&&cnt(a).c>=bthP(a)[0]){S.bt[a]=1;giveEarmark(a);lg(`[BREAKTHROUGH] ${AREAS[a]}: the engineers see the pattern. Choose an approach: ${t1opts(a).map(m=>m.n).join(' or ')}.`,'hd')}
const t2=!vehA(a)&&MSL.find(m=>m.a==a&&m.tier==2);if(t2&&!S.bt[a+'2']&&!msLock(t2)){S.bt[a+'2']=1;lg(`[DESIGN] ${AREAS[a]}: ${t2.n} is now feasible.`,'hd')}}
}
// Chance a payload is found intact. Too fast on the way down and it burns up unless the heat protection is good enough.
export function recoveryOdds(sp,ps,dr){if(sp.rc<=0)return{p:0,burn:0,none:1};let p=sp.rc+(S.fac.recov?.2:0)+(S.crew.rec?.15:0)+(S.fac.ship?.05:0);if(dr>80000&&!S.fac.recov&&!S.fac.ship)p-=.2;const burn=ps>sp.rv?Math.min(1,(ps-sp.rv)/sp.rv*2):0;p*=1-burn;return{p:Math.max(0,Math.min(.95,p)),burn}}

// Congress earmarks money for an area's first milestone when its breakthrough lands: 70% of the cheaper approach.
export function giveEarmark(a){const c=Math.min(...t1opts(a).map(m=>m.c));S.ear[a]=Math.round(c*.7/1000)*1000;lg(`[CONGRESS] A special appropriation of ${K(S.ear[a])} is earmarked for the ${AREAS[a].toLowerCase()} programme.`,'hd')}
export const netCost=it=>isMS(it.id)&&it.tier==1&&S.ear&&S.ear[it.a]?Math.max(0,it.c-S.ear[it.a]):it.c;
// Estimated progress toward orbit: directives met, best speed against orbital speed, and the staging and guidance it takes.
export const raceKey=()=>S.nasa?'r_gagarin':'r_sat';
export function progress(){if(S.nasa&&S.p2){const P=S.p2;if(P.secDone)return 1;const tr=Math.max(0,...(P.astros||[]).map(a=>Math.min(1,a.tday/500)));return Math.min(.99,.7*P.dir/6+.15*tr+.15*(done('ms_mrman')?1:0))}if(S.fs.f_orbit=='us'||S.fs.f_orbit=='second')return 1;const gen=Math.max(0,...Object.keys(S.progs).filter(k=>S.progs[k].ready).map(k=>PROGS[k].gen));return Math.min(.99,.45*S.dir/5+.3*Math.min(1,(S.hs||0)/7000)+.25*Math.min(1,gen/4))}

// The Defense Department tops up appropriations when intelligence puts the Soviets ahead: the bigger the gap, the bigger the supplement.
export function sovietGap(){const k=raceKey();if(S.rvd[k]||(S.nasa?S.p2&&S.p2.secDone:S.fs.f_orbit))return 0;const mid=S.nasa?Math.min(1,(S.day-S.nasa)/(S.rv[k]-S.nasa)):Math.min(1,S.day/S.rv[k]);return mid-progress()}
export const dodSupplement=()=>{const g=sovietGap();return g>.05?Math.round(baseGrant()*Math.min(.75,(g-.05)*2.5)):0};
