// PEOPLE YOU CAN READ (next-level visual pass, November 2026). The controllers at their desks, drawn larger and with
// more to them: seen from behind, as the room is seen from its back, each with their own hair, the headset's band and
// ear cups from 1958, a collar, and a few small things they do while the room is calm: look round at a neighbour,
// lean over to talk, sit back with their hands behind their head, drink from a mug, bend to write. Each person keeps
// to their own slow timetable, so the room is never in step. A runner carries paper along the aisle now and then.
// The drawing only moves bodies: no light changes, so nothing flashes. Presentation only.
import { colorOf } from './kit.js';

// A small stable hash of a string and a number, 0..1.
export function hashOf(s, n = 0) {
  let h = 2166136261 ^ n;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const SKIN = [0xf0c8a4, 0xe2b993, 0xc99a74, 0xa87652, 0x7d5338, 0x5c3a26];
const HAIR = [0x2a2018, 0x3e2c1c, 0x6a4a2a, 0x8a6a40, 0xb08a5a, 0x9a9a98, 0x1c1c20];

// How a person looks, from their name (or seat) and the year: fixed for life, the hair's style following the times.
export function lookOf(key, year = 1965) {
  const h = n => hashOf(key, n);
  const styles =
    year < 1968
      ? ['crew', 'crew', 'part', 'bald', 'part']
      : year < 1990
        ? ['part', 'long', 'crew', 'bald', 'curly']
        : ['crew', 'part', 'long', 'curly', 'bald'];
  return {
    skin: SKIN[Math.floor(h(1) * SKIN.length)],
    hair: HAIR[Math.floor(h(2) * HAIR.length)],
    style: styles[Math.floor(h(3) * styles.length)],
    glasses: h(4) < 0.3,
  };
}

// What a person is doing while the room is calm, at time t: their own slow timetable of small actions.
// Returns { kind, side }: kind one of still, look, lean, back, mug, write; side -1 or 1.
export const IDLE = ['still', 'still', 'still', 'look', 'lean', 'back', 'mug', 'write'];
export function idleAt(key, i, t) {
  const period = 7 + Math.floor(hashOf(key, 9) * 8); // 7 to 14 seconds a spell
  const slot = Math.floor((t + hashOf(key, 10) * period) / period);
  const r = hashOf(key, 100 + slot);
  return { kind: IDLE[Math.floor(r * IDLE.length)], side: hashOf(key, 200 + slot) < 0.5 ? -1 : 1 };
}

const darker = (c, k) =>
  (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);

// Draws a seated controller seen from behind into Graphics p, centred at px with y 0 the desk's top edge.
// who: the person (color, hat, name); mood: the room's (fx/moods.js); i: the desk's place; year: the room's year.
export function drawPerson(p, px, who, mood, t, i, year) {
  const key = who.name || `seat${i}`;
  const L = lookOf(key, year);
  const body = colorOf(who.color || '#4a5568'),
    shade = darker(body, 0.78),
    skin = L.skin,
    skinS = darker(skin, 0.8),
    hair = L.hair;
  const idle = mood === 'calm' ? idleAt(key, i, t) : { kind: 'still', side: 1 };
  p.clear();
  // How the body sits: up out of the chair for the tense moments and the cheering, slumped in grief, leaning or back.
  const up = mood === 'cheer' || (mood === 'tense' && i % 3 === 1) ? 14 : 0,
    slump = mood === 'grief' ? 7 : 0;
  const lean = idle.kind === 'lean' ? idle.side * 7 : 0,
    back = idle.kind === 'back' ? -3 : 0,
    bow = idle.kind === 'write' ? 4 : 0;
  const bx = px + lean,
    top = -31 - up + slump + back + bow * 0.5;
  // Legs when standing.
  if (up)
    p.rect(bx - 12, top + 31, 9, up + 2)
      .fill(0x2b2e33)
      .rect(bx + 3, top + 31, 9, up + 2)
      .fill(0x2b2e33);
  // The back and shoulders: rounded, a shade down one side, the collar at the neck.
  p.roundRect(bx - 21, top + 4, 42, 30 + up - slump, 9).fill(body);
  p.rect(bx + 8, top + 8, 12, 24 + up - slump).fill({ color: shade, alpha: 0.6 });
  // Arms.
  const arm = (x0, y0, x1, y1) => p.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 7, color: body, cap: 'round' });
  const hand = (x, y) => p.circle(x, y, 3.6).fill(skin);
  const hx = bx + (idle.kind === 'look' ? idle.side * 5 : 0) + (mood === 'grief' ? 0 : 0),
    hy = top - 9 + bow + slump * 0.8;
  if (mood === 'cheer') {
    const sway = Math.sin(t * 2.2 + i * 1.7) * 3;
    arm(bx - 17, top + 8, bx - 24 + sway, top - 20);
    arm(bx + 17, top + 8, bx + 24 + sway, top - 20);
    hand(bx - 24 + sway, top - 22);
    hand(bx + 24 + sway, top - 22);
    if (i % 3 === 0) {
      const fx = bx + 24 + sway,
        fy = top - 40;
      p.rect(fx - 0.5, fy, 1.5, 18).fill(0x8a7a5a);
      p.rect(fx + 1, fy, 14, 9).fill(0xb22234);
      for (let k = 1; k < 4; k++) p.rect(fx + 1, fy + k * 2.2, 14, 1).fill(0xf3efe4);
      p.rect(fx + 1, fy, 6, 4.5).fill(0x3c3b6e);
    }
  } else if (mood === 'grief') {
    if (i % 2) {
      arm(bx + 16, top + 10, bx + 9, hy + 2);
      hand(bx + 9, hy + 2);
    }
  } else if (mood === 'tense' && up) {
    arm(bx - 17, top + 8, bx - 19, top + 30 + up);
    arm(bx + 17, top + 8, bx + 19, top + 30 + up);
  } else if (idle.kind === 'back') {
    // Hands behind the head, elbows out.
    arm(bx - 17, top + 8, bx - 22, hy - 4);
    arm(bx + 17, top + 8, bx + 22, hy - 4);
    p.moveTo(bx - 22, hy - 4)
      .lineTo(hx - 6, hy - 6)
      .moveTo(bx + 22, hy - 4)
      .lineTo(hx + 6, hy - 6)
      .stroke({ width: 6, color: body, cap: 'round' });
  } else if (idle.kind === 'mug') {
    // A mug to the mouth, on one side.
    const s = idle.side;
    arm(bx + s * 17, top + 9, hx + s * 13, hy + 7);
    hand(hx + s * 13, hy + 7);
    p.roundRect(hx + s * 13 - 4, hy - 1, 8, 9, 1.5).fill(0xe8e2d0);
    p.rect(hx + s * 13 - 4, hy - 1, 8, 2).fill(0x5a3c22);
  }
  // The neck, the ears, the head from behind, the hair in its style.
  p.rect(hx - 5, hy + 7, 10, 7).fill(skinS);
  p.ellipse(hx - 11, hy + 1, 2.6, 4).fill(skin);
  p.ellipse(hx + 11, hy + 1, 2.6, 4).fill(skin);
  p.ellipse(hx, hy, 11, 12).fill(skin);
  if (L.style === 'bald') {
    p.ellipse(hx, hy + 5, 11, 6).fill(hair);
    p.ellipse(hx, hy - 1, 9, 8).fill(skin);
  } else if (L.style === 'long') {
    p.ellipse(hx, hy - 1, 12, 12.5).fill(hair);
    p.roundRect(hx - 11, hy, 22, 15, 5).fill(hair);
  } else if (L.style === 'curly') {
    for (const [dx, dy] of [
      [-7, -6],
      [0, -9],
      [7, -6],
      [-9, 1],
      [9, 1],
      [-4, 4],
      [4, 4],
    ])
      p.circle(hx + dx, hy + dy, 6).fill(hair);
  } else {
    p.ellipse(hx, hy - 1.5, 11.5, 11).fill(hair);
    if (L.style === 'part') p.rect(hx - 4, hy - 12, 1.5, 7).fill(darker(hair, 0.7));
  }
  // Turned to look round: a cheek and the tip of a nose on that side.
  if (idle.kind === 'look') {
    p.ellipse(hx + idle.side * 8, hy + 3, 4, 6).fill(skin);
    p.rect(hx + idle.side * 12, hy + 2, 2.5 * idle.side, 3).fill(skinS);
    if (L.glasses) p.rect(hx + idle.side * 6, hy - 1, 6 * idle.side, 1.5).fill(0x2a2a2e);
  }
  // From 1958 the headset: a band over the crown and a cup on each ear (a hat before then, if they wear one).
  if (year >= 1958) {
    p.moveTo(hx - 12, hy + 1)
      .arc(hx, hy + 1, 12, Math.PI, 2 * Math.PI)
      .stroke({ width: 2.5, color: 0x18191c });
    p.roundRect(hx - 14.5, hy - 3, 5, 9, 1.5).fill(0x18191c);
    p.roundRect(hx + 9.5, hy - 3, 5, 9, 1.5).fill(0x18191c);
  } else if (who.hat) p.rect(hx - 13, hy - 11, 26, 5).fill(colorOf(who.hat));
  // The collar.
  p.rect(hx - 7, top + 3, 14, 3.5).fill(0xe8e6de);
}

