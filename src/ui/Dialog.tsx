import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
}

/** Centered modal dialog. Closes on scrim click or Escape. */
export const Dialog = ({ open, onOpenChange, children, title }: DialogProps) => {
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
    <div className="ui-dialog-scrim" onClick={() => onOpenChange(false)}>
      <div
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="ui-dialog-head">
            <h3>{title}</h3>
            <button className="ui-dialog-close" aria-label="Close" onClick={() => onOpenChange(false)}>
              <X size={16} aria-hidden />
            </button>
          </div>
        )}
        <div className="ui-dialog-body">{children}</div>
      </div>
    </div>,
    document.body
  );
};
