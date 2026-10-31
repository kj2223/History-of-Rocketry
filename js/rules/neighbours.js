// THE NEIGHBOURS ON THE RANGE: programmes that fly beside yours but are not yours. For now, the Army's captured V-2s at White
// Sands (data/history.js, V2_PROGRAMME). They fly on the Army's schedule, fail about a third of the time, and make the news when one
// climbs higher than any before it. They never claim your firsts. You can buy nose space on the next one for your instruments
// (a ride-along), and once your WAC Corporal is proven the Army offers Bumper: your rocket as the V-2's upper stage. No DOM.
//
// S.v2: { n: flights flown, ok: good flights, hi: the highest peak (km), next: the game day of the next launch,
//         ride: the payload booked on the next V-2 or null,
//         bump: null until offered; then { st: 'offer'|'on'|'no'|'done', n: Bumper flights flown, ok: separations, hi: best peak (km) } }
import { V2_PROGRAMME, V2_FAILURES, RIDE_FEE, RIDE_SHARE, RIDE_FILM_RECOVERY, RIDE_PAYLOADS, BUMPER_OFFER, BUMPER_FLIGHTS, BUMPER_COST, BUMPER_SEPARATION, BUMPER_PEAK, BUMPER_DOWNRANGE, BUMPER_FLORIDA } from '../data/history.js';
import { PAYLOADS } from '../data/launch.js';
import { S, log, earn, isResearched, addHistory } from '../core/state.js';
import { formatMoney } from '../core/util.js';
import { learn, knowledgeFraction } from './knowledge.js';
import { checkFirsts } from './race.js';

// A launch further back than this is skipped without a word (a save from before the V-2s, opened years in).
const STALE_DAYS = 60;
const nextGap = () => Math.round(V2_PROGRAMME.every * (1 + (Math.random() * 2 - 1) / 3));
const between = ([low, high]) => low + Math.random() * (high - low);
export const v2Flying = () => !S.nasa && S.v2.next <= V2_PROGRAMME.end && S.v2.n > 0;

// Each second: fly the next V-2 once its day comes (one a second at most), and offer Bumper when its time comes. Returns true if
// anything happened.
export function neighboursTick() {
  const v2 = S.v2;
  let changed = offerBumper();
  if (v2.next > V2_PROGRAMME.end || S.day < v2.next) return changed;
  if (S.day - v2.next > STALE_DAYS) {
    while (v2.next <= V2_PROGRAMME.end && S.day - v2.next > STALE_DAYS) v2.next += V2_PROGRAMME.every;
    return changed;
  }
  v2.n++;
  v2.next += nextGap();
  const bumper = v2.bump && v2.bump.st == 'on' && S.b >= BUMPER_COST;
  if (v2.bump && v2.bump.st == 'on' && !bumper) log(`[WHITE SANDS] Bumper waits for the next V-2: it needs ${formatMoney(BUMPER_COST)} in the treasury.`, 'wn');
  const ok = Math.random() < V2_PROGRAMME.ok;
  if (!ok) {
    log(`[WHITE SANDS] ${bumper ? 'Bumper: the' : 'Army'} V-2 No. ${v2.n} ${V2_FAILURES[Math.floor(Math.random() * V2_FAILURES.length)]}.`, bumper ? 'bad' : 'd');
  } else {
    v2.ok++;
    if (!bumper) {
      const [low, high] = V2_PROGRAMME.peak, record = v2.hi > 0 && Math.random() < .1;
      const peak = Math.round(record ? Math.min(V2_PROGRAMME.record, Math.max(v2.hi, high) + 5 + Math.random() * 15) : between([low, high]));
      if (peak > v2.hi) {
        log(`[WHITE SANDS] Army V-2 No. ${v2.n} climbs to ${peak} km${v2.hi ? `, higher than any rocket before it` : ''}. The scientists' instruments ride in its nose.`, 'nar');
        v2.hi = peak;
      } else log(`[WHITE SANDS] Army V-2 No. ${v2.n} reaches ${peak} km.`, 'd');
      if (v2.ride) rideHome(v2.ride, peak);
    }
  }
  if (!ok && v2.ride && !bumper) {
    log(`[V-2 PANEL] Your ${v2.ride} was lost with the V-2.`, 'wn');
  }
  if (!bumper) v2.ride = null;
  if (bumper) flyBumper(ok);
  if (v2.next > V2_PROGRAMME.end) {
    log(`[WHITE SANDS] The last captured V-2 has flown: ${v2.n} launches, ${v2.ok} good. From now on the range belongs to American-built rockets.`, 'nar');
    if (v2.bump && (v2.bump.st == 'on' || v2.bump.st == 'offer')) v2.bump.st = 'done';
  }
  return true;
}

