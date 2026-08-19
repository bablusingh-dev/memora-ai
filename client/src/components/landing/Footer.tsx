'use client';

import React from 'react';
import { Brain } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-background py-14 border-0 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm tracking-tight text-foreground">Memorybook</p>
              <p className="text-xs text-muted-foreground font-normal">Your research workspace — sources, conversation, and audio, all grounded.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground font-medium">
            <span className="bg-muted px-3.5 py-1.5 rounded-full">Next.js 16</span>
            <span className="bg-muted px-3.5 py-1.5 rounded-full">ParadeDB BM25</span>
            <span className="bg-muted px-3.5 py-1.5 rounded-full">Drizzle ORM</span>
            <span className="bg-muted px-3.5 py-1.5 rounded-full">Clerk Auth</span>
            <span className="bg-muted px-3.5 py-1.5 rounded-full">Firecrawl</span>
          </div>

          <div className="text-xs text-muted-foreground font-normal">
            © {new Date().getFullYear()} Memorybook. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
