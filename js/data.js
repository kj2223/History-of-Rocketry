// Static content: propellants, payloads, directives, work packages, failure modes, facilities. Tune balance here.
export const $=q=>document.querySelector(q),K=n=>'$'+Math.round(n).toLocaleString(),gauss=()=>{let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v)};
// Propellant cost = handling c + per-kg price x mass loaded, so it grows with the rocket.
export const FUEL={'Alcohol & LOX':{c:1200,kg:40,isp:225,rel:.9,den:1},'Kerosene & LOX':{c:2000,kg:50,isp:290,rel:.85,den:1.25}};
// Payloads. sci = science value at 30 km (scales with altitude), tlm = share that telemetry returns if the payload is NOT recovered, req = package needed.
export const PAY={'Inert Ballast':{c:500,m:10,sci:0},'Sensor Suite':{c:2000,m:25,sci:4000,tlm:.5},'Cosmic-Ray Package':{c:3000,m:20,sci:6000,tlm:.6,req:'cosm'},'Film Camera':{c:3500,m:30,sci:9000,tlm:0,req:'film'},'Primate Capsule':{c:6000,m:45,sci:12000,tlm:.3,bio:1,req:'bio'},'Explorer Satellite':{c:15000,m:20,sci:25000,sat:1},
// Carried only on Mercury flights; the capsule itself is built and paid for separately.
'Mercury Capsule':{c:0,m:100,sci:0,msn:1}};
export const DIR=[['Sub-Orbital Hop',3,15000],['Lower Atmosphere',15,35000],['Upper Stratosphere',35,60000],['Mesosphere Frontier',65,100000],['First Artificial Satellite',120,250000]];
export const NEWS=['Defense officials want sounding data to calibrate radar grids.','Congress asks for atmospheric density figures before funding larger boosters.','Papers speculate about rockets that climb above the weather.','Rivals abroad are testing larger engines. Prestige is now policy.','The White House backs an orbital satellite. The world is watching.'];
export const ERAS=[['SOUNDING ROCKET ERA','Radar plots, a radio beacon and slide rules.'],['MISSILE & STAGING AGE','Telemetry, test data and talk of stacking stages.'],['THE SATELLITE RACE','Orbit or bust. Every headline is a scoreboard.']];
// Research time is scaled to 75% of the listed figure.
// Phase Two work takes 2.5 times as long in play seconds, matching its slower calendar.
export const R=(id,a,n,c,t,e,x={})=>({id,a,n,c,t:Math.round(t*.75*(x.ph==2?2.5:1)),e,...x});
export const PK=[R('inj','p','Injector pattern trials',3000,80,{t:.05,r:.01}),R('mix','p','Mixture-ratio tests',3500,100,{t:.06}),R('noz','p','Nozzle contour refinement',4500,120,{t:.08,d:1}),R('seal','p','Pump bearing and seal work',5000,150,{t:.04,r:.025}),R('cool','p','Cooling jacket revisions',6000,180,{t:.07,r:.02,d:2}),R('imp','p','Turbopump impeller redesign',7000,200,{t:.06,r:.015,d:1}),
R('gauge','s','Tank wall gauge study',3000,80,{f:6,d:-1}),R('vol','s','Tankage volume extension',5000,150,{f:12,d:2}),R('weld','s','Weld and seam quality program',3500,100,{g:.6,r:.01}),R('ring','s','Stiffening ring layout',4500,120,{g:.8,d:2}),R('alloy','s','Alloy substitution trials',6000,180,{g:.6,f:6,d:-2}),R('prs','s','Tank pressurization study',7000,200,{f:10,g:.3,d:1}),
R('bea','i','Radio beacon refinement',2000,60,{i:.4}),R('fm','i','FM telemetry transmitter',3500,90,{i:.6,d:1}),R('xdc','i','Pressure transducers',4500,120,{i:.5,d:1}),R('str','i','Strain gauge installation',5000,140,{i:.5,d:1}),R('acc','i','Accelerometer package',6000,160,{i:.5,d:1}),R('mux','i','Telemetry channel multiplexing',7000,190,{i:.4,d:1}),
// Experimental work: bigger potential, wide uncertainty, and a chance (dud) of turning out a dead end. Effects can be negative.
R('addv','p','Fuel additive trials (hydrazine blends)',4000,90,{t:.10,r:-.02},{dud:.35}),R('swirl','p','Swirl injector experiments',3800,100,{t:.07,r:.01},{dud:.3}),R('abl','p','Ablative chamber liner',5500,130,{r:.03,d:2},{dud:.15}),R('monop','p','Monopropellant turbine drive',6500,160,{t:.09,d:-1,r:-.01},{dud:.4}),
R('mono','s','Monocoque skin experiments',4000,100,{g:.9,d:-2},{dud:.3}),R('tankint','s','Integral tank construction',5500,140,{f:14,g:.4,d:-1},{dud:.25}),R('magn','s','Magnesium alloy skin trial',4800,120,{d:-3,g:-.3},{dud:.35}),R('bulk','s','Common-bulkhead tankage',6000,150,{f:18,d:-2,r:-.01},{dud:.3}),
R('tape','i','Onboard tape recorder',3000,80,{i:.2},{dud:.2}),R('subc','i','Subcarrier telemetry multiplex',4000,100,{i:.3,d:1},{dud:.25}),R('gyro','i','Rate gyro package',5200,130,{i:.3,r:.01,d:1},{dud:.3}),R('cam','i','Instrument camera package',3500,90,{i:.15,d:1},{dud:.2}),
// AERODYNAMICS: c = drag change, h = heat tolerance, q = dynamic-pressure (aero load) limit
R('ogive','a','Nose ogive profile study',3000,80,{c:-.05}),R('fins','a','Fin shape and sizing trials',3500,100,{c:-.04,q:.12}),R('flush','a','Flush-riveted skin',4000,110,{c:-.05,d:1}),R('wt','a','Wind tunnel program',5000,130,{c:-.06,q:.1}),R('ablnose','a','Ablative nose tip',4500,120,{h:.12,d:1}),R('insul','a','Skin insulation coating',5200,140,{h:.15,d:2}),R('flut','a','Fin flutter testing',4800,120,{q:.24,d:1}),
R('area','a','Area-rule fuselage shaping',6000,150,{c:-.12,q:-.08},{dud:.35}),R('hsink','a','Copper heat-sink nose',5500,130,{h:.21,d:4},{dud:.25}),R('blunt','a','Blunt-body nose shape',5000,120,{h:.18,c:.06},{dud:.3}),
// PAYLOADS & RECOVERY: rc = recovery chance, rv = re-entry speed the payload survives (m/s), sv = science return
R('chute','r','Nose-cone parachute',3000,80,{rc:.35,d:3}),R('bcn','r','Recovery radio beacon',2500,70,{rc:.12,d:1}),R('dye','r','Sea-dye marker & flotation bag',2000,60,{rc:.08,d:1}),R('psep','r','Payload separation mechanism',4000,100,{rc:.1,d:2}),R('hs1','r','Ablative heat-shield nose cone',5500,140,{rv:600,d:4}),
R('cosm','r','Cosmic-ray counter',3000,80,{sv:.15}),R('film','r','Film camera & recoverable canister',4500,110,{sv:.1,d:1}),R('bio','r','Biological life-support capsule',6000,150,{sv:.1,d:3}),
R('ball','r','Ballute decelerator',4500,110,{rc:.18,rv:300,d:2},{dud:.35}),R('snatch','r','Mid-air retrieval by aircraft',5000,120,{rc:.22},{dud:.4}),R('beryl','r','Beryllium heat-sink shield',6500,150,{rv:900,d:6},{dud:.3}),
// SECOND-GENERATION WORK: needs a tier-1 milestone in its area (need:1)
R('gimbal','p','Gimbaled thrust chamber',6000,150,{t:.04,r:.02,d:2},{need:1}),R('regen','p','Regenerative cooling overhaul',7000,170,{t:.08,r:.01,d:3},{need:1}),R('hyprop','p','Hypergolic upper-stage propellant tests',6500,160,{t:.07,r:-.01},{need:1,dud:.3}),
R('chem','s','Chem-milled tank walls',6000,150,{f:8,d:-3},{need:1}),R('lattice','s','Interstage lattice truss',5500,140,{g:.6,d:2},{need:1}),R('sepr','s','Separation retro-rockets',6000,150,{r:.015,d:1},{need:1}),
R('trans','i','Transistor amplifier trials',5500,140,{i:.3,d:-1},{need:1,dud:.3}),R('pcm','i','PCM digital telemetry',6500,160,{i:.4},{need:1}),R('antp','i','Antenna pattern study',4500,120,{i:.2,r:.005},{need:1}),
R('boat','a','Boat-tail shaping',5000,130,{c:-.04},{need:1}),R('fairing','a','Payload fairing redesign',5500,140,{c:-.05,d:1},{need:1}),R('ablfair','a','Ablative fairing coating',6000,150,{h:.12,d:2},{need:1,dud:.25}),
R('biotel','r','Biotelemetry harness',5000,130,{sv:.1},{need:1}),R('ribbon','r','Ribbon parachute',5500,140,{rc:.1,rv:200,d:1},{need:1}),R('sofar','r','SOFAR sound-channel beacon',4500,120,{rc:.08},{need:1}),
// PHASE TWO, SECTION 1 (open once NASA is established). Effects are subsystem reliability (+0.10 = 10 points) unless noted.
// c = Mercury Spacecraft: hs heat shield, ec environmental control, ac attitude control, rr retrorockets, pc parachutes, lb landing bag; man = manual control fitted
R('cap_shape','c','Blunt-body capsule shape and heat studies',8000,110,{hs:.06,lb:.02},{ph:2}),R('cap_ecs','c','Environmental control system',9000,130,{ec:.10},{ph:2}),
R('cap_chute','c','Drogue, main and reserve parachutes',8000,120,{pc:.10},{ph:2}),R('cap_asc','c','Automatic stabilization and control (ASCS)',10000,140,{ac:.08},{ph:2}),
R('cap_retro','c','Retropack and posigrade rockets',9000,130,{rr:.10},{ph:2}),R('cap_bag','c','Landing bag impact attenuator',7000,100,{lb:.08},{ph:2}),
R('cap_fbw','c','Manual and fly-by-wire attitude control',8000,120,{ac:.04,man:1},{ph:2}),R('cap_peri','c','Pilot window and periscope',6000,90,{man:.5,ac:.02},{ph:2,dud:.25}),
// e = Escape & Man-Rating: et escape tower, as abort sensing, tj tower jettison, mr Redstone reliability, rq recovery aids
R('esc_tower','e','Launch escape tower',10000,130,{et:.12},{ph:2}),R('mr_mods','e','Booster man-rating modifications',12000,160,{mr:.08},{ph:2}),
R('esc_asis','e','Abort sensing and implementation system',11000,150,{as:.14},{ph:2}),R('esc_jett','e','Tower jettison and backup sequencer',7000,100,{tj:.10,et:.03},{ph:2}),
R('esc_sea','e','Recovery beacon, dye marker and SOFAR bomb',6000,90,{rq:.15},{ph:2}),R('mr_tank','e','Elongated booster tankage',9000,130,{mr:.04},{ph:2,dud:.2}),
// Found only by investigation: each appears after the failure it cures.
R('mr_umb','e','Umbilical disconnect sequencing',6000,80,{um:1},{ph:2,hid:'four'}),R('ma_band','e','Atlas stiffening band',8000,110,{mab:.12},{ph:2,hid:'maFail'})];
// MILESTONES. tier 1: after an area's breakthrough (5 confirmed packages) choose ONE approach. tier 2: after a tier-1 milestone and 9 confirmed packages in the area.
// tier 'x': joint programmes needing a tier-1 milestone in both areas listed in xa. pay = one-time contract on completion.
export const MSL=[
R('ms_eng','p','High-Performance Engine Program',60000,300,{t:.7,r:.03,d:4},{tier:1,why:'Push chamber pressure hard. Big thrust gains, modest reliability.'}),
R('ms_rel','p','Engine Reliability Program',45000,260,{t:.3,r:.08,d:2},{tier:1,why:'Qualify every component. Less thrust, far fewer failures.'}),
R('ms_tp','p','Turbopump Kerosene Engine (Thor class)',80000,360,{t:.6,r:.03,d:6},{tier:2,why:'A production-grade missile engine.'}),
R('ms_stg','s','Liquid Upper Stage (Vanguard route)',65000,320,{g:4,f:80,d:8},{tier:1,why:'A new liquid second stage. Efficient and capable, but every part is new.'}),
R('ms_clu','s','Clustered Solid Upper Stages (Jupiter-C route)',40000,220,{g:3,f:40,d:4},{tier:1,why:'Bundle proven small solid motors. Quick and cheap, with a harder kick at staging and a riskier separation.'}),
R('ms_balloon','s','Pressure-Stabilized Balloon Tanks (Atlas)',75000,340,{f:70,d:-6,g:-.8},{tier:2,why:'Stainless tanks as thin as a coin, held rigid by their own pressure.'}),
R('ms_in','i','Inertial Platform & Full Telemetry',50000,260,{i:1,d:3},{tier:1,why:'Gyros aboard the vehicle measure everything themselves.'}),
R('ms_rg','i','Radio Guidance from the Ground',35000,200,{i:.7,r:.02},{tier:1,why:'Ground radar steers the vehicle. Cheaper and lighter, less self-contained.'}),
R('ms_tran','i','Transistorized Telemetry',60000,280,{i:.8,d:-3},{tier:2,why:'Vacuum tubes give way to transistors: lighter, with more channels.'}),
R('ms_aero','a','Supersonic Airframe & Thermal Protection Program',60000,300,{c:-.15,h:.375,q:.4,d:3},{tier:1,why:'Slender, stiff and protected. Faster through the dense air.'}),
R('ms_blunt','a','Blunt-Body Re-entry Research',45000,240,{h:.6,c:.05,q:.1,d:2},{tier:1,why:'A blunt shape pushes the heat away. More drag, far more heat tolerance.'}),
R('ms_hyp','a','Hypersonic Wind Tunnel Program',70000,320,{c:-.1,q:.3,h:.2},{tier:2,why:'Test shapes at Mach 7 on the ground.'}),
R('ms_rec','r','Recoverable Re-entry Capsule Program',55000,280,{rc:.25,rv:2500,sv:.3,d:5},{tier:1,why:'A capsule built to come home.'}),
R('ms_bio','r','Biomedical Flight Program',45000,240,{sv:.4,rc:.1,d:3},{tier:1,why:'Instrumented animal flights. The science and the headlines pay well.'}),
R('ms_disc','r','Film-Return Satellite Capsule (Discoverer)',80000,360,{rc:.2,rv:4000,sv:.3,d:4},{tier:2,why:'Catch a capsule falling from orbit, in mid-air.'}),
R('ms_beh','c','Beryllium Heat Sink',45000,240,{hs:.14},{tier:1,ph:2,why:'A thick beryllium shield soaks up the heat. Proven and forgiving on a suborbital arc, but too heavy for orbit.'}),
R('ms_ablh','c','Fibreglass Ablative Heat Shield',45000,240,{hs:.10,orb:1},{tier:1,ph:2,why:'A shield that chars and erodes away, carrying the heat with it. Lighter, and it will handle orbital re-entry, but it is less proven.'}),
R('ms_mqual','c','Mercury Capsule Qualification Program',60000,280,{hs:.04,ec:.05,ac:.05,rr:.04,pc:.05,lb:.04},{tier:2,ph:2,why:'Altitude chambers, drop tests and shake tables for every capsule system.'}),
R('ms_hxp','e','Explosive Side Hatch',38000,200,{eg:.25,hb:.05},{tier:1,ph:2,why:'A ring of explosive bolts blows the hatch off in an instant. Fast egress, with a small risk it fires on its own.'}),
R('ms_hbolt','e','Bolted Side Hatch',30000,180,{eg:.05},{tier:1,ph:2,why:'Seventy bolts and a wrench. It never opens by accident, but getting out of a sinking capsule is slow.'}),
R('ms_mrman','e','Man-Rated Booster Program',60000,280,{mr:.10,as:.04},{tier:2,ph:2,why:'Redundant systems, conservative margins and a full review of the booster. Required before any of your boosters can be certified for a crew.'}),
R('ms_xrv','x','Re-entry Nose Cone Program',50000,260,{rv:1500,h:.3,d:4},{tier:'x',xa:'ar',pay:40000,why:'Warheads must survive re-entry. The Army pays for the answer.'}),
R('ms_xirbm','x','Guided Ballistic Missile Contract (IRBM)',60000,300,{t:.1,r:.02},{tier:'x',xa:'pi',pay:90000,why:'Turn your engine and guidance into a missile the Pentagon will buy.'}),
R('ms_xslv','x','Satellite Launch Vehicle Integration',55000,280,{t:.15,r:.02},{tier:'x',xa:'si',why:'Make stages, guidance and payload work as one vehicle.'}),
R('ms_xasc','x','Ascent Trajectory Optimization',40000,220,{c:-.08,t:.05},{tier:'x',xa:'ap',why:'Fly a cleaner path through the atmosphere.'})];
// First milestones cost 20% less than listed; Congress earmarks money toward them at each breakthrough (design.js).
for(const m of MSL)if(m.tier==1)m.c=Math.round(m.c*.8/1000)*1000;
// Historical firsts: [id, name, cash, reputation, test, rival event that can claim it first]
export const FIRSTS=[['f_50','First rocket above 50 km',8000,2,c=>c.ok&&c.peak>=50000],['f_mach','First flight past 1,000 m/s',6000,2,c=>c.ok&&c.spd>=1000],
['f_space','First American rocket into space (100 km)',20000,6,c=>c.ok&&c.peak>=100000,'r_space'],['f_rec','First payload recovered from flight',5000,2,c=>c.rec],
['f_cosm','First cosmic-ray data from above 50 km',8000,2,c=>c.pay=='Cosmic-Ray Package'&&c.got>0&&c.peak>=50000],['f_photo','First photograph from 100 km',15000,4,c=>c.pay=='Film Camera'&&c.rec&&c.peak>=100000],
['f_bio','First animal recovered alive from 80 km',15000,6,c=>c.pay=='Primate Capsule'&&c.rec&&c.peak>=80000,'r_dog'],['f_stage','First successful multi-stage flight',10000,3,c=>c.ok&&c.staged],
['f_range','First flight 300 km downrange',8000,2,c=>c.ok&&c.dr>=300000],['f_orbit','First artificial satellite',0,0,c=>c.why=='orbit','r_sat'],['f_human','First human in space',0,0,c=>!!c.human,'r_gagarin']];
// Game days run from 1 Jan 1946 (360-day years). Soviet events sit on their historical dates, jittered by +/-5% each game:
// [id, day, wire report, short name for intelligence estimates]
export const RIVAL=[['r_space',1860,'Soviet geophysical rockets climb above 100 km.','rockets above 100 km'],['r_dog',1980,'Soviet dogs Dezik and Tsygan return alive from a rocket flight to 100 km.','an animal flight to space altitude'],
['r_icbm',4170,'The Soviet Union announces a successful intercontinental ballistic missile test. Congress is alarmed.','an ICBM test'],['r_sat',4230,'SPUTNIK. The Soviet Union has placed the first artificial satellite in orbit.','an artificial satellite'],
['r_luna2',4934,'Luna 2 strikes the Moon: the first object from Earth to reach another world.','a probe reaching the Moon'],['r_luna3',4957,'Luna 3 photographs the far side of the Moon.','photographs of the lunar far side'],
['r_belka',5269,'Korabl-Sputnik 2: the dogs Belka and Strelka orbit the Earth for a day and are recovered alive.','animals orbited and recovered'],
['r_gagarin',5502,'VOSTOK 1. A Soviet cosmonaut has orbited the Earth and returned alive: the first human in space.','a crewed spaceflight']];
// Calendar speed: game days per real second. Tuned so a typical first playthrough reaches orbit around early 1958.
export const DAYS_PER_SEC=1.4,DAYS_PER_SEC2=.45; // Phase Two runs the calendar about three times slower: more happens in each year.
export const NASA_DAY=4590; // October 1958: NASA opens its doors
// When the real US programme did each first, for the end-of-phase comparison.
export const HISTUS={f_50:'Oct 1945, WAC Corporal',f_mach:'Apr 1946, captured V-2',f_space:'May 1946, V-2 at White Sands',f_rec:'Oct 1946, V-2 film canister',f_cosm:'1946, V-2 cosmic-ray counters',f_photo:'Oct 1946, V-2 camera at 105 km',f_bio:'Sep 1951, Aerobee (monkey Yorick)',f_stage:'Feb 1949, Bumper-WAC',f_range:'Jul 1950, Bumper-WAC from Cape Canaveral',f_orbit:'Jan 1958, Explorer 1',f_human:'May 1961, Freedom 7 (Vostok 1 had flown in April)'};
export const AREAS={p:'Propulsion',s:'Structures & Tankage',i:'Instrumentation & Telemetry',a:'Aerodynamics & Thermal',r:'Payloads & Recovery',c:'Mercury Spacecraft',e:'Escape & Man-Rating'},BY=Object.fromEntries([...PK,...MSL].map(x=>[x.id,x])),isMS=id=>id.startsWith('ms_');
// Confirmed packages needed for a breakthrough / a second milestone. Phase Two areas are smaller.
export const BTH={c:[3,6],e:[3,5]},bth=a=>BTH[a]||[5,9],P2A=['c','e'];
export const EF={t:['thrust',100,'%'],r:['reliability',100,' pts'],f:['propellant',1,' kg'],g:['g-limit',1,'g'],d:['dry mass',1,' kg'],i:['instrumentation',1,' tier'],c:['drag',100,'%'],h:['heat tolerance',100,'%'],q:['aero load limit',100,'%'],rc:['recovery chance',100,'%'],rv:['re-entry speed limit',1,' m/s'],sv:['science return',100,'%'],hs:['heat shield',100,' pts'],ec:['environmental control',100,' pts'],ac:['attitude control',100,' pts'],rr:['retrorockets',100,' pts'],pc:['parachutes',100,' pts'],lb:['landing bag',100,' pts'],man:['manual control',1,''],et:['escape tower',100,' pts'],as:['abort sensing',100,' pts'],tj:['tower jettison',100,' pts'],mr:['booster reliability on Mercury flights',100,' pts'],rq:['recovery speed',100,'%'],eg:['egress speed',100,'%'],hb:['hatch misfire risk',100,'%'],orb:['orbital re-entry capable',1,''],um:['pad shutdown cured',1,''],mab:['Atlas structural margin',100,' pts']};
export const fe=(k,v,b)=>{const f=EF[k],n=x=>Math.abs(x*f[1]).toFixed(f[1]>1?1:(k=='g'||k=='i'?1:0)).replace(/\.0$/,'');return `${f[0]} ${v<0?'-':'+'}${n(v)}${f[2]}${b!=null?` (\u00b1${n(b)})`:''}`};
export const MODES={c:{n:'Combustion instability',sy:['cut','osc'],fx:[['tune','Propellant mixture tuning',.6,1500,10,{}],['baffle','Baffled injector plate',.3,4000,20,{d:2,t:.99}],['chamber','Chamber redesign',.25,12000,45,{t:1.03}]]},p:{n:'Pump cavitation',sy:['cut','decay'],fx:[['ind','Pump inducer stage',.3,5000,25,{d:1}],['pfed','Pressure-fed tanks',.4,3000,15,{d:4,t:.98}]]},i:{n:'Hard start at ignition',sy:['hard','cut'],fx:[['igniter','Pyrotechnic igniter redesign',.35,3000,15,{d:1}],['slug','Hypergolic start slug',.25,6000,25,{d:2}]]},v:{n:'Propellant valve or line leak',sy:['leak','cut'],fx:[['valve','Valve seat rework',.4,2500,12,{}],['qual','Component qualification program',.2,9000,35,{d:1}]]},x:{n:'Stage separation failure',sy:['stuck'],fx:[['spring','Separation spring tuning',.4,3500,15,{}],['charge','Redundant separation charges',.2,8000,30,{d:3}]]},
h:{n:'Aerodynamic heating (skin overheats and deforms)',sy:['hot','break'],fx:[['nose','Ablative nose tip',.4,3500,18,{h:.12,d:1}],['coat','Heat-resistant skin coating',.25,7000,30,{h:.225,d:3}]]},f:{n:'Fin flutter at high dynamic pressure',sy:['wob','break'],fx:[['fin','Fin redesign and stiffening',.35,3000,15,{d:1,q:.16}],['span','Smaller, thicker fins',.2,6500,28,{d:2,q:.3,c:.02}]]},
s:{n:'Tank buckling under load',sy:['break','pdrop'],fx:[['ring','Stiffening rings',.3,3500,20,{d:4,g:.7}],['pstab','Pressure-stabilized tanks',.45,6000,30,{g:.3}]]}};
export const SY={cut:['engine cutoff earlier than planned',x=>x.v>=1],osc:['chamber pressure oscillation',x=>x.v>=2],decay:['thrust tailing off before cutoff',x=>x.v>=2],hot:['skin temperature spike',x=>x.v>=2],wob:['fin flutter and pitch oscillation',x=>x.v>=2],hard:['violent pressure spike at ignition',x=>x.v>=1],leak:['propellant leak signature',x=>x.v>=2],stuck:['stage separation anomaly',x=>x.v>=1||x.g>=1],break:['radar shows multiple returns (breakup)',x=>x.g>=1||x.v>=1],pdrop:['tank pressure drop',x=>x.v>=2]};
export const vis=(m,tr)=>MODES[m].sy.filter(s=>SY[s][1](tr)),fxOf=(m,id)=>MODES[m].fx.find(f=>f[0]==id);

