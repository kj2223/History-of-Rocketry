// PHASE TWO SCREENS: the Astronaut Office, the Mercury mission planner and man-rating board on the Launch tab,
// the Mercury directive, and the memorial and Section 1 overlays.
import { formatMoney } from '../core/util.js';
import { STATIONS } from '../data/launch-site.js';
import { PROPELLANTS } from '../data/launch.js';
import { BY_ID } from '../data/research.js';
import { PROGRAMMES } from '../data/programmes.js';
import { SKILLS, TRAINING_FOCUS, QUALIFICATION_DAYS, REHEARSALS } from '../data/astronauts.js';
import { MISSION_TYPES, MERCURY_DIRECTIVES, TESTING_REGIMES, OFFICE_DECISIONS, CHIMP_TRAINING_COST } from '../data/mercury.js';
import { S, formatDate, isResearched } from '../core/state.js';
import { skillEstimate, isQualified, simulatorTier, activeAstronauts } from '../rules/astronauts.js';
import { requirementText, crewLock, capsuleSystems, boosterPlan, needText, readyBoosters } from '../rules/mercury.js';
import { manRatingRecord, CLEAN_FLIGHTS_NEEDED, MAN_RATING_RESEARCH, isManRated, isFamilyCertified, anyCertified, certifiedNames } from '../rules/manrate.js';
import { quoteLaunch } from '../rules/design.js';
import { $, escapeHtml, percent, setHTML } from './dom.js';

// The finalists ticked during selection.
export const selectedFinalists = new Set();
const SIMULATOR_NAMES = ['Classroom only', 'Procedures trainer', 'Mission simulator'];

// A skill bar: the believed range, the best guess, and the figure.
function skillBar(astronaut, skill) {
  const estimate = skillEstimate(astronaut, skill), low = Math.max(0, estimate.value - estimate.width), high = Math.min(100, estimate.value + estimate.width);
  return `<div class="sk"><span class="d">${SKILLS[skill]}</span><span class="skb"><i style="left:${low}%;width:${high - low}%"></i><b style="left:${estimate.value}%"></b></span><span class="skv">${estimate.value}${estimate.width > 2 ? ` ±${estimate.width}` : ''}</span></div>`;
}
// An astronaut's card. mode: 0 the roster, 1 selectable, 2 view only (during testing).
function astronautCard(astronaut, mode) {
  const qualified = isQualified(astronaut), training = Math.min(1, astronaut.tday / QUALIFICATION_DAYS);
  let html = `<div class="c astro${mode == 1 && selectedFinalists.has(astronaut.id) ? ' on' : ''}"><div class="r"><b>${escapeHtml(astronaut.name)}</b><span class="d">${astronaut.svc}</span></div><div class="m">Age ${astronaut.age} • ${astronaut.hrs.toLocaleString()} jet hours • ${astronaut.tps ? 'test pilot school graduate' : 'no test pilot school'} • ${astronaut.deg}</div>` + Object.keys(SKILLS).map(skill => skillBar(astronaut, skill)).join('');
  if (mode) {
    if (astronaut.dq) return html + '<div class="bad">Medically disqualified.</div></div>';
    return html + (mode == 1 ? `<button data-a="selt" data-id="${astronaut.id}">${selectedFinalists.has(astronaut.id) ? 'SELECTED ✓' : 'SELECT'}</button>` : '') + '</div>';
  }
  if (astronaut.st == 'medical') return html + '<div class="bad">Permanently grounded (heart condition). Works in the Astronaut Office.</div></div>';
  const status = astronaut.st == 'grounded' ? `Grounded (${Math.ceil(astronaut.gd / 30)} months)` : qualified ? 'Flight qualified' : `General training ${percent(training)}`;
  html += `<div class="r"><span class="d">${status}</span><b class="${astronaut.fat > 60 ? 'bad' : astronaut.fat > 35 ? 'wn' : 'ok'}">Fatigue ${Math.round(astronaut.fat)}</b></div><div class="bar"><i style="width:${training * 100}%"></i></div>`;
  if (astronaut.asg) html += `<div class="r"><span class="d">Assigned: ${MISSION_TYPES[astronaut.asg].fullName}</span><b>${percent(astronaut.mt)} mission training</b></div><div class="bar"><i style="width:${astronaut.mt * 100}%"></i></div>`;
  const rehearsed = Object.keys(astronaut.reh).filter(key => astronaut.reh[key]);
  if (rehearsed.length) html += `<div class="m">Rehearsed in the simulator: ${rehearsed.map(key => REHEARSALS[key].short).join(', ')}.</div>`;
  html += `<div class="m">${astronaut.flights ? `${astronaut.flights} flight${astronaut.flights > 1 ? 's' : ''}. ` : ''}</div><select data-focus="${astronaut.id}">${Object.entries(TRAINING_FOCUS).filter(([key]) => key != 'msn' || astronaut.asg).map(([key, name]) => `<option value="${key}"${astronaut.focus == key ? ' selected' : ''}>Training: ${name}</option>`).join('')}</select>`;
  if (qualified && !astronaut.asg) html += `<button data-a="asg" data-id="${astronaut.id}">ASSIGN AS PILOT FOR THE NEXT MERCURY-REDSTONE</button>`;
  return html + '</div>';
}

