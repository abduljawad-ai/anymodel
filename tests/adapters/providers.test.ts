import { AnthropicAdapter } from '../../src/adapters/anthropic';
import { GoogleAdapter } from '../../src/adapters/google';
import { CompatibleAdapter } from '../../src/adapters/compatible';
import { OpenAIAdapter } from '../../src/adapters/openai';
import { createAdapter } from '../../src/adapters/factory';
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

  test('aux endpoints are unsupported (501)', async () => {
    await expect(adapter.speak('x', '')).rejects.toMatchObject({ status: 501 });
    await expect(adapter.embed(['a'], '')).rejects.toMatchObject({ status: 501 });
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

  test('embedContent returns values', async () => {
    const fm = mockFetch(
      () => new Response(JSON.stringify({ embedding: { values: [0.5, 0.5] } }), { status: 200 }),
    );
    expect(await adapter.embed(['hello'], '')).toEqual([[0.5, 0.5]]);
    expect(String(fm.mock.calls[0][0])).toContain(':embedContent');
    fm.mockRestore();
  });
});

test('factory selects correct wire format classes', () => {
  const deps = { baseUrl: 'https://x', apiKey: () => undefined };
  expect(createAdapter('openai', deps)).toBeInstanceOf(OpenAIAdapter);
  expect(createAdapter('compatible', deps)).toBeInstanceOf(CompatibleAdapter);
  expect(createAdapter('anthropic', deps)).toBeInstanceOf(AnthropicAdapter);
  expect(createAdapter('google', deps)).toBeInstanceOf(GoogleAdapter);
});
