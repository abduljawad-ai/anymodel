import React from 'react';
import { createPortal } from 'react-dom';

// Simple classnames utility
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
}

export const Sheet = ({ open, onOpenChange, children, title }: SheetProps) => {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Scrim */}
      <div 
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Sheet content */}
      <div 
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-surface border-t border-hairline rounded-t-lg",
          "animate-in slide-in-from-bottom duration-200 ease-out"
        )}
        style={{ maxHeight: '80vh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>
        
        {/* Title */}
        {title && (
          <div className="px-4 py-2 border-b border-hairline">
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
        )}
        
        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};