// INPUT: every button, select and slider on the page. Buttons carry data-a (the action) and data-id; after an action the game is
// saved and the screen redrawn, except where an action returns early.
import { S, save, resetState, log, withProgramme } from '../core/state.js';
import { setRequest } from '../rules/budget.js';
import { formNasa } from '../rules/race.js';
import { commission, crashProgramme } from '../rules/research.js';
import { queueResearch, queueAnalysis, queueFix, queueReview, unqueue, moveUpQueue } from '../rules/queue.js';
import { startProgramme } from '../rules/programs.js';
import { buildFacility, hireStation, dismissStation, scrub, troubleshoot, groundTest } from '../rules/launch-site.js';
import { mothball, reopen } from '../rules/site.js';
import { airborne } from '../rules/flight.js';
import { orderAirframes, publishBlueprint, queueRetrofit, cancelQueueItem, holdForLaunch } from '../rules/factory.js';
import { startCure } from '../rules/cures.js';
import { startRetrofit, startInvestigation, chooseFix, startReview, acceptFinding, extendInvestigation, nameCause } from '../rules/jobs.js';
import { hire, ensureStarter } from '../rules/game.js';
import { startCampaign, endCampaign, goAhead } from '../rules/campaign.js';
import { startRemit, raiseRemit, endRemit } from '../rules/remit.js';
import { raiseLanes, endLanes, approveLaneMilestone, laneNotNow } from '../rules/lanes.js';
import { raiseWorks, endWorks, publishHeld } from '../rules/factory-lead.js';
import { raiseOrder, endOrder, resumeOrder } from '../rules/orders.js';
import { approveBrief } from '../rules/brief.js';
import { attendFirst, proceedWithFirst } from '../rules/invitations.js';
import { bookRide, answerBumper } from '../rules/neighbours.js';
import { answerCorporal } from '../rules/corporal.js';
import { hireLead } from '../rules/leads.js';
import { decideRollover, startStudy, chooseArchitecture, giveWorkShare } from '../rules/apollo.js';
import { moveTarget, moveLimit, moveTests, retest } from '../rules/safety.js';
import { answerRequest, shield } from '../rules/requests.js';
import { startShared, raiseShared, endShared, approveProposal, notNow } from '../rules/shared-research.js';
import { orderCapsule, pilotMissionType } from '../rules/mercury.js';
import { manualAbort, chooseOption } from '../rules/mission.js';
import { retuneChannel } from '../rules/telemetry.js';
import { selectCrew, setTrainingFocus, assignPilot, assignBackup, assignThirdCrew } from '../rules/astronauts.js';
import { chooseTestingRegime, answerOfficeDecision, startChimpTraining, ensurePhaseTwo } from '../rules/astronaut-office.js';
import { launchForm, campaignForm, campaignSettings } from './launch-panel.js';
import { launchView, startCount, startFuelling, holdDay, closePad, finishFlight, renderPad, startMissionCount, showLastTranscript, drawFlightInstruments } from './launch-view.js';
import { selectedFinalists, sectionSummaryHTML } from './mercury-panels.js';
import { showPhaseOneSummary, showRunLog, copyRunLog } from './race-and-summaries.js';
import { researchDesk, renderResearchDesk } from './design-bureau.js';
import { trajectoryPanel, currentPlan } from './trajectory.js';
import { siteView, renderFacilities } from './site-plan.js';
import { hireAnalyst, releaseAnalyst } from '../rules/trajectory.js';
import { render, renderHeader, showDesk, openDesk, markDirty, resetScreen } from './screen.js';
import { openMail } from './mail.js';
import { $ } from './dom.js';
import { noteHabit, noteFix } from '../rules/culture.js';
import { startOps, raiseOps, endOps, greenlight, notYet, startSeries, endSeries } from '../rules/flight-ops.js';
import { FAILURE_MODES } from '../data/failures.js';
import { BY_ID, AREAS } from '../data/research.js';

let resetArmed = 0;

document.addEventListener('input', event => {
  if (event.target.dataset.s == 'load') $('#ldv').textContent = event.target.value + '%';
  if (event.target.dataset.tj) $('#tj-' + event.target.dataset.tj).textContent = event.target.value + '°';
});

