'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuth } from '@clerk/nextjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  User,
  Sparkles,
  Database,
  Loader2,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Share2,
  Brain,
  FileText,
  BookmarkPlus,
  CheckCircle2,
  Info,
  Search,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useNotebookStore } from '@/store/useNotebookStore';
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
  ChainOfThoughtSearchResults,
  ChainOfThoughtSearchResult,
} from '@/components/ai-elements/chain-of-thought';
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
  Source,
} from '@/components/ai-elements/sources';
import { CodeBlock } from '@/components/ai-elements/code-block';
import { PromptInput } from '@/components/ai-elements/PromptInput';

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
          className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
          onClick={handleCopy}
        >
          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          <span className="sr-only">Copy text</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px] border-0">
        {copied ? 'Copied to clipboard!' : 'Copy response'}
      </TooltipContent>
    </Tooltip>
  );
}

function SaveNoteButton({ title, text }: { title: string; text: string }) {
  const [saved, setSaved] = useState(false);
  const { createNote } = useNotebookStore();

  const handleSave = async () => {
    if (!text || saved) return;
    try {
      await createNote(title, text, 'ai_summary');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      // ignore
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors gap-1"
          onClick={handleSave}
        >
          {saved ? (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-500 font-semibold">Saved</span>
            </>
          ) : (
            <>
              <BookmarkPlus className="w-3 h-3" />
              <span>Save to Notes</span>
            </>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px] border-0">
        Save response directly to workspace studio notes
      </TooltipContent>
    </Tooltip>
  );
}

function ChatStreamView({ notebookId }: { notebookId: string }) {
  const [selectedCitation, setSelectedCitation] = useState<any | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const { activeNotebook } = useNotebookStore();

  const webSearchRef = useRef(webSearchEnabled);
  useEffect(() => {
    webSearchRef.current = webSearchEnabled;
  }, [webSearchEnabled]);

  const { getToken, isLoaded, isSignedIn } = useAuth();

  const backendBase =
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000')
      : 'http://localhost:5000';
  const apiEndpoint = `${backendBase}/api/v1/notebooks/${notebookId}/chat`;

  const { messages, setMessages, sendMessage, status, stop } = useChat({
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
      body: () => ({
        enableWebSearch: webSearchRef.current,
      }),
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on messages change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, status, isLoading]);

  // Hydrate chat history
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

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading || isHistoryLoading) return;
    setInputValue('');
    await sendMessage({ text });
  };

  const suggestPrompt = (text: string) => {
    handleSendMessage(text);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full min-h-0 overflow-hidden bg-transparent p-4 space-y-3">
        {/* Citation Inspect Modal */}
        <Dialog open={!!selectedCitation} onOpenChange={() => setSelectedCitation(null)}>
          <DialogContent className="sm:max-w-[540px] bg-card border-0 text-foreground rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Database className="w-4 h-4 text-primary" />
                <span>ParadeDB BM25 Chunk Citation</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                <span>BM25 Match Score:</span>
                <Badge variant="secondary" className="font-mono text-[10px] text-primary bg-primary/10 border-0">
                  {selectedCitation?.score?.toFixed(3) ?? '1.000'}
                </Badge>
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 rounded-2xl bg-muted/30 border-0">
              <p className="font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {selectedCitation?.snippet || selectedCitation?.content || 'No raw chunk preview available.'}
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Action Header */}
        <div className="flex items-center justify-between shrink-0 text-xs text-muted-foreground">
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 border-0 gap-1">
              <Database className="w-3 h-3" />
              <span>Grounded Chat</span>
            </Badge>
            <span className="text-[11px] font-medium text-muted-foreground">
              {messages.length > 0 ? `${messages.length} message${messages.length === 1 ? '' : 's'}` : 'New Session'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
                disabled={isClearing || isLoading}
                className="h-7 px-2.5 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </Button>
            )}
          </div>
        </div>

        {/* Chat Message Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4"
        >
          {isHistoryLoading ? (
            <div className="h-48 flex flex-col items-center justify-center space-y-2 text-xs text-muted-foreground">
              <Bot className="w-6 h-6 text-primary" />
              <span>Hydrating cognitive chat history...</span>
            </div>
          ) : !messages || messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 border-0 rounded-3xl bg-muted/20 my-auto">
              <div className="p-4 rounded-3xl bg-primary/10 text-primary">
                <Brain className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="font-bold text-sm text-foreground">
                  Grounded Notebook LLM Studio
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ask questions, request summaries, or generate study guides based strictly on your workspace sources.
                </p>
              </div>

              {/* Starter Chips */}
              <div className="w-full max-w-md pt-2 space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-left px-1">
                  Suggested Prompts
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  <button
                    onClick={() => suggestPrompt('Summarize the main arguments across all uploaded documents.')}
                    className="p-3 rounded-2xl bg-card hover:bg-muted/40 transition-colors border-0 shadow-2xs text-xs font-semibold text-foreground flex items-center justify-between group"
                  >
                    <span>Summarize Main Arguments</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                  </button>

                  <button
                    onClick={() => suggestPrompt('Generate a comprehensive study guide with key definitions and flashcards.')}
                    className="p-3 rounded-2xl bg-card hover:bg-muted/40 transition-colors border-0 shadow-2xs text-xs font-semibold text-foreground flex items-center justify-between group"
                  >
                    <span>Create Study Guide</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                  </button>

                  <button
                    onClick={() => suggestPrompt('What are the key technical concepts and takeaways?')}
                    className="p-3 rounded-2xl bg-card hover:bg-muted/40 transition-colors border-0 shadow-2xs text-xs font-semibold text-foreground flex items-center justify-between group"
                  >
                    <span>Key Concepts & Takeaways</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                  </button>

                  <button
                    onClick={() => suggestPrompt('Find exact source quotes and citation references for research notes.')}
                    className="p-3 rounded-2xl bg-card hover:bg-muted/40 transition-colors border-0 shadow-2xs text-xs font-semibold text-foreground flex items-center justify-between group"
                  >
                    <span>Find Source Quotes</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                  </button>
                </div>
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
              const parts: any[] = message.parts || [];

              // Extract tool parts
              const toolParts = parts.filter(
                (p: any) => p.type?.startsWith('tool-') || p.type === 'dynamic-tool' || p.toolName
              );

              // Collect sources
              const extractedSources: { title: string; snippet?: string; score?: number }[] = [];
              for (const tp of toolParts) {
                const toolName = tp.toolName || tp.type?.replace('tool-', '');
                const output = tp.output || tp.result;
                if (toolName === 'searchParadeDB' && Array.isArray(output?.results)) {
                  output.results.forEach((r: any) => {
                    extractedSources.push({
                      title: `Chunk #${(r.chunkIndex ?? 0) + 1}`,
                      snippet: r.content,
                      score: r.bm25Score,
                    });
                  });
                }
              }

              return (
                <div
                  key={message.id || idx}
                  className={`flex gap-3 text-xs ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <Avatar className="w-7 h-7 bg-primary/10 text-primary border-0 shrink-0 mt-0.5">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                        AI
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div className={`space-y-2 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                    {/* User Message Bubble */}
                    {isUser ? (
                      <div className="bg-primary text-primary-foreground px-4 py-2.5 rounded-3xl shadow-2xs font-medium leading-relaxed">
                        {messageText}
                      </div>
                    ) : (
                      /* AI Message Card */
                      <Card className="bg-card border-0 shadow-2xs rounded-3xl p-4 space-y-3">
                        {/* Chain of Thought RAG Timeline */}
                        {toolParts.length > 0 && (
                          <ChainOfThought defaultOpen={false}>
                            <ChainOfThoughtHeader>
                              RAG Execution Steps ({toolParts.length})
                            </ChainOfThoughtHeader>
                            <ChainOfThoughtContent>
                              {toolParts.map((tp: any, tIdx: number) => {
                                const toolName = tp.toolName || tp.type?.replace('tool-', '');
                                return (
                                  <ChainOfThoughtStep
                                    key={tIdx}
                                    icon={Database}
                                    label={<span className="font-semibold">{toolName}</span>}
                                    description="ParadeDB BM25 query executed"
                                  />
                                );
                              })}
                            </ChainOfThoughtContent>
                          </ChainOfThought>
                        )}

                        {/* Markdown Output */}
                        <div className="prose prose-xs dark:prose-invert max-w-none leading-relaxed text-foreground font-sans">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <CodeBlock
                                    language={match[1]}
                                    code={String(children).replace(/\n$/, '')}
                                  />
                                ) : (
                                  <code
                                    className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                );
                              },
                            }}
                          >
                            {messageText}
                          </ReactMarkdown>
                        </div>

                        {/* Citation Chips */}
                        {extractedSources.length > 0 && (
                          <Sources>
                            <SourcesTrigger count={extractedSources.length} />
                            <SourcesContent>
                              {extractedSources.map((src, sIdx) => (
                                <Source
                                  key={sIdx}
                                  title={src.title}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setSelectedCitation(src);
                                  }}
                                />
                              ))}
                            </SourcesContent>
                          </Sources>
                        )}

                        {/* Footer Action Controls */}
                        <div className="flex items-center justify-between pt-2 text-[11px] text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <CopyMessageButton text={messageText} />
                            <SaveNoteButton
                              title={`AI Answer - ${new Date().toLocaleTimeString()}`}
                              text={messageText}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Grounded • ParadeDB
                          </span>
                        </div>
                      </Card>
                    )}
                  </div>

                  {isUser && (
                    <Avatar className="w-7 h-7 bg-muted text-foreground border-0 shrink-0 mt-0.5">
                      <AvatarFallback className="bg-muted text-foreground font-bold text-xs">
                        U
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Input Bar */}
        <div className="shrink-0 pt-1">
          <PromptInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={() => handleSendMessage()}
            onStop={stop}
            isLoading={isLoading}
            webSearchEnabled={webSearchEnabled}
            onToggleWebSearch={setWebSearchEnabled}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

export function ChatStudioPanel() {
  const { activeNotebook } = useNotebookStore();

  if (!activeNotebook) {
    return (
      <div className="flex flex-col h-full min-h-0 items-center justify-center p-8 text-center space-y-3 bg-background">
        <Bot className="w-10 h-10 text-muted-foreground/60" />
        <h3 className="font-bold text-sm text-foreground">No Active Workspace Selected</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          Select or create a workspace using the header switcher to begin grounded AI chat.
        </p>
      </div>
    );
  }

  return <ChatStreamView key={activeNotebook.id} notebookId={activeNotebook.id} />;
}
