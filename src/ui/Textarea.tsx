import { forwardRef, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    if (label) {
      return (
        <label htmlFor={textareaId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--fg)' }}>{label}</span>
          <textarea ref={ref} id={textareaId} className={`textarea ${className}`} {...props} />
        </label>
      );
    }

    return <textarea ref={ref} className={`textarea ${className}`} {...props} />;
  }
);

Textarea.displayName = 'Textarea';
