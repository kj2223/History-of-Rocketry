// RESEARCH CATALOGUE: every work package and milestone the Design Bureau can commission. Tune research here.
//
// Each row: research(id, area, name, cost in $, listed time in seconds, effects, extra)
//   area     p propulsion, s structures & tankage, i instrumentation & telemetry, a aerodynamics & thermal,
//            r payloads & recovery, c Mercury spacecraft, e escape & man-rating, x joint programme
//   time     the listed figure; play time is 75% of it, and Phase Two work (phase: 2) takes 2.5 times as long again
//   effects  what the package adds to the rocket, as estimates; the real figure is rolled when it completes.
//            The keys are explained in EFFECTS below (t thrust, r reliability, f propellant, d dry mass, ...).
//   extra    dud: chance it turns out a dead end (experimental work; effects can then be negative)
//            needsMilestone: 1 = second-generation work, opens after a tier-1 milestone in its area
//            phase: 2 = Phase Two work, opens once NASA is established
//            hiddenUntil: a Phase Two flag; the package is proposed only after the failure it cures
//            tier, why, jointAreas, contract: milestones only (see MILESTONES)

const RESEARCH_TIME_SCALE = .75; // play time as a share of the listed time
const PHASE_TWO_TIME_SCALE = 2.5; // Phase Two work runs on a slower calendar, so it takes longer in play seconds

export const research = (id, area, name, cost, listedSeconds, effects, extra = {}) => ({
  id, area, name, cost, time: Math.round(listedSeconds * RESEARCH_TIME_SCALE * (extra.phase == 2 ? PHASE_TWO_TIME_SCALE : 1)), effects, ...extra,
});

