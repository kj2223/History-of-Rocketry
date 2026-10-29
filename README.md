# Project Per Aspera

The default prototype now covers **25 May 1961 through Apollo 11**, with a modern Administrator workspace. Develop the rocket and spacecraft, assign leads, plan concurrent work, qualify revisions and carry the same hardware and team history through Apollo 1, 4, 5, 6, 7, 8, 9, 10 and 11. Flight Control and the crew retain operational authority.

## Windows release candidate

The rebuilt Python game is **Per Aspera v0.2.0-rc.1**. Download **PerAspera-Portable.exe** or **PerAspera-Setup.exe** from the matching GitHub prerelease. Python is bundled; no Python installation is needed. The interface opens in your default browser and the simulation runs locally.

Portable saves live in `PerAsperaData/saves` beside the executable; keep it in a writable folder. The installed edition saves in `%LOCALAPPDATA%/PerAspera/saves`. Updates and uninstall leave installed user saves intact. Use Save & settings → Save and quit when finished. Reopening the launcher reopens an already running instance. These initial Windows builds are unsigned.

Existing source-game saves can be copied into the chosen edition's saves folder, then selected under Save & settings. Version-1 modern saves upgrade with an original-file backup; older Vanguard/Electron saves are incompatible with this rewrite. The previous stable releases remain available separately.

## Launch the modern campaign from source

Python 3.11 or newer; no pip dependencies. The interface opens in your browser from a local Python server.

```powershell
cd "C:\Projects\History of Rocketry"
python -m per_aspera
```

Resume is the default. For a separate fresh save:

```powershell
python -m per_aspera --fresh --seed 11
```

You can also use **Launch Per Aspera.cmd**. Leave its server window open while playing. Stop that server before starting another; only one modern campaign writer is allowed. Within the game, **Save & settings → Start fresh campaign** creates another save without deleting the previous one. The clock resumes paused after loading.

Start on **Overview** with the architecture study, then visit **Programme** to assign leads and authorise development. Schedule parallel work before using **Next report**, which advances directly to the next completion. Readiness is tied to the actual hardware revision, not a generic score. Mission opens the portfolio: select several missions, approve a manager and combined envelope, and let preparation proceed in parallel. Independent reviews and actual flights still obey configuration, evidence and resource gates. Run works while you browse the office; routine delegated work needs no repeat sign-off. **Funding** shows allocation, commitments, expenditure and the transaction ledger; money does not appear each year.

New autosaves are `saves/apollo-1961-*.json`; `saves/current-apollo-campaign.txt` selects the default resume file. Original 1969 saves remain separate. Keep backups before editing game data: saves check the catalogue fingerprint.

[Play guide, financial rules and explicit model limitations](docs/CAMPAIGN_MODEL.md) · [Feature coverage](docs/FEATURE_COVERAGE.md)

This is a first expanded campaign foundation: LOR is the implemented architecture, mission execution follows evidence dependencies, and engineering, budgets and flight displays are simplified. It is not a reconstruction of historical NASA reliability or appropriations. Full campaign pacing and emotional payoff need playtesting.

## Validation

```powershell
python -m unittest discover -s tests -q
python -m per_aspera --campaign-demo --seed 11
```

The seeded campaign demonstration uses actual commands and public evidence through all nine milestones. It is an example policy, not an autopilot in the player interface.

## Legacy Apollo 9–11 prototype

The original Tkinter game remains available with `python -m per_aspera --legacy`. Loading an old save using `--load` selects that engine automatically. `--demo` remains the old three-mission demonstration. The following material describes that **legacy scenario**, not the modern campaign's budget or controls.

A modular Python prototype of evidence-led agency leadership, spanning **Apollo 9 → Apollo 10 → Apollo 11**. You run the programme, set investigation boundaries and respond to staff. Mission Control flies the spacecraft. This is a fictional, historically framed simulation built against the supplied cumulative GDD v7.0—not a reconstruction of actual Apollo decisions or hardware reliability.

## Launch

Use Python **3.11 or newer** with Tkinter installed. No pip packages, browser server, Electron or network service are required.

```powershell
cd "C:\Projects\History of Rocketry"
python -m per_aspera
```

Optional reproducible seed:

```powershell
python -m per_aspera --seed 11
```

