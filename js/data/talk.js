// What each person on the site says when you walk up to them, by the beat of the day. Every person has a line for any beat.
export function talk(id, beat) {
  const lines = {
    ellis: { brief: 'Welds first. Then give me a propellant figure for the range.', board: 'The drawing board is in here. I need that propellant figure.', evening1: 'Go home, get some sleep. Big day tomorrow.', static: 'It\'s your firing. Watch that tank gauge before you fire.', review: 'In here when you\'re ready.' },
    kowalski: { brief: 'She\'s all yours, sir. Torch is on the bench.', staticPrep: 'Mind your feet, this thing\'s heavier than it looks.', rollout: 'Booster first, then the truck, then the tower. Same as always.', recovery: 'Truck\'s ready when you are.' },
    delgado: { brief: 'First time on a WAC? Look at the welds. Sarge says they always look at the welds.' },
    vega: { countReady: 'She\'s up. Get in the blockhouse, we count from ten minutes.', rollout: 'Waiting on the round. The tower\'s ready.' },
    morgan: { rollout: 'Radar\'s warmed up. Balloon goes up at T minus ten.', recovery: 'Climb in. Bumpy ride.', board: 'Get me that figure and I\'ll clear the range.' },
    hoyt: { brief: 'Have a good look at her. Every one of these came out of a crate in pieces.', staticPrep: 'We\'ll have her on the stand by noon.', static: 'Steam generator\'s topped up. She\'s ready when you are.', rollout: 'Easy with her. The vanes are graphite.', recovery: 'Bring me back anything with a part number on it.' },
    brandt: { brief: 'Range time is booked. I\'d like to keep it that way.', board: 'Is that plan going to cost me a day?', static: 'Make it count. Every firing is money.', rollout: 'The Navy is watching this one. So am I.', countReady: 'Whenever you\'re ready, Conductor.', review: 'I\'ll want to know what it costs to fix.' },
  };
  const idle = { ellis: 'Busy, busy.', vega: 'Morning.', morgan: 'Clear skies today.', kowalski: 'Sir.', delgado: 'Morning, sir.', hoyt: 'Morning.', brandt: 'Conductor.' };
  return lines[id]?.[beat] || idle[id] || 'Morning.';
}

