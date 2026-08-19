'use client';

import React from 'react';
import { FileText, MessageSquare, Headphones, Network, Layers } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useMemorybookStore } from '@/store/useMemorybookStore';

const upcomingModules = [{ icon: Network, label: 'Mind Map — Coming soon' }];

/**
 * Slim vertical icon rail shown on desktop next to the 3-column workspace grid.
 * The live icons mirror the panels already visible in the grid; Studio-panel
 * shortcuts (Studio, Flashcards) switch the right-hand panel's active tab via
 * the store. The muted slot reserves visual space for a module that doesn't
 * exist yet without implying it does.
 */
export function ModuleRail() {
  const setActiveStudioTab = useMemorybookStore((s) => s.setActiveStudioTab);

  const modules = [
    { icon: FileText, label: 'Sources', onClick: undefined },
    { icon: MessageSquare, label: 'Chat', onClick: undefined },
    { icon: Headphones, label: 'Studio', onClick: () => setActiveStudioTab('audio') },
    { icon: Layers, label: 'Flashcards', onClick: () => setActiveStudioTab('studio') },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="hidden lg:flex flex-col items-center w-14 shrink-0 h-full rounded-3xl bg-slate-200/80 dark:bg-zinc-900/90 shadow-2xs py-4 gap-2">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Tooltip key={mod.label}>
              <TooltipTrigger asChild>
                <button
                  onClick={mod.onClick}
                  className="p-2.5 rounded-2xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors duration-150"
                >
                  <Icon className="w-4 h-4" />
                </button>
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
