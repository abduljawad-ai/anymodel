import React from 'react';
import { Button, type ButtonProps } from './Button';

export interface IconButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  icon: React.ReactNode;
  'aria-label': string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, className, 'aria-label': ariaLabel, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="md"
        className={className}
        aria-label={ariaLabel}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);
IconButton.displayName = 'IconButton';