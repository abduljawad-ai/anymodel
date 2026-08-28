import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}

export function Sheet({ open, onClose, title, children, width }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

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
    const el = sheetRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();
  }, [open]);

  return (
    <>
      <div className={`sheet-scrim ${open ? 'open' : ''}`} onClick={onClose} aria-hidden />
      <div
        ref={sheetRef}
        className={`sheet ${open ? 'open' : ''}`}
        role="dialog"
        aria-label={title}
        aria-modal="true"
        style={width ? { maxWidth: width } : undefined}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <IconButton icon={<X size={16} />} aria-label="Close" onClick={onClose} />
        </div>
        <div className="sheet-body">
          {children}
        </div>
      </div>
    </>
  );
}
