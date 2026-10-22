// THE LAUNCH VIEW: from rollout to splashdown the pad takes the launch desk's place under the plotting board, while the
// consoles on the right follow every station.
// The count starts at T-30. Propellant loading runs inside it; the stations are polled from T-15; anything not ready, or any NO-GO,
// holds the clock. Then either the rocket flies its physics (ordinary launches) or a Mercury mission runs its timeline.
import { formatMoney, gaussian } from '../core/util.js';
import { ROOMS, STATIONS } from '../data/launch-site.js';
import { MISSION_TYPES } from '../data/mercury.js';
import { PAYLOADS } from '../data/launch.js';
import { S, log, logSink } from '../core/state.js';
import { hasBoosterStage, quoteLaunch } from '../rules/design.js';
import { roomLevel, runPoll, PAD_FIX_COST, padFixOdds, scrubCost } from '../rules/launch-site.js';
import { airborne, beginFlight, previewFlight, step, takeReadings, endFlight, formatAltitude, CHANNELS } from '../rules/flight.js';
import { boosterPlan, crewLock } from '../rules/mercury.js';
import { PART_CHANNELS, partReading, watchedChannels, warningLevel } from '../rules/telemetry.js';
import { crewCallouts } from '../rules/callouts.js';
import { beginMission, stepMission, endMission, reading, decisionOptions, decisionOdds, speakerName } from '../rules/mission.js';
import { launchForm, renderControlRoom } from './launch-panel.js';
import { renderConsoles } from './consoles.js';
import { renderPlot } from './plot.js';
import { render, markDirty } from './screen.js';
import { $, setHTML } from './dom.js';

// The launch view's state. count: the countdown in progress, or null:
//   poll (rules/launch-site.js runPoll), shown: poll lines revealed so far, phase: count | flight | done
//   fuel / target: propellant on board / planned (shares of a full tank), filling, label, clock (count seconds left), running
//   hold: why the clock is held ('' if not), userHold: held by the player, override: continuing over a NO-GO
//   polling, pollTicks: the poll is being read out; mission: { vid, crew, af, fuel } for a Mercury flight; result: how it ended
// countTimer, flightTimer: the interval timers. lastTrace: the last flight's altitudes, kept on the plotting board.
export const launchView = { count: null, countTimer: null, flightTimer: null, lastTrace: [] };
export const isBusy = () => !!launchView.count;

const COUNT_FROM = 30, POLL_AT = 15, COUNT_RATE = 2; // count seconds per real second

function openPad() {
  $('#pad').hidden = false;
  $('#home').hidden = true;
  $('#padlog').innerHTML = '';
  $('#comms').hidden = true;
}
export function closePad() {
  clearInterval(launchView.countTimer);
  launchView.countTimer = null;
  launchView.count = null;
  $('#pad').hidden = true;
  $('#home').hidden = false;
  $('#fl').hidden = true;
  $('#comms').hidden = true;
  markDirty();
  render();
}
// Speech bubbles over the stations: GO / NO-GO as the poll is read out, and the fuelling call before it.
// In flight, the latest call on the loop (rules/callouts.js); after it, every station's last call and the Test Conductor's verdict.
export function stationBubbles() {
  const count = launchView.count, bubbles = {};
  if (!count) return bubbles;
  if (count.phase == 'flight' && airborne.flight) return airborne.flight.bubbles;
  if (count.phase == 'done' && count.lastCalls) return count.lastCalls;
  if (count.shown) {
    for (const line of count.poll.lines.slice(0, count.shown)) bubbles[line.id] = { t: line.go ? 'GO' : 'NO-GO', c: line.go ? 'go' : 'no' };
  } else if (count.phase == 'count') {
    const who = S.crew.bstr ? 'bstr' : 'tc';
    if (count.filling) bubbles[who] = { t: 'FUELING', c: 'wn' };
    else if (count.fuel >= count.target - .005 && count.fuel > 0) bubbles[who] = { t: 'TANKS LOADED', c: 'go' };
  }
  return bubbles;
}
const clockText = () => {
  const seconds = Math.max(0, Math.ceil(launchView.count.clock));
  return `T-00:${String(seconds).padStart(2, '0')}`;
};
// The light update every tick: clock and tank only. renderPad() redraws the room when something changes.
function updateCountDisplay() {
  const count = launchView.count;
  if (!count) return;
  const phase = $('#padph');
  if (count.phase == 'count') phase.textContent = `${clockText()} ${count.hold ? 'HOLDING' : count.running ? 'COUNTING' : ''}`;
  const tank = $('#tankfill'), tankPercent = $('#tankpct');
  if (tank) tank.style.width = count.fuel * 100 + '%';
  if (tankPercent) tankPercent.textContent = Math.round(count.fuel * 100) + '%';
  renderConsoles();
}

