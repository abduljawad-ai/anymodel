export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** data URL for vision-capable user turns */
  imageUrl?: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

export interface StreamSignals {
  onDelta(text: string): void;
  /** Optional reasoning/thinking stream (o-series, DeepSeek-style, Claude thinking). */
  onReasoning?(text: string): void;
  onDone(): void;
  signal: AbortSignal;
}

export interface ConnectionResult {
  ok: boolean;
  detail: string;
}

export interface AdapterDeps {
  baseUrl: string;
  apiKey: () => string | undefined;
}

/** One contract, four wire formats. */
export interface ProviderAdapter {
  /** Live model ids from the provider's own API (implemented per adapter). */
  listModels(): Promise<string[]>;
  streamChat(req: ChatRequest, signals: StreamSignals): Promise<void>;
  transcribe(audio: Blob, modelId: string): Promise<string>;
  speak(text: string, modelId: string): Promise<Blob>;
  testConnection(): Promise<ConnectionResult>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
