# Feature coverage — current expanded campaign

Updated 29 October 2026. The modern 1961–1969 campaign is now the default executable prototype. The older coverage below applies specifically to the retained Tkinter scenario.

| Area | Current implementation | Remaining limits |
|---|---|---|
| Campaign | Starts May 1961; development, qualification, Apollo 1/4/5/6/7/8/9/10/11; real completion dates, out-of-order execution and repeat attempts | Concurrent delegated preparation and data-driven flight gates; detailed facilities and simultaneous flights deferred |
| Design | Five workstreams, three proposals each; cost/time/mass/private mechanism differences; paid revisions | Only LOR is executable; Saturn IB inherited; synthetic engineering |
| People | Persistent fictional leads, expertise, opinions, assignment history, independent assurance and aggregate capacity | No full recruitment, careers, contractors or organisation chart |
| Three truths | Separate player interpretation, observed test reports and named staff views; hidden conditions excluded from UI projection | Limited authored interpretations and two mechanism indices per workstream |
| Finance | Finite allocated authority, commitments, settlements, reserve release, dated ledger; no double charge or annual money creation | Illustrative no-year work-package budget, not historical appropriations; no funding-request system |
| Mission | Nine profiles, independent contingency authority, adverse outcomes, snapshot lineage, actual-record launch references | Phase-boundary engineering outcomes; schematic visuals and nominal Saturn V estimates; compressed contingency return |
| Modern UI | Real connected Overview, Programme, People, Funding, Records and Mission views; contextual costs, persistent mission widgets/transcript, speed/pause/location controls | Browser-based; historical UI evolution paused; not every legacy dialogue/audio feature is ported |
| Saves | Separate versioned campaign saves, atomic autosave, named resume, fresh save, single-writer OS lease | No old-state migration; data fingerprint changes require an explicit future migration |
| Validation | Expanded campaign tests cover costs, revision evidence, history, authority, failure, persistence and speed/location invariance; seed 11 completes all nine milestones | User playtest still needed for balance, readability and emotional payoff |

See [CAMPAIGN_MODEL.md](CAMPAIGN_MODEL.md) for launch instructions, actual financial assumptions and all current simplifications. The larger campaign plan remains a roadmap beyond these implemented mechanics.

### Delegated mission portfolio and release candidate

- Implemented: batch mandates with named managers and fixed funded scope; three parallel preparation teams, one assurance team and one flight/test operations slot. Preparation can proceed ahead of dependency flight results. Routine execution is delegated and can run while the Administrator uses other workspace views.
- Implemented: configuration/evidence exceptions, persistent executive holds, accident standdown, explicit priced amendments, retained obligations, deferral and causal authority records. No delegate can bypass flight gates or spend outside its recorded envelope.
- Implemented: version-1 modern-save migration with a preserved backup, version-2 per-mission state, public mission board with status/costs/dependencies, save-and-quit and separate writable storage for portable/installed builds.
- Validation: 145 unit tests pass, including 12 new scheduling/migration tests; source and packaged application lifecycle smoke tests exercise delegation, command security and autosave. Windows CI builds and tests both the portable executable and per-user Inno installer before candidate publication.
- Deferred: simultaneous flights, a detailed resource/launch-window calendar, individual vehicle production inventory, contractor procurement and editable mission objectives. The default mission dependency graph is a documented gameplay abstraction.


---

## Legacy scenario coverage and implementation history

# Feature coverage — Apollo 9 to Apollo 11 prototype

Updated 29 October 2026. **Implemented** means executable in this slice; **Partial** names the exact limit; **Deferred** is not represented as a finished feature. References are physical PDF pages in the supplied cumulative v7.0 working draft. Later addenda take precedence over older examples.

## UI direction revision: modern workspace

**Design concept, not integrated gameplay.** Historical UI evolution is paused at the user's request. The next interface should use stable modern navigation, a clear overview, contextual decision details and a dedicated mission-observation layout. Preserve uncertainty, authority boundaries and separation from simulation. See [MODERN_UI_DIRECTION.md](MODERN_UI_DIRECTION.md). Earlier analogue/UI-evolution entries below describe the existing build or previous plans, not a requirement for the next implementation. The playable game and saves are unchanged by this design work.

## Confirmed next scope: 1961–1969 development campaign

**Planned, not implemented.** The new campaign begins with the 25 May 1961 lunar commitment and proceeds through Apollo 1, 4, 5, 6, 7, 8, 9, 10 and 11. Architecture studies, hardware/configuration lineage, team ownership, long-term commitments, scoped qualification and accident/programme recovery need implementation before this can be described as playable. Apollo 1 is a ground-test/safety milestone with divergent outcomes; it is not a forced disaster or a launch profile. The existing executable remains the Apollo 9–11 scenario. See [the campaign plan](APOLLO_1961_1969_CAMPAIGN_PLAN.md) for delivery gates, dependencies, historical sources and regression requirements.

## Launch anticipation, crescendo and human aftermath — 29 October 2026

This section supersedes previous launch pacing and replay descriptions.

