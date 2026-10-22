# Project Vanguard

A browser game about the American space programme, from sounding rockets in 1946 to the first American in space. Plain HTML, CSS and ES modules: no build step.

**Run it:** serve the folder (for example `python3 -m http.server`) and open `index.html`. The game saves to the browser's localStorage every ten seconds.

**Check balance:** `node tools/balance.mjs [runs] [maxMinutes]` (or `npm run balance`) plays the game headlessly with a seeded bot: Phase One to orbit, then Phase Two Section 1 to the first American in space (`tools/mercury-bot.mjs`). It prints pacing per run: when each directive was met, how many flights and missions failed, and which firsts went to the Soviets. It is deterministic, so diff its output before and after a change. `SEED=n TRACE=1` prints one line per launch and mission for run n; `PHASE_ONE_ONLY=1` stops at orbit.

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
| Rockets: design figures, costs, propellants, flaws | `data/programmes.js` |
| Propellants and payloads | `data/launch.js` |
| Failure modes, symptoms and fixes | `data/failures.js` |
| Facilities, control rooms, launch-crew stations | `data/launch-site.js` |
| Directives, eras, historical firsts, Soviet dates, calendar speed | `data/history.js` |
| Mercury missions, directives, in-flight decisions, office decisions | `data/mercury.js` |
| Astronaut names, skills, training focus | `data/astronauts.js` |
| Grants, payroll, reputation losses | `rules/economy.js` |

### The rules, file by file

| File | Covers |
|---|---|
| `rules/game.js` | The tick, the calendar catch-up, hiring staff, the starting position, run-log snapshots |
| `rules/research.js` | What can be commissioned, breakthroughs, earmarks, finishing and confirming packages |
| `rules/programs.js` | Starting a rocket programme, its hidden true design and flaws, maturity |
| `rules/design.js` | What an airframe can do, launch quotes, recovery odds |
| `rules/production.js` | Blueprint drafts, line learning, airframe and retrofit costs |
| `rules/factory.js` | Build teams, ordering, publishing blueprints, the factory queue |
| `rules/jobs.js` | Engineering-team jobs: investigations, fixes, design reviews, retrofits |
| `rules/knowledge.js` | What the engineers know about each system |
| `rules/launch-site.js` | Building facilities, hiring launch crew, the go/no-go poll, pad troubleshooting, ground tests |
| `rules/flight.js` | Flight physics, failures, instrument readings, flight results |
| `rules/campaign.js` | Launch campaigns: targets, deadlines, budgets and the launch director's experience |
| `rules/auto.js` | The launch director flying the running campaign |
| `rules/race.js` | American firsts, Soviet events, intelligence, forming NASA |
| `rules/manrate.js` | Man-rating boosters for crews |
| `rules/mercury.js` | Phase Two state, mission requirements, boosters for capsules, who may fly, capsules, directives |
| `rules/mission.js` | A Mercury mission in flight: events, decisions, transcript, outcome |
| `rules/astronauts.js` | The candidate pool, skill estimates, selection, training |
| `rules/astronaut-office.js` | Selection testing, office decisions, the chimpanzee colony, the election |

### The UI, file by file

| File | Draws |
|---|---|
| `ui/screen.js` | The header, era theme, directive panel, tabs, and `render()` for the whole page |
| `ui/input.js` | Every click and select: `data-a` on a button names its action |
| `ui/launch-panel.js` | The Launch tab: control room and launch form |
| `ui/launch-view.js` | The full-screen countdown, poll, flight instruments, Mercury flights and transcript |
| `ui/control-room.js` | The control-room and instrument SVGs |
| `ui/design-bureau.js` | The Design Bureau tab and incident cards |
| `ui/hangar.js` | Hangar & Base: blueprints, the factory queue, airframes, facilities |
| `ui/personnel.js` | Personnel: teams, specialists, launch crew |
| `ui/race-and-summaries.js` | The race panel, the Phase One summary, the run log |
| `ui/mercury-panels.js` | The Astronaut Office, mission planner, man-rating board, Mercury overlays |

## The save format

The fields of `S` keep their short names (`S.b` for the budget, `S.pk` for finished packages and so on) because they are what existing saves contain. Renaming one would break saves. `core/state.js` explains every field at the top; `rules/mercury.js` does the same for the Phase Two state `S.p2`.

Each rocket programme keeps its own research, blueprint and fixes. `S.pk`, `S.bp`, `S.fix` and the other per-programme fields always show the programme in focus (`S.cur`). Use `withProgramme(kind, fn)` to work on another one.

Runtime objects that are never saved, such as a flight, a mission or a launch quote, use full names.
