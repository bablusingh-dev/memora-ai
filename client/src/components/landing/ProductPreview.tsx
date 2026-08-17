'use client';

import React, { useState } from 'react';
import { FileText, Globe, Youtube, Play, Bot, User, Sparkles, Plus, BookOpen, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/landing/shared/Container';
import { SectionEyebrow } from '@/components/landing/shared/SectionEyebrow';
import { Reveal } from '@/components/landing/shared/Reveal';
import { cn } from '@/lib/utils';

type PreviewTab = 'sources' | 'chat' | 'audio';

const tabs: { id: PreviewTab; label: string }[] = [
  { id: 'sources', label: 'Sources' },
  { id: 'chat', label: 'Chat' },
  { id: 'audio', label: 'Audio & Studio' },
];

export function ProductPreview() {
  const [activeTab, setActiveTab] = useState<PreviewTab>('chat');

  return (
    <section id="preview" className="py-24 bg-background relative overflow-hidden transition-colors">
      <Container>
        <div className="text-center max-w-3xl mx-auto mb-12">
          <SectionEyebrow icon={Eye}>See it in action</SectionEyebrow>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
            One workspace, built around your sources
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed font-normal">
            Your material sits on the left, conversation happens in the center, and
            audio overviews and notes live on the right — try each panel below.
          </p>
        </div>

        {/* Tab switcher */}
        <Reveal>
          <div className="flex items-center justify-center gap-2 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2 rounded-2xl text-xs font-semibold transition-colors border-0',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Mockup Container */}
        <Reveal delay={0.1}>
          <div className="relative rounded-3xl bg-card shadow-2xl overflow-hidden p-1">
            {/* Header Bar */}
            <div className="h-11 bg-muted/40 px-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                <span className="text-xs font-medium text-muted-foreground ml-3 hidden sm:inline-block">
                  Deep Learning Reading List — Workspace
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] bg-primary/10 text-primary px-3 py-0.5 rounded-full font-mono font-medium">
                  3 sources indexed
                </span>
              </div>
            </div>

            {/* 3-Panel Preview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[440px] text-xs gap-1 bg-muted/20 p-1">
              {/* Left Panel: Sources */}
              <div
                className={cn(
                  'md:col-span-3 bg-card p-4 flex flex-col justify-between rounded-bl-2xl transition-all duration-200',
                  activeTab === 'sources' ? 'md:ring-2 md:ring-primary/50' : 'md:opacity-60'
                )}
              >
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
                        <p className="font-semibold text-xs truncate text-primary">Attention_Is_All_You_Need.pdf</p>
                        <p className="text-[10px] text-muted-foreground">14 Chunks • 12.4 KB</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 text-foreground flex items-start gap-2.5 transition-all shadow-2xs">
                      <Globe className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-semibold text-xs truncate text-foreground">Transformer Architecture Guide</p>
                        <p className="text-[10px] text-muted-foreground">Web page • 8 Chunks</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 text-foreground flex items-start gap-2.5 transition-all shadow-2xs">
                      <Youtube className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-semibold text-xs truncate text-foreground">Distributed Systems Lecture</p>
                        <p className="text-[10px] text-muted-foreground">YouTube transcript • 22 Chunks</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 text-[11px] text-muted-foreground">
                  Total Chunks: <span className="font-bold text-foreground">44 active</span>
                </div>
              </div>

              {/* Center Panel: Chat Studio */}
              <div
                className={cn(
                  'md:col-span-6 p-5 flex flex-col justify-between bg-card transition-all duration-200',
                  activeTab === 'chat' ? 'md:ring-2 md:ring-primary/50 rounded-2xl' : 'md:opacity-60'
                )}
              >
                <div className="space-y-4 overflow-hidden">
                  {/* User Message */}
                  <div className="flex gap-2.5 items-start">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-muted/50 text-foreground p-3.5 rounded-2xl max-w-[88%] font-medium text-xs leading-relaxed">
                      How does self-attention differ from recurrent architectures?
                    </div>
                  </div>

                  {/* AI Message */}
                  <div className="flex gap-2.5 items-start">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="bg-primary/5 text-foreground p-4 rounded-2xl max-w-[92%] font-normal text-xs leading-relaxed space-y-2.5">
                      <p>
                        <strong className="font-semibold text-primary">Self-attention</strong> lets every token weigh every other token directly in a single step, instead of passing state sequentially through time like an RNN.
                      </p>
                      <div className="p-2.5 rounded-xl bg-muted/40 text-[11px] text-muted-foreground font-mono">
                        Citation: [Attention_Is_All_You_Need.pdf · Chunk #3]
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
              <div
                className={cn(
                  'md:col-span-3 bg-card p-4 flex flex-col justify-between rounded-br-2xl transition-all duration-200',
                  activeTab === 'audio' ? 'md:ring-2 md:ring-primary/50' : 'md:opacity-60'
                )}
              >
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
                        <p className="font-bold text-xs text-foreground">Transformers, Explained</p>
                        <p className="text-[10px] text-muted-foreground">Two-Speaker Podcast • 8m 20s</p>
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
                        Key Differences: Attention vs. RNNs
                      </div>
                      <div className="p-3 rounded-2xl bg-muted/30 text-foreground font-medium text-xs shadow-2xs">
                        Study Guide: Transformer Basics
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
