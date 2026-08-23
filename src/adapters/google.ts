import { readSSE } from '../lib/sse';
import { parseDataUrl } from '../lib/dataurl';
import { assertOk } from './http';
import {
  ApiError,
  type AdapterDeps,
  type ChatRequest,
  type ConnectionResult,
  type ModerationResult,
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
      generationConfig: { maxOutputTokens: req.maxTokens ?? 2048 },
    });
  }

  async streamChat(req: ChatRequest, signals: StreamSignals): Promise<void> {
    const body = this.toBody(req);
    let res: Response;
    try {
      res = await fetch(`${this.base}/models/${req.model}:streamGenerateContent?alt=sse`, {
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
    const res2 = await fetch(`${this.base}/models/${req.model}:generateContent`, {
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
  async transcribe(): Promise<string> {
    this.unsupported('transcription');
  }
  async speak(): Promise<Blob> {
    this.unsupported('speech');
  }
  async moderate(): Promise<ModerationResult> {
    this.unsupported('moderation');
  }

  async embed(inputs: string[], modelId: string): Promise<number[][]> {
    const out: number[][] = [];
    for (const text of inputs) {
      const res = await fetch(`${this.base}/models/${modelId || 'text-embedding-004'}:embedContent`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ content: { parts: [{ text }] } }),
      });
      await assertOk(res);
      out.push(((await res.json()).embedding as { values: number[] }).values);
    }
    return out;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      const res = await fetch(`${this.base}/models`, { headers: this.headers(false) });
      await assertOk(res);
      return { ok: true, detail: 'connected' };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }
}