- **Anticipation:** new launches capture up to three source-linked personnel messages from the existing programme director, systems engineer and assurance officer. They appear at countdown seconds 4, 20 and 36. Each cites an actual readiness, engineering or organisational record; judgement is presented as staff interpretation. A missing source suppresses that exchange. No invented appointment, completed delegation or player intervention is asserted. Text is a bounded fictional exchange, not a historical quotation.
- **Crescendo:** explicit final countdown calls join ignition, liftoff, tower clearance, pitch, staging and insertion events. Normal countdown/liftoff run at 2 game seconds/real second, ascent mostly 6, staging 3. After insertion, the scene remains slow enough for the human response. Quiet checkout uses 3.2 real seconds/game hour after its initial checks, keeping nominal Apollo 9 Auto duration approximately **883 s / 14 min 43 s**. Scheduled beats do not pause or ask for an executive decision.
- **Presentation:** Launch focus hides routine tabs and phase-skipping during the sequence, keeping the clock, camera/map, current communication and append-only transcript visible. Show files and Flight Director access remain available. Focus ends automatically at engine mission second 855; it yields to unexpected developments. Persistent widgets and user-selected files are retained. Camera interpolation samples only the existing nominal model between engine seconds; readouts remain engine-confirmed estimates. A bounded Earth-horizon illustration marks completed insertion rather than an empty camera feed. Contingency presentation avoids a nominal orbit celebration.
- **Aftermath:** brief personnel reactions at seconds 775, 800 and 825 link back to their captured campaign sources and the insertion event. They acknowledge relief without declaring earlier judgements correct. Discontinued launches emit no new relief messages. Issued reactions enter the relevant character's memories and permanent transcript/archive; the later office briefing offers one dated recollection and a link to the conversations. It does not show a celebratory recollection after crew loss. These records award no morale, reputation, budget or performance bonus.
- **Audio:** four small locally synthesized cues provide optional ignition/ascent rumble, staging and insertion acknowledgement through Windows' asynchronous sound API. Time → Synthesized launch audio defaults off; pause, mute and leaving LCC/MCC stop it. Missing playback support fails quietly. The source generator is retained; there are no downloaded recordings, speech synthesis, volume changes or dependencies. Automated tests check WAV validity and backend calls; audible hardware quality remains for playtesting.
- **Persistence:** the captured voice schedule and issued-second list are optional additive flight fields in schema 2, validated against source event IDs and allowed times. Existing flights receive no retroactive voice history. Saving mid-sequence resumes without duplicate conversations; the next newly authorised flight uses the complete sequence.
- **Validation:** **105 tests pass**, covering provenance, no hidden-fault leakage, exact/deduplicated beats, save/resume, discontinued-launch suppression, neutral engineering/outcome/RNG/funding effects, focus without tab replacement, pacing and optional audio lifecycle. Existing full-state speed invariance and authority tests still pass. Seed 11 completes all three objectives with $230,000 remaining. Native QA checks the countdown focus and insertion aftermath using an isolated save.
- **Deferred:** expanded pre-Apollo campaign development, appointments, full personnel careers, recorded/voiced radio, detailed launch failures and cinematics. The Saturn V ascent remains a nominal illustrative profile. The human aftermath is an authored, event-conditioned scene, not a new psychology simulation.


## Observation workspace redesign — 29 October 2026

- LCC/MCC use the full content width; office header/sidebar return when navigating back to the office. The analogue office documents and simulation remain separate from the observation presentation.
- A persistent notebook separates **Live observation**, **Situation & readiness**, **Flight plan** and **Flight Director**. Supporting campaign records no longer push the camera/map down a scrolling document. **Speak to Flight Director** opens the contextual contact panel; controller questions and saved answers retain their existing evidence and authority boundaries.
- A vertical splitter resizes the transcript independently of the upper workspace. The transcript stays visible on every tab. Changing data never selects another tab or resets the splitter, transcript selection or scroll position. Venue-specific widgets remain cached during navigation.
- The Canvas fits a fixed 3:1 display board uniformly into available space, centred with letterboxing. Text and geometry use the same scale in both axes, correcting overlapping readouts on wide, shallow windows. Static items rebuild only on resize; flight updates change coordinates and values.
- Location/speed controls are compact; restart/save remain in the Campaign menu. Alternate-history abort appears only in its enabled ruleset, within the contact panel. The shared clock shows authoritative MET even while viewing supporting tabs.
- **93 automated checks pass.** New checks cover wide/tall display bounds and aspect ratio, proportional row spacing, office-navigation restoration, contextual contact access, persistent tab selection during updates and visible paused MET. Native QA verified normal/maximized layouts, narrower-window rendering, office restoration and controller-panel access with an isolated save.
- **Deferred:** later-era skins and digital workflows, configurable workspaces, photorealistic control rooms and a framework migration. This is a 1969 workspace redesign; no new physics, outcome rules or save schema changes.


## Current implementation: second-clock launch and control-room displays — 29 October 2026

This section supersedes the earlier hourly launch replay and display-estimate descriptions below.