// The pad: the room with its stations, then the tank, the poll, holds and the buttons for what can be done now.
export function renderPad() {
  const count = launchView.count;
  if (!count) return;
  const level = roomLevel(), poll = count.poll, airframe = S.air.find(candidate => candidate.id == poll.af) || { label: count.label }, pollDone = count.shown >= poll.lines.length;
  $('#padt').textContent = `${ROOMS[level].name} — ${count.label}`;
  renderControlRoom();
  renderConsoles();
  renderPlot();
  if (count.phase == 'done' && count.mission) return showMissionResult(count.result);
  if (count.phase == 'done') return showFlightResult(count.result);
  if (count.phase == 'flight') {
    $('#paddlg').innerHTML = count.mission && airborne.mission && airborne.mission.pending ? decisionHTML(airborne.mission) : '';
    return;
  }
  updateCountDisplay();
  let html = `<div class="tank"><div class="r"><span class="d">Propellant ${count.filling ? 'loading' : 'on board'}</span><b><span id="tankpct">${Math.round(count.fuel * 100)}%</span> <span class="d">of ${Math.round(count.target * 100)}% planned</span></b></div><div class="bar"><i id="tankfill" style="width:${count.fuel * 100}%"></i><s style="left:${count.target * 100}%"></s></div></div>`;
  if (!count.filling && count.fuel < .01) html += S.crew.bstr ? '' : `<div class="m">No Structures & Booster Engineer on the net: loading is yours, and the count will hold at T-${POLL_AT} until the tanks are full.</div><button data-a="fuel">COMMENCE FUELING & PRESSURIZATION</button>`;
  else if (!count.filling && count.fuel < count.target - .005 && !S.crew.bstr) html += `<button data-a="topoff">TOP OFF LOX (boil-off has cost ${Math.round((count.target - count.fuel) * 100)}%)</button>`;
  // The poll lines worth reading: NO-GO calls, the Test Conductor's report, and fixes or weather holds.
  html += poll.lines.slice(0, count.shown).filter(line => line.msg && (!line.go || line.id == 'tc' || /Fixed|Held/.test(line.msg))).map(line => `<div class="m"><b>${STATIONS[line.id].callSign}:</b> ${line.msg}</div>`).join('');
  if (count.shown && !pollDone) html += `<div class="m wn">${level >= 4 && S.crew.fd ? 'FLIGHT: "All stations, go/no-go for launch."' : 'Polling the stations…'}</div>`;
  if (pollDone && poll.lines.length == 1) html += '<div class="m">Nobody else is on the net. Launch crew hired in Personnel will catch faults before they fly.</div>';
  if (pollDone && poll.wk && poll.wind && airframe.pk) {
    const windy = previewFlight(airframe, launchForm.fuel, launchForm.pay, launchForm.st, count.fuel, poll.wind);
    html += `<div class="r"><span class="d">Aero load in these winds</span><b class="${windy.maxQ > .85 ? 'bad' : windy.maxQ > .6 ? 'wn' : 'ok'}">${Math.round(windy.maxQ * 100)}% of limit</b></div>`;
  }
  if (count.hold) html += `<div class="t bad">HOLD: ${count.hold}</div>`;
  const noGo = poll.lines.find(line => !line.go);
  html += '<div class="padbtns">';
  if (pollDone && poll.nogo) html += `${noGo.wind ? `<button data-a="fixpad"${S.b < PAD_FIX_COST ? ' disabled' : ''}>HOLD FOR WEATHER (${formatMoney(PAD_FIX_COST)}, 2 days)</button>` : `<button data-a="fixpad"${S.b < PAD_FIX_COST ? ' disabled' : ''}>TROUBLESHOOT (${formatMoney(PAD_FIX_COST)}, ~${Math.round(padFixOdds(poll) * 100)}% to fix)</button>`}<button data-a="scrub">SCRUB (${formatMoney(scrubCost())})</button><button data-a="over" class="danger">OVERRIDE AND CONTINUE</button>`;
  else if (count.hold && count.userHold) html += `<button data-a="resume" class="big">RESUME COUNT</button><button data-a="stand">STAND DOWN</button>`;
  else if (count.hold) html += `<button data-a="stand">STAND DOWN</button>`;
  else html += `<button data-a="hold">HOLD THE COUNT</button><button data-a="stand">STAND DOWN</button>`;
  $('#paddlg').innerHTML = html + '</div>';
}
function showMissionResult(result) {
  $('#padph').textContent = result.lost ? 'CREW LOST' : result.ok ? 'MISSION COMPLETE' : 'MISSION FAILED';
  $('#paddlg').innerHTML = `<div class="t ${result.ok ? 'ok' : 'bad'}">${result.ok ? 'Splashdown and recovery.' : result.lost ? 'The crew has been lost.' : 'The mission did not go to plan.'}${result.met ? ' Directive fulfilled.' : ''}</div><div class="m">${result.text}</div><button data-a="closepad" class="big">RETURN TO OPERATIONS</button>`;
}
function showFlightResult(result) {
  $('#padph').textContent = result.ok ? (result.why == 'orbit' ? 'ORBIT' : 'FLIGHT COMPLETE') : result.why == 'abort' ? 'ABORTED' : 'VEHICLE LOST';
  $('#paddlg').innerHTML = `<div class="t ${result.ok ? 'ok' : 'bad'}">${result.ok ? (result.why == 'orbit' ? 'Orbital insertion confirmed.' : 'Impact recorded downrange.') : result.why == 'abort' ? 'Range safety terminated the flight.' : 'Track lost. The vehicle has failed.'}</div><div class="m">See the log for records, science and any incident report.</div><button data-a="closepad" class="big">RETURN TO OPERATIONS</button>`;
}

