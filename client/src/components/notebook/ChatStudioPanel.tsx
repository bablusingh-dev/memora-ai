'use client';

import React, { useState, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuth } from '@clerk/nextjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, Sparkles, Database, FilePlus, Loader2, Info, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotebookStore } from '@/store/useNotebookStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

function ChatStreamView({ notebookId }: { notebookId: string }) {
  const [selectedCitation, setSelectedCitation] = useState<any | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const { getToken, isLoaded, isSignedIn } = useAuth();

  const backendBase =
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000')
      : 'http://localhost:5000';
  const apiEndpoint = `${backendBase}/api/v1/notebooks/${notebookId}/chat`;

  const { messages, setMessages, sendMessage, status, error } = useChat({
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

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Automatically scroll to bottom whenever messages update or while the AI streams
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, status, isLoading]);

  // Hydrate chat history on notebook load/switch once Clerk auth is ready
  useEffect(() => {
    let isCancelled = false;

    async function loadChatHistory() {
      if (!isLoaded) return;
      if (!isSignedIn) {
        setIsHistoryLoading(false);
        return;
      }

      setIsHistoryLoading(true);
      try {
        const token = await getToken().catch(() => null);
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(apiEndpoint, { headers });
        if (res.ok) {
          const json = await res.json();
          const dbMessages = json?.data?.messages || [];
          if (!isCancelled && Array.isArray(dbMessages)) {
            // Map database records into UIMessage format
            const formatted = dbMessages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              parts: m.parts || [{ type: 'text', text: m.content }],
            }));
            setMessages(formatted);
          }
        }
      } catch (err) {
        console.error('[ChatStudioPanel] Failed to load chat history:', err);
      } finally {
        if (!isCancelled) {
          setIsHistoryLoading(false);
        }
      }
    }

    loadChatHistory();

    return () => {
      isCancelled = true;
    };
  }, [notebookId, isLoaded, isSignedIn]);

  const handleClearHistory = async () => {
    if (isClearing || !messages || messages.length === 0) return;
    setIsClearing(true);
    try {
      const token = await getToken().catch(() => null);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(apiEndpoint, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setMessages([]);
      }
    } catch (err) {
      console.error('[ChatStudioPanel] Failed to clear chat history:', err);
    } finally {
      setIsClearing(false);
    }
  };

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

      {/* Action Bar (Clear Chat) */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Database className="w-3 h-3 text-primary" />
          {messages.length > 0 ? `${messages.length} messages in conversation` : 'New conversation'}
        </span>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearHistory}
            disabled={isClearing || isLoading}
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            {isClearing ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Trash2 className="w-3 h-3 mr-1" />
            )}
            Clear History
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto space-y-4 pr-1 scroll-smooth">
        {isHistoryLoading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-2 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Loading conversation history...</span>
          </div>
        ) : !messages || messages.length === 0 ? (
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
          messages.map((message: any, idx: number) => {
            const messageText = message.content
              ? message.content
              : (message.parts as any[])
                  ?.filter((p: any) => p.type === 'text')
                  .map((p: any) => p.text)
                  .join('') || '';

            return (
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
                    {/* Markdown Renderer for Rich Formatted Responses */}
                    <div className="prose-xs max-w-none break-words">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          strong: ({ children }) => (
                            <strong className="font-semibold text-foreground">{children}</strong>
                          ),
                          b: ({ children }) => (
                            <strong className="font-semibold text-foreground">{children}</strong>
                          ),
                          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                          ul: ({ children }) => (
                            <ul className="list-disc list-outside pl-4 my-1.5 space-y-1">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal list-outside pl-4 my-1.5 space-y-1">{children}</ol>
                          ),
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-primary font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
                            >
                              <span>{children}</span>
                              <ExternalLink className="w-2.5 h-2.5 inline shrink-0 ml-0.5" />
                            </a>
                          ),
                          code: ({ inline, className, children, ...props }: any) => {
                            if (inline) {
                              return (
                                <code
                                  className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[11px] border border-border/50"
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            }
                            return (
                              <pre className="p-2.5 my-2 rounded-lg bg-secondary/80 text-foreground font-mono text-[11px] overflow-x-auto border border-border/60">
                                <code {...props}>{children}</code>
                              </pre>
                            );
                          },
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-primary pl-2.5 my-2 italic text-muted-foreground">
                              {children}
                            </blockquote>
                          ),
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-2 border border-border rounded-lg">
                              <table className="w-full text-left text-[11px] border-collapse">{children}</table>
                            </div>
                          ),
                          th: ({ children }) => (
                            <th className="border-b border-border bg-secondary/50 p-1.5 font-semibold text-foreground">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => <td className="border-b border-border/50 p-1.5">{children}</td>,
                          h1: ({ children }) => <h1 className="text-sm font-bold my-2 text-foreground">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-xs font-bold my-1.5 text-foreground">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-xs font-semibold my-1 text-foreground">{children}</h3>,
                        }}
                      >
                        {messageText}
                      </ReactMarkdown>
                    </div>

                    {/* Render Tool Invocations from v4 parts or legacy toolInvocations */}
                    {((message.parts as any[])?.filter(
                      (p: any) => p.type?.startsWith('tool-') || p.type === 'dynamic-tool'
                    ) ||
                      (message.toolInvocations as any[]) ||
                      [])?.map((toolPart: any, toolIdx: number) => {
                      const toolName = toolPart.toolName || toolPart.type?.replace('tool-', '');
                      const toolCallId = toolPart.toolCallId || `tool-${toolIdx}`;
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
            );
          })
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

        {/* Scroll Anchor */}
        <div ref={messagesEndRef} className="h-0" />
      </div>

      {/* Input */}
      <form onSubmit={onSubmit} className="flex items-center gap-2 shrink-0 pt-2 border-t border-border">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask anything about your notebook sources..."
          disabled={isLoading || isHistoryLoading}
          className="flex-1 bg-secondary/30 border border-input rounded-xl px-4 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!inputValue.trim() || isLoading || isHistoryLoading}
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
