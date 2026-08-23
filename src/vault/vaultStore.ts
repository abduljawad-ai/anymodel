import { create } from 'zustand';
import { decryptJson, encryptJson, type VaultBlob } from './crypto';
import type { ProviderId } from '../catalog/types';

const LS_VAULT = 'relay.vault.v1';
type Keys = Partial<Record<ProviderId, string>>;

interface VaultState {
  status: 'empty' | 'locked' | 'unlocked';
  keys: Keys;
  lastActivity: number;
  init(): void;
  createVault(pass: string): Promise<void>;
  unlock(pass: string): Promise<boolean>;
  lock(): void;
  setKey(p: ProviderId, key: string): Promise<void>;
  removeKey(p: ProviderId): Promise<void>;
  hasAnyKey(): boolean;
  touch(): void;
}

/** Passphrase lives ONLY here in memory — never persisted, never exported. */
let passRef: string | null = null;

async function persist(keys: Keys): Promise<void> {
  if (!passRef) return;
  const blob = await encryptJson(keys, passRef);
  localStorage.setItem(LS_VAULT, JSON.stringify(blob));
}

export const useVaultStore = create<VaultState>((set, get) => ({
  status: 'empty',
  keys: {},
  lastActivity: Date.now(),
  init() {
    passRef = null;
    const raw = localStorage.getItem(LS_VAULT);
    set({ status: raw ? 'locked' : 'empty', keys: {} });
  },
  async createVault(pass) {
    passRef = pass;
    await persist(get().keys);
    set({ status: 'unlocked', lastActivity: Date.now() });
  },
  async unlock(pass) {
    const raw = localStorage.getItem(LS_VAULT);
    if (!raw) return false;
    try {
      const blob = JSON.parse(raw) as VaultBlob;
      const keys = await decryptJson<Keys>(blob, pass);
      passRef = pass;
      set({ keys, status: 'unlocked', lastActivity: Date.now() });
      return true;
    } catch {
      return false;
    }
  },
  lock() {
    passRef = null;
    set((st) => ({ status: st.status === 'empty' ? 'empty' : 'locked', keys: {} }));
  },
  async setKey(p, key) {
    if (get().status !== 'unlocked' || !key.trim()) return;
    const keys = { ...get().keys, [p]: key.trim() };
    await persist(keys);
    set({ keys });
  },
  async removeKey(p) {
    if (get().status !== 'unlocked') return;
    const keys = { ...get().keys };
    delete keys[p];
    await persist(keys);
    set({ keys });
  },
  hasAnyKey() {
    return Object.keys(get().keys).length > 0;
  },
  touch() {
    set({ lastActivity: Date.now() });
  },
}));
