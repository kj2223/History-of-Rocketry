// THE PEOPLE AROUND YOU, AS THEY REALLY ARE. Hidden: the player learns these only from what people do. How carefully a
// crew member inspects, how long it takes them, and whether they call GO on a reading they should have questioned.
// Scenes and drawing never import this file (the seeing rule); the game passes only outcomes to them.
export const TRAITS = {
  // Thorough and slow: finds most real faults and rarely cries wolf.
  kowalski: { hit: 0.9, falseAlarm: 0.1, lazyGo: 0.05 },
  // Quick and cheerful: misses things and sees trouble that isn't there, and calls GO on a reading that is off.
  delgado: { hit: 0.6, falseAlarm: 0.3, lazyGo: 0.45 },
};
