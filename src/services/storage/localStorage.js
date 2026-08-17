/**
 * localStorage helpers with graceful degradation.
 * Also handles one-time legacy key migrations ("lahooti_*" → "anymodel_*").
 */

/**
 * Load and JSON-parse a localStorage value, returning `fallback` on any error.
 */
export function loadJson(key, fallback) {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * Save a JSON-serializable value to localStorage.
 * Surfaces a storage-full notice via the `onStorageError` callback if set.
 */
export function saveJson(key, value, onStorageError) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (onStorageError) onStorageError("Storage is full — recent changes may not be saved.");
  }
}

/**
 * One-time migration: rename "lahooti_*" localStorage keys to "anymodel_*".
 * Runs before State is initialized so the app never reads stale keys.
 */
export function migrateLegacyKeys(LS) {
  try {
    if (typeof localStorage === "undefined") return;
    const FIXED = {
      "lahooti_provider_v1":       LS.LS_PROVIDER,
      "lahooti_keys_v1":           LS.LS_KEYS,
      "lahooti_bases_v1":          LS.LS_BASES,
      "lahooti_sysprompt_v1":      LS.LS_SYS,
      "lahooti_messages_v1":       LS.LS_MESSAGES,
      "lahooti_sessions_v1":      LS.LS_SESSIONS,
      "lahooti_active_session_v1": LS.LS_ACTIVE,
    };
    for (const [oldKey, newKey] of Object.entries(FIXED)) {
      const val = localStorage.getItem(oldKey);
      if (val !== null) {
        if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, val);
        localStorage.removeItem(oldKey);
      }
    }
    // Per-provider model selections under "lahooti_model_<provider>"
    const OLD_PREFIX = "lahooti_model_";
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(OLD_PREFIX) === 0) doomed.push(k);
    }
    for (const oldKey of doomed) {
      const suffix = oldKey.slice(OLD_PREFIX.length);
      const newKey = LS.LS_MODEL_PREFIX + suffix;
      const val = localStorage.getItem(oldKey);
      if (val !== null) {
        if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, val);
        localStorage.removeItem(oldKey);
      }
    }
  } catch (e) { /* never block the app on migration */ }
}
