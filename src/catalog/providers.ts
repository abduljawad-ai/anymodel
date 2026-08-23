import type { BuiltinProviderId, ProviderId, ProviderMeta } from './types';
import { loadSettings } from '../state/settings';

/** Muted per-provider identity tints (used for badges/dots). */
export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai',
    tint: '#4E9B7F',
    defaultBase: 'https://api.openai.com/v1',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    kind: 'anthropic',
    tint: '#C96F4A',
    defaultBase: 'https://api.anthropic.com/v1',
  },
  google: {
    id: 'google',
    name: 'Google',
    kind: 'google',
    tint: '#6E8EF7',
    defaultBase: 'https://generativelanguage.googleapis.com/v1beta',
  },
  compatible: {
    id: 'compatible',
    name: 'Compatible',
    kind: 'compatible',
    tint: '#8A94A0',
    defaultBase: 'http://localhost:11434/v1',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as BuiltinProviderId[];

export function tintFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hues = ['#4E9B7F', '#C96F4A', '#6E8EF7', '#8A94A0', '#B0836F', '#7F8FA6'];
  return hues[h % hues.length];
}

function customMetas(): ProviderMeta[] {
  return loadSettings().customProviders.map((c) => ({
    id: c.id,
    name: c.name,
    kind: 'compatible' as const,
    tint: tintFor(c.id),
    defaultBase: c.baseUrl,
  }));
}

/** All providers = builtins + user-registered customs. */
export function listProviders(): ProviderMeta[] {
  return [...Object.values(PROVIDERS), ...customMetas()];
}

export function getProviderMeta(id: ProviderId): ProviderMeta | undefined {
  return PROVIDERS[id as BuiltinProviderId] ?? customMetas().find((m) => m.id === id);
}
