'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuth } from '@clerk/nextjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Database,
  FilePlus,
  Loader2,
  Info,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  CornerDownLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNotebookStore } from '@/store/useNotebookStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text || copied) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground/70 hover:text-foreground hover:bg-secondary transition-colors"
          onClick={handleCopy}
        >
          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          <span className="sr-only">Copy text</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px]">
        {copied ? 'Copied to clipboard!' : 'Copy response'}
      </TooltipContent>
    </Tooltip>
  );
}

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Automatically scroll to bottom whenever messages update or while streaming
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, status, isLoading]);

  // Hydrate chat history on notebook switch
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

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isLoading || isHistoryLoading) return;
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage({ text });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {/* Citation Popover Dialog */}
        <Dialog open={!!selectedCitation} onOpenChange={() => setSelectedCitation(null)}>
          <DialogContent className="sm:max-w-[520px] bg-card border-border shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                <Database className="w-4 h-4 text-primary" /> ParadeDB Chunk Source
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>BM25 Search Score:</span>
                <Badge variant="secondary" className="font-mono text-[10px] text-primary bg-primary/10">
                  {selectedCitation?.bm25Score?.toFixed(3) ?? 'N/A'}
                </Badge>
              </DialogDescription>
            </DialogHeader>
            <Card className="bg-secondary/40 border-border/80">
              <CardContent className="p-3.5">
                <p className="font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                  {selectedCitation?.content}
                </p>
              </CardContent>
            </Card>
          </DialogContent>
        </Dialog>

        {/* Action Bar Header */}
        <div className="flex items-center justify-between px-1 pb-2 shrink-0 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[11px] font-normal gap-1 px-2 py-0.5">
              <Database className="w-3 h-3 text-primary" />
              {messages.length > 0
                ? `${messages.length} message${messages.length === 1 ? '' : 's'}`
                : 'New conversation'}
            </Badge>
          </div>

          {messages.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearHistory}
                  disabled={isClearing || isLoading}
                  className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  {isClearing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Clear History
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[11px]">
                Erase notebook conversation memory
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <Separator className="mb-3" />

        {/* Scrollable Message List with internal overflow containment */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4 scroll-smooth"
        >
          <div className="space-y-4 pb-2">
            {isHistoryLoading ? (
              <div className="h-48 flex flex-col items-center justify-center space-y-2 text-xs text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span>Loading conversation history...</span>
              </div>
            ) : !messages || messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 border border-dashed border-border rounded-xl bg-secondary/10 mt-6">
                <Avatar className="w-12 h-12 bg-primary/10 border border-primary/20 text-primary">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <Bot className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">Notebook AI Assistant Ready</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Ask questions grounded in your uploaded documents. The AI searches ParadeDB BM25
                    chunks and attributes factual sources.
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

                const isUser = message.role === 'user';

                return (
                  <div
                    key={message.id || `msg-${idx}`}
                    className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Role Avatar */}
                    <Avatar
                      className={`w-7 h-7 shrink-0 text-xs ${
                        isUser
                          ? 'bg-secondary border border-border text-foreground'
                          : 'bg-primary/10 border border-primary/30 text-primary'
                      }`}
                    >
                      <AvatarFallback
                        className={
                          isUser ? 'bg-secondary text-foreground' : 'bg-primary/10 text-primary'
                        }
                      >
                        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                      </AvatarFallback>
                    </Avatar>

                    {/* Message Bubble */}
                    <div
                      className={`flex flex-col max-w-[85%] space-y-1.5 ${
                        isUser ? 'items-end' : 'items-start'
                      }`}
                    >
                      <Card
                        className={`text-xs shadow-xs ${
                          isUser
                            ? 'bg-primary text-primary-foreground border-primary px-3.5 py-2.5 rounded-2xl rounded-tr-xs'
                            : 'bg-card border-border/80 text-foreground px-3.5 py-3 rounded-2xl rounded-tl-xs'
                        }`}
                      >
                        {/* Markdown Formatter */}
                        <div className="prose-xs max-w-none break-words leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              strong: ({ children }) => (
                                <strong className="font-semibold text-foreground">{children}</strong>
                              ),
                              b: ({ children }) => (
                                <strong className="font-semibold text-foreground">{children}</strong>
                              ),
                              p: ({ children }) => (
                                <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc list-outside pl-4 my-1.5 space-y-1">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal list-outside pl-4 my-1.5 space-y-1">
                                  {children}
                                </ol>
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
                                  <table className="w-full text-left text-[11px] border-collapse">
                                    {children}
                                  </table>
                                </div>
                              ),
                              th: ({ children }) => (
                                <th className="border-b border-border bg-secondary/50 p-1.5 font-semibold text-foreground">
                                  {children}
                                </th>
                              ),
                              td: ({ children }) => (
                                <td className="border-b border-border/50 p-1.5">{children}</td>
                              ),
                              h1: ({ children }) => (
                                <h1 className="text-sm font-bold my-2 text-foreground">{children}</h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="text-xs font-bold my-1.5 text-foreground">{children}</h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-xs font-semibold my-1 text-foreground">
                                  {children}
                                </h3>
                              ),
                            }}
                          >
                            {messageText}
                          </ReactMarkdown>
                        </div>

                        {/* Tool Invocations / ParadeDB Citations */}
                        {((message.parts as any[])?.filter(
                          (p: any) => p.type?.startsWith('tool-') || p.type === 'dynamic-tool'
                        ) ||
                          (message.toolInvocations as any[]) ||
                          [])?.map((toolPart: any, toolIdx: number) => {
                          const toolName =
                            toolPart.toolName || toolPart.type?.replace('tool-', '');
                          const toolCallId = toolPart.toolCallId || `tool-${toolIdx}`;
                          const state = toolPart.state;
                          const output = toolPart.output || toolPart.result;

                          return (
                            <div
                              key={toolCallId}
                              className="mt-2.5 p-2 rounded-lg bg-secondary/60 border border-border/60 text-[11px] space-y-1.5"
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
                                    <Button
                                      key={res.id || i}
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSelectedCitation(res)}
                                      className="h-5 px-2 text-[10px] font-mono text-primary bg-primary/5 hover:bg-primary/15 border-primary/30 gap-1 rounded"
                                    >
                                      <Info className="w-2.5 h-2.5" /> Chunk #{res.chunkIndex + 1}
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </Card>

                      {/* Footer Actions (Copy Button) */}
                      {!isUser && messageText && (
                        <div className="flex items-center gap-1 pl-1">
                          <CopyMessageButton text={messageText} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 px-3 py-2 rounded-xl border border-primary/20 w-fit animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Searching ParadeDB &amp; synthesizing answer...</span>
              </div>
            )}

            {error && (
              <Card className="bg-destructive/10 border-destructive/20 text-destructive text-xs p-3 font-medium">
                {error.message || 'Failed to complete agentic chat query'}
              </Card>
            )}

            <div className="h-0" />
          </div>
        </div>

        {/* Input Bar Form */}
        <div className="pt-2 shrink-0">
          <Card className="p-1.5 border-border bg-card shadow-xs focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all rounded-xl">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask anything about your notebook documents... (Enter to send, Shift+Enter for new line)"
                disabled={isLoading || isHistoryLoading}
                className="min-h-[38px] max-h-[140px] resize-none border-0 shadow-none focus-visible:ring-0 text-xs px-2.5 py-2 placeholder:text-muted-foreground"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isLoading || isHistoryLoading}
                    className="h-8 w-8 rounded-lg bg-primary text-primary-foreground shrink-0 transition-transform active:scale-95"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px] flex items-center gap-1">
                  <span>Send</span>
                  <CornerDownLeft className="w-2.5 h-2.5 text-muted-foreground" />
                </TooltipContent>
              </Tooltip>
            </div>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function ChatStudioPanel() {
  const { activeNotebook } = useNotebookStore();

  return (
    <div className="flex flex-col h-full min-h-0 bg-background border-r border-border p-4 space-y-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5">
          <Avatar className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 text-primary">
            <AvatarFallback className="bg-primary/10 text-primary rounded-lg">
              <Sparkles className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-base tracking-tight leading-tight">
              Agentic Chat Assistant
            </h2>
            <p className="text-[10px] text-muted-foreground">
              Powered by Vercel AI SDK &amp; ParadeDB Vectorless BM25 Search
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-xs border-primary/40 text-primary flex items-center gap-1 font-mono"
        >
          <Database className="w-3 h-3" /> ParadeDB RAG
        </Badge>
      </div>

      <Separator />

      {/* Main Chat Workspace */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {activeNotebook ? (
          <ChatStreamView key={activeNotebook.id} notebookId={activeNotebook.id} />
        ) : (
          <div className="h-full flex items-center justify-center p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-secondary/5">
            Select or create a notebook to begin chatting with your AI agent.
          </div>
        )}
      </div>
    </div>
  );
}
