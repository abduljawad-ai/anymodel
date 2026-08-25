export interface ToastOpts {
  /** Errors/important warnings stay longer so users can read them. */
  error?: boolean;
  /** Override auto-dismiss duration (ms). */
  ms?: number;
}

type Fn = (msg: string, opts?: ToastOpts) => void;

const listeners = new Set<Fn>();

/** Fire-and-forget transient message. Pass { error: true } to linger longer. */
export function toast(msg: string, opts?: ToastOpts): void {
  listeners.forEach((f) => f(msg, opts));
}

export function onToast(fn: Fn): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
