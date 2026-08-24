import React from 'react';
import { cn } from './Button';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton = ({ className, ...props }: SkeletonProps) => (
  <div className={cn('ui-skeleton', className)} aria-hidden {...props} />
);
