// Saving and resuming. The game saves a checkpoint at the start of each work day: everything needed to rebuild that
// morning, as plain JSON. Knows nothing about the rules: the caller passes a check(checkpoint) that throws on a bad shape.

export const FORMAT = 'per-aspera';
export const CONTENT_VERSION = 3; // 3: V-2 and Bumper rounds, seats and offers; 2: a season of rounds; 1: one round
export const KEYS = { current: 'pa-game', lastGood: 'pa-game-last-good' };

export class SaveError extends Error {}

export const exportSave = checkpoint => JSON.stringify({ format: FORMAT, contentVersion: CONTENT_VERSION, checkpoint });

export const parseSave = (text, check) => {
  let env;
  try { env = JSON.parse(text); } catch { throw new SaveError('This is not a readable save.'); }
  if (env?.format !== FORMAT) throw new SaveError('This is not a Per Aspera save.');
  if (env.contentVersion !== CONTENT_VERSION) throw new SaveError(`This save is from another version of the game (content ${env.contentVersion}).`);
  try { check(env.checkpoint); } catch (e) { throw new SaveError(`The save is damaged: ${e.message}`); }
  return env.checkpoint;
};

export const writeSave = (storage, checkpoint) => {
  const text = exportSave(checkpoint);
  storage.setItem(KEYS.current, text);
  storage.setItem(KEYS.lastGood, text);
};

// The saved checkpoint, falling back to the last good one. Returns null when nothing usable is saved.
export const readSave = (storage, check) => {
  for (const key of [KEYS.current, KEYS.lastGood]) {
    const text = storage.getItem(key);
    if (text === null) continue;
    try { return parseSave(text, check); } catch { /* try the next one */ }
  }
  return null;
};

export const clearSave = storage => Object.values(KEYS).forEach(k => storage.removeItem(k));

export const memoryStorage = () => {
  const data = new Map();
  return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
};
