'use client';

import React, { useEffect, useRef } from 'react';
import { SourcesPanel } from '@/components/notebook/SourcesPanel';
import { ChatStudioPanel } from '@/components/notebook/ChatStudioPanel';
import { AudioOverviewPanel } from '@/components/notebook/AudioOverviewPanel';
import { NotebookSwitcher } from '@/components/notebook/NotebookSwitcher';
import { CreateNotebookModal } from '@/components/notebook/CreateNotebookModal';
import { AddSourceModal } from '@/components/notebook/AddSourceModal';
import { Brain, Settings, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignInButton, UserButton, useAuth } from '@clerk/nextjs';
import { setAuthToken } from '@/lib/api-client';
import { useNotebookStore } from '@/store/useNotebookStore';

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isValidClerkKey =
  publishableKey &&
  publishableKey.startsWith('pk_') &&
  !publishableKey.includes('placeholder');

export default function NotebookDashboardPage() {
  let getToken: any = () => Promise.resolve(null);
  let isSignedIn = true; // Default to true in dev mode so dashboard works out-of-the-box

  try {
    if (isValidClerkKey) {
      const auth = useAuth();
      getToken = auth.getToken;
      isSignedIn = auth.isSignedIn ?? false;
    }
  } catch (e) {
    isSignedIn = true;
  }

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    async function syncTokenAndFetch() {
      if (isValidClerkKey && isSignedIn) {
        const token = await getToken();
        setAuthToken(token);
      } else {
        setAuthToken(null);
      }

      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        await useNotebookStore.getState().fetchNotebooks();
      }
    }

    syncTokenAndFetch();
  }, [isSignedIn]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <CreateNotebookModal />
      <AddSourceModal />

      {/* Top Navbar */}
      <header className="h-14 border-b border-border bg-card/80 backdrop-blur px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary">
              <Brain className="w-5 h-5" />
            </div>
            <h1 className="font-bold text-base tracking-tight flex items-center gap-2">
              memora-ai <span className="text-[10px] font-normal text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded">Notebook LLM</span>
            </h1>
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />
          <NotebookSwitcher />
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <HelpCircle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="w-4 h-4" />
          </Button>

          {/* Clerk Auth Integration UI */}
          {isValidClerkKey ? (
            isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="modal">
                <Button size="sm" className="bg-primary text-primary-foreground text-xs">
                  Sign In
                </Button>
              </SignInButton>
            )
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-[10px] bg-secondary border border-border px-2 py-0.5 rounded text-muted-foreground">
                Dev Mode
              </span>
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center font-bold text-xs justify-center text-primary">
                AI
              </div>
            </div>
          )}
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
