// MAN-RATING: before a crew rides one of your boosters, the design needs a clean flight record and the man-rating research. No DOM.
// Each rocket programme keeps its own record. A booster family is every blueprint revision since the programme's last booster
// milestone (a major redesign). Three successful flights in a row by the family, with the research done, certify it.
import { S, lg, note, done, devEv } from './state.js';
import { BY, isMS } from './data.js';
import { PROGS } from './programs.js';
export const MR_NEED=3,MR_RES=['mr_mods','esc_asis','ms_mrman'];
export function mrate(kind=S.cur){const b=S.progs[kind];if(!b)return{base:1,streak:0,cert:[],n:0};if(!b.mrate)b.mrate={base:b.bp.rev,streak:0,cert:[],n:0};return b.mrate}
const kindOf=af=>af&&af.prog||S.cur;
export const inFamily=af=>af.rev>=mrate(kindOf(af)).base;
const live=(kind=S.cur)=>{const m=mrate(kind),c=m.cert[m.cert.length-1];return!!c&&c[1]==null&&c[0]==m.base};
export const certified=()=>Object.keys(S.progs).some(k=>mrate(k).cert.length>0);
export const rated=af=>mrate(kindOf(af)).cert.some(([a,b])=>af.rev>=a&&af.rev<=(b==null?1e9:b));
export const familyCertified=live;
export const resDone=()=>MR_RES.every(done);
export const ratedNames=()=>Object.keys(S.progs).filter(k=>mrate(k).cert.length).map(k=>`${PROGS[k].n} ${mrate(k).cert.map(([a,b])=>b==null?`Rev ${a}+`:`Rev ${a}–${b}`).join(', ')}`);
// Every booster flight reports here, after NASA exists: ordinary launches and Mercury boosts alike.
export function mrFlight(af,ok){if(!S.nasa)return;const kind=kindOf(af),m=mrate(kind);if(!inFamily(af)||live(kind))return;m.n++;const nm=PROGS[kind]?PROGS[kind].n:'Booster';
if(ok){m.streak++;lg(`[MAN-RATING] Clean flight for the ${nm} Rev ${m.base}+ family: ${Math.min(m.streak,MR_NEED)} of ${MR_NEED} in a row.`,'ok')}
else if(m.streak){m.streak=0;lg(`[MAN-RATING] The ${nm} failed. Its clean-flight count starts again.`,'bad')}
checkCert(kind)}
export function checkCert(kind){if(!kind){let any=false;for(const k in S.progs)if(checkCert(k))any=true;return any}const m=mrate(kind);if(live(kind))return false;if(m.streak<MR_NEED||!resDone())return false;
m.cert.push([m.base,null]);const nm=PROGS[kind].n;note(`${nm} man-rated (Rev ${m.base} onward)`);lg(`[MAN-RATING] Certified: ${nm} boosters built to Rev ${m.base} or later may carry a crew.`,'hd');devEv({k:'manrate',prog:kind,rev:m.base});return true}
// Publishing a blueprint that adds a booster milestone starts a new family. Certified airframes already built stay certified.
export function mrPublish(added,rev){const m=mrate();if(!added.some(id=>isMS(id)&&BY[id]&&BY[id].ph!=2))return;
if(live()){const c=m.cert[m.cert.length-1];c[1]=rev-1;lg(`[MAN-RATING] Rev ${rev} is a major booster redesign and needs its own flight record. Airframes built to Rev ${c[0]}–${rev-1} keep their certification.`,'wn')}
else if(m.streak)lg(`[MAN-RATING] Rev ${rev} is a major booster redesign. The clean-flight count starts again.`,'wn');
m.base=rev;m.streak=0}
