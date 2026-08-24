import React, { useState, useRef, useEffect } from 'react';

// Simple classnames utility
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end';
}

export const Dropdown = ({ trigger, children, align = 'start' }: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setOpen(!open)}>
        {trigger}
      </div>
      
      {open && (
        <div 
          className={cn(
            "absolute z-50 mt-1 bg-surface border border-hairline rounded-md shadow-lg",
            "animate-in slide-in-from-top-2 duration-150 ease-out",
            align === 'end' ? 'right-0' : 'left-0'
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
};

interface DropdownItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const DropdownItem = ({ children, className, ...props }: DropdownItemProps) => {
  return (
    <div
      className={cn(
        "px-3 py-2 text-sm hover:bg-[color:var(--paper)] cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};