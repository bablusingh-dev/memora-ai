'use client';

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Globe,
  Youtube,
  CheckCircle2,
  BookOpen,
  Trash2,
  FileCode,
  Search,
  CheckSquare,
  Square,
  Eye,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useNotebookStore } from '@/store/useNotebookStore';
import { SourceDocument } from '@/types/api';

export function SourcesPanel() {
  const { activeNotebook, setAddSourceModalOpen, deleteSource } = useNotebookStore();
  const sources = activeNotebook?.sources || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [inspectSource, setInspectSource] = useState<SourceDocument | null>(null);

  // Initialize selected sources when sources load
  React.useEffect(() => {
    if (sources.length > 0) {
      setSelectedSourceIds(new Set(sources.map((s) => s.id)));
    }
  }, [sources.length]);

  const filteredSources = useMemo(() => {
    if (!searchQuery.trim()) return sources;
    return sources.filter(
      (s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.fileType.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sources, searchQuery]);

  const toggleSelectAll = () => {
    if (selectedSourceIds.size === sources.length) {
      setSelectedSourceIds(new Set());
    } else {
      setSelectedSourceIds(new Set(sources.map((s) => s.id)));
    }
  };

  const toggleSourceSelection = (id: string) => {
    const next = new Set(selectedSourceIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedSourceIds(next);
  };

  const getSourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FileText className="w-4 h-4 text-primary" />;
      case 'web':
        return <Globe className="w-4 h-4 text-blue-500 dark:text-blue-400" />;
      case 'youtube':
        return <Youtube className="w-4 h-4 text-red-500 dark:text-red-400" />;
      case 'text':
        return <FileCode className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
      default:
        return <FileText className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-transparent p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-xl bg-primary/10 text-primary">
            <BookOpen className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-sm tracking-tight text-foreground">
            Grounding Sources
          </h2>
        </div>
        <Badge
          variant="secondary"
          className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 border-0"
        >
          ParadeDB BM25
        </Badge>
      </div>

      {/* Active Notebook Summary Card */}
      {activeNotebook ? (
        <div className="p-3 rounded-2xl bg-background/90 dark:bg-card border-0 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-foreground truncate">
              {activeNotebook.title}
            </p>
            <span className="text-[10px] text-muted-foreground font-mono">
              {sources.length} doc{sources.length === 1 ? '' : 's'}
            </span>
          </div>
          {activeNotebook.description && (
            <p className="text-[11px] text-muted-foreground truncate leading-tight">
              {activeNotebook.description}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Select or create a workspace to manage document sources.
        </p>
      )}

      {/* Add Source Action Button */}
      <Button
        disabled={!activeNotebook}
        onClick={() => setAddSourceModalOpen(true)}
        className="w-full justify-start space-x-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl shadow-2xs h-9 text-xs font-semibold border-0"
      >
        <Plus className="w-4 h-4" />
        <span>Add Source Document</span>
      </Button>

      {/* Search & Bulk Select Controls */}
      {sources.length > 0 && (
        <div className="space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Filter sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-background/80 dark:bg-card border-0 text-xs h-8 rounded-xl placeholder:text-muted-foreground shadow-2xs"
            />
          </div>

          <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground font-medium">
            <button
              onClick={toggleSelectAll}
              className="flex items-center space-x-1.5 hover:text-foreground transition-colors"
            >
              {selectedSourceIds.size === sources.length ? (
                <CheckSquare className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              <span>
                {selectedSourceIds.size === sources.length
                  ? 'Select None'
                  : 'Select All'}
              </span>
            </button>
            <span>
              {selectedSourceIds.size} of {sources.length} active
            </span>
          </div>
        </div>
      )}

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {sources.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground bg-background/60 dark:bg-card/50 rounded-2xl border-0 space-y-2 shadow-2xs">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="font-medium">No source documents yet</p>
            <p className="text-[11px] text-muted-foreground/80">
              Upload PDFs, URLs, YouTube videos, or text notes to ground the AI model.
            </p>
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground bg-background/60 dark:bg-card/50 rounded-2xl shadow-2xs">
            No sources matching "{searchQuery}".
          </div>
        ) : (
          filteredSources.map((source) => {
            const isSelected = selectedSourceIds.has(source.id);

            return (
              <Card
                key={source.id}
                className={`bg-background/90 dark:bg-card transition-colors duration-150 group rounded-2xl border-0 shadow-2xs ${
                  isSelected ? 'ring-1 ring-primary/40' : 'opacity-75'
                }`}
              >
                <CardContent className="p-3 flex items-start space-x-2.5">
                  <button
                    onClick={() => toggleSourceSelection(source.id)}
                    className="mt-0.5 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  <div className="p-2 rounded-xl bg-muted/60 dark:bg-zinc-800/80 shrink-0">
                    {getSourceIcon(source.fileType)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold truncate text-foreground">
                        {source.title}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium capitalize">
                        <CheckCircle2 className="w-3 h-3 mr-0.5" />
                        {source.fileType} • {source.status || 'Indexed'}
                      </span>

                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setInspectSource(source)}
                          title="Inspect chunks"
                          className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete source "${source.title}"?`)) {
                              deleteSource(source.id);
                            }
                          }}
                          title="Delete source"
                          className="p-1 text-muted-foreground hover:text-destructive rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Source Chunk Inspector Modal */}
      <Dialog
        open={!!inspectSource}
        onOpenChange={() => setInspectSource(null)}
      >
        <DialogContent className="sm:max-w-[550px] bg-card border-0 text-foreground rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
              {inspectSource && getSourceIcon(inspectSource.fileType)}
              <span className="truncate">{inspectSource?.title}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Inspecting ParadeDB BM25 indexed source document metadata and RAG status.
            </DialogDescription>
          </DialogHeader>

          {inspectSource && (
            <div className="space-y-3 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-muted/30">
                <div>
                  <span className="text-[10px] text-muted-foreground block">File Type</span>
                  <span className="font-semibold uppercase">{inspectSource.fileType}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Status</span>
                  <span className="font-semibold text-emerald-500 capitalize">{inspectSource.status || 'Ready'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Created At</span>
                  <span className="font-semibold">{new Date(inspectSource.createdAt).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Source URL</span>
                  <span className="font-semibold truncate block max-w-[180px]">
                    {inspectSource.fileUrl || 'Stored on CDN'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-muted/20 border-0 space-y-1">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-foreground">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span>Document RAG Grounding</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  This document has been chunked into overlapping passages and indexed into ParadeDB for real-time BM25 algorithmic retrieval during chat synthesis.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
