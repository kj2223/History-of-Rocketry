# Apollo 9 to Apollo 11: implementation plan

**Scope update, 29 October 2026:** the next campaign now begins on 25 May 1961 and ends after Apollo 11. See [the expanded campaign plan](APOLLO_1961_1969_CAMPAIGN_PLAN.md) for development, architecture, teams, qualification and mission dependencies. The plan below records the implemented 1969 scenario, which must remain available during the transition. The expanded campaign is not yet implemented.

28 October 2026. Authoritative design: Project Per Aspera GDD v7.0 Working Draft (91 pages), supplied by the user. The PDF retains earlier versions for traceability: later confirmed addenda supersede earlier conflicts. Its illustrative conversations are examples, not mandatory scripts or instructions to the developer. This plan's numerical choices are prototype assumptions, not newly established GDD canon.

## Minimum playable slice

One lunar programme, February–July 1969, through Apollo 9 Earth-orbit qualification, Apollo 10 lunar rehearsal and Apollo 11 landing and return. The player is the Administrator, not the flight controller. Engineering reviews, targeted tests, crew preparation, finite purpose-restricted programme allocations and an Administrator reserve and bounded delegation influence a parameter-based mission simulation. Programme decisions can change the historical outcome. A failed objective can require another attempt; cancellation or crew loss can close the programme.

The central investigation is an ambiguous lunar-module pressure discrepancy: propulsion behaviour, sensor temperature drift and guidance workload are distinct underlying mechanisms. Evidence, individual interpretations and the player's written theory remain separate. Mission success does not erase uncertainty or automatically qualify the next mission's environment.

Four recurring fictional staff carry expertise, professional tendencies, differing hypotheses and event-linked memories. The wider engineering workforce and three-person flight crew are aggregate resources. The Corridor Test uses a temporary participant whose question, associated tests and staff reactions persist as records, without adding a permanent biography.

## Phases

1. **Foundation:** plain Python state, deterministic random stream, hourly simulation loop, scheduled work and structured chronological events. Atomic versioned JSON saves include active tasks, mission phase, interpretations and RNG state. Simulation has no GUI imports.
2. **Engineering and people:** imperfect observations generated from pre-existing mechanisms; staff assessments derived from their expertise, assumptions and evidence; the player's hypothesis; discriminating tests, configuration changes and independent readiness review. Record disagreements and responses rather than awarding friendship points.
3. **Programme arc:** Apollo 9/10 objectives gate later missions; profile-based resource and operating-envelope checks govern mission results. Delegated managers can authorise tests only inside an explicit spending/time envelope and escalate exceptions. Operational specialists execute the flight; the Administrator chooses mission scope, investigation resources and programme disposition.
4. **Interface and validation:** a native Tkinter Administrator desktop, shared domain commands, explicit clock status, save/load, event archive and post-flight review. Headless demonstration, regression tests, launch instructions and feature coverage complete the slice.

## Architecture

- `per_aspera/model.py`: serializable state and records.
- `per_aspera/engine.py`: commands, clock, jobs, evidence, reviews, delegation and mission phases.
- `per_aspera/persistence.py`: strict save validation and atomic replacement.
- `per_aspera/data/`: mission, component, staff and test definitions; reusable event language.
- `per_aspera/ui.py`: Tkinter views and presentation only.
- `per_aspera/__main__.py`: GUI launcher and deterministic headless demonstration.
- `tests/`: domain and persistence tests, requiring no display.

Use only the Python standard library. Tkinter is a replaceable adapter, not a simulation dependency. The first prototype uses explicit Advance/Next Event controls plus optional automatic advancement; real seconds do not determine outcomes. A single command validates authority, funds and phase before it changes state. No external network services, generated dialogue service or population simulation is needed.

## Major risks and acceptance checks

| Risk | Required check |
|---|---|
| UI accidentally exposes objective truth | Public briefing excludes fault values, private staff traits and random state; player theory does not change them. |
| Evidence generated to flatter the player | Equal initial state/seed/test produces equal observations regardless of player's hypothesis. |
| One universally best intervention | Break helps exhausted reviews, interrupts productive disagreement, and cannot manufacture missing evidence. Outsider can decline or suggest a test, never certify hardware. |
| Safety bypass through delegation or authority | Launch requires a current-configuration independent review; a revision invalidates clearance. Managers escalate rather than exceed their envelope. |
| Lucky flight becomes proof of safety | Qualification evidence is mission- and configuration-scoped; subsequent mission requires its own integration review. |
| Corrupted saves destroy campaigns | Validate before replacing state; atomic writes; reject unknown versions and invalid RNG state; test interrupted flight and investigation continuations. |
| Clock appears frozen | Explicit paused/running labels, visible task due times, and domain tests for work completion under advancement. |
| Scope expands into all of NASA | Fixed cast, aggregate workforce, one programme and three missions; later systems documented as deferred. |

## Simplifications and guardrails

Mission profiles compress real operations and use engineering margins rather than full orbital mechanics. Apollo 9/10/11 dates identify historical milestones, not a promise of accurate historical telemetry or failure rates. Fictional staff and anomalies avoid presenting invented statements as historical testimony. The budget covers incremental preparation and operations through one simplified no-year R&D envelope, not the historical total Apollo cost. See ECONOMY_AUDIT.md for the later allocation, commitment and reserve revision. No reputation currency or morality score is used. The archive records what was known and decided at the time; it is not an omniscient explanation of every outcome.

Political hearings, contracts, facilities, the 3D office, individual astronaut careers, mentorship/succession and multi-decade epilogues remain later phases. The full coverage ledger tracks these boundaries explicitly.
