'use client';

import React, { useRef, useEffect } from 'react';
import { Send, Globe, Sparkles, Loader2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  webSearchEnabled: boolean;
  onToggleWebSearch: (enabled: boolean) => void;
  placeholder?: string;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading = false,
  disabled = false,
  webSearchEnabled,
  onToggleWebSearch,
  placeholder = 'Ask anything about your notes, documents, or research...',
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) {
        onSubmit();
      }
    }
  };

  return (
    <div className="w-full relative rounded-2xl border border-border/80 bg-card shadow-sm hover:border-border transition-all focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20 p-2 space-y-2">
      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="w-full resize-none border-0 shadow-none focus-visible:ring-0 px-2 py-1.5 min-h-[38px] max-h-[180px] text-xs leading-relaxed bg-transparent text-foreground placeholder:text-muted-foreground/60"
      />

      {/* Control Bar */}
      <div className="flex items-center justify-between pt-1 border-t border-border/40 px-1">
        {/* Left Toolbar Options (Web Search Toggle) */}
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={webSearchEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => onToggleWebSearch(!webSearchEnabled)}
                className={`h-7 px-2.5 text-[11px] font-medium rounded-full transition-all gap-1.5 ${
                  webSearchEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground border-border/60 bg-secondary/30'
                }`}
              >
                <Globe className={`w-3.5 h-3.5 ${webSearchEnabled ? 'animate-pulse' : ''}`} />
                <span>Web Search</span>
                <Badge
                  variant="secondary"
                  className={`text-[9px] px-1 py-0 font-mono ml-0.5 ${
                    webSearchEnabled
                      ? 'bg-white/20 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {webSearchEnabled ? 'ON' : 'OFF'}
                </Badge>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[11px] max-w-xs">
              {webSearchEnabled
                ? 'Web Search is ON: Agent can surf live internet & scrape websites for current information.'
                : 'Web Search is OFF: Agent is strictly grounded in notebook documents & cognitive memory.'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Right Submit / Stop Action */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono text-[9px]">
              Shift+Enter
            </kbd>{' '}
            for new line
          </span>

          {isLoading ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onStop}
              className="h-7 px-2.5 text-[11px] rounded-xl gap-1"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={onSubmit}
              disabled={!value.trim() || disabled}
              className="h-7 px-3 text-[11px] rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 transition-all shadow-xs"
            >
              <span>Send</span>
              <Send className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
