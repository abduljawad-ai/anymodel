import type { ProviderId, ProviderMeta } from './types';

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

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