export const PACKAGES = [
  research('inj','p','Injector pattern trials',3000,80,{t:.05,r:.01}),
  research('mix','p','Mixture-ratio tests',3500,100,{t:.06}),
  research('noz','p','Nozzle contour refinement',4500,120,{t:.08,d:1}),
  research('seal','p','Pump bearing and seal work',5000,150,{t:.04,r:.025}),
  research('cool','p','Cooling jacket revisions',6000,180,{t:.07,r:.02,d:2}),
  research('imp','p','Turbopump impeller redesign',7000,200,{t:.06,r:.015,d:1}),
  research('gauge','s','Tank wall gauge study',3000,80,{f:6,d:-1}),
  research('vol','s','Tankage volume extension',5000,150,{f:12,d:2}),
  research('weld','s','Weld and seam quality program',3500,100,{g:.6,r:.01}),
  research('ring','s','Stiffening ring layout',4500,120,{g:.8,d:2}),
  research('alloy','s','Alloy substitution trials',6000,180,{g:.6,f:6,d:-2}),
  research('prs','s','Tank pressurization study',7000,200,{f:10,g:.3,d:1}),
  research('bea','i','Radio beacon refinement',2000,60,{i:.4}),
  research('fm','i','FM telemetry transmitter',3500,90,{i:.6,d:1}),
  research('xdc','i','Pressure transducers',4500,120,{i:.5,d:1}),
  research('str','i','Strain gauge installation',5000,140,{i:.5,d:1}),
  research('acc','i','Accelerometer package',6000,160,{i:.5,d:1}),
  research('mux','i','Telemetry channel multiplexing',7000,190,{i:.4,d:1}),
  // Experimental work: bigger potential, wide uncertainty, and a chance (dud) of turning out a dead end. Effects can be negative.
  research('addv','p','Fuel additive trials (hydrazine blends)',4000,90,{t:.10,r:-.02},{dud:.35}),
  research('swirl','p','Swirl injector experiments',3800,100,{t:.07,r:.01},{dud:.3}),
  research('abl','p','Ablative chamber liner',5500,130,{r:.03,d:2},{dud:.15}),
  research('monop','p','Monopropellant turbine drive',6500,160,{t:.09,d:-1,r:-.01},{dud:.4}),
  research('mono','s','Monocoque skin experiments',4000,100,{g:.9,d:-2},{dud:.3}),
  research('tankint','s','Integral tank construction',5500,140,{f:14,g:.4,d:-1},{dud:.25}),
  research('magn','s','Magnesium alloy skin trial',4800,120,{d:-3,g:-.3},{dud:.35}),
  research('bulk','s','Common-bulkhead tankage',6000,150,{f:18,d:-2,r:-.01},{dud:.3}),
  research('tape','i','Onboard tape recorder',3000,80,{i:.2},{dud:.2}),
  research('subc','i','Subcarrier telemetry multiplex',4000,100,{i:.3,d:1},{dud:.25}),
  research('gyro','i','Rate gyro package',5200,130,{i:.3,r:.01,d:1},{dud:.3}),
  research('cam','i','Instrument camera package',3500,90,{i:.15,d:1},{dud:.2}),
  // AERODYNAMICS: c = drag change, h = heat tolerance, q = dynamic-pressure (aero load) limit
  research('ogive','a','Nose ogive profile study',3000,80,{c:-.05}),
  research('fins','a','Fin shape and sizing trials',3500,100,{c:-.04,q:.12}),
  research('flush','a','Flush-riveted skin',4000,110,{c:-.05,d:1}),
  research('wt','a','Wind tunnel program',5000,130,{c:-.06,q:.1}),
  research('ablnose','a','Ablative nose tip',4500,120,{h:.12,d:1}),
  research('insul','a','Skin insulation coating',5200,140,{h:.15,d:2}),
  research('flut','a','Fin flutter testing',4800,120,{q:.24,d:1}),
  research('area','a','Area-rule fuselage shaping',6000,150,{c:-.12,q:-.08},{dud:.35}),
  research('hsink','a','Copper heat-sink nose',5500,130,{h:.21,d:4},{dud:.25}),
  research('blunt','a','Blunt-body nose shape',5000,120,{h:.18,c:.06},{dud:.3}),
  // PAYLOADS & RECOVERY: rc = recovery chance, rv = re-entry speed the payload survives (m/s), sv = science return
  research('chute','r','Nose-cone parachute',3000,80,{rc:.35,d:3}),
  research('bcn','r','Recovery radio beacon',2500,70,{rc:.12,d:1}),
  research('dye','r','Sea-dye marker & flotation bag',2000,60,{rc:.08,d:1}),
  research('psep','r','Payload separation mechanism',4000,100,{rc:.1,d:2}),
  research('hs1','r','Ablative heat-shield nose cone',5500,140,{rv:600,d:4}),
  research('cosm','r','Cosmic-ray counter',3000,80,{sv:.15}),
  research('film','r','Film camera & recoverable canister',4500,110,{sv:.1,d:1}),
  research('bio','r','Biological life-support capsule',6000,150,{sv:.1,d:3}),
  research('ball','r','Ballute decelerator',4500,110,{rc:.18,rv:300,d:2},{dud:.35}),
  research('snatch','r','Mid-air retrieval by aircraft',5000,120,{rc:.22},{dud:.4}),
  research('beryl','r','Beryllium heat-sink shield',6500,150,{rv:900,d:6},{dud:.3}),
  // SECOND-GENERATION WORK: needs a tier-1 milestone in its area (needsMilestone: 1)
  research('gimbal','p','Gimbaled thrust chamber',6000,150,{t:.04,r:.02,d:2},{needsMilestone:1}),
  research('regen','p','Regenerative cooling overhaul',7000,170,{t:.08,r:.01,d:3},{needsMilestone:1}),
  research('hyprop','p','Hypergolic upper-stage propellant tests',6500,160,{t:.07,r:-.01},{needsMilestone:1,dud:.3}),
  research('chem','s','Chem-milled tank walls',6000,150,{f:8,d:-3},{needsMilestone:1}),
  research('lattice','s','Interstage lattice truss',5500,140,{g:.6,d:2},{needsMilestone:1}),
  research('sepr','s','Separation retro-rockets',6000,150,{r:.015,d:1},{needsMilestone:1}),
  research('trans','i','Transistor amplifier trials',5500,140,{i:.3,d:-1},{needsMilestone:1,dud:.3}),
  research('pcm','i','PCM digital telemetry',6500,160,{i:.4},{needsMilestone:1}),
  research('antp','i','Antenna pattern study',4500,120,{i:.2,r:.005},{needsMilestone:1}),
  research('boat','a','Boat-tail shaping',5000,130,{c:-.04},{needsMilestone:1}),
  research('fairing','a','Payload fairing redesign',5500,140,{c:-.05,d:1},{needsMilestone:1}),
  research('ablfair','a','Ablative fairing coating',6000,150,{h:.12,d:2},{needsMilestone:1,dud:.25}),
  research('biotel','r','Biotelemetry harness',5000,130,{sv:.1},{needsMilestone:1}),
  research('ribbon','r','Ribbon parachute',5500,140,{rc:.1,rv:200,d:1},{needsMilestone:1}),
  research('sofar','r','SOFAR sound-channel beacon',4500,120,{rc:.08},{needsMilestone:1}),
  // PHASE TWO, SECTION 1 (open once NASA is established). Effects are subsystem reliability (+0.10 = 10 points) unless noted.
  // c = Mercury Spacecraft: hs heat shield, ec environmental control, ac attitude control, rr retrorockets, pc parachutes, lb landing bag; man = manual control fitted
  research('cap_shape','c','Blunt-body capsule shape and heat studies',8000,110,{hs:.06,lb:.02},{phase:2}),
  research('cap_ecs','c','Environmental control system',9000,130,{ec:.10},{phase:2}),
  research('cap_chute','c','Drogue, main and reserve parachutes',8000,120,{pc:.10},{phase:2}),
  research('cap_asc','c','Automatic stabilization and control (ASCS)',10000,140,{ac:.08},{phase:2}),
  research('cap_retro','c','Retropack and posigrade rockets',9000,130,{rr:.10},{phase:2}),
  research('cap_bag','c','Landing bag impact attenuator',7000,100,{lb:.08},{phase:2}),
  research('cap_fbw','c','Manual and fly-by-wire attitude control',8000,120,{ac:.04,man:1},{phase:2}),
  research('cap_peri','c','Pilot window and periscope',6000,90,{man:.5,ac:.02},{phase:2,dud:.25}),
  // e = Escape & Man-Rating: et escape tower, as abort sensing, tj tower jettison, mr Redstone reliability, rq recovery aids
  research('esc_tower','e','Launch escape tower',10000,130,{et:.12},{phase:2}),
  research('mr_mods','e','Booster man-rating modifications',12000,160,{mr:.08},{phase:2}),
  research('esc_asis','e','Abort sensing and implementation system',11000,150,{as:.14},{phase:2}),
  research('esc_jett','e','Tower jettison and backup sequencer',7000,100,{tj:.10,et:.03},{phase:2}),
  research('esc_sea','e','Recovery beacon, dye marker and SOFAR bomb',6000,90,{rq:.15},{phase:2}),
  research('mr_tank','e','Elongated booster tankage',9000,130,{mr:.04},{phase:2,dud:.2}),
  // Found only by investigation: each appears after the failure it cures.
  research('mr_umb','e','Umbilical disconnect sequencing',6000,80,{um:1},{phase:2,hiddenUntil:'four'}),
  research('ma_band','e','Atlas stiffening band',8000,110,{mab:.12},{phase:2,hiddenUntil:'maFail'}),
];

