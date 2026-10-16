// ROCKET PROGRAMMES: the ladder of real American rockets, each a new design with uncertain performance and hidden flaws. No DOM.
// A programme's true performance sits somewhere inside a window; flights, tests and research narrow it. Traits are flaws rolled
// when the programme starts: they raise one failure mode (or cost performance) until found and cured.
import { K, gauss } from './util.js';
import { PK, BY, MODES } from './data.js';
import { S, lg, note, bundle, withProg, devEv } from './state.js';

// stats: dry mass (kg), propellant capacity f (kg of alcohol-equivalent), thrust (N), structural g-limit, heat tolerance h,
// aero load limit q, drag c, reliability offset r, instrument tier i. stage: a booster stage under the core (staged programmes).
// sz scales packages that add kilograms; cm and tm scale research cost and time. pkN: packages per area. lr: how fast it is learned.
export const PROGS={
wac:{n:'WAC Corporal',yr:1946,gen:0,uc:3000,ut:10,dry:40,f:12,thr:2500,g:6,h:.5,q:1,c:1,r:0,i:0,sz:1,cm:1,tm:1,pkN:3,lr:5,tr:[2,2],fuels:['Alcohol & LOX'],
 contract:20000,why:'A slim liquid-fuelled sounding rocket boosted off the pad by a solid kicker. Small, cheap and simple: the place to learn.'},
aerobee:{n:'Aerobee',yr:1947,gen:1,uc:6000,ut:14,req:['wac'],dry:70,f:55,thr:4200,g:7,h:.6,q:1.1,c:.95,r:.01,i:.4,sz:2,cm:1.3,tm:1,pkN:4,lr:4.5,tr:[2,3],fuels:['Alcohol & LOX'],cost:25000,dev:30,
 contract:30000,why:'A bigger, workhorse sounding rocket for the upper atmosphere. More capacity, and more ways to go wrong.'},
viking:{n:'Viking',yr:1949,gen:2,uc:12000,ut:20,req:['aerobee'],dry:150,f:150,thr:8500,g:8,h:.8,q:1.3,c:.9,r:.02,i:.9,sz:4,cm:1.7,tm:1,pkN:5,lr:4,tr:[2,3],fuels:['Alcohol & LOX'],cost:45000,dev:40,ms:1,
 contract:45000,why:'A research rocket with a gimballed engine and real telemetry. The first American design meant to fly far above the weather.'},
redstone:{n:'Redstone',yr:1953,gen:3,uc:24000,ut:28,req:['viking'],dry:420,f:560,thr:26000,g:8,h:.9,q:1.5,c:.9,r:.05,i:1.3,sz:8,cm:2.2,tm:1.05,pkN:5,lr:4,tr:[2,3],fuels:['Alcohol & LOX'],cost:80000,dev:50,ms:1,
 contract:90000,why:'A heavy, conservative Army ballistic missile. Short ranged but dependable: the kind of rocket you would trust with a man.'},
vanguard:{n:'Vanguard',yr:1955,gen:4,uc:30000,ut:34,req:['viking'],dry:110,f:165,thr:9000,g:8,h:1.8,q:1.6,c:.85,r:-.04,i:1.8,sz:3,cm:2.4,tm:0.9,pkN:6,lr:4,tr:[3,3],fuels:['Kerosene & LOX','Alcohol & LOX'],cost:110000,dev:60,ms:1,sat:1,fund:100000,
 stage:{dry:1000,fuel:9000,thr:170000,isp:265},why:'An all-new three-stage satellite launcher from the Navy\'s Viking team. Light and efficient on paper, but every stage is new.'},
jupc:{n:'Jupiter-C',yr:1956,gen:4,uc:28000,ut:32,req:['redstone'],from:'redstone',dry:90,f:270,thr:10500,g:10.5,h:1.8,q:1.7,c:.85,r:-.01,i:1.6,sz:3,cm:2.2,tm:0.9,pkN:5,lr:4,tr:[2,2],fuels:['Alcohol & LOX'],cost:90000,dev:50,ms:1,sat:1,
 stage:{dry:1100,fuel:10500,thr:200000,isp:262},why:'An elongated Redstone carrying clusters of small solid rockets. Built from parts the Army already trusts.'},
atlas:{n:'Atlas',yr:1958,gen:5,uc:60000,ut:48,req:['vanguard','jupc'],any:1,nasa:1,dry:300,f:600,thr:20000,g:8,h:2.8,q:1.8,c:.8,r:-.05,i:2.2,sz:6,cm:3,tm:1.2,pkN:6,lr:3,tr:[3,3],fuels:['Kerosene & LOX'],cost:200000,dev:75,ms:1,sat:1,
 stage:{dry:1900,fuel:15000,thr:250000,isp:280},why:'An intercontinental missile with steel-balloon tanks thin as a coin. Enough power to put a man in orbit, if it can be tamed.'}};