- **Engine resolution:** new flights start a 60-second terminal countdown. Ignition at T−8, liftoff, tower clearance, pitch programme, max-Q region, stage separations, cutoff and parking-orbit insertion occur at data-defined second boundaries. No future launch entries are pre-written for later replay. Fast-forward and automatic playback use the same boundary stepping, transcript and interruption engine.
- **LCC:** persistent procedural pad/tracking camera, moving Saturn V silhouette, exhaust, separation and stage configuration, amber mission clock, CRT-style numerical estimates and altitude trace. The camera is a reconstruction, not archival video or a physical camera simulation. The colour-room reference informs its presentation.
- **MCC:** distinct sepia/olive console surround, projected world-map estimate, moving marker, recent ground track and numerical board. The map-led room reference informs the presentation; this is a readable prototype rather than a replica of console hardware. Position is unavailable in phases without a model.
- **Evidence boundary:** altitude, Earth-fixed speed, downrange distance and approximate dynamic pressure are nominal estimates. Rounded Apollo 11 ascent knots are reused for Apollo 9–11; the atmosphere uses a simple exponential density approximation. Earth parking-orbit position uses a circular estimate, not orbit determination. These data do not reveal hidden component faults or replace synthetic instrument reports/controller assessments. Trajectory estimates do not affect readiness or determine outcomes.
- **Pacing:** countdown 4 simulated s/real s; launch 6 s/s through insertion; remainder of the existing first-hour slot accelerates at 900 s/s. Other phase rates remain adaptive. Nominal Apollo 9 Auto duration is approximately **866 seconds / 14 min 26 s**, subject to interruptions and callback delays. The countdown occupies part of the existing first-hour mission slot, preserving campaign dates and costs.
- **Persistence:** state/event/transcript second fields are additive to schema 2. New flights save their exact engine second, milestone IDs and latest ten minutes of five-second trace samples. Existing active flights without the second-clock fields retain hourly operation; the next authorised mission uses the new clock. No mid-flight rewrite of old launch history occurs.
- **Incremental rendering:** 50 ms event-loop callbacks update persistent Canvas coordinates/readouts and append new transcript entries. Static geometry rebuilds only on resize; watch widgets, scroll and selections persist. Autosave is throttled to five real seconds during uneventful fine stepping, with immediate writes at recorded events.
- **Authority/outcomes:** Flight Director and crew boundaries, executive questions, unexpected-event pauses and finance remain unchanged. No nominal forced interaction or anomaly. Physics/RNG evaluations still occur at existing hourly engineering boundaries. Detailed ascent failures, holds, launch-abort modes, lunar trajectories, re-entry physics, real video and full historical telemetry remain deferred.

Validation: **88 automated tests**, including exact milestone timing/no early entries, partition-invariant second stepping and trace, mid-launch save/resume, legacy flight compatibility, location invariance, public estimate boundaries, incremental transcript updates and full-state outcome/RNG/finance invariance across playback speeds. Native LCC/MCC QA uses an isolated save. Seed 11 still completes all three objectives with $230,000 remaining.

