import React from 'react';
import { Button, type ButtonProps } from './Button';

export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: React.ReactNode;
  'aria-label': string;
}

/** Icon-only button. `aria-label` is required for accessibility. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, className, variant = 'ghost', size = 'md', 'aria-label': ariaLabel, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
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
