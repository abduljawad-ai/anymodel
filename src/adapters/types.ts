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
  onDone(): void;
  signal: AbortSignal;
}

export interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
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
  streamChat(req: ChatRequest, signals: StreamSignals): Promise<void>;
  transcribe(audio: Blob, modelId: string): Promise<string>;
  speak(text: string, modelId: string): Promise<Blob>;
  embed(inputs: string[], modelId: string): Promise<number[][]>;
  moderate(input: string, modelId: string): Promise<ModerationResult>;
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
