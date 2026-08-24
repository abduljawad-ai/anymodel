import React from 'react';

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn('ui-btn', `ui-btn-${variant}`, `ui-btn-${size}`, className)}
        disabled={loading || disabled}
        {...props}
      >
        {loading && <span className="ui-spinner" aria-hidden />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