// SELECTS: an astronaut's training focus, the Mercury planner (capsule, booster, propellant, crew, orbits), auto-publish, the campaign form and the launch form.
document.addEventListener('change', event => {
  const data = event.target.dataset, value = event.target.value;
  if (data.focus) {
    setTrainingFocus(+data.focus, value);
    save();
    return render();
  }
  if (data.mv) {
    S.p2.lv = +value;
    return render();
  }
  if (data.mb) {
    S.p2.lb = +value;
    return render();
  }
  if (data.mf) {
    S.p2.lf = value;
    return render();
  }
  if (data.mc) {
    S.p2.lc = isNaN(+value) ? value : +value;
    return render();
  }
  if (data.mo) {
    S.p2.lo = +value;
    return render();
  }
  if (data.me) {
    S.p2.le = +value;
    return render();
  }
  if (data.mr) {
    S.p2.lr = value == '0' ? 0 : value;
    return render();
  }
  if (data.rq) {
    setRequest(+value);
    save();
    return render();
  }
  if (data.tj) {
    launchForm.plan = { ...currentPlan(), [data.tj]: +value };
    return render();
  }
  if (data.ch) {
    const picked = launchForm.ch || [];
    launchForm.ch = event.target.checked ? [...picked, data.ch] : picked.filter(id => id != data.ch);
    return render();
  }
  if (data.cf) {
    campaignForm[data.cf] = data.cf == 'kind' ? value : +value;
    return render();
  }
  if (data.ap) {
    S.ap.n = +value;
    save();
    return render();
  }
  const field = data.s;
  if (!field) return;
  launchForm[field] = field == 'st' || field == 'load' ? +value : value;
  if (field == 'st') launchForm.stageChosen = 1;
  if (field == 'af') {
    launchForm.stageChosen = 0;
    launchForm.afPicked = 1;
  }
  render();
});

// THE CULTURE (rules/culture.js): your own tests and fixes are habits the team learns from. Each counts only if the work started
// or was queued.
const workCount = () => S.jobs.length + S.rq.length;
function noteIfStarted(kind, what, start) {
  const before = workCount();
  start();
  if (workCount() > before) noteHabit(kind, 1, what);
}
function noteFixChoice(incidentId, fixId, start) {
  const incident = S.inc.find(candidate => candidate.id == incidentId), fixes = incident && FAILURE_MODES[incident.dx] && FAILURE_MODES[incident.dx].fixes;
  const before = workCount();
  start();
  if (fixes && workCount() > before) noteFix(fixes, fixes.find(fix => fix.id == fixId));
}

