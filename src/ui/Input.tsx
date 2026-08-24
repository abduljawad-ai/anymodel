import React from 'react';
import { cn } from './Button';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, id, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        id={id}
        className={cn('ui-input', className)}
        {...props}
      />
    );
    if (!label) return input;
    return (
      <div className="ui-field">
        <label htmlFor={id} className="ui-label">{label}</label>
        {input}
      </div>
    );
  }
);
Input.displayName = 'Input';
