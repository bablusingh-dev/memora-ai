'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Loader2,
  Table2,
  ScrollText,
  Network,
  Presentation,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { useMemorybookStore } from '@/store/useMemorybookStore';
import { StudioArtifact, StudioArtifactKind, PodcastPayload } from '@/types/api';
import { StudioArtifactCard } from '@/components/memorybook/studio/StudioArtifactCard';
import { FlashcardViewer } from '@/components/memorybook/studio/FlashcardViewer';
import { QuizViewer } from '@/components/memorybook/studio/QuizViewer';
import { DataTableViewer } from '@/components/memorybook/studio/DataTableViewer';
import { ReportViewer } from '@/components/memorybook/studio/ReportViewer';
import { MindMapViewer } from '@/components/memorybook/studio/MindMapViewer';
import { SlideDeckViewer } from '@/components/memorybook/studio/SlideDeckViewer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/**
 * One entry per live Studio generator card. Adding a new kind here (plus a
 * viewer branch in the artifact dialog below) is the only UI change needed
 * per feature — the generation/polling/list plumbing is generic.
 */
const STUDIO_GENERATOR_CONFIGS: {
  kind: StudioArtifactKind;
  label: string;
  description: string;
  generatingLabel: string;
  icon: React.ElementType;
  iconClass: string;
}[] = [
  {
    kind: 'flashcards',
    label: 'Flashcards',
    description: 'Study cards generated from your sources',
    generatingLabel: 'Generating your deck…',
    icon: Layers,
    iconClass: 'bg-violet-500/10 text-violet-500',
  },
  {
    kind: 'quiz',
    label: 'Quiz',
    description: 'Test your understanding with multiple-choice questions',
    generatingLabel: 'Generating your quiz…',
    icon: HelpCircle,
    iconClass: 'bg-sky-500/10 text-sky-500',
  },
  {
    kind: 'data_table',
    label: 'Data Table',
    description: 'Key facts and figures extracted into a sortable table',
    generatingLabel: 'Building your table…',
    icon: Table2,
    iconClass: 'bg-orange-500/10 text-orange-500',
  },
  {
    kind: 'report',
    label: 'Report',
    description: 'A structured written summary of your sources',
    generatingLabel: 'Writing your report…',
    icon: ScrollText,
    iconClass: 'bg-rose-500/10 text-rose-500',
  },
  {
    kind: 'mind_map',
    label: 'Mind Map',
    description: 'Key concepts and how they connect, visualized',
    generatingLabel: 'Mapping your sources…',
    icon: Network,
    iconClass: 'bg-teal-500/10 text-teal-500',
  },
  {
    kind: 'slide_deck',
    label: 'Slide Deck',
    description: 'A presentation-ready outline of your sources',
    generatingLabel: 'Building your deck…',
    icon: Presentation,
    iconClass: 'bg-indigo-500/10 text-indigo-500',
  },
];

/**
 * Per-kind viewer dialog config: icon, a one-line description of the
 * payload, and the viewer component itself. Looked up by `selectedArtifact.kind`
 * so adding a new Studio kind only means adding one entry here.
 */
const STUDIO_VIEWER_CONFIGS: Record<
  StudioArtifactKind,
  { icon: React.ElementType; describe: (artifact: StudioArtifact) => string; render: (artifact: StudioArtifact) => React.ReactNode }
> = {
  flashcards: {
    icon: Layers,
    describe: (a) => `${a.payload && 'cards' in a.payload ? a.payload.cards.length : 0} cards, generated from your sources`,
    render: (a) => (a.payload && 'cards' in a.payload ? <FlashcardViewer payload={a.payload} /> : null),
  },
  quiz: {
    icon: HelpCircle,
    describe: (a) => `${a.payload && 'questions' in a.payload ? a.payload.questions.length : 0} questions, generated from your sources`,
    render: (a) => (a.payload && 'questions' in a.payload ? <QuizViewer payload={a.payload} /> : null),
  },
  data_table: {
    icon: Table2,
    describe: (a) => `${a.payload && 'rows' in a.payload ? a.payload.rows.length : 0} rows, generated from your sources`,
    render: (a) => (a.payload && 'rows' in a.payload ? <DataTableViewer payload={a.payload} /> : null),
  },
  report: {
    icon: ScrollText,
    describe: (a) => `${a.payload && 'sections' in a.payload ? a.payload.sections.length : 0} sections, generated from your sources`,
    render: (a) => (a.payload && 'sections' in a.payload ? <ReportViewer payload={a.payload} /> : null),
  },
  mind_map: {
    icon: Network,
    describe: (a) => `${a.payload && 'nodes' in a.payload ? a.payload.nodes.length : 0} concepts, generated from your sources`,
    render: (a) => (a.payload && 'nodes' in a.payload ? <MindMapViewer payload={a.payload} /> : null),
  },
  slide_deck: {
    icon: Presentation,
    describe: (a) => `${a.payload && 'slides' in a.payload ? a.payload.slides.length + 1 : 0} slides, generated from your sources`,
    render: (a) => (a.payload && 'slides' in a.payload ? <SlideDeckViewer payload={a.payload} /> : null),
  },
  // Podcast has its own dedicated "Audio" tab (below) rather than the
  // generic Studio-tab card + shared dialog every other kind uses — this
  // entry exists only so the Record<StudioArtifactKind, ...> stays
  // exhaustive; it's never reached since podcast is excluded from
  // STUDIO_GENERATOR_CONFIGS.
  podcast: {
    icon: Headphones,
    describe: (a) => `${a.payload && 'durationSec' in a.payload ? Math.round(a.payload.durationSec / 60) : 0} min, generated from your sources`,
    render: () => null,
  },
};

