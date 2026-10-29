# Scenario economy audit — Apollo 9 to Apollo 11

28 October 2026. Audited before changing the financial structure. **The starting total remains $1,800,000.** Values are illustrative incremental preparation/flight costs, not NASA's historical budget. The previous single balance was described inconsistently as both programme funding and discretionary money.

## Audit findings

- Each test, modification, independent readiness review and flight was deducted **once at authorisation**. Delegation's remaining-authority counter was a ceiling, not another deduction. Completion never charged again.
- There are **no recurring expenses**: no daily payroll, meeting charge, idle drain, maintenance bill or fiscal-year reset deduction. Ordinary engineering discussion and recording an assessment cost no money; discussion may consume time.
- The old scenario had **no incoming funding flow**, no protected flight allocation and no ledger. Optional practice and repeat comparisons looked too much like required preparation. Hardware changes legitimately required renewed integration/clearance; the price of that downstream work was easy to overlook.
- Review failures consume the authorised review cost. Repeated reviews/comparisons are separate paid commissions, not double billing. A flight's operations envelope is charged once, regardless of the number of phases advanced.

## Complete charge catalogue

| Authorisation | Cost | Duration | Funding account | Requirement |
|---|---:|---:|---|---|
| Instrumented flow comparison | $55,000 | 18 h | Engineering | Optional diagnosis |
| Thermal sensor calibration | $40,000 | 12 h | Engineering | Optional diagnosis |
| Mission integration rehearsal | $90,000 | 24 h | Readiness | Required for current mission/configuration; repeats optional unless superseded |
| Crew contingency rehearsal | $35,000 | 18 h | Readiness | Required until crew preparation is documented; further practice optional |
| Propellant-feed change | $170,000 | 36 h | Engineering | Conditional on engineering judgement/findings |
| Pressure-instrumentation change | $85,000 | 18 h | Engineering | Conditional; cannot substitute for qualification |
| Guidance-workload change | $140,000 | 30 h | Engineering | Conditional on engineering judgement/findings |
| Independent readiness review | $30,000 | 8 h | Readiness | Required after current integration/crew preparation; a finding cannot be waived |
| Mission flight operations | $100,000 | Mission profile | Operations | Required for each authorised flight/repeat |
| Delegation agreement | $0 itself | 1–336 h envelope | Test-specific accounts | Optional; no second envelope charge |
| Discussion, hypothesis, waiting, allocation memorandum, recorded funding request | $0 | Context-dependent | None | No passive monetary charge |

A modification can entail at least another $90,000 integration rehearsal and $30,000 readiness review, plus crew practice if preparation is insufficient. No modification guarantees clearance. Authorised contracts settle at their obligated amount; the prototype assumes no cancellation refund.

## Reproducible campaign comparison

The headless `demonstrate(11)` uses `run_policy(Simulation.new(11), comparison_rounds=1)`. The same policy with additional comparison rounds provides a repeatable exploration strategy. It uses observed readings, not hidden state.

| Policy, seed 11 | Authorised spend | Uncommitted remaining | Result |
|---|---:|---:|---|
| Demonstration, one flow/thermal round per mission | $1,570,000 | $230,000 | All three missions complete |
| More exploratory, two flow/thermal rounds per mission | $1,600,000 | $200,000 | All three missions complete |
| Heavy investigation, three rounds per mission | $1,600,000 at stop | $200,000 at stop | Two missions complete; next full comparison round exceeds engineering authority and free reserve |

Two rounds do not simply add $285,000 to the demonstration: they do add $285,000 in comparison commissions, but the additional readings and different subsequent random-stream positions lead this policy to avoid $255,000 in feed/instrumentation changes. Engineering outcomes must not be held constant artificially to make spending comparisons look linear. This is one reproducible example, not evidence that extra testing always saves money.

The heavy strategy retains $100,000 allocated for operations, $30,000 for readiness and $70,000 reserve at its stopping point. A $95,000 comparison pair cannot draw from these accounts automatically. The Administrator can choose a narrower comparison, explicitly defer/reallocate another allocation, or stop. Taking flight/readiness funding creates a genuine later shortfall; it does not solve the whole campaign.

The successful demonstration's $1,570,000 comprises:

| Purpose | Campaign expenditure |
|---|---:|
| Three flow comparisons | $165,000 |
| Three thermal calibrations | $120,000 |
| Feed / sensor / guidance changes | $395,000 |
| Four integration rehearsals | $360,000 |
| Four crew rehearsals | $140,000 |
| Three independent reviews | $90,000 |
| Three flights | $300,000 |