// MILESTONES: major programmes, each a big step in one area.
//   tier 1: after an area's breakthrough choose ONE approach. tier 2: after a tier-1 milestone and 9 confirmed packages in the area.
//   tier 'x': joint programmes needing a tier-1 milestone in both areas listed in jointAreas. contract = one-time payment on completion.
//   why: the line shown under the milestone's name.
export const MILESTONES = [
  research('ms_eng','p','High-Performance Engine Program',60000,300,{t:.7,r:.03,d:4},{tier:1,why:'Push chamber pressure hard. Big thrust gains, modest reliability.'}),
  research('ms_rel','p','Engine Reliability Program',45000,260,{t:.3,r:.08,d:2},{tier:1,why:'Qualify every component. Less thrust, far fewer failures.'}),
  research('ms_tp','p','Turbopump Kerosene Engine (Thor class)',80000,360,{t:.6,r:.03,d:6},{tier:2,why:'A production-grade missile engine.'}),
  research('ms_stg','s','Liquid Upper Stage (Vanguard route)',65000,320,{g:4,f:80,d:8},{tier:1,why:'A new liquid second stage. Efficient and capable, but every part is new.'}),
  research('ms_clu','s','Clustered Solid Upper Stages (Jupiter-C route)',40000,220,{g:3,f:40,d:4},{tier:1,why:'Bundle proven small solid motors. Quick and cheap, with a harder kick at staging and a riskier separation.'}),
  research('ms_balloon','s','Pressure-Stabilized Balloon Tanks (Atlas)',75000,340,{f:70,d:-6,g:-.8},{tier:2,why:'Stainless tanks as thin as a coin, held rigid by their own pressure.'}),
  research('ms_in','i','Inertial Platform & Full Telemetry',50000,260,{i:1,d:3},{tier:1,why:'Gyros aboard the vehicle measure everything themselves.'}),
  research('ms_rg','i','Radio Guidance from the Ground',35000,200,{i:.7,r:.02},{tier:1,why:'Ground radar steers the vehicle. Cheaper and lighter, less self-contained.'}),
  research('ms_tran','i','Transistorized Telemetry',60000,280,{i:.8,d:-3},{tier:2,why:'Vacuum tubes give way to transistors: lighter, with more channels.'}),
  research('ms_aero','a','Supersonic Airframe & Thermal Protection Program',60000,300,{c:-.15,h:.375,q:.4,d:3},{tier:1,why:'Slender, stiff and protected. Faster through the dense air.'}),
  research('ms_blunt','a','Blunt-Body Re-entry Research',45000,240,{h:.6,c:.05,q:.1,d:2},{tier:1,why:'A blunt shape pushes the heat away. More drag, far more heat tolerance.'}),
  research('ms_hyp','a','Hypersonic Wind Tunnel Program',70000,320,{c:-.1,q:.3,h:.2},{tier:2,why:'Test shapes at Mach 7 on the ground.'}),
  research('ms_rec','r','Recoverable Re-entry Capsule Program',55000,280,{rc:.25,rv:2500,sv:.3,d:5},{tier:1,why:'A capsule built to come home.'}),
  research('ms_bio','r','Biomedical Flight Program',45000,240,{sv:.4,rc:.1,d:3},{tier:1,why:'Instrumented animal flights. The science and the headlines pay well.'}),
  research('ms_disc','r','Film-Return Satellite Capsule (Discoverer)',80000,360,{rc:.2,rv:4000,sv:.3,d:4},{tier:2,why:'Catch a capsule falling from orbit, in mid-air.'}),
  research('ms_beh','c','Beryllium Heat Sink',45000,240,{hs:.14},{tier:1,phase:2,why:'A thick beryllium shield soaks up the heat. Proven and forgiving on a suborbital arc, but too heavy for orbit.'}),
  research('ms_ablh','c','Fibreglass Ablative Heat Shield',45000,240,{hs:.10,orb:1},{tier:1,phase:2,why:'A shield that chars and erodes away, carrying the heat with it. Lighter, and it will handle orbital re-entry, but it is less proven.'}),
  research('ms_mqual','c','Mercury Capsule Qualification Program',60000,280,{hs:.04,ec:.05,ac:.05,rr:.04,pc:.05,lb:.04},{tier:2,phase:2,why:'Altitude chambers, drop tests and shake tables for every capsule system.'}),
  research('ms_hxp','e','Explosive Side Hatch',38000,200,{eg:.25,hb:.05},{tier:1,phase:2,why:'A ring of explosive bolts blows the hatch off in an instant. Fast egress, with a small risk it fires on its own.'}),
  research('ms_hbolt','e','Bolted Side Hatch',30000,180,{eg:.05},{tier:1,phase:2,why:'Seventy bolts and a wrench. It never opens by accident, but getting out of a sinking capsule is slow.'}),
  research('ms_mrman','e','Man-Rated Booster Program',60000,280,{mr:.10,as:.04},{tier:2,phase:2,why:'Redundant systems, conservative margins and a full review of the booster. Required before any of your boosters can be certified for a crew.'}),
  research('ms_xrv','x','Re-entry Nose Cone Program',50000,260,{rv:1500,h:.3,d:4},{tier:'x',jointAreas:'ar',contract:40000,why:'Warheads must survive re-entry. The Army pays for the answer.'}),
  research('ms_xirbm','x','Guided Ballistic Missile Contract (IRBM)',60000,300,{t:.1,r:.02},{tier:'x',jointAreas:'pi',contract:90000,why:'Turn your engine and guidance into a missile the Pentagon will buy.'}),
  research('ms_xslv','x','Satellite Launch Vehicle Integration',55000,280,{t:.15,r:.02},{tier:'x',jointAreas:'si',why:'Make stages, guidance and payload work as one vehicle.'}),
  research('ms_xasc','x','Ascent Trajectory Optimization',40000,220,{c:-.08,t:.05},{tier:'x',jointAreas:'ap',why:'Fly a cleaner path through the atmosphere.'}),
];
// First milestones cost 20% less than listed (rounded to the nearest $1,000); Congress also earmarks money toward them at each breakthrough (rules/research.js).
const TIER_ONE_DISCOUNT = .8;
for (const milestone of MILESTONES) if (milestone.tier == 1) milestone.cost = Math.round(milestone.cost * TIER_ONE_DISCOUNT / 1000) * 1000;

