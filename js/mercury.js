// PROJECT MERCURY (Phase Two, Section 1): capsules, your boosters, the flight timeline with crew decisions and air-to-ground comms,
// outcomes, directives, and the Astronaut Office calendar (selection, the chimpanzee colony, office decisions, Washington). No DOM.
import { K, gauss } from './util.js';
import { BY, MODES } from './data.js';
import { S, lg, note, save, done, conf, devEv, dateOf } from './state.js';
import { spec, t1done, repLoss, stagingOK, quoteLaunch } from './design.js';
import { byId, assigned, simTier, makePool } from './astro.js';
import { checkFirsts } from './race.js';
import { previewFlight, boosterRun, boosterFailed, boosterGood } from './flight.js';
import { mrFlight, rated, certified, checkCert } from './manrate.js';
import { learn as know, teach } from './knowledge.js';

// Flight profiles: [mission seconds, altitude km, speed m/s, g]. Real figures, rounded: Freedom 7 peaked at 187 km and pulled 11 g on re-entry.
// Each flight scales its profile to what your booster actually delivers with the capsule aboard.
const MR=[[0,0,0,1],[30,3,250,1.5],[60,11,600,2.4],[100,30,1300,4],[142,60,2290,6.3],[150,70,2280,0],[300,187,1980,0],[440,90,2100,0],[480,50,2200,.5],[500,30,1200,11],[530,15,300,3],[560,6.4,150,1],[600,3,10,1.5],[900,.1,9,1],[922,0,0,1]];
const BJ=[[0,0,0,1],[120,60,2500,4],[260,150,5000,6],[420,153,4900,0],[600,110,5000,0],[700,60,5100,.5],[730,30,2500,16],[760,12,400,3],[800,3,10,1],[1000,0,0,1]];
const LJ=[[0,0,0,1],[20,3,450,5],[35,9,600,3],[37,9.5,620,15],[45,10.5,200,1],[80,4,60,1],[190,.1,9,1],[200,0,0,1]];
const MA=[[0,0,0,1],[150,70,3000,5],[300,180,5500,7],[500,185,5400,0],[750,120,5500,0],[860,60,5600,.5],[890,30,2800,14],[920,12,400,3],[960,3,10,1],[1150,0,0,1]];
// Capsules are built in the factory; the booster is one of your airframes from the hangar. need: what the booster must deliver with a capsule aboard.
export const MT={
bj:{n:'Big Joe',full:'Big Joe heat-shield test',cap:'Big Joe boilerplate capsule',c:30000,t:120,prof:BJ,crew:0,need:{v:5500},ref:{alt:153,v:5100},boostEnd:260,sep:260,ent:700,chute:760,end:1000,
 why:'A boilerplate capsule thrown fast enough to prove the heat shield. Needs a booster that reaches 5,500 m/s with a capsule aboard.'},
lj:{n:'Little Joe',full:'Little Joe escape-system test',cap:'Little Joe test capsule',c:15000,t:60,prof:LJ,crew:0,need:{alt:8000},ref:{alt:10.5,v:620},boostEnd:35,abortAt:35,chute:45,end:200,
 why:'Any booster that can climb through maximum aerodynamic load. The escape tower must pull the capsule clear. A rhesus monkey can ride along.'},
mr:{n:'Mercury suborbital',full:'Mercury suborbital flight',cap:'Mercury capsule',c:45000,t:150,prof:MR,crew:1,need:{alt:80000},ref:{alt:187,v:2290},boostEnd:142,sep:150,ent:480,chute:560,end:922,
 why:'Your booster throws the capsule above 80 km, the 50-mile line that earns astronaut wings, and down into the Atlantic. Minutes of weightlessness, then 11 g.'},
ma:{n:'Orbital qualification',full:'Orbital-booster qualification flight',cap:'Mercury capsule (orbital adapter)',c:50000,t:160,prof:MA,crew:0,need:{v:6500},ref:{alt:185,v:5600},boostEnd:300,sep:300,ent:860,chute:920,end:1150,
 why:'Optional. A production capsule on your orbital-class booster (6,500 m/s with a capsule), proving the pair work together before Mercury goes to orbit. A success gives the next section a head start.'}};
export const DIR2=[
{k:'bj',n:'Big Joe',d:'Prove the heat shield: fly a boilerplate capsule on your orbital-class booster and recover it.',r:60000,mt:'bj'},
{k:'lj',n:'Little Joe series',d:'Qualify the escape system across its envelope: three good aborts, at least one with a rhesus monkey aboard.',r:60000,mt:'lj'},
{k:'mr',n:'Uncrewed suborbital flight',d:'Fly a Mercury capsule on a suborbital booster with no one aboard, and recover it.',r:80000,mt:'mr'},
{k:'animal',n:'Animal flight',d:'Fly a trained chimpanzee on a suborbital flight and recover it alive.',r:100000,mt:'mr'},
{k:'rate',n:'Man-rate a booster',d:'Three clean flights in a row by one booster design, with the booster man-rating modifications, abort sensing and the Man-Rated Booster Program complete. Any flight counts: Mercury or ordinary launches.',r:40000,mt:null},
{k:'crew',n:'First American in space',d:'Fly an astronaut on a certified booster and bring them home. The tracking network must be in service.',r:200000,mt:'mr'}];
const CHIMPS=['Jasper','Bongo','Duke','Rusty','Kip','Moe','Bertie'],MONKS=['Pip','Dot','Tilly','Bo','Juno'];
const CAPS=['Valiant','Pioneer','Endeavour','Patriot','Constitution','Independence','Vigilant','Resolute','Courage','Horizon'];
const ELECTION=5340,INAUGURATION=5420; // November 1960 and January 1961

export function fresh2(){return{v:3,sec:1,dir:0,pool:[],astros:[],selDone:0,sel:{st:0,at:Math.round(S.day+50),reg:null},veh:[],flights:0,mem:[],stand:0,secDone:0,memo:null,nv:1,chimp:0,monk:0,
lj:{ok:0,mk:0},fl:{},oq:[],od:null,gmul:1,ch:{on:0,t:0},ma:{ok:0,n:0},elec:0}}
export const p2=()=>S.p2;
export const dirKey=()=>{const D=DIR2[p2().dir];return D?D.k:null};
export const reqText=k=>{const n=x=>BY[x].n,P=p2();if(k=='bj'&&!done('cap_shape'))return`Needs ${n('cap_shape')}.`;
if(k=='lj'&&!done('esc_tower'))return`Needs ${n('esc_tower')}.`;if(k=='mr')for(const x of ['cap_ecs','cap_chute','esc_tower'])if(!done(x))return`Needs ${n(x)}.`;
if(k=='ma'){if(P.dir<1)return'Opens once Big Joe has flown.';if(!done('cap_ecs'))return`Needs ${n('cap_ecs')}.`}return null};

