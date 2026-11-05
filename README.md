# Project Vanguard

A management game about the American space programme, from the first sounding rockets in 1946 to the first American in space. Develop rockets, manage research and a launch site, and guide the programme through its early milestones.

The game is built with HTML, CSS, and JavaScript ES modules. It has no build step and can run as a desktop app or in a browser.

## Get started

You’ll need Node.js 18 or newer.

```bash
npm install
npm start
```

`npm start` opens the game in an Electron desktop window. To run it in a browser, serve the project folder with a local web server and open the served page.

## Development commands

| Command | What it does |
|---|---|
| `npm test` | Runs the rule tests in `tests/`. |
| `npm run acceptance` | Replays bot scenarios that previously stalled and checks save/load behavior. |
| `npm run balance` | Runs a seeded, headless playthrough to check game balance. You can pass run count and maximum minutes: `node tools/balance.mjs [runs] [maxMinutes]`. |
| `npm run dist` | Builds a Windows installer and portable executable in `dist/` (run on Windows). |

Pushes to `main` build Windows packages through GitHub Actions. Pushes and pull requests to `dev` run the test and acceptance checks with Node 22; they do not package or publish the game.

## Project structure

The game code is under `js/`. `js/main.js` starts the interface and game clock.

| Directory | Purpose |
|---|---|
| `js/core/` | Game state, saves and loads, log, and shared helpers. |
| `js/data/` | Research, rocket, failure, launch-site, history, Mercury, and other game data. |
| `js/rules/` | Game rules, player actions, simulation, and flight logic. |
| `js/ui/` | Screen rendering and input handling. |
| `tests/` | Rule tests. |
| `tools/` | Balance and acceptance-test scripts. |
| `desktop/` | Electron entry point and desktop app configuration. |

### Where to make common changes

| To change… | Start with… |
|---|---|
| Research packages and milestones | `js/data/research.js` |
| Research explanations and confidence lines | `js/data/research-notes.js` |
| Rocket designs, costs, flaws, and cures | `js/data/programmes.js` |
| Propellants, payloads, and pitch programs | `js/data/launch.js` |
| Failure modes, symptoms, and fixes | `js/data/failures.js` |
| Facilities, launch pads, crews, and site upkeep | `js/data/launch-site.js` |
| Historical events, eras, and directives | `js/data/history.js` |
| Mercury and Gemini missions | `js/data/mercury.js` |
| Astronauts and training | `js/data/astronauts.js` |
| Core team members | `js/data/team.js` |
| Economy rules | `js/rules/economy.js` |
| Flight behavior and physics | `js/rules/flight.js` |

Other rules are split by responsibility across `js/rules/`; interface components live in `js/ui/`. Files include comments describing their contents.

## Save data

Saved games use short field names in the game state for compatibility with existing saves. Renaming a saved field can make older saves unreadable. Per-programme research, blueprints, and fixes are associated with the programme in focus; use the existing programme helpers when working with that state. Temporary runtime objects, such as flights and missions, use descriptive full names.
