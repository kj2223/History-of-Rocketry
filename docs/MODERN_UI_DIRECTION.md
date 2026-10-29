# Modern Administrator workspace

29 October 2026. Confirmed direction: pause historical UI evolution and design a modern, clean, readable interface before building the expanded campaign.

**Status:** implemented as the default browser-based interface for the expanded 1961–1969 Python campaign. The retained Tkinter scenario and its saves are separate. Historical content remains dated and contextual; the interface no longer needs to imitate the equipment of each era.

## Information hierarchy

1. **Overview:** the most important matter requiring attention, its owner, why it matters and the next action. Keep secondary matters compact and distinguish information-only reports from decisions.
2. **Decision workspace:** one proposal, with evidence, staff views and cost/schedule available in context. Show consequences and funding source before authorisation. Supporting detail opens on request.
3. **Programme:** workstreams, current dependencies, responsibility and milestones. Avoid global readiness percentages that imply certainty or dense tables of every subsystem on the overview.
4. **People:** persistent responsibility, expertise, current assessments and relevant shared experience. Avoid friendship scores and personnel-card walls on unrelated screens.
5. **Funding:** allocation, committed work, paid expenditure, available funds and separate reserve. Clearly distinguish authorising a commitment from paying it.
6. **Records:** connect decisions, rationale, evidence, revisions and later outcomes. Keep full history available without making it the default briefing.
7. **Mission observation:** dominant camera/trajectory presentation, a few relevant readouts, current phase, mission clock, transcript and Flight Director contact. Office management panels should not compete for launch-screen space.

## Shared behaviour

- A stable navigation and terminology system across the campaign; no era-dependent relearning.
- Restrained colour, clear typography and spacing. Follow the application's light/dark appearance; do not use decorative paper, CRT frames or period fonts as the information hierarchy.
- Disagreement and uncertainty remain visible in context. Distinguish measurements, model estimates, staff interpretation, evidence gaps and confirmed outcomes.
- Each matter brings its responsible people and relevant actions together. Avoid a separate generic action panel.
- Date, pause/run state and next-report advancement belong in consistent shared chrome in the playable implementation; save/load, random seed and other technical settings remain secondary.
- Reflow grids and wrap controls at narrower widths. Do not stretch a fixed display and scale type independently. Keep essential controls accessible without hover.
- In implementation, persistent views and incremental mission updates must preserve selections, focus and scroll position. The interactive concept uses sample navigation, not the game engine.

## Reviewable concept

The concept includes Overview, a contextual architecture-study decision, Programme, People, Funding, Records and a separate Apollo 9 observation example. Navigation, context tabs, sample authorisation, resource reconciliation, responsibility assignment and controller context can be explored locally. Example budgets and dialogue are clearly illustrative, not new historical or simulation claims.

Design acceptance: a player can identify what needs attention, find the supporting evidence and differing views, understand cost and schedule, and make a decision without searching unrelated pages. Observation should feel spacious and watchable. Further detail should remain available when it becomes relevant.

Historical UI progression is paused, not silently implemented. Framework selection and integration into the 1961 campaign follow review of this design.