// RIDE-ALONGS. The payloads you can book now: researched, with science, and you can pay for them.
export const ridePayloads = () => RIDE_PAYLOADS.filter(name => !PAYLOADS[name].needs || isResearched(PAYLOADS[name].needs));
export const rideCost = name => PAYLOADS[name].cost + RIDE_FEE;
// Book a payload on the next V-2. Returns an error text, or null.
export function bookRide(name) {
  if (!v2Flying()) return 'The V-2s are not flying.';
  if (!ridePayloads().includes(name)) return 'That payload cannot ride on a V-2.';
  if (S.v2.ride) return `Your ${S.v2.ride} is already booked on the next V-2.`;
  if (S.v2.bump && S.v2.bump.st == 'on') return 'The next V-2s carry Bumper; there is no nose space.';
  if (S.b < rideCost(name)) return `Need ${formatMoney(rideCost(name) - S.b)} more.`;
  S.b -= rideCost(name);
  S.v2.ride = name;
  log(`[V-2 PANEL] Your ${name} is booked in the nose of the next Army V-2 (${formatMoney(rideCost(name))}).`, 'ok');
  return null;
}
// A good V-2 carried your payload: a share of its science (film only if the canister is found), and the instruments teach the team.
function rideHome(name, peak) {
  const payload = PAYLOADS[name];
  if (name == 'Film Camera' && Math.random() >= RIDE_FILM_RECOVERY) {
    log('[V-2 PANEL] The V-2 flew well, but the film canister broke up on impact. No pictures.', 'wn');
    return;
  }
  const cash = Math.round(payload.science * Math.max(.2, Math.min(2.5, peak / 30)) * RIDE_SHARE * .5);
  earn(cash);
  learn('i', 1.5);
  log(`[V-2 PANEL] Your ${name} came back with data from ${peak} km: research contract +${formatMoney(cash)}.`, 'ok');
}

// BUMPER. Offered once, when the WAC Corporal is proven and the time is right, while the V-2s still fly.
function offerBumper() {
  const v2 = S.v2, wac = S.progs.wac;
  if (v2.bump || !v2Flying() || S.day < BUMPER_OFFER.day || !wac || (wac.okf || 0) < BUMPER_OFFER.proven) return false;
  v2.bump = { st: 'offer', n: 0, ok: 0, hi: 0 };
  log('[ARMY ORDNANCE] Project Bumper: the Army and General Electric propose putting your WAC Corporal on top of a V-2 (Mail).', 'hd');
  return true;
}
// Answer the Bumper offer.
export function answerBumper(accept) {
  const bump = S.v2.bump;
  if (!bump || bump.st != 'offer') return;
  bump.st = accept ? 'on' : 'no';
  if (accept) log(`[ARMY ORDNANCE] Bumper is on: the next ${BUMPER_FLIGHTS} V-2s carry your WAC Corporal as their upper stage, ${formatMoney(BUMPER_COST)} each when it flies.`, 'ok');
  else log('[ARMY ORDNANCE] The Army flies its V-2s without your rocket on top.', 'wn');
}
// The chance the WAC Corporal separates and lights: better the more the team knows about staging.
export const separationChance = () => BUMPER_SEPARATION.base + BUMPER_SEPARATION.knowledge * knowledgeFraction('s');
function flyBumper(lowerOk) {
  const bump = S.v2.bump, florida = bump.n >= BUMPER_FLIGHTS - BUMPER_FLORIDA;
  S.b -= BUMPER_COST;
  bump.n++;
  const name = `Bumper ${bump.n}${florida ? ' (Florida)' : ''}`;
  if (!lowerOk) {
    learn('s', 1);
  } else if (Math.random() >= separationChance()) {
    learn('s', 4);
    log(`[WHITE SANDS] ${name}: the V-2 flew well, but your WAC Corporal ${Math.random() < .5 ? 'hung up at separation' : 'separated but never lit'}. The staging engineers have a lot to study.`, 'bad');
  } else {
    bump.ok++;
    learn('s', 2.5);
    const outcome = { ok: true, staged: true, dr: florida ? between(BUMPER_DOWNRANGE) * 1000 : 0 };
    if (florida) log(`[FLORIDA] ${name}: the first launch from the new Long Range Proving Ground. Your WAC Corporal separates and flies ${Math.round(outcome.dr / 1000)} km down the range.`, 'hd');
    else {
      const peak = Math.round(between(BUMPER_PEAK));
      bump.hi = Math.max(bump.hi, peak);
      log(`[WHITE SANDS] ${name}: your WAC Corporal separates high on the V-2 and climbs to ${peak} km, higher than any rocket has gone.`, 'hd');
    }
    if (bump.ok == 1) addHistory('Bumper: the first American two-stage flight');
    checkFirsts(outcome);
  }
  if (bump.n >= BUMPER_FLIGHTS) {
    bump.st = 'done';
    log(`[ARMY ORDNANCE] Bumper is complete: ${bump.n} flights, ${bump.ok} with your upper stage working.`, 'nar');
  }
}
