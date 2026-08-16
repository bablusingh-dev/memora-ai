'use client';

import React from 'react';
import { Database, FileUp, MessageSquare, Mic } from 'lucide-react';
import { HoverEffect } from '@/components/aceternity/HoverEffect';

export function FeatureShowcase() {
  const features = [
    {
      icon: Database,
      color: 'text-blue-500 bg-blue-500/10',
      title: 'ParadeDB Vectorless BM25 Search',
      description:
        'Leverages PostgreSQL pg_search BM25 algorithmic indexing for pinpoint keyword scoring and hybrid search across document chunks without semantic drift.',
      points: ['No embedding hallucination', 'Instant keyword precision', 'Full Drizzle ORM integration'],
    },
    {
      icon: FileUp,
      color: 'text-amber-500 bg-amber-500/10',
      title: 'Multi-Source Data Ingestion',
      description:
        'Ingest research documents from PDFs, text files, web page URLs using Firecrawl, or YouTube video transcripts into a single organized workspace.',
      points: ['PDF & TXT document parsing', 'Firecrawl Web Crawler', 'YouTube transcript extraction'],
    },
    {
      icon: MessageSquare,
      color: 'text-indigo-500 bg-indigo-500/10',
      title: 'Interactive Chat & Note Studio',
      description:
        'Chat directly with your active workspace sources. Generate markdown notes, executive summaries, and study guides with real-time source citations.',
      points: ['Context-grounded responses', 'One-click note synthesis', 'Markdown formatting support'],
    },
    {
      icon: Mic,
      color: 'text-emerald-500 bg-emerald-500/10',
      title: 'Audio Podcast Overview Generator',
      description:
        'Convert key insights from your workspace sources into engaging, two-speaker audio overviews that explain complex topics naturally.',
      points: ['Two-speaker conversational audio', 'Instant audio playback', 'Notebook insight synthesis'],
    },
  ];

  return (
    <section id="features" className="py-24 bg-muted/20 relative z-10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
            Engineered for Deep Research & Knowledge Synthesis
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed font-normal">
            Everything you need to ingest, index, query, and listen to your research documents with total accuracy.
          </p>
        </div>

        {/* Aceternity Animated Hover Grid */}
        <HoverEffect items={features} />
      </div>
    </section>
  );
}
