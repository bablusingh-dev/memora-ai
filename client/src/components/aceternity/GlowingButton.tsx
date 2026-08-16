'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export const GlowingButton = ({
  children,
  onClick,
  className,
  size = 'default',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}) => {
  const sizeClasses = {
    sm: 'px-4 py-2 text-xs',
    default: 'px-6 py-3 text-sm',
    lg: 'px-8 py-3.5 text-sm font-bold',
  }[size];

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center justify-center p-0.5 overflow-hidden text-sm font-semibold rounded-2xl group bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all cursor-pointer border-0',
        className
      )}
    >
      <span className={cn('relative rounded-[14px] transition-all duration-75 ease-in flex items-center gap-2', sizeClasses)}>
        {children}
      </span>
    </button>
  );
};
