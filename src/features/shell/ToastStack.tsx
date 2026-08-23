import { useEffect, useState } from 'react';
import { onToast } from '../../lib/toast';

interface Item {
  id: number;
  msg: string;
}

let nextId = 1;

/** Bottom-center transient notifications. */
export function ToastStack() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(
    () =>
      onToast((msg) => {
        const id = nextId++;
        setItems((cur) => [...cur, { id, msg }]);
        setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), 3500);
      }),
    [],
  );

  if (items.length === 0) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((i) => (
        <div key={i.id} className="toast">
          {i.msg}
        </div>
      ))}
    </div>
  );
}
