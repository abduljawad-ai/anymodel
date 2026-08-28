import type { ReactNode } from 'react';

type ChipVariant = 'default' | 'accent' | 'success' | 'danger';

interface ChipProps {
  variant?: ChipVariant;
  children: ReactNode;
  className?: string;
}

const variantClass: Record<ChipVariant, string> = {
  default: 'chip-default',
  accent: 'chip-accent',
  success: 'chip-success',
  danger: 'chip-danger',
};

export function Chip({ variant = 'default', children, className = '' }: ChipProps) {
  return (
    <span className={`chip ${variantClass[variant]} ${className}`}>
      {children}
    </span>
  );
}
