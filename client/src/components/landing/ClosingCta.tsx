'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, Compass, Network, ListChecks, Users } from 'lucide-react';
import { GlowingButton } from '@/components/aceternity/GlowingButton';
import { Container } from '@/components/landing/shared/Container';
import { SectionEyebrow } from '@/components/landing/shared/SectionEyebrow';
import { Reveal } from '@/components/landing/shared/Reveal';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useNotebookStore } from '@/store/useNotebookStore';

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isValidClerkKey =
  publishableKey &&
  publishableKey.startsWith('pk_') &&
  !publishableKey.includes('placeholder');

const upcoming = [
  { icon: Network, label: 'Mind maps' },
  { icon: ListChecks, label: 'Flashcard decks' },
  { icon: Users, label: 'Shared workspaces' },
];

export function ClosingCta() {
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

  return (
    <section className="py-24 relative z-10 transition-colors">
      <Container>
        {/* Built to grow strip */}
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <SectionEyebrow icon={Compass}>Built to grow</SectionEyebrow>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              More ways to work with your research are on the way
            </h3>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-16">
            {upcoming.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-muted-foreground/25 bg-card/40 text-left"
                >
                  <div className="p-2.5 rounded-xl bg-muted text-muted-foreground/70 shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-foreground/80">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground/70 font-medium">Coming soon</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>

        {/* Final CTA band */}
        <Reveal delay={0.1}>
          <div className="noise-overlay relative rounded-[2rem] bg-foreground text-background overflow-hidden px-8 py-16 sm:py-20 text-center">
            <div className="absolute inset-0 mesh-gradient opacity-60 pointer-events-none" />
            <div className="relative z-10 max-w-xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
                Start your first workspace, free
              </h2>
              <p className="text-sm sm:text-base text-background/70 mb-8 leading-relaxed">
                Upload a source and ask your first grounded question in under a minute.
              </p>
              <div className="flex justify-center">
                <GlowingButton onClick={handleCreateWorkspaceClick} size="lg">
                  <PlusCircle className="w-4 h-4" />
                  <span>Create New Workspace</span>
                </GlowingButton>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
