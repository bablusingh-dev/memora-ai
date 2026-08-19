'use client';

import React from 'react';
import Link from 'next/link';
import { Brain, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/nextjs';

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isValidClerkKey =
  publishableKey &&
  publishableKey.startsWith('pk_') &&
  !publishableKey.includes('placeholder');

export function Navbar() {
  let isSignedIn = false;

  if (isValidClerkKey) {
    try {
      const auth = useAuth();
      isSignedIn = auth.isSignedIn ?? false;
    } catch (e) {
      isSignedIn = false;
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-xl transition-colors border-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-2.5 group">
          <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
            <Brain className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-foreground flex items-center gap-2">
              Memorybook
              <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                AI Workspace
              </span>
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center space-x-8 text-xs font-semibold text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-foreground transition-colors">
            How It Works
          </a>
          <a href="#how-its-built" className="hover:text-foreground transition-colors">
            What Powers It
          </a>
          <a href="#faq" className="hover:text-foreground transition-colors">
            FAQ
          </a>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <ThemeToggle />

          {isValidClerkKey ? (
            isSignedIn ? (
              <div className="flex items-center space-x-3">
                <Link href="/workspace">
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 px-4 rounded-xl border-0 shadow-md shadow-primary/20 gap-1.5">
                    Go to Workspace
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
                <UserButton />
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <SignInButton mode="modal">
                  <Button variant="ghost" size="sm" className="text-xs font-semibold text-muted-foreground hover:text-foreground h-9 px-3.5 border-0">
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 px-4 rounded-xl border-0 shadow-md shadow-primary/20">
                    Get Started
                  </Button>
                </SignUpButton>
              </div>
            )
          ) : (
            <div className="flex items-center space-x-3">
              <span className="text-[11px] font-medium bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                Dev Mode
              </span>
              <Link href="/workspace">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 px-4 rounded-xl border-0 shadow-md shadow-primary/20 gap-1.5">
                  Launch Workspace
                  <Sparkles className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
