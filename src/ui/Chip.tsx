import React from 'react';

// Simple classnames utility
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent';
}

export const Chip = ({ className, variant = 'default', children, ...props }: ChipProps) => {
  const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors';
  
  const variantClasses = {
    default: 'bg-[color:var(--paper)] text-[color:var(--ink)] border border-[color:var(--hairline)]',
    accent: 'bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
  }[variant];

  return (
    <span className={cn(baseClasses, variantClasses, className)} {...props}>
      {children}
    </span>
  );
};