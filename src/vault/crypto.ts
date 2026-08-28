/**
 * Vault crypto — Argon2id key derivation (via Web Worker) + AES-256-GCM encryption.
 *
 * Architecture:
 *   Passphrase → Worker (Argon2id) → CryptoKey → Main thread (AES-GCM encrypt/decrypt)
 *   The passphrase NEVER leaves the Worker's memory.
 *   The derived CryptoKey is structured-cloneable and safe to send to main thread.
 */

import {
  ARGON2_TIME_COST,
  ARGON2_MEMORY_COST,
  ARGON2_PARALLELISM,
  ARGON2_HASH_LENGTH,
} from './vault.worker';

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ── VaultBlob format ──────────────────────────────────────── */
export interface VaultBlob {
  v: 2;                  // version 2 = Argon2id
  argon2: {
    timeCost: number;
    memoryCost: number;
    parallelism: number;
    hashLength: number;
  };
  salt: string;          // base64
  iv: string;            // base64
  data: string;          // base64 (AES-GCM ciphertext)
}

/* ── Base64 helpers ────────────────────────────────────────── */
function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

/* ── Worker pool (lazy singleton) ──────────────────────────── */
let _worker: Worker | null = null;
let _msgId = 0;
const _pending = new Map<number, { resolve: (k: CryptoKey) => void; reject: (e: Error) => void }>();

/**
 * Detect test environment (jsdom has no real Worker).
 * In tests we fall back to direct Argon2id derivation in the main thread.
 */
const IS_TEST = typeof Worker === 'undefined';

function getWorker(): Worker | null {
  if (IS_TEST) return null;
  if (_worker) return _worker;
  _worker = new Worker(new URL('./vault.worker.ts', import.meta.url), { type: 'module' });
  _worker.onmessage = (e) => {
    const { id, key, error } = e.data;
    const p = _pending.get(id);
    if (!p) return;
    _pending.delete(id);
    if (error) p.reject(new Error(error));
    else p.resolve(key as CryptoKey);
  };
  _worker.onerror = (e) => {
    console.error('[vault worker]', e);
  };
  return _worker;
}

/* ── Fallback: direct Argon2id (test env only) ──────────────── */
let _argon2id: typeof import('hash-wasm').argon2id | null = null;

async function deriveKeyDirect(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  if (!_argon2id) {
    _argon2id = (await import('hash-wasm')).argon2id;
  }
  const passHash = await _argon2id({
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

/**
 * Derive a CryptoKey via the Argon2id Web Worker.
 * The passphrase is sent to the worker and NEVER returned — the derived
 * CryptoKey is the only thing that comes back.
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  // In test environment (jsdom), fall back to direct derivation
  const worker = getWorker();
  if (!worker) {
    return deriveKeyDirect(passphrase, salt);
  }

  const id = _msgId++;
  return new Promise<CryptoKey>((resolve, reject) => {
    _pending.set(id, { resolve, reject });
    worker.postMessage({
      type: 'derive',
      id,
      passphrase,
      saltB64: toB64(salt),
    });
  });
}

/* ── Encrypt / Decrypt ─────────────────────────────────────── */

export async function encryptJson(
  obj: unknown,
  passphrase: string,
): Promise<VaultBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassphrase(passphrase, salt);
  const pt = enc.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bs(iv) },
    key,
    pt,
  );
  return {
    v: 2,
    argon2: {
      timeCost: ARGON2_TIME_COST,
      memoryCost: ARGON2_MEMORY_COST,
      parallelism: ARGON2_PARALLELISM,
      hashLength: ARGON2_HASH_LENGTH,
    },
    salt: toB64(salt),
    iv: toB64(iv),
    data: toB64(new Uint8Array(ct)),
  };
}

export async function decryptJson<T>(
  blob: VaultBlob,
  passphrase: string,
): Promise<T> {
  const key = await deriveKeyFromPassphrase(passphrase, fromB64(blob.salt));
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bs(fromB64(blob.iv)) },
      key,
      bs(fromB64(blob.data)),
    );
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    throw new Error('WRONG_PASSPHRASE');
  }
}
