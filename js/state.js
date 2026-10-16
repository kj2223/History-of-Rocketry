import { RIVAL } from './data.js';
// The one game-state object, saving, and the log hook. No DOM: the UI sets logSink.fn to show log lines.
export const fresh=()=>({b:60000,day:0,rep:100,dir:0,hi:0,pb:0,pk:{},bt:{},jobs:[],teams:2,air:[],aq:[],inc:[],fix:{},known:{},fac:{},nid:1,prod:0,ok:0,fr:{},gt:30,sg:0,hs:0,hd:0,bp:{rev:1,pk:[],fix:{}},line:{xp:0},crew:{},fs:{},rvd:{},rv:Object.fromEntries(RIVAL.map(r=>[r[0],Math.round(r[1]*(.95+Math.random()*.1))])),fsd:{},hist:[],ap:{on:0,n:3},ear:{},dev:{v:1,ps:0,fl:0,ev:[],snap:[]},nasa:0,cv:2,staff:{pr:0,director:0},auto:{on:0,fuel:'Alcohol & LOX',pay:'Inert Ballast',st:0,load:1,cd:15}});
export const S=fresh();
function replaceState(n){for(const k of Object.keys(S))delete S[k];Object.assign(S,n)}
export const resetState=()=>{replaceState(fresh());try{localStorage.removeItem('vg2')}catch(e){}};
export const load=()=>{replaceState(fresh());try{const j=JSON.parse(localStorage.getItem('vg2')||'null');if(j){Object.assign(S,j);if(!j.dev)S.dev={v:1,ps:0,fl:0,ev:[{t:0,d:Math.round(S.day),m:'Run log started part-way through this save.'}],snap:[]};if(!j.bp)S.bp={rev:1,pk:Object.keys(S.pk),fix:{...S.fix}};if(!j.line)S.line={xp:Math.min(3,S.prod||0)};if(!j.cv){const f=fresh();S.day=Math.round(S.day/3);S.rv=f.rv;S.cv=2}}}catch(e){}};
export const save=()=>{try{localStorage.setItem('vg2',JSON.stringify(S))}catch(e){}};
export const logSink={fn:null};
// RUN LOG (development): every notable log line and flight, stamped with play time (ps, seconds of game clock) and game day.
const NOISE=/^(T\+|\[FISCAL\]|\[PAYROLL\]|\[DISPATCH\]|\[ANALYSIS\]|=== |--- )/;
export const devEv=o=>{const D=S.dev;if(!D)return;D.ev.push({t:D.ps,d:Math.round(S.day),...o});if(D.ev.length>5000)D.ev.splice(0,D.ev.length-5000)};
export const lg=(t,c='')=>{if(logSink.fn)logSink.fn(t,c);if(!NOISE.test(t))devEv({m:t})};
export const dateOf=d=>`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Math.floor(d%360/30)%12]} ${1946+Math.floor(d/360)}`,dt=()=>dateOf(S.day);
// Programme history for the end-of-phase summary.
export const note=t=>{S.hist.push({d:S.day,t});if(S.hist.length>80)S.hist.shift()};
export const done=id=>!!S.pk[id],conf=id=>!!(S.pk[id]&&S.pk[id].c),free=()=>S.teams-S.jobs.length,job=f=>S.jobs.find(f);
