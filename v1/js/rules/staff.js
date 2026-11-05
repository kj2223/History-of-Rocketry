// Staff at work from 1 January 1945 (freeze §2.2, §3.2, §5.1, §8.2–8.4). Each day the heads and teams
// look at their own programmes and do what their remit covers: they propose the next piece of work,
// file their feasibility cases, take client meetings, raise dossiers and greenlight requests, and report.
// Before delegation opens (the WAC act is "direct") a team proposes and waits for the administrator's
// go-ahead; once a programme is delegated (§8.3) the team schedules its routine work itself and reports.
// Teams reason only from claims and beliefs, never from hidden truth, and draw no random numbers.
// Staff act through the same commands as the player: the façade passes `run(state, type, actor, payload)`.

import { dateLabel, fiscalQuarter } from '../core/calendar.js';
import { FLIGHT_CONDITIONS, ANOMALIES, HYPOTHESES } from '../data/engineering.js';
import { PROGRAMMES } from '../data/scenario.js';
import { TUNING } from '../data/tuning.js';
import { QUANTITIES, REVISIONS, STAGES, VEHICLES, VEHICLE_QUANTITIES } from '../data/vehicles.js';
import { FACILITY_KINDS } from '../data/facilities.js';
import { Rejection, memo } from './authority.js';
import { claimStatus } from './evidence.js';
import { openHypotheses } from './belief.js';
import { holders } from './facilities.js';
import { available, capacityRemaining, protectedBaseline } from './fiscal.js';
import { isDelegated } from './delegation.js';
import { money, programmeName } from './reports.js';

export const initStaff = () => ({ proposals: [], next: 1, snooze: {}, noted: {}, raised: {} });
// Saves made before staff existed load without this section; the staff start work on the next day.
const staffOf = state => (state.staff ??= initStaff());

const list = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const qname = q => QUANTITIES[q].name.toLowerCase();
const team = p => `The ${p.name} team`;

// ---- what a team would do next on a greenlit programme ----

// The next step, from what the team knows: ground-test each stage under flight conditions, then fly.
// A finding outside normal limits stops the work until a test can discriminate or the administrator directs.
export const nextStep = (state, p) => {
  const config = { vehicle: p.vehicle, stages: p.baseline };
  for (const stage of VEHICLES[p.vehicle].stages) {
    const qs = VEHICLE_QUANTITIES[p.vehicle].filter(q => q.startsWith(`${stage}.`));
    if (!qs.length) continue;
    const adverse = qs.filter(q => claimStatus(state, config, q).status === 'adverse');
    if (adverse.length) {
      const anomaly = Object.values(state.beliefs.anomalies).find(a => ANOMALIES[a.id].stage === stage && a.proposedTests?.length);
      if (anomaly) { const t = anomaly.proposedTests[0]; return { kind: 'ground-test', stage, burn: t.conditions.burn, channels: t.channels, why: 'anomaly', anomaly: anomaly.id }; }
      return { kind: 'adverse', stage, quantities: adverse };
    }
    if (qs.every(q => claimStatus(state, config, q, FLIGHT_CONDITIONS).status === 'measured-normal')) continue;
    const started = qs.some(q => claimStatus(state, config, q).status === 'measured-normal');
    return { kind: 'ground-test', stage, burn: started ? 'long' : 'short', channels: qs, why: started ? 'flight-conditions' : 'first' };
  }
  return { kind: 'fly' };
};
const keyOf = s => [s.kind, s.stage, s.burn, s.channels?.join('+')].filter(Boolean).join(':');

const openLaunchDecision = (state, pid) => state.launches.some(l => l.programmeId === pid && l.status === 'awaiting-decision'
  && state.decisions.some(d => d.type === 'launch' && d.subject === l.id && d.status === 'open'));
const lastFlight = (state, pid) => Math.max(-Infinity, ...state.launches.filter(l => l.programmeId === pid && l.status === 'flown').map(l => l.day));

// Why the team is waiting rather than proposing, or null when it is free to act.
const busy = (state, p) => {
  const running = state.work.find(j => j.programmeId === p.id && (j.status === 'running' || j.status === 'paused'));
  if (running) return running.status === 'paused' ? `${running.kind.replace(/-/g, ' ')} is paused` : `${running.kind.replace(/-/g, ' ')} under way`;
  if (openLaunchDecision(state, p.id)) return 'a launch is waiting for your decision';
  if (state.decisions.some(d => d.status === 'open' && d.type === 'displacement' && d.text.startsWith(p.name))) return 'a facility clash is waiting for your decision';
  return null;
};

