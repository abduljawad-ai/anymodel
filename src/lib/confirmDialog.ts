/**
 * Lightweight in-app confirmation dialog (replaces native window.confirm/alert
 * so the UX stays consistent with the app's own toast/dialog system).
 *
 * Returns a Promise<boolean> that resolves to the user's choice. Safe to call
 * from anywhere (no React context required) — it mounts a fixed overlay.
 */
export function confirmDialog(
  message: string,
  opts: { title?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.setAttribute('role', 'alertdialog');
    root.setAttribute('aria-modal', 'true');
    Object.assign(root.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(25,23,20,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '200',
      padding: '20px',
    } as CSSStyleDeclaration);

    const card = document.createElement('div');
    Object.assign(card.style, {
      background: 'var(--surface)',
      color: 'var(--ink)',
      border: '1px solid var(--hairline)',
      borderRadius: 'var(--r-md, 12px)',
      padding: '20px',
      maxWidth: '420px',
      width: '100%',
      boxShadow: '0 12px 40px rgba(25,23,20,0.25)',
      fontFamily: 'inherit',
    } as CSSStyleDeclaration);

    if (opts.title) {
      const h = document.createElement('div');
      h.textContent = opts.title;
      h.style.fontWeight = '700';
      h.style.marginBottom = '8px';
      card.appendChild(h);
    }

    const msg = document.createElement('div');
    msg.textContent = message;
    msg.style.fontSize = '14px';
    msg.style.lineHeight = '1.5';
    msg.style.marginBottom = '18px';
    msg.style.whiteSpace = 'pre-wrap';
    card.appendChild(msg);

    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end' } as CSSStyleDeclaration);

    let settled = false;
    const finish = (val: boolean) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      root.remove();
      resolve(val);
    };

    const cancel = document.createElement('button');
    cancel.textContent = opts.cancelLabel ?? 'Cancel';
    Object.assign(cancel.style, {
      padding: '8px 14px',
      borderRadius: 'var(--r, 8px)',
      border: '1px solid var(--hairline)',
      background: 'var(--paper)',
      color: 'var(--ink)',
      cursor: 'pointer',
      font: 'inherit',
    } as CSSStyleDeclaration);
    cancel.onclick = () => finish(false);

    const confirm = document.createElement('button');
    confirm.textContent = opts.confirmLabel ?? 'Confirm';
    Object.assign(confirm.style, {
      padding: '8px 14px',
      borderRadius: 'var(--r, 8px)',
      border: '1px solid ' + (opts.destructive ? 'var(--err)' : 'var(--accent)'),
      background: opts.destructive ? 'var(--err)' : 'var(--accent)',
      color: 'var(--paper)',
      cursor: 'pointer',
      font: 'inherit',
      fontWeight: '600',
    } as CSSStyleDeclaration);
    confirm.onclick = () => finish(true);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
      if (e.key === 'Enter') finish(true);
    };
    document.addEventListener('keydown', onKey);

    row.appendChild(cancel);
    row.appendChild(confirm);
    card.appendChild(row);
    root.appendChild(card);
    document.body.appendChild(root);
    confirm.focus();
  });
}

/** Simple in-app alert replacement (info only, resolves when dismissed). */
export function alertDialog(message: string, title?: string): Promise<void> {
  return confirmDialog(message, { title, confirmLabel: 'OK', cancelLabel: '' }).then(() => undefined);
}
