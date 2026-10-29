# Apollo development campaign: May 1961 through Apollo 11

Scope revision, 29 October 2026. **Roadmap with an implemented first campaign foundation.** The default modern game now runs May 1961 through all nine milestones. See [CAMPAIGN_MODEL.md](CAMPAIGN_MODEL.md) for actual coverage: the full capability graph, alternative architectures, detailed organisation and expanded historical systems described below remain future work.

**UI direction update:** historical UI evolution is paused. Use a modern, readable Administrator workspace with progressive disclosure throughout the campaign. Historical events and records keep their context; period-specific interface skins are not a prerequisite. See [the modern UI direction](MODERN_UI_DIRECTION.md). This supersedes the paper-UI implementation wording below.

Start on 25 May 1961 with Kennedy's lunar commitment. Finish with the player's Apollo 11 landing attempt, return and programme review. The historical path includes Apollo 1, 4, 5, 6, 7, 8, 9, 10 and 11. Dates are historical planning references; actual development, test and flight dates can slip. A late lunar landing remains playable and is recorded as a missed deadline rather than silently corrected to the historical calendar.

This confirmed scope replaces the previous February–July 1969 minimum slice as the next development objective. Preserve that slice as a separate scenario and regression fixture during the transition. This document does not claim that adding the new mission names to the old scenario would implement the campaign.

## What the player should experience

The player inherits an agency already doing difficult work, chooses how it will meet an extraordinary commitment, and lives with the consequences. By a later launch, the vehicle should be recognisably the result of years of programme decisions and the work of people the player knows.

The Administrator approves requirements, competing engineering proposals, programme architecture, appointments, resources, test strategy and readiness dispositions. Engineering teams own detailed design and may challenge executive demands. Flight Control, test conductors and crews retain operational safety authority. Direct manoeuvre control and a power to order unsafe continuation remain outside the grounded ruleset.

The opening is not a technology reset. Mercury, existing Saturn work, propulsion research, facilities, institutional knowledge and inherited commitments already exist. The player did not create NASA in May 1961. Their decisions must be distinguished from that inheritance.

## The first meaningful choices

These are examples of interacting commitments, not a sequence of answers with a universally correct option.

| Commitment | What the Administrator decides | What persists |
|---|---|---|
| Mission architecture | Resource comparative studies, hear dissent, then endorse a technically supported architecture | Launch mass, rendezvous requirements, lander scope, interfaces, training and facility requirements |
| Development strategy | Commitments to booster, CSM, lander and operations work; sequencing and concurrency | Overlapping workloads, discovery opportunities, rework exposure and dates |
| Design requirements | Request and approve proposals balancing mass margin, access/maintainability, redundancy, interfaces and mission needs | Component revisions, engineering assumptions and unresolved objections |
| Team leadership | Appoint recurring leaders to work packages, give bounded authority, retain or change responsibilities | Attribution for work, local expertise, handovers, relationships and institutional memory |
| Qualification strategy | Component/subsystem programmes, integrated tests, uncrewed flights and evidence-driven re-tests | What is known, what was never exercised and the costs of changing a design |
| Programme pressure | Protect an investigation, defer another project, change scope or seek resources | Explicit contracts, opportunity costs, launch-date changes and contemporary decision records |

Example: authorising concurrent production before an integrated test can save calendar time. A later interface defect then affects several committed vehicles, not just a progress bar. Testing every component separately can still miss coupled vibration or sequencing faults. A lighter design can free payload margin while creating a harder qualification problem. These consequences must arise from models and work already committed, not from retrospective narrative scoring.

## Campaign acts and playable dependencies

### Commitment and architecture, 1961–1962

Establish the inherited programme baseline, brief the lunar goal, assign an architecture study and development leads, and compare technical arguments. Direct ascent, Earth-orbit rendezvous and lunar-orbit rendezvous are competing studies with different enabling requirements.

For the **first complete expanded implementation**, support the historical lunar-orbit-rendezvous architecture through to flight. Alternative studies should be real sources of evidence and dissent, but an unimplemented architecture must be labelled as such and must not be offered as a functional full-campaign branch. Delivering viable direct-ascent and Earth-orbit-rendezvous flight programmes is a later expansion with different vehicles and milestones. Within LOR, substantial design, staffing, sequencing and qualification choices must remain playable.

