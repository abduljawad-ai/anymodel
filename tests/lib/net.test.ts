import { fetchWithRetry } from '../../src/lib/net';

function mockFetchSequence(responses: Array<() => Response>) {
  let i = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    const make = responses[Math.min(i, responses.length - 1)];
    i++;
    return make();
  });
}

describe('fetchWithRetry', () => {
  it('passes through a 200 immediately', async () => {
    const fm = mockFetchSequence([() => new Response('ok', { status: 200 })]);
    const res = await fetchWithRetry('https://x.test/', {});
    expect(res.status).toBe(200);
    expect(fm).toHaveBeenCalledTimes(1);
    fm.mockRestore();
  });

  it('retries once on 429 and succeeds', async () => {
    const fm = mockFetchSequence([
      () => new Response('rate limited', { status: 429, headers: { 'Retry-After': '0' } }),
      () => new Response('ok', { status: 200 }),
    ]);
    const res = await fetchWithRetry('https://x.test/', {});
    expect(res.status).toBe(200);
    expect(fm).toHaveBeenCalledTimes(2);
    fm.mockRestore();
  });

  it('returns the last 429 response after exhausting retries (callers assert)', async () => {
    const fm = mockFetchSequence([
      () => new Response('nope', { status: 429, headers: { 'Retry-After': '0' } }),
      () => new Response('still nope', { status: 429, headers: { 'Retry-After': '0' } }),
    ]);
    const res = await fetchWithRetry('https://x.test/', {});
    expect(res.status).toBe(429);
    expect(fm).toHaveBeenCalledTimes(2);
    fm.mockRestore();
  });

  it('does not retry non-retryable errors', async () => {
    const fm = mockFetchSequence([() => new Response('bad request', { status: 400 })]);
    const res = await fetchWithRetry('https://x.test/', {});
    expect(res.status).toBe(400);
    expect(fm).toHaveBeenCalledTimes(1);
    fm.mockRestore();
  });

  it('surfaces a friendly message when the request times out', async () => {
    const fm = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('timeout')));
        }),
    );
    await expect(fetchWithRetry('https://x.test/', {}, { timeoutMs: 20, retries: 0 })).rejects.toThrow(/timed out/i);
    fm.mockRestore();
  });
});
