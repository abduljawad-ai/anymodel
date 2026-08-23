const map = new Map<string, AbortController>();

/** Begin a tracked request under `key` — aborts any previous one with the same key. */
export function startStream(key: string): AbortController {
  stopStream(key);
  const ac = new AbortController();
  map.set(key, ac);
  return ac;
}

/** Abort one tracked request, or every tracked request when key is omitted. */
export function stopStream(key?: string): void {
  if (key) {
    map.get(key)?.abort();
    map.delete(key);
    return;
  }
  for (const ac of map.values()) ac.abort();
  map.clear();
}

export function anyActive(): boolean {
  return map.size > 0;
}
