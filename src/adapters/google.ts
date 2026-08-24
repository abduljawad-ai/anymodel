import { readSSE } from '../lib/sse';
import { fetchWithRetry } from '../lib/net';
import { parseDataUrl } from '../lib/dataurl';
import { assertOk } from './http';
import {
  ApiError,
  type AdapterDeps,
  type ChatRequest,
  type ConnectionResult,
  type ProviderAdapter,
  type StreamSignals,
  type VideoGenOpts,
  type VideoJobHandle,
  type VideoJobStatus,
} from './types';

/** Google Generative Language wire format (v1beta), SSE with non-stream fallback. */
export class GoogleAdapter implements ProviderAdapter {
  constructor(private deps: AdapterDeps) {}

  private get base(): string {
    return this.deps.baseUrl.replace(/\/+$/, '');
  }

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = { 'x-goog-api-key': this.deps.apiKey() ?? '' };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  private toBody(req: ChatRequest): string {
    const systemParts = req.messages.filter((m) => m.role === 'system').map((m) => ({ text: m.content }));
    const contents = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        const parts: Array<Record<string, unknown>> = [{ text: m.content }];
        if (m.imageUrl && m.role === 'user') {
          const p = parseDataUrl(m.imageUrl);
          if (p && p.mediaType.startsWith('image/')) {
            parts.push({ inline_data: { mime_type: p.mediaType, data: p.base64 } });
          }
        }
        return { role: m.role === 'assistant' ? 'model' : 'user', parts };
      });
    return JSON.stringify({
      contents,
      ...(systemParts.length ? { systemInstruction: { parts: systemParts } } : {}),
      generationConfig: { maxOutputTokens: req.maxTokens ?? 2048 },
    });
  }

  async streamChat(req: ChatRequest, signals: StreamSignals): Promise<void> {
    const body = this.toBody(req);
    let res: Response;
    try {
      res = await fetchWithRetry(`${this.base}/models/${req.model}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: this.headers(),
        body,
        signal: signals.signal,
      });
      await assertOk(res);
      for await (const ev of readSSE(res.body!)) {
        try {
          const parts = JSON.parse(ev.data)?.candidates?.[0]?.content?.parts as
            | Array<{ text?: string }>
            | undefined;
          const text = (parts ?? []).map((p) => p.text ?? '').join('');
          if (text) signals.onDelta(text);
        } catch {
          /* skip malformed frame */
        }
      }
      signals.onDone();
      return;
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 404) throw e;
      // fall through to non-stream fallback
    }

    // Non-stream fallback — single delta.
    const res2 = await fetchWithRetry(`${this.base}/models/${req.model}:generateContent`, {
      method: 'POST',
      headers: this.headers(),
      body,
      signal: signals.signal,
    });
    await assertOk(res2);
    const j = await res2.json();
    const parts = (j.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string }>;
    const text = parts.map((p) => p.text ?? '').join('');
    if (text) signals.onDelta(text);
    signals.onDone();
  }

  private unsupported(op: string): never {
    throw new ApiError(501, `Google does not expose ${op} via this endpoint.`);
  }
  async listModels(): Promise<string[]> {
    const res = await fetchWithRetry(`${this.base}/models`, { headers: this.headers(false) });
    await assertOk(res);
    const models = (await res.json()).models as Array<{
      name: string;
      supportedGenerationMethods?: string[];
    }>;
    return models
      .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));
  }
  async transcribe(_audio?: Blob, _modelId?: string): Promise<string> {
    this.unsupported('transcription');
  }
  async speak(_text?: string, _modelId?: string): Promise<Blob> {
    this.unsupported('speech');
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

  /** Text-to-video via Veo predictLongRunning. Returns an operation handle. */
  async generateVideo(opts: VideoGenOpts): Promise<VideoJobHandle> {
    const model = opts.model || 'veo-3.0-generate-preview';
    const res = await fetchWithRetry(`${this.base}/models/${model}:predictLongRunning`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        instances: [{ prompt: opts.prompt }],
        parameters: {
          aspectRatio: '16:9',
          ...(opts.seconds ? { durationSeconds: opts.seconds } : {}),
        },
      }),
    });
    await assertOk(res);
    const json = (await res.json()) as { name?: string };
    if (!json.name) throw new Error('Provider returned no operation name');
    return { jobId: json.name };
  }

  /** Poll a Veo operation until it resolves. */
  async getVideoStatus(job: VideoJobHandle): Promise<VideoJobStatus> {
    const res = await fetchWithRetry(`${this.base}/${job.jobId}`, {
      headers: this.headers(false),
    });
    await assertOk(res);
    const json = (await res.json()) as {
      done?: boolean;
      error?: { message?: string };
      response?: {
        generateVideoResponse?: {
          generatedSamples?: Array<{ video?: { uri?: string } }>;
        };
      };
    };
    if (json.error) {
      return { status: 'failed', error: json.error.message ?? 'Video generation failed' };
    }
    if (!json.done) {
      return { status: 'processing' };
    }
    const uri = json.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (!uri) return { status: 'failed', error: 'Operation finished but returned no video' };
    // Stash the URI on the handle for getVideoContent.
    videoUris.set(job.jobId, uri);
    return { status: 'completed', progress: 100 };
  }

  /** Download the finished Veo video (auth via API key header). */
  async getVideoContent(job: VideoJobHandle): Promise<Blob> {
    const uri = videoUris.get(job.jobId);
    if (!uri) throw new Error('No video URI — poll the job to completion first');
    const res = await fetchWithRetry(uri, { headers: this.headers(false) });
    await assertOk(res);
    return res.blob();
  }
}

/** Operation id → finished video URI (memory-only, per session). */
const videoUris = new Map<string, string>();
