'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMemorybookStore } from '@/store/useMemorybookStore';
import { Loader2, Sparkles, FolderPlus } from 'lucide-react';

export function CreateMemorybookModal() {
  const { isCreateModalOpen, setCreateModalOpen, createMemorybook, isLoading } = useMemorybookStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Workspace title is required');
      return;
    }
    setErrorMsg('');

    try {
      await createMemorybook(title.trim(), description.trim() || undefined);
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create workspace');
    }
  };

  return (
    <Dialog open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
      <DialogContent className="sm:max-w-[480px] bg-slate-100 dark:bg-zinc-900 border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-2xl dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.95)] text-foreground rounded-3xl p-5 space-y-3">
        {/* Header Section Card */}
        <DialogHeader className="bg-white dark:bg-zinc-950 p-4 rounded-2xl shadow-2xs space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                Create New Workspace
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Organize documents, research papers, notes, and AI audio overviews.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Input Form Section Card */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-950 p-4 rounded-2xl shadow-2xs space-y-3.5">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-destructive/10 border-0 text-destructive text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Workspace Title <span className="text-primary">*</span></span>
              <span className="text-[10px] text-muted-foreground font-normal">e.g. Quantum Computing</span>
            </label>
            <Input
              placeholder="e.g. Deep Learning & RAG Architectures"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              className="bg-slate-100 dark:bg-zinc-800/90 border-0 text-foreground placeholder:text-muted-foreground font-medium text-xs h-10 rounded-2xl focus-visible:ring-1 focus-visible:ring-primary shadow-inner"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Topic Description (Optional)</label>
            <Input
              placeholder="e.g. Research notes on vectorless search vs dense embeddings"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              className="bg-slate-100 dark:bg-zinc-800/90 border-0 text-foreground placeholder:text-muted-foreground font-medium text-xs h-10 rounded-2xl focus-visible:ring-1 focus-visible:ring-primary shadow-inner"
            />
          </div>

          <DialogFooter className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateModalOpen(false)}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground text-xs font-semibold h-9 px-4 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !title.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold h-9 px-5 rounded-xl border-0 shadow-xs gap-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create Workspace</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
