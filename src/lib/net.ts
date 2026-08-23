/** Fetch with timeout + Retry-After-aware single auto-retry (Claude-Code-style lightest intervention). */
export interface FetchOpts extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

export async function fetchWithRetry(url: string, init: RequestInit = {}, opts: FetchOpts = {}): Promise<Response> {
  const { timeoutMs = 90_000, retries = 1, ...rest } = { ...init, ...opts } as FetchOpts;
  let attempt = 0;
  for (;;) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error('timeout')), timeoutMs);
    const signal = init.signal
      ? mergeSignals(init.signal, ctrl.signal)
      : ctrl.signal;
    let res: Response;
    try {
      res = await fetch(url, { ...rest, signal });
    } catch (e) {
      clearTimeout(timer);
      // Propagate user aborts immediately; treat our own timeout as retryable.
      if (init.signal?.aborted) throw e;
      if (attempt >= retries) throw new Error((e as Error).name === 'TimeoutError' || (e as Error).message === 'timeout' ? 'Request timed out' : String((e as Error).message ?? e));
      attempt++;
      continue;
    }
    clearTimeout(timer);

    if ((res.status === 429 || res.status === 503) && attempt < retries && !init.signal?.aborted) {
      const ra = Number(res.headers.get('retry-after'));
      const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 1500 * 2 ** attempt + Math.random() * 400;
      await sleep(wait);
      attempt++;
      continue;
    }
    return res;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const off = () => ctrl.abort(a.reason ?? b.reason);
  if (a.aborted || b.aborted) off();
  else {
    a.addEventListener('abort', off, { once: true });
    b.addEventListener('abort', off, { once: true });
  }
  return ctrl.signal;
}
