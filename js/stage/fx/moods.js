// THE ROOM'S MOOD (v0.8 visual pass): how the people in a control room carry themselves, read from what the room
// knows. 'calm' at work; 'tense' through the moments everyone stands for (the climb, the powered descent, entry);
// 'cheer' when a crew is home safe, or for the first hour on the Moon; 'grief' when a crew or a lander is lost.
// The drawing only moves bodies and arms: no light changes, so nothing flashes.
import { FLIGHTS } from '../../data/flights.js';

export function roomMood(g, c) {
  if (!c) return 'calm';
  if (c.phase === 'done' && c.kind !== 'sim') {
    const end = c.round?.end || {};
    if (c.fate === 'killed' || end.capsule === 'lost' || end.lmLost) return 'grief';
    if (c.fate === 'hurt' || c.sank || end.outcome === 'pad' || end.outcome === 'breakup') return 'calm';
    return 'cheer';
  }
  const f = c.flight;
  if (f) {
    if (f.phase === 'On the surface') {
      const down = FLIGHTS[f.id]?.steps.find(s => s.phase === 'On the surface')?.at ?? f.at;
      if (f.at - down < 1) return 'cheer';
    }
    if (f.phase === 'Powered descent') return 'tense';
  }
  if (['ascent', 'insertion', 'entry'].includes(c.phase)) return 'tense';
  return 'calm';
}
