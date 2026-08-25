const map = new Map<string, AbortController>();

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

/** Subscribe to stream activity changes (returns unsubscribe). */
export function onStreamActivity(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Begin a tracked request under `key` — aborts any previous one with the same key. */
export function startStream(key: string): AbortController {
  const had = map.size > 0;
  stopStream(key);
  const ac = new AbortController();
  map.set(key, ac);
  if (!had) emit();
  return ac;
}

/** Abort one tracked request, or every tracked request when key is omitted. */
export function stopStream(key?: string): void {
  if (key) {
    const had = map.size > 0;
    map.get(key)?.abort();
    map.delete(key);
    if (had && map.size === 0) emit();
    return;
  }
  if (map.size === 0) return;
  for (const ac of map.values()) ac.abort();
  map.clear();
  emit();
}

/** Release a finished stream WITHOUT aborting (normal completion path). */
export function endStream(key: string): void {
  const had = map.size > 0;
  map.delete(key);
  if (had && map.size === 0) emit();
}

export function anyActive(): boolean {
  return map.size > 0;
}
