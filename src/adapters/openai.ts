import { readSSE } from '../lib/sse';
import type {
  AdapterDeps,
  ChatRequest,
  ConnectionResult,
  ImageGenOpts,
  ImageGenResult,
  ProviderAdapter,
  StreamSignals,
  VideoGenOpts,
  VideoJobHandle,
  VideoJobStatus,
} from './types';
import { assertOk } from './http';
import { fetchWithRetry } from '../lib/net';

/** OpenAI wire format — also the base for OpenAI-compatible endpoints. */
export class OpenAIAdapter implements ProviderAdapter {
  constructor(protected deps: AdapterDeps) {}

  protected get base(): string {
    return this.deps.baseUrl.replace(/\/+$/, '');
  }

  protected headers(json = true): Record<string, string> {
    const h: Record<string, string> = {};
    if (json) h['Content-Type'] = 'application/json';
    const k = this.deps.apiKey();
    if (k) h.Authorization = `Bearer ${k}`;
    return h;
  }

  async listModels(): Promise<string[]> {
    const res = await fetchWithRetry(`${this.base}/models`, { headers: this.headers(false) });
    await assertOk(res);
    const ids = ((await res.json()).data as Array<{ id: string }>).map((m) => m.id);
    return [...new Set(ids)].sort();
  }

  async streamChat(req: ChatRequest, signals: StreamSignals): Promise<void> {
    const messages = req.messages.map((m) =>
      m.imageUrl && m.role === 'user'
        ? {
            role: m.role,
            content: [
              { type: 'text', text: m.content },
              { type: 'image_url', image_url: { url: m.imageUrl } },
            ],
          }
        : { role: m.role, content: m.content },
    );
    const res = await fetchWithRetry(`${this.base}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: req.model,
        messages,
        max_tokens: req.maxTokens ?? 2048,
        stream: true,
      }),
      signal: signals.signal,
    });
    await assertOk(res);
    for await (const ev of readSSE(res.body!)) {
      if (ev.data === '[DONE]') break;
      try {
        const d = JSON.parse(ev.data)?.choices?.[0]?.delta;
        const rc = d?.reasoning_content ?? d?.reasoning;
        if (typeof rc === 'string' && rc) signals.onReasoning?.(rc);
        if (typeof d?.content === 'string' && d.content) signals.onDelta(d.content);
      } catch {
        /* skip malformed frame */
      }
    }
    signals.onDone();
  }

  async transcribe(audio: Blob, modelId: string): Promise<string> {
    const form = new FormData();
    form.append('file', audio, 'audio.webm');
    form.append('model', modelId || 'whisper-1');
    const res = await fetchWithRetry(`${this.base}/audio/transcriptions`, {
      method: 'POST',
      headers: this.headers(false),
      body: form,
    });
    await assertOk(res);
    return (await res.json()).text as string;
  }

  async speak(text: string, modelId: string): Promise<Blob> {
    const res = await fetchWithRetry(`${this.base}/audio/speech`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: modelId || 'tts-1',
        input: text,
        voice: 'alloy',
        response_format: 'mp3',
      }),
    });
    await assertOk(res);
    return res.blob();
  }



  async testConnection(): Promise<ConnectionResult> {
    try {
      const res = await fetchWithRetry(`${this.base}/models`, { headers: this.headers(false) });
      await assertOk(res);
      return { ok: true, detail: 'connected' };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Text-to-image via /images/generations (dall-e-3, gpt-image-1). */
  async generateImage(opts: ImageGenOpts): Promise<ImageGenResult> {
    const body: Record<string, unknown> = {
      model: opts.model || 'gpt-image-1',
      prompt: opts.prompt,
      n: opts.n ?? 1,
    };
    if (opts.size) body.size = opts.size;
    // dall-e-3 accepts quality; gpt-image-1 accepts quality too. Harmless otherwise.
    if (opts.quality) body.quality = opts.quality;

    const res = await fetchWithRetry(`${this.base}/images/generations`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    await assertOk(res);
    const json = (await res.json()) as {
      data?: Array<{ url?: string; b64_json?: string }>;
    };
    const images = (json.data ?? [])
      .map((d) => (d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url))
      .filter((u): u is string => Boolean(u));
    if (images.length === 0) throw new Error('Provider returned no images');
    return { images };
  }

  /** Text-to-video via /videos (Sora). Returns a job handle for polling. */
  async generateVideo(opts: VideoGenOpts): Promise<VideoJobHandle> {
    const form = new FormData();
    form.append('model', opts.model || 'sora-2');
    form.append('prompt', opts.prompt);
    form.append('seconds', String(opts.seconds ?? 4));
    if (opts.size) form.append('size', opts.size);
    const res = await fetchWithRetry(`${this.base}/videos`, {
      method: 'POST',
      headers: this.headers(false),
      body: form,
    });
    await assertOk(res);
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new Error('Provider returned no video job id');
    return { jobId: json.id };
  }

  /** Poll a Sora video job. */
  async getVideoStatus(job: VideoJobHandle): Promise<VideoJobStatus> {
    const res = await fetchWithRetry(`${this.base}/videos/${encodeURIComponent(job.jobId)}`, {
      headers: this.headers(false),
    });
    await assertOk(res);
    const json = (await res.json()) as {
      status?: string;
      progress?: number;
      error?: { message?: string } | string | null;
    };
    const map: Record<string, VideoJobStatus['status']> = {
      queued: 'queued',
      in_progress: 'processing',
      processing: 'processing',
      completed: 'completed',
      failed: 'failed',
    };
    const status = map[json.status ?? ''] ?? 'processing';
    const err =
      typeof json.error === 'string'
        ? json.error
        : json.error && typeof json.error === 'object'
          ? json.error.message
          : undefined;
    return {
      status,
      progress: typeof json.progress === 'number' ? json.progress : undefined,
      error: status === 'failed' ? (err ?? 'Video generation failed') : undefined,
    };
  }

  /** Fetch the finished video bytes. */
  async getVideoContent(job: VideoJobHandle): Promise<Blob> {
    const res = await fetchWithRetry(
      `${this.base}/videos/${encodeURIComponent(job.jobId)}/content`,
      { headers: this.headers(false) },
    );
    await assertOk(res);
    return res.blob();
  }
}