Most official Windows Python installers include Tkinter. If a Linux Python installation lacks it, install the distribution's `python3-tk` package. Check availability with `python -m tkinter`. The simulation and tests work without a display or Tkinter; the GUI imports it only when launched.

## First session

1. Start at **Daily briefing**. The in-tray explains the current issue and names the responsible programme director. Its main action leads to the relevant dossier or advances to the next report.
2. **Engineering dossier** contains test proposals, reports, your assessment and hardware-change requests. Test proposals show the question, accountable lead, price and time before authorisation.
3. In **Read findings**, distinguish recorded observations from the named staff assessment. Instrument values are synthetic indices, not failure probabilities. Your own assessment is a working interpretation, not a confirmed diagnosis.
4. **Briefing room** presents the meeting and contextual responses. **Personnel** lets you consult one staff member at a time. **Commission work** gives a manager a spending/time envelope; exceptions return to your in-tray.
5. Return to the briefing to wait for reports, commission independent clearance and authorise a mission. Readiness requirements are shown without treating them as a safety score. Hardware changes require renewed integration and clearance.
6. **Registry** holds searchable decisions and outcomes. **Campaign** contains save/load, seed selection for a new campaign, export and programme closure. **Time** contains six-hour advancement and automatic run/pause.

The clock starts paused. Authorising work does not advance time. Ground running advances six simulated hours per second and pauses when engineering work completes. In flight, the adaptive clock starts automatically and continues until the outcome: critical activity runs slowly and routine coasting accelerates. Location changes and office browsing preserve mission running state.

The 1969 presentation uses paper-coloured documents, typed report text and folder-like navigation. It deliberately avoids simulated paper dragging or animations. Later digital-era workflows are deferred; presentation reads the public briefing and issues commands without changing simulation rules.

### Costs and time

The starting **$1.8 million** is unchanged: an illustrative R&D envelope containing **$1.5m programme allocations** and a **$300k Administrator reserve**, not Apollo's total historical cost. Spending and delays are real constraints; there are no prestige points or arbitrary reputation rewards.

| Action | Funds | Programme time |
|---|---:|---:|
| Instrumented flow comparison | $55,000 | 18 h |
| Thermal calibration | $40,000 | 12 h |
| Mission integration rehearsal | $90,000 | 24 h |
| Crew contingency rehearsal | $35,000 | 18 h |
| Propellant-feed modification | $170,000 | 36 h |
| Instrumentation modification | $85,000 | 18 h |
| Guidance-workload modification | $140,000 | 30 h |
| Independent readiness review | $30,000 | 8 h |
| Mission operations reserve | $100,000 | Profile-dependent |

Different hypotheses, seeds and operating conditions can produce a completed objective and recovery, a return without the objective, crew loss, or a programme ended by the Administrator. These outcomes follow the simulated margins; the game does not force a historical victory or tragedy. A successful Apollo 9 does not prove a configuration safe for Apollo 10 or 11.

## Observe a mission

Use the four location buttons above the shared clock to switch instantly between **Administrator’s office**, **Launch Control Center**, **Mission Control Center** and **Recovery operations**. Switching is free and preserves the running/paused clock. Return to the office at any point; only office decisions can authorise a flight.

LCC and MCC use a full-width observation workspace. **Live observation** holds the camera or map; **Situation & readiness** contains the mission file; **Flight plan** holds the schedule. Drag the horizontal divider to resize the persistent transcript. Supporting tabs preserve the running clock, and the office sidebar returns when you go back to the office. Restart/save are in the Campaign menu. Recovery displays the actual return outcome, including incomplete objectives or crew loss.

**Next report / phase** skips ahead using the same engine; **Run / pause** watches events unfold. New flights use an authoritative second clock. Auto runs the final countdown and liftoff at 2 game seconds per real second, most ascent at 6, and staging at 3. It keeps the early orbit-insertion aftermath at 2 before accelerating routine orbital operations. Checkout begins with two slower hours. Coast/rest uses 2 real seconds per mission hour; stable checkout uses 3.2; other stable operations use 4; other critical phases use 30. Apollo 9’s 86-hour profile targets approximately **14 min 43 s** before interruptions. Select 0.5×, Auto, 2×, 4× or 8×. Unexpected operational reports pause for inspection; ordinary milestones continue. Ground running remains six hours per real second. Location changes consume no time or money.