// Kinds whose content benefits from a wider dialog (a table or a long-form
// document reads poorly squeezed into the default 440px card-style width).
const WIDE_VIEWER_KINDS = new Set<StudioArtifactKind>(['data_table', 'report', 'mind_map', 'slide_deck']);

export function AudioOverviewPanel() {
  const {
    activeMemorybook,
    activeNotes,
    createNote,
    deleteNote,
    studioArtifacts,
    generateStudioArtifact,
    deleteStudioArtifact,
    uiActiveStudioTab: activeTab,
    setActiveStudioTab: setActiveTab,
  } = useMemorybookStore();

  // Note Modal States
  const [isCreateNoteOpen, setCreateNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [notesSearch, setNotesSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audio Player (Deep Dive Podcast) — driven by a real <audio> element once
  // a podcast artifact is ready; see the audio-event wiring effect below.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const speeds = [1.0, 1.25, 1.5, 2.0];
  const [isPodcastDialogOpen, setPodcastDialogOpen] = useState(false);
  const [podcastFocus, setPodcastFocus] = useState('');

  // Studio artifact generation/viewing state
  const [selectedArtifact, setSelectedArtifact] = useState<StudioArtifact | null>(null);
  const [requestingKind, setRequestingKind] = useState<StudioArtifactKind | null>(null);

  const isKindGenerating = (kind: StudioArtifactKind) =>
    requestingKind === kind || studioArtifacts.some((a) => a.kind === kind && a.status === 'generating');

  const handleGenerate = async (kind: StudioArtifactKind) => {
    if (!activeMemorybook || isKindGenerating(kind)) return;
    setRequestingKind(kind);
    try {
      await generateStudioArtifact(kind);
    } catch (e) {
      // error surfaced via store's error state / the card's own status
    } finally {
      setRequestingKind(null);
    }
  };

  const podcastArtifact = studioArtifacts.find((a) => a.kind === 'podcast');
  const podcastPayload: PodcastPayload | null =
    podcastArtifact?.status === 'ready' && podcastArtifact.payload && 'audioUrl' in podcastArtifact.payload
      ? podcastArtifact.payload
      : null;
  const podcastGenerating = isKindGenerating('podcast');

  const handleGeneratePodcast = async () => {
    if (!activeMemorybook || podcastGenerating) return;
    setRequestingKind('podcast');
    try {
      await generateStudioArtifact('podcast', { focus: podcastFocus.trim() || undefined });
      setPodcastDialogOpen(false);
      setPodcastFocus('');
    } catch (e) {
      // error surfaced via store's error state
    } finally {
      setRequestingKind(null);
    }
  };

  // Wire the real <audio> element's playback state once a podcast is ready —
  // re-runs whenever the audio source changes (new podcast generated).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [podcastPayload?.audioUrl]);

  const togglePodcastPlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  };

  const restartPodcast = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
  };

  const cyclePodcastSpeed = () => {
    const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  };

  const seekPodcast = (percent: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const newTime = (percent / 100) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatPlaybackTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSaveTranscript = () => {
    if (!podcastPayload) return;
    const transcriptMd = podcastPayload.turns
      .map((t) => `- ${t.speaker === 'host_a' ? 'Host A' : 'Host B'}: ${t.text}`)
      .join('\n');
    generateAIArtifact(
      'ai_summary',
      'Podcast Transcript',
      `# Podcast Transcript: ${podcastArtifact?.title || activeMemorybook?.title || 'Workspace'}\n\n${transcriptMd}`
    );
  };

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
    if (!activeMemorybook) return;
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
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'audio' | 'studio' | 'notes')}
        className="w-full flex-1 flex flex-col min-h-0"
      >
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
              {podcastPayload && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {Math.round(podcastPayload.durationSec / 60)} min summary
                </span>
              )}
            </div>

            <div>
              <h3 className="font-bold text-xs text-foreground">
                {podcastArtifact?.status === 'ready' ? podcastArtifact.title : 'Audio Overview'}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Two AI hosts discuss key findings and insights from your workspace sources.
              </p>
            </div>

            {podcastArtifact?.status === 'error' ? (
              // Generation failed — surface the reason and let the user retry.
              <div className="space-y-3">
                <div className="flex items-start space-x-2 p-3 rounded-2xl bg-destructive/10 text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">{podcastArtifact.errorMessage || 'Generation failed.'}</p>
                </div>
                <Button
                  disabled={!activeMemorybook}
                  onClick={() => setPodcastDialogOpen(true)}
                  className="w-full justify-center space-x-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9 rounded-2xl border-0 font-semibold shadow-xs"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </Button>
              </div>
            ) : podcastGenerating ? (
              // Generation in progress — this genuinely takes longer than the
              // other Studio kinds (script + many sequential TTS calls), so
              // set that expectation instead of looking stuck.
              <div className="flex flex-col items-center justify-center py-6 space-y-2 text-center">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Writing the script and recording both hosts — this can take a minute or two…
                </p>
              </div>
            ) : podcastPayload ? (
              <>
                {/* Real audio element — hidden, driven by the controls below */}
                <audio ref={audioRef} src={podcastPayload.audioUrl} preload="metadata" className="hidden" />

                {/* Visualizer Bar (reacts to real playback state) */}
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

                {/* Scrub Slider — bound to real currentTime/duration */}
                <div className="space-y-1">
                  <Slider
                    value={[duration ? (currentTime / duration) * 100 : 0]}
                    onValueChange={(val) => seekPodcast(val[0])}
                    max={100}
                    step={1}
                    className="w-full cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>{formatPlaybackTime(currentTime)}</span>
                    <span>{formatPlaybackTime(duration)}</span>
                  </div>
                </div>

                {/* Player Controls */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={cyclePodcastSpeed}
                    className="text-[11px] font-mono font-bold px-2 py-1 rounded-xl bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {playbackSpeed}x
                  </button>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={restartPodcast}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      onClick={togglePodcastPlayback}
                      disabled={!activeMemorybook}
                      className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground p-0 flex items-center justify-center shadow-xs"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </Button>
                  </div>

                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSaveTranscript}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="Save Transcript to Notes"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => podcastArtifact && deleteStudioArtifact(podcastArtifact.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="Delete Podcast"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              // No podcast generated yet
              <Button
                disabled={!activeMemorybook}
                onClick={() => setPodcastDialogOpen(true)}
                className="w-full justify-center space-x-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9 rounded-2xl border-0 font-semibold shadow-xs"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Generate Deep Dive Podcast</span>
              </Button>
            )}
          </Card>

          {/* Quick AI Summary Note Generator */}
          <Button
            disabled={!activeMemorybook || isSubmitting}
            onClick={() =>
              generateAIArtifact(
                'ai_summary',
                `Executive Briefing - ${new Date().toLocaleDateString()}`,
                `# Executive Briefing: ${activeMemorybook?.title}\n\n### Key Synthesized Themes:\n1. **Grounded Multi-Document Context**: Real-time integration of PDFs, web pages, and YouTube transcripts.\n2. **Precise, Cited Retrieval**: Every answer traces back to exact passages in your sources.\n3. **Private by Default**: Your workspace and its contents stay isolated to your account.`
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
            AI synthesis tools based on your workspace sources:
          </p>

          {STUDIO_GENERATOR_CONFIGS.map(({ kind, label, description, generatingLabel, icon: Icon, iconClass }) => {
            const generating = isKindGenerating(kind);
            return (
              <React.Fragment key={kind}>
                <Card
                  onClick={() => handleGenerate(kind)}
                  className={`bg-background/90 dark:bg-card border-0 shadow-2xs rounded-2xl p-3 flex items-center space-x-3 transition-all duration-150 ${
                    !activeMemorybook || generating
                      ? 'opacity-60 cursor-not-allowed'
                      : 'hover:bg-background cursor-pointer hover:scale-[1.01] active:scale-[0.99]'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${iconClass}`}>
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{label}</h4>
                    <p className="text-[10px] text-muted-foreground">{generating ? generatingLabel : description}</p>
                  </div>
                </Card>

                {studioArtifacts.filter((a) => a.kind === kind).length > 0 && (
                  <div className="space-y-2 pt-1">
                    {studioArtifacts
                      .filter((a) => a.kind === kind)
                      .map((artifact) => (
                        <StudioArtifactCard
                          key={artifact.id}
                          artifact={artifact}
                          onOpen={() => setSelectedArtifact(artifact)}
                          onDelete={() => deleteStudioArtifact(artifact.id)}
                        />
                      ))}
                  </div>
                )}
              </React.Fragment>
            );
          })}

          <p className="text-[10px] text-muted-foreground/70 pt-3 pb-1 uppercase tracking-wide font-semibold">
            Coming soon
          </p>

          <div className="opacity-50 grayscale bg-background/60 dark:bg-card/50 border border-dashed border-muted-foreground/25 rounded-2xl p-3 flex items-center space-x-3 cursor-not-allowed">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Study Guide</h4>
              <p className="text-[10px] text-muted-foreground">Key concepts & definitions</p>
            </div>
          </div>

          <div className="opacity-50 grayscale bg-background/60 dark:bg-card/50 border border-dashed border-muted-foreground/25 rounded-2xl p-3 flex items-center space-x-3 cursor-not-allowed">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">FAQ Document</h4>
              <p className="text-[10px] text-muted-foreground">Most common questions answered</p>
            </div>
          </div>

          <div className="opacity-50 grayscale bg-background/60 dark:bg-card/50 border border-dashed border-muted-foreground/25 rounded-2xl p-3 flex items-center space-x-3 cursor-not-allowed">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Timeline Outline</h4>
              <p className="text-[10px] text-muted-foreground">Chronological sequence of events</p>
            </div>
          </div>
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
              disabled={!activeMemorybook}
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

      {/* Studio Artifact Viewer Dialog */}
      <Dialog open={!!selectedArtifact} onOpenChange={() => setSelectedArtifact(null)}>
        <DialogContent
          className={`${
            selectedArtifact?.kind === 'mind_map'
              ? 'sm:max-w-[820px]'
              : selectedArtifact && WIDE_VIEWER_KINDS.has(selectedArtifact.kind)
                ? 'sm:max-w-[640px]'
                : 'sm:max-w-[440px]'
          } border-0 bg-slate-100 dark:bg-zinc-900 ring-1 ring-black/5 dark:ring-white/10 shadow-2xl dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.95)] text-foreground rounded-3xl p-5 space-y-3`}
        >
          {selectedArtifact && (
            <>
              <DialogHeader className="bg-white dark:bg-zinc-950 p-4 rounded-2xl shadow-2xs">
                <DialogTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                  {(() => {
                    const Icon = STUDIO_VIEWER_CONFIGS[selectedArtifact.kind].icon;
                    return <Icon className="w-4 h-4 text-primary" />;
                  })()}
                  <span className="truncate">{selectedArtifact.title}</span>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                  {STUDIO_VIEWER_CONFIGS[selectedArtifact.kind].describe(selectedArtifact)}
                </DialogDescription>
              </DialogHeader>

              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 shadow-2xs">
                {STUDIO_VIEWER_CONFIGS[selectedArtifact.kind].render(selectedArtifact)}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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

      {/* Generate Podcast Dialog */}
      <Dialog open={isPodcastDialogOpen} onOpenChange={setPodcastDialogOpen}>
        <DialogContent className="sm:max-w-[450px] border-0 bg-slate-100 dark:bg-zinc-900 ring-1 ring-black/5 dark:ring-white/10 shadow-2xl dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.95)] text-foreground rounded-3xl p-5 space-y-3">
          <DialogHeader className="bg-white dark:bg-zinc-950 p-4 rounded-2xl shadow-2xs">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Headphones className="w-4 h-4 text-primary" /> Generate Deep Dive Podcast
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Two AI hosts will discuss your sources in a ~6-8 minute conversation.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl shadow-2xs space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Focus on... (optional)</label>
              <textarea
                rows={3}
                placeholder="e.g. Focus on the financial risks and mitigation strategies"
                value={podcastFocus}
                onChange={(e) => setPodcastFocus(e.target.value)}
                disabled={podcastGenerating}
                maxLength={300}
                className="w-full rounded-2xl bg-slate-100 dark:bg-zinc-800/90 px-3.5 py-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary border-0 shadow-inner"
              />
              <p className="text-[10px] text-muted-foreground">Leave blank for a general overview of everything in this workspace.</p>
            </div>
            <Button
              onClick={handleGeneratePodcast}
              disabled={!activeMemorybook || podcastGenerating}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 rounded-2xl border-0 shadow-xs gap-2"
            >
              {podcastGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Headphones className="w-3.5 h-3.5" />}
              <span>Generate</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