const eligible = p => p.vehicle && p.stage === 'greenlit';

const operational = (state, kind) => Object.values(state.facilities.units).filter(u => u.kind === kind && u.status === 'operational');
// A free unit of this kind for the period, else the first one (reserving it will raise the clash for decision).
const pickUnit = (state, kind, from, to) => {
  const units = operational(state, kind);
  return (units.find(u => holders(state, u.id, from, to).length < (FACILITY_KINDS[kind].exclusive ? 1 : u.capacity)) ?? units[0])?.id ?? null;
};

const readyArticle = (state, p) => Object.values(state.hardware.articles).find(a => a.programmeId === p.id && a.status === 'built'
  && !state.hardware.batches[a.batchId].held && Object.entries(p.baseline).every(([s, r]) => a.stages[s] === r));

const describe = (state, p, step) => {
  if (step.kind === 'feasibility') return `Shall we look into ${p.name}${p.client ? ` for ${p.client}` : ''}? `
    + `If you authorise bounded feasibility work, the technical director and the financial officer will report on whether it is possible and what it would cost (about ${Math.ceil(TUNING.staffCaseDays / 7)} weeks)`
    + `${PROGRAMMES.find(d => d.id === p.id)?.terms ? ` and we will meet ${p.client} to hear their terms` : ''}. The dossier then comes back to you.`;
  if (step.kind === 'ground-test') {
    const stand = pickUnit(state, 'static-stand', state.day, state.day + TUNING.staffTestBookingDays);
    const what = `a ${step.burn}-burn ground test of the ${STAGES[step.stage].name} on ${stand ? `static test stand ${stand}` : 'a static test stand'}, reading ${list(step.channels.map(qname))}`;
    const why = { first: 'We have no readings on it yet, so this is where we start.',
      'flight-conditions': 'The short-burn readings are in. Flights run the full burn, so we need readings at full duration before we fly.',
      anomaly: `${ANOMALIES[step.anomaly]?.name ?? 'The anomaly'} has more than one explanation, and this test should tell them apart.` }[step.why];
    return `${team(p)} would like to run ${what}. ${why}`;
  }
  const article = readyArticle(state, p);
  return `Ground readings for every stage of ${VEHICLES[p.vehicle].name} are within normal limits under flight conditions. `
    + `${article ? `Article ${article.id} is ready` : 'Production would build the next article'}, and we would book pad and tracking and ask for a launch. `
    + 'The launch itself still comes to you for decision.';
};

// Carry out a step through ordinary commands. Returns { decision } if a booking clash was raised instead.
const execute = (state, run, p, step, actor) => {
  const s = staffOf(state), id = () => `staff-${s.next++}`;
  const as = role => (actor === 'administrator' ? 'administrator' : role);
  const book = (kind, days, purpose) => {
    const unitId = pickUnit(state, kind, state.day, state.day + days);
    if (!unitId) throw new Rejection(`We have no ${FACILITY_KINDS[kind].name.toLowerCase()} in service`);
    const rid = id(), r = run(state, 'reserve-facility', as('department-head'), { id: rid, unitId, programmeId: p.id, from: state.day, to: state.day + days, purpose });
    return r.decision ? { decision: r.decision } : { reservation: rid };
  };
  if (step.kind === 'feasibility') { run(state, 'authorise-feasibility', 'administrator', { programmeId: p.id }); return {}; }
  if (step.kind === 'ground-test') {
    const stand = book('static-stand', TUNING.staffTestBookingDays, `${step.burn}-burn ground test`);
    if (stand.decision) return stand;
    run(state, 'schedule-test', as('department-head'), { jobId: id(), programmeId: p.id, stage: step.stage, stages: {}, conditions: { burn: step.burn }, channels: step.channels, reservation: stand.reservation });
    return {};
  }
  let n = Object.values(state.hardware.articles).filter(a => a.programmeId === p.id).length + 1;
  while (state.hardware.articles[`${p.id}-${n}`]) n++;
  const articleId = readyArticle(state, p)?.id ?? run(state, 'build-article', as('department-head'), { id: `${p.id}-${n}`, programmeId: p.id });
  const pad = book('range', TUNING.staffLaunchBookingDays, 'launch');
  if (pad.decision) return pad;
  const tracking = book('tracking', TUNING.staffLaunchBookingDays, 'tracking');
  if (tracking.decision) return tracking;
  return run(state, 'request-launch', as('department-head'), { id: id(), articleId, pad: pad.reservation, tracking: tracking.reservation, cost: TUNING.staffFlightCost, replacementCost: TUNING.staffFlightCost });
};

