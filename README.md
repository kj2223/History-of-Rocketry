# Ad Astra

**Build the programme that takes America from the desert test range to the Moon.**

*Ad Astra* is a historical side-scrolling game about the American space programme. Begin as a junior engineer at White Sands in 1945 and work your way to Flight Director. Once you take the Houston shift, you stay on console from Gemini through Apollo, Skylab, the Shuttle, the space station, the first commercial crew and Artemis, to the return to the Moon at the lunar south pole. A separate management mode is in design.

This is not just a story about rockets. It is a story about the people on the ground who have to make them work.

## From text-led game to a 2D world

The project has grown from a text-based experience into a playable, side-on 2D view of the launch site. Instead of encountering the whole campaign through text alone, you can now move through the range, see the buildings and crew, and choose where to go: click to walk, enter a building to work at its rooms and consoles, or approach a person to talk.

The 2D presentation makes the work feel tangible—the rocket moves from the hangar to the stand and tower, the crew goes about its jobs, and the countdown unfolds around you. Text remains an important part of the game: conversations, mission updates, notebook entries, and the decisions themselves carry the historical detail and consequences. The new view brings that narrative to life rather than replacing it.

## What you’ll do

- **Learn the hardware by working with it.** Inspect rockets, investigate warning signs, plan tests, and decide what to fix before the next attempt.
- **Run the range.** Follow static firings, rollout, launch countdowns, tracking, recovery, and post-flight reviews.
- **Make consequential calls.** Balance caution, evidence, budget, and schedule. The fixes you adopt—and the trust you earn—carry forward.
- **Grow with the programme.** Take on new responsibilities as the campaign advances from early test vehicles to crewed spaceflight.
- **Work the missions.** From Mercury to Artemis, take your place in the control room and respond to the changing flight plan. Crews can be lost, and nothing is scripted: the faults are hidden in the hardware, not written into the story.
- **Keep your own record.** The notebook, campaign record, and autosaved checkpoints help you follow what happened and pick up where you left off.

Some outcomes and technical problems are simulated, so the campaign is about more than replaying a fixed sequence: you have to interpret what the evidence is telling you and decide what to do next.

## How to play

- **Click the ground** to walk to a location.
- **Click a building** to enter it; **click a person** to walk over and talk.
- **Drag the site** or use the **mouse wheel** to look along the range without walking.
- **A / D** or **← / →** walks. Hold **Shift** with those keys to pan the view.
- **Space** pauses or resumes. **1**, **2**, and **3** select normal, fast, and fastest simulation speed.
- Press **N** to open your notebook. **Esc** closes the notebook or current room.

The top bar also provides pause, simulation-speed, notebook, and game options. Game progress is saved automatically in the browser or desktop app.

## Play

### Download (Windows)

The newest build is always on the [releases page](https://github.com/kj2223/History-of-Rocketry/releases/latest): `ProjectVanguard-Setup.exe` installs the game, `ProjectVanguard-Portable.exe` runs without installing. The builds are unsigned, so Windows SmartScreen warns on first run (More info, then Run anyway). On first launch, Ad Astra copies the old Project Vanguard desktop save folder if no Ad Astra save folder exists. The game can resume saves in the `per-aspera` format at content version 3.

### In a browser

Serve the repository with any local static HTTP server, then open the address it provides. For example, with Python installed:

```sh
python -m http.server 8000
```

Then visit <http://localhost:8000>. JavaScript must be enabled.

### Desktop app (Electron)

Requires Node.js and npm:

```sh
npm install
npm start
```

The desktop app is built with Electron. On Windows, create distributable builds with:

```sh
npm run dist
```

## Development

Run the test suite with:

```sh
npm test
```

### Playtest log

While you play, the game keeps a log of the session so bugs can be found without describing them: the beats and scenes
you went through, your clicks, keys and decisions, the faults each round rolled and how it came out, the fixes adopted,
the radio-loop calls, both clocks (the game's and the mission's) at each turn, every caught error, the window size and
the build. It is bounded (the newest 2,500 events, 400 calls, 100 distinct errors, 40 marks; well under a megabyte),
stays on your computer, and is kept apart from the save, so it never changes or blocks one.

- **F8** marks a problem: the moment, a screenshot and a copy of the save go into the log.
- The desktop app writes it to `%APPDATA%\Ad Astra\playtest`: `log.json`, `save.json` (the latest checkpoint) and
  `marks\`. The **Playtest** menu (press Alt to show the menu bar) opens that folder, starts a fresh log (the old one is
  kept as `log-previous.json`), and switches the log off or on.
- In a browser the log is kept in localStorage under `pa-playtest-log`. Seeded replays (`?seed=`) are not logged.

To read one back:

```sh
npm run playtest-report -- "%APPDATA%\Ad Astra\playtest"
```

It prints the builds and sessions, errors with where they happened, each F8 mark with the 25 entries that led up to it,
the rounds and outcomes, any mismatch between a cruise's clock and the game's, and the last 60 entries.

## The long view

From the first uncertain firings at White Sands to the decisions made in Mission Control, *Ad Astra* is about earning progress one test at a time.
