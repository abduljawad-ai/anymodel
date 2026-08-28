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
  /** Global custom instructions — prepended as a system message to every chat. */
  systemPrompt: string;
  /** Sampling temperature (provider-supported models). */
  temperature: number;
  /** Custom base URL per provider ('' or missing → PROVIDERS.defaultBase). */
  bases: Partial<Record<ProviderId, string>>;
  lastModel: { providerId: ProviderId; modelId: string };
  /** Favorite models for quick access in palette */
  favoriteModels: Array<{ providerId: ProviderId; modelId: string; label: string }>;
}

export const DEFAULT_SETTINGS: RelaySettings = {
  theme: 'light',
  autoLockMin: 15,
  contextBudgetTokens: 12000,
  customProviders: [],
  gateUrl: '',
  systemPrompt: '',
  temperature: 0.7,
  bases: {},
  lastModel: { providerId: 'openai', modelId: 'gpt-4o' },
  favoriteModels: [],
};

export function loadSettings(): RelaySettings {
  let parsed = {};
  try {
    parsed = JSON.parse(localStorage.getItem(LS_SETTINGS) ?? '{}');
  } catch {}
  
  const settings = { ...DEFAULT_SETTINGS, ...parsed };
  if (typeof settings.autoLockMin !== 'number' || settings.autoLockMin < 1) {
    settings.autoLockMin = 15;
  }
  return settings;
}

export function saveSettings(patch: Partial<RelaySettings>): void {
  localStorage.setItem(LS_SETTINGS, JSON.stringify({ ...loadSettings(), ...patch }));
}
