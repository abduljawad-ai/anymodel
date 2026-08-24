import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deepResearch } from '../../src/lib/research';
import type { ProviderAdapter } from '../../src/adapters/types';

function makeAdapter(chunks: string[]): ProviderAdapter {
  return {
    listModels: async () => [],
    streamChat: async (_req, signals) => {
      // First chunk is the forced plan → arrives as reasoning; the rest is answer text.
      chunks.forEach((c, i) => (i === 0 ? signals.onReasoning?.(c) : signals.onDelta(c)));
      signals.onDone();
    },
    transcribe: async () => '',
    speak: async () => new Blob(),
    testConnection: async () => ({ ok: true, detail: '' }),
  };
}

describe('deepResearch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('runs plan → search → synthesize; search hits Exa with the key', async () => {
    const plan = '<plan>step a</plan><queries>\ncats\n</queries>';
    const adapter = makeAdapter([plan, 'SYNTHESIS ANSWER']);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({ results: [{ title: 'Cat Fact', url: 'https://x.test/cats', text: 'Cats sleep a lot.' }] }),
        { status: 200 },
      );
    });

    const deltas: string[] = [];
    const reasoning: string[] = [];
    await deepResearch({
      adapter,
      modelId: 'm',
      history: [],
      question: 'why do cats sleep so much?',
      exaKey: 'exa-k',
      signal: new AbortController().signal,
      onDelta: (d) => deltas.push(d),
      onReasoning: (r) => reasoning.push(r),
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.exa.ai/search');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('exa-k');
    expect(deltas.join('')).toContain('SYNTHESIS ANSWER');
    expect(reasoning.join('')).toContain('plan');
    fetchMock.mockRestore();
  });

  it('degrades to reasoning-only when no Exa key exists', async () => {
    const plan = '<plan>x</plan><queries>\nq1\n</queries>';
    const adapter = makeAdapter([plan, 'SYNTH']);
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const deltas: string[] = [];
    await deepResearch({
      adapter,
      modelId: 'm',
      history: [],
      question: 'q',
      exaKey: undefined,
      signal: new AbortController().signal,
      onDelta: (d) => deltas.push(d),
      onReasoning: () => {},
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(deltas.join('')).toContain('SYNTH');
  });

  it('continues to synthesis when the search request fails', async () => {
    const plan = '<plan>x</plan><queries>\nq1\n</queries>';
    const adapter = makeAdapter([plan, 'SYNTH']);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('boom', { status: 500 }));
    const deltas: string[] = [];
    await deepResearch({
      adapter,
      modelId: 'm',
      history: [],
      question: 'q',
      exaKey: 'k',
      signal: new AbortController().signal,
      onDelta: (d) => deltas.push(d),
      onReasoning: () => {},
    });
    expect(deltas.join('')).toContain('SYNTH');
    fetchMock.mockRestore();
  });
});
