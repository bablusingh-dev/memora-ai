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
import { useNotebookStore } from '@/store/useNotebookStore';
import { Sparkles, Loader2 } from 'lucide-react';

export function CreateNotebookModal() {
  const { isCreateModalOpen, setCreateModalOpen, createNotebook, isLoading } = useNotebookStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Title is required');
      return;
    }
    setErrorMsg('');

    try {
      await createNotebook(title.trim(), description.trim() || undefined);
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create notebook');
    }
  };

  return (
    <Dialog open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
      <DialogContent className="sm:max-w-[460px] bg-white border border-slate-200 shadow-2xl text-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Sparkles className="w-5 h-5 text-primary" />
            Create New Notebook
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Give your notebook a title and optional topic description to organize your research sources.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800">Notebook Title *</label>
            <Input
              placeholder="e.g. Deep Learning & RAG Architectures"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              className="bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 font-medium focus:bg-white focus:border-primary text-xs h-10"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800">Description (Optional)</label>
            <Input
              placeholder="e.g. Research notes on vectorless search vs dense embeddings"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              className="bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 font-medium focus:bg-white focus:border-primary text-xs h-10"
            />
          </div>

          <DialogFooter className="pt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              disabled={isLoading}
              className="border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold h-9 px-5 shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...
                </>
              ) : (
                'Create Notebook'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
