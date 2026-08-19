'use client';

import React, { useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuizPayload } from '@/types/api';

interface QuizViewerProps {
  payload: QuizPayload;
}

/**
 * One question at a time, pick an option, see immediate right/wrong +
 * explanation, then a final score screen with a retry option. No new
 * dependency — plain state machine over the questions array.
 */
export function QuizViewer({ payload }: QuizViewerProps) {
  const questions = payload.questions;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [finished, setFinished] = useState(false);

  const current = questions[index];

  const selectOption = (optionIndex: number) => {
    if (selected !== null) return; // already answered this question
    setSelected(optionIndex);
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = optionIndex;
      return next;
    });
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setSelected(answers[index + 1] ?? null);
  };

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setAnswers(questions.map(() => null));
    setFinished(false);
  };

  if (!current) {
    return <div className="text-xs text-muted-foreground p-6 text-center">No quiz questions to show.</div>;
  }

  if (finished) {
    const score = answers.filter((a, i) => a === questions[i].correctIndex).length;
    return (
      <div className="flex flex-col items-center space-y-4 py-4">
        <p className="text-3xl font-extrabold text-foreground">
          {score} / {questions.length}
        </p>
        <p className="text-xs text-muted-foreground">
          {score === questions.length ? 'Perfect score!' : 'Nice work — review the ones you missed.'}
        </p>
        <Button
          onClick={restart}
          className="h-9 px-4 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5 transition-transform hover:scale-[1.03] active:scale-[0.97]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Retake Quiz
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono px-1">
        <span>
          Question {index + 1} / {questions.length}
        </span>
      </div>

      <p className="text-sm font-semibold text-foreground leading-relaxed">{current.question}</p>

      <div className="space-y-2">
        {current.options.map((option, i) => {
          const isSelected = selected === i;
          const isCorrect = i === current.correctIndex;
          const showResult = selected !== null;

          let stateClass = 'bg-muted/40 hover:bg-muted/70 border-transparent';
          if (showResult && isCorrect) {
            stateClass = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400';
          } else if (showResult && isSelected && !isCorrect) {
            stateClass = 'bg-destructive/10 border-destructive/40 text-destructive';
          }

          return (
            <button
              key={i}
              onClick={() => selectOption(i)}
              disabled={showResult}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-colors duration-150 flex items-center justify-between gap-2 ${stateClass} ${
                showResult ? 'cursor-default' : 'cursor-pointer'
              }`}
            >
              <span>{option}</span>
              {showResult && isCorrect && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />}
              {showResult && isSelected && !isCorrect && <XCircle className="w-4 h-4 shrink-0 text-destructive" />}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div className="p-3 rounded-xl bg-muted/30 text-[11px] text-muted-foreground leading-relaxed">
          {current.explanation}
        </div>
      )}

      <Button
        onClick={next}
        disabled={selected === null}
        className="w-full h-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
      >
        {index + 1 >= questions.length ? 'See Results' : 'Next Question'}
      </Button>
    </div>
  );
}
