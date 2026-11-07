# Per Aspera

**Build the programme that takes America from the desert test range to the Moon.**

*Per Aspera* is a historical rocket-programme management game set in the early American space age. Begin as a junior engineer at White Sands in 1945, where every test is a lesson and every launch is a risk. Follow the programme as it grows through the early rockets, Mercury, Gemini, and Apollo—making the calls that shape the hardware, the schedule, and your career.

This is not just a story about rockets. It is a story about the people on the ground who have to make them work.

## From text-led game to a 2D world

The project has grown from a text-based experience into a playable, side-on 2D view of the launch site. Instead of encountering the whole campaign through text alone, you can now move through the range, see the buildings and crew, and choose where to go: click to walk, enter a building to work at its rooms and consoles, or approach a person to talk.

The 2D presentation makes the work feel tangible—the rocket moves from the hangar to the stand and tower, the crew goes about its jobs, and the countdown unfolds around you. Text remains an important part of the game: conversations, mission updates, notebook entries, and the decisions themselves carry the historical detail and consequences. The new view brings that narrative to life rather than replacing it.

## What you’ll do

- **Learn the hardware by working with it.** Inspect rockets, investigate warning signs, plan tests, and decide what to fix before the next attempt.
- **Run the range.** Follow static firings, rollout, launch countdowns, tracking, recovery, and post-flight reviews.
- **Make consequential calls.** Balance caution, evidence, budget, and schedule. The fixes you adopt—and the trust you earn—carry forward.
- **Grow with the programme.** Take on new responsibilities as the campaign advances from early test vehicles to crewed spaceflight.
- **Work the missions.** At the Mercury, Gemini, and Apollo stages, take your place in the control room and respond to the changing flight plan.
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

## The long view

From the first uncertain firings at White Sands to the decisions made in Mission Control, *Per Aspera* is about earning progress one test at a time. If you enjoy history, thoughtful management, and stories where the details matter, step onto the range and help write the next chapter of rocketry.
