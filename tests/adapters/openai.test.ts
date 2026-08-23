import { OpenAIAdapter } from '../../src/adapters/openai';
import { streamFromStrings } from '../../src/lib/sse';

const adapter = new OpenAIAdapter({ baseUrl: 'https://api.openai.test/v1', apiKey: () => 'sk-k' });

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (url, init) => handler(String(url), init));
}

test('streamChat emits deltas then done', async () => {
  const fm = mockFetch(
    () =>
      new Response(
        streamFromStrings([
          'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
          'data: [DONE]\n\n',
        ]) as unknown as ReadableStream<Uint8Array>,
        { status: 200 },
      ),
  );
  const deltas: string[] = [];
  let done = false;
  await adapter.streamChat(
    { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
    { onDelta: (d) => deltas.push(d), onDone: () => (done = true), signal: new AbortController().signal },
  );
  expect(deltas.join('')).toBe('Hello');
  expect(done).toBe(true);
  const body = JSON.parse(String(fm.mock.calls[0][1]!.body));
  expect(body.messages[0].content).toBe('hi');
  expect(body.stream).toBe(true);
  expect((fm.mock.calls[0][1]!.headers as Record<string, string>).Authorization).toBe('Bearer sk-k');
  fm.mockRestore();
});

test('streamChat maps image turns to content parts', async () => {
  const fm = mockFetch(
    () =>
      new Response(streamFromStrings(['data: [DONE]\n\n']) as unknown as ReadableStream<Uint8Array>, {
        status: 200,
      }),
  );
  await adapter.streamChat(
    {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'look', imageUrl: 'data:image/png;base64,QUJD' }],
    },
    { onDelta: () => {}, onDone: () => {}, signal: new AbortController().signal },
  );
  const body = JSON.parse(String(fm.mock.calls[0][1]!.body));
  expect(body.messages[0].content[0]).toEqual({ type: 'text', text: 'look' });
  expect(body.messages[0].content[1].image_url.url).toContain('base64,QUJD');
  fm.mockRestore();
});

test('401 becomes humanized ApiError', async () => {
  const fm = mockFetch(
    () => new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 }),
  );
  await expect(
    adapter.streamChat(
      { model: 'gpt-4o', messages: [] },
      { onDelta: () => {}, onDone: () => {}, signal: new AbortController().signal },
    ),
  ).rejects.toMatchObject({ name: 'ApiError', status: 401 });
  fm.mockRestore();
});

test('transcribe posts FormData and returns text', async () => {
  const fm = mockFetch((url, init) => {
    expect(url).toBe('https://api.openai.test/v1/audio/transcriptions');
    expect((init!.body as FormData).get('model')).toBe('whisper-1');
    return new Response(JSON.stringify({ text: 'hello world' }), { status: 200 });
  });
  const text = await adapter.transcribe(new File(['x'], 'a.webm', { type: 'audio/webm' }), 'whisper-1');
  expect(text).toBe('hello world');
  fm.mockRestore();
});

