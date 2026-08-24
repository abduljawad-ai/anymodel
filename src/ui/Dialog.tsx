import React from 'react';
import { createPortal } from 'react-dom';

// Simple classnames utility
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
}

export const Dialog = ({ open, onOpenChange, children, title }: DialogProps) => {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Scrim */}
      <div 
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Dialog content */}
      <div 
        className={cn(
          "fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2",
          "bg-surface border border-hairline rounded-lg shadow-lg",
          "animate-in zoom-in-95 duration-200 ease-out"
        )}
        style={{ maxWidth: '90vw', maxHeight: '90vh' }}
      >
        {/* Header */}
        {title && (
          <div className="px-4 py-3 border-b border-hairline flex items-center justify-between">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button 
              className="text-muted hover:text-ink"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};