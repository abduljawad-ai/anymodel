import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    if (label) {
      return (
        <label htmlFor={inputId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--fg)' }}>{label}</span>
          <input ref={ref} id={inputId} className={`input ${className}`} {...props} />
        </label>
      );
    }

    return <input ref={ref} className={`input ${className}`} {...props} />;
  }
);

Input.displayName = 'Input';
