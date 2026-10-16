// Phase Two screens: the Astronaut Office, the Mercury mission planner, the Section 1 directive, and the memorial and section-complete overlays.
import { K } from './util.js';
import { STN, FACS } from './data.js';
import { S, dateOf } from './state.js';
import { SKILLS, FOCUS, QUAL_DAYS, est, qualified, simTier, active } from './astro.js';
import { MT, DIR2, reqText, crewLock, rel, dirKey, REGIME, OFFICE, CHIMP_COST, boosterPlan, needText, boosters } from './mercury.js';
import { mrate, MR_NEED, MR_RES, rated, familyCertified, certified, ratedNames } from './manrate.js';
import { PROGS } from './programs.js';
import { FUEL, BY as BYD } from './data.js';
import { kerLock, quoteLaunch } from './design.js';
import { done } from './state.js';
const $=q=>document.querySelector(q);
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);
export const sel=new Set();
const pct=v=>v>=.995?'99.5%':Math.round(v*100)+'%';
const SIM=['Classroom only','Procedures trainer','Mission simulator'];
const REH={att:'attitude failure',ecs:'cooling failure',tj:'tower jettison',abort:'launch abort',retro:'retrofire failure',hatch:'emergency egress'};

function skillBar(a,k){const e=est(a,k),lo=Math.max(0,e.v-e.w),hi=Math.min(100,e.v+e.w);
return`<div class="sk"><span class="d">${SKILLS[k]}</span><span class="skb"><i style="left:${lo}%;width:${hi-lo}%"></i><b style="left:${e.v}%"></b></span><span class="skv">${e.v}${e.w>2?` ±${e.w}`:''}</span></div>`}
// pick: 0 roster, 1 selectable, 2 view only (during testing)
function card(a,pick){const q=qualified(a),tr=Math.min(1,a.tday/QUAL_DAYS);
let h=`<div class="c astro${pick==1&&sel.has(a.id)?' on':''}"><div class="r"><b>${esc(a.name)}</b><span class="d">${a.svc}</span></div><div class="m">Age ${a.age} • ${a.hrs.toLocaleString()} jet hours • ${a.tps?'test pilot school graduate':'no test pilot school'} • ${a.deg}</div>`+Object.keys(SKILLS).map(k=>skillBar(a,k)).join('');
if(pick){if(a.dq)return h+'<div class="bad">Medically disqualified.</div></div>';return h+(pick==1?`<button data-a="selt" data-id="${a.id}">${sel.has(a.id)?'SELECTED ✓':'SELECT'}</button>`:'')+'</div>'}
if(a.st=='medical')return h+'<div class="bad">Permanently grounded (heart condition). Works in the Astronaut Office.</div></div>';
h+=`<div class="r"><span class="d">${a.st=='grounded'?`Grounded (${Math.ceil(a.gd/30)} months)`:q?'Flight qualified':`General training ${pct(tr)}`}</span><b class="${a.fat>60?'bad':a.fat>35?'wn':'ok'}">Fatigue ${Math.round(a.fat)}</b></div><div class="bar"><i style="width:${tr*100}%"></i></div>`;
if(a.asg)h+=`<div class="r"><span class="d">Assigned: ${MT[a.asg].full}</span><b>${pct(a.mt)} mission training</b></div><div class="bar"><i style="width:${a.mt*100}%"></i></div>`;
const reh=Object.keys(a.reh).filter(k=>a.reh[k]);if(reh.length)h+=`<div class="m">Rehearsed in the simulator: ${reh.map(k=>REH[k]).join(', ')}.</div>`;
h+=`<div class="m">${a.flights?`${a.flights} flight${a.flights>1?'s':''}. `:''}</div><select data-focus="${a.id}">${Object.entries(FOCUS).filter(([k])=>k!='msn'||a.asg).map(([k,v])=>`<option value="${k}"${a.focus==k?' selected':''}>Training: ${v}</option>`).join('')}</select>`;
if(q&&!a.asg)h+=`<button data-a="asg" data-id="${a.id}">ASSIGN AS PILOT FOR THE NEXT MERCURY-REDSTONE</button>`;return h+'</div>'}