// THE COUNT. A new countdown runs the go/no-go poll at once (its results are read out from T-15).
const newCount = (poll, target, label, mission) => ({
  poll, shown: 0, phase: 'count', fuel: 0, target, filling: false, label, clock: COUNT_FROM, running: true, hold: '', userHold: false, override: false, ...(mission ? { mission } : {}),
});
function runCount() {
  if (S.crew.bstr) startFuelling();
  clearInterval(launchView.countTimer);
  launchView.countTimer = setInterval(countTick, 100);
  renderPad();
}
export function startCount() {
  const form = launchForm, airframe = S.air.find(candidate => candidate.id == form.af && candidate.st == 'r');
  if (!airframe || quoteLaunch(airframe, form.fuel, form.pay, form.st, form.load / 100).error) return;
  launchView.count = newCount(runPoll(airframe, form.fuel, form.st && hasBoosterStage(airframe) ? 1 : 0), form.load / 100, airframe.label);
  openPad();
  runCount();
}
// One 100 ms tick of the count: loading, the clock, reading out the poll, and the holds.
function countTick() {
  const count = launchView.count;
  if (!count || count.phase != 'count') return;
  let redraw = false;
  const poll = count.poll;
  if (count.filling) {
    count.fuel = Math.min(count.target, count.fuel + (S.crew.bstr ? .02 : .01) * count.target);
    if (count.fuel >= count.target) {
      count.filling = false;
      // Without the Structures & Booster Engineer, loading lands within a few percent of plan.
      if (!S.crew.bstr) count.fuel = Math.max(.05, Math.min(1, count.target * (1 + .04 * gaussian())));
      log(S.crew.bstr ? '[BSTR] Tanks loaded and pressurized to plan.' : `[PAD] Tanks loaded: about ${Math.round(count.fuel * 100)}% against ${Math.round(count.target * 100)}% planned. Pressurization nominal.`, 'ok');
      if (count.hold == 'Propellant loading incomplete.') count.hold = '';
      redraw = true;
    }
  }
  if (count.running && !count.hold) {
    count.clock -= COUNT_RATE * .1;
    if (count.clock <= POLL_AT && !count.shown && !count.polling) {
      if (count.filling || count.fuel < .01) {
        count.hold = 'Propellant loading incomplete.';
        count.clock = POLL_AT;
        redraw = true;
      } else {
        count.polling = 1;
        count.pollTicks = 0;
        count.shown = 1;
        redraw = true;
      }
    }
    if (count.polling && count.shown < poll.lines.length && ++count.pollTicks >= (roomLevel() >= 4 ? 4 : 6)) {
      count.pollTicks = 0;
      count.shown++;
      redraw = true;
    }
    if (count.polling && count.shown >= poll.lines.length) {
      count.polling = 0;
      if (poll.nogo && !count.override) {
        count.hold = 'NO-GO called.';
        redraw = true;
      }
    }
    if (count.clock <= 2 && count.shown < poll.lines.length) {
      count.hold = 'Awaiting station reports.';
      count.clock = 2;
      redraw = true;
    }
    if (count.clock <= 0) {
      count.clock = 0;
      return liftoff(count.override);
    }
  }
  if (redraw) renderPad();
  else updateCountDisplay();
}
export function startFuelling() {
  const count = launchView.count;
  if (!count || count.filling) return;
  count.filling = true;
  renderPad();
}
// Every day held on the pad boils off LOX. The Structures & Booster Engineer tops it off as it goes.
export function holdDay() {
  const count = launchView.count;
  if (!count) return;
  if (S.crew.bstr) log('[BSTR] LOX topped off during the hold.', 'ok');
  else {
    count.fuel = Math.max(.05, count.fuel * .95);
    log(`[PAD] LOX boil-off during the hold. Propellant now about ${Math.round(count.fuel * 100)}%.`, 'wn');
  }
}
function liftoff(override) {
  if (!launchView.count) return;
  if (launchView.count.mission) return launchMission(override);
  launchFlight(override);
}

