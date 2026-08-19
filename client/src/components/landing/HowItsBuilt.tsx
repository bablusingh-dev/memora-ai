'use client';

import React from 'react';
import { Cpu, Search, ShieldCheck, Lock, Globe2 } from 'lucide-react';
import { Container } from '@/components/landing/shared/Container';
import { SectionHeading } from '@/components/landing/shared/SectionHeading';
import { Reveal } from '@/components/landing/shared/Reveal';

const stack = [
  {
    icon: Cpu,
    name: 'Fast, modern interface',
    detail: 'Streaming AI responses as you type',
  },
  {
    icon: Search,
    name: 'Full-text + semantic search',
    detail: 'Grounded answers, not guesses',
  },
  {
    icon: ShieldCheck,
    name: 'Reliable by design',
    detail: 'Type-safe data layer end to end',
  },
  {
    icon: Lock,
    name: 'Secure, multi-tenant accounts',
    detail: 'Your workspaces stay isolated',
  },
  {
    icon: Globe2,
    name: 'Clean web import',
    detail: 'Any page, turned into readable source material',
  },
];

export function HowItsBuilt() {
  const loop = [...stack, ...stack];

  return (
    <section id="how-its-built" className="py-24 bg-muted/20 relative z-10 transition-colors overflow-hidden">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="What powers your workspace"
            eyebrowIcon={Cpu}
            title="Built for real research work"
            description="Everything you need to actually get work done."
          />
        </Reveal>
      </Container>

      <Reveal delay={0.1}>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-muted/20 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-muted/20 to-transparent z-10" />
          <div className="flex w-max animate-marquee">
            {loop.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={`${item.name}-${idx}`}
                  className="flex items-center gap-3 mx-3 px-5 py-4 rounded-2xl bg-card shadow-sm border-0 shrink-0 w-[280px]"
                >
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-foreground">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