export const ORDER=['wac','aerobee','viking','redstone','vanguard','jupc','atlas'];
export const MATURE=45; // programme maturity (average team knowledge of the rocket) that opens the next programme

// Flaws a new rocket can be born with. m: the failure mode it feeds (weight w until cured by a fix). st: a performance penalty (fraction).
export const TRAITS=[
{k:'rough',n:'Rough combustion',m:'c',w:3,why:'The injector and chamber resonate under load.'},
{k:'pump',n:'Marginal turbopump',m:'p',w:3,why:'The pump runs close to cavitation at full thrust.'},
{k:'start',n:'Hard-starting engine',m:'i',w:3,why:'Ignition is violent and inconsistent.'},
{k:'leak',n:'Leak-prone plumbing',m:'v',w:3,why:'Valves and lines weep under pressure.'},
{k:'thin',n:'Thin tank walls',m:'s',w:3,st:{g:-.15},why:'The tanks buckle under the loads the engine can deliver.'},
{k:'sep',n:'Unreliable separation',m:'x',w:4,stg:1,why:'Stages hang up or tumble at separation.'},
{k:'soak',n:'Heat-soaked skin',m:'h',w:3,st:{h:-.15},why:'The skin heats faster than the drawings predicted.'},
{k:'flut',n:'Flutter-prone fins',m:'f',w:3,st:{q:-.15},why:'The fins start to flutter well below their design load.'},
{k:'heavy',n:'Overweight structure',st:{dry:.15},why:'The airframe came out heavier than the drawings.'},
{k:'weak',n:'Engine short of rated thrust',st:{thr:-.08},why:'The engine never quite delivers its rated thrust.'}];
export const TR=k=>TRAITS.find(t=>t.k==k);
// Which knowledge area reveals each stat, and how wide the window starts (fraction of the value, either side).
export const STATS=[['thr','Thrust','p',.25],['dry','Dry mass','s',.2],['f','Propellant capacity','s',.15],['g','Structural limit','s',.2],['h','Heat tolerance','a',.25],['q','Aero load limit','a',.25],['r','Reliability','p',.06]];

// Each programme researches a slice of the package catalogue: later rockets get later work, scaled to their size.
const AREA_LISTS={};export const VEH=['p','s','i','a'];
for(const a of VEH)AREA_LISTS[a]=PK.filter(x=>x.a==a&&!x.ph);
export function progPkgs(kind,a){const pr=PROGS[kind],L=AREA_LISTS[a]||[],n=Math.min(pr.pkN,L.length),start=Math.min(pr.gen*2,Math.max(0,L.length-n));return L.slice(start,start+n)}
export const inProg=(kind,id)=>{const it=BY[id];return!!it&&VEH.includes(it.a)&&!!progPkgs(kind,it.a).find(x=>x.id==id)};
// A package as this programme sees it: cost and time scaled, kilogram effects scaled to the rocket's size.
export function scaled(it,kind){const pr=PROGS[kind];if(!pr||!VEH.includes(it.a)&&it.tier!=1)return it;const e={};for(const k in it.e)e[k]=(k=='f'||k=='d')?Math.round(it.e[k]*pr.sz*10)/10:it.e[k];
return{...it,c:Math.round(it.c*pr.cm/100)*100,t:Math.round(it.t*pr.tm*.7),e}}