// A pending office decision, shown on the Astronaut Office and the Launch tab.
export function officeHTML(){const P=S.p2;if(!P||!P.od)return'';const o=OFFICE[P.od];return`<div class="c decide"><div class="t">${o.who}: DECISION NEEDED</div><div>${o.q}</div><div class="two"><button data-a="offy"${o.c&&S.b<o.c?' disabled':''}>${o.a[0]}</button><button data-a="offn">${o.a[1]}</button></div></div>`}

function selectionHTML(P){const st=P.sel.st;
if(st==0)return`<div class="m">NASA is screening 508 military service records for test pilots who meet the criteria. A shortlist is expected around <b>${dateOf(P.sel.at)}</b>.</div>`;
if(st==1)return`<div class="m">Interviews have narrowed the field to ${P.pool.length} finalists. Choose how thoroughly to test them. The full programme takes longer and costs more, but it reveals more about each finalist and catches every hidden medical problem; standard examinations miss about half.</div>
<div class="two">${Object.entries(REGIME).map(([k,g])=>`<button data-a="reg" data-id="${k}"${S.b<g.c?' disabled':''}>${g.n.toUpperCase()} (${K(g.c)}, ${g.d} DAYS)</button>`).join('')}</div><div class="cards">${P.pool.map(a=>card(a,2)).join('')}</div>`;
if(st==2)return`<div class="m">${REGIME[P.sel.reg].n} under way. Results around <b>${dateOf(P.sel.at)}</b>.</div><div class="cards">${P.pool.map(a=>card(a,2)).join('')}</div>`;
return`<div class="m">Choose between three and seven astronauts. The ranges narrow further once training shows what each person can really do.</div><div class="cards">${P.pool.map(a=>card(a,1)).join('')}</div><button data-a="selok" class="big"${sel.size<3||sel.size>7?' disabled':''}>CONFIRM SELECTION (${sel.size} chosen, 3 to 7)</button>`}

export function rAstro(){const P=S.p2,o=$('#ao'),o2=$('#ao2');if(!o)return;if(!P){o.innerHTML='<div class="m">The Astronaut Office opens when NASA is established.</div>';o2.innerHTML='';return}
o.innerHTML=officeHTML()+(!P.selDone?selectionHTML(P):`<div class="m">General training takes about ${QUAL_DAYS} days before an astronaut can be assigned; a flight then needs mission training. Simulator: <b>${SIM[simTier()]}</b>.</div><div class="cards">${P.astros.filter(a=>a.st!='lost').map(a=>card(a,0)).join('')}</div>`);
const fac=[['centrifuge','Centrifuge'],['zerog','Zero-G aircraft'],['egress','Egress tank'],['ptrain','Procedures trainer'],['msim','Mission simulator']];
const ch=P.ch.t>=1?'<b class="ok">Trained and ready</b>':P.ch.on?`<b>${pct(P.ch.t)} trained</b>`:`<button data-a="chimps"${S.b<CHIMP_COST?' disabled':''}>START TRAINING (${K(CHIMP_COST)})</button>`;
o2.innerHTML=`<div class="t">ANIMAL PROGRAMME</div><div class="r"><span class="d">Chimpanzee colony, Holloman AFB</span>${ch}</div><div class="m">About five months of lever and couch training before a chimpanzee can fly. Little Joe monkeys need no special training.</div>
<div class="t" style="margin-top:10px">TRAINING FACILITIES</div>${fac.map(([k,n])=>`<div class="r"><span class="d">${n}</span><b class="${S.fac[k]?'ok':'d'}">${S.fac[k]?'Operational':'Not built (Hangar & Base)'}</b></div>`).join('')}
<div class="t" style="margin-top:10px">FLIGHT CONTROLLERS</div>${['capcom','surg'].map(k=>`<div class="r"><span class="d">${STN[k].n}</span><b class="${S.crew[k]?'ok':'d'}">${S.crew[k]?'On console':'Vacant (Personnel)'}</b></div>`).join('')}
${P.mem.length?`<div class="mem"><div class="t">IN MEMORIAM</div>${P.mem.map(m=>`<div><b>${esc(m.name)}</b>, ${m.svc}<div class="m">${m.mission}, ${dateOf(m.d)}</div></div>`).join('')}</div>`:''}`}

