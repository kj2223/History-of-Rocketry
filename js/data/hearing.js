// HEARINGS (rules/hearing.js): what a congressional hearing makes of NASA's record. Each kind names the lead who prepares and
// reads the record into plain effects. Tune here. The keys are stored in saves.
//
// outcome(record) returns { verdict: what the committee concludes, rep, press, pub, cong: added (a minus eases), and any other
// effect its own apply(effects) handles }. record: { accepted: risks you accepted under pressure (requests granted and crewed
// launches past the safety bar), tests: ground tests really run on crew rockets, skipped: tests signed off but never run }.
export const HEARING_DAYS = 14;
export const HEARINGS = {
  apollo: {
    name: 'Apollo before the House Committee on Science and Astronautics',
    lead: 'ellis',
    outcome({ accepted, tests, skipped }) {
      if (skipped) return { verdict: 'An engineer tells the committee that ground tests were signed off without being run. Members want to know who else knew.', rep: -6, press: 15, cong: 12 };
      if (!accepted && tests >= 2) return { verdict: `The committee reads ${tests} ground tests and not one risk taken under pressure. Apollo is in careful hands.`, rep: 4, press: -10, cong: -25 };
      const ratio = tests / Math.max(1, accepted);
      if (ratio >= 3) return { verdict: `${tests} ground tests against ${accepted} risk${accepted == 1 ? '' : 's'} accepted under pressure. The committee is satisfied.`, rep: 2, press: -6, cong: -18 };
      if (ratio >= 1) return { verdict: `${tests} ground tests, but ${accepted} risk${accepted == 1 ? '' : 's'} accepted under pressure. The committee lets Apollo go on, with questions.`, cong: -8 };
      return { verdict: `Members read out ${accepted} risk${accepted == 1 ? '' : 's'} accepted under pressure against ${tests} ground test${tests == 1 ? '' : 's'}. The hearing goes badly.`, rep: -4, press: 8, cong: 10 };
    },
  },
};
