// Launch site: base upgrades, control-room level, launch crew, the go/no-go poll and the engine test stand. No DOM.
import { K } from './util.js';
import { FACS, STN, FMSG, ROOMKEYS, BY } from './data.js';
import { S, lg, conf, free, note, dateOf } from './state.js';
import { pad } from './design.js';
import { kf, sysOf } from './knowledge.js';
import { withProg } from './state.js';
import { progOf, traitsOf, TR } from './programs.js';
export const room=()=>ROOMKEYS.filter(k=>S.fac[k]).length;
export const slots=()=>3+Object.keys(FACS).reduce((a,k)=>a+(S.fac[k]?FACS[k][5]:0),0);
export const crewList=()=>['tc',...Object.keys(STN).filter(k=>k!='tc'&&S.crew[k])];
export function baseLock(id){const f=FACS[id];if(!f)return'Unknown.';if(S.fac[id])return'Built.';if(S.fb&&S.fb[id])return`Under construction: in service around ${dateOf(S.fb[id])}.`;if(f[7]&&!S.nasa)return'Opens when NASA is established.';if(f[3]&&!S.fac[f[3]])return`Requires ${FACS[f[3]][0]}.`;if(S.dir<f[4])return`Available from directive ${f[4]+1}.`;if(S.b<f[1])return`Need ${K(f[1]-S.b)} more.`;return null}
export function buildFacility(id){if(baseLock(id))return;const f=FACS[id];S.b-=f[1];if(f[8]){S.fb=S.fb||{};S.fb[id]=Math.round(S.day+f[8]);lg(`[BASE] Construction begins: ${f[0]}. In service around ${dateOf(S.fb[id])}.`,'wn');return}S.fac[id]=1;if(f[6])note(`Control room: ${f[0]}`);lg(`[BASE] ${f[0]} operational.`,'ok')}
export function stnLock(id){const s=STN[id];if(!s||id=='tc')return'Always on console.';if(S.crew[id])return'On console.';if(s.ph==2&&!S.nasa)return'Opens when NASA is established.';if(s.req&&!S.fac[s.req])return`Needs ${FACS[s.req][0]}.`;if(crewList().length>=slots())return'No free console. Expand the control room.';if(S.b<s.c)return`Need ${K(s.c-S.b)} more.`;return null}
export function hireStation(id){if(stnLock(id))return;const s=STN[id];S.b-=s.c;S.crew[id]=1;lg(`[LAUNCH CREW] ${s.n} takes the ${s.s} console.`,'ok')}
export function dismissStation(id){if(S.crew[id]){S.crew[id]=0;lg(`[LAUNCH CREW] ${STN[id].n} released from the ${STN[id].s} console.`,'wn')}}
export const scrubCost=()=>Math.round(1500+pad()*.3);
const cap=s=>s[0].toUpperCase()+s.slice(1)+'.';
// Each countdown may hide one latent fault. Staffed stations whose domain covers it may catch it; any station may raise a false alarm.
export function poll(af,fuel,stage){return withProg(progOf(af),()=>poll0(af,fuel,stage))}
function poll0(af,fuel,stage){const unp=af.pk.filter(i=>!conf(i)).length,pL=Math.min(.55,.12+.04*unp+(stage?.08:0)+((S.fr[fuel]||0)<3?.06:0))*(1-.35*(kf('p')+kf('s')+kf('a'))/3),pool='ccpiivvsshf'+(stage?'xx':'')+traitsOf(progOf(af)).filter(t=>TR(t.k).m&&!af.fix[TR(t.k).m]).map(t=>TR(t.k).m.repeat(4)).join(''),
fault=Math.random()<pL?pool[Math.floor(Math.random()*pool.length)]:null,wr=Math.random(),wind=wr<.6?0:wr<.9?1:2,wk=!!S.fac.wx,bonus=S.crew.fd?.15:0,lines=[];let det=false;
for(const id of crewList()){const st=STN[id];let go=true,msg='',real=false,issue='';
if(id=='tc'){msg=wk?`Range forecast: ${['calm','gusty','high'][wind]} winds.`:'No weather forecast on the range.';if(fault&&Math.random()<.12+.15*kf(sysOf(fault))){go=false;det=true;real=true;issue=FMSG[fault];msg=`Walkdown finds a problem: ${issue}.`}}
else if(fault&&!det&&st.dm.includes(fault)&&Math.random()<.5+bonus+.3*kf(sysOf(fault))){go=false;det=true;real=true;issue=FMSG[fault];msg=cap(issue)}
else if(id=='rso'&&wk&&wind==2){go=false;msg='Winds aloft exceed range limits.'}
else if(st.dm&&Math.random()<(S.crew.fd?.015:.03)){go=false;issue=FMSG[st.dm[Math.floor(Math.random()*st.dm.length)]];msg=cap(issue)}
lines.push({id,go,msg,orig:msg,issue,real,wind:id=='rso'&&!go&&!real&&msg.startsWith('Winds')})}
return{lines,fault,det,wind,wk,nogo:lines.some(l=>!l.go),af:af.id}}
export function scrub(P){const c=Math.min(S.b,scrubCost());S.b-=c;S.day+=2;const l=P.lines.find(x=>!x.go);lg(`[SCRUB] Launch scrubbed${l?` (${STN[l.id].s}: ${l.msg})`:''} Turnaround ${K(c)}.`,'wn')}
// Ground tests confirm a package without flying it: propulsion on the test stand, spacecraft systems by qualification tests (drop tests, altitude chambers, sled runs).
export const qualArea=a=>a=='c'||a=='e';
export function groundTestLock(id){const p=S.pk[id],a=BY[id].a;if(!qualArea(a)&&!S.fac.stand)return'Needs the Static Engine Test Stand.';if(!p)return'Not built yet.';if(p.c)return'Already confirmed.';if(a!='p'&&!qualArea(a))return'Only propulsion and spacecraft work can be ground tested.';if(S.jobs.find(j=>j.k=='gt'&&j.id==id))return'Test under way.';if(S.b<(qualArea(a)?4000:2000))return`Need ${K((qualArea(a)?4000:2000)-S.b)} more.`;if(free()<1)return'All teams busy.';return null}
export function groundTest(id){if(groundTestLock(id))return;const q=qualArea(BY[id].a);S.b-=q?4000:2000;S.jobs.push({k:'gt',id,t:q?110:30,tot:q?110:30});lg(q?`[QUALIFICATION] Ground tests scheduled for ${BY[id].n} ($4,000).`:`[TEST STAND] Static firing scheduled for ${BY[id].n} ($2,000).`,'wn')}

