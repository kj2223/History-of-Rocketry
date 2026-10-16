// The launch director: flies the fleet unattended from standing orders, running the go/no-go poll and scrubbing on any NO-GO. No DOM.
import { S, lg, done } from './state.js';
import { quoteLaunch, unit, kerLock, stagingOK } from './design.js';
import { poll, scrub, scrubCost, troubleshoot, fixCost } from './base.js';
import { rt, beginFlight, step, sample, endFlight } from './flight.js';
import { PROGS } from './programs.js';
export function autoLaunch(){const a=S.auto;if(!S.staff.director||!a.on||rt.F||--a.cd>0)return false;a.cd=15;
const af=S.air.filter(x=>x.st=='r').sort((x,y)=>y.pk.length-x.pk.length)[0];if(!af)return false;
const fl=PROGS[af.prog].fuels,fuel=fl.includes(a.fuel)?a.fuel:fl[0],stage=a.st&&stagingOK(af)?1:0,q=quoteLaunch(af,fuel,a.pay,stage,a.load);
if(q.err||S.b-q.t<unit()+6000)return false;const P=poll(af,fuel,stage);if(P.nogo&&S.b>=fixCost())troubleshoot(P);if(P.nogo){if(S.b>=scrubCost())scrub(P);return true}
const F=beginFlight(af,fuel,a.pay,stage,a.load,{latent:P.fault,wind:P.wind});if(!F)return false;
lg('[LAUNCH DIRECTOR] All stations GO. Flying '+af.label+' under standing orders.','cyan');let r;do{r=step(F);if(r=='tick')sample(F,true)}while(r=='tick'||r=='sep');endFlight(F,r!='fail',r);return true}
