'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { Reveal } from '@/components/landing/shared/Reveal';

export function FaqSection() {
  const faqs = [
    {
      question: 'What is Memorybook and how does it work?',
      answer:
        'Memorybook is a research workspace: create a workspace, upload your sources (PDFs, web pages, YouTube links, text files), and interact with them through context-grounded AI chat, generated study notes, and podcast-style audio overviews — all synthesized strictly from your own material.',
    },
    {
      question: 'Why full-text BM25 search instead of vector embeddings?',
      answer:
        'Memorybook uses ParadeDB pg_search to run full-text BM25 algorithmic search directly inside PostgreSQL. Vector embeddings can suffer from semantic drift and hallucination on precise technical terms, whereas BM25 ensures exact keyword matching and high-scoring chunk retrieval.',
    },
    {
      question: 'How is user data protected and isolated?',
      answer:
        'Memorybook implements multi-tenant Clerk Express authentication on the backend and frontend. Every database query, source document, and generated note is strictly scoped by your authenticated User ID.',
    },
    {
      question: 'What file formats and source types are supported?',
      answer:
        'Memorybook supports local PDF uploads, Markdown and TXT files, web page URLs (crawled and chunked via Firecrawl), and YouTube video URLs (with automated transcript extraction).',
    },
    {
      question: 'How does the Audio Overview feature function?',
      answer:
        'The Audio Overview feature synthesizes your uploaded workspace documents into a structured, two-speaker podcast script and generates natural audio overviews so you can listen to key research insights on the go.',
    },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-24 bg-muted/20 relative z-10 transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed font-normal">
            Everything you need to know about how Memorybook works, and how your data stays secure.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <Reveal key={idx} delay={idx * 0.05}>
                <div className="rounded-2xl bg-card hover:bg-muted/40 overflow-hidden transition-all shadow-sm border-0">
                  <button
                    onClick={() => toggle(idx)}
                    className="w-full p-6 text-left flex items-center justify-between font-bold text-sm sm:text-base text-foreground hover:text-primary transition-colors focus:outline-none"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-primary' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-xs sm:text-sm text-muted-foreground leading-relaxed pt-1">
                      {faq.answer}
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