// THE MISSION CLOCK STRIP under the plotting board: the clock, the flight's milestones, and what the tracking can read now.
// phases: [{ name, reached }], in order; the one after the last reached is coming up. readouts: [{ label, text, none, lost, warn }].
const clockFormat = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
function drawClockStrip(clock, phases, readouts) {
  $('#mclock').textContent = clock;
  // A milestone counts as passed once any later one is (a slow rocket may never show a clear max Q).
  const passed = phases.map(phase => phase.reached).lastIndexOf(true);
  setHTML($('#phases'), phases.map((phase, index) => `<div class="ph ${index <= passed ? 'done' : index == passed + 1 ? 'now' : ''}"><i></i><span>${phase.name}</span></div>`).join(''));
  setHTML($('#readouts'), readouts.map(item => `<span class="ro${item.warn ? ' bad' : ''}"><span class="d">${item.label}</span> <b>${item.none ? 'N/A' : item.lost ? 'NO TRACK' : item.text}</b></span>`).join(''));
  renderConsoles();
  renderPlot();
}

// AN ORDINARY FLIGHT: its milestones, and the readings the range and the rocket's own telemetry can give.
function flightPhases(flight) {
  const ui = flight.clockMarks || (flight.clockMarks = { qPeak: 0 }), payload = PAYLOADS[flight.payload], last = flight.stages[flight.stages.length - 1];
  ui.qPeak = Math.max(ui.qPeak, flight.aeroLoad || 0);
  const apogee = flight.time > 5 && flight.verticalSpeed <= 0;
  const phases = [
    { name: 'IGNITION', reached: flight.countdown <= 0 },
    { name: 'MAX Q', reached: ui.qPeak > .05 && flight.aeroLoad < ui.qPeak * .7 },
    { name: flight.stages.length > 1 ? 'STAGE 2 CUTOFF' : 'CUTOFF', reached: last.fuel <= 0 },
  ];
  if (payload.satellite) return [...phases, { name: 'ORBIT', reached: false }];
  phases.push({ name: 'APOGEE', reached: apogee });
  if (payload.science) phases.push({ name: 'CHUTE', reached: apogee && !!flight.descent && flight.altitude < 3000 });
  return [...phases, { name: 'IMPACT', reached: false }];
}
function drawFlightInstruments(flight) {
  const readings = flight.lastReadings, lost = flight.lostChannels || {}, ground = flight.tracking.g, vehicle = flight.tracking.v;
  const approximate = reading => reading && reading.quality.noise >= .05 ? '~' : '';
  const readouts = [];
  const altitude = readings.alt;
  readouts.push({ label: 'RADAR ALT', text: altitude ? formatAltitude(altitude.value, altitude.quality) : '--', lost: lost.alt });
  const velocity = readings.vel;
  readouts.push(CHANNELS.vel.quality(ground, vehicle)
    ? { label: vehicle >= 2 ? 'ACCEL VEL' : 'DOPPLER VEL', text: velocity ? approximate(velocity) + velocity.value + ' m/s' : '--', lost: lost.vel }
    : { label: 'VELOCITY', none: 1 });
  const fuel = readings.fuel;
  readouts.push(vehicle >= 1
    ? { label: 'PROPELLANT', text: fuel ? approximate(fuel) + fuel.value + ' kg' : '--', lost: lost.fuel }
    : { label: 'BURN', text: flight.time < flight.burnTime ? `${flight.burnTime - flight.time}s left` : 'BURNOUT' });
  const horizontal = readings.hor;
  readouts.push(CHANNELS.hor.quality(ground, vehicle)
    ? { label: vehicle >= 3 ? 'INERTIAL H-VEL' : 'RANGE RATE', text: horizontal ? approximate(horizontal) + horizontal.value + ' m/s' : '--', lost: lost.hor }
    : { label: 'DOWNRANGE', none: 1 });
  // The part channels picked before launch; a channel showing a failure building turns red.
  for (const id of flight.watch || []) readouts.push({ label: PART_CHANNELS[id].label, text: partReading(flight, id).text, warn: warningLevel(flight, id) > .3 });
  drawClockStrip(flight.countdown > 0 ? `T-00:0${flight.countdown}` : `T+${clockFormat(flight.time)}`, flightPhases(flight), readouts);
}
function launchFlight(override) {
  const count = launchView.count, poll = count.poll, form = launchForm;
  const airframe = S.air.find(candidate => candidate.id == poll.af && candidate.st == 'r');
  const flight = airframe && beginFlight(airframe, form.fuel, form.pay, form.st, count.fuel, { latent: poll.fault, wind: poll.wind, over: override });
  if (!flight) return;
  flight.watch = watchedChannels(airframe, form.ch);
  flight.bubbles = { tc: { t: 'LIFTOFF', c: 'go' } };
  flight.warningTicks = 0;
  airborne.flight = flight;
  flight.countdown = 0;
  clearInterval(launchView.countTimer);
  launchView.countTimer = null;
  count.phase = 'flight';
  log('[TC] Ignition. Liftoff!', 'hd');
  document.documentElement.classList.add('flying');
  $('#fl').hidden = false;
  renderPad();
  drawFlightInstruments(flight);
  $('#ln').textContent = roomLevel() >= 2 ? 'Trajectory is plotted on the board above.' : 'No plotting board yet: radar calls are marked by hand above.';
  launchView.flightTimer = setInterval(flightTick, 250);
}
// The Test Conductor's last word on the loop, by how the flight ended.
const FLIGHT_VERDICTS = { land: { t: 'IMPACT', c: 'go' }, orbit: { t: 'ORBIT', c: 'go' }, fail: { t: 'VEHICLE LOST', c: 'no' }, abort: { t: 'ABORTED', c: 'no' } };
export function finishFlight(ok, why) {
  const flight = airborne.flight;
  clearInterval(launchView.flightTimer);
  launchView.flightTimer = null;
  launchView.lastTrace = flight.trace.slice();
  endFlight(flight, ok, why);
  airborne.flight = null;
  document.documentElement.classList.remove('flying');
  if (launchView.count) {
    launchView.count.phase = 'done';
    launchView.count.result = { ok, why };
    launchView.count.lastCalls = { ...flight.lastCalls, tc: FLIGHT_VERDICTS[why] };
  }
  $('#fl').hidden = true;
  markDirty();
  render();
  renderPad();
}
// A quarter-second of the flight: two seconds of flight time under power, 25 while coasting above the atmosphere.
function flightTick() {
  const flight = airborne.flight;
  if (!flight) return;
  const phase = $('#padph');
  if (flight.countdown > 0) {
    phase.textContent = `T-MINUS ${flight.countdown}`;
    if (++flight.countdownTicks >= 4) {
      flight.countdown--;
      flight.countdownTicks = 0;
    }
    return;
  }
  phase.textContent = flight.stages[flight.stageIndex].fuel > 0 ? (flight.stageIndex ? 'STAGE 2 BURN' : 'POWERED ASCENT') : flight.coasting ? 'COASTING ABOVE THE ATMOSPHERE' : flight.verticalSpeed > 0 ? 'COASTING' : 'DESCENT';
  // While a failure shows its warning on a watched channel, the flight runs in real time (one second every fourth tick), so there is time to abort.
  const warning = flight.pending && (flight.watch || []).some(id => warningLevel(flight, id) > 0);
  if (warning && ++flight.warningTicks % 4) return drawFlightInstruments(flight);
  const steps = warning ? 1 : flight.coasting ? 25 : 2, bubbles = flight.bubbles;
  for (let n = 0; n < steps; n++) {
    const result = step(flight);
    if (result == 'sep') {
      logSink.fn(flight.tracking.v >= 1 ? `T+${flight.time}s | [TLM] Booster separation confirmed.` : `T+${flight.time}s | [RANGE] Staging commanded. Separation not confirmed.`, 'ok');
      continue;
    }
    if (result == 'fail') return finishFlight(0, 'fail');
    if (result == 'orbit') return finishFlight(1, 'orbit');
    if (result == 'land') return finishFlight(1, 'land');
    crewCallouts(flight);
    takeReadings(flight, flight.coasting && n < steps - 1);
  }
  if (flight.bubbles != bubbles) renderPad();
  drawFlightInstruments(flight);
}