Acceptance: two players can reach a LOR development authorisation with different teams, evidence, commitments and schedules. The game does not award a reputation bonus for selecting the historically adopted architecture.

### Hardware and organisation, 1962–1966

Develop booster, spacecraft and lander configurations over months and years. Introduce test-stand capacity, integrated test resources and contractor/work-package coordination only to the level needed for concrete queue conflicts and ownership.

Retain a bounded cast and aggregate the workforce. Use recurring programme, propulsion, integration and assurance personnel; give them actual work histories. Mercury/Gemini-derived experience and supporting Saturn flights supply scoped capabilities and records. In the first expanded build these supporting programmes can be aggregate work packages and reported milestones; they must not materialise as unexplained free competence in 1968.

Acceptance: a design revision can invalidate relevant evidence, delay a dependent assembly and require more work. The same personnel can later discuss a decision they participated in without inventing an appointment or attributing inherited work to the player.

### Ground safety and uncrewed qualification, 1966–1968

| Milestone | Historical role to represent | Required simulation distinction |
|---|---|---|
| Apollo 1 / AS-204 | Crewed CSM ground-test preparation and the plugs-out safety context | Ground systems, cabin materials/atmosphere, wiring, egress, test classification, emergency preparations and organisational reporting; **not a Saturn V launch** |
| Apollo 4 | First Saturn V all-up flight and spacecraft/entry qualification | Booster integration, sequencing, high-energy entry and applicable support systems |
| Apollo 5 | Uncrewed LM flight on Saturn IB | LM propulsion and control tests; it cannot inherit a Saturn V launch simply because it is named Apollo |
| Apollo 6 | Further Saturn V and integrated spacecraft qualification | Coupled dynamic loads, engine/upper-stage behaviour, anomaly investigation and disposition |

Apollo 1 must be a preventable/divergent safety situation, not a scripted catastrophe or an obvious warning followed by a moral-choice button. Risks must have discoverable evidence and meaningful organisational responses before the test. A deferred test, an uncrewed investigation, a redesigned configuration, an aborted test, a near miss and a serious accident must remain distinguishable outcomes. Test conductors and the crew can stop unsafe operations without awaiting permission from the Administrator.

Do not claim a precise historical probability for a fire, a single conclusively identified ignition source, or a complete fire/egress physical model. Early implementation should model interacting hazards and qualification gaps, with explicitly documented abstractions. A severe accident needs an investigation and programme recovery path; copying the current automatic campaign termination after crew loss would prevent the intended continuity.

The historical mission order is a default plan. Dependencies are capabilities and evidence, not a blanket rule that every named mission must succeed in order. Repeats and revised test objectives remain possible. Some lander and booster work can proceed independently.

### Crewed qualification and lunar commitment, 1968–1969

| Mission | Programme purpose | Examples of dependencies |
|---|---|---|
| Apollo 7 | Crewed CSM demonstration in Earth orbit, Saturn IB | CSM readiness, ground safety disposition, life support, crew and operations preparation |
| Apollo 8 | Crewed lunar-orbit mission, Saturn V | CSM flight experience, launch-vehicle evidence, high-energy entry, navigation and distant-flight operations; no operational LM required |
| Apollo 9 | Crewed CSM/LM Earth-orbit qualification | LM uncrewed evidence, compatible interfaces, crew rendezvous preparation and integration |
| Apollo 10 | Lunar rehearsal | LM Earth-orbit experience, lunar environment evidence, descent/rendezvous scope and return margins |
| Apollo 11 | Landing, surface work, ascent/rendezvous and recovery | Relevant booster, CSM, LM, navigation, training and operational envelopes; contemporary independent readiness disposition |

The Apollo 8 decision is a programme commitment under uncertainty, not an automatic calendar event. Hardware readiness, the lander's actual schedule, available evidence and staff recommendations should shape whether a lunar-orbit attempt is credible.

Apollo 9–11 retain the existing observation, authority and transcript work, but receive the hardware and organisational state actually developed by the player. There is no automatic reset to a standard 1969 vehicle, budget or cast.