// ---- proposals the administrator answers ----

export const proposal = (state, id) => staffOf(state).proposals.find(x => x.id === id) ?? (() => { throw new Rejection(`No proposal ${id}`); })();

export const approveProposal = (state, run, id) => {
  const pr = proposal(state, id);
  if (pr.status !== 'open') throw new Rejection(`That proposal is ${pr.status}`);
  const p = state.programmes[pr.programmeId];
  pr.status = 'approved';
  pr.decidedDay = state.day;
  return execute(state, run, p, pr.step, 'administrator');
};

export const declineProposal = (state, id) => {
  const pr = proposal(state, id);
  if (pr.status !== 'open') throw new Rejection(`That proposal is ${pr.status}`);
  Object.assign(pr, { status: 'declined', decidedDay: state.day });
  staffOf(state).snooze[pr.programmeId] = state.day + TUNING.proposalSnoozeDays;
};

// ---- the daily round ----

const noteOnce = (state, key, m) => { const s = staffOf(state); if (s.noted[key]) return; s.noted[key] = state.day; memo(state, m); };

// The technical director's judgement: is it possible with what we have, what it would take, what worries us.
const engineeringCase = (state, p) => {
  if (!p.vehicle) return `Not yet possible as asked: there is no ${p.name} design, so there is nothing we could fire or fly. `
    + 'Preliminary acceptance would mean design work first; we would come back with a vehicle before asking for any test time.';
  const v = VEHICLES[p.vehicle], config = { vehicle: p.vehicle, stages: p.baseline };
  const ours = v.stages.filter(st => STAGES[st].developable).map(st => STAGES[st].name), supplied = v.stages.filter(st => !STAGES[st].developable).map(st => STAGES[st].name);
  const testable = v.stages.filter(st => VEHICLE_QUANTITIES[p.vehicle].some(q => q.startsWith(`${st}.`)));
  const known = VEHICLE_QUANTITIES[p.vehicle].filter(q => claimStatus(state, config, q, FLIGHT_CONDITIONS).status === 'measured-normal').length;
  const sharing = Object.values(state.programmes).filter(x => x.id !== p.id && eligible(x)).map(x => x.name);
  const stands = operational(state, 'static-stand').length;
  return [
    `We think ${v.name} is possible with the facilities we have.`,
    ours.length ? `We would develop the ${list(ours)} ourselves${supplied.length ? `; the ${list(supplied)} would come as supplied` : ''}.` : `Every stage would come as supplied (${list(supplied)}).`,
    known ? `${known} of its ${VEHICLE_QUANTITIES[p.vehicle].length} measured quantities already have applicable readings.` : 'We have no readings that apply to it yet, so everything about it is unknown.',
    `Before a first flight we would want a short- and a long-burn firing of the ${list(testable.map(st => STAGES[st].name))}, about ${testable.length * 2} ground tests, then at least ${TUNING.delegationSuccessfulFlights} experimental flights.`,
    stands === 1 && sharing.length ? `Concern: our only static test stand is shared with ${list(sharing)}, so its tests would queue behind theirs.` : 'No concern about facilities at present.',
  ].join(' ');
};

// The financial officer's judgement against what this year can actually carry.
const fundingCase = (state, p) => {
  const avail = available(state), award = state.fiscal.award, m = p.meeting;
  if (!m) return `This year's award is ${money(award)}, of which ${money(avail)} is not yet spoken for. Without the client's figures I cannot say more than that.`;
  const fits = m.cost <= avail ? `We could carry that from what is not yet spoken for this year (${money(avail)}).`
    : m.cost <= award ? `That is more than we have free this year (${money(avail)}), so it would need phasing into next year's award.`
    : `That is more than this year's whole award of ${money(award)}. I would not support it without multi-year authority or a larger share from the client.`;
  return `${p.client ?? 'The sponsor'} put the cost at ${money(m.cost)} over ${m.timeline}. ${fits} Each flight would add about ${money(TUNING.staffFlightCost)}.`;
};

