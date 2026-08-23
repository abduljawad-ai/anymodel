import type { BuiltinKind, ProviderId, ProviderMeta } from './types';
import { loadSettings } from '../state/settings';

/**
 * The provider DIRECTORY — ~20 famous providers with their base URLs and a
 * few suggested models. This is convenience metadata, not a limit: live
 * /models discovery always wins once the user loads a provider, and custom
 * providers can be added freely.
 */
export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  openai: {
    id: 'openai', name: 'OpenAI', kind: 'openai', tint: '#4E9B7F',
    defaultBase: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys',
    popular: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  },
  anthropic: {
    id: 'anthropic', name: 'Anthropic', kind: 'anthropic', tint: '#C96F4A',
    defaultBase: 'https://api.anthropic.com/v1', keyUrl: 'https://console.anthropic.com/settings/keys',
    popular: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
  },
  google: {
    id: 'google', name: 'Google Gemini', kind: 'google', tint: '#6E8EF7',
    defaultBase: 'https://generativelanguage.googleapis.com/v1beta', keyUrl: 'https://aistudio.google.com/apikey',
    popular: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  },
  groq: {
    id: 'groq', name: 'Groq', kind: 'compatible', tint: '#8A5A44',
    defaultBase: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys',
    popular: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  deepseek: {
    id: 'deepseek', name: 'DeepSeek', kind: 'compatible', tint: '#4F6BED',
    defaultBase: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys',
    popular: ['deepseek-chat', 'deepseek-reasoner'],
  },
  mistral: {
    id: 'mistral', name: 'Mistral AI', kind: 'compatible', tint: '#D97A29',
    defaultBase: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys',
    popular: ['mistral-large-latest', 'mistral-small-latest'],
  },
  xai: {
    id: 'xai', name: 'xAI Grok', kind: 'compatible', tint: '#555555',
    defaultBase: 'https://api.x.ai/v1', keyUrl: 'https://console.x.ai',
    popular: ['grok-3', 'grok-3-mini'],
  },
  openrouter: {
    id: 'openrouter', name: 'OpenRouter', kind: 'compatible', tint: '#7C6FD0',
    defaultBase: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys',
    popular: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.3-70b-instruct'],
  },
  together: {
    id: 'together', name: 'Together AI', kind: 'compatible', tint: '#3B7EA1',
    defaultBase: 'https://api.together.xyz/v1', keyUrl: 'https://api.together.ai/settings/api-keys',
    popular: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'deepseek-ai/DeepSeek-V3'],
  },
  fireworks: {
    id: 'fireworks', name: 'Fireworks AI', kind: 'compatible', tint: '#B04A4A',
    defaultBase: 'https://api.fireworks.ai/inference/v1', keyUrl: 'https://fireworks.ai/account/api-keys',
    popular: ['accounts/fireworks/models/llama-v3p3-70b-instruct'],
  },
  cerebras: {
    id: 'cerebras', name: 'Cerebras', kind: 'compatible', tint: '#C96F4A',
    defaultBase: 'https://api.cerebras.ai/v1', keyUrl: 'https://cloud.cerebras.ai',
    popular: ['llama-3.3-70b', 'llama3.1-8b'],
  },
  perplexity: {
    id: 'perplexity', name: 'Perplexity', kind: 'compatible', tint: '#20808D',
    defaultBase: 'https://api.perplexity.ai', keyUrl: 'https://www.perplexity.ai/settings/api',
    popular: ['sonar', 'sonar-pro'],
  },
  cohere: {
    id: 'cohere', name: 'Cohere', kind: 'compatible', tint: '#8A6FA8',
    defaultBase: 'https://api.cohere.ai/compatibility/v1', keyUrl: 'https://dashboard.cohere.com/api-keys',
    popular: ['command-r-plus-08-2024', 'command-r7b-12-20241219'],
  },
  nvidia: {
    id: 'nvidia', name: 'NVIDIA NIM', kind: 'compatible', tint: '#76B900',
    defaultBase: 'https://integrate.api.nvidia.com/v1', keyUrl: 'https://build.nvidia.com/explore/discover',
    popular: ['meta/llama-3.3-70b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct'],
  },
  ai21: {
    id: 'ai21', name: 'AI21 Jamba', kind: 'compatible', tint: '#A15E75',
    defaultBase: 'https://api.ai21.com/studio/v1', keyUrl: 'https://studio.ai21.com/api-keys',
    popular: ['jamba-1.5-mini', 'jamba-1.5-large'],
  },
  ollama: {
    id: 'ollama', name: 'Ollama (local)', kind: 'compatible', tint: '#6B7280', local: true,
    defaultBase: 'http://localhost:11434/v1', keyUrl: 'https://ollama.com/download',
  },
  lmstudio: {
    id: 'lmstudio', name: 'LM Studio (local)', kind: 'compatible', tint: '#946B54', local: true,
    defaultBase: 'http://localhost:1234/v1', keyUrl: 'https://lmstudio.ai',
  },
  vllm: {
    id: 'vllm', name: 'vLLM (local)', kind: 'compatible', tint: '#5E8C61', local: true,
    defaultBase: 'http://localhost:8000/v1', keyUrl: 'https://docs.vllm.ai',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);

/** Deterministic muted tint for ids without an explicit one (customs). */
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
    kind: 'compatible' as BuiltinKind,
    tint: tintFor(c.id),
    defaultBase: c.baseUrl,
  }));
}

/** Directory entries + user-registered customs. */
export function listProviders(): ProviderMeta[] {
  const customs = new Set(loadSettings().customProviders.map((c) => c.id));
  const builtin = Object.values(PROVIDERS).filter((m) => !customs.has(m.id));
  return [...builtin, ...customMetas()];
}

export function getProviderMeta(id: ProviderId): ProviderMeta | undefined {
  return (
    PROVIDERS[id] ??
    customMetas().find((m) => m.id === id)
  );
}
