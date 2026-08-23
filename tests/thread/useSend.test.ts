import { useSessionStore } from '../../src/state/sessionStore';
import { useUiStore } from '../../src/state/uiStore';
import { useVaultStore } from '../../src/vault/vaultStore';
import { buildHistory, sendTurn } from '../../src/features/thread/useSend';
import type { Turn } from '../../src/state/sessionStore';

function sseResponse(chunks: string[]) {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
  return new Response(stream as unknown as ReadableStream, { status: 200 });
}

describe('buildHistory', () => {
  test('skips errored/empty turns and caps context', () => {
    const turns: Turn[] = [
      { id: 'u1', role: 'user', content: 'a' },
      { id: 'e1', role: 'assistant', content: '', error: { message: 'x' } },
      { id: 'a1', role: 'assistant', content: 'b' },
      { id: 'u2', role: 'user', content: '' },
    ];
    expect(buildHistory(turns)).toEqual([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
    ]);
    expect(buildHistory(turns, 1)).toEqual([{ role: 'assistant', content: 'b' }]);
  });

  test('keeps imageUrl only on user turns', () => {
    const turns: Turn[] = [{ id: 'u1', role: 'user', content: 'look', imageUrl: 'data:image/png;base64,Q==' }];
    expect(buildHistory(turns)[0].imageUrl).toBe('data:image/png;base64,Q==');
  });
});

describe('sendTurn streaming flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    useSessionStore.getState().init();
  });

  test('appends user + assistant turns and streams deltas into the store', async () => {
    // Vault unlocked with an openai key; active model gpt-4o.
    useVaultStore.getState().init();
    await useVaultStore.getState().createVault('password1');
    await useVaultStore.getState().setKey('openai', 'sk-test');
    useUiStore.getState().setActiveModel({ providerId: 'openai', modelId: 'gpt-4o' });

    const fm = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async () =>
          sseResponse([
            'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
            'data: [DONE]\n\n',
          ]) as unknown as Response,
      );

    await sendTurn('hi there');

    const st = useSessionStore.getState();
    const session = st.active()!;
    expect(session.turns).toHaveLength(2);
    expect(session.turns[0]).toMatchObject({ role: 'user', content: 'hi there' });
    expect(session.title).toBe('hi there');
    const assistant = session.turns[1];
    expect(assistant).toMatchObject({ role: 'assistant', modelId: 'gpt-4o', content: 'Hello', streaming: false });

    const body = JSON.parse(String(fm.mock.calls[0][1]!.body));
    expect(body.model).toBe('gpt-4o');
    expect(body.messages.at(-1).content).toBe('hi there');
    fm.mockRestore();
  });

  test('missing key produces a toast, not a request', async () => {
    localStorage.clear();
    useVaultStore.getState().init();
    useUiStore.getState().setActiveModel({ providerId: 'anthropic', modelId: 'claude-x' });

    const fm = vi.spyOn(globalThis, 'fetch');
    let toasts = 0;
    const { onToast } = await import('../../src/lib/toast');
    const off = onToast(() => toasts++);

    await sendTurn('no key');
    off();

    expect(toasts).toBe(1);
    expect(fm).not.toHaveBeenCalled();
  });

  test('HTTP failure lands as an inline error card with retry affordance', async () => {
    useVaultStore.getState().init();
    await useVaultStore.getState().createVault('password1');
    await useVaultStore.getState().setKey('openai', 'sk-test');
    useUiStore.getState().setActiveModel({ providerId: 'openai', modelId: 'gpt-4o' });

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { message: 'bad key' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }) as unknown as Response,
    );

    await sendTurn('boom');

    const assistant = useSessionStore.getState().active()!.turns[1];
    expect(assistant.error?.status).toBe(401);
    expect(assistant.error!.message).toContain('Key rejected');
    expect(assistant.streaming).toBe(false);
    vi.restoreAllMocks();
  });
});