// BUTTONS. Pad actions only apply while a countdown is open.
const PAD_ACTIONS = {
  count: () => startCount(),
  fuel: () => startFuelling(),
  topoff: count => {
    if (count) {
      count.fuel = count.target;
      log('[PAD] LOX topped off.', 'ok');
    }
  },
  hold: count => {
    if (count) {
      count.hold = 'Held by the Test Conductor.';
      count.userHold = true;
    }
  },
  resume: count => {
    if (count) {
      count.hold = '';
      count.userHold = false;
    }
  },
  over: count => {
    if (count) {
      count.override = true;
      count.hold = '';
      log('[TC] Continuing the count over a NO-GO.', 'bad');
    }
  },
  scrub: count => {
    if (count) {
      scrub(count.poll);
      noteHabit('scrub', 1, `${count.label} scrubbed`);
    }
    closePad();
  },
  // Standing down after fuelling costs a scrub.
  stand: count => {
    if (count && count.fuel > .01) scrub(count.poll);
    if (count && count.poll.nogo) noteHabit('scrub', 1, `${count.label} stood down`);
    closePad();
  },
  closepad: () => closePad(),
  fixpad: count => {
    if (count) {
      troubleshoot(count.poll);
      holdDay();
      if (!count.poll.nogo) {
        count.hold = 'Fixed. Resume when ready.';
        count.userHold = true;
      }
    }
  },
};
// Actions that change the game: id is the button's data-id; button is the element (for data-n and data-f).
const GAME_ACTIONS = {
  com: id => commission(id),
  crash: id => crashProgramme(id),
  rq: id => queueResearch(id),
  unq: index => unqueue(+index),
  qup: index => moveUpQueue(+index),
  qinv: id => queueAnalysis(+id),
  qfix: (id, button) => noteFixChoice(+id, button.dataset.f, () => queueFix(+id, button.dataset.f)),
  qrev: id => noteIfStarted('test', `a design review of ${AREAS[id] || id}`, () => queueReview(id)),
  ord: (id, button) => orderAirframes(+button.dataset.n),
  retro: id => startRetrofit(id),
  hire: id => hire(id),
  cstart: () => {
    const error = startCampaign({ ...campaignSettings(), ...campaignForm });
    if (error) log('[LAUNCH DIRECTOR] ' + error, 'bad');
  },
  cend: () => endCampaign('ended'),
  cgo: () => goAhead(),
  rstart: cap => {
    const error = startRemit(+cap);
    if (error) log('[CHIEF] ' + error, 'bad');
  },
  rraise: (id, button) => raiseRemit(button.dataset.n == '2'),
  rend: () => endRemit(),
  lraise: (id, button) => raiseLanes(button.dataset.n == '2'),
  lend: () => endLanes(),
  lapprove: id => {
    const error = approveLaneMilestone(id);
    if (error) log('[R&D] ' + error, 'bad');
  },
  lqueue: id => S.lanes && withProgramme(S.lanes.prog, () => queueResearch(id)),
  lnot: area => laneNotNow(area),
  wraise: (id, button) => raiseWorks(button.dataset.n == '2'),
  wend: () => endWorks(),
  wpub: () => publishHeld(),
  leadhire: id => {
    const error = hireLead(...id.split(':'));
    if (error) log('[R&D] ' + error, 'bad');
  },
  sstart: cap => {
    const error = startShared(+cap);
    if (error) log('[R&D] ' + error, 'bad');
  },
  sraise: (id, button) => raiseShared(button.dataset.n == '2'),
  sclose: () => endShared(),
  sapprove: id => {
    const error = approveProposal(id);
    if (error) log('[R&D] ' + error, 'bad');
  },
  snot: area => notNow(area),
  aproll: send => decideRollover(send == '1'),
  apstudy: size => {
    const error = startStudy(size);
    if (error) log('[NASA] ' + error, 'bad');
  },
  apshare: key => {
    const error = giveWorkShare(key);
    if (error) log('[NASA] ' + error, 'bad');
  },
  aparch: key => {
    const error = chooseArchitecture(key);
    if (error) log('[NASA] ' + error, 'bad');
  },
  sftgt: (_, button) => moveTarget(+button.dataset.n),
  sflim: (key, button) => moveLimit(key, +button.dataset.n),
  sftests: (_, button) => moveTests(+button.dataset.n),
  v2ride: name => {
    const error = bookRide(name);
    if (error) log('[V-2 PANEL] ' + error, 'bad');
  },
  corpyes: () => answerCorporal(true),
  corpno: () => answerCorporal(false),
  bumpyes: () => answerBumper(true),
  bumpno: () => answerBumper(false),
  sfretest: kind => retest(kind),
  rqans: answer => {
    const error = answerRequest(answer);
    if (error) log('[NASA] ' + error, 'bad');
  },
  shield: key => {
    const error = shield(key);
    if (error) log('[NASA] ' + error, 'bad');
  },
  iattend: () => attendFirst(),
  iproceed: () => proceedWithFirst(),
  bstart: size => {
    const error = approveBrief(+size);
    if (error) log('[PROGRAMME] ' + error, 'bad');
  },
  oraise: (_, button) => raiseOrder(button.dataset.n == '2'),
  fstart: cap => {
    const error = startOps(+cap);
    if (error) log('[FLIGHT OPS] ' + error, 'bad');
  },
  fraise: (id, button) => raiseOps(button.dataset.n == '2'),
  fend: () => endOps(),
  fgo: (id, button) => greenlight(false, false, +(button.dataset.n || 1)),
  fattend: () => {
    greenlight(true);
    openDesk('watch');
  },
  fnot: () => notYet(),
  fseries: (id, button) => {
    const error = startSeries(id, +button.dataset.n);
    if (error) log('[FLIGHT OPS] ' + error, 'bad');
  },
  fsend: () => endSeries(),
  oend: () => endOrder(),
  ores: () => resumeOrder(),
  fac: id => buildFacility(id),
  mothball: id => mothball(id),
  reopen: id => reopen(id),
  inv: id => startInvestigation(+id),
  fix: (id, button) => noteFixChoice(+id, button.dataset.f, () => chooseFix(+id, button.dataset.f)),
  accept: id => acceptFinding(+id),
  extend: id => extendInvestigation(+id),
  name: (id, button) => nameCause(+id, button.dataset.f),
  publish: () => publishBlueprint(),
  upgrade: id => queueRetrofit(+id),
  cure: id => { const [kind, traitKey] = id.split(':'); withProgramme(kind, () => startCure(kind, traitKey)); },
  afhold: id => holdForLaunch(+id, !(S.air.find(airframe => airframe.id == +id) || {}).hold),
  cancelq: id => cancelQueueItem(+id),
  aptog: () => S.ap.on = S.ap.on ? 0 : 1,
  mcount: id => startMissionCount(id == 'over'),
  mord: id => orderCapsule(id),
  prog: id => {
    if (S.progs[id]) S.cur = id;
  },
  pstart: id => startProgramme(id),
  rev: id => noteIfStarted('test', `a design review of ${AREAS[id] || id}`, () => startReview(id)),
  reg: id => chooseTestingRegime(id),
  offy: () => answerOfficeDecision(true),
  offn: () => answerOfficeDecision(false),
  chimps: () => startChimpTraining(),
  selt: id => selectedFinalists.has(+id) ? selectedFinalists.delete(+id) : selectedFinalists.add(+id),
  selok: () => {
    if (selectCrew([...selectedFinalists])) selectedFinalists.clear();
  },
  asg: id => assignPilot(+id, pilotMissionType()),
  bkp: id => assignBackup(+id, pilotMissionType()),
  asgp: id => assignPilot(+id, 'gtp'),
  bkpp: id => assignBackup(+id, 'gtp'),
  nxp: id => assignThirdCrew(+id, 'gt'),
  nxpp: id => assignThirdCrew(+id, 'gtp'),
  memok: () => {
    S.p2.memo = null;
    $('#sum').hidden = true;
  },
  crew: id => hireStation(id),
  dismiss: id => dismissStation(id),
  analyst: () => hireAnalyst(),
  unanalyst: () => releaseAnalyst(),
  gt: id => noteIfStarted('test', `a ground test of ${BY_ID[id] ? BY_ID[id].name : id}`, () => groundTest(id)),
};
// Actions that only change what is shown: they return without saving or redrawing.
const VIEW_ACTIONS = {
  // Mail: open a message, or go from Ellis's incident message to the incidents in Research.
  mailopen: id => openMail(id),
  // From the directive or race block in the top bar: open Mail on that message.
  mailshow: id => {
    openDesk('');
    openMail(id);
  },
  // From Ellis's remit message: her rocket's incidents, with the findings she referred to you.
  mailremit: () => {
    if (S.remit && S.progs[S.remit.prog]) S.cur = S.remit.prog;
    researchDesk.view = 'incidents';
    openDesk('rd');
    render();
  },
  mailinc: () => {
    researchDesk.view = 'incidents';
    openDesk('rd');
    render();
  },
  nasa: () => {
    formNasa();
    ensurePhaseTwo();
    save();
    render();
    showPhaseOneSummary();
  },
  summary: () => showPhaseOneSummary(),
  closesum: () => {
    $('#sum').hidden = true;
  },
  runlog: () => showRunLog(),
  copylog: () => copyRunLog(),
  mdec: id => {
    if (airborne.mission) {
      chooseOption(airborne.mission, +id);
      renderPad();
    }
  },
  txview: () => showLastTranscript(),
  retune: id => {
    if (airborne.flight) {
      retuneChannel(airborne.flight, id);
      drawFlightInstruments(airborne.flight);
    }
  },
  // The R&D desk: switch its view, or pick a research card for the detail bar.
  rview: id => {
    researchDesk.view = id;
    render();
  },
  // The flight result's incident button: back to operations, with the R&D desk open on that incident's rocket and view.
  incident: (id, button) => {
    closePad();
    if (S.progs[button.dataset.f]) S.cur = button.dataset.f;
    const incident = S.inc.find(candidate => candidate.id == id);
    researchDesk.view = incident && (incident.st == 'diag' || incident.st == 'fixing') ? 'file' : 'incidents';
    openDesk('rd');
    render();
  },
  rpick: id => {
    researchDesk.pick = id;
    render();
  },
  rfold: area => {
    researchDesk.unfolded[area] = !researchDesk.unfolded[area];
    render();
  },
  // The trajectory panel: open or close it, pick a pitch program, or go back to the default plan.
  traj: () => {
    trajectoryPanel.open = !trajectoryPanel.open;
    render();
  },
  tjprog: id => {
    launchForm.plan = { ...currentPlan(), program: id };
    render();
  },
  tjreset: () => {
    launchForm.plan = null;
    render();
  },
  // The trajectory team: the goal it searches for, and flying the best plan it has found.
  tjgoal: id => {
    trajectoryPanel.goal = id;
    render();
  },
  tjbest: () => {
    launchForm.plan = { ...trajectoryPanel.search.best.plan };
    render();
  },
  sec1: () => {
    $('#sum').innerHTML = sectionSummaryHTML();
    $('#sum').hidden = false;
  },
};