## Required architecture

### Persistent programme state

Use a campaign state above individual flights:

- Calendar and historical context; planned and actual dates.
- Purpose-restricted funding, commitments, paid expenditure and an explicit reserve.
- Persistent people and work-package assignments; aggregate workforce and scarce test capacity.
- Vehicle configurations assembled from versioned components and interfaces.
- Development/manufacturing/test jobs and their actual dependencies.
- Evidence with configuration, environment, coverage, provenance and uncertainty.
- Independent readiness findings and recorded dispositions.
- Milestone plans, attempts and operational outcomes.
- Decisions, objections, changes and causal links used by briefings, launches and the archive.

A component record needs identity, revision, mass/performance assumptions, underlying mechanisms, development/manufacturing state, evidence references and applicable operating envelope. A vehicle snapshot fixes the configuration for an actual mission. Later redesigns cannot silently improve an already-built or launched vehicle.

### Three truths over eight years

The player records their interpretation. Staff form different interpretations from available evidence, experience and professional priorities. The simulation retains the actual mechanisms and configuration state.

An analysis or test improves knowledge only within its coverage. Redesign changes the underlying mechanism and can introduce different risks. A successful flight provides evidence about that particular configuration and environment; it does not erase disagreement or make every earlier management choice sound.

Do not use hidden condition values to generate omniscient staff dialogue. Preserve dated beliefs and objections so later people can be relieved, surprised or mistaken without the archive rewriting them.

### Time, queues and money

Use event-driven strategic time: days for development, weeks/months for long work packages, and finer resolution for tests and flights. Advance to the next decision-relevant report rather than asking the player to click through eight years of empty days. Routine work can remain delegated within bounded authority.

Keep the existing second-resolution launch presentation separate from strategic stepping. Saturn IB needs its own supported launch presentation/profile; the Saturn V illustrative profile is not applicable to every mission. Background work and the shared calendar must continue consistently during observation.

Replace the 1969 slice's $1.8m incremental envelope with an explicitly scoped campaign economy. Do not multiply the starting reserve or present a finite prototype spending pool as the historical NASA appropriation. A first campaign funding model may use data-defined, purpose-restricted funding authorisations and explicit funding-request decisions; it need not implement the entire congressional system.

Model meaningful committed obligations and recurring costs where included. Exhausting the reserve cannot stop already authorised work. Reallocation has legal/purpose boundaries, existing obligations survive fiscal transitions, and additional resources are not guaranteed. State clearly which budget amounts and authorities are prototype abstractions. Balance the economy against several complete campaign strategies before tuning it.

### Causal payoff at launch

The launch briefing should be able to follow actual links:

`architecture decision → work package → appointed lead → design revision → test result → unresolved/disposed finding → vehicle snapshot → flight observation → later staff recollection`

Show a few relevant links, not the entire audit trail. A programme director may recall a protected investigation; an engineer may watch a stage they helped qualify; assurance may retain a caveat. These references need real records. The player earns the feeling through continuity, without points for gratitude, a forced intervention or a guaranteed successful launch.

## Delivery sequence and completion gates

### Foundation gate: a playable 1961 opening

Implement the new campaign state, isolated scenario selection and save version, inherited agency baseline, architecture studies, team appointments and work-package/resource commitments. Deliver a modern briefing UI that keeps issue, evidence, people and actions together.

**Done when:** saving and resuming preserves assignments, contractual commitments, reports and dated interpretations; two opening policies create materially different development plans. No new mission is labelled playable merely because its title is in a catalogue.

### Development gate: build and qualify the vehicles

Implement component/configuration lineage, dependent work, test capacity, noisy evidence and independent findings. Support a booster/CSM/LM development loop that can reach the uncrewed qualification programme. Add the ground-test hazard review with its own operational authority.

**Done when:** a late change produces bounded rework; evidence invalidation is scoped; a held safety test can lead to new evidence and corrective work; preserving an earlier commitment can have an intelligible advantage as well as a downside.

### Flight gate: Apollo 1 and 4–8

Implement distinct ground/uncrewed/crewed profiles, configurable attempts, anomaly disposition, accident investigation and programme recovery. Preserve capability dependencies, alternate outcomes and mission-specific launch vehicles.

