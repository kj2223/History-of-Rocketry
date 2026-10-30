// LEAD POSTS: the research leads you hire as the programme grows (GDD v7.2 §6, middle-path stages 5 and 6). Each post is offered
// from two named candidates, one quicker and dearer than the other, and a hired lead draws a salary every funding cycle. A lead
// runs the research lane of their area: the shared areas' lanes (rules/shared-research.js), and the development lanes of every
// rocket's four systems (rules/lanes.js), which the station engineers lead only until a development lead is appointed. The
// station engineers keep their consoles: FIDO still sets the flight limits, the aero/thermal lead owns the development.
// The keys and candidate ids are stored in saves.
//   title, opens: 'chen' (once Alice Chen joins) or 'nasa' (once NASA is established)
//   candidates: [{ id, name, note, pace: lane speed (1 is a station engineer's), salary: $ per funding cycle }]
export const LEAD_POSTS = {
  p: {
    title: 'Propulsion Development Lead', opens: 'chen', candidates: [
      { id: 'mercer', name: 'James Mercer', note: 'Ran engine test cells at Reaction Motors. Pushes chamber pressure, and the schedule.', pace: 1.3, salary: 700 },
      { id: 'ward', name: 'Helen Ward', note: 'Combustion specialist from the Jet Propulsion Laboratory. Methodical.', pace: 1.1, salary: 400 },
    ],
  },
  s: {
    title: 'Structures Development Lead', opens: 'chen', candidates: [
      { id: 'kowalski', name: 'Frank Kowalski', note: 'Airframe stress man from Convair. Knows thin tanks better than anyone.', pace: 1.3, salary: 650 },
      { id: 'novak', name: 'Irene Novak', note: 'Welding and materials engineer from the Navy yards. Careful.', pace: 1.1, salary: 350 },
    ],
  },
  i: {
    title: 'Instrumentation Development Lead', opens: 'chen', candidates: [
      { id: 'park', name: 'Leonard Park', note: 'Telemetry designer from the Naval Research Laboratory. Fast with new circuits.', pace: 1.3, salary: 650 },
      { id: 'hale', name: 'Dorothy Hale', note: 'Instrument engineer from the Bureau of Standards. Exacting.', pace: 1.1, salary: 350 },
    ],
  },
  a: {
    title: 'Aero/Thermal Development Lead', opens: 'chen', candidates: [
      { id: 'lindqvist', name: 'Dr Victor Lindqvist', note: 'Wind-tunnel man from NACA Ames. Quick to a shape that works.', pace: 1.3, salary: 700 },
      { id: 'mercado', name: 'Ann Mercado', note: 'Heat-transfer engineer from the Army ballistic missile range. Thorough.', pace: 1.1, salary: 400 },
    ],
  },
  r: {
    title: 'Payloads & Recovery Lead', opens: 'chen', candidates: [
      { id: 'hartley', name: 'Dr Paul Hartley', note: 'Built instruments for the V-2 upper-air panel. Careful and thorough.', pace: .9, salary: 300 },
      { id: 'okafor', name: 'Grace Okafor', note: 'Ran parachute recovery trials at El Centro. Quick, and she knows it.', pace: 1.2, salary: 600 },
    ],
  },
  c: {
    title: 'Spacecraft Lead', opens: 'nasa', candidates: [
      { id: 'hayes', name: 'Rebecca Hayes', note: 'Came over from the NACA capsule studies. Drives a team hard.', pace: 1.2, salary: 1100 },
      { id: 'brandt', name: 'Walter Brandt', note: 'Aircraft systems engineer from the X-15 programme. Steady.', pace: 1, salary: 700 },
    ],
  },
  e: {
    title: 'Escape & Man-Rating Lead', opens: 'nasa', candidates: [
      { id: 'mchen', name: 'Dr Maya Chen', note: 'Human-factors researcher from the Aeromedical Laboratory. Fast on anything with a person in it.', pace: 1.2, salary: 1000 },
      { id: 'ortiz', name: 'Dr Lila Ortiz', note: 'Reliability and assurance engineer. Steady, and signs nothing she has not seen tested.', pace: 1, salary: 650 },
    ],
  },
};
