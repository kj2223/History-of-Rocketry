// The race: historical firsts and the Soviet programme's timeline. No DOM.
import { K } from './util.js';
import { FIRSTS, RIVAL, NASA_DAY } from './data.js';
import { S, lg, dateOf, note } from './state.js';
// Soviet events land on their (jittered) dates. A first they reach before you is lost: matching it later pays 40% and less reputation.
export function rivalTick(){let ch=false;for(const[k,,msg]of RIVAL){if(S.rvd[k]||S.day<S.rv[k])continue;S.rvd[k]=1;ch=true;const f=FIRSTS.find(x=>x[5]==k);
if(f&&S.fs[f[0]]){lg(`[WIRE] ${msg} The United States got there first.`,'wn');continue}
if(f)S.fs[f[0]]='them';note(`Soviet: ${msg.split('.')[0]}`);lg(`[WIRE] ${msg}`,'bad');
if(k=='r_sat'){S.rep=Math.max(0,S.rep-8);lg('[PRESS] Panic in Washington. Congress opens the purse: appropriations +30% until America answers.','nar')}
else if(k=='r_icbm'){S.rep=Math.max(0,S.rep-3);lg('[PRESS] The missile gap dominates the news. Appropriations +10% from now on.','nar')}
else if(f){S.rep=Math.max(0,S.rep-3);lg(`[PRESS] Another Soviet first. Matching it now will earn less.`,'nar')}}
return ch}
export function checkFirsts(c){for(const[id,n,cash,rep,test]of FIRSTS){if(S.fs[id]=='us'||S.fs[id]=='second'||!test(c))continue;const lost=S.fs[id]=='them',m=lost?.4:1;S.fs[id]=lost?'second':'us';S.fsd[id]=S.day;note(lost?`Matched the Soviets: ${n.replace(/^First /,'')}`:`First: ${n.replace(/^First /,'')}`);
if(cash)S.b+=Math.round(cash*m);S.rep=Math.min(100,S.rep+(lost?Math.ceil(rep/3):rep));
lg(lost?`[PRESS] America answers the Soviets: ${n.replace(/^First /,'').toLowerCase()}.${cash?` Bonus +${K(cash*m)}.`:''}`:`[HISTORIC FIRST] ${n}!${cash?` Bonus +${K(cash)}, reputation +${rep}.`:''}`,'hd')}}
// What intelligence says about the next Soviet event: a date window that is honest about its uncertainty.
export function intel(){const nx=RIVAL.find(r=>!S.rvd[r[0]]);if(!nx)return null;const d=S.rv[nx[0]],w=Math.round(d*.08);return{what:nx[3],lo:dateOf(Math.max(S.day,d-w)),hi:dateOf(d+w)}}

// NASA: offered once you reach orbit, or from October 1958 whatever your progress. Establishing it closes Phase One.
export const nasaReady=()=>!S.nasa&&(S.fs.f_orbit=='us'||S.fs.f_orbit=='second'||S.day>=NASA_DAY);
export function formNASA(){if(!nasaReady())return;S.nasa=S.day;note('NASA established');lg('[WASHINGTON] The National Aeronautics and Space Act is signed. Your programme becomes the core of NASA.','hd')}

// Intelligence estimate of Soviet progress toward a satellite, as a range.
export function sovietProgress(){if(S.rvd.r_sat)return{lo:1,hi:1,done:true};const r=S.day/S.rv.r_sat;return{lo:Math.min(1,r/1.08),hi:Math.min(1,r/.92),done:false}}