// BOOSTERS: what a given airframe delivers with a capsule aboard, single stage first, staged if needed. Cached per airframe, fuel and mission.
const pcache=new Map();
export function boosterPlan(af,fuel,mt){const m=MT[mt],b=S.progs[af.prog]||{kn:{}},key=[af.id,af.rev,fuel,mt,Math.round(Object.values(b.kn).reduce((x,y)=>x+y,0)/5)].join('|');if(pcache.has(key))return pcache.get(key);
let best=null;for(const st of stagingOK(af)?[0,1]:[0]){const pv=previewFlight(af,fuel,'Mercury Capsule',st,1),ok=pv.twr>1.05&&(!m.need.alt||pv.alt>=m.need.alt)&&(!m.need.v||pv.spd>=m.need.v);const r={st,pv,ok};if(ok){best=r;break}if(!best||pv.spd>best.pv.spd)best=r}
if(pcache.size>400)pcache.clear();pcache.set(key,best);return best}
export const needText=mt=>{const n=MT[mt].need;return n.alt?`${Math.round(n.alt/1000)} km`:`${n.v.toLocaleString()} m/s`};
export const boosters=()=>S.air.filter(a=>a.st=='r');

// Who may fly. Crews wait for the animal flight, a man-rated booster, both first milestones, the tracking network and a trained, assigned pilot.
export function crewLock(c,af){const P=p2();if(c=='none')return null;
if(c=='monkey')return done('cap_ecs')?null:`A monkey passenger needs ${BY.cap_ecs.n}.`;
if(c=='chimp'){if(!t1done('c'))return'An animal flight needs a heat-shield milestone (Mercury Spacecraft).';if(P.ch.t<1)return P.ch.on?`The chimpanzees are ${Math.round(P.ch.t*100)}% through training at Holloman.`:'Start chimpanzee training in the Astronaut Office.';return null}
if(P.stand>S.day)return`Crewed flights are stood down after the loss of a crew until ${dateOf(P.stand)}.`;
if(P.dir<4)return'NASA will not fly a crew until an animal has flown and been recovered alive.';
if(!certified())return'No booster is man-rated yet (see the man-rating board).';if(af&&!rated(af))return`${af.label} (Rev ${af.rev}) is outside the certified booster revisions.`;
if(!S.fac.trknet)return S.fb&&S.fb.trknet?`The tracking network is still being built (in service around ${dateOf(S.fb.trknet)}).`:'Needs the Mercury Worldwide Tracking Network (Hangar & Base).';
if(!t1done('e'))return'Needs a hatch milestone (Escape & Man-Rating).';
const a=assigned('mr');if(!a)return'Assign a qualified astronaut in the Astronaut Office.';if(a.mt<1)return`${a.name} is ${Math.round(a.mt*100)}% through mission training.`;return null}

// Capsules are built in the factory to the published blueprint, so their systems are fixed when ordered.
export function orderVehicle(k){const m=MT[k];if(reqText(k)||S.b<m.c)return;S.b-=m.c;S.aq.push({k:'msn',mt:k,cfg:{pk:Object.keys(S.g.pk),rev:S.g.bp.rev},cost:m.c,t:m.t,tot:m.t});lg(`[FACTORY] Ordered a ${m.cap} (${K(m.c)}).`,'wn')}
export function deliverVehicle(q){const P=p2();const v={id:P.nv++,mt:q.mt,cfg:q.cfg,built:Math.round(S.day)};P.veh.push(v);if(q.af){q.af.st='r';S.air.push(q.af)}lg(`[FACTORY] ${MT[q.mt].cap} #${v.id} (Rev ${q.cfg.rev})${q.refurb?` and ${q.af?q.af.label:'its booster'} are refurbished and`:' is'} ready at the Cape.`,'ok')}

// Reliability of each capsule system: a base, the packages on its blueprint, a penalty for each spacecraft package not yet proven.
export function rel(cfg){const sp=spec(cfg.pk),un=cfg.pk.filter(id=>BY[id]&&BY[id].ph==2&&!conf(id)).length,R=k=>Math.max(.5,Math.min(.995,.8+(sp[k]||0)-.012*un));
return{R,sp,un,man:sp.man>0||!!(S.p2&&S.p2.fl.ovr),hx:done('ms_hxp')&&cfg.pk.includes('ms_hxp'),orb:sp.orb>0}}

const lerp=(prof,t)=>{let i=0;while(i<prof.length-2&&prof[i+1][0]<t)i++;const a=prof[i],b=prof[i+1],f=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0]||1)));return{alt:a[1]+(b[1]-a[1])*f,v:a[2]+(b[2]-a[2])*f,g:a[3]+(b[3]-a[3])*f}};
const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const animalName=a=>`the ${a.an} ${a.chimp}`;

