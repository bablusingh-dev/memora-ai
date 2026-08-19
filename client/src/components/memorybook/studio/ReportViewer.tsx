'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReportPayload } from '@/types/api';

interface ReportViewerProps {
  payload: ReportPayload;
}

/**
 * Long-form document viewer — executive summary + sections, rendered with
 * the same ReactMarkdown/remarkGfm + `prose` styling used for chat answers
 * in ChatStudioPanel.tsx, for a consistent reading experience.
 */
export function ReportViewer({ payload }: ReportViewerProps) {
  return (
    <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-5">
      <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/10">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary mb-1">Executive Summary</p>
        <p className="text-xs text-foreground/90 leading-relaxed">{payload.summary}</p>
      </div>

      {payload.sections.map((section, i) => (
        <div key={i} className="space-y-1.5">
          <h3 className="text-sm font-bold text-foreground">{section.heading}</h3>
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-p:leading-relaxed prose-p:text-foreground/90 text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}
