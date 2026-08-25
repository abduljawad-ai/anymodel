import { useEffect, useState } from 'react';
import { onToast, type ToastOpts } from '../../lib/toast';

interface Item {
  id: number;
  msg: string;
  error: boolean;
}

let nextId = 1;

/** Bottom-center transient notifications. Errors linger longer. */
export function ToastStack() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(
    () =>
      onToast((msg, opts?: ToastOpts) => {
        const id = nextId++;
        const error = !!opts?.error;
        const ttl = opts?.ms ?? (error ? 6000 : 3500);
        setItems((cur) => [...cur, { id, msg, error }]);
        setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), ttl);
      }),
    [],
  );

  if (items.length === 0) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((i) => (
        <div key={i.id} className={`toast ${i.error ? 'toast-err' : ''}`}>
          {i.msg}
        </div>
      ))}
    </div>
  );
}
