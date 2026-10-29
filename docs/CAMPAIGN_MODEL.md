# Expanded campaign prototype — 29 October 2026

The default game starts on 25 May 1961. It implements development, team ownership, qualification and nine mission milestones through Apollo 11. The modern browser interface calls an independent Python simulation; it does not decide outcomes. The previous Apollo 9–11 Tkinter scenario remains available with `--legacy`.

## First playthrough

1. On Overview, commission the architecture study. Next report advances directly to its completion. Read it and endorse lunar-orbit rendezvous.
2. Open Programme. Assign workstream owners and compare development proposals for Saturn V, the CSM, the LM, ground procedures and operations. Cost, estimated duration, mass implications and funding source appear before authorisation.
3. Plan concurrent work before advancing years. There are initially two aggregate teams; expansion to three costs money and takes time. Each named lead can own only one active package. Assigning everyone to the same manager prevents parallel progress.
4. Development delivers hardware, not proof of readiness. Commission both component tests and integrated rehearsals. Reports contain synthetic observations and named staff interpretations. Corrective work changes the revision and requires fresh tests. Repeating a test does not repair a fault.
5. Mission opens a portfolio of dossiers. Select several missions, choose a programme manager and approve their combined envelope. Selection order sets the preparation queue, so choosing Apollo 7 first reserves early preparation capacity for it. Up to three mission teams prepare concurrently, including later flights whose dependency evidence is still pending. One independent assurance team reviews eligible dossiers; one shared operations slot executes cleared attempts. Use Run for continuous delegated progress or Next report to inspect a boundary. Apollo 1 is a hazardous ground test, not a rocket launch. A fire is possible, not scripted as inevitable.
6. You can keep managing development while delegated missions proceed, or observe missions from Launch Control, Mission Control or Recovery, or return to the office. Live playback has adaptive speed, pause and manual speed selection. Unexpected operational reports stop presentation; inspect, acknowledge and resume. Crew and controllers take emergency actions independently.
7. Records preserves decisions, reports, links, conversations and outcomes. Your interpretation is separate from evidence. Save & settings supports save, resume and a new fresh campaign without deleting the previous one.

## What carries forward

Proposal choice changes cost, time, mass/capacity and private engineering conditions. Lead expertise affects work duration and observational uncertainty. Evidence belongs to its tested revision. Mission preparation and review are configuration-specific. Flights freeze their hardware, owners and provenance. Pre-launch references cite actual records; they do not invent earlier player decisions. A successful flight does not remove hidden weaknesses or retroactively validate every choice.

Failures retain their cost and history, impose a standdown and require investigation. Investigation invalidates qualification; it does not magically repair hardware. The same milestone can be attempted again after corrective work. Historical reference dates do not force launch dates. Late campaigns remain playable.

## Financial abstraction

The campaign starts with **$9.75bn of illustrative, finite, no-year authority**: engineering $6bn, readiness $1.5bn, operations $1.5bn and Administrator reserve $750m. These figures are game work-package allocations, **not historical NASA appropriations or total Apollo cost**.

Authorisation commits funds once. Completion converts the commitment into paid expenditure without reducing available funds twice. Fixed-price packages include aggregate labour; idle time has no separate payroll charge. Account allocations, commitments, payments and uncommitted balances are visible, with a dated transaction ledger. The reserve can be explicitly released to a programme account with a recorded reason. Programme accounts cannot be freely transferred. No annual top-ups, congressional requests, refunds or new money appear automatically. Existing funded work continues with an empty reserve. Defer new work or release remaining reserve when an account is exhausted; a bankrupt campaign may require a restart.

## Explicit scope limits

