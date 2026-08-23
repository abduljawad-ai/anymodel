import { readSSE } from '../lib/sse';
import type {
  AdapterDeps,
  ChatRequest,
  ConnectionResult,
  ModerationResult,
  ProviderAdapter,
  StreamSignals,
} from './types';
import { assertOk } from './http';

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
    const res = await fetch(`${this.base}/chat/completions`, {
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
        const delta = JSON.parse(ev.data)?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) signals.onDelta(delta);
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
    const res = await fetch(`${this.base}/audio/transcriptions`, {
      method: 'POST',
      headers: this.headers(false),
      body: form,
    });
    await assertOk(res);
    return (await res.json()).text as string;
  }

  async speak(text: string, modelId: string): Promise<Blob> {
    const res = await fetch(`${this.base}/audio/speech`, {
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

  async embed(inputs: string[], modelId: string): Promise<number[][]> {
    const res = await fetch(`${this.base}/embeddings`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: modelId || 'text-embedding-3-small', input: inputs }),
    });
    await assertOk(res);
    return ((await res.json()).data as Array<{ embedding: number[] }>).map((d) => d.embedding);
  }

  async moderate(input: string, _modelId: string): Promise<ModerationResult> {
    void _modelId; // OpenAI moderation uses its own default model
    const res = await fetch(`${this.base}/moderations`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ input }),
    });
    await assertOk(res);
    const r = ((await res.json()).results as ModerationResult[])[0];
    return { flagged: !!r?.flagged, categories: r?.categories ?? {} };
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
