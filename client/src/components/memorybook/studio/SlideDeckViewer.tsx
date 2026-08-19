'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SlideDeckPayload } from '@/types/api';

interface SlideDeckViewerProps {
  payload: SlideDeckPayload;
}

/**
 * Slide-by-slide presentation viewer — same prev/next navigation pattern as
 * FlashcardViewer, rendered as a 16:9-ish slide instead of a flip card. No
 * carousel dependency needed for this: it's index-based navigation, not
 * swipe gestures or autoplay. Slide 0 is a synthetic title slide built from
 * `deckTitle`; slides 1..n are the generated content slides.
 */
export function SlideDeckViewer({ payload }: SlideDeckViewerProps) {
  const totalSlides = payload.slides.length + 1; // +1 for the title slide
  const [index, setIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  const goTo = (next: number) => {
    setIndex((next + totalSlides) % totalSlides);
    setShowNotes(false);
  };

  const isTitleSlide = index === 0;
  const slide = isTitleSlide ? null : payload.slides[index - 1];

  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="w-full flex items-center justify-between text-[11px] text-muted-foreground font-mono px-1">
        <span>
          {index + 1} / {totalSlides}
        </span>
        {slide?.speakerNotes && (
          <button
            onClick={() => setShowNotes((s) => !s)}
            className={`flex items-center gap-1 transition-colors ${showNotes ? 'text-primary' : 'hover:text-foreground'}`}
            title="Toggle speaker notes"
          >
            <StickyNote className="w-3 h-3" />
            Notes
          </button>
        )}
      </div>

      {/* Slide surface */}
      <div className="w-full aspect-video rounded-2xl bg-gradient-to-br from-primary/5 to-background border border-border/60 shadow-sm flex flex-col items-center justify-center p-8 text-center overflow-hidden">
        {isTitleSlide ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-3">Slide Deck</p>
            <h2 className="text-xl font-extrabold text-foreground leading-tight">{payload.deckTitle}</h2>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-start justify-start text-left">
            <h3 className="text-base font-bold text-foreground mb-4">{slide!.title}</h3>
            <ul className="space-y-2 w-full">
              {slide!.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground/90 leading-relaxed">
                  <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showNotes && slide?.speakerNotes && (
        <div className="w-full p-3 rounded-xl bg-muted/30 text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground/80">Speaker notes: </span>
          {slide.speakerNotes}
        </div>
      )}

      <div className="flex items-center justify-center gap-3 pt-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => goTo(index - 1)}
          className="h-9 w-9 rounded-full border-0 bg-muted/50 hover:bg-muted transition-transform hover:scale-[1.03] active:scale-[0.97]"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          onClick={() => goTo(index + 1)}
          className="h-9 px-4 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-transform hover:scale-[1.03] active:scale-[0.97]"
        >
          Next
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => goTo(index + 1)}
          className="h-9 w-9 rounded-full border-0 bg-muted/50 hover:bg-muted transition-transform hover:scale-[1.03] active:scale-[0.97]"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
