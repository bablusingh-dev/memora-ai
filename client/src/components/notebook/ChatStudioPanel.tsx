'use client';

import React, { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Send, Bot, User, Sparkles, Database, FilePlus, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotebookStore } from '@/store/useNotebookStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function ChatStudioPanel() {
  const { activeNotebook } = useNotebookStore();
  const [selectedCitation, setSelectedCitation] = useState<any | null>(null);
  const [input, setInput] = useState('');

  const apiEndpoint = activeNotebook ? `/api/v1/notebooks/${activeNotebook.id}/chat` : '';

  const { messages, sendMessage, status, error } = (useChat as any)({
    api: apiEndpoint,
    id: activeNotebook?.id || 'default-chat',
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeNotebook || isLoading) return;
    sendMessage({ text: input } as any);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-background border-r border-border p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg tracking-tight">Agentic Chat Assistant</h2>
            <p className="text-[10px] text-muted-foreground">
              Powered by Vercel AI SDK & ParadeDB Vectorless BM25 Search
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs border-primary/40 text-primary flex items-center gap-1">
          <Database className="w-3 h-3" /> ParadeDB RAG
        </Badge>
      </div>

      {/* Citation Popover Dialog */}
      <Dialog open={!!selectedCitation} onOpenChange={() => setSelectedCitation(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Database className="w-4 h-4 text-primary" /> ParadeDB Chunk Source
            </DialogTitle>
            <DialogDescription className="text-xs">
              BM25 Search Score: <span className="font-bold text-primary">{selectedCitation?.bm25Score?.toFixed(3) || 'N/A'}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-xl bg-secondary/30 border border-border text-xs space-y-2 leading-relaxed">
            <p className="font-mono text-muted-foreground whitespace-pre-wrap">{selectedCitation?.content}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Messages Stream Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {!activeNotebook ? (
          <div className="h-full flex items-center justify-center p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            Select or create a notebook to begin chatting with your AI agent.
          </div>
        ) : messages && messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3 border border-dashed border-border rounded-xl bg-secondary/10">
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Notebook AI Assistant Ready</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Ask questions about your uploaded documents. The AI agent will autonomously search ParadeDB and cite facts.
              </p>
            </div>
          </div>
        ) : (
          messages && messages.map((message: any) => (
            <div
              key={message.id}
              className={`flex space-x-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] space-y-2 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                <Card
                  className={`p-3 text-xs leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border/80 text-foreground'
                  }`}
                >
                  {/* Render Message Parts */}
                  <div className="whitespace-pre-wrap">
                    {message.parts
                      ? message.parts.map((part: any, i: number) => {
                          if (part.type === 'text') return <span key={i}>{part.text}</span>;
                          return null;
                        })
                      : message.content}
                  </div>

                  {/* Render Tool Invocations (e.g. searchParadeDB or createNotebookNote) */}
                  {message.toolInvocations?.map((toolInvocation: any) => {
                    const { toolName, toolCallId, state } = toolInvocation;
                    return (
                      <div
                        key={toolCallId}
                        className="mt-2 p-2 rounded-lg bg-secondary/50 border border-border/60 text-[11px] space-y-1"
                      >
                        <div className="flex items-center gap-1.5 font-medium text-primary">
                          {toolName === 'searchParadeDB' ? (
                            <Database className="w-3.5 h-3.5" />
                          ) : (
                            <FilePlus className="w-3.5 h-3.5" />
                          )}
                          <span>Tool Call: {toolName}</span>
                          {state === 'call' && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                        </div>

                        {/* Display retrieved ParadeDB chunks as clickable citations */}
                        {toolName === 'searchParadeDB' && state === 'result' && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(toolInvocation.result as any)?.results?.map((res: any, idx: number) => (
                              <button
                                key={res.id || idx}
                                onClick={() => setSelectedCitation(res)}
                                className="px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Info className="w-2.5 h-2.5" /> Chunk #{res.chunkIndex + 1}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Card>
              </div>

              {message.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-center space-x-2 text-xs text-primary bg-primary/5 p-2 rounded-lg border border-primary/20 w-fit">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>AI Agent is analyzing ParadeDB sources & generating response...</span>
          </div>
        )}

        {error && (
          <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
            {error.message || 'Failed to complete agentic chat query'}
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form onSubmit={onSubmit} className="flex items-center space-x-2 shrink-0 pt-2 border-t border-border">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={activeNotebook ? 'Ask anything about your notebook sources...' : 'Select a notebook to chat'}
          disabled={!activeNotebook || isLoading}
          className="flex-1 bg-secondary/30 border border-input rounded-xl px-4 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!activeNotebook || !input.trim() || isLoading}
          className="bg-primary text-primary-foreground shrink-0 rounded-xl"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
}
