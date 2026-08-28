/**
 * Vault Web Worker — runs Argon2id derivation in isolation.
 * The passphrase and derived key NEVER leave this worker's memory.
 * The main thread can only call: derive(passphrase, salt) → CryptoKey.
 */

import { argon2id } from 'hash-wasm';

const enc = new TextEncoder();

/** Argon2id parameters (OWASP 2026 browser recommendations) */
export const ARGON2_TIME_COST = 3;       // iterations
export const ARGON2_MEMORY_COST = 65536; // 64 MiB
export const ARGON2_PARALLELISM = 1;     // single-threaded (safe for browser)
export const ARGON2_HASH_LENGTH = 32;    // 256-bit key

/**
 * Derive an AES-256-GCM CryptoKey from a passphrase using Argon2id.
 * Returns the derived CryptoKey (structured-cloneable, can be sent to main thread).
 */
async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const passHash = await argon2id({
    password: enc.encode(passphrase),
    salt,
    parallelism: ARGON2_PARALLELISM,
    iterations: ARGON2_TIME_COST,
    memorySize: ARGON2_MEMORY_COST,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: 'binary',
  });

  return crypto.subtle.importKey(
    'raw',
    passHash as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Message handler */
self.onmessage = async (e: MessageEvent) => {
  const { type, id, passphrase, saltB64 } = e.data as {
    type: string;
    id: number;
    passphrase: string;
    saltB64: string;
  };

  if (type !== 'derive') {
    self.postMessage({ id, error: `Unknown message type: ${type}` });
    return;
  }

  try {
    // Decode salt from base64
    const saltStr = atob(saltB64);
    const salt = new Uint8Array(saltStr.length);
    for (let i = 0; i < saltStr.length; i++) salt[i] = saltStr.charCodeAt(i);

    const key = await deriveKey(passphrase, salt);
    self.postMessage({ id, key });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};

export type VaultWorker = Worker;
