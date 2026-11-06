// Save envelope, version policy and scenario-isolated storage (V2 freeze §12; V1 freeze §9.1, §9.2, §9.5).
// Knows nothing about game rules: the caller passes a validate(state) that throws on bad shape.
// V2 has its own format, scenario and keys, and starts its own content versions at 1.

export const FORMAT = 'per-aspera-v2';
export const SCENARIO = 'v2-1958-1966';
export const SCHEMA_VERSION = 1;
export const CONTENT_VERSION = 1;
// shortcut: no migrations exist yet; add a tested migration per version when cv 2 ships.
export const SUPPORTED_CONTENT_VERSIONS = [1];
export const KEYS = { current: 'pa-v2', lastGood: 'pa-v2-last-good', unreadable: 'pa-v2-unreadable' };

// The one V1 save V2 can continue from (V2 freeze §3): a V1 cv 4 save that has reached NASA formation.
export const V1 = { format: 'per-aspera-v1', scenario: 'v1-1945-1958', schemaVersion: 1, contentVersions: [4] };

export class SaveError extends Error {}

export const exportSave = (state, day = state.day) => JSON.stringify({
  format: FORMAT, scenario: SCENARIO, schemaVersion: SCHEMA_VERSION, contentVersion: CONTENT_VERSION, savedDay: day, state,
});

const readJson = text => { try { return JSON.parse(text); } catch { throw new SaveError('This file is not a readable save.'); } };

// Parse and check a save text without touching storage. Returns the state.
export const parseSave = (text, validate) => {
  const env = readJson(text);
  if (env?.format === V1.format) throw new SaveError('This is a V1 save. Use "Continue from a V1 save" to start Mercury and Gemini from it.');
  if (!env || env.format !== FORMAT) throw new SaveError('This file is not a Per Aspera V2 save.');
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

// Read a V1 save for import. Only reads: the text, and any V1 storage it came from, are never written.
export const parseV1Save = text => {
  const env = readJson(text);
  if (!env || env.format !== V1.format) throw new SaveError('This file is not a Per Aspera V1 save.');
  if (env.scenario !== V1.scenario) throw new SaveError(`This V1 save belongs to another scenario (${env.scenario}).`);
  if (env.schemaVersion !== V1.schemaVersion) throw new SaveError(`Unsupported V1 save schema ${env.schemaVersion}.`);
  if (!V1.contentVersions.includes(env.contentVersion)) throw new SaveError(`V1 content version ${env.contentVersion} cannot be continued. Only V1 content version ${V1.contentVersions.join(', ')} saves can.`);
  const s = env.state;
  if (!s?.concluded || s.continuation?.hook?.from !== 'nasa-formation' || !s.continuation?.summary) {
    throw new SaveError('This V1 campaign has not reached NASA formation yet. Play it to 1 October 1958 first, or start fresh.');
  }
  return s;
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
