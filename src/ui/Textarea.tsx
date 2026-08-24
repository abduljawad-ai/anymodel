import React from 'react';

// Simple classnames utility
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label 
            htmlFor={id} 
            className="text-sm font-medium text-[color:var(--ink)]"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={cn(
            "flex min-h-[60px] w-full rounded-md border border-[color:var(--hairline)]",
            "bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
            "placeholder:text-[color:var(--muted)]",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--accent)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';