// A programme's true design, rolled when it starts: the nominal figures, a deviation inside the window, and its traits.
export function rollProgramme(kind){const pr=PROGS[kind],T={c:pr.c,i:pr.i},bias={},ntr=pr.tr[0]+Math.floor(Math.random()*(pr.tr[1]-pr.tr[0]+1));
// Satellite launchers are rolled within a narrower spread: their flaws are in reliability, not in whether orbit is possible at all.
const wm=pr.sat?.45:1;for(const [k,,,w] of STATS){const dev=Math.max(-1,Math.min(1,gauss()*.45));T[k]=k=='r'?pr.r+dev*w:pr[k]*(1+dev*w*wm);bias[k]=Math.max(-1.5,Math.min(1.5,gauss()))}
const pool=TRAITS.filter(t=>!t.stg||pr.stage),traits=[];while(traits.length<ntr&&pool.length){const t=pool.splice(Math.floor(Math.random()*pool.length),1)[0];traits.push({k:t.k,found:0});if(t.st)for(const s in t.st)T[s]*=1+t.st[s]}
return{T,bias,traits}}
// Start a programme: a fresh bundle, the rolled design, and a head start in knowledge from the rockets already flown.
export function createProgramme(kind){const pr=PROGS[kind],b=bundle(),r=rollProgramme(kind);Object.assign(b,{kind,start:Math.round(S.day),...r,ready:pr.dev?0:1});
const prev=Object.values(S.progs);for(const a of VEH){const best=Math.max(0,...prev.map(p=>p.kn[a]||0)),src=pr.from&&S.progs[pr.from]?S.progs[pr.from].kn[a]||0:0;b.kn[a]=Math.max(best*.45,src*.6)}
S.progs[kind]=b;return b}
export const progOf=af=>af&&af.prog||S.cur;
export const PR=(kind=S.cur)=>PROGS[kind];
// Programme maturity: the team's average knowledge of the rocket's four systems.
export const maturity=kind=>{const b=S.progs[kind];if(!b)return 0;return VEH.reduce((a,k)=>a+(b.kn[k]||0),0)/VEH.length};
// Which programmes can be proposed now: all prerequisites (or any one, for 'any') mature, NASA where needed.
export function nextLock(kind){const pr=PROGS[kind];if(S.progs[kind])return'Already started.';if(pr.nasa&&!S.nasa)return'Needs NASA.';const ok=r=>S.progs[r]&&maturity(r)>=MATURE;
const met=pr.any?pr.req.some(ok):pr.req.every(ok);if(!met)return`Needs ${pr.req.map(r=>PROGS[r].n).join(pr.any?' or ':' and ')} to reach maturity ${MATURE}.`;if(S.b<pr.cost)return`Need ${K(pr.cost-S.b)} more.`;return null}
export const candidates=()=>ORDER.filter(k=>!S.progs[k]&&PROGS[k].req&&(PROGS[k].any?PROGS[k].req.some(r=>S.progs[r]):PROGS[k].req.every(r=>S.progs[r])));
export function startProgramme(kind){if(nextLock(kind))return false;const pr=PROGS[kind];S.b-=pr.cost;createProgramme(kind);S.jobs.push({k:'dev',prog:kind,id:kind,t:pr.dev,tot:pr.dev,free:1});
lg(`[PROGRAMME] ${pr.n} programme approved (${K(pr.cost)}). Engineers begin the detailed design; the first drawings are ready in about ${pr.dev}s.`,'hd');if(pr.fund){S.b+=pr.fund;lg(`[CONGRESS] ${pr.n} is named the American satellite for the International Geophysical Year. A dedicated appropriation of ${K(pr.fund)} comes with it.`,'hd')}note(`${pr.n} programme started`);devEv({k:'prog',id:kind});return true}
export function finishDev(kind){const b=S.progs[kind];if(!b)return;b.ready=1;S.cur=kind;lg(`[PROGRAMME] ${PROGS[kind].n}: the drawings are released. Order airframes in Hangar & Base; its true performance is still to be learned.`,'hd')}
// Trait bookkeeping: found when its failure mode is diagnosed or a review flags it; stat traits surface once the team knows the system well.
export const traitsOf=kind=>(S.progs[kind]||{}).traits||[];
export function revealTraits(kind,why){const b=S.progs[kind];if(!b)return;for(const t of b.traits){if(t.found)continue;const d=TR(t.k);let hit=false;if(d.m&&b.known[d.m])hit=true;
if(!d.m){const st=Object.keys(d.st)[0],area=STATS.find(s=>s[0]==st)[2];if((b.kn[area]||0)>=40)hit=true}
if(hit){t.found=1;lg(`[ENGINEERING] ${PROGS[kind].n}: ${d.n.toLowerCase()}. ${d.why}${d.m?' A fix for it cures the flaw.':''}`,'wn')}}}
export const traitWeight=(kind,m,af)=>{const t=traitsOf(kind).find(x=>TR(x.k).m==m);return t&&!(af&&af.fix&&af.fix[m])?TR(t.k).w:1};
// The window the team believes for a stat: centred near the truth (an early bias that fades) and narrowing with knowledge.
export function window(kind,stat){const b=S.progs[kind],s=STATS.find(x=>x[0]==stat);if(!b||!s)return null;const v=b.T[stat],kf=(b.kn[s[2]]||0)/100,w=s[3]*(1-.88*kf),
half=stat=='r'?w:Math.abs(v)*w,mid=v+b.bias[stat]*half*.5;return{lo:mid-half,hi:mid+half,mid,true:v}}
