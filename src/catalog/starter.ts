import type { ModelInfo, ProviderId } from './types';

const m = (providerId: ProviderId, id: string, label: string, ...caps: ModelInfo['caps']): ModelInfo => ({
  id,
  providerId,
  label,
  caps,
});

/** Curated offline catalog — the app works with zero network beyond API calls. */
export const STARTER_MODELS: ModelInfo[] = [
  m('openai', 'gpt-4o', 'GPT-4o', 'vision', 'tools'),
  m('openai', 'gpt-4o-mini', 'GPT-4o mini', 'vision', 'tools'),
  m('openai', 'o3-mini', 'o3-mini', 'reasoning'),
  m('openai', 'whisper-1', 'Whisper STT', 'stt'),
  m('openai', 'tts-1', 'TTS voice', 'tts'),
  m('openai', 'text-embedding-3-small', 'Embeddings small'),
  m('anthropic', 'claude-sonnet-4-20250514', 'Claude Sonnet 4', 'vision', 'tools', 'reasoning'),
  m('anthropic', 'claude-3-5-haiku-20241022', 'Claude Haiku 3.5', 'vision', 'tools'),
  m('google', 'gemini-2.0-flash', 'Gemini 2.0 Flash', 'vision', 'tools'),
  m('google', 'gemini-1.5-pro', 'Gemini 1.5 Pro', 'vision', 'reasoning'),
];