// Base upgrades: [name, cost, description, requires, from directive (index), consoles added, control-room upgrade]
export const FACS={
tty:['Teleprinter & Range Communications',12000,'Teleprinters link the blockhouse to the range. Unlocks the Telemetry Engineer.',null,0,1,1],
plot:['Plotting Board',18000,'A live trajectory plot on the wall. Unlocks the Structures & Booster Engineer.','tty',0,1,1],
comp:['Range Computer (IBM 704)',40000,'Halves the uncertainty of pre-flight estimates. Unlocks the Flight Dynamics Officer.','plot',1,2,1],
mcc:['Mercury-Style Control Center',60000,'Rows of consoles and a world map. Unlocks the Flight Director.','comp',2,3,1],
wall:['Wall Displays & World Tracking Map',45000,'The big board. Pre-flight estimates a further 20% tighter.','mcc',3,2,1],
radar:['Tracking Radar Network',30000,'Sharper, faster plots and a velocity track.',null,0,0,0],
ship:['Downrange Tracking Ship',25000,'Tracks horizontal velocity, raises grants and helps find payloads downrange.','radar',1,0,0],
wx:['Range Weather Station',8000,'Forecasts winds before each launch. Gusts raise aerodynamic loads; with a Range Safety Officer, high winds become a NO-GO.',null,0,0,0],
stand:['Static Engine Test Stand',22000,'Ground-test finished propulsion packages to confirm them without risking a flight.',null,0,0,0],
recov:['Recovery Force & Helicopter Pad',20000,'Recovery chance +20%. Unlocks the Recovery Controller.',null,1,0,0],
jigs:['Assembly Jigs & Fixtures',25000,'Purpose-built jigs hold every airframe and capsule the same way. All factory work 25% faster.',null,1,0,0],
nc:['Numerically Controlled Machining',60000,'Tape-driven machine tools cut parts straight from the drawings. All factory work a further 25% faster.','jigs',3,0,0],
// Astronaut training (Phase Two): the eighth field marks a facility that opens with NASA.
centrifuge:['Human Centrifuge',35000,'Full-rate g-tolerance training. Without it, physical training runs at 40%.',null,0,0,0,1],
zerog:['Zero-G Training Aircraft',20000,'Parabolic flights give astronauts seconds of weightlessness at a time: composure training at full rate.',null,0,0,0,1],
egress:['Water Egress Tank',12000,'Practise getting out of a capsule in the water. Egress training at full rate.',null,0,0,0,1],
ptrain:['Mercury Procedures Trainer',25000,'Simulator tier 1: analog computers behind a mock instrument panel. Training value doubles over classroom work.',null,0,0,0,1],
msim:['Mercury Mission Simulator',60000,'Simulator tier 2: digital computers drive a flight-faithful cockpit. Full training value and more rehearsed failures.','ptrain',0,0,0,1],
// The ninth field is construction time in days: the facility is ordered now and comes on line later.
clean:['Spacecraft Clean Room',40000,'A dust-free hall for capsule assembly and checkout. Capsules build 30% faster.',null,0,0,0,1],
trknet:['Mercury Worldwide Tracking Network',150000,'Eighteen ground stations and two ships around the world, linked to the Cape by teleprinter. Required before a crew flies. With full coverage, CAPCOM advice in flight is better. Construction takes about ten months.',null,0,0,0,1,300]};
export const ROOMKEYS=['tty','plot','comp','mcc','wall'];
export const ROOMS=[['Blockhouse, White Sands Proving Ground','A concrete bunker, a periscope and a handful of engineers.'],['Blockhouse with Range Communications','Teleprinters chatter. The range can finally talk back.'],['Range Control Center','A plotting board tracks every flight across the wall.'],['Range Control & Computing Center','Tape reels spin. The computer predicts what the slide rule guessed.'],['Mercury Control Center','Rows of consoles, a world map, and a Flight Director running the poll.'],['Mission Operations Control Room','The big board. Every station on the loop, every flight on the screen.']];
// Launch crew. dm = failure modes the station can catch in the pre-launch poll; req = base upgrade needed.
export const STN={tc:{n:'Test Conductor (you)',s:'TC',c:0,sal:0,req:null,dm:'',d:'Runs the count and the walkdown. Always on the net.'},
prop:{n:'Propulsion Engineer',s:'PROP',c:6000,sal:400,req:null,dm:'cpiv',d:'Checks engine, pumps, igniters and valves before launch.'},
rso:{n:'Range Safety Officer',s:'RSO',c:5000,sal:300,req:null,dm:'',d:'Commands destruct on a failing vehicle, cutting reputation lost to failures by 30%. With a weather station, calls NO-GO on high winds.'},
tlm:{n:'Telemetry Engineer',s:'TLM',c:8000,sal:500,req:'tty',dm:'v',d:'Watches the telemetry checkout and steers failure investigations toward the right answer.'},
bstr:{n:'Structures & Booster Engineer',s:'BSTR',c:9000,sal:600,req:'plot',dm:'sx',d:'Leak and pressure checks on tankage; arms and checks staging circuits.'},
fido:{n:'Flight Dynamics Officer',s:'FIDO',c:12000,sal:700,req:'comp',dm:'hf',d:'Checks the airframe against aero and heating loads and tightens the pre-flight estimate.'},
rec:{n:'Recovery Controller',s:'REC',c:8000,sal:500,req:'recov',dm:'',d:'Coordinates recovery forces: recovery chance +15%.'},
fd:{n:'Flight Director',s:'FLIGHT',c:20000,sal:1200,req:'mcc',dm:'',d:'Runs the go/no-go poll: every station catches faults 15% more often.'},
capcom:{n:'Capsule Communicator',s:'CAPCOM',c:6000,sal:500,req:'mcc',dm:'',ph:2,d:'An astronaut on the ground who talks to the crew. Every crew decision in flight goes better.'},
surg:{n:'Flight Surgeon',s:'SURG',c:8000,sal:600,req:null,dm:'',ph:2,d:'Watches the crew\'s heart rate and breathing in flight and halves the time injured astronauts are grounded.'}};
export const FMSG={c:'chamber pressure transducer erratic on the static check',p:'turbopump spin-up shows rough bearings',i:'igniter continuity check failed',v:'LOX valve slow to seat',s:'tank pressure decaying on the leak check',x:'separation squib circuit reads high resistance',h:'nose-cone skin joint out of tolerance',f:'play found in a fin attachment'};
export const WIND=['calm','gusty','high'];
