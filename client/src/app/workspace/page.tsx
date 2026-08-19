'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SourcesPanel } from '@/components/memorybook/SourcesPanel';
import { ChatStudioPanel } from '@/components/memorybook/ChatStudioPanel';
import { AudioOverviewPanel } from '@/components/memorybook/AudioOverviewPanel';
import { MemorybookSwitcher } from '@/components/memorybook/MemorybookSwitcher';
import { ModuleRail } from '@/components/memorybook/ModuleRail';
import { CreateMemorybookModal } from '@/components/memorybook/CreateMemorybookModal';
import { AddSourceModal } from '@/components/memorybook/AddSourceModal';
import {
  Brain,
  Settings,
  HelpCircle,
  ArrowLeft,
  FileText,
  MessageSquare,
  Headphones,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SignInButton, UserButton, useAuth } from '@clerk/nextjs';
import { setAuthToken, setTokenGetter } from '@/lib/api-client';
import { useMemorybookStore } from '@/store/useMemorybookStore';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isValidClerkKey =
  publishableKey &&
  publishableKey.startsWith('pk_') &&
  !publishableKey.includes('placeholder');

function ClerkAuthSync() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        setTokenGetter(getToken);
      } else {
        setTokenGetter(null);
        setAuthToken(null);
      }
    }
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}

