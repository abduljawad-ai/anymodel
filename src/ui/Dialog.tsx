import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}

export function Dialog({ open, onClose, title, children, width }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Trap focus
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();
  }, [open]);

  return (
    <>
      <div className={`dialog-scrim ${open ? 'open' : ''}`} onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        className={`dialog ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={width ? { maxWidth: width, width: '100%' } : undefined}
      >
        <div className="dialog-head">
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{title}</h2>
          <IconButton icon={<X size={16} />} aria-label="Close" onClick={onClose} />
        </div>
        <div className="dialog-body">
          {children}
        </div>
      </div>
    </>
  );
}
