'use client';

import React, { useState } from 'react';
import {
  Headphones,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  BookOpen,
  Layers,
  Plus,
  Trash2,
  FileText,
  CheckCircle2,
  Download,
  HelpCircle,
  Clock,
  ListTodo,
  Share2,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { useNotebookStore } from '@/store/useNotebookStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export function AudioOverviewPanel() {
  const { activeNotebook, activeNotes, createNote, deleteNote } = useNotebookStore();
  const [activeTab, setActiveTab] = useState('audio');

  // Note Modal States
  const [isCreateNoteOpen, setCreateNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [notesSearch, setNotesSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audio Player Mock State (deep-dive audio overview)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(25);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const speeds = [1.0, 1.25, 1.5, 2.0];

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

  const generateAIArtifact = async (type: string, title: string, content: string) => {
    if (!activeNotebook) return;
    setIsSubmitting(true);
    try {
      await createNote(
        `${title} - ${new Date().toLocaleDateString()}`,
        content,
        type
      );
      setActiveTab('notes');
    } catch (e) {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredNotes = activeNotes.filter((n) =>
    n.title.toLowerCase().includes(notesSearch.toLowerCase()) ||
    n.content.toLowerCase().includes(notesSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-transparent p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-xl bg-primary/10 text-primary">
            <Headphones className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-sm tracking-tight text-foreground">
            Studio & Overview
          </h2>
        </div>
        <Badge
          variant="secondary"
          className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 border-0"
        >
          {activeNotes.length} Note{activeNotes.length === 1 ? '' : 's'}
        </Badge>
      </div>

      {/* Main Tabs: Audio | Studio Generators | Notes */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-3 w-full bg-background/80 dark:bg-zinc-900/80 p-1 rounded-2xl border-0 shrink-0 shadow-2xs">
          <TabsTrigger
            value="audio"
            className="text-xs font-semibold rounded-xl text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary border-0 transition-colors duration-150 py-1.5"
          >
            Audio
          </TabsTrigger>
          <TabsTrigger
            value="studio"
            className="text-xs font-semibold rounded-xl text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary border-0 transition-colors duration-150 py-1.5"
          >
            Studio
          </TabsTrigger>
          <TabsTrigger
            value="notes"
            className="text-xs font-semibold rounded-xl text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary border-0 transition-colors duration-150 py-1.5"
          >
            Notes
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: AUDIO OVERVIEW */}
        <TabsContent
          value="audio"
          className="mt-0 pt-3 flex-1 flex flex-col min-h-0 space-y-3 overflow-y-auto outline-none data-[state=inactive]:hidden"
        >
          <Card className="bg-background/90 dark:bg-card border-0 shadow-2xs rounded-3xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] font-semibold">
                AI Deep Dive Podcast
              </Badge>
              <span className="text-[10px] text-muted-foreground font-mono">12 min summary</span>
            </div>

            <div>
              <h3 className="font-bold text-xs text-foreground">Audio Overview</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Two AI hosts discuss key findings and insights from your workspace sources.
              </p>
            </div>

            {/* Static Visualizer Bar (No Animations) */}
            <div className="h-10 bg-muted/40 dark:bg-zinc-800/60 rounded-2xl p-2 flex items-center justify-between px-3">
              {[40, 65, 30, 80, 95, 50, 70, 35, 85, 60, 90, 45, 75, 55, 80, 40, 60, 85, 30, 70].map(
                (h, idx) => (
                  <div
                    key={idx}
                    className={`w-1 rounded-full transition-colors ${
                      isPlaying && idx < 8 ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                    style={{ height: `${h}%` }}
                  />
                )
              )}
            </div>

            {/* Scrub Slider */}
            <div className="space-y-1">
              <Slider
                value={[playbackProgress]}
                onValueChange={(val) => setPlaybackProgress(val[0])}
                max={100}
                step={1}
                className="w-full cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>03:00</span>
                <span>12:00</span>
              </div>
            </div>

            {/* Player Controls */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
                  setPlaybackSpeed(nextSpeed);
                }}
                className="text-[11px] font-mono font-bold px-2 py-1 rounded-xl bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                {playbackSpeed}x
              </button>

              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPlaybackProgress(0)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
                <Button
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={!activeNotebook}
                  className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground p-0 flex items-center justify-center shadow-xs"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  generateAIArtifact(
                    'ai_summary',
                    'Audio Overview Transcript',
                    `# Audio Overview Transcript for ${activeNotebook?.title || 'Workspace'}\n\n- Host A: Welcome back to Memora AI Studio.\n- Host B: Today we are examining the core principles of vectorless BM25 search vs dense embeddings.\n- Key takeaways: ParadeDB provides exact BM25 keyword precision.`
                  )
                }
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Save Audio Transcript to Notes"
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>

          {/* Quick AI Summary Note Generator */}
          <Button
            disabled={!activeNotebook || isSubmitting}
            onClick={() =>
              generateAIArtifact(
                'ai_summary',
                `Executive Briefing - ${new Date().toLocaleDateString()}`,
                `# Executive Briefing: ${activeNotebook?.title}\n\n### Key Synthesized Themes:\n1. **Grounded Multi-Document Context**: Real-time integration of PDFs, Web scrapings, and YouTube transcripts.\n2. **ParadeDB BM25 Precision**: Hybrid vectorless retrieval for deterministic term matching.\n3. **Clerk Express Multi-Tenant Security**: Enforced session tokens.`
              )
            }
            className="w-full justify-center space-x-2 bg-background/80 hover:bg-background text-foreground text-xs h-9 rounded-2xl border-0 font-semibold shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Generate Executive Briefing Note</span>
          </Button>
        </TabsContent>

        {/* TAB 2: STUDIO GENERATORS */}
        <TabsContent
          value="studio"
          className="mt-0 pt-3 flex-1 flex flex-col min-h-0 space-y-2 overflow-y-auto outline-none data-[state=inactive]:hidden"
        >
          <p className="text-xs text-muted-foreground mb-1">
            One-click AI synthesis tools based on workspace sources:
          </p>

          <Card
            onClick={() =>
              generateAIArtifact(
                'study_guide',
                'Comprehensive Study Guide',
                `# Study Guide: ${activeNotebook?.title || 'Workspace'}\n\n### Core Concepts:\n- **BM25 Scoring**: Evaluates term frequency and inverse document frequency.\n- **Firecrawl**: Transforms complex Web HTML into clean Markdown.\n- **Svix Webhook Handling**: Ensures zero-latency user synchronization.`
              )
            }
            className="bg-background/90 dark:bg-card hover:bg-background transition-colors duration-150 cursor-pointer border-0 shadow-2xs rounded-2xl p-3 flex items-center space-x-3"
          >
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Study Guide</h4>
              <p className="text-[10px] text-muted-foreground">Key concepts, definitions, & flashcards</p>
            </div>
          </Card>

          <Card
            onClick={() =>
              generateAIArtifact(
                'faq',
                'Frequently Asked Questions',
                `# FAQ: ${activeNotebook?.title || 'Workspace'}\n\n**Q: How does ParadeDB handle search?**\n*A: ParadeDB uses Postgres-native BM25 index extension via pg_search syntax.*\n\n**Q: How are YouTube videos ingested?**\n*A: YouTube video IDs are passed to the backend transcript API for text extraction.*`
              )
            }
            className="bg-background/90 dark:bg-card hover:bg-background transition-colors duration-150 cursor-pointer border-0 shadow-2xs rounded-2xl p-3 flex items-center space-x-3"
          >
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">FAQ Document</h4>
              <p className="text-[10px] text-muted-foreground">Most common questions answered</p>
            </div>
          </Card>

          <Card
            onClick={() =>
              generateAIArtifact(
                'timeline',
                'Project & Concept Timeline',
                `# Concept Timeline: ${activeNotebook?.title || 'Workspace'}\n\n- **Phase 1**: Database schema design & Drizzle ORM setup.\n- **Phase 2**: Clerk authentication integration & Express Middleware.\n- **Phase 3**: RAG pipeline & ParadeDB BM25 query construction.`
              )
            }
            className="bg-background/90 dark:bg-card hover:bg-background transition-colors duration-150 cursor-pointer border-0 shadow-2xs rounded-2xl p-3 flex items-center space-x-3"
          >
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Timeline Outline</h4>
              <p className="text-[10px] text-muted-foreground">Chronological sequence of events</p>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 3: WORKSPACE NOTES */}
        <TabsContent
          value="notes"
          className="mt-0 pt-3 flex-1 flex flex-col min-h-0 space-y-3 outline-none data-[state=inactive]:hidden"
        >
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={notesSearch}
                onChange={(e) => setNotesSearch(e.target.value)}
                className="pl-8 bg-background/80 dark:bg-card border-0 text-xs h-8 rounded-xl placeholder:text-muted-foreground shadow-2xs"
              />
            </div>
            <Button
              disabled={!activeNotebook}
              onClick={() => setCreateNoteOpen(true)}
              size="sm"
              className="bg-primary text-primary-foreground font-semibold h-8 text-xs px-3 rounded-xl border-0 shadow-2xs gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Note</span>
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredNotes.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground bg-background/60 dark:bg-card/50 rounded-2xl border-0 shadow-2xs">
                No notes found. Create a custom note or generate an AI artifact.
              </div>
            ) : (
              filteredNotes.map((note) => (
                <Card
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className="bg-background/90 dark:bg-card hover:bg-background transition-colors duration-150 cursor-pointer group border-0 rounded-2xl p-3 shadow-2xs"
                >
                  <div className="flex items-start space-x-2.5">
                    {note.type === 'ai_summary' || note.type === 'study_guide' ? (
                      <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <BookOpen className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate text-foreground">{note.title}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-tight">
                        {note.content}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNote(note.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity shrink-0 text-muted-foreground"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Note View Dialog */}
      <Dialog open={!!selectedNote} onOpenChange={() => setSelectedNote(null)}>
        <DialogContent className="sm:max-w-[500px] border-0 bg-slate-100 dark:bg-zinc-900 ring-1 ring-black/5 dark:ring-white/10 shadow-2xl dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.95)] text-foreground rounded-3xl p-5 space-y-3">
          <DialogHeader className="bg-white dark:bg-zinc-950 p-4 rounded-2xl shadow-2xs">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              <span className="truncate">{selectedNote?.title}</span>
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
              Created {selectedNote?.createdAt ? new Date(selectedNote.createdAt).toLocaleString() : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 text-xs leading-relaxed max-h-[350px] overflow-y-auto text-foreground font-mono shadow-2xs">
            <p className="whitespace-pre-wrap">{selectedNote?.content}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Note Dialog */}
      <Dialog open={isCreateNoteOpen} onOpenChange={setCreateNoteOpen}>
        <DialogContent className="sm:max-w-[450px] border-0 bg-slate-100 dark:bg-zinc-900 ring-1 ring-black/5 dark:ring-white/10 shadow-2xl dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.95)] text-foreground rounded-3xl p-5 space-y-3">
          <DialogHeader className="bg-white dark:bg-zinc-950 p-4 rounded-2xl shadow-2xs">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Plus className="w-4 h-4 text-primary" /> Create Workspace Note
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Save key takeaways, study flashcards, or research notes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateNote} className="bg-white dark:bg-zinc-950 p-4 rounded-2xl shadow-2xs space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Note Title</label>
              <Input
                placeholder="e.g. Chapter 4 Key Takeaways"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                disabled={isSubmitting}
                className="bg-slate-100 dark:bg-zinc-800/90 border-0 text-foreground text-xs h-10 rounded-2xl shadow-inner"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Content</label>
              <textarea
                rows={4}
                placeholder="Write your note here..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-slate-100 dark:bg-zinc-800/90 px-3.5 py-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary border-0 shadow-inner"
              />
            </div>
            <Button
              type="submit"
              disabled={!noteTitle.trim() || !noteContent.trim() || isSubmitting}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 rounded-2xl border-0 shadow-xs"
            >
              Save Note
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
