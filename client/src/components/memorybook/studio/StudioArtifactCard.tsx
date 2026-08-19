'use client';

import React from 'react';
import { Layers, HelpCircle, Table2, ScrollText, Network, Presentation, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { StudioArtifact } from '@/types/api';

const KIND_ICONS: Record<string, React.ElementType> = {
  flashcards: Layers,
  quiz: HelpCircle,
  data_table: Table2,
  report: ScrollText,
  mind_map: Network,
  slide_deck: Presentation,
};

interface StudioArtifactCardProps {
  artifact: StudioArtifact;
  onOpen: () => void;
  onDelete: () => void;
}

/**
 * List entry for a generated Studio artifact — mirrors the visual treatment
 * of source cards in SourcesPanel.tsx (icon, title, status line, hover
 * delete action) and reuses the same generating/ready/error state pattern
 * already established for source ingestion.
 */
export function StudioArtifactCard({ artifact, onOpen, onDelete }: StudioArtifactCardProps) {
  const Icon = KIND_ICONS[artifact.kind] || Layers;

  const status = (() => {
    switch (artifact.status) {
      case 'generating':
        return {
          icon: <Loader2 className="w-3 h-3 mr-0.5 animate-spin" />,
          colorClass: 'text-amber-600 dark:text-amber-400',
          label: 'Generating',
        };
      case 'error':
        return {
          icon: <AlertTriangle className="w-3 h-3 mr-0.5" />,
          colorClass: 'text-destructive',
          label: artifact.errorMessage || 'Failed',
        };
      default:
        return {
          icon: null,
          colorClass: 'text-emerald-600 dark:text-emerald-400',
          label: 'Ready',
        };
    }
  })();

  const isReady = artifact.status === 'ready';

  return (
    <Card
      onClick={isReady ? onOpen : undefined}
      className={`bg-background/90 dark:bg-card transition-colors duration-150 group border-0 rounded-2xl p-3 shadow-2xs ${
        isReady ? 'hover:bg-background cursor-pointer' : 'opacity-80'
      }`}
    >
      <div className="flex items-start space-x-2.5">
        <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold truncate text-foreground">{artifact.title}</p>
          <span className={`flex items-center text-[10px] font-medium ${status.colorClass}`} title={artifact.errorMessage || undefined}>
            {status.icon}
            {status.label}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity shrink-0 text-muted-foreground"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </Card>
  );
}
