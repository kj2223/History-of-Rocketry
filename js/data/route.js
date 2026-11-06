// THE ROUTE TO THE MOON, 1962: the meeting where NASA's centres argue how Apollo goes to the Moon. A scene, not a flight.
// The modes and the arguments are the real ones; the people are the game's. NASA chose lunar-orbit rendezvous: Marshall
// came round to it at Huntsville on 7 June 1962, and NASA announced it on 11 July.
import { dayOf } from '../core/calendar.js';

export const ROUTE_DAY = dayOf(1962, 6, 7);
export const ROUTE_ANNOUNCED = '11 July 1962';

export const ROUTE_MODES = {
  direct: {
    name: 'Direct ascent',
    plan: 'One giant rocket, the Nova, flies the whole ship to the Moon, lands it tail first and brings it home. No rendezvous anywhere.',
    case: 'Nothing has to meet anything. But the Nova is twice the size of anything on paper, and landing a ship that tall on ground nobody has seen frightens everyone who has flown a capsule.',
    who: 'Some at headquarters still like it.',
  },
  eor: {
    name: 'Earth-orbit rendezvous',
    plan: 'Two or more Saturns go up, meet in Earth orbit and fuel or join a ship that then goes to the Moon and lands whole.',
    case: 'Rendezvous close to home, where a miss can be tried again or the crew can come down. Marshall\'s plan: it needs Marshall\'s rockets, and a lot of them.',
    who: 'Marshall, Albrecht\'s people in Huntsville.',
  },
  lor: {
    name: 'Lunar-orbit rendezvous',
    plan: 'One Saturn V. A mother ship stays in orbit round the Moon while a small, light lander takes two men down and back up to meet it.',
    case: 'By far the lightest: the lander leaves its legs and its descent stage behind, and only the mother ship carries a heat shield. But the rendezvous is a quarter of a million miles from home, and if it fails nobody can help.',
    who: 'Langley\'s rendezvous people. Houston is coming round to it.',
  },
};
