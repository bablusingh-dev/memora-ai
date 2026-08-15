'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, language = 'json', className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('relative group rounded-md border border-border/50 bg-secondary/30 text-xs font-mono', className)}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-secondary/50 text-[11px] text-muted-foreground">
        <span className="uppercase">{language}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="h-5 w-5 text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>
      <pre className="p-3 overflow-x-auto text-[11px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}
