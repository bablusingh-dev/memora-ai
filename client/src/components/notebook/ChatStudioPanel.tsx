'use client';

import React, { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuth } from '@clerk/nextjs';
import { Send, Bot, User, Sparkles, Database, FilePlus, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotebookStore } from '@/store/useNotebookStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

function ChatStreamView({ notebookId }: { notebookId: string }) {
  const [selectedCitation, setSelectedCitation] = useState<any | null>(null);
  const [inputValue, setInputValue] = useState('');

  const { getToken } = useAuth();

  // Point the stream directly at Express, bypassing the Next.js rewrite proxy.
  // Next.js rewrites buffer SSE responses before forwarding — direct fetch preserves real-time chunks.
  const backendBase =
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000')
      : 'http://localhost:5000';
  const apiEndpoint = `${backendBase}/api/v1/notebooks/${notebookId}/chat`;

  // throttle: 50ms forces React to re-render every 50ms as stream chunks arrive
  // Without it, React batches updates and the UI appears to freeze until stream ends
  const { messages, sendMessage, status, error } = useChat({
    id: notebookId,
    throttle: 50,
    transport: new DefaultChatTransport({
      api: apiEndpoint,
      headers: async (): Promise<Record<string, string>> => {
        const token = await getToken().catch(() => null);
        const result: Record<string, string> = {};
        if (token) result['Authorization'] = `Bearer ${token}`;
        return result;
      },
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue('');
    await sendMessage({ text });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Citation Popover Dialog */}
      <Dialog open={!!selectedCitation} onOpenChange={() => setSelectedCitation(null)}>
        <DialogContent className="sm:max-w-[500px] bg-white border border-slate-200 text-slate-900 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Database className="w-4 h-4 text-primary" /> ParadeDB Chunk Source
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              BM25 Search Score:{' '}
              <span className="font-bold text-primary">
                {selectedCitation?.bm25Score?.toFixed(3) ?? 'N/A'}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs leading-relaxed">
            <p className="font-mono text-slate-700 whitespace-pre-wrap">{selectedCitation?.content}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {!messages || messages.length === 0 ? (
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
          messages.map((message: any, idx: number) => (
            <div
              key={message.id || `msg-${idx}`}
              className={`flex space-x-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                <Card
                  className={`p-3 text-xs leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border/80 text-foreground'
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {message.content
                      ? message.content
                      : (message.parts as any[])
                          ?.filter((p: any) => p.type === 'text')
                          .map((p: any, i: number) => <span key={i}>{p.text}</span>)}
                  </div>

                  {/* Render Tool Invocations from v4 parts or legacy toolInvocations */}
                  {((message.parts as any[])?.filter((p: any) => p.type?.startsWith('tool-') || p.type === 'dynamic-tool') ||
                    (message.toolInvocations as any[]) ||
                    [])?.map((toolPart: any, idx: number) => {
                    const toolName = toolPart.toolName || toolPart.type?.replace('tool-', '');
                    const toolCallId = toolPart.toolCallId || `tool-${idx}`;
                    const state = toolPart.state;
                    const output = toolPart.output || toolPart.result;

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
                          <span>Tool: {toolName}</span>
                          {(state === 'call' || state === 'input-streaming') && (
                            <Loader2 className="w-3 h-3 animate-spin ml-auto" />
                          )}
                        </div>

                        {toolName === 'searchParadeDB' && (state === 'result' || output?.results) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {output?.results?.map((res: any, i: number) => (
                              <button
                                key={res.id || i}
                                onClick={() => setSelectedCitation(res)}
                                className="px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-[10px] font-mono flex items-center gap-1 transition-colors"
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
            <span>Analyzing sources &amp; generating response...</span>
          </div>
        )}

        {error && (
          <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium">
            {error.message || 'Failed to complete agentic chat query'}
          </div>
        )}
      </div>

      {/* Input — managed with local React state, no v3 handleInputChange needed */}
      <form onSubmit={onSubmit} className="flex items-center gap-2 shrink-0 pt-2 border-t border-border">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask anything about your notebook sources..."
          disabled={isLoading}
          className="flex-1 bg-secondary/30 border border-input rounded-xl px-4 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!inputValue.trim() || isLoading}
          className="bg-primary text-primary-foreground shrink-0 rounded-xl"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
}

export function ChatStudioPanel() {
  const { activeNotebook } = useNotebookStore();

  return (
    <div className="flex flex-col h-full bg-background border-r border-border p-4 space-y-4">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg tracking-tight">Agentic Chat Assistant</h2>
            <p className="text-[10px] text-muted-foreground">
              Powered by Vercel AI SDK &amp; ParadeDB Vectorless BM25 Search
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs border-primary/40 text-primary flex items-center gap-1">
          <Database className="w-3 h-3" /> ParadeDB RAG
        </Badge>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeNotebook ? (
          <ChatStreamView key={activeNotebook.id} notebookId={activeNotebook.id} />
        ) : (
          <div className="h-full flex items-center justify-center p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            Select or create a notebook to begin chatting with your AI agent.
          </div>
        )}
      </div>
    </div>
  );
}
