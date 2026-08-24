import React from 'react';
import { cn } from './Button';

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent';
}

export const Chip = ({ className, variant = 'default', children, ...props }: ChipProps) => {
  return (
    <span className={cn('ui-chip', variant === 'accent' && 'ui-chip-accent', className)} {...props}>
      {children}
    </span>
  );
};
