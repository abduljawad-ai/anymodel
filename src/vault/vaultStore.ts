import { create } from 'zustand';
import { decryptJson, encryptJson, type VaultBlob } from './crypto';
import type { ProviderId } from '../catalog/types';

const LS_VAULT = 'relay.vault.v1';
const SS_PASS = 'relay.session.pass'; // cleared when the browser closes or the user locks
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

/** Passphrase lives ONLY here in memory — never persisted, never exported. */
let passRef: string | null = null;

async function persist(payload: SealedPayload): Promise<void> {
  if (!passRef) return;
  const blob = await encryptJson(payload, passRef);
  localStorage.setItem(LS_VAULT, JSON.stringify(blob));
}

const seal = (get: () => VaultState): SealedPayload => ({ keys: get().keys, gateRecords: get().gateRecords });

export const useVaultStore = create<VaultState>((set, get) => ({
  status: 'empty',
  keys: {},
  gateRecords: {},
  lastActivity: Date.now(),
  init() {
    if (get().status === 'unlocked') return; // never downgrade a live session
    passRef = null;
    const raw = localStorage.getItem(LS_VAULT);
    set({ status: raw ? 'locked' : 'empty', keys: {}, gateRecords: {} });
    // Same-tab-session auto-unlock: skip the passphrase after refreshes.
    const remembered = sessionStorage.getItem(SS_PASS);
    if (raw && remembered) {
      void get()
        .unlock(remembered)
        .then((ok) => {
          if (!ok) sessionStorage.removeItem(SS_PASS);
        });
    }
  },
  async createVault(pass) {
    passRef = pass;
    sessionStorage.setItem(SS_PASS, pass);
    await persist(seal(get));
    set({ status: 'unlocked', lastActivity: Date.now() });
  },
  async unlock(pass) {
    const raw = localStorage.getItem(LS_VAULT);
    if (!raw) return false;
    try {
      const blob = JSON.parse(raw) as VaultBlob;
      const payload = await decryptJson<SealedPayload | Keys>(blob, pass);
      // Legacy blobs sealed only the keys map.
      const sealed = 'keys' in payload ? (payload as SealedPayload) : { keys: payload as Keys };
      passRef = pass;
      sessionStorage.setItem(SS_PASS, pass);
      set({ keys: sealed.keys ?? {}, gateRecords: sealed.gateRecords ?? {}, status: 'unlocked', lastActivity: Date.now() });
      return true;
    } catch {
      return false;
    }
  },
  lock() {
    passRef = null;
    sessionStorage.removeItem(SS_PASS);
    set((st) => ({ status: st.status === 'empty' ? 'empty' : 'locked', keys: {}, gateRecords: {} }));
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