// A pending office decision, shown on the Astronaut Office and the Launch tab.
export function officeDecisionHTML() {
  const state = S.p2;
  if (!state || !state.od) return '';
  const decision = OFFICE_DECISIONS[state.od];
  return `<div class="c decide"><div class="t">${decision.who}: DECISION NEEDED</div><div>${decision.question}</div><div class="two"><button data-a="offy"${decision.cost && S.b < decision.cost ? ' disabled' : ''}>${decision.answers[0]}</button><button data-a="offn">${decision.answers[1]}</button></div></div>`;
}

// SELECTION, step by step: screening, choosing the testing, testing, choosing the group.
function selectionHTML(state) {
  const step = state.sel.st;
  if (step == 0) return `<div class="m">NASA is screening 508 military service records for test pilots who meet the criteria. A shortlist is expected around <b>${formatDate(state.sel.at)}</b>.</div>`;
  if (step == 1) return `<div class="m">Interviews have narrowed the field to ${state.pool.length} finalists. Choose how thoroughly to test them. The full programme takes longer and costs more, but it reveals more about each finalist and catches every hidden medical problem; standard examinations miss about half.</div>
<div class="two">${Object.entries(TESTING_REGIMES).map(([key, regime]) => `<button data-a="reg" data-id="${key}"${S.b < regime.cost ? ' disabled' : ''}>${regime.name.toUpperCase()} (${formatMoney(regime.cost)}, ${regime.days} DAYS)</button>`).join('')}</div><div class="cards">${state.pool.map(candidate => astronautCard(candidate, 2)).join('')}</div>`;
  if (step == 2) return `<div class="m">${TESTING_REGIMES[state.sel.reg].name} under way. Results around <b>${formatDate(state.sel.at)}</b>.</div><div class="cards">${state.pool.map(candidate => astronautCard(candidate, 2)).join('')}</div>`;
  return `<div class="m">Choose between three and seven astronauts. The ranges narrow further once training shows what each person can really do.</div><div class="cards">${state.pool.map(candidate => astronautCard(candidate, 1)).join('')}</div><button data-a="selok" class="big"${selectedFinalists.size < 3 || selectedFinalists.size > 7 ? ' disabled' : ''}>CONFIRM SELECTION (${selectedFinalists.size} chosen, 3 to 7)</button>`;
}

