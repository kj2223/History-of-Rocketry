// Save envelope, version policy and scenario-isolated storage (GAME-DESIGN §18.6). Knows nothing about game
// rules: the caller passes a validate(state) that throws on bad shape, and a migrate for earlier builds' saves.
// The one continuous campaign has its own format and keys, and starts its own content versions at 1.

export const FORMAT = 'per-aspera';
export const SCENARIO = 'campaign-1945';
export const SCHEMA_VERSION = 1;
export const CONTENT_VERSION = 1;
// shortcut: no migrations exist yet; add a tested migration per version when cv 2 ships.
export const SUPPORTED_CONTENT_VERSIONS = [1];
export const KEYS = { current: 'pa-game', lastGood: 'pa-game-last-good', unreadable: 'pa-game-unreadable' };

// Saves from the two earlier builds, which carry on in this one (GAME-DESIGN §17.0b). Their storage is only read.
export const LEGACY = {
  'per-aspera-v1': { scenario: 'v1-1945-1958', schemaVersion: 1, contentVersions: [4], key: 'pa-v1', label: 'your 1945 campaign' },
  'per-aspera-v2': { scenario: 'v2-1958-1966', schemaVersion: 1, contentVersions: [1], key: 'pa-v2', label: 'your Mercury and Gemini campaign' },
};

export class SaveError extends Error {}

export const exportSave = (state, day = state.day) => JSON.stringify({
  format: FORMAT, scenario: SCENARIO, schemaVersion: SCHEMA_VERSION, contentVersion: CONTENT_VERSION, savedDay: day, state,
});

const readJson = text => { try { return JSON.parse(text); } catch { throw new SaveError('This file is not a readable save.'); } };

const checkVersion = (env, contentVersions, current) => {
  if (!contentVersions.includes(env.contentVersion)) {
    throw new SaveError(env.contentVersion > current
      ? `This save is from a newer version (content ${env.contentVersion}) and cannot be loaded.`
      : `Content version ${env.contentVersion} is not supported.`);
  }
};

// Parse and check a save text without touching storage. Returns the state. `migrate(format, state)` brings a
// save from an earlier build into this one's shape; it works on a copy, never the text's own storage.
export const parseSave = (text, validate, migrate = (f, s) => s) => {
  const env = readJson(text);
  const legacy = LEGACY[env?.format];
  if (!env || (env.format !== FORMAT && !legacy)) throw new SaveError('This file is not a Per Aspera save.');
  const scenario = legacy ? legacy.scenario : SCENARIO;
  if (env.scenario !== scenario) throw new SaveError(`This save belongs to another scenario (${env.scenario}).`);
  if (env.schemaVersion !== (legacy ? legacy.schemaVersion : SCHEMA_VERSION)) throw new SaveError(`Unsupported save schema ${env.schemaVersion}.`);
  checkVersion(env, legacy ? legacy.contentVersions : SUPPORTED_CONTENT_VERSIONS, legacy ? Math.max(...legacy.contentVersions) : CONTENT_VERSION);
  let state;
  try { state = legacy ? migrate(env.format, env.state) : env.state; validate(state); } catch (e) { throw new SaveError(`The save is damaged: ${e.message}`); }
  return state;
};

// A save an earlier build left in this storage, offered to carry on. Read only. Returns { label, text } or null.
export const legacySave = storage => {
  for (const l of [LEGACY['per-aspera-v2'], LEGACY['per-aspera-v1']]) {
    const text = storage.getItem(l.key);
    if (text !== null) return { label: l.label, text };
  }
  return null;
};

export const writeSave = (storage, state) => {
  const text = exportSave(state);
  storage.setItem(KEYS.current, text);
  storage.setItem(KEYS.lastGood, text);
};

// Load the current save, falling back to the last good one. Returns null when nothing is saved.
export const readSave = (storage, validate, migrate) => {
  const text = storage.getItem(KEYS.current);
  if (text === null) return null;
  try { return parseSave(text, validate, migrate); } catch (e) {
    storage.setItem(KEYS.unreadable, text);
    const backup = storage.getItem(KEYS.lastGood);
    if (backup === null || backup === text) throw e;
    return parseSave(backup, validate, migrate);
  }
};

// Import validates fully before writing, so a bad file never touches active state.
export const importSave = (storage, text, validate, migrate) => {
  const state = parseSave(text, validate, migrate);
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
