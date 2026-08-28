import { create } from 'zustand';
import { decryptJson, encryptJson, type VaultBlob } from './crypto';
import { getSealedVault, setSealedVault } from './idb';
import type { ProviderId } from '../catalog/types';

type Keys = Partial<Record<ProviderId, string>>;

export interface GateRecord {
  recordId: string;
  pairingKey: string;
}

interface SealedPayload {
  keys: Keys;
  gateRecords?: Record<string, GateRecord>;
}

interface VaultState {
  status: 'empty' | 'locked' | 'unlocked';
  booting: boolean;
  keys: Keys;
  gateRecords: Record<string, GateRecord>;
  lastActivity: number;
  init(): void;
  createVault(pass: string): Promise<void>;
  unlock(pass: string): Promise<boolean>;
  lock(): void;
  setKey(p: ProviderId, key: string): Promise<void>;
  removeKey(p: ProviderId): Promise<void>;
  hasAnyKey(): boolean;
  touch(): void;
  setGateRecord(p: ProviderId, rec: GateRecord): Promise<void>;
  removeGateRecord(p: ProviderId): Promise<void>;
}

/**
 * Passphrase lives ONLY here in memory — never persisted, never exported.
 * It is also sent to the Web Worker for Argon2id derivation but never stored there.
 */
let passRef: string | null = null;

async function persist(payload: SealedPayload): Promise<void> {
  if (!passRef) return;
  const blob = await encryptJson(payload, passRef);
  await setSealedVault(blob);
}

const seal = (get: () => VaultState): SealedPayload => ({
  keys: get().keys,
  gateRecords: get().gateRecords,
});

export const useVaultStore = create<VaultState>((set, get) => ({
  status: 'empty',
  booting: true,
  keys: {},
  gateRecords: {},
  lastActivity: Date.now(),

  async init() {
    if (get().status === 'unlocked') {
      set({ booting: false });
      return; // never downgrade a live session
    }
    passRef = null;
    try {
      const blob = await getSealedVault();
      set({ status: blob ? 'locked' : 'empty', keys: {}, gateRecords: {}, booting: false });
    } catch {
      set({ status: 'empty', keys: {}, gateRecords: {}, booting: false });
    }
  },

  async createVault(pass) {
    passRef = pass;
    await persist(seal(get));
    set({ status: 'unlocked', lastActivity: Date.now() });
  },

  async unlock(pass) {
    try {
      const blob: VaultBlob | null = await getSealedVault();
      if (!blob) return false;
      const payload = await decryptJson<SealedPayload | Keys>(blob, pass);
      // Legacy blobs sealed only the keys map.
      const sealed = 'keys' in payload ? (payload as SealedPayload) : { keys: payload as Keys };
      passRef = pass;
      set({
        keys: sealed.keys ?? {},
        gateRecords: sealed.gateRecords ?? {},
        status: 'unlocked',
        lastActivity: Date.now(),
      });
      return true;
    } catch {
      return false;
    }
  },

  lock() {
    passRef = null;
    set((st) => ({
      status: st.status === 'empty' ? 'empty' : 'locked',
      keys: {},
      gateRecords: {},
    }));
  },

  async setKey(p, key) {
    if (get().status !== 'unlocked' || !key.trim()) return;
    set({ keys: { ...get().keys, [p]: key.trim() } });
    await persist(seal(get));
  },

  async removeKey(p) {
    if (get().status !== 'unlocked') return;
    const keys = { ...get().keys };
    delete keys[p];
    set({ keys });
    await persist(seal(get));
  },

  async setGateRecord(p, rec) {
    if (get().status !== 'unlocked') return;
    set({ gateRecords: { ...get().gateRecords, [p]: rec } });
    await persist(seal(get));
  },

  async removeGateRecord(p) {
    if (get().status !== 'unlocked') return;
    const gateRecords = { ...get().gateRecords };
    delete gateRecords[p];
    set({ gateRecords });
    await persist(seal(get));
  },

  hasAnyKey() {
    return Object.keys(get().keys).length > 0;
  },

  touch() {
    set({ lastActivity: Date.now() });
  },
}));
