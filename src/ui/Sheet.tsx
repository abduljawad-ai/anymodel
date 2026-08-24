import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
}

/** Bottom sheet — mobile-first overlay. Closes on scrim click or Escape. */
export const Sheet = ({ open, onOpenChange, children, title }: SheetProps) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="ui-sheet-scrim" onClick={() => onOpenChange(false)} aria-hidden />
      <div className="ui-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ui-sheet-handle" aria-hidden />
        {title && <h3 className="ui-sheet-title">{title}</h3>}
        <div className="ui-sheet-body">{children}</div>
      </div>
    </>,
    document.body
  );
};
