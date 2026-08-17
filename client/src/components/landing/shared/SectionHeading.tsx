import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionEyebrow } from './SectionEyebrow';

export function SectionHeading({
  eyebrow,
  eyebrowIcon,
  title,
  description,
  align = 'center',
  className,
}: {
  eyebrow?: string;
  eyebrowIcon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'center' | 'left';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'max-w-3xl mb-12',
        align === 'center' ? 'text-center mx-auto' : 'text-left',
        className
      )}
    >
      {eyebrow && <SectionEyebrow icon={eyebrowIcon}>{eyebrow}</SectionEyebrow>}
      <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
        {title}
      </h2>
      {description && (
        <p className="text-base text-muted-foreground leading-relaxed font-normal">
          {description}
        </p>
      )}
    </div>
  );
}