// AIR-TO-GROUND: a transcript of the loop. Speakers: CC (CAPCOM, or the Cape before there is one), P (the pilot, by call sign), SURG, FLT, TLM; '' is an editor's note.
const human=M=>M.crew&&!M.crew.chimp?M.crew:null;
export function spk(M,w){return w=='CC'?(S.crew.capcom?'CAPCOM':'CAPE'):w=='P'?(M.call||'PILOT').toUpperCase():w}
function tx(M,w,x,c=''){if(!M.tx)M.tx=[];const a=human(M);if(w=='P'&&a&&a.t.com<45&&Math.random()<.3)x=x.replace(/^(\w)/,m=>'Uh... '+m.toLowerCase());M.tx.push({t:Math.round(M.tnow??M.t),w,x,c})}
// Scripted calls, keyed to mission time; each fires once if its condition holds. Events and decisions add their own lines as they happen.
function script(M){const a=human(M),ok=()=>!M.out.boost&&!M.out.abort&&!M.done,L=[];const add=(t,w,x,f=ok)=>L.push({t,w,x,f});
if(M.mt=='mr'&&a){const hr=()=>Math.round(88+(60-a.t.com)*.9+Math.random()*12);
add(0,'CC','Liftoff. The clock is running.');add(2,'P','Roger, clock is running. She\'s off the pad.');
add(15,'P','All systems go. Fuel go, oxygen go, cabin pressure holding at five point five.');add(40,'P','Getting some vibration... a little rough here.');add(46,'CC','Copy. That\'s max q. Should smooth out.');
add(75,'P','Smoothing out now. Pressures steady.');add(105,'CC',()=>`You are go, ${M.call}. Right down the line.`);
add(156,'P','Capsule separation, green light. Turnaround has started.');
add(178,'P',()=>p2().fl.win?'Out the window I can see the whole coastline. Clouds out over the Atlantic. What a view.':'On the periscope. Mostly cloud cover, some coastline to the west.');
add(205,'P',()=>M.r.man?'Going to manual. Pitch is OK... yaw is OK... roll is OK.':'Automatic control is holding attitude nicely.');add(212,'CC','Roger. Looks good from here.');
if(S.crew.surg)add(235,'SURG',()=>`Pulse ${hr()}, respiration steady. He sounds fine.`);
add(258,'CC','Stand by for retro sequence.');add(266,'P','Retro attitude set. Retro sequence is green.');
add(335,'P','Retro jettison. I heard it go.',()=>ok()&&!M.retroFail);add(425,'CC',()=>`${M.call}, your re-entry attitude looks good.`);add(468,'P','Periscope is in. Here come the g\'s.');
add(605,'P','Landing bag is out. Green light.');add(660,'CC','Recovery forces have you on radar. Helicopter is on the way.',()=>!M.done);
if(S.crew.surg)add(700,'SURG',()=>`Pulse back down to ${hr()-25}.`,()=>!M.done)}
else{const lj=M.mt=='lj',an=M.crew&&M.crew.chimp?M.crew:null;
add(0,'FLT','Liftoff. Clock has started.');add(lj?20:40,'TLM','Max q. Vehicle stable.');
if(!lj){add(M.m.sep+8,'TLM','Capsule separation. Turnaround under way.');add(M.m.sep+60,'TLM','Capsule attitude holding on the automatics.');
 if(an&&an.an=='chimpanzee')add(M.m.sep+90,'SURG',()=>`${an.chimp} is working the levers. Right on cue, heart rate steady.`);
 if(M.mt!='mr')add(M.m.sep+150,'FLT','Coasting. Range has the capsule on radar.');add(M.m.ent-20,'TLM','Entering the atmosphere.')}}
return L.sort((x,y)=>x.t-y.t)}

// Build the flight: the booster flies its real physics with a capsule aboard; every capsule failure is rolled up front and given a time.
export function beginMission(vid,crew,opt={}){const P=p2(),v=P.veh.find(x=>x.id==vid),af=S.air.find(a=>a.id==opt.af&&a.st=='r');if(!v||!af)return null;const m=MT[v.mt],r=rel(v.cfg),fuel=opt.fuel||'Alcohol & LOX';
const plan=boosterPlan(af,fuel,v.mt);if(!plan.ok)return null;const q=quoteLaunch(af,fuel,'Mercury Capsule',plan.st,1);if(q.err)return null;S.b-=q.t;
P.veh.splice(P.veh.indexOf(v),1);S.air.splice(S.air.indexOf(af),1);S.day+=3;
const who=crew=='none'||!crew?null:crew=='chimp'?{chimp:CHIMPS[P.chimp++%CHIMPS.length],an:'chimpanzee'}:crew=='monkey'?{chimp:MONKS[P.monk++%MONKS.length],an:'rhesus monkey'}:byId(crew);
const M={v,m,mt:v.mt,r,af,fuel,st:plan.st,crew:who,cid:crew,t:0,ev:[],log:[],tx:[],pend:null,out:{boost:0,abort:0,heat:0,chute:0,sink:0,lost:0,injured:0,att:0,rec:0,ecs:0},latent:opt.latent||null,over:!!opt.over,done:0,res:null,trace:[],
 sa:clamp(plan.pv.alt/1000/m.ref.alt,.4,2.5),sv:clamp(plan.pv.spd/m.ref.v,.4,2.5)};
if(who&&!who.chimp){who.cap=who.cap||`${CAPS[(who.id*7)%CAPS.length]} ${P.astros.length}`;M.call=who.cap}
const add=(t,k)=>M.ev.push({t,k});
lg(`--- ${m.full.toUpperCase()}: capsule #${v.id} on ${af.label}${who?` with ${who.chimp?animalName(who):who.name}`:''} ---`,'wn');
tx(M,'',`${m.full} on ${af.label}${M.call?`. Call sign ${M.call}`:''}${who&&who.chimp?`, with ${animalName(who)} aboard`:''}.`);
// Two failures that end a flight before it starts: the escape rocket firing on the pad, and a booster shutting down after rising a few inches.
if(v.mt=='lj'&&Math.random()<.12*(1-Math.min(1,(r.sp.as||0)*5))){add(.1,'stray');return M}
if(v.mt!='lj'&&!(r.sp.um>0)&&Math.random()<(P.fl.four?.06:.12)){add(1,'four');return M}
// The booster: your airframe's own physics and failure model. The man-rating modifications give a failing booster a chance to ride it out.
const be=m.boostEnd,gsp=spec(Object.keys(S.pk)),rescue=Math.min(.6,((gsp.mr||0)+(v.mt=='ma'?gsp.mab||0:0))*2.5);
let br=boosterRun(af,fuel,plan.st,{latent:M.latent,wind:opt.wind||0});if((br.fail||br.short)&&Math.random()<rescue){br=boosterRun(af,fuel,plan.st,{wind:opt.wind||0});M.saved=1}M.br=br;
if(br.fail||br.short)add(Math.max(3,Math.min(be-2,br.frac*be)),'boost');else add(be-.5,'bco');
if(m.abortAt)add(m.abortAt,'ljabort');
if(m.sep&&v.mt=='mr'&&Math.random()<1-r.R('tj'))add(m.sep+2,'tj');
if(v.mt=='mr'){if(!rated(af)&&Math.random()<.2)add(be-10,'over');if(Math.random()<1-r.R('ac'))add(rnd(180,260),'att');if(Math.random()<1-r.R('ec'))add(rnd(170,400),'ecs');add(300,'retro');if(Math.random()<1-r.R('rr'))M.retroFail=1}
if(m.ent)add(m.ent+10,'heat');if(m.chute>40)add(m.chute-30,'drogue');add(m.chute,'chute');add(m.end-2,'splash');
M.ev.sort((a,b)=>a.t-b.t);M.script=script(M);return M}

