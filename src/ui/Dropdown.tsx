import { useEffect, useRef, type ReactNode } from 'react';

interface DropdownProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: 'start' | 'end';
  width?: number;
}

export function Dropdown({ open, onClose, anchorRef, children, align = 'end', width }: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="dropdown"
      style={{
        position: 'absolute',
        top: '100%',
        right: align === 'end' ? 0 : undefined,
        left: align === 'start' ? 0 : undefined,
        marginTop: 4,
        minWidth: width || 180,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 'var(--z-dropdown)',
        padding: 'var(--sp-1)',
        animation: 'ui-pop 0.15s var(--ease)',
      }}
    >
      {children}
    </div>
  );
}
