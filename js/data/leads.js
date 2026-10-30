// LEAD POSTS: the research leads you hire as the programme grows (GDD v7.2 §6, middle-path stage 5). Each post is offered from two
// named candidates, one quicker and dearer than the other, and a hired lead draws a salary every funding cycle. A lead runs the
// research lane of their area (rules/shared-research.js for the shared areas). The keys and candidate ids are stored in saves.
//   title, opens: 'chen' (once Alice Chen joins) or 'nasa' (once NASA is established)
//   candidates: [{ id, name, note, pace: lane speed (1 is a station engineer's), salary: $ per funding cycle }]
export const LEAD_POSTS = {
  r: {
    title: 'Payloads & Recovery Lead', opens: 'chen', candidates: [
      { id: 'hartley', name: 'Dr Paul Hartley', note: 'Built instruments for the V-2 upper-air panel. Careful and thorough.', pace: .9, salary: 700 },
      { id: 'okafor', name: 'Grace Okafor', note: 'Ran parachute recovery trials at El Centro. Quick, and she knows it.', pace: 1.2, salary: 1300 },
    ],
  },
  c: {
    title: 'Spacecraft Lead', opens: 'nasa', candidates: [
      { id: 'hayes', name: 'Rebecca Hayes', note: 'Came over from the NACA capsule studies. Drives a team hard.', pace: 1.2, salary: 1800 },
      { id: 'brandt', name: 'Walter Brandt', note: 'Aircraft systems engineer from the X-15 programme. Steady.', pace: 1, salary: 1200 },
    ],
  },
  e: {
    title: 'Escape & Man-Rating Lead', opens: 'nasa', candidates: [
      { id: 'mchen', name: 'Dr Maya Chen', note: 'Human-factors researcher from the Aeromedical Laboratory. Fast on anything with a person in it.', pace: 1.2, salary: 1600 },
      { id: 'ortiz', name: 'Dr Lila Ortiz', note: 'Reliability and assurance engineer. Steady, and signs nothing she has not seen tested.', pace: 1, salary: 1100 },
    ],
  },
};