// The channels Mission Control sees, as a reading from the scaled profile with a little noise.
export function reading(M){const p=M.out.four||M.out.stray?{alt:0,v:0,g:1}:lerp(M.m.prof,M.t),n=x=>x*(1+.02*gauss());return{alt:Math.max(0,n(p.alt*(M.sa||1))),v:Math.max(0,n(p.v*(M.sv||1))*(M.out.over?1.08:1)),g:Math.max(0,p.g*(M.out.over&&M.t>480?1.35:1)+.1*gauss()),temp:Math.round(24+(M.out.ecs?14:0)+(M.t>(M.m.ent||9e9)&&M.t<(M.m.chute||0)?6:0)+gauss())}}

// Decisions. Crew decisions name the skill they lean on and a base chance; training, rehearsal, CAPCOM and simulator fidelity add to it.
// Ground decisions (ctl) are yours as Test Conductor, whoever is aboard.
const DEC={abort:{q:'The booster is failing and the abort system has not fired.',o:[{t:'Pull the abort handle',sk:'com',b:.75},{t:'Hold on and trust the booster',b:.04}]},
tj:{q:'The escape tower failed to jettison after booster separation. The parachutes cannot deploy with it attached.',o:[{t:'Fire the tower jettison by hand',sk:'pil',b:.6},{t:'Wait for the backup sequencer',b:.3,bk:'tjb'}]},
att:{q:'The capsule is drifting off attitude: the automatic stabilization is misbehaving.',o:[{t:'Take manual control',sk:'pil',b:.6,need:'man'},{t:'Let the automatics recover',b:.45},{t:'Follow CAPCOM through the backup procedure',sk:'com',b:.55,need:'capcom'}]},
ecs:{q:'Suit and cabin temperatures are climbing.',o:[{t:'Turn up the suit coolant',sk:'sys',b:.6},{t:'Ride it out',sk:'end',b:.5},{t:'Cut the experiments and conserve',b:.8,soft:1}]},
retro:{q:'The retrorockets did not fire on the timer.',o:[{t:'Fire the retros manually',sk:'pil',b:.6,need:'man'},{t:'Leave them: they are not needed to come home on this arc',b:1,soft:1}]},
hatch:{q:'The hatch has blown on the water and the capsule is flooding.',o:[{t:'Get out through the hatch now',sk:'end',b:.55,rk:'hatch'},{t:'Stay with the capsule until the helicopter hooks it',b:.3,heli:1}]},
pad:{ctl:1,q:'The booster is back on the pad, fuelled, with its destruct system armed and the parachutes draped down its side. Nobody can go near it while the capsule batteries are live.',o:[
 {t:'Wait for the batteries to drain overnight',b:1,soft:1},{t:'Send a pad crew out to make it safe now',b:.7,crew:1},{t:'Shoot holes in the tanks to vent the propellant',b:.95,shoot:1}]}};
// What the pilot says when a decision lands on them, and how CAPCOM answers.
const CALL={abort:['Abort light! Abort light is on!','Abort, abort, abort!'],tj:['No tower jettison light. The tower is still on.','Copy. Use the manual jettison.'],att:['Attitude\'s wandering. The automatics aren\'t holding me.','We see it here. Your call.'],
ecs:[M=>`Suit temperature is climbing. Reading ${reading(M).temp} degrees.`,'Copy. Watch it.'],retro:['No retro fire. Repeat, no retros.','We confirm, no retro fire.'],hatch:['Hatch is gone! Water\'s coming in!','Helicopter is right over you!']};
const REHK={abort:'abort',tj:'tj',att:'att',ecs:'ecs',retro:'retro',hatch:'hatch'};
export const isCtl=k=>!!DEC[k].ctl;
export function options(M,k){return DEC[k].o.map((o,i)=>({...o,i,ok:!(o.need=='man'&&!M.r.man)&&!(o.need=='capcom'&&!S.crew.capcom)}))}
export function odds(M,k,o){const cl=p=>Math.max(.04,Math.min(.97,p));if(DEC[k].ctl)return o.soft?1:cl(o.b+(o.crew&&S.crew.bstr?.15:0));
const a=human(M),P=p2();let p=o.bk=='tjb'?(done('esc_jett')?.75:.3):o.b;if(a&&o.sk)p+=(a.t[o.sk]-50)/100*.7;if(a&&a.reh[REHK[k]])p+=.15;if(S.crew.capcom)p+=.05;if(S.fac.trknet&&a)p+=.03;p+=simTier()*.03;if(a&&a.fat>60)p-=.08;
if(P.fl.win&&(k=='att'||k=='retro'))p+=.04;if(o.heli&&S.fac.recov)p+=.25;return cl(p)}
const ask=(M,k)=>{if(DEC[k].ctl||human(M)){M.pend={k,q:DEC[k].q,ctl:!!DEC[k].ctl};const c=CALL[k];if(c&&human(M)){tx(M,'P',typeof c[0]=='function'?c[0](M):c[0],'bad');tx(M,'CC',c[1])}return true}
const best=options(M,k).filter(o=>o.ok&&!o.need).sort((x,y)=>odds(M,k,y)-odds(M,k,x))[0];resolve(M,k,best,true);return false};
const say=(M,t,c='')=>{M.log.push(t);lg(`T+${Math.round(M.t)}s | ${t}`,c);tx(M,'',t,c)};
export function choose(M,i){const p=M.pend;if(!p)return;M.pend=null;const o=options(M,p.k).find(x=>x.i==i);resolve(M,p.k,o,false)}
function resolve(M,k,o,auto){const ok=Math.random()<odds(M,k,o),hm=human(M),who=DEC[k].ctl?'Test Conductor':hm?hm.name.split(' ')[1]:'The automatic sequence',P=p2();
if(!auto){M.log.push(`${who}: "${o.t}."`);lg(`T+${Math.round(M.t)}s | ${who}: "${o.t}."`,'cyan');tx(M,DEC[k].ctl?'TC':'P',`${o.t}.`,'cyan')}
if(k=='abort'){if(ok)towerFires(M);else{M.out.lost=1;say(M,'The booster breaks up with the capsule still attached.','bad')}}
else if(k=='tj'){if(ok){say(M,'Tower clear. Parachute sequence armed.','ok');if(hm)tx(M,'P','Tower\'s gone. I felt it go.')}else{M.out.tjBad=1;say(M,'The tower is still attached.','bad')}}
else if(k=='att'){if(ok||o.soft){say(M,'Attitude recovered.','ok');if(hm)tx(M,'P','Got it. Holding attitude now.')}else{M.out.att=1;say(M,'The capsule is still off attitude going into re-entry.','wn')}}
else if(k=='ecs'){if(ok){say(M,'Temperatures are coming down.','ok');if(hm)tx(M,'P','Better. Suit\'s cooling off.')}else{M.out.ecs=1;say(M,'Cabin temperatures stay high.','wn')}if(o.soft)M.out.soft=1}
else if(k=='retro'){if(o.soft)say(M,'Retros left unfired. Re-entry continues on the ballistic arc.','wn');else if(ok){say(M,'Retros fired by hand.','ok');if(hm)tx(M,'P','Retros fired on the manual switch. I felt all three.')}else say(M,'The manual retro switch does nothing.','wn')}
else if(k=='hatch'){if(ok){M.out.sink=1;say(M,M.crew.chimp?'The capsule sinks; the recovery swimmers get the animal out.':o.heli?'The helicopter hooks the capsule and lifts it clear before it floods.':'Out of the capsule and into the water. The capsule sinks, but the recovery helicopter has the crew.','wn');if(o.heli)M.out.sink=0}else{M.out.sink=1;if(Math.random()<.12)M.out.lost=1;else M.out.injured=1;say(M,M.out.lost?'The crew could not get clear of the flooding capsule.':'Pulled from the water exhausted and half-drowned.','bad')}}
else if(k=='pad'){M.done=1;
 if(o.soft){const f=10000;S.b=Math.max(0,S.b-f);S.aq.push({k:'msn',mt:M.mt,cfg:M.v.cfg,cost:f,t:110,tot:110,refurb:1,af:M.af});say(M,`Overnight the batteries run down and the pad crew safes the booster. Capsule and booster go back for refurbishment (${K(f)}).`,'wn')}
 else if(o.crew){if(ok){S.b=Math.max(0,S.b-3000);P.veh.push(M.v);M.af.st='r';S.air.push(M.af);say(M,'The pad crew disarms the booster in two tense hours. Capsule and booster can be readied to fly again.','ok')}else{S.rep=Math.max(0,S.rep-3);P.veh.push(M.v);say(M,'A squib fires as the crew works. Nobody is badly hurt, but the booster is scrapped. The capsule is saved.','bad')}}
 else{P.veh.push(M.v);say(M,'The tanks are vented and the booster scrapped. The capsule is saved for reuse.','wn')}}}
