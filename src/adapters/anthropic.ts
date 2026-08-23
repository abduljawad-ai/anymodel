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

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/** Anthropic Messages wire format. Direct browser calls need the dangerous-access opt-in header. */
export class AnthropicAdapter implements ProviderAdapter {
  constructor(private deps: AdapterDeps) {}

  private get base(): string {
    return this.deps.baseUrl.replace(/\/+$/, '');
  }

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = {
      'x-api-key': this.deps.apiKey() ?? '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  async streamChat(req: ChatRequest, signals: StreamSignals): Promise<void> {
    const system = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const messages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        const content: Array<Record<string, unknown>> = [{ type: 'text', text: m.content }];
        if (m.imageUrl && m.role === 'user') {
          const p = parseDataUrl(m.imageUrl);
          if (p && IMAGE_MIME.has(p.mediaType)) {
            content.push({ type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.base64 } });
          }
        }
        return { role: m.role, content };
      });

    const res = await fetch(`${this.base}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.maxTokens ?? 2048,
        ...(system ? { system } : {}),
        messages,
      }),
      signal: signals.signal,
    });
    await assertOk(res);

    for await (const ev of readSSE(res.body!)) {
      try {
        const j = JSON.parse(ev.data);
        if (j.type === 'content_block_delta' && typeof j.delta?.text === 'string') {
          signals.onDelta(j.delta.text);
        } else if (j.type === 'message_stop') {
          break;
        } else if (j.type === 'error') {
          throw new ApiError(500, j.error?.message ?? 'stream error');
        }
      } catch (e) {
        if (e instanceof ApiError) throw e;
        /* skip malformed frame */
      }
    }
    signals.onDone();
  }

  private unsupported(op: string): never {
    throw new ApiError(501, `Anthropic does not expose ${op} — use an OpenAI or compatible provider.`);
  }
  async transcribe(): Promise<string> {
    this.unsupported('transcription');
  }
  async speak(): Promise<Blob> {
    this.unsupported('speech');
  }
  async embed(): Promise<number[][]> {
    this.unsupported('embeddings');
  }
  async moderate(): Promise<ModerationResult> {
    this.unsupported('moderation');
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      const res = await fetch(`${this.base}/messages`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
        }),
      });
      await assertOk(res);
      return { ok: true, detail: 'connected' };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }
}
