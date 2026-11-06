// THE ASTRONAUTS AS THEY REALLY ARE. Hidden: the player learns these only from what each does. Scenes and drawing never
// import this file (the seeing rule).
// risk: how much trouble he will fly into. candour: how plainly he says what he sees. independence: how soon he acts on
// his own reading rather than waiting for the ground.
export const CREW_TRAITS = {
  rourke: { risk: 0.55, candour: 0.8, independence: 0.5 },
  okafor: { risk: 0.35, candour: 0.75, independence: 0.7 },
  whitcomb: { risk: 0.85, candour: 0.45, independence: 0.8 },
  lindqvist: { risk: 0.5, candour: 0.35, independence: 0.4 },
  price: { risk: 0.45, candour: 0.6, independence: 0.25 },
  achterberg: { risk: 0.7, candour: 0.7, independence: 0.75 },
  moreau: { risk: 0.25, candour: 0.65, independence: 0.6 },
};

// Whether he consents to go, from his own reading of the recovery board and the count. Binding: no consent, no launch.
// A rough sea or a ship off station worries a cautious man; the bold ones fly anyway.
export function consents(traits, board) {
  const trouble = (board.sea > 4 ? 1 : 0) + (board.late ? 1 : 0);
  return trouble === 0 || traits.risk >= 0.5 + 0.2 * (trouble - 1);
}
// How far off the line (degrees) he lets her go before he pulls the abort handle himself. Binding: the escape tower fires.
// The independent ones act on their own reading; the others wait for the ground's call, and pull it only when it is
// plainly over.
export const ownAbortAt = traits => 6 + 6 * (1 - traits.independence);
// Whether he says out loud that the holds are wearing thin.
export const impatient = (traits, holds) => holds >= 2 && traits.independence > 0.45;
