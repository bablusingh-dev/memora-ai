'use client';

import React from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { BookIcon, ChevronDownIcon, GlobeIcon, DatabaseIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

export type SourcesProps = ComponentProps<typeof Collapsible>;

export const Sources = ({ className, ...props }: SourcesProps) => (
  <Collapsible
    className={cn('not-prose my-3 text-primary text-xs', className)}
    {...props}
  />
);

export type SourcesTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number;
};

export const SourcesTrigger = ({
  className,
  count,
  children,
  ...props
}: SourcesTriggerProps) => (
  <CollapsibleTrigger
    className={cn(
      'flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer',
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        <BookIcon className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold text-foreground">Used {count} sources &amp; citations</span>
        <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </>
    )}
  </CollapsibleTrigger>
);

export type SourcesContentProps = ComponentProps<typeof CollapsibleContent>;

export const SourcesContent = ({
  className,
  ...props
}: SourcesContentProps) => (
  <CollapsibleContent
    className={cn(
      'mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
      className
    )}
    {...props}
  />
);

export type SourceProps = ComponentProps<'a'> & {
  title?: string;
  isWeb?: boolean;
};

export const Source = ({ href, title, isWeb, children, className, ...props }: SourceProps) => (
  <a
    className={cn(
      'flex items-center justify-between gap-2 p-2 rounded-xl bg-card hover:bg-secondary/40 transition-all text-foreground text-xs shadow-2xs group border-0',
      className
    )}
    href={href}
    rel="noreferrer"
    target={href && href !== '#' ? '_blank' : undefined}
    {...props}
  >
    <div className="flex items-center gap-2 min-w-0">
      {isWeb ? (
        <GlobeIcon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <DatabaseIcon className="h-3.5 w-3.5 text-primary shrink-0" />
      )}
      <span className="font-medium text-[11px] truncate group-hover:text-primary transition-colors">
        {title || 'Source reference'}
      </span>
    </div>
  </a>
);
