'use client';

import React, { useEffect } from 'react';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeatureShowcase } from '@/components/landing/FeatureShowcase';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { ProductPreview } from '@/components/landing/ProductPreview';
import { HowItsBuilt } from '@/components/landing/HowItsBuilt';
import { FaqSection } from '@/components/landing/FaqSection';
import { ClosingCta } from '@/components/landing/ClosingCta';
import { Footer } from '@/components/landing/Footer';
import { CreateNotebookModal } from '@/components/notebook/CreateNotebookModal';
import { useAuth } from '@clerk/nextjs';
import { setAuthToken, setTokenGetter } from '@/lib/api-client';

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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased selection:bg-primary/20 selection:text-primary">
      {isValidClerkKey && <ClerkAuthSync />}
      <CreateNotebookModal />

      {/* Header Navbar */}
      <Navbar />

      {/* Main Landing Sections */}
      <main className="flex-1">
        <HeroSection />
        <FeatureShowcase />
        <HowItWorks />
        <ProductPreview />
        <HowItsBuilt />
        <FaqSection />
        <ClosingCta />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
