'use client';

import React from 'react';
import { UploadCloud, MessagesSquare, Sparkles, Route } from 'lucide-react';
import { Container } from '@/components/landing/shared/Container';
import { SectionHeading } from '@/components/landing/shared/SectionHeading';
import { Reveal } from '@/components/landing/shared/Reveal';

const steps = [
  {
    icon: UploadCloud,
    step: '01',
    title: 'Add your sources',
    description:
      'Upload PDFs and text files, paste a web page URL, or drop in a YouTube link. Everything is read, chunked, and indexed in seconds.',
  },
  {
    icon: MessagesSquare,
    step: '02',
    title: 'Ask, and get cited answers',
    description:
      'Chat with your workspace in plain language. Every response is grounded in your sources and comes with a citation you can inspect.',
  },
  {
    icon: Sparkles,
    step: '03',
    title: 'Synthesize & listen',
    description:
      'Generate study guides, FAQs, and timelines from your material — or turn the whole workspace into a two-speaker audio overview.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-background relative z-10 transition-colors">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            eyebrowIcon={Route}
            title="From raw sources to grounded answers in three steps"
            description="No prompt engineering, no manual tagging — just add material and start asking questions."
          />
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.title} delay={idx * 0.1}>
                <div className="relative h-full rounded-3xl bg-card border-0 shadow-sm p-6">
                  <span className="absolute top-5 right-6 text-4xl font-extrabold text-muted-foreground/10 select-none">
                    {step.step}
                  </span>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg-primary/10 text-primary">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight mb-2 text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-xs leading-relaxed font-normal">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
