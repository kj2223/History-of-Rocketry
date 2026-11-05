// Save envelope, version policy and scenario-isolated storage (freeze §9.1, §9.2, §9.5).
// Knows nothing about game rules: the caller passes a validate(state) that throws on bad shape.

export const FORMAT = 'per-aspera-v1';
export const SCENARIO = 'v1-1945-1958';
export const SCHEMA_VERSION = 1;
export const CONTENT_VERSION = 4;
// Explicit allow-list. Older WAC-fork saves (cv 1–3) belong to another scenario and are rejected.
// shortcut: no migrations exist yet; add a tested migration per version when cv 5 ships.
export const SUPPORTED_CONTENT_VERSIONS = [4];
export const KEYS = { current: 'pa-v1', lastGood: 'pa-v1-last-good', unreadable: 'pa-v1-unreadable' };

export class SaveError extends Error {}

export const exportSave = (state, day = state.day) => JSON.stringify({
  format: FORMAT, scenario: SCENARIO, schemaVersion: SCHEMA_VERSION, contentVersion: CONTENT_VERSION, savedDay: day, state,
});

// Parse and check a save text without touching storage. Returns the state.
export const parseSave = (text, validate) => {
  let env;
  try { env = JSON.parse(text); } catch { throw new SaveError('This file is not a readable save.'); }
  if (!env || env.format !== FORMAT) throw new SaveError('This file is not a Per Aspera V1 save.');
  if (env.scenario !== SCENARIO) throw new SaveError(`This save belongs to another scenario (${env.scenario}).`);
  if (env.schemaVersion !== SCHEMA_VERSION) throw new SaveError(`Unsupported save schema ${env.schemaVersion}.`);
  if (!SUPPORTED_CONTENT_VERSIONS.includes(env.contentVersion)) {
    throw new SaveError(env.contentVersion > CONTENT_VERSION
      ? `This save is from a newer version (content ${env.contentVersion}) and cannot be loaded.`
      : `Content version ${env.contentVersion} is not supported.`);
  }
  try { validate(env.state); } catch (e) { throw new SaveError(`The save is damaged: ${e.message}`); }
  return env.state;
};

export const writeSave = (storage, state) => {
  const text = exportSave(state);
  storage.setItem(KEYS.current, text);
  storage.setItem(KEYS.lastGood, text);
};

// Load the current save, falling back to the last good one. Returns null when nothing is saved.
export const readSave = (storage, validate) => {
  const text = storage.getItem(KEYS.current);
  if (text === null) return null;
  try { return parseSave(text, validate); } catch (e) {
    storage.setItem(KEYS.unreadable, text);
    const backup = storage.getItem(KEYS.lastGood);
    if (backup === null || backup === text) throw e;
    return parseSave(backup, validate);
  }
};

// Import validates fully before writing, so a bad file never touches active state.
export const importSave = (storage, text, validate) => {
  const state = parseSave(text, validate);
  writeSave(storage, state);
  return state;
};

export const resetSave = storage => Object.values(KEYS).forEach(key => storage.removeItem(key));

export const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k),
    keys: () => [...data.keys()],
  };
};