const investigationRound = (state, run, p) => {
  const s = staffOf(state);
  const since = [...p.history].reverse().find(e => e.event === 'bounded feasibility work authorised')?.day ?? state.day;
  const elapsed = state.day - since;
  const terms = PROGRAMMES.find(d => d.id === p.id)?.terms;
  if (!s.raised[`started:${p.id}:${since}`]) {
    s.raised[`started:${p.id}:${since}`] = state.day;
    memo(state, { from: 'project-manager', refs: { programme: p.id },
      text: `Feasibility work on ${p.name} has started. ${terms && !p.meeting ? `We meet ${p.client} around ${dateLabel(since + TUNING.staffMeetingDays)} to hear their terms. ` : ''}`
        + `The technical director and the financial officer will report by about ${dateLabel(since + TUNING.staffCaseDays)}, and the dossier comes to you after that.` });
  }
  if (elapsed >= TUNING.staffMeetingDays && !p.meeting && terms) {
    run(state, 'record-meeting', 'project-manager', { programmeId: p.id, ...terms });
    memo(state, { from: 'project-manager', kind: 'report', text: `We met ${p.client} about ${p.name}. They put the cost at ${money(terms.cost)} over ${terms.timeline}; they would contribute ${terms.contribution}; they need ${terms.requirements}.`, refs: { programme: p.id } });
  }
  if (elapsed >= TUNING.staffCaseDays && !p.cases.engineering) {
    run(state, 'complete-case', 'technical-director', { programmeId: p.id, summary: engineeringCase(state, p) });
    memo(state, { from: 'technical-director', kind: 'report', text: `Engineering case for ${p.name}: ${p.cases.engineering.summary}`, refs: { programme: p.id } });
  }
  if (elapsed >= TUNING.staffCaseDays && !p.cases.funding) {
    run(state, 'complete-case', 'financial-officer', { programmeId: p.id, summary: fundingCase(state, p) });
    memo(state, { from: 'financial-officer', kind: 'report', text: `Funding case for ${p.name}: ${p.cases.funding.summary}`, refs: { programme: p.id } });
  }
  if (p.cases.engineering && p.cases.funding && p.meeting) run(state, 'submit-dossier', 'project-manager', { programmeId: p.id });
};

const preliminaryRound = (state, run, p) => {
  const s = staffOf(state), key = `greenlight:${p.id}:${p.window.opens}`;
  if (s.raised[key] || state.day - p.window.opens < TUNING.staffGreenlightPrepDays) return;
  if (state.decisions.some(d => d.type === 'greenlight' && d.subject === p.id && d.status === 'open')) return;
  s.raised[key] = state.day;
  run(state, 'request-greenlight', 'project-manager', { programmeId: p.id });
};

const workRound = (state, run, p) => {
  const s = staffOf(state);
  const step = nextStep(state, p), key = keyOf(step);
  const open = s.proposals.find(x => x.status === 'open' && x.programmeId === p.id);
  const waiting = busy(state, p);
  if (open && (waiting || open.key !== key)) open.status = 'superseded';
  if (waiting || (open && open.status === 'open')) return;
  if (step.kind === 'adverse') {
    const remedy = Object.entries(REVISIONS).find(([r, x]) => x.stage === step.stage && x.remedies && !state.hardware.revisions[r]);
    const anomaly = Object.values(state.beliefs.anomalies).find(a => ANOMALIES[a.id].stage === step.stage);
    const leading = anomaly?.status === 'leading' ? HYPOTHESES[openHypotheses(anomaly)[0]].name.toLowerCase() : null;
    noteOnce(state, `adverse:${p.id}:${step.stage}:${step.quantities.join('+')}`, { from: 'technical-director', kind: 'warning', refs: { programme: p.id },
      text: `${team(p)} has stopped new work on the ${STAGES[step.stage].name}: ${list(step.quantities.map(qname))} came back outside normal limits. ${leading ? `Our leading explanation is ${leading}.` : 'No test we can run would explain it.'} `
        + (remedy ? `The department head recommends the ${remedy[1].label} (see Engineering).` : 'We need your direction before we spend more on it.') });
    return;
  }
  if ((s.snooze[p.id] ?? -Infinity) > state.day) return;
  if (step.kind === 'fly' && state.day - lastFlight(state, p.id) < TUNING.staffFlightSpacingDays) return;
  if (isDelegated(state, p.id)) {
    const text = describe(state, p, step);
    try {
      const shadow = structuredClone(state);
      const out = execute(shadow, run, shadow.programmes[p.id], step, 'team');
      Object.assign(state, shadow);
      memo(state, { from: step.kind === 'fly' ? 'department-head' : 'technical-director', kind: 'report', refs: { programme: p.id },
        text: `${text.replace(' would like to run ', ' has scheduled ').replace('Production would build', 'Production is building')}${out.decision ? ' A booking clash needs your decision first.' : ''}` });
    } catch (e) {
      if (!(e instanceof Rejection)) throw e;
      noteOnce(state, `blocked:${p.id}:${key}:${e.message}`, { from: 'technical-director', kind: 'warning', refs: { programme: p.id }, text: `${team(p)} could not schedule its next step: ${e.message}.` });
    }
    return;
  }
  propose(state, p, step, key, step.kind === 'fly' ? 'department-head' : 'technical-director');
};

