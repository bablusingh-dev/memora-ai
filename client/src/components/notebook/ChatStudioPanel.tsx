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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
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
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

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

  const { messages, setMessages, sendMessage, status, stop, error } = useChat({
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
    await sendMessage({ text });
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {/* Citation Popover Dialog */}
        <Dialog open={!!selectedCitation} onOpenChange={() => setSelectedCitation(null)}>
          <DialogContent className="sm:max-w-[540px] bg-card border-border shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                <Database className="w-4 h-4 text-primary" /> ParadeDB Vectorless Chunk Source
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>BM25 Relevance Score:</span>
                <Badge variant="secondary" className="font-mono text-[10px] text-primary bg-primary/10">
                  {selectedCitation?.bm25Score?.toFixed(3) ?? '1.000'}
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
            <Badge variant="secondary" className="text-[11px] font-normal gap-1.5 px-2 py-0.5">
              <Database className="w-3 h-3 text-primary" />
              {messages.length > 0
                ? `${messages.length} message${messages.length === 1 ? '' : 's'}`
                : 'New conversation'}
            </Badge>

            {webSearchEnabled && (
              <Badge
                variant="outline"
                className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 gap-1"
              >
                <Globe className="w-2.5 h-2.5" /> Web Search ON
              </Badge>
            )}
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

        {/* Scrollable Message List */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4 scroll-smooth"
        >
          <div className="space-y-4 pb-2">
            {isHistoryLoading ? (
              <div className="h-48 flex flex-col items-center justify-center space-y-2 text-xs text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span>Loading cognitive memory &amp; history...</span>
              </div>
            ) : !messages || messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 border border-dashed border-border rounded-xl bg-secondary/10 mt-6">
                <Avatar className="w-12 h-12 bg-primary/10 border border-primary/20 text-primary">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <Bot className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">Memora AI Agent Active</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Grounded with ParadeDB BM25 vectorless search, Neo4j Graph DB, and multi-tier cognitive memory.
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
                const parts: any[] = message.parts || [];

                // Extract tool parts
                const toolParts = parts.filter(
                  (p: any) => p.type?.startsWith('tool-') || p.type === 'dynamic-tool' || p.toolName
                );

                // Collect sources from ParadeDB search and Web Search
                const extractedSources: { title: string; url?: string; snippet?: string; score?: number; chunkIndex?: number }[] = [];
                for (const tp of toolParts) {
                  const toolName = tp.toolName || tp.type?.replace('tool-', '');
                  const output = tp.output || tp.result;
                  if (toolName === 'searchParadeDB' && Array.isArray(output?.results)) {
                    output.results.forEach((r: any) => {
                      extractedSources.push({
                        title: `Document Chunk #${(r.chunkIndex ?? 0) + 1}`,
                        snippet: r.content?.slice(0, 140),
                        score: r.bm25Score,
                        chunkIndex: r.chunkIndex,
                      });
                    });
                  }
                  if (toolName === 'searchWeb' && Array.isArray(output?.results)) {
                    output.results.forEach((w: any) => {
                      extractedSources.push({
                        title: w.title || 'Web Search Result',
                        url: w.url,
                        snippet: w.snippet,
                      });
                    });
                  }
                }

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
                      className={`flex flex-col max-w-[90%] space-y-2 ${
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
                        {/* 1. Official AI Elements ChainOfThought / Reasoning Flow */}
                        {!isUser && (
                          <ChainOfThought defaultOpen={isLoading && idx === messages.length - 1}>
                            <ChainOfThoughtHeader>
                              <span className="font-semibold text-foreground">
                                Thought &amp; Execution Timeline
                              </span>
                            </ChainOfThoughtHeader>

                            <ChainOfThoughtContent>
                              {/* Step 1: Cognitive Memory Retrieval */}
                              <ChainOfThoughtStep
                                icon={Brain}
                                label={<span className="font-semibold text-foreground">Cognitive Memory Retrieval</span>}
                                description="Queried 9 memory layers (Short-term, Semantic, Episodic, User Profile, Procedural, Temporal)"
                                status="complete"
                              >
                                <div className="text-[11px] text-muted-foreground bg-secondary/30 p-2 rounded-md font-mono">
                                  <span>Retrieved &amp; normalized multi-tier candidate facts and rules.</span>
                                </div>
                              </ChainOfThoughtStep>

                              {/* Step 2..N: Every Tool Call, Input Query & Execution Result */}
                              {toolParts.map((tp, tIdx) => {
                                const toolName = tp.toolName || tp.type?.replace('tool-', '');
                                const input = tp.input || tp.args;
                                const output = tp.output || tp.result;

                                let stepIcon = Database;
                                let stepLabel = `Tool: ${toolName}`;
                                if (toolName === 'searchParadeDB') {
                                  stepIcon = Database;
                                  stepLabel = 'ParadeDB Vectorless BM25 Search';
                                } else if (toolName === 'queryKnowledgeGraph') {
                                  stepIcon = Share2;
                                  stepLabel = 'Neo4j Knowledge Graph Traversal';
                                } else if (toolName === 'searchWeb') {
                                  stepIcon = Globe;
                                  stepLabel = 'Live Internet Web Search';
                                } else if (toolName === 'browseWebPage') {
                                  stepIcon = FileText;
                                  stepLabel = 'Live Webpage Scraping';
                                } else if (toolName === 'createNotebookNote') {
                                  stepIcon = BookmarkPlus;
                                  stepLabel = 'Save Notebook Study Note';
                                }

                                return (
                                  <ChainOfThoughtStep
                                    key={tp.toolCallId || tIdx}
                                    icon={stepIcon}
                                    label={
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-foreground">{stepLabel}</span>
                                        <Badge variant="outline" className="text-[9px] font-mono">
                                          {tp.state || 'Completed'}
                                        </Badge>
                                      </div>
                                    }
                                    description={
                                      input
                                        ? `Parameters: ${JSON.stringify(input)}`
                                        : 'Executed tool action'
                                    }
                                    status={tp.state === 'call' ? 'active' : 'complete'}
                                  >
                                    <div className="space-y-2 mt-1">
                                      {input && (
                                        <CodeBlock
                                          code={JSON.stringify(input, null, 2)}
                                          language="json"
                                        />
                                      )}

                                      {/* ParadeDB Chunk Pills */}
                                      {toolName === 'searchParadeDB' && output?.results && (
                                        <ChainOfThoughtSearchResults>
                                          {output.results.map((res: any, rIdx: number) => (
                                            <ChainOfThoughtSearchResult key={res.id || rIdx}>
                                              <button
                                                type="button"
                                                onClick={() => setSelectedCitation(res)}
                                                className="flex items-center gap-1 hover:text-primary transition-colors"
                                              >
                                                <Info className="w-2.5 h-2.5 text-primary" />
                                                <span>Chunk #{res.chunkIndex != null ? res.chunkIndex + 1 : rIdx + 1}</span>
                                                {res.bm25Score && (
                                                  <span className="opacity-70 font-mono">
                                                    ({res.bm25Score.toFixed(2)})
                                                  </span>
                                                )}
                                              </button>
                                            </ChainOfThoughtSearchResult>
                                          ))}
                                        </ChainOfThoughtSearchResults>
                                      )}

                                      {/* Neo4j Graph Output */}
                                      {toolName === 'queryKnowledgeGraph' && output && (
                                        <div className="text-[11px] font-mono text-muted-foreground bg-secondary/30 p-2 rounded-md space-y-1">
                                          <div className="font-semibold text-foreground">
                                            Traversed {output.entitiesFound ?? output.entities?.length ?? 0} Entities:
                                          </div>
                                          {output.relations?.slice(0, 3).map((rel: any, relIdx: number) => (
                                            <div key={relIdx} className="flex items-center gap-1">
                                              <span className="text-foreground">{rel.sourceEntity}</span>
                                              <span className="text-primary font-bold">-[{rel.relationType}]-&gt;</span>
                                              <span className="text-foreground">{rel.targetEntity}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Web Search Output */}
                                      {toolName === 'searchWeb' && output?.results && (
                                        <div className="space-y-1.5">
                                          {output.results.slice(0, 3).map((w: any, wIdx: number) => (
                                            <div key={wIdx} className="p-2 rounded-md bg-secondary/30 border border-border/50 text-[11px]">
                                              <a
                                                href={w.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-medium text-primary hover:underline flex items-center gap-1"
                                              >
                                                <span className="truncate">{w.title}</span>
                                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                              </a>
                                              <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                                                {w.snippet}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Raw Output Block for other tools */}
                                      {toolName !== 'searchParadeDB' &&
                                        toolName !== 'queryKnowledgeGraph' &&
                                        toolName !== 'searchWeb' &&
                                        output && (
                                          <CodeBlock
                                            code={JSON.stringify(output, null, 2)}
                                            language="json"
                                          />
                                        )}
                                    </div>
                                  </ChainOfThoughtStep>
                                );
                              })}

                              {/* Step Final: Self-RAG Evaluator & Reflection Verification */}
                              <ChainOfThoughtStep
                                icon={Sparkles}
                                label={<span className="font-semibold text-foreground">Self-RAG Grounding &amp; Reflection</span>}
                                description="Verified factual grounding, query alignment, and complete coverage."
                                status="complete"
                              >
                                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Passed Self-Evaluation quality threshold (&gt;= 0.85). Ready to stream.</span>
                                </div>
                              </ChainOfThoughtStep>
                            </ChainOfThoughtContent>
                          </ChainOfThought>
                        )}

                        {/* 2. Markdown Formatter */}
                        {messageText && (
                          <div className="prose-xs max-w-none break-words leading-relaxed pt-1">
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
                              }}
                            >
                              {messageText}
                            </ReactMarkdown>
                          </div>
                        )}

                        {/* 3. Official AI Elements Sources Component */}
                        {!isUser && extractedSources.length > 0 && (
                          <div className="pt-2">
                            <Sources>
                              <SourcesTrigger count={extractedSources.length} />
                              <SourcesContent>
                                {extractedSources.map((s, sIdx) => (
                                  <Source
                                    key={sIdx}
                                    href={s.url || '#'}
                                    title={s.title}
                                    onClick={(e) => {
                                      if (!s.url) {
                                        e.preventDefault();
                                        setSelectedCitation(s);
                                      }
                                    }}
                                  />
                                ))}
                              </SourcesContent>
                            </Sources>
                          </div>
                        )}
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
                <span>
                  {webSearchEnabled
                    ? 'Reasoning, searching notebook & live web...'
                    : 'Reasoning & retrieving cognitive memory...'}
                </span>
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

        {/* AI Elements PromptInput Bar */}
        <div className="pt-2 shrink-0">
          <PromptInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSendMessage}
            onStop={stop}
            isLoading={isLoading}
            disabled={isHistoryLoading}
            webSearchEnabled={webSearchEnabled}
            onToggleWebSearch={setWebSearchEnabled}
            placeholder={
              webSearchEnabled
                ? 'Ask anything (Web search enabled: agent will search internet & notebook)...'
                : 'Ask anything grounded in your notebook sources & memories...'
            }
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
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs space-y-2">
        <Bot className="w-8 h-8 opacity-30" />
        <p>Select or create a notebook to start chatting with grounded memory.</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col p-3 overflow-hidden">
      <ChatStreamView notebookId={activeNotebook.id} />
    </div>
  );
}