function towerFires(M){M.out.abort=1;if(Math.random()<M.r.R('et')){say(M,'ESCAPE TOWER FIRES. The capsule is pulled clear of the booster.','wn');if(human(M))tx(M,'P','Tower fired! I\'m off the booster. Waiting on the chutes.');M.t=Math.max(M.t,M.m.chute-1);M.ev=M.ev.filter(e=>e.k=='chute'||e.k=='splash');M.ev.forEach(e=>{if(e.k=='splash')e.t=M.m.chute+60})}
else{M.out.lost=M.crew?(Math.random()<.7?1:0):1;if(!M.out.lost)M.out.injured=1;say(M,'The escape tower fails to pull the capsule clear.','bad');M.done=1}}
const bname=M=>M.af.label;
function boosterDown(M){const br=M.br;M.out.boost=1;boosterFailed(br.F);mrFlight(M.af,false);
say(M,`BOOSTER MALFUNCTION: ${br.short?'the booster cannot hold the climb with the capsule aboard':MODES[br.fail]?MODES[br.fail].n.toLowerCase():'cause unknown'}.`,'bad')}

// Advance the mission clock by dt seconds. Returns 'decide' when someone must choose, 'end' when the flight is over.
export function stepMission(M,dt){if(M.done)return'end';if(M.pend)return'decide';M.t+=dt;M.tnow=null;
while(M.script&&M.script.length&&M.script[0].t<=M.t){const l=M.script.shift();M.tnow=l.t;if(!l.f||l.f())tx(M,l.w,typeof l.x=='function'?l.x():l.x)}M.tnow=null;
while(M.ev.length&&M.ev[0].t<=M.t){const e=M.ev.shift(),hm=human(M);M.tnow=Math.min(M.t,e.t);
if(e.k=='stray'){M.out.stray=1;M.out.lost=M.crew?0:1;M.af.st='r';S.air.push(M.af);say(M,'Half an hour before launch, the escape rocket fires on its own. It carries the capsule a few hundred metres up and drops it in the scrub. The booster never leaves the pad.','bad');if(M.crew)say(M,`Recovery crews find ${animalName(M.crew)} shaken but alive.`,'wn');M.done=1;return'end'}
if(e.k=='four'){M.out.four=1;M.t=1;say(M,'Ignition. The booster rises a few inches, the engine shuts down, and it settles back onto the pad.','bad');if(hm)tx(M,'P','Engine\'s shut down. I\'m still on the pad. Everything is quiet up here.','bad');say(M,'The escape tower jettisons and flies off; the drogue and main parachutes spill out over the side of the booster.','bad');if(ask(M,'pad'))return'decide';return'end'}
if(e.k=='bco'){boosterGood(M.br.F);mrFlight(M.af,true);say(M,`Booster cutoff. ${M.saved?'The man-rating redundancy rode out a fault on the way up. ':''}${bname(M)} did its job.`,'ok');if(hm)tx(M,'P','Cutoff. Tower jettison... green light.');continue}
if(e.k=='boost'){boosterDown(M);if(M.mt=='bj'||M.mt=='ma'){M.out.lost=1;say(M,'With no escape tower on this flight, the capsule is lost with the booster.','bad');M.done=1;return'end'}if(Math.random()<M.r.R('as')){say(M,'Abort sensing trips automatically.','wn');towerFires(M)}else if(ask(M,'abort'))return'decide';if(M.done)return'end'}
else if(e.k=='ljabort'){say(M,'Maximum aerodynamic load: abort commanded.','wn');if(Math.random()<M.r.R('as'))towerFires(M);else{say(M,'Abort sensing fails to fire the tower.','bad');M.out.lost=1;M.done=1;return'end'}if(M.done)return'end'}
else if(e.k=='over'){M.out.over=1;say(M,'The booster is burning hot: velocity well above plan at cutoff.','wn');say(M,'The capsule will overshoot the landing area. Recovery forces are moving downrange.','wn');if(hm){tx(M,'P','Harder ride than the simulator. Lot more push than I expected.');tx(M,'CC','You\'re running long. Recovery is moving downrange.')}}
else if(e.k=='tj'){say(M,'Tower jettison did not fire.','bad');if(ask(M,'tj'))return'decide'}
else if(e.k=='att'){say(M,'Attitude control fault.','wn');if(ask(M,'att'))return'decide'}
else if(e.k=='ecs'){say(M,'Environmental control fault: temperatures rising.','wn');if(ask(M,'ecs'))return'decide'}
else if(e.k=='retro'){if(M.retroFail){say(M,'Retrofire signal sent; no retro ignition.','wn');if(ask(M,'retro'))return'decide'}else{say(M,'Retrorockets fire on time.','ok');if(hm)tx(M,'P','Retro one... retro two... retro three. All three fired. Good kick.')}}
else if(e.k=='heat'){const hp=(1-M.r.R('hs'))*(M.mt=='bj'?1.3:M.mt=='ma'?1.4:1)*(M.out.att?1.8:1);const gl=M.out.over?15:11;if(Math.random()<hp){M.out.heat=1;say(M,'Heat-shield temperatures far above prediction.','bad');if(hm)tx(M,'P','Getting hot in here. Orange glow all around.','bad');if(M.crew&&Math.random()<.12){M.out.lost=1;say(M,'Signal lost during re-entry.','bad');tx(M,'CC',`${M.call||'Capsule'}, Cape. Do you read? ... ${M.call||'Capsule'}, do you read?`,'bad');M.done=1;return'end'}else if(M.crew)M.out.injured=1}else{say(M,'Re-entry: heat shield holding. '+(hm?`${hm.name.split(' ')[1]} reports ${gl} g.`:`Peak deceleration ${M.out.over?'far above':'nominal at'} ${gl} g.`),'ok');if(hm)tx(M,'P',`g's building... ${gl} g... OK... still with you.`)}
if(hm&&hm.t.end<(M.out.over?55:40)&&!S.fac.centrifuge&&Math.random()<.4){say(M,'The pilot greyed out briefly under the g-load.','wn');tx(M,'CC',`${M.call}, Cape. Say your status.`);tx(M,'P','...I\'m here. Lost my vision for a second. OK now.');if(M.out.over&&Math.random()<.3)M.out.injured=1}}
else if(e.k=='drogue'){if(hm)tx(M,'P','Drogue is out.');else tx(M,'TLM','Drogue deployed.')}
else if(e.k=='chute'){const pc=M.r.R('pc')*(M.out.tjBad?.3:1);if(Math.random()<pc){say(M,'Main parachute good.','ok');if(hm)tx(M,'P','Main chute is out. Beautiful chute!')}else{say(M,'MAIN PARACHUTE FAILURE. Reserve deployed.','bad');if(hm)tx(M,'P','Main is streaming! Going to the reserve!','bad');if(Math.random()>pc*.95){M.out.chute=1;M.out.lost=M.crew?(Math.random()<.85?1:0):0;if(M.crew&&!M.out.lost)M.out.injured=1;M.out.sink=1;say(M,'The reserve parachute fails.','bad');M.done=1;return'end'}else{say(M,'Reserve parachute good.','ok');if(hm)tx(M,'P','Reserve is good. Reserve is good.')}}}
else if(e.k=='splash'){say(M,M.out.over?'Splashdown, 200 km beyond the planned area. The ships are hours away.':'Splashdown.',M.out.over?'wn':'ok');if(hm){tx(M,'P','Impact. Capsule is upright, no leaks.');tx(M,'CC',`Welcome home, ${M.call}.`)}
if(Math.random()>M.r.R('lb')){say(M,'Hard landing: the landing bag did not deploy properly.','wn');if(M.crew&&Math.random()<.25)M.out.injured=1;if(!M.crew&&Math.random()<(S.fac.recov?.2:.4))M.out.sink=1}
if(M.out.over&&!M.out.sink&&Math.random()<(S.fac.recov?.1:.25)){say(M,'The capsule is taking on water while it waits for the ships.','wn');if(!M.crew||M.crew.chimp)M.out.sink=Math.random()<.5?1:0}
if(M.r.hx&&M.crew&&Math.random()<.05+(M.r.sp.hb||0)){say(M,'The hatch blows early. Water is pouring in.','bad');if(ask(M,'hatch'))return'decide'}
M.out.rec=M.out.sink&&!M.crew?0:1;M.done=1;return'end'}}
if(M.t>=M.m.end){M.done=1;return'end'}return'tick'}