## Mission briefings, interruptions and launch

Scheduled milestones slow the adaptive clock without pausing. Unexpected controller/crew safety developments pause on an **Observation** report; Flight Control’s response is already in effect. Real delegation or assurance escalations are **Action required** reports linked to the existing office document. Acknowledge/resume explicitly; the pause creates no in-world time to perform emergency repairs or override flight rules. Manual fast-forward also stops at unexpected events.

The **Flight Director** is your primary contact. Choose **Speak to Flight Director** or open the **Flight Director** tab; select a controller and one of five contextual questions, then **Request briefing**. A reusable reading window shows the answer, and the timestamped exchange is saved in the mission transcript. **Mission archive** holds those exchanges and linked mission records. Normal communications append from engine events; important entries are highlighted. Answers use available observations and professional judgement, never hidden fault values.

Before launch, up to three timed messages from the programme director, systems engineer and independent assurance refer to actual campaign records and their contemporary interpretations. **Launch focus** opens automatically for new flights: routine tabs and phase-skipping recede, while the clock, model camera, current communication and transcript stay visible. **Show files** restores the normal workspace at any time. No nominal decision or acknowledgement is required. Final countdown calls, ignition, tower clearance, staging and insertion have distinct engine events. After insertion, the programme director and engineers have a brief human aftermath before routine pacing resumes; their source-linked words persist in personal memories, the transcript and archive. A compact launch-day recollection also appears in the later office briefing. No morale reward or engineering certainty is awarded. Enable optional local synthesized rumble/cues under **Time → Synthesized launch audio**; it defaults off, stops on pause or leaving observation, and uses no historical recordings or speech.

Before launch, a compact readiness digest cites actual campaign records. Authorisation opens LCC: a simulated pad/tracking camera shows ignition, liftoff, pitch and staging. MCC uses a projected ground track and CRT-style numerical board. Both retain a live transcript. Countdown, launch milestones and MET come from the engine; altitude, speed, range and dynamic pressure are explicitly **nominal model estimates**, separate from engineering measurements and controller judgements. The profile uses rounded [NASA Apollo 11 ascent data](https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11d_Ascent_Phase.htm), reused for this slice’s three launches. The camera is a procedural reconstruction, not video. Parking orbit uses a simple circular estimate; unsupported lunar phases show unavailable position rather than an invented trajectory.

Grounded rules give Flight Control and the crew operational safety authority, including independent crew emergency abort. There is no unsafe-continuation order. The Campaign menu’s **Alternate history: Administrator abort authority** option defaults off and can be enabled only during preparation; it never grants manoeuvre control, disables crew safety authority or guarantees recovery.

## Budget papers

**Budget papers** shows the appropriation, account allocations, committed work, settled expenditure, uncommitted funds and a dated transaction register. Authorisations deduct available funds once; completion does not charge again. Programme funding works even when the Administrator reserve is zero.

Engineering, readiness and operations each use their own allocation. Tests and hardware requests show cost, duration, funding source and whether they are optional. Further crew practice is explicitly optional once preparation is documented. The reserve is released only by an explicit reallocation memorandum. Moving uncommitted funds can defer another activity, but cannot defund an authorised contract or cross appropriations.

An unfunded action explains its account shortfall. Choose an affordable scope, defer unstarted work, make a lawful reallocation, record a pending funding request or end the programme. Requests provide no additional money in this prototype; readiness is never waived. The 1 July fiscal-year transition carries no-year funds and commitments forward without replenishment.

The seed-11 demo spends **$1.57m**, leaving **$230k**. Read the [economy audit](docs/ECONOMY_AUDIT.md) for the complete charge catalogue, higher-spending comparisons, current save diagnosis, historical abstractions and balance rationale.

## Save, load and records

- **Save…** writes a named JSON snapshot. **Load…** validates the whole candidate before replacing the running campaign. Invalid or incompatible files leave the current game and original file intact.
- The interface autosaves after successful actions, automatic time advancement and normal window close to `saves/autosave.json`. Launching without `--load` starts a new campaign; it does **not** silently resume or overwrite the autosave until an action is taken. To resume explicitly:

```powershell
python -m per_aspera --load saves/autosave.json
```

