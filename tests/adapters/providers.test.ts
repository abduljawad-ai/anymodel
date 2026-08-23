import { AnthropicAdapter } from '../../src/adapters/anthropic';
import { GoogleAdapter } from '../../src/adapters/google';
import { CompatibleAdapter } from '../../src/adapters/compatible';
import { OpenAIAdapter } from '../../src/adapters/openai';
import { streamFromStrings } from '../../src/lib/sse';

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (url, init) => handler(String(url), init));
}

describe('anthropic adapter', () => {
  const adapter = new AnthropicAdapter({ baseUrl: 'https://api.anthropic.test/v1', apiKey: () => 'ak-k' });

  test('streams text deltas and sends anthropic headers + system', async () => {
    const fm = mockFetch(
      () =>
        new Response(
          streamFromStrings([
            'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"He"}}\n\n',
            'event: message_stop\ndata: {"type":"message_stop"}\n\n',
          ]) as unknown as ReadableStream<Uint8Array>,
          { status: 200 },
        ),
    );
    const deltas: string[] = [];
    let done = false;
    await adapter.streamChat(
      {
        model: 'claude-x',
        messages: [
          { role: 'system', content: 'be brief' },
          { role: 'user', content: 'hi' },
        ],
      },
      { onDelta: (d) => deltas.push(d), onDone: () => (done = true), signal: new AbortController().signal },
    );
    expect(deltas.join('')).toBe('He');
    expect(done).toBe(true);
    const init = fm.mock.calls[0][1]!;
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('ak-k');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    const body = JSON.parse(String(init.body));
    expect(body.system).toBe('be brief');
    expect(body.messages[0].content[0].text).toBe('hi');
    fm.mockRestore();
  });

  test('image turn maps to base64 source block', async () => {
    const fm = mockFetch(
      () =>
        new Response(
          streamFromStrings(['event: message_stop\ndata: {"type":"message_stop"}\n\n']) as unknown as ReadableStream<Uint8Array>,
          { status: 200 },
        ),
    );
    await adapter.streamChat(
      { model: 'm', messages: [{ role: 'user', content: 'see', imageUrl: 'data:image/png;base64,QUJD' }] },
      { onDelta: () => {}, onDone: () => {}, signal: new AbortController().signal },
    );
    const body = JSON.parse(String(fm.mock.calls[0][1]!.body));
    expect(body.messages[0].content[1]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'QUJD' },
    });
    fm.mockRestore();
  });

  test('speech is unsupported (501)', async () => {
    await expect(adapter.speak('x', '')).rejects.toMatchObject({ status: 501 });
  });
});

describe('google adapter', () => {
  const adapter = new GoogleAdapter({
    baseUrl: 'https://generativelanguage.test/v1beta',
    apiKey: () => 'gk-k',
  });

  test('streams concatenated parts with api key header', async () => {
    const fm = mockFetch((url) => {
      expect(url).toContain(':streamGenerateContent?alt=sse');
      return new Response(
        streamFromStrings([
          'data: {"candidates":[{"content":{"parts":[{"text":"A"},{"text":"B"}]}}]}\n\n',
          'data: {"candidates":[{"content":{"parts":[{"text":"C"}]}}]}\n\n',
        ]) as unknown as ReadableStream<Uint8Array>,
        { status: 200 },
      );
    });
    const deltas: string[] = [];
    await adapter.streamChat(
      { model: 'gemini-x', messages: [{ role: 'user', content: 'hi' }] },
      { onDelta: (d) => deltas.push(d), onDone: () => {}, signal: new AbortController().signal },
    );
    expect(deltas.join('')).toBe('ABC');
    const headers = fm.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe('gk-k');
    fm.mockRestore();
  });

  test('openai speak returns an audio blob', async () => {
    const adapter = new OpenAIAdapter({ baseUrl: 'https://api.openai.test/v1', apiKey: () => 'sk' });
    const fm = mockFetch(
      (url, init) => {
        const body = JSON.parse(String(init!.body));
        expect(body.voice).toBe('alloy');
        return new Response('MP3DATA', { status: 200 });
      },
    );
    const blob = await adapter.speak('hello', 'tts-1');
    expect(blob.size).toBeGreaterThan(0);
    fm.mockRestore();
  });

  test('anthropic + google testConnection report failures gracefully', async () => {
    const a = new AnthropicAdapter({ baseUrl: 'https://a.test/v1', apiKey: () => 'k' });
    const g = new GoogleAdapter({ baseUrl: 'https://g.test/v1beta', apiKey: () => 'k' });
    const fm = mockFetch(() => new Response('{}', { status: 401 }));
    expect((await a.testConnection()).ok).toBe(false);
    expect((await g.testConnection()).ok).toBe(false);
    fm.mockRestore();
  });

  test('compatible adapter streams like openai', async () => {
    const c = new CompatibleAdapter({ baseUrl: 'http://localhost:11434/v1', apiKey: () => undefined });
    const fm = mockFetch(
      (url) =>
        new Response(streamFromStrings(['data: [DONE]\n\n']) as unknown as ReadableStream<Uint8Array>, {
          status: 200,
        }),
    );
    let done = false;
    await c.streamChat(
      { model: 'llama3', messages: [{ role: 'user', content: 'hey' }] },
      { onDelta: () => {}, onDone: () => (done = true), signal: new AbortController().signal },
    );
    expect(done).toBe(true);
    fm.mockRestore();
  });
});
