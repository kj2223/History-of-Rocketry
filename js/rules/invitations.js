// INVITATIONS: a first flown by Ellis's campaign (rules/auto.js) waits for you (GDD v7.2 §6, middle-path stage 4). Before she flies
// the first flight of a rocket she sends an invitation to Mail: ATTEND and she brings it to the pad and runs the count in Watch with
// her crews while you watch (you can still hold or scrub); LET FLIGHT CONTROL PROCEED and she flies it unseen. If you do not answer
// within INVITE_TURNS of her turns, Flight Control proceeds. A new blueprint needs no invitation: the team cleared it when it was
// signed into the design. Readiness questions (a held campaign, a held
// order) stay separate: an invitation never asks whether to fly, only whether you want to be there. Standing orders already
// ask you to approve a new configuration (rules/orders.js), so they send no invitation. No DOM.
//
// S.auto.inv: { air: the airframe's id, prog, what: the first it would fly, turns: her turns left before Flight Control proceeds,
//               attend: 1 once you say you will watch it, ok: 1 once Flight Control may proceed } or null
// S.auto.pad: the attended launch she has brought to the pad, for Watch to count down: { af: airframe id, fuel, pay, st, load } or null
// A programme's bundle keeps fm: the milestones it has flown (absent until it first flies).
import { isMilestone } from '../data/research.js';
import { PROGRAMMES } from '../data/programmes.js';
import { S, log } from '../core/state.js';
import { successfulFlights } from './programs.js';

// How many of her turns (15 seconds each) an invitation waits for an answer.
export const INVITE_TURNS = 3;

// The first this airframe would fly, as a phrase, or null. A programme that flew before fm was saved counts as flown.
export function firstAboard(airframe) {
  const bundle = S.progs[airframe.prog];
  return !bundle.fm && !successfulFlights(airframe.prog) ? `the first flight of the ${PROGRAMMES[airframe.prog].name}` : null;
}

// After every flight (rules/flight.js endFlight): the rocket has now flown its milestones, and an invitation for it is answered.
export function recordFirsts(flight) {
  const bundle = S.progs[flight.programme];
  if (!bundle) return;
  bundle.fm = [...new Set([...(bundle.fm || []), ...flight.airframe.pk.filter(isMilestone)])];
  if (S.auto.inv && S.auto.inv.prog == flight.programme) S.auto.inv = null;
}

// The director's check before she flies an airframe for a campaign. Returns true while she waits on an invitation, 'attend' once
// you have said you will watch (she brings it to the pad for Watch), and false when she may fly it unseen.
export function waitForInvitation(airframe) {
  const what = firstAboard(airframe), invitation = S.auto.inv;
  if (!what) return false;
  if (invitation && invitation.air == airframe.id) {
    if (invitation.ok) return false;
    if (invitation.attend) return 'attend';
    if (--invitation.turns > 0) return true;
    invitation.ok = 1;
    log(`[LAUNCH DIRECTOR] No word from you: Flight Control proceeds with ${what}.`, 'cyan');
    return false;
  }
  S.auto.inv = { air: airframe.id, prog: airframe.prog, what, turns: INVITE_TURNS };
  log(`[LAUNCH DIRECTOR] ${airframe.label} is next: ${what}. Your invitation to attend is in Mail.`, 'hd');
  return true;
}

// Your answer. Attending, she brings the rocket to the pad at once.
export function attendFirst() {
  if (!S.auto.inv) return;
  S.auto.inv.attend = 1;
  S.auto.cd = 1;
}
export function proceedWithFirst() {
  if (!S.auto.inv) return;
  S.auto.inv.ok = 1;
  S.auto.inv.attend = 0;
  S.auto.pad = null;
  S.auto.cd = 1;
}
