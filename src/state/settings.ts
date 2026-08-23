import type { ProviderId } from '../catalog/types';

const LS_SETTINGS = 'relay.settings.v1';

export interface RelaySettings {
  theme: 'light' | 'dark';
  autoLockMin: number;
  /** History token budget before compaction kicks in. */
  contextBudgetTokens: number;
  /** User-registered OpenAI-compatible providers (nothing about models is hardcoded). */
  customProviders: Array<{ id: string; name: string; baseUrl: string }>;
  /** relay-gate base URL — when set + enrolled, traffic takes split-key custody. */
  gateUrl: string;
  /** Custom base URL per provider ('' or missing → PROVIDERS.defaultBase). */
  bases: Partial<Record<ProviderId, string>>;
  lastModel: { providerId: ProviderId; modelId: string };
}

export const DEFAULT_SETTINGS: RelaySettings = {
  theme: 'light',
  autoLockMin: 15,
  contextBudgetTokens: 12000,
  customProviders: [],
  gateUrl: '',
  bases: {},
  lastModel: { providerId: 'openai', modelId: 'gpt-4o' },
};

export function loadSettings(): RelaySettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(LS_SETTINGS) ?? '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch: Partial<RelaySettings>): void {
  localStorage.setItem(LS_SETTINGS, JSON.stringify({ ...loadSettings(), ...patch }));
}
