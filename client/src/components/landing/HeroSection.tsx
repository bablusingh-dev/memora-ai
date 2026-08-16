'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spotlight } from '@/components/aceternity/Spotlight';
import { GlowingButton } from '@/components/aceternity/GlowingButton';
import {
  Sparkles,
  PlusCircle,
  LayoutDashboard,
  Mic,
  FileText,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useNotebookStore } from '@/store/useNotebookStore';

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isValidClerkKey =
  publishableKey &&
  publishableKey.startsWith('pk_') &&
  !publishableKey.includes('placeholder');

export function HeroSection() {
  const router = useRouter();
  const setCreateModalOpen = useNotebookStore((state) => state.setCreateModalOpen);

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
      {/* Aceternity Radial Spotlight */}
      <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="hsl(var(--primary))" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        {/* Top Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          <span>ParadeDB BM25 Vectorless Search & Clerk Multi-Tenant Auth</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-foreground leading-[1.1] mb-6 max-w-5xl mx-auto tracking-tight">
          Your Intelligent Research Companion & Knowledge Workspace
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed font-normal">
          Upload research papers, web articles, YouTube transcripts, and notes. Chat with your custom knowledge base using accurate BM25 full-text retrieval and generate podcast-style audio overviews.
        </p>

        {/* Call To Actions with Aceternity Glowing Button */}
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

        {/* Feature Pills */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-card text-left shadow-sm border-0">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-foreground">ParadeDB BM25</p>
              <p className="text-[11px] text-muted-foreground font-normal">Exact keyword search</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-2xl bg-card text-left shadow-sm border-0">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-foreground">Audio Overview</p>
              <p className="text-[11px] text-muted-foreground font-normal">Podcast summary generator</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-2xl bg-card text-left shadow-sm border-0">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-foreground">Multi-Format Ingestion</p>
              <p className="text-[11px] text-muted-foreground font-normal">PDF, Web, YouTube, Text</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-2xl bg-card text-left shadow-sm border-0">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-foreground">Clerk Auth Security</p>
              <p className="text-[11px] text-muted-foreground font-normal">Isolated data protection</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