// A directive is met: reward, record, and the Section 1 finale on the last one.
function fulfil(D,a){const P=p2();S.b+=D.r;S.rep=Math.min(100,S.rep+(D.k=='crew'?20:8));note(`Mercury directive met: ${D.n}`);lg(`[DIRECTIVE FULFILLED] ${D.n}. Reward +${K(D.r)}.`,'hd');P.dir++;
if(P.dir==DIR2.length){checkFirsts({human:1});P.secDone=Math.round(S.day);note('Section 1 complete');lg(`[NEWS] ${a?a.name:'An astronaut'} is the first American in space. Ticker-tape parades are planned.`,'hd');lg('[WASHINGTON] The President asks Congress to commit the nation to landing a man on the Moon and returning him safely to the Earth before this decade is out.','hd')}}

// Close out a mission: crew, reputation, packages confirmed, directive and firsts, and the record.
export function endMission(M){const P=p2(),o=M.out,a=human(M),animal=M.crew&&M.crew.chimp?M.crew:null;P.flights++;
const crewSafe=!o.lost,recovered=o.rec||(M.crew&&crewSafe&&!o.chute),ok=!o.boost&&!o.abort&&!o.heat&&!o.chute&&!o.lost&&!o.four&&!o.stray&&recovered;
lg('=== MISSION COMPLETE ===',ok?'ok':'wn');
if(!o.four&&!o.stray&&(M.t>(M.m.sep||30)||ok))for(const id of M.v.cfg.pk)if(BY[id]&&BY[id].ph==2&&!conf(id)){const p=S.pk[id];if(p){p.c=1;p.m={};for(const k in p.a)p.m[k]=p.a[k]*(1+.08*gauss());lg(`[DESIGN] Flight data confirms ${BY[id].n}.`,'cyan')}}
if(a&&(o.four||o.stray))lg(`[ASTRONAUT OFFICE] ${a.name} climbs out once the booster is safe. The flight does not count; mission training stands.`,'wn');
else if(a){a.flights++;a.asg=null;a.mt=0;a.focus='rest';a.fat=Math.min(100,a.fat+30);
if(o.lost){a.st='lost';P.mem.push({name:a.name,svc:a.svc,mission:`${M.m.full} (${a.cap||'capsule #'+M.v.id})`,d:Math.round(S.day)});P.memo={name:a.name,mission:M.m.full};P.stand=Math.round(S.day+180);S.rep=Math.max(0,S.rep-25-(P.fl.life?8:0));note(`Astronaut ${a.name} lost on the ${M.m.full}`);
lg(`[NASA] ${a.name} (${a.svc}) was lost on the ${M.m.full}. Crewed flights are stood down while a review board investigates.`,'bad')}
else if(o.injured){a.st='grounded';a.gd=S.crew.surg?60:120;lg(`[FLIGHT SURGEON] ${a.name} is injured and grounded for about ${S.crew.surg?'two':'four'} months.`,'wn')}}
if(animal){if(o.lost){repLoss('bio');lg(`[PRESS] ${animalName(animal)} was lost. The press is critical.`.replace('[PRESS] the','[PRESS] The'),'nar')}else lg(`[PRESS] ${animalName(animal)} is recovered alive.${animal.an=='chimpanzee'&&!o.over&&!o.four?' It pulled its levers on cue all through the flight.':''}`.replace('[PRESS] the','[PRESS] The'),'ok')}
if(!ok&&!o.lost)S.rep=Math.max(0,S.rep-(o.boost?4:2));
// What the failures teach: each investigation proposes the package that cures it.
if(o.four&&!P.fl.four){P.fl.four=1;lg('[INVESTIGATION] The tail-plug cables pulled out in the wrong order and the booster read it as a cutoff command. New package proposed: Umbilical disconnect sequencing.','hd')}
if(M.mt=='ma'&&o.boost&&!P.fl.maFail){P.fl.maFail=1;lg('[INVESTIGATION] The booster skin buckled where it meets the capsule adapter. New package proposed: booster stiffening band.','hd')}
if(M.mt=='ma'){P.ma.n++;if(ok){P.ma.ok++;if(!P.fl.maQual){P.fl.maQual=1;S.b+=50000;S.rep=Math.min(100,S.rep+3);note('Orbital booster qualified with a capsule');lg('[MERCURY] Capsule and orbital booster fly together and the capsule is recovered. Orbital Mercury has a head start. Bonus +$50,000.','hd')}}}
const D=DIR2[P.dir];let met=false;
if(D&&D.mt==M.mt){const k=D.k;
 if(k=='bj')met=recovered&&!o.heat&&!o.boost;
 else if(k=='lj'){if(o.abort&&!o.chute&&!o.lost&&!o.stray){P.lj.ok++;if(animal)P.lj.mk=1;lg(`[LITTLE JOE] Good abort: ${P.lj.ok} of 3${P.lj.mk?', monkey flight done':', a monkey flight still needed'}.`,'ok')}met=P.lj.ok>=3&&!!P.lj.mk}
 else if(k=='mr')met=!M.crew&&ok;
 else if(k=='animal')met=!!animal&&animal.an=='chimpanzee'&&crewSafe&&recovered&&!o.boost&&!o.four;
 else if(k=='crew')met=!!a&&crewSafe&&recovered&&!o.boost&&!o.abort}
if(met)fulfil(D,a);
if(!o.four&&!o.stray){const t=teach(M.br&&M.br.F.tr);know('c',(o.heat||o.chute||o.ecs||o.att?3:1.5)*t);know('e',(o.abort?4:1)*t)}
P.lastTx={n:M.m.full,call:M.call||'',tx:M.tx.slice(-200)};
devEv({k:'mission',n:P.flights,type:M.mt,crew:a?a.name:animal?animal.an:'none',booster:M.af.label,ok,abort:o.abort||undefined,lost:o.lost||undefined,met:met||undefined,four:o.four||undefined,over:o.over||undefined,bfail:o.boost?(M.br.fail||'short'):undefined});save();return{ok,met,lost:!!o.lost}}

