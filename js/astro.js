// ASTRONAUT OFFICE: a fictional candidate pool, selection, training and crew status. No DOM.
// Skills run 0-100. The player sees an estimate with a range; the range narrows as training reveals the person.
import { gauss } from './util.js';
import { S, lg, note } from './state.js';
import { scheduleOffice } from './mercury.js';

const FIRST=['Walter','Donald','Robert','James','Richard','Thomas','Frank','Edward','Charles','William','George','Harold','Raymond','Kenneth','Paul','Henry','Arthur','Eugene','Lawrence','Martin','Russell','Vernon','Glen','Howard','Lloyd','Dale','Curtis','Warren'];
const LAST=['Hartley','Brennan','Calloway','Doyle','Whitfield','Marsh','Kessler','Lund','Avery','Garrity','Holloway','Pruitt','Sorensen','Talbot','Wyatt','Ferris','McAllister','Rourke','Stanton','Tremaine','Voss','Ingram','Brandt','Ashby','Corwin','Dunlap','Ellery','Fenwick','Hollis','Kearney','Lathrop','Mercer','Nyland','Oakes','Pendry','Quist','Rowell','Sayer','Tolliver','Winslow'];
const SERV=['US Navy','US Marine Corps','US Air Force'];
const DEGREE=['Aeronautical Engineering','Mechanical Engineering','Electrical Engineering','Mathematics','Physics','Military Science'];
export const SKILLS={pil:'Piloting',sys:'Systems',end:'Endurance',com:'Composure'};
export const FOCUS={bal:'Balanced',phys:'Physical (centrifuge, zero-g)',sim:'Simulator',egr:'Egress and survival',msn:'Mission training',rest:'Rest'};
export const QUAL_DAYS=500; // general training before an astronaut can be assigned to fly
const pick=a=>a[Math.floor(Math.random()*a.length)],cl=v=>Math.max(15,Math.min(92,Math.round(v)));

function candidate(id){const svc=pick(SERV),hrs=Math.round(1200+Math.random()*2400),tps=Math.random()<.7,deg=pick(DEGREE),age=32+Math.floor(Math.random()*8);
const t={pil:cl(42+(hrs-1500)/70+(tps?7:0)+gauss()*9),sys:cl(46+(/Engineering|Physics|Math/.test(deg)?9:0)+gauss()*11),end:cl(52+(39-age)*.8+gauss()*11),com:cl(52+gauss()*12)};
const bias=Object.fromEntries(Object.keys(SKILLS).map(k=>[k,gauss()]));
return{id,name:`${pick(FIRST)} ${pick(LAST)}`,svc,hrs,tps,deg,age,t,bias,med:Math.random()<.15?1:0,kn:0,tday:0,reh:{},focus:'bal',st:'pool',gd:0,fat:0,flights:0,mt:0,asg:null}}
export function makePool(n=16){const used=new Set(),out=[];let id=1;while(out.length<n){const c=candidate(id),sn=c.name.split(' ')[1];if(used.has(sn))continue;used.add(sn);out.push(c);id++}return out}

// What the office believes: the estimate drifts toward the truth and the range shrinks with training days.
export const width=a=>Math.round(24/(1+(a.tday+(a.kn||0))/150)); // training days and pre-selection testing both reveal the person
export const est=(a,k)=>{const w=width(a);return{v:Math.max(0,Math.min(100,Math.round(a.t[k]+a.bias[k]*w*.5))),w}};
export const active=()=>(S.p2&&S.p2.astros||[]).filter(a=>a.st=='active'||a.st=='grounded');
export const byId=id=>(S.p2.astros||[]).find(a=>a.id==id);
export const qualified=a=>a.st=='active'&&a.tday>=QUAL_DAYS;

