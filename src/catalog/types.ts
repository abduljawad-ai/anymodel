export type ProviderId = 'openai' | 'anthropic' | 'google' | 'compatible';
export type Capability = 'vision' | 'stt' | 'tts' | 'reasoning' | 'tools';

export interface ModelInfo {
  id: string;
  providerId: ProviderId;
  label: string;
  caps: Capability[];
}

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  /** Wire-format family used by the adapter factory. */
  kind: 'openai' | 'anthropic' | 'google' | 'compatible';
  tint: string;
  defaultBase: string;
}