// A MERCURY FLIGHT: the same count and poll, then the mission timeline with decisions and the air-to-ground loop.
export function startMissionCount() {
  const state = S.p2, capsule = state && state.veh.find(candidate => candidate.id == state.lv), booster = state && S.air.find(airframe => airframe.id == state.lb && airframe.st == 'r');
  if (!capsule || !booster) return;
  const crew = state.lc || 'none', propellant = state.lf || 'Alcohol & LOX', plan = boosterPlan(booster, propellant, capsule.mt);
  if (!plan.ok || crewLock(crew, booster)) return;
  launchView.count = newCount(runPoll(booster, propellant, plan.staged), 1, `${MISSION_TYPES[capsule.mt].fullName}: capsule #${capsule.id} on ${booster.label}`, { vid: capsule.id, crew, af: booster.id, fuel: propellant });
  openPad();
  runCount();
}
function launchMission(override) {
  const count = launchView.count, poll = count.poll;
  const mission = beginMission(count.mission.vid, count.mission.crew, { af: count.mission.af, fuel: count.mission.fuel, latent: poll.fault, over: override, wind: poll.wind });
  if (!mission) return;
  airborne.mission = mission;
  mission.shownTranscript = 0;
  $('#ctx').innerHTML = '';
  $('#comms').hidden = false;
  drawTranscript(mission);
  clearInterval(launchView.countTimer);
  launchView.countTimer = null;
  count.phase = 'flight';
  log('[TC] Ignition. Liftoff!', 'hd');
  document.documentElement.classList.add('flying');
  $('#fl').hidden = false;
  renderPad();
  drawMissionInstruments(mission);
  $('#ln').textContent = mission.crew && !mission.crew.species ? `${mission.crew.name} is aboard. Decisions in flight are theirs, with CAPCOM's help.` : 'Telemetry from the capsule.';
  launchView.flightTimer = setInterval(missionTick, 250);
}
// A quarter-second of the mission: five mission seconds with a pilot aboard, ten without. The clock stops for decisions.
function missionTick() {
  const mission = airborne.mission;
  if (!mission) return;
  if (mission.pending) {
    $('#padph').textContent = 'DECISION';
    return;
  }
  const result = stepMission(mission, mission.crew && !mission.crew.species ? 5 : 10);
  drawTranscript(mission);
  const now = reading(mission);
  mission.trace.push(Math.round(now.alt * 1000));
  const type = mission.type;
  $('#padph').textContent = result == 'decide' ? 'DECISION' : `T+${Math.floor(mission.time / 60)}:${String(Math.floor(mission.time % 60)).padStart(2, '0')} ${mission.time < (type.sep || 40) ? 'POWERED FLIGHT' : mission.time < (type.reentry || type.chute) ? 'COAST' : mission.time < type.chute ? 'RE-ENTRY' : 'DESCENT AND RECOVERY'}`;
  drawMissionInstruments(mission);
  if (result == 'decide') renderPad();
  if (result == 'end') finishMission();
}
function drawMissionInstruments(mission) {
  const now = reading(mission), type = mission.type, time = mission.time;
  const phases = [{ name: 'LIFTOFF', reached: time > 0 }];
  if (type.sep) phases.push({ name: 'BOOSTER SEP', reached: time >= type.sep });
  if (type.reentry) phases.push({ name: 'RE-ENTRY', reached: time >= type.reentry });
  phases.push({ name: 'CHUTE', reached: time >= type.chute }, { name: 'SPLASHDOWN', reached: false });
  drawClockStrip(`T+${clockFormat(time)}`, phases, [
    { label: 'ALTITUDE', text: `${now.alt.toFixed(1)} km` },
    { label: 'VELOCITY', text: `${Math.round(now.v)} m/s` },
    { label: 'G-LOAD', text: `${now.g.toFixed(1)} g` },
    { label: 'CABIN TEMP', text: `${now.temp} °C` },
  ]);
}
function decisionHTML(mission) {
  const key = mission.pending.key, options = decisionOptions(mission, key);
  return `<div class="t bad">${mission.pending.question}</div><div class="m">${mission.pending.ground ? 'Your call as Test Conductor.' : `${mission.crew.name} has to choose. CAPCOM ${S.crew.capcom ? 'is on the loop' : 'is not staffed'}.`}</div><div class="padbtns">${options.map(choice => `<button data-a="mdec" data-id="${choice.index}"${choice.available ? '' : ' disabled'}>${choice.text.toUpperCase()}${choice.available ? ` (~${Math.round(decisionOdds(mission, key, choice) * 100)}%)` : choice.needs == 'man' ? ' (needs manual control fitted)' : ' (needs CAPCOM)'}</button>`).join('')}</div>`;
}
function finishMission() {
  clearInterval(launchView.flightTimer);
  launchView.flightTimer = null;
  const mission = airborne.mission, result = endMission(mission);
  launchView.lastTrace = mission.trace.slice();
  airborne.mission = null;
  document.documentElement.classList.remove('flying');
  if (launchView.count) {
    launchView.count.phase = 'done';
    launchView.count.result = { ok: result.ok, met: result.met, lost: result.lost, text: mission.log.slice(-4).join(' ') };
  }
  $('#fl').hidden = true;
  markDirty();
  render();
  renderPad();
}

