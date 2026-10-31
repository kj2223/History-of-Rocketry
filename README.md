# Project Vanguard

A browser game about the American space programme, from sounding rockets in 1946 to the first American in space. Plain HTML, CSS and ES modules: no build step.

**Run it:** `npm install` once, then `npm start` opens the game in its own desktop window (Electron, set up in `desktop/main.js`). It still runs in a browser too: serve the folder (for example `python3 -m http.server`) and open `index.html`. The game saves to localStorage every ten seconds; the desktop window and the browser keep separate saves.

**Build for testers:** `npm run dist` builds a Windows installer and a portable .exe into `dist/` (run it on Windows). Every push to `dev` also builds them on GitHub (`.github/workflows/windows-build.yml`) and publishes a numbered release (v0.1.1, v0.1.2, …); change `version` in `package.json` to 0.2.0 to start the v0.2 series. The newest build is always at `releases/latest/download/ProjectVanguard-Setup.exe` (or `-Portable.exe`), and the game's title bar shows its version. The builds are unsigned: on first run Windows SmartScreen says it protected your PC; click **More info**, then **Run anyway**.

**Check balance:** `node tools/balance.mjs [runs] [maxMinutes]` (or `npm run balance`) plays the game headlessly with a seeded bot: Phase One to orbit, then Phase Two: Section 1 to the first American in space, Section 2 through orbital Mercury and Gemini (`tools/mercury-bot.mjs`). It prints pacing per run: when each directive was met, how many flights and missions failed, and which firsts went to the Soviets. It is deterministic, so diff its output before and after a change. `SEED=n TRACE=1` prints one line per launch and mission for run n (`SEED=5,7` plays several); `PHASE_ONE_ONLY=1` stops at orbit. The last line sums up the medians and names any stall (a stage reached but never finished); a stall makes the bot exit with an error.

**Check for dead ends:** `npm run acceptance` replays the bot games that once stalled (`tools/acceptance.mjs`) and fails if any still does. It takes about half a minute.

**Run the tests:** `npm test` runs the rule tests in `tests/` (Node 18 or newer).

## Where things are

The code is in four layers. Each file opens with a comment saying what it holds.

| Folder | What it holds | Touches the page? |
|---|---|---|
| `js/core/` | The game state `S`, saving and loading, the log, small helpers | No |
| `js/data/` | Tables of content and tuning numbers: research, rockets, failures, the launch site, history, Mercury | No |
| `js/rules/` | How the game works: every player action and the once-per-second tick | No |
| `js/ui/` | Drawing the panels and handling clicks | Yes |

`js/main.js` starts the UI and runs the clock.

### To change a number or some text

