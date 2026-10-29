# White Sands observation model

## Implemented

The generic phase animation has been replaced by a projected bunker sightline and a separate ground-radar plotting view. View switches and magnification are presentation controls: they cannot alter flight events, money, seed, pause state or operational authority. Persistent widgets retain transcript position and the selected briefing question.

The model integrates downrange and vertical motion at quarter-second resolution, with constant gravity, discrete motor burns, coast and ground impact. A deterministic motor scale is fitted to the flight's admitted altitude envelope. Tiny Tim boost, limited/full WAC sustainer burns, V-2 carrier coast and powered Bumper upper-stage operation have distinct schedules. The existing sampled flight result remains authoritative; an adverse flight terminates powered operation at its authoritative anomaly milestone. This is a coarse envelope model, not an aerodynamic or engine reconstruction, and cannot diagnose a real failure mechanism. No drag, wind, changing mass, Earth curvature or variable gravity is modelled.

New flights privately freeze their motion envelope at range release. This uses a copy of the campaign RNG state, preserving the established campaign RNG stream. Viewing, resampling sensors, pausing and changing display speed do not roll another outcome. Already completed records are not rewritten. Active older saves without a frozen envelope remain loadable and use a deterministic nominal/degraded fallback; their newly displayed geometry is an approximation, not recovered historical data.

The bunker renderer projects apparent elevation and angular size into a fixed observation slit. The vehicle can leave the field of view or become too small to resolve. It does not remain centred, acquire an invented altitude label, or stay visible merely because a phase is active. Magnification is an accessibility/presentation aid, not a claim about installed bunker optics. The approximately 152 m early sightline and 300 m later sightline are representative scenario choices, not a survey of each historical pad.

Radar readings are sampled every five simulated seconds from a station notionally 5 km behind the launcher. They include repeatable range/elevation error, a low-altitude acquisition limit and finite coverage. Prototype coverage limits are 80 km for early rounds and 160 km for later research/staging flights; these are gameplay abstractions, not SCR-584 performance specifications. Failed reception produces no track. Loss of coverage retains a timestamped last fix rather than continuing an invisible perfect trajectory. The screen is a simplified plotting board of slant range against elevation, not a reproduction of a particular radar scope. Derived height uses flat-earth geometry and is labelled as such.

Flight reports and archives retain those radar samples. The highest sampled height is explicitly distinguished from confirmed apogee. With no validated radar solution, the report does not invent an altitude from the private flight envelope. The existing observation-based scoped objectives, staff assessments and player interpretation remain separate from underlying reality.

## Cached 3D launch film direction — proposed, not implemented

The player's suggested next visual step is a locally rendered 3D launch film, prepared while programme work is running and played cheaply in the observation window. The current trajectory provides a common motion source for that renderer; it must not invent a separate flight.

- Reusable bunker, terrain, tower, vehicle and lighting assets can be prepared during research. A flight-specific film is valid only after configuration and the admitted flight are frozen; before then it is a disposable candidate, not an outcome commitment.
- Cache identity must include configuration, motion/model version, vehicle, camera and visual asset versions. Any relevant change invalidates the candidate. Background jobs must be bounded/cancellable and must not change simulation time or use the campaign RNG.
- Frames require simulation timestamps. Playback seeks to the authoritative mission clock across pauses, speed changes, anomalies and reloads; video end cannot complete a mission or override the range team.
- Optical imagery and radar must share one trajectory. The film cannot show continued nominal flight after an authoritative anomaly or reveal future events while the simulation is paused.
- Pre-rendering shifts compute earlier and makes playback cheap; it does not eliminate rendering cost. File size, render duration and fallback behaviour need measurement before selecting a renderer or adding a dependency. The current bunker/radar display remains usable without a render job.

No 3D movie generator or new rendering dependency is included in this update.

## Historical references

[The contemporary WAC Corporal account held by JPL](https://jplwater.nasa.gov/docs/NAS710673.pdf) describes a protected control house approximately 500 feet from the tower and distributed camera/radar instrumentation. [The White Sands V-2 facilities survey](https://wsmrmuseum.com/wp-content/uploads/2022/02/HAER-V-2.pdf) describes the later concrete blockhouse, observation slits and WAC launch platform. [White Sands radar history](https://wsmrmuseum.com/2026/10/02/missile-park-2/48/) describes station relocation and tracking limitations. These support the observation experience without implying a perfect track on every flight.