// THE AIR-TO-GROUND TRANSCRIPT: new lines are appended as the mission clock reaches them, typed onto the teleprinter roll.
const timestamp = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const transcriptLine = (mission, line) => line.w
  ? `<div class="cl ${line.c || ''}"><span class="ctm">${timestamp(line.t)}</span><b>${speakerName(mission, line.w)}</b><span>${line.x}</span></div>`
  : `<div class="cl note ${line.c || ''}"><span class="ctm">${timestamp(line.t)}</span><i>[${line.x}]</i></div>`;
function drawTranscript(mission) {
  const box = $('#ctx');
  if (!box || !mission.transcript) return;
  if (mission.transcript.length > mission.shownTranscript) {
    box.insertAdjacentHTML('beforeend', mission.transcript.slice(mission.shownTranscript).map(line => transcriptLine(mission, line)).join(''));
    mission.shownTranscript = mission.transcript.length;
    box.scrollTop = box.scrollHeight;
  }
}
export function showLastTranscript() {
  const last = S.p2 && S.p2.lastTx;
  if (!last) return;
  const mission = { callSign: last.call };
  $('#sum').innerHTML = `<div class="sumbox"><h1>AIR-TO-GROUND TRANSCRIPT</h1><div class="d">${last.n}${last.call ? `, call sign ${last.call}` : ''}</div><div class="comms"><div class="ctx">${last.tx.map(line => transcriptLine(mission, line)).join('')}</div></div><button data-a="closesum">CLOSE</button></div>`;
  $('#sum').hidden = false;
}
