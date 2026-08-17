/**
 * AES-GCM encrypted API key storage.
 *
 * Keys are encrypted with a user-supplied passphrase using PBKDF2 (150k iterations,
 * SHA-256) to derive an AES-256-GCM key. The passphrase lives only in memory
 * for the session — never persisted.
 *
 * LS_KEYS stores: { enc:1, iter, salt, iv, data } (base64 fields).
 * Legacy plaintext objects are migrated to encrypted blob on next save.
 */

// ── Base64 helpers ───────────────────────────────────────────────────

function b64FromBytes(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function bytesFromB64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Key derivation ───────────────────────────────────────────────────

async function deriveKey(pass, salt) {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ── Encryption ───────────────────────────────────────────────────────

/**
 * Encrypt a keys object and return the blob structure for storage.
 * @param {object} keysObj - the API keys map
 * @param {string} pass - user passphrase (session-only)
 */
export async function encryptKeysBlob(keysObj, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(keysObj))
  );
  return {
    enc: 1,
    iter: 150000,
    salt: b64FromBytes(salt),
    iv: b64FromBytes(iv),
    data: b64FromBytes(new Uint8Array(ct))
  };
}

/**
 * Decrypt a keys blob.
 * @param {object} blob - the stored blob { enc, salt, iv, data }
 * @param {string} pass - user passphrase
 * @returns {Promise<object>} the decrypted keys map
 */
export async function decryptKeysBlob(blob, pass) {
  const key = await deriveKey(pass, bytesFromB64(blob.salt));
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytesFromB64(blob.iv) },
    key,
    bytesFromB64(blob.data)
  );
  return JSON.parse(new TextDecoder().decode(pt));
}

// ── Blob access ──────────────────────────────────────────────────────

/**
 * Read and parse the raw stored blob from localStorage (may be plaintext or encrypted).
 */
export function keysBlob(getItem) {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(getItem) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) {
    return null;
  }
}

/**
 * Whether the key store is encrypted but not yet unlocked for this session.
 */
export function keysLocked(blob, hasPassphrase) {
  return !!(blob && blob.enc) && !hasPassphrase;
}