// THE MAN-RATING BOARD: what stands between your boosters and a crew.
export function manrateHTML(){const P2=S.p2,af=S.air.find(a=>a.id==(P2&&P2.lb)),kind=af?af.prog:S.cur,m=mrate(kind),ok=x=>x?'<b class="ok">✓</b>':'<b class="d">○</b>',fam=familyCertified(kind),nm=PROGS[kind]?PROGS[kind].n:'Booster';
return`<div class="c"><div class="t">MAN-RATING BOARD</div><div class="m">A crew rides only a certified booster. Each rocket programme earns its own certification: ${MR_NEED} clean flights in a row by one booster family (every revision since its last milestone) and the man-rating research. Any flight counts, Mercury or ordinary.</div>
<div class="r"><span class="d">${nm} family</span><b>Rev ${m.base} onward</b></div><div class="r"><span class="d">Clean flights in a row</span><b class="${m.streak>=MR_NEED||fam?'ok':''}">${fam?'certified':`${Math.min(m.streak,MR_NEED)} of ${MR_NEED}`}</b></div>
${MR_RES.map(id=>`<div class="r"><span class="d">${BYD[id].n}</span>${ok(done(id))}</div>`).join('')}
<div class="r"><span class="d">Certified boosters</span><b class="${certified()?'ok':'d'}">${ratedNames().join('; ')||'none yet'}</b></div></div>`}

