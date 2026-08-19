'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Shuffle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FlashcardsPayload } from '@/types/api';

interface FlashcardViewerProps {
  payload: FlashcardsPayload;
}

/**
 * Hand-rolled CSS 3D flip card — no new dependency needed for this. Flips
 * between front/back on click via a rotateY transform on a shared
 * preserve-3d wrapper, with each face's backface hidden so only one side is
 * ever visible at a time.
 */
export function FlashcardViewer({ payload }: FlashcardViewerProps) {
  const cards = payload.cards;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));

  const current = cards[order[index]];

  const goTo = (next: number) => {
    setFlipped(false);
    setIndex((next + order.length) % order.length);
  };

  const shuffle = () => {
    const shuffled = [...order];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setOrder(shuffled);
    setIndex(0);
    setFlipped(false);
  };

  if (!current) {
    return <div className="text-xs text-muted-foreground p-6 text-center">No flashcards to show.</div>;
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="w-full flex items-center justify-between text-[11px] text-muted-foreground font-mono px-1">
        <span>
          {index + 1} / {order.length}
        </span>
        <button
          onClick={shuffle}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          title="Shuffle deck"
        >
          <Shuffle className="w-3 h-3" />
          Shuffle
        </button>
      </div>

      {/* Flip card */}
      <div
        onClick={() => setFlipped((f) => !f)}
        className="w-full h-56 cursor-pointer [perspective:1200px]"
      >
        <div
          className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          {/* Front */}
          <div className="absolute inset-0 [backface-visibility:hidden] rounded-3xl bg-primary/5 border border-primary/10 flex items-center justify-center p-6 text-center">
            <p className="text-sm font-semibold text-foreground leading-relaxed">{current.front}</p>
          </div>
          {/* Back */}
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-3xl bg-card border border-border flex items-center justify-center p-6 text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">{current.back}</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <RotateCw className="w-3 h-3" />
        Flip card
      </button>

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