// Every package and milestone by id.
export const BY_ID = Object.fromEntries([...PACKAGES, ...MILESTONES].map(item => [item.id, item]));
export const isMilestone = id => id.startsWith('ms_');

export const AREAS = { p: 'Propulsion', s: 'Structures & Tankage', i: 'Instrumentation & Telemetry', a: 'Aerodynamics & Thermal', r: 'Payloads & Recovery', c: 'Mercury Spacecraft', e: 'Escape & Man-Rating' };
// Confirmed packages needed in an area for [a breakthrough, the second milestone]. Phase Two areas are smaller.
const BREAKTHROUGH_NEEDS = { c: [3, 6], e: [3, 5] };
export const breakthroughNeeds = area => BREAKTHROUGH_NEEDS[area] || [5, 9];
export const PHASE_TWO_AREAS = ['c', 'e'];

// EFFECTS: how each effect key reads in the game. [name, display multiplier, unit]
export const EFFECTS = {
  t: ['thrust', 100, '%'], r: ['reliability', 100, ' pts'], f: ['propellant', 1, ' kg'], g: ['g-limit', 1, 'g'], d: ['dry mass', 1, ' kg'],
  i: ['instrumentation', 1, ' tier'], c: ['drag', 100, '%'], h: ['heat tolerance', 100, '%'], q: ['aero load limit', 100, '%'],
  rc: ['recovery chance', 100, '%'], rv: ['re-entry speed limit', 1, ' m/s'], sv: ['science return', 100, '%'],
  // Mercury spacecraft systems
  hs: ['heat shield', 100, ' pts'], ec: ['environmental control', 100, ' pts'], ac: ['attitude control', 100, ' pts'], rr: ['retrorockets', 100, ' pts'],
  pc: ['parachutes', 100, ' pts'], lb: ['landing bag', 100, ' pts'], man: ['manual control', 1, ''],
  // Escape & man-rating
  et: ['escape tower', 100, ' pts'], as: ['abort sensing', 100, ' pts'], tj: ['tower jettison', 100, ' pts'], mr: ['booster reliability on Mercury flights', 100, ' pts'],
  rq: ['recovery speed', 100, '%'], eg: ['egress speed', 100, '%'], hb: ['hatch misfire risk', 100, '%'], orb: ['orbital re-entry capable', 1, ''],
  um: ['pad shutdown cured', 1, ''], mab: ['Atlas structural margin', 100, ' pts'],
};
// One effect as text, e.g. "thrust +5%" or, with an uncertainty, "thrust +5% (±1)".
export const formatEffect = (key, value, uncertainty) => {
  const effect = EFFECTS[key];
  const number = x => Math.abs(x * effect[1]).toFixed(effect[1] > 1 ? 1 : (key == 'g' || key == 'i' ? 1 : 0)).replace(/\.0$/, '');
  return `${effect[0]} ${value < 0 ? '-' : '+'}${number(value)}${effect[2]}${uncertainty != null ? ` (\u00b1${number(uncertainty)})` : ''}`;
};