const SYS={bj:[['hs','Heat shield'],['pc','Parachutes']],lj:[['et','Escape tower'],['as','Abort sensing'],['pc','Parachutes']],ma:[['hs','Heat shield'],['ec','Environmental control'],['pc','Parachutes']],
mr:[['as','Abort sensing'],['et','Escape tower'],['tj','Tower jettison'],['ac','Attitude control'],['ec','Environmental control'],['hs','Heat shield'],['pc','Parachutes'],['lb','Landing bag']]};
// Mission planner on the Launch tab: order capsules, then pair a capsule with a booster from the hangar.
const kms=x=>`${Math.round(x/1000).toLocaleString()} km`;
export function rMissions(){const P=S.p2,box=$('#pm');if(!box)return;box.hidden=!P;if(!P)return;const veh=P.veh,inProd=k=>S.aq.filter(q=>q.k=='msn'&&q.mt==k).length;
let h=Object.entries(MT).map(([k,m])=>{const r=reqText(k),n=veh.filter(v=>v.mt==k).length;return`<div class="c"><div class="r"><b>${m.full}</b><span class="d">${n} capsule${n==1?'':'s'} ready${inProd(k)?`, ${inProd(k)} building`:''}</span></div><div class="m">${m.why}</div><button data-a="mord" data-id="${k}"${r||S.b<m.c?' disabled':''}>ORDER ${m.cap.toUpperCase()} (${K(m.c)}, ${m.t}s)</button>${r?`<div class="m">${r}</div>`:''}</div>`}).join('');
const bs=boosters();
if(veh.length){const v=veh.find(x=>x.id==P.lv)||veh[0];P.lv=v.id;const crewOpts=v.mt=='mr'?['none','chimp',...active().filter(a=>a.asg=='mr').map(a=>a.id)]:v.mt=='lj'?['none','monkey']:['none'];if(!crewOpts.includes(P.lc))P.lc='none';
const fuelFor=a=>{const f=PROGS[a.prog].fuels;return f.includes(P.lf)?P.lf:f[0]};
const plans=bs.map(af=>({af,p:boosterPlan(af,fuelFor(af),v.mt)}));if(!bs.find(a=>a.id==P.lb)){const best=plans.find(x=>x.p.ok&&(P.lc=='none'||P.lc=='chimp'||P.lc=='monkey'||rated(x.af)))||plans.find(x=>x.p.ok)||plans[0];P.lb=best&&best.af.id}
const af=bs.find(a=>a.id==P.lb);if(af)P.lf=fuelFor(af);const fuels=af?PROGS[af.prog].fuels:Object.keys(FUEL),pl=af&&boosterPlan(af,P.lf,v.mt),q=af&&pl?quoteLaunch(af,P.lf,'Mercury Capsule',pl.st,1):null;
const r=rel(v.cfg),sys=SYS[v.mt],lock=!af?'No booster in the hangar. Order airframes in Hangar & Base.':!pl.ok?`${af.label} cannot deliver ${needText(v.mt)} with a capsule aboard.`:q.err?q.err:S.b<q.t?`Need ${K(q.t-S.b)} more for propellant and the pad.`:crewLock(P.lc,af);
const nm=c=>c=='none'?'No crew (instruments only)':c=='chimp'?'Chimpanzee':c=='monkey'?'Rhesus monkey':`Astronaut: ${(P.astros.find(a=>a.id==c)||{}).name}`;
h+=`<div class="c"><div class="t">PREPARE A FLIGHT</div><select data-mv="1">${veh.map(x=>`<option value="${x.id}"${x.id==v.id?' selected':''}>${MT[x.mt].cap} #${x.id} (Rev ${x.cfg.rev}) • ${MT[x.mt].n}</option>`).join('')}</select>
<select data-mb="1">${bs.length?plans.map(({af:a,p})=>`<option value="${a.id}"${a.id==P.lb?' selected':''}>Booster: ${a.label}, Rev ${a.rev}${rated(a)?' • man-rated':''}${p.ok?'':' • too weak'}</option>`).join(''):'<option>No boosters in the hangar</option>'}</select>
<select data-mf="1">${fuels.map(f=>`<option${f==P.lf?' selected':''}>${f}</option>`).join('')}</select>
<select data-mc="1">${crewOpts.map(c=>`<option value="${c}"${c==P.lc?' selected':''}>${nm(c)}</option>`).join('')}</select>
${af?`<div class="m">With the capsule aboard, ${af.label} ${pl.st?'(staged)':'(single stage)'} should reach <b>${kms(pl.pv.alt)}</b> and <b>${Math.round(pl.pv.spd).toLocaleString()} m/s</b>. This mission needs ${needText(v.mt)}: ${pl.ok?'<b class="ok">enough</b>':'<b class="bad">not enough</b>'}. Liftoff thrust-to-weight ${pl.pv.twr.toFixed(2)}.${q&&!q.err?` Propellant and pad ${K(q.t)}.`:''}</div>`:''}
<div class="m">Capsule systems${r.un?` (${r.un} unproven package${r.un>1?'s':''} aboard)`:''}:</div><div class="rels">${sys.map(([k,n])=>`<div class="r"><span class="d">${n}</span><b class="${r.R(k)<.85?'bad':r.R(k)<.92?'wn':'ok'}">${pct(r.R(k))}</b></div>`).join('')}</div>
<button data-a="mcount" class="big"${lock?' disabled':''}>BEGIN COUNTDOWN</button>${lock?`<div class="m bad">${lock}</div>`:''}</div>`}
else if(!bs.length)h+='<div class="m">Capsules fly on your own boosters: keep airframes in the hangar.</div>';
h+=manrateHTML()+(P.lastTx?'<button data-a="txview">LAST FLIGHT: AIR-TO-GROUND TRANSCRIPT</button>':'');
box.querySelector('#mp').innerHTML=h}

function sideHTML(P){const net=S.fac.trknet?'<b class="ok">in service</b>':S.fb&&S.fb.trknet?`under construction, in service around ${dateOf(S.fb.trknet)}`:'<b class="wn">not started</b> (Hangar & Base)';
return`<div class="m">Tracking network: ${net}. Orbital qualification (optional): ${P.fl.maQual?'<b class="ok">done</b>':P.ma.n?`${P.ma.n} flown, not yet successful`:'not flown'}.</div>`}
export function p2Directive(){const P=S.p2;if(!P)return'';if(P.secDone)return`<div class="ok">Section 1 complete ${dateOf(P.secDone)}: an American has flown in space, and the country is committed to the Moon.</div><button data-a="sec1">VIEW SECTION 1 SUMMARY</button><div class="m">Section 2 (Mercury-Atlas and Gemini) is in development.</div>`;
const D=DIR2[P.dir],k=D.k;let x='';
if(k=='lj')x=`<div class="m">Good aborts so far: ${P.lj.ok} of 3. Monkey flight: ${P.lj.mk?'<b class="ok">done</b>':'still needed'}.</div>`;
if(k=='animal'&&P.ch.t<1)x=`<div class="m">${P.ch.on?`Chimpanzee training ${pct(P.ch.t)}.`:'Start chimpanzee training in the Astronaut Office.'}</div>`;
if(k=='rate'){const m=mrate();x=`<div class="m">Clean flights in a row: ${Math.min(m.streak,MR_NEED)} of ${MR_NEED} (${PROGS[S.cur]?PROGS[S.cur].n:''} Rev ${m.base}+ family). Research: ${MR_RES.filter(done).length} of ${MR_RES.length}.</div>`}
return`<div class="t">Mercury directive ${P.dir+1} of ${DIR2.length}: ${D.n}</div><div class="m">${D.d} Reward ${K(D.r)}.</div>${x}${sideHTML(P)}${officeHTML()}`}

// Full-screen overlays. The memorial is shown once, plainly.
export function memorialHTML(m){return`<div class="memo"><div class="d">IN MEMORIAM</div><h1>${esc(m.name)}</h1><div>Lost on the ${m.mission}.</div><div class="m">Crewed flights are stood down while a review board finds out what went wrong.</div><button data-a="memok">CONTINUE</button></div>`}
export function sectionHTML(){const P=S.p2,hist=(S.hist||[]).filter(h=>h.d>=(S.nasa||0));
return`<div class="sumbox"><h1>SECTION 1 COMPLETE</h1><div class="d">Project Mercury: from NASA's founding to the first American in space • ${dateOf(P.secDone)}</div>
<div class="sumg"><div><h2>THE ROAD TO SPACE</h2>${hist.map(h=>`<div class="first"><span>${esc(h.t)}</span><b class="d">${dateOf(h.d)}</b></div>`).join('')}</div>
<div><h2>THE ASTRONAUTS</h2>${P.astros.map(a=>`<div class="first"><span>${esc(a.name)} <span class="d">${a.svc}</span></span><b class="${a.st=='lost'?'bad':'d'}">${a.st=='lost'?'lost':a.st=='medical'?'grounded':`${a.flights} flight${a.flights==1?'':'s'}`}</b></div>`).join('')}
<h2 style="margin-top:14px">THE RACE</h2><div class="m">First human in space: ${S.fs.f_human=='us'?'<b class="ok">you</b>':'<b class="bad">the Soviet Union</b> (Vostok 1)'}. Mercury flights flown: ${P.flights}. Man-rated boosters: ${ratedNames().join('; ')||'none'}. Orbital qualification: ${P.fl.maQual?'done, a head start for orbit':'not yet'}.</div>
<div class="m">Historically, NASA flew one more uncrewed Redstone in March 1961 to finish man-rating it. Vostok 1 flew on 12 April and Freedom 7 on 5 May. On 25 May the President asked Congress to land a man on the Moon before 1970.</div></div></div>
<div class="m">Section 2 (Mercury-Atlas, Gemini and spacewalks) is in development. You can keep flying and training in the meantime.</div><button data-a="closesum">CONTINUE</button></div>`}
