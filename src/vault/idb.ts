/**
 * IndexedDB wrapper for vault storage.
 * Falls back to localStorage in test environments where IndexedDB isn't available.
 */

const DB_NAME = 'relay-vault';
const DB_VERSION = 1;
const STORE_NAME = 'vault';
const VAULT_KEY = 'sealed-blob';
const LS_PREFIX = 'relay.vault.idb.';

/** Detect if IndexedDB is real (jsdom has a stub that fails) */
let _idbSupported: boolean | null = null;
async function isIDBSupported(): Promise<boolean> {
  if (_idbSupported !== null) return _idbSupported;
  try {
    const db = indexedDB.open('_test_');
    await new Promise<void>((resolve, reject) => {
      db.onsuccess = () => { _idbSupported = true; db.result.close(); resolve(); };
      db.onerror = () => { _idbSupported = false; reject(db.error); };
    });
    // Clean up test DB
    indexedDB.deleteDatabase('_test_');
  } catch {
    _idbSupported = false;
  }
  return _idbSupported!;
}

/* ── IndexedDB path ───────────────────────────────────────── */

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ── localStorage fallback ────────────────────────────────── */

function lsGet<T>(key: string): T | null {
  const raw = localStorage.getItem(LS_PREFIX + key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function lsSet<T>(key: string, value: T): void {
  localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
}

function lsDelete(key: string): void {
  localStorage.removeItem(LS_PREFIX + key);
}

/* ── Public API ───────────────────────────────────────────── */

export async function idbGet<T>(key: string): Promise<T | null> {
  if (!(await isIDBSupported())) return lsGet<T>(key);
  const db = await openDB();
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  if (!(await isIDBSupported())) { lsSet(key, value); return; }
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function idbDelete(key: string): Promise<void> {
  if (!(await isIDBSupported())) { lsDelete(key); return; }
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function idbClear(): Promise<void> {
  if (!(await isIDBSupported())) {
    // Clear all relay.vault.idb.* keys from localStorage
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(LS_PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
    return;
  }
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Convenience: get/set the sealed vault blob. */
export async function getSealedVault(): Promise<any | null> {
  return idbGet(VAULT_KEY);
}

export async function setSealedVault(blob: any): Promise<void> {
  return idbSet(VAULT_KEY, blob);
}

export async function removeSealedVault(): Promise<void> {
  return idbDelete(VAULT_KEY);
}