export default function WorkspaceDashboardPage() {
  let getToken: any = () => Promise.resolve(null);
  let isSignedIn = true;

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
  const [mobileTab, setMobileTab] = useState<'sources' | 'chat' | 'studio'>('chat');
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  const { activeMemorybook } = useMemorybookStore();
  const sourceCount = activeMemorybook?.sources?.length || 0;

  useEffect(() => {
    async function syncTokenAndFetch() {
      if (isValidClerkKey && isSignedIn) {
        setTokenGetter(getToken);
        const token = await getToken();
        setAuthToken(token);
      } else {
        setTokenGetter(null);
        setAuthToken(null);
      }

      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        await useMemorybookStore.getState().fetchMemorybooks();
      }
    }

    syncTokenAndFetch();
  }, [isSignedIn]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100/80 dark:bg-black text-foreground">
      {isValidClerkKey && <ClerkAuthSync />}
      <CreateMemorybookModal />
      <AddSourceModal />

      {/* Help Modal */}
      <Dialog open={isHelpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-[480px] bg-slate-100 dark:bg-zinc-950 border-0 text-foreground rounded-3xl p-5 space-y-3">
          <DialogHeader className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-2xs">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <HelpCircle className="w-5 h-5 text-primary" />
              <span>Memorybook Workspace Guide</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              Your grounded research workspace — powerful full-text and semantic search across PDFs, web pages, and videos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xs space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-foreground">
                <FileText className="w-4 h-4 text-primary" />
                <span>1. Add Document Sources</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Upload PDFs, website URLs, YouTube videos, or paste in your own text notes.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xs space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-foreground">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span>2. Ask Grounded Questions</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Query the AI model with full multi-source citations, transparent chain-of-thought retrieval, and live web search.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xs space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-foreground">
                <Headphones className="w-4 h-4 text-primary" />
                <span>3. Generate Audio & Studio Notes</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Create AI deep-dive audio podcasts, executive briefings, study guides, and FAQs saved directly to notes.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[480px] bg-slate-100 dark:bg-zinc-950 border-0 text-foreground rounded-3xl p-5 space-y-3">
          <DialogHeader className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-2xs">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Settings className="w-5 h-5 text-primary" />
              <span>Workspace Settings</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Your workspace's search, import, and storage preferences.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 text-xs">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xs flex items-center justify-between">
              <div>
                <p className="font-bold text-foreground">Search</p>
                <p className="text-[10px] text-muted-foreground">Full-text + semantic search</p>
              </div>
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 font-mono text-[10px] border-0">
                ACTIVE
              </Badge>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xs flex items-center justify-between">
              <div>
                <p className="font-bold text-foreground">Web Import</p>
                <p className="text-[10px] text-muted-foreground">Clean article import from any URL</p>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary font-mono text-[10px] border-0">
                ENABLED
              </Badge>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xs flex items-center justify-between">
              <div>
                <p className="font-bold text-foreground">File Storage</p>
                <p className="text-[10px] text-muted-foreground">Secure cloud file storage</p>
              </div>
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 font-mono text-[10px] border-0">
                CONNECTED
              </Badge>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Top Header Navbar */}
      <header className="h-14 bg-white/90 dark:bg-zinc-900 px-4 flex items-center justify-between shrink-0 z-40 mb-2 shadow-2xs">
        <div className="flex items-center space-x-3">
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className="h-8.5 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5 rounded-2xl transition-colors duration-150"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Landing Page</span>
            </Button>
          </Link>

          <div className="flex items-center space-x-2 pl-1">
            <div className="p-1.5 rounded-2xl bg-primary/10 text-primary">
              <Brain className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-tight hidden md:inline-block text-foreground">
              Memorybook
            </span>
          </div>

          <MemorybookSwitcher />
        </div>

        <div className="flex items-center space-x-2">
          {activeMemorybook && (
            <Badge
              variant="secondary"
              className="hidden lg:flex text-[11px] font-medium bg-muted/60 text-muted-foreground px-2.5 py-1 rounded-2xl border-0 gap-1"
            >
              <Database className="w-3 h-3 text-primary" />
              <span>{sourceCount} Grounded Source{sourceCount === 1 ? '' : 's'}</span>
            </Badge>
          )}

          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHelpOpen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl"
            title="Workspace Help"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl"
            title="Workspace Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>

          {/* Clerk Auth Integration UI */}
          {isValidClerkKey ? (
            isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="modal">
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground font-semibold text-xs h-8.5 px-4 rounded-2xl border-0 shadow-xs"
                >
                  Sign In
                </Button>
              </SignInButton>
            )
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-[10px] bg-muted/50 px-2.5 py-1 rounded-full text-muted-foreground font-medium">
                Dev Mode
              </span>
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center font-bold text-xs justify-center text-primary">
                AI
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mobile View Navigation Bar (< lg) */}
      <div className="flex lg:hidden bg-card p-1 shrink-0 mb-2">
        <button
          onClick={() => setMobileTab('sources')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'sources'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Sources ({sourceCount})</span>
        </button>

        <button
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'chat'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat Studio</span>
        </button>

        <button
          onClick={() => setMobileTab('studio')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'studio'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Headphones className="w-3.5 h-3.5" />
          <span>Studio & Notes</span>
        </button>
      </div>

      {/* Main Responsive Layout: 3 Independent Floating Sections with Gaps & Border Radius */}
      <main className="flex-1 min-h-0 relative px-3 pb-3">
        {/* Desktop Layout (>= lg): Module Rail + 3 Rounded Floating Columns */}
        <div className="hidden lg:flex h-full w-full gap-3">
          <ModuleRail />

          <div className="grid grid-cols-12 flex-1 min-w-0 h-full gap-3">
            {/* Left Column: Grounding Sources (Side Panel Shade: bg-slate-200/80 dark:bg-zinc-900) */}
            <section className="col-span-3 h-full min-h-0 overflow-hidden rounded-3xl bg-slate-200/80 dark:bg-zinc-900/90 shadow-2xs">
              <SourcesPanel />
            </section>

            {/* Center Column: AI Chat Studio (Center Panel Shade: bg-white dark:bg-zinc-950) */}
            <section className="col-span-6 h-full min-h-0 overflow-hidden rounded-3xl bg-white dark:bg-zinc-950 shadow-2xs">
              <ChatStudioPanel />
            </section>

            {/* Right Column: Audio Overview & Studio (Side Panel Shade: bg-slate-200/80 dark:bg-zinc-900 - MATCHES LEFT SIDE) */}
            <section className="col-span-3 h-full min-h-0 overflow-hidden rounded-3xl bg-slate-200/80 dark:bg-zinc-900/90 shadow-2xs">
              <AudioOverviewPanel />
            </section>
          </div>
        </div>

        {/* Mobile View Layout (< lg) */}
        <div className="block lg:hidden h-full w-full">
          {mobileTab === 'sources' && (
            <div className="h-full w-full overflow-hidden rounded-3xl bg-slate-200/80 dark:bg-zinc-900/90 shadow-2xs">
              <SourcesPanel />
            </div>
          )}
          {mobileTab === 'chat' && (
            <div className="h-full w-full overflow-hidden rounded-3xl bg-white dark:bg-zinc-950 shadow-2xs">
              <ChatStudioPanel />
            </div>
          )}
          {mobileTab === 'studio' && (
            <div className="h-full w-full overflow-hidden rounded-3xl bg-slate-200/80 dark:bg-zinc-900/90 shadow-2xs">
              <AudioOverviewPanel />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