- Only lunar-orbit rendezvous has an executable end-to-end campaign. Direct ascent and Earth-orbit rendezvous appear in the architecture study as comparisons, not fake playable branches.
- The portfolio contains Apollo 1, 4, 5, 6, 7, 8, 9, 10, 11. Preparation is concurrent and execution can occur out of numeric order. Data-driven flight gates require Apollo 4 before 6; 1 and 4 before 7; 6 and 7 before 8; 5, 6 and 7 before 9; 8 and 9 before 10; and 10 before 11. These are prototype evidence dependencies, not a claim about exact historical approval rules. There is one active flight/occupied test at a time; multiple simultaneous flights, a detailed range calendar and facility expansion are deferred. Saturn IB is inherited rather than separately developed. Mercury/Gemini experience is aggregated in operations work.
- Four fictional persistent senior staff and an aggregate workforce stand in for the organisation. Appointments are workstream assignments, not a full hiring, contractor or personnel-career system. Independent assurance cannot be assigned development work.
- Engineering uses two synthetic mechanism indices per workstream, noisy test observations and simplified payload allowances. Indices are not calibrated failure probabilities. Interface evidence does not yet implement a complete cross-component dependency graph.
- Outcomes follow seeded engineering exposure at operational phase boundaries. Launch communications have finer scheduled timestamps, but there is no continuous physical rocket, cabin-fire, navigation or landing simulation. The Saturn V display is a nominal estimate; illustrations are schematic. Detailed lunar telemetry and video footage are absent. Abort/recovery outcomes are compressed at the relevant boundary rather than simulating a complete contingency return trajectory.
- The modern campaign retains independent crew/controller safety authority. Its structured Flight Director questions cover observations, uncertainty and authority. It does not yet port every controller-specific exchange, optional Administrator abort rule, audio or aftermath scene from the legacy scenario.
- Historical UI evolution, 3D offices, travel, political oversight, facilities, contractor markets, full appropriations and extended epilogues remain deferred.

## Persistence and validation

New campaigns use version-2 saves and a data-content fingerprint. Version-1 modern campaign saves migrate without inventing mandates or charging funds; the original is preserved as a .v1-backup.json file on the first upgraded save. Original 1969 Tkinter saves remain separate. Autosaves are atomic. A project-wide OS lease prevents concurrent modern servers from writing competing campaign state. The UI is loopback-only, with same-origin command checks and an instance token; no external services or packages are required. Closing the browser stops live stepping. Relaunching resumes paused.

`python -m per_aspera --campaign-demo --seed 11` exercises one public-evidence policy through all nine objectives, returning on 1 September 1969 with this catalogue. With the revised mission scheduler, seed 29 reaches Apollo 11 but an incomplete attempt needs further work, slips past 1969 and requires an explicit additional allocation before a repeat flight. The fixed demonstration policy does not supply that allocation automatically. That proves complete routes and meaningful slippage, not universal balance or historical fidelity. All 105 retained scenario tests and 28 expanded campaign tests pass (the full 131-test regression run plus the final 28-test campaign run). Tests cover funding, evidence revision, authority, adverse outcomes, save/resume, provenance and playback invariance. Campaign pacing and emotional payoff still need the user's full playtest.


## Delegation, exceptions and amended scope

A mandate commits preparation and execution from operations, and independent review from readiness, before work begins. Starting and completing delegated stages consume that recorded obligation rather than charging it again. Named programme managers coordinate aggregate mission teams and may oversee multiple dossiers; development work still has its original lead/capacity limits. There are three preparation teams, one independent assurance team and one shared flight/test operations slot. These are explicit scheduling abstractions rather than a full workforce/facility model.

Managers cannot waive readiness evidence, mass limits, configuration validity, accident standdown or crew/controller safety authority. Preparation may precede the required earlier flight results; independent disposition and execution wait for them. Hardware changes after preparation, observed excursions and failed attempts hold the affected mandate and produce a persistent executive exception. A failed attempt also requires investigation. Ordinary preparation, review and nominal outcomes do not automatically pause delegated playback. Unexpected operational reports and executive exceptions do.

A funded amendment retains existing commitments and quotes only the newly required packages. Paid obsolete preparation/review remains in the ledger. Deferring a mandate lets already contracted work finish and holds subsequent execution; it does not refund contracts or create money. The shared hardware model means a corrective revision can invalidate several prepared dossiers. The prototype has no separate inventory of individual manufactured stages or spacecraft.

Use Save & settings → Save and quit to shut down the local server cleanly. Run also works during scheduled strategic development (one game day per real second at Auto); missions retain phase-sensitive pacing. The office, mission board and observation views share the same clock. Changing views, speed and pause does not change seeded operational outcomes.
