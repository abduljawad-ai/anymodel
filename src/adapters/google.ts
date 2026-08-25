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
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 2048,
        ...(typeof req.temperature === 'number' ? { temperature: req.temperature } : {}),
      },
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

}