// THE ASTRONAUT OFFICE tab: the office decision, selection or the roster; the animal programme, facilities, controllers and memorial.
const TRAINING_FACILITIES = [['centrifuge', 'Centrifuge'], ['zerog', 'Zero-G aircraft'], ['egress', 'Egress tank'], ['ptrain', 'Procedures trainer'], ['msim', 'Mission simulator']];
export function renderAstronautOffice() {
  const state = S.p2, main = $('#ao'), side = $('#ao2');
  if (!main) return;
  if (!state) {
    setHTML(main, '<div class="m">The Astronaut Office opens when NASA is established.</div>');
    setHTML(side, '');
    return;
  }
  setHTML(main, officeDecisionHTML() + (!state.selDone ? selectionHTML(state)
    : `<div class="m">General training takes about ${QUALIFICATION_DAYS} days before an astronaut can be assigned; a flight then needs mission training. Simulator: <b>${SIMULATOR_NAMES[simulatorTier()]}</b>.</div><div class="cards">${state.astros.filter(astronaut => astronaut.st != 'lost').map(astronaut => astronautCard(astronaut, 0)).join('')}</div>`));
  const chimps = state.ch.t >= 1 ? '<b class="ok">Trained and ready</b>' : state.ch.on ? `<b>${percent(state.ch.t)} trained</b>` : `<button data-a="chimps"${S.b < CHIMP_TRAINING_COST ? ' disabled' : ''}>START TRAINING (${formatMoney(CHIMP_TRAINING_COST)})</button>`;
  setHTML(side, `<div class="t">ANIMAL PROGRAMME</div><div class="r"><span class="d">Chimpanzee colony, Holloman AFB</span>${chimps}</div><div class="m">About five months of lever and couch training before a chimpanzee can fly. Little Joe monkeys need no special training.</div>
<div class="t" style="margin-top:10px">TRAINING FACILITIES</div>${TRAINING_FACILITIES.map(([id, name]) => `<div class="r"><span class="d">${name}</span><b class="${S.fac[id] ? 'ok' : 'd'}">${S.fac[id] ? 'Operational' : 'Not built (Base desk)'}</b></div>`).join('')}
<div class="t" style="margin-top:10px">FLIGHT CONTROLLERS</div>${['capcom', 'surg'].map(id => `<div class="r"><span class="d">${STATIONS[id].name}</span><b class="${S.crew[id] ? 'ok' : 'd'}">${S.crew[id] ? 'On console' : 'Vacant (Personnel)'}</b></div>`).join('')}
${state.mem.length ? `<div class="mem"><div class="t">IN MEMORIAM</div>${state.mem.map(entry => `<div><b>${escapeHtml(entry.name)}</b>, ${entry.svc}<div class="m">${entry.mission}, ${formatDate(entry.d)}</div></div>`).join('')}</div>` : ''}`);
}

// THE MAN-RATING BOARD: what stands between your boosters and a crew, for the booster chosen in the planner.
export function manRatingBoardHTML() {
  const state = S.p2, booster = S.air.find(airframe => airframe.id == (state && state.lb)), kind = booster ? booster.prog : S.cur;
  const record = manRatingRecord(kind), tick = done => done ? '<b class="ok">✓</b>' : '<b class="d">○</b>', certified = isFamilyCertified(kind);
  const name = PROGRAMMES[kind] ? PROGRAMMES[kind].name : 'Booster';
  return `<div class="c"><div class="t">MAN-RATING BOARD</div><div class="m">A crew rides only a certified booster. Each rocket programme earns its own certification: ${CLEAN_FLIGHTS_NEEDED} clean flights in a row by one booster family (every revision since its last milestone) and the man-rating research. Any flight counts, Mercury or ordinary.</div>
<div class="r"><span class="d">${name} family</span><b>Rev ${record.base} onward</b></div><div class="r"><span class="d">Clean flights in a row</span><b class="${record.streak >= CLEAN_FLIGHTS_NEEDED || certified ? 'ok' : ''}">${certified ? 'certified' : `${Math.min(record.streak, CLEAN_FLIGHTS_NEEDED)} of ${CLEAN_FLIGHTS_NEEDED}`}</b></div>
${MAN_RATING_RESEARCH.map(id => `<div class="r"><span class="d">${BY_ID[id].name}</span>${tick(isResearched(id))}</div>`).join('')}
<div class="r"><span class="d">Certified boosters</span><b class="${anyCertified() ? 'ok' : 'd'}">${certifiedNames().join('; ') || 'none yet'}</b></div></div>`;
}

