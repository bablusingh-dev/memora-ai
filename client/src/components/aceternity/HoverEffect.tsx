'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export const HoverEffect = ({
  items,
  className,
}: {
  items: {
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    points: string[];
  }[];
  className?: string;
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-6 py-8', className)}>
      {items.map((item, idx) => {
        const Icon = item.icon;
        const isHovered = hoveredIndex === idx;

        return (
          <div
            key={idx}
            className="relative group block p-2 h-full w-full cursor-pointer"
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {isHovered && (
              <span
                className="absolute inset-0 h-full w-full bg-primary/10 dark:bg-primary/15 block rounded-3xl transition-opacity duration-150"
              />
            )}

            <div
              className="rounded-2xl h-full w-full p-6 overflow-hidden bg-card text-card-foreground shadow-xs hover:shadow-md relative z-20 transition-colors duration-150 border-0"
            >
              <div className="relative z-50">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${item.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold tracking-wide mb-2 text-foreground">
                  {item.title}
                </h3>
                <p className="text-muted-foreground tracking-wide text-xs leading-relaxed mb-6 font-normal">
                  {item.description}
                </p>
                <div className="space-y-2 pt-4">
                  {item.points.map((pt, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-semibold text-foreground/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
