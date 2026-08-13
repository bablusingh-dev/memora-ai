'use client';

import React, { useEffect } from 'react';
import { SourcesPanel } from '@/components/notebook/SourcesPanel';
import { ChatStudioPanel } from '@/components/notebook/ChatStudioPanel';
import { AudioOverviewPanel } from '@/components/notebook/AudioOverviewPanel';
import { NotebookSwitcher } from '@/components/notebook/NotebookSwitcher';
import { CreateNotebookModal } from '@/components/notebook/CreateNotebookModal';
import { Brain, Settings, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignInButton, UserButton, useAuth } from '@clerk/nextjs';
import { setAuthToken } from '@/lib/api-client';
import { useNotebookStore } from '@/store/useNotebookStore';

export default function NotebookDashboardPage() {
  const { getToken, isSignedIn } = useAuth();
  const { fetchNotebooks } = useNotebookStore();

  useEffect(() => {
    async function syncTokenAndFetch() {
      if (isSignedIn) {
        const token = await getToken();
        setAuthToken(token);
        await fetchNotebooks();
      } else {
        setAuthToken(null);
      }
    }
    syncTokenAndFetch();
  }, [getToken, isSignedIn, fetchNotebooks]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <CreateNotebookModal />

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

          {isSignedIn && (
            <>
              <div className="h-4 w-px bg-border hidden sm:block" />
              <NotebookSwitcher />
            </>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <HelpCircle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="w-4 h-4" />
          </Button>

          {/* Clerk Auth Integration UI */}
          {isSignedIn ? (
            <UserButton />
          ) : (
            <SignInButton mode="modal">
              <Button size="sm" className="bg-primary text-primary-foreground text-xs">
                Sign In
              </Button>
            </SignInButton>
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