export function selectCrew(ids){const P=S.p2;if(P.selDone||(P.sel&&P.sel.st!=3)||ids.length<3||ids.length>7)return false;if(P.pool.some(a=>ids.includes(a.id)&&a.dq))return false;for(const a of P.pool)if(ids.includes(a.id)){a.st='active';P.astros.push(a)}P.pool=[];P.selDone=1;if(P.sel)P.sel.st=4;
note(`Astronaut group selected (${ids.length})`);lg(`[ASTRONAUT OFFICE] ${ids.length} astronauts selected: ${P.astros.map(a=>a.name).join(', ')}. Training begins.`,'hd');
S.rep=Math.min(100,S.rep+4);lg('[PRESS] NASA introduces its astronauts at a crowded press conference in Washington. Overnight they are famous.','ok');scheduleOffice();return true}

// Training for dd days. Rates scale with facilities; simulator fidelity decides how much a session is worth.
export const simTier=()=>S.fac.msim?2:S.fac.ptrain?1:0;
const REH=['att','ecs','tj','abort','retro','hatch'];
export function trainTick(dd){const P=S.p2;if(!P||!P.selDone)return;const sm=[.35,.7,1][simTier()],cf=S.fac.centrifuge?1:.4,zg=S.fac.zerog?1:.4,eg=S.fac.egress?1:.35;
for(const a of P.astros){if(a.st=='grounded'){a.gd-=dd;a.fat=Math.max(0,a.fat-dd*.4);if(a.gd<=0){a.st='active';lg(`[FLIGHT SURGEON] ${a.name} is returned to flight status.`,'ok')}continue}
if(a.st!='active')continue;const f=a.focus,g=(k,r)=>{a.t[k]=Math.min(95,a.t[k]+r*dd*(1-a.t[k]/100)*(a.fat>60?.5:1))};
if(f=='rest'){a.fat=Math.max(0,a.fat-dd*.6);a.tday+=dd*.2;continue}
a.tday+=dd;a.fat=Math.min(100,a.fat+dd*.05);
const w=f=='bal'?.5:1;
if(f=='phys'||f=='bal'){g('end',.05*cf*w);g('com',.02*zg*w)}
if(f=='sim'||f=='bal'){g('sys',.045*sm*w);g('pil',.04*sm*w);g('com',.015*sm*w);if(Math.random()<.006*dd*simTier()*w){const e=pick(REH);if(!a.reh[e]){a.reh[e]=1;lg(`[SIMULATOR] ${a.name} has rehearsed a ${({att:'attitude-control failure',ecs:'cabin cooling failure',tj:'tower jettison failure',abort:'launch abort',retro:'retrofire failure',hatch:'emergency egress'})[e]}.`,'cyan')}}}
if(f=='egr'){g('end',.02*eg);a.reh.hatch=a.reh.hatch||(Math.random()<.01*dd*eg?1:0)}
if(f=='msn'&&a.asg){a.mt=Math.min(1,a.mt+dd/110*(.5+.5*sm));g('sys',.02*sm);g('pil',.02*sm)}
if(a.med&&Math.random()<.0025*dd){a.st='medical';a.asg=null;a.mt=0;lg(`[FLIGHT SURGEON] A heart irregularity missed in selection has been found in ${a.name}. Permanently grounded from flight; ${a.name.split(' ')[0]} stays on in the Astronaut Office.`,'bad');continue}
if(Math.random()<.00012*dd*(1+a.fat/50)){a.st='grounded';a.gd=60+Math.random()*180;lg(`[FLIGHT SURGEON] ${a.name} is grounded for about ${Math.round(a.gd/30)} months after a medical finding.`,'wn');if(a.asg){a.asg=null;a.mt=0}}}}
export function setFocus(id,f){const a=byId(id);if(a&&FOCUS[f])a.focus=f}
export function assign(id,m){const a=byId(id);if(!a||!qualified(a))return;for(const b of S.p2.astros)if(b.asg==m){b.asg=null;b.mt=0}a.asg=m;a.mt=0;a.focus='msn';lg(`[ASTRONAUT OFFICE] ${a.name} is assigned as pilot for the next ${m=='mr'?'Mercury-Redstone':m} flight. Mission training begins.`,'ok')}
export const assigned=m=>(S.p2.astros||[]).find(a=>a.asg==m&&a.st=='active');