- Saves retain active work, meeting context, in-flight phase and the random stream. Equal seed and command sequence produce reproducible outcomes in the same Python/scenario version. Schema-1 saves migrate to the financial ledger without changing their remaining balance; updated scenario definitions still require an explicit migration.
- **Campaign → Export public record…** produces the Administrator's evidence/decision view. It excludes hidden condition magnitudes, private staff traits and RNG state. Ordinary campaign saves contain hidden simulation truth so exact replay is possible; avoid inspecting them if you want to preserve uncertainty.
- **New campaign** first backs up the current one to `saves/before-new-campaign.json` after entering a seed. This fixed backup is replaced on subsequent new campaigns; use Save… for permanent branches of play.

## Headless demonstration and tests

```powershell
python -m per_aspera --demo --seed 11
python -m unittest discover -s tests -v
```

The demo uses agency-visible evidence to choose tests, modifications and independent reviews. Seed 11 completes the Apollo 9/10/11 progression; it is an example policy, not the sole winning path. Tests use separate controlled fixtures for outcome boundaries and safety rules.

```powershell
python -m per_aspera --demo --seed 11 --save saves/demo.json
```

## Structure and design reference

| Path | Responsibility |
|---|---|
| `per_aspera/interruptions.py` | Event classification, deduplication and first-interruption stepping |
| `per_aspera/mission_contact.py` | Bounded, evidence-based controller question library |
| `per_aspera/continuity.py` | Launch references grounded in actual campaign records |
| `per_aspera/observation.py` | Read-only location presentations and shared UI clock stepping |
| `per_aspera/finance.py` | Purpose-restricted allocations, reconciliation, migration and fiscal-year ledger rules |
| `per_aspera/model.py` | State, staff, jobs, evidence and event records |
| `per_aspera/engine.py` | Commands, deterministic clock, engineering, delegation, meetings, mission phases and public briefing |
| `per_aspera/persistence.py` | Validated, versioned, atomic JSON snapshots |
| `per_aspera/data/` | Data-driven missions, component mechanisms, staff, test methods and incidental profiles |
| `per_aspera/presentation.py` | Plain-language guidance derived from public evidence only |
| `per_aspera/ui.py` | Replaceable native Tkinter interface; no authority to manufacture outcomes |
| `per_aspera/demo.py` | Example headless policy using observed evidence |
| `tests/test_simulation.py` | Domain and persistence regression checks |

Read [the phased plan](docs/IMPLEMENTATION_PLAN.md) and [the maintained feature-coverage ledger](docs/FEATURE_COVERAGE.md) for exact scope, risks, simplifications and deferred GDD features. The supplied PDF is referenced, not copied into the project. Later confirmed addenda supersede conflicting older draft examples.

This prototype defers full orbital physics, individual astronaut careers, facilities/contractors, political oversight, 3D office, succession and multi-decade epilogues. It preserves their architectural boundaries and records without pretending to implement them.


## Restart the current save

The **Campaign → Restart save…** command starts a fresh campaign with the current seed. It pauses the clock and asks before resetting. The previous run is saved as `before-restart.json` beside the active autosave; each restart replaces that fixed backup, so use Save campaign first for permanent branches. Backup or reset-save failure leaves the live campaign intact. Restarting is a deliberate new playthrough, not a refund within an existing campaign.


The presentation uses 50 ms Tk callbacks and persistent Canvas items. New-flight time advances in whole seconds; launch events fire exactly once at defined boundaries, and a ten-minute trace samples model estimates every five game seconds. Saving preserves the engine second and transcript. Display speed and unsimulated fractional time remain session-only. Legacy active flights retain their hourly clock until the next launch. Engineering outcomes still use the existing hourly operational boundaries; this update adds no new launch-failure physics, random draws, resource costs or executive flight controls.


## Build Windows packages

On Windows with Python 3.12 and Inno Setup 6 installed:

```powershell
python -m pip install -r requirements-build.txt
python tools/build_windows.py
python tools/smoke_windows.py --exe dist/PerAspera-Portable.exe --installer dist/PerAspera-Setup.exe
```

The dev workflow runs all tests, builds both executables, tests installation/startup/uninstall with temporary data and uploads hashes plus the source commit. Release candidates are explicitly published from that verified commit; a dev push does not overwrite a published release or mark a candidate as the stable latest release.