// A NO-GO can be worked on the pad: a team tries to fix the reported problem (it may not work), or the range holds for better weather.
export const fixCost=()=>800;
export const fixOdds=P=>Math.max(.3,Math.min(.9,.55+(S.crew.fd?.15:0)+(S.fac.comp?.05:0)-.1*((P.tries||0))));
export function troubleshoot(P){const l=P.lines.find(x=>!x.go);if(!l||S.b<fixCost())return;S.b-=fixCost();S.day+=1;
if(l.id=='rso'&&l.wind){const wr=Math.random(),w=wr<.6?0:wr<.9?1:2;P.wind=w;if(w<2){l.go=true;l.msg=`Held for weather. Winds now ${['calm','gusty'][w]}.`}else l.msg='Held for weather. Winds still above limits.';lg(`[RANGE] Weather hold: winds ${['calm','gusty','high'][w]}.`,'wn')}
else{const ok=Math.random()<fixOdds(P);P.tries=(P.tries||0)+1;if(ok){l.go=true;l.msg=`Fixed on the pad: ${l.issue}.`;if(l.real)P.fault=null;lg(`[PAD] ${STN[l.id].s} reports the problem fixed.`,'ok')}else{l.msg=`${l.orig} Fix attempt failed.`;lg(`[PAD] ${STN[l.id].s}: fix attempt failed.`,'bad')}}
P.nogo=P.lines.some(x=>!x.go)}

// Facilities with a construction time come on line when their date arrives.
export function constructionTick(){if(!S.fb)return false;let ch=false;for(const id in S.fb)if(S.day>=S.fb[id]){delete S.fb[id];S.fac[id]=1;lg(`[BASE] ${FACS[id][0]} is in service.`,'hd');ch=true}return ch}
