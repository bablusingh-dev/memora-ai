import React from 'react';
import { cn } from '@/lib/utils';

export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('max-w-[1280px] mx-auto px-6 lg:px-8', className)}>
      {children}
    </div>
  );
}
