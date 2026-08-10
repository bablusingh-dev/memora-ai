'use client';

import React from 'react';
import { SourcesPanel } from '@/components/notebook/SourcesPanel';
import { ChatStudioPanel } from '@/components/notebook/ChatStudioPanel';
import { AudioOverviewPanel } from '@/components/notebook/AudioOverviewPanel';
import { Brain, Settings, HelpCircle, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotebookDashboardPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 border-b border-border bg-card/80 backdrop-blur px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight flex items-center gap-2">
              memora-ai <span className="text-[10px] font-normal text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded">Notebook LLM</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <HelpCircle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="w-4 h-4" />
          </Button>
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center font-bold text-xs justify-center text-primary">
            AI
          </div>
        </div>
      </header>

      {/* Main 3-Column Responsive Grid */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
        {/* Left Column: Sources */}
        <section className="md:col-span-3 h-full overflow-hidden">
          <SourcesPanel />
        </section>

        {/* Center Column: Chat & Studio */}
        <section className="md:col-span-6 h-full overflow-hidden">
          <ChatStudioPanel />
        </section>

        {/* Right Column: Audio Overview & Studio */}
        <section className="md:col-span-3 h-full overflow-hidden">
          <AudioOverviewPanel />
        </section>
      </main>
    </div>
  );
}
