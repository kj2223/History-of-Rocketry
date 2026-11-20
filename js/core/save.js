// Saving and resuming. The game saves a checkpoint at the start of each work day: everything needed to rebuild that
// morning, as plain JSON. Knows nothing about the rules: the caller passes a check(checkpoint) that throws on a bad shape.
// Each game mode keeps its own slot (current, last good and backup), so a Flight Director game and a management game
// never overwrite each other and neither save loads as the other. Every function takes the slot last and defaults to
// the Flight Director's, so its saves are written exactly as before (no mode field) and old ones still load.

export const FORMAT = 'per-aspera';
export const CONTENT_VERSION = 3; // 3: V-2 and Bumper rounds, seats and offers; 2: a season of rounds; 1: one round
export const KEYS = {
  current: 'pa-game',
  lastGood: 'pa-game-last-good',
  backup: 'pa-game-backup',
  unreadable: 'pa-game-unreadable', // a save this build refused at start-up, kept for a later migration
};

export const FLIGHT = { mode: 'flight', keys: KEYS, contentVersion: CONTENT_VERSION };
export const MANAGEMENT = {
  mode: 'management',
  keys: { current: 'aa-manage', lastGood: 'aa-manage-last-good', backup: 'aa-manage-backup' },
  contentVersion: 1,
};

export const DESK = {
  mode: 'desk',
  keys: { current: 'aa-desk', lastGood: 'aa-desk-last-good', backup: 'aa-desk-backup' },
  contentVersion: 1,
};

export class SaveError extends Error {}

export const exportSave = (checkpoint, slot = FLIGHT) =>
  JSON.stringify(
    slot.mode === FLIGHT.mode
      ? { format: FORMAT, contentVersion: slot.contentVersion, checkpoint }
      : { format: FORMAT, mode: slot.mode, contentVersion: slot.contentVersion, checkpoint },
  );

export const parseSave = (text, check, slot = FLIGHT) => {
  let env;
  try {
    env = JSON.parse(text);
  } catch {
    throw new SaveError('This is not a readable save.');
  }
  if (env?.format !== FORMAT) throw new SaveError('This is not an Ad Astra save.');
  if ((env.mode ?? FLIGHT.mode) !== slot.mode)
    throw new SaveError(`This is a ${env.mode === 'management' ? 'management' : 'Flight Director'} save.`);
  if (env.contentVersion !== slot.contentVersion)
    throw new SaveError(`This save is from another version of the game (content ${env.contentVersion}).`);
  try {
    check(env.checkpoint);
  } catch (e) {
    throw new SaveError(`The save is damaged: ${e.message}`);
  }
  return env.checkpoint;
};

export const writeSave = (storage, checkpoint, slot = FLIGHT) => {
  const text = exportSave(checkpoint, slot);
  // The checkpoint before this one becomes the fallback, so a bad checkpoint never takes its own fallback with it.
  const previous = storage.getItem(slot.keys.current);
  if (previous !== text) storage.setItem(slot.keys.lastGood, previous ?? text);
  storage.setItem(slot.keys.current, text);
};

// The saved checkpoint, falling back to the last good one. Returns null when nothing usable is saved.
export const readSave = (storage, check, slot = FLIGHT) => {
  for (const key of [slot.keys.current, slot.keys.lastGood]) {
    const text = storage.getItem(key);
    if (text === null) continue;
    try {
      return parseSave(text, check, slot);
    } catch {
      /* try the next one */
    }
  }
  return null;
};

// Starting a new game keeps the one you were playing as the backup, so starting over never loses a game.
export const startOver = (storage, check, slot = FLIGHT) => {
  const current = readSave(storage, check, slot);
  if (current !== null) storage.setItem(slot.keys.backup, exportSave(current, slot));
  storage.removeItem(slot.keys.current);
  storage.removeItem(slot.keys.lastGood);
};
// The backup, if there is one this version can carry on; null otherwise.
export const readBackup = (storage, check, slot = FLIGHT) => {
  const text = storage.getItem(slot.keys.backup);
  if (text === null) return null;
  try {
    return parseSave(text, check, slot);
  } catch {
    return null;
  }
};
// Go back to the backup: it becomes the current game, and the current game becomes the backup.
export const swapBackup = (storage, check, slot = FLIGHT) => {
  const backup = readBackup(storage, check, slot);
  if (backup === null) return false;
  const current = readSave(storage, check, slot);
  if (current !== null) storage.setItem(slot.keys.backup, exportSave(current, slot));
  else storage.removeItem(slot.keys.backup);
  writeSave(storage, backup, slot);
  return true;
};

export const clearSave = (storage, slot = FLIGHT) => Object.values(slot.keys).forEach(k => storage.removeItem(k));

export const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k),
  };
};
