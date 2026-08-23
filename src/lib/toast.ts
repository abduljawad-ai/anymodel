type Fn = (msg: string) => void;

const listeners = new Set<Fn>();

/** Fire-and-forget transient message. */
export function toast(msg: string): void {
  listeners.forEach((f) => f(msg));
}

export function onToast(fn: Fn): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