// The capsule systems the planner shows for each mission type: [system key, name].
const SYSTEMS_SHOWN = {
  bj: [['hs', 'Heat shield'], ['pc', 'Parachutes']],
  lj: [['et', 'Escape tower'], ['as', 'Abort sensing'], ['pc', 'Parachutes']],
  ma: [['hs', 'Heat shield'], ['ec', 'Environmental control'], ['pc', 'Parachutes']],
  mr: [['as', 'Abort sensing'], ['et', 'Escape tower'], ['tj', 'Tower jettison'], ['ac', 'Attitude control'], ['ec', 'Environmental control'], ['hs', 'Heat shield'], ['pc', 'Parachutes'], ['lb', 'Landing bag']],
};
const kilometres = metres => `${Math.round(metres / 1000).toLocaleString()} km`;
// THE MISSION PLANNER on the Launch tab: order capsules, then pair a capsule with a booster from the hangar, a propellant and a crew.
export function renderMissionPlanner() {
  const state = S.p2, box = $('#pm');
  if (!box) return;
  box.hidden = !state;
  if (!state) return;
  const capsules = state.veh, building = missionType => S.aq.filter(item => item.k == 'msn' && item.mt == missionType).length;
  let html = Object.entries(MISSION_TYPES).map(([key, type]) => {
    const locked = requirementText(key), ready = capsules.filter(capsule => capsule.mt == key).length;
    return `<div class="c"><div class="r"><b>${type.fullName}</b><span class="d">${ready} capsule${ready == 1 ? '' : 's'} ready${building(key) ? `, ${building(key)} building` : ''}</span></div><div class="m">${type.why}</div><button data-a="mord" data-id="${key}"${locked || S.b < type.cost ? ' disabled' : ''}>ORDER ${type.capsuleName.toUpperCase()} (${formatMoney(type.cost)}, ${type.buildTime}s)</button>${locked ? `<div class="m">${locked}</div>` : ''}</div>`;
  }).join('');
  const boosters = readyBoosters();
  if (capsules.length) html += flightPreparationHTML(state, capsules, boosters);
  else if (!boosters.length) html += '<div class="m">Capsules fly on your own boosters: keep airframes in the hangar.</div>';
  html += manRatingBoardHTML() + (state.lastTx ? '<button data-a="txview">LAST FLIGHT: AIR-TO-GROUND TRANSCRIPT</button>' : '');
  setHTML(box.querySelector('#mp'), html);
}
// The planner's choices are kept in S.p2: lv capsule, lb booster, lf propellant, lc crew. Missing or stale ones are filled in here.
function flightPreparationHTML(state, capsules, boosters) {
  const capsule = capsules.find(candidate => candidate.id == state.lv) || capsules[0];
  state.lv = capsule.id;
  const crewChoices = capsule.mt == 'mr' ? ['none', 'chimp', ...activeAstronauts().filter(astronaut => astronaut.asg == 'mr').map(astronaut => astronaut.id)] : capsule.mt == 'lj' ? ['none', 'monkey'] : ['none'];
  if (!crewChoices.includes(state.lc)) state.lc = 'none';
  const propellantFor = airframe => {
    const propellants = PROGRAMMES[airframe.prog].propellants;
    return propellants.includes(state.lf) ? state.lf : propellants[0];
  };
  const plans = boosters.map(airframe => ({ airframe, plan: boosterPlan(airframe, propellantFor(airframe), capsule.mt) }));
  if (!boosters.find(airframe => airframe.id == state.lb)) {
    const best = plans.find(entry => entry.plan.ok && (state.lc == 'none' || state.lc == 'chimp' || state.lc == 'monkey' || isManRated(entry.airframe))) || plans.find(entry => entry.plan.ok) || plans[0];
    state.lb = best && best.airframe.id;
  }
  const booster = boosters.find(airframe => airframe.id == state.lb);
  if (booster) state.lf = propellantFor(booster);
  const propellants = booster ? PROGRAMMES[booster.prog].propellants : Object.keys(PROPELLANTS);
  const plan = booster && boosterPlan(booster, state.lf, capsule.mt), quote = booster && plan ? quoteLaunch(booster, state.lf, 'Mercury Capsule', plan.staged, plan.load) : null;
  const systems = capsuleSystems(capsule.cfg), shown = SYSTEMS_SHOWN[capsule.mt];
  const lock = !booster ? 'No booster in the hangar. Order airframes at the Hangar desk.'
    : !plan.ok && plan.overLimit ? `${booster.label} would exceed its ${plan.preview.maxHeat >= 1 ? 'heating' : 'aerodynamic load'} limit with a capsule aboard (${Math.round(Math.max(plan.preview.maxHeat, plan.preview.maxQ) * 100)}% of limit).`
    : !plan.ok ? `${booster.label} cannot deliver ${needText(capsule.mt)} with a capsule aboard.`
    : quote.error ? quote.error
    : S.b < quote.cost ? `Need ${formatMoney(quote.cost - S.b)} more for propellant and the pad.`
    : crewLock(state.lc, booster);
  const crewName = choice => choice == 'none' ? 'No crew (instruments only)' : choice == 'chimp' ? 'Chimpanzee' : choice == 'monkey' ? 'Rhesus monkey' : `Astronaut: ${(state.astros.find(astronaut => astronaut.id == choice) || {}).name}`;
  return `<div class="c"><div class="t">PREPARE A FLIGHT</div><select data-mv="1">${capsules.map(candidate => `<option value="${candidate.id}"${candidate.id == capsule.id ? ' selected' : ''}>${MISSION_TYPES[candidate.mt].capsuleName} #${candidate.id} (Rev ${candidate.cfg.rev}) • ${MISSION_TYPES[candidate.mt].name}</option>`).join('')}</select>
<select data-mb="1">${boosters.length ? plans.map(({ airframe, plan: option }) => `<option value="${airframe.id}"${airframe.id == state.lb ? ' selected' : ''}>Booster: ${airframe.label}, Rev ${airframe.rev}${isManRated(airframe) ? ' • man-rated' : ''}${option.ok ? '' : option.overLimit ? ' • over its limits' : ' • too weak'}</option>`).join('') : '<option>No boosters in the hangar</option>'}</select>
<select data-mf="1">${propellants.map(propellant => `<option${propellant == state.lf ? ' selected' : ''}>${propellant}</option>`).join('')}</select>
<select data-mc="1">${crewChoices.map(choice => `<option value="${choice}"${choice == state.lc ? ' selected' : ''}>${crewName(choice)}</option>`).join('')}</select>
${booster ? `<div class="m">With the capsule aboard, ${booster.label} ${plan.staged ? '(staged)' : '(single stage)'}${plan.ok && plan.load < 1 ? `, off-loaded to ${Math.round(plan.load * 100)}% propellant to stay inside its limits,` : ''} should reach <b>${kilometres(plan.preview.peakAltitude)}</b> and <b>${Math.round(plan.preview.peakSpeed).toLocaleString()} m/s</b>. This mission needs ${needText(capsule.mt)}: ${plan.ok ? '<b class="ok">enough</b>' : plan.overLimit ? '<b class="bad">not safely</b>' : '<b class="bad">not enough</b>'}. Liftoff thrust-to-weight ${plan.preview.thrustToWeight.toFixed(2)}, peak skin heating ${Math.round(plan.preview.maxHeat * 100)}% and aero load ${Math.round(plan.preview.maxQ * 100)}% of limit.${quote && !quote.error ? ` Propellant and pad ${formatMoney(quote.cost)}.` : ''}</div>` : ''}
<div class="m">Capsule systems${systems.unproven ? ` (${systems.unproven} unproven package${systems.unproven > 1 ? 's' : ''} aboard)` : ''}:</div><div class="rels">${shown.map(([key, name]) => `<div class="r"><span class="d">${name}</span><b class="${systems.reliability(key) < .85 ? 'bad' : systems.reliability(key) < .92 ? 'wn' : 'ok'}">${percent(systems.reliability(key))}</b></div>`).join('')}</div>
<button data-a="mcount" class="big"${lock ? ' disabled' : ''}>BEGIN COUNTDOWN</button>${lock ? `<div class="m bad">${lock}</div>` : ''}</div>`;
}

// THE MERCURY DIRECTIVE panel, with progress notes for the directive in hand.
function sideNotesHTML(state) {
  const network = S.fac.trknet ? '<b class="ok">in service</b>' : S.fb && S.fb.trknet ? `under construction, in service around ${formatDate(S.fb.trknet)}` : '<b class="wn">not started</b> (Base desk)';
  return `<div class="m">Mercury Worldwide Tracking Network (needed before a crew flies, not the radar): ${network}. Orbital qualification (optional): ${state.fl.maQual ? '<b class="ok">done</b>' : state.ma.n ? `${state.ma.n} flown, not yet successful` : 'not flown'}.</div>`;
}
export function mercuryDirectiveHTML() {
  const state = S.p2;
  if (!state) return '';
  if (state.secDone) return `<div class="ok">Section 1 complete ${formatDate(state.secDone)}: an American has flown in space, and the country is committed to the Moon.</div><button data-a="sec1">VIEW SECTION 1 SUMMARY</button><div class="m">Section 2 (Mercury-Atlas and Gemini) is in development.</div>`;
  const directive = MERCURY_DIRECTIVES[state.dir], key = directive.key;
  let progress = '';
  if (key == 'lj') progress = `<div class="m">Good aborts so far: ${state.lj.ok} of 3. Monkey flight: ${state.lj.mk ? '<b class="ok">done</b>' : 'still needed'}.</div>`;
  if (key == 'animal' && state.ch.t < 1) progress = `<div class="m">${state.ch.on ? `Chimpanzee training ${percent(state.ch.t)}.` : 'Start chimpanzee training in the Astronaut Office.'}</div>`;
  if (key == 'rate') {
    const record = manRatingRecord();
    progress = `<div class="m">Clean flights in a row: ${Math.min(record.streak, CLEAN_FLIGHTS_NEEDED)} of ${CLEAN_FLIGHTS_NEEDED} (${PROGRAMMES[S.cur] ? PROGRAMMES[S.cur].name : ''} Rev ${record.base}+ family). Research: ${MAN_RATING_RESEARCH.filter(isResearched).length} of ${MAN_RATING_RESEARCH.length}.</div>`;
  }
  return `<div class="t">Mercury directive ${state.dir + 1} of ${MERCURY_DIRECTIVES.length}: ${directive.name}</div><div class="m">${directive.description} Reward ${formatMoney(directive.reward)}.</div>${progress}${sideNotesHTML(state)}${officeDecisionHTML()}`;
}

// FULL-SCREEN OVERLAYS. The memorial is shown once, plainly.
export function memorialHTML(memo) {
  return `<div class="memo"><div class="d">IN MEMORIAM</div><h1>${escapeHtml(memo.name)}</h1><div>Lost on the ${memo.mission}.</div><div class="m">Crewed flights are stood down while a review board finds out what went wrong.</div><button data-a="memok">CONTINUE</button></div>`;
}
export function sectionSummaryHTML() {
  const state = S.p2, history = (S.hist || []).filter(entry => entry.d >= (S.nasa || 0));
  return `<div class="sumbox"><h1>SECTION 1 COMPLETE</h1><div class="d">Project Mercury: from NASA's founding to the first American in space • ${formatDate(state.secDone)}</div>
<div class="sumg"><div><h2>THE ROAD TO SPACE</h2>${history.map(entry => `<div class="first"><span>${escapeHtml(entry.t)}</span><b class="d">${formatDate(entry.d)}</b></div>`).join('')}</div>
<div><h2>THE ASTRONAUTS</h2>${state.astros.map(astronaut => `<div class="first"><span>${escapeHtml(astronaut.name)} <span class="d">${astronaut.svc}</span></span><b class="${astronaut.st == 'lost' ? 'bad' : 'd'}">${astronaut.st == 'lost' ? 'lost' : astronaut.st == 'medical' ? 'grounded' : `${astronaut.flights} flight${astronaut.flights == 1 ? '' : 's'}`}</b></div>`).join('')}
<h2 style="margin-top:14px">THE RACE</h2><div class="m">First human in space: ${S.fs.f_human == 'us' ? '<b class="ok">you</b>' : '<b class="bad">the Soviet Union</b> (Vostok 1)'}. Mercury flights flown: ${state.flights}. Man-rated boosters: ${certifiedNames().join('; ') || 'none'}. Orbital qualification: ${state.fl.maQual ? 'done, a head start for orbit' : 'not yet'}.</div>
<div class="m">Historically, NASA flew one more uncrewed Redstone in March 1961 to finish man-rating it. Vostok 1 flew on 12 April and Freedom 7 on 5 May. On 25 May the President asked Congress to land a man on the Moon before 1970.</div></div></div>
<div class="m">Section 2 (Mercury-Atlas, Gemini and spacewalks) is in development. You can keep flying and training in the meantime.</div><button data-a="closesum">CONTINUE</button></div>`;
}