const propose = (state, p, step, key, from) => {
  const s = staffOf(state);
  s.proposals.push({ id: `proposal-${s.proposals.length + 1}`, day: state.day, programmeId: p.id, stage: p.stage, key, step, from, text: describe(state, p, step), status: 'open', decidedDay: null });
};

// A new proposal waits at stage 1 until the administrator authorises bounded work (§8.2).
const feasibilityRound = (state, p) => {
  const s = staffOf(state);
  if (s.proposals.some(x => x.status === 'open' && x.programmeId === p.id) || (s.snooze[p.id] ?? -Infinity) > state.day) return;
  propose(state, p, { kind: 'feasibility' }, 'feasibility', 'project-manager');
};

export const quarterReport = state => {
  const q = fiscalQuarter(state.day);
  memo(state, { from: 'financial-officer', kind: 'report',
    text: `Quarter report for ${dateLabel(q.start)} to ${dateLabel(q.end)}. This year's award is ${money(state.fiscal.award)}. `
      + `We can still spend ${money(capacityRemaining(state))} of what has been released; ${money(protectedBaseline(state))} of that is already owed in bills due before the next release, `
      + `which leaves ${money(available(state))} for new work.` });
};

// The first morning: who is here, what they are working on, and what they want from you.
export const openingBriefing = state => {
  const wac = state.programmes.wac;
  const units = Object.values(state.facilities.units).map(u => `${FACILITY_KINDS[u.kind].name.toLowerCase()} ${u.id}`);
  memo(state, { from: 'technical-director', refs: { programme: 'wac' },
    text: `Welcome to White Sands. ${wac.name} is our programme, and it is already approved. We have ${list(units)}. `
      + 'Nothing has flown yet and we have no readings, so we know nothing for certain about the vehicle. '
      + 'The team has put its first proposal in your Mail. Until we have a track record, the teams propose and you give the go-ahead.' });
};

export const staffDay = (state, run) => {
  staffOf(state);
  for (const p of Object.values(state.programmes)) {
    try {
      if (p.stage === 'feasibility') feasibilityRound(state, p);
      else if (p.stage === 'investigation') investigationRound(state, run, p);
      else if (p.stage === 'preliminary') preliminaryRound(state, run, p);
      if (eligible(p)) workRound(state, run, p);
    } catch (e) {
      if (!(e instanceof Rejection)) throw e;
      noteOnce(state, `stuck:${p.id}:${p.stage}:${e.message}`, { from: 'project-manager', kind: 'warning', refs: { programme: p.id }, text: `${team(p)} is held up: ${e.message}.` });
    }
  }
  for (const pr of state.staff.proposals.filter(x => x.status === 'open' && state.programmes[x.programmeId]?.stage !== x.stage)) pr.status = 'superseded';
};

// What each team is doing, for the Programmes screen.
export const teamStatus = (state, p) => {
  if (p.stage === 'feasibility') return 'Waiting for you to authorise bounded feasibility work (see Mail).';
  if (p.stage === 'investigation') {
    const missing = [!p.cases.engineering && 'the engineering case', !p.cases.funding && 'the funding case', !p.meeting && 'the client meeting'].filter(Boolean);
    return missing.length ? `Working on ${list(missing)}.` : 'Dossier ready.';
  }
  if (p.stage === 'preliminary') return `Preparing the greenlight request; the window closes ${dateLabel(p.window.closes)}.`;
  if (!eligible(p)) return null;
  const waiting = busy(state, p);
  if (waiting) return `${waiting[0].toUpperCase()}${waiting.slice(1)}.`;
  const open = staffOf(state).proposals.find(x => x.status === 'open' && x.programmeId === p.id);
  if (open) return 'Waiting for your go-ahead on a proposal in Mail.';
  const step = nextStep(state, p);
  if (step.kind === 'adverse') return 'Stopped: a finding is outside normal limits and needs your direction.';
  if ((staffOf(state).snooze[p.id] ?? -Infinity) > state.day) return `You asked us to wait; we will propose again on ${dateLabel(staffOf(state).snooze[p.id])}.`;
  if (step.kind === 'fly') return `Ready for the next flight; spacing flights until ${dateLabel(lastFlight(state, p.id) + TUNING.staffFlightSpacingDays)}.`;
  return 'Planning the next test.';
};
