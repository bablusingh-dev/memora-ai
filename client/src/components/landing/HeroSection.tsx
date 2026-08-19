'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spotlight } from '@/components/aceternity/Spotlight';
import { GlowingButton } from '@/components/aceternity/GlowingButton';
import { Container } from '@/components/landing/shared/Container';
import { SectionEyebrow } from '@/components/landing/shared/SectionEyebrow';
import { Reveal } from '@/components/landing/shared/Reveal';
import {
  Sparkles,
  PlusCircle,
  LayoutDashboard,
  Mic,
  FileSearch,
  ShieldCheck,
  Quote,
} from 'lucide-react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useMemorybookStore } from '@/store/useMemorybookStore';

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isValidClerkKey =
  publishableKey &&
  publishableKey.startsWith('pk_') &&
  !publishableKey.includes('placeholder');

export function HeroSection() {
  const router = useRouter();
  const setCreateModalOpen = useMemorybookStore((state) => state.setCreateModalOpen);

  let isSignedIn = false;
  let clerk: any = null;

  if (isValidClerkKey) {
    try {
      const auth = useAuth();
      isSignedIn = auth.isSignedIn ?? false;
      clerk = useClerk();
    } catch (e) {
      isSignedIn = false;
    }
  }

  const handleCreateWorkspaceClick = () => {
    if (isValidClerkKey && !isSignedIn) {
      if (clerk && clerk.openSignIn) {
        clerk.openSignIn();
      }
      return;
    }

    setCreateModalOpen(true);
    router.push('/workspace');
  };

  const handleExploreClick = () => {
    if (isValidClerkKey && !isSignedIn) {
      if (clerk && clerk.openSignIn) {
        clerk.openSignIn();
      }
      return;
    }
    router.push('/workspace');
  };

  return (
    <section className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-32 bg-background transition-colors">
      {/* Ambient brand glow */}
      <div className="absolute inset-0 mesh-gradient pointer-events-none" />
      <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="hsl(var(--primary))" />

      <Container className="text-center relative z-10">
        <Reveal>
          <SectionEyebrow icon={Sparkles}>Now with two-speaker audio overviews</SectionEyebrow>
        </Reveal>

        {/* Hero Title */}
        <Reveal delay={0.05}>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-foreground leading-[1.1] mb-6 max-w-5xl mx-auto tracking-tight">
            Turn every source into an answer you can trust
          </h1>
        </Reveal>

        {/* Subtitle */}
        <Reveal delay={0.1}>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed font-normal">
            Drop in research papers, web pages, YouTube videos, and notes. Memorybook reads
            everything, answers with exact citations back to the source, and turns your
            workspace into a short audio briefing you can listen to on the go.
          </p>
        </Reveal>

        {/* Call To Actions */}
        <Reveal delay={0.15}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <GlowingButton onClick={handleCreateWorkspaceClick} size="lg">
              <PlusCircle className="w-4 h-4" />
              <span>Create New Workspace</span>
            </GlowingButton>

            <Button
              onClick={handleExploreClick}
              size="lg"
              className="w-full sm:w-auto bg-muted/60 hover:bg-muted text-foreground font-semibold text-sm h-12 px-7 rounded-2xl border-0 shadow-sm gap-2"
            >
              <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
              <span>Explore Workspace</span>
            </Button>
          </div>
        </Reveal>

        {/* Feature Pills */}
        <Reveal delay={0.2}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-card text-left shadow-sm border-0">
              <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 shrink-0">
                <FileSearch className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs text-foreground">Grounded search</p>
                <p className="text-[11px] text-muted-foreground font-normal">Exact-match citations</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-2xl bg-card text-left shadow-sm border-0">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs text-foreground">Audio overviews</p>
                <p className="text-[11px] text-muted-foreground font-normal">Two-speaker podcasts</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-2xl bg-card text-left shadow-sm border-0">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
                <Quote className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs text-foreground">Any source</p>
                <p className="text-[11px] text-muted-foreground font-normal">PDF, web, YouTube, notes</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-2xl bg-card text-left shadow-sm border-0">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs text-foreground">Private by default</p>
                <p className="text-[11px] text-muted-foreground font-normal">Your workspace, isolated</p>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
