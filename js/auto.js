// The launch director: flies the fleet unattended from standing orders. No DOM.
import { S, lg, done } from './state.js';
import { quoteLaunch, unit, kerLock } from './design.js';
import { rt, beginFlight, step, sample, endFlight } from './flight.js';
export function autoLaunch(){const a=S.auto;if(!S.staff.director||!a.on||rt.F||--a.cd>0)return false;a.cd=15;
const af=S.air.filter(x=>x.st=='r').sort((x,y)=>y.pk.length-x.pk.length)[0];if(!af)return false;
const fuel=a.fuel[0]=='K'&&kerLock()?'Alcohol & LOX':a.fuel,stage=a.st&&done('ms_stg')?1:0,q=quoteLaunch(af,fuel,a.pay,stage,a.load);
if(q.err||S.b-q.t<unit()+6000)return false;const F=beginFlight(af,fuel,a.pay,stage,a.load);if(!F)return false;
lg('[LAUNCH DIRECTOR] Flying '+af.label+' under standing orders.','cyan');let r;do{r=step(F);if(r=='tick')sample(F,true)}while(r=='tick'||r=='sep');endFlight(F,r!='fail',r);return true}
