// INPUT: every button, select and slider on the page. Buttons carry data-a (the action) and data-id; after an action the game is
// saved and the screen redrawn, except where an action returns early.
import { S, save, resetState, log } from '../core/state.js';
import { setRequest } from '../rules/budget.js';
import { formNasa } from '../rules/race.js';
import { commission, crashProgramme } from '../rules/research.js';
import { queueResearch, queueAnalysis, unqueue, moveUpQueue } from '../rules/queue.js';
import { startProgramme } from '../rules/programs.js';
import { buildFacility, hireStation, dismissStation, scrub, troubleshoot, groundTest } from '../rules/launch-site.js';
import { mothball, reopen } from '../rules/site.js';
import { airborne } from '../rules/flight.js';
import { orderAirframes, publishBlueprint, queueRetrofit, cancelQueueItem } from '../rules/factory.js';
import { startRetrofit, startInvestigation, chooseFix, startReview, acceptFinding, extendInvestigation, nameCause } from '../rules/jobs.js';
import { hire, ensureStarter } from '../rules/game.js';
import { startCampaign, endCampaign, goAhead } from '../rules/campaign.js';
import { orderCapsule, pilotMissionType } from '../rules/mercury.js';
import { manualAbort, chooseOption } from '../rules/mission.js';
import { retuneChannel } from '../rules/telemetry.js';
import { selectCrew, setTrainingFocus, assignPilot, assignBackup } from '../rules/astronauts.js';
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
import { $ } from './dom.js';

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
    if (count) scrub(count.poll);
    closePad();
  },
  // Standing down after fuelling costs a scrub.
  stand: count => {
    if (count && count.fuel > .01) scrub(count.poll);
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
  ord: (id, button) => orderAirframes(+button.dataset.n),
  retro: id => startRetrofit(id),
  hire: id => hire(id),
  cstart: () => {
    const error = startCampaign({ ...campaignSettings(), ...campaignForm });
    if (error) log('[LAUNCH DIRECTOR] ' + error, 'bad');
  },
  cend: () => endCampaign('ended'),
  cgo: () => goAhead(),
  fac: id => buildFacility(id),
  mothball: id => mothball(id),
  reopen: id => reopen(id),
  inv: id => startInvestigation(+id),
  fix: (id, button) => chooseFix(+id, button.dataset.f),
  accept: id => acceptFinding(+id),
  extend: id => extendInvestigation(+id),
  name: (id, button) => nameCause(+id, button.dataset.f),
  publish: () => publishBlueprint(),
  upgrade: id => queueRetrofit(+id),
  cancelq: id => cancelQueueItem(+id),
  aptog: () => S.ap.on = S.ap.on ? 0 : 1,
  mcount: () => startMissionCount(),
  mord: id => orderCapsule(id),
  prog: id => {
    if (S.progs[id]) S.cur = id;
  },
  pstart: id => startProgramme(id),
  rev: id => startReview(id),
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
  memok: () => {
    S.p2.memo = null;
    $('#sum').hidden = true;
  },
  crew: id => hireStation(id),
  dismiss: id => dismissStation(id),
  analyst: () => hireAnalyst(),
  unanalyst: () => releaseAnalyst(),
  gt: id => groundTest(id),
};
// Actions that only change what is shown: they return without saving or redrawing.
const VIEW_ACTIONS = {
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

// HOVERING a research card shows it in the R&D desk's dossier. Moving between cards keeps the last one; leaving the columns
// goes back to the picked card.
document.addEventListener('mouseover', event => {
  const card = event.target.closest('#rdesk .rcard');
  if (!card && event.target.closest('#rdesk .rcols')) return;
  const id = card ? card.dataset.id : null;
  if (researchDesk.hover == id) return;
  researchDesk.hover = id;
  renderResearchDesk();
});

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
  } else if (GAME_ACTIONS[action]) GAME_ACTIONS[action](id, button);
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
