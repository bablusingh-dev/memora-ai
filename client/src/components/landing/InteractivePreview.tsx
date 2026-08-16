'use client';

import React from 'react';
import { FileText, Globe, Youtube, Play, Bot, User, Sparkles, Plus, BookOpen, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function InteractivePreview() {
  return (
    <section id="how-it-works" className="py-24 bg-background relative overflow-hidden transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            <Layers className="w-3.5 h-3.5" />
            <span>Fluid 3-Column Workspace</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
            Designed for Seamless Research Workflows
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed font-normal">
            Manage your sources on the left, converse with AI in the center, and listen to podcast overviews or review notes on the right.
          </p>
        </div>

        {/* Mockup Container with zero border */}
        <div className="relative rounded-3xl bg-card shadow-2xl overflow-hidden p-1">
          {/* Header Bar */}
          <div className="h-11 bg-muted/40 px-4 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-amber-500/70" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
              <span className="text-xs font-medium text-muted-foreground ml-3 hidden sm:inline-block">
                Memora AI Workspace — Deep Learning RAG Paper.pdf
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] bg-primary/10 text-primary px-3 py-0.5 rounded-full font-mono font-medium">
                BM25 Indexed
              </span>
            </div>
          </div>

          {/* 3-Panel Preview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[440px] text-xs gap-1 bg-muted/20 p-1">
            {/* Left Panel: Sources */}
            <div className="md:col-span-3 bg-card p-4 flex flex-col justify-between rounded-bl-2xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                    <BookOpen className="w-3.5 h-3.5 text-primary" /> Sources (3)
                  </span>
                  <span className="text-[11px] font-semibold text-primary cursor-pointer hover:underline flex items-center gap-0.5">
                    <Plus className="w-3 h-3" /> Add Source
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="p-3 rounded-2xl bg-primary/10 text-foreground flex items-start gap-2.5 shadow-2xs">
                    <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-xs truncate text-primary">ParadeDB_BM25_RAG_Paper.pdf</p>
                      <p className="text-[10px] text-muted-foreground">14 Chunks • 12.4 KB</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 text-foreground flex items-start gap-2.5 transition-all shadow-2xs">
                    <Globe className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-xs truncate text-foreground">Next.js & Drizzle ORM Docs</p>
                      <p className="text-[10px] text-muted-foreground">Firecrawl Web • 8 Chunks</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 text-foreground flex items-start gap-2.5 transition-all shadow-2xs">
                    <Youtube className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-xs truncate text-foreground">Notebook LLM Demo Video</p>
                      <p className="text-[10px] text-muted-foreground">YouTube Transcript • 22 Chunks</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 text-[11px] text-muted-foreground">
                Total Chunks: <span className="font-bold text-foreground">44 active</span>
              </div>
            </div>

            {/* Center Panel: Chat Studio */}
            <div className="md:col-span-6 p-5 flex flex-col justify-between bg-card">
              <div className="space-y-4 overflow-hidden">
                {/* User Message */}
                <div className="flex gap-2.5 items-start">
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-muted/50 text-foreground p-3.5 rounded-2xl max-w-[88%] font-medium text-xs leading-relaxed">
                    How does ParadeDB BM25 search differ from standard vector embeddings?
                  </div>
                </div>

                {/* AI Message */}
                <div className="flex gap-2.5 items-start">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-primary/5 text-foreground p-4 rounded-2xl max-w-[92%] font-normal text-xs leading-relaxed space-y-2.5">
                    <p>
                      <strong className="font-semibold text-primary">ParadeDB BM25 Search</strong> utilizes algorithmic probabilistic scoring directly within PostgreSQL (`pg_search`), eliminating vector embedding latency and semantic drift.
                    </p>
                    <div className="p-2.5 rounded-xl bg-muted/40 text-[11px] text-muted-foreground font-mono">
                      Citation: [ParadeDB_BM25_RAG_Paper.pdf Chunk #3]
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Input Placeholder */}
              <div className="mt-4">
                <div className="h-11 rounded-2xl bg-muted/40 px-4 flex items-center justify-between text-muted-foreground text-xs shadow-2xs">
                  <span>Ask a question about your uploaded sources...</span>
                  <div className="p-1.5 rounded-xl bg-primary text-primary-foreground">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel: Audio Overview & Studio */}
            <div className="md:col-span-3 bg-card p-4 flex flex-col justify-between rounded-br-2xl">
              <div>
                <div className="font-bold text-foreground mb-3 text-xs flex items-center justify-between">
                  <span>Audio Overview</span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2.5 py-0.5 rounded-full font-mono font-medium">
                    Ready
                  </span>
                </div>

                {/* Player Card */}
                <div className="p-4 rounded-2xl bg-muted/30 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-foreground">Deep Learning Overview</p>
                      <p className="text-[10px] text-muted-foreground">Two-Speaker Podcast • 3m 45s</p>
                    </div>
                    <Button size="icon" className="w-8 h-8 rounded-full bg-primary text-primary-foreground shrink-0 shadow-sm border-0">
                      <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                    </Button>
                  </div>

                  {/* Waveform graphic */}
                  <div className="flex items-center gap-1 h-5 pt-1">
                    {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 65, 30, 85, 40, 75, 55, 90, 60, 35, 80].map((h, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full ${i < 8 ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="font-bold text-foreground mb-2.5 text-xs">Saved Notes (2)</div>
                  <div className="space-y-2">
                    <div className="p-3 rounded-2xl bg-muted/30 text-foreground font-medium text-xs shadow-2xs">
                      Key Takeaways on RAG vs BM25
                    </div>
                    <div className="p-3 rounded-2xl bg-muted/30 text-foreground font-medium text-xs shadow-2xs">
                      Firecrawl Integration Notes
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
