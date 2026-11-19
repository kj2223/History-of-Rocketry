// APOLLO 13: BRINGING THE COMMAND MODULE BACK FROM COLD. The tiger team's problem, on the board in front of you: the
// command module has only its re-entry batteries left, and they must carry her from power-up to splashdown. Every system
// you switch on is amp-hours you cannot get back. Nobody had ever powered a command module up in flight from cold; in
// April 1970 John Aaron's team in the back room wrote the sequence that fitted, and the crew read it back over three
// days. This is that problem, fitted to a panel. The numbers are rounded, close to the real budget (three entry
// batteries of 40 amp-hours, one partly spent, and a top-up from the lander's batteries through the umbilical).

// need: 'must' (no safe entry without it), 'should' (entry is harder or colder without it), or 'nice'.
export const POWER_SYSTEMS = {
  guidance: {
    name: 'Guidance computer and platform, aligned on the stars',
    ah: 38,
    need: 'must',
    why: 'Without it there is no guided entry: she flies a ballistic one, steep and hot, into the wrong ocean.',
  },
  quads: {
    name: "Heaters for the thruster quads, before they're needed",
    ah: 12,
    need: 'must',
    why: 'The thrusters have sat at deep cold for three days. Cold, they may not fire to hold her attitude in entry.',
  },
  voice: {
    name: 'One S-band radio for voice',
    ah: 6,
    need: 'must',
    why: 'Without a voice link the ground cannot read up the entry numbers or hear what is wrong.',
  },
  displays: {
    name: 'The entry monitor and the flight displays',
    ah: 8,
    need: 'must',
    why: 'The crew fly the entry on these.',
  },
  telemetry: {
    name: 'Full telemetry to the ground',
    ah: 14,
    need: 'should',
    why: 'Without it the back room flies blind on the spacecraft until she is in the ocean.',
  },
  early: {
    name: 'Power up two hours early, for time to troubleshoot',
    ah: 22,
    need: 'should',
    why: 'If anything comes up wrong from cold, there is time to find it. Power up late and there is none.',
  },
  cabin: {
    name: 'The cabin heaters',
    ah: 18,
    need: 'nice',
    why: 'The crew have been at about three degrees for days. It would be a mercy, and it is a lot of amp-hours.',
  },
};
// What the entry batteries hold, and what a top-up from the lander adds.
export const POWER_BUDGET = 92;
export const TOPUP = { name: "Top up entry battery A from the lander's batteries", ah: 20 };

// The plan as amp-hours: { used, budget, over }.
export function powerTotal(on) {
  const used = Object.keys(POWER_SYSTEMS)
    .filter(k => on[k])
    .reduce((a, k) => a + POWER_SYSTEMS[k].ah, 0);
  const budget = POWER_BUDGET + (on.topup ? TOPUP.ah : 0);
  return { used, budget, over: used > budget };
}

// The plan you read up, as the call it is: over (the batteries go flat before splashdown), blind (no guided entry),
// cold (a must-have left off), clean (every must-have, the shoulds too), or margin (every must-have, some should left off).
export function powerPlan(on) {
  const t = powerTotal(on);
  if (t.over) return 'over';
  if (!on.guidance) return 'blind';
  if (!['quads', 'voice', 'displays'].every(k => on[k])) return 'cold';
  return on.telemetry && on.early ? 'clean' : 'margin';
}