// The runner: someone carrying a sheaf of paper along the aisle, side on, walking. dir 1 to the right.
export function drawRunner(p, x, y, t, dir, key, year) {
  const L = lookOf(key, year);
  const step = Math.sin(t * 7) * 6;
  p.clear();
  // Legs, swinging.
  p.moveTo(x, y - 26)
    .lineTo(x + step, y)
    .moveTo(x, y - 26)
    .lineTo(x - step, y)
    .stroke({ width: 6, color: 0x2b2e33, cap: 'round' });
  // Body, arm forward holding the paper, head.
  p.roundRect(x - 9, y - 58, 18, 34, 6).fill(0xdcdad0);
  p.rect(x + dir * 2, y - 52, dir * 12, 6).fill(0xdcdad0);
  p.rect(x + dir * 10, y - 58, dir * 10, 13).fill(0xf4f1e6);
  p.rect(x + dir * 11, y - 56, dir * 7, 1).fill(0x9a9a9a);
  p.rect(x + dir * 11, y - 53, dir * 7, 1).fill(0x9a9a9a);
  p.rect(x - 3, y - 62, 6, 5).fill(darker(L.skin, 0.8));
  p.ellipse(x, y - 70, 9, 10).fill(L.skin);
  p.ellipse(x - dir * 2, y - 73, 9, 7.5).fill(L.hair);
  p.rect(x + dir * 7, y - 70, dir * 3, 3).fill(darker(L.skin, 0.8));
}
