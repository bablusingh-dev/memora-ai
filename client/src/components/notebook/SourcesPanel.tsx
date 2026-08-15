'use client';

import React from 'react';
import { FileText, Plus, Globe, Youtube, CheckCircle2, BookOpen, Trash2, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotebookStore } from '@/store/useNotebookStore';

export function SourcesPanel() {
  const { activeNotebook, setAddSourceModalOpen, deleteSource } = useNotebookStore();
  const sources = activeNotebook?.sources || [];

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-4 h-4 text-primary" />;
      case 'web':
        return <Globe className="w-4 h-4 text-blue-400" />;
      case 'youtube':
        return <Youtube className="w-4 h-4 text-red-400" />;
      case 'text':
        return <FileCode className="w-4 h-4 text-amber-400" />;
      default:
        return <FileText className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-card/60 backdrop-blur border-r border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg tracking-tight">Sources</h2>
        </div>
        <Badge variant="outline" className="text-xs border-primary/40 text-primary">
          BM25 Indexed
        </Badge>
      </div>

      {activeNotebook ? (
        <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/60 flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">{activeNotebook.title}</p>
            {activeNotebook.description && (
              <p className="text-[10px] text-muted-foreground truncate">{activeNotebook.description}</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Select or create a notebook above to manage document sources.
        </p>
      )}

      <Button
        disabled={!activeNotebook}
        onClick={() => setAddSourceModalOpen(true)}
        className="w-full justify-start space-x-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30"
      >
        <Plus className="w-4 h-4" />
        <span>Add Source Document</span>
      </Button>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {sources.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            No source documents added yet. Click "Add Source Document" to upload PDFs, URLs, YouTube videos, or notes.
          </div>
        ) : (
          sources.map((source) => (
            <Card key={source.id} className="bg-secondary/40 border-border/60 hover:border-primary/50 transition-all group">
              <CardContent className="p-3 flex items-start space-x-3">
                <div className="p-2 rounded-lg bg-background/80 shrink-0">
                  {getSourceIcon(source.fileType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{source.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="flex items-center text-[10px] text-emerald-400 capitalize">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" /> {source.fileType} • {source.status}
                    </span>

                    <button
                      onClick={() => {
                        if (confirm(`Delete source "${source.title}"?`)) {
                          deleteSource(source.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
