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

/* ---------- Generation (Studio) ---------- */

export interface ImageGenOpts {
  prompt: string;
  model: string;
  size?: string;
  quality?: string;
  n?: number;
}

export interface ImageGenResult {
  /** data URLs or remote URLs of generated images */
  images: string[];
  revisedPrompt?: string;
}

export interface VideoGenOpts {
  prompt: string;
  model: string;
  seconds?: number;
  size?: string;
}

/** Provider-side video job handle (e.g. Sora / Veo long-running operations). */
export interface VideoJobHandle {
  jobId: string;
}

export interface VideoJobStatus {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number; // 0..100
  error?: string;
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
  /** Text-to-image. Optional — providers without image gen omit it. */
  generateImage?(opts: ImageGenOpts): Promise<ImageGenResult>;
  /** Kick off text-to-video. Optional. */
  generateVideo?(opts: VideoGenOpts): Promise<VideoJobHandle>;
  /** Poll a video job's status. Optional. */
  getVideoStatus?(job: VideoJobHandle): Promise<VideoJobStatus>;
  /** Fetch the finished video as a Blob. Optional. */
  getVideoContent?(job: VideoJobHandle): Promise<Blob>;
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
