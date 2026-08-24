import React, { useEffect, useRef, useState } from 'react';
import { cn } from './Button';

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end';
  label?: string;
}

/** Click-to-open popover menu. Closes on outside click or Escape. */
export const Dropdown = ({ trigger, children, align = 'start', label }: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="ui-dropdown" ref={ref}>
      <span
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        style={{ display: 'inline-flex' }}
      >
        {trigger}
      </span>
      {open && (
        <div className={cn('ui-dropdown-menu', align === 'end' && 'align-end')} role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
};

export interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const DropdownItem = ({ children, className, ...props }: DropdownItemProps) => (
  <button className={cn('ui-dropdown-item', className)} role="menuitem" {...props}>
    {children}
  </button>
);
