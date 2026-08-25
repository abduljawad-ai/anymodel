export type BuiltinKind = 'openai' | 'anthropic' | 'google' | 'compatible';
/** Any string — directory ids and user-registered custom providers alike. */
export type ProviderId = string;
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
  /** Wire format used to pick the adapter. */
  kind: BuiltinKind;
  tint: string;
  defaultBase: string;
  /** Where users get an API key (directory providers). */
  keyUrl?: string;
  /** A few suggested model ids shown before the live fetch — never a limit. */
  popular?: string[];
  /** True for localhost development endpoints (http allowed). */
  local?: boolean;
}
