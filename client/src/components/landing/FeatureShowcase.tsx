'use client';

import React from 'react';
import { Search, FileUp, MessageSquare, Mic, Layers } from 'lucide-react';
import { HoverEffect } from '@/components/aceternity/HoverEffect';
import { Container } from '@/components/landing/shared/Container';
import { SectionHeading } from '@/components/landing/shared/SectionHeading';
import { Reveal } from '@/components/landing/shared/Reveal';

export function FeatureShowcase() {
  const features = [
    {
      icon: Search,
      color: 'text-orange-500 bg-orange-500/10',
      title: 'Full-Text Grounded Search',
      description:
        'Every answer is scored and retrieved with algorithmic full-text search across your document chunks — precise on exact keywords and technical terms, with no semantic drift.',
      points: ['No embedding hallucination', 'Instant keyword precision', 'Every claim traces to a source'],
    },
    {
      icon: FileUp,
      color: 'text-amber-500 bg-amber-500/10',
      title: 'Bring Any Source',
      description:
        'Ingest research documents from PDFs and text files, crawl entire web pages, or pull the full transcript from a YouTube video — all into one organized workspace.',
      points: ['PDF & TXT document parsing', 'Full web page crawling', 'YouTube transcript extraction'],
    },
    {
      icon: MessageSquare,
      color: 'text-indigo-500 bg-indigo-500/10',
      title: 'Chat That Cites Its Work',
      description:
        'Ask questions directly against your active workspace. Every response comes with clickable citations, and you can save any answer straight into your notes.',
      points: ['Context-grounded responses', 'One-click note synthesis', 'Markdown formatting support'],
    },
    {
      icon: Mic,
      color: 'text-emerald-500 bg-emerald-500/10',
      title: 'Turn Sources Into Audio',
      description:
        'Convert the key insights from your workspace into an engaging, two-speaker audio overview that explains complex topics naturally — perfect for listening on the go.',
      points: ['Two-speaker conversational audio', 'Instant playback', 'Synthesized from your own sources'],
    },
  ];

  return (
    <section id="features" className="py-24 bg-muted/20 relative z-10 transition-colors">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Capabilities"
            eyebrowIcon={Layers}
            title="Engineered for deep research and knowledge synthesis"
            description="Everything you need to ingest, question, and listen to your own research — with total accuracy."
          />
        </Reveal>

        <Reveal delay={0.1}>
          <HoverEffect items={features} />
        </Reveal>
      </Container>
    </section>
  );
}
