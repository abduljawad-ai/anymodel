import { useEffect, useState } from 'react';
import { onToast, type ToastOpts } from '../../lib/toast';

interface ToastItem {
  id: number;
  msg: string;
  error: boolean;
}

let nextId = 1;

export function ToastStack() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(
    () =>
      onToast((msg, opts?: ToastOpts) => {
        const id = nextId++;
        const error = !!opts?.error;
        const ttl = opts?.ms ?? (error ? 6000 : 3500);
        setItems((cur) => [...cur, { id, msg, error }]);
        setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), ttl);
      }),
    [],
  );

  if (items.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.error ? 'toast-error' : ''}`}>
          <span className="toast-msg">{t.msg}</span>
          <button
            className="toast-close"
            aria-label="Dismiss"
            onClick={() => setItems((cur) => cur.filter((x) => x.id !== t.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
