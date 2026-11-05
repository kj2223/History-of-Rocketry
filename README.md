# Project Vanguard

**The space race is on. Can you get America to orbit—and bring its first astronaut home?**

Project Vanguard is a historical space-programme management game set in the dawn of the Space Age. Starting with sounding rockets in 1946, build the people, technology, rockets, and launch facilities needed to reach orbit and carry the first American into space.

Every launch is a test of engineering and judgement. Research new systems, choose what to build, prepare your launch site, and decide when a vehicle is ready to fly. Setbacks can cost time, money, and confidence—but they can also reveal what your engineers need to fix before the next attempt.

## Lead the programme

- **Build a rocket programme.** Develop launch vehicles, commission research, and turn proven designs into production hardware.
- **Make every launch count.** Plan trajectories, prepare the pad and crew, and follow each flight as it unfolds.
- **Manage risk and resources.** Work within NASA's budget, balance competing priorities, and learn from failures before they become repeat problems.
- **Shape the people behind the mission.** Grow your engineering and launch teams, build experience, and select and train astronauts.
- **Race through history.** Respond to directives and milestones as the programme advances from early rockets toward Mercury—and beyond.

## Start playing

You’ll need Node.js 18 or newer.

```bash
npm install
npm start
```

The game opens in its own desktop window using Electron. You can also run it in a browser by serving the project folder with a local web server and opening the served page.

## For developers

This project uses HTML, CSS, and JavaScript ES modules, with no application build step.

| Command | Purpose |
|---|---|
| `npm test` | Run the rule tests in `tests/`. |
| `npm run acceptance` | Replay bot scenarios that previously stalled and check save/load behavior. |
| `npm run balance` | Run seeded, headless playthroughs to check game balance. Optional arguments: `node tools/balance.mjs [runs] [maxMinutes]`. |
| `npm run dist` | Build a Windows installer and portable executable in `dist/` (run on Windows). |

Pushes to `main` build Windows packages through GitHub Actions. Pushes and pull requests to `dev` run the tests and acceptance checks with Node 22; they do not package or publish the game.

### Project layout

`js/main.js` starts the interface and game clock. Game code is organized by responsibility:

| Directory | Contents |
|---|---|
| `js/core/` | Game state, saves and loads, log, and shared helpers. |
| `js/data/` | Research, rocket, failure, launch-site, history, Mercury, and other game data. |
| `js/rules/` | Game rules, player actions, simulation, and flight logic. |
| `js/ui/` | Screen rendering and input handling. |
| `tests/` | Rule tests. |
| `tools/` | Balance and acceptance-test scripts. |
| `desktop/` | Electron entry point and desktop app configuration. |

For common changes, start with the corresponding file in `js/data/`—for example, `research.js`, `programmes.js`, `launch.js`, `failures.js`, `launch-site.js`, `history.js`, `mercury.js`, `astronauts.js`, or `team.js`. Economy rules are in `js/rules/economy.js`, and flight behavior is in `js/rules/flight.js`. Other rules and interface components are split across `js/rules/` and `js/ui/`; files include comments describing their contents.

### Save compatibility

Saved games use short field names in the game state for compatibility with existing saves. Renaming a saved field can make older saves unreadable. Research, blueprints, and fixes are kept per rocket programme; use the existing programme helpers when working with that state. Temporary runtime objects, such as flights and missions, use descriptive full names.