document.addEventListener('click', event => {
  const deskButton = event.target.closest('[data-desk]');
  if (deskButton) return showDesk(deskButton.dataset.desk);
  const speedButton = event.target.closest('[data-spd]');
  if (speedButton) {
    S.speed = +speedButton.dataset.spd;
    return renderHeader();
  }
  const plot = event.target.closest('[data-plot]');
  if (plot) {
    siteView.selected = plot.dataset.plot;
    return renderFacilities();
  }
  const button = event.target.closest('button[data-a]');
  if (!button || button.disabled) return;
  const action = button.dataset.a, id = button.dataset.id;
  if (VIEW_ACTIONS[action]) return VIEW_ACTIONS[action](id, button);
  if (PAD_ACTIONS[action]) PAD_ACTIONS[action](launchView.count);
  else if (action == 'abort') {
    if (airborne.flight) finishFlight(0, 'abort');
    else if (airborne.mission) manualAbort(airborne.mission);
  } else if (GAME_ACTIONS[action]) {
    // A button inside a lower stage's block (ui/design-bureau.js) acts with that stage in focus.
    const stage = button.closest('[data-stage]');
    stage ? withProgramme(stage.dataset.stage, () => GAME_ACTIONS[action](id, button)) : GAME_ACTIONS[action](id, button);
  }
  else if (action == 'reset') {
    if (!resetArmed) return armReset(button);
    resetGame(button);
  }
  save();
  markDirty();
  render();
});
// RESET takes two clicks within four seconds.
function armReset(button) {
  resetArmed = 1;
  button.textContent = 'CLICK AGAIN TO WIPE THE SAVE';
  setTimeout(() => {
    resetArmed = 0;
    const resetButton = $('#rs');
    if (resetButton) resetButton.textContent = 'RESET';
  }, 4000);
}
function resetGame(button) {
  resetArmed = 0;
  button.textContent = 'RESET';
  if (launchView.flightTimer) clearInterval(launchView.flightTimer);
  if (launchView.countTimer) clearInterval(launchView.countTimer);
  launchView.flightTimer = launchView.countTimer = null;
  airborne.flight = null;
  launchView.count = null;
  $('#pad').hidden = true;
  $('#home').hidden = false;
  resetState();
  ensureStarter();
  $('#lg').innerHTML = '';
  $('#fl').hidden = true;
  $('#lc').hidden = false;
  resetScreen();
  document.documentElement.classList.remove('flying');
}