// THE ASTRONAUT OFFICE CALENDAR
// Selection: records screening, then a testing programme you choose, then the pick.
export const REGIME={std:{n:'Standard medical examinations',c:15000,d:45,kn:60,find:.5},full:{n:'Full Lovelace Clinic and Wright-Patterson stress testing',c:40000,d:75,kn:160,find:1}};
export function chooseRegime(r){const P=p2(),g=REGIME[r];if(!g||P.sel.st!=1||S.b<g.c)return;S.b-=g.c;P.sel={st:2,at:Math.round(S.day+g.d),reg:r};lg(`[ASTRONAUT OFFICE] ${g.n} begin for the ${P.pool.length} finalists (${K(g.c)}). Results around ${dateOf(P.sel.at)}.`,'wn')}
function finishTesting(){const P=p2(),g=REGIME[P.sel.reg];let n=0;for(const a of P.pool){a.kn=(a.kn||0)+g.kn;if(a.med&&Math.random()<g.find){a.dq=1;n++}}P.sel.st=3;
lg(`[ASTRONAUT OFFICE] Testing is complete. ${n?`${n} finalist${n>1?'s are':' is'} medically disqualified. `:''}Choose your astronauts.`,'hd')}
// Office decisions: offers and demands that land on the calendar after selection.
export const OFFICE={
life:{who:'PRESS',q:'Life magazine offers the astronauts an exclusive contract for their personal stories, worth $500,000 shared among them.',a:['APPROVE THE CONTRACT','TURN IT DOWN'],
 yes:'The astronauts become national heroes in Life. Public interest and appropriations rise, but the press now follows their every move.',no:'The astronauts keep their privacy. The newspapers are cooler toward Mercury.'},
win:{who:'ASTRONAUT OFFICE',q:'The astronauts want a real window in the capsule, not just a periscope. "We are pilots, not passengers."',a:['ADD A WINDOW ($25,000)','REFUSE: WEIGHT AND SCHEDULE COME FIRST'],c:25000,
 yes:'The capsule is redesigned around a pilot\'s window. Attitude and retrofire decisions get easier.',no:'The astronauts take it badly. Composure suffers.'},
ovr:{who:'ASTRONAUT OFFICE',q:'The astronauts want a manual override for every automatic sequence: retrofire, attitude and parachutes.',a:['ADD THE OVERRIDES ($20,000)','REFUSE: THE AUTOMATICS ARE SAFER'],c:20000,
 yes:'Manual overrides are wired into every capsule. Manual-control options are open in flight even before fly-by-wire research.',no:'The astronauts complain to the press that they are passengers. Composure suffers.'},
cock:{who:'ASTRONAUT OFFICE',q:'The astronauts ask to sit in on spacecraft design reviews, each following one system at the factory.',a:['AGREE: EACH FOLLOWS A SYSTEM','KEEP THEM ON THE TRAINING SCHEDULE'],
 yes:'The astronauts learn their spacecraft from the inside. Systems knowledge rises, at the cost of some training time.',no:'Training stays on schedule. The astronauts feel shut out.'}};
