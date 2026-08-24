import React from 'react';
import { cn } from './Button';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, id, ...props }, ref) => {
    const ta = (
      <textarea
        ref={ref}
        id={id}
        className={cn('ui-textarea', className)}
        {...props}
      />
    );
    if (!label) return ta;
    return (
      <div className="ui-field">
        <label htmlFor={id} className="ui-label">{label}</label>
        {ta}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