Sources: [NASA Apollo 11 ascent table](https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11d_Ascent_Phase.htm) for rounded nominal profile knots; [NASA MCC restoration](https://www.nasa.gov/johnson/history/apollo-mcc-restoration/) for projected television/graphics and separate timing-display direction. These sources do not validate the prototype’s simplified physics.

### Earlier iteration records

The sections below record prior implementations. Where they describe hourly MET estimates or launch replay, the current implementation above takes precedence.


## Requested foundation

| Feature | Status | Implementation / boundary | Evidence |
|---|---|---|---|
| Modular Python simulation, independent of GUI | Implemented | `model.py`, `engine.py`, `persistence.py`; only `ui.py` imports Tkinter. | Headless tests and `--demo`. |
| Deterministic simulation clock and scheduled work | Implemented | Second-resolution clock and launch events for new flights; hourly engineering/work boundaries; next-report/phase advancement; optional GUI clock. No outcomes depend on wall-clock timing. | Work-duration and deterministic-state tests. |
| Event system | Implemented | Typed records, monotonic IDs, simulation timestamps, actor, mission, configuration and causal/evidence links. Emission is synchronous; no generic plugin bus. | Mission, job, review and history assertions. |
| Save/load | Implemented | Atomic JSON replacement, schema version, catalogue fingerprint, validated RNG, in-progress jobs/meetings/flight, separate public-record export. | Exact continuation tests; rejected malformed/future/catalogue-mismatch saves; failed replacement preserves previous file. |
| NASA Administrator interface | Implemented | Native Tkinter Programme, Evidence, People, Engineering Review, Delegation & Decisions and Archive desks. Explicit clock status; affordable/authority/phase validation in domain commands. | Native window visual and control checks; see QA notes below. |
| One playable programme | Implemented | Apollo 9 qualification → Apollo 10 rehearsal → Apollo 11 landing and return. Later missions require earlier objectives and fresh readiness review. | Full seed-11 headless run; next-mission qualification gate test. |
| Several possible outcomes | Implemented | Objective plus recovery; contingency return without objective; crew loss from inadequate remaining operating margin; voluntary programme termination. | Controlled margin fixtures cover all three flight outcomes; cancellation test. |
| Small persistent cast | Implemented | Four recurring fictional specialists, distinct expertise/initial interpretations, private tendencies and event-linked memories. | Stable staff population and divergent-opinion tests. |
| Three truths | Implemented | Separate player hypothesis/rationale; staff beliefs/recommendations; objective mechanism magnitudes and seeded dispersions. Public briefing is an explicit projection. | Hypothesis-invariant test observations; hidden-field exclusion test. |
| Delegation | Implemented | Named lead, capped spend and elapsed time; real tests use the same command path; exceptions stop autonomy. No delegated design changes, risk waivers or launches. | Spend/deadline/escalation tests. |
| Contextual reviews and interventions | Implemented | Continue argument, brief break, incidental outsider, ask for discriminating evidence, step aside, impose interpretation. Fatigue/evidence/progress and remembered conduct shape responses. | Same-break helpful/harmful/neutral fixtures; challenge and outsider tests. |
| Persistent decision/outcome record | Implemented | Archive and JSON public export preserve contemporary interpretation and uncertainty, not an omniscient verdict. Save files retain hidden state for replay. | Linked event records and post-flight histories. |

## GDD systems and principles

| GDD theme / pages | Status | Scope and next work |
|---|---|---|
| Administrator vs operational authority (1–4) | Implemented | Administrator funds, delegates, reviews and authorises; Flight Control executes phases and invokes contingencies. No cockpit controls. |
| Historical divergence (5, 23–24) | Partial | Mission outcomes follow conditions; no forced historical accident. Wider historical pressures and institutional reform are deferred. |
| Modular hardware/configuration (2–3, 27–31) | Partial | Three mechanisms and one assembly revision with immutable test/flight condition snapshots. Targeted modifications change one mechanism and invalidate clearance. No engine/tank manufacturing inventory, lots or contractor provenance. |
| Evidence vs reliability / three truths (25–30) | Partial | Controlled/noisy readings and likelihood-weighted interpretations; correct diagnosis is not awarded for choosing a hypothesis. Engineering indices are synthetic and uncalibrated, not statistical estimates of real Apollo reliability. |
| Observable testing (27–30) | Partial | Readable test results, provenance, configuration, conditions and caveats; nominal ascent estimates and five-second visual traces are implemented separately from sampled engineering evidence. |
| Mandatory independent safety review (7, 9, 11, 14, 26) | Implemented for slice | Current-mission integration and crew prerequisites; observed operating-envelope findings withhold clearance. New evidence or configuration changes require a new review. The public result never consults hidden faults. |
| Provisional fixes / technical debt (31–32) | Partial | Open assurance findings and configuration-linked work remain in the record. No provisional-flight waivers, promised future corrections or long-term debt propagation. |
| Domain expertise, professional challenge, memory (7–11, 86–88) | Partial | Different recommendations, context-sensitive challenge and remembered responses. Full competence/candour/fairness relationship evolution, grievance decay, retention and career advancement are deferred; no displayed friendship/trust points. |
| Three personnel tiers (90–91) | Implemented | Four key people; 84 aggregate engineers/two teams/three-person aggregate crew; incidental profiles do not become persistent staff. |
| Corridor Test (89–91) | Implemented minimally | Participant can decline, ask a domain-relevant question or confirm a comparison already exists. Specialists must order and interpret a real test. No automatic breakthrough or certification. |
| Situational leadership (81–88) | Partial | Break/continued debate/fresh perspective respond to latent fatigue/progress/evidence. No full conversational generator, personal humour repertoire or long-term imitation/mentorship learning. |
| Culture and reporting agreements (12–24) | Partial | Suppression can reduce later willingness to challenge; stepping aside creates an event-linked working memory; delegated limits escalate. No multi-directorate workflow, routine correspondence traffic or normalisation-of-deviance model. |
| Astronaut training (2–3, 25) | Partial | Aggregate mission-specific preparation, practice costs and persistent experience. No individual astronaut roster, medical model, crew substitutions or separate EVA/rendezvous qualifications. |
| Parametric mission phases (3) | Partial | Timed profiles and resource-margin constraints, distinct objective/return and contingency paths. No orbital integrator, launch-vehicle staging physics, surface navigation or genuine launch-window geometry. |
| Finite resources and opportunity cost (5–15) | Partial | A purpose-restricted scenario appropriation, programme allocations, protected commitments, uncommitted funds, an explicit reserve, two concurrent accountable leads, elapsed-time limits and review hours. No recurring payroll, contractor capacity loss or explicit multi-programme executive-attention resource. |
| Facilities, ranges and contractors (2, 5–6) | Deferred | No building map, construction queue, procurement or manufacturing contracts. |
| Political oversight and budget accountability (31–39, 53–54, 70–71) | Partial scenario finance; oversight deferred | No Congress, President, hearings or reputation rewards. The appropriation is a fixed scenario envelope with internal allocations and reserve; supplemental requests are recorded but not adjudicated. |
| Archive as imperfect evidence (25–30) | Partial | Contemporary evidence and decisions remain accessible with caveats and links. No multi-era retrieval, damaged records, media migration or stale-case recommendation system. |
| Mentorship, talent and succession (16–22, 37–60) | Deferred | Rebecca is a persistent systems engineer, not a scripted successor. No career/promotions, political appointment, leadership loss or retirement simulation. |
| Epilogue, advisory recall and legacy (40–80) | Deferred | Programme closure and public record provide the raw material; no simulated decades, retrospective press or emergent personal calls. |
| 3D executive office and historical crises (1, 3–4) | Deferred | All interactions use a native 2D desk. No Apollo 1/13, Challenger or Columbia scenarios. |
| Later agency portfolio / probes / Shuttle / ISS | Deferred | The prototype ends after Apollo 11 outcome and return. No early NACA campaign or later programmes. |

## Known simplifications to preserve when extending

- Numerical values, fault distributions and reading units are illustrative. They are not claims about real Apollo hardware, astronaut competence or historical accident probability.
- Earth-orbit operations are compressed and mission profiles are approximate. Once its nominal opportunity opens, a mission can currently launch at any subsequent hour; orbital windows need a geometry model later.
- Engineering modifications directly reduce the selected physical mechanism; ground tests only generate observations. Manufacturing defects, partial implementation and repair-induced integration problems are future work.
- Assurance uses a documented simplified operating-envelope rule from current evidence. It can be mistaken under incomplete/noisy evidence; it cannot see the secret true condition. Repeated comparisons are not independent flight reliability trials.
- Individual opinions use small likelihood updates and stable domain tendencies. Shared evidence can make staff converge without making them identical. There is no factual infallibility attached to seniority or the player.
- Candour and fatigue are hidden aggregate conditions, not player scores. The programme does not award “good/bad leader” points or automatically punish a reasonable but incorrect hypothesis.
- Native Tkinter controls are keyboard operable. Rich screen-reader semantics, accessible plotted traces and a packaged installer need further UI work.
- Save compatibility is guaranteed for this schema **and catalogue fingerprint**. Changes to definitions require an explicit migration instead of silently changing an old campaign's meaning. Save JSON is not encrypted; inspecting it externally reveals simulation truth.

## Validation record

The original 24 domain/persistence checks remain; the current suite has 45 checks including presentation and scenario-finance tests. The expanded suite passes on Python 3.12 and 3.15. Seed 11's example policy completes all three missions and returns lunar samples with funds remaining; a 20-seed policy/validation sweep also completed. Separate fixtures exercise safe abort, crew loss and cancellation; the demonstration is an example policy, not a guarantee that every seed or choice succeeds.

Native UI QA checks the initial programme, evidence/test ordering, advance-to-report, review intervention, delegation and archive. A real window was closed and reopened from its autosave; save/load correctness is also tested headlessly. This is a prototype smoke check, not a full accessibility assessment or historical engineering validation. Update this ledger whenever a feature's status changes; do not mark whole GDD themes implemented because one example exists.


## 1969 interface revision

**Implemented:** daily briefing and prioritised in-tray; paper palette and typed reports; folder navigation; named responsibility; test cost/time proposals; observations, staff assessment and player interpretation labelled separately; contextual meeting responses; secondary Campaign/Time menus; searchable registry. Report bodies scroll and selected rows use dark text for contrast. Campaign persistence and simulation rules are unchanged.

**Partial:** the flat native desktop suggests an Administrator’s desk and briefing room without a rendered office. This is a readable document workflow, not a physical desk simulation. Multi-decade visual progression, rich screen-reader semantics and full usability evaluation remain deferred.

Validation for this revision: 28 automated checks (24 domain/persistence plus four public-presentation checks). Native visual inspection covers the daily briefing, report dossier and navigation. Historical aesthetics are interpretive, not a facsimile of an actual NASA document system.


## Funding clarity and pacing revision

**Implemented:** unchanged $1.8m opening total; $1.5m programme allocations and $300k unallocated reserve; separate engineering/readiness/operations accounts; one-time commitments and settlement; dated obligation/reallocation register with purpose, programme and balance; explicit within-appropriation reallocations that cannot reclaim commitments; source-specific affordability checks and alternatives; public lower-bound remaining-campaign estimate; optional repeats labelled separately from readiness requirements. Programme work does not depend on reserve remaining positive. The analogue navigation gains a Budget papers folder.

**Implemented for the 1969 slice:** no-year carryover at the 1 July fiscal boundary, without automatic new money; schema-2 persistence with reconciled version-1 authorisation-history migration. Existing exhausted saves receive no hidden bailout.

**Partial / deferred:** supplemental funding requests remain pending memoranda and create no spendable authority. Congressional adjudication, broader NASA appropriations, apportionment controls, multi-programme competition, payroll, contracting termination refunds and later-era fiscal calendars are not implemented. The original scope and user-directed economy audit are documented in [ECONOMY_AUDIT.md](ECONOMY_AUDIT.md), including historical sources and exact abstractions.

**Balance evidence:** seed-11 demo spends $1.57m and completes; two comparison rounds per mission spend $1.60m and complete; three rounds stop after two missions with $200k still purpose-allocated/reserved. Keep the starting total provisionally: visibility and allocation trade-offs address the observed issue without granting more money. This is not a balance guarantee across every seed.

**Validation:** 45 tests cover original simulation/persistence/public-truth boundaries and new financial exhaustion, commitments, deduction, delegation, reallocation, ledger, migration, forecast and fiscal-year cases. Native UI inspection is a smoke check, not a full accessibility audit.


## Mission observation vertical slice — 29 October 2026

**Implemented:** persistent instant switches between the Administrator’s office, Launch Control Center, Mission Control Center and recovery operations. These are presentation-only locations over one simulation. Switching does not advance time, charge money, change schedules, touch random state, append simulation events or pause/resume the shared clock. Returning through the office location button restores the previous office folder; opening an office form retains its existing pause-on-navigation behaviour.

**Implemented:** analogue situation reports, simple 2D launch/flight/recovery boards, elapsed/remaining phase time, a phase progress indicator, reached/planned/not-reached flight-plan entries and the latest 20 operational history entries. The full record remains in the office registry. LCC distinguishes the planning countdown to the mission opportunity from an authorised ascent; MCC follows the engine’s flight phase; recovery waits for the authoritative return report. Safe-return, incomplete-objective and crew-loss results remain distinct. A completed mission’s recovery report stays visible when the engine proposes the next mission. LCC can then show that next mission’s preparation.

**Authority and uncertainty:** Flight Control retains operational decisions. Observation views have no launch, steering, descent, abort, clearance or safety-waiver controls. The office remains the place to authorise a mission. Operational logs are existing engine events, not generated radio chatter. The schematic is not live trajectory telemetry; entering recovery does not create a splashdown or crew retrieval. Hidden engineering truth is excluded.

**Clock:** Next report/phase uses the existing simulation command in every venue. The shared automatic UI clock advances up to six hours per tick, bounded by the current flight-phase end so short phases remain visible. Existing report/outcome pauses apply across all venues. Explicit six-hour advancement remains in the common Time menu. This changes the size of automatic UI steps, not mission physics or the engine’s time rules.

**Deferred:** travel time, travel costs, scheduling penalties, location-based morale/culture bonuses, 3D locations, detailed launch countdown procedures, orbital physics, live vehicle positioning and separate splashdown/retrieval subphases. Observation location is session-only presentation state; loading a campaign returns to the office. Recovery remains the existing compressed one-hour engine phase.

**Validation:** 55 automated checks total. New checks exercise free/read-only location changes, the actual UI switch handler preserving run state, identical seeded outcomes/RNG/finances with and without observation, phase/log provenance, short-phase clock steps, completed-mission report retention, skipped phases, alternate outcomes and exclusion of hidden state. Native smoke inspection covers LCC ascent, phase advancement, switching to MCC with unchanged time/balance, and recovery standby/active/completed reports; QA campaigns save separately from player campaigns.


## Restart and real-time mission pacing — 29 October 2026

**Implemented:** Restart save button and Campaign-menu command. A confirmed restart creates a fresh deterministic campaign with the same seed, backs up the current run to `before-restart.json`, writes the new autosave, and returns to the office. The fixed backup is replaced by the next restart; the confirmation explains this. Failure before replacement retains the current in-memory run.

**Implemented:** flights automatically start running on authorisation (or application startup with an active flight) at one simulated hour per 30 real seconds. One wall-clock accumulator is shared across venues and office browsing. Pause/resume resets the partial-hour accumulator and excludes paused time. Routine flight observations and phase changes continue automatically; outcome/recovery pauses the clock before the next programme milestone. Ground running stays at six simulated hours per real second and pauses for reports. Manual advance/next-phase remains available. Explicit load from the Campaign menu stays paused for inspection.

**Presentation:** each mission hour refreshes the phase, elapsed/remaining hours and progress; the status line reports actual events or a watch update stating no new operational report. No artificial radio traffic, random draws or engineering events are generated to fill quiet coast periods. Wall-clock pacing is UI-only and does not change engine physics, costs or saved simulation schema. Delayed callbacks can catch up elapsed mission hours, stopping at the mission outcome; pause before leaving the application if unattended progression is unwanted.

**Validation:** 62 automated checks total, including exact 30-second pacing, fractional intervals, paused-time exclusion, location-switch neutrality, continued flight reports through recovery, same-seed restart, backup preservation and backup-failure handling. Native smoke checks use an isolated campaign; player saves remain separate. Full long-duration usability testing is deferred.


## Adaptive pacing, live watch and incremental updates — 29 October 2026

This revision supersedes the fixed 30 s/h pacing and rebuild-based observation display described above.

**Implemented — time compression:** UI-only phase policy in `pacing.py`. Critical ascent, separation/rendezvous, descent and recovery use 30 real seconds per simulated hour. Checkout’s first two hours use 30 s/h, then its stable portion uses 4 s/h. Coast/rest uses 2 s/h; surface/stable operations use 4 s/h. Current Apollo 9 is **86 hours**, not 84: one-hour ascent + 72-hour checkout + 12-hour separation/rendezvous + one-hour recovery. Its uneventful nominal Auto schedule is **760 seconds (12 min 40 s)** before event alerts. These provisional rates are explicit presentation choices, not historical duration claims. Longer Apollo 10/11 profiles also compress routine coasts. Playtest tuning remains necessary.

**Implemented — control and significant events:** Auto and 0.5×/2×/4×/8× speed adjustments share one accumulator. Engine operational reports (objective achievement or discontinuation), assurance findings and escalations trigger a 20-real-second attention interval with at least 30 s/h, even at manually increased speeds. An active controller return contingency maintains the slower minimum. This is observation deceleration, never an Administrator abort/flight-control command. Pause and location changes preserve the partial display-hour estimate. Automatic stepping is one engine hour at a time; each resulting event is inspected before further stepping. Long blocked callbacks are capped to avoid racing through unseen events. Ground preparation retains the existing fast report-paced clock.

**Implemented — continuous watch:** a 250 ms scheduled callback updates MET and a phase bar in place. Their minutes/seconds are explicitly **display estimates**; the last confirmed engine elapsed hour remains visible. Controller interpretation, configuration, objective confirmation and crew-return confirmation are shown only as supported by public records. The latest actual synthetic in-flight observation carries its source, date, caveat and normalised readings. It is a sampled report, not interpolated physical telemetry. No fuel, position, communications or invented spacecraft health stream is shown. Quiet coasts have a moving time/progress estimate, not generated radio chatter.

**Implemented — persistent Tk presentation:** mission-location frames, labels, phase rows, status board and log are persistent. Values update only when changed; the small schematic redraws only for a changed mission/status, not each tick. A per-location event cursor appends each engine event once in chronological order. Scroll position and text/row selection are retained; a log already at the bottom follows new entries. Office documents are cached across location switches, preserving notebook/form/document state. During flight the office’s daily briefing is also a persistent mission watch. Explicit office commands/navigation may rebuild their own document to show fresh results; this is distinct from automatic mission updates. Campaign replacement clears the cache so records from separate saves cannot mix.

**Resolution review / deferred:** the engine evaluates phase activity in hourly increments and emits measurements at supported operational boundaries. Changing that grid would affect random draws, elapsed costs and save/replay semantics; this iteration therefore keeps authoritative hourly physics unchanged. Fine-resolution launch countdown procedures, separate re-entry/splashdown/retrieval events and subhour engineering telemetry require explicit engine/data/schema work later. The visible subhour estimate makes no such claims. Display fraction, speed and alert timer are session-only; loading restores the exact engine-confirmed saved state, not the transient interpolated estimate. Travel mechanics, morale bonuses, 3D scenes and full physical telemetry remain deferred.

**Validation:** 68 automated checks total. Tests compare full seeded engine state, finances, event history and RNG across 0.5×/Auto/8× for successful, safe-return-incomplete and crew-loss fixtures. They cover phase rates/nominal duration, anomaly deceleration at high manual speed, return-contingency deceleration, pause/resume fractions, no stalled-callback catch-up, resource-free observation switching, append deduplication, retained log scroll/text focus/row selection, and cached office-widget identity. Native visual QA uses a separate campaign. A complete real-time 10–15-minute usability session and broader accessibility assessment remain unperformed.


## Event-sensitive interruption, mission contact and launch continuity — 29 October 2026

This revision adds inspection pauses and persistent conversations to the adaptive watch; scheduled operations still slow without requiring interaction.

### Actual implementation

- **Routine and scheduled operations:** the existing phase pacing remains. Nominal countdown/ascent/checkouts/separation/rendezvous/return do not create executive prompts. Significant **unexpected** events carry an explicit `observation` or `action_required` classification in the authoritative engine event. Normal objective achievement is not classified as an unexpected interruption.
- **Observation interruption:** the existing Flight Director return-contingency event, independent crew emergency abort and an adverse crew-recovery report pause presentation. The controller/crew response has already been recorded by the engine before the pause. The Administrator can inspect, ask questions, acknowledge and resume; there is no unsafe-continuation or manoeuvre-order control.
- **Action required interruption:** actual delegated-authority escalations and withheld assurance findings open an executive issue. The button goes to the existing commission/engineering document; acknowledging a presentation notice does not resolve that underlying issue or waive clearance. The slice has no fabricated in-flight executive emergency decisions.
- **Stepping/resumption:** normal ticks and manual advance/next-report commands use the same engine, one authoritative hour at a time, and stop at the first unexpected event batch. Seen event IDs suppress duplicate notices. Acknowledgement changes only session presentation state. Loading an active return contingency reopens its observation notice; transcript/history remain unchanged. Outcome transitions stop stepping before the next programme’s time advances.
- **Pause limits:** the pause is reading/accessibility time, not an in-world intervention window. Flight rules and crew/controller responses already recorded cannot be undone; flight preparation/repair/reallocation commands remain unavailable in flight. No pause creates free engineering work or rescues an immediate emergency. The engine still lacks subhour emergency dynamics and detailed flight-rule deadlines.
- **Primary contact:** Flight Director by default, with Propulsion Controller, Guidance Controller and Recovery Coordinator alternatives. Five structured questions cover observations/data, causes/uncertainty, seriousness, recommendations including abort, and further-action conditions. A bounded JSON library and public evidence projection generate deterministic answers. No unrestricted AI dialogue, private fault inspection or invented detailed telemetry is involved. The requested briefing opens a reusable nonmodal reading window and is also appended to the transcript; requesting it pauses presentation without consuming mission time or resources.
- **Persistent transcript/archive:** normal communications are verbatim engine event summaries, not invented radio traffic. Questions, responses, launch references and their event links are saved alongside the campaign. A fixed transcript dock remains visible while readiness papers and the flight plan scroll. Each location appends unseen entries, highlights interruption-linked records and preserves scrolling/selection; a newly opened mission starts on its latest entry. The **Mission archive** office folder provides all saved mission transcripts; Registry retains underlying engine events. Additive optional state fields preserve existing schema-2 saves; old event-derived transcripts are reconstructed on simulation load when absent. The new text is saved, so later template changes do not rewrite previous exchanges.
- **Authority:** Flight Director retains operational decisions. At a more severe version of the existing synthetic margin condition, the aggregate Crew Commander independently invokes an emergency abort; the less severe condition remains Flight Director-managed. These are illustrative thresholds in the existing engineering model, not historical flight rules. No continuation override is offered. The **Alternate history: Administrator abort authority** Campaign option defaults **off**, can be changed only during preparation, and enables only discontinuing the objective. Return manoeuvres remain with Flight Control; recovery is not guaranteed. The alternate-history option cannot disable crew authority, and its abort control is unavailable during an observation inspection pause.

### Launch payoff and continuity

- Up to three readiness-file references cite actual clearance/findings, engineering evidence/configuration and delegation or remembered interventions/staff judgements. Records, event links and existing staff memories select the references; the game does not invent work or personnel decisions that the player never made. Full referenced text is preserved in the pre-launch transcript; the visible digest is compact.
- Authorisation enters the LCC watch. Terminal countdown, ignition, liftoff and early-ascent cues are deterministic engine-authored launch records, revealed in order during the existing slow ascent presentation. No nominal interaction, forced anomaly, morale award or prestige reward is added.
- **Important abstraction:** the engine still has one-hour ascent resolution. These four launch records share that coarse authorisation hour and are replayed at display fractions 0, 0.2, 0.4 and 0.6 of the ascent hour. They are labelled presentation replay, not independently measured subhour ignition/trajectory physics. Manual fast-forward reveals the remaining records once; archive text preserves the authoritative sequence. A true pre-ignition countdown simulation, pad holds/aborts and detailed launch failures are deferred.
- The ascent handover includes the existing systems engineer’s current interpretation, names Flight Control’s next priorities and explicitly avoids treating launch as proof that earlier concerns were resolved. Existing opinions can remain provisional or divided; no launch-driven relationship or morale bonus is applied.

### Historical boundary and deferred work

NASA’s [Apollo 11 Mission Rules](https://www.nasa.gov/wp-content/uploads/static/history/alsj/a11/a11missionrules.pdf), general guidelines 1-15 through 1-17, distinguish ground abort requests, crew abort action and launch-site responsibility. The prototype uses that operational separation as inspiration; it does not reproduce the complete authority chain, launch-abort modes, console positions or legal rules. Direct Administrator abort power is therefore clearly marked alternate history rather than presented as the historically normal workflow.

Deferred: precise launch/re-entry/abort physics; subhour emergency deadlines; full controller staffing, unrestricted dialogue, broad campaign biography, elaborate cinematics and new personnel systems. Narrative references are limited to records actually present in the Apollo 9–11 slice.

### Verification

**79 automated checks total.** New coverage exercises explicit interruption types, normal milestones without pauses, first-event stopping during fast-forward, deduplicated resume, actual UI pause/resume, public-evidence-only answers, no question-driven time/RNG/resource changes, blocked authority overrides, independent crew abort, optional executive abort, transcript save/load, resumed contingency inspection, event-grounded launch references, ordered launch replay, incremental appending and unchanged outcomes with pauses/questions. Existing speed-invariance tests still compare full seeded mission state across slow/Auto/fast playback. Native QA uses controlled isolated campaigns and checks the pause notice, controller question request, transcript/archive and nominal launch presentation. The UI does not modify player saves during QA.


## Ground wait-button correction — 29 October 2026

A pending ground escalation could block the daily briefing’s Wait for next report action while its acknowledgement controls were only available on mission-watch screens. The daily briefing now displays the actual paused report, an explicit acknowledgement and a link to the executive issue. Its main next-step card explains the clock hold rather than offering a misleading wait action. A blocked advance routes directly to the report. Acknowledgement refreshes the ground briefing so the ordinary wait button returns; in-flight watch widgets remain persistent.

Three regression checks reproduce an eight-hour readiness review behind an earlier delegation escalation, confirm that wait opens the blocking report without changing state, then verify review completion after acknowledgement with no further charge. Acknowledgement leaves the underlying executive issue unchanged. **82 checks total.** Simulation costs, safety gates and event outcomes are unchanged by this fix.