**Done when:** Apollo 1 is not forced to burn, Apollo 5 uses Saturn IB, a partial Apollo 6-type qualification leaves real follow-up work, and Apollo 8 depends on actual capabilities rather than the date alone.

### Continuity gate: complete the campaign through Apollo 11

Feed the developed state into Apollo 9–11, carry people/funding/hardware forward, and make launches and post-flight conversations refer to the campaign's actual history. Tune strategic and observation pacing together.

**Done when:** a deterministic headless policy and a UI playthrough can start on 25 May 1961 and finish a landing attempt and recovery; different plausible policies produce different costs, dates, evidence and outcomes. Missed deadlines, repeats and programme recovery are supported rather than silently repaired.

## Regression and acceptance tests

1. Existing 1969 saves still open in their original scenario; migration never invents eight years of player decisions. Keep an explicit older-scenario launcher and backup before any conversion.
2. Strategic step size, display speed, pauses and location switches do not change seeded outcomes for the same command history.
3. Only actual tests/observations create evidence; commissioning an investigation does not itself improve hardware.
4. Configuration changes invalidate only evidence whose applicability changed; historical records remain readable.
5. A leader's assignment and work history survive handover, save/load and successive missions; unassigned people are not credited with work.
6. Jobs reserve and settle costs once; concurrent work, reserve exhaustion and fiscal transitions reconcile.
7. Flight attempts snapshot their actual vehicle; future redesign cannot affect them retroactively.
8. Ground safety, crew/test-conductor authority and flight authority cannot be bypassed through an executive dialogue option.
9. Launch references and recollections cite actual earlier records and retain their original uncertainty.
10. Successful prior missions do not qualify untested environments or suppress a valid concern.
11. An accident or failed objective can leave an investigable programme state; retries cannot reset costs, history or crew losses.
12. A complete campaign has several viable policies and no requirement to reproduce every historical failure.

## Major implementation risks

- The current engine hard-codes one LM investigation, a three-mission catalogue and mission-index progression. Separate programme development, evidence applicability and mission execution before expanding it.
- Changing the global scenario catalogue changes the current save content hash. Preserve the old scenario and add explicit catalogue/version selection; do not edit the old start date and call that migration.
- The current finance envelope covers marginal late-slice work, not an eight-year national programme. Balance development commitments and staffing before promising a campaign funding model.
- Full alternative architectures multiply hardware, mission, interface and qualification requirements. Historical LOR is the first end-to-end target; label the branch boundary honestly.
- Too many mandatory appointments or reviews turn forethought into paperwork. Show high-consequence decisions and delegate routine detail. Use case reports and next-report advancement rather than mandatory monthly clicking.
- Real-time launch polish cannot substitute for career continuity. Preserve the existing observation system while development systems establish why that particular launch matters.

## Historical references and abstractions

- [NASA: Apollo architecture decision](https://www.nasa.gov/history/60-years-ago-nasa-decides-on-lunar-orbit-rendezvous-for-moon-landing/): competing direct, Earth-orbit-rendezvous and lunar-orbit-rendezvous approaches; the historical LOR decision was announced in July 1962.
- [NASA: Apollo programme and mission catalogue](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo.html): historical milestones and mission purposes. The campaign need not force those dates or outcomes.
- [NASA: Apollo 204 Review Board report](https://www.nasa.gov/missions/apollo/apollo-1/report-of-the-apollo-204-review-board/): ground-test context and investigation evidence. Historical accident facts are not instructions to reproduce the accident.
- [NASA: Apollo 6](https://www.nasa.gov/mission/apollo-6/): integrated flight qualification and multiple distinct anomalies, rather than a generic success/failure stamp.
- [NASA: Apollo 11 overview](https://www.nasa.gov/history/apollo-11-mission-overview/): May 1961 commitment and landing/return objective.

Mission timings, development durations, costs, quantitative risk models and candidate trade-offs still require implementation and playtesting. None of the proposed numeric models should be represented as a validated reconstruction of historical engineering or funding law. The supplied GDD remains the design reference; its illustrative dialogue is not a required script.
