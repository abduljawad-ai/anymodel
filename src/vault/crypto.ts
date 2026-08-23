const enc = new TextEncoder();
const dec = new TextDecoder();

export const PBKDF2_ITERATIONS = 310_000;

/** Encrypted-at-rest vault blob. All binary fields are base64. */
export interface VaultBlob {
  v: 1;
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(pass: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bs(salt), iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(obj: unknown, pass: string, iterations = PBKDF2_ITERATIONS): Promise<VaultBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt, iterations);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(iv) }, key, enc.encode(JSON.stringify(obj)));
  return { v: 1, iterations, salt: toB64(salt), iv: toB64(iv), data: toB64(new Uint8Array(ct)) };
}

export async function decryptJson<T>(blob: VaultBlob, pass: string): Promise<T> {
  const key = await deriveKey(pass, fromB64(blob.salt), blob.iterations);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bs(fromB64(blob.iv)) }, key, bs(fromB64(blob.data)));
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    throw new Error('WRONG_PASSPHRASE');
  }
}