| You want to change | Look in |
|---|---|
| Research packages and milestones (cost, time, effects) | `data/research.js` |
| What the R&D desk says about a package (explainers, the engineers' confidence lines) | `data/research-notes.js` |
| Rockets: design figures, costs, propellants, flaws | `data/programmes.js` |
| Propellants (sea-level and vacuum Isp), payloads and pitch programs | `data/launch.js` |
| Engine start and tail-off, residual propellant, drag through the sound barrier, gravity-turn steering, staging delays | the constants above `step()` in `rules/flight.js` |
| Failure modes, symptoms and fixes | `data/failures.js` |
| Facilities, launch pads, control rooms, launch-crew stations, trajectory analysts; construction crews, build days, upkeep and pad turnaround (`SITE`) | `data/launch-site.js` |
| Directives, eras, historical firsts, Soviet dates, calendar speed | `data/history.js` |
| Mercury and Gemini missions, directives, in-flight decisions, office decisions | `data/mercury.js` |
| Astronaut names, skills, training focus | `data/astronauts.js` |
| The core team: names, roles, specialities | `data/team.js` |
| Grants, payroll, reputation losses | `rules/economy.js` |

### The rules, file by file

| File | Covers |
|---|---|
| `rules/game.js` | The tick, the calendar catch-up, hiring staff, the starting position, run-log snapshots |
| `rules/research.js` | What can be commissioned, breakthroughs, earmarks, crash programmes, finishing and confirming packages |
| `rules/programs.js` | Starting a rocket programme, its hidden true design and flaws, maturity |
| `rules/design.js` | What an airframe can do, launch quotes, recovery odds |
| `rules/production.js` | Blueprint drafts, line learning, airframe and retrofit costs |
| `rules/factory.js` | Build teams, ordering, publishing blueprints, the factory queue |
| `rules/jobs.js` | Engineering-team jobs: investigations, fixes, design reviews, retrofits |
| `rules/knowledge.js` | What the engineers know about each system |
| `rules/launch-site.js` | Building facilities, hiring launch crew, the go/no-go poll, pad troubleshooting, ground tests |
| `rules/budget.js` | NASA's yearly budget: the appropriation, the request, what Congress grants, the carry-over and quiet spells |
| `rules/site.js` | The site from NASA on: construction by contractor crews, upkeep, mothballing, launch pads and their turnaround |
| `rules/flight.js` | Flight physics in tenths of a second (thrust rising with altitude, Mach drag, the gravity turn, staging, the flight's milestones), failures, instrument readings, flight results |
| `rules/trajectory.js` | The trajectory team: hiring analysts, goals, and the search for the best flight plan |
| `rules/campaign.js` | Launch campaigns: targets, deadlines, budgets and the launch director's experience |
| `rules/auto.js` | The launch director flying the running campaign |
| `rules/team.js` | The core team's record (Ellis, Vega, Morgan) and what they say after failures and in records analyses |
| `rules/race.js` | American firsts, Soviet events, intelligence, forming NASA |
| `rules/manrate.js` | Man-rating boosters for crews (Titan II also needs its pogo cured) |
| `rules/mercury.js` | Phase Two state, mission requirements, boosters for capsules, who may fly, capsules, directives, opening Gemini |
| `rules/mission.js` | A Mercury or Gemini mission in flight: events, decisions, transcript, outcome |
| `rules/astronauts.js` | The candidate pool, skill estimates, selection, training, the second group |
| `rules/astronaut-office.js` | Selection testing, office decisions, the chimpanzee colony, the election |

### The UI, file by file

| File | Draws |
|---|---|
| `index.html` | The one fixed screen, styled as a small operating system: the app rail, the top bar, and one app at a time (Mail, Watch, Research, Hangar, Site, People, Astronauts) |
| `ui/screen.js` | The top bar, era banners, the directive message, switching apps, and `render()` for the whole page |
| `ui/mail.js` | Mail, the home screen: the inbox built from the game state, the open message, and the work in your team's hands |
| `ui/input.js` | Every click and select: `data-a` on a button names its action |
| `ui/launch-panel.js` | The control-room picture and the launch form |
| `ui/launch-view.js` | The pad under the plotting board: countdown, poll, the mission clock strip, Mercury flights and transcript |
| `ui/plot.js` | The plotting board: the flight's altitude over distance downrange, FIDO's predicted arc, and the directive |
| `ui/trajectory.js` | The trajectory panel beside the plotting board: launcher elevation, pitch program, upper stage aim, the prediction and the team's best plan |
| `ui/consoles.js` | One live tile per launch-crew station: readout, gauge, what it is doing, its last call |
| `ui/control-room.js` | The control-room picture |
| `ui/design-bureau.js` | The R&D desk: research columns and the dossier under them, the rocket programme, the engineering file, incidents |
| `ui/hangar.js` | The Hangar desk: blueprints, the factory queue, airframes |
| `ui/site-plan.js` | The Base desk: the drawn site plan, the selected building, construction and what can be ordered |
| `ui/personnel.js` | The Crew desk: teams, specialists, launch crew |
| `ui/race-and-summaries.js` | The race panel, the Phase One summary, the run log |
| `ui/mercury-panels.js` | The Astronaut Office, mission planner, man-rating board, Mercury overlays |

## The save format

The fields of `S` keep their short names (`S.b` for the budget, `S.pk` for finished packages and so on) because they are what existing saves contain. Renaming one would break saves. `core/state.js` explains every field at the top; `rules/mercury.js` does the same for the Phase Two state `S.p2`.

Each rocket programme keeps its own research, blueprint and fixes. `S.pk`, `S.bp`, `S.fix` and the other per-programme fields always show the programme in focus (`S.cur`). Use `withProgramme(kind, fn)` to work on another one.

Runtime objects that are never saved, such as a flight, a mission or a launch quote, use full names.
