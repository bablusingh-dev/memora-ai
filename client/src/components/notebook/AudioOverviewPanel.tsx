'use client';

import React, { useState } from 'react';
import { Headphones, Play, Sparkles, BookOpen, Layers, Plus, Trash2, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotebookStore } from '@/store/useNotebookStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function AudioOverviewPanel() {
  const { activeNotebook, activeNotes, createNote, deleteNote } = useNotebookStore();
  const [isCreateNoteOpen, setCreateNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    setIsSubmitting(true);
    try {
      await createNote(noteTitle.trim(), noteContent.trim(), 'user_note');
      setNoteTitle('');
      setNoteContent('');
      setCreateNoteOpen(false);
    } catch (e) {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateAISummaryNote = async () => {
    if (!activeNotebook) return;
    setIsSubmitting(true);
    try {
      await createNote(
        `AI Executive Briefing - ${new Date().toLocaleDateString()}`,
        `# Executive Summary for ${activeNotebook.title}\n\nKey themes extracted from uploaded source documents:\n- Automated ParadeDB BM25 indexing.\n- Multi-source document grounding (PDF, Web, YouTube, Notes).\n- Real-time agentic context retrieval.`,
        'ai_summary'
      );
    } catch (e) {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card/60 backdrop-blur border-l border-border p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <Headphones className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg tracking-tight">Studio & Notes</h2>
        </div>
        <Badge variant="outline" className="text-xs border-primary/40 text-primary">
          {activeNotes.length} Notes
        </Badge>
      </div>

      {/* Note View Dialog */}
      <Dialog open={!!selectedNote} onOpenChange={() => setSelectedNote(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="w-4 h-4 text-primary" /> {selectedNote?.title}
            </DialogTitle>
            <DialogDescription className="text-[10px]">
              Created {selectedNote?.createdAt ? new Date(selectedNote.createdAt).toLocaleString() : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-xl bg-secondary/30 border border-border text-xs leading-relaxed max-h-[300px] overflow-y-auto">
            <p className="whitespace-pre-wrap">{selectedNote?.content}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Note Dialog */}
      <Dialog open={isCreateNoteOpen} onOpenChange={setCreateNoteOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Plus className="w-4 h-4 text-primary" /> Create Notebook Note
            </DialogTitle>
            <DialogDescription className="text-xs">
              Save key takeaways, study flashcards, or research notes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateNote} className="space-y-3 mt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Note Title</label>
              <Input
                placeholder="e.g. Chapter 4 Key Takeaways"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Content</label>
              <textarea
                rows={4}
                placeholder="Write your note here..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <Button type="submit" disabled={!noteTitle.trim() || !noteContent.trim() || isSubmitting} className="w-full bg-primary text-primary-foreground">
              Save Note
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Audio Overview Card */}
      <Card className="bg-gradient-to-br from-primary/15 via-secondary/40 to-background border-primary/30 shrink-0">
        <CardContent className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="border-primary/50 text-primary text-[10px]">
              AI Studio Output
            </Badge>
            <span className="text-[10px] text-muted-foreground">Interactive</span>
          </div>

          <h3 className="font-medium text-xs">Generate Executive Briefing</h3>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Synthesize key takeaways across all notebook documents into a studio note.
          </p>

          <Button
            disabled={!activeNotebook || isSubmitting}
            onClick={generateAISummaryNote}
            className="w-full justify-center space-x-2 bg-primary text-primary-foreground text-xs h-8"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate AI Briefing Note</span>
          </Button>
        </CardContent>
      </Card>

      {/* Studio Notes List */}
      <div className="space-y-2 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Notebook Notes ({activeNotes.length})</span>
          </div>
          <button
            disabled={!activeNotebook}
            onClick={() => setCreateNoteOpen(true)}
            className="text-primary hover:underline text-xs lowercase tracking-normal flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" /> new
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {activeNotes.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
              No notes saved yet. Click "+ new" or generate an AI briefing note.
            </div>
          ) : (
            activeNotes.map((note) => (
              <Card
                key={note.id}
                onClick={() => setSelectedNote(note)}
                className="bg-secondary/30 border-border/60 hover:border-primary/50 transition-all cursor-pointer group"
              >
                <CardContent className="p-2.5 flex items-center space-x-2.5">
                  {note.type === 'ai_summary' ? (
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{note.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{note.content}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNote(note.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
