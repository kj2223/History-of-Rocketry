import { RIVAL, BY } from './data.js';
// The one game-state object, saving, and the log hook. No DOM: the UI sets logSink.fn to show log lines.
// Soviet dates vary run to run: about 5% early in the period, but no more than six weeks either way once the race is close.
export const jitter=d=>Math.round(d+(Math.random()*2-1)*Math.min(d*.05,d>4590?45:1e9));
// ROCKET PROGRAMMES: each rocket keeps its own research, blueprint, fixes, incidents, knowledge, production line and man-rating.
// Payload & recovery work and the Mercury spacecraft are not part of any rocket: they live in the global bundle S.g.
export const GLOB=['r','c','e'];
export const bundle=()=>({pk:{},bt:{},fix:{},inc:[],known:{},kn:{},ear:{},bp:{rev:1,pk:[],fix:{}},line:{xp:0},mrate:null});
export const fresh=()=>({b:60000,day:0,rep:100,dir:0,hi:0,pb:0,progs:{},cur:null,g:bundle(),jobs:[],teams:2,air:[],aq:[],fac:{},nid:1,prod:0,ok:0,fr:{},gt:30,sg:0,hs:0,hd:0,crew:{},fs:{},rvd:{},rv:Object.fromEntries(RIVAL.map(r=>[r[0],jitter(r[1])])),fsd:{},hist:[],speed:1,ap:{on:0,n:3},dev:{v:1,ps:0,fl:0,ev:[],snap:[]},nasa:0,cv:3,staff:{pr:0,director:0},auto:{on:0,fuel:'Alcohol & LOX',pay:'Inert Ballast',st:0,load:1,cd:15}});
export const S=fresh();
// The programme in focus. Everything that reads S.pk, S.bp, S.fix and so on sees this programme's bundle.
export const P=()=>S.progs[S.cur]||S.g;
// Run fn with another programme in focus (a flight of an older rocket, a job started under another programme).
export function withProg(id,fn){if(!id||id==S.cur||!S.progs[id])return fn();const prev=S.cur;S.cur=id;try{return fn()}finally{S.cur=prev}}
// Keys that split between the programme and the global bundle: research areas r, c and e (and their tier-2 flags) are global.
const gKey=k=>typeof k=='string'&&GLOB.includes(k[0])&&(k.length==1||k[1]=='2');
const gPk=k=>typeof k=='string'&&BY[k]&&GLOB.includes(BY[k].a);
function split(name,isG){const side=k=>isG(k)?S.g[name]:P()[name];return new Proxy({},{get:(t,k)=>typeof k=='symbol'?undefined:side(k)[k],set:(t,k,v)=>{side(k)[k]=v;return true},has:(t,k)=>k in side(k),deleteProperty:(t,k)=>{delete side(k)[k];return true},
ownKeys:()=>[...new Set([...Object.keys(P()[name]),...(P()==S.g?[]:Object.keys(S.g[name]))])],getOwnPropertyDescriptor:(t,k)=>{const s=side(k);return k in s?{value:s[k],enumerable:true,configurable:true,writable:true}:undefined}})}
const SPLIT={pk:split('pk',gPk),bt:split('bt',gKey),kn:split('kn',gKey),ear:split('ear',gKey)};
for(const k in SPLIT)Object.defineProperty(S,k,{get:()=>SPLIT[k],set:()=>{},enumerable:false,configurable:true});
for(const k of ['bp','fix','inc','known','line','mrate'])Object.defineProperty(S,k,{get:()=>P()[k],set:v=>{P()[k]=v},enumerable:false,configurable:true});
function replaceState(n){for(const k of Object.keys(S))delete S[k];Object.assign(S,n)}
const KEY='vg3';
export const resetState=()=>{replaceState(fresh());try{localStorage.removeItem(KEY)}catch(e){}};
export const load=()=>{replaceState(fresh());try{const j=JSON.parse(localStorage.getItem(KEY)||'null');if(j&&j.cv>=3){Object.assign(S,j);if(!j.dev)S.dev={v:1,ps:0,fl:0,ev:[],snap:[]};for(const r of RIVAL)if(!(r[0] in S.rv))S.rv[r[0]]=jitter(r[1])}}catch(e){}};
export const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
export const logSink={fn:null};
// RUN LOG (development): every notable log line and flight, stamped with play time (ps, seconds of game clock) and game day.
const NOISE=/^(T\+|\[FISCAL\]|\[PAYROLL\]|\[DISPATCH\]|\[ANALYSIS\]|=== |--- )/;
export const devEv=o=>{const D=S.dev;if(!D)return;D.ev.push({t:D.ps,d:Math.round(S.day),...o});if(D.ev.length>5000)D.ev.splice(0,D.ev.length-5000)};
export const lg=(t,c='')=>{if(logSink.fn)logSink.fn(t,c);if(S.speed>1&&(c=='hd'||/^\[WIRE\]/.test(t)))S.speed=1;if(!NOISE.test(t))devEv({m:t})};
export const dateOf=d=>`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Math.floor(d%360/30)%12]} ${1946+Math.floor(d/360)}`,dt=()=>dateOf(S.day);
// Programme history for the end-of-phase summary.
export const note=t=>{S.hist.push({d:S.day,t});if(S.hist.length>80)S.hist.shift()};
export const done=id=>!!S.pk[id],conf=id=>!!(S.pk[id]&&S.pk[id].c),free=()=>S.teams-S.jobs.filter(j=>!j.free).length,job=f=>S.jobs.find(f);