### Current saved campaign

The pre-revision autosave reached Apollo 11 on 16 July 1969 with **$0** left and no work underway. The thirty authorisations reconcile to exactly $1,800,000. Two $35,000 crew rehearsals were authorised after the final independent review, taking the last $70,000. There is no evidence of a duplicate deduction. The new UI identifies such training as optional once crew preparation is recorded. Migration preserves this campaign's actual balance; it grants no refund, additional appropriation or free launch.

## Limited financial rules now implemented

There is one simplified **no-year R&D appropriation**, not a whole NASA or congressional budget simulator:

| Opening disposition | Amount |
|---|---:|
| Lunar programme: engineering investigations/changes | $735,000 |
| Lunar programme: readiness/assurance | $465,000 |
| Lunar programme: flight operations | $300,000 |
| Administrator's unallocated R&D reserve | $300,000 |
| Total scenario appropriation | **$1,800,000** |

The initial $465,000 readiness allocation covers one integration, crew rehearsal and independent review for each of three missions. The $300,000 operations allocation covers three flights. Rework/repeated qualification needs explicit funding decisions. The starting $300,000 reserve is 16.7% of the total; it can cover meaningful additional work without guaranteeing arbitrary repetition. The demonstration needs an explicit $125,000 reserve release to readiness, leaving $175,000 reserve and $55,000 engineering funds.

**Decision:** retain the total and this initial reserve provisionally. The baseline completes with a 12.8% total margin, and the two-round exploration policy also completes. This supports improving visibility and protection first, not increasing the whole envelope. It does not establish balance across all seeds or unrestricted exploratory strategies; further playtesting should assess whether the reserve needs adjustment.

- Appropriation = programme allocations + unallocated reserve.
- Each programme allocation = uncommitted funds + outstanding commitments + settled expenditure.
- Authorisation creates a commitment and reduces uncommitted funds once. Completion moves commitment to expenditure without another deduction. Flights remain committed through their funded profile.
- A zero reserve does not block already funded work or further affordable programme authorisations.
- Only uncommitted funds may be reassigned, and only within the same appropriation. Reducing another planned allocation can defer that work; it cannot reclaim obligated contracts. No cross-appropriation transfers are exposed.
- A request for supplemental funding records a reason/account/amount and remains **pending**. There is no adjudication, automatic award or assumed success. One consolidated request per fiscal year is a prototype pacing limit, not a historical legal claim.
- Fiscal year 1970 begins on **1 July 1969**. Existing no-year balances, reserve, commitments and requests persist. Nothing replenishes or disappears merely because the fiscal year changes.
- Budget papers show allocations, commitments, expenditure, source-specific free funds and a dated transaction register. The public lower-bound forecast includes future required qualifications/flights, excludes already committed work, and warns that diagnosis/rework can add costs.
- Save schema 2 records the ledger. Version-1 saves are migrated in memory and original files remain unchanged until normal saving. Historic authorisations are reconstructed and reconciled; historic allocation decisions were never recorded. Migration fails rather than inventing a balancing entry when records disagree.

## Historical and legal abstractions

NASA R&D was funded on a no-year basis in the historical period; see NASA's [Historical Data Book, volume IV](https://ntrs.nasa.gov/api/citations/19880016046/downloads/19880016046.pdf), printed page 10. The [GAO budget glossary](https://tile.loc.gov/storage-services/master/gdc/gdcebookspublic/20/23/71/02/26/2023710226/2023710226.pdf), printed page 55, documents the earlier July–June federal fiscal year.

The $1.8m scenario appropriation, reserve, internal accounts and ability to reallocate their free funds are deliberate gameplay abstractions. They do not reproduce statutory NASA totals, apportionments, allotments, reprogramming notifications, transfer caps, earmarks, procurement termination liabilities or congressional procedures. The reserve belongs to the same purpose-restricted R&D authority; it is not personal cash. Facilities, management appropriations and transfers between them remain outside the slice. The fiscal-year helper is scoped to this 1969 prototype; later eras need the 1976 transition-quarter/calendar rules before extension.

## Verification

Automated checks cover commitments, delegation envelopes, invalid authorisations, single deductions at approval/completion, flight settlement, reserve exhaustion, within-account reallocation, rejected cross-appropriation transfers, no passive costs, fiscal-year carryover, pending requests without income, ledger reconciliation, legacy saves, and the three economic policy runs above. Financial display guidance uses public evidence only; no hidden engineering state enters forecasts or budget decisions.
