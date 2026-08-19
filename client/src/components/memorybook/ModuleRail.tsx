'use client';

import React from 'react';
import { FileText, MessageSquare, Headphones, Network, ListChecks } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const liveModules = [
  { icon: FileText, label: 'Sources' },
  { icon: MessageSquare, label: 'Chat' },
  { icon: Headphones, label: 'Studio' },
];

const upcomingModules = [
  { icon: Network, label: 'Mind Map — Coming soon' },
  { icon: ListChecks, label: 'Flashcards — Coming soon' },
];

/**
 * Slim vertical icon rail shown on desktop next to the 3-column workspace grid.
 * Purely presentational: the live icons mirror the panels already visible in the
 * grid, and the muted slots reserve visual space for future modules without
 * implying they exist yet.
 */
export function ModuleRail() {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="hidden lg:flex flex-col items-center w-14 shrink-0 h-full rounded-3xl bg-slate-200/80 dark:bg-zinc-900/90 shadow-2xs py-4 gap-2">
        {liveModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Tooltip key={mod.label}>
              <TooltipTrigger asChild>
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary cursor-default">
                  <Icon className="w-4 h-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-[11px] border-0">
                {mod.label}
              </TooltipContent>
            </Tooltip>
          );
        })}

        <div className="w-6 h-px bg-muted-foreground/15 my-1" />

        {upcomingModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Tooltip key={mod.label}>
              <TooltipTrigger asChild>
                <div className="p-2.5 rounded-2xl border border-dashed border-muted-foreground/25 text-muted-foreground/40 cursor-default">
                  <Icon className="w-4 h-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-[11px] border-0">
                {mod.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