export function officeChoice(yes){const P=p2(),k=P.od,o=OFFICE[k];if(!o)return;if(yes&&o.c&&S.b<o.c)return;P.od=null;const cr=P.astros.filter(a=>a.st=='active'||a.st=='grounded'),bump=(s,v)=>cr.forEach(a=>{a.t[s]=Math.max(10,Math.min(95,a.t[s]+v))});
if(yes){if(o.c)S.b-=o.c;P.fl[k]=1;if(k=='life'){S.rep=Math.min(100,S.rep+5);P.gmul+=.05;cr.forEach(a=>a.fat=Math.min(100,a.fat+6))}else if(k=='cock'){bump('sys',4);cr.forEach(a=>a.tday=Math.max(0,a.tday-15))}}
else{if(k=='win'||k=='ovr'){bump('com',-3);cr.forEach(a=>a.fat=Math.min(100,a.fat+6))}else if(k=='cock')bump('com',-2);else if(k=='life')S.rep=Math.max(0,S.rep-1)}
lg(`[${o.who}] ${yes?o.yes:o.no}`,yes?'ok':'wn')}
export function scheduleOffice(){const P=p2(),d=S.day,r=a=>Math.round(d+a+Math.random()*60);P.oq=[{k:'life',at:r(25)},{k:'win',at:r(110)},{k:'ovr',at:r(230)},{k:'cock',at:r(340)}]}
// The chimpanzee colony at Holloman Air Force Base: months of lever training before an animal can fly.
export const CHIMP_COST=20000;
export function startChimps(){const P=p2();if(P.ch.on||S.b<CHIMP_COST)return;S.b-=CHIMP_COST;P.ch.on=1;lg(`[HOLLOMAN] Six chimpanzees begin training at Holloman Air Force Base (${K(CHIMP_COST)}): couches, pressure suits and lever tasks on cue.`,'wn')}

export function officeTick(dd){const P=p2();if(!P)return false;let ch=false;
if(dirKey()=='rate'&&(certified()||checkCert())){fulfil(DIR2[P.dir]);ch=true}
if(P.sel.st==0&&S.day>=P.sel.at){P.pool=makePool(16);P.sel.st=1;lg('[ASTRONAUT OFFICE] Interviews and written tests have narrowed 110 test pilots to 16 finalists. Choose how thoroughly to test them.','hd');ch=true}
if(P.sel.st==2&&S.day>=P.sel.at){finishTesting();ch=true}
if(P.ch.on&&P.ch.t<1){P.ch.t=Math.min(1,P.ch.t+dd/150);if(P.ch.t>=1){lg('[HOLLOMAN] The chimpanzees are trained and ready to fly.','ok');ch=true}}
if(!P.od&&P.oq.length&&S.day>=P.oq[0].at){P.od=P.oq.shift().k;lg(`[${OFFICE[P.od].who}] ${OFFICE[P.od].q} (Astronaut Office)`,'hd');ch=true}
if(P.elec==0&&S.day>=ELECTION){P.elec=1;lg('[WASHINGTON] A new President is elected. His science advisers will review whether Mercury is worth the risk before the inauguration.','hd');ch=true}
if(P.elec==1&&S.day>=INAUGURATION){P.elec=2;if(P.dir>=3){P.gmul+=.1;lg('[WASHINGTON] The new administration\'s review backs Mercury. Appropriations +10%.','hd')}else{P.gmul=Math.max(.6,P.gmul-.1);lg('[WASHINGTON] The new administration\'s review questions whether Mercury is ready. Appropriations cut by 10%.','bad')}ch=true}
return ch}

// Phase Two state appears the first tick after NASA is established. Older saves are brought up to date here.
export function ensureP2(){if(!S.p2){S.p2=fresh2();lg('[ASTRONAUT OFFICE] NASA begins screening 508 military service records: jet pilots under 40 and under 5 ft 11 in, with 1,500 flying hours and test pilot school.','hd');return}
const P=S.p2;if(P.v==2){P.v=3;if(P.bd=='skip'&&P.dir==5&&!certified())P.dir=4;delete P.bd;return}if(P.v>=3)return;const old=P.dir;S.p2=Object.assign(fresh2(),P,{v:3});const Q=S.p2;Q.sel={st:Q.selDone?4:Q.pool.length?3:0,at:Math.round(S.day+20),reg:'std'};
if(old>=2)Q.lj={ok:3,mk:1};if(old>=4)Q.dir=old==4?4:6;if(old>=3)Q.ch={on:1,t:1};if(Q.selDone)scheduleOffice()}

export function manualAbort(M){if(M.done||M.pend)return;if(M.mt=='bj'||M.mt=='ma'||M.t>(M.m.sep||M.m.abortAt||0)){say(M,'Abort requested, but there is no escape tower to fire. The flight continues.','wn');return}say(M,'MANUAL ABORT commanded.','bad');M.out.boost=1;towerFires(M)}
